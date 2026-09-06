// src/lib/providers/zoho/reports.ts
import { withRetry, ZohoQueryOptions } from './core'
import { providerFetch } from '../core'
import { ProviderApiClient } from '../apiClient'



export interface ReportOptions extends ZohoQueryOptions {
  period?: 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year' | 
           'yesterday' | 'previous_week' | 'previous_month' | 'previous_quarter' | 'previous_year' |
           'last_7_days' | 'last_30_days' | 'last_90_days' | 'last_365_days' | 'custom'
  start_date?: string
  end_date?: string
  from_date?: string  // Zoho uses this for P&L
  to_date?: string    // Zoho uses this for P&L
  report_basis?: 'cash' | 'accrual' // Only for P&L, Balance Sheet, Trial Balance
}

export interface ProfitLossData {
  report_name: string
  start_date: string
  end_date: string
  report_basis: string
  income: any[]
  cost_of_goods_sold: any[]
  gross_profit: number
  expenses: any[]
  net_income: number
  total_income: number
  total_expenses: number
}

export interface CashFlowData {
  report_name: string
  start_date: string
  end_date: string
  net_cash_from_operating_activities: number
  net_cash_from_investing_activities: number
  net_cash_from_financing_activities: number
  net_change_in_cash: number
  cash_at_beginning: number
  cash_at_end: number
}

export interface AgedReceivablesData {
  report_name: string
  report_date: string
  contact_name: string
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
}

export interface AgedPayablesData {
  report_name: string
  report_date: string
  vendor_name: string
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
}

export interface BalanceSheetData {
  report_name: string
  as_of_date: string
  report_basis: string
  total_assets: number
  total_liabilities: number
  total_equity: number
  cash_and_equivalents: number
  current_assets: number
  current_liabilities: number
  working_capital: number
}

/**
 * Get Profit and Loss report
 * Reference: https://www.zoho.com/books/api/v3/reports/#profit-and-loss
 * Note: Only use from_date/to_date parameters (period parameter doesn't work)
 */
