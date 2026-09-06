// src/hooks/useOutstandingPayments.ts
'use client'

import { useMemo } from 'react'
import { useSession } from '@/contexts/SessionContext'
import { useQuickBooksARAging } from './useReportData'

/**
 * AR Aging line from QuickBooks API
 */
interface ARAGingLine {
  name: string
  entityId?: string
  total: number
  byPeriod: Record<string, number>
}

/**
 * Processed data for outstanding payments
 */
interface OutstandingPaymentsSummary {
  totalOutstanding: number
  numberOfCustomers: number
  overdueAmount: number
  overdueCustomers: number
  periods: string[]
  totals: Record<string, number>
  topCustomers: Array<{
    name: string
    id?: string
    total: number
    current: number
    overdue: number
    byPeriod: Record<string, number>
  }>
}

/**
 * Hook for fetching and processing outstanding payments data
 * Uses QuickBooks AR aging report for accurate data
 *
 * Note: startDate and endDate params are kept for backward compatibility but not used
 * AR aging always shows current outstanding as of today
 */
export function useOutstandingPayments(_startDate?: string, _endDate?: string, realmId?: string) {
  const { organization, connectedProviders } = useSession()

  // Get organization ID (with ORG# prefix)
  const organizationId =
    organization?.PK ||
    (organization?.organization_id ? `ORG#${organization.organization_id}` : undefined)

  // Check if QuickBooks is connected (can be connected alongside other providers)
  const isQuickBooksConnected = connectedProviders.includes('quickbooks')

  // Only fetch if QuickBooks is connected - this hook is specifically for QB data
  const shouldFetch = isQuickBooksConnected

  // Fetch AR aging data from the correct QuickBooks endpoint
  // Pass undefined if not connected to prevent SWR from making the request
  const { reportData, isLoading, error, mutate } = useQuickBooksARAging(
    shouldFetch ? organizationId : undefined,
    realmId
  )

  const outstandingData = useMemo((): OutstandingPaymentsSummary | null => {
    if (!reportData) {
      return null
    }

    // The QuickBooks AR aging report has this structure:
    // { reportName, reportDate, currency, periods, lines, totals, grandTotal }
    const { lines = [], totals = {}, grandTotal = 0, periods = [] } = reportData

    // Calculate overdue amount (everything except "Current")
    let overdueAmount = 0
    let currentAmount = 0

    // Find "Current" period and calculate amounts
    for (const [period, amount] of Object.entries(totals)) {
      const periodLower = period.toLowerCase()
      if (periodLower === 'current' || periodLower.includes('current')) {
        currentAmount += amount as number
      } else {
        overdueAmount += amount as number
      }
    }

    // Process customers - sort by total and take top 20
    const sortedLines = [...(lines as ARAGingLine[])].sort((a, b) => b.total - a.total)
    const topCustomers = sortedLines.slice(0, 20).map((line) => {
      // Calculate current and overdue for each customer
      let customerCurrent = 0
      let customerOverdue = 0

      for (const [period, amount] of Object.entries(line.byPeriod || {})) {
        const periodLower = period.toLowerCase()
        if (periodLower === 'current' || periodLower.includes('current')) {
          customerCurrent += amount as number
        } else {
          customerOverdue += amount as number
        }
      }

      return {
        name: line.name,
        id: line.entityId,
        total: line.total,
        current: customerCurrent,
        overdue: customerOverdue,
        byPeriod: line.byPeriod || {},
      }
    })

    // Count customers with overdue amounts
    const overdueCustomers = (lines as ARAGingLine[]).filter((line) => {
      for (const [period, amount] of Object.entries(line.byPeriod || {})) {
        const periodLower = period.toLowerCase()
        if (!periodLower.includes('current') && (amount as number) > 0) {
          return true
        }
      }
      return false
    }).length

    return {
      totalOutstanding: grandTotal,
      numberOfCustomers: (lines as ARAGingLine[]).length,
      overdueAmount,
      overdueCustomers,
      periods,
      totals,
      topCustomers,
    }
  }, [reportData])

  // If QuickBooks is not connected, return null to clear notifications
  // This ensures notifications disappear when QB is disconnected
  return {
    outstandingData: isQuickBooksConnected ? outstandingData : null,
    isLoading: isQuickBooksConnected ? isLoading : false,
    error: isQuickBooksConnected ? error : null,
    mutate,
    refetch: () => mutate(),
  }
}
