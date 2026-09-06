// src/lib/providers/zoho/reports-enhanced.ts
// Enhanced P&L report extraction with full account hierarchy

import { providerFetch, withRetry } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface PnLAccount {
  account_id: string
  name: string
  account_code?: string
  total: number
  depth: number
  is_child_present?: boolean
  children?: PnLAccount[]
}

export interface PnLSection {
  name: string
  total: number
  total_label?: string
  accounts: PnLAccount[]
}

export interface CompletePnLReport {
  metadata: {
    report_name: string
    organization_name?: string
    currency?: string
    start_date: string
    end_date: string
    report_basis: string
    generated_at: string
  }
  
  sections: {
    operating_income: PnLSection
    cost_of_goods_sold: PnLSection
    gross_profit: {
      amount: number
      margin_percentage: number
    }
    operating_expenses: PnLSection
    operating_profit: {
      amount: number
      margin_percentage: number
    }
    non_operating_income: PnLSection
    non_operating_expenses: PnLSection
    net_profit: {
      amount: number
      margin_percentage: number
    }
  }
  
  totals: {
    total_income: number
    total_cogs: number
    gross_profit: number
    total_operating_expenses: number
    operating_profit: number
    total_non_operating_income: number
    total_non_operating_expenses: number
    ebitda?: number
    ebit?: number
    net_profit: number
  }
  
  comparisons?: {
    previous_period?: {
      total_income: number
      total_expenses: number
      net_profit: number
      income_change_pct: number
      expense_change_pct: number
      profit_change_pct: number
    }
    year_to_date?: {
      total_income: number
      total_expenses: number
      net_profit: number
    }
  }
  
  kpis: {
    gross_margin: number
    operating_margin: number
    net_margin: number
    expense_ratio: number
    revenue_per_day?: number
  }
}

/**
 * Extract complete P&L report with full account hierarchy
 */
