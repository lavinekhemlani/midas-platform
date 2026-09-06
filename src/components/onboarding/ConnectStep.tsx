// src/components/onboarding/ConnectStep.tsx
'use client'

import React, { useState } from 'react'
import ProviderIntegrationManager from '@/components/integrations/ProviderIntegrationManager'
import type { ProviderID } from '@/lib/providers/database'
import { Loader2 } from 'lucide-react'

interface ConnectStepProps {
  onComplete: (data: { acceptTerms: boolean }) => Promise<void>
  isLoading: boolean
  initialProviderStatus?: {
    connected: boolean
    providerName?: string
    organizationName?: string | null
  }
  /** Map of ALL connected providers for multi-provider support */
  connectedProvidersMap?: Record<string, { organizationName: string | null }>
  onRefreshStatus: () => Promise<void>
  apiError?: string | null
}

export default function ConnectStep({
  onComplete,
  isLoading: parentIsLoading,
  initialProviderStatus,
  connectedProvidersMap,
  onRefreshStatus,
  apiError,
}: ConnectStepProps) {
  // Check if any provider is connected (either from map or initial status)
  const hasConnectedProvider = connectedProvidersMap
    ? Object.keys(connectedProvidersMap).length > 0
    : initialProviderStatus?.connected || false
  const [isConnected, setIsConnected] = useState(hasConnectedProvider)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)

  const isLoading = parentIsLoading || isFinishing

  const handleConnectionChange = (connected: boolean, provider: ProviderID | null) => {
    setIsConnected(connected)
  }

  const handleFinish = async () => {
    if (!isConnected) {
      setError('Please connect your accounting provider to continue.')
      return
    }

    if (!acceptTerms) {
      setError('Please accept the terms and conditions to continue.')
      return
    }

    setError(null)
    setIsFinishing(true)

    // @ts-ignore - Set bypass flag for unsaved changes warning
    window.bypassUnsavedChangesWarning = true

    try {
      await onComplete({ acceptTerms })
      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
      setIsFinishing(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] md:min-h-[calc(100vh-100px)] flex flex-col justify-center w-full max-w-2xl mx-auto py-6 px-2">
      {/* Friendly Greeting */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-light theme-text-primary mb-2">Almost there</h1>
        <p className="text-sm theme-text-primary">Link your accounting software to get started</p>
      </div>

      {(error || apiError) && (
        <div className="mb-6 p-3 bg-red-500/10 text-red-400 rounded-md text-sm border border-red-500/30">
          {error || apiError}
        </div>
      )}

      {/* Provider Integration */}
      <div className="mb-8">
        <ProviderIntegrationManager
          environment="onboarding"
          initialProviderStatus={initialProviderStatus}
          connectedProvidersMap={connectedProvidersMap}
          onConnectionChange={handleConnectionChange}
          onRefreshStatus={onRefreshStatus}
          showNavigation={false}
          isLoading={false}
        />
      </div>

      {/* Terms Checkbox - Simple */}
      <div className="mb-8">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-4 h-4 accent-amber-500"
          />
          <span className="text-sm theme-text-secondary">
            I agree to the{' '}
            <a href="/terms" target="_blank" className="text-amber-500 hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" className="text-amber-500 hover:underline">
              Privacy Policy
            </a>
          </span>
        </label>
      </div>

      {/* Complete Button */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handleFinish}
          disabled={isLoading || !isConnected || !acceptTerms}
          data-onboarding-complete="true"
          className={`glass-next-button glass-next-button-primary w-full text-base py-3 rounded-lg flex items-center justify-center group font-medium ${
            !isConnected || !acceptTerms ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isFinishing ? 'Setting up your dashboard...' : 'Saving'}
            </>
          ) : (
            <>
              Get Started
              <span className="ml-2 transform transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
