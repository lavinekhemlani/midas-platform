/**
 * QuickBooks Report Transformers
 *
 * Transforms raw QuickBooks report responses into normalized formats
 * suitable for frontend consumption.
 */

import type {
  QBReportResponse,
  QBReportRow,
  NormalizedReportLine,
  NormalizedProfitAndLoss,
  NormalizedBalanceSheet,
  NormalizedCashFlow,
  NormalizedAgedReport,
  NormalizedAgedReportDetail,
  AgedReportDetailLine,
  AgedReportTransaction,
  NormalizedGeneralLedger,
  NormalizedTrialBalance,
} from '../types/reports'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a string value to number, handling various formats
 */
function parseAmount(value: string | undefined | null): number {
  if (!value || value === '' || value === '-') return 0
  // Remove currency symbols, commas, and whitespace
  let cleaned = value.replace(/[$,\s]/g, '').trim()

  // Handle parenthetical negatives: (100) → -100
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Extract column headers from report
 */
function extractColumnHeaders(report: QBReportResponse): string[] {
  if (!report?.Columns?.Column) {
    console.warn('[extractColumnHeaders] Report has no Columns structure', {
      hasReport: !!report,
      hasColumns: !!report?.Columns,
    })
    return []
  }
  return report.Columns.Column.map((col) => col.ColTitle).filter((title) => title && title !== '')
}

/**
 * Process a row into a normalized line item
 */
function processRow(row: QBReportRow, level: number = 0): NormalizedReportLine | null {
  // Handle data rows (with ColData)
  if (row.ColData && row.ColData.length > 0) {
    const name = row.ColData[0]?.value || ''
    const accountId = row.ColData[0]?.id

    // Skip empty rows
    if (!name || name === '') return null

    // Get values from remaining columns
    const values: Record<string, number> = {}
    let total = 0

    row.ColData.slice(1).forEach((col, index) => {
      const amount = parseAmount(col.value)
      values[`col_${index}`] = amount
      // Last column is typically the total
      total = amount
    })

    return {
      name,
      accountId,
      values,
      value: total, // Add this for enricher compatibility
      total, // Keep for backward compatibility
      level,
      isSummary: false,
    }
  }

  return null
}

/**
 * Process a section of rows recursively
 */
function processSection(
  row: QBReportRow,
  level: number = 0
): { lines: NormalizedReportLine[]; total: number } {
  const lines: NormalizedReportLine[] = []
  let sectionTotal = 0

  // Process header if present
  if (row.Header?.ColData) {
    const headerLine = processRow({ ColData: row.Header.ColData } as QBReportRow, level)
    if (headerLine) {
      headerLine.isSummary = false
      lines.push(headerLine)
    }
  }

  // Process nested rows
  if (row.Rows?.Row) {
    for (const childRow of row.Rows.Row) {
      if (childRow.type === 'Section') {
        // Recursive section
        const { lines: childLines, total } = processSection(childRow, level + 1)
        lines.push(...childLines)
        sectionTotal = total
      } else if (childRow.ColData) {
        const line = processRow(childRow, level + 1)
        if (line) {
          lines.push(line)
        }
      }
    }
  }

  // Process summary if present
  if (row.Summary?.ColData) {
    const summaryLine = processRow({ ColData: row.Summary.ColData } as QBReportRow, level)
    if (summaryLine) {
      summaryLine.isSummary = true
      sectionTotal = summaryLine.total
      lines.push(summaryLine)
    }
  }

  return { lines, total: sectionTotal }
}

/**
 * Hierarchical asset/liability item structure for QuickBooks-style nesting
 */
interface HierarchyItem {
  name: string
  total: number
  children: Array<{ name: string; value: number; accountId?: string }>
}

// Alias for backward compatibility
type FixedAssetHierarchyItem = HierarchyItem

/**
 * Process fixed assets section preserving QuickBooks hierarchy
 * QuickBooks fixed assets have nested structure like:
 * Fixed Assets
 * └── Truck (Section)
 *     ├── Original Cost         $25,000
 *     ├── Accumulated Depr      -$5,000
 *     └── Total for Truck       $20,000
 *
 * This function preserves that parent-child relationship
 */
function processFixedAssetsWithHierarchy(fixedAssetsSection: QBReportRow | undefined): {
  lines: NormalizedReportLine[]
  total: number
  hierarchy: FixedAssetHierarchyItem[]
} {
  if (!fixedAssetsSection) {
    return { lines: [], total: 0, hierarchy: [] }
  }

  const lines: NormalizedReportLine[] = []
  const hierarchy: FixedAssetHierarchyItem[] = []
  let sectionTotal = 0

  // Process header if present (e.g., "Fixed Assets" header)
  if (fixedAssetsSection.Header?.ColData) {
    const headerLine = processRow({ ColData: fixedAssetsSection.Header.ColData } as QBReportRow, 0)
    if (headerLine) {
      headerLine.isSummary = false
      lines.push(headerLine)
    }
  }

  // Process nested rows - these are the asset categories (Truck, Equipment, etc.)
  const nestedRows = fixedAssetsSection.Rows?.Row || []
  for (const childRow of nestedRows) {
    if (childRow.type === 'Section') {
      // This is a nested asset category (e.g., Truck)
      const categoryName = childRow.Header?.ColData?.[0]?.value || ''
      const children: Array<{ name: string; value: number; accountId?: string }> = []
      let categoryTotal = 0

      // Process the header as a line item
      if (childRow.Header?.ColData) {
        const headerLine = processRow({ ColData: childRow.Header.ColData } as QBReportRow, 1)
        if (headerLine) {
          headerLine.isSummary = false
          lines.push(headerLine)
        }
      }

      // Process child items within this category (Original Cost, Depreciation, etc.)
      const categoryRows = childRow.Rows?.Row || []
      for (const itemRow of categoryRows) {
        if (itemRow.ColData) {
          const line = processRow(itemRow, 2)
          if (line) {
            lines.push(line)
            // Add to children array for hierarchy
            children.push({ name: line.name, value: line.total, accountId: line.accountId })
          }
        } else if (itemRow.type === 'Section') {
          // Handle deeper nesting if present
          const { lines: subLines } = processSection(itemRow, 2)
          lines.push(...subLines)
          subLines.forEach((l) => {
            if (!l.isSummary) {
              children.push({ name: l.name, value: l.total, accountId: l.accountId })
            }
          })
        }
      }

      // Process summary for this category (Total for Truck)
      if (childRow.Summary?.ColData) {
        const summaryLine = processRow({ ColData: childRow.Summary.ColData } as QBReportRow, 1)
        if (summaryLine) {
          summaryLine.isSummary = true
          categoryTotal = summaryLine.total
          lines.push(summaryLine)
        }
      }

      // Add to hierarchy if we have a category name
      if (categoryName) {
        hierarchy.push({
          name: categoryName,
          total: categoryTotal,
          children,
        })
      }
    } else if (childRow.ColData) {
      // Direct line item (not nested)
      const line = processRow(childRow, 1)
      if (line) {
        lines.push(line)
        // Add as standalone item in hierarchy
        hierarchy.push({
          name: line.name,
          total: line.total,
          children: [],
        })
      }
    }
  }

  // Process summary for entire fixed assets section
  if (fixedAssetsSection.Summary?.ColData) {
    const summaryLine = processRow(
      { ColData: fixedAssetsSection.Summary.ColData } as QBReportRow,
      0
    )
    if (summaryLine) {
      summaryLine.isSummary = true
      sectionTotal = summaryLine.total
      lines.push(summaryLine)
    }
  }

  return { lines, total: sectionTotal, hierarchy }
}

/**
 * Process any asset/liability section preserving QuickBooks hierarchy
 * Works for Current Assets, Fixed Assets, Current Liabilities, etc.
 *
 * QuickBooks sections have nested structure like:
 * Current Assets
 * ├── Bank Accounts (Section)
 * │   ├── Checking Account      $10,000
 * │   ├── Savings Account        $5,000
 * │   └── Total Bank Accounts   $15,000
 * ├── Accounts Receivable (Section)
 * │   ├── A/R                    $8,000
 * │   └── Total A/R              $8,000
 * └── Total Current Assets      $23,000
 *
 * This function preserves that parent-child relationship
 */
function processSectionWithHierarchy(section: QBReportRow | undefined): {
  lines: NormalizedReportLine[]
  total: number
  hierarchy: HierarchyItem[]
} {
  if (!section) {
    return { lines: [], total: 0, hierarchy: [] }
  }

  const lines: NormalizedReportLine[] = []
  const hierarchy: HierarchyItem[] = []
  let sectionTotal = 0

  // Process header if present
  if (section.Header?.ColData) {
    const headerLine = processRow({ ColData: section.Header.ColData } as QBReportRow, 0)
    if (headerLine) {
      headerLine.isSummary = false
      lines.push(headerLine)
    }
  }

  // Process nested rows - these are sub-categories (Bank Accounts, A/R, etc.)
  const nestedRows = section.Rows?.Row || []
  for (const childRow of nestedRows) {
    if (childRow.type === 'Section') {
      // This is a nested category (e.g., Bank Accounts)
      const categoryName = childRow.Header?.ColData?.[0]?.value || ''
      const children: Array<{ name: string; value: number; accountId?: string }> = []
      let categoryTotal = 0

      // Process the header as a line item
      if (childRow.Header?.ColData) {
        const headerLine = processRow({ ColData: childRow.Header.ColData } as QBReportRow, 1)
        if (headerLine) {
          headerLine.isSummary = false
          lines.push(headerLine)
        }
      }

      // Process child items within this category
      const categoryRows = childRow.Rows?.Row || []
      for (const itemRow of categoryRows) {
        if (itemRow.ColData) {
          const line = processRow(itemRow, 2)
          if (line) {
            lines.push(line)
            children.push({ name: line.name, value: line.total, accountId: line.accountId })
          }
        } else if (itemRow.type === 'Section') {
          // Handle deeper nesting if present
          const { lines: subLines } = processSection(itemRow, 2)
          lines.push(...subLines)
          subLines.forEach((l) => {
            if (!l.isSummary) {
              children.push({ name: l.name, value: l.total, accountId: l.accountId })
            }
          })
        }
      }

      // Process summary for this category
      if (childRow.Summary?.ColData) {
        const summaryLine = processRow({ ColData: childRow.Summary.ColData } as QBReportRow, 1)
        if (summaryLine) {
          summaryLine.isSummary = true
          categoryTotal = summaryLine.total
          lines.push(summaryLine)
        }
      }

      // Add to hierarchy if we have a category name
      if (categoryName) {
        hierarchy.push({
          name: categoryName,
          total: categoryTotal,
          children,
        })
      }
    } else if (childRow.ColData) {
      // Direct line item (not nested)
      const line = processRow(childRow, 1)
      if (line) {
        lines.push(line)
        // Add as standalone item in hierarchy
        hierarchy.push({
          name: line.name,
          total: line.total,
          children: [],
        })
      }
    }
  }

  // Process summary for entire section
  if (section.Summary?.ColData) {
    const summaryLine = processRow({ ColData: section.Summary.ColData } as QBReportRow, 0)
    if (summaryLine) {
      summaryLine.isSummary = true
      sectionTotal = summaryLine.total
      lines.push(summaryLine)
    }
  }

  return { lines, total: sectionTotal, hierarchy }
}

/**
 * Find a section by group name (supports multiple aliases for international standards)
 * Case-insensitive matching to handle variations like 'INCOME', 'Income', 'income'
 * Falls back to fuzzy matching if exact match fails
 */
function findSection(rows: QBReportRow[], groupName: string): QBReportRow | undefined {
  // Define aliases for different accounting standards (US GAAP, IFRS, HK PE, etc.)
  const groupAliases: Record<string, string[]> = {
    // Balance Sheet sections
    Assets: ['Assets', 'NetAssets', 'TotalAssets'],
    // NOTE: Combined sections like "LiabilitiesAndEquity" are NOT included here
    // They are handled separately in transformBalanceSheet via index-based fallback
    Liabilities: ['Liabilities', 'TotalLiabilities'],
    // NOTE: Combined sections like "LiabilitiesAndEquity" are NOT included here
    // They are handled separately in transformBalanceSheet via index-based fallback
    Equity: [
      'Equity',
      'TotalEquity',
      'TotalShareHoldersEquityNode',
      'ShareholdersEquity',
      'StockholdersEquity',
      'ShareholderEquity',
      'OwnersEquity',
    ],
    CurrentAssets: [
      'CurrentAssets',
      'TotalAssetLessCurrentLiabilities',
      'TotalCurrentAssets',
      'Current Assets',
    ],
    FixedAssets: [
      'FixedAssets',
      'NonCurrentAssets',
      'PropertyPlantEquipment',
      'Fixed Assets',
      'PPE',
    ],
    CurrentLiabilities: [
      'CurrentLiabilities',
      'TotalCurrentLiabilities',
      'Current Liabilities',
      'AccountsPayable',
    ],
    LongTermLiabilities: [
      'LongTermLiabilities',
      'NonCurrentLiabilities',
      'Long Term Liabilities',
      'Long-Term Liabilities',
    ],
    OtherAssets: ['OtherAssets', 'Other Assets', 'OtherCurrentAssets', 'Other Current Assets'],
    // P&L sections
    Income: ['Income', 'Revenue', 'TotalIncome', 'GrossIncome'],
    COGS: ['COGS', 'CostOfGoodsSold', 'CostOfSales'],
    Expenses: ['Expenses', 'TotalExpenses', 'OperatingExpenses'],
    OtherIncome: ['OtherIncome', 'NonOperatingIncome', 'Other Income'],
    OtherExpenses: ['OtherExpenses', 'NonOperatingExpenses', 'Other Expenses'],
    // Cash Flow sections
    OperatingActivities: ['OperatingActivities', 'CashFromOperations', 'Operating Activities'],
    InvestingActivities: ['InvestingActivities', 'CashFromInvesting', 'Investing Activities'],
    FinancingActivities: ['FinancingActivities', 'CashFromFinancing', 'Financing Activities'],
  }

  const aliases = groupAliases[groupName] || [groupName]
  // Normalize aliases to lowercase for case-insensitive comparison
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase().trim().replace(/\s+/g, ''))

  // First try exact match (case-insensitive, whitespace-normalized)
  let found = rows.find((row) => {
    if (!row.group) return false
    const normalizedGroup = row.group.toLowerCase().trim().replace(/\s+/g, '')
    return normalizedAliases.includes(normalizedGroup)
  })

  if (found) return found

  // Fallback: fuzzy matching using .includes() like the old code
  // This handles cases where QB returns slightly different section names
  // IMPORTANT: Liabilities pattern must NOT match combined "LiabilitiesAndEquity" sections
  const fuzzyPatterns: Record<string, string[]> = {
    Assets: ['asset'],
    Liabilities: ['liabilit'], // Will be handled specially below to exclude "equity"
    Equity: ['equity', 'shareholder', 'stockholder', 'owner'],
    CurrentAssets: ['current asset', 'currentasset'],
    FixedAssets: ['fixed asset', 'fixedasset', 'property', 'plant', 'equipment'],
    CurrentLiabilities: ['current liabilit', 'currentliabilit'],
    LongTermLiabilities: ['long term', 'longterm', 'non-current liab', 'noncurrent liab'],
    OtherAssets: ['other asset', 'otherasset'],
    Income: ['income', 'revenue'],
    COGS: ['cost of goods', 'costofgoods', 'cogs', 'cost of sales'],
    Expenses: ['expense'],
    OtherIncome: ['other income', 'otherincome'],
    OtherExpenses: ['other expense', 'otherexpense'],
    OperatingActivities: ['operating'],
    InvestingActivities: ['investing'],
    FinancingActivities: ['financing'],
  }

  const patterns = fuzzyPatterns[groupName] || [groupName.toLowerCase()]

  found = rows.find((row) => {
    if (!row.group) return false
    const normalizedGroup = row.group.toLowerCase().trim()

    // Special handling for Liabilities: must NOT match combined sections that also contain "equity"
    // This prevents matching "LiabilitiesAndEquity" when looking for just "Liabilities"
    if (groupName === 'Liabilities') {
      return normalizedGroup.includes('liabilit') && !normalizedGroup.includes('equity')
    }

    // Special handling for Equity: must NOT match combined sections that also contain "liabilit"
    // This prevents matching "LiabilitiesAndEquity" when looking for just "Equity"
    if (groupName === 'Equity') {
      return (
        (normalizedGroup.includes('equity') ||
          normalizedGroup.includes('shareholder') ||
          normalizedGroup.includes('stockholder') ||
          normalizedGroup.includes('owner')) &&
        !normalizedGroup.includes('liabilit')
      )
    }

    return patterns.some((pattern) => normalizedGroup.includes(pattern))
  })

  return found
}

