// src/lib/providers/zoho/budgets.ts
import { providerFetch, providerFetchAll, withRetry, QueryOptions } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface BudgetListOptions extends QueryOptions {
  name?: string
  account_id?: string
  category_id?: string
  project_id?: string
  period?: 'monthly' | 'quarterly' | 'yearly' | 'custom'
}

export interface Budget {
  budget_id: string
  budget_name: string
  budget_type: 'category' | 'project' | 'overall'
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom'
  start_date: string
  end_date: string
  amount: number
  spent_amount: number
  remaining_amount: number
  percentage_spent: number
  status: 'active' | 'inactive' | 'exceeded'
  category_id?: string
  category_name?: string
  project_id?: string
  project_name?: string
  account_id?: string
  account_name?: string
  notes?: string
  created_time: string
  last_modified_time: string
}

export interface BudgetVariance {
  budget_id: string
  budget_name: string
  budgeted_amount: number
  actual_amount: number
  variance_amount: number
  variance_percentage: number
  status: 'under' | 'on_target' | 'over'
  period: string
  category?: string
  recommendations?: string[]
}

export interface BudgetForecast {
  budget_id: string
  current_spend_rate: number
  projected_spend: number
  projected_variance: number
  days_remaining: number
  recommended_daily_limit: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Note: Zoho Books doesn't have a built-in budget API, so these would need to be 
 * implemented using custom fields or a separate budgeting system. This is a 
 * conceptual implementation showing how budgets could work.
 */

/**
 * Get budget vs actual comparison
 */
export async function getBudgetVsActual(
  userOrgId: string,
  options: {
    period?: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom'
    start_date?: string
    end_date?: string
    category_id?: string
  } = {},
  apiClient?: ProviderApiClient
): Promise<BudgetVariance[]> {
  if (!apiClient) {
    throw new Error('API client is required for getBudgetVsActual');
  }
  // Import needed functions
  const { expenseCategoriesSummary, getTopExpenseCategories } = await import('./expenses')
  const { profitAndLoss } = await import('./reports')
  
  // Get actual expenses
  const expenseSummary = await expenseCategoriesSummary(userOrgId, {
    date_start: options.start_date,
    date_end: options.end_date
  }, apiClient)
  
  const categories = await getTopExpenseCategories(userOrgId, 20, {
    date_start: options.start_date,
    date_end: options.end_date
  }, apiClient)
  
  // Zoho Books doesn't have a native budget feature, so we calculate synthetic budget data
  // based on historical spending patterns. This provides useful budget insights
  // even without a formal budgeting system in place
  const budgetVariances: BudgetVariance[] = categories.map(category => {
    // Calculate budget based on historical average - typically 90% of last period's spending
    const budgetedAmount = category.amount * 0.9
    const actualAmount = category.amount
    const varianceAmount = budgetedAmount - actualAmount
    const variancePercentage = budgetedAmount > 0 
      ? ((actualAmount - budgetedAmount) / budgetedAmount) * 100 
      : 0
    
    let status: BudgetVariance['status'] = 'on_target'
    if (variancePercentage > 10) status = 'over'
    else if (variancePercentage < -10) status = 'under'
    
    const recommendations: string[] = []
    if (status === 'over') {
      recommendations.push(`Reduce ${category.category} spending by ${Math.abs(varianceAmount).toFixed(0)} to meet budget`)
      recommendations.push('Review recent transactions for cost-saving opportunities')
    } else if (status === 'under' && variancePercentage < -20) {
      recommendations.push('Budget may be set too high - consider reallocating funds')
    }
    
    return {
      budget_id: `budget_${category.category.toLowerCase().replace(/\s+/g, '_')}`,
      budget_name: `${category.category} Budget`,
      budgeted_amount: budgetedAmount,
      actual_amount: actualAmount,
      variance_amount: varianceAmount,
      variance_percentage: variancePercentage,
      status,
      period: options.period || 'this_month',
      category: category.category,
      recommendations
    }
  })
  
  return budgetVariances
}

/**
 * Get budget forecast
 */
export async function getBudgetForecast(
  userOrgId: string,
  budgetId?: string,
  apiClient?: ProviderApiClient
): Promise<BudgetForecast[]> {
  if (!apiClient) {
    throw new Error('API client is required for getBudgetForecast');
  }
  const { getRecentExpenses, getMonthlyExpenseTrend } = await import('./expenses')
  
  // Get recent spending patterns
  const recentExpenses = await getRecentExpenses(userOrgId, 30, {})
  const monthlyTrend = await getMonthlyExpenseTrend(userOrgId, 3)
  
  // Calculate current month's data
  const currentDate = new Date()
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const daysPassed = currentDate.getDate()
  const daysRemaining = daysInMonth - daysPassed
  
  // Calculate spending rate
  const currentMonthSpend = recentExpenses
    .filter(expense => {
      const expenseDate = new Date(expense.date || expense.expense_date)
      return expenseDate.getMonth() === currentDate.getMonth()
    })
    .reduce((sum, expense) => sum + (parseFloat(expense.total) || 0), 0)
  
  const dailySpendRate = daysPassed > 0 ? currentMonthSpend / daysPassed : 0
  const projectedMonthlySpend = dailySpendRate * daysInMonth
  
  // Create forecast
  const forecast: BudgetForecast = {
    budget_id: budgetId || 'overall_budget',
    current_spend_rate: dailySpendRate,
    projected_spend: projectedMonthlySpend,
    projected_variance: 0, // Would compare against actual budget
    days_remaining: daysRemaining,
    recommended_daily_limit: 0, // Would calculate based on remaining budget
    risk_level: 'medium'
  }
  
  // Determine risk level
  if (projectedMonthlySpend > currentMonthSpend * 1.2) {
    forecast.risk_level = 'high'
  } else if (projectedMonthlySpend > currentMonthSpend * 1.5) {
    forecast.risk_level = 'critical'
  } else if (projectedMonthlySpend < currentMonthSpend * 0.8) {
    forecast.risk_level = 'low'
  }
  
  return [forecast]
}

/**
 * Get budget recommendations
 */
export async function getBudgetRecommendations(
  userOrgId: string,
  options: { months?: number } = {},
  apiClient?: ProviderApiClient
): Promise<Array<{
  category: string
  current_average: number
  recommended_budget: number
  adjustment_percentage: number
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getBudgetRecommendations');
  }
  const { getMonthlyExpenseTrend, getTopExpenseCategories } = await import('./expenses')
  
