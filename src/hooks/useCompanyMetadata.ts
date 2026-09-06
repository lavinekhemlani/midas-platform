// src/hooks/useCompanyMetadata.ts
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { useSession } from '@/contexts/SessionContext'

// Custom fetcher function that handles the apiClient pattern
const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    let errorData: any = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: 'Failed to fetch company metadata' }
    }
    throw new Error(errorData.error || errorData.message || 'Failed to fetch company metadata')
  }
  return response.json()
}

export interface CompanyMetadata {
  identity: {
    name: string
    legalName: string | null
    organizationId: string
    taxId: string | null
    country: string
    establishedDate: string
    businessAge: string | null
    registrationNumber: string | null
    jurisdiction: string | null
    revenueModel: string | null
    vatRegistered: boolean
  }
  contact: {
    email: string | null
    phone: string | null
    fax: string | null
    website: string | null
    address: {
      street_address1?: string
      street_address2?: string
      city?: string
      state?: string
      country?: string
      zip?: string
    } | null
    addressString: string | null
  }
  financial: {
    fiscalYearStartMonth: number
    fiscalYearEnd: string
    currencyCode: string
    currencySymbol: string
    currencyFormat: string
    pricePrecision: number
    taxBasis: string
    timezone: string
    languageCode: string
  }
  integration: {
    provider: string | null
    connected: boolean
    connectionHealth: 'healthy' | 'warning' | 'error' | 'disconnected'
    lastSync: string | null
    dataFreshness: 'fresh' | 'recent' | 'stale' | 'unknown'
    dataAgeHours: number | null
    tokenStatus: 'valid' | 'expiring_soon' | 'expired' | 'unknown'
    tokenExpiryDays: number | null
    realmId: string | null
  }
  subscription: {
    tier: string
    activeFeatures: string[]
    userCount: number
    accountAge: number | null
  }
  operational: {
    activeCustomers: number | null
    activeVendors: number | null
    activeEmployees: number | null
    bankAccounts: number | null
  }
}

export function useCompanyMetadata() {
  const { activeProvider, requiresProviderConnection } = useSession()

  // Only fetch if there's an active provider connected - prevents loop when QB disconnected
  const shouldFetch = !!activeProvider && !requiresProviderConnection

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: CompanyMetadata }>(
    shouldFetch ? '/api/company/metadata' : null,
    fetcher,
    {
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true,
    }
  )

  return {
    data: data?.data,
    isLoading,
    error,
    mutate,
  }
}
