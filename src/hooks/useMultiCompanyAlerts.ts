// Hook for fetching alerts from multiple QB companies
'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { MetricAlert } from '@/lib/types/metric-alert'
import { useCombinedAlerts } from './useMetricAlerts'
import { useSession } from '@/contexts/SessionContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { logger } from '@/lib/logger'

interface CompanyInfo {
  realmId: string
  companyName: string
}

interface BillsData {
  totalUnpaid?: number
  totalBills?: number
  overdueBills?: number
  overdueAmount?: number
}

interface OutstandingData {
  totalOutstanding?: number
  numberOfCustomers?: number
  overdueAmount?: number
  overdueCustomers?: number
}

// Fetcher for SWR that throws on error (matches useReportData pattern)
const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    const error = new Error('Failed to fetch data')
    throw error
  }
  return response.json()
}

/**
 * Hook to fetch unpaid bills for a specific realmId
 */
function useCompanyUnpaidBills(
  organizationId: string | undefined,
  realmId: string,
  startDate: string,
  endDate: string,
  enabled: boolean
) {
  const params = new URLSearchParams()
  if (organizationId) params.append('organizationId', organizationId)
  params.append('start', startDate)
  params.append('end', endDate)
  params.append('view', 'aging')
  params.append('asOfDate', endDate)
  if (realmId) params.append('realmId', realmId)

  const swrKey =
    enabled && organizationId && realmId ? `/api/quickbooks/bills?${params.toString()}` : null

  const { data, isLoading, error } = useSWR(swrKey, fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const billsData = useMemo((): BillsData | null => {
    if (error) {
      logger.debug('Bills fetch error for realm', { realmId, error: error.message })
      return null
    }
    if (!data?.data) return null

    const bills = data.data.bills || []
    const unpaidBills = bills.filter((bill: any) => bill.balance && bill.balance > 0)

    const totalUnpaid =
      data.data.kpis?.totalBalance ||
      unpaidBills.reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0)
    const overdueBills = unpaidBills.filter((b: any) => b.daysOverdue > 0).length
    const overdueAmount =
      data.data.kpis?.overdueBalance ||
      unpaidBills
        .filter((b: any) => b.daysOverdue > 0)
        .reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0)

    return {
      totalUnpaid,
      totalBills: unpaidBills.length,
      overdueBills,
      overdueAmount,
    }
  }, [data, error, realmId])

  return { billsData, isLoading }
}

/**
 * Hook to fetch outstanding payments for a specific realmId
 */
