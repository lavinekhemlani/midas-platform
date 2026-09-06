// src/app/(main)/reports/views/BalanceSheetView.tsx
'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { useBalanceSheet, useBalanceSheetMonthlyTrend } from '@/hooks/useReportData'
import { useReportsContext } from '@/contexts/ReportsContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { ReportLoadingState } from '../components/ReportLoadingState'
import { ReportErrorState } from '../components/ReportErrorState'
import { useCollapsibleSections } from '../components/hooks/useCollapsibleSections'
import { useMetricStorage } from '../components/hooks/useMetricStorage'
import { BalanceSheetMetricsGrid } from '../components/balance-sheet/BalanceSheetMetricsGrid'
import { BalanceSheetTable } from '../components/balance-sheet/BalanceSheetTable'
import { AIAnalysisCard } from '@/components/ai-analysis'
import {
  BookkeepingValidationAlert,
  validateBalanceSheetData,
} from '../components/BookkeepingValidationAlert'
import type { BalanceSheetItem } from '@/app/(main)/reports/types'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'
import { useSession } from '@/hooks/useSession'
import { Building2, RefreshCw, X } from 'lucide-react'
import { format } from 'date-fns'
import { DateRangeInputs } from '../components/DateRangeInputs'
import { PeriodSelect } from '../components/PeriodSelect'
import { getDateRangeForPeriod } from '@/lib/report-utils'