/**
 * Get section total from summary
 */
function getSectionTotal(row: QBReportRow | undefined): number {
  if (!row?.Summary?.ColData) return 0
  const lastCol = row.Summary.ColData[row.Summary.ColData.length - 1]
  return parseAmount(lastCol?.value)
}

// ============================================================================
// Report Transformers
// ============================================================================

/**
 * Transform Profit and Loss report
 */
export function transformProfitAndLoss(report: QBReportResponse): NormalizedProfitAndLoss {
  const rows = report.Rows?.Row || []
  const columns = extractColumnHeaders(report)

  // Find main sections
  const incomeSection = findSection(rows, 'Income')
  const cogsSection = findSection(rows, 'COGS')
  const expensesSection = findSection(rows, 'Expenses')
  const otherIncomeSection = findSection(rows, 'OtherIncome')
  const otherExpensesSection = findSection(rows, 'OtherExpenses')

  // Process each section with hierarchy support (like Balance Sheet)
  const income = incomeSection
    ? processSectionWithHierarchy(incomeSection)
    : { lines: [], total: 0, hierarchy: [] }
  const cogs = cogsSection
    ? processSectionWithHierarchy(cogsSection)
    : { lines: [], total: 0, hierarchy: [] }
  const expenses = expensesSection
    ? processSectionWithHierarchy(expensesSection)
    : { lines: [], total: 0, hierarchy: [] }
  const otherIncome = otherIncomeSection
    ? processSectionWithHierarchy(otherIncomeSection)
    : { lines: [], total: 0, hierarchy: [] }
  const otherExpenses = otherExpensesSection
    ? processSectionWithHierarchy(otherExpensesSection)
    : { lines: [], total: 0, hierarchy: [] }

  // Calculate derived values
  const grossProfit = income.total - cogs.total
  const netOperatingIncome = grossProfit - expenses.total
  const netIncome = netOperatingIncome + otherIncome.total - otherExpenses.total

  // Try to find Net Income row directly
  const netIncomeRow = rows.find(
    (row) =>
      row.group === 'NetIncome' ||
      row.Summary?.ColData?.[0]?.value?.toLowerCase().includes('net income')
  )
  const reportedNetIncome = netIncomeRow ? getSectionTotal(netIncomeRow) : netIncome

  return {
    reportName: report.Header.ReportName,
    reportBasis: report.Header.ReportBasis || 'Accrual',
    startDate: report.Header.StartPeriod,
    endDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,

    income: {
      lines: income.lines,
      total: income.total,
      hierarchy: income.hierarchy,
    },

    costOfGoodsSold: {
      lines: cogs.lines,
      total: cogs.total,
      hierarchy: cogs.hierarchy,
    },

    grossProfit,

    expenses: {
      lines: expenses.lines,
      total: expenses.total,
      hierarchy: expenses.hierarchy,
    },

    otherIncome: {
      lines: otherIncome.lines,
      total: otherIncome.total,
      hierarchy: otherIncome.hierarchy,
    },

    otherExpenses: {
      lines: otherExpenses.lines,
      total: otherExpenses.total,
      hierarchy: otherExpenses.hierarchy,
    },

    netOperatingIncome,
    netIncome: reportedNetIncome,
    columns,
  }
}

