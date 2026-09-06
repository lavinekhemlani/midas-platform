// src/lib/providers/oauthMonitoring.ts

/**
 * Enhanced OAuth and token monitoring system
 * Tracks token health, refresh patterns, and API usage metrics
 */

import { logger } from '../logger'

export interface TokenRefreshEvent {
  organizationId: string
  providerId: string
  success: boolean
  duration: number
  error?: string
  errorType?: 'invalid_grant' | 'rate_limit' | 'network' | 'validation' | 'other'
  timestamp: number
  lockWaitTime?: number
  circuitBreakerState?: string
}

export interface RateLimitEvent {
  organizationId: string
  providerId: string
  endpoint: string
  status: number
  retryAfter?: number
  recovered: boolean
  timestamp: number
}

export interface OAuthStateEvent {
  userId: string
  organizationId: string
  providerId: string
  event: 'generated' | 'validated' | 'expired' | 'invalid'
  error?: string
  timestamp: number
}

export interface TokenHealthMetrics {
  organizationId: string
  providerId: string
  tokenAge: number // seconds since token was issued
  refreshCount: number // number of times refreshed in last 24h
  lastRefreshSuccess: boolean
  lastRefreshTime: number
  consecutiveFailures: number
  averageRefreshDuration: number
  circuitBreakerState: string
}

class OAuthMonitoringService {
  private tokenRefreshEvents: TokenRefreshEvent[] = []
  private rateLimitEvents: RateLimitEvent[] = []
  private oauthStateEvents: OAuthStateEvent[] = []

  // Keep events for 24 hours
  private readonly EVENT_RETENTION_MS = 24 * 60 * 60 * 1000

  /**
   * Log a token refresh event
   */
  logTokenRefresh(event: Omit<TokenRefreshEvent, 'timestamp'>): void {
    const enrichedEvent: TokenRefreshEvent = {
      ...event,
      timestamp: Date.now(),
    }

    this.tokenRefreshEvents.push(enrichedEvent)
    this.cleanupOldEvents()

    // Log to console with structured format
    const message = `Token refresh ${event.success ? 'succeeded' : 'failed'}`

    if (event.success) {
      logger.debug(message, {
        provider: event.providerId,
        organizationId: event.organizationId,
        duration: event.duration,
      })
    } else {
      logger.warn(message, {
        provider: event.providerId,
        organizationId: event.organizationId,
        duration: event.duration,
        errorType: event.errorType,
        circuitBreakerState: event.circuitBreakerState,
      })
    }

    // Send to external monitoring if configured
    if (process.env.MONITORING_WEBHOOK_URL) {
      this.sendToWebhook('token_refresh', enrichedEvent)
    }
  }

  /**
   * Log a rate limit event
   */
  logRateLimit(event: Omit<RateLimitEvent, 'timestamp'>): void {
    const enrichedEvent: RateLimitEvent = {
      ...event,
      timestamp: Date.now(),
    }

    this.rateLimitEvents.push(enrichedEvent)
    this.cleanupOldEvents()

    logger.warn(`Rate limit ${event.recovered ? 'recovered with cached data' : 'hit'}`, {
      provider: event.providerId,
      endpoint: event.endpoint,
      status: event.status,
      retryAfter: event.retryAfter,
      organizationId: event.organizationId,
    })

    if (process.env.MONITORING_WEBHOOK_URL) {
      this.sendToWebhook('rate_limit', enrichedEvent)
    }
  }

  /**
   * Log OAuth state events (for CSRF monitoring)
   */
  logOAuthState(event: Omit<OAuthStateEvent, 'timestamp'>): void {
    const enrichedEvent: OAuthStateEvent = {
      ...event,
      timestamp: Date.now(),
    }

    this.oauthStateEvents.push(enrichedEvent)
    this.cleanupOldEvents()

    if (event.event === 'invalid' || event.event === 'expired') {
      logger.warn(`OAuth state ${event.event}`, {
        provider: event.providerId,
        userId: event.userId,
        organizationId: event.organizationId,
        error: event.error,
      })
    } else {
      logger.debug(`OAuth state ${event.event}`, {
        provider: event.providerId,
        userId: event.userId,
        organizationId: event.organizationId,
      })
    }

    // Alert on security events
    if (event.event === 'invalid' && process.env.SECURITY_WEBHOOK_URL) {
      this.sendToWebhook('security_alert', enrichedEvent, process.env.SECURITY_WEBHOOK_URL)
    }
  }

