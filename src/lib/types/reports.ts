// Enhanced TypeScript types for financial reports and KPIs
// These types provide comprehensive structure for both QuickBooks and Zoho formats

/**
 * Base report line item structure
 */
export interface ReportLineItem {
  id: string
  name: string
  value: number
  parent_id?: string
  level: number
  is_subtotal?: boolean
  is_total?: boolean
  is_header?: boolean
  children?: ReportLineItem[]
  account_type?: string
  account_code?: string
  percentage?: number // For percentage of total calculations
}

/**
 * Report section containing related line items
 */
export interface ReportSection {
  section_id: string
  section_name: string
  section_type: string
  line_items: ReportLineItem[]
  section_total?: number
  subsections?: ReportSection[]
  sort_order?: number
}

/**
 * Enhanced financial report base structure
 */
export interface EnhancedFinancialReport {
  report_name: string
  report_type: 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'aged_receivables' | 'aged_payables' | 'trial_balance'
  organization_name: string
  currency: string
  period: {
    start_date?: string
    end_date?: string
    as_of_date?: string
  }
  basis?: 'accrual' | 'cash'
  sections: ReportSection[]
  totals: Record<string, number>
  export_options?: {
    pdf_url?: string
    excel_url?: string
  }
  metadata?: {
    generated_at?: string
    provider?: string
    cache_status?: string
  }
}

/**
 * Comprehensive Profit & Loss report structure
 */
export interface EnhancedProfitLossReport extends EnhancedFinancialReport {
  report_type: 'profit_loss'
  income_sections: ReportSection[]
  expense_sections: ReportSection[]
  cogs_sections?: ReportSection[]
  margin_analysis: {
    gross_margin_percent: number
    net_margin_percent: number
    ebitda_margin_percent?: number
  }
  period_comparison?: {
    previous_period: EnhancedProfitLossReport
    variance_analysis: VarianceAnalysis
  }
}

/**
 * Enhanced Balance Sheet report structure
 */
export interface EnhancedBalanceSheetReport extends EnhancedFinancialReport {
  report_type: 'balance_sheet'
  asset_sections: ReportSection[]
  liability_sections: ReportSection[]
  equity_sections: ReportSection[]
  ratios: {
    current_ratio?: number
    quick_ratio?: number
    debt_to_equity?: number
    working_capital: number
  }
}

/**
 * Enhanced Cash Flow report structure
 */
export interface EnhancedCashFlowReport extends EnhancedFinancialReport {
  report_type: 'cash_flow'
  operating_activities: ReportSection
  investing_activities: ReportSection
  financing_activities: ReportSection
  cash_summary: {
    beginning_cash: number
    ending_cash: number
    net_change: number
  }
}

/**
 * Aged receivables/payables report structure
 */
export interface AgedReport {
  report_name: string
  report_type: 'aged_receivables' | 'aged_payables'
  organization_name: string
  currency: string
  as_of_date: string
  aging_buckets: {
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    days_over_90: number
  }
  details: AgedReportItem[]
  total_amount: number
  summary_stats: {
    average_days_outstanding: number
    largest_outstanding: number
    concentration_risk: number // Percentage of total from top customer/vendor
  }
}

export interface AgedReportItem {
  contact_id: string
  contact_name: string
  current: number
  days_1_30: number
  days_31_60: number
  days_61_90: number
  days_over_90: number
  total: number
  percentage_of_total: number
}

/**
 * Variance analysis for period comparisons
 */
export interface VarianceAnalysis {
  revenue_change: number
  revenue_change_percent: number
  expense_change: number
  expense_change_percent: number
  profit_change: number
  profit_change_percent: number
  margin_change: {
    gross_margin_change: number
    net_margin_change: number
  }
}

/**
 * Comprehensive KPI data structure
 */
export interface KPIData {
  metric: KPIMetricType
  value: number
  formatted_value?: string
  trend: TrendData
  period_end: string
  last_update_ts: number
  next_update_ts: number
  benchmark?: {
    industry_average?: number
    target_value?: number
    status: 'above_target' | 'below_target' | 'on_target'
  }
  drill_down?: {
    url: string
    report_type: string
  }
}

