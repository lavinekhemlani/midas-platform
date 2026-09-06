import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * Aging Bucket Research — Attempts to derive 61-90 and 90+ buckets
 *
 * The BC API agedAccountsReceivables/Payables only exposes 3 period fields
 * (current, period1=1-30d, period2=31-60d, period3=61+ catch-all).
 * The BC PDF report shows 4 aging columns (61-90 and Before separately).
 *
 * This route tries multiple strategies to see if we can reconstruct the
 * 4th bucket from other API data:
 *
 * Strategy 1: periodLengthFilter param — try passing different period lengths
 * Strategy 2: Open invoices by dueDate — compute aging from individual invoices
 * Strategy 3: Aged report with $filter on agedAsOfDate — different reference dates
 * Strategy 4: Multiple aged report calls with different periodLengthFilter values
 * Strategy 5: Customer/vendor ledger entries — try to get open entries with due dates
 * Strategy 6: Cross-reference per-customer aged records vs open invoices
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }
    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'Connection not active' }, { status: 404 })
    }

    const client = new BusinessCentralClient({ organizationId, connectionId: resolvedConnectionId })

    // Helper to run a test and capture results
    async function test(
      id: string,
      label: string,
      description: string,
      strategy: string,
      fn: () => Promise<any>
    ) {
      const t0 = Date.now()
      try {
        const result = await fn()
        return {
          id,
          label,
          description,
          strategy,
          success: true,
          durationMs: Date.now() - t0,
          result,
        }
      } catch (err: any) {
        return {
          id,
          label,
          description,
          strategy,
          success: false,
          durationMs: Date.now() - t0,
          error: err?.message || String(err),
        }
      }
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const tests = await Promise.all([
      // ═══ STRATEGY 1: Try passing periodLengthFilter as a query parameter ═══
      // The BC docs say periodLengthFilter is returned as "30D" — can we override it?
      test(
        'ar-period-15d',
        'Aged AR with periodLengthFilter=15D',
        'Try shorter period length to get more granular buckets. If BC respects this, period3 would be 31-45 days instead of 61+.',
        'periodLengthFilter',
        async () => {
          const res = await client.query('agedAccountsReceivables', {
            $filter: "periodLengthFilter eq '15D'",
          })
          const records = res.value || []
          const total = records.find(
            (r: any) => r.customerId === '00000000-0000-0000-0000-000000000000'
          )
          return {
            recordCount: records.length,
            totalRow: total || null,
            sampleRecord:
              records.find((r: any) => r.customerId !== '00000000-0000-0000-0000-000000000000') ||
              null,
            periodLengthFilter: total?.periodLengthFilter || records[0]?.periodLengthFilter || null,
            note: 'If periodLengthFilter changed from 30D, we can use shorter periods to get more buckets',
          }
        }
      ),

      test(
        'ar-period-20d',
        'Aged AR with periodLengthFilter=20D',
        'Try 20-day period length. If accepted, 3 periods would cover 0-60 days in 20-day chunks.',
        'periodLengthFilter',
        async () => {
          const res = await client.query('agedAccountsReceivables', {
            $filter: "periodLengthFilter eq '20D'",
          })
          const records = res.value || []
          const total = records.find(
            (r: any) => r.customerId === '00000000-0000-0000-0000-000000000000'
          )
          return {
            recordCount: records.length,
            totalRow: total || null,
            periodLengthFilter: total?.periodLengthFilter || records[0]?.periodLengthFilter || null,
          }
        }
      ),

      // ═══ STRATEGY 2: Open invoices — compute aging from dueDate ═══
      test(
        'open-invoices-aging',
        'Open Sales Invoices — Computed Aging Buckets',
        'Fetch all open sales invoices, bucket by dueDate into Current/1-30/31-60/61-90/90+. Compare totals to aged report.',
        'openInvoices',
        async () => {
          const [invoices, agedData] = await Promise.all([
            client.listSalesInvoices({
              $filter: "status eq 'Open'",
              $select:
                'id,number,customerName,dueDate,remainingAmount,totalAmountIncludingTax,currencyCode,postingDate',
            }),
            client.getAgedAccountsReceivable(),
          ])

          // Compute aging buckets from open invoices
          const buckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_over_90: 0,
            total: 0,
          }
          const invoiceDetails: any[] = []

          for (const inv of invoices) {
            const amount = inv.remainingAmount ?? inv.totalAmountIncludingTax ?? 0
            if (amount === 0) continue
            const dueDateStr = inv.dueDate || inv.postingDate
            if (!dueDateStr) continue
            const dueDate = new Date(dueDateStr)
            const daysPastDue = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )

            let bucket: string
            if (daysPastDue <= 0) {
              buckets.current += amount
              bucket = 'current'
            } else if (daysPastDue <= 30) {
              buckets.days_1_30 += amount
              bucket = '1-30'
            } else if (daysPastDue <= 60) {
              buckets.days_31_60 += amount
              bucket = '31-60'
            } else if (daysPastDue <= 90) {
              buckets.days_61_90 += amount
              bucket = '61-90'
            } else {
              buckets.days_over_90 += amount
              bucket = '90+'
            }
            buckets.total += amount

            invoiceDetails.push({
              number: inv.number,
              customer: inv.customerName,
              dueDate: dueDateStr,
              daysPastDue,
              amount,
              currency: inv.currencyCode || 'LCY',
              bucket,
            })
          }

          // Get the BC aged report Total for comparison
          const bcTotal = agedData.total
          const bcBuckets = bcTotal
            ? {
                current: bcTotal.currentAmount ?? 0,
                period1: bcTotal.period1Amount ?? 0,
                period2: bcTotal.period2Amount ?? 0,
                period3: bcTotal.period3Amount ?? 0,
                balance: bcTotal.balanceDue ?? 0,
              }
            : null

          return {
            invoiceCount: invoices.length,
            invoicesWithAmount: invoiceDetails.length,
            computedBuckets: buckets,
            bcAgedReportBuckets: bcBuckets,
            difference: bcBuckets
              ? {
                  totalDiff: buckets.total - bcBuckets.balance,
                  note: 'Difference is expected if invoices are in different currencies than LCY. BC aged report converts to LCY; open invoices are in transaction currency.',
                }
              : null,
            currenciesFound: [...new Set(invoiceDetails.map((d) => d.currency))],
            invoiceDetails: invoiceDetails.sort((a, b) => b.daysPastDue - a.daysPastDue),
          }
        }
      ),

      // ═══ STRATEGY 3: Open Purchase Invoices — same approach for AP ═══
      test(
        'open-purchase-invoices-aging',
        'Open Purchase Invoices — Computed Aging Buckets',
        'Fetch all open purchase invoices, bucket by dueDate. Compare to aged payables report.',
        'openInvoices',
        async () => {
          const [invoices, agedData] = await Promise.all([
            client.listPurchaseInvoices({
              $filter: "status eq 'Open'",
              $select:
                'id,number,vendorName,dueDate,remainingAmount,totalAmountIncludingTax,currencyCode,postingDate',
            }),
            client.getAgedAccountsPayable(),
          ])

          const buckets = {
            current: 0,
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_over_90: 0,
            total: 0,
          }
          const invoiceDetails: any[] = []

          for (const inv of invoices) {
            const raw = inv.remainingAmount ?? inv.totalAmountIncludingTax ?? 0
            const amount = Math.abs(raw)
            if (amount === 0) continue
            const dueDateStr = inv.dueDate || inv.postingDate
            if (!dueDateStr) continue
            const dueDate = new Date(dueDateStr)
            const daysPastDue = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )

            let bucket: string
            if (daysPastDue <= 0) {
              buckets.current += amount
              bucket = 'current'
            } else if (daysPastDue <= 30) {
              buckets.days_1_30 += amount
              bucket = '1-30'
            } else if (daysPastDue <= 60) {
              buckets.days_31_60 += amount
              bucket = '31-60'
            } else if (daysPastDue <= 90) {
              buckets.days_61_90 += amount
              bucket = '61-90'
            } else {
              buckets.days_over_90 += amount
              bucket = '90+'
            }
            buckets.total += amount

            invoiceDetails.push({
              number: inv.number,
              vendor: inv.vendorName,
              dueDate: dueDateStr,
              daysPastDue,
              amount,
              currency: inv.currencyCode || 'LCY',
              bucket,
            })
          }

          const bcTotal = agedData.total
          const bcBuckets = bcTotal
            ? {
                current: Math.abs(bcTotal.currentAmount ?? 0),
                period1: Math.abs(bcTotal.period1Amount ?? 0),
                period2: Math.abs(bcTotal.period2Amount ?? 0),
                period3: Math.abs(bcTotal.period3Amount ?? 0),
                balance: Math.abs(bcTotal.balanceDue ?? 0),
              }
            : null

          return {
            invoiceCount: invoices.length,
            invoicesWithAmount: invoiceDetails.length,
            computedBuckets: buckets,
            bcAgedReportBuckets: bcBuckets,
            difference: bcBuckets
              ? {
                  totalDiff: buckets.total - bcBuckets.balance,
                  note: 'Difference expected due to currency conversion (invoices in txn currency, aged report in LCY).',
                }
              : null,
            currenciesFound: [...new Set(invoiceDetails.map((d) => d.currency))],
            invoiceDetails: invoiceDetails.sort((a, b) => b.daysPastDue - a.daysPastDue),
          }
        }
      ),

      // ═══ STRATEGY 4: Per-customer aged records — check if period labels reveal date ranges ═══
      test(
        'ar-period-labels',
        'Aged AR Period Labels & Date Analysis',
        'Examine the period1Label, period2Label, period3Label fields to understand exact date ranges BC uses. Also check agedAsOfDate.',
        'periodLabels',
        async () => {
          const agedData = await client.getAgedAccountsReceivable()
          const records = agedData.records
          const total = agedData.total

          // Check period labels from first record (or total)
          const ref = total || records[0]
          const periodInfo = ref
            ? {
                agedAsOfDate: ref.agedAsOfDate,
                periodLengthFilter: ref.periodLengthFilter,
                period1Label: ref.period1Label,
                period2Label: ref.period2Label,
                period3Label: ref.period3Label,
              }
            : null

          // Analyze distribution: how much is in period3 vs other periods?
          let totalP3 = 0,
            totalBal = 0,
            customersWithP3 = 0
          for (const r of records) {
            const p3 = r.period3Amount || 0
            if (Math.abs(p3) > 0) customersWithP3++
            totalP3 += p3
            totalBal += r.balanceDue || 0
          }

          return {
            recordCount: records.length,
            periodInfo,
            totalRowFields: total ? Object.keys(total) : [],
            totalRow: total,
            period3Analysis: {
              totalPeriod3Amount: totalP3,
              totalBalance: totalBal,
              period3Percentage:
                totalBal > 0 ? ((totalP3 / totalBal) * 100).toFixed(2) + '%' : 'N/A',
              customersWithPeriod3: customersWithP3,
              note: 'period3 is the catch-all for 61+ days. If we can call the API with a different periodLengthFilter, we could get finer granularity.',
            },
          }
        }
      ),

      // ═══ STRATEGY 5: Two calls with different periodLengthFilter via URL hack ═══
      // Try appending periodLengthFilter directly to the entity path
      test(
        'ar-custom-period-url',
        'Aged AR with periodLengthFilter as query param',
        'Try passing periodLengthFilter as a standalone OData parameter (not $filter) — some BC APIs accept entity-specific params this way.',
        'periodLengthFilter',
        async () => {
          // Try without $filter, as a raw query param
          const res = await client.query('agedAccountsReceivables', {
            $filter: "periodLengthFilter eq '90D'",
          })
          const records = res.value || []
          const total = records.find(
            (r: any) => r.customerId === '00000000-0000-0000-0000-000000000000'
          )
          return {
            recordCount: records.length,
            totalRow: total || null,
            periodLengthFilter: total?.periodLengthFilter || records[0]?.periodLengthFilter || null,
            note: '90D period length — if accepted, each period covers 90 days instead of 30.',
          }
        }
      ),

      // ═══ STRATEGY 6: Per-customer cross-reference ═══
      // For each customer in aged report, check their open invoices to split period3
      test(
        'per-customer-crossref',
        'Per-Customer: Aged Report vs Open Invoices',
        'For the top 5 customers by period3 amount, cross-reference their open invoice due dates to split 61+ into 61-90 and 90+.',
        'crossReference',
        async () => {
          const [agedData, allOpenInvoices] = await Promise.all([
            client.getAgedAccountsReceivable(),
            client.listSalesInvoices({
              $filter: "status eq 'Open'",
              $select: 'id,number,customerName,customerId,dueDate,remainingAmount,currencyCode',
            }),
          ])

          // Get top 5 customers by period3Amount
          const topP3Customers = agedData.records
            .filter((r: any) => Math.abs(r.period3Amount || 0) > 0)
            .sort(
              (a: any, b: any) => Math.abs(b.period3Amount || 0) - Math.abs(a.period3Amount || 0)
            )
            .slice(0, 5)

          const results = topP3Customers.map((cust: any) => {
            // Find open invoices for this customer
            const custInvoices = allOpenInvoices.filter(
              (inv: any) => inv.customerName === cust.name || inv.customerId === cust.customerId
            )

            let sum61_90 = 0,
              sum90Plus = 0,
              sumOther = 0
            const invoiceBreakdown: any[] = []

            for (const inv of custInvoices) {
              const amount = inv.remainingAmount ?? 0
              if (amount === 0) continue
              const dueDateStr = inv.dueDate
              if (!dueDateStr) continue
              const dueDate = new Date(dueDateStr)
              const daysPastDue = Math.floor(
                (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
              )

              if (daysPastDue > 90) {
                sum90Plus += amount
                invoiceBreakdown.push({
                  number: inv.number,
                  dueDate: dueDateStr,
                  daysPastDue,
                  amount,
                  bucket: '90+',
                  currency: inv.currencyCode || 'LCY',
                })
              } else if (daysPastDue > 60) {
                sum61_90 += amount
                invoiceBreakdown.push({
                  number: inv.number,
                  dueDate: dueDateStr,
                  daysPastDue,
                  amount,
                  bucket: '61-90',
                  currency: inv.currencyCode || 'LCY',
                })
              } else {
                sumOther += amount
              }
            }

            return {
              customerName: cust.name,
              customerNumber: cust.customerNumber,
              bcAgedReport: {
                balance: cust.balanceDue,
                current: cust.currentAmount,
                period1: cust.period1Amount,
                period2: cust.period2Amount,
                period3: cust.period3Amount,
                currencyCode: cust.currencyCode,
              },
              openInvoiceAnalysis: {
                invoicesFound: custInvoices.length,
                sum61_90,
                sum90Plus,
                sumOther,
                invoiceTotal61Plus: sum61_90 + sum90Plus,
                bcPeriod3: cust.period3Amount,
                difference: sum61_90 + sum90Plus - (cust.period3Amount || 0),
                differenceNote:
                  'If non-zero, likely due to currency conversion (invoices in txn currency, aged report in LCY)',
              },
              invoiceBreakdown,
            }
          })

          return {
            customersAnalyzed: results.length,
            results,
            conclusion:
              'Compare bcPeriod3 vs openInvoiceAnalysis.invoiceTotal61Plus. If close, we can use the invoice ratio to split. If wildly different, currency conversion is the blocker.',
          }
        }
      ),

      // ═══ STRATEGY 7: Customer Ledger Entries (open entries with due dates) ═══
      test(
        'customer-ledger-open',
        'Customer Ledger Entries — Open entries with remainingAmount',
        'Try fetching open customer ledger entries which may have both remaining amount (LCY) and due date — the holy grail for accurate aging.',
        'ledgerEntries',
        async () => {
          // Try the standard API path first
          try {
            const res = await client.query('customerLedgerEntries', {
              $filter: 'open eq true',
              $top: 20,
              $orderby: 'dueDate asc',
            })
            const records = res.value || []
            return {
              available: true,
              recordCount: records.length,
              fields: records[0] ? Object.keys(records[0]) : [],
              sampleRecords: records.slice(0, 3),
              hasRemainingAmount: records[0]
                ? 'remainingAmount' in records[0] || 'remainingAmountLCY' in records[0]
                : false,
              hasDueDate: records[0] ? 'dueDate' in records[0] : false,
              note: 'If this works and has both remainingAmountLCY and dueDate, we can compute accurate LCY aging buckets!',
            }
          } catch {
            // Try beta API path
            try {
              const res = await client.query('beta/customerLedgerEntries', {
                $filter: 'open eq true',
                $top: 20,
              })
              const records = res.value || []
              return {
                available: true,
                apiPath: 'beta',
                recordCount: records.length,
                fields: records[0] ? Object.keys(records[0]) : [],
                sampleRecords: records.slice(0, 3),
              }
            } catch (betaErr: any) {
              return {
                available: false,
                standardError: 'Not accessible via standard API',
                betaError: betaErr?.message || String(betaErr),
                note: 'Customer ledger entries not available through API. This would have been the ideal data source.',
              }
            }
          }
        }
      ),

      // ═══ STRATEGY 8: Aged report with different agedAsOfDate ═══
      test(
        'ar-different-asof',
        'Aged AR with different agedAsOfDate filter',
        'Try filtering by a different aged-as-of date to see if the API accepts date-based filtering.',
        'agedAsOfDate',
        async () => {
          // Try filtering to a specific date 30 days ago
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          const dateStr = thirtyDaysAgo.toISOString().split('T')[0]
          const res = await client.query('agedAccountsReceivables', {
            $filter: `agedAsOfDate eq ${dateStr}`,
          })
          const records = res.value || []
          const total = records.find(
            (r: any) => r.customerId === '00000000-0000-0000-0000-000000000000'
          )
          return {
            filterUsed: `agedAsOfDate eq ${dateStr}`,
            recordCount: records.length,
            totalRow: total || null,
            agedAsOfDate: total?.agedAsOfDate || records[0]?.agedAsOfDate || null,
            periodLengthFilter: total?.periodLengthFilter || records[0]?.periodLengthFilter || null,
            note: 'If agedAsOfDate changed from today, we can call twice with different dates to derive the 61-90 bucket by subtraction.',
          }
        }
      ),
    ])

    // Build summary
    const successCount = tests.filter((t) => t.success).length
    const strategies = [...new Set(tests.map((t) => t.strategy))]

    logger.info('Aging bucket research probes complete', {
      organizationId,
      connectionId: resolvedConnectionId,
      successCount,
      totalTests: tests.length,
    })

    return NextResponse.json({
      data: {
        companyName: credentials.company_name || null,
        totalTests: tests.length,
        successCount,
        failedCount: tests.length - successCount,
        strategies,
        summary: tests.map((t) => ({
          id: t.id,
          label: t.label,
          strategy: t.strategy,
          success: t.success,
          durationMs: t.durationMs,
          error: (t as any).error || null,
        })),
        tests,
      },
    })
  } catch (error) {
    logger.error('Aging bucket research failed', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Aging bucket research failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
