// src/instrumentation.ts
// Next.js instrumentation file - runs on server startup
import { initializeAuth } from './lib/auth-init'
import { logger } from './lib/logger'

// Use global to persist across module reloads in development
const globalForInit = global as typeof globalThis & {
  __instrumentationInitialized?: boolean
}

/**
 * Initialize circuit breakers with any persisted state
 * Currently starts fresh since logs are console-based (ephemeral)
 * When external log aggregation (CloudWatch, DataDog, etc.) is added,
 * this can query recent [CircuitBreaker:State] logs to restore state
 */
async function initializeCircuitBreakers(): Promise<void> {
  // Import dynamically to avoid circular dependencies
  const { warmCircuitBreakers } = await import('./ai/circuit-breaker')

  // For now, start fresh - no persisted state available
  // In the future, this could query external log service:
  // const recentCircuitStates = await queryLogService('[CircuitBreaker:State]', { event: 'opened' })
  // warmCircuitBreakers(recentCircuitStates)

  // Initialize with empty state (fresh start)
  warmCircuitBreakers([])

  logger.info('[Instrumentation] Circuit breakers initialized (starting fresh)')
}

export async function register() {
  // Only run on server and prevent duplicate initialization
  if (typeof window === 'undefined' && !globalForInit.__instrumentationInitialized) {
    globalForInit.__instrumentationInitialized = true

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('Starting server instrumentation')

    // Initialize authentication system
    await initializeAuth()

    // Initialize circuit breakers (warm from persisted state if available)
    await initializeCircuitBreakers()

    logger.info('Server instrumentation completed')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  }
}
