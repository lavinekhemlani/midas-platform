// Types for the threshold-based metric alert system
// These alerts are generated client-side based on fetched data

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertCategory =
  | 'billing'
  | 'cash_flow'
  | 'receivables'
  | 'profitability'
  | 'liquidity'
  | 'general'

export interface MetricThreshold {
  id: string
  metric: string
  category: AlertCategory
  // Threshold conditions
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  value: number
  // Alert configuration
  severity: AlertSeverity
  title: string
  messageTemplate: string // Supports {value}, {threshold}, {metric} placeholders
  // Optional: secondary threshold for escalation
  criticalThreshold?: number
  // Navigation
  actionUrl?: string
  actionLabel?: string
  // Whether this rule is enabled
  enabled: boolean
}

export interface MetricAlert {
  id: string
  thresholdId: string
  category: AlertCategory
  severity: AlertSeverity
  title: string
  message: string
  // The actual values that triggered the alert
  currentValue: number
  thresholdValue: number
  // Metadata for display
  icon?: string
  actionUrl?: string
  actionLabel?: string
  // Timestamps
  createdAt: number
  // For deduplication - allows dismissing for a period
  dismissedUntil?: number
  // Multi-company support
  companyId?: string // realmId for QuickBooks
  companyName?: string
}

export interface AlertsState {
  alerts: MetricAlert[]
  dismissedAlertIds: Set<string>
  lastChecked: number
}

// Default threshold rules that can be extended
export const DEFAULT_THRESHOLD_RULES: MetricThreshold[] = [
  // Unpaid Bills (Aged Payables) - RED
  // Uses unpaid bills data from useUnpaidBills hook
  {
    id: 'unpaid_bills_any',
    metric: 'unpaid_bills_count',
    category: 'billing',
    operator: 'gt',
    value: 0,
    severity: 'critical', // Red - bills we need to pay
    title: 'Unpaid Bills',
    messageTemplate: '{value} unpaid bills totaling {amount}',
    actionUrl: '/expenses/bills',
    actionLabel: 'View Bills',
    enabled: true,
  },
  // Outstanding Payments (Aged Receivables) - AMBER/YELLOW
  // Uses outstanding payments data from useOutstandingPayments hook
  {
    id: 'outstanding_payments_any',
    metric: 'outstanding_invoices_count',
    category: 'receivables',
    operator: 'gt',
    value: 0,
    severity: 'warning', // Amber - money owed to us
    title: 'Outstanding Payments',
    messageTemplate: '{value} customers with outstanding payments totaling {amount}',
    actionUrl: '/sales?tab=outstanding',
    actionLabel: 'View All',
    enabled: true,
  },
  // Cash Flow
  {
    id: 'low_cash_runway',
    metric: 'cash_runway_months',
    category: 'cash_flow',
    operator: 'lt',
    value: 6,
    severity: 'warning',
    title: 'Low Cash Runway',
    messageTemplate:
      'Cash runway is {value} months - consider reducing expenses or securing funding',
    criticalThreshold: 3,
    actionUrl: '/reports/cash-flow',
    actionLabel: 'View Cash Flow',
    enabled: true,
  },
  {
    id: 'negative_cash_flow',
    metric: 'operating_cash_flow',
    category: 'cash_flow',
    operator: 'lt',
    value: 0,
    severity: 'warning',
    title: 'Negative Operating Cash Flow',
    messageTemplate: 'Operating cash flow is negative at {value}',
    actionUrl: '/reports/cash-flow',
    actionLabel: 'Analyze',
    enabled: true,
  },
  // Profitability
  {
    id: 'negative_net_income',
    metric: 'net_income',
    category: 'profitability',
    operator: 'lt',
    value: 0,
    severity: 'info',
    title: 'Operating at a Loss',
    messageTemplate: 'Net income is negative at {value}',
    actionUrl: '/reports/pnl',
    actionLabel: 'View P&L',
    enabled: true,
  },
  // Liquidity
  {
    id: 'low_current_ratio',
    metric: 'current_ratio',
    category: 'liquidity',
    operator: 'lt',
    value: 1.0,
    severity: 'warning',
    title: 'Low Current Ratio',
    messageTemplate: 'Current ratio of {value} indicates potential liquidity issues',
    criticalThreshold: 0.5,
    actionUrl: '/reports/balance-sheet',
    actionLabel: 'View Balance Sheet',
    enabled: true,
  },
]

// Helper to generate alert ID for deduplication
export function generateAlertId(thresholdId: string, date: string): string {
  return `${thresholdId}_${date}`
}

// Helper to format message with placeholders
export function formatAlertMessage(
  template: string,
  replacements: Record<string, string | number>
): string {
  let message = template
  for (const [key, value] of Object.entries(replacements)) {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return message
}