function useCompanyOutstanding(
  organizationPK: string | undefined,
  realmId: string,
  enabled: boolean
) {
  const params = new URLSearchParams()
  if (organizationPK) params.append('orgId', organizationPK)
  params.append('type', 'AgedReceivables')
  if (realmId) params.append('realmId', realmId)

  const swrKey =
    enabled && organizationPK && realmId ? `/api/quickbooks/reports?${params.toString()}` : null

  const { data, isLoading, error } = useSWR(swrKey, fetcher, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const outstandingData = useMemo((): OutstandingData | null => {
    if (error) {
      logger.debug('Outstanding payments fetch error for realm', { realmId, error: error.message })
      return null
    }
    if (!data?.data) return null

    const { lines = [], totals = {}, grandTotal = 0 } = data.data

    // Calculate overdue amount (everything except "Current")
    let overdueAmount = 0
    for (const [period, amount] of Object.entries(totals)) {
      const periodLower = period.toLowerCase()
      if (!periodLower.includes('current')) {
        overdueAmount += amount as number
      }
    }

    // Count customers with overdue amounts
    const overdueCustomers = (lines as any[]).filter((line) => {
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
      numberOfCustomers: (lines as any[]).length,
      overdueAmount,
      overdueCustomers,
    }
  }, [data, error, realmId])

  return { outstandingData, isLoading }
}

/**
 * Hook for a single company's alerts
 */
function useCompanyAlerts(
  company: CompanyInfo,
  organizationId: string | undefined,
  organizationPK: string | undefined,
  startDate: string,
  endDate: string,
  currency: string,
  enabled: boolean
): { alerts: MetricAlert[]; isLoading: boolean } {
  const { billsData, isLoading: billsLoading } = useCompanyUnpaidBills(
    organizationId,
    company.realmId,
    startDate,
    endDate,
    enabled
  )

  const { outstandingData, isLoading: outstandingLoading } = useCompanyOutstanding(
    organizationPK,
    company.realmId,
    enabled
  )

  const baseAlerts = useCombinedAlerts(billsData, outstandingData, undefined, currency)

  // Add company info to each alert
  const alerts = useMemo(() => {
    return baseAlerts.map((alert) => ({
      ...alert,
      id: `${company.realmId}_${alert.id}`,
      companyId: company.realmId,
      companyName: company.companyName,
      // Update action URLs to include realmId
      actionUrl: alert.actionUrl
        ? `${alert.actionUrl}${alert.actionUrl.includes('?') ? '&' : '?'}realmId=${company.realmId}`
        : undefined,
    }))
  }, [baseAlerts, company.realmId, company.companyName])

  return {
    alerts,
    isLoading: billsLoading || outstandingLoading,
  }
}

export interface MultiCompanyAlertsResult {
  alerts: MetricAlert[]
  alertsByCompany: Map<string, MetricAlert[]>
  companies: CompanyInfo[]
  isLoading: boolean
  unreadCount: number
}

/**
 * Parse QB companies from providerEntities
 */
export function parseQBCompanies(providerEntities: Record<string, string>): CompanyInfo[] {
  const companies: CompanyInfo[] = []
  const qbEntities = providerEntities['quickbooks']

  if (qbEntities) {
    try {
      const nameMap = JSON.parse(qbEntities) as Record<string, string>
      for (const [realmId, companyName] of Object.entries(nameMap)) {
        companies.push({ realmId, companyName })
      }
    } catch {
      // Legacy single-entity format - no realmId available
    }
  }

  return companies
}

/**
 * Hook for fetching alerts from multiple QB companies
 * Returns alerts grouped by company
 */
export function useMultiCompanyAlerts(
  providerEntities: Record<string, string>,
  startDate?: string,
  endDate?: string
): MultiCompanyAlertsResult {
  const { organization, connectedProviders } = useSession()
  const { currency } = useCurrency()

  const isQuickBooksConnected = connectedProviders.includes('quickbooks')
  // For bills API, use organization_id directly
  const organizationId = organization?.organization_id
  // For AR aging API, use PK or construct with ORG# prefix
  const organizationPK =
    organization?.PK ||
    (organization?.organization_id ? `ORG#${organization.organization_id}` : undefined)

  // Parse companies from providerEntities
  const companies = useMemo(() => parseQBCompanies(providerEntities), [providerEntities])

  // Calculate default date range if not provided
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }, [])

  const effectiveStartDate = startDate || defaultStartDate
  const effectiveEndDate = endDate || defaultEndDate

  // Fetch alerts for each company (up to 5 to avoid too many requests)
  const maxCompanies = Math.min(companies.length, 5)

  // We need to call hooks unconditionally, so pad with dummy companies
  const paddedCompanies = useMemo(() => {
    const result: (CompanyInfo | null)[] = [...companies.slice(0, maxCompanies)]
    while (result.length < 5) {
      result.push(null)
    }
    return result
  }, [companies, maxCompanies])

  // Call hooks for each slot (hooks must be called unconditionally)
  const company0 = useCompanyAlerts(
    paddedCompanies[0] || { realmId: '', companyName: '' },
    organizationId,
    organizationPK,
    effectiveStartDate,
    effectiveEndDate,
    currency,
    isQuickBooksConnected && paddedCompanies[0] !== null
  )

  const company1 = useCompanyAlerts(
    paddedCompanies[1] || { realmId: '', companyName: '' },
    organizationId,
    organizationPK,
    effectiveStartDate,
    effectiveEndDate,
    currency,
    isQuickBooksConnected && paddedCompanies[1] !== null
  )

  const company2 = useCompanyAlerts(
    paddedCompanies[2] || { realmId: '', companyName: '' },
    organizationId,
    organizationPK,
    effectiveStartDate,
    effectiveEndDate,
    currency,
    isQuickBooksConnected && paddedCompanies[2] !== null
  )

  const company3 = useCompanyAlerts(
    paddedCompanies[3] || { realmId: '', companyName: '' },
    organizationId,
    organizationPK,
    effectiveStartDate,
    effectiveEndDate,
    currency,
    isQuickBooksConnected && paddedCompanies[3] !== null
  )

  const company4 = useCompanyAlerts(
    paddedCompanies[4] || { realmId: '', companyName: '' },
    organizationId,
    organizationPK,
    effectiveStartDate,
    effectiveEndDate,
    currency,
    isQuickBooksConnected && paddedCompanies[4] !== null
  )

  // Combine all results
  const result = useMemo(() => {
    const companyResults = [company0, company1, company2, company3, company4]

    const allAlerts: MetricAlert[] = []
    const alertsByCompany = new Map<string, MetricAlert[]>()
    let isLoading = false

    for (let i = 0; i < maxCompanies; i++) {
      const company = paddedCompanies[i]
      const companyResult = companyResults[i]

      if (company && companyResult) {
        if (companyResult.isLoading) isLoading = true
        if (companyResult.alerts.length > 0) {
          allAlerts.push(...companyResult.alerts)
          alertsByCompany.set(company.realmId, companyResult.alerts)
        }
      }
    }

    // Sort by severity (critical first, then warning, then info)
    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    }
    allAlerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return {
      alerts: allAlerts,
      alertsByCompany,
      companies: companies.slice(0, maxCompanies),
      isLoading,
      unreadCount: allAlerts.length,
    }
  }, [company0, company1, company2, company3, company4, paddedCompanies, maxCompanies, companies])

  return result
}
