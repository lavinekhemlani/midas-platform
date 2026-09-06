/**
 * Configuration for AI Analysis across different page types
 * Centralized config following DRY principle
 */

import { AIAnalysisConfig, PageType, AnalysisType } from './types'

export const AI_ANALYSIS_CONFIGS: Record<PageType, AIAnalysisConfig> = {
  pnl: {
    pageType: 'pnl',
    displayName: 'P&L Analysis',
    analysisType: 'PNL_ANALYSIS',
    cacheTTL: 15,
    description: 'Profit & Loss Statement insights',
    focusAreas: [
      'Revenue trends and growth drivers',
      'Expense efficiency and cost optimization',
      'Gross margin and operating margin analysis',
      'Unit economics and profitability metrics',
      'Revenue mix and customer segment performance',
    ],
  },

  cashflow: {
    pageType: 'cashflow',
    displayName: 'Cash Flow Analysis',
    analysisType: 'CASHFLOW_ANALYSIS',
    cacheTTL: 15,
    description: 'Cash flow and liquidity insights',
    focusAreas: [
      'Operating cash flow trends and sustainability',
      'Working capital efficiency (DSO, DIO, DPO)',
      'Burn rate and runway calculations',
      'Cash conversion cycle optimization',
      'Investment and financing activity impact',
    ],
  },

  balancesheet: {
    pageType: 'balancesheet',
    displayName: 'Balance Sheet Analysis',
    analysisType: 'BALANCE_SHEET_ANALYSIS',
    cacheTTL: 15,
    description: 'Balance sheet and financial position insights',
    focusAreas: [
      'Asset utilization and efficiency',
      'Liability structure and obligations',
      'Equity position and capital structure',
      'Liquidity ratios (current, quick)',
      'Leverage and solvency metrics',
    ],
  },

  sales: {
    pageType: 'sales',
    displayName: 'Sales Analysis',
    analysisType: 'SALES_ANALYSIS',
    cacheTTL: 15,
    description: 'Sales performance and customer insights',
    focusAreas: [
      'Sales growth and momentum trends',
      'Customer acquisition and retention patterns',
      'Average deal size and sales velocity',
      'Sales pipeline efficiency',
      'Revenue concentration and diversification',
    ],
  },

  expenses: {
    pageType: 'expenses',
    displayName: 'Expenses Analysis',
    analysisType: 'EXPENSES_ANALYSIS',
    cacheTTL: 15,
    description: 'Expense management and optimization insights',
    focusAreas: [
      'Expense category trends and patterns',
      'Cost structure and fixed vs variable costs',
      'Spending efficiency and ROI by category',
      'Budget variance and forecasting accuracy',
      'Expense optimization opportunities',
    ],
  },

  journal: {
    pageType: 'journal',
    displayName: 'Journal Analysis',
    analysisType: 'JOURNAL_ANALYSIS',
    cacheTTL: 15,
    description: 'Transaction patterns and accounting insights',
    focusAreas: [
      'Transaction volume and patterns',
      'Account activity and trends',
      'Unusual or anomalous entries',
      'Journal entry accuracy and completeness',
      'Month-end close efficiency',
    ],
  },

  summary: {
    pageType: 'summary',
    displayName: 'Executive Summary',
    analysisType: 'EXEC_SUMMARY',
    cacheTTL: 15,
    description: 'Strategic executive summary and comprehensive financial insights',
    focusAreas: [
      'Overall financial health and performance trajectory',
      'Cross-functional trend analysis and correlations',
      'Strategic priorities and critical action items',
      'Forward-looking predictions and scenario analysis',
      'Holistic business insights and strategic recommendations',
    ],
  },
}

export function getAnalysisConfig(pageType: PageType): AIAnalysisConfig {
  const config = AI_ANALYSIS_CONFIGS[pageType]
  if (!config) {
    throw new Error(`Invalid page type: ${pageType}`)
  }
  return config
}

export function getAnalysisTypeFromPageType(pageType: PageType): AnalysisType {
  return getAnalysisConfig(pageType).analysisType
}

export function getCacheTTL(pageType: PageType): number {
  return getAnalysisConfig(pageType).cacheTTL
}
