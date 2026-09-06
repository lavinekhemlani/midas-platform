// src/app/api/kpis/phase2/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
// Bank transaction processing is done inline
import { formatCurrency } from '@/lib/utils/currency'

// Helper function to format dates for API (YYYY-MM-DD)
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId, realmId }) => {
    try {
      const startTime = Date.now()
      const apiCallTimings: { name: string; duration: number; status: 'success' | 'failed' }[] = []

      // Detect if we're in production
      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production' ||
        !request.url.includes('localhost')

      console.log(`[KPI Phase 2] Starting - Provider: ${providerId}, Production: ${isProduction}`)

      // Helper function to track API call timing
      const trackApiCall = async (name: string, apiCall: () => Promise<any>) => {
        const callStart = Date.now()
        try {
          const result = await apiCall()
          const duration = Date.now() - callStart
          apiCallTimings.push({ name, duration, status: 'success' })
          console.log(`[Phase 2 API Call] ${name}: ${duration}ms`)
          return result
        } catch (error) {
          const duration = Date.now() - callStart
          apiCallTimings.push({ name, duration, status: 'failed' })
          console.log(`[Phase 2 API Call] ${name}: FAILED after ${duration}ms`)
          throw error
        }
      }

      // Calculate date ranges
      const now = new Date()
      // Use longer lookback for QuickBooks sandbox which has older data
      const lookbackDays = providerId === 'quickbooks' ? 120 : 30
      const thirtyDaysAgo = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

      // Fetch transaction data for revenue breakdown, daily cash flow, and recent transactions
      let invoices = []
      let salesReceipts = []
      let expenses = []
      let recentTransactions = []
      let bankAccounts = []

      console.log(
        `[Phase 2] Date range: ${formatDate(thirtyDaysAgo)} to ${formatDate(now)} (${lookbackDays} days)`
      )

      try {
        // Always fetch all transaction data in Phase 2
        const invoiceParams =
          providerId === 'quickbooks'
            ? {
                per_page: 200,
                sort_order: 'D',
                date_start: formatDate(thirtyDaysAgo),
                date_end: formatDate(now),
              }
            : {
                per_page: 200,
                sort_order: 'D',
                from_date: formatDate(thirtyDaysAgo),
                to_date: formatDate(now),
              }

        const expenseParams =
          providerId === 'quickbooks'
            ? {
                per_page: 200,
                sort_order: 'D',
                date_start: formatDate(thirtyDaysAgo),
                date_end: formatDate(now),
              }
            : {
                per_page: 200,
                sort_order: 'D',
                from_date: formatDate(thirtyDaysAgo),
                to_date: formatDate(now),
              }

        console.log(`[Phase 2] Invoice params:`, invoiceParams)
        console.log(`[Phase 2] Provider invoices available:`, !!provider.invoices)
        console.log(
          `[Phase 2] Provider invoices.listInvoices available:`,
          !!provider.invoices?.listInvoices
        )

        // QuickBooks provider methods only take 2 params (orgId, options)
        // Zoho provider methods take 3 params (orgId, options, apiClient)
        if (providerId === 'quickbooks') {
          // Check if salesReceipts is available
          const hasSalesReceipts = !!(provider as any).salesReceipts?.listSalesReceipts
          console.log(`[Phase 2] QuickBooks salesReceipts available:`, hasSalesReceipts)

          // We'll fetch additional expense types for QuickBooks
          const additionalExpenses: any[] = []

          ;[invoices, salesReceipts, expenses, recentTransactions, bankAccounts] =
            await Promise.all([
              trackApiCall('List Invoices', () =>
                (provider.invoices.listInvoices as any)(organizationId, invoiceParams)
              ).catch((err: any) => {
                console.error('[Phase 2] CRITICAL: Failed to fetch QuickBooks invoices:', {
                  error: err?.message || err,
                  params: invoiceParams,
                  organizationId,
                })
                return []
              }),
              // Fetch Sales Receipts for QuickBooks
              hasSalesReceipts
                ? trackApiCall('List Sales Receipts', () =>
                    (provider as any).salesReceipts.listSalesReceipts(organizationId, {
                      limit: 200,
                    })
                  ).catch((err: any) => {
                    console.error('[Phase 2] Error fetching QuickBooks sales receipts:', err)
                    return []
                  })
                : Promise.resolve([]),
              trackApiCall('List Expenses', () =>
                (provider.expenses?.listExpenses as any)?.(organizationId, expenseParams)
              ).catch((err: any) => {
                console.error('[Phase 2] Error fetching QuickBooks expenses:', err)
                return []
              }),
              trackApiCall('Recent Bank Transactions', () =>
                (provider.banking.getRecentTransactions as any)(organizationId, lookbackDays, {})
              ).catch((err: any) => {
                console.error('[Phase 2] Error fetching QuickBooks bank transactions:', err)
                return []
              }),
              trackApiCall('List Bank Accounts', () =>
                (provider.banking.listBankAccounts as any)(organizationId, {})
              ).catch((err: any) => {
                console.error('[Phase 2] Error fetching QuickBooks bank accounts:', err)
                return []
              }),
            ])

          // Fetch additional QuickBooks expense types that aren't covered by Bills/Purchases
          if (providerId === 'quickbooks') {
            try {
              console.log(
                '[Phase2] Fetching additional QuickBooks expense types (JournalEntries, Checks)...'
              )
              const { QuickBooksClient } = await import('@/lib/providers/quickbooks/client')
              const qbClient = new QuickBooksClient({ organizationId, realmId })

              // Query for Journal Entries with expense lines (last 30 days)
              const jeQuery = `SELECT * FROM JournalEntry WHERE TxnDate >= '${formatDate(thirtyDaysAgo)}' AND TxnDate <= '${formatDate(now)}' ORDERBY TxnDate DESC MAXRESULTS 50`
              const checkQuery = `SELECT * FROM Purchase WHERE PaymentType = 'Check' AND TxnDate >= '${formatDate(thirtyDaysAgo)}' AND TxnDate <= '${formatDate(now)}' ORDERBY TxnDate DESC MAXRESULTS 50`

              const [jeResponse, checkResponse] = await Promise.all([
                trackApiCall('QuickBooks Journal Entries', () => qbClient.query(jeQuery)).catch(
                  (err) => {
                    console.error('[Phase2] Failed to fetch journal entries:', err)
                    return { QueryResponse: { JournalEntry: [] } }
                  }
                ),
                trackApiCall('QuickBooks Check Payments', () => qbClient.query(checkQuery)).catch(
                  (err) => {
                    console.error('[Phase2] Failed to fetch check payments:', err)
                    return { QueryResponse: { Purchase: [] } }
                  }
                ),
              ])

              const journalEntries = jeResponse.QueryResponse?.JournalEntry || []
              const checkPayments = checkResponse.QueryResponse?.Purchase || []

              // Convert journal entries with debit lines (expenses) to our expense format
              journalEntries.forEach((je: any) => {
                if (je.Line && Array.isArray(je.Line)) {
                  je.Line.forEach((line: any) => {
                    // Debit lines in expense accounts represent expenses
                    if (line.JournalEntryLineDetail?.PostingType === 'Debit' && line.Amount > 0) {
                      const accountName = line.JournalEntryLineDetail?.AccountRef?.name || ''
                      // Skip asset/liability accounts, focus on expense accounts
                      if (
                        !accountName.toLowerCase().includes('asset') &&
                        !accountName.toLowerCase().includes('liability') &&
                        !accountName.toLowerCase().includes('equity')
                      ) {
                        additionalExpenses.push({
                          id: `je-${je.Id}-${line.Id}`,
                          date: je.TxnDate,
                          amount: line.Amount,
                          description: line.Description || `Journal Entry - ${accountName}`,
                          category_name: accountName || 'Journal Entry',
                        })
                      }
                    }
                  })
                }
              })

              // Add check payments
              checkPayments.forEach((check: any) => {
                additionalExpenses.push({
                  id: check.Id,
                  date: check.TxnDate,
                  amount: check.TotalAmt,
                  description: check.Line?.[0]?.Description || 'Check Payment',
                  category_name:
                    check.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name || 'Check',
                })
              })

              console.log(
                `[Phase2] Found ${additionalExpenses.length} additional expense transactions (${journalEntries.length} JE lines, ${checkPayments.length} checks)`
              )

              // Combine with existing expenses
              expenses = [...(expenses || []), ...additionalExpenses]
            } catch (error) {
              console.error('[Phase2] Failed to fetch additional QuickBooks expenses:', error)
            }
          }
        } else {
          // Zoho and other providers use the apiClient parameter
          ;[invoices, expenses, recentTransactions, bankAccounts] = await Promise.all([
            trackApiCall('List Invoices', () =>
              (provider.invoices.listInvoices as any)(organizationId, invoiceParams, apiClient)
            ).catch((err: any) => {
              console.error('[Phase 2] Error fetching invoices:', err)
              return []
            }),
            trackApiCall('List Expenses', () =>
              (provider.expenses?.listExpenses as any)?.(organizationId, expenseParams, apiClient)
            ).catch((err: any) => {
              console.error('[Phase 2] Error fetching expenses:', err)
              return []
            }),
            trackApiCall('Recent Bank Transactions', () =>
              (provider.banking.getRecentTransactions as any)(
                organizationId,
                lookbackDays,
                {},
                apiClient
              )
            ).catch((err: any) => {
              console.error('[Phase 2] Error fetching bank transactions:', err)
              return []
            }),
            trackApiCall('List Bank Accounts', () =>
              (provider.banking.listBankAccounts as any)(organizationId, {}, apiClient)
            ).catch((err: any) => {
              console.error('[Phase 2] Error fetching bank accounts:', err)
              return []
            }),
          ])
        }

        console.log(
          `[Phase 2] Fetched: ${invoices?.length || 0} invoices, ${salesReceipts?.length || 0} sales receipts, ${expenses?.length || 0} expenses, ${recentTransactions?.length || 0} bank transactions`
        )
      } catch (error) {
        console.warn('Error fetching Phase 2 data:', error)
      }

      // Build revenue breakdown from invoices AND sales receipts
      const revenueByCustomer = new Map<string, { name: string; amount: number }>()
      let totalInvoiceRevenue = 0
      let incomeDeposits: any[] = []

      // Fallback: If no traditional revenue sources, check for income deposits (Stripe/payment processor pattern)
      if (
        providerId === 'quickbooks' &&
        (!invoices || invoices.length === 0) &&
        (!salesReceipts || salesReceipts.length === 0)
      ) {
        try {
          console.log('[Phase2] No invoices/sales receipts found, checking for income deposits...')
          const { QuickBooksClient } = await import('@/lib/providers/quickbooks/client')
          const qbClient = new QuickBooksClient({ organizationId })

          // Query deposits from the last 30 days
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          const query = `SELECT * FROM Deposit WHERE TxnDate >= '${thirtyDaysAgo.toISOString().split('T')[0]}' ORDER BY TxnDate DESC MAXRESULTS 100`

          // Track this API call
          const depositResponse = await trackApiCall('QuickBooks Deposits (Fallback)', () =>
            qbClient.query(query)
          )
          const allDeposits = depositResponse.QueryResponse?.Deposit || []

          // Filter for income deposits (those categorized as Revenue/Income accounts)
          incomeDeposits = allDeposits.filter((deposit: any) => {
            return deposit.Line?.some((line: any) => {
              const accountName = line.DepositLineDetail?.AccountRef?.name?.toLowerCase() || ''
              return (
                accountName.includes('revenue') ||
                accountName.includes('income') ||
                accountName.includes('sales')
              )
            })
          })

          console.log(`[Phase2] Found ${incomeDeposits.length} income deposits`)
        } catch (error) {
          console.error('[Phase2] Failed to fetch deposits:', error)
        }
      }

      // Process invoices
      if (Array.isArray(invoices) && invoices.length > 0) {
        console.log('[Phase 2] Processing invoices for revenue breakdown:', {
          count: invoices.length,
          firstInvoice: {
            keys: Object.keys(invoices[0]),
            total: invoices[0].total,
            customer_name: invoices[0].customer_name,
          },
        })

        invoices.forEach((inv: any) => {
          const amount = parseFloat(
            String(inv.total ?? inv.amount ?? inv.TotalAmt ?? inv.Total ?? 0)
          )

          if (amount > 0) {
            totalInvoiceRevenue += amount

            const customerId =
              inv.customer_id || inv.CustomerId || inv.CustomerRef?.value || 'unknown'
            const customerName =
              inv.customer_name || inv.CustomerName || inv.CustomerRef?.name || 'Unknown Customer'

            if (!revenueByCustomer.has(customerId)) {
              revenueByCustomer.set(customerId, { name: customerName, amount: 0 })
            }

            const customer = revenueByCustomer.get(customerId)!
            customer.amount += amount
          }
        })
      }

      // Process sales receipts (for QuickBooks)
      if (Array.isArray(salesReceipts) && salesReceipts.length > 0) {
        console.log('[Phase 2] Processing sales receipts for revenue breakdown:', {
          count: salesReceipts.length,
          firstReceipt: salesReceipts[0]
            ? {
                keys: Object.keys(salesReceipts[0]),
                total: salesReceipts[0].total_amt || salesReceipts[0].TotalAmt,
                customer: salesReceipts[0].customer_ref,
              }
            : null,
        })

        salesReceipts.forEach((receipt: any) => {
          const amount = parseFloat(
            String(receipt.total_amt ?? receipt.TotalAmt ?? receipt.Total ?? 0)
          )

          if (amount > 0) {
            totalInvoiceRevenue += amount

            const customerId =
              receipt.customer_ref?.value || receipt.CustomerRef?.value || 'unknown'
            const customerName =
              receipt.customer_ref?.name || receipt.CustomerRef?.name || 'Direct Sale'

            if (!revenueByCustomer.has(customerId)) {
              revenueByCustomer.set(customerId, { name: customerName, amount: 0 })
            }

            const customer = revenueByCustomer.get(customerId)!
            customer.amount += amount
          }
        })
      }

      // Process income deposits as fallback revenue source ONLY when no traditional revenue exists
      if (
        incomeDeposits.length > 0 &&
        (!invoices || invoices.length === 0) &&
        (!salesReceipts || salesReceipts.length === 0)
      ) {
        console.log('[Phase 2] Processing income deposits for revenue breakdown (fallback mode):', {
          count: incomeDeposits.length,
        })

        incomeDeposits.forEach((deposit: any) => {
          const amount = parseFloat(deposit.TotalAmt || 0)

          if (amount > 0) {
            totalInvoiceRevenue += amount

            // Get the entity from the first line (usually the payer like Stripe)
            const entity = deposit.Line?.[0]?.DepositLineDetail?.Entity?.name || 'Direct Deposit'
            const entityId = deposit.Line?.[0]?.DepositLineDetail?.Entity?.value || 'deposit'

            if (!revenueByCustomer.has(entityId)) {
              revenueByCustomer.set(entityId, { name: entity, amount: 0 })
            }

            const customer = revenueByCustomer.get(entityId)!
            customer.amount += amount
          }
        })
      }

      const topRevenueCustomers = Array.from(revenueByCustomer.values())
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map((customer) => ({
          source: customer.name,
          amount: Math.round(customer.amount * 100) / 100,
          percentage:
            totalInvoiceRevenue > 0
              ? Math.round((customer.amount / totalInvoiceRevenue) * 1000) / 10
              : 0,
        }))

      // Build daily cash flow from transactions
      const transformedTransactions: any[] = []

      // Add income deposits to cash flow ONLY if they're our primary revenue source (no invoices/sales)
      // This prevents double-counting when customers have both deposits AND invoices
      if (
        incomeDeposits.length > 0 &&
        (!invoices || invoices.length === 0) &&
        (!salesReceipts || salesReceipts.length === 0)
      ) {
        incomeDeposits.forEach((deposit: any) => {
          transformedTransactions.push({
            id: deposit.Id,
            date: deposit.TxnDate,
            type: 'inflow', // Changed from 'income' to 'inflow' to match daily cash flow logic
            category: 'Revenue',
            description: deposit.Line?.[0]?.DepositLineDetail?.Entity?.name || 'Deposit',
            amount: parseFloat(deposit.TotalAmt || 0),
          })
        })
      }

      // Add ALL invoices for cash flow
      if (invoices && Array.isArray(invoices)) {
        invoices.forEach((inv: any) => {
          transformedTransactions.push({
            id: inv.invoice_id || inv.id,
            date: inv.date || inv.invoice_date || inv.created_at,
            amount: parseFloat(inv.total || inv.amount || '0'),
            type: 'inflow' as const,
            description: `Invoice #${inv.invoice_number || inv.number} - ${inv.customer_name || 'Customer'}`,
            category: 'Revenue',
          })
        })
      }

      // Add ALL sales receipts for cash flow
      if (salesReceipts && Array.isArray(salesReceipts)) {
        salesReceipts.forEach((receipt: any) => {
          transformedTransactions.push({
            id: receipt.id || receipt.Id,
            date: receipt.txn_date || receipt.TxnDate || receipt.created_time,
            amount: parseFloat(receipt.total_amt || receipt.TotalAmt || '0'),
            type: 'inflow' as const,
            description: `Sales Receipt #${receipt.doc_number || receipt.DocNumber || receipt.id} - ${receipt.customer_ref?.name || receipt.CustomerRef?.name || 'Direct Sale'}`,
            category: 'Revenue',
          })
        })
      }

      // Add ALL expenses for cash flow
      if (expenses && Array.isArray(expenses)) {
        expenses.forEach((exp: any) => {
          transformedTransactions.push({
            id: exp.expense_id || exp.id,
            date: exp.date || exp.expense_date || exp.created_at,
            amount: parseFloat(exp.total || exp.amount || '0'),
            type: 'outflow' as const,
            description: exp.description || exp.account_name || 'Expense',
            category: exp.category_name || 'Operating Expense',
          })
        })
      }

      // For QuickBooks, if we have few or no expenses, we might be missing transaction types
      // The expenses endpoint only returns Bills and Purchases, but P&L includes more
      if (providerId === 'quickbooks' && expenses && expenses.length < 5) {
        console.log(
          `[Phase2] QuickBooks: Only ${expenses.length} expenses found via API. P&L report likely includes additional expense types (payroll, checks, journal entries).`
        )
      }

      // Add bank transactions ONLY for providers other than QuickBooks
      // QuickBooks already has invoices, sales receipts, expenses, and deposits covered
      if (providerId !== 'quickbooks' && recentTransactions && Array.isArray(recentTransactions)) {
        // transformBankTransactionsForCashFlow returns the daily flow array directly
        // We need to convert bank transactions to the format we need
        recentTransactions.forEach((txn: any) => {
          const amount = parseFloat(txn.amount || '0')
          const isInflow =
            txn.transaction_type === 'debit' || txn.debit_or_credit === 'debit' || amount > 0

          transformedTransactions.push({
            id: txn.transaction_id || txn.id,
            date: txn.date || txn.transaction_date,
            amount: Math.abs(amount),
            type: isInflow ? 'inflow' : 'outflow',
            description:
              txn.description || txn.payee_name || txn.reference_number || 'Bank Transaction',
            category: txn.transaction_type || 'Banking',
          })
        })
      }

      // Group by date for daily cash flow chart
      const dailyCashFlowMap = new Map<
        string,
        { date: string; inflow: number; outflow: number; net: number }
      >()

      transformedTransactions.forEach((txn) => {
        const dateStr = new Date(txn.date).toISOString().split('T')[0]

        if (!dailyCashFlowMap.has(dateStr)) {
          dailyCashFlowMap.set(dateStr, {
            date: dateStr,
            inflow: 0,
            outflow: 0,
            net: 0,
          })
        }

        const dayData = dailyCashFlowMap.get(dateStr)!
        if (txn.type === 'inflow') {
          dayData.inflow += txn.amount
        } else {
          dayData.outflow += txn.amount
        }
        dayData.net = dayData.inflow - dayData.outflow
      })

      const dailyCashFlow = Array.from(dailyCashFlowMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30)
        .map((day) => ({
          date: day.date,
          inflow: Math.round(day.inflow * 100) / 100,
          outflow: Math.round(day.outflow * 100) / 100,
          net: Math.round(day.net * 100) / 100,
        }))

      // Build recent transactions list (convert type for RecentTransactions component)
      const recentTransactionsList = transformedTransactions
        .filter((txn) => new Date(txn.date) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50) // Get more transactions for pagination
        .map((txn) => ({
          id: txn.id,
          date: txn.date,
          description: txn.description,
          amount: Math.round(txn.amount * 100) / 100,
          type: txn.type === 'inflow' ? 'invoice' : 'expense', // Convert to component's expected type
          status: txn.type === 'inflow' ? 'paid' : 'processed',
          category: txn.category,
        }))

      const totalDuration = Date.now() - startTime

      // Log summary of API calls
      const successfulCalls = apiCallTimings.filter((t) => t.status === 'success')
      const failedCalls = apiCallTimings.filter((t) => t.status === 'failed')
      const totalApiTime = apiCallTimings.reduce((sum, t) => sum + t.duration, 0)

      console.log(`[KPI Phase 2] Completed in ${totalDuration}ms`)
      console.log(
        `[KPI Phase 2] API Calls: ${successfulCalls.length} successful, ${failedCalls.length} failed`
      )
      console.log(
        `[KPI Phase 2] Total API time: ${totalApiTime}ms, Processing time: ${totalDuration - totalApiTime}ms`
      )
      console.log(`[KPI Phase 2] Final revenue breakdown:`, {
        customersWithRevenue: topRevenueCustomers.length,
        totalRevenue: totalInvoiceRevenue,
        revenueSource: incomeDeposits.length > 0 ? 'deposits' : 'invoices/sales',
        depositCount: incomeDeposits.length,
        topCustomers: topRevenueCustomers
          .slice(0, 3)
          .map((c) => ({ name: c.source, amount: c.amount })),
      })

      // Return Phase 2 data
      return NextResponse.json({
        phase: 2,
        dailyCashFlow,
        recentTransactions: recentTransactionsList,
        revenueBreakdown: topRevenueCustomers,
        revenueBreakdownTotal: totalInvoiceRevenue,
        duration: totalDuration,
        apiTimings: apiCallTimings,
        counts: {
          invoices: invoices?.length || 0,
          salesReceipts: salesReceipts?.length || 0,
          expenses: expenses?.length || 0,
          bankTransactions: recentTransactions?.length || 0,
        },
      })
    } catch (error) {
      console.error('KPI Phase 2 API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch Phase 2 data',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
