/**
 * QuickBooks Reports API
 *
 * Fetches financial reports from QuickBooks Online.
 * Reports are fetched in real-time (not stored) to comply with data privacy policy.
 *
 * GET /api/quickbooks/reports?type=ProfitAndLoss&orgId=ORG%23xxx
 *
 * Query Parameters:
 * - orgId: Organization ID (required)
 * - type: Report type (required) - ProfitAndLoss, BalanceSheet, CashFlow, etc.
 * - start_date: Start date YYYY-MM-DD (optional)
 * - end_date: End date YYYY-MM-DD (optional)
 * - date_macro: Date macro like "This Fiscal Year-to-date" (optional)
 * - summarize_column_by: Total, Month, Quarter, Year (optional)
 * - accounting_method: Accrual or Cash (optional)
 * - normalized: Whether to return normalized data (default: true)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  transformProfitAndLoss,
  transformBalanceSheet,
  transformCashFlow,
  transformAgedReport,
  transformTrialBalance,
} from '@/quickbooks/reports'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import type { QBReportType, QBReportQueryParams } from '@/quickbooks/types/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Valid report types
const VALID_REPORT_TYPES: QBReportType[] = [
  'ProfitAndLoss',
  'ProfitAndLossDetail',
  'BalanceSheet',
  'CashFlow',
  'GeneralLedger',
  'TrialBalance',
  'AgedReceivables',
  'AgedReceivableDetail',
  'AgedPayables',
  'AgedPayableDetail',
  'TransactionList',
  'CustomerIncome',
  'CustomerBalance',
  'CustomerBalanceDetail',
  'VendorBalance',
  'VendorBalanceDetail',
  'AccountListDetail',
]

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams

  // Required parameters
  const orgId = searchParams.get('orgId')
  const realmId = searchParams.get('realmId') || undefined
  const reportType = searchParams.get('type') as QBReportType | null

  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
  }

  if (!reportType) {
    return NextResponse.json(
      {
        error: 'Missing type parameter',
        validTypes: VALID_REPORT_TYPES,
      },
      { status: 400 }
    )
  }

  if (!VALID_REPORT_TYPES.includes(reportType)) {
    return NextResponse.json(
      {
        error: `Invalid report type: ${reportType}`,
        validTypes: VALID_REPORT_TYPES,
      },
      { status: 400 }
    )
  }

  // Optional parameters
  const params: QBReportQueryParams = {}

  const startDate = searchParams.get('start_date')
  if (startDate) params.start_date = startDate

  const endDate = searchParams.get('end_date')
  if (endDate) params.end_date = endDate

  const dateMacro = searchParams.get('date_macro')
  if (dateMacro) params.date_macro = dateMacro as QBReportQueryParams['date_macro']

  const summarizeBy = searchParams.get('summarize_column_by')
  if (summarizeBy)
    params.summarize_column_by = summarizeBy as QBReportQueryParams['summarize_column_by']

  const accountingMethod = searchParams.get('accounting_method')
  if (accountingMethod)
    params.accounting_method = accountingMethod as QBReportQueryParams['accounting_method']

  const customer = searchParams.get('customer')
  if (customer) params.customer = customer

  const vendor = searchParams.get('vendor')
  if (vendor) params.vendor = vendor

  const department = searchParams.get('department')
  if (department) params.department = department

  const classParam = searchParams.get('class')
  if (classParam) params.class = classParam

  // Whether to normalize the response (default: true)
  const normalized = searchParams.get('normalized') !== 'false'

  try {
    // Create QuickBooks client (uses DynamoDB for token storage)
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Build report URL with query parameters
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    // Add minor version for latest API features
    reportParams.set('minorversion', '65')

    const endpoint = `/reports/${reportType}?${reportParams.toString()}`

    // Fetch the report
    const rawReport = await client.request(endpoint)

    // Return raw or normalized based on parameter
    if (!normalized) {
      return NextResponse.json({
        success: true,
        reportType,
        data: rawReport,
      })
    }

    // Transform based on report type
    let normalizedData: unknown

    switch (reportType) {
      case 'ProfitAndLoss':
      case 'ProfitAndLossDetail':
        normalizedData = transformProfitAndLoss(rawReport)
        break

      case 'BalanceSheet':
        normalizedData = transformBalanceSheet(rawReport)
        break

      case 'CashFlow':
        normalizedData = transformCashFlow(rawReport)
        break

      case 'AgedReceivables':
      case 'AgedReceivableDetail':
      case 'AgedPayables':
      case 'AgedPayableDetail':
        normalizedData = transformAgedReport(rawReport)
        break

      case 'TrialBalance':
        normalizedData = transformTrialBalance(rawReport)
        break

      default:
        // For reports without specific transformers, return raw data
        normalizedData = rawReport
    }

    return NextResponse.json({
      success: true,
      reportType,
      data: normalizedData,
    })
  } catch (error) {
    console.error(`[QuickBooks Reports] Error fetching ${reportType}:`, error)

    // Check for error code property first (set by QuickBooksClient)
    const errorCode = (error as any)?.code
    const requiresReconnect = (error as any)?.requiresReconnect

    // Handle PROVIDER_INVALID_GRANT errors (authentication failed)
    if (errorCode === 'PROVIDER_INVALID_GRANT' || requiresReconnect) {
      return NextResponse.json(
        {
          error: 'QuickBooks authentication expired',
          code: 'PROVIDER_INVALID_GRANT',
          requiresReconnect: true,
          provider: 'quickbooks',
          userMessage: 'Your QuickBooks connection has expired. Please reconnect.',
        },
        { status: 401 }
      )
    }

    // Handle specific error types
    if (error instanceof Error) {
      const errorMessage = error.message

      if (
        errorMessage.includes('No valid token') ||
        errorMessage.includes('TOKEN_EXPIRED') ||
        errorMessage.includes('invalid_grant') ||
        errorMessage.includes('authentication failed')
      ) {
        return NextResponse.json(
          {
            error: 'QuickBooks authentication required',
            code: 'PROVIDER_INVALID_GRANT',
            requiresReconnect: true,
            provider: 'quickbooks',
          },
          { status: 401 }
        )
      }

      if (errorMessage.includes('not connected')) {
        return NextResponse.json(
          {
            error: 'QuickBooks not connected',
            code: 'PROVIDER_NOT_CONNECTED',
            requiresReconnect: true,
            provider: 'quickbooks',
          },
          { status: 401 }
        )
      }

      if (errorMessage.includes('Rate limit')) {
        return NextResponse.json(
          {
            error: 'QuickBooks API rate limit exceeded. Please try again later.',
            code: 'RATE_LIMITED',
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error: errorMessage,
          code: 'REPORT_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch report',
        code: 'UNKNOWN_ERROR',
      },
      { status: 500 }
    )
  }
}