/**
 * Transform Balance Sheet report
 *
 * QuickBooks Balance Sheet structure:
 * - Row[0]: Assets section
 * - Row[1]: Liabilities and Equity section (combined)
 *   - May contain sub-sections for Liabilities and Equity separately
 *   - Or may have them nested within
 */
export function transformBalanceSheet(report: QBReportResponse): NormalizedBalanceSheet {
  const rows = report.Rows?.Row || []
  const columns = extractColumnHeaders(report)

  // DEBUG: Log what sections we're finding
  console.log(
    '[transformBalanceSheet] Top-level sections found:',
    rows.map((r) => r.group || 'no-group')
  )

  // Find main sections - support different accounting standards
  // First try by group name matching
  let assetsSection = findSection(rows, 'Assets')
  let liabilitiesSection = findSection(rows, 'Liabilities')
  let equitySection = findSection(rows, 'Equity')

  // Fallback: Use index-based access like the old code
  // QuickBooks typically returns: Row[0] = Assets, Row[1] = Liabilities and Equity
  if (!assetsSection && rows.length > 0) {
    assetsSection = rows[0]
    console.log('[transformBalanceSheet] Using index-based fallback for Assets (Row[0])')
  }

  // For the second section (Liabilities + Equity combined)
  let liabEquitySection: QBReportRow | undefined
  if (!liabilitiesSection && rows.length > 1) {
    liabEquitySection = rows[1]
    console.log(
      '[transformBalanceSheet] Using index-based fallback for Liabilities+Equity (Row[1]):',
      liabEquitySection?.group
    )

    // Look for Liabilities and Equity sub-sections inside the combined section
    const subRows = liabEquitySection?.Rows?.Row || []
    console.log(
      '[transformBalanceSheet] Sub-sections in Row[1]:',
      subRows.map((r: QBReportRow) => r.group || 'no-group')
    )

    // Try to find Liabilities sub-section
    liabilitiesSection = findSection(subRows, 'Liabilities')
    if (!liabilitiesSection) {
      // Fuzzy match: look for any section containing 'liabilit' (but not 'equity')
      liabilitiesSection = subRows.find((r: QBReportRow) => {
        const group = (r.group || '').toLowerCase()
        return group.includes('liabilit') && !group.includes('equity')
      })
    }

    // Try to find Equity sub-section
    if (!equitySection) {
      equitySection = findSection(subRows, 'Equity')
      if (!equitySection) {
        // Fuzzy match: look for any section containing 'equity'
        equitySection = subRows.find((r: QBReportRow) => {
          const group = (r.group || '').toLowerCase()
          return (
            group.includes('equity') || group.includes('shareholder') || group.includes('owner')
          )
        })
      }
    }
  }

  // For HK PE and similar standards, liabilities and equity are combined
  // If we found "NetLiabilitiesAndShareHolderEquity", look for equity inside it
  if (liabilitiesSection && !equitySection) {
    const liabRows = liabilitiesSection.Rows?.Row || []
    equitySection = findSection(liabRows, 'Equity')
  }

  console.log('[transformBalanceSheet] Final sections found:', {
    assets: assetsSection?.group || 'none',
    liabilities: liabilitiesSection?.group || 'none',
    equity: equitySection?.group || 'none',
  })

  // Process assets - try to find sub-sections
  const assetsRows = assetsSection?.Rows?.Row || []
  const currentAssetsSection =
    findSection(assetsRows, 'CurrentAssets') ||
    findSection(assetsRows, 'Bank') ||
    findSection(assetsRows, 'AccountsReceivable')
  const fixedAssetsSection = findSection(assetsRows, 'FixedAssets')
  const otherAssetsSection = findSection(assetsRows, 'OtherAssets')

  // Use hierarchical processing to preserve QuickBooks nesting structure
  const currentAssets = processSectionWithHierarchy(currentAssetsSection)
  const fixedAssets = processSectionWithHierarchy(fixedAssetsSection)
  const otherAssets = processSectionWithHierarchy(otherAssetsSection)

  // If no sub-sections found, process all assets together
  const allAssets =
    currentAssets.lines.length === 0 && fixedAssets.lines.length === 0
      ? processSection(assetsSection || ({ Rows: { Row: [] } } as QBReportRow))
      : { lines: [], total: 0 }

  const totalAssets =
    getSectionTotal(assetsSection) ||
    currentAssets.total + fixedAssets.total + otherAssets.total + allAssets.total

  // Process liabilities - may be nested or at top level
  // Use hierarchical processing to preserve QuickBooks nesting structure (like Credit Cards section)
  const liabilitiesRows = liabilitiesSection?.Rows?.Row || []
  const currentLiabilitiesSection =
    findSection(liabilitiesRows, 'CurrentLiabilities') ||
    findSection(liabilitiesRows, 'AccountsPayable')
  const longTermLiabilitiesSection = findSection(liabilitiesRows, 'LongTermLiabilities')

  // Use processSectionWithHierarchy to preserve QuickBooks-style nesting
  // This captures sub-sections like Credit Cards, Accounts Payable, etc.
  let currentLiabilities = processSectionWithHierarchy(currentLiabilitiesSection)
  let longTermLiabilities = processSectionWithHierarchy(longTermLiabilitiesSection)

  // If no sub-sections found for liabilities, process the entire liabilities section
  if (
    currentLiabilities.lines.length === 0 &&
    longTermLiabilities.lines.length === 0 &&
    liabilitiesSection
  ) {
    const allLiabilities = processSectionWithHierarchy(liabilitiesSection)
    // Put all in current liabilities as default
    currentLiabilities = allLiabilities
  }

  // Calculate total liabilities (excluding equity if it's nested)
  let totalLiabilities =
    getSectionTotal(liabilitiesSection) || currentLiabilities.total + longTermLiabilities.total

  // Process equity
  let equity = equitySection ? processSection(equitySection) : { lines: [], total: 0 }
  let totalEquity = getSectionTotal(equitySection) || equity.total

  // Get the grand total from the liabilities+equity section if available
  const grandTotal =
    getSectionTotal(liabEquitySection) ||
    getSectionTotal(liabilitiesSection) ||
    totalLiabilities + totalEquity

  // If liabilities total is 0 but we have grand total and equity, calculate liabilities
  if (totalLiabilities === 0 && grandTotal > 0 && totalEquity !== 0) {
    totalLiabilities = grandTotal - totalEquity
  }

  return {
    reportName: report.Header.ReportName,
    reportBasis: report.Header.ReportBasis || 'Accrual',
    asOfDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,

    assets: {
      current: {
        lines: currentAssets.lines.length > 0 ? currentAssets.lines : allAssets.lines,
        total: currentAssets.total || allAssets.total,
        hierarchy: currentAssets.hierarchy, // QuickBooks-style nesting (Bank Accounts, A/R, etc.)
      },
      fixed: {
        lines: fixedAssets.lines,
        total: fixedAssets.total,
        hierarchy: fixedAssets.hierarchy, // QuickBooks-style nesting preserved
      },
      other: {
        lines: otherAssets.lines,
        total: otherAssets.total,
        hierarchy: otherAssets.hierarchy, // QuickBooks-style nesting preserved
      },
      total: totalAssets,
    },

    liabilities: {
      current: {
        lines: currentLiabilities.lines,
        total: currentLiabilities.total,
        hierarchy: currentLiabilities.hierarchy, // QuickBooks-style nesting (Credit Cards, A/P, etc.)
      },
      longTerm: {
        lines: longTermLiabilities.lines,
        total: longTermLiabilities.total,
        hierarchy: longTermLiabilities.hierarchy, // QuickBooks-style nesting preserved
      },
      total: totalLiabilities,
    },

    equity: {
      lines: equity.lines,
      total: totalEquity,
    },

    totalLiabilitiesAndEquity: grandTotal,
    columns,
  }
}

