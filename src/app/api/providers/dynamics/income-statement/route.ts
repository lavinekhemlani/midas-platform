import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/income-statement
 *
 * Fetches P&L data from BC API with 3-tier fallback:
 *   1. `incomeStatement` report entity (formatted report — not available on all environments)
 *   2. `trialBalance` + `accounts` (trialBalance has actual period numbers, accounts has categories)
 *   3. Returns error if both report entities are unavailable
 *
 * The `accounts` entity's FlowFields (balance, netChange) return 0 on many BC environments,
 * so we NEVER rely on them for actual amounts. Instead we use trialBalance which has
 * `totalDebit` / `totalCredit` with real computed values for the period.
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
    // Standard OData ge/le operators are NOT supported on report entity dateFilter fields.
    let filter: string | undefined
    if (startDate && endDate) {
      filter = `dateFilter eq '${startDate}..${endDate}'`
    } else if (endDate) {
      filter = `dateFilter eq '..${endDate}'`
    } else if (startDate) {
      filter = `dateFilter eq '${startDate}..'`
    }

    let data: any[] = []
    let source: 'incomeStatement' | 'trialBalance' = 'incomeStatement'

    // ── Strategy 1: Try the incomeStatement report entity ──
    try {
      data = await client.getIncomeStatement(filter ? { $filter: filter } : undefined)
    } catch (reportError: any) {
      logger.warn('incomeStatement entity not available, trying trialBalance fallback', {
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
        // We use accounts entity for accountType because trialBalance may not reliably
        // expose it (different formats across BC versions).
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

        // Filter to P&L posting accounts and compute period net change
        const plEntries: Array<{
          number: string
          display: string
          netChange: number
          category: string
          subCategory: string
        }> = []

        for (const tb of trialBalanceData) {
          const catInfo = categoryMap[tb.number]
          if (!catInfo) continue
          if (!['Income', 'Expense', 'Cost of Goods Sold'].includes(catInfo.category)) continue

          // Only include Posting accounts — skip Heading, Begin-Total, End-Total, Total
          if (catInfo.accountType && catInfo.accountType !== 'posting') continue

          const debit = tb.totalDebit ?? 0
          const credit = tb.totalCredit ?? 0

          // Compute net change using debit - credit for ALL categories.
          // BC trialBalance uses debit-positive convention: income accounts show
          // period activity as debits, expenses as debits. This gives:
          //   Income: positive = revenue earned
          //   COGS/Expense: positive = money spent
          const netChange = debit - credit

          // Skip zero-activity accounts
          if (netChange === 0) continue

          plEntries.push({
            number: tb.number,
            display: tb.display || tb.number,
            netChange,
            category: catInfo.category,
            subCategory: catInfo.subCategory,
          })
        }

        // Group by category and subCategory
        const grouped: Record<string, Record<string, typeof plEntries>> = {}
        for (const entry of plEntries) {
          if (!grouped[entry.category]) grouped[entry.category] = {}
          if (!grouped[entry.category][entry.subCategory])
            grouped[entry.category][entry.subCategory] = []
          grouped[entry.category][entry.subCategory].push(entry)
        }

        // Build structured line items
        const lines: any[] = []
        let lineNumber = 0
        const categoryOrder = ['Income', 'Cost of Goods Sold', 'Expense']

        for (const category of categoryOrder) {
          const subs = grouped[category]
          if (!subs) continue

          lines.push({
            lineNumber: lineNumber++,
            display: category,
            netChange: 0,
            lineType: 'header',
            indentation: 0,
            _category: category,
          })

          let categoryTotal = 0
          const subEntries = Object.entries(subs)

          for (const [subCategory, accounts] of subEntries) {
            if (subEntries.length > 1) {
              lines.push({
                lineNumber: lineNumber++,
                display: subCategory,
                netChange: 0,
                lineType: 'header',
                indentation: 1,
                _category: category,
                _subCategory: subCategory,
              })
            }

            let subTotal = 0
            for (const acc of accounts) {
              lines.push({
                lineNumber: lineNumber++,
                display: acc.display,
                netChange: acc.netChange,
                lineType: 'detail',
                indentation: subEntries.length > 1 ? 2 : 1,
                _category: category,
                _subCategory: subCategory,
                _accountNumber: acc.number,
              })
              subTotal += acc.netChange
            }

            if (subEntries.length > 1) {
              lines.push({
                lineNumber: lineNumber++,
                display: `Total ${subCategory}`,
                netChange: subTotal,
                lineType: 'total',
                indentation: 1,
                _category: category,
                _subCategory: subCategory,
              })
            }
            categoryTotal += subTotal
          }

          lines.push({
            lineNumber: lineNumber++,
            display: `Total ${category}`,
            netChange: categoryTotal,
            lineType: 'total',
            indentation: 0,
            _category: category,
          })
        }

        data = lines
      } catch (tbError: any) {
        logger.error('trialBalance fallback also failed', {
          organizationId,
          connectionId: resolvedConnectionId,
          error: tbError.message,
        })
        return NextResponse.json(
          {
            error: 'Income statement data not available',
            details: `Neither incomeStatement nor trialBalance entities are accessible: ${tbError.message}`,
          },
          { status: 404 }
        )
      }
    }

    // ── Compute totals ──
    let totalRevenue = 0
    let totalCOGS = 0
    let grossProfit = 0
    let totalExpenses = 0
    let netIncome = 0

    if (source === 'trialBalance') {
      // For trialBalance-based data, use category totals directly
      for (const line of data) {
        if (line.lineType === 'total' && line.indentation === 0) {
          const cat = line._category || ''
          if (cat === 'Income') totalRevenue = line.netChange
          else if (cat === 'Cost of Goods Sold') totalCOGS = line.netChange
          else if (cat === 'Expense') totalExpenses = line.netChange
        }
      }
      grossProfit = totalRevenue - totalCOGS
      netIncome = grossProfit - totalExpenses
    } else {
      // For report entity data, parse from display names
      for (const line of data) {
        const amount = line.netChange ?? 0
        const display = (line.display || '').toLowerCase()
        const lineType = (line.lineType || '').toLowerCase()

        if (lineType === 'total' || lineType === 'header') {
          if (display.includes('total revenue') || display.includes('total income')) {
            totalRevenue = amount
          } else if (display.includes('cost of goods sold') || display.includes('total cogs')) {
            totalCOGS = Math.abs(amount)
          } else if (display.includes('gross profit')) {
            grossProfit = amount
          } else if (display.includes('total expense')) {
            totalExpenses = Math.abs(amount)
          } else if (display.includes('net income') || display.includes('net loss')) {
            netIncome = amount
          }
        }
      }

      // Fallback: if no total lines found, derive from line types
      if (totalRevenue === 0 && netIncome === 0) {
        for (const line of data) {
          const amount = line.netChange ?? 0
          const display = (line.display || '').toLowerCase()
          if (line.lineType !== 'total' && line.lineType !== 'header') {
            if (
              display.includes('revenue') ||
              display.includes('sales') ||
              display.includes('income')
            ) {
              totalRevenue += amount
            } else if (display.includes('cost') || display.includes('cogs')) {
              totalCOGS += Math.abs(amount)
            } else {
              totalExpenses += Math.abs(amount)
            }
          }
        }
        grossProfit = totalRevenue - totalCOGS
        netIncome = grossProfit - totalExpenses
      }
    }

    const companyName = credentials.company_name || null

    logger.info('BC income statement fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      source,
      lineCount: data.length,
    })

    return NextResponse.json({
      data: {
        lines: data,
        totals: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          totalExpenses,
          operatingIncome: grossProfit - totalExpenses,
          netIncome,
        },
        companyName,
        currency: 'USD',
        period: { startDate, endDate },
        source,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC income statement', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch income statement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
