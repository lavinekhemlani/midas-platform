'use client'

import React from 'react'
import IntegrationsContainer, { IntegrationsContainerProps } from './IntegrationsContainer'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export interface ProviderIntegrationManagerProps
  extends Omit<IntegrationsContainerProps, 'connectedProvidersMap'> {
  /** Map of ALL connected providers for multi-provider support */
  connectedProvidersMap?: Record<string, { organizationName: string | null }>
  /**
   * Environment context - determines styling and behavior
   * 'onboarding': Clean, guided experience for new users
   * 'settings': Full-featured management for existing users
   * 'dashboard': Inline prompt for connection issues
   */
  environment?: 'onboarding' | 'settings' | 'dashboard'

  /**
   * Optional title and description overrides
   */
  title?: string
  description?: string

  /**
   * Additional CSS classes for wrapper
   */
  className?: string

  /**
   * Show header icon for dashboard environment
   */
  showIcon?: boolean

  /**
   * Custom error message to display
   */
  errorMessage?: string | null
}

/**
 * Unified provider integration component that adapts to different environments
 * This wraps IntegrationsContainer to provide consistent behavior across:
 * - Onboarding flow
 * - Settings page
 * - Dashboard connection prompts
 */
export default function ProviderIntegrationManager({
  environment = 'settings',
  title,
  description,
  className,
  showIcon = true,
  errorMessage,
  connectedProvidersMap,
  ...integrationProps
}: ProviderIntegrationManagerProps) {
  // Determine environment-specific defaults
  const getEnvironmentConfig = () => {
    switch (environment) {
      case 'onboarding':
        return {
          defaultTitle: 'Connect Your Books',
          defaultDescription:
            'Connect your accounting software to sync financial data automatically',
          wrapperClass: 'onboarding-integration-wrapper',
          showNavigation: integrationProps.showNavigation ?? true,
          showHeader: true,
        }

      case 'dashboard':
        return {
          defaultTitle: 'Add a Provider',
          defaultDescription: 'Please connect your accounting software to view financial data',
          wrapperClass: 'dashboard-integration-wrapper',
          showNavigation: integrationProps.showNavigation ?? false,
          showHeader: true,
        }

      case 'settings':
      default:
        return {
          defaultTitle: 'Integrations',
          defaultDescription: 'Manage your accounting software connections',
          wrapperClass: 'settings-integration-wrapper',
          showNavigation: integrationProps.showNavigation ?? false,
          showHeader: false,
        }
    }
  }

  const config = getEnvironmentConfig()
  const displayTitle = title || config.defaultTitle
  const displayDescription = description || config.defaultDescription

  return (
    <div className={cn('provider-integration-manager', config.wrapperClass, className)}>
      {/* Header */}
      {config.showHeader && (
        <div className={cn('mb-6', environment === 'dashboard' && 'text-center')}>
          {/* Icon for dashboard environment */}
          {environment === 'dashboard' && showIcon && (
            <div className="inline-flex p-3 bg-amber-500/10 rounded-full mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          )}

          <h2
            className={cn(
              'font-bold theme-text-primary mb-2',
              environment === 'onboarding'
                ? 'text-2xl md:text-3xl onboarding-heading-serif'
                : environment === 'dashboard'
                  ? 'text-2xl'
                  : 'text-lg'
            )}
          >
            {displayTitle}
          </h2>
          <p
            className={cn(
              'theme-text-secondary',
              environment === 'onboarding' ? 'text-sm onboarding-subtext-serif' : 'text-sm'
            )}
          >
            {displayDescription}
          </p>

          {/* Error message if provided */}
          {errorMessage && <p className="text-sm text-red-500 mt-2">{errorMessage}</p>}
        </div>
      )}

      {/* Integration Container - Core functionality */}
      <IntegrationsContainer
        {...integrationProps}
        connectedProvidersMap={connectedProvidersMap}
        showNavigation={config.showNavigation}
        apiError={integrationProps.apiError || errorMessage}
        environment={environment}
      />

      {/* Environment-specific footer content */}
      {environment === 'onboarding' && (
        <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-xs theme-text-secondary text-center">
            You can change your provider settings anytime from your account settings
          </p>
        </div>
      )}

      {environment === 'dashboard' && (
        <div className="mt-6">
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <p className="text-sm theme-text-secondary text-center">
              <strong className="text-amber-500">Need help?</strong> Make sure you're logged into
              your accounting software and have the necessary permissions to authorize the
              connection.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
