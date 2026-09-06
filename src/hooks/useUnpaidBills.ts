// src/hooks/useUnpaidBills.ts
'use client'

import { useMemo } from 'react'
import { useBills } from './useReportData'
import { useSession } from '@/contexts/SessionContext'

interface UnpaidBill {
  id: string
  vendor: string
  docNumber: string
  txnDate: string
  dueDate: string
  totalAmount: number
  balance: number
  daysOverdue: number
  isOverdue: boolean
  agingBucket: string
}

interface UnpaidBillsSummary {
  totalUnpaid: number
  totalBills: number
  overdueBills: number
  overdueAmount: number
  topOverdueVendors: Array<{
    name: string
    amount: number
    billCount: number
  }>
  bills: UnpaidBill[]
}

/**
 * Hook for fetching and processing unpaid bills data
 * Uses the existing bills data and extracts unpaid bill information
 */
export function useUnpaidBills(
  startDate?: string,
  endDate?: string,
  organizationId?: string,
  realmId?: string
) {
  const { connectedProviders } = useSession()

  // Check if QuickBooks is connected (can be connected alongside other providers)
  const isQuickBooksConnected = connectedProviders.includes('quickbooks')

  // Only fetch if QuickBooks is connected - this hook is specifically for QB data
  const shouldFetch = isQuickBooksConnected

  const { reportData, isLoading, error, mutate, refetch } = useBills(
    startDate,
    endDate,
    'aging', // Use aging view to get unpaid bills with balance info
    shouldFetch ? organizationId : undefined, // Pass undefined to disable SWR fetch
    realmId
  )

  const unpaidBillsData = useMemo(() => {
    if (!reportData?.data) {
      return null
    }

    const data = reportData.data
    const bills = data.bills || []

    // Process bills to extract unpaid ones
    const unpaidBills: UnpaidBill[] = bills
      .filter((bill: any) => bill.balance && bill.balance > 0)
      .map((bill: any) => ({
        id: bill.id || bill.txnId,
        vendor: bill.vendor || 'Unknown Vendor',
        docNumber: bill.docNumber || bill.billNumber || '',
        txnDate: bill.txnDate,
        dueDate: bill.dueDate,
        totalAmount: bill.totalAmount || 0,
        balance: bill.balance || 0,
        daysOverdue: bill.daysOverdue || 0,
        isOverdue: bill.daysOverdue > 0,
        agingBucket: bill.agingBucket || 'Current',
      }))

    // Sort by balance (highest first)
    unpaidBills.sort((a, b) => b.balance - a.balance)

    // Calculate summary metrics
    const totalUnpaid =
      data.kpis?.totalBalance || unpaidBills.reduce((sum, bill) => sum + bill.balance, 0)
    const totalBills = unpaidBills.length
    const overdueBills = unpaidBills.filter((b) => b.isOverdue).length
    const overdueAmount =
      data.kpis?.overdueBalance ||
      unpaidBills.filter((b) => b.isOverdue).reduce((sum, bill) => sum + bill.balance, 0)

    // Calculate top overdue vendors
    const vendorOverdue: { [key: string]: { name: string; amount: number; billCount: number } } = {}

    unpaidBills
      .filter((b) => b.isOverdue)
      .forEach((bill) => {
        if (!vendorOverdue[bill.vendor]) {
          vendorOverdue[bill.vendor] = {
            name: bill.vendor,
            amount: 0,
            billCount: 0,
          }
        }
        vendorOverdue[bill.vendor].amount += bill.balance
        vendorOverdue[bill.vendor].billCount += 1
      })

    const topOverdueVendors = Object.values(vendorOverdue)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5) // Top 5 vendors with overdue bills

    return {
      totalUnpaid,
      totalBills,
      overdueBills,
      overdueAmount,
      topOverdueVendors,
      bills: unpaidBills,
    } as UnpaidBillsSummary
  }, [reportData])

  // If QuickBooks is not connected, return null to clear notifications
  // This ensures notifications disappear when QB is disconnected
  return {
    unpaidBillsData: isQuickBooksConnected ? unpaidBillsData : null,
    isLoading: isQuickBooksConnected ? isLoading : false,
    error: isQuickBooksConnected ? error : null,
    mutate,
    refetch: () => refetch(),
  }
}
