// src/app/(main)/reports/components/cash-flow/CashFlowMetricsGrid.tsx
'use client'

import React from 'react'
import { ReportCard, ReportChart } from '@/components/reports'
import {
  DollarSign,
  Activity,
  Flame,
  Clock,
  TrendingUp,
  Target,
  Repeat,
  BarChart3,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricTooltip } from '../MetricTooltip'
import { MetricLearnDialog } from '../MetricLearnDialog'
import { useTheme } from '@/hooks/useTheme'

export interface CashFlowMetricsGridProps {
  operatingCashFlow: number
  investingCashFlow: number
  financingCashFlow: number
  netCashFlow: number
  cashBeginning?: number
  cashEnding: number
  realTimeCashBalance: number
  grossBurnRate: number
  operatingBreakdown: any[]
  investingFinancingBreakdown: any[]
  waterfallData: any[]
  monthlyFlowData: any[]
  currency?: string
  cashMetrics: {
    total_expenses?: number
    period_months?: number
    runway_months?: number
    operating_cash_flow_ratio?: number
    free_cash_flow?: number
    capital_expenditures?: number
    cash_conversion_cycle?: number
    days_receivable?: number
    days_inventory?: number
    days_payable?: number
    operating_cash_flow_margin?: number
    revenue?: number
    cash_flow_coverage_ratio?: number
    total_debt?: number
    dso?: number
    dpo?: number
    current_liabilities?: number
  }
  contextData: {
    cash_balance: number
    ocf: number
    burn_rate: number
    runway_months: number
    ocf_ratio: number
    free_cash_flow: number
    cash_conversion_cycle: number
    ocf_margin: number
    cf_coverage: number
    dso: number
    dpo: number
  }
  isLoading?: boolean
  periodMonths?: number
}

