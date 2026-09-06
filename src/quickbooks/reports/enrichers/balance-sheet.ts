/**
 * Balance Sheet Report Enricher
 *
 * Adds business logic and calculations to normalized Balance Sheet data:
 * - KPIs: currentRatio, quickRatio, debtToEquity, workingCapital
 * - ROA and ROE calculations (requires P&L data)
 * - Asset composition with percentages
 * - Liability breakdown with percentages
 * - Equity composition with percentages
 * - Current vs non-current classification
 * - Additional ratios: assetTurnover, equityMultiplier, debtRatio
 */

import {
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDebtToEquity,
  calculateROA,
  calculateROE,
  calculateWorkingCapital,
  calculateAssetTurnover,
  calculateEquityMultiplier,
  calculateDebtRatio,
  toTwoDecimals,
} from '@/lib/utils/financial/reportCalculations'

// ============================================================================
// Types
// ============================================================================

interface NormalizedBalanceSheet {
  reportDate: string
  total_assets: number
  total_liabilities: number
  total_equity: number
  // Pre-calculated current totals from transformer (preferred)
  current_assets?: number
  current_liabilities?: number
  assets: Array<{
    name: string
    value: number
    category?: string
    subCategory?: string
    classification?: 'current' | 'non-current'
    accountType?: string
  }>
  liabilities: Array<{
    name: string
    value: number
    category?: string
    subCategory?: string
    classification?: 'current' | 'non-current'
    accountType?: string
  }>
  equity: Array<{
    name: string
    value: number
  }>
  accounts_receivable?: number
  accounts_payable?: number
  cash_and_equivalents?: number
}

interface NormalizedProfitAndLoss {
  total_income: number
  net_income: number
}

interface PeriodAverages {
  avgAssets: number
  avgEquity: number
}

interface CompositionItem {
  name: string
  value: number
  percentage: number
  color: string
  classification?: 'current' | 'non-current'
  accountType?: string
  category?: string
  subCategory?: string
  type?: string
}

interface EnrichedBalanceSheet {
  reportType: 'balance_sheet'
  reportDate: string
  currency: string
  generated: string
  data: {
    kpis: {
      totalAssets: number
      totalLiabilities: number
      totalEquity: number
      workingCapital: number
      currentAssets: number
      currentLiabilities: number
      inventory: number
      currentRatio: number
      debtToEquity: number
      quickRatio: number
      roa: number
    }
    assetComposition: CompositionItem[]
    liabilityBreakdown: CompositionItem[]
    equityComposition: CompositionItem[]
    ratios: {
      assetTurnover: number
      equityMultiplier: number
      returnOnEquity: number
      debtRatio: number
      revenue: number
      netIncome: number
      totalDebt: number
    }
  }
}

// ============================================================================
// Classification Helpers
// ============================================================================

/**
 * Determine if an asset is current based on various properties
 */
function isCurrentAsset(account: {
  classification?: 'current' | 'non-current'
  accountType?: string
  category?: string
  subCategory?: string
}): boolean {
  // Primary: use normalized classification from parser
  if (account.classification) {
    return account.classification === 'current'
  }

  // Fallback 1: Check accountType (from Account entity query)
  const CURRENT_ASSET_TYPES = ['Bank', 'Accounts Receivable', 'Other Current Asset', 'Inventory']
  if (account.accountType && CURRENT_ASSET_TYPES.includes(account.accountType)) {
    return true
  }

  // Fallback 2: Keyword matching on category/subCategory
  const category = (account.category || '').toLowerCase()
  const subCategory = (account.subCategory || '').toLowerCase()

  const NON_CURRENT_CATEGORIES = [
    'fixed assets',
    'other assets',
    'non-current assets',
    'noncurrent',
    'property',
    'intangible',
    'long-term',
    'long term',
  ]

  const CURRENT_CATEGORIES = [
    'current assets',
    'bank accounts',
    'accounts receivable',
    'other current assets',
    'inventory',
  ]

  // First check if explicitly non-current
  const isNonCurrent = NON_CURRENT_CATEGORIES.some(
    (cat) => category.includes(cat) || subCategory.includes(cat)
  )
  if (isNonCurrent) return false

  // Then check if it's a current asset
  return CURRENT_CATEGORIES.some((cat) => category.includes(cat) || subCategory.includes(cat))
}

/**
 * Determine if a liability is current based on various properties
 */
