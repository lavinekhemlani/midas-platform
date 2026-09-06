'use client'

import { useSession } from '@/hooks/useSession'

/**
 * Hook to check if PII (Personally Identifiable Information) protection mode is enabled.
 * When enabled, sensitive data like company names should be blurred.
 */
export function usePIIMode(): boolean {
  const { user } = useSession()
  return user?.preferences?.pii_mode ?? false
}
