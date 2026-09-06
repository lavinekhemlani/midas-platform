// src/ai/tools/business-central-data/metrics-registry.ts
// Comprehensive registry of 33 financial KPIs for Business Central data

// =============================================================================
// Types
// =============================================================================

export type MetricCategory =
  | 'profitability'
  | 'liquidity'
  | 'efficiency'
  | 'cash_flow'
  | 'leverage'
  | 'growth'

export type MetricFormat = 'percent' | 'currency' | 'ratio' | 'days' | 'number'

export interface MetricDefinition {
  id: string
  name: string
  shortName: string
  category: MetricCategory
  description: string
  dataSources: string[] // BC-specific sources (g_l_entry, g_l_account, customer, vendor, etc.)
  format: MetricFormat
  formula: string // Human-readable calculation
  interpretation: {
    good: string
    bad: string
    benchmark?: string
  }
  priority: 'critical' | 'high' | 'medium' | 'low'
}

// =============================================================================
// Metrics Registry (33 KPIs)
// =============================================================================

export const BC_METRICS_REGISTRY: MetricDefinition[] = [
  // ============================================================================
  // PROFITABILITY METRICS (8)
  // ============================================================================
  {
    id: 'gross_margin',
    name: 'Gross Profit Margin',
    shortName: 'Gross Margin',
    category: 'profitability',
    description: 'Percentage of revenue remaining after direct costs (COGS)',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: '(Revenue - COGS) / Revenue × 100',
    interpretation: {
      good: 'Above 40% indicates healthy pricing and cost control',
      bad: 'Below 20% suggests pricing or cost issues',
      benchmark: '40-60% for most industries',
    },
    priority: 'critical',
  },
  {
    id: 'net_margin',
    name: 'Net Profit Margin',
    shortName: 'Net Margin',
    category: 'profitability',
    description: 'Percentage of revenue remaining as profit after all expenses',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: 'Net Income / Revenue × 100',
    interpretation: {
      good: 'Above 10% indicates strong profitability',
      bad: 'Below 5% suggests thin margins',
      benchmark: '10-20% for healthy businesses',
    },
    priority: 'critical',
  },
  {
    id: 'operating_margin',
    name: 'Operating Profit Margin',
    shortName: 'Operating Margin',
    category: 'profitability',
    description: 'Profit margin from core operations before interest and taxes',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: 'Operating Income / Revenue × 100',
    interpretation: {
      good: 'Above 15% indicates efficient operations',
      bad: 'Below 5% suggests operational inefficiency',
      benchmark: '15-25% for well-run companies',
    },
    priority: 'high',
  },
  {
    id: 'ebitda_margin',
    name: 'EBITDA Margin',
    shortName: 'EBITDA Margin',
    category: 'profitability',
    description: 'Earnings before interest, taxes, depreciation, and amortization as % of revenue',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: 'EBITDA / Revenue × 100',
    interpretation: {
      good: 'Above 20% indicates strong cash generation',
      bad: 'Below 10% suggests limited cash generation',
      benchmark: '20-30% for established companies',
    },
    priority: 'high',
  },
  {
    id: 'roa',
    name: 'Return on Assets',
    shortName: 'ROA',
    category: 'profitability',
    description: 'How efficiently assets generate profit',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: 'Net Income / Total Assets × 100',
    interpretation: {
      good: 'Above 5% indicates efficient asset utilization',
      bad: 'Below 2% suggests poor asset efficiency',
      benchmark: '5-10% for most industries',
    },
    priority: 'medium',
  },
  {
    id: 'roe',
    name: 'Return on Equity',
    shortName: 'ROE',
    category: 'profitability',
    description: 'Return generated on shareholder equity',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: 'Net Income / Total Equity × 100',
    interpretation: {
      good: 'Above 15% indicates strong returns for investors',
      bad: 'Below 10% suggests underperformance',
      benchmark: '15-20% for healthy companies',
    },
    priority: 'high',
  },
  {
    id: 'gross_profit',
    name: 'Gross Profit',
    shortName: 'Gross Profit',
    category: 'profitability',
    description: 'Revenue minus cost of goods sold',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'currency',
    formula: 'Revenue - COGS',
    interpretation: {
      good: 'Consistently growing gross profit',
      bad: 'Declining or volatile gross profit',
      benchmark: 'Varies by industry',
    },
    priority: 'high',
  },
  {
    id: 'operating_income',
    name: 'Operating Income',
    shortName: 'Operating Income',
    category: 'profitability',
    description: 'Profit from core business operations',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'currency',
    formula: 'Gross Profit - Operating Expenses',
    interpretation: {
      good: 'Positive and growing operating income',
      bad: 'Negative or declining operating income',
      benchmark: 'Positive for sustainable businesses',
    },
    priority: 'critical',
  },

  // ============================================================================
  // LIQUIDITY METRICS (6)
  // ============================================================================
  {
    id: 'current_ratio',
    name: 'Current Ratio',
    shortName: 'Current Ratio',
    category: 'liquidity',
    description: 'Ability to pay short-term obligations with current assets',
    dataSources: ['g_l_account'],
    format: 'ratio',
    formula: 'Current Assets / Current Liabilities',
    interpretation: {
      good: 'Above 1.5 indicates strong liquidity',
      bad: 'Below 1.0 suggests liquidity concerns',
      benchmark: '1.5-3.0 for healthy companies',
    },
    priority: 'critical',
  },
  {
    id: 'quick_ratio',
    name: 'Quick Ratio',
    shortName: 'Quick Ratio',
    category: 'liquidity',
    description: 'Ability to pay short-term obligations with liquid assets (excludes inventory)',
    dataSources: ['g_l_account', 'item'],
    format: 'ratio',
    formula: '(Current Assets - Inventory) / Current Liabilities',
    interpretation: {
      good: 'Above 1.0 indicates strong immediate liquidity',
      bad: 'Below 0.5 suggests immediate liquidity risk',
      benchmark: '1.0-1.5 for healthy companies',
    },
    priority: 'high',
  },
  {
    id: 'cash_ratio',
    name: 'Cash Ratio',
    shortName: 'Cash Ratio',
    category: 'liquidity',
    description: 'Most conservative liquidity measure using only cash and equivalents',
    dataSources: ['bank_account'],
    format: 'ratio',
    formula: '(Cash + Cash Equivalents) / Current Liabilities',
    interpretation: {
      good: 'Above 0.5 indicates strong cash position',
      bad: 'Below 0.2 suggests cash flow concerns',
      benchmark: '0.5-1.0 for well-capitalized companies',
    },
    priority: 'medium',
  },
  {
    id: 'working_capital',
    name: 'Working Capital',
    shortName: 'Working Capital',
    category: 'liquidity',
    description: 'Net liquid assets available for operations',
    dataSources: ['g_l_account'],
    format: 'currency',
    formula: 'Current Assets - Current Liabilities',
    interpretation: {
      good: 'Positive and growing working capital',
      bad: 'Negative or declining working capital',
      benchmark: 'Positive for operational flexibility',
    },
    priority: 'critical',
  },
  {
    id: 'cash_balance',
    name: 'Cash Balance',
    shortName: 'Cash',
    category: 'liquidity',
    description: 'Total cash and cash equivalents on hand',
    dataSources: ['bank_account'],
    format: 'currency',
    formula: 'Sum of bank account balances',
    interpretation: {
      good: 'Sufficient to cover 3-6 months of expenses',
      bad: 'Less than 1 month of expenses',
      benchmark: '3-6 months operating expenses',
    },
    priority: 'critical',
  },
  {
    id: 'debt_to_equity',
    name: 'Debt to Equity Ratio',
    shortName: 'D/E Ratio',
    category: 'liquidity',
    description: 'Proportion of debt to shareholder equity',
    dataSources: ['g_l_account'],
    format: 'ratio',
    formula: 'Total Liabilities / Total Equity',
    interpretation: {
      good: 'Below 1.0 indicates conservative leverage',
      bad: 'Above 2.0 suggests high financial risk',
      benchmark: '0.5-1.5 for most industries',
    },
    priority: 'high',
  },

  // ============================================================================
  // EFFICIENCY METRICS (7)
  // ============================================================================
  {
    id: 'dso',
    name: 'Days Sales Outstanding',
    shortName: 'DSO',
    category: 'efficiency',
    description: 'Average days to collect payment from customers',
    dataSources: ['customer', 'g_l_entry'],
    format: 'days',
    formula: '(Accounts Receivable / Revenue) × 365',
    interpretation: {
      good: 'Below 30 days indicates efficient collections',
      bad: 'Above 60 days suggests collection issues',
      benchmark: '30-45 days for most businesses',
    },
    priority: 'high',
  },
  {
    id: 'dpo',
    name: 'Days Payable Outstanding',
    shortName: 'DPO',
    category: 'efficiency',
    description: 'Average days to pay supplier invoices',
    dataSources: ['vendor', 'g_l_entry'],
    format: 'days',
    formula: '(Accounts Payable / COGS) × 365',
    interpretation: {
      good: '30-60 days maintains supplier relationships',
      bad: 'Too low (immediate payment) or too high (strained relationships)',
      benchmark: '30-60 days for healthy cash flow',
    },
    priority: 'high',
  },
  {
    id: 'inventory_turnover',
    name: 'Inventory Turnover',
    shortName: 'Inventory Turnover',
    category: 'efficiency',
    description: 'How many times inventory is sold and replaced in a period',
    dataSources: ['item', 'g_l_entry'],
    format: 'ratio',
    formula: 'COGS / Average Inventory',
    interpretation: {
      good: 'Above 4 indicates efficient inventory management',
      bad: 'Below 2 suggests excess or slow-moving inventory',
      benchmark: '4-8 for most industries',
    },
    priority: 'medium',
  },
  {
    id: 'asset_turnover',
    name: 'Asset Turnover',
    shortName: 'Asset Turnover',
    category: 'efficiency',
    description: 'How efficiently assets generate revenue',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'ratio',
    formula: 'Revenue / Total Assets',
    interpretation: {
      good: 'Above 1.0 indicates efficient asset utilization',
      bad: 'Below 0.5 suggests underutilized assets',
      benchmark: '1.0-2.0 for most industries',
    },
    priority: 'medium',
  },
  {
    id: 'receivables_turnover',
    name: 'Receivables Turnover',
    shortName: 'AR Turnover',
    category: 'efficiency',
    description: 'How many times receivables are collected in a period',
    dataSources: ['customer', 'g_l_entry'],
    format: 'ratio',
    formula: 'Revenue / Average Accounts Receivable',
    interpretation: {
      good: 'Above 8 indicates efficient collections',
      bad: 'Below 4 suggests slow collections',
      benchmark: '6-12 for most businesses',
    },
    priority: 'medium',
  },
  {
    id: 'payables_turnover',
    name: 'Payables Turnover',
    shortName: 'AP Turnover',
    category: 'efficiency',
    description: 'How many times payables are paid in a period',
    dataSources: ['vendor', 'g_l_entry'],
    format: 'ratio',
    formula: 'COGS / Average Accounts Payable',
    interpretation: {
      good: '6-12 times per year maintains balance',
      bad: 'Too high (cash flow pressure) or too low (strained relationships)',
      benchmark: '6-12 for healthy operations',
    },
    priority: 'medium',
  },
  {
    id: 'cash_conversion_cycle',
    name: 'Cash Conversion Cycle',
    shortName: 'CCC',
    category: 'efficiency',
    description: 'Days between paying suppliers and collecting from customers',
    dataSources: ['customer', 'vendor', 'item', 'g_l_entry'],
    format: 'days',
    formula: 'DSO + DIO - DPO (where DIO = Days Inventory Outstanding)',
    interpretation: {
      good: 'Lower is better, indicates faster cash conversion',
      bad: 'Above 90 days suggests cash flow challenges',
      benchmark: '30-60 days for efficient operations',
    },
    priority: 'high',
  },

  // ============================================================================
  // CASH FLOW METRICS (5)
  // ============================================================================
  {
    id: 'operating_cash_flow',
    name: 'Operating Cash Flow',
    shortName: 'Op Cash Flow',
    category: 'cash_flow',
    description: 'Cash generated from core business operations',
    dataSources: ['g_l_entry', 'bank_account'],
    format: 'currency',
    formula: 'Net Income + Depreciation + Changes in Working Capital',
    interpretation: {
      good: 'Positive and growing operating cash flow',
      bad: 'Negative operating cash flow',
      benchmark: 'Positive for sustainable operations',
    },
    priority: 'critical',
  },
  {
    id: 'free_cash_flow',
    name: 'Free Cash Flow',
    shortName: 'FCF',
    category: 'cash_flow',
    description: 'Cash available after capital expenditures',
    dataSources: ['g_l_entry', 'bank_account'],
    format: 'currency',
    formula: 'Operating Cash Flow - Capital Expenditures',
    interpretation: {
      good: 'Positive FCF indicates financial flexibility',
      bad: 'Negative FCF suggests capital constraints',
      benchmark: 'Positive for growth and dividends',
    },
    priority: 'critical',
  },
  {
    id: 'burn_rate',
    name: 'Cash Burn Rate',
    shortName: 'Burn Rate',
    category: 'cash_flow',
    description: 'Monthly cash consumption rate',
    dataSources: ['g_l_entry', 'bank_account'],
    format: 'currency',
    formula: 'Total Expenses / Months in Period',
    interpretation: {
      good: 'Decreasing burn rate or positive cash flow',
      bad: 'Increasing burn rate without revenue growth',
      benchmark: 'Manageable within runway',
    },
    priority: 'critical',
  },
  {
    id: 'runway_months',
    name: 'Cash Runway',
    shortName: 'Runway',
    category: 'cash_flow',
    description: 'Months until cash runs out at current burn rate',
    dataSources: ['g_l_entry', 'bank_account'],
    format: 'number',
    formula: 'Cash Balance / Monthly Burn Rate',
    interpretation: {
      good: 'Above 12 months provides security',
      bad: 'Below 6 months requires immediate action',
      benchmark: '12-18 months for healthy startups',
    },
    priority: 'critical',
  },
  {
    id: 'cash_flow_margin',
    name: 'Cash Flow Margin',
    shortName: 'CF Margin',
    category: 'cash_flow',
    description: 'Operating cash flow as percentage of revenue',
    dataSources: ['g_l_entry', 'bank_account'],
    format: 'percent',
    formula: 'Operating Cash Flow / Revenue × 100',
    interpretation: {
      good: 'Above 15% indicates strong cash generation',
      bad: 'Below 5% suggests weak cash conversion',
      benchmark: '15-25% for healthy companies',
    },
    priority: 'high',
  },

  // ============================================================================
  // LEVERAGE METRICS (3)
  // ============================================================================
  {
    id: 'debt_ratio',
    name: 'Debt Ratio',
    shortName: 'Debt Ratio',
    category: 'leverage',
    description: 'Proportion of assets financed by debt',
    dataSources: ['g_l_account'],
    format: 'percent',
    formula: 'Total Liabilities / Total Assets × 100',
    interpretation: {
      good: 'Below 40% indicates conservative leverage',
      bad: 'Above 60% suggests high financial risk',
      benchmark: '30-50% for most industries',
    },
    priority: 'medium',
  },
  {
    id: 'interest_coverage',
    name: 'Interest Coverage Ratio',
    shortName: 'Interest Coverage',
    category: 'leverage',
    description: 'Ability to pay interest expenses from operating income',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'ratio',
    formula: 'Operating Income / Interest Expense',
    interpretation: {
      good: 'Above 3.0 indicates comfortable debt service',
      bad: 'Below 1.5 suggests debt service challenges',
      benchmark: '2.5-4.0 for healthy companies',
    },
    priority: 'high',
  },
  {
    id: 'equity_ratio',
    name: 'Equity Ratio',
    shortName: 'Equity Ratio',
    category: 'leverage',
    description: 'Proportion of assets financed by equity',
    dataSources: ['g_l_account'],
    format: 'percent',
    formula: 'Total Equity / Total Assets × 100',
    interpretation: {
      good: 'Above 50% indicates strong equity position',
      bad: 'Below 30% suggests high leverage risk',
      benchmark: '40-60% for most industries',
    },
    priority: 'medium',
  },

  // ============================================================================
  // GROWTH METRICS (4)
  // ============================================================================
  {
    id: 'revenue_growth',
    name: 'Revenue Growth Rate',
    shortName: 'Revenue Growth',
    category: 'growth',
    description: 'Period-over-period revenue growth',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: '((Current Revenue - Previous Revenue) / Previous Revenue) × 100',
    interpretation: {
      good: 'Above 20% indicates strong growth',
      bad: 'Negative growth suggests declining business',
      benchmark: '15-30% for growth companies',
    },
    priority: 'high',
  },
  {
    id: 'profit_growth',
    name: 'Profit Growth Rate',
    shortName: 'Profit Growth',
    category: 'growth',
    description: 'Period-over-period profit growth',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: '((Current Profit - Previous Profit) / Previous Profit) × 100',
    interpretation: {
      good: 'Above revenue growth indicates scaling efficiency',
      bad: 'Below revenue growth suggests margin compression',
      benchmark: 'At or above revenue growth rate',
    },
    priority: 'high',
  },
  {
    id: 'customer_growth',
    name: 'Customer Growth Rate',
    shortName: 'Customer Growth',
    category: 'growth',
    description: 'Period-over-period customer count growth',
    dataSources: ['customer'],
    format: 'percent',
    formula: '((Current Customers - Previous Customers) / Previous Customers) × 100',
    interpretation: {
      good: 'Positive growth indicates market expansion',
      bad: 'Negative growth suggests customer churn issues',
      benchmark: '10-25% for growth companies',
    },
    priority: 'medium',
  },
  {
    id: 'expense_growth',
    name: 'Expense Growth Rate',
    shortName: 'Expense Growth',
    category: 'growth',
    description: 'Period-over-period expense growth',
    dataSources: ['g_l_entry', 'g_l_account'],
    format: 'percent',
    formula: '((Current Expenses - Previous Expenses) / Previous Expenses) × 100',
    interpretation: {
      good: 'Below revenue growth indicates improving efficiency',
      bad: 'Above revenue growth suggests margin pressure',
      benchmark: 'Below revenue growth rate',
    },
    priority: 'medium',
  },
]

