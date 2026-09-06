// src/lib/providers/circuitBreaker.ts
import { logger } from '@/lib/logger'

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, calls are failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  recoveryTimeoutMs: number // Time to wait before trying half-open state
  monitoringWindowMs: number // Time window for counting failures
  successThreshold: number // Successes needed in half-open to close circuit
}

/**
 * Circuit breaker for token refresh operations
 * Prevents cascading failures when QuickBooks API is having issues
 */
export class TokenRefreshCircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failures: { timestamp: number; error: string }[] = []
  private lastFailureTime = 0
  private halfOpenSuccesses = 0

  private readonly config: CircuitBreakerConfig = {
    failureThreshold: 5, // Open after 5 failures
    recoveryTimeoutMs: 60000, // Wait 1 minute before trying again
    monitoringWindowMs: 300000, // Count failures in last 5 minutes
    successThreshold: 3, // Need 3 successes to fully close circuit
  }

  constructor(
    private organizationId: string,
    private providerId: string
  ) {}

  /**
   * Execute a token refresh operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        logger.info('[CircuitBreaker] State transition', {
          organizationId: this.organizationId,
          providerId: this.providerId,
          from: 'OPEN',
          to: 'HALF_OPEN',
        })
        this.state = CircuitBreakerState.HALF_OPEN
        this.halfOpenSuccesses = 0
      } else {
        const waitTime = Math.ceil(
          (this.config.recoveryTimeoutMs - (Date.now() - this.lastFailureTime)) / 1000
        )
        throw new Error(
          `Token refresh circuit breaker is OPEN for ${this.providerId}. Try again in ${waitTime} seconds.`
        )
      }
    }

    try {
      const startTime = Date.now()
      logger.debug('[CircuitBreaker] Executing refresh', {
        organizationId: this.organizationId,
        providerId: this.providerId,
        state: this.state,
      })

      const result = await operation()
      const duration = Date.now() - startTime

      this.onSuccess(duration)
      return result
    } catch (error) {
      this.onFailure(error as Error)
      throw error
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(duration: number): void {
    logger.info('[CircuitBreaker] Refresh succeeded', {
      organizationId: this.organizationId,
      providerId: this.providerId,
      state: this.state,
      duration,
    })

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenSuccesses++
      logger.debug('[CircuitBreaker] Half-open success count', {
        organizationId: this.organizationId,
        providerId: this.providerId,
        successes: this.halfOpenSuccesses,
        threshold: this.config.successThreshold,
      })

      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        logger.info('[CircuitBreaker] State transition', {
          organizationId: this.organizationId,
          providerId: this.providerId,
          from: 'HALF_OPEN',
          to: 'CLOSED',
        })
        this.state = CircuitBreakerState.CLOSED
        this.failures = []
        this.halfOpenSuccesses = 0
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Clean up old failures in monitoring window
      this.cleanupOldFailures()
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    const now = Date.now()

    logger.error('[CircuitBreaker] Refresh failed', {
      organizationId: this.organizationId,
      providerId: this.providerId,
      state: this.state,
      error,
    })

    this.failures.push({
      timestamp: now,
      error: error.message,
    })

    this.lastFailureTime = now
    this.cleanupOldFailures()

    // Check if we should open the circuit
    if (this.state === CircuitBreakerState.CLOSED || this.state === CircuitBreakerState.HALF_OPEN) {
      const recentFailures = this.failures.length

      if (recentFailures >= this.config.failureThreshold) {
        logger.error('[CircuitBreaker] Opening circuit', {
          organizationId: this.organizationId,
          providerId: this.providerId,
          recentFailures,
          threshold: this.config.failureThreshold,
        })
        this.state = CircuitBreakerState.OPEN
        this.halfOpenSuccesses = 0
      }
    }
  }

  /**
   * Check if circuit should attempt to reset from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs
  }

  /**
   * Clean up failures outside the monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoffTime = Date.now() - this.config.monitoringWindowMs
    this.failures = this.failures.filter((failure) => failure.timestamp > cutoffTime)
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    state: CircuitBreakerState
    recentFailures: number
    lastFailureTime: number
    halfOpenSuccesses: number
  } {
    this.cleanupOldFailures()

    return {
      state: this.state,
      recentFailures: this.failures.length,
      lastFailureTime: this.lastFailureTime,
      halfOpenSuccesses: this.halfOpenSuccesses,
    }
  }

  /**
   * Force reset the circuit breaker (for administrative purposes)
   */
  forceReset(): void {
    logger.info('[CircuitBreaker] Force resetting', {
      organizationId: this.organizationId,
      providerId: this.providerId,
      previousState: this.state,
    })
    this.state = CircuitBreakerState.CLOSED
    this.failures = []
    this.halfOpenSuccesses = 0
    this.lastFailureTime = 0
  }
}

/**
 * Static map to maintain circuit breaker instances per organization/provider
 */
const circuitBreakers = new Map<string, TokenRefreshCircuitBreaker>()

/**
 * Get or create a circuit breaker for the given organization and provider
 */
export function getTokenRefreshCircuitBreaker(
  organizationId: string,
  providerId: string
): TokenRefreshCircuitBreaker {
  const key = `${organizationId}:${providerId}`

  if (!circuitBreakers.has(key)) {
    circuitBreakers.set(key, new TokenRefreshCircuitBreaker(organizationId, providerId))
  }

  return circuitBreakers.get(key)!
}

/**
 * Enhanced rate limit handling with exponential backoff and jitter
 */
export async function handleRateLimit(
  retryAfterSeconds: number,
  attempt: number,
  maxRetries: number = 3
): Promise<void> {
  if (attempt > maxRetries) {
    throw new Error(`Rate limit retry exhausted after ${maxRetries} attempts`)
  }

  // Use retry-after header if provided, otherwise exponential backoff
  let waitTime = retryAfterSeconds > 0 ? retryAfterSeconds : Math.pow(2, attempt - 1) * 2 // 2s, 4s, 8s...

  // Add jitter to prevent thundering herd (±25% randomness)
  const jitter = waitTime * 0.25 * (Math.random() - 0.5)
  waitTime = Math.max(1, waitTime + jitter)

  logger.info('[CircuitBreaker] Rate limited, waiting before retry', {
    waitTime: waitTime.toFixed(1),
    attempt,
    maxRetries,
    retryAfterSeconds,
  })
  await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
}
