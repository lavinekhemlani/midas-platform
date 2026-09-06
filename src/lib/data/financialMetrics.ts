// src/lib/data/financialMetrics.ts

import { getDefaultThresholds } from '@/lib/utils/metricThresholds'

export interface FinancialMetric {
  id: string
  name: string
  description: string
  unit: string
  category: 'efficiency' | 'profitability' | 'liquidity' | 'leverage'
  formula?: string
}

export interface MetricVariant {
  baseMetricId: string
  revenueModel: string
  name: string
  description: string
  formula: string
  benchmarks: {
    excellent: number
    good: number
    fair: number
    poor: number
  }
  defaultTarget: number
  targetRange: {
    min: number
    max: number
    step: number
  }
  unit: string
}

export const FINANCIAL_METRICS: FinancialMetric[] = [
  // Liquidity Metrics
  {
    id: 'cash_runway',
    name: 'Cash Runway',
    description: 'Months of operating capital remaining',
    unit: 'months',
    category: 'liquidity',
    formula: 'Cash Balance / Monthly Burn Rate',
  },
  {
    id: 'cash_balance',
    name: 'Cash Balance',
    description: 'Total cash and cash equivalents',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Cash + Short-term Investments',
  },
  {
    id: 'cash_flow',
    name: 'Operating Cash Flow',
    description: 'Cash generated from operations',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Net Income + Depreciation - Changes in Working Capital',
  },
  {
    id: 'working_capital',
    name: 'Working Capital',
    description: 'Short-term financial health indicator',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Current Assets - Current Liabilities',
  },
  {
    id: 'free_cash_flow',
    name: 'Free Cash Flow',
    description: 'Cash available after capital expenditures',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Operating Cash Flow - Capital Expenditures',
  },

  // Profitability Metrics
  {
    id: 'gross_margin',
    name: 'Gross Margin',
    description: 'Gross profit as percentage of revenue',
    unit: '%',
    category: 'profitability',
    formula: '(Revenue - COGS) / Revenue * 100',
  },
  {
    id: 'net_profit_margin',
    name: 'Net Profit Margin',
    description: 'Net income as percentage of revenue',
    unit: '%',
    category: 'profitability',
    formula: '(Net Income / Revenue) * 100',
  },
  {
    id: 'operating_margin',
    name: 'Operating Margin',
    description: 'Operating income as percentage of revenue',
    unit: '%',
    category: 'profitability',
    formula: '(Operating Income / Revenue) * 100',
  },

  // Efficiency Metrics
  {
    id: 'working_capital_ratio',
    name: 'Current Ratio',
    description: 'Ability to meet short-term obligations',
    unit: 'ratio',
    category: 'efficiency',
    formula: 'Current Assets / Current Liabilities',
  },
  {
    id: 'quick_ratio',
    name: 'Quick Ratio',
    description: 'Ability to meet short-term obligations without inventory',
    unit: 'ratio',
    category: 'efficiency',
    formula: '(Current Assets - Inventory) / Current Liabilities',
  },
  {
    id: 'cash_conversion_cycle',
    name: 'Cash Conversion Cycle',
    description: 'Time to convert investments into cash',
    unit: 'days',
    category: 'efficiency',
    formula: 'Days Sales Outstanding + Days Inventory Outstanding - Days Payable Outstanding',
  },
  {
    id: 'asset_turnover',
    name: 'Asset Turnover',
    description: 'How efficiently assets generate revenue',
    unit: 'ratio',
    category: 'efficiency',
    formula: 'Revenue / Total Assets',
  },
  {
    id: 'inventory_turnover',
    name: 'Inventory Turnover',
    description: 'How efficiently inventory is converted to sales',
    unit: 'ratio',
    category: 'efficiency',
    formula: 'Cost of Goods Sold / Average Inventory',
  },
  {
    id: 'dso',
    name: 'Days Sales Outstanding',
    description: 'Average days to collect receivables',
    unit: 'days',
    category: 'efficiency',
    formula: '(Accounts Receivable / Revenue) * Days in Period',
  },
  {
    id: 'dpo',
    name: 'Days Payable Outstanding',
    description: 'Average days to pay suppliers',
    unit: 'days',
    category: 'efficiency',
    formula: '(Accounts Payable / COGS) * Days in Period',
  },

  // Leverage & Returns Metrics
  {
    id: 'debt_to_equity',
    name: 'Debt-to-Equity Ratio',
    description: 'Financial leverage indicator',
    unit: 'ratio',
    category: 'leverage',
    formula: 'Total Debt / Total Equity',
  },
  {
    id: 'debt_ratio',
    name: 'Debt Ratio',
    description: 'Percentage of assets financed by debt',
    unit: '%',
    category: 'leverage',
    formula: '(Total Debt / Total Assets) * 100',
  },
  {
    id: 'equity_multiplier',
    name: 'Equity Multiplier',
    description: 'Financial leverage measurement',
    unit: 'ratio',
    category: 'leverage',
    formula: 'Total Assets / Total Equity',
  },
  {
    id: 'roe',
    name: 'Return on Equity',
    description: 'Profitability relative to equity',
    unit: '%',
    category: 'profitability',
    formula: '(Net Income / Total Equity) * 100',
  },
  {
    id: 'roa',
    name: 'Return on Assets',
    description: 'Profitability relative to total assets',
    unit: '%',
    category: 'profitability',
    formula: '(Net Income / Total Assets) * 100',
  },

  // Additional Cash Flow Metrics
  {
    id: 'burn_rate',
    name: 'Gross Burn Rate',
    description: 'Monthly cash consumption rate',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Total Monthly Expenses',
  },
  {
    id: 'net_burn_rate',
    name: 'Net Burn Rate',
    description: 'Monthly net cash consumption',
    unit: 'currency',
    category: 'liquidity',
    formula: 'Monthly Expenses - Monthly Revenue',
  },
  {
    id: 'operating_cash_flow_ratio',
    name: 'Operating Cash Flow Ratio',
    description: 'Cash flow coverage of current liabilities',
    unit: 'ratio',
    category: 'liquidity',
    formula: 'Operating Cash Flow / Current Liabilities',
  },
  {
    id: 'cash_flow_coverage_ratio',
    name: 'Cash Flow Coverage Ratio',
    description: 'Cash flow coverage of total debt',
    unit: 'ratio',
    category: 'leverage',
    formula: 'Operating Cash Flow / Total Debt',
  },
  {
    id: 'operating_cash_flow_margin',
    name: 'Operating Cash Flow Margin',
    description: 'Operating cash flow as percentage of revenue',
    unit: '%',
    category: 'profitability',
    formula: '(Operating Cash Flow / Revenue) * 100',
  },
]

