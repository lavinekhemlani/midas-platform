// src/lib/utils/metricThresholds.ts
/**
 * Utility functions for calculating dynamic metric thresholds based on user targets
 */

export interface MetricThreshold {
  excellent: number
  good: number
  fair: number
  poor: number
  critical: number
}

export interface ThresholdScores {
  excellent: number // 100
  good: number // 85
  fair: number // 70
  poor: number // 55
  critical: number // 40-20
}

const DEFAULT_SCORES: ThresholdScores = {
  excellent: 100,
  good: 85,
  fair: 70,
  poor: 55,
  critical: 20,
}

/**
 * Calculate dynamic thresholds for a metric based on user's target value
 * The target becomes the "excellent" threshold (100 score)
 * Other thresholds are adjusted proportionally below the target
 */
export function calculateDynamicThresholds(
  metricId: string,
  target: number,
  unit: string
): MetricThreshold {
  // For percentage-based metrics (higher is better)
  if (
    unit === '%' &&
    ['gross_margin', 'gross_revenue_retention', 'conversion_rate'].includes(metricId)
  ) {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 0.85, // 85% of target
      fair: target * 0.7, // 70% of target
      poor: target * 0.5, // 50% of target
      critical: target * 0.3, // 30% of target
    }
  }

  // For percentage-based metrics (lower is better) like churn
  if (unit === '%' && ['customer_churn_rate'].includes(metricId)) {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 1.15, // 15% above target
      fair: target * 1.3, // 30% above target
      poor: target * 1.5, // 50% above target
      critical: target * 2, // Double target
    }
  }

  // For months-based metrics (higher is better) like runway
  if (unit === 'months') {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 0.85, // 85% of target
      fair: target * 0.7, // 70% of target
      poor: target * 0.5, // 50% of target
      critical: target * 0.25, // 25% of target
    }
  }

  // For currency-based metrics where lower is better (burn_rate, net_burn_rate)
  if (unit === 'currency' && ['burn_rate', 'net_burn_rate'].includes(metricId)) {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 1.15, // 15% above target
      fair: target * 1.3, // 30% above target
      poor: target * 1.5, // 50% above target
      critical: target * 2, // Double target
    }
  }

  // For currency-based metrics (higher is better)
  if (unit === 'currency') {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 0.85, // 85% of target
      fair: target * 0.7, // 70% of target
      poor: target * 0.5, // 50% of target
      critical: target * 0.2, // 20% of target
    }
  }

  // For ratio-based metrics (higher is better)
  if (unit === 'ratio') {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 0.85, // 85% of target
      fair: target * 0.7, // 70% of target
      poor: target * 0.5, // 50% of target
      critical: target * 0.25, // 25% of target
    }
  }

  // For days-based metrics (lower is usually better) like cash conversion cycle
  if (unit === 'days') {
    return {
      excellent: target, // Meeting target = 100 points
      good: target * 1.15, // 15% above target
      fair: target * 1.3, // 30% above target
      poor: target * 1.5, // 50% above target
      critical: target * 2, // Double target
    }
  }

  // Default fallback (assumes higher is better)
  return {
    excellent: target, // Meeting target = 100 points
    good: target * 0.85, // 85% of target
    fair: target * 0.7, // 70% of target
    poor: target * 0.5, // 50% of target
    critical: target * 0.25, // 25% of target
  }
}

/**
 * Calculate score for a metric value based on thresholds
 */
export function calculateScoreFromThresholds(
  value: number,
  thresholds: MetricThreshold,
  higherIsBetter: boolean = true
): number {
  if (higherIsBetter) {
    if (value >= thresholds.excellent) return DEFAULT_SCORES.excellent
    if (value >= thresholds.good) return DEFAULT_SCORES.good
    if (value >= thresholds.fair) return DEFAULT_SCORES.fair
    if (value >= thresholds.poor) return DEFAULT_SCORES.poor
    return DEFAULT_SCORES.critical
  } else {
    // For metrics where lower is better (churn, days, etc.)
    if (value <= thresholds.excellent) return DEFAULT_SCORES.excellent
    if (value <= thresholds.good) return DEFAULT_SCORES.good
    if (value <= thresholds.fair) return DEFAULT_SCORES.fair
    if (value <= thresholds.poor) return DEFAULT_SCORES.poor
    return DEFAULT_SCORES.critical
  }
}

/**
 * Get status for a metric value based on thresholds
 */
export function getStatusFromThresholds(
  value: number,
  thresholds: MetricThreshold,
  higherIsBetter: boolean = true
): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
  if (higherIsBetter) {
    if (value >= thresholds.excellent) return 'excellent'
    if (value >= thresholds.good) return 'good'
    if (value >= thresholds.fair) return 'fair'
    if (value >= thresholds.poor) return 'poor'
    return 'critical'
  } else {
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.fair) return 'fair'
    if (value <= thresholds.poor) return 'poor'
    return 'critical'
  }
}

