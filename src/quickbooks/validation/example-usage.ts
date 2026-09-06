/**
 * Example Usage of QuickBooks Validation Utilities
 *
 * This file demonstrates how to use the validation utilities
 * in QuickBooks API route handlers.
 *
 * @example Using in a Next.js API route
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  validateReportParams,
  validationErrorResponse,
  missingParamResponse,
  handleQBError,
} from './index'

/**
 * Example API route handler with validation
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams

  // Check required parameters
  const orgId = searchParams.get('orgId')
  if (!orgId) {
    return missingParamResponse('orgId')
  }

  // Validate report parameters
  const validation = validateReportParams(searchParams)
  if (!validation.success) {
    return validationErrorResponse(validation.errors)
  }

  // Use validated parameters safely
  const params = validation.data

  try {
    // Your QuickBooks API logic here
    // const client = new QuickBooksClient({ organizationId: orgId })
    // const result = await client.fetchReport(params)

    return NextResponse.json({
      success: true,
      data: { message: 'Report fetched successfully', params },
    })
  } catch (error) {
    // Centralized error handling
    return handleQBError(error, 'Failed to fetch report')
  }
}

/**
 * Example validation usage patterns
 */
export function exampleValidationPatterns() {
  // Example 1: Valid date range
  const params1 = new URLSearchParams({
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    accounting_method: 'Accrual',
  })
  const result1 = validateReportParams(params1)
  console.log('Valid params:', result1)
  // => { success: true, data: { start_date: '2024-01-01', ... } }

  // Example 2: Invalid date format
  const params2 = new URLSearchParams({
    start_date: '01-01-2024', // Wrong format
    end_date: '2024-12-31',
  })
  const result2 = validateReportParams(params2)
  console.log('Invalid date format:', result2)
  // => { success: false, errors: [{ field: 'start_date', message: '...' }] }

  // Example 3: Invalid date range
  const params3 = new URLSearchParams({
    start_date: '2024-12-31',
    end_date: '2024-01-01', // End before start
  })
  const result3 = validateReportParams(params3)
  console.log('Invalid date range:', result3)
  // => { success: false, errors: [{ field: 'date_range', message: '...' }] }

  // Example 4: Invalid enum value
  const params4 = new URLSearchParams({
    accounting_method: 'InvalidMethod',
  })
  const result4 = validateReportParams(params4)
  console.log('Invalid enum:', result4)
  // => { success: false, errors: [{ field: 'accounting_method', message: '...' }] }

  // Example 5: Date macro (valid)
  const params5 = new URLSearchParams({
    date_macro: 'This Fiscal Year-to-date',
    summarize_column_by: 'Month',
  })
  const result5 = validateReportParams(params5)
  console.log('Valid date macro:', result5)
  // => { success: true, data: { date_macro: 'This Fiscal Year-to-date', ... } }

  // Example 6: Conflicting date parameters
  const params6 = new URLSearchParams({
    date_macro: 'This Month',
    start_date: '2024-01-01', // Conflict!
  })
  const result6 = validateReportParams(params6)
  console.log('Conflicting params:', result6)
  // => { success: false, errors: [{ field: 'date_params', message: '...' }] }
}

/**
 * Before: Without validation
 */
export async function beforeValidation(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams

  // Unsafe - no validation
  const params = {
    start_date: searchParams.get('start_date'), // Could be invalid format
    accounting_method: searchParams.get('accounting_method'), // Could be invalid value
  }

  try {
    // This might fail with cryptic QB API errors
    // const result = await client.fetchReport(params)
    return NextResponse.json({ success: true })
  } catch (error) {
    // Generic error handling
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

/**
 * After: With validation
 */
export async function afterValidation(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams

  // Validate parameters first
  const validation = validateReportParams(searchParams)
  if (!validation.success) {
    // Return clear validation errors to client
    return validationErrorResponse(validation.errors)
  }

  // Now we know params are valid
  const params = validation.data

  try {
    // This is more likely to succeed
    // const result = await client.fetchReport(params)
    return NextResponse.json({ success: true })
  } catch (error) {
    // Structured error handling with proper status codes
    return handleQBError(error, 'Failed to fetch report')
  }
}
