'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useSession } from '@/hooks/useSession'
import {
  getConnectedProviderConfigs,
  type ProviderConfig,
  type ProviderCategory,
  DYNAMICS_OAUTH_CONFIG,
  DYNAMICS_WAREHOUSE_CONFIG,
  CATEGORY_META,
} from '@/lib/providers/provider-config'
import { useTheme } from '@/hooks/useTheme'
import { apiClient } from '@/lib/apiClient'
import ProviderIntegrationManager from '@/components/integrations/ProviderIntegrationManager'
import { useDashboardQBData, type ProviderSnapshot } from './hooks/useDashboardQBData'
import { useDashboardBCData } from './hooks/useDashboardBCData'
import { useDashboardBCOAuthData } from './hooks/useDashboardBCOAuthData'
import { useDashboardShopifyData } from './hooks/useDashboardShopifyData'
import { useDashboardQBTrend, useDashboardBCTrend } from './hooks/useDashboardTrendData'
import { useEntitySnapshot, useEntityTrend, type EntityType } from './hooks/useEntitySnapshot'
import { FinancialSnapshot } from './components/FinancialSnapshot'
import { CrossIntegrationSummary } from './components/CrossIntegrationSummary'
import { PeriodSelect } from '@/app/(main)/qb/reports/components/PeriodSelect'
import { DateRangeInputs } from '@/app/(main)/qb/reports/components/DateRangeInputs'
import type { ProviderTrendData } from './components/CrossIntegrationSummary'
import type { DashboardDateRange } from './hooks/types'
import { getDateRangeForPeriod, getDateRangeLabel } from '@/lib/utils/dateRanges'
import {
  Banknote,
  Database,
  ArrowRight,
  CheckCircle2,
  Unplug,
  Loader2,
  Plus,
  X,
  Clock,
  Building2,
  AlertTriangle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  LayoutDashboard,
  FileBarChart,
  LineChart,
  FileText,
  CreditCard,
  Store,
  Users,
  Package,
  ChevronRight,
  Sparkles,
  Zap,
  Activity,
  RefreshCw,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProviderID } from '@/lib/providers/database'
import { useWelcomeContextOptional } from '@/contexts/WelcomeContext'

// Represents a single dashboard card — either a provider or a QB entity
interface DashboardCard {
  provider: ProviderConfig
  category: ProviderCategory
  // For QB multi-entity or BC multi-connection: per-entity info
  entity?: {
    realmId: string
    companyName: string
    currency?: string
    connected: boolean
    lastSynced: Date | null
    lastError?: string | null
    isActive: boolean
    plan?: string
    // BC connections: distinguish OAuth (direct API) from warehouse (Fivetran/Redshift)
    connectionType?: 'oauth' | 'warehouse'
  }
}

// Provider icons mapping
const providerIcons: Record<ProviderID, React.ElementType> = {
  quickbooks: Banknote,
  dynamics: Database,
  zoho: Banknote,
  xero: Banknote,
  stripe: Banknote,
  shopify: Store,
}

// Icon mapping for nav items (matches Sidebar)
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CreditCard,
  Building2,
  Wallet,
  FileBarChart,
  Store,
  LineChart,
  Banknote,
  Package,
  Database,
}

