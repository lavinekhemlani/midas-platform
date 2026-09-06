'use client'

import React, { useState, useEffect, useMemo, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WarehouseSchema {
  schema_name: string
  source_type: string
  display_name: string
  connected_at: number
  last_synced?: number
  tables?: string[]
}

export interface WarehouseConfig {
  enabled: boolean
  schemas: WarehouseSchema[]
  default_schema?: string
}

export interface WarehouseConfigResult {
  success: boolean
  organizationId?: string
  organizationName?: string
  config?: WarehouseConfig
  error?: string
}

// ── Context ───────────────────────────────────────────────────────────────────

interface WarehouseDevContextValue {
  selectedSchema: string
  setSelectedSchema: (s: string) => void
  warehouseConfig: WarehouseConfigResult | null
  configLoading: boolean
}

const WarehouseDevContext = createContext<WarehouseDevContextValue>({
  selectedSchema: '',
  setSelectedSchema: () => {},
  warehouseConfig: null,
  configLoading: true,
})

export function useWarehouseDev() {
  return useContext(WarehouseDevContext)
}

// ── Source type labels ─────────────────────────────────────────────────────────

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  business_central: { label: 'Business Central', color: 'text-blue-400' },
  d365: { label: 'D365 F&O', color: 'text-purple-400' },
  shopify: { label: 'Shopify', color: 'text-green-400' },
  meta_ads: { label: 'Meta Ads', color: 'text-indigo-400' },
  amazon: { label: 'Amazon', color: 'text-orange-400' },
  tally: { label: 'Tally', color: 'text-yellow-400' },
  manual: { label: 'Manual Upload', color: 'text-gray-400' },
}

// ── Navigation Tabs ───────────────────────────────────────────────────────────

const NAV_TABS = [
  { href: '/dev/warehouse', label: 'Explorer' },
  { href: '/dev/warehouse/agent', label: 'Agent Tester' },
]

// ── Layout Component ──────────────────────────────────────────────────────────

export function WarehouseDevLayout({ children }: { children: React.ReactNode }) {
  const { status: sessionStatus } = useSession()
  const pathname = usePathname()

  // Config state
  const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfigResult | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [selectedSchema, setSelectedSchema] = useState<string>('')

  // Load warehouse config on mount
  useEffect(() => {
    async function loadConfig() {
      console.log('[Warehouse UI] Loading warehouse config...')
      try {
        const response = await fetch('/api/redshift/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_warehouse_config' }),
        })

        const data: WarehouseConfigResult = await response.json()
        console.log(
          '[Warehouse UI] Config response:',
          JSON.stringify({
            success: data.success,
            organizationName: data.organizationName,
            schemasCount: data.config?.schemas?.length ?? 0,
            schemas: data.config?.schemas?.map((s) => s.schema_name),
            defaultSchema: data.config?.default_schema,
          })
        )
        setWarehouseConfig(data)

        if (data.success && data.config?.schemas?.length) {
          const defaultSchema = data.config.default_schema || data.config.schemas[0].schema_name
          setSelectedSchema(defaultSchema)
        }
      } catch (err) {
        console.error('[Warehouse UI] Config load error:', err)
        setWarehouseConfig({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load warehouse config',
        })
      } finally {
        setConfigLoading(false)
      }
    }

    if (sessionStatus === 'authenticated') {
      loadConfig()
    }
  }, [sessionStatus])

  const contextValue = useMemo(
    () => ({
      selectedSchema,
      setSelectedSchema,
      warehouseConfig,
      configLoading,
    }),
    [selectedSchema, warehouseConfig, configLoading]
  )

  if (sessionStatus === 'loading' || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="theme-text-secondary">Loading warehouse configuration...</p>
        </div>
      </div>
    )
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-luxury-card p-8 text-center">
          <h2 className="text-xl font-semibold theme-text-primary mb-2">Authentication Required</h2>
          <p className="theme-text-secondary">Please sign in to access the warehouse explorer.</p>
        </div>
      </div>
    )
  }

  if (!warehouseConfig?.success || !warehouseConfig?.config?.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-luxury-card p-8 text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold theme-text-primary mb-2">
            Warehouse Not Configured
          </h2>
          <p className="theme-text-secondary mb-4">
            {warehouseConfig?.error ||
              'Your organization does not have warehouse access configured yet.'}
          </p>
        </div>
      </div>
    )
  }

  const currentSchemaConfig = warehouseConfig.config.schemas.find(
    (s) => s.schema_name === selectedSchema
  )

  return (
    <WarehouseDevContext.Provider value={contextValue}>
      <div className="min-h-screen p-6" style={{ background: 'var(--theme-bg)' }}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="glass-luxury-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold theme-text-primary">
                  Data Warehouse Explorer
                </h1>
                <p className="theme-text-secondary mt-1">
                  {warehouseConfig.organizationName || 'Organization'} – Query and explore synced
                  data
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-sm font-medium">
                  {warehouseConfig.config.schemas.length} Source
                  {warehouseConfig.config.schemas.length !== 1 ? 's' : ''}
                </div>
                <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-sm font-medium">
                  DEV
                </div>
              </div>
            </div>
          </div>

          {/* Data Source Selector */}
          <div className="glass-luxury-card p-6">
            <h2 className="text-lg font-medium theme-text-primary mb-4">Data Sources</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {warehouseConfig.config.schemas.map((schema) => {
                const sourceInfo = SOURCE_TYPE_LABELS[schema.source_type] || {
                  label: schema.source_type,
                  color: 'text-gray-400',
                }
                const isSelected = selectedSchema === schema.schema_name
                return (
                  <button
                    key={schema.schema_name}
                    onClick={() => setSelectedSchema(schema.schema_name)}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-sm font-medium', sourceInfo.color)}>
                        {sourceInfo.label}
                      </span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="font-medium theme-text-primary">{schema.display_name}</p>
                    <p className="text-xs font-mono theme-text-secondary mt-1">
                      {schema.schema_name}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
            {NAV_TABS.map((tab) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'theme-text-secondary hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>

          {/* Page Content */}
          {children}
        </div>
      </div>
    </WarehouseDevContext.Provider>
  )
}
