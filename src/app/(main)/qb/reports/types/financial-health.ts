// src/app/(main)/reports/types/financial-health.ts

import type { HealthScore, HealthScoreComponent, MetricTarget } from './metrics'

/**
 * Financial health metric definition
 */
export interface FinancialHealthMetric {
  /** Unique metric identifier */
  id: string
  /** Display name */
  name: string
  /** Metric category */
  category: 'profitability' | 'liquidity' | 'efficiency' | 'leverage' | 'growth'
  /** Description of what this metric measures */
  description: string
  /** Ideal target value */
  defaultTarget?: number
  /** Unit of measurement */
  unit: 'percentage' | 'ratio' | 'currency' | 'days' | 'months'
  /** Whether higher values are better */
  higherIsBetter: boolean
  /** Formula for calculation */
  formula?: string
  /** Related financial term ID for learn pages */
  termId?: string
}

/**
 * Financial health settings stored in user preferences
 */
export interface FinancialHealthSettings {
  /** Selected metric IDs to display (max 4) */
  selectedMetricIds: string[]
  /** Custom targets for metrics */
  customTargets: MetricTarget[]
  /** Last updated timestamp */
  lastUpdated?: string
}

/**
 * Financial health card props
 */
export interface FinancialHealthCardProps {
  /** Current health score */
  healthScore: HealthScore
  /** Selected metric IDs to display */
  selectedMetricIds: string[]
  /** Custom metric targets */
  customTargets: MetricTarget[]
  /** Function to get metric value from current data */
  getMetricValue: (metricId: string) => number | null
  /** Function to get metric icon component */
  getMetricIcon: (metricId: string) => any
  /** Function to get metric color class */
  getMetricColor: (metricId: string) => string
  /** Function to get metric's term ID for learn pages */
  getMetricTermId: (metricId: string) => string
  /** Function to format metric value for display */
  formatMetricValue: (metricId: string, value: number) => string
  /** Function to format target value for display */
  formatTargetValue: (metricId: string, target: number | undefined) => string
  /** Function to get tooltip data for a metric */
  getFinancialHealthMetricTooltip: (metricId: string) => TooltipData | null
  /** Context data for learn pages */
  contextData: Record<string, any>
  /** Whether data is loading */
  isLoading: boolean
  /** Whether settings are being saved */
  isSaving: boolean
  /** Handler for settings button click */
  onSettingsClick: () => void
}

/**
 * Financial health settings dialog props
 */
export interface FinancialHealthSettingsDialogProps {
  /** Whether dialog is open */
  open: boolean
  /** Handler for dialog close */
  onClose: () => void
  /** Currently selected metric IDs */
  selectedMetricIds: string[]
  /** Handler for metric selection change */
  onMetricsChange: (metricIds: string[]) => void
  /** Custom metric targets */
  customTargets: MetricTarget[]
  /** Handler for targets change */
  onTargetsChange: (targets: MetricTarget[]) => void
  /** Whether settings are being saved */
  isSaving: boolean
}

/**
 * Metric configuration for display and calculation
 */
export interface MetricConfiguration {
  /** Metric definition */
  metric: FinancialHealthMetric
  /** Current value */
  currentValue: number | null
  /** Target value */
  targetValue?: number
  /** Score (0-100) */
  score: number
  /** Status rating */
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  /** Trend direction */
  trend?: 'up' | 'down' | 'stable'
  /** Percentage change from previous period */
  changePercent?: number
}

/**
 * Financial health calculation result
 */
export interface FinancialHealthResult {
  /** Overall health score */
  healthScore: HealthScore
  /** Individual metric configurations */
  metrics: MetricConfiguration[]
  /** Calculation timestamp */
  calculatedAt: string
  /** Period covered by the calculation */
  period: {
    start: string
    end: string
  }
}

/**
 * Tooltip data structure for metric tooltips
 */
export interface TooltipData {
  /** Formula display string */
  formula: string
  /** Breakdown components */
  components: Array<{
    label: string
    value: string | number
    highlight?: boolean
  }>
  /** Metric description */
  description: string
}

/**
 * Health score thresholds for status determination
 */
export interface HealthScoreThresholds {
  /** Minimum score for 'excellent' status */
  excellent: number
  /** Minimum score for 'good' status */
  good: number
  /** Minimum score for 'fair' status */
  fair: number
  /** Minimum score for 'poor' status */
  poor: number
  // Below poor is 'critical'
}

/**
 * Default health score thresholds
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthScoreThresholds = {
  excellent: 90,
  good: 75,
  fair: 60,
  poor: 40,
}

/**
 * Metric weights for health score calculation
 */
export interface MetricWeights {
  [metricId: string]: number
}

/**
 * Default equal weights for 4 metrics
 */
export const DEFAULT_METRIC_WEIGHTS: MetricWeights = {
  gross_margin: 0.25,
  current_ratio: 0.25,
  burn_rate: 0.25,
  runway_months: 0.25,
}

