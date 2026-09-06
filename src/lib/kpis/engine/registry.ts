import { KPIDefinition, KPIId, KPICategory } from '../types'
import * as revenue from '../formulas/revenue'
import * as profitability from '../formulas/profitability'
import * as cashflow from '../formulas/cashflow'
import * as liquidity from '../formulas/liquidity'
import * as efficiency from '../formulas/efficiency'
import * as balance from '../formulas/balance'
import * as receivables from '../formulas/receivables'
import * as payables from '../formulas/payables'

/**
 * Registry of all KPI definitions
 * See: docs/api-v2/kpi-definitions/catalog.md
 */
export const KPI_REGISTRY: Record<KPIId, KPIDefinition> = {
  // ========== Revenue Metrics ==========
  revenue: {
    id: 'revenue',
    name: 'Revenue',
    displayName: 'Total Revenue',
    category: 'revenue',
    format: 'currency',
    precision: 2,
    calculate: revenue.calculateRevenue,
    dataSources: ['pnl', 'invoices', 'deposits'],
    description: 'Total income for the period',
    quickbooksField: 'total_income',
  },
  arr: {
    id: 'arr',
    name: 'ARR',
    displayName: 'Annual Recurring Revenue',
    category: 'revenue',
    format: 'currency',
    precision: 2,
    calculate: revenue.calculateARR,
    dataSources: ['pnl', 'invoices', 'deposits'],
    description: 'Annualized recurring revenue based on current period',
    benchmark: {
      good: 1000000, // $1M ARR
      average: 500000,
      poor: 100000,
    },
  },
  mrr: {
    id: 'mrr',
    name: 'MRR',
    displayName: 'Monthly Recurring Revenue',
    category: 'revenue',
    format: 'currency',
    precision: 2,
    calculate: revenue.calculateMRR,
    dataSources: ['pnl', 'invoices', 'deposits'],
    description: 'Monthly recurring revenue',
    benchmark: {
      good: 83333, // $1M ARR / 12
      average: 41666,
      poor: 8333,
    },
  },
  revenue_growth: {
    id: 'revenue_growth',
    name: 'Revenue Growth',
    displayName: 'Revenue Growth Rate',
    category: 'revenue',
    format: 'percentage',
    precision: 1,
    calculate: (data) => revenue.calculateRevenueGrowth(data),
    dataSources: ['pnl', 'invoices'],
    description: 'Period-over-period revenue growth rate',
    benchmark: {
      good: 20, // 20% growth
      average: 10,
      poor: 0,
    },
  },

  // ========== Profitability Metrics ==========
  total_expenses: {
    id: 'total_expenses',
    name: 'Total Expenses',
    displayName: 'Total Expenses',
    category: 'profitability',
    format: 'currency',
    precision: 2,
    calculate: profitability.calculateTotalExpenses,
    dataSources: ['pnl'],
    description: 'Total operating and non-operating expenses',
    quickbooksField: 'total_expenses',
  },
  gross_profit: {
    id: 'gross_profit',
    name: 'Gross Profit',
    displayName: 'Gross Profit',
    category: 'profitability',
    format: 'currency',
    precision: 2,
    calculate: profitability.calculateGrossProfit,
    dataSources: ['pnl'],
    description: 'Revenue minus cost of goods sold',
    quickbooksField: 'gross_profit',
  },
  gross_margin: {
    id: 'gross_margin',
    name: 'Gross Margin',
    displayName: 'Gross Margin %',
    category: 'profitability',
    format: 'percentage',
    precision: 1,
    calculate: profitability.calculateGrossMargin,
    dataSources: ['pnl'],
    description: 'Gross profit as percentage of revenue',
    benchmark: {
      good: 70, // 70% for SaaS
      average: 50,
      poor: 30,
    },
  },
  net_income: {
    id: 'net_income',
    name: 'Net Income',
    displayName: 'Net Income',
    category: 'profitability',
    format: 'currency',
    precision: 2,
    calculate: profitability.calculateNetIncome,
    dataSources: ['pnl'],
    description: 'Revenue minus all expenses',
    quickbooksField: 'net_income',
  },
  net_margin: {
    id: 'net_margin',
    name: 'Net Margin',
    displayName: 'Net Profit Margin %',
    category: 'profitability',
    format: 'percentage',
    precision: 1,
    calculate: profitability.calculateNetMargin,
    dataSources: ['pnl'],
    description: 'Net income as percentage of revenue',
    benchmark: {
      good: 20,
      average: 10,
      poor: 0,
    },
  },
  ebitda: {
    id: 'ebitda',
    name: 'EBITDA',
    displayName: 'EBITDA',
    category: 'profitability',
    format: 'currency',
    precision: 2,
    calculate: profitability.calculateEBITDA,
    dataSources: ['pnl'],
    description: 'Earnings before interest, taxes, depreciation, and amortization',
  },
  ebitda_margin: {
    id: 'ebitda_margin',
    name: 'EBITDA Margin',
    displayName: 'EBITDA Margin %',
    category: 'profitability',
    format: 'percentage',
    precision: 1,
    calculate: profitability.calculateEBITDAMargin,
    dataSources: ['pnl'],
    description: 'EBITDA as percentage of revenue',
    benchmark: {
      good: 30,
      average: 15,
      poor: 5,
    },
  },

  // ========== Cash Flow Metrics ==========
  investing_cash_flow: {
    id: 'investing_cash_flow',
    name: 'Investing Cash Flow',
    displayName: 'Investing Cash Flow',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateInvestingCashFlow,
    dataSources: ['cashflow'],
    description: 'Cash used in investing activities',
    quickbooksField: 'net_cash_from_investing_activities',
  },
  financing_cash_flow: {
    id: 'financing_cash_flow',
    name: 'Financing Cash Flow',
    displayName: 'Financing Cash Flow',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateFinancingCashFlow,
    dataSources: ['cashflow'],
    description: 'Cash from financing activities',
    quickbooksField: 'net_cash_from_financing_activities',
  },
  net_cash_flow: {
    id: 'net_cash_flow',
    name: 'Net Cash Flow',
    displayName: 'Net Cash Flow',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateNetCashFlow,
    dataSources: ['cashflow'],
    description: 'Total change in cash position',
  },
  beginning_cash: {
    id: 'beginning_cash',
    name: 'Beginning Cash',
    displayName: 'Beginning Cash Balance',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateBeginningCash,
    dataSources: ['cashflow'],
    description: 'Cash balance at period start',
    quickbooksField: 'cash_at_beginning',
  },
  days_cash: {
    id: 'days_cash',
    name: 'Days Cash',
    displayName: 'Days Cash on Hand',
    category: 'cashflow',
    format: 'days',
    precision: 0,
    calculate: cashflow.calculateDaysCash,
    dataSources: ['cashflow', 'balanceSheet', 'pnl'],
    description: 'Days of operations covered by current cash',
    benchmark: {
      good: 180,
      average: 90,
      poor: 30,
    },
  },
  operating_cash_flow: {
    id: 'operating_cash_flow',
    name: 'Operating Cash Flow',
    displayName: 'Operating Cash Flow',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateOperatingCashFlow,
    dataSources: ['cashflow', 'pnl'],
    description: 'Cash generated from operations',
    quickbooksField: 'net_cash_from_operating_activities',
  },
  free_cash_flow: {
    id: 'free_cash_flow',
    name: 'Free Cash Flow',
    displayName: 'Free Cash Flow',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateFreeCashFlow,
    dataSources: ['cashflow', 'pnl'],
    description: 'Operating cash flow minus capital expenditures',
  },
  burn_rate: {
    id: 'burn_rate',
    name: 'Burn Rate',
    displayName: 'Monthly Burn Rate',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateBurnRate,
    dataSources: ['pnl'],
    description: 'Monthly cash consumption rate',
    benchmark: {
      good: 25000, // Lower burn is better
      average: 50000,
      poor: 100000,
    },
  },
  runway_months: {
    id: 'runway_months',
    name: 'Runway',
    displayName: 'Cash Runway',
    category: 'cashflow',
    format: 'months',
    precision: 0,
    calculate: cashflow.calculateRunway,
    dataSources: ['cashflow', 'balanceSheet', 'pnl', 'bankAccounts'],
    description: 'Months of cash remaining at current burn rate',
    benchmark: {
      good: 18,
      average: 12,
      poor: 6,
    },
  },
  cash_balance: {
    id: 'cash_balance',
    name: 'Cash Balance',
    displayName: 'Cash Balance',
    category: 'cashflow',
    format: 'currency',
    precision: 2,
    calculate: cashflow.calculateCashBalance,
    dataSources: ['cashflow', 'balanceSheet', 'bankAccounts'],
    description: 'Current cash and cash equivalents',
    quickbooksField: 'cash_at_end',
  },

  // ========== Liquidity Metrics ==========
  current_ratio: {
    id: 'current_ratio',
    name: 'Current Ratio',
    displayName: 'Current Ratio',
    category: 'liquidity',
    format: 'ratio',
    precision: 2,
    calculate: liquidity.calculateCurrentRatio,
    dataSources: ['balanceSheet'],
    description: 'Current assets divided by current liabilities',
    benchmark: {
      good: 2.0,
      average: 1.5,
      poor: 1.0,
    },
  },
  quick_ratio: {
    id: 'quick_ratio',
    name: 'Quick Ratio',
    displayName: 'Quick Ratio',
    category: 'liquidity',
    format: 'ratio',
    precision: 2,
    calculate: liquidity.calculateQuickRatio,
    dataSources: ['balanceSheet'],
    description: 'Liquid assets divided by current liabilities',
    benchmark: {
      good: 1.5,
      average: 1.0,
      poor: 0.5,
    },
  },
  working_capital: {
    id: 'working_capital',
    name: 'Working Capital',
    displayName: 'Working Capital',
    category: 'liquidity',
    format: 'currency',
    precision: 2,
    calculate: liquidity.calculateWorkingCapital,
    dataSources: ['balanceSheet'],
    description: 'Current assets minus current liabilities',
  },
  working_capital_ratio: {
    id: 'working_capital_ratio',
    name: 'Working Capital Ratio',
    displayName: 'Working Capital Ratio %',
    category: 'liquidity',
    format: 'percentage',
    precision: 1,
    calculate: liquidity.calculateWorkingCapitalRatio,
    dataSources: ['balanceSheet'],
    description: 'Working capital as percentage of current assets',
    benchmark: {
      good: 40,
      average: 20,
      poor: 0,
    },
  },

  // ========== Efficiency Metrics ==========
  dso: {
    id: 'dso',
    name: 'DSO',
    displayName: 'Days Sales Outstanding',
    category: 'efficiency',
    format: 'days',
    precision: 0,
    calculate: efficiency.calculateDSO,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Average days to collect payment after a sale',
    benchmark: {
      good: 30,
      average: 45,
      poor: 60,
    },
  },
  dpo: {
    id: 'dpo',
    name: 'DPO',
    displayName: 'Days Payable Outstanding',
    category: 'efficiency',
    format: 'days',
    precision: 0,
    calculate: efficiency.calculateDPO,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Average days to pay suppliers',
    benchmark: {
      good: 45,
      average: 30,
      poor: 15,
    },
  },
  dio: {
    id: 'dio',
    name: 'DIO',
    displayName: 'Days Inventory Outstanding',
    category: 'efficiency',
    format: 'days',
    precision: 0,
    calculate: efficiency.calculateDIO,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Average days inventory is held before sale',
    benchmark: {
      good: 30,
      average: 60,
      poor: 90,
    },
  },
  cash_conversion_cycle: {
    id: 'cash_conversion_cycle',
    name: 'CCC',
    displayName: 'Cash Conversion Cycle',
    category: 'efficiency',
    format: 'days',
    precision: 0,
    calculate: efficiency.calculateCashConversionCycle,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Days between paying for inventory and collecting cash from sales',
    benchmark: {
      good: 30,
      average: 60,
      poor: 90,
    },
  },

  // ========== Balance Sheet Metrics ==========
  total_assets: {
    id: 'total_assets',
    name: 'Total Assets',
    displayName: 'Total Assets',
    category: 'balance_sheet',
    format: 'currency',
    precision: 2,
    calculate: balance.calculateTotalAssets,
    dataSources: ['balanceSheet'],
    description: 'Sum of all company assets',
    quickbooksField: 'total_assets',
  },
  total_liabilities: {
    id: 'total_liabilities',
    name: 'Total Liabilities',
    displayName: 'Total Liabilities',
    category: 'balance_sheet',
    format: 'currency',
    precision: 2,
    calculate: balance.calculateTotalLiabilities,
    dataSources: ['balanceSheet'],
    description: 'Sum of all company liabilities',
    quickbooksField: 'total_liabilities',
  },
  total_equity: {
    id: 'total_equity',
    name: 'Total Equity',
    displayName: 'Total Equity',
    category: 'balance_sheet',
    format: 'currency',
    precision: 2,
    calculate: balance.calculateTotalEquity,
    dataSources: ['balanceSheet'],
    description: 'Total shareholder equity',
    quickbooksField: 'total_equity',
  },
  debt_to_equity: {
    id: 'debt_to_equity',
    name: 'D/E Ratio',
    displayName: 'Debt-to-Equity Ratio',
    category: 'balance_sheet',
    format: 'ratio',
    precision: 2,
    calculate: balance.calculateDebtToEquity,
    dataSources: ['balanceSheet'],
    description: 'Total liabilities divided by total equity',
    benchmark: {
      good: 0.5,
      average: 1.0,
      poor: 2.0,
    },
  },
  roa: {
    id: 'roa',
    name: 'ROA',
    displayName: 'Return on Assets %',
    category: 'balance_sheet',
    format: 'percentage',
    precision: 1,
    calculate: balance.calculateROA,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Net income as percentage of total assets',
    benchmark: {
      good: 10,
      average: 5,
      poor: 0,
    },
  },
  roe: {
    id: 'roe',
    name: 'ROE',
    displayName: 'Return on Equity %',
    category: 'balance_sheet',
    format: 'percentage',
    precision: 1,
    calculate: balance.calculateROE,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Net income as percentage of total equity',
    benchmark: {
      good: 20,
      average: 15,
      poor: 10,
    },
  },
  asset_turnover: {
    id: 'asset_turnover',
    name: 'Asset Turnover',
    displayName: 'Asset Turnover Ratio',
    category: 'balance_sheet',
    format: 'ratio',
    precision: 2,
    calculate: balance.calculateAssetTurnover,
    dataSources: ['balanceSheet', 'pnl'],
    description: 'Revenue generated per dollar of assets',
    benchmark: {
      good: 2.0,
      average: 1.0,
      poor: 0.5,
    },
  },
  equity_multiplier: {
    id: 'equity_multiplier',
    name: 'Equity Multiplier',
    displayName: 'Equity Multiplier',
    category: 'balance_sheet',
    format: 'ratio',
    precision: 2,
    calculate: balance.calculateEquityMultiplier,
    dataSources: ['balanceSheet'],
    description: 'Assets divided by equity (financial leverage)',
    benchmark: {
      good: 1.5,
      average: 2.0,
      poor: 3.0,
    },
  },

  // ========== Receivables Metrics ==========
  receivables_outstanding: {
    id: 'receivables_outstanding',
    name: 'Receivables Outstanding',
    displayName: 'Total Receivables',
    category: 'receivables',
    format: 'currency',
    precision: 2,
    calculate: receivables.calculateReceivablesOutstanding,
    dataSources: ['agedReceivables', 'balanceSheet'],
    description: 'Total outstanding customer receivables',
  },
  receivables_overdue: {
    id: 'receivables_overdue',
    name: 'Receivables Overdue',
    displayName: 'Overdue Receivables',
    category: 'receivables',
    format: 'currency',
    precision: 2,
    calculate: receivables.calculateReceivablesOverdue,
    dataSources: ['agedReceivables'],
    description: 'Receivables past 30 days',
  },
  receivables_past_due_pct: {
    id: 'receivables_past_due_pct',
    name: 'Past Due %',
    displayName: 'Receivables Past Due %',
    category: 'receivables',
    format: 'percentage',
    precision: 1,
    calculate: receivables.calculateReceivablesPastDuePercentage,
    dataSources: ['agedReceivables'],
    description: 'Percentage of receivables overdue',
    benchmark: {
      good: 10,
      average: 25,
      poor: 40,
    },
  },
  receivables_current_pct: {
    id: 'receivables_current_pct',
    name: 'Current %',
    displayName: 'Current Receivables %',
    category: 'receivables',
    format: 'percentage',
    precision: 1,
    calculate: receivables.calculateReceivablesCurrentPercentage,
    dataSources: ['agedReceivables'],
    description: 'Percentage of receivables current',
    benchmark: {
      good: 80,
      average: 60,
      poor: 40,
    },
  },
  receivables_90_plus_pct: {
    id: 'receivables_90_plus_pct',
    name: '90+ Days %',
    displayName: 'Receivables 90+ Days %',
    category: 'receivables',
    format: 'percentage',
    precision: 1,
    calculate: receivables.calculateReceivables90PlusPercentage,
    dataSources: ['agedReceivables'],
    description: 'Percentage over 90 days old',
    benchmark: {
      good: 5,
      average: 10,
      poor: 20,
    },
  },
  avg_invoice_size: {
    id: 'avg_invoice_size',
    name: 'Avg Invoice Size',
    displayName: 'Average Invoice Size',
    category: 'receivables',
    format: 'currency',
    precision: 2,
    calculate: receivables.calculateAverageInvoiceSize,
    dataSources: ['invoices', 'agedReceivables'],
    description: 'Average value per invoice',
  },
  customer_count: {
    id: 'customer_count',
    name: 'Customer Count',
    displayName: 'Active Customers',
    category: 'receivables',
    format: 'number',
    precision: 0,
    calculate: receivables.calculateCustomerCount,
    dataSources: ['agedReceivables', 'invoices'],
    description: 'Number of customers with outstanding balances',
  },
  collection_efficiency: {
    id: 'collection_efficiency',
    name: 'Collection Efficiency',
    displayName: 'Collection Efficiency',
    category: 'receivables',
    format: 'percentage',
    precision: 1,
    calculate: receivables.calculateCollectionEfficiency,
    dataSources: ['agedReceivables'],
    description: 'Effectiveness of collections process',
    benchmark: {
      good: 90,
      average: 70,
      poor: 50,
    },
  },

  // ========== Payables Metrics ==========
  payables_outstanding: {
    id: 'payables_outstanding',
    name: 'Payables Outstanding',
    displayName: 'Total Payables',
    category: 'payables',
    format: 'currency',
    precision: 2,
    calculate: payables.calculatePayablesOutstanding,
    dataSources: ['agedPayables', 'balanceSheet'],
    description: 'Total outstanding vendor payables',
  },
  payables_overdue: {
    id: 'payables_overdue',
    name: 'Payables Overdue',
    displayName: 'Overdue Payables',
    category: 'payables',
    format: 'currency',
    precision: 2,
    calculate: payables.calculatePayablesOverdue,
    dataSources: ['agedPayables'],
    description: 'Payables past 30 days',
  },
  payables_past_due_pct: {
    id: 'payables_past_due_pct',
    name: 'Past Due %',
    displayName: 'Payables Past Due %',
    category: 'payables',
    format: 'percentage',
    precision: 1,
    calculate: payables.calculatePayablesPastDuePercentage,
    dataSources: ['agedPayables'],
    description: 'Percentage of payables overdue',
    benchmark: {
      good: 15,
      average: 30,
      poor: 50,
    },
  },
  payables_current_pct: {
    id: 'payables_current_pct',
    name: 'Current %',
    displayName: 'Current Payables %',
    category: 'payables',
    format: 'percentage',
    precision: 1,
    calculate: payables.calculatePayablesCurrentPercentage,
    dataSources: ['agedPayables'],
    description: 'Percentage of payables current',
    benchmark: {
      good: 75,
      average: 60,
      poor: 40,
    },
  },
  payables_90_plus_pct: {
    id: 'payables_90_plus_pct',
    name: '90+ Days %',
    displayName: 'Payables 90+ Days %',
    category: 'payables',
    format: 'percentage',
    precision: 1,
    calculate: payables.calculatePayables90PlusPercentage,
    dataSources: ['agedPayables'],
    description: 'Percentage over 90 days old',
    benchmark: {
      good: 5,
      average: 15,
      poor: 30,
    },
  },
  avg_bill_size: {
    id: 'avg_bill_size',
    name: 'Avg Bill Size',
    displayName: 'Average Bill Size',
    category: 'payables',
    format: 'currency',
    precision: 2,
    calculate: payables.calculateAverageBillSize,
    dataSources: ['bills', 'agedPayables'],
    description: 'Average value per bill',
  },
  vendor_count: {
    id: 'vendor_count',
    name: 'Vendor Count',
    displayName: 'Active Vendors',
    category: 'payables',
    format: 'number',
    precision: 0,
    calculate: payables.calculateVendorCount,
    dataSources: ['agedPayables', 'bills'],
    description: 'Number of vendors with outstanding balances',
  },
  payment_efficiency: {
    id: 'payment_efficiency',
    name: 'Payment Efficiency',
    displayName: 'Payment Efficiency',
    category: 'payables',
    format: 'percentage',
    precision: 1,
    calculate: payables.calculatePaymentEfficiency,
    dataSources: ['agedPayables'],
    description: 'Balance between cash flow management and vendor relationships',
    benchmark: {
      good: 85,
      average: 70,
      poor: 50,
    },
  },
}

/**
 * Get KPI definition by ID
 */
export function getKPIDefinition(id: KPIId): KPIDefinition {
  const definition = KPI_REGISTRY[id]
  if (!definition) {
    throw new Error(`Unknown KPI: ${id}`)
  }
  return definition
}

/**
 * Get all KPIs for a category
 */
export function getKPIsByCategory(category: KPICategory): KPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.category === category)
}

/**
 * Get all available KPI IDs
 */
export function getAllKPIIds(): KPIId[] {
  return Object.keys(KPI_REGISTRY) as KPIId[]
}

/**
 * Get KPIs by data source
 */
export function getKPIsByDataSource(dataSource: string): KPIDefinition[] {
  return Object.values(KPI_REGISTRY).filter((kpi) => kpi.dataSources.includes(dataSource))
}

/**
 * Get essential KPIs for dashboard
 */
export function getDashboardKPIs(): KPIId[] {
  return [
    'revenue',
    'arr',
    'gross_margin',
    'net_margin',
    'burn_rate',
    'runway_months',
    'cash_balance',
    'current_ratio',
  ]
}

/**
 * Get KPIs that require comparison data
 */
export function getComparativeKPIs(): KPIId[] {
  return ['revenue_growth']
}
