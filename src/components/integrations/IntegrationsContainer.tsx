'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
  Building,
  CreditCard,
  Search,
  Check,
  Clock,
  ArrowUpRight,
  Plus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { apiClient } from '@/lib/apiClient'
import type { ProviderID } from '@/lib/providers/database'
import { isProviderSupported } from '@/lib/providers'
import { useSession } from '@/hooks/useSession'
import { trackProviderConnected } from '@/lib/analytics/gtm'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/contexts/CurrencyContext'
import { getCurrencyInfo } from '@/lib/utils/currency'
import DynamicsCredentialsModal from './DynamicsCredentialsModal'
import ShopifyStoreModal from './ShopifyStoreModal'

type ConnectionStatus = 'checking' | 'connected' | 'warning' | 'error'
type AuthType = 'oauth' | 'faux_credentials' | 'dual'

interface ProviderDataSummary {
  organizations?: number
  invoices?: number
  expenses?: number
  items?: number
  contacts?: number
}

export interface IntegrationsContainerProps {
  initialProviderStatus?: {
    connected: boolean
    providerName?: string
    organizationName?: string | null
  }
  /** Map of ALL connected providers for multi-provider support */
  connectedProvidersMap?: Record<string, { organizationName: string | null }>
  onConnectionChange?: (connected: boolean, provider: ProviderID | null) => void
  onRefreshStatus?: () => Promise<void>
  showNavigation?: boolean
  onNext?: () => void
  isLoading?: boolean
  apiError?: string | null
  environment?: 'onboarding' | 'settings' | 'dashboard'
  /** Callback when user wants to add an integration (used by settings dialog mode) */
  onRequestAddIntegration?: () => void
}

// Logo data with brand colors for fallbacks
const logoData: Record<string, { color: string; letter: string }> = {
  quickbooks: { color: '#2CA01C', letter: 'Q' },
  xero: { color: '#13B5EA', letter: 'X' },
  stripe: { color: '#635BFF', letter: 'S' },
  shopify: { color: '#7AB55C', letter: 'S' },
  salesforce: { color: '#00A1E0', letter: 'S' },
  hubspot: { color: '#FF7A59', letter: 'H' },
  paypal: { color: '#003087', letter: 'P' },
  square: { color: '#3E4348', letter: 'S' },
  mailchimp: { color: '#FFE01B', letter: 'M' },
  zoho: { color: '#E42527', letter: 'Z' },
  sap: { color: '#0FAAFF', letter: 'S' },
  oracle: { color: '#F80000', letter: 'O' },
  amazon: { color: '#FF9900', letter: 'A' },
  meta: { color: '#0081FB', letter: 'M' },
  linkedin: { color: '#0A66C2', letter: 'L' },
  woocommerce: { color: '#96588A', letter: 'W' },
  googleads: { color: '#4285F4', letter: 'G' },
  sage: { color: '#00D639', letter: 'S' },
  freshbooks: { color: '#0075DD', letter: 'F' },
  wave: { color: '#003087', letter: 'W' },
  cin7: { color: '#FF6B35', letter: 'C' },
  plaid: { color: '#111111', letter: 'P' },
  mercury: { color: '#5851DB', letter: 'M' },
  brex: { color: '#FF5722', letter: 'B' },
  microsoft: { color: '#00A4EF', letter: 'M' },
  pipedrive: { color: '#1A1A1A', letter: 'P' },
  klaviyo: { color: '#000000', letter: 'K' },
  tradegecko: { color: '#00B388', letter: 'T' },
}

interface Integration {
  id: string
  name: string
  description: string
  category: string
  logoSlug: string
  logoPath?: string
  isAvailable: boolean
  authType?: AuthType
}