export type KPIMetricType = 
  | 'arr' 
  | 'gross_margin_pct' 
  | 'net_profit_margin' 
  | 'burn_rate' 
  | 'runway_months' 
  | 'cash_balance' 
  | 'ocf' 
  | 'dso' 
  | 'dpo'
  | 'revenue_growth'
  | 'customer_acquisition_cost'
  | 'lifetime_value'
  | 'churn_rate'

export interface TrendData {
  direction: 'up' | 'down' | 'stable'
  percentage: number
  period_comparison: string // e.g., "vs last month"
  trend_analysis?: {
    is_improving: boolean
    confidence_level: 'high' | 'medium' | 'low'
    forecast?: number
  }
}

/**
 * Financial insights and alerts
 */
export interface FinancialInsight {
  id: string
  type: 'critical' | 'warning' | 'positive' | 'info'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  category: 'cash_flow' | 'profitability' | 'growth' | 'efficiency' | 'risk'
  metrics_affected: KPIMetricType[]
  recommended_actions?: string[]
  auto_generated: boolean
  confidence_score?: number
}

/**
 * Dashboard summary structure
 */
export interface FinancialDashboard {
  organization_name: string
  currency: string
  provider: string
  last_sync: number
  period: {
    current: string
    comparison: string
  }
  kpis: KPIData[]
  insights: FinancialInsight[]
  charts: {
    revenue_trend: ChartData[]
    cash_flow_trend: ChartData[]
    expense_breakdown: ExpenseBreakdown[]
    customer_concentration: CustomerBreakdown[]
  }
  quick_actions: QuickAction[]
  performance_metrics: {
    calculation_method: string
    data_freshness: string
    cache_status: string
    processing_time_ms?: number
  }
}

export interface ChartData {
  period: string
  revenue: number
  expenses: number
  profit: number
  cash_flow?: number
}

export interface ExpenseBreakdown {
  category: string
  amount: number
  percentage: number
  trend?: TrendData
}

export interface CustomerBreakdown {
  source: string
  amount: number
  percentage: number
  risk_level?: 'high' | 'medium' | 'low'
}

export interface QuickAction {
  id: string
  title: string
  description: string
  action_type: 'navigate' | 'export' | 'create' | 'update'
  url?: string
  icon?: string
  requires_permission?: string[]
}

/**
 * Export format options
 */
export interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv'
  include_charts: boolean
  include_details: boolean
  custom_date_range?: {
    start_date: string
    end_date: string
  }
  sections_to_include?: string[]
  branding?: {
    logo_url?: string
    company_colors?: string[]
  }
}

/**
 * Report generation request
 */
export interface ReportRequest {
  report_type: EnhancedFinancialReport['report_type']
  period: {
    start_date?: string
    end_date?: string
    as_of_date?: string
    period_preset?: 'this_month' | 'last_month' | 'this_quarter' | 'this_year'
  }
  comparison_period?: {
    start_date?: string
    end_date?: string
  }
  include_details: boolean
  format: 'json' | 'pdf' | 'excel'
  filters?: {
    accounts?: string[]
    departments?: string[]
    projects?: string[]
    minimum_amount?: number
  }
  grouping?: {
    group_by: 'account' | 'department' | 'project' | 'month'
    sort_order: 'asc' | 'desc'
    sort_by: 'name' | 'amount' | 'percentage'
  }
}

/**
 * Cache configuration for reports
 */
export interface ReportCacheConfig {
  ttl_seconds: number
  max_entries: number
  cache_key_strategy: 'org_period' | 'user_period' | 'custom'
  invalidation_triggers: ('data_sync' | 'manual_entry' | 'time_based')[]
  compression_enabled: boolean
}

/**
 * Provider-specific report capabilities
 */
export interface ProviderCapabilities {
  provider_id: string
  supported_reports: EnhancedFinancialReport['report_type'][]
  supported_export_formats: ('pdf' | 'excel' | 'csv')[]
  real_time_data: boolean
  historical_data_years: number
  custom_fields_supported: boolean
  advanced_filtering: boolean
  multi_currency: boolean
  consolidation_supported: boolean
  api_rate_limits: {
    requests_per_minute: number
    requests_per_hour: number
  }
}