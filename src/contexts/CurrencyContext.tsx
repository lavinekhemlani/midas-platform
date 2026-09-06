// src/contexts/CurrencyContext.tsx
'use client'

import { createContext, useContext, ReactNode, useCallback } from 'react'
import { useFinancialData } from './FinancialDataContext'
import { useSession } from './SessionContext'
import { useSearchParams, usePathname } from 'next/navigation'
import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface CurrencyContextType {
  currency: string
  setCurrency: (currency: string) => void
  hasFetchedCurrency: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

const currencyFetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) return null
  const data = await response.json()
  return data.currency || null
}

/**
 * Derive the active provider from the current pathname.
 * This is the source of truth for which integration the user is currently viewing,
 * since `activeProvider` from session is static (first connected provider) and
 * doesn't change when navigating between /qb and /bc routes.
 */
function getRouteProvider(pathname: string | null): 'quickbooks' | 'dynamics' | 'shopify' | null {
  if (!pathname) return null
  if (pathname.startsWith('/qb')) return 'quickbooks'
  if (pathname.startsWith('/bc-warehouse') || pathname.startsWith('/bc')) return 'dynamics'
  if (pathname.startsWith('/shopify')) return 'shopify'
  // Dashboard and other non-provider routes — fall back to null
  return null
}

/**
 * Build the SWR cache key for currency fetching.
 * Returns null when we shouldn't fetch (SWR skips the request).
 * Each provider+entity combo produces a unique key → separate cache entries.
 */
function getCurrencyKey(
  status: string,
  routeProvider: 'quickbooks' | 'dynamics' | 'shopify' | null,
  fallbackProvider: string | null,
  realmId: string | null,
  bcConnectionId: string | null,
  shopDomain: string | null
): string | null {
  if (status !== 'authenticated') return null

  // Use route-derived provider first, fall back to session's activeProvider
  // (for pages like /dashboard that aren't under /qb or /bc)
  const provider = routeProvider || fallbackProvider
  if (!provider) return null

  if (provider === 'quickbooks' || provider === 'zoho') {
    const base = '/api/organization/currency'
    return realmId ? `${base}?realmId=${encodeURIComponent(realmId)}` : base
  }
  if (provider === 'dynamics') {
    const base = '/api/providers/dynamics/currency'
    return bcConnectionId ? `${base}?connectionId=${encodeURIComponent(bcConnectionId)}` : base
  }
  if (provider === 'shopify') {
    const base = '/api/providers/shopify/currency'
    return shopDomain ? `${base}?shop=${encodeURIComponent(shopDomain)}` : base
  }
  return null
}

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { financialData } = useFinancialData()
  const { status, activeProvider } = useSession()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const routeProvider = getRouteProvider(pathname)

  // QB entity from URL
  const realmId = searchParams.get('realmId')
  // BC entity from URL
  const bcConnectionId =
    searchParams.get('connectionId') || searchParams.get('bc') || searchParams.get('schema')
  // Shopify store from URL
  const shopDomain = searchParams.get('shop')

  const swrKey = getCurrencyKey(
    status,
    routeProvider,
    activeProvider,
    realmId,
    bcConnectionId,
    shopDomain
  )

  const { data: fetchedCurrency, mutate } = useSWR<string | null>(swrKey, currencyFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    keepPreviousData: false,
  })

  // financialData.currency (from dashboard hooks) can be stale when switching
  // between providers, so only use it when it matches the current route's provider.
  // e.g. if financialData was loaded on /bc (dynamics), don't use it on /qb pages.
  const financialCurrency = financialData?.currency || null
  const currency = fetchedCurrency || financialCurrency || ''
  const hasFetchedCurrency = !!currency

  // Allow pages (e.g. BCOAuthSummaryView) to explicitly set the currency.
  // This writes into SWR's cache for the current key so it stays consistent.
  const setCurrency = useCallback(
    (value: string) => {
      if (value) {
        mutate(value, { revalidate: false })
      }
    },
    [mutate]
  )

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, hasFetchedCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
