/**
 * Monthly Trend Extractor Utility
 *
 * Extracts monthly trend data from normalized QuickBooks reports.
 * Used by the AI tool system to provide time-series data for analysis.
 */

import type {
  NormalizedProfitAndLoss,
  NormalizedCashFlow,
  NormalizedReportLine,
} from '@/quickbooks/types/reports'

// ============================================================================
// Types
// ============================================================================

export interface PnLMonthlyDataPoint {
  month: string
  revenue: number
  cogs: number
  grossProfit: number
  expenses: number
  netIncome: number
  margin: number
}

export interface CashFlowMonthlyDataPoint {
  month: string
  operating: number
  investing: number
  financing: number
  netCashFlow: number
}

export interface LineItemMonthlyData {
  name: string
  accountId?: string
  level: number // Nesting depth from QuickBooks (0 = section, 1 = category, 2 = line item)
  monthly: Record<string, number> // { "Jan 2024": 5000, "Feb 2024": 6000 }
  total: number
}

/**
 * Hierarchical monthly data structure for nested category queries
 * Allows users to query by category (e.g., "show me Operating Expenses by month")
 * and get aggregated data for all items within that category
 */
export interface HierarchyItemMonthly {
  name: string
  accountId?: string
  level: number
  /** Monthly values for this item (includes children totals if parent) */
  monthly: Record<string, number>
  /** Total across all periods */
  total: number
  /** Child items within this category */
  children: HierarchyItemMonthly[]
}

export interface SectionMonthlyData {
  /** Flat list of all line items with monthly data */
  items: LineItemMonthlyData[]
  /** Hierarchical structure for category-based queries */
  hierarchy: HierarchyItemMonthly[]
}

