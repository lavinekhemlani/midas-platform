/**
 * Raw Forecast Data API
 *
 * Returns historical cash flow data and memories WITHOUT projections.
 * Projections are calculated client-side for instant responsiveness.
 *
 * GET /api/forecasting/raw
 *
 * Query Parameters:
 * - horizon: '13-week' | '6-month' (default: '13-week')
 */

import { NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { MemoryService } from '@/ai/memory/memoryService'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { transformCashFlow } from '@/quickbooks/reports'
import { withRetry, formatErrorResponse, formatReportDate } from '@/quickbooks/utils/route-helpers'
import type { ForecastHorizon, ScheduledMemory } from '@/types/forecasting'
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
// Types for Raw Data
// ============================================================================

export interface RawHistoricalPeriod {
  date: string
  label: string
  colKey: string
  operating: number
  investing: number
  financing: number
  netChange: number
  cumulativeCash: number
  inflow: number
  outflow: number
}

export interface RawLineItem {
  id: string
  name: string
  category: 'operating' | 'investing' | 'financing'
  values: Record<string, number> // colKey -> value
  total: number
}

export interface RawForecastData {
  horizon: ForecastHorizon
  isWeekly: boolean
  numHistorical: number
  numForecast: number
  beginningCash: number
  currentCash: number
  currency: string
  historicalStart: string
  forecastEnd: string
  lastHistoricalDate: string
  historicalPeriods: RawHistoricalPeriod[]
  lineItems: RawLineItem[]
  memories: {
    expenses: ScheduledMemory[]
    income: ScheduledMemory[]
  }
  generated: string
}

// ============================================================================
// Main API Handler
// ============================================================================

export const GET = withActiveProvider(async (request, { organizationId, userId, realmId }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  const horizon = (searchParams.get('horizon') || '13-week') as ForecastHorizon

  const isWeekly = horizon === '13-week'
  const numHistorical = isWeekly ? 13 : 7
  const numForecast = isWeekly ? 13 : 6

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate date ranges
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

    // Filter real lines (not summaries or empty headers)
    const isRealLine = (l: NormalizedReportLine) => {
      if (l.isSummary) return false
      const hasAnyValue = historicalColKeys.some((k) => (l.values[k] || 0) !== 0) || l.total !== 0
      return hasAnyValue
    }
    const operatingLines = normalizedCF.operatingActivities.lines.filter(isRealLine)
    const investingLines = normalizedCF.investingActivities.lines.filter(isRealLine)
    const financingLines = normalizedCF.financingActivities.lines.filter(isRealLine)

    // Build historical periods
    const historicalPeriods: RawHistoricalPeriod[] = periodColumns.map(
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

        const periodDate = isWeekly
          ? addWeeks(historicalStart, index)
          : addMonths(historicalStart, index)

        const label = isWeekly
          ? periodDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : periodDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

        return {
          date: formatDate(periodDate),
          label,
          colKey,
          operating,
          investing,
          financing,
          netChange,
          cumulativeCash: runningCash,
          inflow: Math.max(0, operating) + Math.max(0, investing) + Math.max(0, financing),
          outflow:
            Math.abs(Math.min(0, operating)) +
            Math.abs(Math.min(0, investing)) +
            Math.abs(Math.min(0, financing)),
        }
      }
    )

    const currentCash = runningCash

    // Build line items with raw values
    const lineItems: RawLineItem[] = [
      ...operatingLines.map((line, idx) => ({
        id: `operating_${idx}_${line.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: line.name,
        category: 'operating' as const,
        values: Object.fromEntries(historicalColKeys.map((k) => [k, line.values[k] || 0])),
        total: line.total || 0,
      })),
      ...investingLines.map((line, idx) => ({
        id: `investing_${idx}_${line.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: line.name,
        category: 'investing' as const,
        values: Object.fromEntries(historicalColKeys.map((k) => [k, line.values[k] || 0])),
        total: line.total || 0,
      })),
      ...financingLines.map((line, idx) => ({
        id: `financing_${idx}_${line.name.replace(/\s+/g, '_').toLowerCase()}`,
        name: line.name,
        category: 'financing' as const,
        values: Object.fromEntries(historicalColKeys.map((k) => [k, line.values[k] || 0])),
        total: line.total || 0,
      })),
    ]

    // Calculate last historical date for forecast start
    const lastHistoricalDate =
      numHistoricalCols > 0
        ? isWeekly
          ? addWeeks(historicalStart, numHistoricalCols)
          : addMonths(historicalStart, numHistoricalCols)
        : isWeekly
          ? addWeeks(currentPeriodStart, 1)
          : addMonths(currentPeriodStart, 1)

    // ========================================================================
    // Fetch memories
    // ========================================================================
    const memoryService = new MemoryService(userId, organizationId, realmId)
    const [expenseMemories, incomeMemories] = await Promise.all([
      memoryService.search({ type: 'expense', includeArchived: false }),
      memoryService.search({ type: 'income', includeArchived: false }),
    ])

    // Use lastHistoricalDate as start so memories align with forecast period boundaries
    // (not `today`, which may fall mid-period and miss memories in the current period)
    const expandedExpenses = expandRecurringMemories(expenseMemories, lastHistoricalDate, forecastEnd)
    const expandedIncome = expandRecurringMemories(incomeMemories, lastHistoricalDate, forecastEnd)

    // ========================================================================
    // Build response
    // ========================================================================
    const rawData: RawForecastData = {
      horizon,
      isWeekly,
      numHistorical: numHistoricalCols,
      numForecast,
      beginningCash,
      currentCash,
      currency,
      historicalStart: formatDate(historicalStart),
      forecastEnd: formatDate(forecastEnd),
      lastHistoricalDate: formatDate(lastHistoricalDate),
      historicalPeriods,
      lineItems,
      memories: {
        expenses: expandedExpenses,
        income: expandedIncome,
      },
      generated: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: rawData,
      metadata: {
        queryTime: Date.now() - startTime,
        historicalPeriods: historicalPeriods.length,
        lineItemCount: lineItems.length,
        memoryCount: expandedExpenses.length + expandedIncome.length,
      },
    })
  } catch (error) {
    return formatErrorResponse(error, 'Failed to fetch raw forecast data')
  }
})
