import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { formatDate } from '@/quickbooks/utils/accounts'
import {
  fetchConsolidatedExpenseData,
  transformForBillsView,
  transformForAPAgingView,
} from '@/lib/services/expenseDataService'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Get default date range (current year)
function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), 0, 1)
  return {
    start: formatDate(firstDay),
    end: formatDate(today),
  }
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const defaultRange = getDefaultDateRange()
      const startDate = searchParams.get('start') || defaultRange.start
      const endDate = searchParams.get('end') || defaultRange.end
      const view = searchParams.get('view') || 'bills' // 'bills' or 'aging'
      const asOfDate = searchParams.get('asOfDate') // For aging view

      // Get company metadata - prefer stored values to avoid API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      let currency: string = storedMetadata.homeCurrency || ''

      if (!currency) {
        // Fallback: fetch from provider API (also stores for future use)
        const orgInfo = await (provider.organizations.getOrganizationInfo as any)(
          organizationId,
          apiClient
        )
        currency = orgInfo.currency_code || 'USD'

        // Store metadata for future requests
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: currency,
          companyName: orgInfo.name || undefined,
        }).catch((err) => console.warn('[Bills] Failed to store metadata:', err))
      }

      console.log(`Fetching bills data for ${organizationId} (view: ${view})`)

      let billsData: any

      if (providerId === 'quickbooks') {
        // Fetch consolidated expense data using the unified service
        const consolidatedData = await fetchConsolidatedExpenseData(organizationId, {
          startDate,
          endDate,
          asOfDate: view === 'aging' ? asOfDate || endDate : undefined,
        })

        // Transform data based on requested view
        if (view === 'aging') {
          const agingDate = asOfDate || endDate
          billsData = transformForAPAgingView(consolidatedData, agingDate)
        } else {
          billsData = transformForBillsView(consolidatedData)
        }
      } else {
        // For non-QuickBooks providers, return empty data
        if (view === 'aging') {
          billsData = {
            bills: [],
            kpis: {
              totalBalance: 0,
              overdueBalance: 0,
              currentBalance: 0,
              billCount: 0,
              vendorCount: 0,
              avgDaysOutstanding: 0,
              percentOverdue: 0,
            },
            vendorSummary: [],
            agingDistribution: [],
            topOverdueVendors: [],
            agingBuckets: {
              current: 0,
              days1to30: 0,
              days31to60: 0,
              days61to90: 0,
              days90plus: 0,
            },
          }
        } else {
          billsData = {
            bills: [],
            kpis: {
              totalBills: 0,
              totalAmount: 0,
              totalPaid: 0,
              totalUnpaid: 0,
              overdueCount: 0,
              overdueAmount: 0,
              paidCount: 0,
              unpaidCount: 0,
              vendorCount: 0,
            },
            vendorSummary: [],
            statusDistribution: [],
            monthlyTrend: [],
          }
        }
      }

      // Build response
      const reportData = {
        dataType: view === 'aging' ? 'ap_aging' : 'bills',
        reportType: view === 'aging' ? 'ap_aging' : 'bills',
        organizationId,
        organizationName: 'Organization',
        fromDate: startDate,
        toDate: endDate,
        asOfDate: view === 'aging' ? asOfDate || endDate : undefined,
        currency,
        generated: new Date().toISOString(),
        data: billsData,
      }

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error fetching bills:', error)

      // Extract error message
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Determine error type and provide helpful response
      let statusCode = 500
      let userMessage = 'Failed to fetch bills data'
      let suggestion = 'Please try again or contact support'
      let requiresReconnect = false

      // Track error code for frontend handling
      let errorCode: string | undefined

      if (errorMessage.includes('not connected')) {
        statusCode = 401
        userMessage = 'QuickBooks account not connected'
        suggestion = 'Please reconnect your QuickBooks account in settings'
        requiresReconnect = true
        errorCode = 'PROVIDER_NOT_CONNECTED'
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        statusCode = 429
        userMessage = 'Too many requests to QuickBooks'
        suggestion = 'Please wait a moment and try again'
      } else if (errorMessage.includes('invalid_grant')) {
        statusCode = 401
        userMessage = 'QuickBooks authentication expired'
        suggestion = 'Please reconnect your QuickBooks account'
        requiresReconnect = true
        errorCode = 'PROVIDER_INVALID_GRANT'
      } else if (errorMessage.includes('timeout')) {
        statusCode = 504
        userMessage = 'Request timed out'
        suggestion = 'Try selecting a smaller date range'
      }

      return NextResponse.json(
        {
          error: userMessage,
          code: errorCode,
          suggestion,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
          timestamp: new Date().toISOString(),
          requiresReconnect,
          provider: 'quickbooks',
          userMessage: `${userMessage}. ${suggestion}`,
        },
        { status: statusCode }
      )
    }
  }
)
