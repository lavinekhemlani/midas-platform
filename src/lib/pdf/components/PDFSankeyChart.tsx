// src/lib/pdf/components/PDFSankeyChart.tsx
import React from 'react'
import { View, Text, Svg, Rect, Path, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for sankey nodes
const NODE_COLORS = [
  '#3b82f6', // blue - Revenue/Source
  '#ef4444', // red - COGS/Expenses
  '#10b981', // green - Profit
  '#f59e0b', // amber - Operating
  '#8b5cf6', // purple - Other
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
]

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 10,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#111827',
  },
})

// Format currency
function formatCurrency(value: number, currency: string = 'USD'): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 1000000)
    return formatted.replace(/[\d,.]+/, (m) => m + 'M')
  }
  if (absValue >= 1000) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value / 1000)
    return formatted.replace(/[\d,.]+/, (m) => m + 'K')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format number
function formatNumber(value: number): string {
  const absValue = Math.abs(value)
  if (absValue >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (absValue >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

interface SankeyNode {
  name: string
}

interface SankeyLink {
  source: string | number
  target: string | number
  value: number
}

interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

interface PDFSankeyChartProps {
  sankeyData: SankeyData
  title?: string
  currency?: string
  format?: 'currency' | 'number'
}

interface PositionedNode {
  name: string
  depth: number
  x: number
  y: number
  height: number
  value: number
  color: string
  index: number
}

interface PositionedLink {
  source: PositionedNode
  target: PositionedNode
  value: number
  sourceY: number
  targetY: number
  thickness: number
  path: string
}

// Calculate node depths using BFS
function calculateNodeDepths(nodes: SankeyNode[], links: SankeyLink[]): Map<string, number> {
  const depths = new Map<string, number>()
  const nodeNames = new Set(nodes.map((n) => n.name))

  // Find source nodes (nodes that are not targets of any link)
  const targets = new Set(links.map((l) => l.target))
  const sources = [...nodeNames].filter((n) => !targets.has(n))

  // If no clear sources, use first node
  if (sources.length === 0 && nodes.length > 0) {
    sources.push(nodes[0].name)
  }

  // BFS to assign depths
  const queue: Array<{ name: string; depth: number }> = sources.map((s) => ({ name: s, depth: 0 }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const { name, depth } = queue.shift()!
    if (visited.has(name)) continue
    visited.add(name)
    depths.set(name, Math.max(depths.get(name) || 0, depth))

    // Find all outgoing links
    const outgoing = links.filter((l) => l.source === name)
    for (const link of outgoing) {
      if (!visited.has(link.target)) {
        queue.push({ name: link.target, depth: depth + 1 })
      }
    }
  }

  // Handle any unvisited nodes (assign to last depth)
  const maxDepth = Math.max(...Array.from(depths.values()), 0)
  for (const node of nodes) {
    if (!depths.has(node.name)) {
      depths.set(node.name, maxDepth + 1)
    }
  }

  return depths
}

// Calculate node values (sum of incoming or outgoing links)
function calculateNodeValues(nodes: SankeyNode[], links: SankeyLink[]): Map<string, number> {
  const values = new Map<string, number>()

  for (const node of nodes) {
    const incoming = links
      .filter((l) => l.target === node.name)
      .reduce((sum, l) => sum + l.value, 0)
    const outgoing = links
      .filter((l) => l.source === node.name)
      .reduce((sum, l) => sum + l.value, 0)
    values.set(node.name, Math.max(incoming, outgoing, 0))
  }

  return values
}

// Generate bezier curve path for link
function generateLinkPath(
  sourceX: number,
  sourceY: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetHeight: number,
  linkThickness: number,
  sourceOffset: number,
  targetOffset: number
): string {
  const x1 = sourceX
  const y1Top = sourceY + sourceOffset
  const y1Bottom = y1Top + linkThickness

  const x2 = targetX
  const y2Top = targetY + targetOffset
  const y2Bottom = y2Top + linkThickness

  // Control points for bezier curves
  const midX = (x1 + x2) / 2

  // Path: top edge (source to target), then bottom edge (target back to source)
  return `
    M ${x1} ${y1Top}
    C ${midX} ${y1Top}, ${midX} ${y2Top}, ${x2} ${y2Top}
    L ${x2} ${y2Bottom}
    C ${midX} ${y2Bottom}, ${midX} ${y1Bottom}, ${x1} ${y1Bottom}
    Z
  `
}

export const PDFSankeyChart: React.FC<PDFSankeyChartProps> = ({
  sankeyData,
  title,
  currency = 'USD',
  format = 'currency',
}) => {
  if (!sankeyData || !sankeyData.nodes?.length || !sankeyData.links?.length) {
    return null
  }

  const { nodes, links } = sankeyData

  // SVG dimensions
  const width = 500
  const height = 280
  const padding = { top: 20, right: 90, bottom: 20, left: 90 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Node dimensions
  const nodeWidth = 18
  const nodePadding = 15

  // Calculate depths and values
  const depths = calculateNodeDepths(nodes, links)
  const values = calculateNodeValues(nodes, links)

  // Group nodes by depth
  const maxDepth = Math.max(...Array.from(depths.values()))
  const nodesByDepth: Map<number, SankeyNode[]> = new Map()
  for (const node of nodes) {
    const depth = depths.get(node.name) || 0
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, [])
    }
    nodesByDepth.get(depth)!.push(node)
  }

  // Calculate the maximum total value at any single depth level
  // This is used for global scaling so all depths use the same scale
  let maxDepthTotalValue = 0
  for (let depth = 0; depth <= maxDepth; depth++) {
    const nodesAtDepth = nodesByDepth.get(depth) || []
    const depthTotalValue = nodesAtDepth.reduce((sum, n) => sum + (values.get(n.name) || 0), 0)
    maxDepthTotalValue = Math.max(maxDepthTotalValue, depthTotalValue)
  }
  maxDepthTotalValue = Math.max(maxDepthTotalValue, 1)

  // Position nodes using global scale for proper proportional sizing
  const positionedNodes: Map<string, PositionedNode> = new Map()
  const columnX = (depth: number) =>
    padding.left + (depth / Math.max(maxDepth, 1)) * (chartWidth - nodeWidth)

  for (let depth = 0; depth <= maxDepth; depth++) {
    const nodesAtDepth = nodesByDepth.get(depth) || []
    const totalNodeValue = nodesAtDepth.reduce((sum, n) => sum + (values.get(n.name) || 0), 0)

    // Calculate node heights using global scale so flow is visually consistent
    // Each node's height is proportional to its value relative to the max depth total
    const maxAvailableHeight = chartHeight - nodePadding * Math.max(nodesAtDepth.length - 1, 0)

    // Calculate total height needed for this column based on global scale
    const scaledTotalHeight = (totalNodeValue / maxDepthTotalValue) * maxAvailableHeight

    // Center the column vertically if it's not using full height
    const columnStartY = padding.top + (maxAvailableHeight - scaledTotalHeight) / 2

    let currentY = columnStartY
    nodesAtDepth.forEach((node, index) => {
      const nodeValue = values.get(node.name) || 0
      // Height is proportional to global max, ensuring consistent visual flow
      const nodeHeight = Math.max(
        (nodeValue / maxDepthTotalValue) * maxAvailableHeight,
        10 // Minimum height
      )

      positionedNodes.set(node.name, {
        name: node.name,
        depth,
        x: columnX(depth),
        y: currentY,
        height: nodeHeight,
        value: nodeValue,
        color: NODE_COLORS[index % NODE_COLORS.length],
        index,
      })

      currentY += nodeHeight + nodePadding
    })
  }

  // Track link offsets for stacking (proportional to node height)
  const sourceOffsets: Map<string, number> = new Map()
  const targetOffsets: Map<string, number> = new Map()

  // Sort links by source node depth, then by value (largest first) for better visual stacking
  const sortedLinks = [...links].sort((a, b) => {
    const sourceDepthA = depths.get(a.source) || 0
    const sourceDepthB = depths.get(b.source) || 0
    if (sourceDepthA !== sourceDepthB) return sourceDepthA - sourceDepthB
    return b.value - a.value // Larger flows first within same depth
  })

  // Position links with proper proportional thickness
  const positionedLinks: PositionedLink[] = sortedLinks
    .map((link) => {
      const sourceNode = positionedNodes.get(link.source)!
      const targetNode = positionedNodes.get(link.target)!

      if (!sourceNode || !targetNode) {
        return null as any
      }

      // Calculate link thickness proportional to the node heights
      // This ensures links visually connect properly to nodes - following the D3 Sankey approach
      // where the sum of all outgoing link thicknesses equals the source node height
      const sourceValue = values.get(link.source) || 1
      const targetValue = values.get(link.target) || 1

      // Leave a small gap between links for visual clarity (5%)
      const availableSourceHeight = sourceNode.height * 0.95
      const availableTargetHeight = targetNode.height * 0.95

      // Calculate proportional thickness from both source and target perspectives
      const scaledSourceThickness = (link.value / sourceValue) * availableSourceHeight
      const scaledTargetThickness = (link.value / targetValue) * availableTargetHeight

      // Use the minimum to ensure links fit both nodes properly
      const linkThickness = Math.max(Math.min(scaledSourceThickness, scaledTargetThickness), 2)

      // Get current offsets
      const sourceOffset = sourceOffsets.get(link.source) || 0
      const targetOffset = targetOffsets.get(link.target) || 0

      // Update offsets for next link - add a small gap between links
      const linkGap = 1
      sourceOffsets.set(link.source, sourceOffset + linkThickness + linkGap)
      targetOffsets.set(link.target, targetOffset + linkThickness + linkGap)

      const path = generateLinkPath(
        sourceNode.x + nodeWidth,
        sourceNode.y,
        sourceNode.height,
        targetNode.x,
        targetNode.y,
        targetNode.height,
        linkThickness,
        sourceOffset,
        targetOffset
      )

      return {
        source: sourceNode,
        target: targetNode,
        value: link.value,
        sourceY: sourceNode.y + sourceOffset,
        targetY: targetNode.y + targetOffset,
        thickness: linkThickness,
        path,
      }
    })
    .filter(Boolean)

  const formatValue = (value: number) => {
    return format === 'currency' ? formatCurrency(value, currency) : formatNumber(value)
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Render links first (behind nodes) */}
          {positionedLinks.map((link, index) => (
            <Path key={`link-${index}`} d={link.path} fill={link.source.color} fillOpacity={0.35} />
          ))}

          {/* Render nodes */}
          {Array.from(positionedNodes.values()).map((node, index) => (
            <React.Fragment key={`node-${index}`}>
              {/* Node rectangle */}
              <Rect
                x={node.x}
                y={node.y}
                width={nodeWidth}
                height={node.height}
                fill={node.color}
                rx={2}
              />

              {/* Node label - position based on depth */}
              <Text
                x={node.depth === 0 ? node.x - 5 : node.x + nodeWidth + 5}
                y={node.y + node.height / 2 + 3}
                style={{
                  fontSize: 8,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fontWeight: 600,
                  fill: '#374151',
                  textAnchor: node.depth === 0 ? 'end' : 'start',
                }}
              >
                {node.name}
              </Text>

              {/* Node value - show below label for non-first/last nodes */}
              <Text
                x={node.depth === 0 ? node.x - 5 : node.x + nodeWidth + 5}
                y={node.y + node.height / 2 + 12}
                style={{
                  fontSize: 7,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fill: '#6b7280',
                  textAnchor: node.depth === 0 ? 'end' : 'start',
                }}
              >
                {formatValue(node.value)}
              </Text>
            </React.Fragment>
          ))}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {Array.from(positionedNodes.values())
          .slice(0, 7)
          .map((node, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: node.color }]} />
              <Text style={styles.legendText}>{node.name}</Text>
            </View>
          ))}
      </View>
    </View>
  )
}