/**
 * Determine if higher values are better for a metric
 */
export function isHigherBetter(metricId: string, unit: string): boolean {
  // Lower is better for these metrics
  const lowerIsBetter = [
    'customer_churn_rate',
    'cash_conversion_cycle',
    'burn_rate',
    'net_burn_rate',
    'cac_payback_period',
  ]

  if (lowerIsBetter.includes(metricId)) return false
  if (unit === 'days' && !metricId.includes('runway')) return false

  return true
}

/**
 * Get default thresholds for a metric (fallback when no custom target is set)
 */
export function getDefaultThresholds(metricId: string): MetricThreshold | null {
  const defaults: Record<string, MetricThreshold> = {
    // Liquidity Metrics
    cash_runway: {
      excellent: 12,
      good: 9,
      fair: 6,
      poor: 3,
      critical: 1,
    },
    cash_balance: {
      excellent: 500000,
      good: 250000,
      fair: 100000,
      poor: 50000,
      critical: 10000,
    },
    cash_flow: {
      excellent: 100000,
      good: 50000,
      fair: 10000,
      poor: 0,
      critical: -10000,
    },
    working_capital: {
      excellent: 500000,
      good: 250000,
      fair: 100000,
      poor: 50000,
      critical: 0,
    },
    free_cash_flow: {
      excellent: 100000,
      good: 50000,
      fair: 10000,
      poor: 0,
      critical: -50000,
    },
    burn_rate: {
      excellent: 10000,
      good: 25000,
      fair: 50000,
      poor: 100000,
      critical: 200000,
    },
    net_burn_rate: {
      excellent: -10000, // Negative burn = making money
      good: 0,
      fair: 25000,
      poor: 50000,
      critical: 100000,
    },

    // Profitability Metrics
    gross_margin: {
      excellent: 70,
      good: 50,
      fair: 40,
      poor: 25,
      critical: 10,
    },
    net_profit_margin: {
      excellent: 20,
      good: 10,
      fair: 5,
      poor: 0,
      critical: -10,
    },
    operating_margin: {
      excellent: 25,
      good: 15,
      fair: 10,
      poor: 5,
      critical: 0,
    },
    roe: {
      excellent: 20,
      good: 15,
      fair: 10,
      poor: 5,
      critical: 0,
    },
    roa: {
      excellent: 15,
      good: 10,
      fair: 5,
      poor: 2,
      critical: 0,
    },
    operating_cash_flow_margin: {
      excellent: 20,
      good: 15,
      fair: 10,
      poor: 5,
      critical: 0,
    },

    // Efficiency Metrics
    working_capital_ratio: {
      excellent: 2.0,
      good: 1.5,
      fair: 1.2,
      poor: 1.0,
      critical: 0.8,
    },
    quick_ratio: {
      excellent: 1.5,
      good: 1.2,
      fair: 1.0,
      poor: 0.8,
      critical: 0.5,
    },
    cash_conversion_cycle: {
      excellent: 30,
      good: 45,
      fair: 60,
      poor: 90,
      critical: 120,
    },
    asset_turnover: {
      excellent: 2.0,
      good: 1.5,
      fair: 1.0,
      poor: 0.5,
      critical: 0.25,
    },
    inventory_turnover: {
      excellent: 12,
      good: 8,
      fair: 6,
      poor: 4,
      critical: 2,
    },
    dso: {
      excellent: 30,
      good: 45,
      fair: 60,
      poor: 90,
      critical: 120,
    },
    dpo: {
      excellent: 45,
      good: 35,
      fair: 30,
      poor: 20,
      critical: 10,
    },

    // Leverage & Returns Metrics
    debt_to_equity: {
      excellent: 0.5,
      good: 1.0,
      fair: 1.5,
      poor: 2.0,
      critical: 3.0,
    },
    debt_ratio: {
      excellent: 30,
      good: 40,
      fair: 50,
      poor: 60,
      critical: 75,
    },
    equity_multiplier: {
      excellent: 1.5,
      good: 2.0,
      fair: 2.5,
      poor: 3.0,
      critical: 4.0,
    },

    // Additional Cash Flow Metrics
    operating_cash_flow_ratio: {
      excellent: 2.0,
      good: 1.5,
      fair: 1.0,
      poor: 0.5,
      critical: 0.25,
    },
    cash_flow_coverage_ratio: {
      excellent: 2.0,
      good: 1.5,
      fair: 1.0,
      poor: 0.5,
      critical: 0.25,
    },
  }

  return defaults[metricId] || null
}