// All integrations - QuickBooks is available, rest are on request
const allIntegrations: Integration[] = [
  // Active integrations first
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Industry-leading accounting software',
    category: 'Accounting',
    logoSlug: 'quickbooks',
    logoPath: '/images/hero/Intuit_QuickBooks_logo-cropped.svg',
    isAvailable: true,
    authType: 'oauth',
  },
  {
    id: 'dynamics',
    name: 'Microsoft Dynamics 365 BC',
    description: 'Enterprise-grade Business Central',
    category: 'ERP',
    logoSlug: 'microsoft',
    isAvailable: true,
    authType: 'dual', // OAuth (new) or faux_credentials (existing Fivetran clients)
  },

  // Coming soon
  {
    id: 'xero',
    name: 'Xero',
    description: 'Beautiful cloud accounting software',
    category: 'Accounting',
    logoSlug: 'xero',
    logoPath: '/images/hero/Xero_software_logo.svg',
    isAvailable: false,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store',
    category: 'E-commerce',
    logoSlug: 'shopify',
    isAvailable: true,
    authType: 'oauth',
  },

  // Accounting
  {
    id: 'zoho',
    name: 'Zoho Books',
    description: 'Cloud-based accounting platform',
    category: 'Accounting',
    logoSlug: 'zoho',
    logoPath: '/images/hero/books-512-1.svg',
    isAvailable: false,
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description: 'Invoicing and accounting',
    category: 'Accounting',
    logoSlug: 'freshbooks',
    isAvailable: false,
  },
  {
    id: 'wave',
    name: 'Wave',
    description: 'Free accounting software',
    category: 'Accounting',
    logoSlug: 'wave',
    isAvailable: false,
  },

  // ERP
  {
    id: 'oracle',
    name: 'Oracle NetSuite',
    description: 'Leading cloud ERP',
    category: 'ERP',
    logoSlug: 'oracle',
    isAvailable: false,
  },
  {
    id: 'sap',
    name: 'SAP Business One',
    description: 'Enterprise resource planning',
    category: 'ERP',
    logoSlug: 'sap',
    isAvailable: false,
  },
  {
    id: 'sage',
    name: 'Sage Intacct',
    description: 'Cloud financial management',
    category: 'ERP',
    logoSlug: 'sage',
    isAvailable: false,
  },

  // Banking
  {
    id: 'plaid',
    name: 'Plaid',
    description: 'Secure bank connections',
    category: 'Banking',
    logoSlug: 'plaid',
    isAvailable: false,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing',
    category: 'Banking',
    logoSlug: 'stripe',
    isAvailable: false,
  },
  {
    id: 'square',
    name: 'Square',
    description: 'Point of sale platform',
    category: 'Banking',
    logoSlug: 'square',
    isAvailable: false,
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Payment tracking',
    category: 'Banking',
    logoSlug: 'paypal',
    isAvailable: false,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    description: 'Banking for startups',
    category: 'Banking',
    logoSlug: 'mercury',
    isAvailable: false,
  },
  {
    id: 'brex',
    name: 'Brex',
    description: 'Corporate cards',
    category: 'Banking',
    logoSlug: 'brex',
    isAvailable: false,
  },

  // CRM
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Enterprise CRM',
    category: 'CRM',
    logoSlug: 'salesforce',
    isAvailable: false,
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    description: 'All-in-one CRM platform',
    category: 'CRM',
    logoSlug: 'hubspot',
    isAvailable: false,
  },
  {
    id: 'zohocrm',
    name: 'Zoho CRM',
    description: 'CRM with AI',
    category: 'CRM',
    logoSlug: 'zoho',
    isAvailable: false,
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    description: 'Sales CRM',
    category: 'CRM',
    logoSlug: 'pipedrive',
    isAvailable: false,
  },

  // Marketing
  {
    id: 'googleads',
    name: 'Google Ads',
    description: 'Ad spend data',
    category: 'Marketing',
    logoSlug: 'googleads',
    isAvailable: false,
  },
  {
    id: 'meta',
    name: 'Meta Ads',
    description: 'Facebook & Instagram ads',
    category: 'Marketing',
    logoSlug: 'meta',
    isAvailable: false,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Ads',
    description: 'B2B advertising',
    category: 'Marketing',
    logoSlug: 'linkedin',
    isAvailable: false,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing',
    category: 'Marketing',
    logoSlug: 'mailchimp',
    isAvailable: false,
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'E-commerce automation',
    category: 'Marketing',
    logoSlug: 'klaviyo',
    isAvailable: false,
  },

  // E-commerce
  {
    id: 'amazon',
    name: 'Amazon Seller',
    description: 'Marketplace data',
    category: 'E-commerce',
    logoSlug: 'amazon',
    isAvailable: false,
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'WordPress eCommerce',
    category: 'E-commerce',
    logoSlug: 'woocommerce',
    isAvailable: false,
  },
  {
    id: 'cin7',
    name: 'Cin7',
    description: 'Inventory management',
    category: 'E-commerce',
    logoSlug: 'cin7',
    isAvailable: false,
  },
  {
    id: 'tradegecko',
    name: 'TradeGecko',
    description: 'Order management',
    category: 'E-commerce',
    logoSlug: 'tradegecko',
    isAvailable: false,
  },
]

const categories = ['All', 'Accounting', 'ERP', 'Banking', 'CRM', 'Marketing', 'E-commerce']

function IntegrationLogo({
  slug,
  name,
  logoPath,
  size = 24,
}: {
  slug: string
  name: string
  logoPath?: string
  size?: number
}) {
  const data = logoData[slug]

  // Use local logo if available
  if (logoPath) {
    return (
      <img src={logoPath} alt={name} className="max-h-8 w-auto object-contain" loading="lazy" />
    )
  }

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={name}
        width={size}
        height={size}
        className="opacity-80"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const fallback = e.currentTarget.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className="absolute inset-0 items-center justify-center text-white font-semibold rounded hidden"
        style={{
          backgroundColor: data?.color || '#f59e0b',
          fontSize: size * 0.5,
        }}
      >
        {data?.letter || name.charAt(0)}
      </div>
    </div>
  )
}

