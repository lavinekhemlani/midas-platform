/**
 * Cash Flow Forecasting API
 *
 * Generates 13-week or 6-month cash flow forecasts based on historical
 * QuickBooks data, user-defined assumptions, and scheduled memory events.
 *
 * GET /api/forecasting
 *
 * Query Parameters:
 * - horizon: '13-week' | '6-month' (default: '13-week')
 * - growthRate: number (-50 to 100, default: 0)
 * - inflowGrowthRate: number (-50 to 100, default: same as growthRate)
 * - outflowGrowthRate: number (-50 to 100, default: same as growthRate)
 * - rollingDays: 30 | 60 | 90 (default: 30)
 * - memoryIds: comma-separated list of enabled memory IDs (optional, null = all)
 */

import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { MemoryService } from '@/ai/memory/memoryService'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { transformCashFlow } from '@/quickbooks/reports'
import { withRetry, formatErrorResponse, formatReportDate } from '@/quickbooks/utils/route-helpers'
import type {
  ForecastHorizon,
  ForecastData,
  ForecastPeriod,
  ForecastLineItem,
  ForecastAssumptions,
  ScheduledMemory,
} from '@/types/forecasting'
import type { NormalizedReportLine } from '@/quickbooks/types/reports'
import type { Memory } from '@/ai/memory/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// Date Helpers
// ============================================================================

function formatDate(date: Date): string {
  return formatReportDate(date)
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isDateInPeriod(dateStr: string, periodStart: Date, periodEnd: Date): boolean {
  // Parse YYYY-MM-DD as local time (not UTC) to match periodStart/periodEnd
  const parts = dateStr.split('-')
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return d >= periodStart && d < periodEnd
}

// ============================================================================
// Currency Helper
// ============================================================================

function getCurrency(info: any): string {
  if (info?.HomeCurrency?.value) return info.HomeCurrency.value
  if (info?.currency_code) return info.currency_code
  if (info?.Country === 'US') return 'USD'
  if (info?.Country === 'CA') return 'CAD'
  if (info?.Country === 'GB') return 'GBP'
  if (info?.Country === 'AU') return 'AUD'
  if (info?.Country === 'HK') return 'HKD'
  return 'USD'
}

// ============================================================================
// Memory Expansion
// ============================================================================

function expandRecurringMemories(
  memories: Memory[],
  startDate: Date,
  endDate: Date
): ScheduledMemory[] {
  const events: ScheduledMemory[] = []

  for (const memory of memories) {
    if (!memory.metadata?.amount || !memory.metadata?.date) continue

    const baseDate = new Date(memory.metadata.date)
    const amount = memory.metadata.amount
    const type = memory.type === 'expense' ? 'expense' : 'income'

    if (!memory.metadata.recurring) {
      if (baseDate >= startDate && baseDate <= endDate) {
        events.push({
          id: memory.id,
          sourceMemoryId: memory.id,
          type,
          description: memory.content,
          amount,
          date: memory.metadata.date,
          recurring: false,
          enabled: true,
          category: memory.metadata.category,
        })
      }
    } else {
      const frequency = memory.metadata.frequency || 'monthly'
      const currentDate = new Date(baseDate)

      while (currentDate < startDate) {
        switch (frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1)
            break
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7)
            break
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1)
            break
          case 'quarterly':
            currentDate.setMonth(currentDate.getMonth() + 3)
            break
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + 1)
            break
        }
      }

      while (currentDate <= endDate) {
        events.push({
          id: `${memory.id}::${formatDate(currentDate)}`,
          sourceMemoryId: memory.id,
          type,
          description: memory.content,
          amount,
          date: formatDate(currentDate),
          recurring: true,
          frequency: frequency as ScheduledMemory['frequency'],
          enabled: true,
          category: memory.metadata.category,
        })

        switch (frequency) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1)
            break
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7)
            break
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1)
            break
          case 'quarterly':
            currentDate.setMonth(currentDate.getMonth() + 3)
            break
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + 1)
            break
        }
      }
    }
  }

  return events
}

