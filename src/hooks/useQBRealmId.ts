// src/hooks/useQBRealmId.ts
// Reads ?realmId from URL search params for multi-entity QB routing
'use client'

import { useSearchParams } from 'next/navigation'

/**
 * Returns the QB realmId from URL search params (?realmId=xxx).
 * Used by QB data hooks to target a specific entity's data.
 * Returns undefined if no realmId in URL (uses org's active realm).
 */
export function useQBRealmId(): string | undefined {
  const searchParams = useSearchParams()
  return searchParams.get('realmId') || undefined
}

/**
 * Appends realmId to a URLSearchParams instance if provided.
 * Shared utility for QB data hooks.
 */
export function appendRealmId(params: URLSearchParams, realmId?: string): void {
  if (realmId) {
    params.append('realmId', realmId)
  }
}
