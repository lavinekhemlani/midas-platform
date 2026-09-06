// src/app/(main)/components/CashFlowForecast.tsx
'use client'

import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TrendingUp,
  AlertTriangle,
  Info,
  Calendar,
  DollarSign,
  Target,
  Zap,
  TrendingDown,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'

interface DailyCashFlowData {
  date: string
  inflow: number
  outflow: number
  net: number
}

interface ForecastData {
  date: string
  actual?: number
  forecast: number
  optimistic: number
  pessimistic: number
  confidence: number
}

interface ScheduledEvent {
  date: string
  amount: number
  description: string
  currency?: string
  recurring?: boolean
  frequency?: string
}

interface KeyDate {
  date: string
  description: string
}

interface CashFlowForecastProps {
  historicalData: DailyCashFlowData[]
  currentCash: number
  monthlyBurn: number
  currency?: string
  className?: string
  forecastDays?: number
  scheduledExpenses?: ScheduledEvent[]
  scheduledIncome?: ScheduledEvent[]
  keyDates?: KeyDate[]
}

export default function CashFlowForecast({
  historicalData,
  currentCash,
  monthlyBurn,
  currency = 'USD',
  className,
  forecastDays = 90,
  scheduledExpenses = [],
  scheduledIncome = [],
  keyDates = [],
}: CashFlowForecastProps) {
  const [selectedView, setSelectedView] = useState<'forecast' | 'scenarios' | 'breakdown'>(
    'forecast'
  )
  const [showConfidenceBands, setShowConfidenceBands] = useState(true)
  const [showScheduledEvents, setShowScheduledEvents] = useState(true)

  // Check if we have any scheduled events from memory
  const hasScheduledEvents = scheduledExpenses.length > 0 || scheduledIncome.length > 0

  // Calculate forecast data based on historical trends and scheduled events
  const forecastData = useMemo(() => {
    if (!historicalData.length) return []

    // Calculate rolling averages and trends
    const recentDays = Math.min(30, historicalData.length)
    const recentData = historicalData.slice(-recentDays)

    const avgDailyNet = recentData.reduce((sum, day) => sum + day.net, 0) / recentDays
    const avgInflow = recentData.reduce((sum, day) => sum + day.inflow, 0) / recentDays
    const avgOutflow = recentData.reduce((sum, day) => sum + day.outflow, 0) / recentDays

    // Calculate volatility for confidence bands
    const netFlows = recentData.map((d) => d.net)
    const variance =
      netFlows.reduce((sum, net) => sum + Math.pow(net - avgDailyNet, 2), 0) / netFlows.length
    const stdDev = Math.sqrt(variance)

    // Generate forecast
    const forecast: ForecastData[] = []
    let runningBalance = currentCash
    let optimisticBalance = currentCash
    let pessimisticBalance = currentCash

    for (let i = 0; i <= forecastDays; i++) {
      const forecastDate = new Date()
      forecastDate.setDate(forecastDate.getDate() + i)
      const dateStr = forecastDate.toISOString().split('T')[0]

      // Find scheduled events for this day (only if toggle is on)
      let scheduledExpenseAmount = 0
      let scheduledIncomeAmount = 0

      if (showScheduledEvents) {
        // Sum expenses for this day
        scheduledExpenseAmount = scheduledExpenses
          .filter((e) => e.date === dateStr)
          .reduce((sum, e) => sum + (e.amount || 0), 0)

        // Sum income for this day
        scheduledIncomeAmount = scheduledIncome
          .filter((e) => e.date === dateStr)
          .reduce((sum, e) => sum + (e.amount || 0), 0)
      }

      // Adjust daily change: base + scheduled income - scheduled expenses
      const dailyAdjustment = scheduledIncomeAmount - scheduledExpenseAmount

      // Base forecast
      runningBalance += avgDailyNet + dailyAdjustment

      // Optimistic scenario (20% better)
      optimisticBalance += avgDailyNet * 1.2 + dailyAdjustment

      // Pessimistic scenario (20% worse)
      pessimisticBalance += avgDailyNet * 0.8 + dailyAdjustment

      // Confidence decreases over time
      const confidence = Math.max(50, 95 - (i / forecastDays) * 45)

      forecast.push({
        date: dateStr,
        forecast: Math.max(0, runningBalance),
        optimistic: Math.max(0, optimisticBalance),
        pessimistic: Math.max(0, pessimisticBalance),
        confidence,
      })
    }

    return forecast
  }, [
    historicalData,
    currentCash,
    forecastDays,
    showScheduledEvents,
    scheduledExpenses,
    scheduledIncome,
  ])

  // Calculate key insights
  const insights = useMemo(() => {
    const criticalDate = forecastData.find((d) => d.forecast <= 0)
    const thirtyDayForecast = forecastData[30]
    const sixtyDayForecast = forecastData[60]
    const ninetyDayForecast = forecastData[forecastDays]

    const runwayDays = criticalDate
      ? Math.ceil(
          (new Date(criticalDate.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
      : null

    return {
      criticalDate: criticalDate ? new Date(criticalDate.date) : null,
      runwayDays,
      runwayMonths: runwayDays ? (runwayDays / 30).toFixed(1) : null,
      thirtyDay: thirtyDayForecast?.forecast || 0,
      sixtyDay: sixtyDayForecast?.forecast || 0,
      ninetyDay: ninetyDayForecast?.forecast || 0,
      thirtyDayOptimistic: thirtyDayForecast?.optimistic || 0,
      thirtyDayPessimistic: thirtyDayForecast?.pessimistic || 0,
    }
  }, [forecastData, forecastDays])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label)
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

      return (
        <div className="glass-luxury-card p-3 border border-amber-500/20">
          <p className="font-semibold theme-text-primary mb-2">{formattedDate}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm theme-text-secondary">
                  {entry.dataKey === 'forecast'
                    ? 'Expected'
                    : entry.dataKey === 'optimistic'
                      ? 'Best Case'
                      : entry.dataKey === 'pessimistic'
                        ? 'Worst Case'
                        : entry.dataKey}
                </span>
              </div>
              <span className="text-sm font-semibold theme-text-primary ml-4">
                {formatCompactCurrency(entry.value, currency)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Cash flow breakdown by category
  const categoryBreakdown = useMemo(() => {
    const categories = {
      operations: { inflow: 0, outflow: 0 },
      customers: { inflow: 0, outflow: 0 },
      vendors: { inflow: 0, outflow: 0 },
      other: { inflow: 0, outflow: 0 },
    }

    // Simulate category breakdown (in real implementation, this would come from transaction data)
    const totalInflow = historicalData.reduce((sum, d) => sum + d.inflow, 0)
    const totalOutflow = historicalData.reduce((sum, d) => sum + d.outflow, 0)

    categories.customers.inflow = totalInflow * 0.8
    categories.operations.inflow = totalInflow * 0.15
    categories.other.inflow = totalInflow * 0.05

    categories.vendors.outflow = totalOutflow * 0.4
    categories.operations.outflow = totalOutflow * 0.5
    categories.other.outflow = totalOutflow * 0.1

    return categories
  }, [historicalData])

  return (
    <Card className={cn('chart-container', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="chart-title">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Cash Flow Forecast
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-blue-500/30 text-blue-600">
              {forecastDays} Days
            </Badge>
            {insights.criticalDate && (
              <Badge variant="destructive" className="flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Low Cash Warning</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
          <TabsList className="grid grid-cols-3 w-full max-w-md mb-6">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="space-y-6">
            {/* Key Insights */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-slate-500/5 rounded-lg">
                <Calendar className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <div className="text-xs theme-text-secondary mb-1">30-Day Forecast</div>
                <div
                  className={cn(
                    'text-lg font-bold',
                    insights.thirtyDay > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(insights.thirtyDay, currency)}
                </div>
              </div>

              <div className="text-center p-4 bg-slate-500/5 rounded-lg">
                <Target className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                <div className="text-xs theme-text-secondary mb-1">60-Day Forecast</div>
                <div
                  className={cn(
                    'text-lg font-bold',
                    insights.sixtyDay > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(insights.sixtyDay, currency)}
                </div>
              </div>

              <div className="text-center p-4 bg-slate-500/5 rounded-lg">
                <Zap className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                <div className="text-xs theme-text-secondary mb-1">90-Day Forecast</div>
                <div
                  className={cn(
                    'text-lg font-bold',
                    insights.ninetyDay > 0 ? 'text-emerald-400' : 'text-red-400'
                  )}
                >
                  {formatCompactCurrency(insights.ninetyDay, currency)}
                </div>
              </div>

              <div className="text-center p-4 bg-slate-500/5 rounded-lg">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                <div className="text-xs theme-text-secondary mb-1">Cash Runway</div>
                <div
                  className={cn(
                    'text-lg font-bold',
                    insights.runwayMonths && parseFloat(insights.runwayMonths) < 6
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  )}
                >
                  {insights.runwayMonths || '12+'} months
                </div>
              </div>
            </div>

            {/* Scheduled Events Summary */}
            {hasScheduledEvents && showScheduledEvents && (
              <div className="p-4 bg-slate-500/5 rounded-lg mb-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  Scheduled Events from Memory
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scheduledExpenses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-red-400">Upcoming Expenses</p>
                      {scheduledExpenses.slice(0, 5).map((e, i) => (
                        <div key={`exp-${i}`} className="flex justify-between text-xs">
                          <span className="theme-text-secondary truncate max-w-[60%]">
                            {e.description}
                          </span>
                          <span className="text-red-400 font-medium">
                            -{formatCompactCurrency(e.amount, currency)} •{' '}
                            {new Date(e.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      ))}
                      {scheduledExpenses.length > 5 && (
                        <p className="text-xs theme-text-secondary">
                          +{scheduledExpenses.length - 5} more...
                        </p>
                      )}
                    </div>
                  )}
                  {scheduledIncome.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-emerald-400">Upcoming Income</p>
                      {scheduledIncome.slice(0, 5).map((e, i) => (
                        <div key={`inc-${i}`} className="flex justify-between text-xs">
                          <span className="theme-text-secondary truncate max-w-[60%]">
                            {e.description}
                          </span>
                          <span className="text-emerald-400 font-medium">
                            +{formatCompactCurrency(e.amount, currency)} •{' '}
                            {new Date(e.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      ))}
                      {scheduledIncome.length > 5 && (
                        <p className="text-xs theme-text-secondary">
                          +{scheduledIncome.length - 5} more...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Forecast Chart */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm theme-text-secondary">
                Based on 30-day average cash flow patterns
                {hasScheduledEvents && showScheduledEvents && ' + scheduled events'}
              </p>
              <div className="flex items-center gap-2">
                {hasScheduledEvents && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowScheduledEvents(!showScheduledEvents)}
                    className="text-xs"
                  >
                    {showScheduledEvents ? 'Hide' : 'Show'} Scheduled Events
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfidenceBands(!showConfidenceBands)}
                  className="text-xs"
                >
                  {showConfidenceBands ? 'Hide' : 'Show'} Confidence Bands
                </Button>
              </div>
            </div>

            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />

                  <XAxis
                    dataKey="date"
                    stroke="rgba(148, 163, 184, 0.6)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      const date = new Date(value)
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    stroke="rgba(148, 163, 184, 0.6)"
                    fontSize={11}
                    tickFormatter={(value) => formatCompactCurrency(value, currency)}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Legend
                    iconType="circle"
                    wrapperStyle={{
                      paddingTop: '10px',
                      fontSize: '12px',
                    }}
                  />

                  {/* Zero line */}
                  <ReferenceLine y={0} stroke="rgba(239, 68, 68, 0.5)" strokeDasharray="2 2" />

                  {/* Current cash line */}
                  <ReferenceLine
                    y={currentCash}
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeDasharray="5 5"
                    label={{ value: 'Current', position: 'left', fontSize: 11 }}
                  />

                  {/* Confidence bands */}
                  {showConfidenceBands && (
                    <>
                      <Area
                        dataKey="optimistic"
                        stroke="none"
                        fill="#10b981"
                        fillOpacity={0.1}
                        name="Best Case"
                      />
                      <Area
                        dataKey="pessimistic"
                        stroke="none"
                        fill="#ef4444"
                        fillOpacity={0.1}
                        name="Worst Case"
                      />
                    </>
                  )}

                  {/* Main forecast line */}
                  <Area
                    dataKey="forecast"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#forecastGradient)"
                    name="Expected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast Summary */}
            {insights.criticalDate && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-400 mb-1">Cash Flow Alert</h4>
                    <p className="text-sm theme-text-secondary">
                      At current burn rate, you may run out of cash in approximately{' '}
                      {insights.runwayMonths} months ({insights.runwayDays} days). Consider reducing
                      expenses or securing additional funding.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="scenarios" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="glass-luxury-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Best Case (30 days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-emerald-400">
                    {formatCurrency(insights.thirtyDayOptimistic, { currency })}
                  </div>
                  <p className="text-xs theme-text-secondary mt-1">20% improvement in cash flow</p>
                </CardContent>
              </Card>

              <Card className="glass-luxury-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span>Expected (30 days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-blue-400">
                    {formatCurrency(insights.thirtyDay, { currency })}
                  </div>
                  <p className="text-xs theme-text-secondary mt-1">Based on current trends</p>
                </CardContent>
              </Card>

              <Card className="glass-luxury-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span>Worst Case (30 days)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-400">
                    {formatCurrency(insights.thirtyDayPessimistic, { currency })}
                  </div>
                  <p className="text-xs theme-text-secondary mt-1">20% decline in cash flow</p>
                </CardContent>
              </Card>
            </div>

            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-400 mb-1">Scenario Planning</h4>
                  <p className="text-sm theme-text-secondary">
                    These scenarios help you prepare for different cash flow outcomes. The best case
                    assumes improved collections and reduced expenses, while the worst case accounts
                    for delayed payments and unexpected costs.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Inflow Breakdown */}
              <div>
                <h4 className="text-sm font-semibold theme-text-primary mb-4">
                  Cash Inflow Sources
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm theme-text-primary">Customer Payments</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">
                        {formatCompactCurrency(categoryBreakdown.customers.inflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">80%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                      <span className="text-sm theme-text-primary">Operations</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-400">
                        {formatCompactCurrency(categoryBreakdown.operations.inflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">15%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-gray-400" />
                      <span className="text-sm theme-text-primary">Other</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-400">
                        {formatCompactCurrency(categoryBreakdown.other.inflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">5%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Outflow Breakdown */}
              <div>
                <h4 className="text-sm font-semibold theme-text-primary mb-4">
                  Cash Outflow Categories
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="w-5 h-5 text-red-400" />
                      <span className="text-sm theme-text-primary">Operations</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-400">
                        {formatCompactCurrency(categoryBreakdown.operations.outflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">50%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-orange-400" />
                      <span className="text-sm theme-text-primary">Vendor Payments</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-400">
                        {formatCompactCurrency(categoryBreakdown.vendors.outflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">40%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-500/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Zap className="w-5 h-5 text-gray-400" />
                      <span className="text-sm theme-text-primary">Other</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-400">
                        {formatCompactCurrency(categoryBreakdown.other.outflow, currency)}
                      </p>
                      <p className="text-xs theme-text-secondary">10%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
