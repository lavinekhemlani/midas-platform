/**
 * QuickBooks Error Classes
 *
 * Typed errors with recovery information for proper error handling.
 */

// ============================================================================
// Base Error
// ============================================================================

export class QBError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly recoverable: boolean = true,
    public readonly retryAfterMs?: number
  ) {
    super(message)
    this.name = 'QBError'
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      retryAfterMs: this.retryAfterMs,
    }
  }
}

// ============================================================================
// Authentication Errors
// ============================================================================

export type QBAuthErrorCode =
  | 'NOT_CONNECTED'
  | 'NO_TOKEN'
  | 'INVALID_GRANT'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_FAILED'
  | 'REFRESH_TIMEOUT'
  | 'INVALID_STATE'

export class QBAuthError extends QBError {
  constructor(code: QBAuthErrorCode, message: string) {
    // invalid_grant, not_connected, no_token are not recoverable - requires user to reconnect
    const recoverable = code !== 'INVALID_GRANT' && code !== 'NOT_CONNECTED' && code !== 'NO_TOKEN'
    super(code, message, recoverable)
    this.name = 'QBAuthError'
  }

  static notConnected(organizationId: string): QBAuthError {
    return new QBAuthError(
      'NOT_CONNECTED',
      `QuickBooks not connected for organization ${organizationId}`
    )
  }

  static invalidGrant(): QBAuthError {
    return new QBAuthError(
      'INVALID_GRANT',
      'QuickBooks authentication expired. User must reconnect.'
    )
  }

  static tokenExpired(): QBAuthError {
    return new QBAuthError('TOKEN_EXPIRED', 'Access token has expired')
  }

  static refreshFailed(reason: string): QBAuthError {
    return new QBAuthError('REFRESH_FAILED', `Token refresh failed: ${reason}`)
  }

  static refreshTimeout(): QBAuthError {
    return new QBAuthError('REFRESH_TIMEOUT', 'Token refresh timed out waiting for lock')
  }

  static invalidState(): QBAuthError {
    return new QBAuthError('INVALID_STATE', 'OAuth state parameter mismatch - possible CSRF attack')
  }
}

// ============================================================================
// API Errors
// ============================================================================

export interface QBApiErrorDetail {
  Message?: string
  Detail?: string
  code?: string
  element?: string
}

export interface QBFault {
  Error?: QBApiErrorDetail[]
  type?: string
}

export class QBApiError extends QBError {
  public readonly fault?: QBFault

  constructor(
    public readonly statusCode: number,
    public readonly details: unknown,
    retryAfterMs?: number
  ) {
    const message = QBApiError.extractMessage(statusCode, details)
    const recoverable = statusCode >= 500 || statusCode === 429
    super(`API_${statusCode}`, message, recoverable, retryAfterMs)
    this.name = 'QBApiError'
    this.fault = QBApiError.extractFault(details)
  }

  private static extractMessage(statusCode: number, details: unknown): string {
    if (typeof details === 'object' && details !== null) {
      const fault = (details as { Fault?: QBFault }).Fault
      const firstError = fault?.Error?.[0]
      if (firstError?.Message) {
        return `${firstError.Message}${firstError.Detail ? `: ${firstError.Detail}` : ''} (${firstError.code || statusCode})`
      }
    }
    return `QuickBooks API error: ${statusCode}`
  }

  private static extractFault(details: unknown): QBFault | undefined {
    if (typeof details === 'object' && details !== null) {
      return (details as { Fault?: QBFault }).Fault
    }
    return undefined
  }

  get errorCode(): string | undefined {
    return this.fault?.Error?.[0]?.code
  }

  get errorDetail(): string | undefined {
    return this.fault?.Error?.[0]?.Detail
  }

  static badRequest(details: unknown): QBApiError {
    return new QBApiError(400, details)
  }

  static unauthorized(details?: unknown): QBApiError {
    return new QBApiError(401, details ?? { message: 'Unauthorized' })
  }

  static forbidden(details?: unknown): QBApiError {
    return new QBApiError(403, details ?? { message: 'Forbidden' })
  }

  static notFound(entityType: string, entityId: string): QBApiError {
    return new QBApiError(404, {
      Fault: {
        Error: [
          {
            Message: 'Object Not Found',
            Detail: `${entityType} with id ${entityId} not found`,
            code: '610',
          },
        ],
      },
    })
  }

  static serverError(details?: unknown): QBApiError {
    return new QBApiError(500, details ?? { message: 'Internal Server Error' })
  }

  static serviceUnavailable(retryAfterMs?: number): QBApiError {
    return new QBApiError(503, { message: 'Service Unavailable' }, retryAfterMs)
  }
}

// ============================================================================
// Rate Limit Error
// ============================================================================

export class QBRateLimitError extends QBError {
  constructor(
    retryAfterMs: number,
    public readonly limit?: number,
    public readonly remaining?: number
  ) {
    super(
      'RATE_LIMITED',
      `Rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s`,
      true,
      retryAfterMs
    )
    this.name = 'QBRateLimitError'
  }

  static fromResponse(
    retryAfterHeader?: string,
    limitHeader?: string,
    remainingHeader?: string
  ): QBRateLimitError {
    const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 60000
    const limit = limitHeader ? parseInt(limitHeader, 10) : undefined
    const remaining = remainingHeader ? parseInt(remainingHeader, 10) : undefined
    return new QBRateLimitError(retryAfterMs, limit, remaining)
  }
}

// ============================================================================
// Validation Error
// ============================================================================

