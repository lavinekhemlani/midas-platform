// src/lib/providers/interfaces/expenses.ts
import { BaseQueryOptions } from './invoices';

/**
 * Options for listing expenses across different providers
 */
export interface ExpenseListOptions extends BaseQueryOptions {
  account_id?: string;
  paid_through_account_id?: string;
  category_id?: string;
  search_text?: string;
  reference_number?: string;
  expense_receipt_name?: string;
  description?: string;
  customer_id?: string;
  project_id?: string;
  recurring_expense_id?: string;
  tax_id?: string;
}

/**
 * Standardized expense summary structure
 */
export interface ExpenseSummary {
  total_amount: number;
  total_count: number;
  by_category: Record<string, { amount: number; count: number }>;
  by_month: Record<string, number>;
  average_amount: number;
}

/**
 * Monthly expense trend data point
 */
export interface MonthlyExpenseTrend {
  month: string;
  amount: number;
  count: number;
}

/**
 * Top expense category data
 */
export interface TopExpenseCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

/**
 * Generic expense object structure that providers should map to
 */
export interface Expense {
  id: string;
  expense_number?: string;
  account_id?: string;
  paid_through_account_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  category_id?: string;
  category_name?: string;
  date: string;
  amount: number;
  total: number;
  currency_code: string;
  description?: string;
  reference_number?: string;
  customer_id?: string;
  customer_name?: string;
  project_id?: string;
  project_name?: string;
  status?: string;
  created_time?: string;
  last_modified_time?: string;
}

/**
 * Interface that all expense providers must implement
 */
export interface ExpenseProvider {
  /**
   * List expenses with optional filtering
   * @param userOrgId - The organization ID
   * @param options - Filtering and pagination options
   * @returns Promise resolving to an array of expenses
   */
  listExpenses(userOrgId: string, options?: ExpenseListOptions): Promise<Expense[]>;

  /**
   * Get detailed expense by ID
   * @param userOrgId - The organization ID
   * @param expenseId - The expense ID
   * @returns Promise resolving to a single expense
   */
  getExpense(userOrgId: string, expenseId: string): Promise<Expense>;

  /**
   * Get expense categories summary
   * @param userOrgId - The organization ID
   * @param options - Date range options
   * @returns Promise resolving to expense summary data
   */
  expenseCategoriesSummary(userOrgId: string, options?: { date_start?: string; date_end?: string }): Promise<ExpenseSummary>;

  /**
   * Get expenses by category
   * @param userOrgId - The organization ID
   * @param categoryId - The category ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of expenses
   */
  getExpensesByCategory(userOrgId: string, categoryId: string, options?: Omit<ExpenseListOptions, 'category_id'>): Promise<Expense[]>;

  /**
   * Get expenses by customer
   * @param userOrgId - The organization ID
   * @param customerId - The customer ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of expenses
   */
  getExpensesByCustomer(userOrgId: string, customerId: string, options?: Omit<ExpenseListOptions, 'customer_id'>): Promise<Expense[]>;

  /**
   * Search expenses by text
   * @param userOrgId - The organization ID
   * @param searchText - Text to search for
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of matching expenses
   */
  searchExpenses(userOrgId: string, searchText: string, options?: Omit<ExpenseListOptions, 'search_text'>): Promise<Expense[]>;

  /**
   * Get recent expenses (last N days)
   * @param userOrgId - The organization ID
   * @param days - Number of days to look back (default: 30)
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of recent expenses
   */
  getRecentExpenses(userOrgId: string, days?: number, options?: ExpenseListOptions): Promise<Expense[]>;

  /**
   * Get monthly expense trend
   * @param userOrgId - The organization ID
   * @param months - Number of months to look back (default: 12)
   * @returns Promise resolving to monthly trend data
   */
  getMonthlyExpenseTrend(userOrgId: string, months?: number): Promise<MonthlyExpenseTrend[]>;

  /**
   * Get top expense categories
   * @param userOrgId - The organization ID
   * @param limit - Number of top categories to return (default: 10)
   * @param options - Date range options
   * @returns Promise resolving to top categories data
   */
  getTopExpenseCategories(userOrgId: string, limit?: number, options?: { date_start?: string; date_end?: string }): Promise<TopExpenseCategory[]>;
}
