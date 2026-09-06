// src/lib/providers/interfaces/budgets.ts
import { BaseQueryOptions } from './invoices';

/**
 * Options for listing budgets across different providers
 */
export interface BudgetListOptions extends BaseQueryOptions {
  name?: string;
  account_id?: string;
  category_id?: string;
  project_id?: string;
  period?: 'monthly' | 'quarterly' | 'yearly' | 'custom';
}

/**
 * Generic budget structure that providers should map to
 */
export interface Budget {
  budget_id: string;
  budget_name: string;
  budget_type: 'category' | 'project' | 'overall';
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  start_date: string;
  end_date: string;
  amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_spent: number;
  status: 'active' | 'inactive' | 'exceeded';
  category_id?: string;
  category_name?: string;
  project_id?: string;
  project_name?: string;
  account_id?: string;
  account_name?: string;
  notes?: string;
  created_time: string;
  last_modified_time: string;
}

/**
 * Budget variance analysis data structure
 */
export interface BudgetVariance {
  budget_id: string;
  budget_name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_percentage: number;
  status: 'under' | 'on_target' | 'over';
  period: string;
  category?: string;
  recommendations?: string[];
}

/**
 * Budget forecast data structure
 */
export interface BudgetForecast {
  budget_id: string;
  current_spend_rate: number;
  projected_spend: number;
  projected_variance: number;
  days_remaining: number;
  recommended_daily_limit: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Budget recommendation data structure
 */
export interface BudgetRecommendation {
  category: string;
  current_average: number;
  recommended_budget: number;
  adjustment_percentage: number;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Budget alert rule data structure
 */
export interface BudgetAlertRule {
  category?: string;
  threshold_percentage: number;
  alert_type: 'email' | 'dashboard' | 'both';
  recipients?: string[];
}

/**
 * Historical budget performance data structure
 */
export interface HistoricalBudgetPerformance {
  month: string;
  total_budgeted: number;
  total_actual: number;
  variance: number;
  variance_percentage: number;
  categories_over_budget: number;
  categories_under_budget: number;
}

/**
 * Budget optimization suggestion data structure
 */
export interface BudgetOptimizationSuggestion {
  suggestion_type: 'reallocation' | 'reduction' | 'elimination' | 'automation';
  category_from?: string;
  category_to?: string;
  amount: number;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  expected_savings?: number;
}

/**
 * Interface that all budget providers must implement
 */
export interface BudgetProvider {
  /**
   * List all budgets
   * @param userOrgId - The organization ID
   * @param options - Filtering options
   * @returns Promise resolving to array of budgets
   */
  listBudgets?(userOrgId: string, options?: BudgetListOptions): Promise<Budget[]>;

  /**
   * Get budget vs actual comparison
   * @param userOrgId - The organization ID
   * @param options - Period and filtering options
   * @returns Promise resolving to budget variance data
   */
  getBudgetVsActual(userOrgId: string, options?: {
    period?: 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
    start_date?: string;
    end_date?: string;
    category_id?: string;
  }): Promise<BudgetVariance[]>;

  /**
   * Get budget forecast
   * @param userOrgId - The organization ID
   * @param budgetId - Optional specific budget ID
   * @returns Promise resolving to budget forecast data
   */
  getBudgetForecast(userOrgId: string, budgetId?: string): Promise<BudgetForecast[]>;

  /**
   * Get budget recommendations
   * @param userOrgId - The organization ID
   * @param options - Options including number of months to analyze
   * @returns Promise resolving to budget recommendations
   */
  getBudgetRecommendations(userOrgId: string, options?: { months?: number }): Promise<BudgetRecommendation[]>;

  /**
   * Create budget alert rules
   * @param userOrgId - The organization ID
   * @param rules - Array of alert rules to create
   * @returns Promise resolving to creation result
   */
  createBudgetAlertRules(userOrgId: string, rules: BudgetAlertRule[]): Promise<{ success: boolean; rules_created: number }>;

  /**
   * Get historical budget performance
   * @param userOrgId - The organization ID
   * @param months - Number of months to analyze (default: 12)
   * @returns Promise resolving to historical performance data
   */
  getHistoricalBudgetPerformance(userOrgId: string, months?: number): Promise<HistoricalBudgetPerformance[]>;

  /**
   * Get budget optimization suggestions
   * @param userOrgId - The organization ID
   * @returns Promise resolving to optimization suggestions
   */
  getBudgetOptimizationSuggestions(userOrgId: string): Promise<BudgetOptimizationSuggestion[]>;
}
