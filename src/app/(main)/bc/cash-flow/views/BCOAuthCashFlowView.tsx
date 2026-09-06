'use client'

import React, { useState, useMemo, useEffect, useCallback, type SetStateAction } from 'react'
import { useBCCashFlow } from '../../hooks/useBCCashFlow'
import { useBCBalanceSheet } from '../../hooks/useBCBalanceSheet'
import { useBCMonthlyCashTrend } from '../../hooks/useBCMonthlyCashTrend'
import { useBCEnhancedData } from '../../hooks/useBCEnhancedData'
import { useBCOAuthCashFlowStatement } from '../../hooks/useBCOAuthCashFlowStatement'
import { CashFlowMetricsCard } from '../components/CashFlowMetricsCard'
import { CashFlowStatementCard } from '../components/CashFlowStatementCard'
import { formatCompactCurrency } from '@/lib/utils/currency'
import { getDateRangeForPeriod } from '@/lib/utils/dateRanges'
import {
  AlertCircle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { EChartsLine } from '@/components/charts/echarts'
import { useTheme } from '@/hooks/useTheme'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { PERIOD_OPTION_GROUPS, PERIOD_OPTIONS } from '@/lib/utils/dateRanges'
import { PeriodPicker } from '../../components/PeriodPicker'
import { StatementExportDropdown } from '@/components/reports/StatementExportDropdown'
import type { StatementLineItem } from '@/lib/utils/statementExport'
import { CashFlowPDF } from '../components'
import { CashFlowItemDetailDrawer } from '../components/CashFlowItemDetailDrawer'
import { BankAccountDetailDrawer } from '../components/BankAccountDetailDrawer'
import { pdf } from '@react-pdf/renderer'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

export function BCOAuthCashFlowView({ connectionId }: { connectionId: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState('this_year')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const [selectedCFItem, setSelectedCFItem] = useState<{ id: string; name: string } | null>(null)
  const [selectedBankAccount, setSelectedBankAccount] = useState<{
    no: string
    name: string
  } | null>(null)

  const handleCFItemClick = useCallback((item: { id: string; name: string }) => {
    setSelectedCFItem((prev) => (prev?.id === item.id ? null : item))
  }, [])

  const handleBankAccountClick = useCallback((accountNo: string, accountName: string) => {
    setSelectedBankAccount((prev) =>
      prev?.no === accountNo ? null : { no: accountNo, name: accountName }
    )
  }, [])
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const sectionHover = cn(
    'group relative -mx-3 px-3 -mt-4 pt-4 -mb-6 pb-6 rounded-[4px]',
    'transition-all duration-300 ease-out',
    'hover:scale-[1.02] origin-center',
    isLight
      ? 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]'
      : 'hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]'
  )

  const styles = useMemo(
    () => ({
      text: isLight ? 'text-stone-900' : 'text-white',
      textMuted: isLight ? 'text-stone-500' : 'text-stone-500',
      border: isLight ? 'border-stone-200' : 'border-white/[0.08]',
      rowBg: isLight ? 'bg-stone-200/60' : 'bg-white/[0.02]',
      rowHover: isLight ? 'hover:bg-stone-300/50' : 'hover:bg-white/[0.05]',
    }),
    [isLight]
  )

  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate }
    }
    const range = getDateRangeForPeriod(selectedPeriod)
    return { startDate: range.start, endDate: range.end }
  }, [selectedPeriod, customStartDate, customEndDate])

  const { bankAccounts, totals, companyName, isLoading, error, mutate } = useBCCashFlow(
    connectionId,
    dateRange
  )
  const trend = useBCMonthlyCashTrend(connectionId, dateRange)
  const enhanced = useBCEnhancedData(connectionId, dateRange)
  const cfStatement = useBCOAuthCashFlowStatement(connectionId, dateRange)
  const bs = useBCBalanceSheet(connectionId, dateRange.endDate)

  // Extract bank/cash accounts with balances from balance sheet lines
  const bsBankAccounts = useMemo(() => {
    if (bs.lines.length === 0) return []
    // Find lines between "Bank & Cash Balances" header and its total
    const startIdx = bs.lines.findIndex(
      (l) => l.lineType === 'header' && l.display === 'Bank & Cash Balances'
    )
    if (startIdx === -1) return []
    const endIdx = bs.lines.findIndex(
      (l, i) =>
        i > startIdx && l.lineType === 'total' && l.display?.includes('Bank & Cash Balances')
    )
    const slice =
      endIdx > startIdx ? bs.lines.slice(startIdx + 1, endIdx) : bs.lines.slice(startIdx + 1)
    return slice.filter((l) => l.lineType === 'detail')
  }, [bs.lines])

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    const hasData = !!totals || bankAccounts.length > 0 || !!cfStatement.statement
    const allDoneLoading = !isLoading && !cfStatement.isLoading
    if (hasData || allDoneLoading) {
      welcomeContext?.setDataLoading(false)
    } else {
      welcomeContext?.setDataLoading(true)
    }
  }, [
    welcomeContext,
    isLoading,
    cfStatement.isLoading,
    cfStatement.statement,
    totals,
    bankAccounts.length,
  ])

  const currency = trend.currency || 'USD'

  const mutateAll = () => {
    mutate()
    trend.mutate()
    enhanced.mutate()
    cfStatement.mutate()
  }

  // PDF download state
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false)

  // Format trend data for EChartsLine
  const formattedTrendData = useMemo(() => {
    return trend.months.map((row) => {
      const date = new Date(row.month + '-01')
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      return {
        month: monthLabel,
        inflow: row.inflow,
        outflow: -row.outflow, // Negate for visual comparison
        netChange: row.netChange,
        balance: row.runningBalance,
      }
    })
  }, [trend.months])

  // Compute derived metrics — prefer indirect method data for accuracy
  const cashMetrics = useMemo(() => {
    // Use indirect method statement if available
    if (cfStatement.statement) {
      const stmt = cfStatement.statement
      const ocf = stmt.operatingActivities.totalOperating
      const capex = stmt.investingActivities.capitalExpenditures
      const fcf = ocf + capex // capex is already negative (outflow)
      const monthCount = trend.months.length || 12
      const monthlyFCF = fcf / monthCount
      const currentCash = stmt.endingCash

      const burnRate = monthlyFCF < 0 ? Math.abs(monthlyFCF) : 0
      const runway = burnRate > 0 ? Math.max(0, currentCash / burnRate) : null

      return {
        operatingCashFlow: ocf,
        freeCashFlow: fcf,
        cashRunway: runway,
        burnRate,
      }
    }

    // Fallback to trend-based approximation
    if (trend.months.length === 0 || !totals) return null

    const totalInflow = trend.months.reduce((s, m) => s + m.inflow, 0)
    const totalOutflow = trend.months.reduce((s, m) => s + m.outflow, 0)
    const periodNet = totalInflow - totalOutflow
    const monthCount = trend.months.length || 1
    const monthlyNet = periodNet / monthCount

    const currentCash = trend.cashBalance || totals.totalBalance || 0
    const burnRate = monthlyNet < 0 ? Math.abs(monthlyNet) : 0
    const runway = burnRate > 0 ? Math.max(0, currentCash / burnRate) : null

    return {
      operatingCashFlow: periodNet,
      freeCashFlow: periodNet,
      cashRunway: runway,
      burnRate,
    }
  }, [cfStatement.statement, trend.months, trend.cashBalance, totals])

  const themeGreen = isLight ? '#178E66' : '#2FBC8B'
  const themeRed = isLight ? '#B91C1C' : '#F87171'
  const themeBlue = isLight ? '#0D54A8' : '#66A7F3'
  const themeAmber = isLight ? '#D97706' : '#F59E0B'

  // Transform monthly trend data for export
  const monthlyTrendExportData = useMemo((): StatementLineItem[] => {
    if (trend.months.length === 0) return []

    const result: StatementLineItem[] = []

    // Header row
    result.push({
      name: 'Monthly Cash Movement',
      amount: 0,
      isHeader: true,
    })

    // Monthly rows with per-account detail
    for (const m of trend.months) {
      const date = new Date(m.month + '-01')
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

      result.push({
        name: `${label} - Inflow`,
        amount: m.inflow,
        isChild: true,
      })
      result.push({
        name: `${label} - Outflow`,
        amount: -m.outflow,
        isChild: true,
      })
      result.push({
        name: `${label} - Net Change`,
        amount: m.netChange,
        isSubtotal: true,
      })

      // Per-account breakdown
      if (m.accounts && m.accounts.length > 0) {
        for (const acc of m.accounts) {
          result.push({
            name: `  ${acc.accountNumber} ${acc.accountName}`,
            amount: acc.netChange,
            isChild: true,
          })
        }
      }
    }

    // Total row
    const totalInflow = trend.months.reduce((s, m) => s + m.inflow, 0)
    const totalOutflow = trend.months.reduce((s, m) => s + m.outflow, 0)
    const totalNet = totalInflow - totalOutflow

    result.push({
      name: 'Total Net Change',
      amount: totalNet,
      isFinalTotal: true,
    })

    return result
  }, [trend.months])

  // PDF download handler (after cashMetrics is defined)
  const handleDownloadPDF = useCallback(async () => {
    setIsDownloadingPDF(true)
    try {
      const blob = await pdf(
        <CashFlowPDF
          statement={cfStatement.statement}
          monthlyTrend={trend.months}
          metrics={cashMetrics}
          companyName={cfStatement.companyName || companyName || trend.companyName}
          currency={currency}
          dateRange={
            dateRange.startDate && dateRange.endDate
              ? { start: dateRange.startDate, end: dateRange.endDate }
              : undefined
          }
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const filename = `cash-flow-${dateRange.startDate}-to-${dateRange.endDate}.pdf`
      link.download = filename
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
    cfStatement.statement,
    cfStatement.companyName,
    trend.months,
    trend.companyName,
    cashMetrics,
    companyName,
    currency,
    dateRange,
  ])

  // --- Tooltip data builders ---

  const cashTrendTooltipProps = useMemo(() => {
    if (!trend.months || trend.months.length === 0) return undefined
    const totalInflow = trend.months.reduce((s, m) => s + m.inflow, 0)
    const totalOutflow = trend.months.reduce((s, m) => s + m.outflow, 0)
    const netChange = totalInflow - totalOutflow
    return {
      description:
        'Monthly cash inflows and outflows over time, with running balance showing cumulative position.',
      calculationTooltip: {
        formula: 'Net Change = Total Inflow − Total Outflow',
        components: [
          { label: 'Months', value: trend.months.length.toString() },
          { label: 'Total Inflow', value: formatCompactCurrency(totalInflow, currency) },
          { label: 'Total Outflow', value: formatCompactCurrency(totalOutflow, currency) },
          {
            label: 'Net Change',
            value: formatCompactCurrency(netChange, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC General Ledger cash account entries, aggregated monthly.',
    }
  }, [trend.months, currency])

  const cashMetricsTooltipProps = useMemo(() => {
    if (!cashMetrics) return undefined

    // Get capex from statement if available
    const capex = cfStatement.statement?.investingActivities?.capitalExpenditures ?? 0
    const monthCount = trend.months.length || 12

    return {
      description:
        'Key cash flow health indicators: operating cash flow, free cash flow, burn rate, and runway.',
      calculationTooltip: {
        formula:
          'OCF = Net Income + Non-Cash Adjustments + Working Capital Changes\n' +
          'FCF = OCF - Capital Expenditures\n' +
          'Burn Rate = |FCF| ÷ Months\n' +
          'Runway = Cash Balance ÷ Burn Rate',
        components: [
          {
            label: 'Operating CF',
            value: formatCompactCurrency(cashMetrics.operatingCashFlow, currency),
          },
          {
            label: 'Capital Expenditures',
            value: capex === 0 ? '$0' : formatCompactCurrency(capex, currency),
          },
          {
            label: '= Free Cash Flow',
            value: formatCompactCurrency(cashMetrics.freeCashFlow, currency),
            highlight: true,
          },
          {
            label: `÷ ${monthCount} months`,
            value: '',
          },
          {
            label: '= Monthly Burn Rate',
            value:
              cashMetrics.burnRate > 0
                ? `${formatCompactCurrency(cashMetrics.burnRate, currency)}/mo`
                : 'N/A',
          },
          {
            label: '= Cash Runway',
            value:
              cashMetrics.cashRunway !== null ? `${cashMetrics.cashRunway.toFixed(1)} months` : '∞',
            highlight: true,
          },
        ],
      },
      note: 'Source: BC GL Entries (indirect method). FCF = OCF when CapEx is $0.',
    }
  }, [cashMetrics, cfStatement.statement, trend.months.length, currency])

  const bankAccountsTooltipProps = useMemo(() => {
    if (bankAccounts.length === 0) return undefined
    return {
      description: 'Bank accounts registered in Business Central with their currency codes.',
      calculationTooltip: {
        formula: 'Total Accounts = Count of BC Bank Accounts',
        components: [{ label: 'Accounts', value: bankAccounts.length.toString(), highlight: true }],
      },
      note: 'Source: BC Bank Accounts entity. Balances are managed through bank reconciliation.',
    }
  }, [bankAccounts])

  const monthlyCashMovementTooltipProps = useMemo(() => {
    if (!trend.months || trend.months.length === 0) return undefined
    const totalInflow = trend.months.reduce((s, m) => s + m.inflow, 0)
    const totalOutflow = trend.months.reduce((s, m) => s + m.outflow, 0)
    return {
      description:
        'Detailed monthly breakdown of cash inflows, outflows, net changes, and running balance.',
      calculationTooltip: {
        formula: 'Running Balance = Previous Balance + Net Change',
        components: [
          { label: 'Months', value: trend.months.length.toString() },
          { label: 'Total Inflow', value: formatCompactCurrency(totalInflow, currency) },
          { label: 'Total Outflow', value: formatCompactCurrency(totalOutflow, currency) },
          {
            label: 'Ending Balance',
            value: formatCompactCurrency(
              trend.months[trend.months.length - 1]?.runningBalance || 0,
              currency
            ),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC GL cash account postings by month. Exportable via CSV/Excel.',
    }
  }, [trend.months, currency])

  const cashFlowStatementTooltipProps = useMemo(() => {
    if (!cfStatement.statement) return undefined
    const s = cfStatement.statement
    return {
      description:
        'Detailed cash flow statement using the indirect method, starting from net income and adjusting for non-cash items.',
      calculationTooltip: {
        formula: 'Ending Cash = Beginning Cash + Net Cash Change',
        components: [
          { label: 'Beginning Cash', value: formatCompactCurrency(s.beginningCash, currency) },
          {
            label: 'Operating',
            value: formatCompactCurrency(s.operatingActivities.totalOperating, currency),
          },
          {
            label: 'Investing',
            value: formatCompactCurrency(s.investingActivities.totalInvesting, currency),
          },
          {
            label: 'Financing',
            value: formatCompactCurrency(s.financingActivities.totalFinancing, currency),
          },
          {
            label: 'Ending Cash',
            value: formatCompactCurrency(s.endingCash, currency),
            highlight: true,
          },
        ],
      },
      note: 'Source: BC GL Entries mapped to cash flow categories (indirect method).',
    }
  }, [cfStatement.statement, currency])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500" />
          <h3 className={cn('text-lg font-semibold', styles.text)}>Data Load Error</h3>
          <p className={cn('text-sm', styles.textMuted)}>
            {error instanceof Error ? error.message : 'Failed to load cash flow data.'}
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
              Cash Flow
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
              disabled={isLoading || trend.isLoading || enhanced.isLoading || cfStatement.isLoading}
              className="p-1.5 theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading || trend.isLoading || cfStatement.isLoading ? 'animate-spin' : ''}`}
              />
            </button>
            {/* Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF || isLoading || cfStatement.isLoading}
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

      {/* Summary Cards — use indirect method data when available */}
      {cfStatement.statement || totals ? (
        <div className={cn('flex flex-wrap gap-6 sm:gap-10 py-5 border-b', styles.border)}>
          <SummaryCard
            label="Operating"
            value={
              cfStatement.statement?.operatingActivities.totalOperating ??
              totals?.totalOperating ??
              0
            }
            currency={currency}
            isLight={isLight}
            isPositive={
              (cfStatement.statement?.operatingActivities.totalOperating ??
                totals?.totalOperating ??
                0) >= 0
            }
          />
          <SummaryCard
            label="Investing"
            value={
              cfStatement.statement?.investingActivities.totalInvesting ??
              totals?.totalInvesting ??
              0
            }
            currency={currency}
            isLight={isLight}
            isPositive={
              (cfStatement.statement?.investingActivities.totalInvesting ??
                totals?.totalInvesting ??
                0) >= 0
            }
          />
          <SummaryCard
            label="Financing"
            value={
              cfStatement.statement?.financingActivities.totalFinancing ??
              totals?.totalFinancing ??
              0
            }
            currency={currency}
            isLight={isLight}
            isPositive={
              (cfStatement.statement?.financingActivities.totalFinancing ??
                totals?.totalFinancing ??
                0) >= 0
            }
          />
          <SummaryCard
            label="Net Change"
            value={cfStatement.statement?.netCashChange ?? totals?.netChange ?? 0}
            currency={currency}
            isLight={isLight}
            isPositive={(cfStatement.statement?.netCashChange ?? totals?.netChange ?? 0) >= 0}
            showSign
          />
          <SummaryCard
            label="Net Position"
            value={(cfStatement.statement?.endingCash ?? 0) - (enhanced.agedPayables?.total ?? 0)}
            currency={currency}
            isLight={isLight}
            isPositive={
              (cfStatement.statement?.endingCash ?? 0) - (enhanced.agedPayables?.total ?? 0) >= 0
            }
          />
        </div>
      ) : isLoading || cfStatement.isLoading ? (
        <div className={cn('flex flex-wrap gap-6 sm:gap-10 py-5 border-b', styles.border)}>
          {['Operating', 'Investing', 'Financing', 'Net Change', 'Net Position'].map((label) => (
            <div key={label}>
              <div
                className={cn(
                  'text-[12px] uppercase tracking-wider mb-1',
                  isLight ? 'text-stone-900' : 'text-white'
                )}
              >
                {label}
              </div>
              <div
                className={cn(
                  'h-[34px] w-24 animate-pulse mt-1',
                  isLight ? 'bg-stone-200' : 'bg-white/[0.06]'
                )}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Monthly Cash Flow Trend Chart */}
      {formattedTrendData.length > 0 && (
        <div className={cn('group border-b pb-6', styles.border)}>
          <div className="flex items-center gap-1.5 mb-5">
            <span
              className={cn(
                'relative text-base font-normal uppercase tracking-wider',
                isLight ? 'text-stone-800' : 'text-stone-300'
              )}
            >
              Monthly Cash Flow Trend
              <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
            </span>
            {cashTrendTooltipProps && <InfoTooltip {...cashTrendTooltipProps} />}
          </div>
          <div className="overflow-hidden">
            <EChartsLine
              height={280}
              data={formattedTrendData}
              xKey="month"
              series={[
                { key: 'inflow', name: 'Inflow', color: themeGreen },
                { key: 'outflow', name: 'Outflow', color: themeRed },
                { key: 'netChange', name: 'Net Change', color: themeBlue },
                { key: 'balance', name: 'Running Balance', color: themeAmber, smooth: true },
              ]}
              formatY={(v) => formatCompactCurrency(v, currency)}
            />
          </div>
        </div>
      )}

      {/* Cash Flow Metrics + Bank Accounts Row */}
      <div
        className={cn(
          'grid grid-cols-1 @2xl:grid-cols-2 gap-x-12 gap-y-20 border-b pb-6',
          styles.border
        )}
      >
        {/* Cash Flow Metrics */}
        <section
          className={cn(
            '@2xl:pr-8 relative @2xl:after:absolute @2xl:after:right-0 @2xl:after:top-4 @2xl:after:bottom-4 @2xl:after:w-px',
            isLight ? '@2xl:after:bg-stone-200' : '@2xl:after:bg-white/[0.08]',
            sectionHover
          )}
        >
          {cashMetrics ? (
            <CashFlowMetricsCard
              data={cashMetrics}
              isLoading={trend.isLoading}
              currency={currency}
              isLight={isLight}
              tooltipProps={cashMetricsTooltipProps}
              breakdown={
                cfStatement.statement
                  ? {
                      netIncome: cfStatement.statement.operatingActivities.netIncome,
                      depreciation:
                        cfStatement.statement.operatingActivities.adjustments?.depreciation,
                      arChange:
                        cfStatement.statement.operatingActivities.adjustments
                          ?.accountsReceivableChange,
                      inventoryChange:
                        cfStatement.statement.operatingActivities.adjustments?.inventoryChange,
                      apChange:
                        cfStatement.statement.operatingActivities.adjustments
                          ?.accountsPayableChange,
                      otherWCChanges:
                        (cfStatement.statement.operatingActivities.adjustments?.prepaidChange ??
                          0) +
                        (cfStatement.statement.operatingActivities.adjustments
                          ?.accruedLiabilitiesChange ?? 0) +
                        (cfStatement.statement.operatingActivities.adjustments
                          ?.deferredRevenueChange ?? 0) +
                        (cfStatement.statement.operatingActivities.adjustments?.otherAdjustments ??
                          0),
                      capitalExpenditures:
                        cfStatement.statement.investingActivities.capitalExpenditures,
                      cashBalance: cfStatement.statement.endingCash,
                      monthCount: trend.months.length || undefined,
                    }
                  : undefined
              }
            />
          ) : enhanced.cashRunwayData && !cfStatement.isLoading ? (
            (() => {
              // Derive burn rate & runway from the same FCF value we display
              const displayedFCF = enhanced.cashRunwayData.avgMonthlyNetIncome
              const totalCash = enhanced.cashRunwayData.totalCash
              const derivedBurnRate = displayedFCF < 0 ? Math.abs(displayedFCF) : 0
              const derivedRunway =
                derivedBurnRate > 0 ? Math.max(0, totalCash / derivedBurnRate) : null
              return (
                <CashFlowMetricsCard
                  data={{
                    operatingCashFlow:
                      enhanced.cashRunwayData.monthlyRevenue -
                      enhanced.cashRunwayData.monthlyExpenses,
                    freeCashFlow: displayedFCF,
                    cashRunway: derivedRunway,
                    burnRate: derivedBurnRate,
                  }}
                  isLoading={enhanced.isLoading}
                  currency={currency}
                  isLight={isLight}
                  tooltipProps={cashMetricsTooltipProps}
                />
              )
            })()
          ) : (
            <CashFlowMetricsCard
              data={null}
              isLoading={
                isLoading || trend.isLoading || enhanced.isLoading || cfStatement.isLoading
              }
              currency={currency}
              isLight={isLight}
              tooltipProps={cashMetricsTooltipProps}
            />
          )}
        </section>

        {/* Bank Accounts */}
        <section className={sectionHover}>
          {isLoading ? (
            <div>
              <div className="flex items-center gap-1.5 mb-5">
                <span
                  className={cn(
                    'relative text-base font-normal uppercase tracking-wider',
                    isLight ? 'text-stone-800' : 'text-stone-300'
                  )}
                >
                  Bank Accounts
                  <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
                {bankAccountsTooltipProps && <InfoTooltip {...bankAccountsTooltipProps} />}
              </div>
              <div className="space-y-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-12 animate-pulse',
                      isLight ? 'bg-stone-100/70' : 'bg-white/[0.02]'
                    )}
                  />
                ))}
              </div>
            </div>
          ) : bsBankAccounts.length > 0 ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'relative text-base font-normal uppercase tracking-wider',
                      isLight ? 'text-stone-800' : 'text-stone-300'
                    )}
                  >
                    Bank Accounts
                    <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                  {bankAccountsTooltipProps && <InfoTooltip {...bankAccountsTooltipProps} />}
                </div>
                <span
                  className={cn(
                    'text-xs font-mono px-2 py-1',
                    isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/[0.04] text-stone-400'
                  )}
                >
                  {bsBankAccounts.length} {bsBankAccounts.length === 1 ? 'account' : 'accounts'}
                </span>
              </div>
              <div
                className={cn(
                  'max-h-[320px] overflow-y-auto overflow-x-hidden pr-1',
                  '[&::-webkit-scrollbar]:w-1.5',
                  '[&::-webkit-scrollbar-track]:bg-transparent',
                  isLight
                    ? '[&::-webkit-scrollbar-thumb]:bg-stone-300'
                    : '[&::-webkit-scrollbar-thumb]:bg-stone-600'
                )}
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: isLight ? '#a8a29e transparent' : '#57534e transparent',
                }}
              >
                {bsBankAccounts.map((acc: any, i: number) => {
                  const bal = acc.balance ?? 0
                  const accNo = acc._accountNumber || ''
                  const isSelected = selectedBankAccount?.no === accNo
                  return (
                    <React.Fragment key={accNo || i}>
                      <button
                        onClick={() => handleBankAccountClick(accNo, acc.display)}
                        className={cn(
                          'w-full flex items-center gap-3 py-2.5 px-2 -mx-2 text-xs transition-colors cursor-pointer text-left',
                          i % 2 === 0 && styles.rowBg,
                          styles.rowHover,
                          isSelected &&
                            (isLight
                              ? 'bg-amber-50 ring-1 ring-amber-300'
                              : 'bg-amber-500/10 ring-1 ring-amber-500/30')
                        )}
                      >
                        <div
                          className="w-2 h-2 flex-shrink-0"
                          style={{ backgroundColor: isLight ? '#22c55e' : '#4ade80' }}
                        />
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn('font-medium truncate block text-[13px]', styles.text)}
                          >
                            {acc.display}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-xs font-mono font-semibold tabular-nums flex-shrink-0',
                            bal >= 0
                              ? isLight
                                ? 'text-stone-900'
                                : 'text-white'
                              : isLight
                                ? 'text-red-600'
                                : 'text-red-400'
                          )}
                        >
                          {formatCompactCurrency(bal, currency)}
                        </span>
                      </button>
                      {isSelected && (
                        <BankAccountDetailDrawer
                          open
                          onClose={() => setSelectedBankAccount(null)}
                          connectionId={connectionId}
                          accountNumber={accNo}
                          accountName={acc.display}
                          startDate={dateRange.startDate}
                          endDate={dateRange.endDate}
                          currency={currency}
                        />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-5">
                <span
                  className={cn(
                    'relative text-base font-normal uppercase tracking-wider',
                    isLight ? 'text-stone-800' : 'text-stone-300'
                  )}
                >
                  Bank Accounts
                  <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
                </span>
                {bankAccountsTooltipProps && <InfoTooltip {...bankAccountsTooltipProps} />}
              </div>
              <p className={cn('text-sm text-center py-4', styles.textMuted)}>
                No bank accounts found
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Monthly Inflow vs Outflow Detail */}
      {trend.months.length > 0 && (
        <div className={cn(sectionHover, 'border-b pb-6', styles.border)}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'relative text-base font-normal uppercase tracking-wider',
                  isLight ? 'text-stone-800' : 'text-stone-300'
                )}
              >
                Monthly Cash Movement
                <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-yellow-400 transition-all duration-300 ease-out group-hover:w-full" />
              </span>
              {monthlyCashMovementTooltipProps && (
                <InfoTooltip {...monthlyCashMovementTooltipProps} />
              )}
            </div>
            <StatementExportDropdown
              data={monthlyTrendExportData}
              metadata={{
                title: 'Monthly Cash Movement',
                statementType: 'cash-flow',
                dateRange:
                  dateRange.startDate && dateRange.endDate
                    ? { start: dateRange.startDate, end: dateRange.endDate }
                    : undefined,
                currency,
                basis: 'Cash',
              }}
              compact
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={cn('border-b', styles.border)}>
                  <th
                    className={cn(
                      'text-left py-2.5 px-2 text-[10px] uppercase tracking-wider font-medium',
                      styles.textMuted
                    )}
                  >
                    Month
                  </th>
                  <th
                    className="text-right py-2.5 px-2 text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: themeGreen }}
                  >
                    Inflow
                  </th>
                  <th
                    className="text-right py-2.5 px-2 text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: themeRed }}
                  >
                    Outflow
                  </th>
                  <th
                    className={cn(
                      'text-right py-2.5 px-2 text-[10px] uppercase tracking-wider font-medium',
                      styles.textMuted
                    )}
                  >
                    Net Change
                  </th>
                  <th
                    className={cn(
                      'text-right py-2.5 px-2 text-[10px] uppercase tracking-wider font-medium',
                      styles.textMuted
                    )}
                  >
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {trend.months.map((m, i) => {
                  const date = new Date(m.month + '-01')
                  const label = date.toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                  const isExpanded = expandedMonths.has(m.month)
                  const hasAccounts = m.accounts && m.accounts.length > 0
                  return (
                    <React.Fragment key={m.month}>
                      <tr
                        onClick={() => {
                          if (hasAccounts) {
                            setExpandedMonths((prev) => {
                              const next = new Set(prev)
                              if (next.has(m.month)) next.delete(m.month)
                              else next.add(m.month)
                              return next
                            })
                          }
                        }}
                        className={cn(
                          'transition-colors',
                          i % 2 === 0 && styles.rowBg,
                          styles.rowHover,
                          hasAccounts && 'cursor-pointer'
                        )}
                      >
                        <td className={cn('py-2 px-2 font-mono text-xs', styles.text)}>
                          <span className="inline-flex items-center gap-1">
                            {hasAccounts &&
                              (isExpanded ? (
                                <ChevronDown className="w-3 h-3 theme-text-secondary" />
                              ) : (
                                <ChevronRight className="w-3 h-3 theme-text-secondary" />
                              ))}
                            {label}
                          </span>
                        </td>
                        <td
                          className="py-2 px-2 text-right font-mono text-xs"
                          style={{ color: themeGreen }}
                        >
                          {formatCompactCurrency(m.inflow, currency)}
                        </td>
                        <td
                          className="py-2 px-2 text-right font-mono text-xs"
                          style={{ color: themeRed }}
                        >
                          {formatCompactCurrency(-m.outflow, currency)}
                        </td>
                        <td
                          className="py-2 px-2 text-right font-mono font-semibold text-xs"
                          style={{ color: m.netChange >= 0 ? themeGreen : themeRed }}
                        >
                          {m.netChange >= 0 ? '+' : ''}
                          {formatCompactCurrency(m.netChange, currency)}
                        </td>
                        <td
                          className={cn(
                            'py-2 px-2 text-right font-mono text-xs font-semibold',
                            styles.text
                          )}
                        >
                          {formatCompactCurrency(m.runningBalance, currency)}
                        </td>
                      </tr>
                      {isExpanded &&
                        m.accounts?.map((acc) => (
                          <tr
                            key={`${m.month}-${acc.accountNumber}`}
                            className={cn(isLight ? 'bg-stone-100/60' : 'bg-white/[0.01]')}
                          >
                            <td className={cn('py-1.5 pl-8 pr-2 text-[11px]', styles.textMuted)}>
                              <span className="font-mono">{acc.accountNumber}</span>
                              <span className="ml-2">{acc.accountName}</span>
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-mono text-[11px]"
                              style={{ color: acc.inflow > 0 ? themeGreen : undefined }}
                            >
                              {acc.inflow > 0 ? formatCompactCurrency(acc.inflow, currency) : '—'}
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-mono text-[11px]"
                              style={{ color: acc.outflow > 0 ? themeRed : undefined }}
                            >
                              {acc.outflow > 0
                                ? formatCompactCurrency(-acc.outflow, currency)
                                : '—'}
                            </td>
                            <td
                              className="py-1.5 px-2 text-right font-mono text-[11px] font-medium"
                              style={{ color: acc.netChange >= 0 ? themeGreen : themeRed }}
                            >
                              {acc.netChange >= 0 ? '+' : ''}
                              {formatCompactCurrency(acc.netChange, currency)}
                            </td>
                            <td />
                          </tr>
                        ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className={cn('border-t font-semibold', styles.border)}>
                  <td className={cn('py-2.5 px-2 text-xs', styles.text)}>Total</td>
                  <td
                    className="py-2.5 px-2 text-right font-mono text-xs"
                    style={{ color: themeGreen }}
                  >
                    {formatCompactCurrency(
                      trend.months.reduce((s, m) => s + m.inflow, 0),
                      currency
                    )}
                  </td>
                  <td
                    className="py-2.5 px-2 text-right font-mono text-xs"
                    style={{ color: themeRed }}
                  >
                    {formatCompactCurrency(
                      -trend.months.reduce((s, m) => s + m.outflow, 0),
                      currency
                    )}
                  </td>
                  <td
                    className="py-2.5 px-2 text-right font-mono text-xs"
                    style={{
                      color:
                        trend.months.reduce((s, m) => s + m.netChange, 0) >= 0
                          ? themeGreen
                          : themeRed,
                    }}
                  >
                    {trend.months.reduce((s, m) => s + m.netChange, 0) >= 0 ? '+' : ''}
                    {formatCompactCurrency(
                      trend.months.reduce((s, m) => s + m.netChange, 0),
                      currency
                    )}
                  </td>
                  <td className={cn('py-2.5 px-2 text-right font-mono text-xs', styles.text)}>
                    {formatCompactCurrency(
                      trend.months[trend.months.length - 1]?.runningBalance ?? 0,
                      currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Indirect Method Cash Flow Statement */}
      <div className="flex items-center gap-3 mb-8 mt-20">
        <h2 className="text-[20px] font-normal tracking-[0.15em] uppercase theme-text-secondary">
          Statement of Cash Flows
        </h2>
        <div className="h-px flex-1 section-divider-line" />
      </div>
      <div>
        <CashFlowStatementCard
          data={cfStatement.statement}
          isLoading={cfStatement.isLoading}
          dateRange={
            dateRange.startDate && dateRange.endDate
              ? { start: dateRange.startDate, end: dateRange.endDate }
              : undefined
          }
          currency={currency}
          isLight={isLight}
          tooltipProps={cashFlowStatementTooltipProps}
          onItemClick={handleCFItemClick}
          selectedItemId={selectedCFItem?.id ?? null}
          renderItemDetail={() => (
            <CashFlowItemDetailDrawer
              open={!!selectedCFItem}
              onClose={() => setSelectedCFItem(null)}
              connectionId={connectionId}
              itemType={selectedCFItem?.id ?? null}
              itemName={selectedCFItem?.name ?? null}
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              currency={currency}
            />
          )}
        />
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  currency,
  isLight,
  isPositive,
  showSign,
}: {
  label: string
  value: number
  currency: string
  isLight: boolean
  isPositive: boolean
  showSign?: boolean
}) {
  const positiveColor = isLight ? 'text-green-600' : 'text-green-400'
  const negativeColor = isLight ? 'text-red-600' : 'text-red-400'

  return (
    <div>
      <p
        className={cn(
          'text-[12px] uppercase tracking-wider mb-1',
          isLight ? 'text-stone-900' : 'text-white'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-[28px] font-mono font-semibold tabular-nums',
          isPositive ? positiveColor : negativeColor
        )}
      >
        {showSign && isPositive ? '+' : ''}
        {formatCompactCurrency(value, currency)}
      </p>
    </div>
  )
}