  /**
   * Get token health metrics for an organization/provider
   */
  getTokenHealth(organizationId: string, providerId: string): TokenHealthMetrics {
    const now = Date.now()
    const last24Hours = now - 24 * 60 * 60 * 1000

    // Get recent refresh events
    const recentRefreshes = this.tokenRefreshEvents.filter(
      (e) =>
        e.organizationId === organizationId &&
        e.providerId === providerId &&
        e.timestamp > last24Hours
    )

    // Calculate metrics
    const refreshCount = recentRefreshes.length
    const successfulRefreshes = recentRefreshes.filter((e) => e.success)
    const lastRefresh = recentRefreshes[recentRefreshes.length - 1]

    // Calculate consecutive failures
    let consecutiveFailures = 0
    for (let i = recentRefreshes.length - 1; i >= 0; i--) {
      if (!recentRefreshes[i].success) {
        consecutiveFailures++
      } else {
        break
      }
    }

    // Calculate average refresh duration
    const totalDuration = successfulRefreshes.reduce((sum, e) => sum + e.duration, 0)
    const averageRefreshDuration =
      successfulRefreshes.length > 0 ? Math.round(totalDuration / successfulRefreshes.length) : 0

    return {
      organizationId,
      providerId,
      tokenAge: 0, // This would need to be calculated from actual token data
      refreshCount,
      lastRefreshSuccess: lastRefresh?.success ?? true,
      lastRefreshTime: lastRefresh?.timestamp ?? 0,
      consecutiveFailures,
      averageRefreshDuration,
      circuitBreakerState: lastRefresh?.circuitBreakerState ?? 'CLOSED',
    }
  }

  /**
   * Get rate limit statistics
   */
  getRateLimitStats(
    organizationId: string,
    providerId: string
  ): {
    totalEvents: number
    recoveredEvents: number
    averageRetryAfter: number
    affectedEndpoints: string[]
    lastRateLimit: number
  } {
    const now = Date.now()
    const last24Hours = now - 24 * 60 * 60 * 1000

    const recentRateLimits = this.rateLimitEvents.filter(
      (e) =>
        e.organizationId === organizationId &&
        e.providerId === providerId &&
        e.timestamp > last24Hours
    )

    const recoveredEvents = recentRateLimits.filter((e) => e.recovered).length
    const retryAfterValues = recentRateLimits.filter((e) => e.retryAfter).map((e) => e.retryAfter!)

    const averageRetryAfter =
      retryAfterValues.length > 0
        ? Math.round(retryAfterValues.reduce((sum, val) => sum + val, 0) / retryAfterValues.length)
        : 0

    const affectedEndpoints = Array.from(new Set(recentRateLimits.map((e) => e.endpoint)))
    const lastRateLimit =
      recentRateLimits.length > 0 ? Math.max(...recentRateLimits.map((e) => e.timestamp)) : 0

    return {
      totalEvents: recentRateLimits.length,
      recoveredEvents,
      averageRetryAfter,
      affectedEndpoints,
      lastRateLimit,
    }
  }

  /**
   * Get OAuth security events summary
   */
  getSecuritySummary(organizationId?: string): {
    invalidStates: number
    expiredStates: number
    successfulValidations: number
    suspiciousActivity: boolean
  } {
    const now = Date.now()
    const last24Hours = now - 24 * 60 * 60 * 1000

    const recentEvents = this.oauthStateEvents.filter(
      (e) => e.timestamp > last24Hours && (!organizationId || e.organizationId === organizationId)
    )

    const invalidStates = recentEvents.filter((e) => e.event === 'invalid').length
    const expiredStates = recentEvents.filter((e) => e.event === 'expired').length
    const successfulValidations = recentEvents.filter((e) => e.event === 'validated').length

    // Consider it suspicious if >10% of validations are invalid/expired
    const totalValidations = recentEvents.length
    const failedValidations = invalidStates + expiredStates
    const suspiciousActivity = totalValidations > 10 && failedValidations / totalValidations > 0.1

    return {
      invalidStates,
      expiredStates,
      successfulValidations,
      suspiciousActivity,
    }
  }

