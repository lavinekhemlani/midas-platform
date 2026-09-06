/**
 * Tool Timeout Wrapper
 * Wraps async tool functions with AbortController-based timeout
 */

import { logger } from '@/lib/logger'
import { createToolError, type ToolError } from '@/lib/errors/classifier'

const DEFAULT_TIMEOUT_MS = 15000 // 15 seconds default

/**
 * Error thrown when a tool times out
 */
export class ToolTimeoutError extends Error {
  readonly toolName: string
  readonly timeoutMs: number

  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`)
    this.name = 'ToolTimeoutError'
    this.toolName = toolName
    this.timeoutMs = timeoutMs
  }
}

/**
 * Wraps an async tool function with a timeout
 * Returns a unified error response on timeout instead of throwing
 *
 * @param toolFn - The async function to wrap
 * @param toolName - Name of the tool for logging
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 */
export function withTimeout<TInput, TOutput>(
  toolFn: (input: TInput, config?: any) => Promise<TOutput>,
  toolName: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): (input: TInput, config?: any) => Promise<TOutput> {
  return async (input: TInput, config?: any): Promise<TOutput> => {
    const controller = new AbortController()
    const startTime = Date.now()
    const correlationId = config?.configurable?.correlationId

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        controller.abort()
        reject(new ToolTimeoutError(toolName, timeoutMs))
      }, timeoutMs)

      // Clear timeout if aborted externally
      controller.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId)
      })
    })

    try {
      // Race between tool execution and timeout
      const result = await Promise.race([toolFn(input, config), timeoutPromise])

      const duration = Date.now() - startTime
      logger.debug(`[Tool:${toolName}] Completed successfully`, {
        duration,
        correlationId,
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime

      if (error instanceof ToolTimeoutError) {
        logger.warn(`[Tool:${toolName}] Timeout after ${timeoutMs}ms`, {
          correlationId,
          duration,
        })

        // Return a unified error response
        const errorResponse: ToolError = {
          code: 'TOOL_TIMEOUT',
          message: `Operation timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again.`,
          retryable: true,
          timestamp: Date.now(),
          correlationId,
          toolName,
          duration,
        }

        return JSON.stringify({
          success: false,
          ...errorResponse,
        }) as TOutput
      }

      // For other errors, create unified error response
      logger.error(`[Tool:${toolName}] Error`, {
        error: error instanceof Error ? error.message : String(error),
        duration,
        correlationId,
      })

      const unifiedError = createToolError(error, toolName, {
        correlationId,
        duration,
      })

      return JSON.stringify({
        success: false,
        ...unifiedError,
      }) as TOutput
    }
  }
}

/**
 * Creates a tool wrapper with a specific timeout
 * Useful for creating pre-configured wrappers for different tool categories
 */
export function createTimeoutWrapper(timeoutMs: number) {
  return <TInput, TOutput>(
    toolFn: (input: TInput, config?: any) => Promise<TOutput>,
    toolName: string
  ) => withTimeout(toolFn, toolName, timeoutMs)
}

// Pre-configured wrappers for common use cases
export const withShortTimeout = createTimeoutWrapper(10000) // 10 seconds
export const withMediumTimeout = createTimeoutWrapper(15000) // 15 seconds
export const withLongTimeout = createTimeoutWrapper(30000) // 30 seconds
export const withExtraLongTimeout = createTimeoutWrapper(60000) // 60 seconds
