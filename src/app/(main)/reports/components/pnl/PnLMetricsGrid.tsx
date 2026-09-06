import { useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { ReportCard } from '@/components/reports'
import { EChartsLine } from '@/components/charts/echarts'
import {
  useThemeEChartsConfig,
  ReactECharts,
  canvasHighDpiOpts,
} from '@/components/chat/visualizations/shared'
import {
  TrendingDown,
  DollarSign,
  Percent,
  AlertCircle,
  Activity,
  Flame,
  Clock,
  BarChart3,
  GitBranch,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatPnLCurrency, formatPercentage } from '@/lib/utils/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricTooltip } from '../MetricTooltip'
import { MetricLearnDialog } from '../MetricLearnDialog'
import { PnLSankey } from './PnLSankey'

interface PnLMetricsGridProps {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  grossProfit: number
  costOfGoodsSold: number
  operatingExpenses: number
  grossMarginRaw: number | null
  operatingMarginRaw: number | null
  expenseRatioRaw: number | null
  netProfitMarginRaw?: number | null
  cogsRatioRaw?: number | null
  grossBurnRate: number
  monthsInPeriod: number
  cashBalance: number
  runway: number
  isLoading: boolean
  incomeBreakdown: Array<{ name: string; value: number }>
  expenseBreakdown: Array<{ name: string; value: number }>
  plFlowData: Array<{ name: string; value: number }>
  data: {
    monthlyTrend?: Array<any>
    kpis?: {
      ebitda?: number
      interestExpense?: number
      taxExpense?: number
      depreciationAmortization?: number
    }
  }
  contextData: Record<string, any>
  currency?: string
  isSingleMonth?: boolean
}

export function PnLMetricsGrid({
  totalRevenue,
  totalExpenses,
  netIncome,
  grossProfit,
  costOfGoodsSold,
  operatingExpenses,
  grossMarginRaw,
  operatingMarginRaw,
  expenseRatioRaw,
  netProfitMarginRaw,
  cogsRatioRaw,
  grossBurnRate,
  monthsInPeriod,
  cashBalance,
  runway,
  isLoading,
  incomeBreakdown,
  expenseBreakdown,
  data,
  contextData,
  currency = 'USD',
  isSingleMonth = false,
}: PnLMetricsGridProps) {
  const { theme } = useTheme()

  // Theme-aware colors for charts
  const themeRed = useMemo(() => (theme === 'light' ? '#D51323' : '#EE3D4C'), [theme])
  const themeGreen = useMemo(() => (theme === 'light' ? '#178E66' : '#2FBC8B'), [theme])
  const themeOrange = useMemo(() => (theme === 'light' ? '#CF6900' : '#FF8100'), [theme])
  const { axisLabelStyle, splitLineStyle } = useThemeEChartsConfig()

  // Single-month waterfall chart: Revenue → COGS → Gross Profit → OpEx → Net Income
  const singleMonthWaterfallOption = useMemo(() => {
    if (!isSingleMonth) return null

    // Build waterfall steps
    // Each "deduction" bar sits on an invisible base, so it looks like it's subtracting
    const steps = [
      { name: 'Revenue', value: totalRevenue, type: 'total' as const },
      { name: 'COGS', value: -Math.abs(costOfGoodsSold), type: 'deduction' as const },
      { name: 'Gross Profit', value: grossProfit, type: 'subtotal' as const },
      {
        name: 'Operating\nExpenses',
        value: -Math.abs(operatingExpenses),
        type: 'deduction' as const,
      },
      { name: 'Net Income', value: netIncome, type: 'total' as const },
    ]

    // Calculate invisible base for each bar (the "floating" effect)
    // For deductions: base = where the bar starts (the remaining value after deduction)
    // For totals/subtotals: base = 0
    const bases: number[] = []
    const values: number[] = []

    steps.forEach((step) => {
      if (step.type === 'total' || step.type === 'subtotal') {
        bases.push(0)
        values.push(step.value)
      } else {
        // Deduction: floats from the previous subtotal
        const absVal = Math.abs(step.value)
        const prevTotal = values[values.length - 1] // previous bar's top
        const prevBase = bases[bases.length - 1]
        const startPoint = prevBase + prevTotal - absVal
        bases.push(startPoint)
        values.push(absVal)
      }
    })

    const getBarColor = (step: (typeof steps)[0]) => {
      if (step.type === 'deduction') return themeRed
      if (step.name === 'Net Income') return netIncome >= 0 ? themeGreen : themeRed
      if (step.name === 'Gross Profit') return themeOrange
      return themeGreen
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: (params: any[]) => {
          // The visible bar is the second series (index 1)
          const visible = params.find((p: any) => p.seriesIndex === 1)
          if (!visible) return ''
          const step = steps[visible.dataIndex]
          const displayValue = step.type === 'deduction' ? step.value : step.value
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:2px 0">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getBarColor(step)}"></span>
              <span style="color:#94a3b8">${step.name.replace('\n', ' ')}</span>
              <span style="font-weight:600;font-family:monospace;color:#f8fafc;margin-left:auto">
                ${formatPnLCurrency(displayValue, currency)}
              </span>
            </div>
          `
        },
      },
      legend: { show: false },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '3%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: steps.map((s) => s.name),
        axisLabel: {
          ...axisLabelStyle,
          fontSize: 11,
          interval: 0,
        },
        axisLine: { lineStyle: { color: splitLineStyle.color } },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          ...axisLabelStyle,
          formatter: (v: number) => formatPnLCurrency(v, currency),
        },
        splitLine: { lineStyle: { color: splitLineStyle.color } },
      },
      series: [
        // Invisible base (transparent)
        {
          name: 'Base',
          type: 'bar',
          stack: 'waterfall',
          data: bases,
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          tooltip: { show: false },
        },
        // Visible bars
        {
          name: 'Amount',
          type: 'bar',
          stack: 'waterfall',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: getBarColor(steps[i]),
              borderRadius: steps[i].type === 'deduction' ? [0, 0, 4, 4] : [4, 4, 0, 0],
            },
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top' as const,
            formatter: (params: any) => {
              const step = steps[params.dataIndex]
              return formatPnLCurrency(
                step.type === 'deduction' ? step.value : step.value,
                currency
              )
            },
            fontSize: 11,
            fontWeight: 600,
            color: theme === 'light' ? 'rgba(55, 65, 81, 0.85)' : 'rgba(226, 232, 240, 0.85)',
          },
          emphasis: {
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
          },
        },
      ],
    }
  }, [
    isSingleMonth,
    totalRevenue,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    netIncome,
    themeGreen,
    themeRed,
    themeOrange,
    theme,
    axisLabelStyle,
    splitLineStyle,
    currency,
  ])

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 @md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Total Revenue
                  </div>
                  <div className="text-2xl font-bold text-theme-green">
                    {formatPnLCurrency(totalRevenue, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">All income from sales and services for the period.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Total Expenses */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Total Expenses
                  </div>
                  <div className="text-2xl font-bold text-theme-red">
                    {formatPnLCurrency(totalExpenses, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Operating expenses, interest, taxes, and other expenses.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Net Income */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <ReportCard variant="glass" padding="none" className="p-4 cursor-help text-center">
                  <div className="text-xs theme-text-secondary uppercase tracking-wider font-medium mb-1">
                    Net Income
                  </div>
                  <div
                    className={`text-2xl font-bold ${netIncome >= 0 ? 'text-theme-green' : 'text-theme-red'}`}
                  >
                    {formatPnLCurrency(netIncome, currency)}
                  </div>
                </ReportCard>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">
                {netIncome >= 0 ? 'Profit' : 'Loss'} after all revenues and expenses.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Monthly P&L Trend */}
      <div className="col-span-1">
        <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
          {/* Chart */}
          <TooltipProvider>
            <ReportCard variant="glass" padding="default" className="flex flex-col">
              <div className="flex items-center justify-between mb-2 pb-3 border-b border-gray-200/10">
                <div className="flex items-center gap-3">
                  <div className="p-2">
                    <Activity className="w-5 h-5 text-theme-blue" />
                  </div>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <div className="text-xs theme-text-secondary uppercase tracking-wide font-medium">
                          {isSingleMonth ? 'Monthly P&L Summary' : 'Monthly P&L Trend'}
                        </div>
                        <div className="text-sm theme-text-primary font-semibold">
                          Revenue vs Expenses
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {isSingleMonth
                            ? 'Monthly Profit & Loss Summary'
                            : 'Monthly Profit & Loss Trend'}
                        </p>
                        <p className="text-xs">
                          {isSingleMonth
                            ? 'Revenue, expenses, and net income for the selected month.'
                            : 'Track revenue, expenses, and net income trends over time.'}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex items-center">
                {isSingleMonth && singleMonthWaterfallOption ? (
                  <div className="w-full" style={{ height: 300 }}>
                    <ReactECharts
                      option={singleMonthWaterfallOption}
                      style={{ width: '100%', height: 300 }}
                      opts={canvasHighDpiOpts}
                    />
                  </div>
                ) : (
                  <EChartsLine
                    data={data.monthlyTrend || []}
                    xKey="month"
                    series={[
                      { key: 'revenue', name: 'Revenue', color: themeGreen, showArea: true },
                      { key: 'expenses', name: 'Expenses', color: themeRed, showArea: true },
                      {
                        key: 'netIncome',
                        name: 'Net Income',
                        color: themeOrange,
                        showArea: true,
                      },
                    ]}
                    formatY={(value) => formatPnLCurrency(value, currency)}
                    showLegend={true}
                    height={300}
                  />
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
                    {/* Gross Margin */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Percent className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Gross Profit ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'Revenue',
                                value: formatPnLCurrency(totalRevenue, currency),
                              },
                              {
                                label: '− COGS',
                                value: formatPnLCurrency(costOfGoodsSold, currency),
                              },
                              {
                                label: '= Gross Profit',
                                value: formatPnLCurrency(grossProfit, currency),
                              },
                              {
                                label: '= Gross Margin',
                                value: formatPercentage(grossMarginRaw),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Percentage of revenue retained after direct production costs (COGS). Reflects pricing power and production efficiency. Benchmark: 40-60% for products, 60-80% for services."
                        >
                          <span className="text-sm theme-text-secondary">Gross Margin</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="gross-margin"
                          icon={Percent}
                          iconColor="amber"
                          label="Gross Margin"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPercentage(grossMarginRaw)}
                      </span>
                    </div>

                    {/* Operating Margin */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-theme-blue opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Operating Income ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'Revenue',
                                value: formatPnLCurrency(totalRevenue, currency),
                              },
                              {
                                label: '− COGS',
                                value: formatPnLCurrency(costOfGoodsSold, currency),
                              },
                              {
                                label: '− OpEx',
                                value: formatPnLCurrency(operatingExpenses, currency),
                              },
                              {
                                label: '= Operating Income',
                                value: formatPnLCurrency(
                                  totalRevenue - costOfGoodsSold - operatingExpenses,
                                  currency
                                ),
                              },
                              {
                                label: '= Operating Margin',
                                value: formatPercentage(operatingMarginRaw),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Percentage of revenue remaining after all operating expenses. Shows core business efficiency independent of financing. Benchmark: 15-25% is healthy."
                        >
                          <span className="text-sm theme-text-secondary">Operating Margin</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="operating-margin"
                          icon={Activity}
                          iconColor="blue"
                          label="Operating Margin"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPercentage(operatingMarginRaw)}
                      </span>
                    </div>

                    {/* Net Profit Margin */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-theme-green/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Net Income ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'Net Income',
                                value: formatPnLCurrency(netIncome, currency),
                              },
                              {
                                label: '÷ Revenue',
                                value: formatPnLCurrency(totalRevenue, currency),
                              },
                              {
                                label: '= Net Profit Margin',
                                value: formatPercentage(netProfitMarginRaw),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Percentage of revenue retained as profit after all expenses. The ultimate measure of profitability. Benchmark: 10-20% is healthy for most industries."
                        >
                          <span className="text-sm theme-text-secondary">Net Profit Margin</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="net-profit-margin"
                          icon={DollarSign}
                          iconColor="emerald"
                          label="Net Profit Margin"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPercentage(netProfitMarginRaw)}
                      </span>
                    </div>

                    {/* Expense Ratio */}
                    <div className="group flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Total Expenses ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'Total Expenses',
                                value: formatPnLCurrency(totalExpenses, currency),
                              },
                              {
                                label: '÷ Revenue',
                                value: formatPnLCurrency(totalRevenue, currency),
                              },
                              {
                                label: '= Expense Ratio',
                                value: formatPercentage(expenseRatioRaw, 0),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Total expenses as percentage of revenue. Shows overall cost efficiency. Lower is better. Track trends to identify efficiency gains or cost creep."
                        >
                          <span className="text-sm theme-text-secondary">Expense Ratio</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="expense-ratio"
                          icon={AlertCircle}
                          iconColor="orange"
                          label="Expense Ratio"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPercentage(expenseRatioRaw, 0)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-1">
                    {/* COGS Ratio */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <TrendingDown className="w-4 h-4 text-theme-red opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: '(Cost of Goods Sold ÷ Revenue) × 100',
                            components: [
                              {
                                label: 'COGS',
                                value: formatPnLCurrency(costOfGoodsSold, currency),
                              },
                              {
                                label: '÷ Revenue',
                                value: formatPnLCurrency(totalRevenue, currency),
                              },
                              {
                                label: '= COGS Ratio',
                                value: formatPercentage(cogsRatioRaw),
                                highlight: true,
                              },
                            ],
                          }}
                          description="Direct production costs as percentage of revenue. Lower is better. Benchmark: 20-40% for product companies, near 0% for pure services."
                        >
                          <span className="text-sm theme-text-secondary">COGS Ratio</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="cogs-ratio"
                          icon={TrendingDown}
                          iconColor="red"
                          label="COGS Ratio"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {formatPercentage(cogsRatioRaw)}
                      </span>
                    </div>

                    {/* Gross Burn Rate */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <Flame className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Total Expenses ÷ Number of Months',
                            components: [
                              {
                                label: 'Total Expenses',
                                value: formatPnLCurrency(totalExpenses, currency),
                              },
                              { label: '÷ Period (months)', value: `${monthsInPeriod}` },
                              {
                                label: '= Gross Burn Rate',
                                value: `${formatPnLCurrency(grossBurnRate, currency)}/mo`,
                                highlight: true,
                              },
                            ],
                          }}
                          description="Average monthly cash outflow from all expenses. Key for runway calculations and budget planning. Compare month-over-month to track spending trends."
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
                        {isLoading ? 'Loading...' : formatPnLCurrency(grossBurnRate, currency)}/mo
                      </span>
                    </div>

                    {/* EBITDA */}
                    <div className="group flex items-center justify-between py-1.5 border-b border-gray-200/5">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-cyan-400/70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Net Income + Interest + Tax + D&A',
                            components: [
                              {
                                label: 'Net Income',
                                value: formatPnLCurrency(netIncome, currency),
                              },
                              {
                                label: '+ Interest',
                                value:
                                  data.kpis?.interestExpense !== undefined
                                    ? formatPnLCurrency(data.kpis.interestExpense, currency)
                                    : 'N/A',
                              },
                              {
                                label: '+ Tax',
                                value:
                                  data.kpis?.taxExpense !== undefined
                                    ? formatPnLCurrency(data.kpis.taxExpense, currency)
                                    : 'N/A',
                              },
                              {
                                label: '+ D&A',
                                value:
                                  data.kpis?.depreciationAmortization !== undefined
                                    ? formatPnLCurrency(
                                        data.kpis.depreciationAmortization,
                                        currency
                                      )
                                    : 'N/A',
                              },
                              {
                                label: '= EBITDA',
                                value:
                                  data.kpis?.ebitda !== undefined
                                    ? formatPnLCurrency(data.kpis.ebitda, currency)
                                    : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Earnings Before Interest, Taxes, Depreciation & Amortization. Proxy for operating cash generation. Useful for comparing companies with different capital structures."
                        >
                          <span className="text-sm theme-text-secondary">EBITDA</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="ebitda"
                          icon={DollarSign}
                          iconColor="cyan"
                          label="EBITDA"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {data.kpis?.ebitda !== undefined
                          ? formatPnLCurrency(data.kpis.ebitda, currency)
                          : 'N/A'}
                      </span>
                    </div>

                    {/* Cash Runway */}
                    <div className="group flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-theme-yellow opacity-70" />
                        <MetricTooltip
                          calculationTooltip={{
                            formula: 'Cash Balance ÷ Gross Monthly Burn Rate',
                            components: [
                              {
                                label: 'Cash Balance',
                                value: formatPnLCurrency(cashBalance, currency),
                              },
                              {
                                label: '÷ Gross Burn Rate',
                                value:
                                  grossBurnRate > 0
                                    ? `${formatPnLCurrency(grossBurnRate, currency)}/mo`
                                    : 'N/A',
                              },
                              {
                                label: '= Runway',
                                value:
                                  runway >= 1
                                    ? `${runway.toFixed(2)} months`
                                    : runway > 0 && runway < 1
                                      ? `${runway.toFixed(2)} months (< 1 month)`
                                      : 'N/A',
                                highlight: true,
                              },
                            ],
                          }}
                          description="Estimated months of operation at current burn rate. Alert thresholds: <6 months = urgent action, 6-12 months = caution, >12 months = healthy."
                        >
                          <span className="text-sm theme-text-secondary">Cash Runway</span>
                        </MetricTooltip>
                        <MetricLearnDialog
                          termId="runway"
                          icon={Clock}
                          iconColor="orange"
                          label="Cash Runway"
                          contextData={contextData}
                        />
                      </div>
                      <span className="text-sm font-semibold theme-text-primary">
                        {isLoading
                          ? 'Loading...'
                          : runway >= 1
                            ? `${runway.toFixed(1)} months`
                            : runway > 0 && runway < 1
                              ? '< 1 month'
                              : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* P&L Flow Sankey - only show when profitable */}
        {netIncome >= 0 && (
          <Card className="glass-luxury-card border border-gray-200/10 mt-6">
            <CardHeader className="pb-2 pt-4 px-6">
              <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-400" />
                P&L Sankey Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <PnLSankey
                totalRevenue={totalRevenue}
                costOfGoodsSold={costOfGoodsSold}
                grossProfit={grossProfit}
                operatingExpenses={operatingExpenses}
                operatingIncome={grossProfit - operatingExpenses}
                netIncome={netIncome}
                incomeBreakdown={incomeBreakdown}
                expenseBreakdown={expenseBreakdown}
                taxExpense={data.kpis?.taxExpense}
                currency={currency}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
