/**
 * Time-series forecasting utilities.
 *
 * Implements Holt-Winters Double Exponential Smoothing (DES), a standard
 * algorithm that separates a series into level and trend components, then
 * projects them forward. Robust against noise and well-suited to trending
 * business metrics like orders, revenue, and demand.
 *
 * Reference: Holt, C.C. (1957) "Forecasting trends and seasonals by
 * exponentially weighted moving averages."
 */

/**
 * Holt-Winters Double Exponential Smoothing forecast.
 *
 * Recurrence relations:
 *   level_t = α × y_t + (1 - α) × (level_{t-1} + trend_{t-1})
 *   trend_t = β × (level_t - level_{t-1}) + (1 - β) × trend_{t-1}
 *
 * Forecast at horizon h: F(h) = level_n + h × trend_n
 *
 * @param values  Historical observations in chronological order.
 * @param horizon Number of future periods to forecast.
 * @param alpha   Level smoothing factor in [0, 1]. Higher = more reactive to
 *                recent observations. Default 0.3.
 * @param beta    Trend smoothing factor in [0, 1]. Higher = more reactive to
 *                recent trend changes. Default 0.1.
 * @returns Array of length `horizon` with forecasted values, clamped to ≥ 0.
 */
export function holtWintersForecast(
  values: number[],
  horizon: number,
  alpha = 0.3,
  beta = 0.1
): number[] {
  if (horizon <= 0) return []
  const n = values.length

  // Degenerate cases — not enough data to fit a trend
  if (n < 2) {
    const v = n === 1 ? Math.max(0, values[0]) : 0
    return Array(horizon).fill(v)
  }

  // Initialize level from first observation; initialize trend as the mean
  // change over the first few periods (up to 4) for stability
  let level = values[0]
  const initPeriod = Math.min(4, n - 1)
  let trend = 0
  for (let i = 0; i < initPeriod; i++) {
    trend += values[i + 1] - values[i]
  }
  trend /= initPeriod

  // Run DES through all observations to update level and trend
  for (let t = 1; t < n; t++) {
    const prevLevel = level
    const prevTrend = trend
    level = alpha * values[t] + (1 - alpha) * (prevLevel + prevTrend)
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend
  }

  // Project forward: F(h) = level + h × trend
  const forecast: number[] = []
  for (let h = 1; h <= horizon; h++) {
    forecast.push(Math.max(0, level + h * trend))
  }
  return forecast
}
