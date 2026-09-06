/**
 * QuickBooks Report Parameter Validation
 *
 * Validates and sanitizes report API query parameters to ensure data integrity
 * and prevent invalid requests to QuickBooks API.
 *
 * @module quickbooks/validation/report-params
 */

import { NextResponse } from 'next/server'
import type { QBDateMacro } from '@/quickbooks/types/reports'
import {
  QBValidationError,
  QBAuthError,
  QBRateLimitError,
  QBApiError,
  isQBAuthError,
  isQBRateLimitError,
  isQBApiError,
  isQBValidationError,
  type ValidationIssue,
} from '@/quickbooks/errors'

// ============================================================================
// Constants - Valid enum values
// ============================================================================

/**
 * Valid accounting methods
 */
export const VALID_ACCOUNTING_METHODS = ['Accrual', 'Cash'] as const
export type AccountingMethod = (typeof VALID_ACCOUNTING_METHODS)[number]

/**
 * Valid column summarization periods
 */
export const VALID_SUMMARIZE_COLUMN_BY = [
  'Total',
  'Month',
  'Week',
  'Days',
  'Quarter',
  'Year',
] as const
export type SummarizeColumnBy = (typeof VALID_SUMMARIZE_COLUMN_BY)[number]

/**
 * Valid date macros (aligned with QBDateMacro type)
 */
export const VALID_DATE_MACROS: readonly QBDateMacro[] = [
  'Today',
  'Yesterday',
  'This Week',
  'This Week-to-date',
  'Last Week',
  'Last Week-to-date',
  'This Month',
  'This Month-to-date',
  'Last Month',
  'Last Month-to-date',
  'This Fiscal Quarter',
  'This Fiscal Quarter-to-date',
  'Last Fiscal Quarter',
  'Last Fiscal Quarter-to-date',
  'This Fiscal Year',
  'This Fiscal Year-to-date',
  'Last Fiscal Year',
  'Last Fiscal Year-to-date',
] as const

// ============================================================================
// Date Validation
// ============================================================================

/**
 * Validates a date string in YYYY-MM-DD format
 *
 * Checks:
 * - Format matches YYYY-MM-DD
 * - Year is 4 digits between 1900-2099
 * - Month is 01-12
 * - Day is valid for the given month/year
 * - Date can be parsed as a valid JavaScript Date
 *
 * @param dateStr - Date string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * isValidDate('2024-01-15') // true
 * isValidDate('2024-13-01') // false (invalid month)
 * isValidDate('2024-02-30') // false (invalid day)
 * isValidDate('01-15-2024') // false (wrong format)
 */
export function isValidDate(dateStr: string): boolean {
  // Check format: YYYY-MM-DD
  const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/
  const match = dateStr.match(dateRegex)

  if (!match) {
    return false
  }

  const [, yearStr, monthStr, dayStr] = match
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Validate year range (1900-2099)
  if (year < 1900 || year > 2099) {
    return false
  }

  // Validate month range (1-12)
  if (month < 1 || month > 12) {
    return false
  }

  // Validate day range (1-31)
  if (day < 1 || day > 31) {
    return false
  }

  // Validate actual date (handles leap years, days in month, etc.)
  const date = new Date(year, month - 1, day)

  // Check if date rolled over (e.g., Feb 30 -> Mar 2)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false
  }

  // Check if date is valid
  return !isNaN(date.getTime())
}

/**
 * Validates that start_date is before or equal to end_date
 *
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns true if range is valid, false otherwise
 *
 * @example
 * isValidDateRange('2024-01-01', '2024-12-31') // true
 * isValidDateRange('2024-12-31', '2024-01-01') // false
 */
export function isValidDateRange(startDate: string, endDate: string): boolean {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return false
  }

  const start = new Date(startDate)
  const end = new Date(endDate)

  return start <= end
}

// ============================================================================
// Enum Validators
// ============================================================================

/**
 * Validates accounting method value
 *
 * @param value - Value to validate
 * @returns true if valid accounting method
 */
export function isValidAccountingMethod(value: string): value is AccountingMethod {
  return VALID_ACCOUNTING_METHODS.includes(value as AccountingMethod)
}

/**
 * Validates summarize_column_by value
 *
 * @param value - Value to validate
 * @returns true if valid summarization period
 */
export function isValidSummarizeColumnBy(value: string): value is SummarizeColumnBy {
  return VALID_SUMMARIZE_COLUMN_BY.includes(value as SummarizeColumnBy)
}

/**
 * Validates date macro value
 *
 * @param value - Value to validate
 * @returns true if valid date macro
 */
export function isValidDateMacro(value: string): value is QBDateMacro {
  return VALID_DATE_MACROS.includes(value as QBDateMacro)
}

// ============================================================================
// Parameter Validation
// ============================================================================

/**
 * Validated report parameters result
 */