  /**
   * Generate a comprehensive health report
   */
  generateHealthReport(organizationId: string): {
    overall: 'healthy' | 'degraded' | 'unhealthy'
    providers: Record<
      string,
      {
        status: 'healthy' | 'degraded' | 'unhealthy'
        tokenHealth: TokenHealthMetrics
        rateLimitStats: {
          totalEvents: number
          recoveredEvents: number
          averageRetryAfter: number
          affectedEndpoints: string[]
          lastRateLimit: number
        }
      }
    >
    recommendations: string[]
  } {
    const providers = ['quickbooks', 'zoho', 'xero', 'stripe']
    const providerHealth: Record<string, any> = {}
    const recommendations: string[] = []

    let overallHealthScore = 0
    let activeProviders = 0

    for (const providerId of providers) {
      const tokenHealth = this.getTokenHealth(organizationId, providerId)
      const rateLimitStats = this.getRateLimitStats(organizationId, providerId)

      // Skip providers with no activity
      if (tokenHealth.refreshCount === 0 && rateLimitStats.totalEvents === 0) {
        continue
      }

      activeProviders++

      // Calculate provider health score (0-100)
      let providerScore = 100

      // Deduct for consecutive failures
      providerScore -= Math.min(tokenHealth.consecutiveFailures * 20, 60)

      // Deduct for rate limiting
      if (rateLimitStats.totalEvents > 5) {
        providerScore -= Math.min(rateLimitStats.totalEvents * 2, 20)
      }

      // Deduct for slow refresh times
      if (tokenHealth.averageRefreshDuration > 5000) {
        providerScore -= 10
      }

      // Deduct for circuit breaker issues
      if (tokenHealth.circuitBreakerState === 'OPEN') {
        providerScore -= 30
      } else if (tokenHealth.circuitBreakerState === 'HALF_OPEN') {
        providerScore -= 15
      }

      providerScore = Math.max(0, providerScore)
      overallHealthScore += providerScore

      // Determine provider status
      let status: 'healthy' | 'degraded' | 'unhealthy'
      if (providerScore >= 80) {
        status = 'healthy'
      } else if (providerScore >= 50) {
        status = 'degraded'
      } else {
        status = 'unhealthy'
      }

      providerHealth[providerId] = {
        status,
        tokenHealth,
        rateLimitStats,
      }

      // Generate recommendations
      if (tokenHealth.consecutiveFailures > 2) {
        recommendations.push(
          `${providerId}: Consider re-authenticating - ${tokenHealth.consecutiveFailures} consecutive token refresh failures`
        )
      }

      if (rateLimitStats.totalEvents > 10) {
        recommendations.push(
          `${providerId}: High rate limit events (${rateLimitStats.totalEvents}) - consider implementing caching or reducing API calls`
        )
      }

      if (tokenHealth.averageRefreshDuration > 10000) {
        recommendations.push(
          `${providerId}: Slow token refresh (avg ${tokenHealth.averageRefreshDuration}ms) - check network connectivity`
        )
      }
    }

    // Calculate overall health
    const avgHealthScore = activeProviders > 0 ? overallHealthScore / activeProviders : 100
    let overall: 'healthy' | 'degraded' | 'unhealthy'
    if (avgHealthScore >= 80) {
      overall = 'healthy'
    } else if (avgHealthScore >= 50) {
      overall = 'degraded'
    } else {
      overall = 'unhealthy'
    }

    return {
      overall,
      providers: providerHealth,
      recommendations,
    }
  }

  /**
   * Clean up old events to prevent memory leaks
   */
  private cleanupOldEvents(): void {
    const cutoff = Date.now() - this.EVENT_RETENTION_MS

    this.tokenRefreshEvents = this.tokenRefreshEvents.filter((e) => e.timestamp > cutoff)
    this.rateLimitEvents = this.rateLimitEvents.filter((e) => e.timestamp > cutoff)
    this.oauthStateEvents = this.oauthStateEvents.filter((e) => e.timestamp > cutoff)
  }

  /**
   * Send events to external monitoring webhook
   */
  private async sendToWebhook(eventType: string, event: any, webhookUrl?: string): Promise<void> {
    try {
      const url = webhookUrl || process.env.MONITORING_WEBHOOK_URL
      if (!url) return

      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ZenithOS-OAuth-Monitor/1.0',
        },
        body: JSON.stringify({
          eventType,
          timestamp: new Date().toISOString(),
          data: event,
        }),
      })
    } catch (error) {
      console.error('Failed to send monitoring webhook:', error)
      // Don't throw - monitoring failures shouldn't break the main application
    }
  }
}

// Export singleton instance
export const oauthMonitoring = new OAuthMonitoringService()

/**
 * Utility function to categorize token refresh errors
 */
export function categorizeTokenError(error: any): TokenRefreshEvent['errorType'] {
  if (!error) return 'other'

  const errorMessage = error.message || error.error || ''
  const errorDescription = error.error_description || ''

  if (errorMessage.includes('invalid_grant') || errorDescription.includes('invalid_grant')) {
    return 'invalid_grant'
  }

  if (error.status === 429 || errorMessage.includes('rate limit')) {
    return 'rate_limit'
  }

  if (
    errorMessage.includes('validation failed') ||
    errorMessage.includes('Missing refresh_token')
  ) {
    return 'validation'
  }

  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('network') ||
    error.code === 'ENOTFOUND'
  ) {
    return 'network'
  }

  return 'other'
}
