/**
 * Profit and Loss Report API
 *
 * Convenience endpoint for fetching Profit & Loss (Income Statement) reports.
 *
 * GET /api/quickbooks/reports/profit-loss
 *
 * Query Parameters:
 * - start: Start date YYYY-MM-DD (optional, default: first day of current month)
 * - end: End date YYYY-MM-DD (optional, default: today)
 * - details: Include detailed statement (optional, default: true)
 * - start_date: Alternative to 'start' for compatibility
 * - end_date: Alternative to 'end' for compatibility
 * - date_macro: Date macro (optional, e.g., "This Fiscal Year-to-date")
 * - summarize_column_by: Total, Month, Quarter, Year (optional)
 * - accounting_method: Accrual or Cash (optional)
 */

import { NextRequest, NextResponse } from 'next/server'
import { transformProfitAndLoss } from '@/quickbooks/reports'
import { enrichProfitAndLoss } from '@/quickbooks/reports/enrichers'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import type { QBProfitAndLossParams } from '@/quickbooks/types/reports'
import {
  formatReportDate,
  withRetry,
  validateDateRange,
  formatErrorResponse,
} from '@/quickbooks/utils/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper functions for default dates
function formatDate(date: Date): string {
  return formatReportDate(date)
}

function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(1) // First day of current month
  return formatDate(date)
}

function getDefaultEndDate(): string {
  const date = new Date()
  return formatDate(date)
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  // Support both 'start'/'end' and 'start_date'/'end_date' query params
  const startDate =
    searchParams.get('start') || searchParams.get('start_date') || getDefaultStartDate()
  const endDate = searchParams.get('end') || searchParams.get('end_date') || getDefaultEndDate()
  const includeDetails = searchParams.get('details') !== 'false'

  // Validate date inputs
  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)

  const dateValidation = validateDateRange(startDateObj, endDateObj)
  if (!dateValidation.valid && dateValidation.error) {
    return NextResponse.json(
      {
        error: dateValidation.error.message,
        suggestion: dateValidation.error.suggestion,
        timestamp: new Date().toISOString(),
      },
      { status: dateValidation.error.statusCode }
    )
  }

  try {
    // Build params
    const params: QBProfitAndLossParams = {
      start_date: startDate,
      end_date: endDate,
    }

    // Optional params
    const dateMacro = searchParams.get('date_macro')
    if (dateMacro) params.date_macro = dateMacro as QBProfitAndLossParams['date_macro']

    const summarizeBy = searchParams.get('summarize_column_by')
    if (summarizeBy)
      params.summarize_column_by = summarizeBy as QBProfitAndLossParams['summarize_column_by']

    const accountingMethod = searchParams.get('accounting_method')
    if (accountingMethod)
      params.accounting_method = accountingMethod as QBProfitAndLossParams['accounting_method']

    // Build report URL with query parameters
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw P&L report with retry logic
    const client = new QuickBooksClient({ organizationId, realmId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/ProfitAndLoss?${reportParams.toString()}`)
    )

    // Normalize the raw report
    const normalized = transformProfitAndLoss(rawReport)

    // Get organization info for currency and name
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[P&L Report] Failed to fetch org info:', err)
      return null
    })

    // Improved currency extraction - check HomeCurrency first
    const getCurrency = (info: any): string => {
      // QuickBooks returns HomeCurrency as { value: "HKD" }
      if (info?.HomeCurrency?.value) return info.HomeCurrency.value
      // Fallback to currency_code if adapter normalized it
      if (info?.currency_code) return info.currency_code
      // Country-based fallback
      if (info?.Country === 'US') return 'USD'
      if (info?.Country === 'CA') return 'CAD'
      if (info?.Country === 'GB') return 'GBP'
      if (info?.Country === 'AU') return 'AUD'
      if (info?.Country === 'HK') return 'HKD'
      return 'USD'
    }

    const currency = getCurrency(orgInfo)
    const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

    // Enrich the normalized data
    const enriched = await enrichProfitAndLoss(normalized, organizationId, {
      includeDetails,
      startDate,
      endDate,
      currency,
      organizationName,
    })

    // Add query time to metadata
    ;(enriched.data as any).metadata = {
      ...(enriched.data as any).metadata,
      queryTime: Date.now() - startTime,
    }

    return NextResponse.json(enriched)
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate profit & loss report')
  }
})
