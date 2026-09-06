/**
 * Standardized color palette for financial reports
 * Ensures consistent visual language across P&L, Balance Sheet, and Cash Flow reports
 */

// Primary semantic colors
export const REPORT_COLORS = {
  // Positive/Growth indicators
  positive: '#10b981', // emerald-400
  success: '#10b981',
  revenue: '#10b981',
  assets: '#10b981',
  income: '#10b981',

  // Negative/Loss indicators
  negative: '#ef4444', // red-400
  danger: '#ef4444',
  expense: '#ef4444',
  liabilities: '#ef4444',

  // Neutral/Warning indicators
  warning: '#f59e0b', // amber-400
  neutral: '#f59e0b',

  // Category-specific colors
  equity: '#3b82f6',      // blue-400 - used for Balance Sheet equity
  operating: '#10b981',   // emerald-400 - used for operating activities
  investing: '#f59e0b',   // amber-400 - used for investing activities
  financing: '#8b5cf6',   // purple-400 - used for financing activities

  // Status colors
  info: '#3b82f6',        // blue-400
  purple: '#8b5cf6',      // purple-400
} as const

// Chart-specific color mappings
export const CHART_COLORS = {
  pnl: {
    revenue: REPORT_COLORS.revenue,
    expenses: REPORT_COLORS.expense,
    netIncome: REPORT_COLORS.warning,
  },
  balanceSheet: {
    assets: REPORT_COLORS.assets,
    liabilities: REPORT_COLORS.liabilities,
    equity: REPORT_COLORS.equity,
  },
  cashFlow: {
    operating: REPORT_COLORS.operating,
    investing: REPORT_COLORS.investing,
    financing: REPORT_COLORS.financing,
  },
} as const

// Status badge color mappings
export const STATUS_COLORS = {
  excellent: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  good: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  healthy: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  low: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
  },
  warning: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  moderate: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  high: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  critical: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  poor: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
} as const

// Icon background colors (for KPI cards)
export const ICON_BG_COLORS = {
  emerald: 'bg-emerald-500/10',
  red: 'bg-red-500/10',
  amber: 'bg-amber-500/10',
  blue: 'bg-blue-500/10',
  purple: 'bg-purple-500/10',
} as const

// Icon text colors
export const ICON_TEXT_COLORS = {
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
} as const

/**
 * Get status color classes based on status string
 */
export function getStatusColors(status: string): { text: string; bg: string; border: string } {
  const normalizedStatus = status.toLowerCase()
  return STATUS_COLORS[normalizedStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.moderate
}

/**
 * Get color for value (positive = green, negative = red)
 */
export function getValueColor(value: number): string {
  return value >= 0 ? REPORT_COLORS.positive : REPORT_COLORS.negative
}

/**
 * Get text color class for value
 */
export function getValueColorClass(value: number): string {
  return value >= 0 ? ICON_TEXT_COLORS.emerald : ICON_TEXT_COLORS.red
}

/**
 * Color scheme documentation for reference
 *
 * ## Color Psychology in Financial Reports
 *
 * ### Primary Colors:
 * - **Emerald Green (#10b981)**: Represents positive values, growth, revenue, assets, and healthy status
 * - **Red (#ef4444)**: Represents negative values, expenses, liabilities, and critical status
 * - **Amber (#f59e0b)**: Represents warnings, moderate status, and neutral financial indicators
 *
 * ### Category Colors:
 * - **Blue (#3b82f6)**: Used for equity and informational elements
 * - **Purple (#8b5cf6)**: Used for financing activities to differentiate from other cash flow categories
 *
 * ### Usage Guidelines:
 * 1. Always use emerald for positive financial indicators (revenue, assets, profit)
 * 2. Always use red for negative financial indicators (expenses, liabilities, loss)
 * 3. Use amber for neutral or mixed indicators (net income can be positive or negative)
 * 4. Maintain consistency within report sections (e.g., all P&L trends use same color set)
 * 5. Use status colors consistently across all KPI badges
 *
 * ### Accessibility:
 * - All colors meet WCAG AA contrast standards on dark backgrounds
 * - Colors are distinguishable for common forms of color blindness
 * - Numeric indicators and labels provide redundancy for color information
 */