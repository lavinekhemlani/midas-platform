/**
 * Forecasting Algorithms
 *
 * Provides multiple forecasting methods for cash flow projections:
 * - Weighted Moving Average (exponential decay)
 * - Holt-Winters Exponential Smoothing (seasonal patterns)
 * - Trend-Adjusted (linear regression with growth)
 */

import { linearRegression, linearRegressionLine } from 'simple-statistics'
import type { ForecastAlgorithm } from '@/types/forecasting'

// ============================================================================
// Algorithm Parameters
// ============================================================================

interface ProjectionParams {
  values: number[] // Historical values (ordered oldest to newest)
  numPeriods: number // Number of periods to forecast
  growthRate: number // Growth rate percentage (-50 to +100)
  isWeekly: boolean // True for 13-week, false for 6-month
  algorithm: ForecastAlgorithm
}

interface ProjectionResult {
  projected: number[] // Forecasted values
  trend?: number // Detected trend (for UI display)
  seasonalFactors?: number[] // Seasonal multipliers (for Holt-Winters)
}

// ============================================================================
// Main Projection Function
// ============================================================================

export function projectValues(params: ProjectionParams): ProjectionResult {
  const { values, numPeriods, growthRate, isWeekly, algorithm } = params

  // Filter to non-zero values for calculations
  const nonZeroValues = values.filter((v) => v !== 0)

  if (nonZeroValues.length === 0) {
    return { projected: Array(numPeriods).fill(0) }
  }

  switch (algorithm) {
    case 'holt-winters':
      return holtWintersProjection(nonZeroValues, numPeriods, growthRate, isWeekly)
    case 'trend-adjusted':
      return trendAdjustedProjection(nonZeroValues, numPeriods, growthRate, isWeekly)
    case 'weighted':
    default:
      return weightedAverageProjection(nonZeroValues, numPeriods, growthRate, isWeekly)
  }
}

// ============================================================================
// Weighted Moving Average (Enhanced with Exponential Decay)
// ============================================================================

function weightedAverageProjection(
  values: number[],
  numPeriods: number,
  growthRate: number,
  isWeekly: boolean
): ProjectionResult {
  const DECAY_FACTOR = 0.85

  // Calculate weighted average
  let weightedSum = 0
  let weightSum = 0

  for (let i = 0; i < values.length; i++) {
    const weight = Math.pow(DECAY_FACTOR, values.length - 1 - i)
    weightedSum += values[i] * weight
    weightSum += weight
  }

  const weightedAvg = weightSum > 0 ? weightedSum / weightSum : 0

  // Project forward with compound growth
  const projected: number[] = []
  for (let i = 0; i < numPeriods; i++) {
    const monthsAhead = isWeekly ? (i + 1) / 4.33 : i + 1
    const growthFactor = Math.pow(1 + growthRate / 100, monthsAhead)
    projected.push(Math.round(weightedAvg * growthFactor * 100) / 100)
  }

  return { projected }
}

// ============================================================================
// Holt-Winters Exponential Smoothing
// ============================================================================

function holtWintersProjection(
  values: number[],
  numPeriods: number,
  growthRate: number,
  isWeekly: boolean
): ProjectionResult {
  // Holt-Winters parameters (tuned for financial data)
  const alpha = 0.3 // Level smoothing
  const beta = 0.1 // Trend smoothing
  const gamma = 0.3 // Seasonal smoothing

  // Determine seasonal period (4 for monthly data = quarters, 12 for weekly = quarters)
  const seasonalPeriod = isWeekly ? 4 : 4 // Use quarterly seasonality

  // Need at least 2 seasonal periods for reliable detection
  if (values.length < seasonalPeriod * 2) {
    // Fall back to weighted average if not enough data
    return weightedAverageProjection(values, numPeriods, growthRate, isWeekly)
  }

  // Initialize components
  // Level: average of first seasonal period
  let level = values.slice(0, seasonalPeriod).reduce((a, b) => a + b, 0) / seasonalPeriod

  // Trend: average difference between first two seasonal periods
  const firstPeriodAvg = values.slice(0, seasonalPeriod).reduce((a, b) => a + b, 0) / seasonalPeriod
  const secondPeriodAvg =
    values.slice(seasonalPeriod, seasonalPeriod * 2).reduce((a, b) => a + b, 0) / seasonalPeriod
  let trend = (secondPeriodAvg - firstPeriodAvg) / seasonalPeriod

  // Seasonal factors: ratio of each point to level
  const seasonalFactors: number[] = []
  for (let i = 0; i < seasonalPeriod; i++) {
    const periodValues = values.filter((_, idx) => idx % seasonalPeriod === i)
    const avgForPeriod = periodValues.reduce((a, b) => a + b, 0) / periodValues.length
    seasonalFactors.push(level > 0 ? avgForPeriod / level : 1)
  }

  // Normalize seasonal factors to sum to seasonalPeriod
  const seasonalSum = seasonalFactors.reduce((a, b) => a + b, 0)
  for (let i = 0; i < seasonalFactors.length; i++) {
    seasonalFactors[i] = (seasonalFactors[i] * seasonalPeriod) / seasonalSum
  }

  // Update components through historical data
  for (let t = 0; t < values.length; t++) {
    const seasonIdx = t % seasonalPeriod
    const y = values[t]

    const prevLevel = level
    const prevTrend = trend
    const prevSeasonal = seasonalFactors[seasonIdx]

    // Update level
    level = alpha * (y / prevSeasonal) + (1 - alpha) * (prevLevel + prevTrend)

    // Update trend
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend

    // Update seasonal factor
    seasonalFactors[seasonIdx] = gamma * (y / level) + (1 - gamma) * prevSeasonal
  }

  // Forecast future periods
  const projected: number[] = []
  for (let h = 1; h <= numPeriods; h++) {
    const seasonIdx = (values.length + h - 1) % seasonalPeriod
    const baseProjection = (level + h * trend) * seasonalFactors[seasonIdx]

    // Apply user's growth rate adjustment
    const monthsAhead = isWeekly ? h / 4.33 : h
    const growthAdjustment = Math.pow(1 + growthRate / 100, monthsAhead)

    projected.push(Math.round(baseProjection * growthAdjustment * 100) / 100)
  }

  return {
    projected,
    trend,
    seasonalFactors,
  }
}

