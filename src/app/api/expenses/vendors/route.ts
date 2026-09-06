import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { formatDate } from '@/quickbooks/utils/accounts'
import {
  fetchConsolidatedExpenseData,
  transformForVendorAnalysisView,
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
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const defaultRange = getDefaultDateRange()
      const startDate = searchParams.get('start') || defaultRange.start
      const endDate = searchParams.get('end') || defaultRange.end

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
        }).catch((err) => console.warn('[Vendors] Failed to store metadata:', err))
      }

      console.log(`Fetching vendor analysis data for ${organizationId}`)

      let vendorData: any

      if (providerId === 'quickbooks') {
        // Fetch consolidated expense data using the unified service
        const consolidatedData = await fetchConsolidatedExpenseData(organizationId, {
          startDate,
          endDate,
          // Don't use asOfDate here - we want date range filtering, not point-in-time
          // asOfDate is only for AP Aging and Vendor Balance reports
          includeVendorCredits: true,
          realmId,
        })

        // Transform data for vendor analysis view
        vendorData = transformForVendorAnalysisView(consolidatedData, endDate)
      } else {
        // For non-QuickBooks providers, return empty data
        vendorData = {
          transactions: [],
          vendorSummary: [],
          categoryBreakdown: [],
          monthlyTrend: [],
          topVendors: [],
          balanceDistribution: [],
          kpis: {
            totalExpenses: 0,
            totalTransactions: 0,
            totalBills: 0,
            averageExpense: 0,
            totalPaid: 0,
            totalUnpaid: 0,
            vendorCount: 0,
            categoryCount: 0,
            totalBalance: 0,
            largestBalance: 0,
            largestVendor: '',
            avgBalance: 0,
            totalBillCount: 0,
            totalCredits: 0,
          },
        }
      }

      // Build response
      const reportData = {
        reportType: 'vendor_analysis',
        organizationId,
        organizationName: 'Organization',
        fromDate: startDate,
        toDate: endDate,
        asOfDate: endDate,
        currency,
        generated: new Date().toISOString(),
        data: vendorData,
      }

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error fetching vendor analysis:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch vendor analysis',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
