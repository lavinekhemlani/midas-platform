/**
 * Profit & Loss Report Enricher
 *
 * Takes normalized P&L data and enriches it with all business logic:
 * - KPIs (profit margin, expense ratio, gross margin, operating margin)
 * - EBITDA calculations
 * - Burn rate and runway
 * - Revenue by category with contra-revenue detection
 * - Expense categories by section (COGS, Operating, Other)
 * - Detailed statement with variance analysis
 * - Insights generation
 */

import {
  calculateProfitMargin,
  calculateExpenseRatio,
  calculateGrossMargin,
  calculateOperatingMargin,
  calculateTotalExpenses,
  toTwoDecimals,
} from '@/lib/utils/financial/reportCalculations'
import { getCashAndEquivalents } from '@/quickbooks/utils/accounts'
import {
  extractEBITDAComponents,
  reconcilePnLData,
  generatePnLInsights,
  generatePnLDetailedStatement,
} from '@/quickbooks/utils/report-helpers'

/**
 * Hierarchy item structure for nested P&L display
 * Matches the structure used by Balance Sheet for consistency
 */
interface EnrichedHierarchyItem {
  name: string
  fullPath: string
  total: number
  ownValue?: number // Value of this account itself (not including children)
  level: number
  accountId?: string
  children: EnrichedHierarchyItem[]
}

/**
 * Build hierarchy directly from the level-based structure in P&L lines
 * QuickBooks already provides proper nesting via the `level` property:
 * - Parent accounts at level 1 (e.g., "4000 Done For You")
 * - Child accounts at level 2+ (e.g., "4010 Rocketship")
 * - Summary rows marked with isSummary: true
 */
function buildHierarchyFromLevels(
  lines: Array<{
    name: string
    value?: number
    total?: number
    level?: number
    accountId?: string
    isSummary?: boolean
  }>
): EnrichedHierarchyItem[] {
  // Filter out summary rows and zero-value parent placeholders
  const dataLines = lines.filter((line) => {
    // Skip summary rows (Total X)
    if (line.isSummary) return false
    // Skip section headers like "Income", "Expenses" at level 0
    if ((line.level ?? 0) === 0) return false
    return true
  })

  if (dataLines.length === 0) return []

  // Build tree using a stack-based approach
  const roots: EnrichedHierarchyItem[] = []
  const stack: EnrichedHierarchyItem[] = []

  for (const line of dataLines) {
    const level = (line.level ?? 1) - 1 // Adjust level (QB uses 1-based for first real items)
    const value = line.value ?? line.total ?? 0

    const node: EnrichedHierarchyItem = {
      name: line.name,
      fullPath: line.name,
      total: value,
      ownValue: value,
      level: level,
      accountId: line.accountId,
      children: [],
    }

    // Pop stack until we find the parent level
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      // This is a root node
      roots.push(node)
    } else {
      // Add as child of current parent
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      node.fullPath = `${parent.fullPath}:${line.name}`
    }

    // Push this node as potential parent for next items
    stack.push(node)
  }

  // Calculate totals recursively
  // In QuickBooks P&L reports, parent account values represent DIRECT transactions in that account
  // Children values represent transactions in sub-accounts
  // Total = parent's own value + sum of children values
  function calculateTotals(node: EnrichedHierarchyItem): number {
    if (node.children.length === 0) {
      // Leaf node: use its own value
      return node.total
    }

    // Parent node with children: total = own value + children total
    const childrenTotal = node.children.reduce((sum, child) => sum + calculateTotals(child), 0)
    node.total = (node.ownValue ?? 0) + childrenTotal
    return node.total
  }

  roots.forEach(calculateTotals)

  console.log(
    `[buildHierarchyFromLevels] Built ${roots.length} root nodes from ${dataLines.length} lines`
  )

  return roots
}

/**
 * Enriched Profit & Loss Report Return Type
 */
interface EnrichedProfitAndLoss {
  reportType: string
  organizationId: string
  organizationName: string
  fromDate: string
  toDate: string
  currency: string
  generated: string
  data: {
    kpis: {
      totalRevenue: number
      totalExpenses: number
      netIncome: number
      profitMargin: number
      expenseRatio: number
      grossProfit: number
      costOfGoodsSold: number
      otherExpenses: number
      otherIncome: number
      operatingExpenses: number
      operatingIncome: number
      grossMargin: number
      operatingMargin: number
      interestExpense: number
      taxExpense: number
      depreciationAmortization: number
      ebitda: number
      burnRate: number
      monthsInPeriod: number
      grossBurnRate: number
      cashBalance: number
      netProfitMargin: number
      cogsRatio: number
      revenuePerMonth: number
      netBurnRate: number
    }
    revenueByCategory?: any[]
    revenueHierarchy?: EnrichedHierarchyItem[]
    otherIncomeByCategory?: any[]
    otherIncomeHierarchy?: EnrichedHierarchyItem[]
    expenseCategories?: any[]
    cogsHierarchy?: EnrichedHierarchyItem[]
    expenseHierarchy?: EnrichedHierarchyItem[]
    cogsHierarchy?: EnrichedHierarchyItem[] // Added this line
    detailedStatement: any
    insights: any
    metadata: {
      dataCompleteness: {
        hasRevenueCategoryData: boolean
        hasOtherIncomeCategoryData: boolean
        hasExpenseCategoryData: boolean
      }
      dataQuality: {
        isComplete: boolean
        hasPartialData: boolean
        errors: any[]
        warnings: any[]
      }
    }
  }
}