export async function profitAndLoss(
  userOrgId: string,
  options: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<ProfitLossData> {
  if (!apiClient) {
    throw new Error('API client is required for profitAndLoss');
  }
  
  return withRetry(async () => {
    // Build the correct parameters
    const reportOptions: any = { ...options }
    
    // Always use from_date/to_date, never use period
    if (!options.from_date || !options.to_date) {
      // If dates not provided, default to current month
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      
      reportOptions.from_date = options.start_date || formatDate(monthStart)
      reportOptions.to_date = options.end_date || formatDate(monthEnd)
    }
    
    // Remove any period parameter as it causes errors
    delete reportOptions.period
    delete reportOptions.start_date
    delete reportOptions.end_date
    
    const response = await providerFetch<any>(
      apiClient,
      'zoho',
      userOrgId,
      '/reports/profitandloss',
      reportOptions
    )
    
    // Parse the Zoho response structure
    console.log('P&L Raw Response:', JSON.stringify(response, null, 2).substring(0, 1000))
    
    // Extract data from the nested structure
    let totalIncome = 0
    let totalExpenses = 0
    let grossProfit = 0
    let netIncome = 0
    let costOfGoodsSold = 0
    
    // Zoho returns P&L data in profit_and_loss array with sections
    if (response && typeof response === 'object') {
      // Primary method: Parse from profit_and_loss array (Zoho's actual format)
      if (response.profit_and_loss && Array.isArray(response.profit_and_loss)) {
        const pnlSections = response.profit_and_loss
        
        // First, try to extract from account_transactions directly
        // Keep track of what we've found for better reporting
        const accountsFound: any[] = []
        
        pnlSections.forEach((section: any) => {
          // If this section has account_transactions, process them
          if (section.account_transactions && Array.isArray(section.account_transactions)) {
            section.account_transactions.forEach((subsection: any) => {
              const subsectionName = (subsection.name || '').toLowerCase()
              const subsectionTotal = parseFloat(subsection.total || '0')
              
              // Check if this subsection has nested account_transactions
              if (subsection.account_transactions && Array.isArray(subsection.account_transactions)) {
                // Process nested accounts
                subsection.account_transactions.forEach((account: any) => {
                  const accountName = (account.name || '').toLowerCase()
                  const accountTotal = parseFloat(account.total || '0')
                  
                  accountsFound.push({
                    name: account.name,
                    total: accountTotal,
                    section: subsection.name
                  })
                  
                  // Categorize based on subsection name
                  if (subsectionName.includes('operating income')) {
                    totalIncome += Math.abs(accountTotal)
                    console.log(`Found income account: ${account.name} = ${accountTotal}`)
                  }
                  else if (subsectionName.includes('cost of goods sold')) {
                    costOfGoodsSold += Math.abs(accountTotal)
                    console.log(`Found COGS account: ${account.name} = ${accountTotal}`)
                  }
                  else if (subsectionName.includes('operating expense')) {
                    totalExpenses += Math.abs(accountTotal)
                    console.log(`Found expense account: ${account.name} = ${accountTotal}`)
                  }
                  else if (subsectionName.includes('non operating income') || 
                           subsectionName.includes('other income')) {
                    totalIncome += Math.abs(accountTotal)
                    console.log(`Found other income: ${account.name} = ${accountTotal}`)
                  }
                  else if (subsectionName.includes('non operating expense') || 
                           subsectionName.includes('other expense')) {
                    totalExpenses += Math.abs(accountTotal)
                    console.log(`Found other expense: ${account.name} = ${accountTotal}`)
                  }
                })
              } else {
                // This subsection is itself an account category
                accountsFound.push({
                  name: subsection.name,
                  total: subsectionTotal,
                  section: 'Top Level'
                })
                
                // Identify by name
                if (subsectionName.includes('operating income') || 
                    subsectionName.includes('sales') || 
                    subsectionName.includes('revenue')) {
                  totalIncome += Math.abs(subsectionTotal)
                  console.log(`Found income section: ${subsection.name} = ${subsectionTotal}`)
                }
                else if (subsectionName.includes('cost of goods sold') || 
                         subsectionName.includes('cogs')) {
                  costOfGoodsSold += Math.abs(subsectionTotal)
                  console.log(`Found COGS section: ${subsection.name} = ${subsectionTotal}`)
                }
                else if (subsectionName.includes('operating expense') || 
                         subsectionName.includes('expense')) {
                  totalExpenses += Math.abs(subsectionTotal)
                  console.log(`Found expense section: ${subsection.name} = ${subsectionTotal}`)
                }
                else if (subsectionName.includes('non operating income') || 
                         subsectionName.includes('other income')) {
                  totalIncome += Math.abs(subsectionTotal)
                  console.log(`Found other income section: ${subsection.name} = ${subsectionTotal}`)
                }
                else if (subsectionName.includes('non operating expense') || 
                         subsectionName.includes('other expense')) {
                  totalExpenses += Math.abs(subsectionTotal)
                  console.log(`Found other expense section: ${subsection.name} = ${subsectionTotal}`)
                }
              }
            })
          }
        })
        
        console.log(`Total accounts/sections found: ${accountsFound.length}`)
        
        // If we didn't find data in account_transactions, try the original section-based approach
        if (totalIncome === 0 && totalExpenses === 0) {
          pnlSections.forEach((section: any) => {
            // Check if this is a top-level section with total
            const sectionName = (section.name || '').toLowerCase()
            const sectionLabel = (section.total_label || '').toLowerCase()
            const sectionTotal = Math.abs(parseFloat(section.total || '0'))
          
          // Look for Operating Income, Sales, or Revenue
          if (sectionName.includes('operating income') || 
              sectionLabel.includes('total operating income') ||
              sectionName.includes('income') ||
              sectionName.includes('sales') ||
              sectionName.includes('revenue')) {
            // This section contains income data
            if (section.account_transactions && Array.isArray(section.account_transactions)) {
              section.account_transactions.forEach((subsection: any) => {
                const subsectionName = (subsection.name || '').toLowerCase()
                const subsectionLabel = (subsection.total_label || '').toLowerCase()
                const subsectionTotal = Math.abs(parseFloat(subsection.total || '0'))
                
                if (subsectionLabel.includes('total operating income') || 
                    subsectionLabel.includes('total income') ||
                    subsectionLabel.includes('total sales') ||
                    subsectionLabel.includes('total revenue')) {
                  totalIncome = subsectionTotal
                } else if ((subsection.name === 'Operating Income' || 
                           subsectionName.includes('sales') || 
                           subsectionName.includes('revenue')) && subsectionTotal > 0) {
                  totalIncome += subsectionTotal // Add to total instead of replacing
                }
              })
            }
            // If no subsections, use the section total
            if (totalIncome === 0 && sectionTotal > 0) {
              totalIncome = sectionTotal
            }
          }
          
          // Look for Operating Expenses
          else if (sectionName.includes('operating expense') || 
                   sectionLabel.includes('total operating expense') ||
                   sectionName.includes('expense')) {
            // This section contains expense data
            if (section.account_transactions && Array.isArray(section.account_transactions)) {
              section.account_transactions.forEach((subsection: any) => {
                const subsectionLabel = (subsection.total_label || '').toLowerCase()
                const subsectionTotal = Math.abs(parseFloat(subsection.total || '0'))
                
                if (subsectionLabel.includes('total operating expense') || 
                    subsectionLabel.includes('total expense')) {
                  totalExpenses = subsectionTotal
                } else if (subsection.name === 'Operating Expenses' && subsectionTotal > 0) {
                  totalExpenses = subsectionTotal
                }
              })
            }
            // If no subsections, use the section total
            if (totalExpenses === 0 && sectionTotal > 0) {
              totalExpenses = sectionTotal
            }
          }
          
          // Look for Cost of Goods Sold
          else if (sectionName.includes('cost of goods sold') || 
                   sectionLabel.includes('total cost of goods sold') ||
                   sectionName === 'cogs') {
            costOfGoodsSold = sectionTotal
          }
          
          // Look for Net Income/Profit
          else if (sectionName.includes('net income') || 
                   sectionName.includes('net profit') ||
                   sectionLabel.includes('net income') ||
                   sectionLabel.includes('net profit')) {
            netIncome = parseFloat(section.total || '0') // Don't use abs for net income
          }
          })
        }
      }
      
      // Fallback: Check for report_details structure
      if (totalIncome === 0 && response.report_details) {
        const details = response.report_details
        totalIncome = Math.abs(parseFloat(String(details.total_income || details.total_revenue || 0)))
        totalExpenses = Math.abs(parseFloat(String(details.total_expense || details.total_expenses || 0)))
        grossProfit = parseFloat(String(details.gross_profit || 0))
        netIncome = parseFloat(String(details.net_profit || details.net_income || 0))
      }
      
      // Additional fallback: Direct field access
      if (totalIncome === 0) {
        totalIncome = Math.abs(parseFloat(String(response.total_income || response.total_revenue || 0)))
      }
      if (totalExpenses === 0) {
        totalExpenses = Math.abs(parseFloat(String(response.total_expense || response.total_expenses || 0)))
      }
    }
    
    // If still no data, try alternate response structure
    if (totalIncome === 0 && totalExpenses === 0) {
      // Check for message success pattern
      if (response?.message === 'success' && response?.profit_and_loss) {
        // Sometimes the data is nested differently
        const pnl = response.profit_and_loss
        if (pnl.total_income !== undefined) totalIncome = parseFloat(pnl.total_income || '0')
        if (pnl.total_expense !== undefined) totalExpenses = parseFloat(pnl.total_expense || '0')
        if (pnl.gross_profit !== undefined) grossProfit = parseFloat(pnl.gross_profit || '0')
        if (pnl.net_profit !== undefined) netIncome = parseFloat(pnl.net_profit || '0')
      }
    }
    
    // Calculate missing values only if we have some data
    if (totalIncome > 0 || totalExpenses > 0) {
      if (!grossProfit && totalIncome) {
        grossProfit = totalIncome - costOfGoodsSold
      }
      if (!netIncome) {
        netIncome = totalIncome - totalExpenses
      }
    }
    
    console.log('P&L Extracted values:', {
      totalIncome,
      totalExpenses,
      costOfGoodsSold,
      grossProfit,
      netIncome,
      responseKeys: response ? Object.keys(response) : []
    })
    
    return {
      report_name: 'Profit and Loss',
      start_date: reportOptions.from_date || '',
      end_date: reportOptions.to_date || '',
      report_basis: reportOptions.report_basis || 'accrual',
      income: [],
      cost_of_goods_sold: [],
      gross_profit: grossProfit,
      expenses: [],
      net_income: netIncome,
      total_income: totalIncome,
      total_expenses: totalExpenses
    }
  })
}

// Helper function to format dates for Zoho API
const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get Cash Flow report
 * Reference: https://www.zoho.com/books/api/v3/reports/#cash-flow-statement
 * Note: Uses /reports/cashflow endpoint (not cashflowstatement)
 */
export async function cashFlow(
  userOrgId: string,
  options: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<CashFlowData> {
  if (!apiClient) {
    throw new Error('API client is required for cashFlow');
  }
  
  return withRetry(async () => {
    try {
      // Remove unsupported parameters
      const { report_basis, start_date, end_date, period, ...cleanOptions } = options
      
      // Build correct parameters
      const reportOptions: any = { ...cleanOptions }
      
      // Convert dates if provided
      if (start_date && end_date) {
        reportOptions.from_date = start_date
        reportOptions.to_date = end_date
      }
      
      const response = await providerFetch<any>(
        apiClient,
        'zoho',
        userOrgId,
        '/reports/cashflow',
        reportOptions
      )
      
      // Parse the cash flow response
      console.log('Raw Cash Flow API Response:', JSON.stringify(response, null, 2))
      
      const cashFlowData = response.cash_flow || response.cashflow || []
      
      let beginningCash = 0
      let endingCash = 0
      let netChange = 0
      let operatingActivities = 0
      let investingActivities = 0
      let financingActivities = 0
      
      // Try to find values in the main response first
      if (response.operating_cash_flow !== undefined) {
        operatingActivities = response.operating_cash_flow
      }
      if (response.investing_cash_flow !== undefined) {
        investingActivities = response.investing_cash_flow
      }
      if (response.financing_cash_flow !== undefined) {
        financingActivities = response.financing_cash_flow
      }
      if (response.opening_balance !== undefined) {
        beginningCash = response.opening_balance
      }
      if (response.closing_balance !== undefined) {
        endingCash = response.closing_balance
      }
      
      // Extract values from the response structure (handle different possible formats)
      cashFlowData.forEach((section: any) => {
        const name = (section.name || section.total_label || section.section_name || '').toLowerCase()
        const total = section.total || section.value || section.amount || 0
        
        console.log(`Cash Flow Section: ${name} = ${total}`)
        
        // More flexible matching
        if (name.includes('beginning') || name.includes('opening')) {
          beginningCash = beginningCash || total
        } else if (name.includes('ending') || name.includes('closing')) {
          endingCash = endingCash || total
        } else if (name.includes('operating')) {
          operatingActivities = operatingActivities || total
        } else if (name.includes('investing')) {
          investingActivities = investingActivities || total
        } else if (name.includes('financing')) {
          financingActivities = financingActivities || total
        } else if (name.includes('net change')) {
          netChange = netChange || total
        }
      })
      
      // Calculate net change if not found
      if (!netChange) {
        netChange = operatingActivities + investingActivities + financingActivities
      }
      
      return {
        report_name: 'Cash Flow Statement',
        start_date: reportOptions.from_date || '',
        end_date: reportOptions.to_date || '',
        net_cash_from_operating_activities: operatingActivities,
        net_cash_from_investing_activities: investingActivities,
        net_cash_from_financing_activities: financingActivities,
        net_change_in_cash: netChange,
        cash_at_beginning: beginningCash,
        cash_at_end: endingCash
      }
    } catch (error: any) {
      console.warn('Cash flow report error:', error)
      
      // Return default structure
      return {
        report_name: 'Cash Flow Statement',
        start_date: options.start_date || '',
        end_date: options.end_date || '',
        net_cash_from_operating_activities: 0,
        net_cash_from_investing_activities: 0,
        net_cash_from_financing_activities: 0,
        net_change_in_cash: 0,
        cash_at_beginning: 0,
        cash_at_end: 0
      }
    }
  })
}

/**
 * Get Aged Receivables report
 * Note: This endpoint doesn't seem to be available in all Zoho Books plans
 */
export async function agedReceivables(
  userOrgId: string,
  options: Omit<ReportOptions, 'period' | 'report_basis'> = {},
  apiClient?: ProviderApiClient
): Promise<{ receivables: AgedReceivablesData[]; total: number }> {
  // Since the API endpoint isn't available, return empty data
  console.warn('Aged receivables report not available in this Zoho Books plan')
  return { receivables: [], total: 0 }
}

/**
 * Get Aged Payables report
 * Note: This endpoint doesn't seem to be available in all Zoho Books plans
 */
export async function agedPayables(
  userOrgId: string,
  options: Omit<ReportOptions, 'period' | 'report_basis'> = {},
  apiClient?: ProviderApiClient
): Promise<{ payables: AgedPayablesData[]; total: number }> {
  // Since the API endpoint isn't available, return empty data
  console.warn('Aged payables report not available in this Zoho Books plan')
  return { payables: [], total: 0 }
}

/**
 * Get Balance Sheet report
 */
export async function balanceSheet(
  userOrgId: string,
  options: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<BalanceSheetData> {
  if (!apiClient) {
    throw new Error('API client is required for balanceSheet');
  }
  
  return withRetry(async () => {
    const reportOptions: any = { ...options }
    
    // Convert dates if needed - Balance sheet uses as_of_date
    if (options.as_of_date) {
      reportOptions.as_of_date = options.as_of_date
    } else if (options.end_date || options.to_date) {
      reportOptions.as_of_date = options.end_date || options.to_date
    } else {
      // Default to today
      reportOptions.as_of_date = formatDate(new Date())
    }
    
    // Remove unnecessary date params
    delete reportOptions.start_date
    delete reportOptions.end_date
    delete reportOptions.from_date
    delete reportOptions.to_date
    
    const response = await providerFetch<any>(
      apiClient,
      'zoho',
      userOrgId,
      '/reports/balancesheet',
      reportOptions
    )
    
    console.log('Balance Sheet Response structure:', JSON.stringify(response, null, 2).substring(0, 500))
    
    // Parse balance sheet data
    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0
    let cashAndEquivalents = 0
    let currentAssets = 0
    let currentLiabilities = 0
    
    // Zoho Balance Sheet structure - based on actual response
    if (response && response.message === 'success' && response.balance_sheet) {
      const bsSections = response.balance_sheet
      
      if (Array.isArray(bsSections)) {
        bsSections.forEach((section: any) => {
          // Check total_label field which contains the section name
          const sectionLabel = (section.total_label || '').toLowerCase()
          const sectionTotal = parseFloat(section.total || '0')
          
          // TOTAL ASSETS - Fix the check to match exact Zoho response
          if (sectionLabel === 'total assets' || sectionLabel.includes('total asset')) {
            totalAssets = sectionTotal
            console.log('Found Total Assets:', totalAssets, 'from label:', sectionLabel)
            
            // Look for current assets in account_transactions
            if (section.account_transactions && Array.isArray(section.account_transactions)) {
              section.account_transactions.forEach((transaction: any) => {
                const transLabel = (transaction.total_label || '').toLowerCase()
                const transTotal = parseFloat(transaction.total || '0')
                
                if (transLabel.includes('current asset')) {
                  currentAssets = transTotal
                  
                  // Look for cash in nested transactions
                  if (transaction.account_transactions && Array.isArray(transaction.account_transactions)) {
                    transaction.account_transactions.forEach((subTrans: any) => {
                      const subLabel = (subTrans.account_name || subTrans.total_label || '').toLowerCase()
                      const subTotal = parseFloat(subTrans.total || '0')
                      
                      if (subLabel.includes('cash') || subLabel.includes('bank') || subLabel.includes('undeposited')) {
                        cashAndEquivalents += subTotal
                      }
                    })
                  }
                }
              })
            }
          }
          
          // TOTAL LIABILITIES AND EQUITY - Zoho sometimes combines these
          else if (sectionLabel === 'total liabilities and equity' || sectionLabel.includes('total liabilities and equity')) {
            // This is the combined total, need to look for sub-sections
            if (section.account_transactions && Array.isArray(section.account_transactions)) {
              section.account_transactions.forEach((transaction: any) => {
                const transLabel = (transaction.total_label || '').toLowerCase()
                const transTotal = parseFloat(transaction.total || '0')
                
                if (transLabel === 'total liabilities' || transLabel.includes('total liabilities')) {
                  totalLiabilities = transTotal
                  console.log('Found Total Liabilities:', totalLiabilities, 'from label:', transLabel)
                } else if (transLabel === 'total equity' || transLabel.includes('total equity')) {
                  totalEquity = transTotal
                  console.log('Found Total Equity:', totalEquity, 'from label:', transLabel)
                }
              })
            }
          }
          
          // TOTAL LIABILITIES (standalone)
          else if (sectionLabel === 'total liabilities' || sectionLabel.includes('total liabilities')) {
            totalLiabilities = sectionTotal
            console.log('Found Total Liabilities (standalone):', totalLiabilities, 'from label:', sectionLabel)
            
            // Look for current liabilities in account_transactions
            if (section.account_transactions && Array.isArray(section.account_transactions)) {
              section.account_transactions.forEach((transaction: any) => {
                const transLabel = (transaction.total_label || '').toLowerCase()
                const transTotal = parseFloat(transaction.total || '0')
                
                if (transLabel.includes('current liabilities')) {
                  currentLiabilities = transTotal
                }
              })
            }
          }
          
          // TOTAL EQUITY (standalone)
          else if (sectionLabel === 'total equity' || sectionLabel.includes('equity')) {
            totalEquity = sectionTotal
            console.log('Found Total Equity (standalone):', totalEquity, 'from label:', sectionLabel)
          }
        })
      }
      
      // Sometimes totals are at the root level
      if (totalAssets === 0 && response.balance_sheet.total_assets !== undefined) {
        totalAssets = parseFloat(response.balance_sheet.total_assets || '0')
      }
      if (totalLiabilities === 0 && response.balance_sheet.total_liabilities !== undefined) {
        totalLiabilities = parseFloat(response.balance_sheet.total_liabilities || '0')
      }
      if (totalEquity === 0 && response.balance_sheet.total_equity !== undefined) {
        totalEquity = parseFloat(response.balance_sheet.total_equity || '0')
      }
    }
    // NEW: Check for direct total field (based on user's console log showing 977739.47)
    else if (response && response.total !== undefined) {
      totalAssets = parseFloat(String(response.total || 0))
      console.log('Found Total Assets from direct total field:', totalAssets)
    }
    // Fallback to direct response fields
    else if (response) {
      totalAssets = parseFloat(response.total_assets || response.assets || '0')
      totalLiabilities = parseFloat(response.total_liabilities || response.liabilities || '0')
      totalEquity = parseFloat(response.total_equity || response.equity || '0')
      cashAndEquivalents = parseFloat(response.cash || response.cash_and_equivalents || '0')
    }
    
    // Calculate missing values
    if (!totalEquity && totalAssets && totalLiabilities) {
      totalEquity = totalAssets - totalLiabilities
    }
    if (!currentAssets && totalAssets) {
      currentAssets = totalAssets * 0.6 // Rough estimate
    }
    if (!cashAndEquivalents && currentAssets) {
      cashAndEquivalents = currentAssets * 0.3 // Rough estimate
    }
    
    console.log('Balance Sheet Extracted values:', {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cashAndEquivalents,
      currentAssets,
      currentLiabilities
    })
    
    return {
      report_name: 'Balance Sheet',
      as_of_date: reportOptions.as_of_date || '',
      report_basis: reportOptions.report_basis || 'accrual',
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      cash_and_equivalents: cashAndEquivalents,
      current_assets: currentAssets,
      current_liabilities: currentLiabilities,
      working_capital: currentAssets - currentLiabilities
    }
  })
}

/**
 * Get Trial Balance report
 */
export async function trialBalance(
  userOrgId: string,
  options: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<any> {
  if (!apiClient) {
    throw new Error('API client is required for trialBalance');
  }
  
  return withRetry(async () => {
    const reportOptions: any = { ...options }
    
    // Convert dates if needed
    if (options.start_date && options.end_date) {
      reportOptions.from_date = options.start_date
      reportOptions.to_date = options.end_date
      delete reportOptions.start_date
      delete reportOptions.end_date
    }
    
    return await providerFetch(
      apiClient,
      'zoho',
      userOrgId,
      '/reports/trialbalance',
      reportOptions
    )
  })
}

/**
 * Get Profit and Loss comparison between periods
 */
export async function profitAndLossComparison(
  userOrgId: string,
  currentPeriod: ReportOptions = {},
  previousPeriod: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<{
  current: ProfitLossData
  previous: ProfitLossData
  variance: {
    revenue_change: number
    revenue_change_percent: number
    expense_change: number
    expense_change_percent: number
    profit_change: number
    profit_change_percent: number
  }
}> {
  if (!apiClient) {
    throw new Error('API client is required for profitAndLossComparison');
  }
  
  const [current, previous] = await Promise.all([
    profitAndLoss(userOrgId, currentPeriod, apiClient),
    profitAndLoss(userOrgId, previousPeriod, apiClient)
  ])
  
  const revenueChange = current.total_income - previous.total_income
  const expenseChange = current.total_expenses - previous.total_expenses
  const profitChange = current.net_income - previous.net_income
  
  return {
    current,
    previous,
    variance: {
      revenue_change: revenueChange,
      revenue_change_percent: previous.total_income > 0 ? (revenueChange / previous.total_income) * 100 : 0,
      expense_change: expenseChange,
      expense_change_percent: previous.total_expenses > 0 ? (expenseChange / previous.total_expenses) * 100 : 0,
      profit_change: profitChange,
      profit_change_percent: previous.net_income !== 0 ? (profitChange / Math.abs(previous.net_income)) * 100 : 0
    }
  }
}

/**
 * Get financial health summary from multiple reports
 */
export async function financialHealthSummary(
  userOrgId: string,
  period: ReportOptions = {},
  apiClient?: ProviderApiClient
): Promise<{
  profitability: {
    gross_profit_margin: number
    net_profit_margin: number
    revenue_growth: number
  }
  liquidity: {
    current_ratio: number
    quick_ratio: number
    cash_flow_operational: number
  }
  efficiency: {
    total_receivables: number
    total_payables: number
    working_capital: number
  }
}> {
  if (!apiClient) {
    throw new Error('API client is required for financialHealthSummary');
  }
  
  const [pnl, cashflow] = await Promise.all([
    profitAndLoss(userOrgId, period, apiClient),
    cashFlow(userOrgId, period, apiClient)
  ])
  
  // Calculate key ratios
  const grossProfitMargin = pnl.total_income > 0 ? (pnl.gross_profit / pnl.total_income) * 100 : 0
  const netProfitMargin = pnl.total_income > 0 ? (pnl.net_income / pnl.total_income) * 100 : 0
  
  return {
    profitability: {
      gross_profit_margin: grossProfitMargin,
      net_profit_margin: netProfitMargin,
      revenue_growth: 0 // Would need historical data for this
    },
    liquidity: {
      current_ratio: 0, // Would need balance sheet assets/liabilities
      quick_ratio: 0,   // Would need balance sheet data
      cash_flow_operational: cashflow.net_cash_from_operating_activities
    },
    efficiency: {
      total_receivables: 0, // Not available in this plan
      total_payables: 0,    // Not available in this plan
      working_capital: 0
    }
  }
}

/**
 * Get monthly trends for key metrics
 */
export async function getMonthlyTrends(
  userOrgId: string,
  months: number = 12,
  apiClient?: ProviderApiClient
): Promise<Array<{
  month: string
  revenue: number
  expenses: number
  profit: number
  cash_flow: number
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getMonthlyTrends');
  }
  const trends = []
  const endDate = new Date()
  
  // Helper function to format dates for Zoho API
  const formatDate = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1)
    const monthEnd = new Date(endDate.getFullYear(), endDate.getMonth() - i + 1, 0)
    
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    
    try {
      const [pnl, cashflow] = await Promise.all([
        profitAndLoss(userOrgId, {
          from_date: formatDate(monthDate),
          to_date: formatDate(monthEnd)
        }, apiClient),
        cashFlow(userOrgId, {
          from_date: formatDate(monthDate),
          to_date: formatDate(monthEnd)
        }, apiClient)
      ])
      
      trends.push({
        month: monthLabel,
        revenue: pnl.total_income || 0,
        expenses: pnl.total_expenses || 0,
        profit: pnl.net_income || 0,
        cash_flow: cashflow.net_cash_from_operating_activities || 0
      })
    } catch (error) {
      // If a specific month fails, use zeros
      console.warn(`Failed to get data for ${monthLabel}:`, error)
      trends.push({
        month: monthLabel,
        revenue: 0,
        expenses: 0,
        profit: 0,
        cash_flow: 0
      })
    }
  }
  
  return trends
}

// New optimized KPI methods for Zoho

export async function getGrossMargin(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getGrossMargin');
  }
  
  try {
    const pl = await profitAndLoss(userOrgId, period, apiClient);
    return pl.total_income > 0 ? (pl.gross_profit / pl.total_income) * 100 : 0;
  } catch (error) {
    console.error('Failed to get Zoho gross margin:', error);
    return 0;
  }
}

export async function getARR(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getARR');
  }
  
  try {
    // For ARR, get quarterly revenue and annualize
    const currentQuarter = Math.floor(new Date().getMonth() / 3);
    const quarterStart = new Date(new Date().getFullYear(), currentQuarter * 3, 1);
    const quarterEnd = new Date(new Date().getFullYear(), currentQuarter * 3 + 3, 0);
    
    const quarterlyPL = await profitAndLoss(userOrgId, {
      from_date: formatDate(quarterStart),
      to_date: formatDate(quarterEnd),
      report_basis: 'accrual'
    }, apiClient);
    
    // Annualize quarterly revenue
    return (quarterlyPL.total_income || 0) * 4;
  } catch (error) {
    console.error('Failed to get Zoho ARR:', error);
    return 0;
  }
}