export function CashFlowMetricsGrid({
  operatingCashFlow,
  investingCashFlow,
  financingCashFlow,
  netCashFlow,
  cashEnding,
  realTimeCashBalance,
  grossBurnRate,
  operatingBreakdown,
  investingFinancingBreakdown,
  waterfallData,
  monthlyFlowData,
  currency = 'USD',
  cashMetrics,
  contextData,
  isLoading = false,
}: CashFlowMetricsGridProps) {
  const { theme } = useTheme()

  // Theme-aware chart colors
  const themeGreen = theme === 'light' ? '#178E66' : '#2FBC8B'
  const themeYellow = theme === 'light' ? '#CF6900' : '#FF8100'
  const themeBlue = theme === 'light' ? '#0D54A8' : '#66A7F3'
  const themePurple = theme === 'light' ? '#6F1CBD' : '#BF92E9'

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 @md:grid-cols-3 gap-4">
        {/* Operating Cash Flow */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Operating CF
                  </div>
                  <div
                    className={`text-2xl font-bold ${operatingCashFlow >= 0 ? 'text-theme-green' : 'text-red-400'}`}
                  >
                    {formatPnLCurrency(operatingCashFlow, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Cash generated from core business operations.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Combined Investing & Financing */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Combined I&F
                  </div>
                  <div
                    className={`text-2xl font-bold ${investingCashFlow + financingCashFlow >= 0 ? 'text-theme-green' : 'text-red-400'}`}
                  >
                    {formatPnLCurrency(investingCashFlow + financingCashFlow, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                Investing: {formatPnLCurrency(investingCashFlow, currency)} | Financing:{' '}
                {formatPnLCurrency(financingCashFlow, currency)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Net Cash Flow */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Net Cash Flow
                  </div>
                  <div
                    className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-theme-green' : 'text-red-400'}`}
                  >
                    {formatPnLCurrency(netCashFlow, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                Total change in cash. Ending balance: {formatPnLCurrency(cashEnding, currency)}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Monthly Trend */}
      <div className="col-span-1">
        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
          {/* Chart */}
          <TooltipProvider>
            <ReportCard variant="glass" padding="default" className="flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200/10">
                <div className="flex items-center gap-3">
                  <div className="p-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                  </div>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="text-xs theme-text-secondary uppercase tracking-wide font-medium">
                          Monthly Cash Flow Trend
                        </div>
                        <div className="text-sm theme-text-primary font-semibold">
                          Operating, Investing & Financing
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">Monthly Cash Flow Activities</p>
                        <p className="text-xs">
                          Track cash flows from operating, investing, and financing activities over
                          time.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-xs text-gray-400">Cash Basis</span>
              </div>
              <div className="flex-1 min-h-0 flex items-center">
                {monthlyFlowData.length > 0 ? (
                  <ReportChart
                    type="bar-line"
                    data={monthlyFlowData}
                    dataKeys={[
                      { key: 'operating', color: '#10b981', name: 'Operating' },
                      { key: 'investing', color: '#f59e0b', name: 'Investing' },
                      { key: 'financing', color: '#8b5cf6', name: 'Financing' },
                      {
                        key: 'totalCash',
                        color: '#3b82f6',
                        name: 'Total Cash',
                        isLine: true,
                      },
                    ]}
                    xKey="month"
                    formatTooltip={(value) => formatPnLCurrency(value as number, currency)}
                    showGrid={false}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <p className="text-gray-400 text-sm">No monthly trend data available</p>
                  </div>
                )}
              </div>
            </ReportCard>
          </TooltipProvider>

          {/* Key Metrics Section */}
          <div>
            <Card className="@container glass-luxury-card border border-gray-200/10 h-full gap-0">
              <CardHeader className="pb-3 pt-3 px-6">
                <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Key Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 px-6">
                <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-x-4">
                  {/* Left Column */}
                  <div className="space-y-1">
                    {/* Cash Balance - Same as Executive Summary */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-theme-green/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Sum of All Active Bank Account Balances',
                            components: [
                              {
                                label: 'Current Balance',
                                value: formatPnLCurrency(realTimeCashBalance, currency),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Real-time total of all active bank account balances from QuickBooks. This is your current liquid cash position available for operations, investments, or emergencies."
                        >
                          <span className="text-sm theme-text-secondary">Cash Balance</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="cash-balance"
                          icon={DollarSign}
                          iconColor="emerald"
                          label="Cash Balance"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold text-theme-green">
                        {isLoading
                          ? 'Loading...'
                          : formatPnLCurrency(realTimeCashBalance, currency)}
                      </span>
                    </div>

                    {/* Gross Burn Rate */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Flame className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Total Monthly Expenses',
                            components: [
                              {
                                label: 'Total Expenses',
                                value: formatPnLCurrency(
                                  cashMetrics?.total_expenses || 0,
                                  currency
                                ),
                              },
                              {
                                label: '÷ Period (months)',
                                value: `${cashMetrics?.period_months || 1}`,
                              },
                              {
                                label: '= Gross Burn Rate',
                                value: `${formatPnLCurrency(grossBurnRate, currency)}/mo`,
                                highlight: true,
                              },
                            ],
                          }}
                          description="Total amount of cash your business spends each month on operating expenses."
                        >
                          <span className="text-sm theme-text-secondary">Gross Burn Rate</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="burn-rate"
                          icon={Flame}
                          iconColor="orange"
                          label="Gross Burn Rate"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {isLoading
                          ? 'Loading...'
                          : `${formatPnLCurrency(grossBurnRate, currency)}/mo`}
                      </span>
                    </div>

                    {/* Cash Runway */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Cash Balance ÷ Gross Monthly Burn Rate',
                            components: [
                              {
                                label: 'Cash Balance',
                                value: formatPnLCurrency(realTimeCashBalance, currency),
                              },
                              {
                                label: '÷ Gross Burn Rate',
                                value: formatPnLCurrency(grossBurnRate, currency),
                              },
                              {
                                label: '= Runway',
                                value:
                                  realTimeCashBalance > 0 && grossBurnRate > 0
                                    ? `${(realTimeCashBalance / grossBurnRate).toFixed(1)} months`
                                    : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Number of months your business can operate at current spending levels before running out of cash."
                        >
                          <span className="text-sm theme-text-secondary">Cash Runway</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="runway"
                          icon={Clock}
                          iconColor="amber"
                          label="Cash Runway"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {isLoading
                          ? 'Loading...'
                          : realTimeCashBalance > 0 && grossBurnRate > 0
                            ? `${(realTimeCashBalance / grossBurnRate).toFixed(1)} mo`
                            : 'N/A'}
                      </span>
                    </div>

                    {/* OCF Ratio */}
                    <div className="group flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-theme-green/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Operating CF ÷ Current Liabilities',
                            components: [
                              {
                                label: 'Operating CF',
                                value: formatPnLCurrency(operatingCashFlow, currency),
                              },
                              {
                                label: '÷ Current Liabilities',
                                value: formatPnLCurrency(
                                  cashMetrics?.current_liabilities || 0,
                                  currency
                                ),
                              },
                              {
                                label: '= OCF Ratio',
                                value: (cashMetrics?.operating_cash_flow_ratio || 0).toFixed(4),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Operating Cash Flow relative to current liabilities. Above 1.0 means operations generate enough cash to cover short-term debts."
                        >
                          <span className="text-sm theme-text-secondary">OCF Ratio</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="ocf-ratio"
                          icon={TrendingUp}
                          iconColor="emerald"
                          label="OCF Ratio"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {(cashMetrics?.operating_cash_flow_ratio || 0).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-1">
                    {/* Free Cash Flow */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-cyan-400/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Operating CF - Capital Expenditures',
                            components: [
                              {
                                label: 'Operating CF',
                                value: formatPnLCurrency(operatingCashFlow, currency),
                              },
                              {
                                label: '- CapEx',
                                value:
                                  cashMetrics?.capital_expenditures !== undefined
                                    ? formatPnLCurrency(cashMetrics.capital_expenditures, currency)
                                    : 'N/A',
                              },
                              {
                                label: '= Free CF',
                                value:
                                  cashMetrics?.free_cash_flow !== undefined
                                    ? formatPnLCurrency(cashMetrics.free_cash_flow, currency)
                                    : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Cash available after operating expenses and capital expenditures. Positive FCF means business generates excess cash for growth, dividends, or debt reduction."
                        >
                          <span className="text-sm theme-text-secondary">Free Cash Flow</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="free-cash-flow"
                          icon={DollarSign}
                          iconColor="cyan"
                          label="Free Cash Flow"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPnLCurrency(cashMetrics?.free_cash_flow || 0, currency)}
                      </span>
                    </div>

                    {/* Cash Conversion Cycle */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Repeat className="w-4 h-4 text-theme-purple" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Days Receivable + Days Inventory - Days Payable',
                            components: [
                              {
                                label: 'Days Receivable',
                                value: `${cashMetrics?.days_receivable || 0} days`,
                              },
                              {
                                label: '+ Days Inventory',
                                value: `${cashMetrics?.days_inventory || 0} days`,
                              },
                              {
                                label: '- Days Payable',
                                value: `${cashMetrics?.days_payable || 0} days`,
                              },
                              {
                                label: '= Cash Conversion Cycle',
                                value: `${cashMetrics?.cash_conversion_cycle || 0} days`,
                                highlight: true,
                              },
                            ],
                          }}
                          description="Days between paying suppliers and collecting from customers. Shorter cycles = better working capital efficiency. Negative cycles are ideal."
                        >
                          <span className="text-sm theme-text-secondary">Cash Conversion</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="cash-conversion-cycle"
                          icon={Repeat}
                          iconColor="purple"
                          label="Cash Conversion Cycle"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {cashMetrics?.cash_conversion_cycle || 0} days
                      </span>
                    </div>

                    {/* OCF Margin */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Target className="w-4 h-4 text-blue-400/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Operating CF ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'Operating CF',
                                value: formatPnLCurrency(operatingCashFlow, currency),
                              },
                              {
                                label: '÷ Revenue',
                                value:
                                  cashMetrics?.revenue !== undefined
                                    ? formatPnLCurrency(cashMetrics.revenue, currency)
                                    : 'N/A',
                              },
                              {
                                label: '= OCF Margin',
                                value:
                                  cashMetrics?.operating_cash_flow_margin !== undefined
                                    ? `${cashMetrics.operating_cash_flow_margin.toFixed(2)}%`
                                    : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Operating cash flow as percentage of revenue. Shows how much of each revenue dollar converts to actual cash. Higher = better cash generation."
                        >
                          <span className="text-sm theme-text-secondary">OCF Margin</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="ocf-margin"
                          icon={Target}
                          iconColor="blue"
                          label="OCF Margin"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {cashMetrics?.operating_cash_flow_margin !== undefined
                          ? `${cashMetrics.operating_cash_flow_margin.toFixed(2)}%`
                          : 'N/A'}
                      </span>
                    </div>

                    {/* CF Coverage */}
                    <div className="group flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-theme-green opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Operating CF ÷ Total Debt',
                            components: [
                              {
                                label: 'Operating CF',
                                value: formatPnLCurrency(operatingCashFlow, currency),
                              },
                              {
                                label: '÷ Total Debt',
                                value:
                                  cashMetrics?.total_debt !== undefined
                                    ? formatPnLCurrency(cashMetrics.total_debt, currency)
                                    : 'N/A',
                              },
                              {
                                label: '= CF Coverage Ratio',
                                value:
                                  cashMetrics?.cash_flow_coverage_ratio !== undefined
                                    ? cashMetrics.cash_flow_coverage_ratio.toFixed(4)
                                    : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Operating cash flow vs total debt service. Above 1.0 means operations generate enough cash to service debt obligations."
                        >
                          <span className="text-sm theme-text-secondary">CF Coverage</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="cf-coverage"
                          icon={Activity}
                          iconColor="green"
                          label="CF Coverage"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {cashMetrics?.cash_flow_coverage_ratio !== undefined
                          ? cashMetrics.cash_flow_coverage_ratio.toFixed(4)
                          : 'N/A'}
                      </span>
                    </div>
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