/**
 * Transform Cash Flow report
 */
export function transformCashFlow(report: QBReportResponse): NormalizedCashFlow {
  const rows = report.Rows?.Row || []
  const columns = extractColumnHeaders(report)

  // Find main sections
  const operatingSection = findSection(rows, 'OperatingActivities')
  const investingSection = findSection(rows, 'InvestingActivities')
  const financingSection = findSection(rows, 'FinancingActivities')

  const operating = operatingSection ? processSection(operatingSection) : { lines: [], total: 0 }
  const investing = investingSection ? processSection(investingSection) : { lines: [], total: 0 }
  const financing = financingSection ? processSection(financingSection) : { lines: [], total: 0 }

  const netCashChange = operating.total + investing.total + financing.total

  // Try to find beginning/ending cash balances from QB report rows
  // QB Cash Flow reports have cash balance rows as standalone data rows,
  // not section headers - need to check both Header.ColData and ColData directly
  let beginningCash = 0
  let endingCash = 0

  for (const row of rows) {
    // Check BOTH Header (section rows) AND ColData (standalone data rows)
    const headerLabel = row.Header?.ColData?.[0]?.value?.toLowerCase() || ''
    const dataLabel = row.ColData?.[0]?.value?.toLowerCase() || ''
    const label = headerLabel || dataLabel

    // Match beginning cash variations:
    // "Cash and cash equivalents at beginning of year"
    // "Cash at Beginning of Period"
    if (label.includes('beginning') && label.includes('cash')) {
      // Value can be in Summary (for section rows) OR directly in ColData (for data rows)
      const value =
        row.Summary?.ColData?.[row.Summary.ColData.length - 1]?.value ||
        row.ColData?.[row.ColData.length - 1]?.value
      const parsed = parseAmount(value)
      if (parsed !== 0 || beginningCash === 0) {
        beginningCash = parsed
      }
    }
    // Match ending cash variations:
    // "CASH AND CASH EQUIVALENTS AT END OF YEAR"
    // "Cash at End of Period"
    else if (
      (label.includes('end') && label.includes('cash')) ||
      label.includes('cash and cash equivalents at end')
    ) {
      const value =
        row.Summary?.ColData?.[row.Summary.ColData.length - 1]?.value ||
        row.ColData?.[row.ColData.length - 1]?.value
      const parsed = parseAmount(value)
      if (parsed !== 0 || endingCash === 0) {
        endingCash = parsed
      }
    }
  }

  return {
    reportName: report.Header.ReportName,
    startDate: report.Header.StartPeriod,
    endDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,

    operatingActivities: {
      lines: operating.lines,
      total: operating.total,
    },

    investingActivities: {
      lines: investing.lines,
      total: investing.total,
    },

    financingActivities: {
      lines: financing.lines,
      total: financing.total,
    },

    netCashChange,
    // Derive beginning cash if not parsed (check for !== 0 to handle explicit 0)
    // Formula: Beginning Cash = Ending Cash - Net Cash Change
    // If both are missing/0 and netCashChange exists, defaults to 0
    beginningCash:
      beginningCash !== 0 ? beginningCash : endingCash !== 0 ? endingCash - netCashChange : 0,
    // Derive ending cash: Ending = Beginning + Net Change
    endingCash: endingCash !== 0 ? endingCash : beginningCash + netCashChange,
    columns,
  }
}

