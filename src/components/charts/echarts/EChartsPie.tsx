'use client'

import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useChartThemeColors } from '../useChartThemeColors'

export interface EChartsPieDataItem {
  name: string
  value: number
  color?: string
  items?: EChartsPieDataItem[] // For grouped items
  percentage?: string // Added during processing
  [key: string]: any // Allow additional custom properties
}

export interface EChartsPieProps {
  data: EChartsPieDataItem[]
  height?: number
  innerRadius?: number | string // for donut
  outerRadius?: number | string
  showLabels?: boolean
  showLegend?: boolean
  showCenterTotal?: boolean // show total value in center of donut
  legendPosition?: 'top' | 'bottom' | 'left' | 'right'
  formatValue?: (value: number) => string
  groupSmallValues?: number // threshold to group into "Others"
  className?: string
  title?: string
  centerLabel?: string
  // Advanced styling options
  paddingAngle?: number
  startAngle?: number
  colors?: string[]
  enableEmphasis?: boolean
  enableAnimation?: boolean
  borderRadius?: number
}

const DEFAULT_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
]

export function EChartsPie({
  data,
  height = 350,
  innerRadius = '0%',
  outerRadius = '70%',
  showLabels = true,
  showLegend = true,
  showCenterTotal = true,
  legendPosition = 'bottom',
  formatValue = (val) => val.toLocaleString(),
  groupSmallValues,
  className,
  title,
  centerLabel,
  paddingAngle = 0,
  startAngle = 90,
  colors = DEFAULT_COLORS,
  enableEmphasis = true,
  enableAnimation = true,
  borderRadius: borderRadiusProp = 0,
}: EChartsPieProps) {
  // Get theme-reactive colors
  const { textColor, tooltipBg, tooltipText } = useChartThemeColors()

  // Process data: group small values if threshold is set
  const processedData = useMemo(() => {
    if (!groupSmallValues || groupSmallValues <= 0) {
      return data
    }

    // Calculate total
    const total = data.reduce((sum, item) => sum + item.value, 0)

    // Separate items above and below threshold
    const mainItems: EChartsPieDataItem[] = []
    const smallItems: EChartsPieDataItem[] = []

    data.forEach((item) => {
      const percentage = (item.value / total) * 100
      if (percentage >= groupSmallValues) {
        mainItems.push(item)
      } else {
        smallItems.push(item)
      }
    })

    // If there are small items, group them
    if (smallItems.length > 0) {
      const othersValue = smallItems.reduce((sum, item) => sum + item.value, 0)
      mainItems.push({
        name: 'Others',
        value: othersValue,
        color: colors[mainItems.length % colors.length],
        items: smallItems, // Store grouped items for tooltip
      })
    }

    return mainItems
  }, [data, groupSmallValues, colors])

  // Calculate total
  const total = useMemo(() => {
    return processedData.reduce((sum, item) => sum + item.value, 0)
  }, [processedData])

  // Format total for center display
  const formattedTotal = useMemo(() => {
    if (Math.abs(total) >= 1000000) return `$${(total / 1000000).toFixed(1)}M`
    if (Math.abs(total) >= 1000) return `$${(total / 1000).toFixed(1)}K`
    return `$${total.toLocaleString()}`
  }, [total])

  // Calculate percentages
  const dataWithPercentages = useMemo(() => {
    return processedData.map((item) => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1),
    }))
  }, [processedData, total])

  const option = useMemo(() => {
    // Determine if light theme for border color
    const isLight = tooltipBg.includes('255, 255, 255')
    const borderColor = isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: tooltipBg,
        borderColor: borderColor,
        borderWidth: 1,
        borderRadius: 12,
        padding: [12, 16],
        textStyle: {
          color: tooltipText,
          fontSize: 12,
        },
        formatter: (params: any) => {
          const { name, value, data, marker } = params
          const percentage = data.percentage || '0'

          // If this is an "Others" group, show breakdown
          if (data.items && Array.isArray(data.items)) {
            let content = `<div style="font-weight:600;margin-bottom:8px;color:${tooltipText}">${name}</div>`
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="display:flex;align-items:center;gap:6px">
                  ${marker}
                  <span style="color:${textColor}">Total</span>
                </span>
                <span style="font-family:monospace;color:${tooltipText}">
                  ${formatValue(value)}
                </span>
              </div>
            `
            content += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                <span style="color:${textColor}">Percentage</span>
                <span style="font-family:monospace;color:${tooltipText}">
                  ${percentage}%
                </span>
              </div>
            `
            content += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid ${borderColor}">`
            data.items.forEach((item: EChartsPieDataItem) => {
              const itemTotal = processedData.reduce((sum, d) => sum + d.value, 0)
              const itemPercentage = ((item.value / itemTotal) * 100).toFixed(1)
              content += `
                <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
                  <span style="color:${textColor}">${item.name}</span>
                  <span style="font-family:monospace;color:${tooltipText}">
                    ${formatValue(item.value)} (${itemPercentage}%)
                  </span>
                </div>
              `
            })
            content += `</div>`
            return content
          }

          let content = `<div style="font-weight:600;margin-bottom:8px;color:${tooltipText}">${name}</div>`
          content += `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
              <span style="display:flex;align-items:center;gap:6px">
                ${marker}
                <span style="color:${textColor}">Value</span>
              </span>
              <span style="font-family:monospace;color:${tooltipText}">
                ${formatValue(value)}
              </span>
            </div>
          `
          content += `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:3px 0">
              <span style="color:${textColor}">Percentage</span>
              <span style="font-family:monospace;color:${tooltipText}">
                ${percentage}%
              </span>
            </div>
          `
          return content
        },
      },
      legend: showLegend
        ? {
            type: dataWithPercentages.length > 10 ? 'scroll' : 'plain',
            orient: 'horizontal',
            bottom: 0,
            left: 'center',
            textStyle: {
              color: textColor,
              fontSize: 12,
            },
            formatter: (name: string) => {
              return name
            },
            tooltip: {
              show: true,
              formatter: (params: { name: string }) => {
                const item = dataWithPercentages.find((d) => d.name === params.name)
                if (!item) return params.name
                return `${params.name}: ${formatValue(item.value)} (${item.percentage}%)`
              },
            },
            itemGap: 16,
            itemWidth: 12,
            itemHeight: 12,
            pageButtonItemGap: 5,
            pageButtonGap: 10,
            pageIconColor: textColor,
            pageIconInactiveColor: 'rgba(128, 128, 128, 0.5)',
            pageTextStyle: {
              color: textColor,
            },
          }
        : undefined,
      series: [
        {
          type: 'pie',
          radius: [innerRadius, outerRadius],
          center: ['50%', '45%'], // Shifted up to accommodate bottom legend
          startAngle: startAngle,
          padAngle: paddingAngle,
          data: dataWithPercentages.map((item, index) => ({
            name: item.name,
            value: item.value,
            percentage: item.percentage,
            items: item.items,
            itemStyle: {
              color: item.color || colors[index % colors.length],
              borderRadius: borderRadiusProp,
              borderColor: 'transparent',
              borderWidth: 1,
            },
          })),
          label: showLabels
            ? {
                show: true,
                formatter: '{b}',
                color: textColor,
                fontSize: 11,
                textBorderColor: 'transparent',
                textBorderWidth: 0,
              }
            : {
                show: false,
              },
          labelLine: showLabels
            ? {
                show: true,
                length: 15,
                length2: 10,
                lineStyle: {
                  color: textColor,
                  opacity: 0.3,
                },
              }
            : {
                show: false,
              },
          emphasis: enableEmphasis
            ? {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)',
                },
                label: {
                  show: false,
                },
                scaleSize: 4,
              }
            : undefined,
          animationType: enableAnimation ? 'expansion' : undefined,
          animationEasing: 'cubicOut',
          animationDuration: 1000,
        },
      ],
      // Center total amount for donut charts (when innerRadius > 0 and showCenterTotal is true)
      graphic:
        showCenterTotal && innerRadius !== '0%' && innerRadius !== 0
          ? {
              type: 'text',
              left: 'center',
              top: '45%', // Match chart center position
              style: {
                text: formattedTotal,
                fontSize: 20,
                fontWeight: 'bold',
                fill: colors[0],
                textAlign: 'center',
              },
            }
          : undefined,
    }
  }, [
    textColor,
    tooltipBg,
    tooltipText,
    showLegend,
    showCenterTotal,
    legendPosition,
    dataWithPercentages,
    innerRadius,
    outerRadius,
    startAngle,
    paddingAngle,
    showLabels,
    enableEmphasis,
    enableAnimation,
    colors,
    formatValue,
    processedData,
    formattedTotal,
  ])

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts option={option} style={{ height }} opts={{ renderer: 'svg' }} />
      {(title || centerLabel) && (
        <p className="text-sm font-semibold text-center mt-2" style={{ color: textColor }}>
          {centerLabel || title}
        </p>
      )}
    </div>
  )
}
