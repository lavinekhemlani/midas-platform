import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { formatDate } from '@/quickbooks/utils/accounts'
import { throttledRequests, withRetry } from '@/lib/utils/throttle'
import { QUERY_LIMITS } from '@/lib/providers/quickbooks/constants'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Get default date range (current month)
function getDefaultDateRange(): { start: string; end: string } {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return {
    start: formatDate(firstDay),
    end: formatDate(today),
  }
}

// Parse transaction type from QuickBooks
function getTransactionType(txnType: string): string {
  const typeMap: { [key: string]: string } = {
    JournalEntry: 'Journal Entry',
    Invoice: 'Invoice',
    Bill: 'Bill',
    Payment: 'Payment',
    Deposit: 'Deposit',
    CreditMemo: 'Credit Memo',
    VendorCredit: 'Vendor Credit',
    Purchase: 'Purchase',
    SalesReceipt: 'Sales Receipt',
    Check: 'Check',
    Transfer: 'Transfer',
    Expense: 'Expense',
  }
  return typeMap[txnType] || txnType
}

// Fetch journal entries from QuickBooks
async function fetchJournalEntries(orgId: string, startDate: string, endDate: string, realmId?: string) {
  const client = new QuickBooksClient({ organizationId: orgId, realmId })

  try {
    // Query for JournalEntry transactions within date range
    const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' MAXRESULTS 1000`
    const result = await withRetry(() => client.query(query), 3)

    return result.QueryResponse?.JournalEntry || []
  } catch (error) {
    console.error('Error fetching journal entries:', error)
    return []
  }
}

// Process journal entries into report format
function processJournalEntries(entries: any[]): any {
  const processedEntries: any[] = []
  const accountMap = new Map<string, { count: number; totalDebits: number; totalCredits: number }>()
  const transactionTypeMap = new Map<string, number>()
  const dailyMap = new Map<string, { debit: number; credit: number }>()

  let totalDebits = 0
  let totalCredits = 0
  let totalTransactions = 0

  entries.forEach((entry) => {
    const txnDate = entry.TxnDate
    const txnType = getTransactionType('JournalEntry')
    const docNumber = entry.DocNumber || ''
    const privateNote = entry.PrivateNote || ''

    // Process each line in the journal entry
    entry.Line?.forEach((line: any) => {
      if (line.DetailType === 'JournalEntryLineDetail') {
        const detail = line.JournalEntryLineDetail
        const accountName = detail.AccountRef?.name || 'Unknown'
        const postingType = detail.PostingType // 'Debit' or 'Credit'
        const amount = parseFloat(line.Amount || '0')
        const description = line.Description || privateNote || ''

        totalTransactions++

        // Track debits and credits
        if (postingType === 'Debit') {
          totalDebits += amount
        } else if (postingType === 'Credit') {
          totalCredits += amount
        }

        // Track by account
        if (!accountMap.has(accountName)) {
          accountMap.set(accountName, { count: 0, totalDebits: 0, totalCredits: 0 })
        }
        const accountData = accountMap.get(accountName)!
        accountData.count++
        if (postingType === 'Debit') {
          accountData.totalDebits += amount
        } else {
          accountData.totalCredits += amount
        }

        // Track by transaction type
        transactionTypeMap.set(txnType, (transactionTypeMap.get(txnType) || 0) + 1)

        // Track daily trend
        if (!dailyMap.has(txnDate)) {
          dailyMap.set(txnDate, { debit: 0, credit: 0 })
        }
        const dailyData = dailyMap.get(txnDate)!
        if (postingType === 'Debit') {
          dailyData.debit += amount
        } else {
          dailyData.credit += amount
        }

        // Add to processed entries
        processedEntries.push({
          date: new Date(txnDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          transactionType: txnType,
          num: docNumber,
          account: accountName,
          memo: description,
          debit: postingType === 'Debit' ? amount : 0,
          credit: postingType === 'Credit' ? amount : 0,
          originalDate: txnDate,
        })
      }
    })
  })

  // Sort entries by date (newest first)
  processedEntries.sort(
    (a, b) => new Date(b.originalDate).getTime() - new Date(a.originalDate).getTime()
  )

  // Convert maps to arrays
  const accountSummary = Array.from(accountMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      totalDebits: data.totalDebits,
      totalCredits: data.totalCredits,
    }))
    .sort((a, b) => b.count - a.count)

  const transactionTypeBreakdown = Array.from(transactionTypeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const accountActivity = accountSummary.slice(0, 10).map((account) => ({
    account: account.name,
    count: account.count,
  }))

  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      debit: data.debit,
      credit: data.credit,
      originalDate: date,
    }))
    .sort((a, b) => new Date(a.originalDate).getTime() - new Date(b.originalDate).getTime())

  return {
    entries: processedEntries,
    kpis: {
      totalEntries: entries.length,
      totalTransactions,
      totalDebits,
      totalCredits,
      balanceDifference: Math.abs(totalDebits - totalCredits),
    },
    accountSummary,
    transactionTypeBreakdown,
    accountActivity,
    dailyTrend,
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
        }).catch((err) => console.warn('[Journal Report] Failed to store metadata:', err))
      }

      console.log(`Fetching journal report for ${organizationId} from ${startDate} to ${endDate}`)

      // For QuickBooks, fetch journal entries
      let journalData: any
      if (providerId === 'quickbooks') {
        const entries = await fetchJournalEntries(organizationId, startDate, endDate, realmId)
        journalData = processJournalEntries(entries)
      } else {
        // For non-QuickBooks providers, return empty data
        journalData = {
          entries: [],
          kpis: {
            totalEntries: 0,
            totalTransactions: 0,
            totalDebits: 0,
            totalCredits: 0,
            balanceDifference: 0,
          },
          accountSummary: [],
          transactionTypeBreakdown: [],
          accountActivity: [],
          dailyTrend: [],
        }
      }

      // Build response
      const reportData = {
        reportType: 'journal_report',
        organizationId,
        organizationName: 'Organization',
        fromDate: startDate,
        toDate: endDate,
        currency,
        generated: new Date().toISOString(),
        data: journalData,
      }

      return NextResponse.json(reportData)
    } catch (error) {
      console.error('Error generating journal report:', error)
      return NextResponse.json(
        {
          error: 'Failed to generate report',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
