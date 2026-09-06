import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/cash-flow-test
 *
 * Comprehensive cash-flow diagnostic — probes all cash-related BC API entities,
 * compares different methods of computing cash balances (GL entries, trialBalance,
 * accounts FlowFields, bankAccounts), and analyzes cash movements over the period.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 */

function decodeODataString(s: string): string {
  return s.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

interface EntityProbeResult {
  available: boolean
  count?: number
  fields?: string[]
  sampleRecord?: any
  error?: string
  durationMs: number
  description: string
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

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

    // Warm up token to avoid thundering herd on parallel probes
    await client.query('companyInformation', { $top: 1 })

    // ═══ Phase 1: Entity Probe ═══
    const cashEntities = [
      {
        name: 'generalLedgerEntries',
        description: 'GL entries — primary source for cash balances',
      },
      {
        name: 'accounts',
        description: 'Chart of accounts — categories, subCategories, accountType',
      },
      { name: 'trialBalance', description: 'Trial balance — balanceAtDate, totalDebit/Credit' },
      { name: 'cashFlowStatement', description: 'Cash flow statement report entity' },
      { name: 'bankAccounts', description: 'Bank account entities with balance fields' },
      { name: 'salesInvoices', description: 'Sales invoices — for paid/open cash inflow analysis' },
      {
        name: 'purchaseInvoices',
        description: 'Purchase invoices — for paid/open cash outflow analysis',
      },
      { name: 'customerPayments', description: 'Customer payment journal entries' },
      { name: 'vendorPayments', description: 'Vendor payment journal entries' },
      { name: 'journalLines', description: 'General journal lines' },
    ]

    const probeResults: Record<string, EntityProbeResult> = {}

    await Promise.allSettled(
      cashEntities.map(async (entity) => {
        const et0 = Date.now()
        try {
          const res = await client.query(entity.name, { $top: 3 })
          const rows = res.value || []
          probeResults[entity.name] = {
            available: true,
            count: res['@odata.count'] ?? rows.length,
            fields: rows[0] ? Object.keys(rows[0]) : [],
            sampleRecord: rows[0] || null,
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        } catch (err: any) {
          probeResults[entity.name] = {
            available: false,
            error: err.message?.slice(0, 200) || String(err),
            description: entity.description,
            durationMs: Date.now() - et0,
          }
        }
      })
    )

    const availableEntities = Object.entries(probeResults)
      .filter(([, v]) => v.available)
      .map(([k]) => k)
    const unavailableEntities = Object.entries(probeResults)
      .filter(([, v]) => !v.available)
      .map(([k]) => k)

    // ═══ Phase 2: Identify Cash/Bank Accounts from Chart of Accounts ═══
    let cashAccountAnalysis: any = null
    let allAccounts: any[] = []

    if (probeResults.accounts?.available) {
      allAccounts = await client.queryAll('accounts')
      const cashSubCategories = ['cash', 'bank', 'checking', 'savings']

      const sorted = [...allAccounts].sort((a: any, b: any) =>
        (a.number || '').localeCompare(b.number || '')
      )

      const cashAccounts: Array<{
        number: string
        name: string
        category: string
        subCategory: string
        accountType: string
      }> = []

      for (const acc of sorted) {
        const accType = decodeODataString(acc.accountType || '').toLowerCase()
        const cat = (acc.category || '').trim()
        const sub = (acc.subCategory || '').toLowerCase()

        if (cat === 'Assets' && cashSubCategories.some((s) => sub.includes(s))) {
          cashAccounts.push({
            number: acc.number,
            name: acc.displayName || acc.number,
            category: cat,
            subCategory: acc.subCategory || '',
            accountType: accType,
          })
        }
      }

      cashAccountAnalysis = {
        totalAccounts: allAccounts.length,
        cashAccounts,
        postingCashAccounts: cashAccounts.filter((a) => a.accountType === 'posting'),
        nonPostingCashAccounts: cashAccounts.filter((a) => a.accountType !== 'posting'),
      }
    }

    // ═══ Phase 3: Method Comparison — Cash Balance via Different Sources ═══
    const methodResults: Array<{
      method: string
      description: string
      totalCash: number | null
      accountBreakdown: Array<{ number: string; name: string; balance: number }> | null
      durationMs: number
      error?: string
    }> = []

    // Method 1: GL entries cumulative (the "correct" approach)
    if (probeResults.generalLedgerEntries?.available && cashAccountAnalysis) {
      const mt0 = Date.now()
      try {
        const filter = endDate ? `postingDate le ${endDate}` : undefined
        const entries = await client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount',
          ...(filter && { $filter: filter }),
        })

        const amounts = new Map<string, number>()
        for (const entry of entries) {
          const accNum = entry.accountNumber
          if (!accNum) continue
          amounts.set(
            accNum,
            (amounts.get(accNum) ?? 0) + (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
          )
        }

        const postingCashNums = new Set(
          cashAccountAnalysis.postingCashAccounts.map((a: any) => a.number)
        )
        let totalCash = 0
        const breakdown: Array<{ number: string; name: string; balance: number }> = []

        for (const acc of cashAccountAnalysis.postingCashAccounts) {
          const bal = amounts.get(acc.number) ?? 0
          totalCash += bal
          breakdown.push({ number: acc.number, name: acc.name, balance: bal })
        }

        methodResults.push({
          method: 'GL Entries (cumulative)',
          description: `Sum of all GL entries up to ${endDate || 'now'} for cash/bank posting accounts. This is the authoritative method.`,
          totalCash,
          accountBreakdown: breakdown,
          durationMs: Date.now() - mt0,
        })
      } catch (err: any) {
        methodResults.push({
          method: 'GL Entries (cumulative)',
          description: 'Sum of all GL entries for cash/bank accounts',
          totalCash: null,
          accountBreakdown: null,
          durationMs: Date.now() - mt0,
          error: err.message,
        })
      }
    }

    // Method 2: GL entries period-only (for cash movement)
    if (
      probeResults.generalLedgerEntries?.available &&
      cashAccountAnalysis &&
      startDate &&
      endDate
    ) {
      const mt0 = Date.now()
      try {
        const entries = await client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount',
          $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
        })

        const amounts = new Map<string, number>()
        for (const entry of entries) {
          const accNum = entry.accountNumber
          if (!accNum) continue
          amounts.set(
            accNum,
            (amounts.get(accNum) ?? 0) + (entry.debitAmount ?? 0) - (entry.creditAmount ?? 0)
          )
        }

        let totalChange = 0
        const breakdown: Array<{ number: string; name: string; balance: number }> = []
        for (const acc of cashAccountAnalysis.postingCashAccounts) {
          const bal = amounts.get(acc.number) ?? 0
          totalChange += bal
          if (bal !== 0) breakdown.push({ number: acc.number, name: acc.name, balance: bal })
        }

        methodResults.push({
          method: 'GL Entries (period only)',
          description: `Net cash change during ${startDate} to ${endDate}. NOT a balance — shows movement only.`,
          totalCash: totalChange,
          accountBreakdown: breakdown,
          durationMs: Date.now() - mt0,
        })
      } catch (err: any) {
        methodResults.push({
          method: 'GL Entries (period only)',
          description: 'Net cash change during the period',
          totalCash: null,
          accountBreakdown: null,
          durationMs: Date.now() - mt0,
          error: err.message,
        })
      }
    }

    // Method 3: accounts FlowFields (often returns 0)
    if (probeResults.accounts?.available && cashAccountAnalysis) {
      const mt0 = Date.now()
      const breakdown: Array<{ number: string; name: string; balance: number }> = []
      let totalCash = 0

      for (const acc of allAccounts) {
        const accType = decodeODataString(acc.accountType || '').toLowerCase()
        const sub = (acc.subCategory || '').toLowerCase()
        const cat = (acc.category || '').trim()
        if (cat !== 'Assets' || accType !== 'posting') continue
        if (!['cash', 'bank', 'checking', 'savings'].some((s) => sub.includes(s))) continue

        const bal = acc.balance ?? acc.netChange ?? 0
        totalCash += bal
        breakdown.push({
          number: acc.number,
          name: acc.displayName || acc.number,
          balance: bal,
        })
      }

      methodResults.push({
        method: 'accounts FlowFields',
        description:
          'Uses accounts.balance FlowField. WARNING: Returns 0 on many BC environments — unreliable.',
        totalCash,
        accountBreakdown: breakdown,
        durationMs: Date.now() - mt0,
      })
    }

    // Method 4: trialBalance entity
    if (probeResults.trialBalance?.available && cashAccountAnalysis) {
      const mt0 = Date.now()
      try {
        let filter: string | undefined
        if (startDate && endDate) {
          filter = `dateFilter eq '${startDate}..${endDate}'`
        } else if (endDate) {
          filter = `dateFilter eq '..${endDate}'`
        }

        let trialBalanceData: any[]
        try {
          trialBalanceData = await client.getTrialBalance(filter ? { $filter: filter } : undefined)
        } catch {
          trialBalanceData = await client.getTrialBalance()
        }

        const cashNums = new Set(cashAccountAnalysis.postingCashAccounts.map((a: any) => a.number))
        let totalCash = 0
        const breakdown: Array<{ number: string; name: string; balance: number }> = []

        for (const tb of trialBalanceData) {
          if (!cashNums.has(tb.number)) continue
          const balDebit = tb.balanceAtDateDebit ?? 0
          const balCredit = tb.balanceAtDateCredit ?? 0
          const balance = balDebit - balCredit
          totalCash += balance
          breakdown.push({ number: tb.number, name: tb.display || tb.number, balance })
        }

        methodResults.push({
          method: 'trialBalance entity',
          description: 'Uses trialBalance.balanceAtDateDebit/Credit. Returns 404 on some tenants.',
          totalCash,
          accountBreakdown: breakdown,
          durationMs: Date.now() - mt0,
        })
      } catch (err: any) {
        methodResults.push({
          method: 'trialBalance entity',
          description: 'Uses trialBalance balanceAtDate fields',
          totalCash: null,
          accountBreakdown: null,
          durationMs: Date.now() - mt0,
          error: err.message,
        })
      }
    }

    // Method 5: bankAccounts entity
    if (probeResults.bankAccounts?.available) {
      const mt0 = Date.now()
      try {
        const banks = await client.listBankAccounts()
        let totalCash = 0
        const breakdown: Array<{ number: string; name: string; balance: number }> = []

        for (const ba of banks) {
          const bal = ba.balance ?? 0
          totalCash += bal
          breakdown.push({
            number: ba.number || ba.id || '',
            name: ba.displayName || ba.name || '',
            balance: bal,
          })
        }

        methodResults.push({
          method: 'bankAccounts entity',
          description: 'Uses bankAccounts.balance. May return 0 if FlowFields are not computed.',
          totalCash,
          accountBreakdown: breakdown,
          durationMs: Date.now() - mt0,
        })
      } catch (err: any) {
        methodResults.push({
          method: 'bankAccounts entity',
          description: 'Uses bankAccounts entity',
          totalCash: null,
          accountBreakdown: null,
          durationMs: Date.now() - mt0,
          error: err.message,
        })
      }
    }

    // Method 6: cashFlowStatement report entity
    if (probeResults.cashFlowStatement?.available) {
      const mt0 = Date.now()
      try {
        let filter: string | undefined
        if (startDate && endDate) {
          filter = `dateFilter eq '${startDate}..${endDate}'`
        } else if (endDate) {
          filter = `dateFilter eq '..${endDate}'`
        }

        const lines = await client.getCashFlowStatement(filter ? { $filter: filter } : undefined)
        let totalCash = 0

        // Find grand total or net change line
        for (const line of lines) {
          const display = (line.display || '').toLowerCase()
          const lineType = (line.lineType || '').toLowerCase()
          if (
            lineType === 'total' &&
            (display.includes('net change') || display.includes('total cash'))
          ) {
            totalCash = line.netChange ?? 0
          }
        }

        methodResults.push({
          method: 'cashFlowStatement entity',
          description:
            'BC cashFlowStatement report entity. Shows operating/investing/financing breakdown.',
          totalCash,
          accountBreakdown: lines
            .filter((l: any) => l.lineType === 'total')
            .map((l: any) => ({
              number: '',
              name: l.display || '',
              balance: l.netChange ?? 0,
            })),
          durationMs: Date.now() - mt0,
        })
      } catch (err: any) {
        methodResults.push({
          method: 'cashFlowStatement entity',
          description: 'BC cashFlowStatement report entity',
          totalCash: null,
          accountBreakdown: null,
          durationMs: Date.now() - mt0,
          error: err.message,
        })
      }
    }

    // ═══ Phase 4: Monthly Cash Movement Analysis (from GL entries) ═══
    let monthlyCashFlow: any = null

    if (
      probeResults.generalLedgerEntries?.available &&
      cashAccountAnalysis &&
      startDate &&
      endDate
    ) {
      try {
        const entries = await client.listGeneralLedgerEntries({
          $select: 'accountNumber,debitAmount,creditAmount,postingDate,documentType',
          $filter: `postingDate ge ${startDate} and postingDate le ${endDate}`,
        })

        const cashNums = new Set(cashAccountAnalysis.postingCashAccounts.map((a: any) => a.number))

        // Monthly aggregation
        const monthlyMap: Record<string, { inflow: number; outflow: number }> = {}
        // By document type
        const docTypeMap: Record<string, { count: number; debit: number; credit: number }> = {}

        for (const entry of entries) {
          if (!cashNums.has(entry.accountNumber)) continue

          const month = (entry.postingDate || '').substring(0, 7)
          if (!month) continue

          if (!monthlyMap[month]) monthlyMap[month] = { inflow: 0, outflow: 0 }
          const debit = entry.debitAmount ?? 0
          const credit = entry.creditAmount ?? 0
          monthlyMap[month].inflow += debit
          monthlyMap[month].outflow += credit

          const docType = entry.documentType || 'Other'
          if (!docTypeMap[docType]) docTypeMap[docType] = { count: 0, debit: 0, credit: 0 }
          docTypeMap[docType].count++
          docTypeMap[docType].debit += debit
          docTypeMap[docType].credit += credit
        }

        const byMonth = Object.entries(monthlyMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, data]) => ({
            month,
            inflow: data.inflow,
            outflow: data.outflow,
            netChange: data.inflow - data.outflow,
          }))

        const byDocType = Object.entries(docTypeMap)
          .sort(([, a], [, b]) => b.count - a.count)
          .map(([type, data]) => ({
            documentType: type,
            count: data.count,
            totalDebit: data.debit,
            totalCredit: data.credit,
            net: data.debit - data.credit,
          }))

        monthlyCashFlow = {
          totalEntries: entries.filter((e: any) => cashNums.has(e.accountNumber)).length,
          byMonth,
          byDocumentType: byDocType,
          periodNetChange: byMonth.reduce((s, m) => s + m.netChange, 0),
        }
      } catch {
        monthlyCashFlow = null
      }
    }

    // ═══ Phase 5: Cash Runway Estimate ═══
    let cashRunway: any = null
    const glMethod = methodResults.find((m) => m.method === 'GL Entries (cumulative)')
    const periodMethod = methodResults.find((m) => m.method === 'GL Entries (period only)')

    if (glMethod?.totalCash != null && periodMethod?.totalCash != null && startDate && endDate) {
      const periodDays = Math.max(
        1,
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const periodMonths = periodDays / 30.44
      const monthlyNetChange = periodMethod.totalCash / periodMonths

      cashRunway = {
        currentCash: glMethod.totalCash,
        periodNetChange: periodMethod.totalCash,
        periodDays: Math.round(periodDays),
        monthlyNetChange: Math.round(monthlyNetChange * 100) / 100,
        runwayMonths:
          monthlyNetChange < 0
            ? Math.round((glMethod.totalCash / Math.abs(monthlyNetChange)) * 10) / 10
            : null,
        runwayStatus:
          monthlyNetChange >= 0
            ? 'Cash positive (growing)'
            : glMethod.totalCash / Math.abs(monthlyNetChange) > 12
              ? 'Healthy (12+ months)'
              : glMethod.totalCash / Math.abs(monthlyNetChange) > 6
                ? 'Moderate (6-12 months)'
                : 'Warning (< 6 months)',
      }
    }

    const companyName = credentials.company_name || null

    return NextResponse.json({
      data: {
        entityProbe: {
          available: availableEntities,
          unavailable: unavailableEntities,
          details: probeResults,
        },
        cashAccountAnalysis,
        methodComparison: methodResults,
        monthlyCashFlow,
        cashRunway,
        companyName,
        period: { startDate, endDate },
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Cash flow diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