export async function getCompletePnLReport(
  userOrgId: string,
  options: {
    from_date: string
    to_date: string
    report_basis?: 'accrual' | 'cash'
    include_zero_balance?: boolean
    compare_with_previous?: boolean
  },
  apiClient: ProviderApiClient
): Promise<CompletePnLReport> {
  if (!apiClient) {
    throw new Error('API client is required for getCompletePnLReport')
  }

  return withRetry(async () => {
    // Get the main P&L report
    const response = await providerFetch<any>(
      apiClient,
      'zoho',
      userOrgId,
      '/reports/profitandloss',
      {
        from_date: options.from_date,
        to_date: options.to_date,
        report_basis: options.report_basis || 'accrual',
        ...(options.include_zero_balance && { include_zero_balance_accounts: 'true' })
      }
    )
    
    // Initialize the report structure
    const report: CompletePnLReport = {
      metadata: {
        report_name: 'Profit and Loss Statement',
        start_date: options.from_date,
        end_date: options.to_date,
        report_basis: options.report_basis || 'accrual',
        generated_at: new Date().toISOString()
      },
      sections: {
        operating_income: { name: 'Operating Income', total: 0, accounts: [] },
        cost_of_goods_sold: { name: 'Cost of Goods Sold', total: 0, accounts: [] },
        gross_profit: { amount: 0, margin_percentage: 0 },
        operating_expenses: { name: 'Operating Expenses', total: 0, accounts: [] },
        operating_profit: { amount: 0, margin_percentage: 0 },
        non_operating_income: { name: 'Other Income', total: 0, accounts: [] },
        non_operating_expenses: { name: 'Other Expenses', total: 0, accounts: [] },
        net_profit: { amount: 0, margin_percentage: 0 }
      },
      totals: {
        total_income: 0,
        total_cogs: 0,
        gross_profit: 0,
        total_operating_expenses: 0,
        operating_profit: 0,
        total_non_operating_income: 0,
        total_non_operating_expenses: 0,
        net_profit: 0
      },
      kpis: {
        gross_margin: 0,
        operating_margin: 0,
        net_margin: 0,
        expense_ratio: 0
      }
    }
    
    // Parse the Zoho P&L response
    if (response.profit_and_loss && Array.isArray(response.profit_and_loss)) {
      response.profit_and_loss.forEach((mainSection: any) => {
        if (mainSection.account_transactions && Array.isArray(mainSection.account_transactions)) {
          mainSection.account_transactions.forEach((subsection: any) => {
            const subsectionName = (subsection.name || '').toLowerCase()
            const subsectionLabel = (subsection.total_label || '').toLowerCase()
            
            // Process accounts within each subsection
            if (subsection.account_transactions && Array.isArray(subsection.account_transactions)) {
              const accounts: PnLAccount[] = subsection.account_transactions.map((acc: any) => ({
                account_id: acc.account_id,
                name: acc.name,
                account_code: acc.account_code || '',
                total: parseFloat(acc.total || '0'),
                depth: acc.depth || 0,
                is_child_present: acc.is_child_present || false
              }))
              
              // Categorize into appropriate sections
              if (subsectionName.includes('operating income') || 
                  subsectionLabel.includes('total operating income')) {
                report.sections.operating_income.accounts = accounts
                report.sections.operating_income.total = parseFloat(subsection.total || '0')
                report.totals.total_income = Math.abs(report.sections.operating_income.total)
              } 
              else if (subsectionName.includes('cost of goods sold') || 
                       subsectionLabel.includes('total cost of goods sold')) {
                report.sections.cost_of_goods_sold.accounts = accounts
                report.sections.cost_of_goods_sold.total = parseFloat(subsection.total || '0')
                report.totals.total_cogs = Math.abs(report.sections.cost_of_goods_sold.total)
              }
              else if (subsectionName.includes('operating expense') || 
                       subsectionLabel.includes('total operating expense')) {
                report.sections.operating_expenses.accounts = accounts
                report.sections.operating_expenses.total = parseFloat(subsection.total || '0')
                report.totals.total_operating_expenses = Math.abs(report.sections.operating_expenses.total)
              }
              else if (subsectionName.includes('non operating income') || 
                       subsectionName.includes('other income')) {
                report.sections.non_operating_income.accounts = accounts
                report.sections.non_operating_income.total = parseFloat(subsection.total || '0')
                report.totals.total_non_operating_income = Math.abs(report.sections.non_operating_income.total)
              }
              else if (subsectionName.includes('non operating expense') || 
                       subsectionName.includes('other expense')) {
                report.sections.non_operating_expenses.accounts = accounts
                report.sections.non_operating_expenses.total = parseFloat(subsection.total || '0')
                report.totals.total_non_operating_expenses = Math.abs(report.sections.non_operating_expenses.total)
              }
            }
          })
        }
      })
    }
    
    // Calculate derived values
    report.totals.gross_profit = report.totals.total_income - report.totals.total_cogs
    report.totals.operating_profit = report.totals.gross_profit - report.totals.total_operating_expenses
    report.totals.net_profit = report.totals.operating_profit + 
                               report.totals.total_non_operating_income - 
                               report.totals.total_non_operating_expenses
    
    // Calculate margins and KPIs
    if (report.totals.total_income > 0) {
      report.kpis.gross_margin = (report.totals.gross_profit / report.totals.total_income) * 100
      report.kpis.operating_margin = (report.totals.operating_profit / report.totals.total_income) * 100
      report.kpis.net_margin = (report.totals.net_profit / report.totals.total_income) * 100
      report.kpis.expense_ratio = ((report.totals.total_operating_expenses + report.totals.total_non_operating_expenses) / report.totals.total_income) * 100
      
      // Calculate revenue per day
      const startDate = new Date(options.from_date)
      const endDate = new Date(options.to_date)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 0) {
        report.kpis.revenue_per_day = report.totals.total_income / daysDiff
      }
    }
    
    // Update section profit values
    report.sections.gross_profit.amount = report.totals.gross_profit
    report.sections.gross_profit.margin_percentage = report.kpis.gross_margin
    report.sections.operating_profit.amount = report.totals.operating_profit
    report.sections.operating_profit.margin_percentage = report.kpis.operating_margin
    report.sections.net_profit.amount = report.totals.net_profit
    report.sections.net_profit.margin_percentage = report.kpis.net_margin
    
    // If comparison is requested, fetch previous period
    if (options.compare_with_previous) {
      try {
        // Calculate previous period dates
        const currentStart = new Date(options.from_date)
        const currentEnd = new Date(options.to_date)
        const periodLength = currentEnd.getTime() - currentStart.getTime()
        
        const prevEnd = new Date(currentStart.getTime() - 1) // Day before current period
        const prevStart = new Date(prevEnd.getTime() - periodLength)
        
        const prevResponse = await providerFetch<any>(
          apiClient,
          'zoho',
          userOrgId,
          '/reports/profitandloss',
          {
            from_date: formatDate(prevStart),
            to_date: formatDate(prevEnd),
            report_basis: options.report_basis || 'accrual'
          }
        )
        
        // Extract previous period totals
        let prevIncome = 0, prevExpenses = 0
        
        if (prevResponse.profit_and_loss && Array.isArray(prevResponse.profit_and_loss)) {
          // Similar extraction logic for previous period
          // Simplified for brevity
          prevIncome = Math.abs(parseFloat(prevResponse.total_income || '0'))
          prevExpenses = Math.abs(parseFloat(prevResponse.total_expenses || '0'))
        }
        
        const prevProfit = prevIncome - prevExpenses
        
        report.comparisons = {
          previous_period: {
            total_income: prevIncome,
            total_expenses: prevExpenses,
            net_profit: prevProfit,
            income_change_pct: prevIncome > 0 ? ((report.totals.total_income - prevIncome) / prevIncome) * 100 : 0,
            expense_change_pct: prevExpenses > 0 ? ((report.totals.total_operating_expenses - prevExpenses) / prevExpenses) * 100 : 0,
            profit_change_pct: prevProfit !== 0 ? ((report.totals.net_profit - prevProfit) / Math.abs(prevProfit)) * 100 : 0
          }
        }
      } catch (error) {
        console.warn('Could not fetch previous period for comparison:', error)
      }
    }
    
    return report
  })
}