export function BalanceSheetView() {
  const { dateRange, setDateRange, period, setPeriod, isRefreshing, refresh } = useReportsContext()
  const { currency } = useCurrency()
  const { organization } = useSession()
  const [pendingDateRange, setPendingDateRange] = useState<{ start: string; end: string } | null>(
    null
  )

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    if (newPeriod !== 'custom') {
      const range = getDateRangeForPeriod(newPeriod)
      setDateRange(range)
      setPendingDateRange(null)
      setTimeout(() => refresh(), 0)
    } else {
      setPendingDateRange({ start: dateRange.start, end: dateRange.end })
    }
  }

  const handleStartDateChange = (newStart: string) => {
    const newRange = { start: newStart, end: pendingDateRange?.end || dateRange.end }
    setPendingDateRange(newRange)
    setDateRange(newRange)
    setPeriod('custom')
  }

  const handleEndDateChange = (newEnd: string) => {
    const newRange = { start: pendingDateRange?.start || dateRange.start, end: newEnd }
    setPendingDateRange(newRange)
    setDateRange(newRange)
    setPeriod('custom')
  }

  const displayDateRange = pendingDateRange || dateRange

  const formatDateRange = () => {
    if (!dateRange.start || !dateRange.end) return null
    const fmt = (d: string) => {
      try {
        return format(new Date(d + 'T00:00:00'), 'MMM dd, yyyy')
      } catch {
        return d
      }
    }
    return (
      <span className="flex items-center gap-2 text-sm theme-text-secondary">
        <span className="font-serif italic text-[0.9rem] theme-text-primary">from</span>
        <span>{fmt(dateRange.start)}</span>
        <span className="font-serif italic text-[0.9rem] theme-text-primary">to</span>
        <span>{fmt(dateRange.end)}</span>
      </span>
    )
  }

  // Use end date as the "as of" date for Balance Sheet
  const asOfDate = dateRange.end

  // Fetch data from API using context date
  const { reportData, isLoading, isValidating, error, mutate } = useBalanceSheet(asOfDate)

  // Fetch monthly trend data separately for faster core data loading
  const { trendData: bsMonthlyTrend, isLoading: trendLoading } = useBalanceSheetMonthlyTrend(
    dateRange.start,
    dateRange.end
  )

  // Report loading state to WelcomeContext for coordinated loading UI
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    welcomeContext?.setDataLoading(isLoading && !reportData)
  }, [isLoading, reportData, welcomeContext])

  // State for collapsible sections - must be declared before any early returns
  // Include sub-categories for hierarchical display like QuickBooks
  // Note: Fixed asset sections (Truck, Equipment, etc.) are dynamically added when toggled
  const { expandedSections, toggleSection } = useCollapsibleSections([
    'Assets',
    'CurrentAssets',
    'BankAccounts',
    'AccountsReceivable',
    'OtherCurrentAssets',
    'FixedAssets',
    'OtherAssets',
    'LiabilitiesAndEquity',
    'Liabilities',
    'CurrentLiabilities',
    'AccountsPayable',
    'CreditCards',
    'OtherCurrentLiabilities',
    'LongTermLiabilities',
    'NotesPayable',
    'OtherLongTerm',
    'Equity',
    'OpeningBalanceEquity',
    'RetainedEarnings',
    'OwnersEquity',
    'NetIncome',
    'Stock',
    'OtherEquity',
  ])

  // SWR automatically refetches when asOfDate changes, no manual refetch needed

  // Extract data from API response (flattened structure - KPIs/ratios at top level)
  const totalAssets = reportData?.totalAssets || 0
  const totalLiabilities = reportData?.totalLiabilities || 0
  const totalEquity = reportData?.totalEquity || 0

  // Data validation
  const calculatedEquity = totalAssets - totalLiabilities
  const reconciliationError = Math.abs(calculatedEquity - totalEquity) > 0.01

  // Find Net Income in equity breakdown for cross-report validation
  const netIncomeInEquity = useMemo(() => {
    const equityChildren = reportData?.equityHierarchy?.children || []
    const netIncomeItem = equityChildren.find((item: any) =>
      item.name?.toLowerCase().includes('net income')
    )
    return netIncomeItem?.value ?? netIncomeItem?.total ?? 0
  }, [reportData?.equityHierarchy?.children])

  // Generate validation issues for bookkeeping alerts
  const validationIssues = useMemo(
    () =>
      validateBalanceSheetData({
        totalAssets,
        totalLiabilities,
        totalEquity,
        netIncomeInEquity: netIncomeInEquity !== 0 ? netIncomeInEquity : undefined,
      }),
    [totalAssets, totalLiabilities, totalEquity, netIncomeInEquity]
  )

  // Process monthly trend data to calculate liquidity ratios
  // Now using separately fetched trend data for faster core loading
  const monthlyTrendData = (bsMonthlyTrend || []).map((month: any) => {
    const currentAssets = month.currentAssets || 0
    const currentLiabilities = month.currentLiabilities || 0
    // Use actual inventory value - no estimation (inventory varies by business type)
    const inventory = month.inventory ?? 0

    // Calculate Current Ratio (Current Assets / Current Liabilities)
    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0

    // Calculate Quick Ratio ((Current Assets - Inventory) / Current Liabilities)
    // Use actual inventory value, no estimation
    const quickRatio = currentLiabilities > 0 ? (currentAssets - inventory) / currentLiabilities : 0

    return {
      month: month.month,
      currentRatio: Math.round(currentRatio * 100) / 100, // Round to 2 decimals
      quickRatio: Math.round(quickRatio * 100) / 100,
      // Keep original data for reference
      assets: month.assets || 0,
      liabilities: month.liabilities || 0,
      equity: month.equity || 0,
      currentAssets,
      currentLiabilities,
    }
  })

  // Prepare contextData for learn modals with all calculated metrics
  // Use useMemo to stabilize the object reference (flattened structure)
  const contextData = useMemo(
    () => ({
      current_ratio: reportData?.currentRatio || 0,
      quick_ratio: reportData?.quickRatio || 0,
      working_capital: reportData?.workingCapital || 0,
      debt_to_equity: reportData?.debtToEquity || 0,
      asset_turnover: reportData?.assetTurnover || 0,
      equity_multiplier: reportData?.equityMultiplier || 0,
      roe: reportData?.returnOnEquity || 0,
      debt_ratio: reportData?.debtRatio || 0,
    }),
    [
      reportData?.currentRatio,
      reportData?.quickRatio,
      reportData?.workingCapital,
      reportData?.debtToEquity,
      reportData?.assetTurnover,
      reportData?.equityMultiplier,
      reportData?.returnOnEquity,
      reportData?.debtRatio,
    ]
  )

  // Store metrics in sessionStorage for learn pages
  useMetricStorage(contextData, dateRange, isLoading)

  // Prepare Balance Sheet table data with collapsible sections
  // Uses hierarchical structure from API for QuickBooks-like display
  // IMPORTANT: This useMemo must be called before any early returns to comply with Rules of Hooks
  const balanceSheetData = useMemo((): BalanceSheetItem[] => {
    const result: BalanceSheetItem[] = []

    // Get hierarchical data from API (with fallback to flat data)
    const assetsHierarchy = reportData?.assetsHierarchy || {
      current: {
        items: [],
        bankAccounts: { items: [], total: 0 },
        otherItems: [],
        total: reportData?.currentAssets || 0,
      },
      fixed: { items: [], total: 0 },
      other: { items: [], total: 0 },
      total: totalAssets,
    }
    const liabilitiesHierarchy = reportData?.liabilitiesHierarchy || {
      current: { children: [], total: reportData?.currentLiabilities || 0 },
      longTerm: { children: [], total: 0 },
      total: totalLiabilities,
    }
    const equityHierarchy = reportData?.equityHierarchy || {
      children: [],
      total: totalEquity,
    }

    // Extract hierarchical current assets from the new structure (QuickBooks-style nesting)
    // Each hierarchy item has: name, total, children (e.g., Bank Accounts → Checking, Savings)
    const currentAssetsHierarchy: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }> = assetsHierarchy.current?.children || []

    // Check if we have hierarchical current assets structure
    const hasHierarchicalCurrentAssets = currentAssetsHierarchy.length > 0

    // Count total items across all hierarchy items for display
    const currentAssetsChildrenCount = currentAssetsHierarchy.reduce(
      (sum, item) => sum + (item.children?.length || 0) + 1, // +1 for the parent item itself
      0
    )

    // Fallback: flat items (legacy support - now hierarchy is primary)
    const currentAssetItems = assetsHierarchy.current?.items || []
    const fixedAssetItems = assetsHierarchy.fixed?.items || []
    const otherAssetItems = assetsHierarchy.other?.items || []

    // Extract hierarchical fixed assets from the new structure (QuickBooks-style nesting)
    // Each hierarchy item has: name, total, children (e.g., Truck → Original Cost, Depreciation)
    const fixedAssetsHierarchy: Array<{
      name: string
      total: number
      children: Array<{ name: string; value: number }>
    }> = assetsHierarchy.fixed?.children || []

    // Check if we have hierarchical fixed assets structure
    const hasHierarchicalFixedAssets = fixedAssetsHierarchy.length > 0

    // Count total child items across all hierarchy items for display
    const fixedAssetsChildrenCount = fixedAssetsHierarchy.reduce(
      (sum, item) => sum + (item.children?.length || 0) + 1, // +1 for the parent item itself
      0
    )

    // Extract categorized current liabilities from the new structure (QuickBooks-style)
    const accountsPayableItems = liabilitiesHierarchy.current?.accountsPayable?.items || []
    const accountsPayableTotal = liabilitiesHierarchy.current?.accountsPayable?.total || 0
    const creditCardItems = liabilitiesHierarchy.current?.creditCards?.items || []
    const creditCardsTotal = liabilitiesHierarchy.current?.creditCards?.total || 0
    const otherCurrentLiabItems = liabilitiesHierarchy.current?.otherCurrentLiabilities?.items || []
    const otherCurrentLiabilitiesTotal =
      liabilitiesHierarchy.current?.otherCurrentLiabilities?.total || 0

    // Extract categorized long-term liabilities
    const notesPayableItems = liabilitiesHierarchy.longTerm?.notesPayable?.items || []
    const notesPayableTotal = liabilitiesHierarchy.longTerm?.notesPayable?.total || 0
    const otherLongTermItems = liabilitiesHierarchy.longTerm?.otherLongTerm?.items || []
    const otherLongTermTotal = liabilitiesHierarchy.longTerm?.otherLongTerm?.total || 0

    // Check if we have grouped liabilities structure
    const hasGroupedLiabilitiesStructure =
      accountsPayableItems.length > 0 ||
      creditCardItems.length > 0 ||
      otherCurrentLiabItems.length > 0
    const hasGroupedLongTermStructure =
      notesPayableItems.length > 0 || otherLongTermItems.length > 0

    // Fallback: flat items (legacy support - now hierarchy is primary)
    const currentLiabItems = liabilitiesHierarchy.current?.items || []
    const longTermLiabItems = liabilitiesHierarchy.longTerm?.items || []

    // Extract categorized equity from the new structure (QuickBooks-style)
    const openingBalanceEquityItems = equityHierarchy.openingBalanceEquity?.items || []
    const openingBalanceEquityTotal = equityHierarchy.openingBalanceEquity?.total || 0
    const retainedEarningsItems = equityHierarchy.retainedEarnings?.items || []
    const retainedEarningsTotal = equityHierarchy.retainedEarnings?.total || 0
    const ownersEquityItems = equityHierarchy.ownersEquity?.items || []
    const ownersEquityTotal = equityHierarchy.ownersEquity?.total || 0
    const netIncomeItems = equityHierarchy.netIncome?.items || []
    const netIncomeTotal = equityHierarchy.netIncome?.total || 0
    const stockItems = equityHierarchy.stock?.items || []
    const stockTotal = equityHierarchy.stock?.total || 0
    const otherEquityItems = equityHierarchy.otherEquity?.items || []
    const otherEquityTotal = equityHierarchy.otherEquity?.total || 0

    // Check if we have grouped equity structure
    const hasGroupedEquityStructure =
      openingBalanceEquityItems.length > 0 ||
      retainedEarningsItems.length > 0 ||
      ownersEquityItems.length > 0 ||
      netIncomeItems.length > 0 ||
      stockItems.length > 0 ||
      otherEquityItems.length > 0

    // Flat equity items from hierarchy children
    const equityItems = equityHierarchy.children || []

    // Count items for each section - use hierarchical count if available
    const currentAssetsCount = hasHierarchicalCurrentAssets
      ? currentAssetsChildrenCount
      : currentAssetItems.length

    // Count fixed assets items - use hierarchical count if available
    const fixedAssetsCount = hasHierarchicalFixedAssets
      ? fixedAssetsChildrenCount
      : fixedAssetItems.length

    const otherAssetsCount = otherAssetItems.length
    const totalAssetItemsCount = currentAssetsCount + fixedAssetsCount + otherAssetsCount

    // Count liabilities items
    const accountsPayableCount = accountsPayableItems.length
    const creditCardsCount = creditCardItems.length
    const otherCurrentLiabCount = otherCurrentLiabItems.length
    const currentLiabCount = hasGroupedLiabilitiesStructure
      ? accountsPayableCount + creditCardsCount + otherCurrentLiabCount
      : currentLiabItems.length
    const notesPayableCount = notesPayableItems.length
    const otherLongTermCount = otherLongTermItems.length
    const longTermLiabCount = hasGroupedLongTermStructure
      ? notesPayableCount + otherLongTermCount
      : longTermLiabItems.length
    const totalLiabItemsCount = currentLiabCount + longTermLiabCount

    // Count equity items
    const openingBalanceEquityCount = openingBalanceEquityItems.length
    const retainedEarningsCount = retainedEarningsItems.length
    const ownersEquityCount = ownersEquityItems.length
    const netIncomeCount = netIncomeItems.length
    const stockCount = stockItems.length
    const otherEquityCount = otherEquityItems.length
    const equityItemsCount = hasGroupedEquityStructure
      ? openingBalanceEquityCount +
        retainedEarningsCount +
        ownersEquityCount +
        netIncomeCount +
        stockCount +
        otherEquityCount
      : equityItems.length
    const totalLiabEquityItemsCount = totalLiabItemsCount + equityItemsCount

    // ========== ASSETS SECTION ==========
    result.push({
      category: 'Assets',
      name: 'Assets',
      amount: totalAssets,
      isHeader: true,
      isCollapsible: true,
      isExpanded: expandedSections.has('Assets'),
      childCount: totalAssetItemsCount,
      nestingLevel: 0, // Level 0: Main header
    })

    if (expandedSections.has('Assets')) {
      // Current Assets sub-section
      if (currentAssetsCount > 0 || assetsHierarchy.current.total > 0) {
        result.push({
          category: 'CurrentAssets',
          name: 'Current Assets',
          amount: assetsHierarchy.current.total,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: expandedSections.has('CurrentAssets'),
          childCount: currentAssetsCount,
          nestingLevel: 1, // Level 1: Sub-header
        })

        if (expandedSections.has('CurrentAssets')) {
          if (hasHierarchicalCurrentAssets) {
            // QuickBooks-style hierarchical structure
            // Each hierarchy item is a parent category (Bank Accounts, A/R, etc.) with children (Checking, Savings)
            currentAssetsHierarchy.forEach((parentItem) => {
              const childCount = parentItem.children?.length || 0
              const sectionKey = parentItem.name.replace(/\s+/g, '') // e.g., "Bank Accounts" -> "BankAccounts"

              if (childCount === 0) {
                // No children - show as simple line item
                result.push({
                  category: 'CurrentAssets',
                  name: parentItem.name,
                  amount: parentItem.total,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 2, // Level 2: Item under sub-header
                })
              } else {
                // Has children - show as collapsible section (Level 2: sub-sub-header)
                result.push({
                  category: sectionKey,
                  name: parentItem.name,
                  amount: parentItem.total,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has(sectionKey),
                  childCount: childCount,
                  nestingLevel: 2, // Level 2: Sub-sub-header (Bank Accounts, A/R, etc.)
                })

                if (expandedSections.has(sectionKey)) {
                  // Show child items (Checking, Savings, etc.)
                  parentItem.children.forEach((child) => {
                    result.push({
                      category: sectionKey,
                      name: child.name,
                      amount: child.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 3, // Level 3: Leaf items
                    })
                  })

                  // Show subtotal for this parent
                  result.push({
                    category: sectionKey,
                    name: `Total for ${parentItem.name}`,
                    amount: parentItem.total,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 2, // Match parent level
                  })
                }
              }
            })
          } else {
            // Fallback: flat list of all current asset items
            currentAssetItems.forEach((item: any) => {
              result.push({
                category: 'CurrentAssets',
                name: item.name,
                amount: item.value,
                isChild: true,
                isNestedChild: true,
                nestingLevel: 2, // Level 2: Direct children of Current Assets
              })
            })
          }

          result.push({
            category: 'CurrentAssets',
            name: 'Total for Current Assets',
            amount: assetsHierarchy.current?.total || 0,
            isSubtotal: true,
            isNestedSubtotal: true,
            nestingLevel: 1, // Match Current Assets header level
          })
        }
      }

      // Fixed Assets sub-section
      if (fixedAssetsCount > 0 || (assetsHierarchy.fixed?.total || 0) !== 0) {
        result.push({
          category: 'FixedAssets',
          name: 'Fixed Assets',
          amount: assetsHierarchy.fixed?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: expandedSections.has('FixedAssets'),
          childCount: fixedAssetsCount,
          nestingLevel: 1, // Level 1: Sub-header
        })

        if (expandedSections.has('FixedAssets')) {
          if (hasHierarchicalFixedAssets) {
            // QuickBooks-style hierarchical structure
            // Each hierarchy item is a parent asset (Truck, Equipment, etc.) with children (Original Cost, Depreciation)
            fixedAssetsHierarchy.forEach((parentItem) => {
              const childCount = parentItem.children?.length || 0
              const sectionKey = parentItem.name.replace(/\s+/g, '') // e.g., "Truck" -> "Truck"

              if (childCount === 0) {
                // No children - show as simple line item
                result.push({
                  category: 'FixedAssets',
                  name: parentItem.name,
                  amount: parentItem.total,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 2, // Level 2: Item under Fixed Assets
                })
              } else {
                // Has children - show as collapsible section (Level 2: sub-sub-header)
                result.push({
                  category: sectionKey,
                  name: parentItem.name,
                  amount: parentItem.total,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has(sectionKey),
                  childCount: childCount,
                  nestingLevel: 2, // Level 2: Sub-sub-header (Truck, Equipment, etc.)
                })

                if (expandedSections.has(sectionKey)) {
                  // Show child items (Original Cost, Depreciation, etc.)
                  parentItem.children.forEach((child) => {
                    result.push({
                      category: sectionKey,
                      name: child.name,
                      amount: child.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 3, // Level 3: Leaf items
                    })
                  })

                  // Show subtotal for this parent
                  result.push({
                    category: sectionKey,
                    name: `Total for ${parentItem.name}`,
                    amount: parentItem.total,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 2, // Match parent level
                  })
                }
              }
            })
          } else {
            // Fallback: flat list of all fixed asset items
            fixedAssetItems.forEach((item: any) => {
              result.push({
                category: 'FixedAssets',
                name: item.name,
                amount: item.value,
                isChild: true,
                isNestedChild: true,
                nestingLevel: 2, // Level 2: Direct children of Fixed Assets
              })
            })
          }

          result.push({
            category: 'FixedAssets',
            name: 'Total for Fixed Assets',
            amount: assetsHierarchy.fixed?.total || 0,
            isSubtotal: true,
            isNestedSubtotal: true,
            nestingLevel: 1, // Match Fixed Assets header level
          })
        }
      }

      // Other Assets sub-section
      if (otherAssetsCount === 1) {
        // Single account - show directly without nesting
        result.push({
          category: 'Assets',
          name: otherAssetItems[0].name,
          amount: otherAssetItems[0].value,
          isChild: true,
          isNestedChild: true,
          nestingLevel: 1, // Level 1: Direct child of Assets
        })
      } else if (otherAssetsCount > 1) {
        // Multiple accounts - show collapsible structure
        result.push({
          category: 'OtherAssets',
          name: 'Other Assets',
          amount: assetsHierarchy.other?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: expandedSections.has('OtherAssets'),
          childCount: otherAssetsCount,
          nestingLevel: 1, // Level 1: Sub-header
        })

        if (expandedSections.has('OtherAssets')) {
          otherAssetItems.forEach((item: any) => {
            result.push({
              category: 'OtherAssets',
              name: item.name,
              amount: item.value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Child of Other Assets
            })
          })

          result.push({
            category: 'OtherAssets',
            name: 'Total for Other Assets',
            amount: assetsHierarchy.other?.total || 0,
            isSubtotal: true,
            isNestedSubtotal: true,
            nestingLevel: 1, // Match Other Assets header level
          })
        }
      }

      result.push({
        category: 'Assets',
        name: 'Total for Assets',
        amount: totalAssets,
        isTotal: true,
        nestingLevel: 0, // Level 0: Main total
      })
    }

    // ========== LIABILITIES & EQUITY SECTION ==========
    result.push({
      category: 'LiabilitiesAndEquity',
      name: 'Liabilities & Equity',
      amount: totalLiabilities + totalEquity,
      isHeader: true,
      isCollapsible: true,
      isExpanded: expandedSections.has('LiabilitiesAndEquity'),
      childCount: totalLiabEquityItemsCount,
      nestingLevel: 0, // Level 0: Main header
    })

    if (expandedSections.has('LiabilitiesAndEquity')) {
      // LIABILITIES SUBSECTION
      result.push({
        category: 'Liabilities',
        name: 'Liabilities',
        amount: totalLiabilities,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: expandedSections.has('Liabilities'),
        childCount: totalLiabItemsCount,
        nestingLevel: 1, // Level 1: Sub-header
      })

      if (expandedSections.has('Liabilities')) {
        // Current Liabilities sub-section
        if (currentLiabCount > 0 || (liabilitiesHierarchy.current?.total || 0) > 0) {
          result.push({
            category: 'CurrentLiabilities',
            name: 'Current Liabilities',
            amount: liabilitiesHierarchy.current?.total || 0,
            isHeader: true,
            isSubHeader: true,
            isCollapsible: true,
            isExpanded: expandedSections.has('CurrentLiabilities'),
            childCount: currentLiabCount,
            nestingLevel: 2, // Level 2: Sub-sub-header
          })

          if (expandedSections.has('CurrentLiabilities')) {
            if (hasGroupedLiabilitiesStructure) {
              // QuickBooks-style grouped structure

              // 1. Accounts Payable sub-section
              // Always show "Accounts Payable" as a section header (don't simplify single accounts)
              if (accountsPayableCount > 0) {
                result.push({
                  category: 'AccountsPayable',
                  name: 'Accounts Payable',
                  amount: accountsPayableTotal,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has('AccountsPayable'),
                  childCount: accountsPayableCount,
                  nestingLevel: 3, // Level 3: Sub-sub-sub-header
                })

                if (expandedSections.has('AccountsPayable')) {
                  accountsPayableItems.forEach((item: any) => {
                    result.push({
                      category: 'AccountsPayable',
                      name: item.name,
                      amount: item.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 4, // Level 4: Leaf item
                    })
                  })

                  result.push({
                    category: 'AccountsPayable',
                    name: 'Total for Accounts Payable',
                    amount: accountsPayableTotal,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 3, // Match parent level
                  })
                }
              }

              // 2. Credit Cards sub-section
              // Always show "Credit Cards" as a section header (don't simplify single accounts)
              if (creditCardsCount > 0) {
                result.push({
                  category: 'CreditCards',
                  name: 'Credit Cards',
                  amount: creditCardsTotal,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has('CreditCards'),
                  childCount: creditCardsCount,
                  nestingLevel: 3, // Level 3: Sub-sub-sub-header
                })

                if (expandedSections.has('CreditCards')) {
                  creditCardItems.forEach((item: any) => {
                    result.push({
                      category: 'CreditCards',
                      name: item.name,
                      amount: item.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 4, // Level 4: Leaf item
                    })
                  })

                  result.push({
                    category: 'CreditCards',
                    name: 'Total for Credit Cards',
                    amount: creditCardsTotal,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 3, // Match parent level
                  })
                }
              }

              // 3. Other Current Liabilities sub-section
              // Always show "Other Current Liabilities" as a section header (don't simplify single accounts)
              if (otherCurrentLiabCount > 0) {
                result.push({
                  category: 'OtherCurrentLiabilities',
                  name: 'Other Current Liabilities',
                  amount: otherCurrentLiabilitiesTotal,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has('OtherCurrentLiabilities'),
                  childCount: otherCurrentLiabCount,
                  nestingLevel: 3, // Level 3: Sub-sub-sub-header
                })

                if (expandedSections.has('OtherCurrentLiabilities')) {
                  otherCurrentLiabItems.forEach((item: any) => {
                    result.push({
                      category: 'OtherCurrentLiabilities',
                      name: item.name,
                      amount: item.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 4, // Level 4: Leaf item
                    })
                  })

                  result.push({
                    category: 'OtherCurrentLiabilities',
                    name: 'Total for Other Current Liabilities',
                    amount: otherCurrentLiabilitiesTotal,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 3, // Match parent level
                  })
                }
              }
            } else {
              // Fallback: flat list of all current liability items
              currentLiabItems.forEach((item: any) => {
                result.push({
                  category: 'CurrentLiabilities',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })
            }

            result.push({
              category: 'CurrentLiabilities',
              name: 'Total for Current Liabilities',
              amount: liabilitiesHierarchy.current?.total || 0,
              isSubtotal: true,
              isNestedSubtotal: true,
              nestingLevel: 2, // Match Current Liabilities header level
            })
          }
        }

        // Long-Term Liabilities sub-section
        if (longTermLiabCount > 0 || (liabilitiesHierarchy.longTerm?.total || 0) > 0) {
          result.push({
            category: 'LongTermLiabilities',
            name: 'Long-Term Liabilities',
            amount: liabilitiesHierarchy.longTerm?.total || 0,
            isHeader: true,
            isSubHeader: true,
            isCollapsible: true,
            isExpanded: expandedSections.has('LongTermLiabilities'),
            childCount: longTermLiabCount,
            nestingLevel: 2, // Level 2: Sub-sub-header
          })

          if (expandedSections.has('LongTermLiabilities')) {
            if (hasGroupedLongTermStructure) {
              // QuickBooks-style grouped structure

              // 1. Notes Payable sub-section
              if (notesPayableCount === 1) {
                // Single account - show directly without nesting
                result.push({
                  category: 'LongTermLiabilities',
                  name: notesPayableItems[0].name,
                  amount: notesPayableItems[0].value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              } else if (notesPayableCount > 1) {
                // Multiple accounts - show collapsible structure
                result.push({
                  category: 'NotesPayable',
                  name: 'Notes Payable',
                  amount: notesPayableTotal,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has('NotesPayable'),
                  childCount: notesPayableCount,
                  nestingLevel: 3, // Level 3: Sub-sub-sub-header
                })

                if (expandedSections.has('NotesPayable')) {
                  notesPayableItems.forEach((item: any) => {
                    result.push({
                      category: 'NotesPayable',
                      name: item.name,
                      amount: item.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 4, // Level 4: Leaf item
                    })
                  })

                  result.push({
                    category: 'NotesPayable',
                    name: 'Total for Notes Payable',
                    amount: notesPayableTotal,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 3, // Match parent level
                  })
                }
              }

              // 2. Other Long-Term Liabilities sub-section
              if (otherLongTermCount === 1) {
                // Single account - show directly without nesting
                result.push({
                  category: 'LongTermLiabilities',
                  name: otherLongTermItems[0].name,
                  amount: otherLongTermItems[0].value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              } else if (otherLongTermCount > 1) {
                // Multiple accounts - show collapsible structure
                result.push({
                  category: 'OtherLongTerm',
                  name: 'Other Long-Term Liabilities',
                  amount: otherLongTermTotal,
                  isHeader: true,
                  isSubHeader: true,
                  isCollapsible: true,
                  isExpanded: expandedSections.has('OtherLongTerm'),
                  childCount: otherLongTermCount,
                  nestingLevel: 3, // Level 3: Sub-sub-sub-header
                })

                if (expandedSections.has('OtherLongTerm')) {
                  otherLongTermItems.forEach((item: any) => {
                    result.push({
                      category: 'OtherLongTerm',
                      name: item.name,
                      amount: item.value,
                      isChild: true,
                      isNestedChild: true,
                      nestingLevel: 4, // Level 4: Leaf item
                    })
                  })

                  result.push({
                    category: 'OtherLongTerm',
                    name: 'Total for Other Long-Term Liabilities',
                    amount: otherLongTermTotal,
                    isSubtotal: true,
                    isNestedSubtotal: true,
                    nestingLevel: 3, // Match parent level
                  })
                }
              }
            } else {
              // Fallback: flat list of all long-term liability items
              longTermLiabItems.forEach((item: any) => {
                result.push({
                  category: 'LongTermLiabilities',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })
            }

            result.push({
              category: 'LongTermLiabilities',
              name: 'Total for Long-Term Liabilities',
              amount: liabilitiesHierarchy.longTerm?.total || 0,
              isSubtotal: true,
              isNestedSubtotal: true,
              nestingLevel: 2, // Match Long-Term Liabilities header level
            })
          }
        }

        result.push({
          category: 'Liabilities',
          name: 'Total for Liabilities',
          amount: totalLiabilities,
          isSubtotal: true,
          nestingLevel: 1, // Match Liabilities header level
        })
      }

      // EQUITY SUBSECTION
      result.push({
        category: 'Equity',
        name: 'Equity',
        amount: totalEquity,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: expandedSections.has('Equity'),
        childCount: equityItemsCount,
        nestingLevel: 1, // Level 1: Sub-header
      })

      if (expandedSections.has('Equity')) {
        if (hasGroupedEquityStructure) {
          // QuickBooks-style grouped structure

          // 1. Opening Balance Equity sub-section
          if (openingBalanceEquityCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: openingBalanceEquityItems[0].name,
              amount: openingBalanceEquityItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (openingBalanceEquityCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'OpeningBalanceEquity',
              name: 'Opening Balance Equity',
              amount: openingBalanceEquityTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('OpeningBalanceEquity'),
              childCount: openingBalanceEquityCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('OpeningBalanceEquity')) {
              openingBalanceEquityItems.forEach((item: any) => {
                result.push({
                  category: 'OpeningBalanceEquity',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'OpeningBalanceEquity',
                name: 'Total for Opening Balance Equity',
                amount: openingBalanceEquityTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // 2. Retained Earnings sub-section
          if (retainedEarningsCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: retainedEarningsItems[0].name,
              amount: retainedEarningsItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (retainedEarningsCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'RetainedEarnings',
              name: 'Retained Earnings',
              amount: retainedEarningsTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('RetainedEarnings'),
              childCount: retainedEarningsCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('RetainedEarnings')) {
              retainedEarningsItems.forEach((item: any) => {
                result.push({
                  category: 'RetainedEarnings',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'RetainedEarnings',
                name: 'Total for Retained Earnings',
                amount: retainedEarningsTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // 3. Owner's Equity / Capital sub-section
          if (ownersEquityCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: ownersEquityItems[0].name,
              amount: ownersEquityItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (ownersEquityCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'OwnersEquity',
              name: "Owner's Equity",
              amount: ownersEquityTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('OwnersEquity'),
              childCount: ownersEquityCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('OwnersEquity')) {
              ownersEquityItems.forEach((item: any) => {
                result.push({
                  category: 'OwnersEquity',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'OwnersEquity',
                name: "Total for Owner's Equity",
                amount: ownersEquityTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // 4. Stock sub-section
          if (stockCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: stockItems[0].name,
              amount: stockItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (stockCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'Stock',
              name: 'Stock',
              amount: stockTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('Stock'),
              childCount: stockCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('Stock')) {
              stockItems.forEach((item: any) => {
                result.push({
                  category: 'Stock',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'Stock',
                name: 'Total for Stock',
                amount: stockTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // 5. Net Income sub-section (from API or calculated)
          if (netIncomeCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: netIncomeItems[0].name,
              amount: netIncomeItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (netIncomeCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'NetIncome',
              name: 'Net Income',
              amount: netIncomeTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('NetIncome'),
              childCount: netIncomeCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('NetIncome')) {
              netIncomeItems.forEach((item: any) => {
                result.push({
                  category: 'NetIncome',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'NetIncome',
                name: 'Total for Net Income',
                amount: netIncomeTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // 6. Other Equity sub-section
          if (otherEquityCount === 1) {
            // Single account - show directly without nesting
            result.push({
              category: 'Equity',
              name: otherEquityItems[0].name,
              amount: otherEquityItems[0].value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          } else if (otherEquityCount > 1) {
            // Multiple accounts - show collapsible structure
            result.push({
              category: 'OtherEquity',
              name: 'Other Equity',
              amount: otherEquityTotal,
              isHeader: true,
              isSubHeader: true,
              isCollapsible: true,
              isExpanded: expandedSections.has('OtherEquity'),
              childCount: otherEquityCount,
              nestingLevel: 2, // Level 2: Sub-sub-header
            })

            if (expandedSections.has('OtherEquity')) {
              otherEquityItems.forEach((item: any) => {
                result.push({
                  category: 'OtherEquity',
                  name: item.name,
                  amount: item.value,
                  isChild: true,
                  isNestedChild: true,
                  nestingLevel: 3, // Level 3: Leaf item
                })
              })

              result.push({
                category: 'OtherEquity',
                name: 'Total for Other Equity',
                amount: otherEquityTotal,
                isSubtotal: true,
                isNestedSubtotal: true,
                nestingLevel: 2, // Match parent level
              })
            }
          }

          // Calculate if there's unaccounted Net Income (difference between total equity and sum of displayed items)
          const displayedEquitySum =
            openingBalanceEquityTotal +
            retainedEarningsTotal +
            ownersEquityTotal +
            stockTotal +
            netIncomeTotal +
            otherEquityTotal
          const unaccountedNetIncome = totalEquity - displayedEquitySum
          if (Math.abs(unaccountedNetIncome) > 0.01 && netIncomeCount === 0) {
            // Show calculated Net Income if not already from API
            result.push({
              category: 'Equity',
              name: 'Net Income',
              amount: unaccountedNetIncome,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          }
        } else {
          // Fallback: flat list of all equity items
          equityItems.forEach((item: any) => {
            result.push({
              category: 'Equity',
              name: item.name,
              amount: item.value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf items under Equity
            })
          })

          // Calculate sum of displayed equity items
          const equityItemsSum = equityItems.reduce(
            (sum: number, item: any) => sum + (item.value || 0),
            0
          )

          // If there's a difference between total equity and sum of items, show Net Income
          const netIncome = totalEquity - equityItemsSum
          if (Math.abs(netIncome) > 0.01) {
            result.push({
              category: 'Equity',
              name: 'Net Income',
              amount: netIncome,
              isChild: true,
              isNestedChild: true,
              nestingLevel: 2, // Level 2: Leaf item under Equity
            })
          }
        }

        result.push({
          category: 'Equity',
          name: 'Total for Equity',
          amount: totalEquity,
          isSubtotal: true,
          nestingLevel: 1, // Level 1: Match Equity header level
        })
      }
    }

    // FINAL TOTAL
    result.push({
      category: 'Total',
      name: 'Total for Liabilities & Equity',
      amount: totalLiabilities + totalEquity,
      isFinalTotal: true,
      nestingLevel: 0, // Level 0: Main total
    })

    return result
  }, [expandedSections, reportData, totalAssets, totalLiabilities, totalEquity])

  // Generate export data with ALL sections expanded (for PDF/CSV/Markdown exports)
  const balanceSheetExportData = useMemo((): BalanceSheetItem[] => {
    const result: BalanceSheetItem[] = []

    // Get hierarchical data from API
    const assetsHierarchy = reportData?.assetsHierarchy || {
      current: { items: [], total: 0 },
      fixed: { items: [], total: 0 },
      other: { items: [], total: 0 },
      total: totalAssets,
    }
    const liabilitiesHierarchy = reportData?.liabilitiesHierarchy || {
      current: { items: [], total: 0 },
      longTerm: { children: [], total: 0 },
      total: totalLiabilities,
    }
    const equityHierarchy = reportData?.equityHierarchy || {
      children: [],
      total: totalEquity,
    }

    // Helper to add hierarchy items with children
    const addHierarchyItems = (
      items: Array<{
        name: string
        total: number
        children?: Array<{ name: string; value: number }>
      }>,
      category: string,
      baseNestingLevel: number
    ) => {
      items.forEach((item) => {
        const hasChildren = item.children && item.children.length > 0
        if (hasChildren) {
          result.push({
            category,
            name: item.name,
            amount: item.total,
            isHeader: true,
            isSubHeader: true,
            isCollapsible: true,
            isExpanded: true,
            childCount: item.children!.length,
            nestingLevel: baseNestingLevel,
          })
          item.children!.forEach((child) => {
            result.push({
              category,
              name: child.name,
              amount: child.value,
              isChild: true,
              isNestedChild: true,
              nestingLevel: baseNestingLevel + 1,
            })
          })
          result.push({
            category,
            name: `Total for ${item.name}`,
            amount: item.total,
            isSubtotal: true,
            isNestedSubtotal: true,
            nestingLevel: baseNestingLevel,
          })
        } else {
          result.push({
            category,
            name: item.name,
            amount: item.total,
            isChild: true,
            isNestedChild: true,
            nestingLevel: baseNestingLevel,
          })
        }
      })
    }

    // Helper to add simple items
    const addSimpleItems = (
      items: Array<{ name: string; value: number }>,
      category: string,
      nestingLevel: number
    ) => {
      items.forEach((item) => {
        result.push({
          category,
          name: item.name,
          amount: item.value,
          isChild: true,
          isNestedChild: nestingLevel > 1,
          nestingLevel,
        })
      })
    }

    // ========== ASSETS SECTION ==========
    result.push({
      category: 'Assets',
      name: 'Assets',
      amount: totalAssets,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
      nestingLevel: 0,
    })

    // Current Assets
    const currentAssetsHierarchy = assetsHierarchy.current?.children || []
    const currentAssetItems = assetsHierarchy.current?.items || []
    if (
      currentAssetsHierarchy.length > 0 ||
      currentAssetItems.length > 0 ||
      assetsHierarchy.current?.total > 0
    ) {
      result.push({
        category: 'CurrentAssets',
        name: 'Current Assets',
        amount: assetsHierarchy.current?.total || 0,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: true,
        nestingLevel: 1,
      })

      if (currentAssetsHierarchy.length > 0) {
        addHierarchyItems(currentAssetsHierarchy, 'CurrentAssets', 2)
      } else {
        addSimpleItems(currentAssetItems, 'CurrentAssets', 2)
      }

      result.push({
        category: 'CurrentAssets',
        name: 'Total for Current Assets',
        amount: assetsHierarchy.current?.total || 0,
        isSubtotal: true,
        isNestedSubtotal: true,
        nestingLevel: 1,
      })
    }

    // Fixed Assets
    const fixedAssetsHierarchy = assetsHierarchy.fixed?.children || []
    const fixedAssetItems = assetsHierarchy.fixed?.items || []
    if (
      fixedAssetsHierarchy.length > 0 ||
      fixedAssetItems.length > 0 ||
      (assetsHierarchy.fixed?.total || 0) !== 0
    ) {
      result.push({
        category: 'FixedAssets',
        name: 'Fixed Assets',
        amount: assetsHierarchy.fixed?.total || 0,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: true,
        nestingLevel: 1,
      })

      if (fixedAssetsHierarchy.length > 0) {
        addHierarchyItems(fixedAssetsHierarchy, 'FixedAssets', 2)
      } else {
        addSimpleItems(fixedAssetItems, 'FixedAssets', 2)
      }

      result.push({
        category: 'FixedAssets',
        name: 'Total for Fixed Assets',
        amount: assetsHierarchy.fixed?.total || 0,
        isSubtotal: true,
        isNestedSubtotal: true,
        nestingLevel: 1,
      })
    }

    // Other Assets
    const otherAssetItems = assetsHierarchy.other?.items || []
    if (otherAssetItems.length > 0) {
      result.push({
        category: 'OtherAssets',
        name: 'Other Assets',
        amount: assetsHierarchy.other?.total || 0,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: true,
        nestingLevel: 1,
      })
      addSimpleItems(otherAssetItems, 'OtherAssets', 2)
      result.push({
        category: 'OtherAssets',
        name: 'Total for Other Assets',
        amount: assetsHierarchy.other?.total || 0,
        isSubtotal: true,
        isNestedSubtotal: true,
        nestingLevel: 1,
      })
    }

    result.push({
      category: 'Assets',
      name: 'Total for Assets',
      amount: totalAssets,
      isTotal: true,
      nestingLevel: 0,
    })

    // ========== LIABILITIES & EQUITY SECTION ==========
    result.push({
      category: 'LiabilitiesAndEquity',
      name: 'Liabilities & Equity',
      amount: totalLiabilities + totalEquity,
      isHeader: true,
      isCollapsible: true,
      isExpanded: true,
      nestingLevel: 0,
    })

    // Liabilities
    result.push({
      category: 'Liabilities',
      name: 'Liabilities',
      amount: totalLiabilities,
      isHeader: true,
      isSubHeader: true,
      isCollapsible: true,
      isExpanded: true,
      nestingLevel: 1,
    })

    // Current Liabilities
    const accountsPayableItems = liabilitiesHierarchy.current?.accountsPayable?.items || []
    const creditCardItems = liabilitiesHierarchy.current?.creditCards?.items || []
    const otherCurrentLiabItems = liabilitiesHierarchy.current?.otherCurrentLiabilities?.items || []
    const currentLiabItems = liabilitiesHierarchy.current?.items || []

    if (
      accountsPayableItems.length > 0 ||
      creditCardItems.length > 0 ||
      otherCurrentLiabItems.length > 0 ||
      currentLiabItems.length > 0 ||
      (liabilitiesHierarchy.current?.total || 0) > 0
    ) {
      result.push({
        category: 'CurrentLiabilities',
        name: 'Current Liabilities',
        amount: liabilitiesHierarchy.current?.total || 0,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: true,
        nestingLevel: 2,
      })

      if (accountsPayableItems.length > 0) {
        result.push({
          category: 'AccountsPayable',
          name: 'Accounts Payable',
          amount: liabilitiesHierarchy.current?.accountsPayable?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 3,
        })
        addSimpleItems(accountsPayableItems, 'AccountsPayable', 4)
        result.push({
          category: 'AccountsPayable',
          name: 'Total for Accounts Payable',
          amount: liabilitiesHierarchy.current?.accountsPayable?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 3,
        })
      }
      if (creditCardItems.length > 0) {
        result.push({
          category: 'CreditCards',
          name: 'Credit Cards',
          amount: liabilitiesHierarchy.current?.creditCards?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 3,
        })
        addSimpleItems(creditCardItems, 'CreditCards', 4)
        result.push({
          category: 'CreditCards',
          name: 'Total for Credit Cards',
          amount: liabilitiesHierarchy.current?.creditCards?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 3,
        })
      }
      if (otherCurrentLiabItems.length > 0) {
        result.push({
          category: 'OtherCurrentLiabilities',
          name: 'Other Current Liabilities',
          amount: liabilitiesHierarchy.current?.otherCurrentLiabilities?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 3,
        })
        addSimpleItems(otherCurrentLiabItems, 'OtherCurrentLiabilities', 4)
        result.push({
          category: 'OtherCurrentLiabilities',
          name: 'Total for Other Current Liabilities',
          amount: liabilitiesHierarchy.current?.otherCurrentLiabilities?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 3,
        })
      }
      if (
        currentLiabItems.length > 0 &&
        !accountsPayableItems.length &&
        !creditCardItems.length &&
        !otherCurrentLiabItems.length
      ) {
        addSimpleItems(currentLiabItems, 'CurrentLiabilities', 3)
      }

      result.push({
        category: 'CurrentLiabilities',
        name: 'Total for Current Liabilities',
        amount: liabilitiesHierarchy.current?.total || 0,
        isSubtotal: true,
        isNestedSubtotal: true,
        nestingLevel: 2,
      })
    }

    // Long-Term Liabilities
    const notesPayableItems = liabilitiesHierarchy.longTerm?.notesPayable?.items || []
    const otherLongTermItems = liabilitiesHierarchy.longTerm?.otherLongTerm?.items || []
    const longTermLiabItems = liabilitiesHierarchy.longTerm?.items || []

    if (
      notesPayableItems.length > 0 ||
      otherLongTermItems.length > 0 ||
      longTermLiabItems.length > 0 ||
      (liabilitiesHierarchy.longTerm?.total || 0) > 0
    ) {
      result.push({
        category: 'LongTermLiabilities',
        name: 'Long-Term Liabilities',
        amount: liabilitiesHierarchy.longTerm?.total || 0,
        isHeader: true,
        isSubHeader: true,
        isCollapsible: true,
        isExpanded: true,
        nestingLevel: 2,
      })

      if (notesPayableItems.length > 0) {
        result.push({
          category: 'NotesPayable',
          name: 'Notes Payable',
          amount: liabilitiesHierarchy.longTerm?.notesPayable?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 3,
        })
        addSimpleItems(notesPayableItems, 'NotesPayable', 4)
        result.push({
          category: 'NotesPayable',
          name: 'Total for Notes Payable',
          amount: liabilitiesHierarchy.longTerm?.notesPayable?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 3,
        })
      }
      if (otherLongTermItems.length > 0) {
        result.push({
          category: 'OtherLongTerm',
          name: 'Other Long-Term Liabilities',
          amount: liabilitiesHierarchy.longTerm?.otherLongTerm?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 3,
        })
        addSimpleItems(otherLongTermItems, 'OtherLongTerm', 4)
        result.push({
          category: 'OtherLongTerm',
          name: 'Total for Other Long-Term Liabilities',
          amount: liabilitiesHierarchy.longTerm?.otherLongTerm?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 3,
        })
      }
      if (longTermLiabItems.length > 0 && !notesPayableItems.length && !otherLongTermItems.length) {
        addSimpleItems(longTermLiabItems, 'LongTermLiabilities', 3)
      }

      result.push({
        category: 'LongTermLiabilities',
        name: 'Total for Long-Term Liabilities',
        amount: liabilitiesHierarchy.longTerm?.total || 0,
        isSubtotal: true,
        isNestedSubtotal: true,
        nestingLevel: 2,
      })
    }

    result.push({
      category: 'Liabilities',
      name: 'Total for Liabilities',
      amount: totalLiabilities,
      isSubtotal: true,
      nestingLevel: 1,
    })

    // Equity
    result.push({
      category: 'Equity',
      name: 'Equity',
      amount: totalEquity,
      isHeader: true,
      isSubHeader: true,
      isCollapsible: true,
      isExpanded: true,
      nestingLevel: 1,
    })

    // Add equity items from hierarchy or flat list
    const openingBalanceItems = equityHierarchy.openingBalanceEquity?.items || []
    const retainedEarningsItems = equityHierarchy.retainedEarnings?.items || []
    const ownersEquityItems = equityHierarchy.ownersEquity?.items || []
    const netIncomeItems = equityHierarchy.netIncome?.items || []
    const stockItems = equityHierarchy.stock?.items || []
    const otherEquityItems = equityHierarchy.otherEquity?.items || []
    const flatEquityItems = equityHierarchy.children || []

    const hasGroupedEquity =
      openingBalanceItems.length > 0 ||
      retainedEarningsItems.length > 0 ||
      ownersEquityItems.length > 0 ||
      netIncomeItems.length > 0 ||
      stockItems.length > 0 ||
      otherEquityItems.length > 0

    if (hasGroupedEquity) {
      if (openingBalanceItems.length > 0) {
        result.push({
          category: 'OpeningBalanceEquity',
          name: 'Opening Balance Equity',
          amount: equityHierarchy.openingBalanceEquity?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(openingBalanceItems, 'OpeningBalanceEquity', 3)
        result.push({
          category: 'OpeningBalanceEquity',
          name: 'Total for Opening Balance Equity',
          amount: equityHierarchy.openingBalanceEquity?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
      if (retainedEarningsItems.length > 0) {
        result.push({
          category: 'RetainedEarnings',
          name: 'Retained Earnings',
          amount: equityHierarchy.retainedEarnings?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(retainedEarningsItems, 'RetainedEarnings', 3)
        result.push({
          category: 'RetainedEarnings',
          name: 'Total for Retained Earnings',
          amount: equityHierarchy.retainedEarnings?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
      if (ownersEquityItems.length > 0) {
        result.push({
          category: 'OwnersEquity',
          name: "Owner's Equity",
          amount: equityHierarchy.ownersEquity?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(ownersEquityItems, 'OwnersEquity', 3)
        result.push({
          category: 'OwnersEquity',
          name: "Total for Owner's Equity",
          amount: equityHierarchy.ownersEquity?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
      if (stockItems.length > 0) {
        result.push({
          category: 'Stock',
          name: 'Stock',
          amount: equityHierarchy.stock?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(stockItems, 'Stock', 3)
        result.push({
          category: 'Stock',
          name: 'Total for Stock',
          amount: equityHierarchy.stock?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
      if (netIncomeItems.length > 0) {
        result.push({
          category: 'NetIncome',
          name: 'Net Income',
          amount: equityHierarchy.netIncome?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(netIncomeItems, 'NetIncome', 3)
        result.push({
          category: 'NetIncome',
          name: 'Total for Net Income',
          amount: equityHierarchy.netIncome?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
      if (otherEquityItems.length > 0) {
        result.push({
          category: 'OtherEquity',
          name: 'Other Equity',
          amount: equityHierarchy.otherEquity?.total || 0,
          isHeader: true,
          isSubHeader: true,
          isCollapsible: true,
          isExpanded: true,
          nestingLevel: 2,
        })
        addSimpleItems(otherEquityItems, 'OtherEquity', 3)
        result.push({
          category: 'OtherEquity',
          name: 'Total for Other Equity',
          amount: equityHierarchy.otherEquity?.total || 0,
          isSubtotal: true,
          isNestedSubtotal: true,
          nestingLevel: 2,
        })
      }
    } else {
      addSimpleItems(flatEquityItems, 'Equity', 2)
    }

    result.push({
      category: 'Equity',
      name: 'Total for Equity',
      amount: totalEquity,
      isSubtotal: true,
      nestingLevel: 1,
    })

    // Final Total
    result.push({
      category: 'Total',
      name: 'Total for Liabilities & Equity',
      amount: totalLiabilities + totalEquity,
      isFinalTotal: true,
      nestingLevel: 0,
    })

    return result
  }, [reportData, totalAssets, totalLiabilities, totalEquity])

  // Loading state - check AFTER all hooks are called
  if (isLoading && !reportData) {
    return <ReportLoadingState message="Generating balance sheet report..." />
  }

  // Error state - check AFTER all hooks are called
  if (error) {
    return <ReportErrorState error={error} onRetry={() => mutate()} />
  }

  return (
    <div
      className="@container space-y-4 overflow-y-auto styled-scrollbar h-full"
      id="balance-sheet-content"
    >
      {/* Header */}
      <div className="border-b border-gray-200/10 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold theme-text-primary">
                {organization?.name || 'Balance Sheet'}
              </h1>
              <p className="text-sm theme-text-secondary">QuickBooks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {period === 'custom' && (
              <DateRangeInputs
                startDate={displayDateRange.start}
                endDate={displayDateRange.end}
                onStartChange={handleStartDateChange}
                onEndChange={handleEndDateChange}
                disabled={isRefreshing}
                compact
              />
            )}
            {period !== 'custom' && (
              <span className="hidden sm:inline">{formatDateRange()}</span>
            )}
            <div className="w-[160px] flex-shrink-0">
              <PeriodSelect
                value={period}
                onChange={handlePeriodChange}
                disabled={isRefreshing}
              />
            </div>
            {period !== 'last_year' && (
              <button
                onClick={() => handlePeriodChange('last_year')}
                className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-primary hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading overlay during revalidation */}
      {isValidating && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-sm theme-text-secondary">Updating balance sheet data...</p>
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
              reportType="balance_sheet"
              collapsible={true}
              defaultExpanded={false}
            />
          )}

          <BalanceSheetMetricsGrid
            totalAssets={totalAssets}
            totalLiabilities={totalLiabilities}
            totalEquity={totalEquity}
            assetsHierarchy={reportData?.assetsHierarchy}
            liabilitiesHierarchy={reportData?.liabilitiesHierarchy}
            equityHierarchy={reportData?.equityHierarchy}
            kpis={{
              totalAssets,
              totalLiabilities,
              totalEquity,
              workingCapital: reportData?.workingCapital || 0,
              currentAssets: reportData?.currentAssets || 0,
              currentLiabilities: reportData?.currentLiabilities || 0,
              inventory: reportData?.inventory || 0,
              currentRatio: reportData?.currentRatio || 0,
              debtToEquity: reportData?.debtToEquity || 0,
              quickRatio: reportData?.quickRatio || 0,
              roa: reportData?.roa || 0,
            }}
            ratios={{
              assetTurnover: reportData?.assetTurnover || 0,
              equityMultiplier: reportData?.equityMultiplier || 0,
              returnOnEquity: reportData?.returnOnEquity || 0,
              debtRatio: reportData?.debtRatio || 0,
              revenue: reportData?.revenue || 0,
              netIncome: reportData?.netIncome || 0,
              totalDebt: reportData?.totalDebt || 0,
            }}
            currency={currency}
            contextData={contextData}
          />

          {/* AI Analysis Card */}
          <AIAnalysisCard
            pageType="balancesheet"
            data={{
              metrics: {
                totalAssets,
                totalLiabilities,
                totalEquity,
                currentAssets: reportData?.currentAssets,
                currentLiabilities: reportData?.currentLiabilities,
              },
              assetsHierarchy: reportData?.assetsHierarchy,
              liabilitiesHierarchy: reportData?.liabilitiesHierarchy,
              equityHierarchy: reportData?.equityHierarchy,
              ratios: {
                assetTurnover: reportData?.assetTurnover || 0,
                equityMultiplier: reportData?.equityMultiplier || 0,
                returnOnEquity: reportData?.returnOnEquity || 0,
                debtRatio: reportData?.debtRatio || 0,
              },
              kpis: {
                currentRatio: reportData?.currentRatio || 0,
                quickRatio: reportData?.quickRatio || 0,
                debtToEquity: reportData?.debtToEquity || 0,
                workingCapital: reportData?.workingCapital || 0,
              },
            }}
            dateRange={dateRange}
            context={contextData}
            dataLoadingStates={{
              metricsLoading: isLoading,
            }}
          />

          <BalanceSheetTable
            data={balanceSheetData}
            asOfDate={asOfDate}
            toggleSection={toggleSection}
            currency={currency}
            exportData={balanceSheetExportData}
          />
        </>
      )}
    </div>
  )
}
