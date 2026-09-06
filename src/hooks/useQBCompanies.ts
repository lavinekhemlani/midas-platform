// src/hooks/useQBCompanies.ts
// SWR-based hook for managing multi-entity QuickBooks connections

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'
import { useCallback } from 'react'
import type { QBConnectionSummary } from '@/lib/providers/database'

interface QBConnectionsResponse {
  activeRealmId: string | null
  connections: QBConnectionSummary[]
}

interface DisconnectResult {
  success: boolean
  newActiveRealmId: string | null
  remainingCount: number
}

interface SwitchActiveResult {
  success: boolean
  activeRealmId: string
  companyName: string | null
}

const fetcher = async (url: string): Promise<QBConnectionsResponse> => {
  const res = await apiClient(url)
  if (!res.ok) throw new Error('Failed to fetch QB connections')
  return res.json()
}

export function useQBCompanies() {
  const { data, error, isLoading, mutate } = useSWR<QBConnectionsResponse>(
    '/api/providers/quickbooks/connections',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  const connections = data?.connections ?? []
  const activeRealmId = data?.activeRealmId ?? null
  const connectedCount = connections.filter((c) => c.connected).length
  const issueCount = connections.filter((c) => !c.connected).length

  const switchActive = useCallback(
    async (realmId: string): Promise<SwitchActiveResult> => {
      const res = await apiClient('/api/providers/quickbooks/active-company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realmId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to switch active company')
      }
      const result = await res.json()
      await mutate()
      return result
    },
    [mutate]
  )

  const disconnect = useCallback(
    async (realmId: string): Promise<DisconnectResult> => {
      const res = await apiClient(
        `/api/providers/quickbooks/connections?realmId=${encodeURIComponent(realmId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to disconnect company')
      }
      const result = await res.json()
      await mutate()
      return result
    },
    [mutate]
  )

  return {
    connections,
    activeRealmId,
    connectedCount,
    issueCount,
    isLoading,
    error,
    switchActive,
    disconnect,
    refresh: mutate,
  }
}