// =============================================================================
// Metric Dependencies (which BC data sources are needed)
// =============================================================================

export const BC_METRIC_DEPENDENCIES: Record<string, string[]> = {
  // Profitability
  gross_margin: ['g_l_entry', 'g_l_account'],
  net_margin: ['g_l_entry', 'g_l_account'],
  operating_margin: ['g_l_entry', 'g_l_account'],
  ebitda_margin: ['g_l_entry', 'g_l_account'],
  roa: ['g_l_entry', 'g_l_account'],
  roe: ['g_l_entry', 'g_l_account'],
  gross_profit: ['g_l_entry', 'g_l_account'],
  operating_income: ['g_l_entry', 'g_l_account'],

  // Liquidity
  current_ratio: ['g_l_account'],
  quick_ratio: ['g_l_account', 'item'],
  cash_ratio: ['bank_account'],
  working_capital: ['g_l_account'],
  cash_balance: ['bank_account'],
  debt_to_equity: ['g_l_account'],

  // Efficiency
  dso: ['customer', 'g_l_entry'],
  dpo: ['vendor', 'g_l_entry'],
  inventory_turnover: ['item', 'g_l_entry'],
  asset_turnover: ['g_l_entry', 'g_l_account'],
  receivables_turnover: ['customer', 'g_l_entry'],
  payables_turnover: ['vendor', 'g_l_entry'],
  cash_conversion_cycle: ['customer', 'vendor', 'item', 'g_l_entry'],

  // Cash Flow
  operating_cash_flow: ['g_l_entry', 'bank_account'],
  free_cash_flow: ['g_l_entry', 'bank_account'],
  burn_rate: ['g_l_entry', 'bank_account'],
  runway_months: ['g_l_entry', 'bank_account'],
  cash_flow_margin: ['g_l_entry', 'bank_account'],

  // Leverage
  debt_ratio: ['g_l_account'],
  interest_coverage: ['g_l_entry', 'g_l_account'],
  equity_ratio: ['g_l_account'],

  // Growth
  revenue_growth: ['g_l_entry', 'g_l_account'],
  profit_growth: ['g_l_entry', 'g_l_account'],
  customer_growth: ['customer'],
  expense_growth: ['g_l_entry', 'g_l_account'],
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get metrics by category
 */
export function getBCMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return BC_METRICS_REGISTRY.filter((m) => m.category === category)
}

