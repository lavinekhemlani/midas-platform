// src/ai/router/patterns.ts
// Single source of truth for all routing patterns
// Easy to update, audit, and test

import type {
  ExactPattern,
  ReportKeywords,
  IntentPatterns,
  PeriodPatterns,
  IntentMemoryAlignment,
  QueryIntent,
} from './types'
import type { MemoryType } from '../memory/types'

// =============================================================================
// Report Keywords
// Maps report types to keywords that indicate a need for that report
// =============================================================================

export const REPORT_KEYWORDS: ReportKeywords = {
  profit_loss: [
    'revenue',
    'income',
    'sales',
    'expenses',
    'profit',
    'loss',
    'margin',
    'p&l',
    'pnl',
    'earnings',
    'top line',
    'bottom line',
    'cost',
    'spending',
  ],
  balance_sheet: [
    'balance sheet',
    'assets',
    'liabilities',
    'equity',
    'debt',
    'net worth',
    'what do we own',
    'what we own',
  ],
  cash_flow: [
    'cash flow',
    'cash position',
    'operating cash',
    'free cash',
    'cash burn',
    'burn rate',
    'liquidity',
  ],
  revenue_trend: [
    'trend',
    'over time',
    'monthly revenue',
    'quarterly revenue',
    'revenue history',
    'revenue growth',
    'trajectory',
    'progression',
    'month over month',
    'year over year',
  ],
  aged_receivables: [
    'receivable',
    'ar aging',
    'owed to us',
    'who owes',
    'collect',
    'outstanding invoices',
    'overdue invoices',
    'customer owes',
  ],
  aged_payables: [
    'payable',
    'ap aging',
    'bills due',
    'what we owe',
    'outstanding bills',
    'overdue bills',
    'vendor payment',
  ],
  financial_health: [
    'financial health',
    'health score',
    'financial overview',
    'financial status',
    'financial position',
    'financial shape',
  ],
  sales: [
    'sales by customer',
    'customer breakdown',
    'top customers',
    'revenue by customer',
    'customer sales',
    'sales breakdown',
  ],
  bills: ['bills', 'vendor expenses', 'what we paid', 'expenses by vendor', 'vendor bills'],
  pnl_comparison: [
    'compare p&l',
    'compare profit',
    'period comparison',
    'vs last',
    'versus last',
    'compared to',
  ],
  trial_balance: ['trial balance', 'account balances', 'debit credit'],
}

// =============================================================================
// Exact Patterns
// High confidence patterns for common queries
// Order matters - more specific patterns should come first
// =============================================================================