// ============================================================================
// Memory Period Adjustments
// ============================================================================

function getMemoryAdjustmentForPeriod(
  memories: ScheduledMemory[],
  enabledIds: Set<string> | null,
  periodStart: Date,
  periodEnd: Date
): { netAdjustment: number; inflow: number; outflow: number } {
  let inflow = 0
  let outflow = 0

  for (const memory of memories) {
    const baseId = memory.sourceMemoryId
    if (enabledIds !== null && !enabledIds.has(baseId)) continue

    if (isDateInPeriod(memory.date, periodStart, periodEnd)) {
      if (memory.type === 'income') {
        inflow += memory.amount
      } else {
        outflow += memory.amount
      }
    }
  }

  return { netAdjustment: inflow - outflow, inflow, outflow }
}

// ============================================================================
// Line Item Projection
// ============================================================================

function projectLineItem(
  line: NormalizedReportLine,
  historicalColumns: string[],
  numForecastPeriods: number,
  growthRate: number,
  isWeekly: boolean,
  rollingDays: number
): Record<string, number> {
  // Use rollingDays to limit how many historical periods we average over
  // 30 days ≈ 4 weeks or 1 month, 60 ≈ 8 weeks or 2 months, 90 ≈ 13 weeks or 3 months
  const maxPeriods = isWeekly ? Math.ceil(rollingDays / 7) : Math.ceil(rollingDays / 30)
  const relevantColumns = historicalColumns.slice(-Math.min(maxPeriods, historicalColumns.length))

  const historicalValues: number[] = []
  for (const colKey of relevantColumns) {
    historicalValues.push(line.values[colKey] || 0)
  }

  const nonZeroValues = historicalValues.filter((v) => v !== 0)
  const avg =
    nonZeroValues.length > 0 ? nonZeroValues.reduce((s, v) => s + v, 0) / nonZeroValues.length : 0

  const projected: Record<string, number> = {}
  for (let i = 0; i < numForecastPeriods; i++) {
    const monthsAhead = isWeekly ? (i + 1) / 4.33 : i + 1
    const growthFactor = Math.pow(1 + growthRate / 100, monthsAhead)
    projected[`forecast_${i}`] = Math.round(avg * growthFactor * 100) / 100
  }

  return projected
}

// ============================================================================
// Build flat line items from QB section lines
// ============================================================================

type ForecastCategory = ForecastLineItem['category']

function buildFlatLineItems(
  category: ForecastCategory,
  lines: NormalizedReportLine[],
  projectedLines: Array<{ line: NormalizedReportLine; projected: Record<string, number> }>,
  historicalColKeys: string[],
  numForecast: number
): ForecastLineItem[] {
  return projectedLines.map((p, idx) => {
    const values: Record<string, number> = {}

    historicalColKeys.forEach((colKey, colIdx) => {
      values[`period_${colIdx}`] = p.line.values[colKey] || 0
    })

    for (let fi = 0; fi < numForecast; fi++) {
      values[`period_${historicalColKeys.length + fi}`] = p.projected[`forecast_${fi}`] || 0
    }

    const histValues = historicalColKeys.map((k) => p.line.values[k] || 0)
    const nonZero = histValues.filter((v) => v !== 0)
    const historicalAvg =
      nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0

    return {
      id: `${category}_${idx}_${p.line.name.replace(/\s+/g, '_').toLowerCase()}`,
      name: p.line.name,
      category,
      historicalAvg,
      values,
      level: 1,
      isSummary: false,
    }
  })
}

// ============================================================================
// Main API Handler
// ============================================================================