/**
 * Get metric by ID
 */
export function getBCMetricById(metricId: string): MetricDefinition | undefined {
  return BC_METRICS_REGISTRY.find((m) => m.id === metricId)
}

/**
 * Get critical metrics (most important KPIs)
 */
export function getBCCriticalMetrics(): MetricDefinition[] {
  return BC_METRICS_REGISTRY.filter((m) => m.priority === 'critical')
}

/**
 * Get data sources needed for a set of metrics
 */
export function getBCRequiredDataSources(metricIds: string[]): string[] {
  const sources = new Set<string>()

  metricIds.forEach((id) => {
    const deps = BC_METRIC_DEPENDENCIES[id] || []
    deps.forEach((dep) => sources.add(dep))
  })

  return Array.from(sources)
}

/**
 * Get all metrics that can be calculated from available data sources
 */
export function getBCCalculableMetrics(availableDataSources: string[]): MetricDefinition[] {
  const availableSet = new Set(availableDataSources)

  return BC_METRICS_REGISTRY.filter((metric) => {
    const required = BC_METRIC_DEPENDENCIES[metric.id] || []
    return required.every((dep) => availableSet.has(dep))
  })
}

/**
 * Resolve a free-form metric name to a registry entry.
 * Matches against id, name, and shortName (case-insensitive).
 * Falls back to substring matching if no exact match found.
 *
 * Returns { metric, matchType } or null if no match.
 */
