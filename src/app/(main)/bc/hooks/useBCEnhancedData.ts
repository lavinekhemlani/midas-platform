'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import type {
  TopCustomerRow,
  TopVendorRow,
  AgedReceivablesSummary,
  AgedPayablesSummary,
  ARAPSummary,
  BankAccountRow,
  FinancialRatios,
  EfficiencyMetrics,
  CashRunwayData,
  InventorySummary,
  InventoryItem,
  MonthlyRevenueRow,
  SalespersonRow,
} from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface DateRange {
  startDate: string
  endDate: string
}

interface EnhancedFinancialData {
  topCustomers: TopCustomerRow[]
  topVendors: TopVendorRow[]
  agedReceivables: AgedReceivablesSummary | null
  agedPayables: AgedPayablesSummary | null
  arapSummary: ARAPSummary
  bankAccounts: BankAccountRow[]
  totalCash: number
  financialRatios: Partial<FinancialRatios>
  efficiencyMetrics: EfficiencyMetrics | null
  cashRunwayData: CashRunwayData | null
  inventorySummary: InventorySummary | null
  inventoryItems: InventoryItem[]
  monthlyRevenue: MonthlyRevenueRow[]
  salesBySalesperson: SalespersonRow[]
  currency?: string
  companyName: string | null
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch enhanced financial data')
  }
  return response.json()
}

export function useBCEnhancedData(connectionId: string | null, dateRange?: DateRange) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  if (dateRange?.startDate) params.set('startDate', dateRange.startDate)
  if (dateRange?.endDate) params.set('endDate', dateRange.endDate)
  const qs = params.toString()
  const url = connectionId
    ? `/api/providers/dynamics/enhanced-financial-data${qs ? `?${qs}` : ''}`
    : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-enhanced-data', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: EnhancedFinancialData | null = data?.data ?? null

  return {
    topCustomers: d?.topCustomers ?? [],
    topVendors: d?.topVendors ?? [],
    agedReceivables: d?.agedReceivables ?? null,
    agedPayables: d?.agedPayables ?? null,
    arapSummary: d?.arapSummary ?? null,
    bankAccounts: d?.bankAccounts ?? [],
    totalCash: d?.totalCash ?? 0,
    financialRatios: d?.financialRatios ?? null,
    efficiencyMetrics: d?.efficiencyMetrics ?? null,
    cashRunwayData: d?.cashRunwayData ?? null,
    inventorySummary: d?.inventorySummary ?? null,
    inventoryItems: d?.inventoryItems ?? [],
    monthlyRevenue: d?.monthlyRevenue ?? [],
    salesBySalesperson: d?.salesBySalesperson ?? [],
    currency: d?.currency,
    companyName: d?.companyName ?? null,
    isLoading,
    error,
    mutate,
  }
}
