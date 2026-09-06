'use client'

import { useState, useMemo, useEffect, useCallback, type SetStateAction } from 'react'
import { useBCBalanceSheet } from '../../hooks/useBCBalanceSheet'
import { useBCIncomeStatement } from '../../hooks/useBCIncomeStatement'
import { useBCEnhancedData } from '../../hooks/useBCEnhancedData'
import { FinancialRatiosCard } from '../../reports/components/FinancialRatiosCard'
import { EfficiencyMetricsCard } from '../../reports/components/EfficiencyMetricsCard'
import { FinancialHealthScoreCard } from '../../reports/components/FinancialHealthScoreCard'
import { AgedReceivablesCard } from '../../reports/components/AgedReceivablesCard'
import { AgedPayablesCard } from '../../reports/components/AgedPayablesCard'
import {
  CollapsibleStatementTable,
  type StatementLine,
} from '../../reports/components/CollapsibleStatementTable'
import { BalanceSheetPDF, BalanceSheetExportButtons, AccountDetailDrawer } from '../components'
import { calculateFinancialHealthScore } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import type { FinancialRatios } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import Link from 'next/link'
import { AlertCircle, RefreshCw, Calendar, ChevronDown, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { InfoTooltip, type InfoTooltipProps } from '@/components/ui/InfoTooltip'
import { useTheme } from '@/hooks/useTheme'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../components/PeriodPicker'
import { pdf } from '@react-pdf/renderer'

export function BCOAuthBalanceSheetView({ connectionId }: { connectionId: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const borderClass = isLight ? 'border-stone-200' : 'border-white/[0.08]'
  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<StatementLine | null>(null)

  const handleAccountClick = useCallback((line: StatementLine) => {
    if (line._accountNumber) {
      setSelectedAccount((prev) => (prev?._accountNumber === line._accountNumber ? null : line))
    }
  }, [])

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const endDate = dateRange.endDate

  const {
    lines,
    totals,
    companyName,
    currency: bsCurrency,
    isLoading,
    error,
    mutate,
  } = useBCBalanceSheet(connectionId, endDate)
  const pnl = useBCIncomeStatement(connectionId, dateRange)
  const enhanced = useBCEnhancedData(connectionId, dateRange)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    const hasData = !!totals
    const allDoneLoading = !isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [welcomeContext, isLoading, totals])

  const currency = bsCurrency || 'USD'

  const mutateAll = () => {
    mutate()
    pnl.mutate()
    enhanced.mutate()
  }

  // Merge financial ratios: server-side + client-side margins from P&L
  const mergedRatios = useMemo((): FinancialRatios | null => {
    const serverRatios = enhanced.financialRatios
    if (!serverRatios && !pnl.totals) return null

    const revenue = pnl.totals?.totalRevenue ?? 0
    return {
      currentRatio: serverRatios?.currentRatio ?? null,
      quickRatio: serverRatios?.quickRatio ?? null,
      debtToEquity: serverRatios?.debtToEquity ?? null,
      workingCapital: serverRatios?.workingCapital ?? 0,
      grossMargin: revenue > 0 && pnl.totals ? (pnl.totals.grossProfit / revenue) * 100 : null,
      netMargin: revenue > 0 && pnl.totals ? (pnl.totals.netIncome / revenue) * 100 : null,
      operatingMargin:
        revenue > 0 && pnl.totals ? (pnl.totals.operatingIncome / revenue) * 100 : null,
      currentAssets: serverRatios?.currentAssets,
      currentLiabilities: serverRatios?.currentLiabilities,
      inventory: serverRatios?.inventory,
      totalLiabilities: serverRatios?.totalLiabilities,
      totalEquity: serverRatios?.totalEquity,
    }
  }, [enhanced.financialRatios, pnl.totals])

  // Compute financial health score
  const healthScore = useMemo(() => {
    return calculateFinancialHealthScore(
      mergedRatios,
      enhanced.efficiencyMetrics,
      enhanced.cashRunwayData,
      pnl.totals ? { totalRevenue: pnl.totals.totalRevenue, netIncome: pnl.totals.netIncome } : null
    )
  }, [mergedRatios, enhanced.efficiencyMetrics, enhanced.cashRunwayData, pnl.totals])

  // Filter out the diagnostic "Balance Check (A - L - E)" line for production view
  // and use it for the balance indicator badge instead
  const filteredLines = useMemo(() => {
    return lines.filter((l) => l.display !== 'Balance Check (A - L - E)')
  }, [lines])

  const balanceCheck = useMemo(() => {
    const checkLine = lines.find((l) => l.display === 'Balance Check (A - L - E)')
    if (!checkLine) return undefined
    return {
      isBalanced: Math.abs(checkLine.balance) < 0.01,
      difference: checkLine.balance,
    }
  }, [lines])

  // Tooltip data builders
  const ratiosTooltipProps = useMemo(() => {
    if (!mergedRatios) return undefined
    return {
      description:
        'Key financial ratios measuring liquidity, leverage, and profitability from the balance sheet and income statement.',
      calculationTooltip: {
        formula: 'Current Ratio = Current Assets ÷ Current Liabilities',
        components: [
          {
            label: 'Current Ratio',
            value:
              mergedRatios.currentRatio !== null ? mergedRatios.currentRatio.toFixed(2) : 'N/A',
          },
          {
            label: 'Quick Ratio',
            value: mergedRatios.quickRatio !== null ? mergedRatios.quickRatio.toFixed(2) : 'N/A',
          },
          {
            label: 'Debt-to-Equity',
            value:
              mergedRatios.debtToEquity !== null ? mergedRatios.debtToEquity.toFixed(2) : 'N/A',
          },
          {
            label: 'Working Capital',
            value: formatCompactCurrency(mergedRatios.workingCapital, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Balance Sheet accounts & Income Statement. Margins derived from P&L totals.',
    }
  }, [mergedRatios, currency])

  const efficiencyTooltipProps = useMemo(() => {
    const m = enhanced.efficiencyMetrics
    if (!m) return undefined
    return {
      description:
        'Efficiency metrics show how effectively the company converts resources into revenue and collects payments.',
      calculationTooltip: {
        formula: 'DSO = (Receivables ÷ Revenue) × Days',
        components: [
          {
            label: 'Days Sales Outstanding',
            value: m.dso !== null ? `${m.dso.toFixed(0)} days` : 'N/A',
          },
          {
            label: 'Days Payable Outstanding',
            value: m.dpo !== null ? `${m.dpo.toFixed(0)} days` : 'N/A',
          },
          {
            label: 'Cash Conversion Cycle',
            value:
              m.cashConversionCycle !== null ? `${m.cashConversionCycle.toFixed(0)} days` : 'N/A',
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Balance Sheet (AR/AP) and Income Statement (Revenue/COGS). Lower DSO and CCC generally indicate better efficiency.',
    }
  }, [enhanced.efficiencyMetrics])

  const healthScoreTooltipProps = useMemo(() => {
    if (!healthScore) return undefined
    return {
      description:
        'Composite financial health score (0-100) based on liquidity ratios, profitability margins, and efficiency metrics.',
      calculationTooltip: {
        formula: 'Score = Weighted Average of Liquidity + Profitability + Efficiency',
        components: [
          { label: 'Overall Score', value: `${healthScore.score}/100`, highlight: true },
          { label: 'Rating', value: healthScore.rating },
          { label: 'Components', value: Object.keys(healthScore.components).length.toString() },
        ],
      },
      note: 'Source: Derived from BC financial ratios, margins, and efficiency metrics. Benchmarks based on general industry standards.',
    }
  }, [healthScore])

  const agedReceivablesTooltipProps = useMemo(() => {
    const ar = enhanced.agedReceivables
    if (!ar) return undefined
    return {
      description:
        'Accounts receivable aged by due date. All amounts in Local Currency (LCY), converted by Business Central from multi-currency invoices.',
      calculationTooltip: {
        formula: 'Total AR (LCY) from BC agedAccountsReceivables report',
        components: [
          { label: 'Current', value: formatCompactCurrency(ar.current || 0, currency) },
          { label: '1-30 Days', value: formatCompactCurrency(ar.days_1_30 || 0, currency) },
          { label: '31-60 Days', value: formatCompactCurrency(ar.days_31_60 || 0, currency) },
          {
            label: '61+ Days',
            value: formatCompactCurrency(
              ar.total - ar.current - ar.days_1_30 - ar.days_31_60,
              currency
            ),
          },
          {
            label: 'Total AR (LCY)',
            value: formatCompactCurrency(ar.total || 0, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC agedAccountsReceivables (LCY). Dual-call for 61-90/90+ split.',
    }
  }, [enhanced.agedReceivables, currency])

  const agedPayablesTooltipProps = useMemo(() => {
    const ap = enhanced.agedPayables
    if (!ap) return undefined
    return {
      description:
        'Accounts payable aged by due date. All amounts in Local Currency (LCY), converted by Business Central from multi-currency invoices.',
      calculationTooltip: {
        formula: 'Total AP (LCY) from BC agedAccountsPayables report',
        components: [
          { label: 'Current', value: formatCompactCurrency(ap.current || 0, currency) },
          { label: '1-30 Days', value: formatCompactCurrency(ap.days_1_30 || 0, currency) },
          { label: '31-60 Days', value: formatCompactCurrency(ap.days_31_60 || 0, currency) },
          {
            label: '61+ Days',
            value: formatCompactCurrency(
              ap.total - ap.current - ap.days_1_30 - ap.days_31_60,
              currency
            ),
          },
          {
            label: 'Total AP (LCY)',
            value: formatCompactCurrency(ap.total || 0, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC agedAccountsPayables (LCY). Dual-call for 61-90/90+ split.',
    }
  }, [enhanced.agedPayables, currency])

  const balanceSheetTooltipProps = useMemo(() => {
    if (!totals) return undefined
    return {
      description:
        'Full balance sheet with expandable line items showing all asset, liability, and equity accounts.',
      calculationTooltip: {
        formula: 'Assets = Liabilities + Equity',
        components: [
          { label: 'Total Assets', value: formatCompactCurrency(totals.totalAssets, currency) },
          {
            label: 'Total Liabilities',
            value: formatCompactCurrency(totals.totalLiabilities, currency),
          },
          {
            label: 'Total Equity',
            value: formatCompactCurrency(totals.totalEquity, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC Chart of Accounts with Balance Sheet category, point-in-time balances.',
    }
  }, [totals, currency])

  // PDF Download state and handler
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <BalanceSheetPDF
          totals={totals}
          lines={filteredLines}
          ratios={mergedRatios}
          efficiencyMetrics={enhanced.efficiencyMetrics}
          healthScore={healthScore}
          cashRunwayData={enhanced.cashRunwayData}
          agedReceivables={enhanced.agedReceivables}
          agedPayables={enhanced.agedPayables}
          companyName={companyName}
          currency={currency}
          asOfDate={endDate}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `balance-sheet-${endDate}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsDownloadingPDF(false)
    }
  }, [
    totals,
    filteredLines,
    mergedRatios,
    enhanced.efficiencyMetrics,
    healthScore,
    enhanced.cashRunwayData,
    enhanced.agedReceivables,
    enhanced.agedPayables,
    companyName,
    currency,
    endDate,
  ])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className="text-lg font-semibold theme-text-primary">Data Load Error</h3>
          <p className="text-sm theme-text-secondary">
            {error instanceof Error ? error.message : 'Failed to load balance sheet data.'}
          </p>
          <Button variant="outline" onClick={mutateAll} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="@container space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="dashboard-title text-[36px] font-light theme-text-primary tracking-tight">
              Balance Sheet
            </h1>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mt-2">
              Business Central
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              disabled={isLoading}
            />
            <button
              onClick={mutateAll}
              disabled={isLoading || enhanced.isLoading}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading || enhanced.isLoading ? 'animate-spin' : ''}`}
              />
            </button>
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF || isLoading || !totals}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Download PDF Report"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Key metrics strip */}
      {totals && (
        <div
          className={cn(
            'flex flex-wrap justify-start gap-x-10 gap-y-4 pt-5 pb-3 border-b',
            borderClass
          )}
        >
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Assets
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-green">
              {formatCompactCurrency(totals.totalAssets, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Liabilities
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums text-theme-red">
              {formatCompactCurrency(totals.totalLiabilities, currency)}
            </div>
          </div>
          <div>
            <div className="text-[12px] uppercase tracking-wider theme-text-secondary mb-1">
              Total Equity
            </div>
            <div className="text-[28px] font-mono font-semibold tabular-nums theme-text-primary">
              {formatCompactCurrency(totals.totalEquity, currency)}
            </div>
          </div>
        </div>
      )}

      {/* Ratios + Efficiency Row */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6')}>
        <section
          className={cn(sectionHover, 'pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', borderClass)}
        >
          <FinancialRatiosCard
            ratios={mergedRatios}
            isLoading={enhanced.isLoading || pnl.isLoading}
            currency={currency}
            tooltipProps={ratiosTooltipProps}
          />
        </section>
        <section className={sectionHover}>
          <EfficiencyMetricsCard
            metrics={enhanced.efficiencyMetrics}
            isLoading={enhanced.isLoading}
            tooltipProps={efficiencyTooltipProps}
          />
        </section>
      </div>

      {/* Health Score Row */}
      <div className={cn(sectionHover, 'pt-6 border-t', borderClass)}>
        <FinancialHealthScoreCard
          healthScore={healthScore}
          isLoading={enhanced.isLoading || pnl.isLoading}
          tooltipProps={healthScoreTooltipProps}
        />
      </div>

      {/* Aged AR + Aged AP Row */}
      <div className={cn('grid grid-cols-1 @3xl:grid-cols-2 gap-8 pt-6 border-t', borderClass)}>
        <section
          className={cn(sectionHover, 'pb-6 @3xl:pb-0 @3xl:pr-8 @3xl:border-r', borderClass)}
        >
          <Link
            href={`/bc/customers${connectionId ? `?connectionId=${connectionId}` : ''}`}
            className="block"
          >
            <AgedReceivablesCard
              summary={enhanced.agedReceivables}
              isLoading={enhanced.isLoading}
              currency={currency}
              tooltipProps={agedReceivablesTooltipProps}
            />
          </Link>
        </section>
        <section className={sectionHover}>
          <Link
            href={`/bc/vendors${connectionId ? `?connectionId=${connectionId}` : ''}`}
            className="block"
          >
            <AgedPayablesCard
              summary={enhanced.agedPayables}
              isLoading={enhanced.isLoading}
              currency={currency}
              tooltipProps={agedPayablesTooltipProps}
            />
          </Link>
        </section>
      </div>

      {/* Collapsible Balance Sheet */}
      <div className="flex items-center gap-3 mb-8">
        <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
          Balance Sheet
        </h2>
        <div className="h-px flex-1 section-divider-line" />
      </div>
      <CollapsibleStatementTable
        lines={filteredLines}
        amountKey="balance"
        currency={currency}
        title="Balance Sheet"
        asOfDate={endDate}
        isLoading={isLoading}
        balanceCheck={balanceCheck}
        tooltipProps={balanceSheetTooltipProps}
        tableMaxWidth="1000px"
        onAccountClick={handleAccountClick}
        selectedAccountNumber={selectedAccount?._accountNumber ?? null}
        renderAccountDetail={() => (
          <AccountDetailDrawer
            open={!!selectedAccount}
            onClose={() => setSelectedAccount(null)}
            connectionId={connectionId}
            accountNumber={selectedAccount?._accountNumber ?? null}
            accountName={selectedAccount?.display ?? null}
            category={selectedAccount?._category ?? null}
            subCategory={selectedAccount?._subCategory ?? null}
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
            currency={currency}
          />
        )}
        exportButtons={
          <BalanceSheetExportButtons
            lines={filteredLines}
            totals={totals}
            companyName={companyName}
            currency={currency}
            asOfDate={endDate}
          />
        }
      />
    </div>
  )
}