// Revenue model to recommended metrics mapping - ONLY uses available metrics
export const REVENUE_MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  SaaS: ['cash_runway', 'gross_margin', 'cash_flow', 'burn_rate'],
  Retail: ['inventory_turnover', 'cash_conversion_cycle', 'gross_margin', 'working_capital'],
  Services: ['cash_flow', 'operating_margin', 'cash_runway', 'working_capital'],
  Marketplace: ['gross_margin', 'asset_turnover', 'cash_flow', 'working_capital'],
  Subscription: ['cash_runway', 'gross_margin', 'burn_rate', 'cash_flow'],
  Hardware: [
    'gross_margin',
    'inventory_turnover',
    'working_capital_ratio',
    'cash_conversion_cycle',
  ],
  Freemium: ['cash_runway', 'gross_margin', 'burn_rate', 'operating_margin'],
  Advertising: ['gross_margin', 'operating_margin', 'cash_flow', 'roe'],
  Commission: ['gross_margin', 'operating_margin', 'cash_flow', 'asset_turnover'],
  Licensing: ['gross_margin', 'operating_margin', 'roe', 'cash_flow'],
  Other: ['gross_margin', 'cash_flow', 'working_capital', 'roe'],
}

// Helper function to get metric by ID
export const getMetricById = (id: string): FinancialMetric | undefined => {
  return FINANCIAL_METRICS.find((metric) => metric.id === id)
}

// Helper function to get recommendations for revenue model
export const getRecommendedMetrics = (revenueModel: string): FinancialMetric[] => {
  const recommendedIds =
    REVENUE_MODEL_RECOMMENDATIONS[revenueModel] || REVENUE_MODEL_RECOMMENDATIONS['Other']
  return recommendedIds.map((id) => getMetricById(id)).filter(Boolean) as FinancialMetric[]
}

// Helper function to get all metrics by category
export const getMetricsByCategory = (category: string): FinancialMetric[] => {
  return FINANCIAL_METRICS.filter((metric) => metric.category === category)
}