export interface ValidatedReportParams {
  orgId: string
  start_date?: string
  end_date?: string
  as_of_date?: string
  date_macro?: QBDateMacro
  accounting_method?: AccountingMethod
  summarize_column_by?: SummarizeColumnBy
  customer?: string
  vendor?: string
  department?: string
  class?: string
  [key: string]: string | undefined
}

/**
 * Validation result - success case
 */
export interface ValidationSuccess {
  success: true
  data: ValidatedReportParams
}

/**
 * Validation result - error case
 */
export interface ValidationError {
  success: false
  errors: ValidationIssue[]
}

/**
 * Result of parameter validation
 */
export type ValidationResult = ValidationSuccess | ValidationError

/**
 * Validates report query parameters from URLSearchParams
 *
 * Performs comprehensive validation:
 * - Date format and range validation
 * - Enum value validation
 * - Logical consistency checks
 * - ID format validation (basic)
 *
 * @param searchParams - URLSearchParams from Next.js request
 * @returns Validation result with either validated data or errors
 *
 * @example
 * const result = validateReportParams(request.nextUrl.searchParams)
 * if (!result.success) {
 *   return validationErrorResponse(result.errors)
 * }
 * const params = result.data
 */
export function validateReportParams(searchParams: URLSearchParams): ValidationResult {
  const errors: ValidationIssue[] = []
  const params: Partial<ValidatedReportParams> = {}

  // Validate orgId (required)
  const orgId = searchParams.get('orgId')
  if (!orgId || orgId.trim() === '') {
    errors.push({
      field: 'orgId',
      message: 'Organization ID is required',
      value: orgId,
    })
  } else {
    params.orgId = orgId.trim()
  }

  // Extract all parameters
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const asOfDate = searchParams.get('as_of_date')
  const dateMacro = searchParams.get('date_macro')
  const accountingMethod = searchParams.get('accounting_method')
  const summarizeColumnBy = searchParams.get('summarize_column_by')
  const customer = searchParams.get('customer')
  const vendor = searchParams.get('vendor')
  const department = searchParams.get('department')
  const classParam = searchParams.get('class')

  // Validate start_date
  if (startDate) {
    if (!isValidDate(startDate)) {
      errors.push({
        field: 'start_date',
        message: 'Must be a valid date in YYYY-MM-DD format',
        value: startDate,
      })
    } else {
      params.start_date = startDate
    }
  }

  // Validate end_date
  if (endDate) {
    if (!isValidDate(endDate)) {
      errors.push({
        field: 'end_date',
        message: 'Must be a valid date in YYYY-MM-DD format',
        value: endDate,
      })
    } else {
      params.end_date = endDate
    }
  }

  // Validate date range
  if (startDate && endDate && isValidDate(startDate) && isValidDate(endDate)) {
    if (!isValidDateRange(startDate, endDate)) {
      errors.push({
        field: 'date_range',
        message: 'start_date must be before or equal to end_date',
        value: { start_date: startDate, end_date: endDate },
      })
    }
  }

  // Validate as_of_date (optional, for balance sheet)
  if (asOfDate) {
    if (!isValidDate(asOfDate)) {
      errors.push({
        field: 'as_of_date',
        message: 'Must be a valid date in YYYY-MM-DD format',
        value: asOfDate,
      })
    } else {
      params.as_of_date = asOfDate
    }
  }

  // Validate date_macro
  if (dateMacro) {
    if (!isValidDateMacro(dateMacro)) {
      errors.push({
        field: 'date_macro',
        message: `Must be one of: ${VALID_DATE_MACROS.join(', ')}`,
        value: dateMacro,
      })
    } else {
      params.date_macro = dateMacro
    }
  }

  // Check for conflicting date parameters
  if (dateMacro && (startDate || endDate)) {
    errors.push({
      field: 'date_params',
      message: 'Cannot specify both date_macro and start_date/end_date',
      value: { date_macro: dateMacro, start_date: startDate, end_date: endDate },
    })
  }

  // Validate accounting_method
  if (accountingMethod) {
    if (!isValidAccountingMethod(accountingMethod)) {
      errors.push({
        field: 'accounting_method',
        message: `Must be one of: ${VALID_ACCOUNTING_METHODS.join(', ')}`,
        value: accountingMethod,
      })
    } else {
      params.accounting_method = accountingMethod
    }
  }

  // Validate summarize_column_by
  if (summarizeColumnBy) {
    if (!isValidSummarizeColumnBy(summarizeColumnBy)) {
      errors.push({
        field: 'summarize_column_by',
        message: `Must be one of: ${VALID_SUMMARIZE_COLUMN_BY.join(', ')}`,
        value: summarizeColumnBy,
      })
    } else {
      params.summarize_column_by = summarizeColumnBy
    }
  }

  // Validate entity IDs (basic validation - just check they're not empty)
  if (customer !== null && customer !== undefined) {
    if (customer.trim() === '') {
      errors.push({
        field: 'customer',
        message: 'Customer ID cannot be empty',
        value: customer,
      })
    } else {
      params.customer = customer.trim()
    }
  }

  if (vendor !== null && vendor !== undefined) {
    if (vendor.trim() === '') {
      errors.push({
        field: 'vendor',
        message: 'Vendor ID cannot be empty',
        value: vendor,
      })
    } else {
      params.vendor = vendor.trim()
    }
  }

  if (department !== null && department !== undefined) {
    if (department.trim() === '') {
      errors.push({
        field: 'department',
        message: 'Department ID cannot be empty',
        value: department,
      })
    } else {
      params.department = department.trim()
    }
  }

  if (classParam !== null && classParam !== undefined) {
    if (classParam.trim() === '') {
      errors.push({
        field: 'class',
        message: 'Class ID cannot be empty',
        value: classParam,
      })
    } else {
      params.class = classParam.trim()
    }
  }

  // Return result
  if (errors.length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: params as ValidatedReportParams }
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Creates a standardized validation error response
 *
 * @param errors - Array of validation issues
 * @returns NextResponse with 400 status
 */
export function validationErrorResponse(errors: ValidationIssue[]): NextResponse {
  return NextResponse.json(
    {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      issues: errors.map((issue) => ({
        field: issue.field,
        message: issue.message,
        ...(issue.value !== undefined && { value: issue.value }),
      })),
    },
    { status: 400 }
  )
}

/**
 * Creates a standardized missing parameter error response
 *
 * @param paramName - Name of the missing parameter
 * @returns NextResponse with 400 status
 */
export function missingParamResponse(paramName: string): NextResponse {
  return NextResponse.json(
    {
      error: `Missing required parameter: ${paramName}`,
      code: 'MISSING_PARAMETER',
      param: paramName,
    },
    { status: 400 }
  )
}

/**
 * Creates a standardized authentication required error response
 *
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function authRequiredResponse(message?: string): NextResponse {
  return NextResponse.json(
    {
      error: message || 'QuickBooks authentication required',
      code: 'AUTH_REQUIRED',
    },
    { status: 401 }
  )
}

/**
 * Creates a standardized rate limit error response
 *
 * @param retryAfterMs - Milliseconds until retry is allowed
 * @param limit - Rate limit cap (optional)
 * @param remaining - Remaining requests (optional)
 * @returns NextResponse with 429 status and Retry-After header
 */
export function rateLimitedResponse(
  retryAfterMs: number,
  limit?: number,
  remaining?: number
): NextResponse {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)

  const headers: Record<string, string> = {
    'Retry-After': retryAfterSeconds.toString(),
  }

  if (limit !== undefined) {
    headers['X-RateLimit-Limit'] = limit.toString()
  }

  if (remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = remaining.toString()
  }

  return NextResponse.json(
    {
      error: `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds`,
      code: 'RATE_LIMITED',
      retryAfter: retryAfterSeconds,
      ...(limit !== undefined && { limit }),
      ...(remaining !== undefined && { remaining }),
    },
    {
      status: 429,
      headers,
    }
  )
}

