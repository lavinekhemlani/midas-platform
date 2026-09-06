'use client'

import { useMemo } from 'react'
import { useSession } from '@/hooks/useSession'

export interface UseShopifyConnectionResult {
  connected: boolean
  isLoading: boolean
}

export function useShopifyConnection(): UseShopifyConnectionResult {
  const { organization, status } = useSession()

  const connected = useMemo(() => {
    const shopify = (organization?.providers as any)?.shopify
    if (!shopify) return false

    // Multi-store: check connections map
    if (shopify.connections) {
      return Object.values(shopify.connections).some((c: any) => c?.credentials?.connected)
    }

    // Legacy: single credentials
    return !!shopify?.credentials?.connected
  }, [organization])

  return {
    connected,
    isLoading: status === 'loading',
  }
}