// Minimal greeting based on time
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const { user, connectedProviders, organization, status, refetchSession } = useSession()
  const { theme, mounted } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [disconnectingProvider, setDisconnectingProvider] = useState<ProviderID | null>(null)
  const [showIntegrationPicker, setShowIntegrationPicker] = useState(false)
  const addIntegrationRef = useRef<HTMLDivElement>(null)
  const isDark = theme !== 'light'

  // ─── Unified period selector state ───
  const [period, setPeriod] = useState('last_year')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const dateRange = useMemo((): DashboardDateRange => {
    if (period === 'custom' && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd, period: 'custom' }
    }
    const range = getDateRangeForPeriod(period)
    return { startDate: range.start, endDate: range.end, period }
  }, [period, customStart, customEnd])

  // Handle ?addCompany=true URL param - open picker modal
  useEffect(() => {
    if (searchParams.get('addCompany') === 'true') {
      setShowIntegrationPicker(true)
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, router])

  // Handle ?bc_connected=true — strip the param (session already refreshed by bc-setup page)
  useEffect(() => {
    if (searchParams.get('bc_connected') === 'true') {
      router.replace('/dashboard', { scroll: false })
    }
  }, [searchParams, router])

  // Financial data hooks — conditional on provider being connected
  const hasQB = connectedProviders.includes('quickbooks')
  const hasBC = connectedProviders.includes('dynamics')

  // Redshift path: only when faux_credentials schemas exist
  const hasBCRedshift = useMemo(() => {
    if (!hasBC) return false
    const bcInfo = organization?.providers?.dynamics as any
    const schemas = bcInfo?.credentials?.schemas as any[] | undefined
    return !!(schemas && schemas.length > 0)
  }, [hasBC, organization])

  // OAuth path: when oauthConnections exist
  const hasBCOAuth = useMemo(() => {
    if (!hasBC) return false
    const bcInfo = organization?.providers?.dynamics as any
    const oauthConns = bcInfo?.oauthConnections as Record<string, any> | undefined
    if (!oauthConns) return false
    const entries = Object.entries(oauthConns).filter(
      ([key, conn]) => key !== '_pending_oauth' && conn?.credentials?.connected
    )
    return entries.length > 0
  }, [hasBC, organization])

  const qbSnapshot = useDashboardQBData(hasQB, undefined, dateRange)
  const bcSnapshot = useDashboardBCData(hasBCRedshift, undefined, dateRange)
  const bcOAuthSnapshot = useDashboardBCOAuthData(hasBCOAuth, undefined, dateRange)
  const qbTrend = useDashboardQBTrend(hasQB)
  const bcTrend = useDashboardBCTrend(hasBCRedshift)

  const snapshotForProvider = useCallback(
    (id: ProviderID): ProviderSnapshot | null => {
      if (id === 'quickbooks') return qbSnapshot
      if (id === 'dynamics') return hasBCOAuth ? bcOAuthSnapshot : bcSnapshot
      return null
    },
    [qbSnapshot, bcSnapshot, bcOAuthSnapshot, hasBCOAuth]
  )

  // ─── Per-entity data for CrossIntegrationSummary ───
  // Build entity descriptors from org data — each QB company and BC schema is an entity
  const ENTITY_COLORS = [
    '#2CA01C',
    '#00A4EF',
    '#F59E0B',
    '#10B981',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
  ]

  const hasShopify = connectedProviders.includes('shopify')

  const entityDescriptors = useMemo(() => {
    const entities: Array<{
      entityKey: string
      providerId: ProviderID
      name: string
      color: string
      type: EntityType
      identifier?: string // realmId for QB, schema_name for BC, shopDomain for Shopify
      connected: boolean
      category: ProviderCategory
    }> = []

    let colorIndex = 0
    const getColor = (providerColor: string) => {
      const c = colorIndex === 0 ? providerColor : ENTITY_COLORS[colorIndex % ENTITY_COLORS.length]
      colorIndex++
      return c
    }

    // QB entities
    if (hasQB) {
      const qbInfo = organization?.providers?.quickbooks as any
      if (qbInfo?.connections) {
        for (const [realmId, conn] of Object.entries(qbInfo.connections) as [string, any][]) {
          entities.push({
            entityKey: `quickbooks-${realmId}`,
            providerId: 'quickbooks',
            name: conn?.credentials?.company_name || `QB ${realmId.slice(-4)}`,
            color: getColor('#2CA01C'),
            type: 'qb',
            identifier: realmId,
            connected: !!conn?.credentials?.connected,
            category: 'accounting',
          })
        }
        // If no connections found but QB is connected, add default
        if (!entities.some((e) => e.providerId === 'quickbooks')) {
          entities.push({
            entityKey: 'quickbooks-default',
            providerId: 'quickbooks',
            name: 'QuickBooks',
            color: getColor('#2CA01C'),
            type: 'qb',
            connected: true,
            category: 'accounting',
          })
        }
      } else {
        // Legacy single-entity QB
        entities.push({
          entityKey: 'quickbooks-default',
          providerId: 'quickbooks',
          name:
            (organization?.providers?.quickbooks as any)?.credentials?.company_name || 'QuickBooks',
          color: getColor('#2CA01C'),
          type: 'qb',
          connected: true,
          category: 'accounting',
        })
      }
    }

    // BC entities - include BOTH OAuth connections AND warehouse schemas
    // They can coexist: OAuth for direct BC API, warehouse for Fivetran-synced data
    if (hasBC) {
      const bcInfo = organization?.providers?.dynamics as any
      const schemas = bcInfo?.credentials?.schemas as any[] | undefined
      let addedBCEntities = false

      // Collect OAuth connections
      const oauthConns = bcInfo?.oauthConnections as Record<string, any> | undefined
      const oauthEntries = oauthConns
        ? Object.entries(oauthConns).filter(
            ([key, conn]) => key !== '_pending_oauth' && conn?.credentials?.connected
          )
        : []

      if (oauthEntries.length > 0) {
        // OAuth direct API connections — fetch financial data from BC API
        for (const [connId, conn] of oauthEntries) {
          entities.push({
            entityKey: `dynamics-oauth-${connId}`,
            providerId: 'dynamics',
            name: conn.credentials?.company_name || 'Business Central (OAuth)',
            color: getColor('#00A4EF'),
            type: 'bc-oauth',
            identifier: connId,
            connected: true,
            category: 'accounting',
          })
          addedBCEntities = true
        }
      }

      // ALSO collect warehouse/Redshift schemas (can coexist with OAuth)
      if (schemas && schemas.length > 0) {
        for (const s of schemas) {
          entities.push({
            entityKey: `dynamics-warehouse-${s.schema_name}`,
            providerId: 'dynamics',
            name: s.company_name || s.schema_name || 'Business Central (Warehouse)',
            color: getColor('#00A4EF'),
            type: 'bc',
            identifier: s.schema_name,
            connected: true,
            category: 'accounting',
          })
          addedBCEntities = true
        }
      }

      // Fallback if neither OAuth nor warehouse schemas exist
      if (!addedBCEntities) {
        entities.push({
          entityKey: 'dynamics-default',
          providerId: 'dynamics',
          name: bcInfo?.credentials?.company_name || 'Business Central',
          color: getColor('#00A4EF'),
          type: 'bc',
          connected: true,
          category: 'accounting',
        })
      }
    }

    // Shopify entities
    if (hasShopify) {
      const shopifyInfo = organization?.providers?.shopify as any
      if (shopifyInfo?.connections) {
        for (const [domain, conn] of Object.entries(shopifyInfo.connections) as [string, any][]) {
          const storeName = conn?.credentials?.company_name || domain.replace('.myshopify.com', '')
          entities.push({
            entityKey: `shopify-${domain}`,
            providerId: 'shopify',
            name: storeName,
            color: getColor('#7AB55C'),
            type: 'shopify',
            identifier: domain,
            connected: !!conn?.credentials?.connected,
            category: 'commerce',
          })
        }
      }
      // Fallback if connected but no connections map
      if (!entities.some((e) => e.providerId === 'shopify')) {
        entities.push({
          entityKey: 'shopify-default',
          providerId: 'shopify',
          name: 'Shopify',
          color: getColor('#7AB55C'),
          type: 'shopify',
          connected: true,
          category: 'commerce',
        })
      }
    }

    return entities
  }, [hasQB, hasBC, hasShopify, organization])

  // Per-entity hooks via fixed slots (React hooks must be called unconditionally)
  // Pass null type for disconnected entities to skip API calls
  const ed = entityDescriptors
  const eSnap0 = useEntitySnapshot(
    ed[0]?.connected === false ? null : (ed[0]?.type ?? null),
    ed[0]?.identifier,
    dateRange
  )
  const eSnap1 = useEntitySnapshot(
    ed[1]?.connected === false ? null : (ed[1]?.type ?? null),
    ed[1]?.identifier,
    dateRange
  )
  const eSnap2 = useEntitySnapshot(
    ed[2]?.connected === false ? null : (ed[2]?.type ?? null),
    ed[2]?.identifier,
    dateRange
  )
  const eSnap3 = useEntitySnapshot(
    ed[3]?.connected === false ? null : (ed[3]?.type ?? null),
    ed[3]?.identifier,
    dateRange
  )
  const eSnap4 = useEntitySnapshot(
    ed[4]?.connected === false ? null : (ed[4]?.type ?? null),
    ed[4]?.identifier,
    dateRange
  )
  const eSnap5 = useEntitySnapshot(
    ed[5]?.connected === false ? null : (ed[5]?.type ?? null),
    ed[5]?.identifier,
    dateRange
  )
  const eSnap6 = useEntitySnapshot(
    ed[6]?.connected === false ? null : (ed[6]?.type ?? null),
    ed[6]?.identifier,
    dateRange
  )
  const eSnap7 = useEntitySnapshot(
    ed[7]?.connected === false ? null : (ed[7]?.type ?? null),
    ed[7]?.identifier,
    dateRange
  )
  const eTrend0 = useEntityTrend(
    ed[0]?.connected === false ? null : (ed[0]?.type ?? null),
    ed[0]?.identifier,
    dateRange
  )
  const eTrend1 = useEntityTrend(
    ed[1]?.connected === false ? null : (ed[1]?.type ?? null),
    ed[1]?.identifier,
    dateRange
  )
  const eTrend2 = useEntityTrend(
    ed[2]?.connected === false ? null : (ed[2]?.type ?? null),
    ed[2]?.identifier,
    dateRange
  )
  const eTrend3 = useEntityTrend(
    ed[3]?.connected === false ? null : (ed[3]?.type ?? null),
    ed[3]?.identifier,
    dateRange
  )
  const eTrend4 = useEntityTrend(
    ed[4]?.connected === false ? null : (ed[4]?.type ?? null),
    ed[4]?.identifier,
    dateRange
  )
  const eTrend5 = useEntityTrend(
    ed[5]?.connected === false ? null : (ed[5]?.type ?? null),
    ed[5]?.identifier,
    dateRange
  )
  const eTrend6 = useEntityTrend(
    ed[6]?.connected === false ? null : (ed[6]?.type ?? null),
    ed[6]?.identifier,
    dateRange
  )
  const eTrend7 = useEntityTrend(
    ed[7]?.connected === false ? null : (ed[7]?.type ?? null),
    ed[7]?.identifier,
    dateRange
  )

  const entitySnapshots = [eSnap0, eSnap1, eSnap2, eSnap3, eSnap4, eSnap5, eSnap6, eSnap7]
  const entityTrends = [eTrend0, eTrend1, eTrend2, eTrend3, eTrend4, eTrend5, eTrend6, eTrend7]
  const anyValidating = entitySnapshots.some((s) => s.isValidating && !s.isLoading)

  // Assemble per-entity provider entries for CrossIntegrationSummary
  const overviewProviders = useMemo(
    () =>
      entityDescriptors.map((desc, i) => ({
        entityKey: desc.entityKey,
        providerId: desc.providerId,
        name: desc.name,
        color: desc.color,
        snapshot: entitySnapshots[i],
        category: desc.category,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityDescriptors, ...entitySnapshots]
  )

  const overviewTrends = useMemo(
    (): (ProviderTrendData & { category: ProviderCategory })[] =>
      entityDescriptors
        .map((desc, i) => ({
          entityKey: desc.entityKey,
          providerId: desc.providerId,
          name: desc.name,
          color: desc.color,
          category: desc.category,
          data: entityTrends[i].data,
          currency: entityTrends[i].currency || '',
          isLoading: entityTrends[i].isLoading,
        }))
        .filter((t) => t.data.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entityDescriptors, ...entityTrends]
  )

  // Split by category for separate dashboard sections
  const accountingProviders = useMemo(
    () => overviewProviders.filter((p) => p.category === 'accounting'),
    [overviewProviders]
  )
  const commerceProviders = useMemo(
    () => overviewProviders.filter((p) => p.category === 'commerce'),
    [overviewProviders]
  )
  const accountingTrends = useMemo(
    () => overviewTrends.filter((t) => t.category === 'accounting'),
    [overviewTrends]
  )
  const commerceTrends = useMemo(
    () => overviewTrends.filter((t) => t.category === 'commerce'),
    [overviewTrends]
  )

  // Build connected providers map for ProviderIntegrationManager
  const connectedProvidersMap = useMemo(() => {
    const map: Record<string, { organizationName: string | null }> = {}
    if (!organization?.providers) return map

    for (const [providerId, providerInfo] of Object.entries(organization.providers)) {
      // For QB multi-entity: check connections map first
      if (providerId === 'quickbooks' && (providerInfo as any)?.connections) {
        const connections = Object.values((providerInfo as any).connections || {})
        const connectedEntities = connections.filter((c: any) => c?.credentials?.connected)
        if (connectedEntities.length > 0) {
          const displayName = connectedEntities
            .map((c: any) => c?.credentials?.company_name)
            .filter(Boolean)
            .join(', ')
          map[providerId] = { organizationName: displayName || null }
          continue
        }
      }

      // For Shopify multi-store: check connections map
      if (providerId === 'shopify' && (providerInfo as any)?.connections) {
        const connections = Object.values((providerInfo as any).connections || {})
        const connectedStores = connections.filter((c: any) => c?.credentials?.connected)
        if (connectedStores.length > 0) {
          const displayName = connectedStores
            .map(
              (c: any) =>
                c?.credentials?.company_name ||
                c?.credentials?.shop_domain?.replace('.myshopify.com', '')
            )
            .filter(Boolean)
            .join(', ')
          map[providerId] = { organizationName: displayName || null }
          continue
        }
      }

      // For Dynamics BC: check BOTH OAuth connections AND warehouse credentials
      // Both can coexist - combine display names from both
      if (providerId === 'dynamics') {
        const pInfo = providerInfo as any
        const displayNames: string[] = []

        // Collect OAuth connection names
        if (pInfo?.oauthConnections) {
          const oauthConns = pInfo.oauthConnections
          const connectedEntries = Object.entries(oauthConns).filter(
            ([key, conn]: [string, any]) => key !== '_pending_oauth' && conn?.credentials?.connected
          )
          for (const [, conn] of connectedEntries as [string, any][]) {
            const name = conn?.credentials?.company_name
            if (name) displayNames.push(name)
          }
        }

        // Collect warehouse schema names
        if (pInfo?.credentials?.connected && pInfo?.credentials?.schemas) {
          for (const schema of pInfo.credentials.schemas) {
            const name = schema.company_name || schema.schema_name
            if (name && !displayNames.includes(name)) displayNames.push(name)
          }
        }

        if (displayNames.length > 0) {
          map[providerId] = { organizationName: displayNames.join(', ') }
          continue
        }
      }

      if ((providerInfo as any)?.credentials?.connected) {
        const schemas = (providerInfo as any)?.credentials?.schemas
        const displayName = schemas?.length
          ? schemas.map((s: any) => s.company_name).join(', ')
          : (providerInfo as any)?.credentials?.company_name ||
            (providerInfo as any)?.credentials?.provider_organization_id ||
            (providerInfo as any)?.credentials?.realm_id ||
            null

        map[providerId] = { organizationName: displayName }
      }
    }
    return map
  }, [organization])

  const initialProviderStatus = useMemo(() => {
    const connectedIds = Object.keys(connectedProvidersMap)
    if (connectedIds.length === 0) return { connected: false }
    return {
      connected: true,
      providerName: connectedIds[0],
      organizationName: connectedProvidersMap[connectedIds[0]]?.organizationName,
    }
  }, [connectedProvidersMap])

  const handleConnectionChange = useCallback(
    async (_connected: boolean, _provider: ProviderID | null) => {},
    []
  )

  const handleRefreshStatus = useCallback(async () => {
    await refetchSession()
    setShowIntegrationPicker(false)
  }, [refetchSession])

  const [disconnectingRealmId, setDisconnectingRealmId] = useState<string | null>(null)

  const handleDisconnect = async (
    providerId: ProviderID,
    providerName: string,
    realmId?: string,
    connectionType?: 'oauth' | 'warehouse',
    schemaName?: string
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to disconnect ${providerName}? This will stop all data synchronization.`
      )
    ) {
      return
    }

    setDisconnectingProvider(providerId)
    if (realmId) setDisconnectingRealmId(realmId)
    try {
      // Build request body based on provider type
      let body: Record<string, string> | undefined
      let headers: Record<string, string> | undefined

      if (providerId === 'dynamics') {
        // Dynamics BC: must specify connectionId (OAuth) or schema_name (warehouse)
        if (connectionType === 'oauth' && schemaName) {
          body = { connectionId: schemaName }
          headers = { 'Content-Type': 'application/json' }
        } else if (connectionType === 'warehouse' && schemaName) {
          body = { schema_name: schemaName }
          headers = { 'Content-Type': 'application/json' }
        }
        // If neither is specified, the backend safeguard will catch it
      } else if (providerId === 'shopify' && realmId) {
        // Shopify: realmId contains the shop domain, API expects shopDomain
        body = { shopDomain: realmId }
        headers = { 'Content-Type': 'application/json' }
      } else if (realmId) {
        // QuickBooks: use realmId
        body = { realmId }
        headers = { 'Content-Type': 'application/json' }
      }

      const response = await apiClient(`/api/providers/${providerId}/disconnect`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        alert(data.error || 'Failed to disconnect provider')
      }
      await refetchSession()
    } catch {
      alert('Failed to disconnect provider')
    } finally {
      setDisconnectingProvider(null)
      setDisconnectingRealmId(null)
    }
  }

  // Extract metadata for each connected provider
  const getProviderMeta = (providerId: ProviderID) => {
    const info = organization?.providers?.[providerId] as any
    if (!info) return null

    // QB multi-entity: extract from connections map
    if (providerId === 'quickbooks' && info.connections) {
      const connections = Object.values(info.connections || {}) as any[]
      const connectedEntities = connections.filter((c) => c?.credentials?.connected)
      const issueEntities = connections.filter(
        (c) => !c?.credentials?.connected && c?.credentials?.lastError
      )
      const companyName = connectedEntities
        .map((c) => c?.credentials?.company_name)
        .filter(Boolean)
        .join(', ')

      // Use active entity's last_synced
      const activeRealmId = info.activeRealmId
      const activeConn = activeRealmId ? info.connections[activeRealmId] : connectedEntities[0]
      const lastSynced = activeConn?.credentials?.last_synced
        ? new Date(activeConn.credentials.last_synced * 1000)
        : null

      return {
        companyName: companyName || null,
        plan: activeConn?.plan as string | undefined,
        lastSynced,
        lastError:
          issueEntities.length > 0
            ? `${issueEntities.length} ${issueEntities.length === 1 ? 'entity' : 'entities'} need attention`
            : null,
        dataSources: connections.length,
      }
    }

    // BC OAuth connections: extract from oauthConnections map
    if (providerId === 'dynamics' && info.oauthConnections) {
      const oauthConns = info.oauthConnections as Record<string, any>
      const connectedEntries = Object.entries(oauthConns).filter(
        ([key, conn]) => key !== '_pending_oauth' && conn?.credentials?.connected
      )
      if (connectedEntries.length > 0) {
        const companyName = connectedEntries
          .map(([, conn]) => conn?.credentials?.company_name)
          .filter(Boolean)
          .join(', ')
        const activeConnId = info.activeConnectionId
        const activeConn = activeConnId ? oauthConns[activeConnId] : connectedEntries[0]?.[1]
        return {
          companyName: companyName || null,
          plan: undefined,
          lastSynced: activeConn?.connectedAt ? new Date(activeConn.connectedAt) : null,
          lastError: null,
          dataSources: connectedEntries.length,
        }
      }
    }

    const creds = info.credentials || {}
    const schemas = creds.schemas as any[] | undefined
    const lastSynced = creds.last_synced ? new Date(creds.last_synced * 1000) : null
    const companyName = schemas?.length
      ? schemas.map((s: any) => s.company_name).join(', ')
      : creds.company_name || null
    return {
      companyName,
      plan: info.plan as string | undefined,
      lastSynced,
      lastError: creds.lastError as string | null | undefined,
      dataSources: schemas?.length || (creds.connected ? 1 : 0),
    }
  }

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const connectedProviderConfigs = getConnectedProviderConfigs(connectedProviders)

  // Expand QB/BC multi-entity into individual cards (including disconnected ones)
  const dashboardCards = useMemo((): DashboardCard[] => {
    const cards: DashboardCard[] = []
    for (const config of connectedProviderConfigs) {
      if (config.id === 'quickbooks') {
        const qbInfo = organization?.providers?.quickbooks as any
        if (qbInfo?.connections) {
          const activeRealmId = qbInfo.activeRealmId
          for (const [realmId, conn] of Object.entries(qbInfo.connections) as [string, any][]) {
            // Include ALL companies - both connected and disconnected
            const isConnected = conn?.credentials?.connected === true
            cards.push({
              provider: config,
              category: config.category,
              entity: {
                realmId,
                companyName: conn?.credentials?.company_name || `QB Company ${realmId}`,
                currency: conn?.credentials?.home_currency,
                connected: isConnected,
                lastSynced: conn?.credentials?.last_synced
                  ? new Date(conn.credentials.last_synced * 1000)
                  : null,
                lastError: conn?.credentials?.lastError,
                isActive: realmId === activeRealmId,
                plan: conn?.plan,
              },
            })
          }
          // If we added entity cards, skip the default provider card
          if (cards.some((c) => c.provider.id === 'quickbooks')) continue
        }
      }
      // BC: expand into individual cards for BOTH OAuth connections AND warehouse schemas
      if (config.id === 'dynamics') {
        const bcInfo = organization?.providers?.dynamics as any
        const schemas = bcInfo?.credentials?.schemas as any[] | undefined
        const oauthConns = bcInfo?.oauthConnections as Record<string, any> | undefined
        let addedBCCards = false

        // Add OAuth connection cards
        if (oauthConns) {
          const oauthEntries = Object.entries(oauthConns).filter(
            ([key, conn]) => key !== '_pending_oauth' && conn?.credentials?.connected
          )
          const activeConnId = bcInfo?.activeConnectionId
          for (const [connId, conn] of oauthEntries) {
            cards.push({
              provider: config,
              category: config.category,
              entity: {
                realmId: connId, // connectionId used as identifier
                companyName: conn.credentials?.company_name || 'Business Central (OAuth)',
                currency: undefined,
                connected: true,
                lastSynced: conn.connectedAt ? new Date(conn.connectedAt * 1000) : null,
                lastError: undefined,
                isActive: connId === activeConnId,
                plan: undefined,
                connectionType: 'oauth', // Mark as OAuth for correct data fetching
              },
            })
            addedBCCards = true
          }
        }

        // ALSO add warehouse schema cards (can coexist with OAuth)
        if (schemas && schemas.length > 0) {
          const defaultSchema = bcInfo?.credentials?.default_schema
          for (const s of schemas) {
            cards.push({
              provider: config,
              category: config.category,
              entity: {
                realmId: s.schema_name, // Use schema_name as realmId for consistency
                companyName: s.company_name || s.schema_name || 'Business Central (Warehouse)',
                currency: undefined,
                connected: true,
                lastSynced: s.last_synced ? new Date(s.last_synced * 1000) : null,
                lastError: undefined,
                isActive: s.schema_name === defaultSchema,
                plan: undefined,
                connectionType: 'warehouse', // Mark as warehouse for correct data fetching
              },
            })
            addedBCCards = true
          }
        }

        // If we added any BC cards, skip the default provider card
        if (addedBCCards) continue
      }
      // Shopify: expand multi-store connections into individual cards
      if (config.id === 'shopify') {
        const shopifyInfo = organization?.providers?.shopify as any
        if (shopifyInfo?.connections) {
          const activeShopDomain = shopifyInfo.activeShopDomain
          for (const [domain, conn] of Object.entries(shopifyInfo.connections) as [string, any][]) {
            const isConnected = conn?.credentials?.connected === true
            // Use the shop name from the API (stored after first fetch) or format the domain
            const storeName =
              conn?.credentials?.company_name || domain.replace('.myshopify.com', '')
            cards.push({
              provider: config,
              category: config.category,
              entity: {
                realmId: domain,
                companyName: storeName,
                currency: undefined,
                connected: isConnected,
                lastSynced: conn?.credentials?.last_synced
                  ? new Date(conn.credentials.last_synced * 1000)
                  : null,
                lastError: undefined,
                isActive: domain === activeShopDomain,
              },
            })
          }
          if (cards.some((c) => c.provider.id === 'shopify')) continue
        }
      }
      // Non-multi-entity providers — one card per provider
      cards.push({ provider: config, category: config.category })
    }
    return cards
  }, [connectedProviderConfigs, organization])

  const accountingCards = useMemo(
    () => dashboardCards.filter((c) => c.category === 'accounting'),
    [dashboardCards]
  )
  const commerceCards = useMemo(
    () => dashboardCards.filter((c) => c.category === 'commerce'),
    [dashboardCards]
  )

  const hasConnections = dashboardCards.length > 0

  // Signal welcome overlay that dashboard is ready to show
  const welcomeContext = useWelcomeContextOptional()
  useEffect(() => {
    if (status !== 'loading' && mounted) {
      welcomeContext?.setDataLoading(false)
    }
  }, [status, mounted, welcomeContext])

  if (status === 'loading' || !mounted) {
    return (
      <div className="dashboard-loading-state flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-6">
          {/* Elegant loading spinner */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full border border-amber-500/20" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium theme-text-primary">Loading your dashboard</p>
            <p className="text-xs theme-text-secondary">Gathering your financial data...</p>
          </div>
        </div>
      </div>
    )
  }

  const greeting = getGreeting()

  // ─── No connections: Welcome state ───
  if (!hasConnections) {
    return (
      <div className="dashboard-welcome @container animate-fade-in">
        {/* Elegant minimal header */}
        <header className="mb-12 pt-4">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mb-3">
            {greeting}
          </p>
          <h1 className="dashboard-title text-[42px] font-light theme-text-primary tracking-tight">
            {user?.first_name ? (
              <>
                Welcome, <span className="midas-text-gradient font-light">{user.first_name}</span>
              </>
            ) : (
              <>
                Welcome to <span className="midas-text-gradient font-light">Midas</span>
              </>
            )}
          </h1>
          <p className="text-base theme-text-secondary mt-4 max-w-lg leading-relaxed font-light">
            Your intelligent financial command center. Connect your first integration to unlock
            real-time insights.
          </p>
        </header>

        {/* Main action area — clean card */}
        <section className="mb-12" ref={addIntegrationRef}>
          <AddIntegrationCard
            showIntegrationPicker={showIntegrationPicker}
            setShowIntegrationPicker={setShowIntegrationPicker}
            initialProviderStatus={initialProviderStatus}
            connectedProvidersMap={connectedProvidersMap}
            handleConnectionChange={handleConnectionChange}
            handleRefreshStatus={handleRefreshStatus}
          />
        </section>

        {/* Feature highlights — unlock grid */}
        <section className="unlock-section">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xs font-medium tracking-[0.15em] uppercase theme-text-secondary">
              What you&apos;ll unlock
            </h2>
            <div className="h-px flex-1 section-divider-line" />
          </div>
          <div className="unlock-grid grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-4 gap-0">
            {[
              {
                icon: TrendingUp,
                title: 'Live Reports',
                desc: 'P&L, Balance Sheet, Cash Flow — generated in seconds',
              },
              {
                icon: Sparkles,
                title: 'AI Insights',
                desc: 'Anomaly detection, forecasting & automated alerts',
              },
              {
                icon: Activity,
                title: 'Health Score',
                desc: 'Real-time financial wellness at a glance',
              },
              {
                icon: Zap,
                title: 'Real-time Sync',
                desc: 'Always current — data refreshes automatically',
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className="unlock-card group py-5 px-5 cursor-default"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4 metric-icon-color flex-shrink-0 transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:scale-110" />
                  <div>
                    <h3 className="text-[15px] font-medium theme-text-primary mb-1 transition-colors duration-300 unlock-title-hover">
                      {item.title}
                    </h3>
                    <p className="text-[14px] theme-text-secondary leading-relaxed opacity-70 transition-opacity duration-300 group-hover:opacity-100">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Add Integration Modal */}
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
      </div>
    )
  }

  // ─── Connected state ───
  return (
    <div className="dashboard-connected @container animate-fade-in">
      {/* Refined header */}
      <header className="mb-10 pt-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] uppercase text-amber-500/80 mb-2">
              {greeting}
            </p>
            <h1 className="dashboard-title text-[42px] font-light theme-text-primary tracking-tight">
              {user?.first_name ? (
                <>
                  {user.first_name}
                  <span className="text-amber-500">.</span>
                </>
              ) : (
                <>
                  Dashboard<span className="text-amber-500">.</span>
                </>
              )}
            </h1>
            {organization?.name && (
              <p className="text-sm theme-text-secondary mt-2 font-light">{organization.name}</p>
            )}
          </div>

          {/* Quick stats badge + Add Integration */}
          {(() => {
            const activeCount = dashboardCards.filter((c) => c.entity?.connected !== false).length
            const disconnectedCount = dashboardCards.filter(
              (c) => c.entity?.connected === false
            ).length
            return (
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs theme-text-secondary">
                      {activeCount} active {activeCount === 1 ? 'connection' : 'connections'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowIntegrationPicker(true)}
                    className="add-integration-btn group flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] hover:bg-amber-500/[0.12] hover:border-amber-500/40 transition-all duration-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-500 transition-colors" />
                    <span className="text-xs font-medium text-amber-500/80 group-hover:text-amber-500 transition-colors">
                      Add Integration
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  {period === 'custom' && (
                    <DateRangeInputs
                      startDate={customStart}
                      endDate={customEnd}
                      onStartChange={setCustomStart}
                      onEndChange={setCustomEnd}
                      compact
                    />
                  )}
                  {anyValidating && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin theme-text-secondary" />
                  )}
                  <div className="w-[160px] flex-shrink-0">
                    <PeriodSelect value={period} onChange={setPeriod} />
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </header>

      {/* ─── Accounting & ERP Section ─── */}
      {accountingCards.length > 0 && (
        <>
          {/* Cross-Integration Overview — accounting entities */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-amber-500/70" />
                <h2 className="text-xs font-medium tracking-[0.15em] uppercase theme-text-secondary">
                  {CATEGORY_META.accounting.label}
                </h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
              <span className="text-[10px] theme-text-secondary opacity-50">
                {CATEGORY_META.accounting.description}
              </span>
            </div>
            <CrossIntegrationSummary
              providers={accountingProviders}
              isDark={isDark}
              trendData={accountingTrends}
              onAddIntegration={() => setShowIntegrationPicker(true)}
            />
          </section>

          {/* Accounting connection cards */}
          <section className="mb-10">
            <div className="grid gap-5">
              {accountingCards.map((card, index) => (
                <ConnectionCard
                  key={
                    card.entity ? `${card.provider.id}-${card.entity.realmId}` : card.provider.id
                  }
                  provider={card.provider}
                  entity={card.entity}
                  meta={card.entity ? null : getProviderMeta(card.provider.id)}
                  snapshot={card.entity ? null : snapshotForProvider(card.provider.id)}
                  isDark={isDark}
                  disconnectingProvider={disconnectingProvider}
                  disconnectingRealmId={disconnectingRealmId}
                  onDisconnect={handleDisconnect}
                  formatTimeAgo={formatTimeAgo}
                  index={index}
                  dateRange={dateRange}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ─── Commerce & Retail Section ─── */}
      {commerceCards.length > 0 && (
        <>
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-500/70" />
                <h2 className="text-xs font-medium tracking-[0.15em] uppercase theme-text-secondary">
                  {CATEGORY_META.commerce.label}
                </h2>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
              <span className="text-[10px] theme-text-secondary opacity-50">
                {CATEGORY_META.commerce.description}
              </span>
            </div>
            {commerceProviders.length > 1 && (
              <CrossIntegrationSummary
                providers={commerceProviders}
                isDark={isDark}
                trendData={commerceTrends}
                onAddIntegration={() => setShowIntegrationPicker(true)}
              />
            )}
          </section>

          {/* Commerce connection cards */}
          <section className="mb-10">
            <div className="grid gap-5">
              {commerceCards.map((card, index) => (
                <ConnectionCard
                  key={
                    card.entity ? `${card.provider.id}-${card.entity.realmId}` : card.provider.id
                  }
                  provider={card.provider}
                  entity={card.entity}
                  meta={card.entity ? null : getProviderMeta(card.provider.id)}
                  snapshot={card.entity ? null : snapshotForProvider(card.provider.id)}
                  isDark={isDark}
                  disconnectingProvider={disconnectingProvider}
                  disconnectingRealmId={disconnectingRealmId}
                  onDisconnect={handleDisconnect}
                  formatTimeAgo={formatTimeAgo}
                  index={index}
                  dateRange={dateRange}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Add Integration button */}
      <section className="mb-10">
        <button
          onClick={() => setShowIntegrationPicker(true)}
          className="group w-full max-w-md rounded-2xl metric-card-bg p-5 flex items-center gap-4 transition-all duration-300 cursor-pointer hover:border-amber-500/30 text-left"
        >
          <div className="w-10 h-10 rounded-xl metric-icon-bg flex items-center justify-center flex-shrink-0">
            <Layers className="w-5 h-5 metric-icon-color opacity-70" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium theme-text-primary block">Add Integration</span>
            <span className="text-xs theme-text-secondary mt-1 block opacity-70 leading-relaxed">
              Connect another accounting, ERP, or sales channel
            </span>
          </div>
          <div className="flex-shrink-0">
            <div className="w-9 h-9 rounded-xl border border-dashed prompt-add-btn flex items-center justify-center transition-all group-hover:border-amber-500/50 group-hover:bg-amber-500/10">
              <Plus className="w-4 h-4 metric-icon-color opacity-50 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </button>
      </section>

      {/* Add Integration Modal */}
      <Dialog open={showIntegrationPicker} onOpenChange={setShowIntegrationPicker}>
        <DialogContent className="sm:max-w-5xl">
          <div className="integration-modal rounded-2xl border border-amber-500/15 bg-[var(--theme-bg)] p-6 shadow-2xl">
            <div className="mb-6">
              <DialogTitle className="text-base font-medium theme-text-primary">
                Connect a Provider
              </DialogTitle>
              <DialogDescription className="text-xs theme-text-secondary mt-1 opacity-70">
                Connect an accounting platform or sales channel
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
    </div>
  )
}

// ─── Connection Card Component ───

interface ProviderMeta {
  companyName: string | null
  plan: string | undefined
  lastSynced: Date | null
  lastError: string | null | undefined
  dataSources: number
}

function ConnectionCard({
  provider,
  entity,
  meta,
  snapshot: externalSnapshot,
  isDark,
  disconnectingProvider,
  disconnectingRealmId,
  onDisconnect,
  formatTimeAgo,
  index = 0,
  dateRange,
}: {
  provider: ProviderConfig
  entity?: DashboardCard['entity']
  meta: ProviderMeta | null
  snapshot: ProviderSnapshot | null
  isDark: boolean
  disconnectingProvider: ProviderID | null
  disconnectingRealmId?: string | null
  onDisconnect: (
    id: ProviderID,
    name: string,
    realmId?: string,
    connectionType?: 'oauth' | 'warehouse',
    schemaName?: string
  ) => void
  formatTimeAgo: (date: Date) => string
  index?: number
  dateRange?: DashboardDateRange
}) {
  const isEntityDisconnected = entity?.connected === false
  const isBCOAuth = provider.id === 'dynamics' && entity?.connectionType === 'oauth'
  const isBCWarehouse = provider.id === 'dynamics' && entity?.connectionType === 'warehouse'

  // QB entities self-fetch their own financial data using their realmId
  // Skip fetch for disconnected entities
  const qbEntitySnapshot = useDashboardQBData(
    provider.id === 'quickbooks' && !!entity && !isEntityDisconnected,
    entity?.realmId,
    dateRange
  )
  // BC warehouse entities self-fetch using their schema name (Redshift/Fivetran)
  const bcWarehouseSnapshot = useDashboardBCData(
    isBCWarehouse && !!entity && !isEntityDisconnected,
    entity?.realmId, // realmId contains schema_name for BC warehouse
    dateRange
  )
  // BC OAuth entities self-fetch using their connectionId (direct BC API)
  const bcOAuthSnapshot = useDashboardBCOAuthData(
    isBCOAuth && !!entity && !isEntityDisconnected,
    entity?.realmId, // realmId contains connectionId for BC OAuth
    dateRange
  )
  // Shopify entities self-fetch using their shop domain
  const shopifySnapshot = useDashboardShopifyData(
    provider.id === 'shopify' && !!entity && !isEntityDisconnected,
    entity?.realmId // realmId contains shop domain for Shopify
  )
  const snapshot = entity
    ? provider.id === 'dynamics'
      ? isBCOAuth
        ? bcOAuthSnapshot
        : bcWarehouseSnapshot
      : provider.id === 'shopify'
        ? shopifySnapshot
        : qbEntitySnapshot
    : externalSnapshot

  const Icon = providerIcons[provider.id] || Banknote

  // For BC entities, use the appropriate config based on connection type
  // Warehouse uses /bc-warehouse/ routes, OAuth uses /bc/ routes
  const effectiveConfig =
    provider.id === 'dynamics'
      ? isBCWarehouse
        ? DYNAMICS_WAREHOUSE_CONFIG
        : DYNAMICS_OAUTH_CONFIG
      : provider

  // Top-level nav items only (skip children like vendors/bills)
  const MAX_NAV_ITEMS = 6
  const allNavItems = effectiveConfig.navItems.filter((item) => !item.comingSoon)
  const navItems = allNavItems.slice(0, MAX_NAV_ITEMS)
  const hasMoreNavItems = allNavItems.length > MAX_NAV_ITEMS

  // Build entity-aware URL with the appropriate query parameter
  // QB uses ?realmId=, BC warehouse uses ?schema=, BC OAuth uses ?connectionId=, Shopify uses ?shop=
  const buildEntityUrl = (baseHref: string): string => {
    if (!entity?.realmId) return baseHref
    let param: string
    if (provider.id === 'dynamics') {
      param = isBCWarehouse ? 'schema' : 'connectionId'
    } else if (provider.id === 'shopify') {
      param = 'shop'
    } else {
      param = 'realmId'
    }
    const separator = baseHref.includes('?') ? '&' : '?'
    return `${baseHref}${separator}${param}=${encodeURIComponent(entity.realmId)}`
  }

  // Use entity-specific data if available, otherwise fall back to meta
  const cardTitle = entity?.companyName || meta?.companyName || provider.name
  const cardLastSynced = entity?.lastSynced ?? meta?.lastSynced
  const cardLastError = entity?.lastError ?? meta?.lastError
  // For QB entities, match on realmId too so only the correct card shows spinner
  const isDisconnecting = entity
    ? disconnectingProvider === provider.id && disconnectingRealmId === entity.realmId
    : disconnectingProvider === provider.id

  return (
    <div
      className={`connection-card @container group relative rounded-2xl border overflow-hidden transition-all duration-300 ${
        isEntityDisconnected
          ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.04]'
          : 'bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
      style={{
        borderColor: isEntityDisconnected
          ? isDark
            ? 'rgba(245,158,11,0.15)'
            : 'rgba(245,158,11,0.2)'
          : isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)',
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: isEntityDisconnected
            ? 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.6), transparent)'
            : `linear-gradient(90deg, transparent, ${provider.color}60, transparent)`,
        }}
      />

      {/* Card Header — Minimal */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Provider icon */}
            <Icon
              className="w-7 h-7"
              style={{
                color: isEntityDisconnected ? '#f59e0b' : provider.color,
                opacity: isEntityDisconnected ? 0.7 : 1,
              }}
            />

            <div>
              <div className="flex items-center gap-2.5">
                <h3
                  className={`text-base font-medium ${isEntityDisconnected ? 'theme-text-secondary' : 'theme-text-primary'}`}
                >
                  {cardTitle}
                </h3>
                {/* Status indicator */}
                {isEntityDisconnected ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                    <AlertTriangle className="w-2.5 h-2.5" /> Disconnected
                  </span>
                ) : cardLastError ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <AlertTriangle className="w-2.5 h-2.5" /> Issue
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                )}
              </div>

              {/* Metadata — clean inline */}
              <div className="flex items-center gap-2 mt-1.5 text-xs theme-text-secondary">
                <span style={{ color: provider.color }} className="font-medium">
                  {provider.name}
                </span>
                {entity?.currency || snapshot?.currency ? (
                  <>
                    <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    <span className="opacity-70">{entity?.currency || snapshot?.currency}</span>
                  </>
                ) : snapshot?.isLoading ? (
                  <>
                    <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    <span
                      className={`inline-block w-8 h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'} animate-pulse`}
                    />
                  </>
                ) : null}
                <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                {cardLastSynced && (
                  <span className="flex items-center gap-1 opacity-70">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(cardLastSynced)}
                  </span>
                )}
                {!entity && meta && meta.dataSources > 0 && (
                  <>
                    <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    <span className="opacity-70">
                      {meta.dataSources} {meta.dataSources === 1 ? 'source' : 'sources'}
                    </span>
                  </>
                )}
                {dateRange && (
                  <>
                    <span className={`w-px h-3 ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
                    <span className="opacity-50 font-mono tabular-nums">
                      {getDateRangeLabel(dateRange.startDate, dateRange.endDate)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions — minimal */}
          <div className="flex items-center gap-2">
            {isEntityDisconnected ? (
              <Link href="/settings">
                <Button
                  size="sm"
                  className="h-8 px-3 gap-1.5 rounded-lg text-xs font-medium transition-all duration-200 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reconnect
                </Button>
              </Link>
            ) : (
              <Link href={buildEntityUrl(navItems[0]?.href || effectiveConfig.basePath)}>
                <Button
                  size="sm"
                  className="h-8 px-3 gap-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                  style={{
                    backgroundColor: `${provider.color}15`,
                    color: provider.color,
                    border: 'none',
                  }}
                >
                  {provider.category === 'commerce' ? 'View Store' : 'View Reports'}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-3 gap-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
              disabled={isDisconnecting}
              onClick={() =>
                onDisconnect(
                  provider.id,
                  cardTitle,
                  entity?.realmId,
                  entity?.connectionType,
                  // For dynamics, realmId contains the connectionId (OAuth) or schema_name (warehouse)
                  provider.id === 'dynamics' ? entity?.realmId : undefined
                )
              }
            >
              {isDisconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unplug className="w-3.5 h-3.5" />
              )}
              {isEntityDisconnected ? 'Remove' : 'Disconnect'}
            </Button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      {isEntityDisconnected ? (
        <div className={`border-t p-6 ${isDark ? 'border-white/[0.04]' : 'border-black/[0.06]'}`}>
          <div className="flex items-center gap-3 text-sm theme-text-secondary">
            <Unplug className="w-4 h-4 text-amber-500/60 flex-shrink-0" />
            <p>
              This company&apos;s QuickBooks connection has been lost. Reconnect from{' '}
              <Link href="/settings" className="text-amber-500 hover:underline">
                Settings
              </Link>{' '}
              to restore access to financial data.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`border-t flex flex-col @xl:flex-row ${isDark ? 'border-white/[0.04]' : 'border-black/[0.06]'}`}
        >
          {/* Module quick links */}
          <div
            className={`@xl:w-[220px] flex-shrink-0 p-4 border-b @xl:border-b-0 @xl:border-r ${isDark ? 'border-white/[0.04]' : 'border-black/[0.06]'}`}
          >
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase theme-text-secondary mb-3 opacity-60">
              Modules
            </p>
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item, itemIndex) => {
                const NavIcon = iconMap[item.icon] || FileText
                const isPrimary = itemIndex === 0
                return (
                  <Link key={item.id} href={buildEntityUrl(item.href)}>
                    <div
                      className={`flex items-center gap-2 py-1.5 rounded-lg transition-all duration-200 group/link cursor-pointer ${
                        isPrimary ? 'px-2.5 mb-1' : 'px-2.5 ml-3 hover:bg-white/[0.03]'
                      }`}
                      style={isPrimary ? { backgroundColor: `${provider.color}10` } : undefined}
                    >
                      <NavIcon
                        className={`flex-shrink-0 transition-colors ${
                          isPrimary
                            ? 'w-3.5 h-3.5'
                            : 'w-3 h-3 theme-text-secondary group-hover/link:text-amber-500'
                        }`}
                        style={isPrimary ? { color: provider.color } : undefined}
                      />
                      <span
                        className={`truncate transition-colors ${
                          isPrimary
                            ? 'text-xs font-medium theme-text-primary'
                            : 'text-xs theme-text-secondary group-hover/link:theme-text-primary'
                        }`}
                      >
                        {item.label}
                      </span>
                      {isPrimary && (
                        <ChevronRight
                          className="w-3 h-3 flex-shrink-0 ml-auto transition-transform group-hover/link:translate-x-0.5"
                          style={{ color: provider.color }}
                        />
                      )}
                      {item.isNew && (
                        <Badge
                          className="text-[8px] px-1.5 py-0 ml-auto font-semibold"
                          style={{
                            backgroundColor: `${provider.color}15`,
                            color: provider.color,
                            borderColor: `${provider.color}25`,
                          }}
                        >
                          New
                        </Badge>
                      )}
                    </div>
                  </Link>
                )
              })}
              {hasMoreNavItems && (
                <Link href={buildEntityUrl(effectiveConfig.basePath)}>
                  <div className="flex items-center gap-2 py-1.5 px-2.5 ml-3 rounded-lg transition-all duration-200 group/link cursor-pointer hover:bg-white/[0.03]">
                    <span className="text-[10px] theme-text-secondary group-hover/link:theme-text-primary transition-colors">
                      +{allNavItems.length - MAX_NAV_ITEMS} more
                    </span>
                    <ChevronRight className="w-2.5 h-2.5 theme-text-secondary group-hover/link:theme-text-primary ml-auto transition-transform group-hover/link:translate-x-0.5" />
                  </div>
                </Link>
              )}
            </nav>
          </div>

          {/* Financial snapshot — KPIs + Health Radar */}
          <div className="flex-1 p-4 @container">
            {snapshot &&
            !snapshot.isLoading &&
            !snapshot.error &&
            (snapshot.revenue !== null ||
              snapshot.cashBalance !== null ||
              snapshot.ar !== null ||
              snapshot.ap !== null ||
              snapshot.netIncome !== null) ? (
              <FinancialSnapshot
                snapshot={snapshot}
                providerColor={provider.color}
                isDark={isDark}
                providerId={provider.id}
              />
            ) : snapshot?.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin theme-text-secondary opacity-50" />
                  <p className="text-xs theme-text-secondary opacity-50">
                    Loading financial data...
                  </p>
                </div>
              </div>
            ) : snapshot?.error ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs text-red-400/70">Failed to load financial data</p>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-xs theme-text-secondary opacity-50">
                  {snapshot && !snapshot.isLoading
                    ? 'No financial data available yet'
                    : 'Financial data loading...'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Integration Card (shared) ───

function AddIntegrationCard({
  setShowIntegrationPicker,
}: {
  showIntegrationPicker: boolean
  setShowIntegrationPicker: (show: boolean) => void
  initialProviderStatus: {
    connected: boolean
    providerName?: string
    organizationName?: string | null
  }
  connectedProvidersMap: Record<string, { organizationName: string | null }>
  handleConnectionChange: (connected: boolean, provider: ProviderID | null) => void
  handleRefreshStatus: () => Promise<void>
}) {
  return (
    <button
      onClick={() => setShowIntegrationPicker(true)}
      className="group w-full max-w-md rounded-2xl metric-card-bg p-5 flex items-center gap-4 transition-all duration-300 cursor-pointer hover:border-amber-500/30 text-left"
    >
      <div className="w-10 h-10 rounded-xl metric-icon-bg flex items-center justify-center flex-shrink-0">
        <Layers className="w-5 h-5 metric-icon-color opacity-70" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium theme-text-primary block">Add Integration</span>
        <span className="text-xs theme-text-secondary mt-1 block opacity-70 leading-relaxed">
          Connect accounting, ERP, e-commerce & more
        </span>
      </div>
      <div className="flex-shrink-0">
        <div className="w-9 h-9 rounded-xl border border-dashed prompt-add-btn flex items-center justify-center transition-all group-hover:border-amber-500/50 group-hover:bg-amber-500/10">
          <Plus className="w-4 h-4 metric-icon-color opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  )
}