export default function IntegrationsContainer({
  initialProviderStatus,
  connectedProvidersMap: externalConnectedProvidersMap,
  onConnectionChange,
  onRefreshStatus,
  showNavigation = false,
  onNext,
  isLoading: parentIsLoading = false,
  apiError,
  environment = 'settings',
  onRequestAddIntegration,
}: IntegrationsContainerProps) {
  const { refetchSession, organization } = useSession()
  const { currency } = useCurrency()
  const autoTestRef = useRef(false)
  const oauthHandledRef = useRef(false)

  // Multi-provider state: track ALL connected providers
  const [connectedProvidersMap, setConnectedProvidersMap] = useState<
    Record<string, { organizationName: string | null; connectionStatus: ConnectionStatus }>
  >({})

  // Legacy single-provider state (for backward compatibility with onboarding/dashboard)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedProvider, setConnectedProvider] = useState<ProviderID | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')
  const [dataSummary, setDataSummary] = useState<ProviderDataSummary | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  // Helper to check if a specific provider is connected (multi-provider aware)
  const isProviderConnected = useCallback(
    (providerId: string): boolean => {
      return providerId in connectedProvidersMap
    },
    [connectedProvidersMap]
  )

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')

  // Loading states
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingProvider, setConnectingProvider] = useState<ProviderID | null>(null)
  const [disconnectingProvider, setDisconnectingProvider] = useState<ProviderID | null>(null)
  const [disconnectingSchema, setDisconnectingSchema] = useState<string | null>(null)
  const [disconnectingRealmId, setDisconnectingRealmId] = useState<string | null>(null)
  const [disconnectingShopDomain, setDisconnectingShopDomain] = useState<string | null>(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Error handling
  const [error, setError] = useState<string | null>(null)

  // Credentials modal state (for faux_credentials auth type)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false)
  const [credentialsModalProvider, setCredentialsModalProvider] = useState<ProviderID | null>(null)
  const [showBCModeDialog, setShowBCModeDialog] = useState(false)
  const [showShopifyModal, setShowShopifyModal] = useState(false)

  // Controls whether the integration picker is expanded (onboarding & settings)
  const [showIntegrationPicker, setShowIntegrationPicker] = useState(
    !initialProviderStatus?.connected
  )

  // Environments that use the collapsed/expanded picker pattern
  const usesCollapsiblePicker = environment === 'onboarding'
  // Settings uses a dialog popup for the picker
  const usesDialogPicker = environment === 'settings'

  const isLoading =
    parentIsLoading || disconnectingProvider !== null || isSwitching || isTestingConnection

  // Get individual BC schemas/connections from organization data (for multi-schema display)
  // COMBINES both OAuth direct API connections AND legacy Redshift/warehouse schemas
  // Both can coexist: OAuth for direct BC API access, warehouse for Fivetran-synced data
  const dynamicsSchemas: Array<{
    schema_name: string
    company_name: string
    connectionType: 'oauth' | 'warehouse'
  }> = useMemo(() => {
    const providers = organization?.providers as Record<string, any> | undefined
    const dynamics = providers?.dynamics
    const results: Array<{
      schema_name: string
      company_name: string
      connectionType: 'oauth' | 'warehouse'
    }> = []

    // Collect OAuth connections
    const oauthConns = dynamics?.oauthConnections as Record<string, any> | undefined
    if (oauthConns) {
      const oauthEntries = Object.entries(oauthConns)
        .filter(([key, conn]) => key !== '_pending_oauth' && conn?.credentials?.connected)
        .map(([connId, conn]) => ({
          schema_name: connId,
          company_name: conn?.credentials?.company_name || 'Business Central (OAuth)',
          connectionType: 'oauth' as const,
        }))
      results.push(...oauthEntries)
    }

    // Collect warehouse/Redshift schemas (can coexist with OAuth)
    const warehouseSchemas = dynamics?.credentials?.schemas as
      | Array<{ schema_name: string; company_name?: string }>
      | undefined
    if (warehouseSchemas && warehouseSchemas.length > 0) {
      const warehouseEntries = warehouseSchemas.map((s) => ({
        schema_name: s.schema_name,
        company_name: s.company_name || s.schema_name || 'Business Central (Warehouse)',
        connectionType: 'warehouse' as const,
      }))
      results.push(...warehouseEntries)
    }

    return results
  }, [organization])

  // Get QuickBooks multi-entity connections (for multi-entity display)
  // Only include connections that are actually connected (connected: true)
  // Disconnected connections (e.g., from invalid_grant) are filtered out
  const qbConnections: Array<{
    realmId: string
    companyName: string | null
    currency: string | null
    connected: boolean
    isActive: boolean
    lastError: string | null
  }> = useMemo(() => {
    const providers = organization?.providers as Record<string, any> | undefined
    const qb = providers?.quickbooks
    if (!qb?.connections) return []
    const activeRealmId = qb.activeRealmId
    return Object.entries(qb.connections)
      .filter(([, conn]: [string, any]) => conn?.credentials?.connected === true)
      .map(([realmId, conn]: [string, any]) => ({
        realmId,
        companyName: conn?.credentials?.company_name || null,
        currency: conn?.credentials?.home_currency || null,
        connected: true, // Always true since we filtered above
        isActive: realmId === activeRealmId,
        lastError: conn?.credentials?.lastError || null,
      }))
  }, [organization])

  // Get Shopify multi-store connections (for multi-store display)
  const shopifyConnections: Array<{
    shopDomain: string
    storeName: string | null
    connected: boolean
    isActive: boolean
  }> = useMemo(() => {
    const providers = organization?.providers as Record<string, any> | undefined
    const shopify = providers?.shopify
    if (!shopify?.connections) return []
    const activeShopDomain = shopify.activeShopDomain
    return Object.entries(shopify.connections)
      .filter(([, conn]: [string, any]) => conn?.credentials?.connected === true)
      .map(([domain, conn]: [string, any]) => ({
        shopDomain: domain,
        storeName: (conn as any)?.credentials?.shop_name || domain.replace('.myshopify.com', ''),
        connected: true,
        isActive: domain === activeShopDomain,
      }))
  }, [organization])

  // Initialize connectedProvidersMap from external prop
  useEffect(() => {
    if (externalConnectedProvidersMap) {
      const newMap: Record<
        string,
        { organizationName: string | null; connectionStatus: ConnectionStatus }
      > = {}
      for (const [providerId, data] of Object.entries(externalConnectedProvidersMap)) {
        newMap[providerId] = {
          organizationName: data.organizationName,
          connectionStatus: 'connected',
        }
      }
      setConnectedProvidersMap(newMap)
    }
  }, [externalConnectedProvidersMap])

  // Count of connected providers
  const connectedCount = Object.keys(connectedProvidersMap).length

  // Filter and sort integrations — connected providers first, then available, then coming soon
  const filteredIntegrations = useMemo(() => {
    return allIntegrations
      .filter((integration) => {
        const matchesSearch =
          integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          integration.description.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = activeFilter === 'All' || integration.category === activeFilter
        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        const aConnected = isProviderConnected(a.id) ? 0 : 1
        const bConnected = isProviderConnected(b.id) ? 0 : 1
        if (aConnected !== bConnected) return aConnected - bConnected
        // Within same connection status, prioritize available over coming soon
        const aAvailable = a.isAvailable ? 0 : 1
        const bAvailable = b.isAvailable ? 0 : 1
        return aAvailable - bAvailable
      })
  }, [searchQuery, activeFilter, isProviderConnected])

  // Handle OAuth success parameter from URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (oauthHandledRef.current) return

    const params = new URLSearchParams(window.location.search)
    const oauthSuccess = params.get('oauth_success')
    const provider = params.get('provider')

    if (oauthSuccess === 'true' && provider) {
      oauthHandledRef.current = true

      logger.info('OAuth success detected', {
        component: 'IntegrationsContainer',
        provider,
        environment,
      })

      // Clean URL params immediately to prevent re-firing
      window.history.replaceState({}, '', window.location.pathname)

      if (organization?.organization_id) {
        trackProviderConnected(provider, organization.organization_id)
      }

      // Dashboard redirects cause a full page reload — session is already fresh.
      // Only refetch in other environments where the component stayed mounted during OAuth.
      if (environment !== 'dashboard') {
        refetchSession()
          .then(() => {
            logger.info('Session refreshed after OAuth success', {
              component: 'IntegrationsContainer',
            })
          })
          .catch((err) => {
            logger.error('Failed to refresh session after OAuth:', {
              error: err,
              component: 'IntegrationsContainer',
            })
          })
      }
    }
  }, [refetchSession, organization, environment])

  // Auto-open integration picker when redirected with ?connect=true
  // This happens when a user signs in without a connected provider
  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const shouldConnect = params.get('connect')

    if (shouldConnect === 'true') {
      logger.info('Connect parameter detected, opening integration picker', {
        component: 'IntegrationsContainer',
      })
      setShowIntegrationPicker(true)

      // Clean up the URL parameter
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Initialize from props and verify auth status
  useEffect(() => {
    const checkProviderAuthStatus = async () => {
      if (initialProviderStatus?.connected) {
        setIsConnected(true)
        setShowIntegrationPicker(false)

        let provider: ProviderID | null = null
        if (initialProviderStatus.providerName) {
          if (
            initialProviderStatus.providerName === 'quickbooks' ||
            initialProviderStatus.providerName === 'QuickBooks'
          ) {
            provider = 'quickbooks'
          } else if (
            initialProviderStatus.providerName === 'zoho' ||
            initialProviderStatus.providerName === 'Zoho Books'
          ) {
            provider = 'zoho'
          } else if (
            initialProviderStatus.providerName === 'dynamics' ||
            initialProviderStatus.providerName === 'Microsoft Dynamics 365 Business Central'
          ) {
            provider = 'dynamics'
          }
        }

        if (provider) {
          setConnectedProvider(provider)
          setOrganizationName(initialProviderStatus.organizationName || null)

          // Dashboard already knows connection state from session — skip redundant API call
          if (environment === 'dashboard') {
            setConnectionStatus('connected')
            setLastChecked(new Date())
            return
          }

          try {
            const response = await fetch('/api/providers/status')
            if (response.ok) {
              const data = await response.json()
              const actuallyConnected = data.connected && data.activeProvider === provider
              if (!actuallyConnected) {
                logger.info('Provider marked as disconnected in database, updating UI', {
                  component: 'IntegrationsContainer',
                  provider,
                })
                setIsConnected(false)
                setConnectedProvider(null)
                setOrganizationName(null)
                setConnectionStatus('error')
                setShowIntegrationPicker(true)
              }
            }
          } catch (error) {
            logger.error('Failed to verify provider status:', {
              error,
              component: 'IntegrationsContainer',
            })
          }
        }
      }
    }

    checkProviderAuthStatus()
  }, [initialProviderStatus, environment])

  // Auto-test connection on mount if connected
  // Skip for all environments — the dashboard has its own health display,
  // and settings/onboarding don't need auto-testing either
  useEffect(() => {
    if (isConnected && connectedProvider) {
      setConnectionStatus('connected')
      setLastChecked(new Date())
    }
  }, [isConnected, connectedProvider])

  // Notify parent of connection changes
  const onConnectionChangeRef = useRef(onConnectionChange)
  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange
  })

  useEffect(() => {
    onConnectionChangeRef.current?.(isConnected, connectedProvider)
  }, [isConnected, connectedProvider])

  // Test connection function
  const testConnection = async (providerId: ProviderID, silent = false) => {
    if (!silent) {
      setIsTestingConnection(true)
    }
    setConnectionStatus('checking')
    setError(null)

    try {
      const response = await apiClient(`/api/providers/${providerId}/test-data?mode=quick`)

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Please try again.')
      }

      const result = await response.json()

      if (response.ok && result.overall_status !== 'failed') {
        const orgName =
          result.tests?.organization?.data?.name ||
          result.company?.name ||
          result.tests?.organization?.name ||
          organizationName

        const summary: ProviderDataSummary = {
          organizations: result.tests?.organization?.status === 'success' ? 1 : 0,
          invoices: result.tests?.invoices?.hasData ? 1 : 0,
          expenses: 0,
          items: 0,
          contacts: result.tests?.customers?.hasData ? 1 : 0,
        }

        setOrganizationName(orgName)
        setDataSummary(summary)
        setConnectionStatus(result.overall_status === 'partial' ? 'warning' : 'connected')
      } else {
        setConnectionStatus('error')
        setError(result.error || 'Failed to test connection')
      }

      setLastChecked(new Date())
    } catch (err) {
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setIsTestingConnection(false)
    }
  }

  // Start standard OAuth redirect flow for a provider
  const startOAuthFlow = (providerId: ProviderID, extraParams?: Record<string, string>) => {
    setIsConnecting(true)
    setConnectingProvider(providerId)
    setError(null)

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`qb_session`)
        localStorage.removeItem(`zoho_session`)
        sessionStorage.clear()
      }

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      const encodedRedirect = encodeURIComponent(currentPath)

      let loginUrl = `/api/providers/${providerId}/login?redirect_uri=${encodedRedirect}`
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          loginUrl += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
        }
      }

      setTimeout(() => {
        window.location.href = loginUrl
      }, 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setIsConnecting(false)
      setConnectingProvider(null)
    }
  }

  // Connect to provider
  const handleConnect = async (providerId: ProviderID) => {
    // Find the integration to check auth type
    const integration = allIntegrations.find((i) => i.id === providerId)

    // Handle faux_credentials auth type
    if (integration?.authType === 'faux_credentials') {
      setCredentialsModalProvider(providerId)
      setShowCredentialsModal(true)
      return
    }

    // Handle dual auth type (Dynamics BC: OAuth or Credentials)
    if (integration?.authType === 'dual') {
      setShowBCModeDialog(true)
      return
    }

    // Shopify needs store domain before OAuth
    if (providerId === 'shopify') {
      setShowShopifyModal(true)
      return
    }

    // Standard OAuth flow
    startOAuthFlow(providerId)
  }

  // Handle successful faux_credentials connection (e.g., Dynamics BC)
  const handleCredentialsSuccess = async (schemaName: string, displayName: string) => {
    if (!credentialsModalProvider) return

    setIsConnected(true)
    setConnectedProvider(credentialsModalProvider)
    setOrganizationName(displayName)
    setConnectionStatus('connected')
    setLastChecked(new Date())
    setShowIntegrationPicker(false)
    setShowCredentialsModal(false)
    setCredentialsModalProvider(null)

    // Track provider connection
    if (organization?.organization_id) {
      trackProviderConnected(credentialsModalProvider, organization.organization_id)
    }

    // Refresh session to update provider status
    await refetchSession()
  }

  // Disconnect a specific provider (multi-provider support)
  const handleDisconnectProvider = async (providerId: ProviderID) => {
    const providerName = allIntegrations.find((i) => i.id === providerId)?.name || providerId
    if (
      !window.confirm(
        `Are you sure you want to disconnect ${providerName}? This will stop all data synchronization.`
      )
    ) {
      return
    }

    setDisconnectingProvider(providerId)
    setError(null)

    try {
      const response = await apiClient(`/api/providers/${providerId}/disconnect`, {
        method: 'POST',
      })

      if (response.ok) {
        // Remove from connected providers map
        setConnectedProvidersMap((prev) => {
          const newMap = { ...prev }
          delete newMap[providerId]
          return newMap
        })

        // Also update legacy single-provider state if this was the connected one
        if (connectedProvider === providerId) {
          setIsConnected(false)
          setConnectedProvider(null)
          setOrganizationName(null)
          setConnectionStatus('checking')
          setDataSummary(null)
          setLastChecked(null)
        }
      } else {
        let errorMessage = 'Failed to disconnect'
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json()
            errorMessage = data.error || errorMessage
          } catch {
            // Ignore JSON parse errors
          }
        }
        setError(errorMessage)
      }

      await refetchSession()
      await onRefreshStatus?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect provider')
    } finally {
      setDisconnectingProvider(null)
    }
  }

  // Disconnect from provider (legacy - for backward compatibility)
  const handleDisconnect = async () => {
    if (!connectedProvider) return
    await handleDisconnectProvider(connectedProvider)
  }

  // Disconnect a single schema from a multi-schema provider (e.g. Dynamics BC)
  const handleDisconnectSchema = async (
    providerId: ProviderID,
    schemaName: string,
    companyName: string,
    connectionType?: 'oauth' | 'warehouse'
  ) => {
    if (
      !window.confirm(
        `Disconnect ${companyName}? This will remove access to the ${schemaName} data source.`
      )
    ) {
      return
    }

    setDisconnectingSchema(schemaName)
    setError(null)

    try {
      // Determine if this is an OAuth connection or a legacy Redshift schema
      // Prefer the explicit connectionType passed from the UI, fallback to checking organization
      let isOAuthConnection = connectionType === 'oauth'
      if (!connectionType) {
        const providers = organization?.providers as Record<string, any> | undefined
        isOAuthConnection = !!providers?.dynamics?.oauthConnections?.[schemaName]
      }
      const disconnectBody = isOAuthConnection
        ? { connectionId: schemaName }
        : { schema_name: schemaName }

      const response = await apiClient(`/api/providers/${providerId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(disconnectBody),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to disconnect data source'
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json()
            errorMessage = data.error || errorMessage
          } catch {
            // Ignore JSON parse errors
          }
        }
        setError(errorMessage)
      }

      await refetchSession()
      await onRefreshStatus?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect data source')
    } finally {
      setDisconnectingSchema(null)
    }
  }

  // Disconnect a single QuickBooks entity (company)
  const handleDisconnectQBEntity = async (realmId: string, companyName: string | null) => {
    const displayName = companyName || `Company ${realmId}`
    if (
      !window.confirm(
        `Disconnect ${displayName}? This will remove access to this QuickBooks company.`
      )
    ) {
      return
    }

    setDisconnectingRealmId(realmId)
    setError(null)

    try {
      const response = await apiClient('/api/providers/quickbooks/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realmId }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to disconnect QuickBooks company'
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json()
            errorMessage = data.error || errorMessage
          } catch {
            // Ignore JSON parse errors
          }
        }
        setError(errorMessage)
      }

      await refetchSession()
      await onRefreshStatus?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect QuickBooks company')
    } finally {
      setDisconnectingRealmId(null)
    }
  }

  // Disconnect a single Shopify store
  const handleDisconnectShopifyStore = async (shopDomain: string, storeName: string | null) => {
    const displayName = storeName || shopDomain
    if (
      !window.confirm(`Disconnect ${displayName}? This will remove access to this Shopify store.`)
    ) {
      return
    }

    setDisconnectingShopDomain(shopDomain)
    setError(null)

    try {
      const response = await apiClient('/api/providers/shopify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopDomain }),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to disconnect Shopify store'
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          try {
            const data = await response.json()
            errorMessage = data.error || errorMessage
          } catch {
            // Ignore JSON parse errors
          }
        }
        setError(errorMessage)
      }

      await refetchSession()
      await onRefreshStatus?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Shopify store')
    } finally {
      setDisconnectingShopDomain(null)
    }
  }

  // Status indicator component
  const StatusIndicator = () => {
    if (connectionStatus === 'checking') {
      return (
        <div className="flex items-center space-x-2 theme-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Checking...</span>
        </div>
      )
    }

    if (connectionStatus === 'connected') {
      return (
        <div className="flex items-center space-x-2 text-emerald-500">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs">Active</span>
        </div>
      )
    }

    if (connectionStatus === 'warning') {
      return (
        <div className="flex items-center space-x-2 text-amber-500">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs">Partial Connection</span>
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-2 text-red-500">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs">Connection Issue</span>
      </div>
    )
  }

  // Connected provider card (special treatment for connected QuickBooks)
  const ConnectedProviderCard = () => {
    if (!connectedProvider) return null

    const integration = allIntegrations.find((i) => i.id === connectedProvider)
    if (!integration) return null

    return (
      <div className="mb-6 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10 border border-emerald-500/20">
              <IntegrationLogo
                slug={integration.logoSlug}
                name={integration.name}
                logoPath={integration.logoPath}
                size={28}
              />
            </div>
            <div>
              <h4 className="font-semibold theme-text-primary">{integration.name}</h4>
              {organizationName && (
                <p className="text-xs theme-text-secondary">{organizationName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator />
            {lastChecked && (
              <button
                onClick={() => testConnection(connectedProvider)}
                disabled={isTestingConnection}
                className="w-7 h-7 rounded-full border border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center justify-center"
                title="Refresh connection"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-500 flex items-center gap-1">
            <Check className="w-3 h-3" />
            Connected
          </span>
          <button
            onClick={handleDisconnect}
            disabled={disconnectingProvider !== null}
            className="px-3 py-1.5 text-xs rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
          >
            {disconnectingProvider === connectedProvider ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Error Message */}
      {(error || apiError) && (
        <div className="mb-4">
          <div className="flex items-start justify-between p-4 bg-red-500/10 border border-red-500 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-red-500">Connection Issue</p>
              <p className="text-sm theme-text-secondary mt-1">{apiError || error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs px-2 py-1 border border-red-500 text-red-500 rounded hover:bg-red-500/10 transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Connected cards view — always visible for dialog picker, or collapsed for collapsible picker */}
      {((usesCollapsiblePicker && !showIntegrationPicker) || usesDialogPicker) &&
        connectedCount > 0 && (
          <div className="space-y-3">
            {/* Render a card for each connected provider */}
            {Object.entries(connectedProvidersMap).map(([providerId, providerData]) => {
              const integration = allIntegrations.find((i) => i.id === providerId)
              if (!integration) return null

              return (
                <div
                  key={providerId}
                  className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10 border border-emerald-500/20">
                        <IntegrationLogo
                          slug={integration.logoSlug}
                          name={integration.name}
                          logoPath={integration.logoPath}
                          size={28}
                        />
                      </div>
                      <div>
                        <h4 className="font-semibold theme-text-primary">{integration.name}</h4>
                        {providerData.organizationName && (
                          <p className="text-xs theme-text-secondary">
                            {providerData.organizationName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-2 text-emerald-500">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs">Active</span>
                      </div>
                    </div>
                  </div>
                  {/* Per-schema display for multi-schema providers (e.g. Dynamics BC) */}
                  {providerId === 'dynamics' && dynamicsSchemas.length > 0 ? (
                    <div className="space-y-2">
                      {dynamicsSchemas.map((schema) => (
                        <div
                          key={schema.schema_name}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-emerald-500/5"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            <span className="font-medium theme-text-primary">
                              {schema.company_name}
                            </span>
                            <span className="theme-text-secondary opacity-60">
                              ({schema.schema_name})
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9px] rounded-full font-medium ${
                                schema.connectionType === 'oauth'
                                  ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                  : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                              }`}
                            >
                              {schema.connectionType === 'oauth' ? 'OAuth' : 'Warehouse'}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              handleDisconnectSchema(
                                'dynamics' as ProviderID,
                                schema.schema_name,
                                schema.company_name,
                                schema.connectionType
                              )
                            }
                            disabled={
                              disconnectingProvider !== null || disconnectingSchema !== null
                            }
                            className="px-2 py-1 text-[10px] rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
                          >
                            {disconnectingSchema === schema.schema_name ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                            ) : (
                              'Disconnect'
                            )}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleConnect('dynamics' as ProviderID)}
                        className="w-full py-2 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 rounded-lg border border-dashed border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Connect Another Data Source
                      </button>
                    </div>
                  ) : providerId === 'quickbooks' && qbConnections.length > 0 ? (
                    /* Per-entity display for multi-entity QuickBooks */
                    <div className="space-y-2">
                      {qbConnections.map((conn) => (
                        <div
                          key={conn.realmId}
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${
                            conn.connected ? 'bg-emerald-500/5' : 'bg-red-500/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs">
                            {conn.connected ? (
                              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            )}
                            <span
                              className={`font-medium ${conn.connected ? 'theme-text-primary' : 'theme-text-secondary'}`}
                            >
                              {conn.companyName || conn.realmId}
                            </span>
                            {conn.currency && (
                              <span className="theme-text-secondary opacity-60">
                                ({conn.currency})
                              </span>
                            )}
                            {conn.connected ? (
                              <>
                                {conn.isActive && (
                                  <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                                    Active
                                  </span>
                                )}
                                {conn.lastError && (
                                  <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                                    Issue
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                                Disconnected
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {!conn.connected && (
                              <button
                                onClick={() => handleConnect('quickbooks' as ProviderID)}
                                className="px-2 py-1 text-[10px] rounded border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-all font-medium"
                              >
                                Reconnect
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleDisconnectQBEntity(conn.realmId, conn.companyName)
                              }
                              disabled={
                                disconnectingProvider !== null || disconnectingRealmId !== null
                              }
                              className="px-2 py-1 text-[10px] rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
                            >
                              {disconnectingRealmId === conn.realmId ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                              ) : (
                                'Disconnect'
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleConnect('quickbooks' as ProviderID)}
                        className="w-full py-2 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 rounded-lg border border-dashed border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Connect Another Company
                      </button>
                    </div>
                  ) : providerId === 'shopify' && shopifyConnections.length > 0 ? (
                    /* Per-store display for multi-store Shopify */
                    <div className="space-y-2">
                      {shopifyConnections.map((conn) => (
                        <div
                          key={conn.shopDomain}
                          className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-emerald-500/5"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            <span className="font-medium theme-text-primary">
                              {conn.storeName || conn.shopDomain}
                            </span>
                            <span className="theme-text-secondary opacity-60">
                              ({conn.shopDomain})
                            </span>
                            {conn.isActive && (
                              <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleDisconnectShopifyStore(conn.shopDomain, conn.storeName)
                            }
                            disabled={
                              disconnectingProvider !== null || disconnectingShopDomain !== null
                            }
                            className="px-2 py-1 text-[10px] rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
                          >
                            {disconnectingShopDomain === conn.shopDomain ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin inline" />
                            ) : (
                              'Disconnect'
                            )}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleConnect('shopify' as ProviderID)}
                        className="w-full py-2 text-xs font-medium text-amber-500 hover:text-amber-400 hover:bg-amber-500/5 rounded-lg border border-dashed border-amber-500/30 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        Connect Another Store
                      </button>
                    </div>
                  ) : providerId === 'dynamics' && dynamicsSchemas.length === 0 ? (
                    /* Dynamics connected but no schemas visible - likely stale data, need refresh */
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Connected
                      </span>
                      <button
                        onClick={async () => {
                          // Refresh session to get updated organization data
                          await refetchSession()
                        }}
                        className="px-3 py-1.5 text-xs rounded border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-all font-medium"
                      >
                        <RefreshCw className="w-3 h-3 inline mr-1" />
                        Refresh
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-500 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Connected
                      </span>
                      <button
                        onClick={() => handleDisconnectProvider(providerId as ProviderID)}
                        disabled={disconnectingProvider !== null}
                        className="px-3 py-1.5 text-xs rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
                      >
                        {disconnectingProvider === providerId ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                            Disconnecting...
                          </>
                        ) : (
                          'Disconnect'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            {/* Add Integration Card */}
            <button
              type="button"
              onClick={() =>
                usesDialogPicker && onRequestAddIntegration
                  ? onRequestAddIntegration()
                  : setShowIntegrationPicker(true)
              }
              className={cn(
                'w-full p-4 rounded-xl border-2 border-dashed border-gray-200/20',
                'hover:border-amber-500/40 hover:bg-amber-500/5',
                'transition-all duration-300 cursor-pointer',
                'flex items-center justify-center gap-3'
              )}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
                <Plus className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-semibold theme-text-primary">Add Integration</h4>
                <p className="text-xs theme-text-secondary">Connect another service</p>
              </div>
            </button>
          </div>
        )}

      {/* Non-collapsible environments: always show connected card */}
      {!usesCollapsiblePicker &&
        !usesDialogPicker &&
        environment !== 'dashboard' &&
        isConnected &&
        connectedProvider && <ConnectedProviderCard />}

      {/* Integration Picker — shown inline for onboarding, dashboard, and settings with no connections */}
      {((!usesCollapsiblePicker && !usesDialogPicker) ||
        (usesDialogPicker && connectedCount === 0) ||
        (usesCollapsiblePicker && (connectedCount === 0 || showIntegrationPicker))) && (
        <>
          {/* Close button header when picker is expanded with existing connections */}
          {usesCollapsiblePicker && connectedCount > 0 && showIntegrationPicker && (
            <div className="mb-4">
              {/* Show all connected provider cards */}
              {Object.entries(connectedProvidersMap).map(([providerId, providerData]) => {
                const integration = allIntegrations.find((i) => i.id === providerId)
                if (!integration) return null

                return (
                  <div
                    key={providerId}
                    className="mb-3 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10 border border-emerald-500/20">
                          <IntegrationLogo
                            slug={integration.logoSlug}
                            name={integration.name}
                            logoPath={integration.logoPath}
                            size={24}
                          />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold theme-text-primary">
                            {integration.name}
                          </h4>
                          <span className="text-xs text-emerald-500 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Connected
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnectProvider(providerId as ProviderID)}
                        disabled={disconnectingProvider !== null}
                        className="px-2 py-1 text-xs rounded border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all font-medium disabled:opacity-50"
                      >
                        {disconnectingProvider === providerId ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                            Disconnecting...
                          </>
                        ) : (
                          'Disconnect'
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold theme-text-primary">
                  Add another integration
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowIntegrationPicker(false)
                    setSearchQuery('')
                    setActiveFilter('All')
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium theme-text-secondary hover:theme-text-primary border border-gray-200/10 hover:border-gray-200/20 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-4">
            <div
              className={cn(
                'relative flex items-center gap-3 px-4 py-2.5 rounded-xl',
                'border border-gray-200/10 bg-white/5',
                'focus-within:border-amber-500/50 focus-within:bg-white/10 transition-all duration-300'
              )}
            >
              <Search className="w-4 h-4 flex-shrink-0 text-amber-500" />
              <input
                type="text"
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm theme-text-primary placeholder:theme-text-secondary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs theme-text-secondary hover:theme-text-primary transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Container for all environments */}
          <div className={cn('max-h-[400px] overflow-y-auto pr-2')}>
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((category) => {
                const isActive = activeFilter === category
                const count =
                  category === 'All'
                    ? allIntegrations.length
                    : allIntegrations.filter((i) => i.category === category).length
                return (
                  <button
                    key={category}
                    onClick={() => setActiveFilter(category)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
                      isActive
                        ? 'bg-amber-500 text-white'
                        : 'border border-gray-200/10 theme-text-secondary hover:border-amber-500/30 hover:theme-text-primary'
                    )}
                  >
                    {category}
                    <span
                      className={cn(
                        'ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]',
                        isActive ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-500'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Results count */}
            <p className="text-xs theme-text-secondary mb-4">
              Showing {filteredIntegrations.length} integration
              {filteredIntegrations.length !== 1 ? 's' : ''}
              {searchQuery && ` for "${searchQuery}"`}
            </p>

            {/* Integration Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredIntegrations.map((integration) => {
                // Multi-provider: check if THIS specific provider is connected
                const isConnectedProvider = isProviderConnected(integration.id)
                // Can connect if available AND not already connected (allows multiple providers)
                const canConnect = integration.isAvailable && !isConnectedProvider

                return (
                  <div
                    key={integration.id}
                    className={cn(
                      'group relative flex flex-col p-4 rounded-xl transition-all duration-300',
                      'border bg-white/5',
                      isConnectedProvider
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : integration.isAvailable
                          ? 'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5'
                          : 'border-gray-200/10 hover:border-gray-200/20'
                    )}
                  >
                    {/* Top Row: Logo + Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center border overflow-hidden transition-colors',
                          isConnectedProvider
                            ? 'bg-emerald-500/10 border-emerald-500/20'
                            : integration.isAvailable
                              ? 'bg-amber-500/10 border-amber-500/20'
                              : 'bg-white/5 border-gray-200/10'
                        )}
                      >
                        <IntegrationLogo
                          slug={integration.logoSlug}
                          name={integration.name}
                          logoPath={integration.logoPath}
                          size={22}
                        />
                      </div>

                      {/* Status Badge - Only show for connected or available integrations */}
                      {(isConnectedProvider || integration.isAvailable) && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-500">
                          {isConnectedProvider ? (
                            <>
                              <Check className="w-2.5 h-2.5" />
                              Connected
                            </>
                          ) : (
                            <>
                              <Check className="w-2.5 h-2.5" />
                              Available
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <h4 className="text-sm font-semibold theme-text-primary mb-1">
                      {integration.name}
                    </h4>

                    {/* Description */}
                    <p className="text-xs theme-text-secondary leading-relaxed flex-1 mb-3">
                      {isConnectedProvider && integration.authType !== 'faux_credentials'
                        ? 'Connect another company to this integration'
                        : integration.description}
                    </p>

                    {/* Category Tag + Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200/10 theme-text-secondary">
                        {integration.category}
                      </span>

                      {isConnectedProvider ? (
                        integration.authType === 'faux_credentials' ? (
                          <button
                            onClick={() => handleConnect(integration.id as ProviderID)}
                            className="flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add Source
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(integration.id as ProviderID)}
                            disabled={isConnecting}
                            className="flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
                          >
                            {isConnecting && connectingProvider === integration.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add Company
                              </>
                            )}
                          </button>
                        )
                      ) : canConnect ? (
                        <button
                          onClick={() => handleConnect(integration.id as ProviderID)}
                          disabled={isConnecting}
                          className="flex items-center gap-1 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
                        >
                          {isConnecting && connectingProvider === integration.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              Connect
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      ) : (
                        <Link
                          href="/schedule-demo"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
                        >
                          <Clock className="w-3 h-3" />
                          Request
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Empty State */}
            {filteredIntegrations.length === 0 && (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center border border-gray-200/10 bg-white/5">
                  <Search className="w-5 h-5 theme-text-secondary" />
                </div>
                <h3 className="text-sm font-semibold theme-text-primary mb-1">
                  No integrations found
                </h3>
                <p className="text-xs theme-text-secondary mb-3">
                  Try adjusting your search or filter criteria
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setActiveFilter('All')
                  }}
                  className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Info - Only visible in settings environment */}
      {environment === 'settings' && (
        <div className="mt-4">
          <p className="text-xs theme-text-secondary">
            <span className="font-medium text-amber-500">Secure Connection:</span> We use OAuth 2.0
            for secure authentication. Your credentials are never stored on our servers.
          </p>
        </div>
      )}

      {/* Navigation - Only show if enabled */}
      {showNavigation && onNext && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={onNext}
            disabled={parentIsLoading || !isConnected}
            className={`glass-next-button glass-next-button-primary w-full text-base py-3 rounded-lg flex items-center justify-center group font-semibold ${
              !isConnected && !parentIsLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Continue to next step"
          >
            {parentIsLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving
              </>
            ) : (
              <>
                Next: Review & Finish
                <span className="ml-2 transform transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Dynamics Credentials Modal */}
      {credentialsModalProvider === 'dynamics' && (
        <DynamicsCredentialsModal
          isOpen={showCredentialsModal}
          onClose={() => {
            setShowCredentialsModal(false)
            setCredentialsModalProvider(null)
          }}
          onSuccess={handleCredentialsSuccess}
          connectedSchemas={dynamicsSchemas}
        />
      )}

      {/* BC Connection Mode Dialog — choose OAuth or Credentials */}
      {showBCModeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Connect Business Central</h3>
              <button
                onClick={() => setShowBCModeDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Choose how to connect your Business Central data.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowBCModeDialog(false)
                  startOAuthFlow('dynamics')
                }}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-amber-500/30 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold">MS</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Connect with Microsoft Account</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Sign in with your Microsoft account for direct API access
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
              </button>
              <button
                onClick={() => {
                  setShowBCModeDialog(false)
                  setCredentialsModalProvider('dynamics')
                  setShowCredentialsModal(true)
                }}
                className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">Connect with Credentials</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    For existing Fivetran/warehouse connections
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopify Store Modal — faux login (default) or manual credentials */}
      <ShopifyStoreModal
        isOpen={showShopifyModal}
        onClose={() => setShowShopifyModal(false)}
        onFauxSuccess={async (shopDomain, displayName) => {
          // Faux login redirects to Shopify OAuth from within the modal.
          // If we reach this callback, the OAuth redirect already happened.
          // This is a no-op — the page will reload after OAuth callback.
          setShowShopifyModal(false)
        }}
        onManualConnect={async (shopDomain, clientId, clientSecret) => {
          setShowShopifyModal(false)
          setIsConnecting(true)
          setConnectingProvider('shopify')
          setError(null)

          try {
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

            // POST credentials to the server — secrets never appear in the URL
            const res = await fetch('/api/providers/shopify/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                shop_domain: shopDomain,
                shopify_client_id: clientId,
                shopify_client_secret: clientSecret,
                redirect_uri: currentPath,
              }),
            })

            if (!res.ok) {
              const data = await res.json()
              throw new Error(data.error || 'Failed to start Shopify connection')
            }

            const { loginUrl } = await res.json()
            window.location.href = loginUrl
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect')
            setIsConnecting(false)
            setConnectingProvider(null)
          }
        }}
      />
    </div>
  )
}
