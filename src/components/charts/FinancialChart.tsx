'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from './useChartThemeColors'
import { canvasHighDpiOpts } from '@/components/chat/visualizations/shared'

export type FinancialChartType = 'waterfall' | 'diverging-bar' | 'horizontal-bar' | 'vertical-bar'

interface FinancialChartProps {
  type: FinancialChartType
  data: any[]
  height?: number
  className?: string
  formatValue?: (value: number) => string
  title?: string
  xKey?: string
  valueKey?: string
  color?: string // Default color for bars
}

// Symmetric log transformation functions for waterfall charts
const symlog = (value: number) => {
  const C = 10000 // Constant to control the transition point
  if (Math.abs(value) < C) {
    return value // Linear for small values
  }
  return Math.sign(value) * C * (1 + Math.log10(Math.abs(value) / C))
}

const symlogInverse = (value: number) => {
  const C = 10000
  if (Math.abs(value) < C) {
    return value
  }
  const sign = Math.sign(value)
  const absValue = Math.abs(value)
  return sign * C * Math.pow(10, absValue / C - 1)
}

export function FinancialChart({
  type,
  data,
  height = 350,
  className,
  formatValue = (val) => `$${val.toLocaleString()}`,
  title,
  xKey = 'name',
  valueKey = 'value',
  color,
}: FinancialChartProps) {
  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipBorder, tooltipText } = useChartThemeColors()

  const option = useMemo(() => {
    switch (type) {
      case 'waterfall':
        return getWaterfallOption(
          data,
          xKey,
          valueKey,
          formatValue,
          title,
          textColor,
          tooltipBg,
          tooltipBorder,
          tooltipText,
          color
        )
      case 'diverging-bar':
        return getDivergingBarOption(
          data,
          xKey,
          valueKey,
          formatValue,
          title,
          textColor,
          tooltipBg,
          tooltipBorder,
          tooltipText,
          color
        )
      case 'horizontal-bar':
        return getHorizontalBarOption(
          data,
          xKey,
          valueKey,
          formatValue,
          title,
          textColor,
          tooltipBg,
          tooltipBorder,
          tooltipText,
          color
        )
      case 'vertical-bar':
        return getVerticalBarOption(
          data,
          xKey,
          valueKey,
          formatValue,
          title,
          textColor,
          tooltipBg,
          tooltipBorder,
          tooltipText,
          color
        )
      default:
        return {}
    }
  }, [
    type,
    data,
    xKey,
    valueKey,
    formatValue,
    title,
    textColor,
    tooltipBg,
    tooltipBorder,
    tooltipText,
    color,
  ])

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={canvasHighDpiOpts}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  )
}

