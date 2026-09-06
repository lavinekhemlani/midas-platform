/**
 * ScatterChart - Backward compatibility wrapper for EChartsScatter
 *
 * This component maintains compatibility with legacy code while using the new
 * ECharts-based implementation under the hood.
 *
 * @deprecated Use EChartsScatter directly for new code
 */
'use client'

import { useMemo } from 'react'
import {
  EChartsScatter,
  type ScatterDataPoint as EChartsDataPoint,
} from '@/components/charts/echarts/EChartsScatter'

// Legacy interface - kept for backward compatibility
interface ScatterDataPoint {
  x: number
  y: number
  z?: number // For bubble charts
  label?: string
  category?: string
  metadata?: any
}

interface ScatterChartProps {
  data: ScatterDataPoint[]
  xLabel?: string
  yLabel?: string
  zLabel?: string // For bubble size
  title?: string
  subtitle?: string
  currency?: string
  height?: number
  showTrendLine?: boolean
  colorByCategory?: boolean
  bubbleChart?: boolean
}

/**
 * Adapter component that converts legacy ScatterChart props to EChartsScatter format
 */
export default function ScatterChart({
  data,
  xLabel = 'X Axis',
  yLabel = 'Y Axis',
  zLabel = 'Size',
  title,
  subtitle,
  currency: propCurrency,
  height = 400,
  showTrendLine = false,
  colorByCategory = true,
  bubbleChart = false,
}: ScatterChartProps) {
  // Convert legacy data format to ECharts format
  const echartsData = useMemo((): EChartsDataPoint[] => {
    return data.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z, // Pass z value for bubble charts
      name: point.label,
      label: point.label, // Backward compatibility
      category: point.category,
      metadata: point.metadata,
    }))
  }, [data])

  // Create format functions for currency-based labels
  const formatX = useMemo(() => {
    return (value: number) => {
      if (xLabel.toLowerCase().includes('date')) {
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      return value.toLocaleString()
    }
  }, [xLabel])

  const formatY = useMemo(() => {
    return (value: number) => {
      if (
        yLabel.toLowerCase().includes('amount') ||
        yLabel.toLowerCase().includes('revenue') ||
        yLabel.toLowerCase().includes('cost')
      ) {
        const currency = propCurrency || 'USD'
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: 'compact',
        }).format(value)
      }
      return value.toLocaleString()
    }
  }, [yLabel, propCurrency])

  return (
    <EChartsScatter
      data={echartsData}
      xLabel={xLabel}
      yLabel={yLabel}
      zLabel={zLabel}
      title={title}
      subtitle={subtitle}
      currency={propCurrency}
      showTrendLine={showTrendLine}
      height={height}
      formatX={formatX}
      formatY={formatY}
      colorByCategory={colorByCategory}
      bubbleChart={bubbleChart}
    />
  )
}