// Revenue-model specific metric variants with contextual calculations and targets
export const METRIC_VARIANTS: Record<string, MetricVariant[]> = {
  cash_runway: [
    {
      baseMetricId: 'cash_runway',
      revenueModel: 'SaaS',
      name: 'SaaS Cash Runway',
      description: 'Months of runway based on burn rate',
      formula: 'Cash Balance / Monthly Burn Rate',
      benchmarks: { excellent: 24, good: 18, fair: 12, poor: 6 },
      defaultTarget: 18,
      targetRange: { min: 6, max: 60, step: 1 },
      unit: 'months',
    },
    {
      baseMetricId: 'cash_runway',
      revenueModel: 'Retail',
      name: 'Retail Cash Runway',
      description: 'Operating capital including inventory turns',
      formula: '(Cash + Inventory Value) / Monthly Operating Costs',
      benchmarks: { excellent: 12, good: 9, fair: 6, poor: 3 },
      defaultTarget: 9,
      targetRange: { min: 3, max: 24, step: 1 },
      unit: 'months',
    },
    {
      baseMetricId: 'cash_runway',
      revenueModel: 'Services',
      name: 'Services Cash Runway',
      description: 'Cash runway including accounts receivable',
      formula: '(Cash + Receivables) / Monthly Fixed Costs',
      benchmarks: { excellent: 18, good: 12, fair: 8, poor: 4 },
      defaultTarget: 12,
      targetRange: { min: 4, max: 36, step: 1 },
      unit: 'months',
    },
  ],

  gross_margin: [
    {
      baseMetricId: 'gross_margin',
      revenueModel: 'SaaS',
      name: 'SaaS Gross Margin',
      description: 'Revenue minus direct costs (hosting, support)',
      formula: '(MRR - Direct Costs) / MRR * 100',
      benchmarks: { excellent: 85, good: 75, fair: 65, poor: 50 },
      defaultTarget: 80,
      targetRange: { min: 50, max: 95, step: 1 },
      unit: '%',
    },
    {
      baseMetricId: 'gross_margin',
      revenueModel: 'Retail',
      name: 'Retail Gross Margin',
      description: 'Revenue minus cost of goods sold',
      formula: '(Revenue - COGS) / Revenue * 100',
      benchmarks: { excellent: 50, good: 40, fair: 30, poor: 20 },
      defaultTarget: 45,
      targetRange: { min: 15, max: 70, step: 1 },
      unit: '%',
    },
    {
      baseMetricId: 'gross_margin',
      revenueModel: 'Services',
      name: 'Services Gross Margin',
      description: 'Revenue minus direct labor and materials',
      formula: '(Project Revenue - Direct Labor - Materials) / Project Revenue * 100',
      benchmarks: { excellent: 70, good: 60, fair: 50, poor: 35 },
      defaultTarget: 65,
      targetRange: { min: 30, max: 80, step: 1 },
      unit: '%',
    },
  ],

  cash_flow: [
    {
      baseMetricId: 'cash_flow',
      revenueModel: 'SaaS',
      name: 'SaaS Operating Cash Flow',
      description: 'Monthly recurring cash generated from operations',
      formula: 'Revenue - Operating Expenses',
      benchmarks: { excellent: 50000, good: 25000, fair: 10000, poor: 0 },
      defaultTarget: 25000,
      targetRange: { min: 0, max: 500000, step: 1000 },
      unit: 'currency',
    },
    {
      baseMetricId: 'cash_flow',
      revenueModel: 'Services',
      name: 'Services Operating Cash Flow',
      description: 'Monthly cash from billable projects minus expenses',
      formula: 'Project Revenue + Retainer Fees - Labor Costs - Overhead',
      benchmarks: { excellent: 40000, good: 20000, fair: 8000, poor: 0 },
      defaultTarget: 20000,
      targetRange: { min: 0, max: 300000, step: 1000 },
      unit: 'currency',
    },
    {
      baseMetricId: 'cash_flow',
      revenueModel: 'Retail',
      name: 'Retail Operating Cash Flow',
      description: 'Monthly cash from sales minus inventory and operating costs',
      formula: 'Sales Revenue - COGS - Inventory Purchases - Operating Expenses',
      benchmarks: { excellent: 35000, good: 18000, fair: 7000, poor: 0 },
      defaultTarget: 18000,
      targetRange: { min: 0, max: 400000, step: 1000 },
      unit: 'currency',
    },
  ],
}

// Helper function to get metric variant for revenue model
export const getMetricVariant = (metricId: string, revenueModel: string): MetricVariant | null => {
  const variants = METRIC_VARIANTS[metricId]
  if (!variants) return null

  const variant = variants.find((v) => v.revenueModel === revenueModel)
  return variant || null
}

// Helper function to get default target for metric + revenue model combination
// Returns a number (never null) with fallback chain: variant → thresholds.good → hardcoded defaults
export const getDefaultTarget = (metricId: string, revenueModel: string): number => {
  // 1. First try revenue-model specific variants
  const variant = getMetricVariant(metricId, revenueModel)
  if (variant) return variant.defaultTarget

  // 2. Fallback to default thresholds "good" value
  const thresholds = getDefaultThresholds(metricId)
  if (thresholds) return thresholds.good

  // 3. Final fallback to generic defaults
  const defaults: Record<string, number> = {
    cash_runway: 12,
    gross_margin: 70,
    cash_flow: 100000,
    cash_balance: 500000,
    working_capital: 250000,
    working_capital_ratio: 1.5,
    burn_rate: 25000,
  }
  return defaults[metricId] || 0
}

// Helper function to get unit for metric (checks variants first, then base metric)
export const getMetricUnit = (metricId: string, revenueModel?: string): string => {
  if (revenueModel) {
    const variant = getMetricVariant(metricId, revenueModel)
    if (variant) return variant.unit
  }

  const baseMetric = getMetricById(metricId)
  return baseMetric ? baseMetric.unit : ''
}
