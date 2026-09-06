'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Organization, User } from '@/lib/data'
import { useSession } from '@/hooks/useSession'
import { apiClient } from '@/lib/apiClient'
import { fetchUserAttributes } from 'aws-amplify/auth'
import { getActiveProvider } from '@/lib/providers/active-provider-client'
import { ProviderID } from '@/lib/providers'

import SetupStep from '@/components/onboarding/SetupStep'
import ConnectStep from '@/components/onboarding/ConnectStep'
import { trackSignupComplete } from '@/lib/analytics/gtm'
import { Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const {
    user: userProfile,
    organization,
    status,
    updateUserProfile,
    refetchSession,
  } = useSession()
  const router = useRouter()
  const params = useParams()
  const [userAttributes, setUserAttributes] = useState<any>(null)
  const [activeProvider, setActiveProvider] = useState<ProviderID | null>(null)
  const [isSavingStep, setIsSavingStep] = useState(false)
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(false)

  // Use a ref to track if we've already loaded data to prevent double-fetches
  const hasLoadedDataRef = useRef(false)

  const isLoaded = status !== 'loading'
  const pathStep = Array.isArray(params.step) ? params.step[0] : params.step || 'setup'
  const [stepApiError, setStepApiError] = useState<string | null>(null)

  // Load initial data for onboarding
  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      // Wait for authentication and user profile
      if (status !== 'authenticated' || !userProfile?.organization_id) {
        return
      }

      // Only load if we haven't loaded yet
      if (isLoadingInitialData || hasLoadedDataRef.current) {
        return
      }

      console.log(`[Onboarding] Loading initial data for step: ${pathStep}`)
      hasLoadedDataRef.current = true
      setIsLoadingInitialData(true)

      try {
        const attributes = await fetchUserAttributes()
        if (isMounted) {
          setUserAttributes(attributes)
        }

        const provider = await getActiveProvider()
        if (isMounted) {
          setActiveProvider(provider)
        }

        console.log('[Onboarding] Initial data loaded successfully:', {
          step: pathStep,
          provider,
          hasAttributes: !!attributes,
        })
      } catch (error) {
        console.error('[Onboarding] Error loading data:', error)
        hasLoadedDataRef.current = false
      } finally {
        // Always log completion, even if component unmounted
        console.log('[Onboarding] Data loading complete for step:', pathStep)
        if (isMounted) {
          setIsLoadingInitialData(false)
        }
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [status, userProfile?.organization_id, isLoadingInitialData, pathStep])

  const handleStepSave = async (stepId: string, data: any) => {
    console.log(`[Onboarding] Saving step: ${stepId}`)
    setStepApiError(null)
    setIsSavingStep(true)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      const response = await apiClient('/api/onboarding/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId, data }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const result = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          console.error('[Onboarding] Unauthorized, redirecting to home')
          router.push('/')
          return
        }
        throw new Error(result.message || result.error || 'Failed to save step.')
      }

      console.log(`[Onboarding] Step ${stepId} saved, next step: ${result.nextStepId}`)

      if (stepId === 'organization_details') {
        await refetchSession()
      } else if (result.user) {
        const updatedUser = {
          ...result.user,
          onboarding_audit: result.onboardingAudit || result.user.onboarding_audit,
        }
        updateUserProfile(updatedUser)
      }

      router.push(`/onboarding/${result.nextStepId}`)
    } catch (err) {
      console.error('[Onboarding] Step save failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'

      if (errorMessage.includes('aborted')) {
        setStepApiError('Request timed out. Please try again.')
      } else {
        setStepApiError(errorMessage)

        if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
          console.log('[Onboarding] Network error, retrying in 2s...')
          setTimeout(() => {
            handleStepSave(stepId, data)
          }, 2000)
        }
      }
    } finally {
      setIsSavingStep(false)
    }
  }

  const handleStepSkip = async (
    stepId: 'corp_profile_upload' | 'provider_connect' | 'manual_financials'
  ) => {
    console.log(`[Onboarding] Skipping step: ${stepId}`)
    setStepApiError(null)
    setIsSavingStep(true)

    try {
      const response = await apiClient('/api/onboarding/skip-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to skip step.')
      }

      console.log(`[Onboarding] Step ${stepId} skipped, next step: ${result.nextStepId}`)

      if (result.user) {
        const updatedUser = {
          ...result.user,
          onboarding_audit: result.onboardingAudit || result.user.onboarding_audit,
        }
        updateUserProfile(updatedUser)
      }

      router.push(`/onboarding/${result.nextStepId}`)
    } catch (err) {
      console.error('[Onboarding] Step skip failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'
      setStepApiError(errorMessage)

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.error('[Onboarding] Unauthorized, redirecting to sign-in')
        router.push('/sign-in')
      }
    } finally {
      setIsSavingStep(false)
    }
  }

  const handleCompletion = async (data: { acceptTerms: boolean }) => {
    console.log('[Onboarding] Completing onboarding flow...')
    setStepApiError(null)
    setIsSavingStep(true)

    try {
      const response = await apiClient('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to complete onboarding.')
      }

      console.log('[Onboarding] Onboarding completed successfully')

      // Track final signup completion
      if (userProfile?.user_id && userProfile?.organization_id) {
        trackSignupComplete(userProfile.user_id, userProfile.organization_id)
      }
    } catch (err) {
      console.error('[Onboarding] Completion failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.'
      setStepApiError(errorMessage)

      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.error('[Onboarding] Unauthorized, redirecting to sign-in')
        router.push('/sign-in')
        return
      }
      throw err
    } finally {
      setIsSavingStep(false)
    }
  }

  const onRefreshProviderStatus = useCallback(async (): Promise<any | null> => {
    if (!userProfile?.organization_id) return null

    try {
      // Fetch fresh data directly from the API instead of relying on stale context
      const response = await apiClient('/api/users/me/profile')
      if (!response.ok) {
        console.error('Failed to fetch updated profile')
        return null
      }

      const profileData = await response.json()
      const freshOrganization = profileData.organization

      // Also trigger the session refresh for other components
      refetchSession()

      // Get the active provider
      const provider = await getActiveProvider()
      setActiveProvider(provider)

      // Return the fresh provider info
      if (provider && freshOrganization?.providers?.[provider]) {
        return freshOrganization.providers[provider]
      }

      // Check for any connected provider if no active provider
      if (freshOrganization?.providers) {
        for (const [providerId, providerInfo] of Object.entries(freshOrganization.providers)) {
          // Multi-entity QB: check connections map
          if (providerId === 'quickbooks' && (providerInfo as any)?.connections) {
            const hasAnyConnected = Object.values((providerInfo as any).connections).some(
              (conn: any) => conn?.credentials?.connected
            )
            if (hasAnyConnected) return providerInfo
          }
          // BC OAuth: check oauthConnections map
          if (providerId === 'dynamics' && (providerInfo as any)?.oauthConnections) {
            const connectedOAuth = Object.entries((providerInfo as any).oauthConnections).filter(
              ([key, conn]: [string, any]) =>
                key !== '_pending_oauth' && conn?.credentials?.connected === true
            )
            if (connectedOAuth.length > 0) return providerInfo
          }
          if ((providerInfo as any)?.credentials?.connected) {
            return providerInfo
          }
        }
      }

      return null
    } catch (err) {
      console.error('Error refreshing provider status:', err)
    }
    return null
  }, [userProfile?.organization_id, refetchSession])

  const renderStepContent = () => {
    // Don't show error during loading or when navigating
    if (!userProfile) {
      if (status === 'loading' || isSavingStep) {
        // Return empty during transitions to prevent flash
        return null
      }

      // Only show error if we're truly unable to load the profile
      if (status === 'unauthenticated') {
        return (
          <div className="text-center p-8">
            <h2 className="text-xl font-bold text-red-600">Authentication Required</h2>
            <p className="theme-text-secondary mt-2">Please sign in to continue with onboarding.</p>
            <button
              onClick={() => (window.location.href = '/')}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Sign In
            </button>
          </div>
        )
      }

      // Final fallback for actual errors
      return (
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600">Profile Loading Error</h2>
          <p className="theme-text-secondary mt-2">
            Unable to load user profile. Please refresh the page or contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600"
          >
            Refresh Page
          </button>
        </div>
      )
    }

    if (!userProfile.onboarding_audit) {
      userProfile.onboarding_audit = {
        current_step: 'setup',
        completed_steps: [],
        skipped_steps: [],
        step_data: {},
        started_at: Date.now(),
        completed_at: null,
      }
    }

    switch (pathStep) {
      case 'setup':
        return (
          <SetupStep
            onNext={(data) => handleStepSave('setup', data)}
            isLoading={isSavingStep}
            initialData={userProfile.onboarding_audit}
            initialFirstName={userAttributes?.given_name || userProfile.first_name || ''}
            apiError={stepApiError}
          />
        )

      case 'connect':
        // Build a map of ALL connected providers (multi-provider support)
        const connectedProvidersMap: Record<string, { organizationName: string | null }> = {}
        let firstConnectedProviderInfo = null
        let firstConnectedProviderId = null

        if (organization?.providers) {
          for (const [providerId, providerInfo] of Object.entries(organization.providers)) {
            // Multi-entity QB: check connections map first
            if (providerId === 'quickbooks' && (providerInfo as any)?.connections) {
              const connections = Object.values((providerInfo as any).connections || {})
              const connectedEntities = connections.filter((c: any) => c?.credentials?.connected)
              if (connectedEntities.length > 0) {
                const displayName = connectedEntities
                  .map((c: any) => c?.credentials?.company_name)
                  .filter(Boolean)
                  .join(', ')
                connectedProvidersMap[providerId] = { organizationName: displayName || null }
                if (!firstConnectedProviderInfo) {
                  firstConnectedProviderInfo = providerInfo
                  firstConnectedProviderId = providerId
                }
                continue
              }
            }

            // BC OAuth: check oauthConnections map
            if (providerId === 'dynamics' && (providerInfo as any)?.oauthConnections) {
              const connectedOAuth = Object.entries((providerInfo as any).oauthConnections).filter(
                ([key, conn]: [string, any]) =>
                  key !== '_pending_oauth' && conn?.credentials?.connected === true
              )
              if (connectedOAuth.length > 0) {
                const displayName = connectedOAuth
                  .map(([, conn]: [string, any]) => conn?.credentials?.company_name)
                  .filter(Boolean)
                  .join(', ')
                connectedProvidersMap[providerId] = { organizationName: displayName || null }
                if (!firstConnectedProviderInfo) {
                  firstConnectedProviderInfo = providerInfo
                  firstConnectedProviderId = providerId
                }
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

              connectedProvidersMap[providerId] = {
                organizationName: displayName,
              }

              // Track first connected provider for backward compatibility
              if (!firstConnectedProviderInfo) {
                firstConnectedProviderInfo = providerInfo
                firstConnectedProviderId = providerId
              }
            }
          }
        }

        const providerCreds = activeProvider
          ? organization?.providers?.[activeProvider]
          : firstConnectedProviderInfo
        const effectiveProvider = activeProvider || firstConnectedProviderId

        return (
          <ConnectStep
            onComplete={handleCompletion}
            isLoading={isSavingStep}
            initialProviderStatus={{
              connected: Object.keys(connectedProvidersMap).length > 0,
              providerName: effectiveProvider || undefined,
              organizationName:
                connectedProvidersMap[effectiveProvider || '']?.organizationName ||
                (providerCreds as any)?.credentials?.provider_organization_id ||
                (providerCreds as any)?.credentials?.realm_id ||
                (providerCreds as any)?.credentials?.organization_id,
            }}
            connectedProvidersMap={connectedProvidersMap}
            onRefreshStatus={onRefreshProviderStatus}
            apiError={stepApiError}
          />
        )

      default:
        return (
          <div className="text-center">
            <h2 className="text-xl font-bold">Unknown Step</h2>
            <p className="theme-text-secondary mt-2">
              The requested onboarding step could not be found.
            </p>
          </div>
        )
    }
  }

  return <>{renderStepContent()}</>
}