// ============================================================================
// Trend-Adjusted Projection (Linear Regression)
// ============================================================================

function trendAdjustedProjection(
  values: number[],
  numPeriods: number,
  growthRate: number,
  isWeekly: boolean
): ProjectionResult {
  // Create data points for regression (x = period index, y = value)
  const dataPoints: [number, number][] = values.map((y, x) => [x, y])

  // Perform linear regression using simple-statistics
  const regression = linearRegression(dataPoints)
  const predictLine = linearRegressionLine(regression)

  // The trend is the slope (m in y = mx + b)
  const trend = regression.m

  // Project forward
  const projected: number[] = []
  const lastIndex = values.length - 1

  for (let i = 0; i < numPeriods; i++) {
    const futureIndex = lastIndex + i + 1
    const baseProjection = predictLine(futureIndex)

    // Apply additional growth rate adjustment from user
    const monthsAhead = isWeekly ? (i + 1) / 4.33 : i + 1
    const growthAdjustment = Math.pow(1 + growthRate / 100, monthsAhead)

    // Don't let values go negative if the base was positive
    const adjustedValue = baseProjection * growthAdjustment
    const finalValue = values[lastIndex] > 0 ? Math.max(0, adjustedValue) : adjustedValue

    projected.push(Math.round(finalValue * 100) / 100)
  }

  return {
    projected,
    trend,
  }
}

// ============================================================================
// Utility: Detect Best Algorithm
// ============================================================================

export function detectBestAlgorithm(values: number[]): ForecastAlgorithm {
  const nonZero = values.filter((v) => v !== 0)

  if (nonZero.length < 4) {
    return 'weighted' // Not enough data for sophisticated methods
  }

  // Check for seasonality (variance in seasonal patterns)
  const seasonalVariance = calculateSeasonalVariance(nonZero, 4)

  // Check for trend (R² of linear regression)
  const trendStrength = calculateTrendStrength(nonZero)

  // Decision logic
  if (seasonalVariance > 0.15 && nonZero.length >= 8) {
    return 'holt-winters' // Strong seasonal patterns detected
  } else if (trendStrength > 0.6) {
    return 'trend-adjusted' // Strong linear trend
  } else {
    return 'weighted' // Default to weighted average
  }
}

function calculateSeasonalVariance(values: number[], seasonalPeriod: number): number {
  if (values.length < seasonalPeriod * 2) return 0

  // Calculate variance between same-period values
  const periodGroups: number[][] = Array.from({ length: seasonalPeriod }, () => [])

  values.forEach((v, i) => {
    periodGroups[i % seasonalPeriod].push(v)
  })

  const groupMeans = periodGroups.map((g) => g.reduce((a, b) => a + b, 0) / g.length)
  const overallMean = values.reduce((a, b) => a + b, 0) / values.length

  if (overallMean === 0) return 0

  // Coefficient of variation between seasonal means
  const variance =
    groupMeans.reduce((sum, mean) => sum + Math.pow(mean - overallMean, 2), 0) / seasonalPeriod
  return Math.sqrt(variance) / Math.abs(overallMean)
}

function calculateTrendStrength(values: number[]): number {
  if (values.length < 3) return 0

  const dataPoints: [number, number][] = values.map((y, x) => [x, y])
  const regression = linearRegression(dataPoints)
  const predictLine = linearRegressionLine(regression)

  // Calculate R² (coefficient of determination)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0)
  const ssResidual = values.reduce((sum, y, x) => sum + Math.pow(y - predictLine(x), 2), 0)

  if (ssTotal === 0) return 0
  return 1 - ssResidual / ssTotal
}