export function resolveMetricName(
  input: string
): { metric: MetricDefinition; matchType: 'exact_id' | 'exact_name' | 'fuzzy' } | null {
  if (!input) return null

  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_')

  // 1. Exact match on id (most common — LLM usually sends the id)
  const byId = BC_METRICS_REGISTRY.find((m) => m.id === normalized)
  if (byId) return { metric: byId, matchType: 'exact_id' }

  // 2. Exact match on name or shortName (case-insensitive)
  const lowerInput = input.toLowerCase().trim()
  const byName = BC_METRICS_REGISTRY.find(
    (m) => m.name.toLowerCase() === lowerInput || m.shortName.toLowerCase() === lowerInput
  )
  if (byName) return { metric: byName, matchType: 'exact_name' }

  // 3. Fuzzy: check if input contains or is contained by id/name/shortName
  const byFuzzy = BC_METRICS_REGISTRY.find(
    (m) =>
      m.id.includes(normalized) ||
      normalized.includes(m.id) ||
      m.name.toLowerCase().includes(lowerInput) ||
      lowerInput.includes(m.name.toLowerCase()) ||
      m.shortName.toLowerCase().includes(lowerInput) ||
      lowerInput.includes(m.shortName.toLowerCase())
  )
  if (byFuzzy) return { metric: byFuzzy, matchType: 'fuzzy' }

  return null
}

