// src/app/(main)/reports/views/PnLView.tsx
'use client'

import React, { useMemo, useEffect } from 'react'
import {
  useProfitLossData,
  usePnLMonthlyTrend,
  useCategoryBreakdownTrend,
} from '@/hooks/useReportData'
import { useAccountLookup } from '@/hooks/useCOA'
import { formatPnLCurrency, safePercentage } from '@/lib/utils/currency'
import { useReportsContext } from '@/contexts/ReportsContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { ReportLoadingState } from '../components/ReportLoadingState'
import { ReportErrorState } from '../components/ReportErrorState'
import { useCollapsibleSections } from '../components/hooks/useCollapsibleSections'
import { useMetricStorage } from '../components/hooks/useMetricStorage'
import { PnLMetricsGrid } from '../components/pnl/PnLMetricsGrid'
import { CategoryBreakdownChart } from '../components/pnl/CategoryBreakdownChart'
import { IncomeStatementTable } from '../components/pnl/IncomeStatementTable'
import { AIAnalysisCard } from '@/components/ai-analysis'
import {
  BookkeepingValidationAlert,
  validatePnLData,
} from '../components/BookkeepingValidationAlert'
import type { PnLItem } from '@/app/(main)/reports/types'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'

export function PnLView() {
  const { dateRange } = useReportsContext()
  const { currency } = useCurrency()

  // Fetch data from API using context dates
  const { reportData, isLoading, isValidating, error, mutate } = useProfitLossData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end,
  })

  // Detect single-month period (e.g., "This Month", "Last Month")
  // When only one month of data exists, charts need alternative visualizations
  const isSingleMonth = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return false
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  }, [dateRange.start, dateRange.end])

  // Fetch monthly trend data separately
  const { trendData, isLoading: trendLoading } = usePnLMonthlyTrend(dateRange.start, dateRange.end)

  // Fetch category breakdown trend data for multi-series line chart
  const {
    expensesData: categoryExpensesData,
    revenueData: categoryRevenueData,
    isLoading: categoryBreakdownLoading,
  } = useCategoryBreakdownTrend(dateRange.start, dateRange.end)

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !reportData)
  }, [isLoading, reportData, welcomeContext])

  // State for collapsible sections - must be declared before any early returns
  const { expandedSections, toggleSection } = useCollapsibleSections([
    'Revenue',
    'Cost of Goods Sold',
    'Expenses',
    'Other Income',
    'Other Expenses',
  ])

  // Fetch Chart of Accounts for account number lookup and hierarchy
  const {
    getAccountByName,
    getAccountByNameAndClassification,
    getAccountDepth,
    getParentAccountName,
    groupItemsByParent,
  } = useAccountLookup()

  // SWR automatically refetches when date range changes, no manual refetch needed

  // Extract data from API response (needed for useEffect dependencies)
  const data = reportData?.data || {}

  // Merge trend data into the data object for PnLMetricsGrid
  const dataWithTrend = useMemo(
    () => ({
      ...data,
      monthlyTrend: trendData,
    }),
    [data, trendData]
  )

  // Type guard for KPI data
  interface KpiData {
    totalRevenue?: number
    totalExpenses?: number
    costOfGoodsSold?: number
    operatingExpenses?: number
    otherExpenses?: number
    otherIncome?: number
    grossProfit?: number
    netIncome?: number
    grossMargin?: number
    operatingMargin?: number
    monthsInPeriod?: number
    cashBalance?: number
    ebitda?: number
    netProfitMargin?: number
    previousRevenue?: number
    previousExpenses?: number
    previousNetIncome?: number
  }

  function isKpiData(obj: unknown): obj is KpiData {
    return obj !== null && typeof obj === 'object'
  }

  const kpis = isKpiData(data.kpis) ? data.kpis : {}

  // Use backend-provided metrics directly with fallbacks for backwards compatibility
  // Backend calculates these values from QuickBooks data, frontend just displays them
  const totalRevenue = kpis.totalRevenue || 0
  const totalExpenses = kpis.totalExpenses || 0
  const costOfGoodsSold = kpis.costOfGoodsSold || 0
  const operatingExpenses = kpis.operatingExpenses || totalExpenses - costOfGoodsSold
  const otherExpenses = kpis.otherExpenses || 0
  const otherIncome = kpis.otherIncome || 0
  const grossProfit = kpis.grossProfit || 0
  const netIncome = kpis.netIncome || 0

  // Use backend-provided margins directly (backend already calculates these)
  const grossMarginRaw = kpis.grossMargin ?? 0
  const operatingMarginRaw = kpis.operatingMargin ?? 0

  // Calculate expense ratio (not typically provided by backend)
  const expenseRatioRaw = safePercentage(totalExpenses, totalRevenue)

  const grossMargin = grossMarginRaw ?? 0
  const operatingMargin = operatingMarginRaw ?? 0
  const expenseRatio = expenseRatioRaw ?? 0

  const monthsInPeriod = kpis.monthsInPeriod || 1
  const grossBurnRate = monthsInPeriod > 0 ? totalExpenses / monthsInPeriod : totalExpenses
  const netBurnRate =
    monthsInPeriod > 0
      ? (totalExpenses - totalRevenue) / monthsInPeriod
      : totalExpenses - totalRevenue
  const cashBalance = kpis.cashBalance || 0
  const runway = cashBalance > 0 && grossBurnRate > 0 ? cashBalance / grossBurnRate : 0

  // Prepare contextData for learn modals with all calculated metrics
  // Use useMemo to stabilize the object reference and prevent unnecessary re-renders
  const contextData = useMemo(
    () => ({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      gross_profit: grossProfit,
      net_income: netIncome,
      gross_margin_pct: grossMargin,
      burn_rate: grossBurnRate,
      runway_months: runway,
      cash_balance: cashBalance,
      operating_margin_pct: operatingMargin,
      expense_ratio: expenseRatio,
      ebitda: kpis.ebitda || 0,
      net_profit_margin: kpis.netProfitMargin || 0,
    }),
    [
      totalRevenue,
      totalExpenses,
      grossProfit,
      netIncome,
      grossMargin,
      grossBurnRate,
      runway,
      cashBalance,
      operatingMargin,
      expenseRatio,
      kpis.ebitda,
      kpis.netProfitMargin,
    ]
  )

  // Store in sessionStorage for learn pages to access
  useMetricStorage(contextData, dateRange, isLoading)

  // Data validation - Net Income = Revenue + Other Income - COGS - Operating Expenses - Other Expenses
  const calculatedNetIncome =
    totalRevenue + otherIncome - (costOfGoodsSold + operatingExpenses + otherExpenses)
  const reconciliationError = Math.abs(calculatedNetIncome - netIncome) > 0.01

  // Generate validation issues for bookkeeping alerts
  const validationIssues = useMemo(
    () =>
      validatePnLData({
        totalRevenue,
        costOfGoodsSold,
        operatingExpenses,
        otherExpenses,
        otherIncome,
        grossProfit,
        netIncome,
      }),
    [
      totalRevenue,
      costOfGoodsSold,
      operatingExpenses,
      otherExpenses,
      otherIncome,
      grossProfit,
      netIncome,
    ]
  )

  const monthlyBurnRate = netBurnRate // for backward compatibility in Net Burn Rate display

  // Income breakdown - show all revenue items (contra-revenue items may be negative)
  const incomeBreakdown = (() => {
    if (data.revenueByCategory && data.revenueByCategory.length > 0) {
      // Include all items, including contra-revenue (discounts) which may be negative
      return data.revenueByCategory.filter((item: any) => item.value !== 0)
    }
    return totalRevenue > 0 ? [{ name: 'Total Revenue', value: totalRevenue }] : []
  })()

  // Other Income breakdown - non-operating income (interest, exchange gains, etc.)
  const otherIncomeBreakdown = (() => {
    if (data.otherIncomeByCategory && data.otherIncomeByCategory.length > 0) {
      return data.otherIncomeByCategory.filter((item: any) => item.value !== 0)
    }
    return otherIncome > 0 ? [{ name: 'Other Income', value: otherIncome }] : []
  })()

  // Expense breakdown - show all expenses including COGS, preserving section info AND hierarchy
  const expenseBreakdown = (() => {
    if (data.expenseCategories && data.expenseCategories.length > 0) {
      // Get expense categories from API, preserving section info AND level for hierarchy
      // IMPORTANT: Do NOT sort - preserve original order from API for hierarchy
      const categories = data.expenseCategories
        .map((item: any) => ({
          name: item.name || item.category || 'Expense',
          value: Math.abs(item.amount || item.value || 0),
          section: item.section, // Preserve section: 'COGS', 'Operating', or 'Other'
          level: item.level ?? 0, // Preserve hierarchy level from API
          accountId: item.accountId, // Preserve account ID
        }))
        .filter((item: any) => item.value > 0)
      // NOTE: Removed .sort() to preserve hierarchical order from API

      // Check if COGS is missing from the breakdown
      const hasCOGS = categories.some(
        (item: any) =>
          item.section === 'COGS' ||
          item.name.toLowerCase().includes('cost of goods') ||
          item.name.toLowerCase().includes('cogs')
      )

      // If categories don't include COGS and COGS exists, prepend it
      if (!hasCOGS && costOfGoodsSold > 0) {
        categories.unshift({
          name: 'Cost of Goods Sold',
          value: costOfGoodsSold,
          section: 'COGS',
          level: 0,
          accountId: undefined,
        })
      }

      return categories // Return all categories without slicing
    }
    // If no detailed breakdown, show COGS and Operating Expenses separately
    const breakdown: Array<{
      name: string
      value: number
      section: string
      level: number
      accountId?: string
    }> = []
    if (costOfGoodsSold > 0) {
      breakdown.push({
        name: 'Cost of Goods Sold',
        value: costOfGoodsSold,
        section: 'COGS',
        level: 0,
        accountId: undefined,
      })
    }
    if (operatingExpenses > 0) {
      breakdown.push({
        name: 'Operating Expenses',
        value: operatingExpenses,
        section: 'Operating',
        level: 0,
        accountId: undefined,
      })
    }
    if (otherExpenses > 0) {
      breakdown.push({
        name: 'Other Expenses',
        value: otherExpenses,
        section: 'Other',
        level: 0,
        accountId: undefined,
      })
    }
    return breakdown
  })()

  // P&L Flow data
  const plFlowData = []
  if (totalRevenue !== 0) {
    plFlowData.push({ name: 'Revenue', value: totalRevenue })
  }
  if (costOfGoodsSold !== 0) {
    plFlowData.push({ name: 'Cost of Goods Sold', value: -Math.abs(costOfGoodsSold) })
  }
  if (operatingExpenses !== 0) {
    plFlowData.push({ name: 'Operating Expenses', value: -Math.abs(operatingExpenses) })
  }
  if (otherIncome !== 0) {
    plFlowData.push({ name: 'Other Income', value: otherIncome })
  }
  if (otherExpenses !== 0) {
    plFlowData.push({ name: 'Other Expenses', value: -Math.abs(otherExpenses) })
  }
  plFlowData.push({ name: 'Net Income', value: netIncome })

  // Prepare Income Statement table data with collapsible sections
  // IMPORTANT: This useMemo must be called before any early returns to comply with Rules of Hooks
  const incomeStatementData = React.useMemo(() => {
    const data: PnLItem[] = []

    // Type for backend hierarchy (matches EnrichedHierarchyItem from enricher)
    interface BackendHierarchyItem {
      name: string
      fullPath: string
      total: number
      ownValue?: number
      level: number
      accountId?: string
      children: BackendHierarchyItem[]
    }

    // NEW: Simplified function that uses pre-built hierarchy from backend
    // This replaces the complex COA lookup and tree-building logic
    const addItemsFromBackendHierarchy = (
      result: PnLItem[],
      hierarchy: BackendHierarchyItem[],
      parentCategory: string,
      isExpense: boolean = false,
      baseNestingLevel: number = 1
    ) => {
      const walkHierarchy = (
        nodes: BackendHierarchyItem[],
        category: string,
        nestingLevel: number
      ) => {
        nodes.forEach((node) => {
          const hasChildren = node.children && node.children.length > 0
          const sectionKey = `${category}_${node.name.replace(/\s+/g, '')}`

          if (hasChildren) {
            // Parent node - show as collapsible sub-header
            const isNodeExpanded = expandedSections.has(sectionKey)

            result.push({
              category: sectionKey,
              name: node.name,
              amount: isExpense ? -Math.abs(node.total) : node.total,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: isNodeExpanded,
              childCount: node.children.length,
              isSubtotal: false,
              isTotal: false,
              isChild: false,
              depth: node.level,
              nestingLevel,
              accountId: node.accountId,
            })

            if (isNodeExpanded) {
              // Show parent's own transactions if any
              if (node.ownValue && node.ownValue > 0) {
                result.push({
                  category: sectionKey,
                  name: node.name,
                  amount: isExpense ? -Math.abs(node.ownValue) : node.ownValue,
                  isHeader: false,
                  isSubtotal: false,
                  isTotal: false,
                  isChild: true,
                  isNestedChild: nestingLevel > 1,
                  depth: node.level + 1,
                  nestingLevel: nestingLevel + 1,
                  accountId: node.accountId,
                })
              }

              // Recursively add children
              walkHierarchy(node.children, sectionKey, nestingLevel + 1)

              // Add subtotal for this group
              result.push({
                category: sectionKey,
                name: `Total ${node.name}`,
                amount: isExpense ? -Math.abs(node.total) : node.total,
                isHeader: false,
                isSubtotal: true,
                isNestedSubtotal: true,
                isTotal: false,
                depth: node.level,
                nestingLevel,
              })
            }
          } else {
            // Leaf node - show as regular item
            result.push({
              category,
              name: node.name,
              amount: isExpense ? -Math.abs(node.total) : node.total,
              isHeader: false,
              isSubtotal: false,
              isTotal: false,
              isChild: true,
              isNestedChild: nestingLevel > 1,
              depth: node.level,
              nestingLevel,
              accountId: node.accountId,
            })
          }
        })
      }

      walkHierarchy(hierarchy, parentCategory, baseNestingLevel)
    }

    // Helper function to add items with hierarchical grouping (QuickBooks-style)
    // Uses Chart of Accounts (COA) fully_qualified_name to determine true hierarchy
    // Supports multi-level nesting: Landscaping Services > Job Materials > Plants
    const addItemsWithHierarchy = (
      result: PnLItem[],
      items: Array<{ name: string; value: number; level?: number; accountId?: string }>,
      category: string,
      isExpense: boolean = false
    ) => {
      if (items.length === 0) return

      // Build a tree structure using COA hierarchy info
      interface TreeNode {
        name: string
        value: number
        ownValue?: number // Parent's direct transactions (before adding children)
        level: number
        accountId?: string
        fullPath: string // fully_qualified_name for determining hierarchy
        children: TreeNode[]
      }

      // First, enrich items with COA info to get true hierarchy levels
      // Use classification-aware lookup to avoid mixing Revenue and Expense accounts with same names
      const classification = isExpense ? 'Expense' : 'Revenue'

      const enrichedItems = items.map((item) => {
        // Look up account by name AND classification to get the correct account
        // This prevents "Plants and Soil" (expense) from finding "Landscaping Services:Job Materials:Plants and Soil" (revenue)
        const account =
          getAccountByNameAndClassification(item.name, classification) ||
          getAccountByName(item.name) // Fallback to name-only lookup

        // Use COA fully_qualified_name to determine hierarchy
        // This preserves QuickBooks' nested account structure (e.g., "6100 Advertising & Marketing:6110 Client Acquisition Cost")
        // The fully_qualified_name contains the full path with colons as separators
        let fullPath: string

        if (account?.fully_qualified_name) {
          // Use COA hierarchy - this is the source of truth for account nesting
          fullPath = account.fully_qualified_name
        } else {
          // Fallback to just the name if no COA match found
          fullPath = item.name
        }

        // Calculate depth from path: "Parent:Child:GrandChild" = depth 2
        const pathParts = fullPath.split(':')
        const calculatedLevel = pathParts.length - 1

        return {
          ...item,
          fullPath,
          level: calculatedLevel, // Use COA-based level for proper hierarchy
          accountId: account?.id || item.accountId,
        }
      })

      // Step 1: Identify missing intermediate parents and create virtual nodes
      // e.g., "Landscaping Services:Job Materials:Plants" - if "Job Materials" has no transactions,
      // it won't be in the data, but we need it as a parent node for proper hierarchy
      const allPaths = new Set(enrichedItems.map((item) => item.fullPath))
      const missingParents = new Map<string, { name: string; level: number; fullPath: string }>()

      enrichedItems.forEach((item) => {
        const pathParts = item.fullPath.split(':')

        // For paths with 2+ parts, check if all ancestor paths exist
        for (let i = 1; i < pathParts.length; i++) {
          const ancestorPath = pathParts.slice(0, i).join(':')

          if (!allPaths.has(ancestorPath) && !missingParents.has(ancestorPath)) {
            // This intermediate parent is missing - create virtual node
            missingParents.set(ancestorPath, {
              name: pathParts[i - 1], // The name is the last part of the ancestor path
              level: i - 1, // Level based on depth in path
              fullPath: ancestorPath,
            })
          }
        }
      })

      // Step 2: Add virtual parents to the items list
      const itemsWithVirtualParents = [
        ...enrichedItems,
        ...Array.from(missingParents.values()).map((vp) => ({
          name: vp.name,
          value: 0, // Virtual nodes have no direct value (sum will be calculated from children)
          level: vp.level,
          fullPath: vp.fullPath,
          accountId: undefined,
        })),
      ]

      // Step 3: Sort by fullPath to ensure parents come before children
      itemsWithVirtualParents.sort((a, b) => a.fullPath.localeCompare(b.fullPath))

      // Build tree using fullPath to determine parent-child relationships
      const buildTree = (flatItems: typeof itemsWithVirtualParents): TreeNode[] => {
        const roots: TreeNode[] = []

        // Create a map of path -> node for quick lookup
        const nodeMap = new Map<string, TreeNode>()

        // First pass: create all nodes
        flatItems.forEach((item) => {
          const node: TreeNode = {
            name: item.name,
            value: item.value,
            level: item.level,
            accountId: item.accountId,
            fullPath: item.fullPath,
            children: [],
          }
          nodeMap.set(item.fullPath, node)
        })

        // Second pass: build tree relationships using fullPath
        flatItems.forEach((item) => {
          const node = nodeMap.get(item.fullPath)!
          const pathParts = item.fullPath.split(':')

          if (pathParts.length === 1) {
            // Top-level item, add to roots
            roots.push(node)
          } else {
            // Find immediate parent by path
            const parentPath = pathParts.slice(0, -1).join(':')
            const parentNode = nodeMap.get(parentPath)

            if (parentNode && !parentNode.children.includes(node)) {
              parentNode.children.push(node)
            } else {
              // Fallback: find closest existing ancestor
              let foundParent = false
              for (let i = pathParts.length - 2; i >= 1; i--) {
                const ancestorPath = pathParts.slice(0, i).join(':')
                const ancestorNode = nodeMap.get(ancestorPath)

                if (ancestorNode && !ancestorNode.children.includes(node)) {
                  ancestorNode.children.push(node)
                  foundParent = true
                  break
                }
              }

              if (!foundParent) {
                roots.push(node)
              }
            }
          }
        })

        // Third pass: calculate totals for parent nodes
        // QuickBooks shows parent total = parent's own value + sum of all children
        // This ensures parents show the correct rolled-up total when collapsed
        const calculateNodeTotal = (node: TreeNode): number => {
          if (node.children.length === 0) {
            return node.value
          }
          // Store the parent's own direct transactions before adding children
          // This allows us to display it as a separate line item when expanded
          node.ownValue = node.value

          // Sum of all children's totals
          const childrenTotal = node.children.reduce(
            (sum, child) => sum + calculateNodeTotal(child),
            0
          )
          // Parent's total = own value + children's total
          // (own value may be 0 for virtual parents, or have actual transactions)
          node.value = node.value + childrenTotal
          return node.value
        }

        // Calculate totals for all root nodes (and recursively their children)
        roots.forEach((root) => calculateNodeTotal(root))

        return roots
      }

      // Recursively add tree nodes to result with proper nesting
      const addTreeNodes = (
        nodes: TreeNode[],
        parentCategory: string,
        baseNestingLevel: number
      ) => {
        nodes.forEach((node) => {
          // Use classification-aware lookup
          const account =
            getAccountByNameAndClassification(node.name, classification) ||
            getAccountByName(node.name)
          const sectionKey = `${parentCategory}_${node.name.replace(/\s+/g, '')}`
          const hasChildren = node.children.length > 0

          if (hasChildren) {
            // This is a parent node - show as collapsible sub-header
            const isNodeExpanded = expandedSections.has(sectionKey)

            result.push({
              category: sectionKey,
              name: node.name,
              amount: isExpense ? -Math.abs(node.value) : node.value,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: isNodeExpanded,
              childCount: node.children.length,
              isSubtotal: false,
              isTotal: false,
              isChild: false,
              depth: node.level,
              nestingLevel: baseNestingLevel,
              accountId: account?.id || node.accountId,
              accountNumber: account?.account_number,
            })

            // Only add children if this node is expanded
            if (isNodeExpanded) {
              // If parent has its own direct transactions, show as a separate line
              // QuickBooks shows this as the parent name at the child level
              if (node.ownValue && node.ownValue > 0) {
                result.push({
                  category: sectionKey,
                  name: node.name, // Same name as parent, displayed at child level
                  amount: isExpense ? -Math.abs(node.ownValue) : node.ownValue,
                  isHeader: false,
                  isSubtotal: false,
                  isTotal: false,
                  isChild: true,
                  isNestedChild: baseNestingLevel > 1,
                  depth: node.level + 1,
                  nestingLevel: baseNestingLevel + 1,
                  accountId: account?.id || node.accountId,
                  accountNumber: account?.account_number,
                })
              }

              // Recursively add children
              addTreeNodes(node.children, sectionKey, baseNestingLevel + 1)

              // Add subtotal for this parent group (node.value already has the correct total)
              result.push({
                category: sectionKey,
                name: `Total ${node.name}`,
                amount: isExpense ? -Math.abs(node.value) : node.value,
                isHeader: false,
                isSubtotal: true,
                isNestedSubtotal: true,
                isTotal: false,
                depth: node.level,
                nestingLevel: baseNestingLevel,
              })
            }
          } else {
            // This is a leaf node (no children) - show as regular item
            result.push({
              category: parentCategory,
              name: node.name,
              amount: isExpense ? -Math.abs(node.value) : node.value,
              isHeader: false,
              isSubtotal: false,
              isTotal: false,
              isChild: true,
              isNestedChild: baseNestingLevel > 1,
              depth: node.level,
              nestingLevel: baseNestingLevel,
              accountId: account?.id || node.accountId,
              accountNumber: account?.account_number,
            })
          }
        })
      }

      // Build tree and add to result using items with virtual parents
      const tree = buildTree(itemsWithVirtualParents)

      addTreeNodes(tree, category, 1) // Start at nesting level 1 (under main header)
    }

    // Revenue section (Main Header - nestingLevel 0)
    data.push({
      category: 'Revenue',
      name: 'Revenue',
      amount: totalRevenue, // Pass total for collapsed display
      isHeader: true,
      isSubtotal: false,
      isTotal: false,
      isCollapsible: true,
      isExpanded: expandedSections.has('Revenue'),
      childCount: incomeBreakdown.length,
      nestingLevel: 0, // Main header
    })

    if (expandedSections.has('Revenue')) {
      // Use backend hierarchy if available, otherwise fall back to COA-based building
      const revenueHierarchy = reportData?.data?.revenueHierarchy
      if (revenueHierarchy && revenueHierarchy.length > 0) {
        addItemsFromBackendHierarchy(data, revenueHierarchy, 'Revenue', false)
      } else {
        addItemsWithHierarchy(data, incomeBreakdown, 'Revenue', false)
      }

      // Only show Total Revenue when section is expanded
      data.push({
        category: 'Revenue',
        name: 'Total Revenue',
        amount: totalRevenue,
        isHeader: false,
        isSubtotal: true,
        isTotal: false,
        nestingLevel: 0, // Section subtotal
      })
    }

    // COGS section - use cogsHierarchy if available for expandable view
    if (costOfGoodsSold > 0) {
      const cogsHierarchy = reportData?.data?.cogsHierarchy
      const cogsItems = expenseBreakdown.filter((item: any) => item.section === 'COGS')
      const hasCogsHierarchy = cogsHierarchy && cogsHierarchy.length > 0

      if (hasCogsHierarchy || cogsItems.length > 1) {
        // Make COGS expandable if there's hierarchy or multiple items
        data.push({
          category: 'Cost of Goods Sold',
          name: 'Cost of Goods Sold',
          amount: -Math.abs(costOfGoodsSold),
          isHeader: true,
          isSubtotal: false,
          isTotal: false,
          isCollapsible: true,
          isExpanded: expandedSections.has('Cost of Goods Sold'),
          childCount: hasCogsHierarchy ? cogsHierarchy.length : cogsItems.length,
          nestingLevel: 0,
        })

        if (expandedSections.has('Cost of Goods Sold')) {
          if (hasCogsHierarchy) {
            addItemsFromBackendHierarchy(data, cogsHierarchy, 'Cost of Goods Sold', true)
          } else {
            addItemsWithHierarchy(
              data,
              cogsItems.map((item: any) => ({
                name: item.name,
                value: item.value || item.amount || 0,
                level: item.level || 0,
                accountId: item.accountId,
              })),
              'Cost of Goods Sold',
              true
            )
          }

          // Show Total COGS when expanded
          data.push({
            category: 'Cost of Goods Sold',
            name: 'Total Cost of Goods Sold',
            amount: -Math.abs(costOfGoodsSold),
            isHeader: false,
            isSubtotal: true,
            isTotal: false,
            nestingLevel: 0,
          })
        }
      } else {
        // Single COGS item - show as simple line
        data.push({
          category: 'Cost of Goods Sold',
          name: 'Cost of Goods Sold',
          amount: -Math.abs(costOfGoodsSold),
          isHeader: false,
          isSubtotal: false,
          isTotal: false,
          nestingLevel: 0,
        })
      }
    }

    // Gross Profit (Key Subtotal - nestingLevel 0)
    data.push({
      category: 'Gross Profit',
      name: 'Gross Profit',
      amount: grossProfit,
      isHeader: false,
      isSubtotal: true,
      isTotal: false,
      nestingLevel: 0, // Key subtotal
    })

    // Expenses - filter by section to exclude COGS and Other Expenses
    const operatingExpenseItems = expenseBreakdown.filter(
      (item: any) =>
        item.name !== 'Cost of Goods Sold' && item.section !== 'COGS' && item.section !== 'Other'
    )
    if (operatingExpenseItems.length > 0) {
      data.push({
        category: 'Expenses',
        name: 'Expenses',
        amount: -Math.abs(operatingExpenses), // Pass total for collapsed display
        isHeader: true,
        isSubtotal: false,
        isTotal: false,
        isCollapsible: true,
        isExpanded: expandedSections.has('Expenses'),
        childCount: operatingExpenseItems.length,
        nestingLevel: 0, // Main header
      })

      if (expandedSections.has('Expenses')) {
        // Use backend hierarchy if available, otherwise fall back to COA-based building
        // Note: expenseHierarchy contains only operating expenses (COGS is in separate cogsHierarchy)
        const expenseHierarchy = reportData?.data?.expenseHierarchy
        if (expenseHierarchy && expenseHierarchy.length > 0) {
          addItemsFromBackendHierarchy(data, expenseHierarchy, 'Expenses', true)
        } else {
          addItemsWithHierarchy(
            data,
            operatingExpenseItems.map((item: any) => ({
              name: item.name,
              value: item.value || item.amount || 0,
              level: item.level || 0,
              accountId: item.accountId,
            })),
            'Expenses',
            true
          )
        }

        // Only show Total Expenses when section is expanded
        data.push({
          category: 'Expenses',
          name: 'Total Expenses',
          amount: -Math.abs(operatingExpenses),
          isHeader: false,
          isSubtotal: true,
          isTotal: false,
          nestingLevel: 0, // Section subtotal
        })
      }
    }

    // Net Operating Income (Key Subtotal - nestingLevel 0)
    data.push({
      category: 'Net Operating Income',
      name: 'Net Operating Income',
      amount: totalRevenue - costOfGoodsSold - operatingExpenses,
      isHeader: false,
      isSubtotal: true,
      isTotal: false,
      nestingLevel: 0, // Key subtotal
    })

    // Other Income (if any) - non-operating income like interest, exchange gains
    if (otherIncome > 0 || otherIncomeBreakdown.length > 0) {
      data.push({
        category: 'Other Income',
        name: 'Other Income',
        amount: otherIncome, // Pass total for collapsed display
        isHeader: true,
        isSubtotal: false,
        isTotal: false,
        isCollapsible: true,
        isExpanded: expandedSections.has('Other Income'),
        childCount: otherIncomeBreakdown.length,
        nestingLevel: 0, // Main header
      })

      if (expandedSections.has('Other Income') && otherIncomeBreakdown.length > 0) {
        // Use backend hierarchy if available, otherwise fall back to COA-based building
        const otherIncomeHierarchy = reportData?.data?.otherIncomeHierarchy
        if (otherIncomeHierarchy && otherIncomeHierarchy.length > 0) {
          addItemsFromBackendHierarchy(data, otherIncomeHierarchy, 'Other Income', false)
        } else {
          addItemsWithHierarchy(data, otherIncomeBreakdown, 'Other Income', false)
        }

        // Only show Total Other Income when section is expanded
        data.push({
          category: 'Other Income',
          name: 'Total Other Income',
          amount: otherIncome,
          isHeader: false,
          isSubtotal: true,
          isTotal: false,
          nestingLevel: 0, // Section subtotal
        })
      }
    }

    // Other Expenses (if any) - show line items if available
    const otherExpenseItems = expenseBreakdown.filter((item: any) => item.section === 'Other')
    if (otherExpenses > 0 || otherExpenseItems.length > 0) {
      data.push({
        category: 'Other Expenses',
        name: 'Other Expenses',
        amount: -Math.abs(otherExpenses), // Pass total for collapsed display
        isHeader: true,
        isSubtotal: false,
        isTotal: false,
        isCollapsible: true,
        isExpanded: expandedSections.has('Other Expenses'),
        childCount: otherExpenseItems.length,
        nestingLevel: 0, // Main header
      })

      if (expandedSections.has('Other Expenses') && otherExpenseItems.length > 0) {
        // Note: Other Expenses uses the flat list (not backend hierarchy) since
        // expenseHierarchy combines all expenses and is used in the main Expenses section
        addItemsWithHierarchy(
          data,
          otherExpenseItems.map((item: any) => ({
            name: item.name,
            value: item.value || item.amount || 0,
            level: item.level || 0,
            accountId: item.accountId,
          })),
          'Other Expenses',
          true
        )

        // Only show Total Other Expenses when section is expanded
        data.push({
          category: 'Other Expenses',
          name: 'Total Other Expenses',
          amount: -Math.abs(otherExpenses),
          isHeader: false,
          isSubtotal: true,
          isTotal: false,
          nestingLevel: 0, // Section subtotal
        })
      }
    }

    // Net Other Income (Key Subtotal - nestingLevel 0)
    // Only show if there's actual Other Income items OR Other Expenses
    // Don't rely on otherIncome KPI as it may incorrectly contain Net instead of Gross
    if (otherIncomeBreakdown.length > 0 || otherExpenses > 0) {
      // Calculate gross Other Income from breakdown items
      // If there are no Other Income items, gross Other Income = 0
      const grossOtherIncome =
        otherIncomeBreakdown.length > 0
          ? otherIncomeBreakdown.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
          : 0

      // Net Other Income = Gross Other Income - Other Expenses
      // This matches QuickBooks calculation exactly
      const netOtherIncomeAmount = grossOtherIncome - otherExpenses

      data.push({
        category: 'Net Other Income',
        name: 'Net Other Income',
        amount: netOtherIncomeAmount,
        isHeader: false,
        isSubtotal: true,
        isTotal: false,
        nestingLevel: 0, // Key subtotal
      })
    }

    // Net Income (Final Total - nestingLevel 0)
    data.push({
      category: 'Net Income',
      name: 'Net Income',
      amount: netIncome,
      isHeader: false,
      isSubtotal: false,
      isTotal: true,
      isFinalTotal: true,
      nestingLevel: 0, // Final total
    })

    return data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    expandedSections,
    incomeBreakdown,
    otherIncomeBreakdown,
    totalRevenue,
    costOfGoodsSold,
    grossProfit,
    expenseBreakdown,
    operatingExpenses,
    otherIncome,
    otherExpenses,
    netIncome,
    reportData?.data?.otherIncomeItems,
    // Backend hierarchy fields for nested P&L display
    reportData?.data?.revenueHierarchy,
    reportData?.data?.otherIncomeHierarchy,
    reportData?.data?.expenseHierarchy,
    getAccountByName,
    getAccountByNameAndClassification,
    getAccountDepth,
    groupItemsByParent,
  ])

  // Generate export data with ALL sections expanded (for PDF/CSV/Markdown exports)
  // This is a simplified version that always walks the full hierarchy
  const incomeStatementExportData = React.useMemo(() => {
    const result: PnLItem[] = []

    // Helper to recursively walk backend hierarchy and add ALL items
    interface BackendHierarchyItem {
      name: string
      fullPath: string
      total: number
      ownValue?: number
      level: number
      accountId?: string
      children: BackendHierarchyItem[]
    }

    const walkHierarchyForExport = (
      nodes: BackendHierarchyItem[],
      category: string,
      isExpense: boolean,
      baseNestingLevel: number
    ) => {
      nodes.forEach((node) => {
        const hasChildren = node.children && node.children.length > 0

        if (hasChildren) {
          // Parent node - show as sub-header
          result.push({
            category,
            name: node.name,
            amount: isExpense ? -Math.abs(node.total) : node.total,
            isHeader: true,
            isSubHeader: true,
            isCollapsible: true,
            isExpanded: true, // Always expanded for export
            childCount: node.children.length,
            nestingLevel: baseNestingLevel,
            accountId: node.accountId,
          })

          // Show parent's own transactions if any
          if (node.ownValue && node.ownValue > 0) {
            result.push({
              category,
              name: node.name,
              amount: isExpense ? -Math.abs(node.ownValue) : node.ownValue,
              isChild: true,
              isNestedChild: baseNestingLevel > 1,
              nestingLevel: baseNestingLevel + 1,
              accountId: node.accountId,
            })
          }

          // Recursively add children
          walkHierarchyForExport(node.children, category, isExpense, baseNestingLevel + 1)

          // Add subtotal
          result.push({
            category,
            name: `Total ${node.name}`,
            amount: isExpense ? -Math.abs(node.total) : node.total,
            isSubtotal: true,
            isNestedSubtotal: true,
            nestingLevel: baseNestingLevel,
          })
        } else {
          // Leaf node
          result.push({
            category,
            name: node.name,
            amount: isExpense ? -Math.abs(node.total) : node.total,
            isChild: true,
            isNestedChild: baseNestingLevel > 1,
            nestingLevel: baseNestingLevel,
            accountId: node.accountId,
          })
        }
      })
    }

    // Revenue section
    result.push({
      category: 'Revenue',
      name: 'Revenue',
      amount: totalRevenue,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
      childCount: incomeBreakdown.length,
      nestingLevel: 0,
    })

    const revenueHierarchy = reportData?.data?.revenueHierarchy
    if (revenueHierarchy && revenueHierarchy.length > 0) {
      walkHierarchyForExport(revenueHierarchy, 'Revenue', false, 1)
    } else {
      incomeBreakdown.forEach((item: any) => {
        result.push({
          category: 'Revenue',
          name: item.name,
          amount: item.value,
          isChild: true,
          nestingLevel: 1,
        })
      })
    }

    result.push({
      category: 'Revenue',
      name: 'Total Revenue',
      amount: totalRevenue,
      isSubtotal: true,
      nestingLevel: 0,
    })

    // COGS section
    if (costOfGoodsSold > 0) {
      const cogsHierarchy = reportData?.data?.cogsHierarchy
      const cogsItems = expenseBreakdown.filter((item: any) => item.section === 'COGS')

      result.push({
        category: 'Cost of Goods Sold',
        name: 'Cost of Goods Sold',
        amount: -Math.abs(costOfGoodsSold),
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
        childCount: cogsHierarchy?.length || cogsItems.length,
        nestingLevel: 0,
      })

      if (cogsHierarchy && cogsHierarchy.length > 0) {
        walkHierarchyForExport(cogsHierarchy, 'Cost of Goods Sold', true, 1)
      } else if (cogsItems.length > 0) {
        cogsItems.forEach((item: any) => {
          result.push({
            category: 'Cost of Goods Sold',
            name: item.name,
            amount: -Math.abs(item.value || item.amount || 0),
            isChild: true,
            nestingLevel: 1,
          })
        })
      }

      result.push({
        category: 'Cost of Goods Sold',
        name: 'Total Cost of Goods Sold',
        amount: -Math.abs(costOfGoodsSold),
        isSubtotal: true,
        nestingLevel: 0,
      })
    }

    // Gross Profit
    result.push({
      category: 'Gross Profit',
      name: 'Gross Profit',
      amount: grossProfit,
      isSubtotal: true,
      nestingLevel: 0,
    })

    // Expenses section
    const operatingExpenseItems = expenseBreakdown.filter(
      (item: any) =>
        item.name !== 'Cost of Goods Sold' && item.section !== 'COGS' && item.section !== 'Other'
    )

    if (operatingExpenseItems.length > 0) {
      result.push({
        category: 'Expenses',
        name: 'Expenses',
        amount: -Math.abs(operatingExpenses),
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
        childCount: operatingExpenseItems.length,
        nestingLevel: 0,
      })

      const expenseHierarchy = reportData?.data?.expenseHierarchy
      if (expenseHierarchy && expenseHierarchy.length > 0) {
        walkHierarchyForExport(expenseHierarchy, 'Expenses', true, 1)
      } else {
        operatingExpenseItems.forEach((item: any) => {
          result.push({
            category: 'Expenses',
            name: item.name,
            amount: -Math.abs(item.value || item.amount || 0),
            isChild: true,
            nestingLevel: 1,
          })
        })
      }

      result.push({
        category: 'Expenses',
        name: 'Total Expenses',
        amount: -Math.abs(operatingExpenses),
        isSubtotal: true,
        nestingLevel: 0,
      })
    }

    // Net Operating Income
    result.push({
      category: 'Net Operating Income',
      name: 'Net Operating Income',
      amount: totalRevenue - costOfGoodsSold - operatingExpenses,
      isSubtotal: true,
      nestingLevel: 0,
    })

    // Other Income
    if (otherIncome > 0 || otherIncomeBreakdown.length > 0) {
      result.push({
        category: 'Other Income',
        name: 'Other Income',
        amount: otherIncome,
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
        childCount: otherIncomeBreakdown.length,
        nestingLevel: 0,
      })

      const otherIncomeHierarchy = reportData?.data?.otherIncomeHierarchy
      if (otherIncomeHierarchy && otherIncomeHierarchy.length > 0) {
        walkHierarchyForExport(otherIncomeHierarchy, 'Other Income', false, 1)
      } else {
        otherIncomeBreakdown.forEach((item: any) => {
          result.push({
            category: 'Other Income',
            name: item.name,
            amount: item.value,
            isChild: true,
            nestingLevel: 1,
          })
        })
      }

      result.push({
        category: 'Other Income',
        name: 'Total Other Income',
        amount: otherIncome,
        isSubtotal: true,
        nestingLevel: 0,
      })
    }

    // Other Expenses
    const otherExpenseItems = expenseBreakdown.filter((item: any) => item.section === 'Other')
    if (otherExpenses > 0 || otherExpenseItems.length > 0) {
      result.push({
        category: 'Other Expenses',
        name: 'Other Expenses',
        amount: -Math.abs(otherExpenses),
        isHeader: true,
        isCollapsible: true,
        isExpanded: true,
        childCount: otherExpenseItems.length,
        nestingLevel: 0,
      })

      otherExpenseItems.forEach((item: any) => {
        result.push({
          category: 'Other Expenses',
          name: item.name,
          amount: -Math.abs(item.value || item.amount || 0),
          isChild: true,
          nestingLevel: 1,
        })
      })

      result.push({
        category: 'Other Expenses',
        name: 'Total Other Expenses',
        amount: -Math.abs(otherExpenses),
        isSubtotal: true,
        nestingLevel: 0,
      })
    }

    // Net Other Income (if applicable)
    if (otherIncomeBreakdown.length > 0 || otherExpenses > 0) {
      const grossOtherIncome =
        otherIncomeBreakdown.length > 0
          ? otherIncomeBreakdown.reduce((sum: number, item: any) => sum + (item.value || 0), 0)
          : 0
      result.push({
        category: 'Net Other Income',
        name: 'Net Other Income',
        amount: grossOtherIncome - otherExpenses,
        isSubtotal: true,
        nestingLevel: 0,
      })
    }

    // Net Income
    result.push({
      category: 'Net Income',
      name: 'Net Income',
      amount: netIncome,
      isTotal: true,
      isFinalTotal: true,
      nestingLevel: 0,
    })

    return result
  }, [
    incomeBreakdown,
    otherIncomeBreakdown,
    totalRevenue,
    costOfGoodsSold,
    grossProfit,
    expenseBreakdown,
    operatingExpenses,
    otherIncome,
    otherExpenses,
    netIncome,
    reportData?.data?.revenueHierarchy,
    reportData?.data?.cogsHierarchy,
    reportData?.data?.expenseHierarchy,
    reportData?.data?.otherIncomeHierarchy,
  ])

  // Loading state - check AFTER all hooks are called
  if (isLoading && !reportData) {
    return <ReportLoadingState message="Generating profit & loss report..." />
  }

  // Error state - check AFTER all hooks are called
  if (error) {
    return <ReportErrorState error={error} onRetry={() => mutate()} />
  }

  return (
    <div
      className="@container space-y-4 overflow-y-auto styled-scrollbar h-full"
      id="profit-loss-content"
    >
      {/* Loading overlay during revalidation */}
      {isValidating && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm theme-text-secondary">Updating profit & loss data...</p>
          </div>
        </div>
      )}

      {/* Main content - hidden during revalidation */}
      {!isValidating && (
        <>
          {/* Bookkeeping Validation Alerts */}
          {validationIssues.length > 0 && (
            <BookkeepingValidationAlert
              issues={validationIssues}
              reportType="pnl"
              collapsible={true}
              defaultExpanded={false}
            />
          )}

          {/* P&L Metrics Grid */}
          <PnLMetricsGrid
            totalRevenue={totalRevenue}
            totalExpenses={totalExpenses}
            netIncome={netIncome}
            grossProfit={grossProfit}
            costOfGoodsSold={costOfGoodsSold}
            operatingExpenses={operatingExpenses}
            grossMarginRaw={grossMarginRaw}
            operatingMarginRaw={operatingMarginRaw}
            expenseRatioRaw={expenseRatioRaw}
            netProfitMarginRaw={kpis.netProfitMargin ?? null}
            cogsRatioRaw={kpis.cogsRatio ?? null}
            grossBurnRate={grossBurnRate}
            monthsInPeriod={monthsInPeriod}
            cashBalance={cashBalance}
            runway={runway}
            isLoading={isLoading}
            currency={currency}
            incomeBreakdown={incomeBreakdown}
            expenseBreakdown={expenseBreakdown}
            plFlowData={plFlowData}
            data={dataWithTrend}
            contextData={contextData}
            isSingleMonth={isSingleMonth}
          />

          {/* Category Breakdown Chart - Monthly breakdown by category */}
          <CategoryBreakdownChart
            expensesData={categoryExpensesData}
            revenueData={categoryRevenueData}
            currency={currency}
            isLoading={categoryBreakdownLoading}
            isSingleMonth={isSingleMonth}
          />

          {/* AI Analysis Card */}
          <AIAnalysisCard
            pageType="pnl"
            data={{
              metrics: {
                totalRevenue,
                totalExpenses,
                netIncome,
                grossMargin,
                operatingMargin,
                costOfGoodsSold,
                operatingExpenses,
                otherExpenses,
                grossProfit,
                grossBurnRate,
                netBurnRate,
                runway,
              },
              previousPeriod: {
                previousRevenue: kpis.previousRevenue,
                previousExpenses: kpis.previousExpenses,
                previousNetIncome: kpis.previousNetIncome,
              },
              revenueByCategory: incomeBreakdown,
              expenseCategories: expenseBreakdown,
              kpis: kpis,
            }}
            dateRange={dateRange}
            context={contextData}
            dataLoadingStates={{
              metricsLoading: isLoading,
            }}
          />

          {/* Income Statement Table */}
          <IncomeStatementTable
            data={incomeStatementData}
            dateRange={dateRange}
            toggleSection={toggleSection}
            currency={currency}
            exportData={incomeStatementExportData}
          />
        </>
      )}
    </div>
  )
}
