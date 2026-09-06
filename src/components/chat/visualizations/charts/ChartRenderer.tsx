/**
 * @component ChartRenderer
 * @description Routes chart blocks to appropriate chart components
 * Central dispatcher for all ECharts-based visualizations
 */

'use client'

import { memo } from 'react'
import type { ChartBlock } from '../shared/types'
import { EmptyState } from '../shared/EmptyState'

// Simple charts
import { BarChart } from './bar'
import { LineChart, AreaChart } from './line'
import { PieChart, ScatterChart, RadarChart } from './pie'

// Financial charts
import { WaterfallChart } from './financial'

// Performance charts
import { BoxplotChart } from './performance'

// Advanced charts
import { TreemapChart, SankeyChart } from './advanced'

export interface ChartRendererProps {
  block: ChartBlock
  className?: string
}

/**
 * Routes chart blocks to the appropriate chart component
 * Maintains backward compatibility with monolithic implementation
 */
export const ChartRenderer = memo(function ChartRenderer({ block, className }: ChartRendererProps) {
  const { chartType } = block

  switch (chartType) {
    // Bar charts (unified - handles vertical, horizontal, stacked, diverging)
    case 'bar':
      return <BarChart block={block} className={className} />

    // Line charts (area handles both single and stacked multi-series)
    case 'line':
      return <LineChart block={block} className={className} />
    case 'area':
      return <AreaChart block={block} className={className} />

    // Pie charts
    case 'pie':
    case 'donut':
      return <PieChart block={block} className={className} />
    case 'scatter':
      return <ScatterChart block={block} className={className} />
    case 'radar':
      return <RadarChart block={block} className={className} />

    // Financial charts
    case 'waterfall':
      return <WaterfallChart block={block} className={className} />

    // Performance charts
    case 'boxplot':
      return <BoxplotChart block={block} className={className} />

    // Advanced charts
    case 'treemap':
      return <TreemapChart block={block} className={className} />
    case 'sankey':
      return <SankeyChart block={block} className={className} />

    default:
      return <EmptyState message={`Unknown chart type: ${chartType}`} />
  }
})

ChartRenderer.displayName = 'ChartRenderer'
