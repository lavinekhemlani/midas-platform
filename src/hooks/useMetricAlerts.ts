// Hook for generating alerts from metric data based on threshold rules
'use client'

import { useMemo } from 'react'
import {
  MetricAlert,
  MetricThreshold,
  AlertSeverity,
  DEFAULT_THRESHOLD_RULES,
  generateAlertId,
  formatAlertMessage,
} from '@/lib/types/metric-alert'
import { formatCurrency } from '@/lib/utils/currency'

interface MetricData {
  // Billing metrics (Aged Payables)
  unpaidBillsCount?: number
  unpaidBillsAmount?: number
  // Receivables metrics (Aged Receivables / Outstanding Payments)
  outstandingInvoicesCount?: number
  outstandingInvoicesAmount?: number
  // Cash flow metrics
  cashRunwayMonths?: number
  operatingCashFlow?: number
  cashBalance?: number
  // Profitability metrics
  netIncome?: number
  grossMargin?: number
  // Liquidity metrics
  currentRatio?: number
  quickRatio?: number
}

interface UseMetricAlertsOptions {
  customRules?: MetricThreshold[]
  enabledCategories?: string[]
  currency?: string
}

// Map metric names to their data keys and formatters
const METRIC_MAPPING: Record<
  string,
  {
    dataKey: keyof MetricData
    amountKey?: keyof MetricData
    formatter?: (value: number, currency: string) => string
  }
> = {
  // Aged Payables (bills we need to pay)
  unpaid_bills_count: {
    dataKey: 'unpaidBillsCount',
    amountKey: 'unpaidBillsAmount',
  },
  // Aged Receivables (money owed to us)
  outstanding_invoices_count: {
    dataKey: 'outstandingInvoicesCount',
    amountKey: 'outstandingInvoicesAmount',
  },
  // Financial metrics
  cash_runway_months: {
    dataKey: 'cashRunwayMonths',
    formatter: (value) => `${value.toFixed(1)} months`,
  },
  operating_cash_flow: {
    dataKey: 'operatingCashFlow',
    formatter: (value, currency) => formatCurrency(value, { currency }),
  },
  net_income: {
    dataKey: 'netIncome',
    formatter: (value, currency) => formatCurrency(value, { currency }),
  },
  current_ratio: {
    dataKey: 'currentRatio',
    formatter: (value) => value.toFixed(2),
  },
}

function checkThreshold(
  value: number,
  threshold: number,
  operator: MetricThreshold['operator']
): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold
    case 'gte':
      return value >= threshold
    case 'lt':
      return value < threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return value === threshold
    case 'neq':
      return value !== threshold
    default:
      return false
  }
}

function determineSeverity(value: number, rule: MetricThreshold): AlertSeverity {
  // Check if critical threshold is met
  if (rule.criticalThreshold !== undefined) {
    const isCritical = checkThreshold(value, rule.criticalThreshold, rule.operator)
    if (isCritical) {
      return 'critical'
    }
  }
  return rule.severity
}

export function useMetricAlerts(
  data: MetricData,
  options: UseMetricAlertsOptions = {}
): MetricAlert[] {
  const { customRules = [], enabledCategories, currency = 'USD' } = options

  const alerts = useMemo(() => {
    const generatedAlerts: MetricAlert[] = []
    const allRules = [...DEFAULT_THRESHOLD_RULES, ...customRules]
    const today = new Date().toISOString().split('T')[0]

    for (const rule of allRules) {
      // Skip disabled rules
      if (!rule.enabled) continue

      // Skip if category is not enabled (when filter is provided)
      if (enabledCategories && !enabledCategories.includes(rule.category)) continue

      // Get the metric mapping
      const mapping = METRIC_MAPPING[rule.metric]
      if (!mapping) continue

      // Get the current value
      const currentValue = data[mapping.dataKey]
      if (currentValue === undefined || currentValue === null) continue

      // Check if threshold is triggered
      const isTriggered = checkThreshold(currentValue, rule.value, rule.operator)
      if (!isTriggered) continue

      // Determine actual severity (may escalate to critical)
      const severity = determineSeverity(currentValue, rule)

      // Format the message
      const replacements: Record<string, string | number> = {
        value: currentValue,
        threshold: rule.value,
        metric: rule.metric,
      }

      // Add amount if available
      if (mapping.amountKey && data[mapping.amountKey] !== undefined) {
        replacements.amount = formatCurrency(data[mapping.amountKey] as number, { currency })
      }

      // Apply custom formatter if available
      if (mapping.formatter) {
        replacements.value = mapping.formatter(currentValue, currency)
      }

      const message = formatAlertMessage(rule.messageTemplate, replacements)
      const alertId = generateAlertId(rule.id, today)

      generatedAlerts.push({
        id: alertId,
        thresholdId: rule.id,
        category: rule.category,
        severity,
        title: rule.title,
        message,
        currentValue,
        thresholdValue: rule.value,
        actionUrl: rule.actionUrl,
        actionLabel: rule.actionLabel,
        createdAt: Date.now(),
      })
    }

    // Sort by severity (critical first, then warning, then info)
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    }
    generatedAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return generatedAlerts
  }, [data, customRules, enabledCategories, currency])

  return alerts
}

// Convenience hook that combines unpaid bills and outstanding payments data
export function useCombinedAlerts(
  unpaidBillsData: {
    totalUnpaid?: number
    totalBills?: number
  } | null,
  outstandingData: {
    totalOutstanding?: number
    numberOfCustomers?: number
  } | null,
  financialMetrics?: {
    cashRunwayMonths?: number
    operatingCashFlow?: number
    netIncome?: number
    currentRatio?: number
  },
  currency: string = 'USD'
): MetricAlert[] {
  const metricData: MetricData = {
    // Aged Payables - bills we need to pay (RED)
    unpaidBillsCount: unpaidBillsData?.totalBills,
    unpaidBillsAmount: unpaidBillsData?.totalUnpaid,
    // Aged Receivables - money owed to us (AMBER)
    outstandingInvoicesCount: outstandingData?.numberOfCustomers,
    outstandingInvoicesAmount: outstandingData?.totalOutstanding,
    // Financial metrics (for future use)
    cashRunwayMonths: financialMetrics?.cashRunwayMonths,
    operatingCashFlow: financialMetrics?.operatingCashFlow,
    netIncome: financialMetrics?.netIncome,
    currentRatio: financialMetrics?.currentRatio,
  }

  return useMetricAlerts(metricData, { currency })
}
