import { logger } from '@/lib/logger'

// =============================================================================
// Circuit Breaker Pattern (Per-User Isolation)
// =============================================================================

interface CircuitState {
  failures: number
  lastFailure: number
  isOpen: boolean
}

export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3, // Open circuit after 3 consecutive failures
  resetTimeoutMs: 60000, // Try again after 60 seconds
  halfOpenMaxAttempts: 1, // Allow 1 probe request when half-open
}

// Cleanup configuration
const CIRCUIT_CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const CIRCUIT_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
let lastCircuitCleanup = Date.now()

// Track circuit state per tool:user (reset on server restart)
const toolCircuits = new Map<string, CircuitState>()

// Metrics collection
interface CircuitMetrics {
  totalFailures: number
  totalSuccesses: number
  circuitOpens: number
  circuitCloses: number
  byTool: Map<string, { failures: number; successes: number }>
}

const circuitMetrics: CircuitMetrics = {
  totalFailures: 0,
  totalSuccesses: 0,
  circuitOpens: 0,
  circuitCloses: 0,
  byTool: new Map(),
}

/**
 * Generate a unique circuit breaker key per user and tool
 * Provides per-user isolation so one user's failures don't affect others
 */
function getCircuitBreakerKey(toolName: string, userId?: string): string {
  if (!userId) {
    // Fallback to tool-only key for backwards compatibility
    return toolName
  }
  return `${toolName}:${userId}`
}

/**
 * Parse circuit key to extract tool and userId
 */
function parseCircuitKey(key: string): { tool: string; userId?: string } {
  const parts = key.split(':')
  if (parts.length === 1) {
    return { tool: parts[0] }
  }
  return { tool: parts[0], userId: parts[1] }
}

/**
 * Update metrics for a tool
 */
function updateToolMetrics(toolName: string, type: 'failure' | 'success'): void {
  const toolStats = circuitMetrics.byTool.get(toolName) || { failures: 0, successes: 0 }
  if (type === 'failure') {
    toolStats.failures++
    circuitMetrics.totalFailures++
  } else {
    toolStats.successes++
    circuitMetrics.totalSuccesses++
  }
  circuitMetrics.byTool.set(toolName, toolStats)
}

/**
 * Clean up expired circuit states to prevent memory leaks
 * Called periodically during tool execution
 */
