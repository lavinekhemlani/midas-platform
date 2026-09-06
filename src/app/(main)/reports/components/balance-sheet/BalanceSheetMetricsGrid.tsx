'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { ReportCard } from '@/components/reports/ReportCard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CreditCard,
  Shield,
  Activity,
  Percent,
  TrendingUp,
  BookOpen,
  BarChart3,
  Wallet,
  Scale,
  PiggyBank,
  PieChart,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { formatPnLCurrency } from '@/lib/utils/currency'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LearnSheetContent } from '@/components/learn/core/LearnSheetContent'
import { Button } from '@/components/ui/button'
import { MetricTooltip } from '../MetricTooltip'
import { SunburstChart, type SunburstNode } from '@/components/chat/visualizations/charts/advanced'
import { useTheme } from '@/hooks/useTheme'

// Hierarchy node from API
interface HierarchyNode {
  name: string
  value?: number
  total?: number
  accountId?: string
  children?: HierarchyNode[]
}

interface CategoryHierarchy {
  total: number
  children: HierarchyNode[]
}

interface AssetsHierarchy {
  current: CategoryHierarchy
  fixed: CategoryHierarchy
  other: CategoryHierarchy
  total: number
}

interface LiabilitiesHierarchy {
  current: CategoryHierarchy
  longTerm: CategoryHierarchy
  total: number
}

interface EquityHierarchy {
  total: number
  children: HierarchyNode[]
}

interface BalanceSheetMetricsGridProps {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  assetsHierarchy?: AssetsHierarchy
  liabilitiesHierarchy?: LiabilitiesHierarchy
  equityHierarchy?: EquityHierarchy
  kpis: any
  ratios: any
  contextData: Record<string, number>
  currency?: string
}

