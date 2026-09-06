// src/lib/errors/classifier.ts

/**
 * Unified error classification for API and LLM operations
 * Consolidates duplicate error handling from chat/route.ts
 */

export type ErrorType =
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'STREAM_TIMEOUT'
  | 'TOOL_TIMEOUT'
  | 'TOOL_EXECUTION'
  | 'CIRCUIT_OPEN'
  | 'NETWORK'
  | 'JSON_PARSE'
  | 'CONFIG'
  | 'TOOL_VALIDATION'
  | 'AUTH'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONTEXT_LENGTH'
  | 'UNKNOWN'

/**
 * Error permanence classification for circuit breaker logic
 * - TRANSIENT: Temporary failures that should count toward circuit breaker (network issues, timeouts)
 * - PERMANENT: Permanent failures that shouldn't count toward circuit breaker (auth, config, validation)
 */
export type ErrorPermanence = 'TRANSIENT' | 'PERMANENT'

/**
 * Unified error structure for consistent error handling across the stack
 */
export interface UnifiedError {
  code: ErrorType
  message: string
  retryable: boolean
  retryAfter?: number
  timestamp: number
  correlationId?: string
  details?: string
}

/**
 * Tool-specific error with additional context
 */
export interface ToolError extends UnifiedError {
  toolName: string
  input?: Record<string, unknown>
  duration?: number
}

export interface ErrorClassification {
  type: ErrorType
  retryable: boolean
  permanence: ErrorPermanence
  userMessage: string
  httpStatus: number
  retryAfter?: number
}

const ERROR_PATTERNS: Array<{
  patterns: RegExp[]
  type: ErrorType
  retryable: boolean
  permanence: ErrorPermanence
  userMessage: string
  httpStatus: number
}> = [
  {
    patterns: [/rate limit/i, /429/, /too many requests/i],
    type: 'RATE_LIMIT',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Service is busy. Please wait a moment and try again.',
    httpStatus: 429,
  },
  {
    patterns: [/stream.?timeout/i, /stream.?timed.?out/i],
    type: 'STREAM_TIMEOUT',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Response took too long. Please try again.',
    httpStatus: 504,
  },
  {
    patterns: [/tool.?timeout/i, /tool.?timed.?out/i, /operation.?timed.?out/i],
    type: 'TOOL_TIMEOUT',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Operation took too long. Please try again.',
    httpStatus: 504,
  },
  {
    patterns: [/tool.?execution/i, /tool.?failed/i, /tool.?error/i],
    type: 'TOOL_EXECUTION',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'An operation failed. Retrying...',
    httpStatus: 500,
  },
  {
    patterns: [/timeout/i, /timed out/i, /etimedout/i, /esockettimedout/i],
    type: 'TIMEOUT',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Request timed out. Please try again.',
    httpStatus: 504,
  },
  {
    patterns: [
      /econnrefused/i,
      /enotfound/i,
      /503/,
      /502/,
      /504/,
      /network/i,
      /fetch failed/i,
      /failed to fetch/i,
      /err_internet_disconnected/i,
      /net::err_/i,
    ],
    type: 'NETWORK',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Connection issue. Please check your internet and try again.',
    httpStatus: 503,
  },
  {
    patterns: [/json/i, /parse/i, /unexpected token/i, /syntax error/i],
    type: 'JSON_PARSE',
    retryable: true,
    permanence: 'TRANSIENT',
    userMessage: 'Response processing error. Retrying...',
    httpStatus: 500,
  },
  {
    patterns: [/config/i, /environment/i, /api.?key/i, /not configured/i],
    type: 'CONFIG',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'Service configuration error. Please contact support.',
    httpStatus: 500,
  },
  {
    patterns: [/tool.*validation/i, /did not match schema/i, /invalid.*argument/i],
    type: 'TOOL_VALIDATION',
    retryable: true,
    permanence: 'PERMANENT', // Validation errors are permanent - different input needed
    userMessage: 'Processing error. Retrying with different approach...',
    httpStatus: 400,
  },
  {
    patterns: [/401/, /unauthorized/i, /authentication/i, /invalid.*token/i],
    type: 'AUTH',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'Authentication error. Please sign in again.',
    httpStatus: 401,
  },
  {
    patterns: [/403/, /forbidden/i, /access denied/i],
    type: 'AUTH',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'Access denied. You may not have permission for this action.',
    httpStatus: 403,
  },
  {
    patterns: [/404/, /not found/i],
    type: 'NOT_FOUND',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'Resource not found.',
    httpStatus: 404,
  },
  {
    patterns: [
      /context_length_exceeded/i,
      /context.*too.*long/i,
      /token.*limit.*exceeded/i,
      /reduce the length/i,
      /maximum context length/i,
    ],
    type: 'CONTEXT_LENGTH',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage:
      'Conversation is too long. Please start a new conversation or try a shorter message.',
    httpStatus: 400,
  },
  {
    patterns: [/400/, /bad request/i, /invalid/i, /validation/i],
    type: 'VALIDATION',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'Invalid request. Please check your input.',
    httpStatus: 400,
  },
]

/**
 * Classify an error for retry logic and user messaging
 */
export function classifyError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Check for Retry-After hint in message
  let retryAfter: number | undefined
  const retryAfterMatch = message.match(/retry.?after[:\s]+(\d+)/i)
  if (retryAfterMatch) {
    retryAfter = parseInt(retryAfterMatch[1], 10)
  }

  // Match against known patterns
  for (const pattern of ERROR_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(lowerMessage)) {
        return {
          type: pattern.type,
          retryable: pattern.retryable,
          permanence: pattern.permanence,
          userMessage: pattern.userMessage,
          httpStatus: pattern.httpStatus,
          retryAfter,
        }
      }
    }
  }

  // Default: unknown error (permanent since we don't know what went wrong)
  return {
    type: 'UNKNOWN',
    retryable: false,
    permanence: 'PERMANENT',
    userMessage: 'An unexpected error occurred. Please try again.',
    httpStatus: 500,
    retryAfter,
  }
}

/**
 * Check if an error is a permanent failure (shouldn't count toward circuit breaker)
 */
export function isPermanentError(error: unknown): boolean {
  return classifyError(error).permanence === 'PERMANENT'
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return classifyError(error).retryable
}

/**
 * Get user-friendly message for an error
 */
export function getUserMessage(error: unknown): string {
  return classifyError(error).userMessage
}

/**
 * Get HTTP status code for an error
 */
export function getHttpStatus(error: unknown): number {
  return classifyError(error).httpStatus
}

/**
 * Create a unified error object with consistent structure
 * Used across frontend, backend, and tools for standardized error handling
 */
export function createUnifiedError(
  error: unknown,
  context?: { correlationId?: string; toolName?: string }
): UnifiedError {
  const classification = classifyError(error)
  const details = error instanceof Error ? error.message : String(error)

  return {
    code: classification.type,
    message: classification.userMessage,
    retryable: classification.retryable,
    retryAfter: classification.retryAfter,
    timestamp: Date.now(),
    correlationId: context?.correlationId,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
  }
}

/**
 * Create a tool-specific error with execution context
 */
export function createToolError(
  error: unknown,
  toolName: string,
  context?: {
    correlationId?: string
    input?: Record<string, unknown>
    duration?: number
  }
): ToolError {
  const unified = createUnifiedError(error, { correlationId: context?.correlationId })

  return {
    ...unified,
    toolName,
    input: context?.input,
    duration: context?.duration,
  }
}
