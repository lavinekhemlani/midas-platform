/**
 * Request Context Middleware
 *
 * Provides automatic context injection for all API routes.
 * Uses AsyncLocalStorage to maintain request context throughout
 * the request lifecycle without prop drilling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestContext, RequestContext, generateCorrelationId, logger } from '@/lib/logger'
import { TokenVerifier } from '@/lib/auth'

/**
 * Wraps an API route handler with request context.
 * Automatically extracts correlation ID, user info, and tracks request timing.
 *
 * Usage:
 * export const GET = withRequestContext(async (req) => {
 *   // Your handler code here
 *   logger.info('Processing request'); // Automatically includes context
 * });
 */
export function withRequestContext<T extends any[], R>(
  handler: (req: NextRequest, ...args: T) => Promise<R>
) {
  return async (req: NextRequest, ...args: T): Promise<R> => {
    const startTime = Date.now()

    // Generate or extract correlation ID
    const correlationId = req.headers.get('x-correlation-id') || generateCorrelationId()

    // Extract user context from JWT if available (supports both header and cookie-based auth)
    let userId: string | undefined
    let organizationId: string | undefined

    try {
      // TokenVerifier.verify handles both Authorization header and cookie-based auth
      const decoded = await TokenVerifier.verify(req)
      userId = decoded.userId
      organizationId = decoded.payload?.organization_id || decoded.payload?.orgId
    } catch (error) {
      // Silent fail - user context is optional for logging
      // Token might not be present or might be invalid
      logger.debug('Could not extract user context from token', { error })
    }

    // Extract provider if present in query params or headers
    const provider =
      req.nextUrl.searchParams.get('provider') || req.headers.get('x-provider') || undefined

    // Build request context
    const context: RequestContext = {
      correlationId,
      userId,
      organizationId,
      provider,
      startTime,
      path: req.nextUrl.pathname,
      method: req.method,
    }

    // Run the handler with context
    return requestContext.run(context, async () => {
      try {
        // Log request start (only in debug mode)
        logger.debug('Request started', {
          path: context.path,
          method: context.method,
        })

        const result = await handler(req, ...args)

        // Log successful completion
        const duration = Date.now() - startTime

        // For NextResponse objects, try to get status
        if (result && typeof result === 'object' && 'status' in result) {
          logger.request(Number(result.status) || 200, duration)
        } else {
          // Default to 200 for successful responses
          logger.request(200, duration)
        }

        return result
      } catch (error) {
        // Log error
        const duration = Date.now() - startTime
        logger.error('Request failed', {
          error,
          duration,
        })

        // Re-throw to let Next.js handle the error response
        throw error
      }
    })
  }
}
