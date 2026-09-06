// src/app/(main)/learn/[term]/page.tsx
'use client'

import { useState, use } from 'react'
import { useLearnTerm, useRelatedTerms } from '@/hooks/useLearnData'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import type { GlossaryEntry } from '@/lib/data'
import { useFinancialData } from '@/contexts/FinancialDataContext'
import { useSession } from '@/hooks/useSession'
import { TermCard } from '@/components/learn/core/TermCard'
import { useCashFlow, useBalanceSheet, useProfitLossData } from '@/hooks/useReportData'
import { ReportsContext } from '@/contexts/ReportsContext'
import { useContext } from 'react'
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  TrendingUp,
  Calculator,
  ChevronRight,
  Copy,
  Check,
  Target,
  BarChart3,
  Activity,
  DollarSign,
  Zap,
  Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function TermMasterclassPage({ params }: { params: Promise<{ term: string }> }) {
  const resolvedParams = use(params)
  const { term: termId } = resolvedParams
  const router = useRouter()
  const { status } = useSession()
  const { financialData } = useFinancialData()

  // Get date range - use reports context if available, otherwise default to current month
  const reportsContext = useContext(ReportsContext)

  let dateRange = { start: '', end: '' }

  if (reportsContext) {
    dateRange = reportsContext.dateRange
  }

  if (!dateRange.start || !dateRange.end) {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    dateRange = {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
    }
  }

  const { reportData: cashFlowData } = useCashFlow(dateRange.start, dateRange.end)
  const { reportData: balanceSheetData } = useBalanceSheet(dateRange.end)
  const { reportData: pnlData } = useProfitLossData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end,
  })

  const cfMetrics = cashFlowData?.data?.kpis || {}
  const bsMetrics = balanceSheetData?.data?.kpis || {}
  const pnlMetrics = pnlData?.data?.kpis || {}

  const periodMonths =
    dateRange.start && dateRange.end
      ? Math.max(
          1,
          Math.round(
            Math.abs(new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) /
              (1000 * 60 * 60 * 24 * 30)
          )
        )
      : 1

  const cashBalance = pnlMetrics.cashBalance || cfMetrics.cashEnding || bsMetrics.cashBalance || 0
  const grossBurnRate = pnlMetrics.totalExpenses
    ? Math.abs(pnlMetrics.totalExpenses) / periodMonths
    : 0
  const runwayMonths = cashBalance && grossBurnRate > 0 ? cashBalance / grossBurnRate : 0

  let contextData = {}

  if (typeof window !== 'undefined') {
    const storedMetrics = sessionStorage.getItem('reportMetrics')
    if (storedMetrics) {
      try {
        const parsed = JSON.parse(storedMetrics)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 15 * 60 * 1000) {
          contextData = parsed.data || {}
        }
      } catch (e) {
        logger.error('Error parsing stored metrics', { error: e, component: 'LearnTermPage' })
      }
    }
  }

  if (Object.keys(contextData).length === 0) {
    contextData = {
      total_revenue: pnlMetrics.totalRevenue || 0,
      total_expenses: pnlMetrics.totalExpenses || 0,
      gross_profit: pnlMetrics.grossProfit || 0,
      gross_margin_pct: pnlMetrics.grossMargin || 0,
      operating_margin_pct: pnlMetrics.operatingMargin || 0,
      net_income: pnlMetrics.netIncome || 0,
      net_profit_margin: pnlMetrics.netProfitMargin || 0,
      revenue_growth: pnlMetrics.revenueGrowth || 0,
      expense_growth: pnlMetrics.expenseGrowth || 0,
      expense_ratio: pnlMetrics.expenseRatio || 0,
      ebitda: pnlMetrics.ebitda || 0,
      ocf: cfMetrics.operatingCashFlow || 0,
      cash_balance: cashBalance,
      burn_rate: grossBurnRate,
      runway_months: runwayMonths,
      free_cash_flow: cfMetrics.freeCashFlow || 0,
      ocf_margin: cfMetrics.ocfMargin || 0,
      ocf_ratio: cfMetrics.ocfRatio || 0,
      cf_coverage: cfMetrics.cfCoverage || 0,
      current_ratio: bsMetrics.currentRatio || 0,
      quick_ratio: bsMetrics.quickRatio || 0,
      working_capital: bsMetrics.workingCapital || 0,
      debt_to_equity: bsMetrics.debtToEquity || 0,
      debt_ratio: bsMetrics.debtRatio || 0,
      equity_multiplier: bsMetrics.equityMultiplier || 0,
      return_on_equity: bsMetrics.returnOnEquity || 0,
      roe: bsMetrics.returnOnEquity || 0,
      asset_turnover: bsMetrics.assetTurnover || 0,
      dso: cfMetrics.dso || bsMetrics.dso || 0,
      dpo: cfMetrics.dpo || bsMetrics.dpo || 0,
      cash_conversion_cycle: cfMetrics.cashConversionCycle || 0,
      arr: pnlMetrics.arr || 0,
      mrr: pnlMetrics.mrr || 0,
      ltv: pnlMetrics.ltv || 0,
      cac: pnlMetrics.cac || 0,
      churn: pnlMetrics.churn || 0,
    }
  }

  const { term, isLoading, error } = useLearnTerm(termId)
  const { relatedTerms } = useRelatedTerms(term?.relatedTerms || [])

  const [copiedFormula, setCopiedFormula] = useState(false)

  const loading = isLoading

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    if (difficulty <= 3) return 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    return 'text-red-500 bg-red-500/10 border-red-500/20'
  }

  const getDifficultyLabel = (difficulty: number) => {
    if (difficulty <= 2) return 'Beginner'
    if (difficulty <= 3) return 'Intermediate'
    return 'Advanced'
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      fundamentals: BookOpen,
      metrics: BarChart3,
      'cash-flow': DollarSign,
      operations: Activity,
      strategy: Target,
      fundraising: TrendingUp,
    }
    const Icon = icons[category.toLowerCase()] || Hash
    return <Icon className="w-4 h-4" />
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      fundamentals: 'text-blue-500 bg-blue-500/8 border-blue-500/20',
      metrics: 'text-purple-500 bg-purple-500/8 border-purple-500/20',
      'cash-flow': 'text-green-500 bg-green-500/8 border-green-500/20',
      operations: 'text-orange-500 bg-orange-500/8 border-orange-500/20',
      strategy: 'text-red-500 bg-red-500/8 border-red-500/20',
      fundraising: 'text-indigo-500 bg-indigo-500/8 border-indigo-500/20',
    }
    return colors[category.toLowerCase()] || 'text-slate-500 bg-slate-500/8 border-slate-500/20'
  }

  const copyFormula = (formula: string) => {
    navigator.clipboard.writeText(formula)
    setCopiedFormula(true)
    setTimeout(() => setCopiedFormula(false), 2000)
  }

  // Process text to replace placeholders with actual values
  const processTextWithMetrics = (text: string): string => {
    if (!text || typeof text !== 'string') return text

    let processedText = text.replace(
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
        if (contextData && key1 in contextData) {
          const value = contextData[key1 as keyof typeof contextData] as number
          const threshold1Num = parseFloat(threshold1)
          const threshold2Num = parseFloat(threshold2)

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
            return `<span class="text-amber-500 font-semibold">${trueValue1}</span>`
          }

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
          return `<span class="text-amber-500 font-semibold">${result}</span>`
        }
        return match
      }
    )

    processedText = processedText.replace(
      /\{([a-z_]+)\s*(>=|<=|>|<|===|==)\s*([\d.]+)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'\}/g,
      (match, key, operator, threshold, trueValue, falseValue) => {
        if (contextData && key in contextData) {
          const value = contextData[key as keyof typeof contextData] as number
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
          return `<span class="text-amber-500 font-semibold">${result}</span>`
        }
        return match
      }
    )

    processedText = processedText.replace(
      /\{(100)\s*-\s*([a-z_]+)\}(%?)/g,
      (match, num, key, trailingPercent) => {
        if (contextData && key in contextData) {
          const value = contextData[key as keyof typeof contextData] as number
          const result = parseFloat(num) - value
          const formattedValue = result.toFixed(1)
          const suffix = trailingPercent ? '%' : ''
          return `<span class="text-amber-500 font-semibold">${formattedValue}${suffix}</span>`
        }
        return match
      }
    )

    processedText = processedText.replace(
      /\{([a-z_]+)\}(%?)(\s+cents)?/g,
      (match, key, trailingPercent, trailingCents) => {
        let value: number | undefined

        if (contextData && key in contextData) {
          value = contextData[key as keyof typeof contextData] as number
        }

        if (value !== undefined) {
          let formattedValue = ''
          const hasTrailingPercent = trailingPercent === '%'
          const hasTrailingCents = !!trailingCents

          if (
            key === 'current_ratio' ||
            key === 'quick_ratio' ||
            key === 'debt_to_equity' ||
            key === 'equity_multiplier' ||
            key === 'asset_turnover'
          ) {
            formattedValue = value.toFixed(2)
          } else if (
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
          ) {
            if (hasTrailingPercent || hasTrailingCents) {
              formattedValue = value.toFixed(1)
            } else {
              formattedValue = `${value.toFixed(1)}%`
            }
          } else if (key === 'runway_months') {
            formattedValue = value.toFixed(1)
          } else if (key === 'dso' || key === 'dpo' || key === 'cash_conversion_cycle') {
            formattedValue = value.toFixed(0)
          } else {
            formattedValue = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value)
          }

          const suffix = hasTrailingPercent ? '%' : hasTrailingCents ? ' cents' : ''
          return `<span class="text-amber-500 font-semibold">${formattedValue}${suffix}</span>`
        }

        return match
      }
    )

    return processedText
  }

  if (loading) {
    return null
  }

  if (error || (!loading && !term)) {
    const isNotFound = error?.status === 404
    return (
      <div className="min-h-screen py-6 px-4">
        <div className="max-w-md mx-auto">
          <div className="glass-luxury-card border border-red-500/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold theme-text-primary mb-1">
                  {isNotFound ? 'Content Not Found' : 'Loading Error'}
                </h2>
                <p className="text-sm theme-text-secondary mb-4">
                  {isNotFound
                    ? 'The requested learning content could not be found.'
                    : error?.message || 'Unable to load this content'}
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push('/learn')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Learning Hub
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="learn-term-page min-h-screen">
      {/* ─── HERO: Full-width header with strong typographic hierarchy ─── */}
      <div className="learn-term-hero">
        <div className="learn-term-hero-inner">
          {/* Navigation breadcrumb */}
          <nav className="learn-term-nav">
            <button onClick={() => router.push('/learn')} className="learn-term-back-link">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Learn</span>
            </button>
            <span className="learn-term-nav-sep">/</span>
            <span className="learn-term-nav-current">{term.category}</span>
          </nav>

          {/* Title block */}
          <div className="learn-term-title-block">
            <div className="learn-term-badges">
              <span className={cn('learn-term-badge', getCategoryColor(term.category))}>
                {getCategoryIcon(term.category)}
                {term.category}
              </span>
              <span className={cn('learn-term-badge', getDifficultyColor(term.difficulty || 2))}>
                {getDifficultyLabel(term.difficulty || 2)}
              </span>
            </div>

            <h1 className="learn-term-title">{term.title}</h1>

            <p
              className="learn-term-subtitle"
              dangerouslySetInnerHTML={{
                __html: processTextWithMetrics(term.definitions.contextual),
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── ARTICLE BODY: Single-column, scroll-driven layout ─── */}
      <div className="learn-term-body">
        <div className="learn-term-content">
          {/* ── Section 01: Foundation ── */}
          <section className="learn-term-section">
            <div className="learn-term-section-header">
              <span className="learn-term-section-number">01</span>
              <h2 className="learn-term-section-title">Foundation</h2>
            </div>
            <div className="learn-term-section-body">
              <p
                className="learn-term-prose"
                dangerouslySetInnerHTML={{
                  __html: processTextWithMetrics(term.definitions.basic),
                }}
              />
            </div>
          </section>

          {/* ── Metaphor Pull-quote ── */}
          {term.definitions.metaphor && (
            <aside className="learn-term-pullquote">
              <div className="learn-term-pullquote-icon">
                <Lightbulb className="w-5 h-5" />
              </div>
              <blockquote>
                <p
                  dangerouslySetInnerHTML={{
                    __html: processTextWithMetrics(term.definitions.metaphor),
                  }}
                />
              </blockquote>
            </aside>
          )}

          {/* ── Formula Block (if exists) ── */}
          {(term as any).formula && (
            <div className="learn-term-formula">
              <div className="learn-term-formula-label">
                <Calculator className="w-3.5 h-3.5" />
                <span>Formula</span>
              </div>
              <div className="learn-term-formula-content">
                <code>{(term as any).formula}</code>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="learn-term-formula-copy"
                        onClick={() => copyFormula((term as any).formula!)}
                      >
                        {copiedFormula ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{copiedFormula ? 'Copied!' : 'Copy formula'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          )}

          {/* ── Section 02: In Practice ── */}
          <section className="learn-term-section">
            <div className="learn-term-section-header">
              <span className="learn-term-section-number">02</span>
              <h2 className="learn-term-section-title">In Practice</h2>
            </div>
            <div className="learn-term-section-body">
              {/* Personalized context card */}
              {financialData && (
                <div className="learn-term-context-card">
                  <div className="learn-term-context-indicator">
                    <Activity className="w-4 h-4" />
                    <span>Based on your data</span>
                  </div>
                  <p
                    className="learn-term-prose"
                    dangerouslySetInnerHTML={{
                      __html: processTextWithMetrics(term.examples.startup),
                    }}
                  />
                </div>
              )}

              <div className="learn-term-example">
                <h4 className="learn-term-example-label">Example Scenario</h4>
                <p
                  className="learn-term-prose"
                  dangerouslySetInnerHTML={{
                    __html: processTextWithMetrics(
                      (term.examples as any).enterprise || term.examples.startup
                    ),
                  }}
                />
              </div>
            </div>
          </section>

          {/* ── Section 03: Key Takeaways ── */}
          <section className="learn-term-section">
            <div className="learn-term-section-header">
              <span className="learn-term-section-number">03</span>
              <h2 className="learn-term-section-title">Key Takeaways</h2>
            </div>
            <div className="learn-term-section-body">
              <ul className="learn-term-takeaways">
                <li>
                  <span className="learn-term-takeaway-marker" />
                  <p>
                    Track this metric {term.category === 'metrics' ? 'daily' : 'regularly'} for
                    optimal financial health
                  </p>
                </li>
                <li>
                  <span className="learn-term-takeaway-marker" />
                  <p>Set alerts when values exceed normal thresholds</p>
                </li>
                <li>
                  <span className="learn-term-takeaway-marker" />
                  <p>Review trends monthly to identify patterns</p>
                </li>
              </ul>
            </div>
          </section>

          {/* ── Next Steps ── */}
          <div className="learn-term-actions">
            <Button
              variant="outline"
              className="learn-term-action-btn"
              onClick={() => router.push('/dashboard')}
            >
              <BarChart3 className="w-4 h-4" />
              <span>View in Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
            </Button>
            <Button
              variant="outline"
              className="learn-term-action-btn"
              onClick={() => router.push('/learn')}
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore More Topics</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
            </Button>
          </div>

          {/* ── Related Concepts ── */}
          {relatedTerms.length > 0 && (
            <section className="learn-term-related">
              <h3 className="learn-term-related-title">Continue Learning</h3>
              <div className="learn-term-related-grid">
                {relatedTerms.map((relatedTerm) => (
                  <TermCard key={relatedTerm.id} term={relatedTerm} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