export const GET = withActiveProvider(async (request, { organizationId, userId, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const horizon = (searchParams.get('horizon') || '13-week') as ForecastHorizon
  const growthRate = Math.max(
    -50,
    Math.min(100, parseFloat(searchParams.get('growthRate') || '10'))
  )
  const inflowGrowthRate = Math.max(
    -50,
    Math.min(100, parseFloat(searchParams.get('inflowGrowthRate') || String(growthRate)))
  )
  const outflowGrowthRate = Math.max(
    -50,
    Math.min(100, parseFloat(searchParams.get('outflowGrowthRate') || String(growthRate)))
  )
  const rollingDays = parseInt(searchParams.get('rollingDays') || '60') as 30 | 60 | 90
  const confidenceLevel = parseInt(searchParams.get('confidenceLevel') || '90') as 80 | 90 | 95
  const memoryIdsParam = searchParams.get('memoryIds')
  const enabledMemoryIds = memoryIdsParam
    ? new Set(memoryIdsParam.split(',').filter(Boolean))
    : null

  const algorithmParam = searchParams.get('algorithm') || 'weighted'
  const algorithm = (
    ['weighted', 'holt-winters', 'trend-adjusted'].includes(algorithmParam)
      ? algorithmParam
      : 'weighted'
  ) as ForecastAssumptions['algorithm']

  const assumptions: ForecastAssumptions = {
    growthRate,
    inflowGrowthRate,
    outflowGrowthRate,
    rollingAverageDays: rollingDays,
    confidenceLevel,
    algorithm,
  }

  const isWeekly = horizon === '13-week'
  const numHistorical = isWeekly ? 13 : 7
  const numForecast = isWeekly ? 13 : 6

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate date ranges
    // Historical includes the current period.
    // Forecast starts from the period AFTER the current one.
    const currentPeriodStart = isWeekly ? getWeekStart(today) : getMonthStart(today)
    const historicalStart = isWeekly
      ? addWeeks(currentPeriodStart, -numHistorical + 1)
      : addMonths(currentPeriodStart, -numHistorical + 1)
    const forecastEnd = isWeekly
      ? addWeeks(currentPeriodStart, numForecast + 1)
      : addMonths(currentPeriodStart, numForecast + 1)

    // ========================================================================
    // Fetch historical data
    // ========================================================================
    const client = new QuickBooksClient({ organizationId, realmId })

    // reportEndDate = end of current period (inclusive for QB)
    const currentPeriodEnd = isWeekly
      ? addWeeks(currentPeriodStart, 1)
      : addMonths(currentPeriodStart, 1)
    const reportEndDate = new Date(currentPeriodEnd)
    reportEndDate.setDate(reportEndDate.getDate() - 1)

    const reportParams = new URLSearchParams({
      start_date: formatDate(historicalStart),
      end_date: formatDate(reportEndDate),
      summarize_column_by: isWeekly ? 'Week' : 'Month',
      minorversion: '65',
    })

    const [rawCashFlow, orgInfo] = await Promise.all([
      withRetry(() => client.request(`/reports/CashFlow?${reportParams.toString()}`)),
      withRetry(() => client.getCompanyInfo()).catch(() => null),
    ])

    const normalizedCF = transformCashFlow(rawCashFlow)
    const currency = getCurrency(orgInfo)

    // ========================================================================
    // Extract historical period data
    // ========================================================================
    const columns = normalizedCF.columns || []
    const periodColumns = columns.filter((col: string) => !col.toLowerCase().includes('total'))

    const beginningCash = normalizedCF.beginningCash || 0
    let runningCash = beginningCash

    const historicalColKeys = periodColumns.map((_: string, i: number) => `col_${i}`)
    const numHistoricalCols = historicalColKeys.length

    // Filter out summary rows AND section-header rows (level 0 with all-zero values)
    const isRealLine = (l: NormalizedReportLine) => {
      if (l.isSummary) return false
      // Skip section headers that have no actual values (just container labels)
      const hasAnyValue = historicalColKeys.some((k) => (l.values[k] || 0) !== 0) || l.total !== 0
      return hasAnyValue
    }
    const operatingLines = normalizedCF.operatingActivities.lines.filter(isRealLine)
    const investingLines = normalizedCF.investingActivities.lines.filter(isRealLine)
    const financingLines = normalizedCF.financingActivities.lines.filter(isRealLine)

    // Build historical periods for chart
    // Compute period dates deterministically from historicalStart + index
    // (QB column headers may be date ranges that can't be parsed by new Date())
    const historicalPeriods: ForecastPeriod[] = periodColumns.map(
      (period: string, index: number) => {
        const colKey = `col_${index}`

        const operating = operatingLines.reduce(
          (sum: number, line: NormalizedReportLine) => sum + (line.values[colKey] || 0),
          0
        )
        const investing = investingLines.reduce(
          (sum: number, line: NormalizedReportLine) => sum + (line.values[colKey] || 0),
          0
        )
        const financing = financingLines.reduce(
          (sum: number, line: NormalizedReportLine) => sum + (line.values[colKey] || 0),
          0
        )
        const netChange = operating + investing + financing

        runningCash += netChange

        // Compute the period date from known start + index (reliable)
        const periodDate = isWeekly
          ? addWeeks(historicalStart, index)
          : addMonths(historicalStart, index)

        const label = isWeekly
          ? periodDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : periodDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

        return {
          date: formatDate(periodDate),
          label,
          actual: runningCash,
          forecast: runningCash,
          isHistorical: true,
          memoryAdjustment: 0,
          inflow: Math.max(0, operating) + Math.max(0, investing) + Math.max(0, financing),
          outflow:
            Math.abs(Math.min(0, operating)) +
            Math.abs(Math.min(0, investing)) +
            Math.abs(Math.min(0, financing)),
          cumulativeCash: runningCash,
          forecastBase: runningCash,
        }
      }
    )

    const currentCash = runningCash

    // ========================================================================
    // Fetch memories
    // ========================================================================
    // Pass realmId for QuickBooks company-scoped memories (same as /api/memories)
    const memoryService = new MemoryService(userId, organizationId, realmId)
    const [expenseMemories, incomeMemories] = await Promise.all([
      memoryService.search({ type: 'expense', includeArchived: false }),
      memoryService.search({ type: 'income', includeArchived: false }),
    ])

    const expandedExpenses = expandRecurringMemories(expenseMemories, today, forecastEnd)
    const expandedIncome = expandRecurringMemories(incomeMemories, today, forecastEnd)
    const allMemories = [...expandedExpenses, ...expandedIncome]

    let totalExpenseImpact = 0
    let totalIncomeImpact = 0
    for (const memory of allMemories) {
      const baseId = memory.sourceMemoryId
      if (enabledMemoryIds === null || enabledMemoryIds.has(baseId)) {
        if (memory.type === 'expense') totalExpenseImpact += memory.amount
        else totalIncomeImpact += memory.amount
      }
    }

    // ========================================================================
    // Project line items forward
    // ========================================================================

    function getLineGrowthRate(line: NormalizedReportLine, colKeys: string[]): number {
      const avgValue =
        colKeys.reduce((s: number, k: string) => s + (line.values[k] || 0), 0) /
        Math.max(colKeys.length, 1)
      return avgValue >= 0 ? inflowGrowthRate : outflowGrowthRate
    }

    const projectedOperating = operatingLines.map((line) => ({
      line,
      projected: projectLineItem(
        line,
        historicalColKeys,
        numForecast,
        getLineGrowthRate(line, historicalColKeys),
        isWeekly,
        rollingDays
      ),
    }))
    const projectedInvesting = investingLines.map((line) => ({
      line,
      projected: projectLineItem(
        line,
        historicalColKeys,
        numForecast,
        getLineGrowthRate(line, historicalColKeys),
        isWeekly,
        rollingDays
      ),
    }))
    const projectedFinancing = financingLines.map((line) => ({
      line,
      projected: projectLineItem(
        line,
        historicalColKeys,
        numForecast,
        getLineGrowthRate(line, historicalColKeys),
        isWeekly,
        rollingDays
      ),
    }))

    // ========================================================================
    // Generate forecast periods
    // ========================================================================
    // Derive forecast start from the actual last historical period
    // so there's never a gap between historical and forecast.
    const lastHistoricalDate =
      numHistoricalCols > 0
        ? isWeekly
          ? addWeeks(historicalStart, numHistoricalCols)
          : addMonths(historicalStart, numHistoricalCols)
        : isWeekly
          ? addWeeks(currentPeriodStart, 1)
          : addMonths(currentPeriodStart, 1)

    const forecastPeriods: ForecastPeriod[] = []
    let forecastCash = currentCash
    let forecastCashNoMemories = currentCash
    let lowestCash = currentCash
    let lowestCashDate = formatDate(today)
    let lowestCashIndex = 0
    let highestCash = currentCash
    let highestCashDate = formatDate(today)
    let highestCashIndex = 0
    let totalInflow = 0
    let totalOutflow = 0

    for (let i = 0; i < numForecast; i++) {
      // Forecast starts from the period right after the last historical period
      const periodStart = isWeekly
        ? addWeeks(lastHistoricalDate, i)
        : addMonths(lastHistoricalDate, i)
      const periodEnd = isWeekly ? addWeeks(periodStart, 1) : addMonths(periodStart, 1)

      const forecastKey = `forecast_${i}`

      const operatingNet = projectedOperating.reduce(
        (s, p) => s + (p.projected[forecastKey] || 0),
        0
      )
      const investingNet = projectedInvesting.reduce(
        (s, p) => s + (p.projected[forecastKey] || 0),
        0
      )
      const financingNet = projectedFinancing.reduce(
        (s, p) => s + (p.projected[forecastKey] || 0),
        0
      )
      const baseNet = operatingNet + investingNet + financingNet

      const memoryAdj = getMemoryAdjustmentForPeriod(
        allMemories,
        enabledMemoryIds,
        periodStart,
        periodEnd
      )
      const periodNet = baseNet + memoryAdj.netAdjustment

      forecastCash += periodNet
      forecastCashNoMemories += baseNet

      const periodInflow =
        Math.max(0, operatingNet) +
        Math.max(0, investingNet) +
        Math.max(0, financingNet) +
        memoryAdj.inflow
      const periodOutflow =
        Math.abs(Math.min(0, operatingNet)) +
        Math.abs(Math.min(0, investingNet)) +
        Math.abs(Math.min(0, financingNet)) +
        memoryAdj.outflow
      totalInflow += periodInflow
      totalOutflow += periodOutflow

      if (forecastCash < lowestCash) {
        lowestCash = forecastCash
        lowestCashDate = formatDate(periodStart)
        lowestCashIndex = i
      }
      if (forecastCash > highestCash) {
        highestCash = forecastCash
        highestCashDate = formatDate(periodStart)
        highestCashIndex = i
      }

      const label = isWeekly
        ? periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : periodStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      forecastPeriods.push({
        date: formatDate(periodStart),
        label,
        forecast: forecastCash,
        isHistorical: false,
        memoryAdjustment: memoryAdj.netAdjustment,
        inflow: periodInflow,
        outflow: periodOutflow,
        cumulativeCash: forecastCash,
        forecastBase: forecastCashNoMemories,
      })
    }

    const allPeriods = [...historicalPeriods, ...forecastPeriods]

    // ========================================================================
    // Build FLAT line items for table (Cash Flow only)
    // ========================================================================
    const cashFlowLineItems: ForecastLineItem[] = [
      ...buildFlatLineItems(
        'operating',
        operatingLines,
        projectedOperating,
        historicalColKeys,
        numForecast
      ),
      ...buildFlatLineItems(
        'investing',
        investingLines,
        projectedInvesting,
        historicalColKeys,
        numForecast
      ),
      ...buildFlatLineItems(
        'financing',
        financingLines,
        projectedFinancing,
        historicalColKeys,
        numForecast
      ),
    ]

    // ========================================================================
    // Build individual memory line items
    // ========================================================================
    const uniqueMemoryBaseIds = new Map<
      string,
      { memory: ScheduledMemory; events: ScheduledMemory[] }
    >()
    for (const mem of allMemories) {
      const baseId = mem.sourceMemoryId
      if (enabledMemoryIds !== null && !enabledMemoryIds.has(baseId)) continue
      if (!uniqueMemoryBaseIds.has(baseId)) {
        uniqueMemoryBaseIds.set(baseId, { memory: mem, events: [] })
      }
      uniqueMemoryBaseIds.get(baseId)!.events.push(mem)
    }

    for (const [baseId, { memory, events }] of uniqueMemoryBaseIds) {
      const values: Record<string, number> = {}
      // Historical periods get 0
      for (let pi = 0; pi < numHistoricalCols; pi++) {
        values[`period_${pi}`] = 0
      }
      // Forecast periods
      for (let fi = 0; fi < numForecast; fi++) {
        const periodStart = isWeekly
          ? addWeeks(lastHistoricalDate, fi)
          : addMonths(lastHistoricalDate, fi)
        const periodEnd = isWeekly ? addWeeks(periodStart, 1) : addMonths(periodStart, 1)

        let periodAmount = 0
        for (const evt of events) {
          if (isDateInPeriod(evt.date, periodStart, periodEnd)) {
            periodAmount += memory.type === 'income' ? evt.amount : -evt.amount
          }
        }
        values[`period_${numHistoricalCols + fi}`] = periodAmount
      }

      const lineItem: ForecastLineItem = {
        id: `memory_${baseId}`,
        name: memory.description,
        category: memory.type === 'income' ? 'memory-income' : 'memory-expense',
        historicalAvg: 0,
        values,
        level: 1,
        isSummary: false,
        isMemory: true,
      }

      cashFlowLineItems.push(lineItem)
    }

    // ========================================================================
    // Calculate runway
    // ========================================================================
    const avgDailyNet =
      numForecast > 0 ? (forecastCash - currentCash) / (numForecast * (isWeekly ? 7 : 30)) : 0
    let runway: number | null = null
    if (avgDailyNet < 0 && currentCash > 0) {
      runway = currentCash / Math.abs(avgDailyNet) / 30
    }

    // ========================================================================
    // Build response
    // ========================================================================
    const forecastData: ForecastData = {
      horizon,
      periods: allPeriods,
      lineItems: {
        cashFlow: cashFlowLineItems,
        profitLoss: [], // Not used anymore
      },
      summary: {
        currentCash,
        projectedEndingCash: forecastCash,
        lowestCashPoint: {
          date: lowestCashDate,
          amount: lowestCash,
          periodIndex: lowestCashIndex,
        },
        highestCashPoint: {
          date: highestCashDate,
          amount: highestCash,
          periodIndex: highestCashIndex,
        },
        runway,
        totalProjectedInflow: totalInflow,
        totalProjectedOutflow: totalOutflow,
        netChange: totalInflow - totalOutflow,
        averageWeeklyBurn: avgDailyNet * 7,
        averageMonthlyBurn: avgDailyNet * 30,
      },
      assumptions,
      memories: {
        expenses: expandedExpenses.map((m) => ({
          ...m,
          enabled: enabledMemoryIds === null || enabledMemoryIds.has(m.sourceMemoryId),
        })),
        income: expandedIncome.map((m) => ({
          ...m,
          enabled: enabledMemoryIds === null || enabledMemoryIds.has(m.sourceMemoryId),
        })),
        totalExpenseImpact,
        totalIncomeImpact,
        netImpact: totalIncomeImpact - totalExpenseImpact,
      },
      currency,
      generated: new Date().toISOString(),
      startDate: formatDate(historicalStart),
      endDate: formatDate(forecastEnd),
    }

    return NextResponse.json({
      success: true,
      data: forecastData,
      metadata: {
        queryTime: Date.now() - startTime,
        historicalPeriods: historicalPeriods.length,
        forecastPeriods: forecastPeriods.length,
        cashFlowLineItemCount:
          operatingLines.length + investingLines.length + financingLines.length,
        memoryCount: allMemories.length,
      },
    })
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate forecast')
  }
})
