'use client'

import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'

// ── Date Helpers ──────────────────────────────────────────────────────────────

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DatePreset {
  label: string
  getRange: () => { start: string; end: string }
}

const DATE_PRESETS: Record<string, DatePreset> = {
  thisMonth: {
    label: 'This Month',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastMonth: {
    label: 'Last Month',
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: formatDateISO(start), end: formatDateISO(end) }
    },
  },
  thisQuarter: {
    label: 'This Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3)
      return {
        start: formatDateISO(new Date(now.getFullYear(), q * 3, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastQuarter: {
    label: 'Last Quarter',
    getRange: () => {
      const now = new Date()
      const q = Math.floor(now.getMonth() / 3) - 1
      const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const qAdj = q < 0 ? 3 : q
      return {
        start: formatDateISO(new Date(y, qAdj * 3, 1)),
        end: formatDateISO(new Date(y, (qAdj + 1) * 3, 0)),
      }
    },
  },
  thisYear: {
    label: 'This Year',
    getRange: () => {
      const now = new Date()
      return {
        start: formatDateISO(new Date(now.getFullYear(), 0, 1)),
        end: formatDateISO(now),
      }
    },
  },
  lastYear: {
    label: 'Last Year',
    getRange: () => {
      const now = new Date()
      const y = now.getFullYear() - 1
      return {
        start: formatDateISO(new Date(y, 0, 1)),
        end: formatDateISO(new Date(y, 11, 31)),
      }
    },
  },
  allTime: {
    label: 'All Time',
    getRange: () => ({ start: '', end: '' }),
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BCOAuthConnection {
  connectionId: string
  companyName: string
  environmentName: string
  connected: boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

interface BCOAuthDevContextValue {
  connectionId: string
  connections: BCOAuthConnection[]
  startDate: string
  endDate: string
}

const BCOAuthDevContext = createContext<BCOAuthDevContextValue>({
  connectionId: '',
  connections: [],
  startDate: '',
  endDate: '',
})

export function useBCOAuthDev() {
  return useContext(BCOAuthDevContext)
}

// ── Navigation Tabs ───────────────────────────────────────────────────────────

const NAV_TABS = [
  { href: '/dev/bcoauth', label: 'Hub' },
  { href: '/dev/bcoauth/pnl', label: 'P&L' },
  { href: '/dev/bcoauth/cash-flow', label: 'Cash Flow' },
  { href: '/dev/bcoauth/inventory', label: 'Inventory' },
  { href: '/dev/bcoauth/aged-ar-ap', label: 'Aged AR/AP' },
  { href: '/dev/bcoauth/customer-detail', label: 'Customer Probe' },
  { href: '/dev/bcoauth/api', label: 'API & All Calls' },
  { href: '/dev/bcoauth/agent', label: 'Agent Tester' },
]

// ── Layout Component ──────────────────────────────────────────────────────────

export function BCOAuthDevLayout({ children }: { children: React.ReactNode }) {
  const { organization, status: sessionStatus } = useSession()
  const pathname = usePathname()

  // Connection state
  const [connections, setConnections] = useState<BCOAuthConnection[]>([])
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')

  // Period state
  const [selectedPreset, setSelectedPreset] = useState<string>('lastYear')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Initialize dates on mount
  useEffect(() => {
    const preset = DATE_PRESETS['lastYear']
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  // Extract BC OAuth connections from organization data
  useEffect(() => {
    if (!organization) return
    const dynamics = (organization as any)?.providers?.dynamics
    const oauthConns = dynamics?.oauthConnections as Record<string, any> | undefined
    if (!oauthConns) return

    const conns: BCOAuthConnection[] = []
    for (const [connId, conn] of Object.entries(oauthConns)) {
      if (connId === '_pending_oauth') continue
      conns.push({
        connectionId: connId,
        companyName: conn?.credentials?.company_name || connId,
        environmentName: conn?.credentials?.environment_name || '',
        connected: conn?.credentials?.connected === true,
      })
    }
    setConnections(conns)
    if (conns.length > 0 && !selectedConnectionId) {
      setSelectedConnectionId(conns[0].connectionId)
    }
  }, [organization, selectedConnectionId])

  const applyPreset = useCallback((key: string) => {
    setSelectedPreset(key)
    const preset = DATE_PRESETS[key]
    if (preset) {
      const { start, end } = preset.getRange()
      setStartDate(start)
      setEndDate(end)
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      connectionId: selectedConnectionId,
      connections,
      startDate,
      endDate,
    }),
    [selectedConnectionId, connections, startDate, endDate]
  )

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-luxury-card p-8 text-center">
          <h2 className="text-xl font-semibold theme-text-primary mb-2">Authentication Required</h2>
          <p className="theme-text-secondary">Please sign in to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <BCOAuthDevContext.Provider value={contextValue}>
      <div className="min-h-screen p-6" style={{ background: 'var(--theme-bg)' }}>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="glass-luxury-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold theme-text-primary">BC OAuth API Tester</h1>
                <p className="theme-text-secondary mt-1">
                  Test BC API endpoints, diagnose filter behavior, and preview financial reports.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
                  {connections.length} Connection{connections.length !== 1 ? 's' : ''}
                </span>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-medium">
                  DEV
                </span>
              </div>
            </div>
          </div>

          {/* Connection Selector */}
          <div className="glass-luxury-card p-6">
            <h2 className="text-lg font-medium theme-text-primary mb-4">BC OAuth Connection</h2>
            {connections.length === 0 ? (
              <p className="theme-text-secondary">
                No BC OAuth connections found. Connect via the settings page first.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {connections.map((conn) => (
                  <button
                    key={conn.connectionId}
                    onClick={() => setSelectedConnectionId(conn.connectionId)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      selectedConnectionId === conn.connectionId
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-medium ${conn.connected ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {conn.connected ? 'Connected' : 'Disconnected'}
                      </span>
                      {selectedConnectionId === conn.connectionId && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="font-medium theme-text-primary">{conn.companyName}</p>
                    <p className="text-xs font-mono theme-text-secondary mt-1">
                      {conn.connectionId}
                    </p>
                    {conn.environmentName && (
                      <p className="text-xs theme-text-secondary mt-0.5">
                        Env: {conn.environmentName}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Period Picker (hidden on agent page — it has its own inside query builder) */}
          {pathname !== '/dev/bcoauth/agent' && (
            <div className="glass-luxury-card p-6">
              <h2 className="text-lg font-medium theme-text-primary mb-4">Date Period</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(DATE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      selectedPreset === key
                        ? 'bg-blue-600 text-white'
                        : 'border border-white/10 theme-text-secondary hover:bg-white/5'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm theme-text-secondary mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setSelectedPreset('custom')
                    }}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm theme-text-secondary mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      setSelectedPreset('custom')
                    }}
                    className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>
            </div>
          )}

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
    </BCOAuthDevContext.Provider>
  )
}
