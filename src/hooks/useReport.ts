'use client'

import useSWR, { SWRConfiguration } from 'swr'
import { apiClient } from '@/lib/apiClient'
import { ReportType, ReportData } from '@/types/reports'

interface UseReportOptions extends SWRConfiguration {
  startDate?: string
  endDate?: string
  organizationId?: string
  includeDetails?: boolean
  enabled?: boolean
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch report: ${response.statusText}`)
  }
  return response.json()
}

export function useReport(
  reportType: ReportType,
  options: UseReportOptions = {}
) {
  const {
    startDate,
    endDate,
    organizationId,
    includeDetails = true,
    enabled = true,
    ...swrOptions
  } = options

  // Build query string
  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)
  if (organizationId) params.append('org', organizationId)
  if (includeDetails) params.append('details', 'true')

  const queryString = params.toString()
  const url = `/api/reports/${reportType}${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportData>(
    enabled ? url : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5 * 60 * 1000, // 5 minutes
      ...swrOptions
    }
  )

  return {
    data,
    error,
    isLoading,
    isValidating,
    refresh: () => mutate(),
    isError: !!error
  }
}

// Convenience hooks for specific report types
export function useProfitLossReport(options?: UseReportOptions) {
  return useReport('profit_loss', options)
}

export function useBalanceSheetReport(options?: UseReportOptions) {
  return useReport('balance_sheet', options)
}

export function useCashFlowReport(options?: UseReportOptions) {
  return useReport('cash_flow', options)
}

export function useAgedReceivablesReport(options?: UseReportOptions) {
  return useReport('aged_receivables', options)
}

export function useAgedPayablesReport(options?: UseReportOptions) {
  return useReport('aged_payables', options)
}

// Hook for fetching multiple reports at once
// Due to React Hook rules, we need to call hooks unconditionally
// This implementation supports up to 5 reports simultaneously
export function useMultipleReports(
  reportConfigs: { type: ReportType; options?: UseReportOptions }[]
) {
  // Always call the same number of hooks in the same order
  const report1 = useReport(
    reportConfigs[0]?.type || 'profit_loss',
    { ...reportConfigs[0]?.options, enabled: !!reportConfigs[0] }
  )
  const report2 = useReport(
    reportConfigs[1]?.type || 'balance_sheet',
    { ...reportConfigs[1]?.options, enabled: !!reportConfigs[1] }
  )
  const report3 = useReport(
    reportConfigs[2]?.type || 'cash_flow',
    { ...reportConfigs[2]?.options, enabled: !!reportConfigs[2] }
  )
  const report4 = useReport(
    reportConfigs[3]?.type || 'aged_receivables',
    { ...reportConfigs[3]?.options, enabled: !!reportConfigs[3] }
  )
  const report5 = useReport(
    reportConfigs[4]?.type || 'aged_payables',
    { ...reportConfigs[4]?.options, enabled: !!reportConfigs[4] }
  )

  // Collect only the enabled results
  const results = [
    reportConfigs[0] ? { type: reportConfigs[0].type, ...report1 } : null,
    reportConfigs[1] ? { type: reportConfigs[1].type, ...report2 } : null,
    reportConfigs[2] ? { type: reportConfigs[2].type, ...report3 } : null,
    reportConfigs[3] ? { type: reportConfigs[3].type, ...report4 } : null,
    reportConfigs[4] ? { type: reportConfigs[4].type, ...report5 } : null,
  ].filter(Boolean)

  const isLoading = results.some(r => r?.isLoading)
  const hasError = results.some(r => r?.isError)
  const allLoaded = results.every(r => r?.data && !r?.isLoading)

  return {
    reports: results,
    isLoading,
    hasError,
    allLoaded,
    maxReports: 5
  }
}