export interface PnLLineItemMonthlyDetail {
  periods: string[] // Column headers for reference
  income: SectionMonthlyData
  costOfGoodsSold: SectionMonthlyData
  expenses: SectionMonthlyData
  otherIncome: SectionMonthlyData
  otherExpenses: SectionMonthlyData
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sum values from report lines for a specific column index
 */
function sumLineValues(lines: NormalizedReportLine[], columnIndex: number): number {
  return lines
    .filter((line) => !line.isSummary) // Filter out summary rows to avoid double-counting
    .reduce((sum, line) => {
      return sum + (line.values[`col_${columnIndex}`] || 0)
    }, 0)
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a normalized report has monthly data (multiple periods)
 *
 * @param normalized - Normalized report with columns array
 * @returns True if report has multiple periods (columns.length > 2)
 */
export function hasMonthlyData(normalized: { columns?: string[] }): boolean {
  return (normalized.columns?.length || 0) > 2
}

/**
 * Extract monthly trend data from Profit & Loss report
 *
 * @param normalized - Normalized P&L report
 * @returns Array of monthly data points with revenue, expenses, margins, etc.
 */
export function extractPnLMonthlyTrend(normalized: NormalizedProfitAndLoss): PnLMonthlyDataPoint[] {
  const columns = normalized.columns || []

  // extractColumnHeaders already removed empty column titles,
  // so columns[0] = first month and col_0 = first month's data (already aligned)
  // Filter out "Total" column - we only want individual period data
  const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

  return periodColumns.map((period: string, index: number) => {
    // Calculate metrics for this period
    const revenue = sumLineValues(normalized.income.lines, index)
    const cogs = sumLineValues(normalized.costOfGoodsSold.lines, index)
    const grossProfit = revenue - cogs
    const expenses = sumLineValues(normalized.expenses.lines, index)
    const netIncome = grossProfit - expenses

    // Calculate profit margin (avoid division by zero)
    const margin = revenue > 0 ? (netIncome / revenue) * 100 : 0

    return {
      month: period,
      revenue,
      cogs,
      grossProfit,
      expenses,
      netIncome,
      margin,
    }
  })
}

/**
 * Extract monthly trend data from Cash Flow report
 *
 * @param normalized - Normalized Cash Flow report
 * @returns Array of monthly data points with operating, investing, financing activities
 */
export function extractCashFlowMonthlyTrend(
  normalized: NormalizedCashFlow
): CashFlowMonthlyDataPoint[] {
  const columns = normalized.columns || []

  // extractColumnHeaders already removed empty column titles,
  // so columns[0] = first month and col_0 = first month's data (already aligned)
  // Filter out "Total" column - we only want individual period data
  const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

  return periodColumns.map((period: string, index: number) => {
    // Calculate cash flow activities for this period
    const operating = sumLineValues(normalized.operatingActivities.lines, index)
    const investing = sumLineValues(normalized.investingActivities.lines, index)
    const financing = sumLineValues(normalized.financingActivities.lines, index)
    const netCashFlow = operating + investing + financing

    return {
      month: period,
      operating,
      investing,
      financing,
      netCashFlow,
    }
  })
}

/**
 * Extract monthly values for each line item in a section
 *
 * @param lines - Array of normalized report lines
 * @param columns - Array of period column headers (e.g., ["Jan 2024", "Feb 2024"])
 * @returns Array of line items with their monthly breakdown and level info
 */
function extractLineItemMonthly(
  lines: NormalizedReportLine[],
  columns: string[]
): LineItemMonthlyData[] {
  // Filter out "Total" column - we only want individual period data
  const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

  return lines
    .filter((line) => !line.isSummary) // Skip summary rows to avoid duplication
    .map((line) => {
      const monthly: Record<string, number> = {}

      periodColumns.forEach((period, index) => {
        monthly[period] = line.values[`col_${index}`] || 0
      })

      return {
        name: line.name,
        accountId: line.accountId,
        level: line.level,
        monthly,
        total: line.total,
      }
    })
}

/**
 * Build hierarchical tree structure from flat line items with level property
 *
 * QuickBooks P&L lines have a `level` property indicating nesting depth:
 * - Level 0: Section header (e.g., "Income", "Expenses")
 * - Level 1: Category (e.g., "4000 Done For You", "Operating Expenses")
 * - Level 2+: Line items within categories
 *
 * This function builds a tree preserving parent-child relationships
 * and aggregates monthly values from children to parents.
 */
function buildMonthlyHierarchy(
  lines: NormalizedReportLine[],
  columns: string[]
): HierarchyItemMonthly[] {
  const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

  // Filter out summary rows and section headers (level 0)
  const dataLines = lines.filter((line) => {
    if (line.isSummary) return false
    // Keep all data lines including parent categories
    return true
  })

  if (dataLines.length === 0) return []

  // Build tree using stack-based approach
  const roots: HierarchyItemMonthly[] = []
  const stack: HierarchyItemMonthly[] = []

  for (const line of dataLines) {
    // Adjust level (QB uses level 0 for section headers, 1 for first real items)
    const level = line.level ?? 1

    // Extract monthly values
    const monthly: Record<string, number> = {}
    periodColumns.forEach((period, index) => {
      monthly[period] = line.values[`col_${index}`] || 0
    })

    const node: HierarchyItemMonthly = {
      name: line.name,
      accountId: line.accountId,
      level,
      monthly,
      total: line.total,
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
    }

    // Push this node as potential parent for next items
    stack.push(node)
  }

  // Calculate aggregated totals recursively
  // For parent nodes, sum up children's monthly values
  function aggregateMonthly(node: HierarchyItemMonthly): void {
    if (node.children.length === 0) {
      // Leaf node - use its own values
      return
    }

    // First, recursively aggregate children
    node.children.forEach(aggregateMonthly)

    // Then, if this is a parent, aggregate children's values
    // Note: In QuickBooks, parent's values often already include children totals
    // We recalculate to ensure accuracy for monthly breakdowns
    const childrenMonthly: Record<string, number> = {}
    let childrenTotal = 0

    for (const child of node.children) {
      for (const [period, value] of Object.entries(child.monthly)) {
        childrenMonthly[period] = (childrenMonthly[period] || 0) + value
      }
      childrenTotal += child.total
    }

    // Use aggregated children values for parent
    node.monthly = childrenMonthly
    node.total = childrenTotal
  }

  roots.forEach(aggregateMonthly)

  return roots
}

/**
 * Extract section monthly data with both flat items and hierarchy
 */
function extractSectionMonthlyData(
  lines: NormalizedReportLine[],
  columns: string[]
): SectionMonthlyData {
  return {
    items: extractLineItemMonthly(lines, columns),
    hierarchy: buildMonthlyHierarchy(lines, columns),
  }
}

/**
 * Extract line-item monthly detail from Profit & Loss report
 *
 * This provides granular monthly data for each account/line item,
 * allowing the AI to analyze trends at the individual account level.
 *
 * The data includes both:
 * - `items`: Flat list of all line items with monthly values (for simple queries)
 * - `hierarchy`: Nested tree structure for category-based queries
 *   (e.g., "show me all items under Operating Expenses by month")
 *
 * When a user asks about a category:
 * 1. Find the category in the hierarchy
 * 2. The category's `monthly` values are pre-aggregated from all children
 * 3. Access `children` to see individual items within the category
 *
 * @param normalized - Normalized P&L report
 * @returns Object with line-item monthly breakdown for each P&L section
 */
export function extractPnLLineItemMonthlyDetail(
  normalized: NormalizedProfitAndLoss
): PnLLineItemMonthlyDetail {
  const columns = normalized.columns || []
  const periodColumns = columns.filter((col) => !col.toLowerCase().includes('total'))

  return {
    periods: periodColumns,
    income: extractSectionMonthlyData(normalized.income.lines, columns),
    costOfGoodsSold: extractSectionMonthlyData(normalized.costOfGoodsSold.lines, columns),
    expenses: extractSectionMonthlyData(normalized.expenses.lines, columns),
    otherIncome: extractSectionMonthlyData(normalized.otherIncome.lines, columns),
    otherExpenses: extractSectionMonthlyData(normalized.otherExpenses.lines, columns),
  }
}