/**
 * Transform Aged Report (Receivables/Payables)
 *
 * IMPORTANT: QuickBooks Aged Reports have a specific column structure:
 * - Column 0: Empty title (entity name like Vendor/Customer) - this is filtered out by extractColumnHeaders
 * - Column 1+: Aging buckets (Current, 1-30, 31-60, 61-90, 90+, Total)
 *
 * Since extractColumnHeaders filters out empty titles, columns[0] is actually the first aging bucket,
 * not the entity name. We need to handle this correctly to avoid off-by-one bucket alignment issues.
 *
 * HIERARCHICAL STRUCTURE:
 * QuickBooks returns parent customers with sub-customers as Section rows:
 * - type: 'Section'
 * - Header.ColData: parent customer name
 * - Rows.Row: nested sub-customer rows
 * - Summary.ColData: rolled-up totals for the parent
 *
 * We process BOTH flat data rows AND hierarchical Section rows to capture all customers.
 */
export function transformAgedReport(report: QBReportResponse): NormalizedAgedReport {
  const rows = report.Rows?.Row || []

  // Get ALL column titles (including empty ones) to understand the true structure
  const allColumnTitles = report.Columns?.Column?.map((col) => col.ColTitle) || []

  // Get the filtered columns (non-empty titles) for period names
  const columns = extractColumnHeaders(report)

  // Determine if the first column in raw data is the entity name (has empty title)
  // This affects how we slice the ColData when processing rows
  const firstColumnIsEntityName =
    allColumnTitles.length > 0 && (!allColumnTitles[0] || allColumnTitles[0] === '')

  // Extract period names - exclude "Total" column
  // If first column is entity name (empty title), all non-empty columns are periods
  // Otherwise, we need to skip the first column which would be the entity name
  let periods: string[]
  if (firstColumnIsEntityName) {
    // All non-empty column titles are aging periods (entity name had empty title, was filtered out)
    periods = columns.filter((col) => !col.toLowerCase().includes('total'))
  } else {
    // First non-empty column is entity name, skip it
    periods = columns.slice(1).filter((col) => !col.toLowerCase().includes('total'))
  }

  const lines: NormalizedAgedReport['lines'] = []
  const totals: Record<string, number> = {}

  // Initialize totals
  periods.forEach((period) => {
    totals[period] = 0
  })

  /**
   * Helper function to process a single row's ColData and return line item
   */
  function processColData(
    colData: Array<{ value: string; id?: string }>
  ): { name: string; entityId?: string; byPeriod: Record<string, number>; total: number } | null {
    if (!colData || colData.length === 0) return null

    const name = colData[0]?.value || ''
    const entityId = colData[0]?.id

    // Skip summary rows (like "Total for X") and empty names
    if (name.toLowerCase().includes('total') || !name) return null

    const byPeriod: Record<string, number> = {}
    let lineTotal = 0

    // Only process columns that correspond to actual aging periods
    // Skip the "Total" column from QuickBooks (it's already a sum)
    colData.slice(1, periods.length + 1).forEach((col, index) => {
      const period = periods[index]
      if (!period) return // Safety check
      const amount = parseAmount(col.value)
      byPeriod[period] = amount
      lineTotal += amount
    })

    return { name, entityId, byPeriod, total: lineTotal }
  }

  /**
   * Recursively process rows to handle both flat and hierarchical structures
   * QuickBooks returns Section rows for customers with sub-customers/jobs
   *
   * IMPORTANT: To avoid double-counting, we use this strategy:
   * - For Section rows (parents with sub-customers): use the SUMMARY totals (rolled-up)
   *   This gives us the parent customer total including all sub-customers
   * - For regular data rows: process directly
   *
   * This matches how QuickBooks displays the report - showing parent totals
   * that include sub-customer amounts.
   */
  function processRows(rowsToProcess: QBReportRow[], isNestedSubCustomer: boolean = false): void {
    for (const row of rowsToProcess) {
      // Check if this is a Section row (parent with sub-customers)
      if (row.type === 'Section') {
        // Get parent customer name from Header
        const headerName = row.Header?.ColData?.[0]?.value || ''
        const headerId = row.Header?.ColData?.[0]?.id

        // Check if this section has nested sub-customer rows
        const hasNestedRows = row.Rows?.Row && row.Rows.Row.length > 0

        if (hasNestedRows && row.Rows?.Row) {
          // Process nested sub-customer rows - these are the actual line items
          // Pass true to indicate these are sub-customers (for proper naming)
          processRows(row.Rows.Row, true)
        }

        // If there's a Summary with a "Total for X" pattern, this is a parent customer
        // We DON'T add the summary to avoid double-counting (sub-customers already added)
        // The summary is just for display in QuickBooks UI

        // However, if there are NO nested rows but there IS a summary,
        // this could be a customer without sub-customers that's wrapped in a Section
        if (!hasNestedRows && row.Summary?.ColData) {
          const summaryLine = processColData(row.Summary.ColData)
          if (summaryLine) {
            // Use the header name as the entity name
            summaryLine.name = headerName || summaryLine.name
            if (headerId) {
              summaryLine.entityId = headerId
            }
            // Skip if it looks like a "Total for X" summary line
            if (!summaryLine.name.toLowerCase().startsWith('total for ')) {
              lines.push(summaryLine)
              // Add to totals
              for (const period of periods) {
                totals[period] = (totals[period] || 0) + (summaryLine.byPeriod[period] || 0)
              }
            }
          }
        }
      } else if (row.ColData && row.ColData.length > 0) {
        // Regular data row - process directly
        const lineItem = processColData(row.ColData)
        if (lineItem) {
          lines.push(lineItem)
          // Add to totals
          for (const period of periods) {
            totals[period] = (totals[period] || 0) + (lineItem.byPeriod[period] || 0)
          }
        }
      }
    }
  }

  // Process all rows (handles both flat and hierarchical structures)
  processRows(rows)

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0)

  return {
    reportName: report.Header.ReportName,
    reportDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,
    periods,
    lines,
    totals,
    grandTotal,
  }
}

