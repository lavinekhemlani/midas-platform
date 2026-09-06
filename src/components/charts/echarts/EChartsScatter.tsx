'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from '../useChartThemeColors'
import { canvasHighDpiOpts } from '@/components/chat/visualizations/shared/echarts-config'

export interface ScatterDataPoint {
  x: number
  y: number
  z?: number // For bubble charts
  name?: string
  label?: string // Backward compatibility with old 'label'
  category?: string // For color grouping
  color?: string // Manual color override
  metadata?: any // Extra data
}

export interface EChartsScatterProps {
  data: Array<ScatterDataPoint>
  xLabel?: string
  yLabel?: string
  zLabel?: string // For bubble size
  title?: string
  subtitle?: string
  currency?: string // For currency formatting
  showTrendLine?: boolean
  height?: number
  formatX?: (value: number) => string
  formatY?: (value: number) => string
  className?: string
  colorByCategory?: boolean // Group by category with different colors
  bubbleChart?: boolean // Enable bubble mode with z values
}

export function EChartsScatter({
  data,
  xLabel = 'X Axis',
  yLabel = 'Y Axis',
  zLabel = 'Size',
  title,
  subtitle,
  currency = 'USD',
  showTrendLine = false,
  height = 400,
  formatX,
  formatY,
  className,
  colorByCategory = false,
  bubbleChart = false,
}: EChartsScatterProps) {
  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipBorder, tooltipText } = useChartThemeColors()

  // Auto-detect format functions based on labels
  const autoFormatX = useMemo(() => {
    if (formatX) return formatX
    if (xLabel.toLowerCase().includes('date')) {
      return (val: number) => {
        try {
          return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        } catch {
          return val.toLocaleString()
        }
      }
    }
    return (val: number) => val.toLocaleString()
  }, [formatX, xLabel])

  const autoFormatY = useMemo(() => {
    if (formatY) return formatY
    const lowerLabel = yLabel.toLowerCase()
    if (
      lowerLabel.includes('amount') ||
      lowerLabel.includes('revenue') ||
      lowerLabel.includes('cost')
    ) {
      return (val: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          notation: 'compact',
        }).format(val)
      }
    }
    return (val: number) => val.toLocaleString()
  }, [formatY, yLabel, currency])

  // Group data by category for coloring
  const { groupedData, categories, colorMap } = useMemo(() => {
    if (!colorByCategory) {
      return {
        groupedData: { default: data },
        categories: ['default'],
        colorMap: { default: '#3b82f6' },
      }
    }

    const groups: Record<string, ScatterDataPoint[]> = {}
    const cats = new Set<string>()

    data.forEach((point) => {
      const category = point.category || 'Other'
      cats.add(category)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(point)
    })

    // Assign colors to categories
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ]

    const colorMapping: Record<string, string> = {}
    Array.from(cats).forEach((cat, i) => {
      colorMapping[cat] = colors[i % colors.length]
    })

    return {
      groupedData: groups,
      categories: Array.from(cats),
      colorMap: colorMapping,
    }
  }, [data, colorByCategory])

  const option = useMemo(() => {
    return getScatterOption(
      data,
      xLabel,
      yLabel,
      zLabel,
      showTrendLine,
      autoFormatX,
      autoFormatY,
      textColor,
      tooltipBg,
      tooltipBorder,
      tooltipText,
      title,
      colorByCategory,
      bubbleChart,
      groupedData,
      categories,
      colorMap
    )
  }, [
    data,
    xLabel,
    yLabel,
    zLabel,
    showTrendLine,
    autoFormatX,
    autoFormatY,
    textColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    title,
    colorByCategory,
    bubbleChart,
    groupedData,
    categories,
    colorMap,
  ])

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (data.length === 0) return null
    return {
      dataPoints: data.length,
      categories: categories.length,
      correlation: showTrendLine ? 'Linear' : 'N/A',
    }
  }, [data.length, categories.length, showTrendLine])

  return (
    <div className={cn('w-full', className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold theme-text-primary">{title}</h3>}
          {subtitle && <p className="text-sm theme-text-secondary mt-1">{subtitle}</p>}
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={canvasHighDpiOpts}
        notMerge={true}
        lazyUpdate={true}
      />

      {stats && (
        <div className="grid grid-cols-3 gap-4 mt-4 pt-3 border-t border-amber-500/10">
          <div className="text-center">
            <div className="text-xs theme-text-secondary mb-1">Data Points</div>
            <div className="text-sm font-bold theme-text-primary">{stats.dataPoints}</div>
          </div>
          <div className="text-center">
            <div className="text-xs theme-text-secondary mb-1">Categories</div>
            <div className="text-sm font-bold theme-text-primary">{stats.categories}</div>
          </div>
          <div className="text-center">
            <div className="text-xs theme-text-secondary mb-1">Correlation</div>
            <div className="text-sm font-bold theme-text-primary">{stats.correlation}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Scatter chart configuration helper
function getScatterOption(
  data: ScatterDataPoint[],
  xLabel: string,
  yLabel: string,
  zLabel: string,
  showTrendLine: boolean,
  formatX: (value: number) => string,
  formatY: (value: number) => string,
  textColor: string,
  tooltipBg: string,
  tooltipBorder: string,
  tooltipText: string,
  title?: string,
  colorByCategory?: boolean,
  bubbleChart?: boolean,
  groupedData?: Record<string, ScatterDataPoint[]>,
  categories?: string[],
  colorMap?: Record<string, string>
) {
  // Handle empty data
  if (!data.length) {
    return {
      backgroundColor: 'transparent',
      title: {
        text: 'No data available',
        textStyle: { color: textColor },
      },
      xAxis: { type: 'value' },
      yAxis: { type: 'value' },
      series: [],
    }
  }

  // Calculate axis domains with padding
  const xValues = data.map((p) => p.x)
  const yValues = data.map((p) => p.y)
  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)
  const xPadding = (xMax - xMin) * 0.1 || 1
  const yPadding = (yMax - yMin) * 0.1 || 1

  // Calculate z domain for bubble chart
  let zMin = 0
  let zMax = 0
  if (bubbleChart) {
    const zValues = data.map((p) => p.z || 0)
    zMin = Math.min(...zValues)
    zMax = Math.max(...zValues)
  }

  // Build series array
  const series: any[] = []

  if (colorByCategory && groupedData && categories && colorMap) {
    // Create a series for each category
    categories.forEach((category) => {
      const categoryData = groupedData[category] || []
      const scatterData = categoryData.map((point) => {
        const value: any = [point.x, point.y]
        if (bubbleChart && point.z !== undefined) {
          value.push(point.z)
        }
        return {
          value,
          name: point.name || point.label || '',
          category: point.category,
          metadata: point.metadata,
          itemStyle: point.color ? { color: point.color } : undefined,
        }
      })

      series.push({
        name: category,
        type: 'scatter',
        data: scatterData,
        symbolSize: bubbleChart
          ? (dataItem: any) => {
              const z = dataItem[2] || 0
              if (zMax === zMin) return 10
              // Scale bubble size between 5 and 30
              return 5 + ((z - zMin) / (zMax - zMin)) * 25
            }
          : 8,
        itemStyle: {
          color: colorMap[category],
          opacity: 0.7,
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
            borderColor: colorMap[category],
            borderWidth: 2,
          },
        },
      })
    })
  } else {
    // Single series without category grouping
    const scatterData = data.map((point) => {
      const value: any = [point.x, point.y]
      if (bubbleChart && point.z !== undefined) {
        value.push(point.z)
      }
      return {
        value,
        name: point.name || point.label || '',
        category: point.category,
        metadata: point.metadata,
        itemStyle: point.color ? { color: point.color } : undefined,
      }
    })

    series.push({
      type: 'scatter',
      data: scatterData,
      symbolSize: bubbleChart
        ? (dataItem: any) => {
            const z = dataItem[2] || 0
            if (zMax === zMin) return 10
            // Scale bubble size between 5 and 30
            return 5 + ((z - zMin) / (zMax - zMin)) * 25
          }
        : 8,
      itemStyle: {
        color: '#3b82f6',
        opacity: 0.7,
      },
      emphasis: {
        itemStyle: {
          opacity: 1,
          borderColor: '#60a5fa',
          borderWidth: 2,
        },
      },
    })
  }

  // Calculate trend line if needed
  if (showTrendLine && data.length >= 2) {
    const n = data.length
    const sumX = data.reduce((sum, p) => sum + p.x, 0)
    const sumY = data.reduce((sum, p) => sum + p.y, 0)
    const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0)
    const sumX2 = data.reduce((sum, p) => sum + p.x * p.x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    const minX = Math.min(...data.map((p) => p.x))
    const maxX = Math.max(...data.map((p) => p.x))

    const trendLineData = [
      [minX, slope * minX + intercept],
      [maxX, slope * maxX + intercept],
    ]

    series.push({
      type: 'line',
      data: trendLineData,
      lineStyle: {
        color: '#6b7280',
        width: 2,
        type: 'dashed',
      },
      symbol: 'none',
      silent: true,
      animation: false,
    })
  }

  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          left: 'center',
          top: 0,
          textStyle: {
            color: textColor,
            fontSize: 16,
            fontWeight: 500,
          },
        }
      : undefined,
    legend:
      colorByCategory && categories && categories.length > 1
        ? {
            top: title ? 30 : 10,
            left: 'center',
            textStyle: {
              color: textColor,
              fontSize: 12,
            },
          }
        : undefined,
    tooltip: {
      backgroundColor: tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: tooltipText },
      trigger: 'item',
      formatter: (params: any) => {
        if (params.componentSubType === 'line') return '' // Hide tooltip for trend line

        const dataItem = params.data
        const [x, y, z] = params.value
        const name = dataItem.name
        const category = dataItem.category
        const metadata = dataItem.metadata

        let html = ''
        if (name) {
          html += `<div style="font-weight: 600; margin-bottom: 8px;">${name}</div>`
        }
        html += `<div style="font-size: 12px;">`
        html += `${xLabel}: <strong>${formatX(x)}</strong><br/>`
        html += `${yLabel}: <strong>${formatY(y)}</strong>`

        if (bubbleChart && z !== undefined) {
          html += `<br/>${zLabel}: <strong>${z.toLocaleString()}</strong>`
        }

        if (category) {
          html += `<br/>Category: <strong>${category}</strong>`
        }

        if (metadata) {
          Object.entries(metadata).forEach(([key, value]) => {
            html += `<br/>${key}: <strong>${value}</strong>`
          })
        }

        html += `</div>`
        return html
      },
    },
    grid: {
      left: '10%',
      right: '5%',
      bottom: '15%',
      top: title ? (colorByCategory && categories && categories.length > 1 ? '20%' : '15%') : '10%',
      containLabel: false,
    },
    xAxis: {
      type: 'value',
      name: xLabel,
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        color: textColor,
        fontSize: 12,
      },
      min: xMin - xPadding,
      max: xMax + xPadding,
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: formatX,
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
    },
    yAxis: {
      type: 'value',
      name: yLabel,
      nameLocation: 'middle',
      nameGap: 50,
      nameTextStyle: {
        color: textColor,
        fontSize: 12,
      },
      min: yMin - yPadding,
      max: yMax + yPadding,
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: formatY,
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
    },
    series,
  }
}
