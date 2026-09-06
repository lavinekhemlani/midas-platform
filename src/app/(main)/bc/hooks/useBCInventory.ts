'use client'

import useSWR from 'swr'
import { apiClient } from '@/lib/apiClient'

interface BCItem {
  id: string
  number: string
  displayName: string
  type: string
  itemCategoryCode?: string
  inventory: number
  unitPrice: number
  unitCost: number
  blocked: boolean
}

interface BCInventorySummary {
  totalItems: number
  totalInventoryValue: number
  totalUnits: number
  lowStockItems: number
  outOfStockItems: number
}

interface BCInventoryData {
  items: BCItem[]
  summary: BCInventorySummary
  companyName: string | null
}

const fetcher = async (url: string) => {
  const response = await apiClient(url)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error('Failed to fetch BC inventory')
  }
  return response.json()
}

export function useBCInventory(connectionId: string | null) {
  const params = new URLSearchParams()
  if (connectionId) params.set('connectionId', connectionId)
  const qs = params.toString()
  const url = connectionId ? `/api/providers/dynamics/inventory${qs ? `?${qs}` : ''}` : null

  const { data, isLoading, error, mutate } = useSWR(
    url ? ['bc-inventory', url] : null,
    () => fetcher(url!),
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false, errorRetryCount: 3 }
  )

  const d: BCInventoryData | null = data?.data ?? null

  return {
    items: d?.items ?? [],
    summary: d?.summary ?? null,
    companyName: d?.companyName ?? null,
    isLoading,
    error,
    mutate,
  }
}