/**
 * Transform Aged Report Detail (Receivables/Payables with invoice-level details)
 *
 * AgedReceivableDetail and AgedPayableDetail reports include:
 * - Individual transactions (invoices/bills) per customer/vendor
 * - Transaction dates, due dates, terms
 * - Days past due calculations
 * - Document numbers and memos
 *
 * QuickBooks Detail Report Column Structure (typical):
 * [Customer/Vendor, Type, Date, Num, Due Date, Past Due, Amount, Open Balance, ...]
 */
export function transformAgedReportDetail(report: QBReportResponse): NormalizedAgedReportDetail {
  const rows = report.Rows?.Row || []

  // Get ALL column titles to understand the structure
  const allColumnTitles = report.Columns?.Column?.map((col) => col.ColTitle) || []

  // Find column indices for key fields
  const findColumnIndex = (patterns: string[]): number => {
    return allColumnTitles.findIndex((title) => {
      if (!title) return false
      const normalized = title.toLowerCase().trim()
      return patterns.some((p) => normalized.includes(p.toLowerCase()))
    })
  }

  // Common column mappings (may vary between receivables and payables)
  const typeColIdx = findColumnIndex(['type', 'txn type', 'transaction type'])
  const dateColIdx = findColumnIndex(['date', 'txn date'])
  const numColIdx = findColumnIndex(['num', 'doc', 'number', 'ref'])
  const dueDateColIdx = findColumnIndex(['due date', 'duedate'])
  const pastDueColIdx = findColumnIndex(['past due', 'days past', 'pastdue'])
  const amountColIdx = findColumnIndex(['amount', 'total'])
  const balanceColIdx = findColumnIndex(['open balance', 'balance', 'open'])
  const termsColIdx = findColumnIndex(['terms', 'payment terms'])
  const memoColIdx = findColumnIndex(['memo', 'description'])

  // Find the aging bucket columns (Current, 1-30, 31-60, etc.)
  // These typically appear after the main data columns
  const agingPatterns = [
    'current',
    '1 - 30',
    '1-30',
    '31 - 60',
    '31-60',
    '61 - 90',
    '61-90',
    '> 90',
    '91',
    'over',
  ]
  const periods: string[] = []
  allColumnTitles.forEach((title) => {
    if (!title) return
    const normalized = title.toLowerCase().trim()
    if (agingPatterns.some((p) => normalized.includes(p)) && !normalized.includes('total')) {
      periods.push(title)
    }
  })

  // If no aging periods found, use default periods
  if (periods.length === 0) {
    periods.push('Current', '1 - 30', '31 - 60', '61 - 90', '> 90')
  }

  const lines: AgedReportDetailLine[] = []
  const totals: Record<string, number> = {}
  let transactionCount = 0

  // Initialize totals
  periods.forEach((period) => {
    totals[period] = 0
  })

  /**
   * Parse a single transaction row
   */
  function parseTransaction(
    colData: Array<{ value: string; id?: string }>
  ): AgedReportTransaction | null {
    if (!colData || colData.length === 0) return null

    // Extract values based on column indices
    const type = typeColIdx >= 0 ? colData[typeColIdx]?.value || '' : ''
    const txnDate = dateColIdx >= 0 ? colData[dateColIdx]?.value || '' : ''
    const docNumber = numColIdx >= 0 ? colData[numColIdx]?.value : undefined
    const dueDate = dueDateColIdx >= 0 ? colData[dueDateColIdx]?.value : undefined
    const daysPastDueStr = pastDueColIdx >= 0 ? colData[pastDueColIdx]?.value : undefined
    const amountStr = amountColIdx >= 0 ? colData[amountColIdx]?.value : undefined
    const balanceStr = balanceColIdx >= 0 ? colData[balanceColIdx]?.value : undefined
    const terms = termsColIdx >= 0 ? colData[termsColIdx]?.value : undefined
    const memo = memoColIdx >= 0 ? colData[memoColIdx]?.value : undefined
    const txnId = amountColIdx >= 0 ? colData[amountColIdx]?.id : undefined

    // Skip if no date (likely a summary row)
    if (!txnDate) return null

    const amount = parseAmount(amountStr)
    const balance = parseAmount(balanceStr)
    const daysPastDue = daysPastDueStr ? parseInt(daysPastDueStr, 10) : undefined

    return {
      type,
      docNumber,
      txnDate,
      dueDate,
      daysPastDue: isNaN(daysPastDue || NaN) ? undefined : daysPastDue,
      amount,
      balance,
      terms,
      txnId,
      memo,
    }
  }

  /**
   * Determine which aging bucket a transaction belongs to based on days past due
   */
  function determineAgingBucket(daysPastDue: number | undefined): string {
    if (daysPastDue === undefined || daysPastDue <= 0) return periods[0] || 'Current'
    if (daysPastDue <= 30)
      return periods.find((p) => p.includes('30') && !p.includes('31')) || periods[1] || '1 - 30'
    if (daysPastDue <= 60)
      return periods.find((p) => p.includes('60') && !p.includes('61')) || periods[2] || '31 - 60'
    if (daysPastDue <= 90)
      return periods.find((p) => p.includes('90') && !p.includes('91')) || periods[3] || '61 - 90'
    return (
      periods.find((p) => p.includes('90') || p.includes('91') || p.includes('>')) ||
      periods[4] ||
      '> 90'
    )
  }

  /**
   * Process rows recursively to handle customer/vendor sections
   */
  function processRows(rowsToProcess: QBReportRow[]): void {
    for (const row of rowsToProcess) {
      if (row.type === 'Section') {
        // Customer/Vendor section
        const headerName = row.Header?.ColData?.[0]?.value || ''
        const headerId = row.Header?.ColData?.[0]?.id

        // Skip summary rows
        if (headerName.toLowerCase().includes('total')) continue

        const transactions: AgedReportTransaction[] = []
        const byPeriod: Record<string, number> = {}
        periods.forEach((p) => (byPeriod[p] = 0))
        let lineTotal = 0

        // Process nested transaction rows
        if (row.Rows?.Row) {
          for (const txnRow of row.Rows.Row) {
            if (txnRow.type === 'Section') {
              // Nested sub-customer/sub-vendor - recurse
              processRows([txnRow])
            } else if (txnRow.ColData) {
              const txn = parseTransaction(txnRow.ColData)
              if (txn) {
                transactions.push(txn)
                transactionCount++

                // Add balance to appropriate aging bucket
                const bucket = determineAgingBucket(txn.daysPastDue)
                byPeriod[bucket] = (byPeriod[bucket] || 0) + txn.balance
                lineTotal += txn.balance
              }
            }
          }
        }

        // Only add if we have transactions
        if (transactions.length > 0) {
          lines.push({
            name: headerName,
            entityId: headerId,
            transactions,
            total: lineTotal,
            byPeriod,
          })

          // Add to totals
          for (const period of periods) {
            totals[period] = (totals[period] || 0) + (byPeriod[period] || 0)
          }
        }
      } else if (row.ColData) {
        // Standalone transaction row (not inside a section)
        const txn = parseTransaction(row.ColData)
        if (txn) {
          // Find or create a "standalone" line for ungrouped transactions
          let standaloneLine = lines.find((l) => l.name === 'Other')
          if (!standaloneLine) {
            standaloneLine = {
              name: 'Other',
              transactions: [],
              total: 0,
              byPeriod: {},
            }
            periods.forEach((p) => (standaloneLine!.byPeriod[p] = 0))
            lines.push(standaloneLine)
          }

          standaloneLine.transactions.push(txn)
          transactionCount++

          const bucket = determineAgingBucket(txn.daysPastDue)
          standaloneLine.byPeriod[bucket] = (standaloneLine.byPeriod[bucket] || 0) + txn.balance
          standaloneLine.total += txn.balance
          totals[bucket] = (totals[bucket] || 0) + txn.balance
        }
      }
    }
  }

  // Process all rows
  processRows(rows)

  const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0)

  return {
    reportName: report.Header.ReportName,
    reportDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,
    periods,
    lines,
    totals,
    grandTotal,
    transactionCount,
  }
}

