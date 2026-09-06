/**
 * QuickBooks Bills API Route
 * Fetches bills and AP aging data using @/quickbooks architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOrgPK } from '@/lib/db/keys'

/**
 * GET handler for bills data
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('organizationId')
  const realmId = searchParams.get('realmId') || undefined

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
  }

  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')
  const view = searchParams.get('view') || 'bills' // 'bills' or 'aging'
  const asOfDate = searchParams.get('asOfDate')

  try {
    // 1. Check connection status using DynamoDB credentials
    // Use createOrgPK to properly normalize the organization ID
    const dbOrgId = createOrgPK(organizationId)

    const { getProviderCredentialsFromDB } = await import('@/lib/providers/database')
    const credentials = await getProviderCredentialsFromDB(dbOrgId, 'quickbooks')

    if (!credentials || !credentials.connected) {
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

    // 2. Get company info for currency using QuickBooksClient
    const { QuickBooksClient } = await import('@/lib/providers/quickbooks/client')
    const client = new QuickBooksClient({ organizationId: dbOrgId, realmId })

    const companyInfo = await client.getCompanyInfoCached().catch(() => ({
      CompanyName: 'Organization',
      HomeCurrency: { value: 'USD' },
    }))

    const currency = companyInfo?.HomeCurrency?.value || 'USD'
    const organizationName = companyInfo?.CompanyName || 'Organization'

    // 3. Fetch bills data using existing service
    const { fetchConsolidatedExpenseData, transformForBillsView, transformForAPAgingView } =
      await import('@/lib/services/expenseDataService')

    // Get default date range if not provided
    const today = new Date()
    const firstDayOfYear = new Date(today.getFullYear(), 0, 1)
    const defaultStartDate = firstDayOfYear.toISOString().split('T')[0]
    const defaultEndDate = today.toISOString().split('T')[0]

    const consolidatedData = await fetchConsolidatedExpenseData(dbOrgId, {
      startDate: startDate || defaultStartDate,
      endDate: endDate || defaultEndDate,
      asOfDate: view === 'aging' ? asOfDate || endDate || defaultEndDate : undefined,
      realmId,
    })

    // 4. Transform based on view
    const billsData =
      view === 'aging'
        ? transformForAPAgingView(consolidatedData, asOfDate || endDate || defaultEndDate)
        : transformForBillsView(consolidatedData)

    // 5. Return response
    return NextResponse.json({
      dataType: view === 'aging' ? 'ap_aging' : 'bills',
      reportType: view === 'aging' ? 'ap_aging' : 'bills',
      organizationId,
      organizationName,
      fromDate: startDate || defaultStartDate,
      toDate: endDate || defaultEndDate,
      asOfDate: view === 'aging' ? asOfDate || endDate || defaultEndDate : undefined,
      currency,
      generated: new Date().toISOString(),
      data: billsData,
    })
  } catch (error) {
    console.error('[QuickBooks Bills] Error:', error)

    // Check for error code property first (set by QuickBooksClient)
    const errorCode = (error as any)?.code
    const requiresReconnect = (error as any)?.requiresReconnect
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Handle PROVIDER_INVALID_GRANT errors (authentication failed)
    if (
      errorCode === 'PROVIDER_INVALID_GRANT' ||
      requiresReconnect ||
      errorMessage.includes('authentication failed')
    ) {
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

    const { isQBAuthError, isQBRateLimitError } = await import('@/quickbooks')

    if (isQBAuthError(error)) {
      // Map QBAuthError codes to PROVIDER_* codes for frontend handling
      const providerCode =
        error.code === 'INVALID_GRANT'
          ? 'PROVIDER_INVALID_GRANT'
          : error.code === 'NOT_CONNECTED'
            ? 'PROVIDER_NOT_CONNECTED'
            : 'PROVIDER_INVALID_GRANT'
      return NextResponse.json(
        {
          error: 'Authentication failed',
          code: providerCode,
          requiresReconnect: true,
          provider: 'quickbooks',
        },
        { status: 401 }
      )
    }

    if (isQBRateLimitError(error)) {
      return NextResponse.json(
        { error: 'Rate limited', retryAfter: (error as any).retryAfterMs },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch bills',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

/**
 * Bills route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
