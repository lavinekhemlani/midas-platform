/**
 * @component Sankey
 * @description Sankey diagram for flow/relationship visualization
 */

'use client'

import { memo, useMemo } from 'react'

import { cn } from '@/lib/utils'
import {
  colorPalette,
  useThemeEChartsConfig,
  formatCompactCurrency,
  getTitleConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '../../shared'
import { EmptyState } from '../../shared/EmptyState'
import type { ChartBlock } from '../../shared/types'

interface SankeyNode {
  name: string
}

interface SankeyLink {
  source: string | number
  target: string | number
  value: number
}

interface SankeyBlock extends ChartBlock {
  sankeyData?: {
    nodes: SankeyNode[]
    links: SankeyLink[]
  }
}

export interface SankeyChartProps {
  block: ChartBlock
  className?: string
}

/**
 * Removes cyclic links from sankey data to ensure valid DAG structure
 * Uses DFS to detect and remove links that would create cycles
 */
function removeCyclicLinks(nodes: SankeyNode[], links: SankeyLink[]): SankeyLink[] {
  // Build node name to index map
  const nodeIndexMap = new Map<string | number, number>()
  nodes.forEach((node, idx) => {
    nodeIndexMap.set(node.name, idx)
    nodeIndexMap.set(idx, idx)
  })

  // Build adjacency list
  const adjList = new Map<number, Set<number>>()
  nodes.forEach((_, idx) => adjList.set(idx, new Set()))

  const validLinks: SankeyLink[] = []

  for (const link of links) {
    const sourceIdx = typeof link.source === 'number' ? link.source : nodeIndexMap.get(link.source)
    const targetIdx = typeof link.target === 'number' ? link.target : nodeIndexMap.get(link.target)

    if (sourceIdx === undefined || targetIdx === undefined) continue
    if (sourceIdx === targetIdx) continue // Self-loop

    // Check if adding this edge would create a cycle (target can reach source)
    const visited = new Set<number>()
    const canReach = (from: number, to: number): boolean => {
      if (from === to) return true
      if (visited.has(from)) return false
      visited.add(from)
      for (const next of adjList.get(from) || []) {
        if (canReach(next, to)) return true
      }
      return false
    }

    // If target can already reach source, adding source→target creates a cycle
    if (!canReach(targetIdx, sourceIdx)) {
      adjList.get(sourceIdx)?.add(targetIdx)
      validLinks.push(link)
    }
  }

  return validLinks
}

export const SankeyChart = memo(function SankeyChart({ block, className }: SankeyChartProps) {
  const { title, currency: blockCurrency } = block
  const currencyCode = blockCurrency || 'USD'
  const sankeyBlock = block as SankeyBlock
  const rawSankeyData = sankeyBlock.sankeyData || { nodes: [], links: [] }
  const { tooltipStyle, isLightTheme } = useThemeEChartsConfig()

  // Process sankey data: remove cycles and validate
  const sankeyData = useMemo(() => {
    if (!rawSankeyData.nodes?.length || !rawSankeyData.links?.length) {
      return { nodes: [], links: [] }
    }
    const validLinks = removeCyclicLinks(rawSankeyData.nodes, rawSankeyData.links)
    return { nodes: rawSankeyData.nodes, links: validLinks }
  }, [rawSankeyData])

  const option = useMemo(() => {
    if (!sankeyData.nodes?.length || !sankeyData.links?.length) return null

    // Calculate minimum value threshold (2% of max) to ensure small nodes are visible
    const maxValue = Math.max(...sankeyData.links.map((l) => Math.abs(l.value)))
    const minValue = maxValue * 0.02

    // Build node depth map (how many levels from the start)
    const nodeDepth = new Map<string, number>()
    const sourceNodes = new Set(sankeyData.links.map((l) => l.source))
    const targetNodes = new Set(sankeyData.links.map((l) => l.target))

    // Root nodes are sources that are never targets
    const rootNodes = [...sourceNodes].filter((n) => !targetNodes.has(n))
    rootNodes.forEach((n) => nodeDepth.set(n, 0))

    // BFS to assign depths
    let currentDepth = 0
    let currentLevel = rootNodes
    while (currentLevel.length > 0) {
      const nextLevel: string[] = []
      for (const node of currentLevel) {
        sankeyData.links
          .filter((l) => l.source === node)
          .forEach((l) => {
            if (!nodeDepth.has(l.target)) {
              nodeDepth.set(l.target, currentDepth + 1)
              nextLevel.push(l.target)
            }
          })
      }
      currentLevel = nextLevel
      currentDepth++
    }

    // Group nodes by depth
    const nodesByDepth = new Map<number, string[]>()
    const maxDepth = Math.max(...nodeDepth.values(), 0)
    for (let d = 0; d <= maxDepth; d++) {
      nodesByDepth.set(d, [])
    }
    nodeDepth.forEach((depth, name) => {
      nodesByDepth.get(depth)?.push(name)
    })

    // Sort each depth level using barycenter method (position based on parent positions)
    const nodePosition = new Map<string, number>()

    // First level: sort by outgoing value descending (largest at top)
    const level0 = nodesByDepth.get(0) || []
    level0.sort((a, b) => {
      const valA = sankeyData.links
        .filter((l) => l.source === a)
        .reduce((sum, l) => sum + Math.abs(l.value), 0)
      const valB = sankeyData.links
        .filter((l) => l.source === b)
        .reduce((sum, l) => sum + Math.abs(l.value), 0)
      return valB - valA
    })
    level0.forEach((name, idx) => nodePosition.set(name, idx))

    // Subsequent levels: sort by weighted barycenter (position × link value)
    for (let d = 1; d <= maxDepth; d++) {
      const levelNodes = nodesByDepth.get(d) || []
      levelNodes.sort((a, b) => {
        // Find parent links and calculate weighted average parent position
        const parentsA = sankeyData.links.filter((l) => l.target === a)
        const parentsB = sankeyData.links.filter((l) => l.target === b)
        const totalWeightA = parentsA.reduce((sum, l) => sum + Math.abs(l.value), 0)
        const totalWeightB = parentsB.reduce((sum, l) => sum + Math.abs(l.value), 0)
        const avgPosA =
          totalWeightA > 0
            ? parentsA.reduce(
                (sum, l) => sum + (nodePosition.get(l.source) ?? 0) * Math.abs(l.value),
                0
              ) / totalWeightA
            : 0
        const avgPosB =
          totalWeightB > 0
            ? parentsB.reduce(
                (sum, l) => sum + (nodePosition.get(l.source) ?? 0) * Math.abs(l.value),
                0
              ) / totalWeightB
            : 0
        return avgPosA - avgPosB
      })
      levelNodes.forEach((name, idx) => nodePosition.set(name, idx))
    }

    // Build final sorted nodes array
    const sortedNodes: SankeyNode[] = []
    for (let d = 0; d <= maxDepth; d++) {
      const levelNodes = nodesByDepth.get(d) || []
      levelNodes.forEach((name) => {
        const node = sankeyData.nodes.find((n) => n.name === name)
        if (node) sortedNodes.push(node)
      })
    }

    // Create node position index for link sorting
    const nodeIndex = new Map(sortedNodes.map((n, i) => [n.name, i]))

    // Sort links: by source depth, then source position, then target position
    const sortedLinks = [...sankeyData.links].sort((a, b) => {
      // First sort by source depth
      const srcDepthA = nodeDepth.get(a.source) ?? 0
      const srcDepthB = nodeDepth.get(b.source) ?? 0
      if (srcDepthA !== srcDepthB) return srcDepthA - srcDepthB
      // Then by source's position within its level
      const srcPosA = nodePosition.get(a.source) ?? 0
      const srcPosB = nodePosition.get(b.source) ?? 0
      if (srcPosA !== srcPosB) return srcPosA - srcPosB
      // Finally by target's position within its level
      const tgtPosA = nodePosition.get(a.target) ?? 0
      const tgtPosB = nodePosition.get(b.target) ?? 0
      return tgtPosA - tgtPosB
    })

    // Apply minimum value to links for visibility while preserving original for tooltip
    const linksWithMinHeight = sortedLinks.map((link) => ({
      ...link,
      value: Math.max(Math.abs(link.value), minValue),
      originalValue: link.value,
    }))

    return {
      backgroundColor: 'transparent',
      title: getTitleConfig(title, isLightTheme),
      tooltip: {
        ...tooltipStyle,
        trigger: 'item' as const,
        formatter: (params: {
          dataType?: string
          data?: SankeyLink & { originalValue?: number }
          name?: string
        }) => {
          if (params.dataType === 'edge' && params.data) {
            const displayValue = params.data.originalValue ?? params.data.value
            return `${params.data.source} → ${params.data.target}<br/>${formatCompactCurrency(displayValue, currencyCode)}`
          }
          return `<strong>${params.name || ''}</strong>`
        },
      },
      color: colorPalette,
      series: [
        {
          type: 'sankey',
          left: '5%',
          right: '15%',
          top: title ? '15%' : '10%',
          bottom: '10%',
          nodeWidth: 15,
          nodeGap: 14,
          layoutIterations: 64,
          nodeAlign: 'justify',
          emphasis: { focus: 'adjacency' },
          data: sortedNodes.map((node: SankeyNode, idx: number) => ({
            ...node,
            itemStyle: {
              color: colorPalette[idx % colorPalette.length],
              borderWidth: 0,
            },
          })),
          links: linksWithMinHeight,
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.4,
          },
          label: {
            color: isLightTheme ? '#6b7280' : '#9ca3af',
            fontSize: 11,
            fontWeight: 500,
          },
        },
      ],
    }
  }, [sankeyData, tooltipStyle, isLightTheme, title, currencyCode])

  if (!sankeyData.nodes?.length || !sankeyData.links?.length || !option) {
    return <EmptyState message="No flow data available for sankey diagram" />
  }

  // Dynamic height based on node count for better visibility
  const nodeCount = sankeyData.nodes.length
  const minHeight = Math.max(400, nodeCount * 28)

  return (
    <div
      className={cn('my-4 p-4 glass-luxury-card rounded-xl', className)}
      data-chart-type="sankey"
    >
      <div style={{ height: minHeight, width: '100%' }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={canvasHighDpiOpts}
        />
      </div>
    </div>
  )
})

SankeyChart.displayName = 'SankeyChart'
