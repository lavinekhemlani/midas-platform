'use client'

import React, { useState, useCallback, useMemo } from 'react'
import ProviderIntegrationManager from '@/components/integrations/ProviderIntegrationManager'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useSession } from '@/hooks/useSession'
import type { ProviderID } from '@/lib/providers/database'

export default function IntegrationsSettings() {
  const { organization, refetchSession } = useSession()
  const [showIntegrationPicker, setShowIntegrationPicker] = useState(false)

  // Build a map of ALL connected providers (multi-provider support)
  const connectedProvidersMap = useMemo(() => {
    const map: Record<string, { organizationName: string | null }> = {}

    if (!organization?.providers) {
      return map
    }

    for (const [providerId, providerInfo] of Object.entries(organization.providers)) {
      // Multi-entity QB: check connections map first
      if (providerId === 'quickbooks' && (providerInfo as any)?.connections) {
        const connections = Object.values((providerInfo as any).connections || {})
        const connectedEntities = connections.filter(
          (c: any) => c?.credentials?.connected
        )
        if (connectedEntities.length > 0) {
          const displayName = connectedEntities
            .map((c: any) => c?.credentials?.company_name)
            .filter(Boolean)
            .join(', ')
          map[providerId] = { organizationName: displayName || null }
          continue
        }
      }

      if ((providerInfo as any)?.credentials?.connected) {
        // For Dynamics BC: display connected schema names from the schemas array
        const schemas = (providerInfo as any)?.credentials?.schemas
        const displayName = schemas?.length
          ? schemas.map((s: any) => s.company_name).join(', ')
          : (providerInfo as any)?.credentials?.company_name ||
            (providerInfo as any)?.credentials?.provider_organization_id ||
            (providerInfo as any)?.credentials?.realm_id ||
            (providerInfo as any)?.credentials?.organization_id ||
            null

        map[providerId] = {
          organizationName: displayName,
        }
      }
    }

    return map
  }, [organization])

  // For backward compatibility, also provide initial status for the first connected provider
  const initialProviderStatus = useMemo(() => {
    const connectedIds = Object.keys(connectedProvidersMap)
    if (connectedIds.length === 0) {
      return { connected: false }
    }

    const firstProvider = connectedIds[0]
    return {
      connected: true,
      providerName: firstProvider,
      organizationName: connectedProvidersMap[firstProvider]?.organizationName,
    }
  }, [connectedProvidersMap])

  const handleConnectionChange = useCallback(
    async (connected: boolean, provider: ProviderID | null) => {
      // In settings mode, we don't need to refetch session on connection change
      // The connection status is already reflected in the organization data
      // Refetching causes an infinite loop
    },
    []
  )

  const handleRefreshStatus = useCallback(async () => {
    await refetchSession()
  }, [refetchSession])

  return (
    <>
      <ProviderIntegrationManager
        environment="settings"
        initialProviderStatus={initialProviderStatus}
        connectedProvidersMap={connectedProvidersMap}
        onConnectionChange={handleConnectionChange}
        onRefreshStatus={handleRefreshStatus}
        showNavigation={false}
        isLoading={false}
        onRequestAddIntegration={() => setShowIntegrationPicker(true)}
      />

      {/* Add Integration Modal — matches dashboard popup */}
      <Dialog open={showIntegrationPicker} onOpenChange={setShowIntegrationPicker}>
        <DialogContent className="sm:max-w-5xl">
          <div className="integration-modal rounded-2xl border border-amber-500/15 bg-[var(--theme-bg)] p-6 shadow-2xl">
            <div className="mb-6">
              <DialogTitle className="text-base font-medium theme-text-primary">
                Connect a Provider
              </DialogTitle>
              <DialogDescription className="text-xs theme-text-secondary mt-1 opacity-70">
                Choose your accounting or ERP platform to get started
              </DialogDescription>
            </div>
            <ProviderIntegrationManager
              environment="dashboard"
              showIcon={false}
              title=""
              description=""
              initialProviderStatus={initialProviderStatus}
              connectedProvidersMap={connectedProvidersMap}
              onConnectionChange={handleConnectionChange}
              onRefreshStatus={handleRefreshStatus}
              showNavigation={false}
              isLoading={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
