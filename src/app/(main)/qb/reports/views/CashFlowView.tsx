// src/app/(main)/reports/views/CashFlowView.tsx
'use client'

import React, { useMemo, useEffect } from 'react'
import { useCashFlow, useCashFlowMonthlyTrend, useProfitLossData } from '@/hooks/useReportData'
import { formatPnLCurrency } from '@/lib/utils/currency'
import { useReportsContext } from '@/contexts/ReportsContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { ReportLoadingState } from '../components/ReportLoadingState'
import { ReportErrorState } from '../components/ReportErrorState'
import { useCollapsibleSections } from '../components/hooks/useCollapsibleSections'
import { useMetricStorage } from '../components/hooks/useMetricStorage'
import { CashFlowMetricsGrid } from '../components/cash-flow/CashFlowMetricsGrid'
import { CashFlowStatementTable } from '../components/cash-flow/CashFlowStatementTable'
import { AIAnalysisCard } from '@/components/ai-analysis'
import {
  BookkeepingValidationAlert,
  validateCashFlowData,
} from '../components/BookkeepingValidationAlert'
import type { CashFlowItem } from '@/app/(main)/reports/types'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'

export function CashFlowView() {
  const { dateRange } = useReportsContext()
  const { currency } = useCurrency()

  // Fetch data from API using context dates
  const { reportData, isLoading, isValidating, error, mutate } = useCashFlow(
    dateRange.start,
    dateRange.end
  )

  // Fetch monthly trend data separately for faster initial load
  const {
    trendData: monthlyTrendData,
    isLoading: isTrendLoading,
    error: trendError,
  } = useCashFlowMonthlyTrend(dateRange.start, dateRange.end)

  // Fetch P&L data to get real-time bank balance (same as Executive Summary)
  const { reportData: pnlData, isLoading: pnlLoading } = useProfitLossData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end,
  })

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !reportData)
  }, [isLoading, reportData, welcomeContext])

  // All hooks must be called before any early returns
  // State for collapsible sections
  const { expandedSections, toggleSection } = useCollapsibleSections([
    'Operating',
    'Investing',
    'Financing',
  ])

  // Prepare Cash Flow Statement table data with collapsible sections
  const cashFlowTableData = React.useMemo((): CashFlowItem[] => {
    // Return empty array if no data yet
    if (!reportData?.data) return []

    const data = reportData.data
    const operatingCashFlow = data.kpis?.operatingCashFlow || 0
    const investingCashFlow = data.kpis?.investingCashFlow || 0
    const financingCashFlow = data.kpis?.financingCashFlow || 0
    const netCashFlow = data.kpis?.netCashFlow || 0
    const cashBeginning = data.kpis?.cashBeginning || 0
    const cashEnding = data.kpis?.cashEnding || 0
    const operatingBreakdown = data.operatingActivities || []

    // Process investing activities
    const investingActivities = (data.investingActivities || []).map((item: any) => {
      const originalAmount = item.amount || item.value || 0
      const isInflow =
        item.name?.toLowerCase().includes('sale') || item.name?.toLowerCase().includes('disposal')
      const processedAmount =
        originalAmount < 0 ? originalAmount : isInflow ? originalAmount : -Math.abs(originalAmount)
      return {
        ...item,
        amount: processedAmount,
        value: processedAmount,
      }
    })

    // Process financing activities
    const financingActivities = (data.financingActivities || []).map((item: any) => {
      const originalAmount = item.amount || item.value || 0
      const itemName = (item.name || item.item || '').toLowerCase()

      const isInflow =
        (itemName.includes('loan') &&
          !itemName.includes('repay') &&
          !itemName.includes('payment')) ||
        itemName.includes('borrow') ||
        itemName.includes('proceeds') ||
        itemName.includes('issuance')

      const isOutflow =
        itemName.includes('repay') ||
        itemName.includes('payment') ||
        itemName.includes('dividend') ||
        itemName.includes('distribution') ||
        itemName.includes('liability') ||
        itemName.includes('debt')

      let processedAmount = originalAmount
      if (isOutflow && originalAmount > 0) {
        processedAmount = -Math.abs(originalAmount)
      } else if (isInflow && originalAmount < 0) {
        processedAmount = Math.abs(originalAmount)
      }

      return {
        ...item,
        amount: processedAmount,
        value: processedAmount,
      }
    })

    const result: CashFlowItem[] = []

    // Beginning cash
    result.push({
      category: 'Beginning',
      name: 'Beginning Cash Balance',
      amount: cashBeginning,
      isTotal: true,
    })

    // Operating Activities
    result.push({
      category: 'Operating',
      name: 'Operating Activities',
      amount: 0,
      isHeader: true,
      isCollapsible: true,
      isExpanded: expandedSections.has('Operating'),
    })

    if (expandedSections.has('Operating')) {
      operatingBreakdown.forEach((item: any) => {
        result.push({
          category: 'Operating',
          name: item.item || item.name || 'Operating Activity',
          amount: item.amount || item.value || 0,
          isChild: true,
        })
      })
    }

    result.push({
      category: 'Operating',
      name: 'Net Cash from Operating Activities',
      amount: operatingCashFlow,
      isSubtotal: true,
    })

    // Investing Activities
    if (investingActivities.length > 0) {
      result.push({
        category: 'Investing',
        name: 'Investing Activities',
        amount: 0,
        isHeader: true,
        isCollapsible: true,
        isExpanded: expandedSections.has('Investing'),
      })

      if (expandedSections.has('Investing')) {
        investingActivities.forEach((item: any) => {
          result.push({
            category: 'Investing',
            name: item.item || item.name || 'Investing Activity',
            amount: item.value || item.amount || 0,
            isChild: true,
          })
        })
      }

      result.push({
        category: 'Investing',
        name: 'Net Cash from Investing Activities',
        amount: investingCashFlow,
        isSubtotal: true,
      })
    }

    // Financing Activities
    if (financingActivities.length > 0) {
      result.push({
        category: 'Financing',
        name: 'Financing Activities',
        amount: 0,
        isHeader: true,
        isCollapsible: true,
        isExpanded: expandedSections.has('Financing'),
      })

      if (expandedSections.has('Financing')) {
        financingActivities.forEach((item: any) => {
          result.push({
            category: 'Financing',
            name: item.item || item.name || 'Financing Activity',
            amount: item.value || item.amount || 0,
            isChild: true,
          })
        })
      }

      result.push({
        category: 'Financing',
        name: 'Net Cash from Financing Activities',
        amount: financingCashFlow,
        isSubtotal: true,
      })
    }

    // Net Change
    result.push({
      category: 'Net',
      name: 'Net Change in Cash',
      amount: netCashFlow,
      isTotal: true,
    })

    // Ending cash
    result.push({
      category: 'Ending',
      name: 'Ending Cash Balance',
      amount: cashEnding,
      isTotal: true,
      isFinalTotal: true,
    })

    return result
  }, [reportData, expandedSections])

  // Generate export data with ALL sections expanded (for PDF/CSV/Markdown exports)
  const cashFlowExportData = React.useMemo((): CashFlowItem[] => {
    if (!reportData?.data) return []

    const data = reportData.data
    const operatingCashFlow = data.kpis?.operatingCashFlow || 0
    const investingCashFlow = data.kpis?.investingCashFlow || 0
    const financingCashFlow = data.kpis?.financingCashFlow || 0
    const netCashFlow = data.kpis?.netCashFlow || 0
    const cashBeginning = data.kpis?.cashBeginning || 0
    const cashEnding = data.kpis?.cashEnding || 0
    const operatingBreakdown = data.operatingActivities || []

    const investingActivities = (data.investingActivities || []).map((item: any) => {
      const originalAmount = item.amount || item.value || 0
      const isInflow =
        item.name?.toLowerCase().includes('sale') || item.name?.toLowerCase().includes('disposal')
      const processedAmount =
        originalAmount < 0 ? originalAmount : isInflow ? originalAmount : -Math.abs(originalAmount)
      return { ...item, amount: processedAmount, value: processedAmount }
    })

    const financingActivities = (data.financingActivities || []).map((item: any) => {
      const originalAmount = item.amount || item.value || 0
      const itemName = (item.name || item.item || '').toLowerCase()
      const isInflow =
        (itemName.includes('loan') &&
          !itemName.includes('repay') &&
          !itemName.includes('payment')) ||
        itemName.includes('borrow') ||
        itemName.includes('proceeds') ||
        itemName.includes('issuance')
      const isOutflow =
        itemName.includes('repay') ||
        itemName.includes('payment') ||
        itemName.includes('dividend') ||
        itemName.includes('distribution') ||
        itemName.includes('liability') ||
        itemName.includes('debt')
      let processedAmount = originalAmount
      if (isOutflow && originalAmount > 0) processedAmount = -Math.abs(originalAmount)
      else if (isInflow && originalAmount < 0) processedAmount = Math.abs(originalAmount)
      return { ...item, amount: processedAmount, value: processedAmount }
    })

    const result: CashFlowItem[] = []

    // Beginning cash
    result.push({
      category: 'Beginning',
      name: 'Beginning Cash Balance',
      amount: cashBeginning,
      isTotal: true,
    })

    // Operating Activities - ALWAYS expanded for export
    result.push({
      category: 'Operating',
      name: 'Operating Activities',
      amount: 0,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
    })
    operatingBreakdown.forEach((item: any) => {
      result.push({
        category: 'Operating',
        name: item.item || item.name || 'Operating Activity',
        amount: item.amount || item.value || 0,
        isChild: true,
      })
    })
    result.push({
      category: 'Operating',
      name: 'Net Cash from Operating Activities',
      amount: operatingCashFlow,
      isSubtotal: true,
    })

    // Investing Activities - ALWAYS expanded for export
    if (investingActivities.length > 0) {
      result.push({
        category: 'Investing',
        name: 'Investing Activities',
        amount: 0,
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
      })
      investingActivities.forEach((item: any) => {
        result.push({
          category: 'Investing',
          name: item.item || item.name || 'Investing Activity',
          amount: item.value || item.amount || 0,
          isChild: true,
        })
      })
      result.push({
        category: 'Investing',
        name: 'Net Cash from Investing Activities',
        amount: investingCashFlow,
        isSubtotal: true,
      })
    }

    // Financing Activities - ALWAYS expanded for export
    if (financingActivities.length > 0) {
      result.push({
        category: 'Financing',
        name: 'Financing Activities',
        amount: 0,
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
      })
      financingActivities.forEach((item: any) => {
        result.push({
          category: 'Financing',
          name: item.item || item.name || 'Financing Activity',
          amount: item.value || item.amount || 0,
          isChild: true,
        })
      })
      result.push({
        category: 'Financing',
        name: 'Net Cash from Financing Activities',
        amount: financingCashFlow,
        isSubtotal: true,
      })
    }

    // Net Change and Ending cash
    result.push({ category: 'Net', name: 'Net Change in Cash', amount: netCashFlow, isTotal: true })
    result.push({
      category: 'Ending',
      name: 'Ending Cash Balance',
      amount: cashEnding,
      isTotal: true,
      isFinalTotal: true,
    })

    return result
  }, [reportData])

  // SWR automatically refetches when date range changes, no manual refetch needed

  // Extract data from API response (must be before early returns)
  const data = reportData?.data || {}
  const operatingCashFlow = data.kpis?.operatingCashFlow || 0
  const investingCashFlow = data.kpis?.investingCashFlow || 0
  const financingCashFlow = data.kpis?.financingCashFlow || 0
  const netCashFlow = data.kpis?.netCashFlow || 0
  const cashBeginning = data.kpis?.cashBeginning || 0
  const cashEnding = data.kpis?.cashEnding || 0

  // Get real-time bank balance from P&L (matches Executive Summary implementation)
  const pnlMetrics = pnlData?.data?.kpis || {}
  const realTimeCashBalance = pnlMetrics.cashBalance || cashEnding || 0

  // Data validation
  const calculatedEnding = cashBeginning + netCashFlow
  const reconciliationError = Math.abs(calculatedEnding - cashEnding) > 0.01
  const calculatedNetChange = operatingCashFlow + investingCashFlow + financingCashFlow
  const netChangeError = Math.abs(calculatedNetChange - netCashFlow) > 0.01

  // Generate validation issues for bookkeeping alerts
  const validationIssues = useMemo(
    () =>
      validateCashFlowData({
        beginningCash: cashBeginning,
        endingCash: cashEnding,
        netChangeInCash: netCashFlow,
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
      }),
    [
      cashBeginning,
      cashEnding,
      netCashFlow,
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
    ]
  )

  // Prepare breakdown data
  const operatingBreakdown = data.operatingActivities || []

  // Process investing and financing activities for charts
  // (same processing logic as in useMemo, but done here for immediate use in rendering)
  const investingActivities = (data.investingActivities || []).map((item: any) => {
    const originalAmount = item.amount || item.value || 0
    const isInflow =
      item.name?.toLowerCase().includes('sale') || item.name?.toLowerCase().includes('disposal')
    const processedAmount =
      originalAmount < 0 ? originalAmount : isInflow ? originalAmount : -Math.abs(originalAmount)
    return {
      ...item,
      amount: processedAmount,
      value: processedAmount,
    }
  })

  const financingActivities = (data.financingActivities || []).map((item: any) => {
    const originalAmount = item.amount || item.value || 0
    const itemName = (item.name || item.item || '').toLowerCase()

    const isInflow =
      (itemName.includes('loan') && !itemName.includes('repay') && !itemName.includes('payment')) ||
      itemName.includes('borrow') ||
      itemName.includes('proceeds') ||
      itemName.includes('issuance')

    const isOutflow =
      itemName.includes('repay') ||
      itemName.includes('payment') ||
      itemName.includes('dividend') ||
      itemName.includes('distribution') ||
      itemName.includes('liability') ||
      itemName.includes('debt')

    let processedAmount = originalAmount
    if (isOutflow && originalAmount > 0) {
      processedAmount = -Math.abs(originalAmount)
    } else if (isInflow && originalAmount < 0) {
      processedAmount = Math.abs(originalAmount)
    }

    return {
      ...item,
      amount: processedAmount,
      value: processedAmount,
    }
  })

  const investingFinancingBreakdown = [...investingActivities, ...financingActivities]
  const waterfallData = data.waterfallChart || []

  // Monthly flow data now comes from separate trend API for faster initial load
  const monthlyFlowData = (monthlyTrendData || []).map((month: any) => {
    // Validate and ensure all required fields exist
    const validated = {
      month: month.period || month.month || 'Unknown',
      operating: month.operating ?? 0,
      investing: month.investing ?? 0,
      financing: month.financing ?? 0,
      totalCash: month.totalCash ?? month.endingCash ?? 0,
    }

    return validated
  })

  // Prepare contextData for learn modals with all calculated metrics
  const periodMonths = data.cashMetrics?.period_months || 1
  const totalExpenses = data.cashMetrics?.total_expenses || pnlMetrics.totalExpenses || 0
  const grossBurnRate = totalExpenses ? Math.abs(totalExpenses) / periodMonths : 0
  const contextData = useMemo(
    () => ({
      cash_balance: realTimeCashBalance,
      ocf: operatingCashFlow,
      burn_rate: grossBurnRate,
      runway_months:
        realTimeCashBalance > 0 && grossBurnRate > 0 ? realTimeCashBalance / grossBurnRate : 0,
      ocf_ratio: data.cashMetrics?.operating_cash_flow_ratio || 0,
      free_cash_flow: data.cashMetrics?.free_cash_flow || 0,
      cash_conversion_cycle: data.cashMetrics?.cash_conversion_cycle || 0,
      ocf_margin: data.cashMetrics?.operating_cash_flow_margin || 0,
      cf_coverage: data.cashMetrics?.cash_flow_coverage_ratio || 0,
      dso: data.cashMetrics?.dso || 0,
      dpo: data.cashMetrics?.dpo || 0,
    }),
    [
      realTimeCashBalance,
      operatingCashFlow,
      totalExpenses,
      periodMonths,
      grossBurnRate,
      data.cashMetrics?.operating_cash_flow_ratio,
      data.cashMetrics?.free_cash_flow,
      data.cashMetrics?.cash_conversion_cycle,
      data.cashMetrics?.operating_cash_flow_margin,
      data.cashMetrics?.cash_flow_coverage_ratio,
      data.cashMetrics?.dso,
      data.cashMetrics?.dpo,
    ]
  )

  // Store in sessionStorage for learn pages to access
  useMetricStorage(contextData, dateRange, isLoading)

  // Loading state - check AFTER all hooks are called
  if (isLoading && !reportData) {
    return <ReportLoadingState message="Generating cash flow report..." />
  }

  // Error state - check AFTER all hooks are called
  if (error) {
    return <ReportErrorState error={error} onRetry={() => mutate()} />
  }

  return (
    <div
      className="@container space-y-4 overflow-y-auto styled-scrollbar h-full"
      id="cash-flow-content"
    >
      {/* Loading overlay during revalidation */}
      {isValidating && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm theme-text-secondary">Updating cash flow data...</p>
          </div>
        </div>
      )}

      {/* Main content - hidden during revalidation */}
      {!isValidating && (
        <>
          {/* Bookkeeping Validation Alerts */}
          {validationIssues.length > 0 && (
            <BookkeepingValidationAlert
              issues={validationIssues}
              reportType="cash_flow"
              collapsible={true}
              defaultExpanded={false}
            />
          )}

          <CashFlowMetricsGrid
            operatingCashFlow={operatingCashFlow}
            investingCashFlow={investingCashFlow}
            financingCashFlow={financingCashFlow}
            netCashFlow={netCashFlow}
            cashBeginning={cashBeginning}
            cashEnding={cashEnding}
            realTimeCashBalance={realTimeCashBalance}
            grossBurnRate={grossBurnRate}
            operatingBreakdown={operatingBreakdown}
            investingFinancingBreakdown={investingFinancingBreakdown}
            waterfallData={waterfallData}
            monthlyFlowData={monthlyFlowData}
            currency={currency}
            cashMetrics={data.cashMetrics || {}}
            contextData={contextData}
            isLoading={isLoading || pnlLoading}
            periodMonths={periodMonths}
          />

          {/* AI Analysis Card */}
          <AIAnalysisCard
            pageType="cashflow"
            data={{
              metrics: {
                operatingCashFlow,
                investingCashFlow,
                financingCashFlow,
                netCashFlow,
                cashBeginning,
                cashEnding,
                burnRate: data.cashMetrics?.burnRate,
              },
              operatingActivities: operatingBreakdown,
              investingActivities,
              financingActivities,
              cashMetrics: data.cashMetrics || {},
              kpis: data.kpis || {},
            }}
            dateRange={dateRange}
            context={{
              dio: data.cashMetrics?.dio,
              runway: data.cashMetrics?.runway,
              cashConversionCycle: data.cashMetrics?.cashConversionCycle,
              periodMonths,
              ...contextData,
            }}
            dataLoadingStates={{
              metricsLoading: isLoading,
            }}
          />

          <CashFlowStatementTable
            data={cashFlowTableData}
            dateRange={dateRange}
            toggleSection={toggleSection}
            currency={currency}
            exportData={cashFlowExportData}
          />
        </>
      )}
    </div>
  )
}
