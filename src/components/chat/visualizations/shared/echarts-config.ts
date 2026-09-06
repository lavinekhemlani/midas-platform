/**
 * @module echarts-config
 * @description Shared ECharts configuration for consistent styling
 * Defines tooltip, axis, and grid styles used across all chart types
 * Matches the styling from /visualizations page
 */

import { formatCompactNumber } from '@/lib/chat/visualizationBlocks'

/**
 * High-quality rendering options for ECharts
 * Uses devicePixelRatio for crisp rendering on Retina/HiDPI displays
 *
 * @param preferSvg - Use SVG renderer (resolution-independent, better for <1000 data points)
 * @returns ECharts init options object
 */
export function getHighQualityOpts(preferSvg = false) {
  return {
    renderer: preferSvg ? 'svg' : 'canvas',
    devicePixelRatio:
      preferSvg || typeof window === 'undefined'
        ? undefined
        : Math.max(window.devicePixelRatio || 1, 2),
  } as const
}

/**
 * Canvas renderer options with high DPI support
 * Use for charts with many data points or visual effects
 */
export const canvasHighDpiOpts = {
  renderer: 'canvas' as const,
  devicePixelRatio: typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2,
}

/**
 * SVG renderer options (resolution-independent)
 * Use for pie charts, simple charts, or when zoom quality matters
 */
export const svgOpts = {
  renderer: 'svg' as const,
}

/**
 * Dark theme tooltip styling
 * Semi-transparent dark background with light text
 */
export const tooltipStyle = {
  backgroundColor: 'rgba(30, 30, 35, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
  borderWidth: 1,
  borderRadius: 4,
  padding: [8, 12],
  textStyle: { color: '#f3f4f6', fontSize: 12 },
  extraCssText:
    'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);',
  confine: true, // Keep tooltip within chart container
  appendToBody: true, // Render tooltip to body to avoid overflow clipping
} as const

/**
 * Axis label styling
 * Muted gray text for readability on dark background
 */
export const axisLabelStyle = {
  color: '#9ca3af',
  fontSize: 11,
  fontFamily: 'DM Sans, sans-serif',
} as const

/**
 * Axis line styling
 * Subtle line color for visual separation
 */
export const axisLineStyle = {
  color: '#374151',
} as const

/**
 * Split line styling
 * Grid lines for value reference
 */
export const splitLineStyle = {
  color: 'rgba(255,255,255,0.1)',
} as const

/**
 * Base chart option that all charts extend
 *
 * @returns Base ECharts option object
 */
export function getBaseChartConfig() {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipStyle,
      trigger: 'item' as const,
    },
  }
}

/**
 * Standard grid configuration for charts with axes
 *
 * @param hasTitle - Whether chart has a title (adjusts top margin)
 * @param hasLegend - Whether chart has a bottom legend
 * @returns Grid configuration object
 */
export function getGridConfig(hasTitle = false, hasLegend = false) {
  return {
    left: '3%',
    right: '4%',
    bottom: hasLegend ? '15%' : '10%',
    top: hasTitle ? '15%' : '10%',
    containLabel: true,
  }
}

/**
 * Standard X axis configuration for category axis
 *
 * @param data - Category labels
 * @param rotate - Label rotation angle (for long labels)
 * @returns X axis configuration
 */
export function getCategoryXAxis(data: string[], rotate = 0) {
  // Auto-rotate labels if any label is long (>10 chars) and we have multiple items
  const hasLongLabels = data.some((label) => label.length > 10)
  const autoRotate = hasLongLabels && data.length > 3 ? -30 : rotate

  return {
    type: 'category' as const,
    data,
    axisLabel: {
      ...axisLabelStyle,
      rotate: autoRotate,
      interval: 0, // Show all labels, don't skip any
      width: 80,
      overflow: 'truncate',
      ellipsis: '...',
    },
    axisLine: { lineStyle: axisLineStyle },
  }
}