export async function enrichProfitAndLoss(
  normalizedData: any,
  organizationId: string,
  options: {
    includeDetails?: boolean
    startDate: string
    endDate: string
    currency?: string
    organizationName?: string
  } = {
    includeDetails: true,
    startDate: '',
    endDate: '',
  }
): Promise<EnrichedProfitAndLoss> {
  const {
    includeDetails = true,
    startDate,
    endDate,
    currency = 'USD',
    organizationName = 'Organization',
  } = options

  // Reconcile the data (detects and corrects double-counting issues)
  const validatedPL = reconcilePnLData(normalizedData)

  // Build revenue by category with contra-revenue detection and hierarchy info
  const revenueByCategory =
    validatedPL.income?.lines
      ?.map((item: any) => {
        const itemValue = item.value || 0
        // Contra-revenue accounts are identified by:
        // 1. Having a negative value in QuickBooks (most reliable)
        // 2. OR common naming patterns (fallback for edge cases)
        const hasNegativeValue = itemValue < 0
        const hasContraRevenueName =
          item.name?.toLowerCase().includes('discount') ||
          item.name?.toLowerCase().includes('refund') ||
          item.name?.toLowerCase().includes('allowance') ||
          item.name?.toLowerCase().includes('return') ||
          item.name?.toLowerCase().includes('contra')
        const isContraRevenue = hasNegativeValue || hasContraRevenueName
        return {
          name: item.name || 'Revenue',
          // Keep original value - don't modify with Math.abs
          // This preserves the sign from QuickBooks
          value: toTwoDecimals(itemValue),
          isContraRevenue,
          percentage: toTwoDecimals(
            validatedPL.total_income > 0
              ? (Math.abs(itemValue) / validatedPL.total_income) * 100
              : 0
          ),
          // Preserve hierarchy info from transformer (level property)
          level: item.level || 0,
          isSummary: item.isSummary || false,
          accountId: item.accountId,
        }
      })
      .filter((item: any) => item.value !== 0 && !item.isSummary) || [] // Filter out summary rows

  // Build other income categories (non-operating income: interest, exchange gains, etc.)
  const otherIncomeByCategory =
    validatedPL.otherIncome?.lines
      ?.map((item: any) => {
        const itemValue = item.value || 0
        return {
          name: item.name || 'Other Income',
          value: toTwoDecimals(itemValue),
          section: 'OtherIncome',
          percentage: toTwoDecimals(
            validatedPL.other_income > 0
              ? (Math.abs(itemValue) / validatedPL.other_income) * 100
              : 0
          ),
          // Preserve hierarchy info
          level: item.level || 0,
          isSummary: item.isSummary || false,
          accountId: item.accountId,
        }
      })
      .filter((item: any) => item.value !== 0 && !item.isSummary) || []

  // Calculate TRUE total expenses (COGS + Operating + Other)
  const trueTotalExpenses = calculateTotalExpenses(
    validatedPL.cogs_total || 0,
    validatedPL.total_expenses || 0,
    validatedPL.other_expenses || 0
  )

  // Build expense categories including COGS, Operating Expenses, AND Other Expenses
  // Preserve hierarchy info (level property) from transformer
  const expenseCategories = [
    // Add COGS items if available
    ...(validatedPL.costOfGoodsSold?.lines || [])
      .filter((item: any) => !item.isSummary)
      .map((item: any) => ({
        name: item.name || 'Cost of Goods Sold',
        section: 'COGS',
        amount: toTwoDecimals(Math.abs(item.value || 0)),
        percentage: toTwoDecimals(
          trueTotalExpenses > 0 ? (Math.abs(item.value || 0) / trueTotalExpenses) * 100 : 0
        ),
        level: item.level || 0,
        accountId: item.accountId,
      })),
    // Add Operating Expense items (NOT including Other Expenses)
    ...(validatedPL.expenses?.lines || [])
      .filter((item: any) => !item.isSummary)
      .map((item: any) => ({
        name: item.name || 'Expense',
        section: 'Operating',
        amount: toTwoDecimals(Math.abs(item.value || 0)),
        percentage: toTwoDecimals(
          trueTotalExpenses > 0 ? (Math.abs(item.value || 0) / trueTotalExpenses) * 100 : 0
        ),
        level: item.level || 0,
        accountId: item.accountId,
      })),
    // Add Other Expense items separately
    ...(validatedPL.otherExpenses?.lines || [])
      .filter((item: any) => !item.isSummary)
      .map((item: any) => ({
        name: item.name || 'Other Expense',
        section: 'Other',
        amount: toTwoDecimals(Math.abs(item.value || 0)),
        percentage: toTwoDecimals(
          trueTotalExpenses > 0 ? (Math.abs(item.value || 0) / trueTotalExpenses) * 100 : 0
        ),
        level: item.level || 0,
        accountId: item.accountId,
      })),
  ].filter((item: any) => item.amount > 0)

  // Calculate KPIs using validated data
  const profitMargin = calculateProfitMargin(validatedPL.net_income, validatedPL.total_income) ?? 0

  const expenseRatio = calculateExpenseRatio(trueTotalExpenses, validatedPL.total_income) ?? 0

  // Extract EBITDA components from P&L report
  const { interestExpense, taxExpense, depreciationAmortization } =
    extractEBITDAComponents(normalizedData)
  const ebitda = validatedPL.net_income + interestExpense + taxExpense + depreciationAmortization

  // Calculate months in period for burn rate
  const monthsInPeriod = Math.max(
    1,
    Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    )
  )

  // Fetch cash balance from bank accounts for runway calculation
  const cashBalance = await getCashAndEquivalents(organizationId)

  // Build hierarchies for nested P&L display
  // Using the level-based structure from QuickBooks P&L lines
  let revenueHierarchy: EnrichedHierarchyItem[]
  let otherIncomeHierarchy: EnrichedHierarchyItem[]
  let cogsHierarchy: EnrichedHierarchyItem[]
  let expenseHierarchy: EnrichedHierarchyItem[]

  // Build hierarchies directly from the level-based structure in P&L lines
  // QuickBooks already provides proper nesting via the `level` property
  console.log('\n===== BUILDING HIERARCHIES FROM LEVELS =====')

  // For income
  revenueHierarchy = buildHierarchyFromLevels(validatedPL.income?.lines || [])
  console.log(`Revenue hierarchy: ${revenueHierarchy.length} root nodes`)

  // For other income
  otherIncomeHierarchy = buildHierarchyFromLevels(validatedPL.otherIncome?.lines || [])
  console.log(`Other income hierarchy: ${otherIncomeHierarchy.length} root nodes`)

  // For COGS (separate hierarchy to avoid double-counting in dashboard)
  cogsHierarchy = buildHierarchyFromLevels(validatedPL.costOfGoodsSold?.lines || [])
  console.log(`COGS hierarchy: ${cogsHierarchy.length} root nodes`)

  // For operating expenses only (NOT including COGS)
  expenseHierarchy = buildHierarchyFromLevels(validatedPL.expenses?.lines || [])
  console.log(`Expense hierarchy: ${expenseHierarchy.length} root nodes`)

  // Log sample hierarchy structure
  if (revenueHierarchy.length > 0) {
    console.log('\nSample revenue hierarchy:')
    revenueHierarchy.slice(0, 2).forEach((root) => {
      console.log(`  - ${root.name} (total: ${root.total}, children: ${root.children.length})`)
      root.children.slice(0, 2).forEach((child) => {
        console.log(`    - ${child.name} (total: ${child.total})`)
      })
    })
  }

  console.log('=============================================\n')

  // Build the enriched response
  return {
    reportType: 'profit_loss',
    organizationId,
    organizationName,
    fromDate: startDate,
    toDate: endDate,
    currency,
    generated: new Date().toISOString(),
    data: {
      kpis: {
        // Use validated QuickBooks P&L report data
        totalRevenue: toTwoDecimals(validatedPL.total_income || 0),
        totalExpenses: toTwoDecimals(validatedPL.total_expenses || 0), // Operating Expenses only (excludes COGS and Other)
        netIncome: toTwoDecimals(validatedPL.net_income || 0),
        profitMargin: toTwoDecimals(profitMargin),
        expenseRatio: toTwoDecimals(expenseRatio),
        grossProfit: toTwoDecimals(validatedPL.gross_profit || 0),
        // cost_of_goods_sold is an array, use cogs_total for the numeric value
        costOfGoodsSold: toTwoDecimals(validatedPL.cogs_total || 0),
        otherExpenses: toTwoDecimals(validatedPL.other_expenses || 0), // This is SEPARATE from operating expenses
        otherIncome: toTwoDecimals(validatedPL.other_income || 0), // Non-operating income (interest, exchange gains, etc.)
        // Operating expenses should NOT include COGS or other expenses
        operatingExpenses: toTwoDecimals(validatedPL.total_expenses || 0),
        // Operating Income = Gross Profit - Operating Expenses (QB "Expenses" section is already operating-only)
        operatingIncome: toTwoDecimals(
          validatedPL.net_operating_income ||
            (validatedPL.gross_profit || 0) - (validatedPL.total_expenses || 0)
        ),
        // Calculate margins
        grossMargin: toTwoDecimals(
          calculateGrossMargin(validatedPL.gross_profit, validatedPL.total_income) ?? 0
        ),
        // Operating Margin = (Revenue - COGS - Operating Expenses) / Revenue
        // Note: Operating expenses already excludes COGS and Other Expenses
        operatingMargin: toTwoDecimals(
          calculateOperatingMargin(
            validatedPL.total_income,
            validatedPL.cogs_total || 0,
            validatedPL.total_expenses
          ) ?? 0
        ),
        // EBITDA components
        interestExpense: toTwoDecimals(interestExpense),
        taxExpense: toTwoDecimals(taxExpense),
        depreciationAmortization: toTwoDecimals(depreciationAmortization),
        ebitda: toTwoDecimals(ebitda),
        // Burn rate and runway calculations
        // Burn rate = monthly expenses (total expenses / months in period)
        burnRate: toTwoDecimals(
          monthsInPeriod > 0 ? trueTotalExpenses / monthsInPeriod : trueTotalExpenses
        ),
        monthsInPeriod,
        // Gross burn rate = monthly total expenses
        grossBurnRate: toTwoDecimals(
          monthsInPeriod > 0 ? trueTotalExpenses / monthsInPeriod : trueTotalExpenses
        ),
        // Cash balance for runway calculation
        cashBalance: toTwoDecimals(cashBalance),
        // New KPIs for enhanced P&L analysis
        netProfitMargin: toTwoDecimals(
          validatedPL.total_income > 0
            ? (validatedPL.net_income / validatedPL.total_income) * 100
            : 0
        ),
        cogsRatio: toTwoDecimals(
          validatedPL.total_income > 0
            ? ((validatedPL.cogs_total || 0) / validatedPL.total_income) * 100
            : 0
        ),
        revenuePerMonth: toTwoDecimals(
          monthsInPeriod > 0 ? validatedPL.total_income / monthsInPeriod : validatedPL.total_income
        ),
        netBurnRate: toTwoDecimals(
          monthsInPeriod > 0
            ? (trueTotalExpenses - validatedPL.total_income) / monthsInPeriod
            : trueTotalExpenses - validatedPL.total_income
        ),
      },
      // Revenue breakdown (flat list for backward compatibility)
      revenueByCategory: revenueByCategory.length > 0 ? revenueByCategory : undefined,
      // Revenue hierarchy (nested structure using COA fully_qualified_name)
      revenueHierarchy: revenueHierarchy.length > 0 ? revenueHierarchy : undefined,
      // Other income breakdown
      otherIncomeByCategory: otherIncomeByCategory.length > 0 ? otherIncomeByCategory : undefined,
      // Other income hierarchy
      otherIncomeHierarchy: otherIncomeHierarchy.length > 0 ? otherIncomeHierarchy : undefined,
      // Expense breakdown (flat list for backward compatibility)
      expenseCategories: expenseCategories.length > 0 ? expenseCategories : undefined,
      // COGS hierarchy (separate from operating expenses to avoid double-counting)
      cogsHierarchy: cogsHierarchy.length > 0 ? cogsHierarchy : undefined,
      // Expense hierarchy (operating expenses only, NOT including COGS)
      expenseHierarchy: expenseHierarchy.length > 0 ? expenseHierarchy : undefined,
      // Detailed statement with variance (if requested)
      // TODO: Pass previous period data when available for variance analysis
      // Currently passing null means limited variance insights
      detailedStatement: includeDetails ? generatePnLDetailedStatement(validatedPL, null) : null,
      // Insights
      // TODO: Pass previous period data when available for richer insights
      insights: generatePnLInsights(validatedPL, null),
      // Metadata
      metadata: {
        dataCompleteness: {
          hasRevenueCategoryData: revenueByCategory.length > 0,
          hasOtherIncomeCategoryData: otherIncomeByCategory.length > 0,
          hasExpenseCategoryData: expenseCategories.length > 0,
        },
        dataQuality: {
          isComplete: true,
          hasPartialData: false,
          errors: [],
          warnings: [],
        },
      },
    },
  }
}