function isCurrentLiability(account: {
  classification?: 'current' | 'non-current'
  accountType?: string
  category?: string
  subCategory?: string
}): boolean {
  // Primary: use normalized classification from parser
  if (account.classification) {
    return account.classification === 'current'
  }

  // Fallback 1: Check accountType
  const CURRENT_LIABILITY_TYPES = ['Accounts Payable', 'Credit Card', 'Other Current Liability']
  if (account.accountType && CURRENT_LIABILITY_TYPES.includes(account.accountType)) {
    return true
  }

  // Fallback 2: Keyword matching
  const category = (account.category || '').toLowerCase()
  const subCategory = (account.subCategory || '').toLowerCase()

  const LONG_TERM_CATEGORIES = [
    'long term liabilities',
    'long-term liabilities',
    'long term liability',
    'non-current liabilities',
    'noncurrent liabilities',
    'notes payable',
    'other long term',
    'mortgage',
    'bonds',
  ]

  const CURRENT_CATEGORIES = [
    'current liabilities',
    'accounts payable',
    'credit cards',
    'credit card',
    'other current liabilities',
    'payroll',
    'withholding',
    'payable',
  ]

  // First check if explicitly long-term
  const isLongTerm = LONG_TERM_CATEGORIES.some(
    (cat) => category.includes(cat) || subCategory.includes(cat)
  )
  if (isLongTerm) return false

  // Then check if it's a current liability
  return CURRENT_CATEGORIES.some((cat) => category.includes(cat) || subCategory.includes(cat))
}

/**
 * Extract inventory from balance sheet
 */
function calculateInventory(bsData: NormalizedBalanceSheet): number {
  return bsData.assets
    .filter((acc) => {
      const name = (acc.name || '').toLowerCase()
      return name.includes('inventory')
    })
    .reduce((sum, acc) => sum + Math.abs(acc.value || 0), 0)
}

/**
 * Calculate current assets total
 */
function calculateCurrentAssets(bsData: NormalizedBalanceSheet): number {
  // Use pre-calculated value from transformer if available (most accurate)
  if (bsData.current_assets !== undefined && bsData.current_assets !== null) {
    return bsData.current_assets
  }

  if (!bsData.assets || !Array.isArray(bsData.assets)) {
    // Fallback estimate: 40% of total assets
    return bsData.total_assets ? bsData.total_assets * 0.4 : 0
  }

  return bsData.assets
    .filter((acc) => isCurrentAsset(acc))
    .reduce((sum, acc) => sum + (acc.value || 0), 0)
}

/**
 * Calculate current liabilities total
 */
function calculateCurrentLiabilities(bsData: NormalizedBalanceSheet): number {
  // Use pre-calculated value from transformer if available (most accurate)
  if (bsData.current_liabilities !== undefined && bsData.current_liabilities !== null) {
    return bsData.current_liabilities
  }

  if (!bsData.liabilities || !Array.isArray(bsData.liabilities)) {
    // Fallback estimate: 50% of total liabilities
    return bsData.total_liabilities ? bsData.total_liabilities * 0.5 : 0
  }

  return bsData.liabilities
    .filter((acc) => isCurrentLiability(acc))
    .reduce((sum, acc) => sum + Math.abs(acc.value || 0), 0)
}

// ============================================================================
// Composition Builders
// ============================================================================

/**
 * Build asset composition with percentages and metadata
 */
function buildAssetComposition(bsData: NormalizedBalanceSheet): CompositionItem[] {
  if (!bsData.assets || bsData.assets.length === 0) {
    return []
  }

  // Calculate total using absolute values for percentage calculation
  const total =
    Math.abs(bsData.total_assets) ||
    bsData.assets.reduce((sum, acc) => sum + Math.abs(acc.value), 0)

  return bsData.assets.map((account) => ({
    name: account.name,
    value: toTwoDecimals(account.value),
    percentage: toTwoDecimals(total > 0 ? (Math.abs(account.value) / total) * 100 : 0),
    color: '#10b981', // Emerald/green for all assets
    classification: account.classification,
    accountType: account.accountType,
    category: account.category,
    subCategory: account.subCategory,
  }))
}

/**
 * Build liability breakdown with percentages and metadata
 */
function buildLiabilityBreakdown(bsData: NormalizedBalanceSheet): CompositionItem[] {
  if (!bsData.liabilities || bsData.liabilities.length === 0) {
    return []
  }

  // Calculate total using absolute values
  const total =
    Math.abs(bsData.total_liabilities) ||
    bsData.liabilities.reduce((sum, acc) => sum + Math.abs(acc.value), 0)

  return bsData.liabilities.map((account) => ({
    name: account.name,
    value: toTwoDecimals(account.value),
    percentage: toTwoDecimals(total > 0 ? (Math.abs(account.value) / total) * 100 : 0),
    type: 'liability',
    color: '#ef4444', // Red for all liabilities
    classification: account.classification,
    accountType: account.accountType,
    category: account.category,
    subCategory: account.subCategory,
  }))
}

/**
 * Build equity composition with percentages
 */
function buildEquityComposition(bsData: NormalizedBalanceSheet): CompositionItem[] {
  if (!bsData.equity || bsData.equity.length === 0) {
    return []
  }

  // Calculate total using absolute values
  const total =
    Math.abs(bsData.total_equity) ||
    bsData.equity.reduce((sum, acc) => sum + Math.abs(acc.value), 0)

  return bsData.equity.map((account) => ({
    name: account.name,
    value: toTwoDecimals(account.value),
    percentage: toTwoDecimals(total > 0 ? (Math.abs(account.value) / total) * 100 : 0),
    color: '#3b82f6', // Blue for equity
  }))
}

// ============================================================================
// Main Enricher Function
// ============================================================================

