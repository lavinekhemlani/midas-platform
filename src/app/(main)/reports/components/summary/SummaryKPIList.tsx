// src/app/(main)/reports/components/summary/SummaryKPIList.tsx
'use client'

import {
  Wallet,
  Activity,
  Percent,
  Flame,
  Clock,
  BookOpen,
  Shield,
  Banknote,
} from 'lucide-react'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { LearnSheetContent } from '@/components/learn/core/LearnSheetContent'
import { MetricTooltip } from '../MetricTooltip'

interface SummaryKPIListProps {
  pnlMetrics: {
    grossProfit?: number
    totalRevenue?: number
    grossMargin?: number
    operatingIncome?: number
    operatingMargin?: number
    totalExpenses?: number
    netIncome?: number
  }
  bsMetrics: {
    currentAssets?: number
    currentLiabilities?: number
    currentRatio?: number
    inventory?: number
    quickRatio?: number
    workingCapital?: number
  }
  cashBalance: number
  periodMonths: number
  pnlLoading: boolean
  cfLoading: boolean
  bsLoading: boolean
  contextData: Record<string, any>
  currency?: string
}

export function SummaryKPIList({
  pnlMetrics,
  bsMetrics,
  cashBalance,
  periodMonths,
  pnlLoading,
  cfLoading,
  bsLoading,
  contextData,
  currency = 'USD',
}: SummaryKPIListProps) {
  return (
    <div className="@container flex flex-col h-full">
      <div className="pb-3 flex-shrink-0 group cursor-default">
        <span className="relative text-base font-normal uppercase tracking-wider theme-text-primary">
          Key Performance Metrics
          <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover:w-full" />
        </span>
      </div>
      <div className="pb-4 flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-4">
          {/* Column 1 */}
          {/* Gross Margin */}
          <div className="group/row flex items-center justify-between py-2.5 px-4 overflow-hidden bg-stone-200/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Percent className="metric-icon w-4 h-4 text-theme-yellow opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: '(Gross Profit ÷ Revenue) × 100',
                  components: [
                    {
                      label: 'Gross Profit',
                      value: formatPnLCurrency(pnlMetrics.grossProfit || 0, currency),
                    },
                    {
                      label: 'Total Revenue',
                      value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
                    },
                    {
                      label: 'Gross Margin',
                      value: `${pnlMetrics.grossMargin?.toFixed(1) || 0}%`,
                      highlight: true,
                    },
                  ],
                }}
                description="Percentage of revenue remaining after direct costs (COGS). Higher margins indicate better pricing power and operational efficiency."
              >
                <span className="text-[14px] theme-text-secondary truncate">Gross Margin</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                  >
                    <BookOpen className="w-3 h-3 text-amber-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                  <DialogHeader className="p-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">Learn: Gross Margin</DialogTitle>
                  </DialogHeader>
                  <LearnSheetContent
                    termId="gross-margin"
                    icon={Percent}
                    iconColor="amber"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {pnlLoading ? (
                <span className="inline-block w-12 h-4 bg-gray-700/30 animate-pulse" />
              ) : pnlMetrics.grossMargin !== undefined ? (
                `${pnlMetrics.grossMargin.toFixed(1)}%`
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 2 */}
          {/* Cash Balance */}
          <div className="group/row flex items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-1 min-w-0">
              <Banknote className="metric-icon w-4 h-4 text-theme-green opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: 'Sum of All Active Bank Account Balances',
                  components: [
                    {
                      label: 'Current Balance',
                      value: formatPnLCurrency(cashBalance, currency),
                      highlight: true,
                    },
                  ],
                }}
                description="Real-time total of all active bank account balances from QuickBooks. This is your current liquid cash position available for operations, investments, or emergencies."
              >
                <span className="text-[14px] theme-text-secondary">Cash Balance</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                  >
                    <BookOpen className="w-3 h-3 text-amber-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                  <DialogHeader className="p-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">Learn: Cash Balance</DialogTitle>
                  </DialogHeader>
                  <LearnSheetContent
                    termId="cash-balance"
                    icon={Banknote}
                    iconColor="emerald"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums text-theme-green flex-shrink-0 ml-1">
              {cfLoading ? (
                <span className="inline-block w-16 h-4 bg-gray-700/30 animate-pulse" />
              ) : (
                formatPnLCurrency(cashBalance, currency)
              )}
            </span>
          </div>

          {/* Column 1 */}
          {/* Operating Margin */}
          <div className="group/row flex items-center justify-between py-2.5 px-4 overflow-hidden bg-stone-200/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Activity className="metric-icon w-4 h-4 text-theme-blue opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: '(Operating Income ÷ Revenue) × 100',
                  components: [
                    {
                      label: 'Operating Income',
                      value: formatPnLCurrency(pnlMetrics.operatingIncome || 0, currency),
                    },
                    {
                      label: 'Total Revenue',
                      value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
                    },
                    {
                      label: 'Operating Margin',
                      value: `${pnlMetrics.operatingMargin?.toFixed(1) || 0}%`,
                      highlight: true,
                    },
                  ],
                }}
                description="Percentage of revenue remaining after all operating expenses. Shows how efficiently you convert revenue to profit before interest and taxes."
              >
                <span className="text-[14px] theme-text-secondary truncate">Operating Margin</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                  >
                    <BookOpen className="w-3 h-3 text-amber-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                  <DialogHeader className="p-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">Learn: Operating Margin</DialogTitle>
                  </DialogHeader>
                  <LearnSheetContent
                    termId="operating-margin"
                    icon={Activity}
                    iconColor="blue"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {pnlLoading ? (
                <span className="inline-block w-12 h-4 bg-gray-700/30 animate-pulse" />
              ) : pnlMetrics.operatingMargin !== undefined ? (
                `${pnlMetrics.operatingMargin.toFixed(1)}%`
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 2 */}
          {/* Gross Burn Rate */}
          <div className="group/row flex items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-1 min-w-0">
              <Flame className="metric-icon w-4 h-4 text-theme-yellow opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: 'Total Monthly Expenses',
                  components: [
                    {
                      label: 'Total Expenses',
                      value: formatPnLCurrency(pnlMetrics.totalExpenses || 0, currency),
                    },
                    { label: '÷ Period (months)', value: `${periodMonths}` },
                    {
                      label: '= Gross Burn Rate',
                      value: `${formatPnLCurrency((pnlMetrics.totalExpenses || 0) / periodMonths, currency)}/mo`,
                      highlight: true,
                    },
                  ],
                }}
                description="Total monthly cash outflow from operations, excluding revenue. We use gross (not net) burn to show true operational cost regardless of income fluctuations—essential for conservative cash planning."
              >
                <span className="text-[14px] theme-text-secondary">Burn Rate</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                  >
                    <BookOpen className="w-3 h-3 text-amber-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                  <DialogHeader className="p-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">Learn: Gross Burn Rate</DialogTitle>
                  </DialogHeader>
                  <LearnSheetContent
                    termId="burn-rate"
                    icon={Flame}
                    iconColor="orange"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {pnlLoading ? (
                <span className="inline-block w-20 h-4 bg-gray-700/30 animate-pulse" />
              ) : pnlMetrics.totalExpenses !== undefined ? (
                `${formatPnLCurrency(Math.abs(pnlMetrics.totalExpenses) / periodMonths, currency)}/mo`
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 1 */}
          {/* Current Ratio */}
          <div className="group/row flex items-center justify-between py-2.5 px-4 overflow-hidden bg-stone-200/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Shield className="metric-icon w-4 h-4 text-theme-green opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: 'Current Assets ÷ Current Liabilities',
                  components: [
                    {
                      label: 'Current Assets',
                      value: formatPnLCurrency(bsMetrics.currentAssets || 0, currency),
                    },
                    {
                      label: 'Current Liabilities',
                      value: formatPnLCurrency(bsMetrics.currentLiabilities || 0, currency),
                    },
                    {
                      label: 'Current Ratio',
                      value: bsMetrics.currentRatio?.toFixed(2) || '0',
                      highlight: true,
                    },
                  ],
                }}
                description="Measures ability to pay short-term obligations with short-term assets. Above 1.0 = sufficient liquidity, 1.5-2.0 = healthy, above 3.0 may indicate inefficient asset use."
              >
                <span className="text-[14px] theme-text-secondary truncate">Current Ratio</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
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
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {bsLoading ? (
                <span className="inline-block w-10 h-4 bg-gray-700/30 animate-pulse" />
              ) : bsMetrics.currentRatio !== undefined ? (
                bsMetrics.currentRatio.toFixed(2)
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 2 */}
          {/* Cash Runway */}
          <div className="group/row flex items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-1 min-w-0">
              <Clock className="metric-icon w-4 h-4 text-theme-yellow opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: 'Cash Balance ÷ Gross Monthly Burn Rate',
                  components: [
                    { label: 'Cash Balance', value: formatPnLCurrency(cashBalance, currency) },
                    {
                      label: '÷ Gross Burn Rate',
                      value: formatPnLCurrency(
                        (pnlMetrics.totalExpenses || 0) / periodMonths,
                        currency
                      ),
                    },
                    {
                      label: '= Runway',
                      value:
                        cashBalance > 0 && (pnlMetrics.totalExpenses ?? 0) > 0
                          ? `${(cashBalance / ((pnlMetrics.totalExpenses ?? 0) / periodMonths)).toFixed(1)} months`
                          : 'N/A',
                      highlight: true,
                    },
                  ],
                }}
                description="Months of operation remaining at current burn rate before cash runs out. Critical for fundraising timelines and expense planning. Below 6 months typically triggers urgent action."
              >
                <span className="text-[14px] theme-text-secondary">Cash Runway</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
                  >
                    <BookOpen className="w-3 h-3 text-amber-500" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-full sm:w-[560px] sm:max-w-none p-0 learn-modal-dialog shadow-2xl">
                  <DialogHeader className="p-0 h-0 overflow-hidden">
                    <DialogTitle className="sr-only">Learn: Cash Runway</DialogTitle>
                  </DialogHeader>
                  <LearnSheetContent
                    termId="runway"
                    icon={Clock}
                    iconColor="amber"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {cfLoading || pnlLoading ? (
                <span className="inline-block w-14 h-4 bg-gray-700/30 animate-pulse" />
              ) : cashBalance > 0 && (pnlMetrics.totalExpenses ?? 0) > 0 ? (
                `${(cashBalance / ((pnlMetrics.totalExpenses ?? 0) / periodMonths)).toFixed(1)} mo`
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 1 */}
          {/* Quick Ratio */}
          <div className="group/row flex items-center justify-between py-2.5 px-4 bg-stone-200/60 dark:bg-white/[0.02]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Activity className="metric-icon w-4 h-4 text-theme-purple flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: '(Current Assets - Inventory) ÷ Current Liabilities',
                  components: [
                    {
                      label: 'Current Assets',
                      value: formatPnLCurrency(bsMetrics.currentAssets || 0, currency),
                    },
                    {
                      label: 'Inventory',
                      value: formatPnLCurrency(bsMetrics.inventory || 0, currency),
                    },
                    {
                      label: 'Current Liabilities',
                      value: formatPnLCurrency(bsMetrics.currentLiabilities || 0, currency),
                    },
                    {
                      label: 'Quick Ratio',
                      value: bsMetrics.quickRatio?.toFixed(2) || '0',
                      highlight: true,
                    },
                  ],
                }}
                description="Acid-test ratio excluding inventory. More conservative than current ratio since inventory cannot always be quickly converted to cash. Above 1.0 is healthy."
              >
                <span className="text-[14px] theme-text-secondary truncate">Quick Ratio</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
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
                    icon={Activity}
                    iconColor="purple"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {bsLoading ? (
                <span className="inline-block w-10 h-4 bg-gray-700/30 animate-pulse" />
              ) : bsMetrics.quickRatio !== undefined ? (
                bsMetrics.quickRatio.toFixed(2)
              ) : (
                'N/A'
              )}
            </span>
          </div>

          {/* Column 2 */}
          {/* Working Capital */}
          <div className="group/row flex items-center justify-between py-2.5 px-4">
            <div className="flex items-center gap-1 min-w-0">
              <Wallet className="metric-icon w-4 h-4 text-theme-green opacity-70 flex-shrink-0" />
              <MetricTooltip
                calculationTooltip={{
                  formula: 'Current Assets - Current Liabilities',
                  components: [
                    {
                      label: 'Current Assets',
                      value: formatPnLCurrency(bsMetrics.currentAssets || 0, currency),
                    },
                    {
                      label: 'Current Liabilities',
                      value: formatPnLCurrency(bsMetrics.currentLiabilities || 0, currency),
                    },
                    {
                      label: 'Working Capital',
                      value: formatPnLCurrency(bsMetrics.workingCapital || 0, currency),
                      highlight: true,
                    },
                  ],
                }}
                description="Current Assets minus Current Liabilities. Positive working capital means you can fund day-to-day operations; negative signals potential cash flow issues."
              >
                <span className="text-[14px] theme-text-secondary">Working Capital</span>
              </MetricTooltip>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-4 h-4 p-0 hover:bg-amber-500/10 opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
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
                    icon={Wallet}
                    iconColor="green"
                    onClose={() => {}}
                    startCloseAnimation={() => {}}
                    contextData={contextData}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <span className="text-[14px] font-mono font-semibold tabular-nums theme-text-primary flex-shrink-0 ml-1">
              {bsLoading ? (
                <span className="inline-block w-16 h-4 bg-gray-700/30 animate-pulse" />
              ) : (
                formatPnLCurrency(bsMetrics.workingCapital || 0, currency)
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