/**
 * Standard Y axis configuration for value axis
 *
 * @returns Y axis configuration
 */
export function getValueYAxis() {
  return {
    type: 'value' as const,
    axisLabel: {
      ...axisLabelStyle,
      formatter: (v: number) => formatCompactNumber(v),
    },
    splitLine: { lineStyle: splitLineStyle },
  }
}

/**
 * Standard title configuration - positioned with proper padding
 *
 * @param title - Title text
 * @param isLightTheme - Whether using light theme
 * @returns Title configuration or undefined if no title
 */
export function getTitleConfig(title: string | undefined, isLightTheme = false) {
  if (!title) return undefined

  return {
    text: title,
    left: 'center',
    top: 4,
    textStyle: {
      color: isLightTheme ? '#374151' : '#e5e7eb',
      fontSize: 13,
      fontWeight: 500,
    },
  }
}

/**
 * Standard legend configuration - adapts layout based on item count
 * - <=3 items: vertical column on right
 * - 4-9 items: 3-column grid on right
 * - >9 items: hidden, tooltip only
 *
 * @param show - Whether to show the legend
 * @param isLightTheme - Whether using light theme
 * @param itemCount - Number of legend items (for layout decisions)
 * @returns Legend configuration or undefined if hidden
 */
export function getLegendConfig(show: boolean, isLightTheme = false, itemCount = 0) {
  if (!show) return undefined

  const textStyle = {
    color: isLightTheme ? 'rgba(55, 65, 81, 0.8)' : 'rgba(156, 163, 175, 0.8)',
    fontSize: 11,
  }

  // More than 9 items: hide legend, rely on tooltip
  if (itemCount > 9) {
    return undefined
  }

  // 3 or fewer items: vertical column
  if (itemCount <= 3) {
    return {
      top: 0,
      right: 0,
      orient: 'vertical' as const,
      textStyle,
      itemGap: 6,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    }
  }

  // 4-9 items: 3-column grid layout
  return {
    top: 0,
    right: 0,
    orient: 'horizontal' as const,
    textStyle,
    itemGap: 6,
    itemWidth: 8,
    itemHeight: 8,
    icon: 'circle',
    width: 200,
    padding: [0, 0, 0, 0],
    formatter: (name: string) => {
      const maxLen = 9
      return name.length > maxLen ? name.slice(0, maxLen) + '…' : name
    },
  }
}

/**
 * Pie/Donut chart legend configuration - horizontal at bottom
 * Better visibility and click interaction for pie charts
 *
 * @param show - Whether to show the legend
 * @param isLightTheme - Whether using light theme
 * @param itemCount - Number of legend items (for layout decisions)
 * @returns Legend configuration or undefined if hidden
 */
export function getPieLegendConfig(show: boolean, isLightTheme = false, itemCount = 0) {
  if (!show) return undefined

  const textStyle = {
    color: isLightTheme ? 'rgba(55, 65, 81, 0.9)' : 'rgba(156, 163, 175, 0.9)',
    fontSize: 12,
  }

  // More than 12 items: scrollable legend
  if (itemCount > 12) {
    return {
      type: 'scroll' as const,
      bottom: 0,
      left: 'center',
      orient: 'horizontal' as const,
      textStyle,
      itemGap: 16,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      pageButtonItemGap: 5,
      pageButtonGap: 10,
      pageIconColor: isLightTheme ? '#374151' : '#9ca3af',
      pageIconInactiveColor: isLightTheme ? '#d1d5db' : '#4b5563',
      pageTextStyle: {
        color: isLightTheme ? '#374151' : '#9ca3af',
      },
    }
  }

  // All items: horizontal row at bottom, centered
  return {
    bottom: 0,
    left: 'center',
    orient: 'horizontal' as const,
    textStyle,
    itemGap: 16,
    icon: 'circle',
    itemWidth: 10,
    itemHeight: 10,
  }
}