/**
 * Enrich normalized Balance Sheet with business logic and calculations
 *
 * @param bsData - Normalized balance sheet from transformBalanceSheet
 * @param plData - Optional P&L data for ROA/ROE calculations
 * @param currency - Currency code (default: USD)
 * @param periodAverages - Optional period averages for GAAP-compliant ROA/ROE calculation
 * @returns Enriched balance sheet matching frontend expectations
 */
export function enrichBalanceSheet(
  bsData: NormalizedBalanceSheet,
  plData?: NormalizedProfitAndLoss,
  currency: string = 'USD',
  periodAverages?: PeriodAverages
): EnrichedBalanceSheet {
  // Calculate current assets/liabilities
  const currentAssets = calculateCurrentAssets(bsData)
  const currentLiabilities = calculateCurrentLiabilities(bsData)
  const inventory = calculateInventory(bsData)

  // Calculate KPIs
  const workingCapital = calculateWorkingCapital(currentAssets, currentLiabilities)
  const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities)
  const quickRatio = calculateQuickRatio(currentAssets, inventory, currentLiabilities)
  const debtToEquity = calculateDebtToEquity(bsData.total_liabilities, bsData.total_equity)

  /**
   * ROA/ROE GAAP Compliance - Period Averages
   * ==========================================
   *
   * GAAP-compliant implementation using period averages:
   * - Formula: ROA = Net Income / Average Total Assets
   * - Formula: ROE = Net Income / Average Total Equity
   * - Where: Average = (Beginning Balance + Ending Balance) / 2
   *
   * Falls back to point-in-time if averages not provided
   */

  // Calculate ROA and ROE if P&L data provided
  const netIncome = plData?.net_income || 0

  // Use period averages if provided (GAAP-compliant), otherwise use point-in-time
  const assetsForROA = periodAverages?.avgAssets ?? bsData.total_assets
  const equityForROE = periodAverages?.avgEquity ?? bsData.total_equity

  const roa = calculateROA(netIncome, assetsForROA)
  const roe = calculateROE(netIncome, equityForROE)

  // Build composition arrays
  const assetComposition = buildAssetComposition(bsData)
  const liabilityBreakdown = buildLiabilityBreakdown(bsData)
  const equityComposition = buildEquityComposition(bsData)

  // Recalculate totals from composition if parser returned 0
  // This handles cases where QuickBooks doesn't include summary rows
  let finalTotalAssets = bsData.total_assets || 0
  let finalTotalLiabilities = bsData.total_liabilities || 0
  let finalTotalEquity = bsData.total_equity || 0

  if (finalTotalAssets === 0 && assetComposition.length > 0) {
    finalTotalAssets = assetComposition.reduce((sum, acc) => sum + (acc.value || 0), 0)
  }

  if (finalTotalLiabilities === 0 && liabilityBreakdown.length > 0) {
    finalTotalLiabilities = liabilityBreakdown.reduce((sum, acc) => sum + (acc.value || 0), 0)
  }

  if (finalTotalEquity === 0 && equityComposition.length > 0) {
    finalTotalEquity = equityComposition.reduce((sum, acc) => sum + (acc.value || 0), 0)
  }

  // Calculate additional ratios
  const revenue = plData?.total_income || 0
  const assetTurnover = calculateAssetTurnover(revenue, finalTotalAssets)
  const equityMultiplier = calculateEquityMultiplier(finalTotalAssets, finalTotalEquity)
  const debtRatio = calculateDebtRatio(finalTotalLiabilities, finalTotalAssets)

  return {
    reportType: 'balance_sheet',
    reportDate: bsData.reportDate,
    currency,
    generated: new Date().toISOString(),
    data: {
      kpis: {
        totalAssets: toTwoDecimals(finalTotalAssets),
        totalLiabilities: toTwoDecimals(finalTotalLiabilities),
        totalEquity: toTwoDecimals(finalTotalEquity),
        workingCapital: toTwoDecimals(workingCapital),
        currentAssets: toTwoDecimals(currentAssets),
        currentLiabilities: toTwoDecimals(currentLiabilities),
        inventory: toTwoDecimals(inventory),
        currentRatio: toTwoDecimals(currentRatio),
        debtToEquity: toTwoDecimals(debtToEquity),
        quickRatio: toTwoDecimals(quickRatio),
        roa: toTwoDecimals(roa),
      },
      assetComposition: assetComposition.length > 0 ? assetComposition : [],
      liabilityBreakdown: liabilityBreakdown.length > 0 ? liabilityBreakdown : [],
      equityComposition: equityComposition.length > 0 ? equityComposition : [],
      ratios: {
        assetTurnover: toTwoDecimals(assetTurnover),
        equityMultiplier: toTwoDecimals(equityMultiplier),
        returnOnEquity: toTwoDecimals(roe),
        debtRatio: toTwoDecimals(debtRatio),
        revenue: toTwoDecimals(revenue),
        netIncome: toTwoDecimals(netIncome),
        totalDebt: toTwoDecimals(finalTotalLiabilities),
      },
    },
  }
}
