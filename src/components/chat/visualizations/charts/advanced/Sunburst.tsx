'use client'

import { cn } from '@/lib/utils'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  canvasHighDpiOpts,
  formatCompactNumber,
  ReactECharts,
  useThemeEChartsConfig,
} from '../../shared'

// ============================================================================
// Types
// ============================================================================

export interface SunburstNode {
  name: string
  value: number
  children?: SunburstNode[]
  /** For "Others" aggregated nodes - details of individual items */
  othersDetails?: Array<{ name: string; value: number }>
}

export interface SunburstChartProps {
  /** Hierarchical data for the sunburst chart */
  data: SunburstNode
  /** Map of top-level category names to colors */
  colors?: Record<string, string>
  /** Maximum depth to allow expansion (undefined = unlimited) */
  maxDepth?: number
  /** Optional className for the container */
  className?: string
  /** Whether to show the center expand/collapse button */
  showCenterButton?: boolean
  /** Callback when a node is clicked */
  onNodeClick?: (nodeName: string, expanded: boolean) => void
  /** Inner radius percentage (default: 10) */
  innerRadius?: number
  /** Outer radius percentage (default: 95) */
  outerRadius?: number
  /** Callback when expanded state changes - receives isFullyExpanded and toggle function */
  onExpandedStateChange?: (isExpanded: boolean, toggleExpand: () => void) => void
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildNodeMap(
  node: SunburstNode,
  depth = 0,
  parent?: string
): Map<string, { depth: number; parent?: string; siblings: string[] }> {
  const map = new Map<string, { depth: number; parent?: string; siblings: string[] }>()
  const siblings = node.children?.map((c) => c.name) || []

  if (node.children) {
    for (const child of node.children) {
      map.set(child.name, { depth: depth + 1, parent, siblings })
      const childMap = buildNodeMap(child, depth + 1, child.name)
      childMap.forEach((v, k) => map.set(k, v))
    }
  }

  return map
}

function getAllExpandableNodes(node: SunburstNode, maxDepth?: number): string[] {
  const expandable: string[] = []

  function collect(n: SunburstNode, currentDepth: number): void {
    if (n.children && n.children.length > 0) {
      // Only add if within maxDepth limit
      if (maxDepth === undefined || currentDepth < maxDepth) {
        expandable.push(n.name)
        for (const child of n.children) {
          collect(child, currentDepth + 1)
        }
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collect(child, 1)
    }
  }

  return expandable
}

function getDescendants(nodeName: string, data: SunburstNode): string[] {
  const descendants: string[] = []

  function findAndCollect(node: SunburstNode, collecting: boolean): void {
    if (collecting && node.children) {
      for (const child of node.children) {
        descendants.push(child.name)
        findAndCollect(child, true)
      }
    } else if (node.name === nodeName && node.children) {
      for (const child of node.children) {
        descendants.push(child.name)
        findAndCollect(child, true)
      }
    } else if (node.children) {
      for (const child of node.children) {
        findAndCollect(child, false)
      }
    }
  }

  findAndCollect(data, false)
  return descendants
}

function getDataDepth(node: SunburstNode, currentDepth = 0): number {
  if (!node.children || node.children.length === 0) {
    return currentDepth
  }
  return Math.max(...node.children.map((child) => getDataDepth(child, currentDepth + 1)))
}

// ============================================================================
// Component
// ============================================================================

export const SunburstChart = memo(function SunburstChart({
  data,
  colors = {},
  maxDepth,
  className,
  showCenterButton = true,
  onNodeClick,
  innerRadius = 10,
  outerRadius = 95,
  onExpandedStateChange,
}: SunburstChartProps) {
  const { tooltipStyle, isLightTheme } = useThemeEChartsConfig()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Memoize derived data
  const nodeMap = useMemo(() => buildNodeMap(data), [data])
  const allExpandableNodes = useMemo(() => getAllExpandableNodes(data, maxDepth), [data, maxDepth])
  const dataMaxDepth = useMemo(() => getDataDepth(data), [data])
  const effectiveMaxDepth = maxDepth ?? dataMaxDepth

  // Get current visible depth
  const currentDepth = useMemo(() => {
    if (expandedNodes.size === 0) return 1
    let depth = 1
    for (const name of expandedNodes) {
      const info = nodeMap.get(name)
      if (info && info.depth + 1 > depth) {
        depth = info.depth + 1
      }
    }
    return Math.min(depth, effectiveMaxDepth)
  }, [expandedNodes, nodeMap, effectiveMaxDepth])

  const isFullyExpanded = useMemo(() => {
    return expandedNodes.size === allExpandableNodes.length
  }, [expandedNodes, allExpandableNodes])

  const handleClick = useCallback(
    (params: { name?: string }) => {
      if (!params.name) return

      const nodeInfo = nodeMap.get(params.name)
      if (!nodeInfo) return

      // Check maxDepth constraint
      if (maxDepth !== undefined && nodeInfo.depth >= maxDepth && !expandedNodes.has(params.name)) {
        return // Don't expand beyond maxDepth
      }

      setExpandedNodes((prev) => {
        const next = new Set(prev)
        const wasExpanded = next.has(params.name!)

        if (wasExpanded) {
          next.delete(params.name!)
          const descendants = getDescendants(params.name!, data)
          descendants.forEach((d) => next.delete(d))
        } else {
          for (const sibling of nodeInfo.siblings) {
            if (sibling !== params.name) {
              next.delete(sibling)
              const siblingDescendants = getDescendants(sibling, data)
              siblingDescendants.forEach((d) => next.delete(d))
            }
          }
          next.add(params.name!)
        }

        onNodeClick?.(params.name!, !wasExpanded)
        return next
      })
    },
    [nodeMap, data, maxDepth, expandedNodes, onNodeClick]
  )

  const handleExpandAll = useCallback(() => {
    setExpandedNodes(new Set(allExpandableNodes))
  }, [allExpandableNodes])

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  const handleToggleExpand = useCallback(() => {
    if (isFullyExpanded) {
      handleCollapseAll()
    } else {
      handleExpandAll()
    }
  }, [isFullyExpanded, handleExpandAll, handleCollapseAll])

  // Notify parent of expanded state changes
  useEffect(() => {
    onExpandedStateChange?.(isFullyExpanded, handleToggleExpand)
  }, [isFullyExpanded, handleToggleExpand, onExpandedStateChange])

  const option = useMemo(() => {
    const processNode = (node: SunburstNode, color: string): unknown => {
      const isExpanded = expandedNodes.has(node.name)

      if (node.children && isExpanded) {
        return {
          name: node.name,
          itemStyle: { color },
          children: node.children.map((child) => processNode(child, color)),
        }
      }

      return {
        name: node.name,
        value: Math.abs(node.value),
        originalValue: node.value,
        othersDetails: node.othersDetails,
        itemStyle: { color },
      }
    }

    const processData = (node: SunburstNode): unknown => {
      const color = colors[node.name] || '#6b7280'
      const isExpanded = expandedNodes.has(node.name)

      return {
        name: node.name,
        value: isExpanded ? undefined : Math.abs(node.value),
        originalValue: isExpanded ? undefined : node.value,
        othersDetails: node.othersDetails,
        itemStyle: { color },
        children: isExpanded ? node.children?.map((child) => processNode(child, color)) : undefined,
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        formatter: (params: {
          name: string
          value: number
          data?: { originalValue?: number; othersDetails?: Array<{ name: string; value: number }> }
        }) => {
          const value = params.data?.originalValue ?? params.value ?? 0
          const othersDetails = params.data?.othersDetails

          // If this is an "Others" node with details, show the breakdown (limited to top 5)
          if (othersDetails && othersDetails.length > 0) {
            const maxItems = 5
            const sortedItems = [...othersDetails].sort(
              (a, b) => Math.abs(b.value) - Math.abs(a.value)
            )
            const displayItems = sortedItems.slice(0, maxItems)
            const remainingCount = sortedItems.length - maxItems

            const itemsList = displayItems
              .map((item) => {
                // Truncate long names
                const name = item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name
                return `<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${name}</span><span style="white-space:nowrap;">$${formatCompactNumber(item.value)}</span></div>`
              })
              .join('')

            const moreText =
              remainingCount > 0
                ? `<div style="color:#6b7280;font-style:italic;margin-top:4px;">and ${remainingCount} more...</div>`
                : ''

            return `<strong>${params.name}</strong><br/><strong>$${formatCompactNumber(value)}</strong><div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">${itemsList}${moreText}</div>`
          }

          return `<strong>${params.name}</strong><br/>$${formatCompactNumber(value)}`
        },
      },
      series: [
        {
          type: 'sunburst',
          data: data.children?.map((child) => processData(child)),
          radius: [`${innerRadius}%`, `${outerRadius}%`],
          sort: 'desc',
          nodeClick: false,
          emphasis: {
            focus: 'ancestor',
          },
          levels: (() => {
            const baseLevels = [{}]
            const availableSpace = outerRadius - innerRadius

            for (let i = 1; i <= currentDepth; i++) {
              const r0 = innerRadius + (availableSpace * (i - 1)) / currentDepth
              const r = innerRadius + (availableSpace * i) / currentDepth

              // Calculate minimum angle to show label based on depth
              const minAngleForLevel = i === 1 ? 20 : i === 2 ? 25 : i === 3 ? 39 : 10

              baseLevels.push({
                r0: `${r0}%`,
                r: `${r}%`,
                itemStyle: {
                  borderWidth: 2,
                  borderColor: isLightTheme ? '#FAF8F5' : '#1a1a1a',
                },
                label: {
                  rotate: 'tangential',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  formatter: (params: { name: string }) => params.name.replace(/ /g, '\n'),
                  minAngle: minAngleForLevel,
                },
              })
            }

            return baseLevels
          })(),
          animation: false,
        },
      ],
    }
  }, [tooltipStyle, expandedNodes, currentDepth, data, colors, innerRadius, outerRadius, isLightTheme])

  const onEvents = useMemo(
    () => ({
      click: handleClick,
    }),
    [handleClick]
  )

  return (
    <div className={cn('relative w-full h-full', className)}>
      <ReactECharts
        option={option}
        style={{ width: '100%', height: '100%' }}
        opts={canvasHighDpiOpts}
        onEvents={onEvents}
      />
      {showCenterButton && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <button
            onClick={isFullyExpanded ? handleCollapseAll : handleExpandAll}
            className="pointer-events-auto w-10 h-10 rounded-full hover:bg-white/10 transition-all hover:scale-110 flex items-center justify-center"
            title={isFullyExpanded ? 'Collapse All' : 'Expand All'}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="theme-text-secondary"
            >
              {isFullyExpanded ? (
                <>
                  <path d="M9 9L4 4M9 9H5M9 9V5" />
                  <path d="M15 9l5-5M15 9h4M15 9V5" />
                  <path d="M9 15l-5 5M9 15H5M9 15v4" />
                  <path d="M15 15l5 5M15 15h4M15 15v4" />
                </>
              ) : (
                <>
                  <path d="M4 4l5 5M4 4v4M4 4h4" />
                  <path d="M20 4l-5 5M20 4v4M20 4h-4" />
                  <path d="M4 20l5-5M4 20v-4M4 20h4" />
                  <path d="M20 20l-5-5M20 20v-4M20 20h-4" />
                </>
              )}
            </svg>
          </button>
        </div>
      )}
    </div>
  )
})

SunburstChart.displayName = 'SunburstChart'
