/**
 * @module waterfall-processor
 * @description Processes data for waterfall chart visualization
 * Handles cumulative calculations and color assignment
 */

import { COLORS } from '../shared/colors'

export interface WaterfallDataPoint {
  label: string
  value: number
  type?: 'initial' | 'final' | 'increment' | 'decrement'
}

export interface ProcessedWaterfallData {
  /** Transparent placeholder bars for positioning */
  placeholder: number[]
  /** Actual visible bar values */
  values: number[]
  /** Colors for each bar */
  colors: string[]
}

/**
 * Process raw data into waterfall chart format
 *
 * Creates placeholder values for stacking effect and assigns
 * colors based on value direction (positive/negative)
 *
 * @param data - Array of waterfall data points
 * @returns Processed data for ECharts series
 */
export function processWaterfallData(data: WaterfallDataPoint[]): ProcessedWaterfallData {
  const placeholder: number[] = []
  const values: number[] = []
  const colors: string[] = []
  let cumulative = 0

  data.forEach((item, index) => {
    const isInitial = item.type === 'initial' || index === 0
    const isFinal = item.type === 'final' || index === data.length - 1

    if (isInitial) {
      // Initial value starts from zero
      placeholder.push(0)
      values.push(item.value)
      colors.push(COLORS.blue)
      cumulative = item.value
    } else if (isFinal) {
      // Final value shows total
      placeholder.push(0)
      values.push(cumulative + item.value)
      colors.push(COLORS.purple)
    } else {
      // Intermediate values stack on cumulative
      if (item.value >= 0) {
        // Positive: placeholder is current cumulative
        placeholder.push(cumulative)
        values.push(item.value)
        colors.push(COLORS.emerald)
        cumulative += item.value
      } else {
        // Negative: placeholder is new cumulative (after decrease)
        cumulative += item.value
        placeholder.push(cumulative)
        values.push(Math.abs(item.value))
        colors.push(COLORS.red)
      }
    }
  })

  return { placeholder, values, colors }
}
