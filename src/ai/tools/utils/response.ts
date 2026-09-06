/**
 * Standardized Tool Response Helpers
 * Provides consistent response format across all tools
 */

import type { ErrorType } from '@/lib/errors/classifier'

/**
 * Standard success response structure
 */
export interface ToolSuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
  duration?: number
}

/**
 * Standard error response structure
 */
export interface ToolErrorResponse {
  success: false
  error: string
  code: ErrorType
  retryable: boolean
  hint?: string
  duration?: number
}

/**
 * Union type for all tool responses
 */
export type ToolResponse<T = unknown> = ToolSuccessResponse<T> | ToolErrorResponse

/**
 * Create a success response
 *
 * @param data - The data to return
 * @param duration - Optional execution duration in ms
 * @returns JSON string of success response
 */
export function toolSuccess<T>(data: T, duration?: number): string {
  const response: ToolSuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    ...(duration !== undefined && { duration }),
  }
  return JSON.stringify(response)
}

/**
 * Create an error response
 *
 * @param message - User-friendly error message
 * @param code - Error type code
 * @param options - Additional options
 * @returns JSON string of error response
 */
export function toolError(
  message: string,
  code: ErrorType = 'TOOL_EXECUTION',
  options?: {
    retryable?: boolean
    hint?: string
    duration?: number
  }
): string {
  const response: ToolErrorResponse = {
    success: false,
    error: message,
    code,
    retryable: options?.retryable ?? false,
    ...(options?.hint && { hint: options.hint }),
    ...(options?.duration !== undefined && { duration: options.duration }),
  }
  return JSON.stringify(response)
}

/**
 * Create a partial success response (some items succeeded, some failed)
 *
 * @param data - Successful results
 * @param errors - Array of error messages
 * @param duration - Optional execution duration
 */
export function toolPartialSuccess<T>(data: T, errors: string[], duration?: number): string {
  return JSON.stringify({
    success: true,
    partialFailure: true,
    data,
    errors,
    timestamp: new Date().toISOString(),
    ...(duration !== undefined && { duration }),
  })
}

/**
 * Create a validation error response
 *
 * @param message - What's wrong with the input
 * @param field - Which field is invalid (optional)
 */
export function toolValidationError(message: string, field?: string): string {
  return toolError(field ? `Invalid ${field}: ${message}` : message, 'TOOL_VALIDATION', {
    retryable: false,
  })
}

/**
 * Create a not found error response
 *
 * @param resource - What resource was not found
 */
export function toolNotFoundError(resource: string): string {
  return toolError(`${resource} not found`, 'NOT_FOUND', { retryable: false })
}

/**
 * Create a timeout error response
 *
 * @param toolName - Name of the tool that timed out
 * @param timeoutSec - Timeout value in seconds
 */
export function toolTimeoutError(toolName: string, timeoutSec: number): string {
  return toolError(`${toolName} operation timed out after ${timeoutSec} seconds`, 'TOOL_TIMEOUT', {
    retryable: true,
  })
}

/**
 * Parse a tool response to extract data or error
 * Useful for handling tool results in the agent
 */
export function parseToolResponse<T>(response: string): ToolResponse<T> {
  try {
    return JSON.parse(response) as ToolResponse<T>
  } catch {
    return {
      success: false,
      error: 'Failed to parse tool response',
      code: 'UNKNOWN',
      retryable: false,
    }
  }
}
