'use client'

import { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { useThemeEChartsConfig } from '@/components/chat/visualizations/shared'

interface PnLSankeyProps {
  totalRevenue: number
  costOfGoodsSold: number
  grossProfit: number
  operatingExpenses: number
  operatingIncome: number
  netIncome: number
  incomeBreakdown?: Array<{ name: string; value: number }>
  expenseBreakdown?: Array<{ name: string; value: number }>
  taxExpense?: number
  currency?: string
}

interface NodeData {
  name: string
  x: number
  y: number
  width: number
  height: number
  color: string
  value: number
  depth: number
}

interface LinkData {
  source: string
  target: string
  value: number
  sy: number // source y offset
  ty: number // target y offset
  sh: number // source height for this link
  th: number // target height for this link
}

export const PnLSankey = memo(function PnLSankey({
  totalRevenue,
  costOfGoodsSold,
  grossProfit,
  operatingExpenses,
  operatingIncome,
  netIncome,
  incomeBreakdown = [],
  taxExpense = 0,
  currency = 'USD',
}: PnLSankeyProps) {
  const { isLightTheme } = useThemeEChartsConfig()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 360 })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null)
  const [hoveredElement, setHoveredElement] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width, height: Math.max(360, height) })
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const layout = useMemo(() => {
    if (totalRevenue <= 0) return null

    const { width, height } = dimensions
    const nodeWidth = 18 // Same as ECharts
    const nodeGap = 12 // Same as ECharts default

    // Use percentage-based padding
    const padding = {
      top: height * 0.05,
      bottom: height * 0.05,
      left: width * 0.02,
      right: width * 0.02,
    }

    // Absolute values
    const absRevenue = Math.abs(totalRevenue)
    const absCogs = Math.abs(costOfGoodsSold)
    const absGrossProfit = Math.abs(grossProfit)
    const absOpex = Math.abs(operatingExpenses)
    const absOperatingIncome = Math.abs(operatingIncome)
    const absNetIncome = Math.abs(netIncome)
    const absTax = Math.abs(taxExpense)

    // Colors - theme-aware colors
    const themeRed = isLightTheme ? '#D51323' : '#EE3D4C'
    const themeGreen = isLightTheme ? '#178E66' : '#2FBC8B'
    const themeYellow = isLightTheme ? '#CF6900' : '#FF8100'
    const colors = {
      revenue: themeGreen,
      grossProfit: isLightTheme ? '#1A9F73' : '#34C896', // lighter green
      operatingProfit: isLightTheme ? '#1DB07C' : '#3CD4A2', // even lighter
      netProfit: isLightTheme ? '#20C186' : '#45E0AE', // lightest green
      netLoss: themeRed,
      cogs: themeRed,
      opex: themeYellow,
      tax: isLightTheme ? '#B55A00' : '#E87700', // slightly different yellow
    }
    // Theme-aware blue for revenue chart colors
    const themeBlue = isLightTheme ? '#0D54A8' : '#66A7F3'
    const themePurple = isLightTheme ? '#6F1CBD' : '#BF92E9'
    const revenueColors = [
      themeBlue,
      themePurple,
      '#06b6d4',
      '#ec4899',
      '#f59e0b',
      '#14b8a6',
      '#6366f1',
      '#f97316',
      '#84cc16',
      themePurple,
    ]

    // Filter income sources
    const reservedNames = new Set([
      'Revenue',
      'Cost of Goods Sold',
      'Gross Profit',
      'Operating Exp.',
      'Operating Profit',
      'Tax',
      'Net Profit',
      'Net Loss',
    ])
    const incomeSources = incomeBreakdown
      .filter((item) => item.value > 0 && !reservedNames.has(item.name))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    // Calculate usable area
    const usableWidth = width - padding.left - padding.right
    const usableHeight = height - padding.top - padding.bottom

    // Revenue node + label should be horizontally centered
    // Label is ~100px wide and positioned 8px to the right of the node
    const labelWidth = 100
    const labelGap = 8
    const revenueTotalWidth = nodeWidth + labelGap + labelWidth
    const centerX = width / 2 - revenueTotalWidth / 2

    // Depths: 0 = income sources (left of center), 1 = Revenue (center), 2,3,4 = right of center
    const hasLeftNodes = incomeSources.length > 0

    // Calculate spacing for left and right sides independently
    const leftSpace = centerX - padding.left - nodeWidth // space for left nodes
    const rightSpace = width - centerX - nodeWidth - padding.right // space for right nodes

    // For tracking depth in node data
    const revenueDepth = 1

    // Max height for revenue node (scaled to fit)
    // Count nodes at each depth to calculate spacing
    const rightNodeCounts = [
      (absGrossProfit > 0 ? 1 : 0) + (absCogs > 0 ? 1 : 0),
      (absOperatingIncome > 0 ? 1 : 0) + (absOpex > 0 ? 1 : 0),
      (absNetIncome > 0 ? 1 : 0) + (absTax > 0 ? 1 : 0),
    ]
    const maxNodesInColumn = Math.max(incomeSources.length, ...rightNodeCounts, 1)

    // Calculate revenue height - shorter like ECharts (around 45% of usable height)
    const revenueHeight = Math.min(
      usableHeight * 0.45,
      usableHeight - (maxNodesInColumn - 1) * nodeGap
    )

    const nodes: NodeData[] = []
    const links: LinkData[] = []

    // Revenue node (center, vertically centered)
    const revenueY = padding.top + (usableHeight - revenueHeight) / 2
    nodes.push({
      name: 'Revenue',
      x: centerX,
      y: revenueY,
      width: nodeWidth,
      height: revenueHeight,
      color: colors.revenue,
      value: absRevenue,
      depth: revenueDepth,
    })

    // Left side: Income sources
    if (incomeSources.length > 0) {
      const leftX = padding.left // Income sources at the left edge
      const totalSourceValue = incomeSources.reduce((s, i) => s + i.value, 0)

      // Calculate heights for left nodes
      const leftNodeHeights = incomeSources.map((s) =>
        Math.max(12, (s.value / totalSourceValue) * revenueHeight * 0.9)
      )
      const totalLeftHeight =
        leftNodeHeights.reduce((s, h) => s + h, 0) + (incomeSources.length - 1) * nodeGap

      let sourceY = revenueY + (revenueHeight - totalLeftHeight) / 2
      let revenueLeftOffset = 0

      incomeSources.forEach((source, idx) => {
        const h = leftNodeHeights[idx]
        const linkH = (source.value / absRevenue) * revenueHeight

        nodes.push({
          name: source.name,
          x: leftX,
          y: sourceY,
          width: nodeWidth,
          height: h,
          color: revenueColors[idx % revenueColors.length],
          value: source.value,
          depth: 0,
        })

        links.push({
          source: source.name,
          target: 'Revenue',
          value: source.value,
          sy: 0,
          ty: revenueLeftOffset,
          sh: h,
          th: linkH,
        })

        sourceY += h + nodeGap
        revenueLeftOffset += linkH
      })
    }

    // Right side columns - evenly spaced in the right half
    const rightStartX = centerX + nodeWidth
    const rightAvailableSpace = width - rightStartX - padding.right
    const rightColSpacing = rightAvailableSpace / 3
    const col1X = rightStartX + rightColSpacing * 0.5
    const col2X = col1X + rightColSpacing
    const col3X = col2X + rightColSpacing

    // Helper for node heights - proportional to parent
    const calcH = (val: number, refVal: number, refH: number) => Math.max(12, (val / refVal) * refH)

    // Column 1: Gross Profit + COGS
    const gpH = calcH(absGrossProfit, absRevenue, revenueHeight)
    const cogsH = calcH(absCogs, absRevenue, revenueHeight)
    const col1Total = gpH + (absCogs > 0 ? cogsH + nodeGap : 0)
    const col1Y = revenueY + (revenueHeight - col1Total) / 2
    let revenueRightOffset = 0

    if (absGrossProfit > 0) {
      nodes.push({
        name: 'Gross Profit',
        x: col1X,
        y: col1Y,
        width: nodeWidth,
        height: gpH,
        color: colors.grossProfit,
        value: absGrossProfit,
        depth: revenueDepth + 1,
      })
      links.push({
        source: 'Revenue',
        target: 'Gross Profit',
        value: absGrossProfit,
        sy: revenueRightOffset,
        ty: 0,
        sh: (absGrossProfit / absRevenue) * revenueHeight,
        th: gpH,
      })
      revenueRightOffset += (absGrossProfit / absRevenue) * revenueHeight
    }
    if (absCogs > 0) {
      nodes.push({
        name: 'Cost of Goods Sold',
        x: col1X,
        y: col1Y + gpH + nodeGap,
        width: nodeWidth,
        height: cogsH,
        color: colors.cogs,
        value: absCogs,
        depth: revenueDepth + 1,
      })
      links.push({
        source: 'Revenue',
        target: 'Cost of Goods Sold',
        value: absCogs,
        sy: revenueRightOffset,
        ty: 0,
        sh: (absCogs / absRevenue) * revenueHeight,
        th: cogsH,
      })
    }

    // Column 2: Operating Profit + OpEx
    const opH = calcH(absOperatingIncome, absGrossProfit, gpH)
    const opexH = calcH(absOpex, absGrossProfit, gpH)
    const col2Total = opH + (absOpex > 0 ? opexH + nodeGap : 0)
    const col2Y = col1Y + (gpH - col2Total) / 2
    let gpRightOffset = 0

    if (absOperatingIncome > 0) {
      nodes.push({
        name: 'Operating Profit',
        x: col2X,
        y: col2Y,
        width: nodeWidth,
        height: opH,
        color: colors.operatingProfit,
        value: absOperatingIncome,
        depth: revenueDepth + 2,
      })
      links.push({
        source: 'Gross Profit',
        target: 'Operating Profit',
        value: absOperatingIncome,
        sy: gpRightOffset,
        ty: 0,
        sh: (absOperatingIncome / absGrossProfit) * gpH,
        th: opH,
      })
      gpRightOffset += (absOperatingIncome / absGrossProfit) * gpH
    }
    if (absOpex > 0) {
      nodes.push({
        name: 'Operating Exp.',
        x: col2X,
        y: col2Y + opH + nodeGap,
        width: nodeWidth,
        height: opexH,
        color: colors.opex,
        value: absOpex,
        depth: revenueDepth + 2,
      })
      links.push({
        source: 'Gross Profit',
        target: 'Operating Exp.',
        value: absOpex,
        sy: gpRightOffset,
        ty: 0,
        sh: (absOpex / absGrossProfit) * gpH,
        th: opexH,
      })
    }

    // Column 3: Net Profit + Tax
    const npH = calcH(absNetIncome, absOperatingIncome, opH)
    const taxH = calcH(absTax, absOperatingIncome, opH)
    const col3Total = npH + (absTax > 0 ? taxH + nodeGap : 0)
    const col3Y = col2Y + (opH - col3Total) / 2
    let opRightOffset = 0
    const npName = netIncome >= 0 ? 'Net Profit' : 'Net Loss'

    if (absNetIncome > 0) {
      nodes.push({
        name: npName,
        x: col3X,
        y: col3Y,
        width: nodeWidth,
        height: npH,
        color: netIncome >= 0 ? colors.netProfit : colors.netLoss,
        value: absNetIncome,
        depth: revenueDepth + 3,
      })
      links.push({
        source: 'Operating Profit',
        target: npName,
        value: absNetIncome,
        sy: opRightOffset,
        ty: 0,
        sh: (absNetIncome / absOperatingIncome) * opH,
        th: npH,
      })
      opRightOffset += (absNetIncome / absOperatingIncome) * opH
    }
    if (absTax > 0) {
      nodes.push({
        name: 'Tax',
        x: col3X,
        y: col3Y + npH + nodeGap,
        width: nodeWidth,
        height: taxH,
        color: colors.tax,
        value: absTax,
        depth: revenueDepth + 3,
      })
      links.push({
        source: 'Operating Profit',
        target: 'Tax',
        value: absTax,
        sy: opRightOffset,
        ty: 0,
        sh: (absTax / absOperatingIncome) * opH,
        th: taxH,
      })
    }

    return { nodes, links }
  }, [
    totalRevenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    netIncome,
    incomeBreakdown,
    taxExpense,
    dimensions,
    isLightTheme,
  ])

  const nodeMap = useMemo(() => {
    if (!layout) return new Map<string, NodeData>()
    return new Map(layout.nodes.map((n) => [n.name, n]))
  }, [layout])

  // Get connected elements for hover highlighting
  const getConnected = useCallback(
    (element: string | null) => {
      if (!element || !layout) return { nodes: new Set<string>(), links: new Set<string>() }
      const nodes = new Set<string>()
      const links = new Set<string>()

      // Check if it's a node
      if (nodeMap.has(element)) {
        nodes.add(element)
        layout.links.forEach((l) => {
          if (l.source === element || l.target === element) {
            links.add(`${l.source}->${l.target}`)
            nodes.add(l.source)
            nodes.add(l.target)
          }
        })
      } else {
        // It's a link
        links.add(element)
        const [src, tgt] = element.split('->')
        nodes.add(src)
        nodes.add(tgt)
      }
      return { nodes, links }
    },
    [layout, nodeMap]
  )

  const connected = useMemo(() => getConnected(hoveredElement), [getConnected, hoveredElement])

  // Generate curved path for link
  const linkPath = useCallback(
    (link: LinkData) => {
      const src = nodeMap.get(link.source)
      const tgt = nodeMap.get(link.target)
      if (!src || !tgt) return ''

      const x0 = src.x + src.width
      const y0 = src.y + link.sy
      const x1 = tgt.x
      const y1 = tgt.y + link.ty
      const curvature = 0.5
      const mx = x0 + (x1 - x0) * curvature

      return `
      M${x0},${y0}
      C${mx},${y0} ${mx},${y1} ${x1},${y1}
      L${x1},${y1 + link.th}
      C${mx},${y1 + link.th} ${mx},${y0 + link.sh} ${x0},${y0 + link.sh}
      Z
    `
    },
    [nodeMap]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
    )
  }, [])

  if (netIncome < 0 || !layout) return null

  const hasHover = hoveredElement !== null

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredElement(null)
        setTooltip(null)
      }}
    >
      <svg width={dimensions.width} height={dimensions.height}>
        <defs>
          {layout.links.map((link, i) => {
            const src = nodeMap.get(link.source)
            const tgt = nodeMap.get(link.target)
            if (!src || !tgt) return null
            return (
              <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={src.color} />
                <stop offset="100%" stopColor={tgt.color} />
              </linearGradient>
            )
          })}
        </defs>

        {/* Links */}
        {layout.links.map((link, i) => {
          const key = `${link.source}->${link.target}`
          const isConn = connected.links.has(key)
          const opacity = hasHover ? (isConn ? 0.7 : 0.1) : 0.4
          return (
            <path
              key={i}
              d={linkPath(link)}
              fill={`url(#grad-${i})`}
              opacity={opacity}
              style={{ transition: 'opacity 0.15s' }}
              onMouseEnter={() => {
                setHoveredElement(key)
                setTooltip({
                  x: 0,
                  y: 0,
                  content: `${link.source} → ${link.target}: ${formatPnLCurrency(link.value, currency)}`,
                })
              }}
              onMouseLeave={() => {
                setHoveredElement(null)
                setTooltip(null)
              }}
            />
          )
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const isConn = connected.nodes.has(node.name)
          const opacity = hasHover ? (isConn ? 1 : 0.3) : 1
          // All labels on the right side like ECharts
          const labelX = node.x + node.width + 8

          return (
            <g key={node.name}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                fill={node.color}
                opacity={opacity}
                style={{ transition: 'opacity 0.15s' }}
                onMouseEnter={() => {
                  setHoveredElement(node.name)
                  setTooltip({
                    x: 0,
                    y: 0,
                    content: `${node.name}: ${formatPnLCurrency(node.value, currency)}`,
                  })
                }}
                onMouseLeave={() => {
                  setHoveredElement(null)
                  setTooltip(null)
                }}
              />
              <text
                x={labelX}
                y={node.y + node.height / 2 - 6}
                textAnchor="start"
                fill={isLightTheme ? '#374151' : '#e5e7eb'}
                fontSize={11}
                fontWeight={500}
                opacity={opacity}
                style={{ transition: 'opacity 0.15s' }}
              >
                {node.name}
              </text>
              <text
                x={labelX}
                y={node.y + node.height / 2 + 8}
                textAnchor="start"
                fill={isLightTheme ? '#374151' : '#e5e7eb'}
                fontSize={11}
                fontWeight={500}
                opacity={opacity}
                style={{ transition: 'opacity 0.15s' }}
              >
                {formatPnLCurrency(node.value, currency)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded shadow-lg text-xs z-50"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            backgroundColor: isLightTheme ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,35,0.95)',
            color: isLightTheme ? '#1f2937' : '#f3f4f6',
            border: `1px solid ${isLightTheme ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}`,
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}
    </div>
  )
})

PnLSankey.displayName = 'PnLSankey'