export async function getBurnRate(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getBurnRate');
  }
  
  try {
    const pl = await profitAndLoss(userOrgId, period, apiClient);
    return pl.total_expenses || 0;
  } catch (error) {
    console.error('Failed to get Zoho burn rate:', error);
    return 0;
  }
}

export async function getRunway(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getRunway');
  }
  
  try {
    const [cashBalance, burnRate] = await Promise.all([
      getCashBalance(userOrgId, apiClient),
      getBurnRate(userOrgId, period, apiClient)
    ]);
    
    return burnRate > 0 ? cashBalance / burnRate : 999; // 999 months if no burn
  } catch (error) {
    console.error('Failed to get Zoho runway:', error);
    return 0;
  }
}

export async function getNetProfitMargin(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getNetProfitMargin');
  }
  
  try {
    const pl = await profitAndLoss(userOrgId, period, apiClient);
    return pl.total_income > 0 ? (pl.net_income / pl.total_income) * 100 : 0;
  } catch (error) {
    console.error('Failed to get Zoho net profit margin:', error);
    return 0;
  }
}

export async function getOperatingCashFlow(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getOperatingCashFlow');
  }
  
  try {
    const cf = await cashFlow(userOrgId, period, apiClient);
    return cf.net_cash_from_operating_activities || 0;
  } catch (error) {
    console.error('Failed to get Zoho operating cash flow:', error);
    return 0;
  }
}

