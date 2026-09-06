// src/app/(main)/reports/views/SummaryView.tsx
'use client'

import { ReportCard } from '@/components/reports'
import { OutstandingPaymentsCard } from '@/components/reports/OutstandingPaymentsCard'
import { UnpaidBillsCard } from '@/components/reports/UnpaidBillsCard'
import { logger } from '@/lib/logger'
import {
  Activity,
  AlertCircle,
  Clock,
  DollarSign,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
// import { CompanyInfoCard } from '@/components/reports/CompanyInfoCard'
import MemorySummaryWidget from '@/app/(main)/components/memory/MemorySummaryWidget'
import { ReportErrorState } from '@/app/(main)/reports/components/ReportErrorState'
import { FinancialHealthCard } from '@/app/(main)/reports/components/summary/FinancialHealthCard'
import { SummaryKPIList } from '@/app/(main)/reports/components/summary/SummaryKPIList'
import { SummaryNavigationCards } from '@/app/(main)/reports/components/summary/SummaryNavigationCards'
import { AIAnalysisCard } from '@/components/ai-analysis'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useReportsContext } from '@/contexts/ReportsContext'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useOutstandingPayments } from '@/hooks/useOutstandingPayments'
import {
  useBalanceSheet,
  useCashFlow,
  useCashFlowMonthlyTrend,
  usePnLMonthlyTrend,
  useProfitLossData,
} from '@/hooks/useReportData'
import { useSession } from '@/hooks/useSession'
import { useUnpaidBills } from '@/hooks/useUnpaidBills'
import { apiClient } from '@/lib/apiClient'
import { getMetricById } from '@/lib/data/financialMetrics'
import { formatPnLCurrency } from '@/lib/utils/currency'
import {
  calculateAssetTurnover,
  calculateCashFlowCoverageRatio,
  calculateCurrentRatio,
  calculateDebtRatio,
  calculateDebtToEquity,
  calculateEquityMultiplier,
  calculateFreeCashFlow,
  calculateNetBurnRate,
  calculateNetMargin,
  calculateOperatingCashFlowMargin,
  calculateOperatingCashFlowRatio,
  calculateQuickRatio,
  calculateROA,
  calculateROE,
  calculateWorkingCapital,
} from '@/lib/utils/financial/calculations'
import {
  calculateDynamicThresholds,
  calculateScoreFromThresholds,
  getDefaultThresholds,
  getStatusFromThresholds,
  isHigherBetter,
} from '@/lib/utils/metricThresholds'
import { DataQualityAlert } from '../components/DataQualityAlert'
import { useMetricStorage } from '../components/hooks/useMetricStorage'

