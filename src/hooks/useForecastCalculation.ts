/**
 * Client-Side Forecast Calculation Hook
 *
 * Fetches raw historical data once, then calculates projections client-side
 * for instant responsiveness when adjusting assumptions.
 *
 * This provides ~100x faster feedback (5-20ms vs 500-2000ms) when users
 * adjust growth rates, rolling average windows, or toggle memories.
 */

'use client'

import { useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { useQBRealmId, appendRealmId } from './useQBRealmId'
import type {
  ForecastHorizon,
  ForecastAssumptions,
  ForecastData,
  ForecastPeriod,
  ForecastLineItem,
  ForecastSummary,
  ForecastMemories,
  ScheduledMemory,
  ForecastAlgorithm,
} from '@/types/forecasting'
import { projectValues } from '@/lib/forecasting/algorithms'

// ============================================================================
// Types for Raw Data (matches API response)
// ============================================================================

interface RawHistoricalPeriod {
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

interface RawLineItem {
  id: string
  name: string
  category: 'operating' | 'investing' | 'financing'
  values: Record<string, number>
  total: number
}

interface RawForecastData {
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

interface RawForecastApiResponse {
  success: boolean
  data?: RawForecastData
  error?: string
}

// ============================================================================
// Date Helpers
// ============================================================================

function addWeeks(dateStr: string, weeks: number): Date {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function addMonths(dateStr: string, months: number): Date {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isDateInPeriod(dateStr: string, periodStart: Date, periodEnd: Date): boolean {
  // Parse as UTC to match period boundaries (which are also UTC from new Date(dateStr))
  const parts = dateStr.split('-')
  const d = Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  return d >= periodStart.getTime() && d < periodEnd.getTime()
}

// ============================================================================
// Projection Functions (Client-Side)
// ============================================================================

function projectLineItem(
  values: Record<string, number>,
  colKeys: string[],
  numForecastPeriods: number,
  growthRate: number,
  isWeekly: boolean,
  rollingDays: number,
  algorithm: ForecastAlgorithm = 'weighted'
): number[] {
  // Convert days to periods
  const maxPeriods = isWeekly ? Math.ceil(rollingDays / 7) : Math.ceil(rollingDays / 30)
  const relevantKeys = colKeys.slice(-Math.min(maxPeriods, colKeys.length))

  // Get historical values (ordered oldest to newest)
  const historicalValues = relevantKeys.map((k) => values[k] || 0)

  // Use the algorithm module for projection
  const result = projectValues({
    values: historicalValues,
    numPeriods: numForecastPeriods,
    growthRate,
    isWeekly,
    algorithm,
  })

  return result.projected
}

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
// Main Calculation Function
// ============================================================================

function calculateForecast(
  rawData: RawForecastData,
  assumptions: ForecastAssumptions,
  enabledMemoryIds: string[] | undefined,
  allMemoriesEnabled: boolean
): ForecastData {
  const { isWeekly, numForecast, currentCash, lineItems, memories, historicalPeriods } = rawData

  const enabledIds = allMemoriesEnabled
    ? null
    : enabledMemoryIds
      ? new Set(enabledMemoryIds)
      : new Set<string>()

  const allMemories = [...memories.expenses, ...memories.income]
  const colKeys = historicalPeriods.map((p) => p.colKey)

  // ========================================================================
  // Project line items
  // ========================================================================
  const projectedLines = lineItems.map((line) => {
    // Determine growth rate based on avg value (positive = inflow, negative = outflow)
    const avgValue =
      colKeys.reduce((s, k) => s + (line.values[k] || 0), 0) / Math.max(colKeys.length, 1)
    const growthRate = avgValue >= 0 ? assumptions.inflowGrowthRate : assumptions.outflowGrowthRate

    const projected = projectLineItem(
      line.values,
      colKeys,
      numForecast,
      growthRate,
      isWeekly,
      assumptions.rollingAverageDays,
      assumptions.algorithm || 'weighted'
    )

    return { line, projected }
  })

  // ========================================================================
  // Build historical periods for output
  // ========================================================================
  const outputHistoricalPeriods: ForecastPeriod[] = historicalPeriods.map((p) => ({
    date: p.date,
    label: p.label,
    actual: p.cumulativeCash,
    forecast: p.cumulativeCash,
    isHistorical: true,
    memoryAdjustment: 0,
    inflow: p.inflow,
    outflow: p.outflow,
    cumulativeCash: p.cumulativeCash,
    forecastBase: p.cumulativeCash,
  }))

  // ========================================================================
  // Calculate historical volatility for confidence bands
  // ========================================================================
  const historicalNetChanges = historicalPeriods.map((p) => p.netChange)
  const avgNetChange =
    historicalNetChanges.length > 0
      ? historicalNetChanges.reduce((s, v) => s + v, 0) / historicalNetChanges.length
      : 0

  // Calculate standard deviation of historical net changes
  const variance =
    historicalNetChanges.length > 1
      ? historicalNetChanges.reduce((s, v) => s + Math.pow(v - avgNetChange, 2), 0) /
        (historicalNetChanges.length - 1)
      : 0
  const stdDev = Math.sqrt(variance)

  // Z-score multipliers for confidence levels
  const zScores: Record<number, number> = { 80: 1.28, 90: 1.645, 95: 1.96 }
  const zScore = zScores[assumptions.confidenceLevel] || 1.645

  // ========================================================================
  // Generate forecast periods
  // ========================================================================
  const forecastPeriods: ForecastPeriod[] = []
  let forecastCash = currentCash
  let forecastCashNoMemories = currentCash
  let forecastCashUpper = currentCash
  let forecastCashLower = currentCash
  let lowestCash = currentCash
  let lowestCashDate = rawData.lastHistoricalDate
  let lowestCashIndex = 0
  let highestCash = currentCash
  let highestCashDate = rawData.lastHistoricalDate
  let highestCashIndex = 0
  let totalInflow = 0
  let totalOutflow = 0

  for (let i = 0; i < numForecast; i++) {
    const periodStart = isWeekly
      ? addWeeks(rawData.lastHistoricalDate, i)
      : addMonths(rawData.lastHistoricalDate, i)
    const periodEnd = isWeekly
      ? addWeeks(rawData.lastHistoricalDate, i + 1)
      : addMonths(rawData.lastHistoricalDate, i + 1)

    // Sum projected values by category
    let operatingNet = 0
    let investingNet = 0
    let financingNet = 0

    for (const { line, projected } of projectedLines) {
      const value = projected[i] || 0
      if (line.category === 'operating') operatingNet += value
      else if (line.category === 'investing') investingNet += value
      else if (line.category === 'financing') financingNet += value
    }

    const baseNet = operatingNet + investingNet + financingNet

    // Memory adjustments
    const memoryAdj = getMemoryAdjustmentForPeriod(allMemories, enabledIds, periodStart, periodEnd)
    const periodNet = baseNet + memoryAdj.netAdjustment

    forecastCash += periodNet
    forecastCashNoMemories += baseNet

    // Confidence bands widen over time (uncertainty grows with sqrt of periods ahead)
    // This models the random walk nature of financial uncertainty
    const uncertaintyMultiplier = Math.sqrt(i + 1)
    const periodUncertainty = stdDev * zScore * uncertaintyMultiplier
    forecastCashUpper = forecastCashNoMemories + periodUncertainty
    forecastCashLower = forecastCashNoMemories - periodUncertainty

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
      confidenceUpper: forecastCashUpper,
      confidenceLower: forecastCashLower,
    })
  }

  // ========================================================================
  // Build line items with projected values
  // ========================================================================
  const cashFlowLineItems: ForecastLineItem[] = projectedLines.map(({ line, projected }) => {
    const values: Record<string, number> = {}

    // Historical values
    colKeys.forEach((colKey, colIdx) => {
      values[`period_${colIdx}`] = line.values[colKey] || 0
    })

    // Forecast values
    projected.forEach((val, fi) => {
      values[`period_${colKeys.length + fi}`] = val
    })

    // Calculate historical average
    const histValues = colKeys.map((k) => line.values[k] || 0)
    const nonZero = histValues.filter((v) => v !== 0)
    const historicalAvg =
      nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0

    return {
      id: line.id,
      name: line.name,
      category: line.category,
      historicalAvg,
      values,
      level: 1,
      isSummary: false,
    }
  })

  // Add memory line items
  const uniqueMemoryBaseIds = new Map<
    string,
    { memory: ScheduledMemory; events: ScheduledMemory[] }
  >()

  for (const mem of allMemories) {
    const baseId = mem.sourceMemoryId
    if (enabledIds !== null && !enabledIds.has(baseId)) continue
    if (!uniqueMemoryBaseIds.has(baseId)) {
      uniqueMemoryBaseIds.set(baseId, { memory: mem, events: [] })
    }
    uniqueMemoryBaseIds.get(baseId)!.events.push(mem)
  }

  for (const [baseId, { memory, events }] of uniqueMemoryBaseIds) {
    const values: Record<string, number> = {}

    // Historical periods get 0
    for (let pi = 0; pi < colKeys.length; pi++) {
      values[`period_${pi}`] = 0
    }

    // Forecast periods
    for (let fi = 0; fi < numForecast; fi++) {
      const periodStart = isWeekly
        ? addWeeks(rawData.lastHistoricalDate, fi)
        : addMonths(rawData.lastHistoricalDate, fi)
      const periodEnd = isWeekly
        ? addWeeks(rawData.lastHistoricalDate, fi + 1)
        : addMonths(rawData.lastHistoricalDate, fi + 1)

      let periodAmount = 0
      for (const evt of events) {
        if (isDateInPeriod(evt.date, periodStart, periodEnd)) {
          periodAmount += memory.type === 'income' ? evt.amount : -evt.amount
        }
      }
      values[`period_${colKeys.length + fi}`] = periodAmount
    }

    cashFlowLineItems.push({
      id: `memory_${baseId}`,
      name: memory.description,
      category: memory.type === 'income' ? 'memory-income' : 'memory-expense',
      historicalAvg: 0,
      values,
      level: 1,
      isSummary: false,
      isMemory: true,
    })
  }

  // ========================================================================
  // Calculate runway and summary
  // ========================================================================
  const avgDailyNet =
    numForecast > 0 ? (forecastCash - currentCash) / (numForecast * (isWeekly ? 7 : 30)) : 0
  let runway: number | null = null
  if (avgDailyNet < 0 && currentCash > 0) {
    runway = currentCash / Math.abs(avgDailyNet) / 30
  }

  // Calculate memory impacts
  let totalExpenseImpact = 0
  let totalIncomeImpact = 0
  for (const memory of allMemories) {
    const baseId = memory.sourceMemoryId
    if (enabledIds === null || enabledIds.has(baseId)) {
      if (memory.type === 'expense') totalExpenseImpact += memory.amount
      else totalIncomeImpact += memory.amount
    }
  }

  const summary: ForecastSummary = {
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
  }

  const forecastMemories: ForecastMemories = {
    expenses: memories.expenses.map((m) => ({
      ...m,
      enabled: enabledIds === null || enabledIds.has(m.sourceMemoryId),
    })),
    income: memories.income.map((m) => ({
      ...m,
      enabled: enabledIds === null || enabledIds.has(m.sourceMemoryId),
    })),
    totalExpenseImpact,
    totalIncomeImpact,
    netImpact: totalIncomeImpact - totalExpenseImpact,
  }

  return {
    horizon: rawData.horizon,
    periods: [...outputHistoricalPeriods, ...forecastPeriods],
    lineItems: {
      cashFlow: cashFlowLineItems,
      profitLoss: [],
    },
    summary,
    assumptions,
    memories: forecastMemories,
    currency: rawData.currency,
    generated: new Date().toISOString(),
    startDate: rawData.historicalStart,
    endDate: rawData.forecastEnd,
  }
}

// ============================================================================
// SWR Fetcher
// ============================================================================

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: 'Failed to fetch raw forecast data' }
    }
    const error: any = new Error(errorData.error || errorData.message || 'Failed to fetch data')
    error.status = response.status
    error.code = errorData.code
    error.requiresReconnect = errorData.requiresReconnect
    throw error
  }
  return response.json()
}