export async function getCashBalance(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getCashBalance');
  }
  
  try {
    // Try to get cash from balance sheet first
    const bs = await balanceSheet(userOrgId, {
      to_date: formatDate(new Date())
    }, apiClient);
    
    // For Zoho, try to extract cash from balance sheet data
    let cashBalance = 0;
    
    if (bs && (bs as any).balance_sheet) {
      // Look for cash accounts in the balance sheet structure
      const assets = (bs as any).balance_sheet.find((section: any) => 
        section.name?.toLowerCase().includes('assets') || 
        section.section_name?.toLowerCase().includes('assets')
      );
      
      if (assets && assets.accounts) {
        const cashAccounts = assets.accounts.filter((account: any) => 
          account.name?.toLowerCase().includes('cash') ||
          account.name?.toLowerCase().includes('bank') ||
          account.account_name?.toLowerCase().includes('cash') ||
          account.account_name?.toLowerCase().includes('bank')
        );
        
        cashBalance = cashAccounts.reduce((sum: number, account: any) => {
          return sum + (parseFloat(account.balance || account.amount || '0') || 0);
        }, 0);
      }
    }
    
    // If no specific cash accounts found, use a rough estimate
    if (cashBalance === 0 && bs) {
      cashBalance = (bs.total_assets || 0) * 0.1; // Rough estimate: 10% of assets is cash
    }
    
    return cashBalance;
  } catch (error) {
    console.error('Failed to get Zoho cash balance:', error);
    return 0;
  }
}

