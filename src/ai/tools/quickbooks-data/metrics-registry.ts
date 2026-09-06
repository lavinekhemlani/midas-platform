// src/ai/tools/quickbooks-data/metrics-registry.ts
// Comprehensive registry of 33+ financial KPIs and metrics

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
  | 'operational'

export type MetricFormat = 'percent' | 'currency' | 'ratio' | 'days' | 'number' | 'score'

export interface MetricDefinition {
  id: string
  name: string
  shortName: string
  category: MetricCategory
  description: string
  dataSources: string[] // Which reports/entities are needed
  format: MetricFormat
  formula: string // Human-readable formula
  interpretation: {
    good: string // What indicates good performance
    bad: string // What indicates poor performance
    benchmark?: string // Industry benchmark if available
  }
  priority: 'critical' | 'high' | 'medium' | 'low'
}

// =============================================================================
// Metrics Registry (33+ KPIs)
// =============================================================================

export const METRICS_REGISTRY: MetricDefinition[] = [
  // ============================================================================
  // PROFITABILITY METRICS (8)
  // ============================================================================
  {
    id: 'gross_margin',
    name: 'Gross Profit Margin',
    shortName: 'Gross Margin',
    category: 'profitability',
    description: 'Percentage of revenue remaining after direct costs (COGS)',
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss', 'balance_sheet'],
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
    dataSources: ['profit_loss', 'balance_sheet'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['cash_flow'],
    format: 'currency',
    formula: 'Ending Cash from Cash Flow Statement',
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['invoices', 'profit_loss'],
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
    dataSources: ['bills', 'profit_loss'],
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
    dataSources: ['balance_sheet', 'profit_loss'],
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
    dataSources: ['profit_loss', 'balance_sheet'],
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
    dataSources: ['invoices', 'profit_loss'],
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
    dataSources: ['bills', 'profit_loss'],
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
    dataSources: ['invoices', 'bills', 'balance_sheet', 'profit_loss'],
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
    dataSources: ['cash_flow'],
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
    dataSources: ['cash_flow'],
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
    dataSources: ['cash_flow', 'balance_sheet'],
    format: 'currency',
    formula: 'Monthly change in cash balance (when negative)',
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
    dataSources: ['cash_flow', 'balance_sheet'],
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
    dataSources: ['cash_flow', 'profit_loss'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['balance_sheet'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['profit_loss'],
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
    dataSources: ['customers'],
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
    dataSources: ['profit_loss'],
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
// Metric Dependencies (which reports are needed for each metric)
// =============================================================================

export const METRIC_DEPENDENCIES: Record<string, string[]> = {
  // Profitability
  gross_margin: ['profit_loss'],
  net_margin: ['profit_loss'],
  operating_margin: ['profit_loss'],
  ebitda_margin: ['profit_loss'],
  roa: ['profit_loss', 'balance_sheet'],
  roe: ['profit_loss', 'balance_sheet'],
  gross_profit: ['profit_loss'],
  operating_income: ['profit_loss'],

  // Liquidity
  current_ratio: ['balance_sheet'],
  quick_ratio: ['balance_sheet'],
  cash_ratio: ['balance_sheet'],
  working_capital: ['balance_sheet'],
  cash_balance: ['cash_flow'],
  debt_to_equity: ['balance_sheet'],

  // Efficiency
  dso: ['invoices', 'profit_loss', 'balance_sheet'],
  dpo: ['bills', 'profit_loss', 'balance_sheet'],
  inventory_turnover: ['balance_sheet', 'profit_loss'],
  asset_turnover: ['profit_loss', 'balance_sheet'],
  receivables_turnover: ['invoices', 'profit_loss', 'balance_sheet'],
  payables_turnover: ['bills', 'profit_loss', 'balance_sheet'],
  cash_conversion_cycle: ['invoices', 'bills', 'balance_sheet', 'profit_loss'],

  // Cash Flow
  operating_cash_flow: ['cash_flow'],
  free_cash_flow: ['cash_flow'],
  burn_rate: ['cash_flow', 'balance_sheet'],
  runway_months: ['cash_flow', 'balance_sheet'],
  cash_flow_margin: ['cash_flow', 'profit_loss'],

  // Leverage
  debt_ratio: ['balance_sheet'],
  interest_coverage: ['profit_loss'],
  equity_ratio: ['balance_sheet'],

  // Growth
  revenue_growth: ['profit_loss'],
  profit_growth: ['profit_loss'],
  customer_growth: ['customers'],
  expense_growth: ['profit_loss'],
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get metrics by category
 */
export function getMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return METRICS_REGISTRY.filter((m) => m.category === category)
}

/**
 * Get metric by ID
 */
export function getMetricById(metricId: string): MetricDefinition | undefined {
  return METRICS_REGISTRY.find((m) => m.id === metricId)
}

/**
 * Get critical metrics (most important KPIs)
 */
export function getCriticalMetrics(): MetricDefinition[] {
  return METRICS_REGISTRY.filter((m) => m.priority === 'critical')
}

/**
 * Get data sources needed for a set of metrics
 */
export function getRequiredDataSources(metricIds: string[]): string[] {
  const sources = new Set<string>()

  metricIds.forEach((id) => {
    const deps = METRIC_DEPENDENCIES[id] || []
    deps.forEach((dep) => sources.add(dep))
  })

  return Array.from(sources)
}

/**
 * Get all metrics that can be calculated from available data sources
 */
export function getCalculableMetrics(availableDataSources: string[]): MetricDefinition[] {
  const availableSet = new Set(availableDataSources)

  return METRICS_REGISTRY.filter((metric) => {
    const required = METRIC_DEPENDENCIES[metric.id] || []
    return required.every((dep) => availableSet.has(dep))
  })
}

/**
 * Group metrics by category for display
 */
export function groupMetricsByCategory(): Record<MetricCategory, MetricDefinition[]> {
  const grouped: Record<string, MetricDefinition[]> = {
    profitability: [],
    liquidity: [],
    efficiency: [],
    cash_flow: [],
    leverage: [],
    growth: [],
    operational: [],
  }

  METRICS_REGISTRY.forEach((metric) => {
    grouped[metric.category].push(metric)
  })

  return grouped as Record<MetricCategory, MetricDefinition[]>
}

/**
 * Get metric recommendations based on business context
 */
export function getRecommendedMetrics(context: {
  hasDebt?: boolean
  hasInventory?: boolean
  isStartup?: boolean
  isGrowthStage?: boolean
}): MetricDefinition[] {
  const recommended: MetricDefinition[] = []

  // Always include critical metrics
  recommended.push(...getCriticalMetrics())

  // Add context-specific metrics
  if (context.hasDebt) {
    recommended.push(...METRICS_REGISTRY.filter((m) => m.category === 'leverage'))
  }

  if (context.hasInventory) {
    const inventoryMetrics = METRICS_REGISTRY.filter(
      (m) => m.id === 'inventory_turnover' || m.id === 'cash_conversion_cycle'
    )
    recommended.push(...inventoryMetrics)
  }

  if (context.isStartup || context.isGrowthStage) {
    recommended.push(
      ...METRICS_REGISTRY.filter((m) => m.category === 'cash_flow' || m.category === 'growth')
    )
  }

  // Remove duplicates
  return Array.from(new Set(recommended))
}

/**
 * Format metric value based on format type
 */
export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'ratio':
      return value.toFixed(2)
    case 'days':
      return `${Math.round(value)} days`
    case 'number':
      return value.toLocaleString()
    case 'score':
      return `${Math.round(value)}/100`
    default:
      return value.toString()
  }
}

/**
 * Interpret metric value (good, neutral, bad)
 */
export function interpretMetricValue(metricId: string, value: number): 'good' | 'neutral' | 'bad' {
  const metric = getMetricById(metricId)
  if (!metric) return 'neutral'

  // Define thresholds based on metric type and benchmarks
  const thresholds = getMetricThresholds(metricId)

  if (value >= thresholds.good) return 'good'
  if (value <= thresholds.bad) return 'bad'
  return 'neutral'
}

/**
 * Get metric thresholds for interpretation
 */
function getMetricThresholds(metricId: string): { good: number; bad: number } {
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
    dso: { good: 30, bad: 60 }, // Lower is better
    dpo: { good: 45, bad: 15 }, // Moderate is better
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