export interface ValidationIssue {
  field: string
  message: string
  value?: unknown
}

export class QBValidationError extends QBError {
  constructor(
    message: string,
    public readonly issues: ValidationIssue[] = []
  ) {
    super('VALIDATION', message, false)
    this.name = 'QBValidationError'
  }

  static field(field: string, message: string, value?: unknown): QBValidationError {
    return new QBValidationError(`Validation failed: ${field} - ${message}`, [
      { field, message, value },
    ])
  }

  static multiple(issues: ValidationIssue[]): QBValidationError {
    const summary = issues.map((i) => `${i.field}: ${i.message}`).join(', ')
    return new QBValidationError(`Validation failed: ${summary}`, issues)
  }
}

// ============================================================================
// Webhook Error
// ============================================================================

export type QBWebhookErrorCode =
  | 'INVALID_SIGNATURE'
  | 'INVALID_PAYLOAD'
  | 'PROCESSING_ERROR'
  | 'HANDLER_NOT_FOUND'

export class QBWebhookError extends QBError {
  constructor(
    code: QBWebhookErrorCode,
    message: string,
    public readonly entityType?: string,
    public readonly entityId?: string
  ) {
    super(code, message, code === 'PROCESSING_ERROR')
    this.name = 'QBWebhookError'
  }

  static invalidSignature(): QBWebhookError {
    return new QBWebhookError('INVALID_SIGNATURE', 'Webhook signature verification failed')
  }

  static invalidPayload(reason: string): QBWebhookError {
    return new QBWebhookError('INVALID_PAYLOAD', `Invalid webhook payload: ${reason}`)
  }

  static processingError(entityType: string, entityId: string, reason: string): QBWebhookError {
    return new QBWebhookError(
      'PROCESSING_ERROR',
      `Failed to process ${entityType} ${entityId}: ${reason}`,
      entityType,
      entityId
    )
  }

  static handlerNotFound(entityType: string): QBWebhookError {
    return new QBWebhookError(
      'HANDLER_NOT_FOUND',
      `No handler registered for entity type: ${entityType}`,
      entityType
    )
  }
}

// ============================================================================
// Sync Error
// ============================================================================

export type QBSyncErrorCode =
  | 'SYNC_FAILED'
  | 'CDC_FAILED'
  | 'ENTITY_FETCH_FAILED'
  | 'TRANSFORM_FAILED'

export class QBSyncError extends QBError {
  constructor(
    code: QBSyncErrorCode,
    message: string,
    public readonly organizationId?: string,
    public readonly entityType?: string,
    public readonly cause?: Error
  ) {
    super(code, message, true)
    this.name = 'QBSyncError'
  }

  static syncFailed(organizationId: string, reason: string, cause?: Error): QBSyncError {
    return new QBSyncError(
      'SYNC_FAILED',
      `Sync failed for organization ${organizationId}: ${reason}`,
      organizationId,
      undefined,
      cause
    )
  }

  static cdcFailed(organizationId: string, reason: string, cause?: Error): QBSyncError {
    return new QBSyncError(
      'CDC_FAILED',
      `CDC sync failed for organization ${organizationId}: ${reason}`,
      organizationId,
      undefined,
      cause
    )
  }

  static entityFetchFailed(
    entityType: string,
    entityId: string,
    reason: string,
    cause?: Error
  ): QBSyncError {
    return new QBSyncError(
      'ENTITY_FETCH_FAILED',
      `Failed to fetch ${entityType} ${entityId}: ${reason}`,
      undefined,
      entityType,
      cause
    )
  }

  static transformFailed(
    entityType: string,
    entityId: string,
    reason: string,
    cause?: Error
  ): QBSyncError {
    return new QBSyncError(
      'TRANSFORM_FAILED',
      `Failed to transform ${entityType} ${entityId}: ${reason}`,
      undefined,
      entityType,
      cause
    )
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isQBError(error: unknown): error is QBError {
  return error instanceof QBError
}

export function isQBAuthError(error: unknown): error is QBAuthError {
  return error instanceof QBAuthError
}

export function isQBApiError(error: unknown): error is QBApiError {
  return error instanceof QBApiError
}

export function isQBRateLimitError(error: unknown): error is QBRateLimitError {
  return error instanceof QBRateLimitError
}

export function isQBValidationError(error: unknown): error is QBValidationError {
  return error instanceof QBValidationError
}

export function isQBWebhookError(error: unknown): error is QBWebhookError {
  return error instanceof QBWebhookError
}

export function isQBSyncError(error: unknown): error is QBSyncError {
  return error instanceof QBSyncError
}

export function isRecoverableError(error: unknown): boolean {
  if (error instanceof QBError) {
    return error.recoverable
  }
  return false
}

export function getRetryDelay(error: unknown): number | undefined {
  if (error instanceof QBError) {
    return error.retryAfterMs
  }
  return undefined
}

// ============================================================================
// Network Error
// ============================================================================

export class QBNetworkError extends QBError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super('NETWORK_ERROR', message, true)
    this.name = 'QBNetworkError'
  }
}

// ============================================================================
// Not Found Error
// ============================================================================

export class QBNotFoundError extends QBError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string
  ) {
    super('NOT_FOUND', `${entityType} with ID ${entityId} not found`, false)
    this.name = 'QBNotFoundError'
  }
}

export function isQBNetworkError(error: unknown): error is QBNetworkError {
  return error instanceof QBNetworkError
}

export function isQBNotFoundError(error: unknown): error is QBNotFoundError {
  return error instanceof QBNotFoundError
}
