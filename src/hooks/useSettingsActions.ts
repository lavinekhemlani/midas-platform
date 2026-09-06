// src/hooks/useSettingsActions.ts
// Hook for executing settings actions triggered from chat via ui_action tool

'use client'

import { useEffect, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { apiClient } from '@/lib/apiClient'
import type { SettingsActionEvent } from '@/hooks/useUIActions'

export function useSettingsActions() {
  const { user, organization, refetchSession } = useSession()

  const handleSettingsAction = useCallback(
    async (event: Event) => {
      const { setting, value } = (event as SettingsActionEvent).detail

      try {
        switch (setting) {
          case 'pii_mode': {
            const response = await apiClient('/api/users/me/profile', {
              method: 'PUT',
              body: JSON.stringify({
                preferences: {
                  ...user?.preferences,
                  pii_mode: value as boolean,
                },
              }),
            })
            if (!response.ok) throw new Error('Failed to update PII mode')
            break
          }

          case 'proficiency_level': {
            const response = await apiClient('/api/users/me/profile', {
              method: 'PUT',
              body: JSON.stringify({
                preferences: {
                  ...user?.preferences,
                  proficiency_level: value as string,
                },
              }),
            })
            if (!response.ok) throw new Error('Failed to update proficiency level')
            break
          }

          case 'revenue_model': {
            if (!organization?.organization_id) {
              console.error('[useSettingsActions] No organization ID available')
              return
            }
            const response = await apiClient(`/api/organizations/${organization.organization_id}`, {
              method: 'PUT',
              body: JSON.stringify({
                organizationData: {
                  revenue_model: value as string,
                },
              }),
            })
            if (!response.ok) throw new Error('Failed to update revenue model')
            break
          }
        }

        await refetchSession()
      } catch (error) {
        console.error('[useSettingsActions] Failed to apply setting:', error)
      }
    },
    [user, organization, refetchSession]
  )

  useEffect(() => {
    window.addEventListener('ui-action:settings', handleSettingsAction)
    return () => {
      window.removeEventListener('ui-action:settings', handleSettingsAction)
    }
  }, [handleSettingsAction])
}