function cleanupExpiredCircuits(): void {
  const now = Date.now()
  if (now - lastCircuitCleanup < CIRCUIT_CLEANUP_INTERVAL) return

  lastCircuitCleanup = now
  let cleaned = 0

  for (const [key, circuit] of toolCircuits.entries()) {
    // Remove closed circuits older than 24h
    if (!circuit.isOpen && now - circuit.lastFailure > CIRCUIT_EXPIRY) {
      toolCircuits.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.debug('[CircuitBreaker] Cleaned expired circuits', { cleaned })
  }
}

/**
 * Check if a tool's circuit is open for a specific user
 */
export function isCircuitOpen(toolName: string, userId?: string): boolean {
  const key = getCircuitBreakerKey(toolName, userId)
  const circuit = toolCircuits.get(key)
  if (!circuit) return false

  // If circuit is open, check if we should try half-open
  if (circuit.isOpen) {
    const timeSinceFailure = Date.now() - circuit.lastFailure
    if (timeSinceFailure >= CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
      // Allow one probe request (half-open state)
      return false
    }
    return true
  }

  return false
}

/**
 * Record a tool failure and potentially open the circuit
 * Only counts transient errors toward circuit breaker threshold
 */
export function recordToolFailure(toolName: string, userId?: string, isPermanent = false): void {
  const key = getCircuitBreakerKey(toolName, userId)
  const circuit = toolCircuits.get(key) || { failures: 0, lastFailure: 0, isOpen: false }

  // Update metrics
  updateToolMetrics(toolName, 'failure')

  // Don't count permanent errors toward circuit breaker
  if (isPermanent) {
    logger.debug('[CircuitBreaker] Permanent error - not counting toward circuit', {
      tool: toolName,
      userId,
    })
    return
  }

  circuit.failures++
  circuit.lastFailure = Date.now()

  if (circuit.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold && !circuit.isOpen) {
    circuit.isOpen = true
    circuitMetrics.circuitOpens++
    logger.warn('[CircuitBreaker] Circuit opened for tool', {
      tool: toolName,
      userId,
      key,
      failures: circuit.failures,
      resetAfterMs: CIRCUIT_BREAKER_CONFIG.resetTimeoutMs,
    })

    // Structured log for potential warming on restart
    logger.info('[CircuitBreaker:State]', {
      event: 'opened',
      key,
      tool: toolName,
      userId,
      failures: circuit.failures,
      isOpen: true,
      timestamp: Date.now(),
    })
  }

  toolCircuits.set(key, circuit)

  // Periodic cleanup
  cleanupExpiredCircuits()
}

/**
 * Record a tool success and reset the circuit
 */
export function recordToolSuccess(toolName: string, userId?: string): void {
  const key = getCircuitBreakerKey(toolName, userId)
  const circuit = toolCircuits.get(key)

  // Update metrics
  updateToolMetrics(toolName, 'success')

  if (circuit) {
    if (circuit.isOpen) {
      circuitMetrics.circuitCloses++
      logger.info('[CircuitBreaker] Circuit closed after successful probe', {
        tool: toolName,
        userId,
        key,
      })

      // Structured log for potential warming on restart
      logger.info('[CircuitBreaker:State]', {
        event: 'closed',
        key,
        tool: toolName,
        userId,
        isOpen: false,
        timestamp: Date.now(),
      })
    }
    toolCircuits.delete(key) // Reset on success
  }
}

/**
 * Get circuit breaker status for error messages
 */
export function getCircuitStatus(
  toolName: string,
  userId?: string
): { isOpen: boolean; retryAfterMs?: number } {
  const key = getCircuitBreakerKey(toolName, userId)
  const circuit = toolCircuits.get(key)
  if (!circuit?.isOpen) return { isOpen: false }

  const timeSinceFailure = Date.now() - circuit.lastFailure
  const retryAfterMs = Math.max(0, CIRCUIT_BREAKER_CONFIG.resetTimeoutMs - timeSinceFailure)

  return { isOpen: true, retryAfterMs }
}

/**
 * Get all active circuits (for health endpoint)
 */
export function getActiveCircuits(): Array<{
  key: string
  tool: string
  userId?: string
  isOpen: boolean
  failures: number
  lastFailure: number
  retryAfterMs?: number
}> {
  const result: Array<{
    key: string
    tool: string
    userId?: string
    isOpen: boolean
    failures: number
    lastFailure: number
    retryAfterMs?: number
  }> = []

  for (const [key, circuit] of toolCircuits.entries()) {
    const { tool, userId } = parseCircuitKey(key)
    const timeSinceFailure = Date.now() - circuit.lastFailure
    const retryAfterMs = circuit.isOpen
      ? Math.max(0, CIRCUIT_BREAKER_CONFIG.resetTimeoutMs - timeSinceFailure)
      : undefined

    result.push({
      key,
      tool,
      userId,
      isOpen: circuit.isOpen,
      failures: circuit.failures,
      lastFailure: circuit.lastFailure,
      retryAfterMs,
    })
  }

  return result
}

/**
 * Get circuit breaker metrics (for health endpoint)
 */
export function getCircuitMetrics(): {
  totalFailures: number
  totalSuccesses: number
  circuitOpens: number
  circuitCloses: number
  byTool: Record<string, { failures: number; successes: number }>
} {
  return {
    totalFailures: circuitMetrics.totalFailures,
    totalSuccesses: circuitMetrics.totalSuccesses,
    circuitOpens: circuitMetrics.circuitOpens,
    circuitCloses: circuitMetrics.circuitCloses,
    byTool: Object.fromEntries(circuitMetrics.byTool),
  }
}

/**
 * Reset all circuit breakers and metrics (for testing)
 */
export function resetCircuitBreakers(): void {
  toolCircuits.clear()
  circuitMetrics.totalFailures = 0
  circuitMetrics.totalSuccesses = 0
  circuitMetrics.circuitOpens = 0
  circuitMetrics.circuitCloses = 0
  circuitMetrics.byTool.clear()
}

/**
 * Warm circuit breakers from persisted state (for startup)
 */
export interface CircuitWarmState {
  key: string
  failures: number
  lastFailure: number
  isOpen: boolean
}

export function warmCircuitBreakers(states: CircuitWarmState[]): void {
  let warmed = 0
  for (const state of states) {
    // Only restore open circuits that haven't expired
    if (state.isOpen && Date.now() - state.lastFailure < CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
      toolCircuits.set(state.key, {
        failures: state.failures,
        lastFailure: state.lastFailure,
        isOpen: true,
      })
      warmed++
    }
  }
  logger.info('[CircuitBreaker] Warmed from persisted state', {
    count: warmed,
    total: states.length,
  })
}