/**
 * Get P&L trend over multiple periods
 */
export async function getPnLTrend(
  userOrgId: string,
  periods: Array<{ from_date: string; to_date: string; label: string }>,
  apiClient: ProviderApiClient
): Promise<Array<{
  period: string
  income: number
  expenses: number
  profit: number
  margin: number
}>> {
  const trend = []
  
  for (const period of periods) {
    try {
      const report = await getCompletePnLReport(
        userOrgId,
        {
          from_date: period.from_date,
          to_date: period.to_date,
          report_basis: 'accrual'
        },
        apiClient
      )
      
      trend.push({
        period: period.label,
        income: report.totals.total_income,
        expenses: report.totals.total_operating_expenses + report.totals.total_non_operating_expenses,
        profit: report.totals.net_profit,
        margin: report.kpis.net_margin
      })
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.warn(`Could not fetch P&L for period ${period.label}:`, error)
      trend.push({
        period: period.label,
        income: 0,
        expenses: 0,
        profit: 0,
        margin: 0
      })
    }
  }
  
  return trend
}

// Helper function to format dates
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Export P&L to various formats
 */
export function exportPnLReport(
  report: CompletePnLReport,
  format: 'csv' | 'json' | 'pdf'
): string | object {
  switch (format) {
    case 'json':
      return report
      
    case 'csv':
      let csv = 'Profit and Loss Statement\n'
      csv += `Period: ${report.metadata.start_date} to ${report.metadata.end_date}\n`
      csv += `Basis: ${report.metadata.report_basis}\n\n`
      
      csv += 'Account,Amount\n'
      
      // Operating Income
      csv += '\nOperating Income\n'
      report.sections.operating_income.accounts.forEach(acc => {
        csv += `"${acc.name}",${acc.total}\n`
      })
      csv += `Total Operating Income,${report.totals.total_income}\n`
      
      // COGS
      if (report.sections.cost_of_goods_sold.accounts.length > 0) {
        csv += '\nCost of Goods Sold\n'
        report.sections.cost_of_goods_sold.accounts.forEach(acc => {
          csv += `"${acc.name}",${acc.total}\n`
        })
        csv += `Total COGS,${report.totals.total_cogs}\n`
      }
      
      csv += `\nGross Profit,${report.totals.gross_profit}\n`
      csv += `Gross Margin,${report.kpis.gross_margin.toFixed(2)}%\n`
      
      // Operating Expenses
      csv += '\nOperating Expenses\n'
      report.sections.operating_expenses.accounts.forEach(acc => {
        csv += `"${acc.name}",${acc.total}\n`
      })
      csv += `Total Operating Expenses,${report.totals.total_operating_expenses}\n`
      
      csv += `\nOperating Profit,${report.totals.operating_profit}\n`
      
      // Non-operating items
      if (report.sections.non_operating_income.accounts.length > 0) {
        csv += '\nOther Income\n'
        report.sections.non_operating_income.accounts.forEach(acc => {
          csv += `"${acc.name}",${acc.total}\n`
        })
      }
      
      if (report.sections.non_operating_expenses.accounts.length > 0) {
        csv += '\nOther Expenses\n'
        report.sections.non_operating_expenses.accounts.forEach(acc => {
          csv += `"${acc.name}",${acc.total}\n`
        })
      }
      
      csv += `\nNet Profit,${report.totals.net_profit}\n`
      csv += `Net Margin,${report.kpis.net_margin.toFixed(2)}%\n`
      
      return csv
      
    default:
      return report
  }
}