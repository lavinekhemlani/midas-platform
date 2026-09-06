'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Hub } from 'aws-amplify/utils'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { Authenticator } from '@aws-amplify/ui-react'
import { SessionContext, SessionState } from '@/contexts/SessionContext'
import { User } from '@/lib/data'
import { apiClient } from '@/lib/apiClient'
import { AuthCookies } from '@/lib/auth'
import { ProviderID } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: 'loading',
    user: null,
    organization: null,
    activeProvider: null,
    connectedProviders: [],
    requiresProviderConnection: false,
    error: null,
    isSigningOut: false,
  })

  // Track fetch state to prevent simultaneous fetches
  const fetchInProgress = useRef(false)

  // Helper function to get all connected providers from organization data
  const getAllConnectedProviders = useCallback((organization: any): ProviderID[] => {
    if (!organization?.providers) {
      console.log('[SessionProvider] getAllConnectedProviders: no providers on organization')
      return []
    }

    const connected: ProviderID[] = []
    for (const [providerId, providerData] of Object.entries(organization.providers)) {
      if (!providerData || typeof providerData !== 'object') continue

      // Multi-entity QB: check connections map for any connected entity
      if (providerId === 'quickbooks' && (providerData as any).connections) {
        const connections = (providerData as any).connections
        const connectionKeys = Object.keys(connections)
        const connectedEntities = Object.entries(connections).filter(
          ([, conn]: [string, any]) => conn?.credentials?.connected === true
        )
        console.log('[SessionProvider] QB multi-entity check:', {
          connectionCount: connectionKeys.length,
          connectionRealmIds: connectionKeys,
          connectedCount: connectedEntities.length,
          activeRealmId: (providerData as any).activeRealmId,
          hasLegacyCredentials: !!(providerData as any).credentials,
          legacyConnected: (providerData as any).credentials?.connected,
        })
        if (connectedEntities.length > 0) {
          connected.push(providerId as ProviderID)
          continue
        }
      }

      // Dynamics BC: check BOTH OAuth connections AND warehouse credentials
      // Both can coexist - OAuth for direct API, warehouse for Fivetran-synced data
      if (providerId === 'dynamics') {
        const pData = providerData as any
        const oauthConns = pData.oauthConnections
        const oauthKeys = oauthConns ? Object.keys(oauthConns) : []
        const connectedOAuth = oauthConns
          ? Object.entries(oauthConns).filter(
              ([key, conn]: [string, any]) =>
                key !== '_pending_oauth' && conn?.credentials?.connected === true
            )
          : []
        const hasWarehouseConnected = pData.credentials?.connected === true

        console.log('[SessionProvider] dynamics connection check:', {
          oauthKeys,
          oauthConnectedCount: connectedOAuth.length,
          oauthConnectedIds: connectedOAuth.map(([k]) => k),
          hasWarehouseConnected,
          warehouseSchemas: pData.credentials?.schemas?.length || 0,
        })

        // Provider is connected if EITHER OAuth OR warehouse (or both) is connected
        if (connectedOAuth.length > 0 || hasWarehouseConnected) {
          connected.push(providerId as ProviderID)
          continue
        }
      }

      // Legacy / other providers: check credentials.connected
      if ('credentials' in providerData && (providerData as any).credentials?.connected === true) {
        connected.push(providerId as ProviderID)
      }
    }

    console.log('[SessionProvider] getAllConnectedProviders result:', connected)
    return connected
  }, [])

  // Helper function to determine active provider from organization data
  const determineActiveProvider = useCallback(
    (organization: any): ProviderID | null => {
      const connected = getAllConnectedProviders(organization)
      return connected.length > 0 ? connected[0] : null
    },
    [getAllConnectedProviders]
  )

  const fetchAndSetSession = useCallback(async () => {
    // Prevent multiple simultaneous fetches (simple deduplication)
    if (fetchInProgress.current) {
      logger.debug('Session fetch already in progress, skipping', { component: 'SessionProvider' })
      return
    }

    logger.debug('Starting session initialization...', { component: 'SessionProvider' })
    fetchInProgress.current = true

    setSession({
      status: 'loading',
      user: null,
      organization: null,
      activeProvider: null,
      connectedProviders: [],
      requiresProviderConnection: false,
      error: null,
      isSigningOut: false,
    })

    // Add timeout protection to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      logger.error('Session initialization timed out after 10 seconds', {
        component: 'SessionProvider',
      })
      setSession({
        status: 'unauthenticated',
        user: null,
        organization: null,
        activeProvider: null,
        connectedProviders: [],
        requiresProviderConnection: false,
        error: 'Session initialization timed out. Please refresh the page.',
        isSigningOut: false,
      })
      fetchInProgress.current = false
    }, 10000) // 10 second timeout

    try {
      const authSession = await fetchAuthSession()
      clearTimeout(timeoutId)

      if (!authSession.tokens) {
        logger.debug('No tokens found, user is unauthenticated', { component: 'SessionProvider' })
        AuthCookies.clear()
        setSession({
          status: 'unauthenticated',
          user: null,
          organization: null,
          activeProvider: null,
          connectedProviders: [],
          requiresProviderConnection: false,
          error: null,
          isSigningOut: false,
        })
        fetchInProgress.current = false
        return
      }

      await AuthCookies.set()

      const response = await apiClient('/api/users/me/profile')
      if (!response.ok) {
        throw new Error('Failed to fetch user profile.')
      }

      const profileData = await response.json()

      // Extract organization from profile data
      const { organization, ...userData } = profileData

      // Determine connected providers and active provider
      const connectedProviders = getAllConnectedProviders(organization)
      const activeProvider = connectedProviders.length > 0 ? connectedProviders[0] : null

      // Compute onboarding status for logging
      const hasAcceptedTerms = userData.terms_accepted === true
      const completedSteps = userData.onboarding_audit?.completed_steps || []
      // Onboarding is required only if user hasn't accepted terms
      // Provider connectivity is handled separately via requiresProviderConnection
      const onboardingRequired = !hasAcceptedTerms

      logger.info('Session loaded successfully', {
        component: 'SessionProvider',
        userId: userData.user_id,
        email: userData.email,
        hasAcceptedTerms,
        completedSteps: completedSteps.length,
        activeProvider,
        connectedProviders,
        onboardingRequired,
        requiresProviderConnection: connectedProviders.length === 0,
      })

      setSession({
        status: 'authenticated',
        user: userData,
        organization: organization || null,
        activeProvider,
        connectedProviders,
        requiresProviderConnection: connectedProviders.length === 0,
        error: null,
        isSigningOut: false,
      })
    } catch (error) {
      clearTimeout(timeoutId)
      logger.error('Session initialization failed:', { error, component: 'SessionProvider' })
      AuthCookies.clear()
      setSession({
        status: 'unauthenticated',
        user: null,
        organization: null,
        activeProvider: null,
        connectedProviders: [],
        requiresProviderConnection: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred.',
        isSigningOut: false,
      })
    } finally {
      fetchInProgress.current = false
    }
  }, [getAllConnectedProviders])

  useEffect(() => {
    fetchAndSetSession()

    const hubListener = (data: any) => {
      switch (data.payload.event) {
        case 'signedIn':
          logger.debug('Hub event: signedIn - refetching session', { component: 'SessionProvider' })
          fetchAndSetSession()
          break
        case 'signedOut':
          logger.debug('Hub event: signedOut - clearing session', { component: 'SessionProvider' })
          AuthCookies.clear()
          setSession({
            status: 'unauthenticated',
            user: null,
            organization: null,
            activeProvider: null,
            connectedProviders: [],
            requiresProviderConnection: false,
            error: null,
            isSigningOut: false, // Reset after sign-out complete
          })
          break
        case 'tokenRefresh':
          logger.debug('Hub event: tokenRefresh - updating cookies', {
            component: 'SessionProvider',
          })
          AuthCookies.set()
          break
      }
    }

    const unsubscribe = Hub.listen('auth', hubListener)
    return () => unsubscribe()
  }, [fetchAndSetSession])

  const updateUserProfile = useCallback((data: Partial<User>) => {
    setSession((prev) => {
      if (!prev.user) return prev
      const updatedUser = { ...prev.user, ...data }
      logger.debug('Updating user profile', {
        component: 'SessionProvider',
        userId: updatedUser.user_id,
        updatedFields: Object.keys(data),
        termsAccepted: updatedUser.terms_accepted,
      })
      return { ...prev, user: updatedUser }
    })
  }, [])

  // Switch to a different organization (for multi-org users)
  const switchOrganization = useCallback(
    async (organizationId: string): Promise<boolean> => {
      logger.info('Switching organization', { component: 'SessionProvider', organizationId })

      try {
        const response = await apiClient('/api/organizations/switch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          logger.error('Failed to switch organization', {
            component: 'SessionProvider',
            organizationId,
            error: errorData.error || response.statusText,
          })
          return false
        }

        const data = await response.json()
        logger.info('Organization switched successfully', {
          component: 'SessionProvider',
          organizationId,
          organizationName: data.activeOrganization?.name,
        })

        // Refetch session to update organization context
        await fetchAndSetSession()
        return true
      } catch (error) {
        logger.error('Error switching organization:', { error, component: 'SessionProvider' })
        return false
      }
    },
    [fetchAndSetSession]
  )

  const handleSignOut = useCallback(async () => {
    logger.info('Sign-out initiated', { component: 'SessionProvider' })

    // Set signing out flag to prevent new API calls
    setSession((prev) => ({ ...prev, isSigningOut: true }))

    try {
      // Clear cookies first
      AuthCookies.clear()
      logger.debug('Cookies cleared', { component: 'SessionProvider' })

      // Clear localStorage and sessionStorage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        logger.debug('Local storage cleared', { component: 'SessionProvider' })
      }

      // Sign out from Amplify (this will trigger the Hub event)
      await signOut({ global: true })
      logger.info('Amplify sign-out complete', { component: 'SessionProvider' })
    } catch (error) {
      logger.error('Sign-out error:', { error, component: 'SessionProvider' })
      // Even if sign-out fails, ensure cleanup
      AuthCookies.clear()
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      // Set to unauthenticated state
      setSession({
        status: 'unauthenticated',
        user: null,
        organization: null,
        activeProvider: null,
        connectedProviders: [],
        requiresProviderConnection: false,
        error: null,
        isSigningOut: false,
      })
      throw error
    }
  }, [])

  // Memoize context value to prevent unnecessary re-renders and infinite loops
  // Include all values in dependency array for clarity (callbacks are stable)
  const contextValue = useMemo(() => {
    // Add computed onboarding flags for easier consumption
    const hasAcceptedTerms = session.user?.terms_accepted === true
    const onboardingAudit = session.user?.onboarding_audit
    const completedSteps = onboardingAudit?.completed_steps || []

    // Determine if onboarding is required
    // Onboarding is required only if user hasn't accepted terms
    // Provider connectivity is handled separately via requiresProviderConnection
    const onboardingRequired = !hasAcceptedTerms

    return {
      ...session,
      refetchSession: fetchAndSetSession,
      updateUserProfile,
      signOut: handleSignOut,
      switchOrganization,
      // Convenience flags for onboarding status
      onboardingRequired,
      hasAcceptedTerms,
    }
  }, [session, fetchAndSetSession, updateUserProfile, handleSignOut, switchOrganization])

  return (
    <Authenticator.Provider>
      <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>
    </Authenticator.Provider>
  )
}