export function BalanceSheetMetricsGrid({
  totalAssets,
  totalLiabilities,
  totalEquity,
  assetsHierarchy,
  liabilitiesHierarchy,
  equityHierarchy,
  kpis,
  ratios,
  contextData,
  currency = 'USD',
}: BalanceSheetMetricsGridProps) {
  // State for sunburst expand/collapse
  const [isChartExpanded, setIsChartExpanded] = useState(false)
  const [toggleExpand, setToggleExpand] = useState<(() => void) | null>(null)
  const { theme } = useTheme()

  // Theme-aware colors
  const equityBlue = theme === 'light' ? '#0D54A8' : '#66A7F3'
  const assetsGreen = theme === 'light' ? '#178E66' : '#2FBC8B'

  const handleExpandedStateChange = useCallback((isExpanded: boolean, toggle: () => void) => {
    setIsChartExpanded(isExpanded)
    setToggleExpand(() => toggle)
  }, [])

  // Convert hierarchy to sunburst format with all depths
  // Aggregates small leaf nodes (without children) into "Others" based on angle
  const convertToSunburst = (
    nodes: HierarchyNode[],
    rootTotal: number,
    minAngle = 12
  ): SunburstNode[] => {
    const result: SunburstNode[] = []
    let othersValue = 0
    const othersItems: Array<{ name: string; value: number }> = []

    for (const node of nodes) {
      const nodeValue = Math.abs(node.value ?? node.total ?? 0)
      const hasChildren = node.children && node.children.length > 0
      // Calculate the angle this segment would occupy (360 degrees total)
      const angle = rootTotal > 0 ? (nodeValue / rootTotal) * 360 : 0

      // Only aggregate leaf nodes (no children) with angle below threshold
      if (!hasChildren && angle < minAngle && angle > 0) {
        const value = node.value ?? node.total ?? 0
        othersValue += value
        othersItems.push({ name: node.name, value })
      } else if (hasChildren) {
        // Node with children - recurse with same rootTotal
        result.push({
          name: node.name,
          value: node.total ?? node.value ?? 0,
          children: convertToSunburst(node.children!, rootTotal, minAngle),
        })
      } else {
        // Leaf node with sufficient angle - keep as-is
        result.push({
          name: node.name,
          value: node.value ?? node.total ?? 0,
        })
      }
    }

    // Add "Others" node if there are aggregated items
    if (othersItems.length > 0) {
      result.push({
        name: `Others (${othersItems.length})`,
        value: othersValue,
        // Store aggregated items for tooltip display
        othersDetails: othersItems,
      } as SunburstNode)
    }

    return result
  }

  // Build sunburst data from hierarchy
  const sunburstData = useMemo((): SunburstNode => {
    // Root total for angle calculations
    const rootTotal = Math.abs(totalAssets) + Math.abs(totalLiabilities) + Math.abs(totalEquity)

    const assetChildren: SunburstNode[] = []
    const liabilityChildren: SunburstNode[] = []

    // Assets - include category level (Current, Fixed, Other)
    if (assetsHierarchy?.current?.children?.length) {
      assetChildren.push({
        name: 'Current Assets',
        value: assetsHierarchy.current.total,
        children: convertToSunburst(assetsHierarchy.current.children, rootTotal),
      })
    }
    if (assetsHierarchy?.fixed?.children?.length) {
      assetChildren.push({
        name: 'Fixed Assets',
        value: assetsHierarchy.fixed.total,
        children: convertToSunburst(assetsHierarchy.fixed.children, rootTotal),
      })
    }
    if (assetsHierarchy?.other?.children?.length) {
      assetChildren.push({
        name: 'Other Assets',
        value: assetsHierarchy.other.total,
        children: convertToSunburst(assetsHierarchy.other.children, rootTotal),
      })
    }

    // Liabilities - include category level (Current, Long-term)
    if (liabilitiesHierarchy?.current?.children?.length) {
      liabilityChildren.push({
        name: 'Current Liabilities',
        value: liabilitiesHierarchy.current.total,
        children: convertToSunburst(liabilitiesHierarchy.current.children, rootTotal),
      })
    }
    if (liabilitiesHierarchy?.longTerm?.children?.length) {
      liabilityChildren.push({
        name: 'Long-term Liabilities',
        value: liabilitiesHierarchy.longTerm.total,
        children: convertToSunburst(liabilitiesHierarchy.longTerm.children, rootTotal),
      })
    }

    // Equity - use same aggregation logic for leaf nodes
    const equityChildren = equityHierarchy?.children
      ? convertToSunburst(equityHierarchy.children, rootTotal)
      : []

    return {
      name: 'Balance Sheet',
      value: rootTotal,
      children: [
        {
          name: 'Assets',
          value: totalAssets,
          children: assetChildren.length > 0 ? assetChildren : undefined,
        },
        {
          name: 'Liabilities',
          value: totalLiabilities,
          children: liabilityChildren.length > 0 ? liabilityChildren : undefined,
        },
        {
          name: 'Equity',
          value: totalEquity,
          children: equityChildren.length > 0 ? equityChildren : undefined,
        },
      ],
    }
  }, [
    totalAssets,
    totalLiabilities,
    totalEquity,
    assetsHierarchy,
    liabilitiesHierarchy,
    equityHierarchy,
  ])

  // Category colors for sunburst (theme-aware green for assets, equity blue)
  const sunburstColors = useMemo(
    () => ({
      Assets: assetsGreen,
      Liabilities: '#ef4444',
      Equity: equityBlue,
    }),
    [equityBlue, assetsGreen]
  )

  // Check if we have hierarchy data
  const hasHierarchyData = useMemo(() => {
    return (
      (assetsHierarchy?.current?.children?.length ?? 0) > 0 ||
      (assetsHierarchy?.fixed?.children?.length ?? 0) > 0 ||
      (assetsHierarchy?.other?.children?.length ?? 0) > 0 ||
      (liabilitiesHierarchy?.current?.children?.length ?? 0) > 0 ||
      (liabilitiesHierarchy?.longTerm?.children?.length ?? 0) > 0 ||
      (equityHierarchy?.children?.length ?? 0) > 0
    )
  }, [assetsHierarchy, liabilitiesHierarchy, equityHierarchy])
  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-4">
        {/* Total Assets */}
        <TooltipProvider>
          <ReportCard variant="glass" padding="compact">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-theme-green/10">
                <Wallet className="w-5 h-5 text-theme-green" />
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-xs theme-text-secondary uppercase tracking-wide font-medium">
                      Total Assets
                    </div>
                    <div className="text-xl font-bold text-theme-green">
                      {formatPnLCurrency(totalAssets, currency)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    Everything the company owns: cash, inventory, equipment, property.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </ReportCard>
        </TooltipProvider>

        {/* Total Liabilities */}
        <TooltipProvider>
          <ReportCard variant="glass" padding="compact">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-theme-red/10">
                <Scale className="w-5 h-5 text-theme-red" />
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-xs theme-text-secondary uppercase tracking-wide font-medium">
                      Total Liabilities
                    </div>
                    <div className="text-xl font-bold text-theme-red">
                      {formatPnLCurrency(totalLiabilities, currency)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    Total amount owed: loans, accounts payable, other obligations.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </ReportCard>
        </TooltipProvider>

        {/* Total Equity */}
        <TooltipProvider>
          <ReportCard variant="glass" padding="compact">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-theme-blue/10">
                <PiggyBank className="w-5 h-5 text-theme-blue" />
              </div>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div className="text-xs theme-text-secondary uppercase tracking-wide font-medium">
                      Total Equity
                    </div>
                    <div
                      className={`text-xl font-bold ${totalEquity >= 0 ? 'text-theme-blue' : 'text-theme-red'}`}
                    >
                      {formatPnLCurrency(totalEquity, currency)}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Owner's stake: Total Assets minus Total Liabilities.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </ReportCard>
        </TooltipProvider>
      </div>

      {/* Balance Sheet Breakdown & Key Performance Metrics - 60/40 split */}
      <div className="col-span-1">
        <div className="grid grid-cols-1 @3xl:grid-cols-10 gap-6">
          {/* Balance Sheet Sunburst Chart - 60% width */}
          <div className="@3xl:col-span-6">
            <ReportCard variant="glass" padding="default" className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2">
                    <PieChart className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="text-sm theme-text-primary font-semibold">
                    Balance Sheet Breakdown
                  </div>
                </div>
                {hasHierarchyData && toggleExpand && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleExpand}
                    className="text-xs theme-text-secondary hover:!text-amber-500 hover:!bg-transparent gap-1.5 min-w-[90px] justify-end"
                  >
                    {isChartExpanded ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        Expand
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="w-full h-[450px]">
                  <SunburstChart
                    data={sunburstData}
                    colors={sunburstColors}
                    maxDepth={hasHierarchyData ? 4 : 1}
                    showCenterButton={false}
                    innerRadius={15}
                    onExpandedStateChange={handleExpandedStateChange}
                  />
                </div>
              </div>
            </ReportCard>
          </div>

          {/* Key Performance Metrics - 40% width, single column */}
          <div className="@3xl:col-span-4">
            <Card className="@container glass-luxury-card border border-gray-200/10 h-full gap-0">
              <CardHeader className="pb-3 pt-3 px-4">
                <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Key Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 px-4">
                <div className="flex flex-col space-y-1">
                  {/* Current Ratio */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-theme-green/70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Current Assets ÷ Current Liabilities',
                          components: [
                            {
                              label: 'Current Assets',
                              value: formatPnLCurrency(kpis?.currentAssets || 0, currency),
                            },
                            {
                              label: '÷ Current Liabilities',
                              value: formatPnLCurrency(kpis?.currentLiabilities || 0, currency),
                            },
                            {
                              label: '= Current Ratio',
                              value:
                                kpis?.currentRatio !== undefined
                                  ? kpis.currentRatio.toFixed(4)
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Measures ability to pay short-term obligations. Above 1.0 = sufficient liquidity, 1.5-2.0 = healthy, above 3.0 may indicate inefficient asset use."
                      >
                        <span className="text-sm theme-text-secondary">Current Ratio</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Current Ratio</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="current-ratio"
                            icon={Shield}
                            iconColor="emerald"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {kpis?.currentRatio !== undefined ? kpis.currentRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>

                  {/* Debt to Equity */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-theme-red opacity-70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Total Liabilities ÷ Total Equity',
                          components: [
                            {
                              label: 'Total Liabilities',
                              value: formatPnLCurrency(kpis?.totalLiabilities || 0, currency),
                            },
                            {
                              label: '÷ Total Equity',
                              value: formatPnLCurrency(Math.abs(kpis?.totalEquity || 0), currency),
                            },
                            {
                              label: '= Debt to Equity',
                              value:
                                kpis?.debtToEquity !== undefined
                                  ? kpis.debtToEquity.toFixed(4)
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Total debt relative to shareholder equity. Lower ratios indicate less leverage and financial risk. Above 2.0 is generally considered high risk."
                      >
                        <span className="text-sm theme-text-secondary">Debt to Equity</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Debt to Equity</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="debt-to-equity"
                            icon={CreditCard}
                            iconColor="red"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {kpis?.debtToEquity !== undefined ? kpis.debtToEquity.toFixed(2) : 'N/A'}
                    </span>
                  </div>

                  {/* Working Capital */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-theme-blue opacity-70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Current Assets - Current Liabilities',
                          components: [
                            {
                              label: 'Current Assets',
                              value: formatPnLCurrency(kpis?.currentAssets || 0, currency),
                            },
                            {
                              label: '- Current Liabilities',
                              value: formatPnLCurrency(kpis?.currentLiabilities || 0, currency),
                            },
                            {
                              label: '= Working Capital',
                              value: formatPnLCurrency(kpis?.workingCapital || 0, currency),
                              highlight: true,
                            },
                          ],
                        }}
                        description="Liquid capital available for daily operations. Positive = healthy short-term position; negative = potential difficulty meeting obligations."
                      >
                        <span className="text-sm theme-text-secondary">Working Capital</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Working Capital</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="working-capital"
                            icon={Activity}
                            iconColor="blue"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {formatPnLCurrency(kpis?.workingCapital || 0, currency)}
                    </span>
                  </div>

                  {/* Quick Ratio */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-theme-purple" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: '(Current Assets - Inventory) ÷ Current Liabilities',
                          components: [
                            {
                              label: 'Current Assets',
                              value: formatPnLCurrency(kpis?.currentAssets || 0, currency),
                            },
                            {
                              label: '- Inventory',
                              value: formatPnLCurrency(kpis?.inventory || 0, currency),
                            },
                            {
                              label: '÷ Current Liabilities',
                              value: formatPnLCurrency(kpis?.currentLiabilities || 0, currency),
                            },
                            {
                              label: '= Quick Ratio',
                              value:
                                kpis?.quickRatio !== undefined ? kpis.quickRatio.toFixed(4) : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Liquid assets (excluding inventory) vs current liabilities. More stringent than current ratio. Above 1.0 indicates strong short-term solvency."
                      >
                        <span className="text-sm theme-text-secondary">Quick Ratio</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Quick Ratio</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="quick-ratio"
                            icon={TrendingUp}
                            iconColor="purple"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {kpis?.quickRatio !== undefined ? kpis.quickRatio.toFixed(2) : 'N/A'}
                    </span>
                  </div>

                  {/* Asset Turnover */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-theme-yellow opacity-70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Revenue ÷ Total Assets',
                          components: [
                            {
                              label: 'Revenue',
                              value:
                                ratios?.revenue !== undefined
                                  ? formatPnLCurrency(ratios.revenue, currency)
                                  : 'N/A',
                            },
                            {
                              label: '÷ Total Assets',
                              value: formatPnLCurrency(kpis?.totalAssets || 0, currency),
                            },
                            {
                              label: '= Asset Turnover',
                              value:
                                ratios?.assetTurnover !== undefined
                                  ? ratios.assetTurnover.toFixed(4)
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Revenue generated per dollar of assets. Higher ratios indicate more efficient use of assets to generate sales."
                      >
                        <span className="text-sm theme-text-secondary">Asset Turnover</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Asset Turnover</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="asset-turnover"
                            icon={Activity}
                            iconColor="amber"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {ratios?.assetTurnover !== undefined
                        ? ratios.assetTurnover.toFixed(4)
                        : 'N/A'}
                    </span>
                  </div>

                  {/* Equity Multiplier */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-cyan-400/70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Total Assets ÷ Total Equity',
                          components: [
                            {
                              label: 'Total Assets',
                              value: formatPnLCurrency(kpis?.totalAssets || 0, currency),
                            },
                            {
                              label: '÷ Total Equity',
                              value: formatPnLCurrency(Math.abs(kpis?.totalEquity || 0), currency),
                            },
                            {
                              label: '= Equity Multiplier',
                              value:
                                ratios?.equityMultiplier !== undefined
                                  ? ratios.equityMultiplier.toFixed(2)
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Total assets per dollar of equity. Higher values indicate more leverage/debt financing. Lower values = more conservative capital structure."
                      >
                        <span className="text-sm theme-text-secondary">Equity Multiplier</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Equity Multiplier</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="equity-multiplier"
                            icon={TrendingUp}
                            iconColor="cyan"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {ratios?.equityMultiplier !== undefined
                        ? ratios.equityMultiplier.toFixed(2)
                        : 'N/A'}
                    </span>
                  </div>

                  {/* Return on Equity */}
                  <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                    <div className="flex items-center gap-3">
                      <Percent className="w-4 h-4 text-theme-green opacity-70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Net Income ÷ Total Equity × 100',
                          components: [
                            {
                              label: 'Net Income',
                              value:
                                ratios?.netIncome !== undefined
                                  ? formatPnLCurrency(ratios.netIncome, currency)
                                  : 'N/A',
                            },
                            {
                              label: '÷ Total Equity',
                              value: formatPnLCurrency(Math.abs(kpis?.totalEquity || 0), currency),
                            },
                            {
                              label: '= Return on Equity',
                              value:
                                ratios?.returnOnEquity !== undefined
                                  ? `${ratios.returnOnEquity.toFixed(1)}%`
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Profit generated per dollar of shareholder equity. Measures how effectively equity capital is deployed. Compare to industry benchmarks."
                      >
                        <span className="text-sm theme-text-secondary">Return on Equity</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Return on Equity</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="return-on-equity"
                            icon={Percent}
                            iconColor="green"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {ratios?.returnOnEquity !== undefined
                        ? `${ratios.returnOnEquity.toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>

                  {/* Debt Ratio */}
                  <div className="group flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-4 h-4 text-theme-yellow opacity-70" />
                      <MetricTooltip
                        calculationTooltip={{
                          formula: 'Total Debt ÷ Total Assets × 100',
                          components: [
                            {
                              label: 'Total Debt',
                              value:
                                ratios?.totalDebt !== undefined
                                  ? formatPnLCurrency(ratios.totalDebt, currency)
                                  : 'N/A',
                            },
                            {
                              label: '÷ Total Assets',
                              value: formatPnLCurrency(kpis?.totalAssets || 0, currency),
                            },
                            {
                              label: '= Debt Ratio',
                              value:
                                ratios?.debtRatio !== undefined
                                  ? `${ratios.debtRatio.toFixed(1)}%`
                                  : 'N/A',
                              highlight: true,
                            },
                          ],
                        }}
                        description="Percentage of assets financed by debt. Below 50% is generally conservative; above 60% indicates higher financial risk."
                      >
                        <span className="text-sm theme-text-secondary">Debt Ratio</span>
                      </MetricTooltip>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          >
                            <BookOpen className="w-3 h-3 text-amber-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                          <DialogHeader className="p-0 h-0 overflow-hidden">
                            <DialogTitle className="sr-only">Learn: Debt Ratio</DialogTitle>
                          </DialogHeader>
                          <LearnSheetContent
                            termId="debt-ratio"
                            icon={CreditCard}
                            iconColor="orange"
                            onClose={() => {}}
                            startCloseAnimation={() => {}}
                            contextData={contextData}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="text-sm font-semibold theme-text-primary">
                      {ratios?.debtRatio !== undefined ? `${ratios.debtRatio.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