// Helper function to generate tooltip data for financial health metrics
function getFinancialHealthMetricTooltip(
  metricId: string,
  data: {
    cfMetrics: any
    cfExtendedMetrics: any
    bsMetrics: any
    pnlMetrics: any
    cashBalance: number
    grossBurnRate: number
    periodMonths: number
    currency: string
  }
): {
  formula: string
  components: Array<{ label: string; value: string | number; highlight?: boolean }>
  description: string
} | null {
  const {
    cfMetrics,
    cfExtendedMetrics,
    bsMetrics,
    pnlMetrics,
    cashBalance,
    grossBurnRate,
    periodMonths,
    currency,
  } = data

  switch (metricId) {
    // ===== LIQUIDITY METRICS =====
    case 'cash_runway':
      return {
        formula: 'Cash Balance ÷ Gross Monthly Burn Rate',
        components: [
          { label: 'Cash Balance', value: formatPnLCurrency(cashBalance, currency) },
          { label: '÷ Gross Burn Rate', value: formatPnLCurrency(grossBurnRate, currency) },
          {
            label: '= Runway',
            value:
              cashBalance > 0 && grossBurnRate > 0
                ? `${(cashBalance / grossBurnRate).toFixed(1)} months`
                : 'N/A',
            highlight: true,
          },
        ],
        description:
          'Number of months your business can operate at current spending levels before running out of cash.',
      }

    case 'cash_balance':
      return {
        formula: 'Total Cash and Cash Equivalents',
        components: [
          {
            label: 'Cash Balance',
            value: formatPnLCurrency(cashBalance, currency),
            highlight: true,
          },
        ],
        description: 'Total amount of liquid cash available to your business for immediate use.',
      }

    case 'cash_flow':
      return {
        formula: 'Cash from Operating Activities',
        components: [
          {
            label: 'Operating Cash Flow',
            value: formatPnLCurrency(cfMetrics.operatingCashFlow || 0, currency),
            highlight: true,
          },
        ],
        description:
          'Cash generated from core business operations, excluding financing and investing activities.',
      }

    case 'working_capital':
      return {
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
            value: formatPnLCurrency(
              (bsMetrics.currentAssets || 0) - (bsMetrics.currentLiabilities || 0)
            ),
            highlight: true,
          },
        ],
        description:
          'Capital available for day-to-day operations. Positive working capital indicates good short-term financial health.',
      }

    case 'free_cash_flow':
      const ocf = cfMetrics.operatingCashFlow || 0
      const capEx = cfExtendedMetrics.capital_expenditures || 0
      return {
        formula: 'Operating Cash Flow - Capital Expenditures',
        components: [
          { label: 'Operating Cash Flow', value: formatPnLCurrency(ocf, currency) },
          { label: 'Capital Expenditures', value: formatPnLCurrency(capEx, currency) },
          {
            label: 'Free Cash Flow',
            value: formatPnLCurrency(ocf - capEx, currency),
            highlight: true,
          },
        ],
        description:
          'Cash available after funding operations and capital investments. Used for growth, dividends, or debt repayment.',
      }

    case 'burn_rate':
      return {
        formula: 'Total Monthly Expenses',
        components: [
          {
            label: 'Total Expenses',
            value: formatPnLCurrency(pnlMetrics.totalExpenses || 0, currency),
          },
          { label: '÷ Period (months)', value: `${periodMonths}` },
          {
            label: '= Gross Burn Rate',
            value: `${formatPnLCurrency(grossBurnRate, currency)}/mo`,
            highlight: true,
          },
        ],
        description: 'Total amount of cash your business spends each month on operating expenses.',
      }

    case 'net_burn_rate':
      const netBurn =
        ((pnlMetrics.totalExpenses || 0) - (pnlMetrics.totalRevenue || 0)) / periodMonths
      return {
        formula: '(Total Expenses - Total Revenue) ÷ Months',
        components: [
          {
            label: 'Total Expenses',
            value: formatPnLCurrency(pnlMetrics.totalExpenses || 0, currency),
          },
          {
            label: 'Total Revenue',
            value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
          },
          { label: '÷ Period (months)', value: `${periodMonths}` },
          {
            label: '= Net Burn Rate',
            value: `${formatPnLCurrency(netBurn, currency)}/mo`,
            highlight: true,
          },
        ],
        description:
          "Monthly cash consumption after accounting for revenue. Negative value means you're profitable.",
      }

    // ===== PROFITABILITY METRICS =====
    case 'gross_margin':
      return {
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
            value: `${(pnlMetrics.grossMargin || 0).toFixed(1)}%`,
            highlight: true,
          },
        ],
        description:
          'Percentage of revenue remaining after direct costs. Higher margins indicate better pricing power and efficiency.',
      }

    case 'net_profit_margin':
      const netMargin = ((pnlMetrics.netIncome || 0) / (pnlMetrics.totalRevenue || 1)) * 100
      return {
        formula: '(Net Income ÷ Revenue) × 100',
        components: [
          { label: 'Net Income', value: formatPnLCurrency(pnlMetrics.netIncome || 0, currency) },
          {
            label: 'Total Revenue',
            value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
          },
          { label: 'Net Profit Margin', value: `${netMargin.toFixed(1)}%`, highlight: true },
        ],
        description:
          'Bottom-line profitability after all expenses. Shows how much profit is generated per dollar of revenue.',
      }

    case 'operating_margin':
      return {
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
            value: `${(pnlMetrics.operatingMargin || 0).toFixed(1)}%`,
            highlight: true,
          },
        ],
        description:
          'Profitability from core operations before interest and taxes. Indicates operational efficiency.',
      }

    case 'roe':
      const roe = ((pnlMetrics.netIncome || 0) / (bsMetrics.totalEquity || 1)) * 100
      return {
        formula: '(Net Income ÷ Total Equity) × 100',
        components: [
          { label: 'Net Income', value: formatPnLCurrency(pnlMetrics.netIncome || 0, currency) },
          { label: 'Total Equity', value: formatPnLCurrency(bsMetrics.totalEquity || 0, currency) },
          { label: 'Return on Equity', value: `${roe.toFixed(1)}%`, highlight: true },
        ],
        description:
          'Measures profitability relative to shareholder equity. Shows how effectively equity is used to generate profit.',
      }

    case 'roa':
      const roa = ((pnlMetrics.netIncome || 0) / (bsMetrics.totalAssets || 1)) * 100
      return {
        formula: '(Net Income ÷ Total Assets) × 100',
        components: [
          { label: 'Net Income', value: formatPnLCurrency(pnlMetrics.netIncome || 0, currency) },
          { label: 'Total Assets', value: formatPnLCurrency(bsMetrics.totalAssets || 0, currency) },
          { label: 'Return on Assets', value: `${roa.toFixed(1)}%`, highlight: true },
        ],
        description:
          'Measures how efficiently assets are used to generate profit. Higher values indicate better asset utilization.',
      }

    case 'operating_cash_flow_margin':
      const ocfMargin = ((cfMetrics.operatingCashFlow || 0) / (pnlMetrics.totalRevenue || 1)) * 100
      return {
        formula: '(Operating Cash Flow ÷ Revenue) × 100',
        components: [
          {
            label: 'Operating Cash Flow',
            value: formatPnLCurrency(cfMetrics.operatingCashFlow || 0, currency),
          },
          {
            label: 'Total Revenue',
            value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
          },
          { label: 'OCF Margin', value: `${ocfMargin.toFixed(1)}%`, highlight: true },
        ],
        description:
          'Cash generated from operations as a percentage of revenue. Shows quality of earnings and cash generation ability.',
      }

    // ===== EFFICIENCY METRICS =====
    case 'working_capital_ratio':
      const currentRatio = (bsMetrics.currentAssets || 0) / (bsMetrics.currentLiabilities || 1)
      return {
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
          { label: 'Current Ratio', value: currentRatio.toFixed(2), highlight: true },
        ],
        description:
          'Ability to pay short-term obligations. A ratio above 1.0 indicates sufficient liquidity.',
      }

    case 'quick_ratio':
      // Use actual inventory value - no estimation (inventory varies by business type)
      const inventory = bsMetrics.inventory ?? 0
      const quickRatio =
        ((bsMetrics.currentAssets || 0) - inventory) / (bsMetrics.currentLiabilities || 1)
      return {
        formula: '(Current Assets - Inventory) ÷ Current Liabilities',
        components: [
          {
            label: 'Current Assets',
            value: formatPnLCurrency(bsMetrics.currentAssets || 0, currency),
          },
          {
            label: 'Inventory',
            value: inventory > 0 ? formatPnLCurrency(inventory, currency) : 'Not tracked',
          },
          {
            label: 'Current Liabilities',
            value: formatPnLCurrency(bsMetrics.currentLiabilities || 0, currency),
          },
          { label: 'Quick Ratio', value: quickRatio.toFixed(2), highlight: true },
        ],
        description:
          'Conservative liquidity measure excluding inventory. Tests ability to meet obligations with most liquid assets.',
      }

    case 'cash_conversion_cycle':
      const ccc = cfExtendedMetrics.cash_conversion_cycle || 0
      return {
        formula: 'DSO + DIO - DPO',
        components: [
          {
            label: 'Days Sales Outstanding',
            value: `${cfExtendedMetrics.days_receivable || 0} days`,
          },
          {
            label: 'Days Inventory Outstanding',
            value: `${cfExtendedMetrics.days_inventory || 0} days`,
          },
          {
            label: 'Days Payable Outstanding',
            value: `${cfExtendedMetrics.days_payable || 0} days`,
          },
          { label: 'Cash Conversion Cycle', value: `${Math.round(ccc)} days`, highlight: true },
        ],
        description:
          'Time (in days) to convert investments in inventory and receivables back into cash. Lower is better.',
      }

    case 'asset_turnover':
      const assetTurnover = (pnlMetrics.totalRevenue || 0) / (bsMetrics.totalAssets || 1)
      return {
        formula: 'Revenue ÷ Total Assets',
        components: [
          {
            label: 'Total Revenue',
            value: formatPnLCurrency(pnlMetrics.totalRevenue || 0, currency),
          },
          { label: 'Total Assets', value: formatPnLCurrency(bsMetrics.totalAssets || 0, currency) },
          { label: 'Asset Turnover', value: assetTurnover.toFixed(2), highlight: true },
        ],
        description:
          'How efficiently assets generate revenue. Higher ratios indicate better asset utilization.',
      }

    case 'inventory_turnover':
      // Use actual inventory value - no estimation (inventory varies by business type)
      const inv = bsMetrics.inventory ?? 0
      const invTurnover = inv > 0 ? (pnlMetrics.costOfGoodsSold || 0) / inv : 0
      return {
        formula: 'Cost of Goods Sold ÷ Average Inventory',
        components: [
          {
            label: 'Cost of Goods Sold',
            value: formatPnLCurrency(pnlMetrics.costOfGoodsSold || 0, currency),
          },
          {
            label: 'Inventory',
            value: inv > 0 ? formatPnLCurrency(inv, currency) : 'Not tracked',
          },
          {
            label: 'Inventory Turnover',
            value: inv > 0 ? invTurnover.toFixed(2) : 'N/A',
            highlight: true,
          },
        ],
        description:
          'How many times inventory is sold and replaced in a period. Higher turnover indicates efficient inventory management.',
      }

    case 'dso':
      const dso = cfExtendedMetrics.days_receivable || 0
      return {
        formula: '(Accounts Receivable ÷ Revenue) × Days in Period',
        components: [
          { label: 'Days Sales Outstanding', value: `${Math.round(dso)} days`, highlight: true },
        ],
        description:
          'Average days to collect payment from customers. Lower values indicate faster cash collection.',
      }

    case 'dpo':
      const dpo = cfExtendedMetrics.days_payable || 0
      return {
        formula: '(Accounts Payable ÷ COGS) × Days in Period',
        components: [
          { label: 'Days Payable Outstanding', value: `${Math.round(dpo)} days`, highlight: true },
        ],
        description:
          'Average days taken to pay suppliers. Higher values can improve cash flow but may strain supplier relationships.',
      }

    // ===== LEVERAGE & RETURNS METRICS =====
    case 'debt_to_equity':
      const dte = (bsMetrics.totalLiabilities || 0) / (bsMetrics.totalEquity || 1)
      return {
        formula: 'Total Liabilities ÷ Total Equity',
        components: [
          {
            label: 'Total Liabilities',
            value: formatPnLCurrency(bsMetrics.totalLiabilities || 0, currency),
          },
          { label: 'Total Equity', value: formatPnLCurrency(bsMetrics.totalEquity || 0, currency) },
          { label: 'Debt-to-Equity', value: dte.toFixed(2), highlight: true },
        ],
        description:
          'Financial leverage indicator showing the proportion of debt to equity. Lower ratios indicate less financial risk.',
      }

    case 'debt_ratio':
      const debtRatio = (bsMetrics.totalLiabilities || 0) / (bsMetrics.totalAssets || 1)
      return {
        formula: 'Total Liabilities ÷ Total Assets',
        components: [
          {
            label: 'Total Liabilities',
            value: formatPnLCurrency(bsMetrics.totalLiabilities || 0, currency),
          },
          { label: 'Total Assets', value: formatPnLCurrency(bsMetrics.totalAssets || 0, currency) },
          { label: 'Debt Ratio', value: `${(debtRatio * 100).toFixed(1)}%`, highlight: true },
        ],
        description:
          'Percentage of assets financed by debt. Lower percentages indicate stronger financial position.',
      }

    case 'equity_multiplier':
      const eqMultiplier = (bsMetrics.totalAssets || 0) / (bsMetrics.totalEquity || 1)
      return {
        formula: 'Total Assets ÷ Total Equity',
        components: [
          { label: 'Total Assets', value: formatPnLCurrency(bsMetrics.totalAssets || 0, currency) },
          { label: 'Total Equity', value: formatPnLCurrency(bsMetrics.totalEquity || 0, currency) },
          { label: 'Equity Multiplier', value: eqMultiplier.toFixed(2), highlight: true },
        ],
        description:
          'Measures financial leverage. Higher values indicate more debt financing relative to equity.',
      }

    case 'operating_cash_flow_ratio':
      const ocfRatio = (cfMetrics.operatingCashFlow || 0) / (bsMetrics.currentLiabilities || 1)
      return {
        formula: 'Operating Cash Flow ÷ Current Liabilities',
        components: [
          {
            label: 'Operating Cash Flow',
            value: formatPnLCurrency(cfMetrics.operatingCashFlow || 0, currency),
          },
          {
            label: 'Current Liabilities',
            value: formatPnLCurrency(bsMetrics.currentLiabilities || 0, currency),
          },
          { label: 'OCF Ratio', value: ocfRatio.toFixed(2), highlight: true },
        ],
        description:
          'Ability to cover current liabilities with cash from operations. Higher ratios indicate better debt coverage.',
      }

    case 'cash_flow_coverage_ratio':
      const cfCoverage = (cfMetrics.operatingCashFlow || 0) / (bsMetrics.totalLiabilities || 1)
      return {
        formula: 'Operating Cash Flow ÷ Total Liabilities',
        components: [
          {
            label: 'Operating Cash Flow',
            value: formatPnLCurrency(cfMetrics.operatingCashFlow || 0, currency),
          },
          {
            label: 'Total Liabilities',
            value: formatPnLCurrency(bsMetrics.totalLiabilities || 0, currency),
          },
          { label: 'CF Coverage Ratio', value: cfCoverage.toFixed(2), highlight: true },
        ],
        description:
          'Ability to cover total debt with operating cash flow. Higher ratios indicate stronger debt servicing capacity.',
      }

    default:
      return null
  }
}

