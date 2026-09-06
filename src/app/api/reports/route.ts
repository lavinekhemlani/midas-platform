// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Types for enhanced report structures
interface ReportLineItem {
  id: string
  name: string
  value: number
  parent_id?: string
  level: number
  is_subtotal?: boolean
  is_total?: boolean
  children?: ReportLineItem[]
}

interface EnhancedFinancialReport {
  report_name: string
  report_type: 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'aged_receivables' | 'aged_payables'
  organization_name: string
  currency: string
  period: {
    start_date?: string
    end_date?: string
    as_of_date?: string
  }
  basis?: 'accrual' | 'cash'
  sections: ReportSection[]
  totals: {
    [key: string]: number
  }
  export_options?: {
    pdf_url?: string
    excel_url?: string
  }
}

interface ReportSection {
  section_id: string
  section_name: string
  section_type: string
  line_items: ReportLineItem[]
  section_total?: number
  subsections?: ReportSection[]
}

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const reportType = searchParams.get('type') || 'summary'
      const period = searchParams.get('period') || 'this_month'
      const format = searchParams.get('format') || 'json' // json, pdf, excel
      const includeDetails = searchParams.get('details') === 'true'

      console.log(`Using optimized ${providerId} provider for reports`)

      // Get company metadata - prefer stored values to avoid API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      let currency: string = storedMetadata.homeCurrency || ''
      let organizationName: string = storedMetadata.companyName || ''

      if (!currency || !organizationName) {
        // Fallback: fetch from provider API (also stores for future use)
        const orgInfo = await (provider.organizations.getOrganizationInfo as any)(
          organizationId,
          apiClient
        )
        if (!currency) currency = orgInfo.currency_code || 'USD'
        if (!organizationName) organizationName = orgInfo.name || 'Organization'

        // Store metadata for future requests
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: currency,
          companyName: organizationName !== 'Organization' ? organizationName : undefined,
        }).catch((err) => console.warn('[Reports] Failed to store metadata:', err))
      }

      // Calculate date ranges
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()
      const currentDay = now.getDate()

      // Helper function to create a date in YYYY-MM-DD format without timezone issues
      const createDate = (year: number, month: number, day: number): string => {
        const m = String(month + 1).padStart(2, '0')
        const d = String(day).padStart(2, '0')
        return `${year}-${m}-${d}`
      }

      let fromDate: string
      let toDate: string = createDate(currentYear, currentMonth, currentDay) // Today's date

      switch (period) {
        case 'this_month':
          fromDate = createDate(currentYear, currentMonth, 1)
          toDate = createDate(currentYear, currentMonth, currentDay) // Today
          break
        case 'last_month':
          // Use Date constructor for automatic year wraparound handling
          // When currentMonth = 0 (January), this correctly produces December of previous year
          const lastMonthEnd = new Date(currentYear, currentMonth, 0) // Last day of prev month
          const lastMonthStart = new Date(currentYear, currentMonth - 1, 1) // First day of prev month (handles year wrap)
          fromDate = createDate(
            lastMonthStart.getFullYear(),
            lastMonthStart.getMonth(),
            lastMonthStart.getDate()
          )
          toDate = createDate(
            lastMonthEnd.getFullYear(),
            lastMonthEnd.getMonth(),
            lastMonthEnd.getDate()
          )
          break
        case 'this_quarter':
          const currentQuarter = Math.floor(currentMonth / 3)
          fromDate = createDate(currentYear, currentQuarter * 3, 1)
          toDate = createDate(currentYear, currentMonth, currentDay) // Today
          break
        case 'this_year':
          fromDate = createDate(currentYear, 0, 1)
          toDate = createDate(currentYear, currentMonth, currentDay) // Today
          break
        default:
          fromDate = createDate(currentYear, currentMonth, 1)
          toDate = createDate(currentYear, currentMonth, currentDay) // Today
      }

      // Fetch and format reports based on type
      let enhancedReportData: EnhancedFinancialReport | any = {}

      switch (reportType) {
        case 'profit_loss':
          const pnlData = await (provider.reports.profitAndLoss as any)(
            organizationId,
            {
              from_date: fromDate,
              to_date: toDate,
              report_basis: 'accrual',
            },
            apiClient
          )
          enhancedReportData = formatProfitLossReport(pnlData, {
            organizationName,
            currency,
            startDate: fromDate,
            endDate: toDate,
            includeDetails,
          })
          break

        case 'balance_sheet':
          const bsData = await (provider.reports.balanceSheet as any)(
            organizationId,
            {
              as_of_date: toDate,
            },
            apiClient
          )
          enhancedReportData = formatBalanceSheetReport(bsData, {
            organizationName,
            currency,
            asOfDate: toDate,
            includeDetails,
          })
          break

        case 'cash_flow':
          const cfData = await (provider.reports.cashFlow as any)(
            organizationId,
            {
              from_date: fromDate,
              to_date: toDate,
            },
            apiClient
          )
          enhancedReportData = formatCashFlowReport(cfData, {
            organizationName,
            currency,
            startDate: fromDate,
            endDate: toDate,
            includeDetails,
          })
          break

        case 'aged_receivables':
          const arData = await (provider.reports.agedReceivables as any)(
            organizationId,
            {
              as_of_date: toDate,
            },
            apiClient
          )
          enhancedReportData = formatAgedReceivablesReport(arData, {
            organizationName,
            currency,
            asOfDate: toDate,
            includeDetails,
          })
          break

        case 'aged_payables':
          const apData = await (provider.reports.agedPayables as any)(
            organizationId,
            {
              as_of_date: toDate,
            },
            apiClient
          )
          enhancedReportData = formatAgedPayablesReport(apData, {
            organizationName,
            currency,
            asOfDate: toDate,
            includeDetails,
          })
          break

        case 'summary':
        default:
          // Fetch multiple reports for comprehensive summary
          const [pnl, cashFlow, balanceSheet, receivables, payables] = await Promise.all([
            (provider.reports.profitAndLoss as any)(
              organizationId,
              {
                from_date: fromDate,
                to_date: toDate,
                report_basis: 'accrual',
              },
              apiClient
            ).catch(() => null),
            (provider.reports.cashFlow as any)(
              organizationId,
              {
                from_date: fromDate,
                to_date: toDate,
              },
              apiClient
            ).catch(() => null),
            (provider.reports.balanceSheet as any)(
              organizationId,
              {
                as_of_date: toDate,
              },
              apiClient
            ).catch(() => null),
            (provider.reports.agedReceivables as any)(
              organizationId,
              {
                as_of_date: toDate,
              },
              apiClient
            ).catch(() => null),
            (provider.reports.agedPayables as any)(
              organizationId,
              {
                as_of_date: toDate,
              },
              apiClient
            ).catch(() => null),
          ])

          enhancedReportData = {
            summary: true,
            organizationName,
            currency,
            period: {
              start_date: fromDate,
              end_date: toDate,
            },
            reports: {
              profit_loss: pnl
                ? formatProfitLossReport(pnl, {
                    organizationName,
                    currency,
                    startDate: fromDate,
                    endDate: toDate,
                    includeDetails: false,
                  })
                : null,
              balance_sheet: balanceSheet
                ? formatBalanceSheetReport(balanceSheet, {
                    organizationName,
                    currency,
                    asOfDate: toDate,
                    includeDetails: false,
                  })
                : null,
              cash_flow: cashFlow
                ? formatCashFlowReport(cashFlow, {
                    organizationName,
                    currency,
                    startDate: fromDate,
                    endDate: toDate,
                    includeDetails: false,
                  })
                : null,
              aged_receivables: receivables,
              aged_payables: payables,
            },
            key_metrics: calculateKeyMetrics(pnl, balanceSheet, cashFlow),
          }
          break
      }

      // Add export URLs if requested
      if (format === 'pdf' || format === 'excel') {
        enhancedReportData.export_options = {
          pdf_url: `/api/reports/export?type=${reportType}&period=${period}&format=pdf&org=${organizationId}`,
          excel_url: `/api/reports/export?type=${reportType}&period=${period}&format=excel&org=${organizationId}`,
        }
      }

      const response = {
        reportType,
        period,
        fromDate: fromDate,
        toDate: toDate,
        currency,
        organizationName,
        provider: providerId,
        enhanced: true,
        data: enhancedReportData,
        metadata: {
          generated_at: new Date().toISOString(),
          cache_status: 'fresh',
          format,
          include_details: includeDetails,
        },
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Enhanced Reports API error:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch enhanced report data',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }
  }
)

