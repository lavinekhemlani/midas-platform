'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Lightbulb, CheckCircle, TrendingUp, Sparkles, ArrowRight, BarChart3 } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import type { GlossaryEntry } from '@/lib/data'
import type { JSX } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import Link from 'next/link'
import RevenueChart from '@/app/(main)/components/charts/RevenueChart'
import DailyCashFlowChart from '@/app/(main)/components/charts/DailyCashFlowChart'
import { logger } from '@/lib/logger'

interface GlossaryDetailProps {
  term: GlossaryEntry
  financialData: any
  icon?: React.ElementType
  iconColor?: string
  isCompleted?: boolean
  onComplete?: (timeSpent: number) => void
  displayMode?: 'modal' | 'full'
  onClose?: () => void
  startCloseAnimation?: () => void
  contextData?: Record<string, number> // Optional metric values to use for personalization
}

export default function GlossaryDetail({
  term,
  financialData,
  icon: Icon,
  iconColor,
  isCompleted = false,
  onComplete,
  displayMode = 'full',
  onClose,
  startCloseAnimation,
  contextData,
}: GlossaryDetailProps) {
  const [startTime] = useState(Date.now())
  const [hasMarkedComplete, setHasMarkedComplete] = useState(isCompleted)

  useEffect(() => {
    setHasMarkedComplete(isCompleted)
  }, [isCompleted])

  const handleComplete = () => {
    if (!hasMarkedComplete && onComplete) {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000)
      onComplete(timeSpent)
      setHasMarkedComplete(true)
    }
  }

  const handleDiscussWithAi = () => {
    if (!term || !startCloseAnimation) return
    logger.debug('Adding term to chat', { component: 'GlossaryDetail', term: term.title })
    startCloseAnimation()
  }

  const personalizeText = (template?: string): (string | JSX.Element)[] => {
    if (!template) return []

    // First pass: handle nested conditional expressions like {metric < 30 ? 'a' : metric < 60 ? 'b' : 'c'}
    let processedTemplate = template.replace(
      /\{([a-z_]+)\s*(>=|<=|>|<|===|==)\s*([\d.]+)\s*\?\s*'([^']+)'\s*:\s*([a-z_]+)\s*(>=|<=|>|<|===|==)\s*([\d.]+)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'\}/g,
      (
        match,
        key1,
        operator1,
        threshold1,
        trueValue1,
        key2,
        operator2,
        threshold2,
        trueValue2,
        falseValue2
      ) => {
        let value: number | undefined

        // First, try to get value from contextData (passed from report views)
        if (contextData && key1 in contextData) {
          value = contextData[key1]
        }
        // Fall back to financialData.kpis (from dashboard context)
        else if (financialData?.kpis) {
          const kpi = financialData.kpis.find((k: any) => k.metric === key1)
          if (kpi) {
            value = kpi.value
          }
        }

        if (value !== undefined) {
          const threshold1Num = parseFloat(threshold1)
          const threshold2Num = parseFloat(threshold2)

          // Evaluate first condition
          let condition1 = false
          switch (operator1) {
            case '>=':
              condition1 = value >= threshold1Num
              break
            case '<=':
              condition1 = value <= threshold1Num
              break
            case '>':
              condition1 = value > threshold1Num
              break
            case '<':
              condition1 = value < threshold1Num
              break
            case '===':
            case '==':
              condition1 = value === threshold1Num
              break
          }

          if (condition1) {
            return `__TERNARY_${trueValue1}__`
          }

          // Evaluate second condition
          let condition2 = false
          switch (operator2) {
            case '>=':
              condition2 = value >= threshold2Num
              break
            case '<=':
              condition2 = value <= threshold2Num
              break
            case '>':
              condition2 = value > threshold2Num
              break
            case '<':
              condition2 = value < threshold2Num
              break
            case '===':
            case '==':
              condition2 = value === threshold2Num
              break
          }

          const result = condition2 ? trueValue2 : falseValue2
          return `__TERNARY_${result}__`
        }
        return match
      }
    )

    // Second pass: handle simple conditional expressions like {metric >= value ? 'true' : 'false'}
    processedTemplate = processedTemplate.replace(
      /\{([a-z_]+)\s*(>=|<=|>|<|===|==)\s*([\d.]+)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'\}/g,
      (match, key, operator, threshold, trueValue, falseValue) => {
        let value: number | undefined

        // First, try to get value from contextData (passed from report views)
        if (contextData && key in contextData) {
          value = contextData[key]
        }
        // Fall back to financialData.kpis (from dashboard context)
        else if (financialData?.kpis) {
          const kpi = financialData.kpis.find((k: any) => k.metric === key)
          if (kpi) {
            value = kpi.value
          }
        }

        if (value !== undefined) {
          const thresholdNum = parseFloat(threshold)

          let condition = false
          switch (operator) {
            case '>=':
              condition = value >= thresholdNum
              break
            case '<=':
              condition = value <= thresholdNum
              break
            case '>':
              condition = value > thresholdNum
              break
            case '<':
              condition = value < thresholdNum
              break
            case '===':
            case '==':
              condition = value === thresholdNum
              break
          }

          const result = condition ? trueValue : falseValue
          return `__TERNARY_${result}__`
        }
        return match
      }
    )

    // Split by placeholders, capturing:
    // - Ternary result markers __TERNARY_xxx__
    // - Arithmetic expressions like {100 - debt_ratio}%
    // - Simple placeholders like {key}, {key}%, or {key} cents
    // The "cents" pattern is to accommodate expense_ratio which uses both {expense_ratio}% and {expense_ratio} cents in the same template
    return processedTemplate
      .split(/(__TERNARY_[^_]+__|\{(?:\d+\s*[-+]\s*)?\w+\}%?(?:\s+cents)?)/g)
      .map((part, index) => {
        // Handle ternary result markers
        const ternaryMatch = part.match(/^__TERNARY_([^_]+)__$/)
        if (ternaryMatch) {
          return (
            <span key={index} className="font-bold text-amber-400">
              {ternaryMatch[1]}
            </span>
          )
        }

        // Check for arithmetic expression like {100 - debt_ratio}%
        const arithmeticMatch = part.match(/^\{(\d+)\s*([-+])\s*(\w+)\}(%?)$/)

        if (arithmeticMatch) {
          const [, num, operator, key, trailingPercent] = arithmeticMatch
          let value: number | undefined

          // First, try to get value from contextData (passed from report views)
          if (contextData && key in contextData) {
            value = contextData[key]
          }
          // Fall back to financialData.kpis (from dashboard context)
          else if (financialData?.kpis) {
            const kpi = financialData.kpis.find((k: any) => k.metric === key)
            if (kpi) {
              value = kpi.value
            }
          }

          if (value !== undefined) {
            const numValue = parseFloat(num)
            const result = operator === '-' ? numValue - value : numValue + value
            const displayValue = result.toFixed(1)
            const suffix = trailingPercent ? '%' : ''
            return (
              <span key={index} className="font-bold text-amber-400">
                {displayValue}
                {suffix}
              </span>
            )
          }
          return (
            <span key={index} className="font-bold text-amber-400">
              [calculation]{trailingPercent ? '%' : ''}
            </span>
          )
        }

        // Check if this part matches {key}, {key}%, or {key} cents
        const placeholderMatch = part.match(/^\{(\w+)\}(%?)(\s+cents)?$/)

        if (placeholderMatch) {
          const key = placeholderMatch[1]
          const hasTrailingPercent = placeholderMatch[2] === '%'
          const hasTrailingCents = !!placeholderMatch[3]
          let value: number | undefined

          // First, try to get value from contextData (passed from report views)
          if (contextData && key in contextData) {
            value = contextData[key]
          }
          // Fall back to financialData.kpis (from dashboard context)
          else if (financialData?.kpis) {
            const kpi = financialData.kpis.find((k: any) => k.metric === key)
            if (kpi) {
              value = kpi.value
            }
          }

          if (value !== undefined) {
            const isCurrency = [
              'total_revenue',
              'arr',
              'gross_profit',
              'cash_balance',
              'ocf',
              'burn_rate',
              'net_flow',
              'daily_inflow',
              'daily_outflow',
            ].includes(key)
            const isPercentage =
              key.includes('_pct') ||
              key.includes('margin') ||
              key.includes('growth') ||
              key === 'roe' ||
              key === 'churn' ||
              key === 'expense_ratio' ||
              key === 'ocf_ratio' ||
              key === 'cf_coverage' ||
              key === 'debt_ratio' ||
              key === 'ocf_margin' ||
              key === 'net_profit_margin'
            const isMonths = key.includes('_months')
            let displayValue = ''

            if (isCurrency) {
              displayValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: financialData?.currency || 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(value)
            } else if (isPercentage) {
              // Only add % if not already present in template and not followed by "cents"
              if (hasTrailingPercent || hasTrailingCents) {
                displayValue = value.toFixed(1)
              } else {
                displayValue = `${value.toFixed(1)}%`
              }
            } else if (key === 'runway_months') {
              // Runway months - show one decimal place for precision
              displayValue = value.toFixed(1)
            } else if (isMonths) {
              displayValue = `${value.toFixed(1)}`
            } else {
              displayValue = value.toLocaleString()
            }

            const suffix = hasTrailingPercent ? '%' : hasTrailingCents ? ' cents' : ''
            return (
              <span key={index} className="font-bold text-amber-400">
                {displayValue}
                {suffix}
              </span>
            )
          }
          const suffix = hasTrailingPercent ? '%' : hasTrailingCents ? ' cents' : ''
          return (
            <span key={index} className="font-bold text-amber-400">
              [your data]{suffix}
            </span>
          )
        }
        return part
      })
  }

  const getIconColorClass = (color?: string) => {
    switch (color) {
      case 'emerald':
      case 'green':
        return 'text-theme-green'
      case 'blue':
        return 'text-theme-blue'
      case 'purple':
        return 'text-theme-purple'
      case 'amber':
        return 'text-theme-yellow'
      case 'orange':
        return 'text-theme-yellow'
      case 'cyan':
        return 'text-cyan-500'
      case 'red':
        return 'text-theme-red'
      default:
        return 'theme-text-primary'
    }
  }

  const getIconBgClass = (color?: string) => {
    switch (color) {
      case 'emerald':
      case 'green':
        return 'bg-theme-green/10'
      case 'blue':
        return 'bg-theme-blue/10'
      case 'purple':
        return 'bg-theme-purple/10'
      case 'amber':
        return 'bg-theme-yellow/10'
      case 'orange':
        return 'bg-theme-yellow/10'
      case 'cyan':
        return 'bg-cyan-500/10'
      case 'red':
        return 'bg-theme-red/10'
      default:
        return 'bg-amber-500/10'
    }
  }

  const renderVisualExample = () => {
    if (financialData && term.visualCue) {
      let chartComponent = null
      let chartTitle = 'Live Example from Your Data'
      let ChartIcon: React.ElementType = BarChart3
      switch (term.visualCue) {
        case 'RevenueChart':
          chartTitle = 'Your Revenue vs. Expenses Trend'
          ChartIcon = BarChart3
          chartComponent = (
            <RevenueChart
              data={financialData.charts.revenueExpenseTrend}
              currency={financialData.currency}
            />
          )
          break
        case 'DailyCashFlowChart':
          chartTitle = 'Your Daily Cash Flow (Last 30 Days)'
          ChartIcon = TrendingUp
          chartComponent = (
            <DailyCashFlowChart
              data={financialData.charts.dailyCashFlow}
              currency={financialData.currency}
            />
          )
          break
      }
      if (chartComponent) {
        return (
          <Card className="chart-container learn-modal-card">
            <CardHeader className="pb-4">
              <CardTitle className="chart-title theme-text-primary">
                <ChartIcon className="w-5 h-5 text-amber-500 mr-2" />
                {chartTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>{chartComponent}</CardContent>
          </Card>
        )
      }
    }
    return (
      <Card className="learn-modal-card">
        <CardHeader>
          <CardTitle className="theme-text-primary text-lg">Startup Example</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="leading-relaxed theme-text-primary">
            {personalizeText(term.examples.startup)}
          </p>
        </CardContent>
      </Card>
    )
  }

  const generateAiInsight = () => {
    if (!financialData?.kpis) {
      return (
        <ul className="list-disc list-inside text-sm theme-text-primary space-y-2">
          <li>Unlock AI Insights by connecting your financial data.</li>
          <li>
            This Pro feature helps you understand how key metrics specifically impact your
            business's health and potential for growth.
          </li>
        </ul>
      )
    }
    const findKpi = (metric: string) => financialData.kpis.find((k: any) => k.metric === metric)
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: financialData.currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    const insights: string[] = []
    switch (term.id) {
      case 'profit':
        const profit = findKpi('gross_profit')
        const revenue = findKpi('total_revenue')
        if (profit && revenue && revenue.value > 0) {
          const profitMargin = (profit.value / revenue.value) * 100
          insights.push(
            `Your profit of ${formatCurrency(profit.value)} on ${formatCurrency(revenue.value)} in revenue indicates a profit margin of ${profitMargin.toFixed(1)}%.`,
            `This margin is the final measure of profitability after all costs. To improve it, focus on increasing high-margin sales or reducing operating expenses.`
          )
        } else {
          insights.push(
            'Connect more comprehensive financial data to generate a detailed profit analysis.'
          )
        }
        break
      case 'dso':
        const dso = findKpi('dso')
        if (dso) {
          insights.push(
            `Your current Days Sales Outstanding (DSO) is ${dso.value.toFixed(0)} days. This is the average time it takes your customers to pay you after a sale.`,
            `A high DSO can strain cash flow. Consider offering early payment discounts or tightening credit terms to reduce this to the SaaS industry benchmark of ~30-45 days.`
          )
        } else {
          insights.push('We need Accounts Receivable data to calculate and analyze your DSO.')
        }
        break
      case 'runway':
        const runway = findKpi('runway_months')
        const burn = findKpi('ocf')
        if (runway && burn) {
          insights.push(
            `With a runway of ${runway.value.toFixed(1)} months, your immediate focus should be on managing your monthly cash flow, which was ${formatCurrency(burn.value)} last month.`,
            `Even a 10% reduction in monthly burn could extend your operational runway by several weeks.`
          )
        }
        break
      default:
        insights.push(
          `This Pro feature provides actionable advice based on your live data.`,
          `It can correlate this metric with other key KPIs, providing deeper context on your business performance.`
        )
    }
    return (
      <ul className="list-disc list-inside text-sm theme-text-primary space-y-2">
        {insights.map((insight, index) => (
          <li key={index}>{insight}</li>
        ))}
      </ul>
    )
  }

  // Provide default contextualSubtitle for ARR if missing
  const defaultSubtitles: Record<string, string> = {
    arr: 'Your annual recurring revenue is {arr}.',
    net_profit_margin: 'Your net profit margin is {net_profit_margin}.',
  }

  const contextualSubtitle = personalizeText(
    term.contextualSubtitle || defaultSubtitles[term.id] || ''
  )

  return (
    <ScrollArea className="flex-1 h-full w-full">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <div
                  className={`w-10 h-10 rounded-lg ${getIconBgClass(iconColor)} flex items-center justify-center`}
                >
                  {React.createElement(Icon, {
                    className: `w-5 h-5 ${iconColor ? getIconColorClass(iconColor) : 'text-theme-yellow'}`,
                  })}
                </div>
              )}
              <h1 className="text-2xl font-bold theme-text-primary">{term.title}</h1>
            </div>
            {term.category && (
              <Badge
                variant="outline"
                className="text-xs font-medium theme-text-secondary"
                style={{ borderColor: 'var(--theme-card-border)' }}
              >
                {term.category}
              </Badge>
            )}
          </div>
          {displayMode === 'full' && (
            <Button
              onClick={handleComplete}
              disabled={hasMarkedComplete}
              variant="outline"
              size="icon"
              className={`flex-shrink-0 rounded-full w-10 h-10 ${hasMarkedComplete ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'hover:bg-amber-500/10'}`}
              title={hasMarkedComplete ? 'Completed' : 'Mark as Complete'}
            >
              <CheckCircle className="w-5 h-5" />
            </Button>
          )}
          {contextualSubtitle && (
            <Card className="mt-4 learn-modal-card shadow-sm">
              <CardContent className="p-3 flex items-start space-x-3">
                <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm theme-text-primary">{contextualSubtitle}</p>
              </CardContent>
            </Card>
          )}
        </div>
        <Card className="mb-4 learn-modal-card shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-amber-500" />
              </div>
              <CardTitle className="text-sm font-semibold theme-text-primary">
                Simple Explanation
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm leading-relaxed theme-text-secondary italic border-l-2 border-white/10 pl-3">
              "{term.definitions.metaphor}"
            </p>
          </CardContent>
        </Card>

        {displayMode === 'modal' ? (
          <div className="space-y-6">
            <Card className="learn-modal-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                  </div>
                  <CardTitle className="text-base font-semibold theme-text-primary">
                    Definition
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed theme-text-primary">
                  {term.definitions.basic}
                </p>
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                  <Link href={`/learn/${term.id}`} passHref>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      className="group bg-white/5 hover:bg-white/10 border-white/20 hover:border-white/30"
                    >
                      <span className="text-sm theme-text-primary">View Full Details</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1 theme-text-primary" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="definition" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
              <TabsTrigger value="definition">Definition</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="context">Founder's Insight</TabsTrigger>
            </TabsList>
            <TabsContent value="definition" className="space-y-6">
              <Card className="learn-modal-card">
                <CardHeader className="pb-3">
                  <CardTitle className="theme-text-primary text-lg">What It Is</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-base leading-relaxed theme-text-primary">
                    {term.definitions.basic}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="examples" className="space-y-6">
              {renderVisualExample()}
            </TabsContent>
            <TabsContent value="context" className="space-y-6">
              <Card className="learn-modal-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <CardTitle className="theme-text-primary text-lg">AI-Powered Insight</CardTitle>
                  </div>
                  <Badge className="bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    PRO
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">{generateAiInsight()}</CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ScrollArea>
  )
}