/**
 * Format metric value based on format type
 */
export function formatBCMetricValue(
  value: number,
  format: MetricFormat,
  currencyCode?: string
): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'ratio':
      return value.toFixed(2)
    case 'days':
      return `${Math.round(value)} days`
    case 'number':
      return value.toLocaleString()
    default:
      return value.toString()
  }
}

/**
 * Interpret metric value (good, neutral, bad)
 */
export function interpretBCMetricValue(
  metricId: string,
  value: number
): 'good' | 'neutral' | 'bad' {
  const thresholds = getBCMetricThresholds(metricId)

  if (value >= thresholds.good) return 'good'
  if (value <= thresholds.bad) return 'bad'
  return 'neutral'
}

/**
 * Get metric thresholds for interpretation
 */
function getBCMetricThresholds(metricId: string): { good: number; bad: number } {
  const thresholds: Record<string, { good: number; bad: number }> = {
    // Profitability (higher is better)
    gross_margin: { good: 40, bad: 20 },
    net_margin: { good: 10, bad: 5 },
    operating_margin: { good: 15, bad: 5 },
    ebitda_margin: { good: 20, bad: 10 },
    roa: { good: 5, bad: 2 },
    roe: { good: 15, bad: 10 },

    // Liquidity (higher is better within range)
    current_ratio: { good: 1.5, bad: 1.0 },
    quick_ratio: { good: 1.0, bad: 0.5 },
    cash_ratio: { good: 0.5, bad: 0.2 },

    // Efficiency (varies by metric)
    dso: { good: 30, bad: 60 },
    dpo: { good: 45, bad: 15 },
    inventory_turnover: { good: 4, bad: 2 },
    asset_turnover: { good: 1.0, bad: 0.5 },

    // Cash Flow (higher is better)
    cash_flow_margin: { good: 15, bad: 5 },
    runway_months: { good: 12, bad: 6 },

    // Leverage (lower is better)
    debt_ratio: { good: 40, bad: 60 },
    debt_to_equity: { good: 1.0, bad: 2.0 },
    interest_coverage: { good: 3.0, bad: 1.5 },

    // Growth (higher is better)
    revenue_growth: { good: 20, bad: 0 },
    profit_growth: { good: 20, bad: 0 },
  }

  return thresholds[metricId] || { good: 100, bad: 0 }
}