// Enhanced report formatting functions

function formatProfitLossReport(
  rawData: any,
  options: {
    organizationName: string
    currency: string
    startDate: string
    endDate: string
    includeDetails: boolean
  }
): EnhancedFinancialReport {
  const sections: ReportSection[] = []

  // Revenue/Income Section
  const revenueSection: ReportSection = {
    section_id: 'revenue',
    section_name: 'Revenue',
    section_type: 'income',
    line_items: [
      {
        id: 'total_revenue',
        name: 'Total Revenue',
        value: rawData.total_income || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.total_income || 0,
  }

  // Cost of Goods Sold Section
  const cogsSection: ReportSection = {
    section_id: 'cogs',
    section_name: 'Cost of Goods Sold',
    section_type: 'cogs',
    line_items: [
      {
        id: 'total_cogs',
        name: 'Total Cost of Goods Sold',
        value: rawData.cost_of_goods_sold || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.cost_of_goods_sold || 0,
  }

  // Gross Profit Section
  const grossProfitSection: ReportSection = {
    section_id: 'gross_profit',
    section_name: 'Gross Profit',
    section_type: 'gross_profit',
    line_items: [
      {
        id: 'gross_profit',
        name: 'Gross Profit',
        // Calculate gross_profit: revenue - COGS
        value:
          rawData.gross_profit ?? (rawData.total_income ?? 0) - (rawData.cost_of_goods_sold ?? 0),
        level: 0,
        is_subtotal: true,
      },
    ],
    section_total:
      rawData.gross_profit ?? (rawData.total_income ?? 0) - (rawData.cost_of_goods_sold ?? 0),
  }

  // Expenses Section
  const expensesSection: ReportSection = {
    section_id: 'expenses',
    section_name: 'Operating Expenses',
    section_type: 'expenses',
    line_items: [
      {
        id: 'total_expenses',
        name: 'Total Operating Expenses',
        value: rawData.total_expenses || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.total_expenses || 0,
  }

  // Net Income Section
  // Calculate net_income: revenue - COGS - expenses
  const calculatedNetIncome =
    rawData.net_income ??
    (rawData.total_income ?? 0) - (rawData.cost_of_goods_sold ?? 0) - (rawData.total_expenses ?? 0)

  const netIncomeSection: ReportSection = {
    section_id: 'net_income',
    section_name: 'Net Income',
    section_type: 'net_income',
    line_items: [
      {
        id: 'net_income',
        name: 'Net Income',
        value: calculatedNetIncome,
        level: 0,
        is_total: true,
      },
    ],
    section_total: calculatedNetIncome,
  }

  sections.push(revenueSection, cogsSection, grossProfitSection, expensesSection, netIncomeSection)

  return {
    report_name: 'Profit and Loss Statement',
    report_type: 'profit_loss',
    organization_name: options.organizationName,
    currency: options.currency,
    period: {
      start_date: options.startDate,
      end_date: options.endDate,
    },
    basis: 'accrual',
    sections,
    totals: {
      total_revenue: rawData.total_income ?? 0,
      total_expenses: rawData.total_expenses ?? 0,
      // Calculate gross_profit: revenue - COGS
      gross_profit:
        rawData.gross_profit ?? (rawData.total_income ?? 0) - (rawData.cost_of_goods_sold ?? 0),
      net_income: calculatedNetIncome,
    },
  }
}

function formatBalanceSheetReport(
  rawData: any,
  options: {
    organizationName: string
    currency: string
    asOfDate: string
    includeDetails: boolean
  }
): EnhancedFinancialReport {
  const sections: ReportSection[] = []

  // Assets Section
  const assetsSection: ReportSection = {
    section_id: 'assets',
    section_name: 'Assets',
    section_type: 'assets',
    line_items: [
      {
        id: 'total_assets',
        name: 'Total Assets',
        value: rawData.total_assets || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.total_assets || 0,
  }

  // Liabilities Section
  const liabilitiesSection: ReportSection = {
    section_id: 'liabilities',
    section_name: 'Liabilities',
    section_type: 'liabilities',
    line_items: [
      {
        id: 'total_liabilities',
        name: 'Total Liabilities',
        value: rawData.total_liabilities || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.total_liabilities || 0,
  }

  // Equity Section
  const equitySection: ReportSection = {
    section_id: 'equity',
    section_name: "Owner's Equity",
    section_type: 'equity',
    line_items: [
      {
        id: 'total_equity',
        name: "Total Owner's Equity",
        value: rawData.total_equity || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.total_equity || 0,
  }

  sections.push(assetsSection, liabilitiesSection, equitySection)

  return {
    report_name: 'Balance Sheet',
    report_type: 'balance_sheet',
    organization_name: options.organizationName,
    currency: options.currency,
    period: {
      as_of_date: options.asOfDate,
    },
    basis: 'accrual',
    sections,
    totals: {
      total_assets: rawData.total_assets || 0,
      total_liabilities: rawData.total_liabilities || 0,
      total_equity: rawData.total_equity || 0,
    },
  }
}

function formatCashFlowReport(
  rawData: any,
  options: {
    organizationName: string
    currency: string
    startDate: string
    endDate: string
    includeDetails: boolean
  }
): EnhancedFinancialReport {
  const sections: ReportSection[] = []

  // Operating Activities Section
  const operatingSection: ReportSection = {
    section_id: 'operating',
    section_name: 'Cash Flow from Operating Activities',
    section_type: 'operating',
    line_items: [
      {
        id: 'net_cash_operating',
        name: 'Net Cash from Operating Activities',
        value: rawData.net_cash_from_operating_activities || 0,
        level: 0,
        is_subtotal: true,
      },
    ],
    section_total: rawData.net_cash_from_operating_activities || 0,
  }

  // Investing Activities Section
  const investingSection: ReportSection = {
    section_id: 'investing',
    section_name: 'Cash Flow from Investing Activities',
    section_type: 'investing',
    line_items: [
      {
        id: 'net_cash_investing',
        name: 'Net Cash from Investing Activities',
        value: rawData.net_cash_from_investing_activities || 0,
        level: 0,
        is_subtotal: true,
      },
    ],
    section_total: rawData.net_cash_from_investing_activities || 0,
  }

  // Financing Activities Section
  const financingSection: ReportSection = {
    section_id: 'financing',
    section_name: 'Cash Flow from Financing Activities',
    section_type: 'financing',
    line_items: [
      {
        id: 'net_cash_financing',
        name: 'Net Cash from Financing Activities',
        value: rawData.net_cash_from_financing_activities || 0,
        level: 0,
        is_subtotal: true,
      },
    ],
    section_total: rawData.net_cash_from_financing_activities || 0,
  }

  // Net Change Section
  const netChangeSection: ReportSection = {
    section_id: 'net_change',
    section_name: 'Net Change in Cash',
    section_type: 'net_change',
    line_items: [
      {
        id: 'net_change_cash',
        name: 'Net Change in Cash',
        value: rawData.net_change_in_cash || 0,
        level: 0,
        is_total: true,
      },
      {
        id: 'cash_beginning',
        name: 'Cash at Beginning of Period',
        value: rawData.cash_at_beginning || 0,
        level: 0,
      },
      {
        id: 'cash_ending',
        name: 'Cash at End of Period',
        value: rawData.cash_at_end || 0,
        level: 0,
        is_total: true,
      },
    ],
    section_total: rawData.cash_at_end || 0,
  }

  sections.push(operatingSection, investingSection, financingSection, netChangeSection)

  return {
    report_name: 'Statement of Cash Flows',
    report_type: 'cash_flow',
    organization_name: options.organizationName,
    currency: options.currency,
    period: {
      start_date: options.startDate,
      end_date: options.endDate,
    },
    sections,
    totals: {
      operating_cash_flow: rawData.net_cash_from_operating_activities || 0,
      investing_cash_flow: rawData.net_cash_from_investing_activities || 0,
      financing_cash_flow: rawData.net_cash_from_financing_activities || 0,
      net_change: rawData.net_change_in_cash || 0,
      ending_cash: rawData.cash_at_end || 0,
    },
  }
}

function formatAgedReceivablesReport(
  rawData: any,
  options: {
    organizationName: string
    currency: string
    asOfDate: string
    includeDetails: boolean
  }
) {
  // Simple format for aged receivables
  return {
    report_name: 'Aged Receivables',
    report_type: 'aged_receivables',
    organization_name: options.organizationName,
    currency: options.currency,
    period: { as_of_date: options.asOfDate },
    data: rawData || { receivables: [], total: 0 },
  }
}

function formatAgedPayablesReport(
  rawData: any,
  options: {
    organizationName: string
    currency: string
    asOfDate: string
    includeDetails: boolean
  }
) {
  // Simple format for aged payables
  return {
    report_name: 'Aged Payables',
    report_type: 'aged_payables',
    organization_name: options.organizationName,
    currency: options.currency,
    period: { as_of_date: options.asOfDate },
    data: rawData || { payables: [], total: 0 },
  }
}

function calculateKeyMetrics(pnl: any, balanceSheet: any, cashFlow: any) {
  if (!pnl) return {}

  const revenue = pnl.total_income || 0
  const expenses = pnl.total_expenses || 0
  const grossProfit = pnl.gross_profit || 0
  const netIncome = pnl.net_income || 0

  return {
    gross_margin_percent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    net_margin_percent: revenue > 0 ? (netIncome / revenue) * 100 : 0,
    operating_cash_flow: cashFlow?.net_cash_from_operating_activities || 0,
    current_ratio:
      balanceSheet && balanceSheet.total_liabilities > 0
        ? balanceSheet.total_assets / balanceSheet.total_liabilities
        : 0,
    working_capital: balanceSheet
      ? (balanceSheet.total_assets || 0) - (balanceSheet.total_liabilities || 0)
      : 0,
  }
}