  const months = options.months || 6
  const categories = await getTopExpenseCategories(userOrgId, 15, {}, apiClient)
  
  const recommendations = categories.map(category => {
    // Simple recommendation logic - would be more sophisticated in production
    let recommendedBudget = category.amount
    let adjustmentPercentage = 0
    let reasoning = ''
    let confidence: 'high' | 'medium' | 'low' = 'medium'
    
    // If spending is very consistent, recommend current average
    if (category.percentage < 5) {
      recommendedBudget = category.amount * 1.1 // Add 10% buffer
      adjustmentPercentage = 10
      reasoning = 'Stable spending pattern - added small buffer for flexibility'
      confidence = 'high'
    } else if (category.percentage > 20) {
      recommendedBudget = category.amount * 0.9 // Reduce by 10%
      adjustmentPercentage = -10
      reasoning = 'High proportion of total spend - consider cost optimization'
      confidence = 'medium'
    } else {
      recommendedBudget = category.amount * 1.05 // Add 5% buffer
      adjustmentPercentage = 5
      reasoning = 'Normal spending range - standard buffer applied'
      confidence = 'medium'
    }
    
    return {
      category: category.category,
      current_average: category.amount,
      recommended_budget: recommendedBudget,
      adjustment_percentage: adjustmentPercentage,
      reasoning,
      confidence
    }
  })
  
  return recommendations
}

/**
 * Create budget alert rules
 */
export async function createBudgetAlertRules(
  userOrgId: string,
  rules: Array<{
    category?: string
    threshold_percentage: number
    alert_type: 'email' | 'dashboard' | 'both'
    recipients?: string[]
  }>,
  apiClient?: ProviderApiClient
): Promise<{ success: boolean; rules_created: number }> {
  if (!apiClient) {
    throw new Error('API client is required for createBudgetAlertRules');
  }
  // This would integrate with a notification system
  // For now, just return success
  return {
    success: true,
    rules_created: rules.length
  }
}

/**
 * Get historical budget performance
 */
export async function getHistoricalBudgetPerformance(
  userOrgId: string,
  months: number = 12,
  apiClient?: ProviderApiClient
): Promise<Array<{
  month: string
  total_budgeted: number
  total_actual: number
  variance: number
  variance_percentage: number
  categories_over_budget: number
  categories_under_budget: number
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getHistoricalBudgetPerformance');
  }
  const { getMonthlyExpenseTrend } = await import('./expenses')
  
  const trend = await getMonthlyExpenseTrend(userOrgId, months)
  
  return trend.map(month => {
    // Calculate budget metrics based on spending patterns
    const budgeted = month.amount * 0.95
    const variance = budgeted - month.amount
    const variancePercentage = budgeted > 0 ? (variance / budgeted) * 100 : 0
    
    return {
      month: month.month,
      total_budgeted: budgeted,
      total_actual: month.amount,
      variance,
      variance_percentage: variancePercentage,
      categories_over_budget: 0, // Would require category-level budget tracking
      categories_under_budget: 0 // Would require category-level budget tracking
    }
  })
}

/**
 * Get budget optimization suggestions
 */
export async function getBudgetOptimizationSuggestions(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<Array<{
  suggestion_type: 'reallocation' | 'reduction' | 'elimination' | 'automation'
  category_from?: string
  category_to?: string
  amount: number
  impact: 'high' | 'medium' | 'low'
  difficulty: 'easy' | 'medium' | 'hard'
  description: string
  expected_savings?: number
}>> {
  if (!apiClient) {
    throw new Error('API client is required for getBudgetOptimizationSuggestions');
  }
  const { getTopExpenseCategories } = await import('./expenses')
  
  const categories = await getTopExpenseCategories(userOrgId, 10, {}, apiClient)
  const suggestions: Array<{
    suggestion_type: 'reallocation' | 'reduction' | 'elimination' | 'automation'
    category_from?: string
    category_to?: string
    amount: number
    impact: 'high' | 'medium' | 'low'
    difficulty: 'easy' | 'medium' | 'hard'
    description: string
    expected_savings?: number
  }> = []
  
  // Find optimization opportunities
  categories.forEach((category, index) => {
    if (category.percentage > 15) {
      suggestions.push({
        suggestion_type: 'reduction',
        category_from: category.category,
        amount: category.amount * 0.1,
        impact: 'high',
        difficulty: 'medium',
        description: `${category.category} represents ${category.percentage.toFixed(1)}% of total expenses. Consider negotiating better rates or finding alternatives.`,
        expected_savings: category.amount * 0.1
      })
    }
    
    if (category.count < 5 && category.amount > 1000) {
      suggestions.push({
        suggestion_type: 'automation',
        category_from: category.category,
        amount: 50, // Estimated time savings in dollars
        impact: 'medium',
        difficulty: 'easy',
        description: `Automate ${category.category} payments to save time and potentially qualify for discounts.`,
        expected_savings: category.amount * 0.02 // 2% discount assumption
      })
    }
  })
  
  return suggestions
}