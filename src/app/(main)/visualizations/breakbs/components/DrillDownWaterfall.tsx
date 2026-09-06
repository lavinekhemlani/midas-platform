'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
  formatCompactNumber,
} from '@/components/chat/visualizations/shared'
import type { BalanceSheetData, HierarchyNode, CategoryHierarchy } from '../mock-data'
import { COLORS } from '../mock-data'

// ============================================================================
// Types
// ============================================================================

interface DrillPath {
  name: string
  type: 'assets' | 'liabilities' | 'equity'
  category?: 'current' | 'fixed' | 'other' | 'longTerm'
  node?: HierarchyNode
}

interface WaterfallItem {
  label: string
  value: number // The absolute value (always positive for display)
  isDecrease?: boolean // True if this item subtracts from the waterfall (extends LEFT)
  isTotal?: boolean
  hasChildren: boolean
  drillInfo?: DrillPath
  isParent?: boolean // True for top-level category bars
  category?: 'assets' | 'liabilities' | 'equity' // For color coding
}

interface DrillDownWaterfallProps {
  data: BalanceSheetData
  className?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

function hasChildren(category: CategoryHierarchy | HierarchyNode): boolean {
  if ('children' in category && category.children && category.children.length > 0) {
    return true
  }
  return false
}

function getChildrenFromPath(
  data: BalanceSheetData,
  path: DrillPath[]
): { items: WaterfallItem[]; total: number; totalLabel: string } {
  // Root level: Show two layers with proper waterfall linking
  // Structure: Children link together → Parent total, then next group
  if (path.length === 0) {
    const items: WaterfallItem[] = []

    // ═══════════════════════════════════════════════════════════════
    // ASSETS GROUP: Children first (linked), then Total
    // ═══════════════════════════════════════════════════════════════
    const { current: assetsCurrent, fixed: assetsFixed, other: assetsOther } = data.assetsHierarchy

    // Asset children - these link together (cumulative within group)
    if (assetsCurrent.total !== 0) {
      items.push({
        label: 'Current Assets',
        value: assetsCurrent.total,
        hasChildren: hasChildren(assetsCurrent),
        category: 'assets',
        drillInfo: { name: 'Current Assets', type: 'assets', category: 'current' },
      })
    }
    if (assetsFixed.total !== 0) {
      items.push({
        label: 'Fixed Assets',
        value: assetsFixed.total,
        hasChildren: hasChildren(assetsFixed),
        category: 'assets',
        drillInfo: { name: 'Fixed Assets', type: 'assets', category: 'fixed' },
      })
    }
    if (assetsOther.total !== 0) {
      items.push({
        label: 'Other Assets',
        value: assetsOther.total,
        hasChildren: hasChildren(assetsOther),
        category: 'assets',
        drillInfo: { name: 'Other Assets', type: 'assets', category: 'other' },
      })
    }
    // Assets total (shows sum of children)
    items.push({
      label: 'Assets',
      value: data.totalAssets,
      hasChildren: true,
      isParent: true,
      isTotal: true, // This is a subtotal
      category: 'assets',
      drillInfo: { name: 'Assets', type: 'assets' },
    })

    // ═══════════════════════════════════════════════════════════════
    // LIABILITIES GROUP: Children first (linked), then Total
    // These subtract from the waterfall (isDecrease = true)
    // ═══════════════════════════════════════════════════════════════
    const { current: liabCurrent, longTerm: liabLongTerm } = data.liabilitiesHierarchy

    // Liability children - positive values but marked as decrease
    if (liabCurrent.total !== 0) {
      items.push({
        label: 'Current Liabilities',
        value: liabCurrent.total, // Positive display value
        isDecrease: true, // Extends LEFT (subtraction)
        hasChildren: hasChildren(liabCurrent),
        category: 'liabilities',
        drillInfo: { name: 'Current Liabilities', type: 'liabilities', category: 'current' },
      })
    }
    if (liabLongTerm.total !== 0) {
      items.push({
        label: 'Long-Term Liabilities',
        value: liabLongTerm.total, // Positive display value
        isDecrease: true, // Extends LEFT (subtraction)
        hasChildren: hasChildren(liabLongTerm),
        category: 'liabilities',
        drillInfo: { name: 'Long-Term Liabilities', type: 'liabilities', category: 'longTerm' },
      })
    }
    // Liabilities total
    items.push({
      label: 'Liabilities',
      value: data.totalLiabilities, // Positive display value
      isDecrease: true, // Extends LEFT (subtraction)
      hasChildren: true,
      isParent: true,
      isTotal: true,
      category: 'liabilities',
      drillInfo: { name: 'Liabilities', type: 'liabilities' },
    })

    // ═══════════════════════════════════════════════════════════════
    // EQUITY GROUP: Children first (linked), then Total (final result)
    // Note: Equity values can be negative (losses) - these extend LEFT
    // ═══════════════════════════════════════════════════════════════
    data.equityHierarchy.children.forEach((child) => {
      const isNegative = child.value < 0
      items.push({
        label: child.name,
        value: Math.abs(child.value), // Always positive display value
        isDecrease: isNegative, // Negative equity extends LEFT
        hasChildren: hasChildren(child),
        category: 'equity',
        drillInfo: { name: child.name, type: 'equity', node: child },
      })
    })
    // Equity total (final result of Assets - Liabilities)
    const equityIsNegative = data.totalEquity < 0
    items.push({
      label: 'Equity',
      value: Math.abs(data.totalEquity), // Always positive display value
      isDecrease: equityIsNegative, // Negative equity extends LEFT
      hasChildren: true,
      isParent: true,
      isTotal: true,
      category: 'equity',
      drillInfo: { name: 'Equity', type: 'equity' },
    })

    return {
      items,
      total: data.totalEquity,
      totalLabel: 'Net Position',
    }
  }

  const firstLevel = path[0]

  // Level 1: Category breakdown (Assets -> Current/Fixed/Other)
  if (path.length === 1) {
    if (firstLevel.type === 'assets') {
      const items: WaterfallItem[] = []
      const { current, fixed, other } = data.assetsHierarchy

      if (current.total !== 0) {
        items.push({
          label: 'Current Assets',
          value: current.total,
          hasChildren: hasChildren(current),
          drillInfo: { name: 'Current Assets', type: 'assets', category: 'current' },
        })
      }
      if (fixed.total !== 0) {
        items.push({
          label: 'Fixed Assets',
          value: fixed.total,
          hasChildren: hasChildren(fixed),
          drillInfo: { name: 'Fixed Assets', type: 'assets', category: 'fixed' },
        })
      }
      if (other.total !== 0) {
        items.push({
          label: 'Other Assets',
          value: other.total,
          hasChildren: hasChildren(other),
          drillInfo: { name: 'Other Assets', type: 'assets', category: 'other' },
        })
      }

      return { items, total: data.totalAssets, totalLabel: 'Total Assets' }
    }

    if (firstLevel.type === 'liabilities') {
      const items: WaterfallItem[] = []
      const { current, longTerm } = data.liabilitiesHierarchy

      if (current.total !== 0) {
        items.push({
          label: 'Current Liabilities',
          value: current.total,
          hasChildren: hasChildren(current),
          drillInfo: { name: 'Current Liabilities', type: 'liabilities', category: 'current' },
        })
      }
      if (longTerm.total !== 0) {
        items.push({
          label: 'Long-Term Liabilities',
          value: longTerm.total,
          hasChildren: hasChildren(longTerm),
          drillInfo: { name: 'Long-Term Liabilities', type: 'liabilities', category: 'longTerm' },
        })
      }

      return { items, total: data.totalLiabilities, totalLabel: 'Total Liabilities' }
    }

    if (firstLevel.type === 'equity') {
      const items: WaterfallItem[] = data.equityHierarchy.children.map((child) => ({
        label: child.name,
        value: child.value,
        hasChildren: hasChildren(child),
        drillInfo: { name: child.name, type: 'equity', node: child },
      }))

      return { items, total: data.totalEquity, totalLabel: 'Total Equity' }
    }
  }

  // Level 2+: Drill into specific category
  if (path.length >= 2) {
    const secondLevel = path[1]

    let categoryData: CategoryHierarchy | undefined
    if (firstLevel.type === 'assets') {
      if (secondLevel.category === 'current') categoryData = data.assetsHierarchy.current
      else if (secondLevel.category === 'fixed') categoryData = data.assetsHierarchy.fixed
      else if (secondLevel.category === 'other') categoryData = data.assetsHierarchy.other
    } else if (firstLevel.type === 'liabilities') {
      if (secondLevel.category === 'current') categoryData = data.liabilitiesHierarchy.current
      else if (secondLevel.category === 'longTerm')
        categoryData = data.liabilitiesHierarchy.longTerm
    }

    if (categoryData) {
      if (path.length > 2) {
        let currentNode: HierarchyNode | undefined
        for (let i = 2; i < path.length; i++) {
          const pathItem = path[i]
          const searchIn = currentNode?.children || categoryData.children
          currentNode = searchIn.find((c) => c.name === pathItem.name)
        }

        if (currentNode?.children) {
          const items: WaterfallItem[] = currentNode.children.map((child) => ({
            label: child.name,
            value: child.value,
            hasChildren: hasChildren(child),
            drillInfo: { name: child.name, type: firstLevel.type, node: child },
          }))
          return { items, total: currentNode.value, totalLabel: `Total ${currentNode.name}` }
        }
      }

      const items: WaterfallItem[] = categoryData.children.map((child) => ({
        label: child.name,
        value: child.value,
        hasChildren: hasChildren(child),
        drillInfo: { name: child.name, type: firstLevel.type, node: child },
      }))

      return { items, total: categoryData.total, totalLabel: `Total ${secondLevel.name}` }
    }
  }

  return { items: [], total: 0, totalLabel: '' }
}

// ============================================================================
// Component
// ============================================================================

export const DrillDownWaterfall = memo(function DrillDownWaterfall({
  data,
  className,
}: DrillDownWaterfallProps) {
  const [drillPath, setDrillPath] = useState<DrillPath[]>([])
  const { tooltipStyle, axisLabelStyle, axisLineStyle, splitLineStyle, isLightTheme } =
    useThemeEChartsConfig()

  const { items, total, totalLabel } = useMemo(
    () => getChildrenFromPath(data, drillPath),
    [data, drillPath]
  )

  const breadcrumb = useMemo(() => {
    if (drillPath.length === 0) return 'Balance Sheet'
    return drillPath.map((p) => p.name).join(' → ')
  }, [drillPath])

  const handleClick = useCallback(
    (params: { name?: string; data?: { drillInfo?: DrillPath; hasChildren?: boolean } }) => {
      if (!params.data?.drillInfo || !params.data?.hasChildren) return
      setDrillPath((prev) => [...prev, params.data!.drillInfo!])
    },
    []
  )

  const handleBack = useCallback(() => {
    setDrillPath((prev) => prev.slice(0, -1))
  }, [])

  const currentType = drillPath.length > 0 ? drillPath[0].type : null
  const isRootLevel = drillPath.length === 0

  // Fixed colors for the three main categories
  const CATEGORY_COLORS = {
    assets: '#10b981', // green
    liabilities: '#ef4444', // red
    equity: '#3b82f6', // blue
  }

  // Build ECharts option with proper waterfall (cumulative) positioning
  const option = useMemo(() => {
    if (!items.length) return null

    const categories: string[] = []
    const helperData: number[] = [] // Transparent bars for positioning
    // Separate series for parent (thick) and child (thin) bars
    const parentPositiveData: Array<
      | {
          value: number
          itemStyle: { color: string; borderRadius: number }
          drillInfo?: DrillPath
          hasChildren?: boolean
        }
      | number
    > = []
    const parentNegativeData: Array<
      | {
          value: number
          itemStyle: { color: string; borderRadius: number }
          drillInfo?: DrillPath
          hasChildren?: boolean
        }
      | number
    > = []
    const childPositiveData: Array<
      | {
          value: number
          itemStyle: { color: string; borderRadius: number }
          drillInfo?: DrillPath
          hasChildren?: boolean
        }
      | number
    > = []
    const childNegativeData: Array<
      | {
          value: number
          itemStyle: { color: string; borderRadius: number }
          drillInfo?: DrillPath
          hasChildren?: boolean
        }
      | number
    > = []

    // Track cumulative positions:
    // - groupCumulative: within a group of children (resets for each category)
    // - mainCumulative: the main waterfall flow (updated only by parent totals)
    let groupCumulative = 0
    let mainCumulative = 0
    let currentCategory: string | null = null

    items.forEach((item) => {
      categories.push(item.label)

      // Reset group cumulative when category changes (for children)
      if (!item.isParent && item.category !== currentCategory) {
        // Equity children start from 0 (showing breakdown of final equity)
        // Other children start from main waterfall position
        if (item.category === 'equity') {
          groupCumulative = 0
        } else {
          groupCumulative = mainCumulative
        }
        currentCategory = item.category || null
      }

      // Determine color based on category (fixed green/red/blue)
      let color: string
      if (item.category) {
        color = CATEGORY_COLORS[item.category]
        // Slightly lighter for child items
        if (!item.isParent) {
          color =
            item.category === 'assets'
              ? '#34d399' // lighter green
              : item.category === 'liabilities'
                ? '#f87171' // lighter red
                : '#60a5fa' // lighter blue
        }
      } else if (currentType) {
        color = CATEGORY_COLORS[currentType]
      } else {
        color = COLORS.total
      }

      const isParentBar = item.isParent
      const positiveData = isParentBar ? parentPositiveData : childPositiveData
      const negativeData = isParentBar ? parentNegativeData : childNegativeData

      if (item.isParent) {
        // Parent/Total bar: These are the "checkpoint" bars that link in the main waterfall
        if (item.isTotal) {
          // For subtotals, show from mainCumulative to the new position
          const change = item.isDecrease ? -item.value : item.value
          const startPos = mainCumulative
          const endPos = mainCumulative + change

          if (item.isDecrease) {
            // Decrease: bar extends LEFT from startPos
            helperData.push(endPos)
            positiveData.push(0)
            negativeData.push({
              value: item.value,
              itemStyle: { color, borderRadius: 0 },
              drillInfo: item.drillInfo,
              hasChildren: item.hasChildren,
            })
          } else {
            // Increase: bar extends RIGHT from startPos
            helperData.push(startPos)
            positiveData.push({
              value: item.value,
              itemStyle: { color, borderRadius: 0 },
              drillInfo: item.drillInfo,
              hasChildren: item.hasChildren,
            })
            negativeData.push(0)
          }
          childPositiveData.push(0)
          childNegativeData.push(0)

          // Update main cumulative for next group
          mainCumulative = endPos
          groupCumulative = mainCumulative
        } else {
          // Non-total parent (shouldn't happen in current structure)
          const change = item.isDecrease ? -item.value : item.value
          if (item.isDecrease) {
            mainCumulative += change
            helperData.push(mainCumulative)
            positiveData.push(0)
            negativeData.push({
              value: item.value,
              itemStyle: { color, borderRadius: 0 },
              drillInfo: item.drillInfo,
              hasChildren: item.hasChildren,
            })
          } else {
            helperData.push(mainCumulative)
            positiveData.push({
              value: item.value,
              itemStyle: { color, borderRadius: 0 },
              drillInfo: item.drillInfo,
              hasChildren: item.hasChildren,
            })
            negativeData.push(0)
            mainCumulative += change
          }
          childPositiveData.push(0)
          childNegativeData.push(0)
        }
      } else {
        // Child item: links within its group (siblings link together)
        const change = item.isDecrease ? -item.value : item.value
        if (item.isDecrease) {
          // Decrease: bar extends LEFT
          groupCumulative += change
          helperData.push(groupCumulative)
          positiveData.push(0)
          negativeData.push({
            value: item.value,
            itemStyle: { color, borderRadius: 0 },
            drillInfo: item.drillInfo,
            hasChildren: item.hasChildren,
          })
        } else {
          // Increase: bar extends RIGHT
          helperData.push(groupCumulative)
          positiveData.push({
            value: item.value,
            itemStyle: { color, borderRadius: 0 },
            drillInfo: item.drillInfo,
            hasChildren: item.hasChildren,
          })
          negativeData.push(0)
          groupCumulative += change
        }
        parentPositiveData.push(0)
        parentNegativeData.push(0)
      }
    })

    // Add total bar for non-root levels
    const showTotal = !isRootLevel && items.length > 0 && !items[items.length - 1]?.isTotal
    if (showTotal) {
      categories.push(totalLabel)
      helperData.push(0)
      if (total >= 0) {
        parentPositiveData.push({
          value: total,
          itemStyle: { color: COLORS.total, borderRadius: 0 },
          hasChildren: false,
        })
        parentNegativeData.push(0)
      } else {
        parentPositiveData.push(0)
        parentNegativeData.push({
          value: Math.abs(total),
          itemStyle: { color: COLORS.total, borderRadius: 0 },
          hasChildren: false,
        })
      }
      childPositiveData.push(0)
      childNegativeData.push(0)
    }

    // Calculate axis bounds - capture all bar start and end positions
    const allValues = [0] // Always include zero as reference

    // Add all helper positions (bar start points)
    allValues.push(...helperData)

    // Add all bar endpoints
    items.forEach((item, i) => {
      // For decrease items, bar extends LEFT from helper (so endpoint is helper + value)
      // For increase items, bar extends RIGHT from helper (so endpoint is helper + value)
      allValues.push(helperData[i] + item.value)
    })

    if (showTotal) {
      allValues.push(total)
      allValues.push(0) // Total bar endpoint (extends to 0)
    }

    const minVal = Math.min(...allValues)
    const maxVal = Math.max(...allValues)
    const range = maxVal - minVal
    const padding = range * 0.15
    const axisMin = minVal - padding
    const axisMax = maxVal + padding

    return {
      backgroundColor: 'transparent',
      tooltip: {
        ...tooltipStyle,
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' },
        formatter: (params: Array<{ seriesName: string; name: string; value: number }>) => {
          const positiveItem = params.find(
            (p) =>
              (p.seriesName === 'ParentPositive' || p.seriesName === 'ChildPositive') && p.value
          )
          const negativeItem = params.find(
            (p) =>
              (p.seriesName === 'ParentNegative' || p.seriesName === 'ChildNegative') && p.value
          )
          const item = positiveItem || negativeItem
          if (!item) return ''
          // Show absolute value - bar direction indicates increase/decrease
          const isDecrease = !!negativeItem
          const prefix = isDecrease ? '-' : ''
          return `<strong>${item.name.trim()}</strong><br/>${prefix}$${formatCompactNumber(item.value)}`
        },
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '5%',
        top: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value' as const,
        min: axisMin,
        max: axisMax,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => `$${formatCompactNumber(v)}`,
        },
        splitLine: {
          lineStyle: { color: splitLineStyle.color },
        },
        axisLine: {
          show: true,
          lineStyle: { color: axisLineStyle.color },
        },
      },
      yAxis: {
        type: 'category' as const,
        data: categories,
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          formatter: (value: string) => {
            const itemIndex = categories.indexOf(value)
            const item = items[itemIndex]
            if (item?.hasChildren) {
              return `${value} →`
            }
            return value
          },
        },
        axisLine: { lineStyle: { color: axisLineStyle.color } },
        axisTick: { show: false },
        inverse: true,
      },
      series: [
        // Helper series for positioning (invisible)
        {
          name: 'Helper',
          type: 'bar',
          stack: 'Total',
          itemStyle: { borderColor: 'transparent', color: 'transparent' },
          emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
          data: helperData,
          silent: true,
        },
        // Parent bars (thick - main category totals)
        {
          name: 'ParentPositive',
          type: 'bar',
          stack: 'Total',
          data: parentPositiveData,
          barWidth: 32,
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: number }) =>
              p.value ? `$${formatCompactNumber(p.value)}` : '',
            color: isLightTheme ? '#374151' : '#d1d5db',
            fontSize: 12,
            fontWeight: 600,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
        {
          name: 'ParentNegative',
          type: 'bar',
          stack: 'Total',
          data: parentNegativeData,
          barWidth: 32,
          label: {
            show: true,
            position: 'left',
            formatter: (p: { value: number }) =>
              p.value ? `-$${formatCompactNumber(p.value)}` : '',
            color: isLightTheme ? '#374151' : '#d1d5db',
            fontSize: 12,
            fontWeight: 600,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.3)',
            },
          },
        },
        // Child bars (thin - subcategory details)
        {
          name: 'ChildPositive',
          type: 'bar',
          stack: 'Total',
          data: childPositiveData,
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            formatter: (p: { value: number }) =>
              p.value ? `$${formatCompactNumber(p.value)}` : '',
            color: isLightTheme ? '#6b7280' : '#9ca3af',
            fontSize: 10,
            fontWeight: 400,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
        {
          name: 'ChildNegative',
          type: 'bar',
          stack: 'Total',
          data: childNegativeData,
          barWidth: 18,
          label: {
            show: true,
            position: 'left',
            formatter: (p: { value: number }) =>
              p.value ? `-$${formatCompactNumber(p.value)}` : '',
            color: isLightTheme ? '#6b7280' : '#9ca3af',
            fontSize: 10,
            fontWeight: 400,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        },
      ],
      animation: true,
      animationDuration: 300,
      animationEasing: 'cubicOut',
    }
  }, [
    items,
    total,
    totalLabel,
    isRootLevel,
    currentType,
    CATEGORY_COLORS,
    tooltipStyle,
    axisLabelStyle,
    axisLineStyle,
    splitLineStyle,
    isLightTheme,
  ])

  const onEvents = useMemo(
    () => ({
      click: handleClick,
    }),
    [handleClick]
  )

  if (!option) {
    return <div className="text-muted-foreground text-sm">No data available</div>
  }

  return (
    <div className={className}>
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-4">
        {drillPath.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-xs">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{breadcrumb}</span>
      </div>

      {/* Chart */}
      <div style={{ height: Math.max(300, items.length * 45 + 60) }}>
        <ReactECharts
          option={option}
          style={{ width: '100%', height: '100%' }}
          opts={canvasHighDpiOpts}
          onEvents={onEvents}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
          <span>Assets</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
          <span>Liabilities</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
          <span>Equity</span>
        </div>
        <span className="ml-auto">Click items with → to drill down</span>
      </div>
    </div>
  )
})

DrillDownWaterfall.displayName = 'DrillDownWaterfall'