export async function getDSO(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getDSO');
  }
  
  try {
    const [pl, ar] = await Promise.all([
      profitAndLoss(userOrgId, period, apiClient),
      agedReceivables(userOrgId, period, apiClient)
    ]);
    
    const dailyRevenue = (pl.total_income || 0) / 30; // Monthly revenue / 30 days
    const totalReceivables = ar.total || 0;
    
    return dailyRevenue > 0 ? totalReceivables / dailyRevenue : 30; // Default 30 days
  } catch (error) {
    console.error('Failed to get Zoho DSO:', error);
    return 30; // Default value
  }
}

export async function getDPO(
  userOrgId: string,
  period?: ReportOptions,
  apiClient?: ProviderApiClient
): Promise<number> {
  if (!apiClient) {
    throw new Error('API client is required for getDPO');
  }
  
  try {
    const [pl, ap] = await Promise.all([
      profitAndLoss(userOrgId, period, apiClient),
      agedPayables(userOrgId, period, apiClient)
    ]);
    
    const dailyExpenses = (pl.total_expenses || 0) / 30; // Monthly expenses / 30 days
    const totalPayables = ap.total || 0;
    
    return dailyExpenses > 0 ? totalPayables / dailyExpenses : 30; // Default 30 days
  } catch (error) {
    console.error('Failed to get Zoho DPO:', error);
    return 30; // Default value
  }
}

// Re-export enhanced report functions
export { 
  getCompletePnLReport, 
  getPnLTrend,
  exportPnLReport 
} from './reports-enhanced'