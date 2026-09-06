import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/balance-sheet
 *
 * Fetches balance sheet data from BC API with 3-tier fallback:
 *   1. `balanceSheet` report entity (formatted report — not available on all environments)
 *   2. `trialBalance` + `accounts` (trialBalance has actual numbers, accounts has categories)
 *   3. Returns error if both report entities are unavailable
 *
 * The `accounts` entity's FlowFields (balance, netChange) return 0 on many BC environments,
 * so we NEVER rely on them for actual amounts. Instead we use trialBalance which has
 * `balanceAtDateDebit` / `balanceAtDateCredit` with real computed values.
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

    const endDate = url.searchParams.get('endDate') || undefined

    let data: any[] = []
    let source: 'balanceSheet' | 'trialBalance' = 'balanceSheet'

    // Build date filter using BC's FlowFilter range syntax
    let filter: string | undefined
    if (endDate) filter = `dateFilter eq '..${endDate}'`

    // ── Strategy 1: Try the balanceSheet report entity ──
    try {
      data = await client.getBalanceSheet(filter ? { $filter: filter } : undefined)
    } catch (reportError: any) {
      logger.warn('balanceSheet entity not available, trying trialBalance fallback', {
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

        // Filter to BS posting accounts and compute balances
        const bsEntries: Array<{
          number: string
          display: string
          balance: number
          category: string
          subCategory: string
        }> = []

        for (const tb of trialBalanceData) {
          const catInfo = categoryMap[tb.number]
          if (!catInfo) continue
          if (!['Assets', 'Liabilities', 'Equity'].includes(catInfo.category)) continue

          // Only include Posting accounts — skip Heading, Begin-Total, End-Total, Total
          if (catInfo.accountType && catInfo.accountType !== 'posting') continue

          // Compute balance from trialBalance using debit - credit for ALL categories.
          // BC trialBalance uses debit-positive convention consistently:
          //   Assets: positive (debit normal)
          //   Liabilities/Equity: negative (credit normal) → we negate for display
          const debit = tb.balanceAtDateDebit ?? 0
          const credit = tb.balanceAtDateCredit ?? 0
          const rawBalance = debit - credit

          // Assets: use raw (positive = asset value)
          // Liabilities/Equity: negate (so positive = liability/equity value)
          const balance = catInfo.category === 'Assets' ? rawBalance : -rawBalance

          // Skip zero-balance accounts
          if (balance === 0) continue

          bsEntries.push({
            number: tb.number,
            display: tb.display || tb.number,
            balance,
            category: catInfo.category,
            subCategory: catInfo.subCategory,
          })
        }

        // Group by category and subCategory
        const grouped: Record<string, Record<string, typeof bsEntries>> = {}
        for (const entry of bsEntries) {
          if (!grouped[entry.category]) grouped[entry.category] = {}
          if (!grouped[entry.category][entry.subCategory])
            grouped[entry.category][entry.subCategory] = []
          grouped[entry.category][entry.subCategory].push(entry)
        }

        // Build structured line items
        const lines: any[] = []
        let lineNumber = 0
        const categoryOrder = ['Assets', 'Liabilities', 'Equity']

        for (const category of categoryOrder) {
          const subs = grouped[category]
          if (!subs) continue

          lines.push({
            lineNumber: lineNumber++,
            display: category,
            balance: 0,
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
                balance: 0,
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
                balance: acc.balance,
                lineType: 'detail',
                indentation: subEntries.length > 1 ? 2 : 1,
                _category: category,
                _subCategory: subCategory,
                _accountNumber: acc.number,
              })
              subTotal += acc.balance
            }

            if (subEntries.length > 1) {
              lines.push({
                lineNumber: lineNumber++,
                display: `Total ${subCategory}`,
                balance: subTotal,
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
            balance: categoryTotal,
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
            error: 'Balance sheet data not available',
            details: `Neither balanceSheet nor trialBalance entities are accessible: ${tbError.message}`,
          },
          { status: 404 }
        )
      }
    }

    // ── Compute totals ──
    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0

    if (source === 'trialBalance') {
      for (const line of data) {
        if (line.lineType === 'total' && line.indentation === 0) {
          const cat = line._category || ''
          if (cat === 'Assets') totalAssets = line.balance
          else if (cat === 'Liabilities') totalLiabilities = line.balance
          else if (cat === 'Equity') totalEquity = line.balance
        }
      }
    } else {
      for (const line of data) {
        const amount = line.balance ?? 0
        const display = (line.display || '').toLowerCase()
        const lineType = (line.lineType || '').toLowerCase()

        if (lineType === 'total' || lineType === 'header') {
          if (display.includes('total assets')) totalAssets = amount
          else if (display.includes('total liabilities')) totalLiabilities = Math.abs(amount)
          else if (display.includes('total equity') || display.includes('total stockholder'))
            totalEquity = amount
        }
      }
    }

    const companyName = credentials.company_name || null

    logger.info('BC balance sheet fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      source,
      lineCount: data.length,
    })

    return NextResponse.json({
      data: {
        lines: data,
        totals: { totalAssets, totalLiabilities, totalEquity },
        companyName,
        asOfDate: endDate || null,
        source,
      },
    })
  } catch (error) {
    logger.error('Failed to fetch BC balance sheet', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch balance sheet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
