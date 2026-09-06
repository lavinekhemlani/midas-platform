import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/cash-flow-statement
 *
 * Fetches cash flow data from BC API with 3-tier fallback:
 *   1. `cashFlowStatement` report entity (not available on all environments)
 *   2. `trialBalance` + `accounts` — uses trialBalance for real numbers (totalDebit/totalCredit
 *      for period changes, balanceAtDateDebit/balanceAtDateCredit for cumulative balances)
 *      and accounts for category metadata. Reconstructs cash position from cash/bank accounts.
 *   3. `generalLedgerEntries` + `accounts` — uses GL entries aggregated by cash/bank account
 *      numbers. Fetches cumulative balances (all entries up to endDate) and period movement
 *      (entries within startDate..endDate). Most universally available fallback.
 *
 * The `accounts` entity's FlowFields (balance, netChange) return 0 on many BC environments,
 * so we NEVER rely on them for actual amounts.
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

    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

    // Build date filter using BC's FlowFilter range syntax: dateFilter eq 'start..end'
    let filter: string | undefined
    if (startDate && endDate) {
      filter = `dateFilter eq '${startDate}..${endDate}'`
    } else if (endDate) {
      filter = `dateFilter eq '..${endDate}'`
    } else if (startDate) {
      filter = `dateFilter eq '${startDate}..'`
    }

    let cashFlowData: any[] = []
    let bankAccounts: any[] = []
    let source: 'cashFlowStatement' | 'trialBalance' | 'generalLedger' = 'cashFlowStatement'

    // Always fetch bank accounts (universally available, for display metadata)
    bankAccounts = await client.listBankAccounts().catch(() => [])

    // ── Strategy 1: Try the cashFlowStatement report entity ──
    try {
      cashFlowData = await client.getCashFlowStatement(filter ? { $filter: filter } : undefined)
    } catch (reportError: any) {
      logger.warn('cashFlowStatement entity not available, trying trialBalance fallback', {
        organizationId,
        connectionId: resolvedConnectionId,
        error: reportError.message,
      })

      // ── Strategy 2: trialBalance (real numbers) + accounts (categories) ──
      try {
        source = 'trialBalance'

        // Fetch trialBalance — try with date filter, fall back to unfiltered if not supported
        let trialBalanceData: any[]
        try {
          trialBalanceData = await client.getTrialBalance(filter ? { $filter: filter } : undefined)
        } catch {
          logger.warn('trialBalance with dateFilter failed, retrying without filter', {
            organizationId,
            connectionId: resolvedConnectionId,
          })
          trialBalanceData = await client.getTrialBalance()
        }
        const allAccounts = await client.queryAll('accounts')

        // Build account number → category + accountType mapping from accounts entity.
        const categoryMap: Record<
          string,
          { category: string; subCategory: string; accountType: string }
        > = {}
        for (const acc of allAccounts) {
          if (acc.number) {
            categoryMap[acc.number] = {
              category: acc.category || '',
              subCategory: acc.subCategory || 'General',
              accountType: (acc.accountType || '').toLowerCase(),
            }
          }
        }

        // Filter to cash/bank posting accounts
        const cashEntries: Array<{
          number: string
          display: string
          balance: number
          netChange: number
          subCategory: string
        }> = []

        for (const tb of trialBalanceData) {
          const catInfo = categoryMap[tb.number]
          if (!catInfo) continue
          if (catInfo.category !== 'Assets') continue
          if (catInfo.subCategory !== 'Cash' && catInfo.subCategory !== 'Bank') continue

          // Only include Posting accounts — skip Heading, Begin-Total, End-Total, Total
          if (catInfo.accountType && catInfo.accountType !== 'posting') continue

          // Assets are debit normal: balance = debit - credit
          const balDebit = tb.balanceAtDateDebit ?? 0
          const balCredit = tb.balanceAtDateCredit ?? 0
          const balance = balDebit - balCredit

          // Period net change = totalDebit - totalCredit (debit normal for assets)
          const periodDebit = tb.totalDebit ?? 0
          const periodCredit = tb.totalCredit ?? 0
          const netChange = periodDebit - periodCredit

          cashEntries.push({
            number: tb.number,
            display: tb.display || tb.number,
            balance,
            netChange,
            subCategory: catInfo.subCategory,
          })
        }

        // Group by subCategory (Cash vs Bank)
        const grouped: Record<string, typeof cashEntries> = {}
        for (const entry of cashEntries) {
          if (!grouped[entry.subCategory]) grouped[entry.subCategory] = []
          grouped[entry.subCategory].push(entry)
        }

        // Build structured line items
        let lineNumber = 0
        cashFlowData = []
        const subCategoryOrder = ['Cash', 'Bank']

        for (const sub of subCategoryOrder) {
          const accounts = grouped[sub]
          if (!accounts || accounts.length === 0) continue

          cashFlowData.push({
            lineNumber: lineNumber++,
            display: `${sub} Accounts`,
            netChange: 0,
            balance: 0,
            lineType: 'header',
            indentation: 0,
            _subCategory: sub,
          })

          let subTotalBalance = 0
          let subTotalNetChange = 0

          for (const acc of accounts) {
            cashFlowData.push({
              lineNumber: lineNumber++,
              display: acc.display,
              netChange: acc.netChange,
              balance: acc.balance,
              lineType: 'detail',
              indentation: 1,
              _accountNumber: acc.number,
              _subCategory: sub,
            })
            subTotalBalance += acc.balance
            subTotalNetChange += acc.netChange
          }

          cashFlowData.push({
            lineNumber: lineNumber++,
            display: `Total ${sub} Accounts`,
            netChange: subTotalNetChange,
            balance: subTotalBalance,
            lineType: 'total',
            indentation: 0,
            _subCategory: sub,
          })
        }

        // Grand total line
        const grandBalance = cashEntries.reduce((sum, e) => sum + e.balance, 0)
        const grandNetChange = cashEntries.reduce((sum, e) => sum + e.netChange, 0)
        cashFlowData.push({
          lineNumber: lineNumber++,
          display: 'Total Cash & Bank',
          netChange: grandNetChange,
          balance: grandBalance,
          lineType: 'total',
          indentation: 0,
          _isGrandTotal: true,
        })
      } catch (tbError: any) {
        logger.warn('trialBalance fallback also failed, trying GL entries fallback', {
          organizationId,
          connectionId: resolvedConnectionId,
          error: tbError.message,
        })

        // ── Strategy 3: generalLedgerEntries + accounts ──
        // Most universally available: aggregate GL entries by cash/bank accounts
        try {
          source = 'generalLedger'
          const allAccounts = await client.queryAll('accounts')

          // Identify cash/bank posting accounts
          const cashSubCategories = ['cash', 'bank', 'checking', 'savings']
          const cashAccounts: Array<{
            number: string
            displayName: string
            subCategory: string
          }> = []

          for (const acc of allAccounts) {
            if (!acc.number) continue
            const accType = (acc.accountType || '')
              .replace(/_x([0-9a-f]{4})_/gi, (_, hex: string) =>
                String.fromCharCode(parseInt(hex, 16))
              )
              .toLowerCase()
            if (accType !== 'posting') continue

            const cat = (acc.category || '').trim()
            if (cat !== 'Assets') continue

            const sub = (acc.subCategory || '').toLowerCase()
            if (!cashSubCategories.some((s) => sub.includes(s))) continue

            cashAccounts.push({
              number: acc.number,
              displayName: acc.displayName || acc.number,
              subCategory: acc.subCategory || 'Cash',
            })
          }

          const cashNums = new Set(cashAccounts.map((a) => a.number))

          // Fetch GL entries in parallel: cumulative (balance) + period (net change)
          const [cumulativeEntries, periodEntries] = await Promise.all([
            // Cumulative: all entries up to endDate for balance
            client.listGeneralLedgerEntries({
              $select: 'accountNumber,debitAmount,creditAmount',
              ...(endDate && { $filter: `postingDate le ${endDate}` }),
            }),
            // Period: entries within date range for net change
            startDate && endDate
              ? client.listGeneralLedgerEntries({
                  $select: 'accountNumber,debitAmount,creditAmount',
                  $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
                })
              : Promise.resolve([]),
          ])

          // Aggregate cumulative balances
          const cumulativeAmounts = new Map<string, number>()
          for (const entry of cumulativeEntries) {
            const accNum = entry.accountNumber
            if (!accNum || !cashNums.has(accNum)) continue
            cumulativeAmounts.set(
              accNum,
              (cumulativeAmounts.get(accNum) ?? 0) +
                (entry.debitAmount ?? 0) -
                (entry.creditAmount ?? 0)
            )
          }

          // Aggregate period net changes
          const periodAmounts = new Map<string, number>()
          for (const entry of periodEntries) {
            const accNum = entry.accountNumber
            if (!accNum || !cashNums.has(accNum)) continue
            periodAmounts.set(
              accNum,
              (periodAmounts.get(accNum) ?? 0) +
                (entry.debitAmount ?? 0) -
                (entry.creditAmount ?? 0)
            )
          }

          // Group by subCategory and build structured line items
          const grouped: Record<
            string,
            Array<{
              number: string
              display: string
              balance: number
              netChange: number
              subCategory: string
            }>
          > = {}

          for (const acc of cashAccounts) {
            const balance = cumulativeAmounts.get(acc.number) ?? 0
            const netChange = periodAmounts.get(acc.number) ?? 0
            const sub = acc.subCategory
            if (!grouped[sub]) grouped[sub] = []
            grouped[sub].push({
              number: acc.number,
              display: acc.displayName,
              balance,
              netChange,
              subCategory: sub,
            })
          }

          let lineNumber = 0
          cashFlowData = []
          const subCategoryOrder = ['Cash', 'Bank', 'Checking', 'Savings']

          for (const sub of subCategoryOrder) {
            const accounts = grouped[sub]
            if (!accounts || accounts.length === 0) continue

            cashFlowData.push({
              lineNumber: lineNumber++,
              display: `${sub} Accounts`,
              netChange: 0,
              balance: 0,
              lineType: 'header',
              indentation: 0,
              _subCategory: sub,
            })

            let subTotalBalance = 0
            let subTotalNetChange = 0

            for (const acc of accounts) {
              cashFlowData.push({
                lineNumber: lineNumber++,
                display: acc.display,
                netChange: acc.netChange,
                balance: acc.balance,
                lineType: 'detail',
                indentation: 1,
                _accountNumber: acc.number,
                _subCategory: sub,
              })
              subTotalBalance += acc.balance
              subTotalNetChange += acc.netChange
            }

            cashFlowData.push({
              lineNumber: lineNumber++,
              display: `Total ${sub} Accounts`,
              netChange: subTotalNetChange,
              balance: subTotalBalance,
              lineType: 'total',
              indentation: 0,
              _subCategory: sub,
            })
          }

          // Grand total line
          const grandBalance = cashAccounts.reduce(
            (sum, a) => sum + (cumulativeAmounts.get(a.number) ?? 0),
            0
          )
          const grandNetChange = cashAccounts.reduce(
            (sum, a) => sum + (periodAmounts.get(a.number) ?? 0),
            0
          )
          cashFlowData.push({
            lineNumber: lineNumber++,
            display: 'Total Cash & Bank',
            netChange: grandNetChange,
            balance: grandBalance,
            lineType: 'total',
            indentation: 0,
            _isGrandTotal: true,
          })
        } catch (glError: any) {
          logger.error('All cash flow fallbacks failed', {
            organizationId,
            connectionId: resolvedConnectionId,
            error: glError.message,
          })
          return NextResponse.json(
            {
              error: 'Cash flow data not available',
              details: `cashFlowStatement, trialBalance, and generalLedgerEntries all failed: ${glError.message}`,
            },
            { status: 404 }
          )
        }
      }
    }

    // Compute totals from cash flow lines
    let totalOperating = 0
    let totalInvesting = 0
    let totalFinancing = 0
    let netChange = 0
    let totalBalance = 0

    if (source === 'cashFlowStatement') {
      for (const line of cashFlowData) {
        const amount = line.netChange ?? 0
        const display = (line.display || '').toLowerCase()
        const lineType = (line.lineType || '').toLowerCase()

        if (lineType === 'total') {
          if (display.includes('operating')) {
            totalOperating = amount
          } else if (display.includes('investing')) {
            totalInvesting = amount
          } else if (display.includes('financing')) {
            totalFinancing = amount
          } else if (display.includes('net change') || display.includes('net increase')) {
            netChange = amount
          }
        }
      }
      if (netChange === 0) {
        netChange = totalOperating + totalInvesting + totalFinancing
      }
    } else {
      // For trialBalance / generalLedger fallback, use the grand total line
      const grandTotal = cashFlowData.find((l: any) => l._isGrandTotal)
      netChange = grandTotal?.netChange ?? 0
      totalBalance = grandTotal?.balance ?? 0
    }

    const companyName = credentials.company_name || null

    logger.info('BC cash flow statement fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      source,
      lineCount: cashFlowData.length,
      bankAccountCount: bankAccounts.length,
    })

    return NextResponse.json({
      data: {
        lines: cashFlowData,
        bankAccounts,
        totals: { totalOperating, totalInvesting, totalFinancing, netChange, totalBalance },
        companyName,
        period: { startDate, endDate },
        source,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC cash flow statement', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch cash flow statement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