/**
 * Available financial health metrics catalog
 */
export const FINANCIAL_HEALTH_METRICS: FinancialHealthMetric[] = [
  // Profitability Metrics
  {
    id: 'gross_margin',
    name: 'Gross Margin',
    category: 'profitability',
    description: 'Percentage of revenue remaining after cost of goods sold',
    defaultTarget: 70,
    unit: 'percentage',
    higherIsBetter: true,
    formula: '(Revenue - COGS) / Revenue × 100',
    termId: 'gross-margin',
  },
  {
    id: 'net_profit_margin',
    name: 'Net Profit Margin',
    category: 'profitability',
    description: 'Percentage of revenue that becomes profit',
    defaultTarget: 20,
    unit: 'percentage',
    higherIsBetter: true,
    formula: 'Net Income / Revenue × 100',
    termId: 'net-profit-margin',
  },
  {
    id: 'operating_margin',
    name: 'Operating Margin',
    category: 'profitability',
    description: 'Operating income as a percentage of revenue',
    defaultTarget: 15,
    unit: 'percentage',
    higherIsBetter: true,
    formula: 'Operating Income / Revenue × 100',
    termId: 'operating-margin',
  },

  // Liquidity Metrics
  {
    id: 'current_ratio',
    name: 'Current Ratio',
    category: 'liquidity',
    description: 'Ability to pay short-term obligations',
    defaultTarget: 2.0,
    unit: 'ratio',
    higherIsBetter: true,
    formula: 'Current Assets / Current Liabilities',
    termId: 'current-ratio',
  },
  {
    id: 'quick_ratio',
    name: 'Quick Ratio',
    category: 'liquidity',
    description: 'Ability to pay short-term obligations with liquid assets',
    defaultTarget: 1.5,
    unit: 'ratio',
    higherIsBetter: true,
    formula: '(Current Assets - Inventory) / Current Liabilities',
    termId: 'quick-ratio',
  },
  {
    id: 'working_capital',
    name: 'Working Capital',
    category: 'liquidity',
    description: 'Operating liquidity available',
    defaultTarget: 100000,
    unit: 'currency',
    higherIsBetter: true,
    formula: 'Current Assets - Current Liabilities',
    termId: 'working-capital',
  },

  // Efficiency Metrics
  {
    id: 'burn_rate',
    name: 'Burn Rate',
    category: 'efficiency',
    description: 'Monthly cash consumption rate',
    defaultTarget: 50000,
    unit: 'currency',
    higherIsBetter: false,
    formula: 'Total Expenses / Number of Months',
    termId: 'burn-rate',
  },
  {
    id: 'runway_months',
    name: 'Runway',
    category: 'efficiency',
    description: 'Months of operation before running out of cash',
    defaultTarget: 18,
    unit: 'months',
    higherIsBetter: true,
    formula: 'Cash Balance / Monthly Burn Rate',
    termId: 'runway',
  },
  {
    id: 'cash_conversion_cycle',
    name: 'Cash Conversion Cycle',
    category: 'efficiency',
    description: 'Time to convert investments back to cash',
    defaultTarget: 30,
    unit: 'days',
    higherIsBetter: false,
    formula: 'DSO + DIO - DPO',
    termId: 'cash-conversion-cycle',
  },

  // Leverage Metrics
  {
    id: 'debt_to_equity',
    name: 'Debt-to-Equity',
    category: 'leverage',
    description: 'Financial leverage ratio',
    defaultTarget: 0.5,
    unit: 'ratio',
    higherIsBetter: false,
    formula: 'Total Liabilities / Total Equity',
    termId: 'debt-to-equity',
  },
  {
    id: 'debt_ratio',
    name: 'Debt Ratio',
    category: 'leverage',
    description: 'Proportion of assets financed by debt',
    defaultTarget: 0.3,
    unit: 'ratio',
    higherIsBetter: false,
    formula: 'Total Debt / Total Assets',
    termId: 'debt-ratio',
  },

  // Growth Metrics
  {
    id: 'roa',
    name: 'Return on Assets',
    category: 'growth',
    description: 'How efficiently company uses assets to generate profit',
    defaultTarget: 10,
    unit: 'percentage',
    higherIsBetter: true,
    formula: '(Net Income / Total Assets) × 100',
    termId: 'return-on-assets',
  },
]

/**
 * Helper function to get metric by ID
 */
export function getFinancialHealthMetric(id: string): FinancialHealthMetric | undefined {
  return FINANCIAL_HEALTH_METRICS.find((m) => m.id === id)
}

/**
 * Helper function to get metrics by category
 */
export function getMetricsByCategory(
  category: FinancialHealthMetric['category']
): FinancialHealthMetric[] {
  return FINANCIAL_HEALTH_METRICS.filter((m) => m.category === category)
}
