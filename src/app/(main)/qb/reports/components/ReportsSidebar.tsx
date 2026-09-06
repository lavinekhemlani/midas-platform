// src/app/(main)/reports/components/ReportsSidebar.tsx
'use client'

import React from 'react'
import { LayoutDashboard, TrendingUp, Building2, Wallet } from 'lucide-react'
import { ReportSidebarCard } from './ReportSidebarCard'
import { ReportsTopBar } from './ReportsTopBar'
import { ReportsBottomBar } from './ReportsBottomBar'
import { useReportsContext, ReportView } from '@/contexts/ReportsContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useProfitLoss, useBalanceSheet, useCashFlow } from '@/hooks/useReportData'
import { formatPnLCurrency, formatPercentage } from '@/lib/utils/currency'

export function ReportsSidebar() {
  const { activeView, setActiveView, dateRange } = useReportsContext()
  const { currency } = useCurrency()

  // Fetch data for all reports using context date range
  // SWR will automatically use cached data and refetch only when cache key changes
  // For balance sheet, use dateRange.end as the "as of" date (consistent with BalanceSheetView)
  const { reportData: pnlData } = useProfitLoss(dateRange.start, dateRange.end)
  const { reportData: bsData } = useBalanceSheet(dateRange.end)
  const { reportData: cfData } = useCashFlow(dateRange.start, dateRange.end)

  // Removed manual refetch useEffects - SWR handles this automatically when dates change

  // Extract metrics from each report
  const pnlMetrics = [
    {
      label: 'Revenue',
      value:
        pnlData?.data?.kpis?.totalRevenue !== undefined
          ? formatPnLCurrency(pnlData.data.kpis.totalRevenue, currency)
          : '—',
    },
    {
      label: 'Net Income',
      value:
        pnlData?.data?.kpis?.netIncome !== undefined
          ? formatPnLCurrency(pnlData.data.kpis.netIncome, currency)
          : '—',
    },
    {
      label: 'Net Margin',
      value:
        pnlData?.data?.kpis?.netMargin !== undefined
          ? formatPercentage(pnlData.data.kpis.netMargin, 1)
          : '—',
    },
  ]

  const bsMetrics = [
    {
      label: 'Total Assets',
      value:
        bsData?.data?.kpis?.totalAssets !== undefined
          ? formatPnLCurrency(bsData.data.kpis.totalAssets, currency)
          : '—',
    },
    {
      label: 'Total Equity',
      value:
        bsData?.data?.kpis?.totalEquity !== undefined
          ? formatPnLCurrency(bsData.data.kpis.totalEquity, currency)
          : '—',
    },
    {
      label: 'Current Ratio',
      value:
        bsData?.data?.kpis?.currentRatio !== undefined
          ? bsData.data.kpis.currentRatio.toFixed(2)
          : '—',
    },
  ]

  const cfMetrics = [
    {
      label: 'Operating CF',
      value:
        cfData?.data?.kpis?.operatingCashFlow !== undefined
          ? formatPnLCurrency(cfData.data.kpis.operatingCashFlow, currency)
          : '—',
    },
    {
      label: 'Ending Cash',
      value:
        cfData?.data?.kpis?.endingCash !== undefined
          ? formatPnLCurrency(cfData.data.kpis.endingCash, currency)
          : '—',
    },
    {
      label: 'Runway',
      value:
        cfData?.cashMetrics?.runway_months !== undefined && cfData.cashMetrics.runway_months >= 0
          ? `${cfData.cashMetrics.runway_months.toFixed(1)} mo`
          : '—',
    },
  ]

  // Summary metrics - aggregate from other reports
  const summaryMetrics = [
    {
      label: 'Revenue',
      value:
        pnlData?.data?.kpis?.totalRevenue !== undefined
          ? formatPnLCurrency(pnlData.data.kpis.totalRevenue, currency)
          : '—',
    },
    {
      label: 'Net Income',
      value:
        pnlData?.data?.kpis?.netIncome !== undefined
          ? formatPnLCurrency(pnlData.data.kpis.netIncome, currency)
          : '—',
    },
    {
      label: 'Cash Balance',
      value:
        cfData?.data?.kpis?.endingCash !== undefined
          ? formatPnLCurrency(cfData.data.kpis.endingCash, currency)
          : '—',
    },
  ]

  // Removed hover prefetch functionality to prevent unnecessary refetches
  // All data is fetched when Summary view loads, so prefetching is not needed

  const cards = [
    {
      id: 'summary' as ReportView,
      title: 'Executive Summary',
      description: 'High-level overview of financial performance',
      icon: LayoutDashboard,
    },
    {
      id: 'pnl' as ReportView,
      title: 'Profit & Loss',
      description: 'Revenue, expenses, and profitability',
      icon: TrendingUp,
    },
    {
      id: 'balance-sheet' as ReportView,
      title: 'Balance Sheet',
      description: 'Assets, liabilities, and equity',
      icon: Building2,
    },
    {
      id: 'cash-flow' as ReportView,
      title: 'Cash Flow',
      description: 'Cash movements and liquidity',
      icon: Wallet,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Bar with Date Controls - Sticky */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-2 border-b border-gray-200/5">
        <ReportsTopBar />
      </div>

      {/* Navigation Cards - Fixed height, no scroll */}
      <nav className="flex-1 overflow-hidden" aria-label="Report navigation">
        <div className="flex flex-col h-full">
          {cards.map((card, index) => {
            const activeIndex = cards.findIndex((c) => c.id === activeView)
            const isAboveActive = index === activeIndex - 1
            const isBelowActive = index === activeIndex + 1
            const isFirstCard = index === 0
            const isLastCard = index === cards.length - 1

            return (
              <ReportSidebarCard
                key={card.id}
                id={card.id}
                title={card.title}
                description={card.description}
                icon={card.icon}
                metrics={[]}
                isActive={activeView === card.id}
                isAboveActive={isAboveActive}
                isBelowActive={isBelowActive}
                isFirstCard={isFirstCard}
                isLastCard={isLastCard}
                onClick={() => setActiveView(card.id)}
                onHover={() => {}} // Removed prefetch handler
              />
            )
          })}
        </div>
      </nav>

      {/* Bottom Actions Bar */}
      <div className="px-4 py-3 border-t border-gray-200/10">
        <ReportsBottomBar />
      </div>
    </div>
  )
}