/**
 * Handles QuickBooks errors and returns appropriate response
 *
 * Converts QB error classes to standardized API responses:
 * - QBValidationError -> 400
 * - QBAuthError -> 401
 * - QBRateLimitError -> 429
 * - QBApiError -> maps status code
 * - Other errors -> 500
 *
 * @param error - Error to handle
 * @param defaultMessage - Fallback error message
 * @returns NextResponse with appropriate status code
 */
export function handleQBError(error: unknown, defaultMessage = 'Operation failed'): NextResponse {
  console.error('[QuickBooks API] Error:', error)

  // Handle validation errors
  if (isQBValidationError(error)) {
    return validationErrorResponse(error.issues)
  }

  // Handle auth errors
  if (isQBAuthError(error)) {
    return authRequiredResponse(error.message)
  }

  // Handle rate limit errors
  if (isQBRateLimitError(error)) {
    return rateLimitedResponse(error.retryAfterMs || 60000, error.limit, error.remaining)
  }

  // Handle API errors
  if (isQBApiError(error)) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.errorCode && { qb_error_code: error.errorCode }),
        ...(error.errorDetail && { details: error.errorDetail }),
      },
      { status: error.statusCode }
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check for common error patterns
    if (
      error.message.includes('No valid token') ||
      error.message.includes('TOKEN_EXPIRED') ||
      error.message.includes('authentication')
    ) {
      return authRequiredResponse()
    }

    return NextResponse.json(
      {
        error: error.message || defaultMessage,
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    )
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: defaultMessage,
      code: 'UNKNOWN_ERROR',
    },
    { status: 500 }
  )
}
