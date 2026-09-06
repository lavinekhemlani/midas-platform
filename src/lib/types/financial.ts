// src/lib/types/financial.ts

/**
 * Normalized financial data types that work across all providers
 * These ensure consistency when switching between Zoho, QuickBooks, etc.
 */

export interface FinancialForecast {
  forecast_id: string
  forecast_name: string
  forecast_type: 'cash_flow' | 'revenue' | 'expenses' | 'profit'
  time_horizon: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  base_date: string
  methodology: 'trend_analysis' | 'seasonal' | 'regression' | 'manual'
  confidence_level: number
  periods: Array<{
    period: string
    forecasted_value: number
    lower_bound: number
    upper_bound: number
    actual_value?: number
    variance?: number
  }>
  assumptions: string[]
  created_date: string
  last_updated: string
}

// API Response wrappers
export interface PaginatedResponse<T> {
  data: T[]
  page_context?: {
    page: number
    per_page: number
    has_more_page: boolean
    sort_order?: string
    total_count?: number
  }
  message?: string
  code?: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
  code?: number
  errors?: Array<{
    field?: string
    message: string
  }>
}

// Utility types for filtering and querying
export interface DateRange {
  start_date: string
  end_date: string
}

export interface QueryFilters {
  date_range?: DateRange
  status?: string | string[]
  customer_id?: string
  vendor_id?: string
  category_id?: string
  account_id?: string
  amount_min?: number
  amount_max?: number
  search_text?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface ProviderConfig {
  provider_id: string
  provider_name: string
  is_active: boolean
  credentials: Record<string, any>
  last_sync: string
  sync_status: 'connected' | 'disconnected' | 'error' | 'syncing'
  error_message?: string
  supported_features: string[]
}

// Rolling window calculations
export interface RollingMetrics {
  metric_name: string
  window_days: number
  current_period: {
    start_date: string
    end_date: string
    value: number
  }
  previous_period: {
    start_date: string
    end_date: string
    value: number
  }
  change_absolute: number
  change_percentage: number
  trend: 'up' | 'down' | 'stable'
  rolling_average: number
  volatility: number
}

export interface MonthlySnapshot {
  year_month: string
  revenue: number
  expenses: number
  gross_profit: number
  net_profit: number
  cash_flow: number
  ending_cash: number
  receivables: number
  payables: number
  employee_count?: number
  customer_count?: number
}

// // Export all types for easy importing
// export type {
//   FinancialPeriod,
//   Currency,
//   Money,
//   Address,
//   Contact,
//   LineItem,
//   Tax,
//   Invoice,
//   Expense,
//   Bill,
//   Payment,
//   BankAccount,
//   BankTransaction,
//   FinancialSummary,
//   KPIMetric,
//   ChartData,
//   TimeSeriesData,
//   CategoryBreakdown,
//   AgingBucket,
//   AgingReport,
//   CashFlowStatement,
//   ProfitLossStatement,
//   BalanceSheet,
//   FinancialRatio,
//   FinancialInsight,
//   FinancialForecast,
//   PaginatedResponse,
//   ApiResponse,
//   DateRange,
//   QueryFilters,
//   ProviderConfig,
//   RollingMetrics,
//   MonthlySnapshot
// } BankAccount {
//   account_id: string
//   account_name: string
//   account_type: 'bank' | 'credit_card' | 'cash' | 'other_current_asset' | 'other_asset'
//   account_number?: string
//   routing_number?: string
//   bank_name?: string
//   balance: number
//   bank_balance?: number
//   uncategorized_transactions?: number
//   currency_code: string
//   is_active: boolean
//   is_primary?: boolean
//   description?: string
//   created_time: string
//   last_modified_time: string
// }

export interface BankTransaction {
  transaction_id: string
  date: string
  amount: number
  debit_or_credit: 'debit' | 'credit'
  payee?: string
  description: string
  reference_number?: string
  bank_transaction_id?: string
  status: 'matched' | 'unmatched' | 'excluded' | 'categorized' | 'uncategorized'
  offset_account_id?: string
  offset_account_name?: string
  customer_id?: string
  customer_name?: string
  vendor_id?: string
  vendor_name?: string
  imported_transaction_id?: string
  currency_code: string
  created_time: string
  last_modified_time: string
}

export interface FinancialSummary {
  total_revenue: number
  total_expenses: number
  gross_profit: number
  net_profit: number
  profit_margin: number
  cash_balance: number
  accounts_receivable: number
  accounts_payable: number
  working_capital: number
  current_ratio?: number
  quick_ratio?: number
  debt_to_equity?: number
  return_on_assets?: number
}

export interface KPIMetric {
  metric_name: string
  current_value: number
  previous_value?: number
  change_amount?: number
  change_percentage?: number
  trend: 'up' | 'down' | 'stable'
  period: string
  unit: 'currency' | 'percentage' | 'number' | 'days' | 'months'
  is_good_trend: boolean
  target_value?: number
  benchmark_value?: number
}

export interface ChartData {
  labels: string[]
  datasets: Array<{
    label: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
    fill?: boolean
    tension?: number
  }>
}

export interface TimeSeriesData {
  period: string
  revenue: number
  expenses: number
  profit: number
  cash_flow: number
  growth_rate?: number
}

export interface CategoryBreakdown {
  category: string
  amount: number
  percentage: number
  count: number
  trend?: 'up' | 'down' | 'stable'
  change_percentage?: number
}

export interface AgingBucket {
  period_name: string
  period_range: string
  amount: number
  count: number
  percentage: number
}

export interface AgingReport {
  report_type: 'receivables' | 'payables'
  as_of_date: string
  currency_code: string
  total_amount: number
  buckets: AgingBucket[]
  details: Array<{
    contact_id: string
    contact_name: string
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_over_90: number
    total: number
  }>
}

export interface CashFlowStatement {
  period: FinancialPeriod
  currency_code: string
  operating_activities: {
    net_income: number
    depreciation: number
    accounts_receivable_change: number
    accounts_payable_change: number
    inventory_change: number
    other_adjustments: number
    net_cash_from_operations: number
  }
  investing_activities: {
    equipment_purchases: number
    asset_sales: number
    other_investments: number
    net_cash_from_investing: number
  }
  financing_activities: {
    loan_proceeds: number
    loan_payments: number
    equity_contributions: number
    dividend_payments: number
    net_cash_from_financing: number
  }
  net_change_in_cash: number
  cash_beginning_period: number
  cash_end_period: number
}

export interface ProfitLossStatement {
  period: FinancialPeriod
  currency_code: string
  revenue: {
    gross_sales: number
    returns_allowances: number
    discounts: number
    net_sales: number
  }
  cost_of_goods_sold: {
    materials: number
    labor: number
    overhead: number
    total_cogs: number
  }
  gross_profit: number
  operating_expenses: {
    salaries_wages: number
    rent: number
    utilities: number
    marketing: number
    professional_services: number
    insurance: number
    depreciation: number
    other_expenses: number
    total_operating_expenses: number
  }
  operating_income: number
  other_income: number
  other_expenses: number
  earnings_before_tax: number
  tax_expense: number
  net_income: number
}

export interface BalanceSheet {
  as_of_date: string
  currency_code: string
  assets: {
    current_assets: {
      cash: number
      accounts_receivable: number
      inventory: number
      prepaid_expenses: number
      other_current_assets: number
      total_current_assets: number
    }
    fixed_assets: {
      equipment: number
      buildings: number
      land: number
      accumulated_depreciation: number
      total_fixed_assets: number
    }
    other_assets: number
    total_assets: number
  }
  liabilities: {
    current_liabilities: {
      accounts_payable: number
      accrued_expenses: number
      short_term_debt: number
      other_current_liabilities: number
      total_current_liabilities: number
    }
    long_term_liabilities: {
      long_term_debt: number
      other_long_term_liabilities: number
      total_long_term_liabilities: number
    }
    total_liabilities: number
  }
  equity: {
    owner_equity: number
    retained_earnings: number
    current_earnings: number
    total_equity: number
  }
  total_liabilities_equity: number
}

export interface FinancialRatio {
  ratio_name: string
  value: number
  benchmark: number
  industry_average?: number
  interpretation: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  description: string
  formula: string
}

export interface FinancialInsight {
  insight_id: string
  title: string
  description: string
  type: 'opportunity' | 'warning' | 'critical' | 'positive' | 'neutral'
  priority: 'high' | 'medium' | 'low'
  category: 'cash_flow' | 'profitability' | 'efficiency' | 'growth' | 'risk'
  metric_impact: number
  action_required: boolean
  recommended_actions?: string[]
  created_date: string
}

export interface FinancialPeriod {
  start_date: string
  end_date: string
  period_name: string
}

export interface Currency {
  code: string
  symbol: string
  precision: number
}

export interface Money {
  amount: number
  currency: Currency
}

export interface Address {
  attention?: string
  address?: string
  street2?: string
  state_code?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  fax?: string
  phone?: string
}

export interface Contact {
  contact_id: string
  contact_name: string
  company_name?: string
  contact_type: 'customer' | 'vendor' | 'employee'
  email?: string
  phone?: string
  website?: string
  billing_address?: Address
  shipping_address?: Address
  payment_terms?: string
  payment_terms_label?: string
  currency_code?: string
  outstanding_receivable_amount?: number
  outstanding_payable_amount?: number
  credit_limit?: number
  is_active: boolean
  created_time: string
  last_modified_time: string
}

export interface LineItem {
  line_item_id?: string
  item_id?: string
  name: string
  description?: string
  rate: number
  quantity: number
  unit?: string
  discount?: number
  tax_percentage?: number
  item_total: number
}

export interface Tax {
  tax_id: string
  tax_name: string
  tax_percentage: number
  tax_amount: number
}

export interface Invoice {
  invoice_id: string
  invoice_number: string
  date: string
  due_date?: string
  payment_terms?: string
  payment_terms_label?: string
  customer_id: string
  customer_name: string
  line_items: LineItem[]
  sub_total: number
  discount_total?: number
  tax_total: number
  total: number
  balance: number
  status: 'draft' | 'sent' | 'viewed' | 'expired' | 'accepted' | 'declined' | 'invoiced' | 'paid' | 'overdue' | 'partially_paid' | 'void'
  payment_made: number
  credits_applied: number
  reference_number?: string
  notes?: string
  shipping_charge?: number
  adjustment?: number
  write_off_amount?: number
  exchange_rate?: number
  currency_code: string
  current_sub_total?: number
  is_viewed_by_client: boolean
  client_viewed_time?: string
  last_payment_date?: string
  created_time: string
  last_modified_time: string
}

export interface Expense {
  expense_id: string
  date: string
  account_id?: string
  account_name?: string
  paid_through_account_id?: string
  vendor_id?: string
  vendor_name?: string
  payee?: string
  expense_receipt_name?: string
  category_id?: string
  category_name?: string
  description?: string
  amount: number
  tax_amount?: number
  sub_total: number
  total: number
  reference_number?: string
  payment_mode?: string
  exchange_rate?: number
  currency_code: string
  project_id?: string
  project_name?: string
  customer_id?: string
  customer_name?: string
  billable?: boolean
  reimbursable?: boolean
  receipt_returned?: boolean
  mileage?: number
  per_mile_rate?: number
  approval_status?: string
  submitted_date?: string
  approved_date?: string
  status: 'unbilled' | 'invoiced' | 'reimbursed' | 'non-billable' | 'billable'
  created_time: string
  last_modified_time: string
}

export interface Bill {
  bill_id: string
  vendor_id: string
  vendor_name: string
  bill_number?: string
  order_number?: string
  date: string
  due_date: string
  reference_number?: string
  line_items: LineItem[]
  sub_total: number
  tax_total: number
  total: number
  balance: number
  payment_made: number
  vendor_credits_applied: number
  status: 'draft' | 'open' | 'overdue' | 'paid' | 'void' | 'partially_paid'
  currency_code: string
  exchange_rate?: number
  notes?: string
  recurring_bill_id?: string
  created_time: string
  last_modified_time: string
}

export interface Payment {
  payment_id: string
  payment_number?: string
  date: string
  payment_mode: string
  amount: number
  bank_charges?: number
  exchange_rate?: number
  currency_code: string
  reference_number?: string
  description?: string
  invoices?: Array<{
    invoice_id: string
    invoice_number: string
    amount_applied: number
    tax_amount_withheld?: number
    discount_amount?: number
  }>
  customer_id?: string
  customer_name?: string
  account_id?: string
  account_name?: string
  created_time: string
  last_modified_time: string
}