// Waterfall chart configuration - Horizontal layout
function getWaterfallOption(
  data: any[],
  xKey: string,
  valueKey: string,
  formatValue: (val: number) => string,
  title?: string,
  textColor: string = '#94a3b8',
  tooltipBg: string = 'rgba(17, 24, 39, 0.95)',
  tooltipBorder: string = 'rgba(75, 85, 99, 0.3)',
  tooltipText: string = '#e5e7eb',
  defaultColor?: string
) {
  // Include all data, including zero values
  const filteredData = data

  // If no data, return empty chart
  if (!filteredData.length) {
    return {
      backgroundColor: 'transparent',
      title: { text: 'No data available', textStyle: { color: '#9ca3af' } },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: [] },
      series: [],
    }
  }

  // Prepare data for horizontal waterfall using stacked bars
  let cumulative = 0
  const categories: string[] = []
  const helperData: number[] = [] // Invisible bars for positioning
  const positiveData: any[] = []
  const negativeData: any[] = []

  // Calculate min/max for axis range
  let minValue = 0
  let maxValue = 0
  let runningTotal = 0

  // First pass to calculate range - need to track both the running total AND individual negative values
  filteredData.forEach((item) => {
    const value = item[valueKey] || 0
    // For negative values, we need to consider their starting position
    if (value < 0) {
      minValue = Math.min(minValue, runningTotal + value, value)
    }
    runningTotal += value
    minValue = Math.min(minValue, runningTotal)
    maxValue = Math.max(maxValue, runningTotal)
  })

  // Also consider individual values for proper scaling
  filteredData.forEach((item) => {
    const value = item[valueKey] || 0
    if (value > 0) {
      maxValue = Math.max(maxValue, value)
    } else {
      minValue = Math.min(minValue, value)
    }
  })

  // Reset cumulative for building data arrays
  cumulative = 0

  // Build the data arrays
  filteredData.forEach((item, index) => {
    const value = item[valueKey] || 0
    const name = item[xKey] || 'Unknown'
    categories.push(name)

    if (value >= 0) {
      // Positive bar starts at cumulative and extends right
      helperData.push(cumulative)
      positiveData.push({
        value: value,
        actualValue: value,
        itemStyle: { color: '#10b981' },
      })
      negativeData.push(0)
    } else {
      // Negative bar starts at cumulative and extends left
      helperData.push(cumulative + value) // Helper positions at the end point (left side)
      positiveData.push(0)
      negativeData.push({
        value: Math.abs(value), // Stack adds this to helper position
        actualValue: value, // Store actual negative value for tooltip
        itemStyle: { color: '#ef4444' },
      })
    }

    cumulative += value
  })

  // Add total bar
  categories.push('Total')
  if (cumulative >= 0) {
    helperData.push(0)
    positiveData.push({
      value: cumulative,
      actualValue: cumulative,
      itemStyle: { color: '#3b82f6' },
    })
    negativeData.push(0)
  } else {
    helperData.push(cumulative)
    positiveData.push(0)
    negativeData.push({
      value: Math.abs(cumulative),
      actualValue: cumulative,
      itemStyle: { color: '#f59e0b' },
    })
  }

  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          textStyle: { color: '#9ca3af', fontSize: 14 },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params: any) {
        if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
          return 'No data'
        }
        const name = params[0].name
        const index = categories.indexOf(name)
        if (index === categories.length - 1) {
          // Total bar
          return `${name}<br/>${formatValue(cumulative)}`
        } else {
          const value = filteredData[index][valueKey]
          return `${name}<br/>${formatValue(value)}`
        }
      },
      backgroundColor: tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: tooltipText },
    },
    legend: {
      show: false,
    },
    grid: {
      left: 'clamp(3%, 1vw + 2%, 6%)',
      right: 'clamp(15%, 2vw + 12%, 22%)', // Responsive right spacing
      bottom: 'clamp(8%, 1vw + 6%, 14%)',
      top: title ? 'clamp(6%, 1vw + 4%, 10%)' : 'clamp(3%, 0.5vw + 2%, 6%)',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: minValue < 0 ? minValue * 1.3 : 0, // Add 30% padding for negative values
      max: maxValue > 0 ? maxValue * 1.1 : 0, // Add 10% padding for positive values
      axisLabel: {
        show: true, // Show x-axis labels
        color: '#9ca3af',
        fontSize: 'clamp(11px, 0.6vw + 9px, 14px)',
        formatter: (value: number) => {
          // Format large numbers for better display
          const absValue = Math.abs(value)
          if (absValue >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`
          } else if (absValue >= 1000) {
            return `${(value / 1000).toFixed(0)}K`
          } else if (absValue === 0) {
            return '0'
          }
          return value.toFixed(0)
        },
      },
      splitLine: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: '#374151',
          width: 2, // Thicker axis line
        },
      },
      axisPointer: {
        lineStyle: { color: '#6b7280' },
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: textColor,
        fontSize: 'clamp(11px, 0.6vw + 9px, 13px)',
      },
      axisLine: { lineStyle: { color: '#374151' } },
      inverse: true, // Show from top to bottom
    },
    series: [
      {
        name: 'Helper',
        type: 'bar',
        stack: 'Total',
        itemStyle: {
          borderColor: 'transparent',
          color: 'transparent',
        },
        emphasis: {
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent',
          },
        },
        data: helperData,
      },
      {
        name: 'Positive',
        type: 'bar',
        stack: 'Total',
        data: positiveData,
        label: {
          show: true,
          position: 'right',
          formatter: function (params: any) {
            if (params.value === 0) return ''
            const actualValue = params.data.actualValue || params.value
            return formatValue(actualValue)
          },
          color: textColor,
          fontSize: 'clamp(10px, 0.55vw + 8px, 12px)',
        },
      },
      {
        name: 'Negative',
        type: 'bar',
        stack: 'Total',
        data: negativeData,
        label: {
          show: true,
          position: 'left',
          formatter: function (params: any) {
            if (params.value === 0) return ''
            const actualValue = params.data.actualValue || -params.value
            return formatValue(actualValue)
          },
          color: textColor,
          fontSize: 'clamp(10px, 0.55vw + 8px, 12px)',
        },
      },
    ],
  }
}

// Diverging bar chart configuration
function getDivergingBarOption(
  data: any[],
  xKey: string,
  valueKey: string,
  formatValue: (val: number) => string,
  title?: string,
  textColor: string = '#94a3b8',
  tooltipBg: string = 'rgba(17, 24, 39, 0.95)',
  tooltipBorder: string = 'rgba(75, 85, 99, 0.3)',
  tooltipText: string = '#e5e7eb',
  defaultColor?: string
) {
  const chartData = data.map((item) => ({
    name: item[xKey],
    value: item[valueKey] || 0,
    itemStyle: {
      color: (item[valueKey] || 0) >= 0 ? '#10b981' : '#ef4444',
    },
  }))

  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          textStyle: { color: '#9ca3af', fontSize: 14 },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
          return 'No data'
        }
        const item = params[0]
        return `${item.name}<br/>${formatValue(item.value)}`
      },
      backgroundColor: tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: tooltipText },
    },
    grid: {
      left: '5%',
      right: '18%', // More space on right to prevent cutoff
      bottom: '5%', // More breathing room
      top: title ? '8%' : '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: function (value: any) {
        return value.min < 0 ? value.min * 1.15 : 0 // Add 15% padding
      },
      max: function (value: any) {
        return value.max * 1.15 // Add 15% padding
      },
      axisLabel: {
        show: false, // Hide x-axis labels
      },
      splitLine: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: '#374151',
          width: 2, // Thicker axis line
        },
      },
    },
    yAxis: {
      type: 'category',
      data: chartData.map((d) => d.name),
      axisLabel: {
        color: textColor,
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'bar',
        data: chartData,
        label: {
          show: true,
          position: (params: any) => (params.value >= 0 ? 'right' : 'left'),
          formatter: (params: any) => formatValue(params.value),
          color: textColor,
          fontSize: 10,
        },
      },
    ],
  }
}

// Horizontal bar chart configuration
function getHorizontalBarOption(
  data: any[],
  xKey: string,
  valueKey: string,
  formatValue: (val: number) => string,
  title?: string,
  textColor: string = '#94a3b8',
  tooltipBg: string = 'rgba(17, 24, 39, 0.95)',
  tooltipBorder: string = 'rgba(75, 85, 99, 0.3)',
  tooltipText: string = '#e5e7eb',
  defaultColor?: string // Color prop from component
) {
  const chartData = data.map((item) => {
    // Check if item has custom color property (for liabilities)
    const value = item[valueKey] || 0
    let color = defaultColor || '#10b981' // Use provided color or default green for positive

    if (item.color) {
      // Use custom color if provided (from API)
      color = item.color
    } else if (item.isNegative || value < 0) {
      // Red for negative values
      color = '#ef4444'
    } else if (item.type === 'liability') {
      // Amber for positive liabilities
      color = '#f59e0b'
    }

    return {
      name: item[xKey],
      value: value,
      itemStyle: { color },
    }
  })

  // Calculate the longest label to determine left margin
  const maxLabelLength = Math.max(...chartData.map((d) => (d.name || '').length), 10)
  // Estimate pixels needed: ~7px per character, capped at 180px
  const estimatedLabelWidth = Math.min(Math.max(maxLabelLength * 7, 80), 180)

  // Calculate longest formatted value for right margin
  const maxValueLength = Math.max(...chartData.map((d) => formatValue(d.value).length), 8)
  // Estimate right margin: ~8px per character + padding
  const estimatedRightMargin = Math.min(Math.max(maxValueLength * 8 + 20, 80), 140)

  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          textStyle: { color: '#9ca3af', fontSize: 14 },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
          return 'No data'
        }
        const item = params[0]
        return `${item.name}<br/>${formatValue(item.value)}`
      },
      backgroundColor: tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: tooltipText },
    },
    grid: {
      left: 10,
      right: estimatedRightMargin,
      bottom: 10,
      top: title ? 30 : 10,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      min: function (value: any) {
        return value.min < 0 ? value.min * 1.2 : 0 // Add 20% padding for negative values
      },
      max: function (value: any) {
        return value.max * 1.1 // Add 10% padding for positive values
      },
      axisLabel: {
        show: false, // Hide x-axis labels
      },
      splitLine: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: '#374151',
          width: 1,
        },
      },
    },
    yAxis: {
      type: 'category',
      data: chartData.map((d) => d.name),
      axisLabel: {
        color: textColor,
        fontSize: 11,
        width: estimatedLabelWidth,
        overflow: 'truncate',
        ellipsis: '...',
        interval: 0,
        margin: 8,
        align: 'right',
        formatter: function (value: string) {
          // Truncate long labels with ellipsis instead of wrapping
          const maxLen = Math.floor(estimatedLabelWidth / 7)
          if (value.length > maxLen) {
            return value.substring(0, maxLen - 2) + '...'
          }
          return value
        },
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#4b5563', width: 1 },
      },
      axisTick: {
        show: false,
      },
      splitLine: {
        show: false,
      },
      inverse: true,
    },
    series: [
      {
        type: 'bar',
        data: chartData,
        label: {
          show: true,
          position: 'right',
          formatter: (params: any) => formatValue(params.value),
          color: textColor,
          fontSize: 11,
          distance: 5,
        },
        barMaxWidth: 24,
        barMinHeight: 2,
        itemStyle: {
          borderRadius: [0, 2, 2, 0],
        },
      },
    ],
  }
}

// Vertical bar chart configuration
function getVerticalBarOption(
  data: any[],
  xKey: string,
  valueKey: string,
  formatValue: (val: number) => string,
  title?: string,
  textColor: string = '#94a3b8',
  tooltipBg: string = 'rgba(17, 24, 39, 0.95)',
  tooltipBorder: string = 'rgba(75, 85, 99, 0.3)',
  tooltipText: string = '#e5e7eb',
  defaultColor?: string
) {
  const chartData = data.map((item) => ({
    name: item[xKey],
    value: item[valueKey] || 0,
    itemStyle: {
      color: (item[valueKey] || 0) >= 0 ? '#10b981' : '#ef4444',
    },
  }))

  return {
    backgroundColor: 'transparent',
    title: title
      ? {
          text: title,
          textStyle: { color: '#9ca3af', fontSize: 14 },
        }
      : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!params || !Array.isArray(params) || params.length === 0 || !params[0]) {
          return 'No data'
        }
        const item = params[0]
        return `${item.name}<br/>${formatValue(item.value)}`
      },
      backgroundColor: tooltipBg,
      borderColor: 'transparent',
      borderWidth: 0,
      textStyle: { color: tooltipText },
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '15%',
      top: title ? '10%' : '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: chartData.map((d) => d.name),
      axisLabel: {
        rotate: 45,
        color: textColor,
        fontSize: 11,
      },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: formatValue,
        color: textColor,
        fontSize: 11,
      },
      splitLine: { lineStyle: { color: '#1f2937' } },
      axisLine: { lineStyle: { color: '#374151' } },
    },
    series: [
      {
        type: 'bar',
        data: chartData,
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => formatValue(params.value),
          color: textColor,
          fontSize: 10,
        },
        barMaxWidth: 50,
      },
    ],
  }
}