export const EXACT_PATTERNS: ExactPattern[] = [
  // ---------------------------------------------------------------------------
  // Revenue queries
  // ---------------------------------------------------------------------------
  {
    pattern: /^(what('s| is| are)|show|get|tell me)( my| our| the)? (current |total )?revenue/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },
  {
    pattern: /^how much (money |revenue )?(did we|have we|do we) (make|earn|bring in)/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },
  {
    pattern: /^(what('s| is)|how much is)( my| our| the)? (total )?(income|earnings)/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },

  // ---------------------------------------------------------------------------
  // Expense queries
  // ---------------------------------------------------------------------------
  {
    pattern: /^(what('s| is| are)|show|get)( my| our| the)? (current |total )?expenses/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },
  {
    pattern: /^how much (did we|have we|are we) spend(ing)?/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },

  // ---------------------------------------------------------------------------
  // Profit queries
  // ---------------------------------------------------------------------------
  {
    pattern: /^(what('s| is)|show|get)( my| our| the)? (net )?(profit|income|margin)/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },
  {
    pattern: /^are we (profitable|making money|in the black)/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },

  // ---------------------------------------------------------------------------
  // Runway / Forecast queries
  // ---------------------------------------------------------------------------
  {
    pattern: /^(what('s| is)|how much is)( my| our| the)? (cash )?runway/i,
    intent: 'forecast',
    reports: ['cash_flow', 'balance_sheet'],
  },
  {
    pattern: /how long (will|can) (the |our |my )?(cash|money|funds) last/i,
    intent: 'forecast',
    reports: ['cash_flow', 'balance_sheet'],
  },
  {
    pattern: /when (will we|do we|are we going to) run out of (cash|money)/i,
    intent: 'forecast',
    reports: ['cash_flow', 'balance_sheet'],
  },
  {
    pattern: /^(what('s| is)|calculate)( my| our| the)? burn rate/i,
    intent: 'forecast',
    reports: ['cash_flow', 'balance_sheet'],
  },
  {
    pattern: /how (long|much time) (do we|have we) (got|have) left/i,
    intent: 'forecast',
    reports: ['cash_flow', 'balance_sheet'],
  },

  // ---------------------------------------------------------------------------
  // P&L / Financial Statement queries
  // ---------------------------------------------------------------------------
  {
    pattern: /^(show|give|get|pull)( me)?( the| a)? (p&l|profit.*(loss|&)|pnl|income statement)/i,
    intent: 'point_query',
    reports: ['profit_loss'],
  },
  {
    pattern: /^(show|give|get|pull)( me)?( the| a)? balance sheet/i,
    intent: 'point_query',
    reports: ['balance_sheet'],
  },
  {
    pattern: /^(show|give|get|pull)( me)?( the| a)? cash flow( statement)?/i,
    intent: 'point_query',
    reports: ['cash_flow'],
  },

  // ---------------------------------------------------------------------------
  // Health check / Overview queries
  // ---------------------------------------------------------------------------
  {
    pattern: /how (is|are) (we|the company|the business|things) doing/i,
    intent: 'health_check',
    reports: ['financial_health', 'profit_loss'],
  },
  {
    pattern: /^(give me |show me )?(an? )?(financial )?(overview|summary|status|snapshot)/i,
    intent: 'health_check',
    reports: ['financial_health', 'profit_loss'],
  },
  {
    pattern: /^what('s| is) (the |our )?(financial )?(health|status|position|shape)/i,
    intent: 'health_check',
    reports: ['financial_health', 'profit_loss'],
  },

  // ---------------------------------------------------------------------------
  // Trend queries
  // ---------------------------------------------------------------------------
  {
    pattern: /revenue (trend|over time|by month|growth|trajectory)/i,
    intent: 'trend',
    reports: ['revenue_trend'],
  },
  {
    pattern: /how has (revenue|income|sales) (changed|trended|grown|evolved)/i,
    intent: 'trend',
    reports: ['revenue_trend'],
  },
  {
    pattern: /show( me)? (the )?(revenue |income |sales )?(trend|history|progression)/i,
    intent: 'trend',
    reports: ['revenue_trend'],
  },
  {
    pattern: /(monthly|quarterly|yearly) (revenue|income|sales|financials)/i,
    intent: 'trend',
    reports: ['revenue_trend'],
  },

  // ---------------------------------------------------------------------------
  // AR/AP queries
  // ---------------------------------------------------------------------------
  {
    pattern: /who owes (us|me)|accounts receivable|ar aging/i,
    intent: 'point_query',
    reports: ['aged_receivables'],
  },
  {
    pattern: /what (invoices|money) (is|are) outstanding/i,
    intent: 'point_query',
    reports: ['aged_receivables'],
  },
  {
    pattern: /what (do we|bills do we) owe|accounts payable|ap aging/i,
    intent: 'point_query',
    reports: ['aged_payables'],
  },
  {
    pattern: /what bills (are|do we have) (due|outstanding|coming up)/i,
    intent: 'point_query',
    reports: ['aged_payables'],
  },

  // ---------------------------------------------------------------------------
  // Comparison queries
  // ---------------------------------------------------------------------------
  {
    pattern: /compare (this|current) (month|quarter|year) (to|vs|with|against) (last|previous)/i,
    intent: 'comparison',
    reports: ['profit_loss', 'pnl_comparison'],
  },
  {
    pattern: /how (does|do) (this|current) (month|quarter|year) compare/i,
    intent: 'comparison',
    reports: ['profit_loss', 'pnl_comparison'],
  },
  {
    pattern: /(month|quarter|year) over (month|quarter|year)/i,
    intent: 'comparison',
    reports: ['profit_loss', 'pnl_comparison'],
  },

  // ---------------------------------------------------------------------------
  // Anomaly / Investigation queries
  // ---------------------------------------------------------------------------
  {
    pattern:
      /why (did|has|is) (revenue|income|expenses|profit|cash) (drop|fall|spike|jump|change)/i,
    intent: 'anomaly',
    reports: ['profit_loss', 'revenue_trend'],
  },
  {
    pattern: /what('s| is) (unusual|different|wrong|off) (about|with)/i,
    intent: 'anomaly',
    reports: ['profit_loss', 'revenue_trend'],
  },
  {
    pattern: /what happened (to|with) (revenue|expenses|profit|cash)/i,
    intent: 'anomaly',
    reports: ['profit_loss', 'revenue_trend'],
  },

  // ---------------------------------------------------------------------------
  // Drill-down queries
  // ---------------------------------------------------------------------------
  {
    pattern: /break(ing)? down (the |my |our )?(revenue|expenses|costs|sales)/i,
    intent: 'drill_down',
    reports: ['profit_loss'],
  },
  {
    pattern: /(revenue|expenses|costs|sales) (by|per) (category|customer|vendor|type)/i,
    intent: 'drill_down',
    reports: ['profit_loss'],
  },
  {
    pattern: /where (is|are) (the |my |our )?(money|revenue|expenses) (going|coming from)/i,
    intent: 'drill_down',
    reports: ['profit_loss'],
  },
]

// =============================================================================
// Intent Patterns
// Used for keyword-based matching when exact patterns don't match
// Order in priority check matters - more specific first
// =============================================================================

export const INTENT_PATTERNS: IntentPatterns = {
  forecast: /(runway|forecast|project|predict|how long|when will|future|burn rate|cash last)/i,
  comparison: /(compare|vs|versus|difference|change from|against|over.*over)/i,
  trend: /(trend|over time|monthly|quarterly|history|growth|trajectory|progression)/i,
  anomaly: /(unusual|spike|drop|why did|what happened|concern|weird|strange|off|wrong)/i,
  health_check: /(overview|summary|status|health|how.*doing|shape|position|snapshot)/i,
  drill_down: /(break down|breakdown|detail|drill|by category|by customer|itemize|where.*going)/i,
  point_query: /^(what('s| is| are)|show|get|tell me|how much|give me)/i,
  general: /.*/, // Always matches as fallback
}

/**
 * Priority order for intent detection
 * More specific intents should be checked first
 */
export const INTENT_PRIORITY: QueryIntent[] = [
  'forecast',
  'comparison',
  'trend',
  'anomaly',
  'health_check',
  'drill_down',
  'point_query',
  'general',
]

// =============================================================================
// Period Patterns
// Detect time periods mentioned in queries
// =============================================================================

export const PERIOD_PATTERNS: PeriodPatterns = {
  this_month: /(this month|current month|mtd|month to date)/i,
  last_month: /(last month|previous month|prior month)/i,
  this_quarter: /(this quarter|current quarter|qtd|quarter to date)/i,
  last_quarter: /(last quarter|previous quarter|prior quarter)/i,
  this_year: /(this year|current year|ytd|year to date)/i,
  last_year: /(last year|previous year|prior year)/i,
}

// =============================================================================
// Memory Alignment
// Which memory types are relevant for each intent
// =============================================================================

export const INTENT_MEMORY_ALIGNMENT: IntentMemoryAlignment = {
  // Forecast needs stored future cashflows for accurate runway
  forecast: ['expense', 'income', 'goal'] as MemoryType[],

  // Comparison benefits from goals as reference points
  comparison: ['goal', 'decision'] as MemoryType[],

  // Trends may be explained by stored decisions
  trend: ['decision', 'context'] as MemoryType[],

  // Health check needs holistic context
  health_check: ['goal', 'deadline', 'expense', 'income'] as MemoryType[],

  // Anomalies may be explained by context
  anomaly: ['decision', 'context', 'expense'] as MemoryType[],

  // Drill-down benefits from business context
  drill_down: ['context'] as MemoryType[],

  // Point queries usually don't need memory
  point_query: [] as MemoryType[],

  // General - let agent decide
  general: [] as MemoryType[],
}

// =============================================================================
// Ambiguous Terms
// Terms that can mean different things depending on context
// Agent should ask for clarification when these appear without specific context
// =============================================================================

export const AMBIGUOUS_TERMS: Record<
  string,
  {
    term: string
    options: { label: string; description: string; reportType: string }[]
  }
> = {
  revenue: {
    term: 'revenue',
    options: [
      {
        label: 'Sales Revenue',
        description: 'Total from invoices and sales transactions',
        reportType: 'sales',
      },
      {
        label: 'P&L Revenue (Total Income)',
        description: 'Revenue as shown in Profit & Loss statement',
        reportType: 'profit_loss',
      },
    ],
  },
  expenses: {
    term: 'expenses',
    options: [
      {
        label: 'Operating Expenses',
        description: 'Day-to-day business costs from P&L',
        reportType: 'profit_loss',
      },
      {
        label: 'Bills & Payables',
        description: 'Actual bills and payments from AP',
        reportType: 'bills',
      },
    ],
  },
  profit: {
    term: 'profit',
    options: [
      {
        label: 'Gross Profit',
        description: 'Revenue minus Cost of Goods Sold',
        reportType: 'profit_loss',
      },
      {
        label: 'Net Profit (Net Income)',
        description: 'Bottom line after all expenses',
        reportType: 'profit_loss',
      },
    ],
  },
  cash: {
    term: 'cash',
    options: [
      {
        label: 'Cash Balance',
        description: 'Current cash on hand from Balance Sheet',
        reportType: 'balance_sheet',
      },
      {
        label: 'Cash Flow',
        description: 'Money moving in/out over time',
        reportType: 'cash_flow',
      },
    ],
  },
}
