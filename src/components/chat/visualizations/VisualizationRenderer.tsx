/**
 * @component VisualizationRenderer
 * @description Main router for all visualization blocks
 * Routes to appropriate renderer based on block type
 *
 * This is the public API entry point - maintains backward compatibility
 * with the original monolithic implementation
 */

'use client'

import { memo } from 'react'
import { aiDebug } from '@/lib/debug'
import type { VisualizationBlock, ChartBlock } from './shared/types'
import { VisualizationErrorBoundary } from '@/components/error'

// Import renderers
import { ChartRenderer } from './charts'
import {
  KPIRenderer,
  MetricRenderer,
  ComparisonRenderer,
  ProgressRenderer,
  TimelineRenderer,
} from './components'

export interface VisualizationRendererProps {
  block: VisualizationBlock
  className?: string
}

/**
 * Main visualization renderer
 * Routes blocks to appropriate component based on type
 */
export const VisualizationRenderer = memo(function VisualizationRenderer({
  block,
  className,
}: VisualizationRendererProps) {
  // Debug logging via centralized logger
  aiDebug.renderer.received({ type: block?.type || 'undefined', block })

  if (!block || !block.type) {
    aiDebug.renderer.unknownType({ type: 'undefined', block })
    return null
  }

  // Wrap all renderers in error boundary to prevent visualization crashes from affecting chat
  const chartType = block.type === 'chart' ? (block as ChartBlock).chartType : block.type

  switch (block.type) {
    case 'chart':
      aiDebug.renderer.rendering({ type: 'chart', chartType: (block as ChartBlock).chartType })
      return (
        <VisualizationErrorBoundary chartType={chartType}>
          <ChartRenderer block={block as ChartBlock} className={className} />
        </VisualizationErrorBoundary>
      )

    case 'kpi':
      aiDebug.renderer.rendering({ type: 'kpi' })
      return (
        <VisualizationErrorBoundary chartType="kpi">
          <KPIRenderer block={block} className={className} />
        </VisualizationErrorBoundary>
      )

    case 'metric':
      aiDebug.renderer.rendering({ type: 'metric' })
      return (
        <VisualizationErrorBoundary chartType="metric">
          <MetricRenderer block={block} className={className} />
        </VisualizationErrorBoundary>
      )

    case 'comparison':
      aiDebug.renderer.rendering({ type: 'comparison' })
      return (
        <VisualizationErrorBoundary chartType="comparison">
          <ComparisonRenderer block={block} className={className} />
        </VisualizationErrorBoundary>
      )

    case 'progress':
      aiDebug.renderer.rendering({ type: 'progress' })
      return (
        <VisualizationErrorBoundary chartType="progress">
          <ProgressRenderer block={block} className={className} />
        </VisualizationErrorBoundary>
      )

    case 'timeline':
      aiDebug.renderer.rendering({ type: 'timeline' })
      return (
        <VisualizationErrorBoundary chartType="timeline">
          <TimelineRenderer block={block} className={className} />
        </VisualizationErrorBoundary>
      )

    default:
      aiDebug.renderer.unknownType({ type: (block as any).type, block })
      return null
  }
})

VisualizationRenderer.displayName = 'VisualizationRenderer'