export function SummaryView() {
  const { dateRange } = useReportsContext()
  const { currency } = useCurrency()
  const { organization, refetchSession } = useSession()
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Detect single-month period (e.g., "This Month", "Last Month")
  // When only one month of data exists, charts need alternative visualizations
  const isSingleMonth = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return false
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  }, [dateRange.start, dateRange.end])

  // Calculate asOfDate from dateRange.end for Balance Sheet
  const asOfDate = dateRange.end

  // Fetch data from all three reports using context dates
  const {
    reportData: cashFlowData,
    isLoading: cfLoading,
    isValidating: cfValidating,
    error: cfError,
    mutate: mutateCF,
  } = useCashFlow(dateRange.start, dateRange.end)
  const {
    reportData: balanceSheetData,
    isLoading: bsLoading,
    isValidating: bsValidating,
    error: bsError,
    mutate: mutateBS,
  } = useBalanceSheet(asOfDate)
  const {
    reportData: pnlData,
    isLoading: pnlLoading,
    isValidating: pnlValidating,
    error: pnlError,
    mutate: mutatePnL,
  } = useProfitLossData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end,
  })

  // Fetch P&L monthly trend separately for faster core data loading
  const {
    trendData: pnlMonthlyTrend,
    isLoading: pnlTrendLoading,
    isValidating: pnlTrendValidating,
    error: pnlTrendError,
    mutate: mutatePnLTrend,
  } = usePnLMonthlyTrend(dateRange.start, dateRange.end)

  // Fetch Cash Flow monthly trend separately for faster core data loading
  const {
    trendData: cfMonthlyTrend,
    isLoading: cfTrendLoading,
    isValidating: cfTrendValidating,
    error: cfTrendError,
    mutate: mutateCFTrend,
  } = useCashFlowMonthlyTrend(dateRange.start, dateRange.end)

  // Fetch outstanding payments and unpaid bills data
  const { outstandingData: paymentsData, isLoading: paymentsLoading } = useOutstandingPayments(
    dateRange.start,
    dateRange.end
  )
  const { unpaidBillsData, isLoading: billsLoading } = useUnpaidBills(
    dateRange.start,
    dateRange.end,
    organization?.organization_id
  )

  // Progressive loading state - allow partial rendering
  const isLoading = cfLoading || bsLoading || pnlLoading
  const isValidating = cfValidating || bsValidating || pnlValidating

  // Track data availability for progressive rendering
  const hasAnyData = !!(cashFlowData || balanceSheetData || pnlData)
  const hasCoreData = !!(pnlData || balanceSheetData) // Need at least P&L or BS for core metrics
  const hasAllData = !!(cashFlowData && balanceSheetData && pnlData)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    // Only show loading in welcome context if we have no data at all
    welcomeContext?.setDataLoading(isLoading && !hasAnyData)
  }, [isLoading, hasAnyData, welcomeContext])

  // Check for authentication errors (these block everything)
  const authError =
    cfError?.status === 401 || cfError?.status === 403
      ? cfError
      : bsError?.status === 401 || bsError?.status === 403
        ? bsError
        : pnlError?.status === 401 || pnlError?.status === 403
          ? pnlError
          : null

  // Only show critical error if auth failed or ALL reports failed
  const allReportsFailed = !!(cfError && bsError && pnlError)
  const hasCriticalError = !isLoading && (authError || (allReportsFailed && !hasAnyData))

  // SWR automatically refetches when date range/asOfDate changes, no manual refetch needed

  // Extract key metrics from each report
  const cfMetrics = cashFlowData?.data?.kpis || {}
  const cfExtendedMetrics = cashFlowData?.data?.cashMetrics || {} // Extended cash flow metrics (DSO, DPO, etc.)
  // Extract balance sheet metrics from flat API response
  const bsMetrics = {
    totalAssets: balanceSheetData?.totalAssets,
    totalLiabilities: balanceSheetData?.totalLiabilities,
    totalEquity: balanceSheetData?.totalEquity,
    currentAssets: balanceSheetData?.currentAssets,
    currentLiabilities: balanceSheetData?.currentLiabilities,
    currentRatio: balanceSheetData?.currentRatio,
    quickRatio: balanceSheetData?.quickRatio,
    workingCapital: balanceSheetData?.workingCapital,
    inventory: balanceSheetData?.inventory,
    debtToEquity: balanceSheetData?.debtToEquity,
    roa: balanceSheetData?.roa,
  }
  const pnlMetrics = pnlData?.data?.kpis || {}

  // Calculate period in months
  const calculatePeriodMonths = () => {
    if (!dateRange.start || !dateRange.end) return 1
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, Math.round(diffDays / 30)) // Approximate months
  }

  const periodMonths = calculatePeriodMonths()

  // Calculate runway months at component level for reuse
  // Use real-time bank account balance from P&L report (matches P&L page), fallback to cash flow/balance sheet
  const cashBalance = pnlMetrics.cashBalance || cfMetrics.cashEnding || bsMetrics.cashBalance || 0
  const grossBurnRate = pnlMetrics.totalExpenses
    ? Math.abs(pnlMetrics.totalExpenses) / periodMonths
    : 0
  const runwayMonths = cashBalance && grossBurnRate > 0 ? cashBalance / grossBurnRate : 0

  // Get selected metrics and targets from organization settings BEFORE calculateHealthScore
  const DEFAULT_METRICS = ['gross_margin', 'cash_runway', 'cash_flow', 'working_capital']
  const selectedMetricIds =
    organization?.financial_health_metrics && organization.financial_health_metrics.length === 4
      ? organization.financial_health_metrics
      : DEFAULT_METRICS
  const customTargets = organization?.financial_health_targets || []

  // Helper to check if data is available for a metric
  const hasDataForMetric = useMemo(() => {
    return (metricId: string): boolean => {
      switch (metricId) {
        // Liquidity Metrics
        case 'cash_runway':
          return !!(cashBalance > 0 && grossBurnRate > 0)
        case 'cash_balance':
          return cashBalance !== undefined && cashBalance !== null
        case 'cash_flow':
          return cfMetrics.operatingCashFlow !== undefined && cfMetrics.operatingCashFlow !== null
        case 'working_capital':
          return !!(bsMetrics.currentAssets && bsMetrics.currentLiabilities)
        case 'free_cash_flow':
          return !!(
            cfMetrics.operatingCashFlow !== undefined ||
            cfExtendedMetrics.free_cash_flow !== undefined
          )
        case 'burn_rate':
          return grossBurnRate !== undefined && grossBurnRate !== null
        case 'net_burn_rate':
          return !!(pnlMetrics.totalExpenses && pnlMetrics.totalRevenue)

        // Profitability Metrics
        case 'gross_margin':
          return pnlMetrics.grossMargin !== undefined && pnlMetrics.grossMargin !== null
        case 'net_profit_margin':
          return !!(pnlMetrics.totalRevenue && pnlMetrics.netIncome !== undefined)
        case 'operating_margin':
          return pnlMetrics.operatingMargin !== undefined && pnlMetrics.operatingMargin !== null
        case 'roe':
          return !!(pnlMetrics.netIncome !== undefined && bsMetrics.totalEquity)
        case 'roa':
          return !!(pnlMetrics.netIncome !== undefined && bsMetrics.totalAssets)
        case 'operating_cash_flow_margin':
          return !!(cfMetrics.operatingCashFlow !== undefined && pnlMetrics.totalRevenue)

        // Efficiency Metrics
        case 'working_capital_ratio':
          return !!(bsMetrics.currentAssets && bsMetrics.currentLiabilities)
        case 'quick_ratio':
          return !!(bsMetrics.currentAssets && bsMetrics.currentLiabilities)
        case 'cash_conversion_cycle':
          return cfExtendedMetrics.cash_conversion_cycle !== undefined
        case 'asset_turnover':
          return !!(pnlMetrics.totalRevenue && bsMetrics.totalAssets)
        case 'inventory_turnover':
          return !!(
            pnlMetrics.costOfGoodsSold &&
            (bsMetrics.inventory !== undefined || bsMetrics.currentAssets)
          )
        case 'dso':
          return cfExtendedMetrics.days_receivable !== undefined
        case 'dpo':
          return cfExtendedMetrics.days_payable !== undefined

        // Leverage & Returns Metrics
        case 'debt_to_equity':
          return !!(bsMetrics.totalLiabilities !== undefined && bsMetrics.totalEquity)
        case 'debt_ratio':
          return !!(bsMetrics.totalLiabilities !== undefined && bsMetrics.totalAssets)
        case 'equity_multiplier':
          return !!(bsMetrics.totalAssets && bsMetrics.totalEquity)

        // Additional Cash Flow Metrics
        case 'operating_cash_flow_ratio':
          return !!(cfMetrics.operatingCashFlow !== undefined && bsMetrics.currentLiabilities)
        case 'cash_flow_coverage_ratio':
          return !!(cfMetrics.operatingCashFlow !== undefined && bsMetrics.totalLiabilities)

        default:
          return false
      }
    }
  }, [cfMetrics, cfExtendedMetrics, bsMetrics, pnlMetrics, cashBalance, grossBurnRate])

  // Helper to get metric value from report data (memoized for performance)
  // Returns null if data is not available, allowing UI to show "No data" state
  const getMetricValue = useMemo(() => {
    const metricMapping: Record<string, () => number | null> = {
      // Liquidity Metrics
      cash_runway: () => {
        try {
          if (!cashBalance || !grossBurnRate || grossBurnRate <= 0) return null
          const runway = cashBalance / grossBurnRate
          if (!isFinite(runway) || isNaN(runway)) {
            logger.warn('Invalid cash runway calculation', {
              metric: 'cashRunway',
              cashBalance,
              grossBurnRate,
              result: runway,
            })
            return null
          }
          return runway
        } catch (error) {
          logger.error('Error calculating cash runway', { error, metric: 'cashRunway' })
          return null
        }
      },
      cash_balance: () => cashBalance ?? null,
      cash_flow: () => cfMetrics.operatingCashFlow ?? null,
      working_capital: () =>
        calculateWorkingCapital(bsMetrics.currentAssets || 0, bsMetrics.currentLiabilities || 0),
      free_cash_flow: () => {
        // Use pre-calculated free cash flow from extended metrics if available
        // Otherwise calculate it: Operating Cash Flow - Capital Expenditures
        const ocf = cfMetrics.operatingCashFlow || 0
        const capEx = cfExtendedMetrics.capital_expenditures || 0
        return cfExtendedMetrics.free_cash_flow ?? calculateFreeCashFlow(ocf, capEx)
      },
      burn_rate: () => grossBurnRate,
      net_burn_rate: () =>
        calculateNetBurnRate(pnlMetrics.totalExpenses || 0, pnlMetrics.totalRevenue || 0) /
        periodMonths,

      // Profitability Metrics
      gross_margin: () => pnlMetrics.grossMargin || 0,
      net_profit_margin: () =>
        calculateNetMargin(pnlMetrics.totalRevenue || 0, pnlMetrics.netIncome || 0),
      operating_margin: () => {
        // Use pre-calculated operating margin if available, otherwise calculate
        return pnlMetrics.operatingMargin ?? 0
      },
      roe: () => calculateROE(pnlMetrics.netIncome || 0, bsMetrics.totalEquity || 0),
      roa: () => calculateROA(pnlMetrics.netIncome || 0, bsMetrics.totalAssets || 0),
      operating_cash_flow_margin: () =>
        calculateOperatingCashFlowMargin(
          cfMetrics.operatingCashFlow || 0,
          pnlMetrics.totalRevenue || 0
        ),

      // Efficiency Metrics
      working_capital_ratio: () =>
        calculateCurrentRatio(bsMetrics.currentAssets || 0, bsMetrics.currentLiabilities || 0),
      quick_ratio: () => {
        // Use real inventory from balance sheet if available, otherwise use 0
        const inventory = bsMetrics.inventory ?? 0
        return calculateQuickRatio(
          bsMetrics.currentAssets || 0,
          inventory,
          bsMetrics.currentLiabilities || 0
        )
      },
      cash_conversion_cycle: () => {
        // Use pre-calculated CCC from extended metrics if available
        return cfExtendedMetrics.cash_conversion_cycle ?? 0
      },
      asset_turnover: () =>
        calculateAssetTurnover(pnlMetrics.totalRevenue || 0, bsMetrics.totalAssets || 0),
      inventory_turnover: () => {
        // Use real inventory from balance sheet if available, otherwise use 0
        const inventory = bsMetrics.inventory ?? 0
        if (inventory === 0) return 0
        return (pnlMetrics.costOfGoodsSold || 0) / inventory
      },
      dso: () => {
        // Days Sales Outstanding from extended metrics
        return cfExtendedMetrics.days_receivable ?? 0
      },
      dpo: () => {
        // Days Payable Outstanding from extended metrics
        return cfExtendedMetrics.days_payable ?? 0
      },

      // Leverage & Returns Metrics
      debt_to_equity: () =>
        calculateDebtToEquity(bsMetrics.totalLiabilities || 0, bsMetrics.totalEquity || 0),
      debt_ratio: () =>
        calculateDebtRatio(bsMetrics.totalLiabilities || 0, bsMetrics.totalAssets || 0),
      equity_multiplier: () =>
        calculateEquityMultiplier(bsMetrics.totalAssets || 0, bsMetrics.totalEquity || 0),

      // Additional Cash Flow Metrics
      operating_cash_flow_ratio: () => {
        // Use pre-calculated ratio from extended metrics if available
        return (
          cfExtendedMetrics.operating_cash_flow_ratio ??
          calculateOperatingCashFlowRatio(
            cfMetrics.operatingCashFlow || 0,
            bsMetrics.currentLiabilities || 0
          )
        )
      },
      cash_flow_coverage_ratio: () => {
        // Use pre-calculated ratio from extended metrics if available
        return (
          cfExtendedMetrics.cash_flow_coverage_ratio ??
          calculateCashFlowCoverageRatio(
            cfMetrics.operatingCashFlow || 0,
            bsMetrics.totalLiabilities || 0
          )
        )
      },
    }

    return (metricId: string): number | null => {
      // Return null if data is not available for this metric
      if (!hasDataForMetric(metricId)) {
        logger.debug('No data available for metric', { metricId })
        return null
      }

      // Wrap metric calculation in try-catch for safety
      try {
        const calculator = metricMapping[metricId]
        if (!calculator) {
          logger.warn('No calculator found for metric', { metricId })
          return null
        }

        const value = calculator()

        // Validate the result
        if (value !== null && (isNaN(value) || !isFinite(value))) {
          logger.error('Invalid value for metric', {
            metricId,
            value,
            isNaN: isNaN(value),
            isFinite: isFinite(value),
          })
          return null
        }

        return value
      } catch (error) {
        logger.error('Error calculating metric', { error, metricId })
        return null
      }
    }
  }, [
    cfMetrics,
    cfExtendedMetrics,
    bsMetrics,
    pnlMetrics,
    periodMonths,
    runwayMonths,
    cashBalance,
    grossBurnRate,
    hasDataForMetric,
  ])

  // Dynamic financial health score calculation based on selected metrics and targets (memoized for performance)
  const healthScore = useMemo(() => {
    try {
      if (selectedMetricIds.length !== 4) {
        logger.debug('Health score not configured - requires exactly 4 metrics', {
          count: selectedMetricIds.length,
        })
        return { score: 0, rating: 'Not Configured', components: [] }
      }

      let totalScore = 0
      let metricsWithData = 0
      const components: Array<{
        metricId: string
        name: string
        score: number
        weight: number
        status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
      }> = []

      for (const metricId of selectedMetricIds) {
        try {
          const value = getMetricValue(metricId)
          const target = customTargets.find((t) => t.metric_id === metricId)
          const metricDef = getMetricById(metricId)

          if (!metricDef) {
            logger.warn('Metric definition not found', { metricId })
            continue
          }

          // Skip metrics with no data available
          if (value === null) {
            logger.debug('Skipping metric - no data available', { metricId })
            continue
          }

          metricsWithData++

          let score: number
          let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

          if (target) {
            // Use custom target and dynamic thresholds
            const thresholds = calculateDynamicThresholds(metricId, target.target, target.unit)
            const higherBetter = isHigherBetter(metricId, target.unit)
            score = calculateScoreFromThresholds(value, thresholds, higherBetter)
            status = getStatusFromThresholds(value, thresholds, higherBetter)
          } else {
            // Fallback to default thresholds if available
            const defaultThresholds = getDefaultThresholds(metricId)
            if (defaultThresholds) {
              const higherBetter = isHigherBetter(metricId, metricDef.unit)
              score = calculateScoreFromThresholds(value, defaultThresholds, higherBetter)
              status = getStatusFromThresholds(value, defaultThresholds, higherBetter)
            } else {
              // No thresholds available, assign neutral score
              logger.warn('No thresholds available for metric, using neutral score', { metricId })
              score = 50
              status = 'fair'
            }
          }

          // Validate score
          if (isNaN(score) || !isFinite(score)) {
            logger.error('Invalid score for metric', { metricId, score, value })
            score = 0
            status = 'critical'
          }

          totalScore += score * 0.25 // Equal weight for all 4 metrics
          components.push({
            metricId,
            name: metricDef.name,
            score,
            weight: 0.25,
            status,
          })
        } catch (metricError) {
          logger.error('Error processing metric', { error: metricError, metricId })
          // Continue processing other metrics
        }
      }

      // Warn if too many metrics are missing data
      if (metricsWithData < 2) {
        logger.warn('Less than 2 metrics have data available', {
          total: selectedMetricIds.length,
          withData: metricsWithData,
          metrics: selectedMetricIds,
        })
      }

      const finalScore = Math.round(totalScore)
      const rating =
        finalScore >= 80
          ? 'Excellent'
          : finalScore >= 60
            ? 'Good'
            : finalScore >= 40
              ? 'Fair'
              : 'Needs Attention'

      logger.debug('Health score calculation complete', {
        finalScore,
        rating,
        metricsWithData,
        totalMetrics: selectedMetricIds.length,
      })

      return { score: finalScore, rating, components }
    } catch (error) {
      logger.error('Fatal error calculating health score', { error })
      return { score: 0, rating: 'Error', components: [] }
    }
  }, [selectedMetricIds, customTargets, getMetricValue])

  // Handler for saving settings (optimized with loading state)
  const handleSaveSettings = async (
    metrics: string[],
    targets: Array<{ metric_id: string; target: number; unit: string }>,
    revenueModel: string
  ) => {
    logger.debug('Saving financial health settings', {
      component: 'Settings',
      metrics,
      targets,
      revenueModel,
    })

    try {
      if (!organization?.organization_id) {
        logger.error('Cannot save - organization ID not found', { component: 'Settings' })
        throw new Error('Organization ID not found')
      }

      setIsSavingSettings(true)

      // Make API call to save settings
      const response = await apiClient(`/api/organizations/${organization.organization_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          organizationData: {
            financial_health_metrics: metrics,
            financial_health_targets: targets,
            revenue_model: revenueModel,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        logger.error('API error saving settings', {
          component: 'Settings',
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        })
        throw new Error(errorData.message || 'Failed to save settings')
      }

      logger.info('Successfully saved financial health settings', { component: 'Settings' })

      // Refresh session to get updated organization data
      // This could be further optimized with SWR's mutate for optimistic updates
      await refetchSession()
      logger.debug('Session refreshed after save', { component: 'Settings' })
    } catch (error) {
      logger.error('Failed to save financial health settings', {
        component: 'Settings',
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Helper to get metric icon
  const getMetricIcon = (metricId: string) => {
    const iconMap: Record<string, any> = {
      cash_runway: Clock,
      gross_margin: Percent,
      cash_flow: DollarSign,
      cash_balance: Wallet,
      mrr_growth_rate: TrendingUp,
      revenue_growth_rate: TrendingUp,
      customer_churn_rate: TrendingDown,
    }
    return iconMap[metricId] || Activity
  }

  // Helper to get metric color
  const getMetricColor = (metricId: string): string => {
    const colorMap: Record<string, string> = {
      cash_runway: 'orange',
      gross_margin: 'amber',
      cash_flow: 'blue',
      cash_balance: 'green',
      mrr_growth_rate: 'purple',
      revenue_growth_rate: 'cyan',
      customer_churn_rate: 'red',
      working_capital: 'green',
      net_profit_margin: 'blue',
      operating_margin: 'cyan',
      quick_ratio: 'purple',
      current_ratio: 'emerald',
    }
    return colorMap[metricId] || 'gray'
  }

  // Helper to get learn sheet termId from metricId
  const getMetricTermId = (metricId: string): string => {
    const termIdMap: Record<string, string> = {
      cash_runway: 'runway',
      gross_margin: 'gross-margin',
      cash_flow: 'cash-flow',
      cash_balance: 'cash_balance',
      working_capital: 'working-capital',
      net_profit_margin: 'net-profit-margin',
      operating_margin: 'operating-margin',
      quick_ratio: 'quick-ratio',
      working_capital_ratio: 'current-ratio',
      burn_rate: 'burn-rate',
      net_burn_rate: 'burn-rate',
    }
    return termIdMap[metricId] || metricId.replace(/_/g, '-')
  }

  // Helper to format metric value for display
  const formatMetricValue = (metricId: string, value: number): string => {
    const metric = getMetricById(metricId)
    if (!metric) return 'N/A'

    const unit = metric.unit
    if (unit === 'months') {
      return value > 0 ? `${value.toFixed(1)} mo` : 'N/A'
    } else if (unit === '%') {
      return `${value.toFixed(1)}%`
    } else if (unit === 'currency') {
      return formatPnLCurrency(value, currency)
    } else if (unit === 'ratio') {
      return value.toFixed(2)
    } else if (unit === 'days') {
      return `${Math.round(value)} days`
    }
    return value.toFixed(2)
  }

  // Helper to format target for display
  const formatTargetValue = (metricId: string, target: number | undefined): string => {
    const metric = getMetricById(metricId)
    if (!metric || target === undefined) return ''

    const unit = metric.unit
    const higherIsBetter = isHigherBetter(metricId, unit)

    // For lower-is-better metrics, use "≤" or "<" notation
    // For higher-is-better metrics, use "≥" or "+" notation
    const targetIndicator = higherIsBetter ? '+' : ' max'

    // Special handling for zero targets
    if (target === 0) {
      if (unit === 'currency') {
        // For net burn rate, 0 means break-even
        if (metricId === 'net_burn_rate') {
          return 'Break-even'
        }
        return higherIsBetter ? '≥$0' : '≤$0'
      } else if (unit === '%') {
        return higherIsBetter ? '≥0%' : '≤0%'
      }
    }

    if (unit === 'months') {
      return `${target}+ mo`
    } else if (unit === '%') {
      return higherIsBetter ? `${target}%+` : `≤${target}%`
    } else if (unit === 'currency') {
      // For lower-is-better currency metrics (burn_rate, net_burn_rate)
      if (!higherIsBetter) {
        return `≤${formatPnLCurrency(Math.abs(target), currency)}`
      }
      return formatPnLCurrency(target, currency) + '+'
    } else if (unit === 'ratio') {
      return higherIsBetter ? `${target.toFixed(1)}+` : `≤${target.toFixed(1)}`
    } else if (unit === 'days') {
      return higherIsBetter ? `${Math.round(target)}+ days` : `≤${Math.round(target)} days`
    }
    return higherIsBetter ? `${target}+` : `≤${target}`
  }

  // Generate insights based on metrics
  const generateInsights = () => {
    const insights: Array<{ type: 'positive' | 'warning' | 'info'; message: string }> = []

    // Cash flow insights
    if (runwayMonths < 6 && grossBurnRate > 0) {
      insights.push({
        type: 'warning',
        message: `Cash runway of ${runwayMonths.toFixed(1)} months is below recommended 6 months. Consider reducing burn rate or securing additional funding.`,
      })
    }

    // Profitability insights
    const netIncome = pnlMetrics.netIncome || 0
    if (netIncome > 0) {
      insights.push({
        type: 'positive',
        message: `Company is profitable with positive net income of ${formatPnLCurrency(netIncome, currency)}.`,
      })
    }

    // Liquidity insights
    const currentRatio = bsMetrics.currentRatio || 0
    if (currentRatio < 1) {
      insights.push({
        type: 'warning',
        message: `Current ratio of ${currentRatio.toFixed(2)} is below 1.0, indicating potential short-term liquidity challenges.`,
      })
    } else if (currentRatio > 2) {
      insights.push({
        type: 'positive',
        message: `Strong liquidity position with current ratio of ${currentRatio.toFixed(2)}.`,
      })
    }

    // Operating cash flow insights
    const ocf = cfMetrics.operatingCashFlow || 0
    if (ocf > 0 && netIncome < 0) {
      insights.push({
        type: 'info',
        message:
          'Positive operating cash flow despite accounting losses demonstrates strong cash generation from core operations.',
      })
    }

    return insights.slice(0, 4) // Return max 4 insights
  }

  const insights = generateInsights()

  // Prepare contextData for learn modals with all calculated metrics
  const contextData = {
    runway_months: runwayMonths,
    cash_balance: cashBalance,
    burn_rate: grossBurnRate,
    ocf: cfMetrics.operatingCashFlow || 0,
    gross_margin_pct: pnlMetrics.grossMargin || 0,
    total_revenue: pnlMetrics.totalRevenue || 0,
    total_expenses: pnlMetrics.totalExpenses || 0,
    net_income: pnlMetrics.netIncome || 0,
    gross_profit: pnlMetrics.grossProfit || 0,
    operating_margin_pct: pnlMetrics.operatingMargin || 0,
    current_ratio: bsMetrics.currentRatio || 0,
    quick_ratio: bsMetrics.quickRatio || 0,
    working_capital: bsMetrics.workingCapital || 0,
    // Add more metrics that might be used
    debt_to_equity: bsMetrics.debtToEquity || 0,
    debt_ratio: bsMetrics.debtRatio || 0,
    equity_multiplier: bsMetrics.equityMultiplier || 0,
    return_on_equity: bsMetrics.returnOnEquity || 0,
    roe: bsMetrics.returnOnEquity || 0,
    asset_turnover: bsMetrics.assetTurnover || 0,
    dso: cfMetrics.dso || bsMetrics.dso || 0,
    dpo: cfMetrics.dpo || bsMetrics.dpo || 0,
    cash_conversion_cycle: cfMetrics.cashConversionCycle || 0,
    free_cash_flow: cfMetrics.freeCashFlow || 0,
    ocf_margin: cfMetrics.ocfMargin || 0,
    ocf_ratio: cfMetrics.ocfRatio || 0,
    cf_coverage: cfMetrics.cfCoverage || 0,
    expense_ratio: pnlMetrics.expenseRatio || 0,
    ebitda: pnlMetrics.ebitda || 0,
    net_profit_margin: pnlMetrics.netProfitMargin || 0,
  }

  // Store in sessionStorage for learn pages to access (without merging)
  useMetricStorage(contextData, dateRange, isLoading, false)

  // Format last updated time
  const formatLastUpdated = (date?: string) => {
    if (!date) return 'Just now'
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Helper function to retry all reports
  const handleRetryAll = () => {
    mutateCF()
    mutateBS()
    mutatePnL()
  }

  // Early return for critical errors - show error UI if auth failed or all reports failed
  if (hasCriticalError) {
    return (
      <ReportErrorState
        error={authError || cfError || bsError || pnlError}
        onRetry={handleRetryAll}
      />
    )
  }

  // PROGRESSIVE LOADING: Only block if we have NO data at all
  // Once we have any data, render the dashboard and show loading states for missing parts
  if (!hasAnyData && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
      </div>
    )
  }

  return (
    <>
      {/* Data Quality Alerts */}
      {(pnlData?.data?.metadata?.dataQuality?.hasPartialData ||
        cashFlowData?.data?.metadata?.dataQuality?.hasPartialData) && (
        <div className="space-y-2 mb-4">
          {pnlData?.data?.metadata?.dataQuality?.hasPartialData && (
            <DataQualityAlert metadata={pnlData.data.metadata} onRetry={() => mutatePnL()} />
          )}
          {cashFlowData?.data?.metadata?.dataQuality?.hasPartialData && (
            <DataQualityAlert metadata={cashFlowData.data.metadata} onRetry={() => mutateCF()} />
          )}
        </div>
      )}

      {/* Main Wireframe Layout */}
      <div className="@container flex flex-col gap-3">
        {/* Unified Grid: Navigation Cards + Financial Health + KPI List */}
        {/* At @5xl: 6 cols (P&L, BS, CF each 2 cols row 1; FH 3 cols, KPI 3 cols row 2) */}
        {/* At @2xl: 2 cols (P&L, BS row 1; CF, FH row 2; KPI spans 2 cols row 3) */}
        {/* At mobile: 1 col stack */}
        <div className="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-6 gap-3">
          {/* Navigation Cards - P&L, Balance Sheet, Cash Flow */}
          <SummaryNavigationCards
            pnlMetrics={pnlMetrics}
            bsMetrics={bsMetrics}
            cfMetrics={cfMetrics}
            pnlLoading={pnlLoading}
            bsLoading={bsLoading}
            cfLoading={cfLoading}
            pnlLastUpdated={formatLastUpdated(pnlData?.toDate)}
            balanceSheetLastUpdated={formatLastUpdated(balanceSheetData?.asOfDate)}
            cashFlowLastUpdated={formatLastUpdated(cashFlowData?.toDate)}
            periodMonths={periodMonths}
            currency={currency}
            pnlError={pnlError}
            bsError={bsError}
            cfError={cfError}
            onRetryPnL={mutatePnL}
            onRetryBS={mutateBS}
            onRetryCF={mutateCF}
            pnlTrendData={pnlMonthlyTrend}
            cfTrendData={cfMonthlyTrend}
            pnlTrendLoading={pnlTrendLoading}
            cfTrendLoading={cfTrendLoading}
            isSingleMonth={isSingleMonth}
          />

          {/* Financial Health Card - shares row with Cash Flow at @2xl, with KPI at @5xl */}
          <div className="h-full @5xl:col-span-3">
            <FinancialHealthCard
              healthScore={healthScore}
              selectedMetricIds={selectedMetricIds}
              customTargets={customTargets}
              getMetricValue={getMetricValue}
              getMetricIcon={getMetricIcon}
              getMetricColor={getMetricColor}
              getMetricTermId={getMetricTermId}
              formatMetricValue={formatMetricValue}
              formatTargetValue={formatTargetValue}
              getFinancialHealthMetricTooltip={(metricId: string) =>
                getFinancialHealthMetricTooltip(metricId, {
                  cfMetrics,
                  cfExtendedMetrics,
                  bsMetrics,
                  pnlMetrics,
                  cashBalance,
                  grossBurnRate,
                  periodMonths,
                  currency,
                })
              }
              contextData={contextData}
              isLoading={isLoading}
              isSaving={isSavingSettings}
              currentRevenueModel={organization?.revenue_model || 'SaaS'}
              onSaveSettings={handleSaveSettings}
            />
          </div>

          {/* Key Performance Metrics - shares row with Financial Health at @5xl, spans 2 cols at @2xl */}
          <div className="h-full @2xl:col-span-2 @5xl:col-span-3">
            <SummaryKPIList
              pnlMetrics={pnlMetrics}
              bsMetrics={bsMetrics}
              cashBalance={cashBalance}
              periodMonths={periodMonths}
              pnlLoading={pnlLoading}
              cfLoading={cfLoading}
              bsLoading={bsLoading}
              contextData={contextData}
              currency={currency}
            />
          </div>
        </div>

        {/* Row 3 - AI Analysis Card (full width) */}
        <AIAnalysisCard
          pageType="summary"
          data={{
            pnlMetrics,
            bsMetrics,
            cfMetrics,
            cfExtendedMetrics,
            cashBalance,
            grossBurnRate,
            periodMonths,
            revenueByCategory: pnlData?.data?.revenueByCategory || [],
            expenseCategories: pnlData?.data?.expenseCategories || [],
            operatingActivities: cashFlowData?.data?.operatingActivities || [],
            investingActivities: cashFlowData?.data?.investingActivities || [],
            financingActivities: cashFlowData?.data?.financingActivities || [],
            assetsHierarchy: balanceSheetData?.assetsHierarchy,
            liabilitiesHierarchy: balanceSheetData?.liabilitiesHierarchy,
            equityHierarchy: balanceSheetData?.equityHierarchy,
            unpaidBills: unpaidBillsData || {},
            outstandingPayments: paymentsData || {},
            pnlKpis: pnlData?.data?.kpis || {},
            cfKpis: cashFlowData?.data?.kpis || {},
            bsKpis: balanceSheetData || {},
            bsRatios: balanceSheetData || {},
          }}
          dateRange={dateRange}
          context={{
            ...contextData,
            healthScore,
            previousPeriodData: {
              revenue: pnlData?.data?.previousRevenue || pnlMetrics?.totalRevenue * 0.9 || 0,
              expenses: pnlData?.data?.previousExpenses || pnlMetrics?.totalExpenses * 0.95 || 0,
              cashBalance: cashFlowData?.data?.previousCashBalance || cashBalance * 1.1 || 0,
              burnRate: cashFlowData?.data?.previousBurnRate || grossBurnRate * 0.9 || 0,
              twoPeriodAgoRevenue:
                pnlData?.data?.twoPeriodAgoRevenue ||
                (pnlData?.data?.previousRevenue || pnlMetrics?.totalRevenue * 0.9) * 0.9 ||
                0,
            },
          }}
          autoGenerate={true}
          dataLoadingStates={{
            pnlLoading,
            cfLoading,
            bsLoading,
            billsLoading,
            paymentsLoading,
          }}
        />

        {/* Row 4 - AI Memory, Unpaid Bills, Outstanding Invoices (1/3 each) */}
        <div className="flex flex-col @3xl:flex-row gap-3">
          {/* AI Memory Widget - 1/3 */}
          <div className="flex-1">
            <MemorySummaryWidget initialSummary={undefined} />
          </div>

          {/* Unpaid Bills Card - 1/3 */}
          <div className="flex-1">
            <UnpaidBillsCard startDate={dateRange.start} endDate={dateRange.end} />
          </div>

          {/* Outstanding Payments Card (Invoices) - 1/3 */}
          <div className="flex-1">
            <OutstandingPaymentsCard startDate={dateRange.start} endDate={dateRange.end} />
          </div>
        </div>
      </div>
    </>
  )
}