/**
 * Transform General Ledger report
 *
 * QuickBooks General Ledger has a hierarchical structure:
 * - Top level: Account sections
 * - Nested: Transaction rows within each account
 * - Each account section has Header (account name), Rows (transactions), Summary (balance)
 */
export function transformGeneralLedger(report: QBReportResponse): NormalizedGeneralLedger {
  const rows = report.Rows?.Row || []

  const accounts: NormalizedGeneralLedger['accounts'] = []

  // Process each account section
  for (const accountSection of rows) {
    // Skip non-section rows
    if (accountSection.type !== 'Section') continue

    // Get account info from header
    const headerData = accountSection.Header?.ColData || []
    const accountName = headerData[0]?.value || ''
    const accountId = headerData[0]?.id || ''

    // Skip empty accounts
    if (!accountName) continue

    // Process transactions within the account
    const transactions: NormalizedGeneralLedger['accounts'][0]['transactions'] = []
    let beginningBalance = 0
    let endingBalance = 0

    const transactionRows = accountSection.Rows?.Row || []
    for (const txnRow of transactionRows) {
      // Check if this is a beginning balance row
      if (txnRow.ColData) {
        const rowType = txnRow.ColData[0]?.value?.toLowerCase() || ''

        if (rowType.includes('beginning balance')) {
          // Beginning balance is typically in the last column (balance column)
          beginningBalance = parseAmount(txnRow.ColData[txnRow.ColData.length - 1]?.value)
          continue
        }

        // Regular transaction row
        // Typical columns: Date, Transaction Type, Num, Name, Memo, Split, Debit, Credit, Balance
        // But QB may vary - we handle flexible column count
        if (txnRow.ColData.length >= 4) {
          const date = txnRow.ColData[0]?.value || ''
          const transactionType = txnRow.ColData[1]?.value || ''
          const docNumber = txnRow.ColData[2]?.value
          const name = txnRow.ColData[3]?.value
          const memo = txnRow.ColData.length > 5 ? txnRow.ColData[4]?.value : undefined

          // Find debit, credit, and balance columns (typically last 3)
          const colLen = txnRow.ColData.length
          const debit = colLen >= 3 ? parseAmount(txnRow.ColData[colLen - 3]?.value) : 0
          const credit = colLen >= 2 ? parseAmount(txnRow.ColData[colLen - 2]?.value) : 0
          const balance = parseAmount(txnRow.ColData[colLen - 1]?.value)

          // Skip if this looks like a header or total row
          if (
            date &&
            !date.toLowerCase().includes('total') &&
            !date.toLowerCase().includes('balance')
          ) {
            transactions.push({
              date,
              transactionType,
              docNumber: docNumber || undefined,
              name: name || undefined,
              memo: memo || undefined,
              debit: debit || undefined,
              credit: credit || undefined,
              balance,
            })

            // Track the last balance as potential ending balance
            endingBalance = balance
          }
        }
      }
    }

    // Get ending balance from summary if available
    const summaryData = accountSection.Summary?.ColData || []
    if (summaryData.length > 0) {
      // Summary typically has the ending balance in the last column
      endingBalance = parseAmount(summaryData[summaryData.length - 1]?.value)
    }

    accounts.push({
      accountId,
      accountName,
      accountType: '', // Will be enriched from COA
      beginningBalance,
      endingBalance,
      transactions,
    })
  }

  return {
    reportName: report.Header.ReportName,
    startDate: report.Header.StartPeriod,
    endDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,
    accounts,
  }
}

/**
 * Transform Trial Balance report
 */
export function transformTrialBalance(report: QBReportResponse): NormalizedTrialBalance {
  const rows = report.Rows?.Row || []

  const accounts: NormalizedTrialBalance['accounts'] = []
  let totalDebits = 0
  let totalCredits = 0

  // Process rows
  for (const row of rows) {
    if (row.ColData && row.ColData.length >= 3) {
      const accountName = row.ColData[0]?.value || ''
      const accountId = row.ColData[0]?.id

      // Skip summary/total rows
      if (accountName.toLowerCase().includes('total') || !accountName) continue

      const debit = parseAmount(row.ColData[1]?.value)
      const credit = parseAmount(row.ColData[2]?.value)

      accounts.push({
        accountId: accountId || '',
        accountName,
        accountType: '', // Trial balance doesn't include account type
        debit,
        credit,
      })

      totalDebits += debit
      totalCredits += credit
    }
  }

  // Check if balanced (with small tolerance for rounding)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01

  return {
    reportName: report.Header.ReportName,
    asOfDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,
    accounts,
    totalDebits,
    totalCredits,
    isBalanced,
  }
}