// ============================================================================
// Hook
// ============================================================================

interface UseForecastCalculationOptions {
  horizon: ForecastHorizon
  assumptions: ForecastAssumptions
  enabledMemoryIds?: string[]
  allMemoriesEnabled?: boolean
  enabled?: boolean
  provider?: string
}

export function useForecastCalculation(options: UseForecastCalculationOptions) {
  const {
    horizon,
    assumptions,
    enabledMemoryIds,
    allMemoriesEnabled = true,
    enabled = true,
    provider,
  } = options

  const realmId = useQBRealmId()

  // Build URL with optional provider and realmId params
  const url = useMemo(() => {
    if (!enabled) return null
    const params = new URLSearchParams()
    params.append('horizon', horizon)
    if (provider) params.append('provider', provider)
    appendRealmId(params, realmId)
    return `/api/forecasting/raw?${params.toString()}`
  }, [enabled, horizon, provider, realmId])

  // Fetch raw data (only refetches when horizon changes)
  const {
    data: rawResponse,
    error: rawError,
    isLoading: isLoadingRaw,
    isValidating,
    mutate,
  } = useSWR<RawForecastApiResponse>(url, fetcher, {
    // Long cache - raw data rarely changes
    dedupingInterval: 5 * 60 * 1000, // 5 minutes
    revalidateOnFocus: false,
    revalidateOnMount: true,
    keepPreviousData: true,
  })

  // Listen for memory changes to refresh forecast data
  useEffect(() => {
    const handleMemoryChange = () => mutate()
    window.addEventListener('memory-created', handleMemoryChange)
    window.addEventListener('memory-updated', handleMemoryChange)
    window.addEventListener('memory-deleted', handleMemoryChange)
    return () => {
      window.removeEventListener('memory-created', handleMemoryChange)
      window.removeEventListener('memory-updated', handleMemoryChange)
      window.removeEventListener('memory-deleted', handleMemoryChange)
    }
  }, [mutate])

  // Calculate forecast client-side (instant when assumptions change)
  const forecastData = useMemo(() => {
    if (!rawResponse?.data) return undefined

    return calculateForecast(rawResponse.data, assumptions, enabledMemoryIds, allMemoriesEnabled)
  }, [rawResponse?.data, assumptions, enabledMemoryIds, allMemoriesEnabled])

  return {
    forecastData,
    rawData: rawResponse?.data,
    isLoading: isLoadingRaw && !rawResponse?.data,
    isValidating,
    error:
      rawError?.message || (rawResponse && !rawResponse.success ? 'Failed to load data' : null),
    isError: !!rawError || (rawResponse ? !rawResponse.success : false),
    refresh: () => mutate(),
    mutate,
  }
}
