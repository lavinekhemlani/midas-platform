'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/hooks/useSession'

/**
 * Unified BC connection type.
 * Supports both OAuth (direct BC API) and Warehouse (Fivetran/Redshift) connections.
 */
export interface BCConnection {
  /** Unique identifier - connectionId for OAuth, schema_name for warehouse */
  id: string
  /** Display name of the company */
  companyName: string
  /** Connection type determines which data fetching method to use */
  type: 'oauth' | 'warehouse'
  /** Whether this connection is currently active/connected */
  connected: boolean
  /** When the connection was established */
  connectedAt?: number
  /** Last sync timestamp (warehouse only) */
  lastSynced?: number
}

export interface UseBCConnectionResult {
  /** The currently active BC connection based on URL ?bc= param */
  activeConnection: BCConnection | null
  /** All available BC connections (both OAuth and warehouse) */
  allConnections: BCConnection[]
  /** The connection ID from URL (?bc= or legacy ?schema=) */
  connectionId: string | null
  /** Whether there are any BC connections */
  hasConnections: boolean
  /** Whether loading session data */
  isLoading: boolean
  /** Convenience: is the active connection OAuth type */
  isOAuth: boolean
  /** Convenience: is the active connection warehouse type */
  isWarehouse: boolean
}

/**
 * Unified hook for accessing BC connection context.
 *
 * Reads the ?bc= URL parameter (with fallback to legacy ?schema=) and
 * returns the appropriate connection details from organization data.
 *
 * Usage:
 * ```tsx
 * const { activeConnection, isOAuth, isWarehouse, allConnections } = useBCConnection()
 *
 * // Use different data fetching based on connection type
 * if (isOAuth) {
 *   // Fetch from BC API directly
 * } else if (isWarehouse) {
 *   // Query from Redshift warehouse
 * }
 * ```
 */
export function useBCConnection(): UseBCConnectionResult {
  const { organization, status } = useSession()
  const searchParams = useSearchParams()

  // Support ?connectionId= (used by sidebar/dashboard for BC OAuth),
  // ?bc= (buildBCUrl helper), and legacy ?schema= (warehouse)
  const connectionId =
    searchParams.get('connectionId') || searchParams.get('bc') || searchParams.get('schema')

  // Extract all BC connections from organization data
  const allConnections = useMemo(() => {
    const connections: BCConnection[] = []
    const dynamics = (organization?.providers as any)?.dynamics

    if (!dynamics) return connections

    // 1. Collect OAuth connections
    const oauthConns = dynamics.oauthConnections as Record<string, any> | undefined
    if (oauthConns) {
      for (const [connId, conn] of Object.entries(oauthConns)) {
        if (connId === '_pending_oauth') continue
        if (conn?.credentials?.connected) {
          connections.push({
            id: connId,
            companyName: conn.credentials.company_name || 'Business Central (OAuth)',
            type: 'oauth',
            connected: true,
            connectedAt: conn.connectedAt,
          })
        }
      }
    }

    // 2. Collect warehouse schemas
    const creds = dynamics.credentials
    if (creds?.connected) {
      const schemas = creds.schemas as any[] | undefined
      if (schemas && schemas.length > 0) {
        for (const schema of schemas) {
          const schemaName = schema.schema_name || 'default'
          // Avoid duplicates if OAuth connection has same ID (unlikely)
          if (!connections.find((c) => c.id === schemaName)) {
            connections.push({
              id: schemaName,
              companyName:
                schema.company_name || schema.schema_name || 'Business Central (Warehouse)',
              type: 'warehouse',
              connected: true,
              connectedAt: schema.connected_at,
              lastSynced: schema.last_synced,
            })
          }
        }
      }
    }

    return connections
  }, [organization])

  // Read the backend's activeConnectionId so we respect which connection the server considers active
  const serverActiveConnectionId = useMemo(() => {
    const dynamics = (organization?.providers as any)?.dynamics
    return (dynamics?.activeConnectionId as string) || null
  }, [organization])

  // Determine the active connection
  const activeConnection = useMemo(() => {
    if (allConnections.length === 0) return null

    // 1. URL param takes highest priority (?bc= or ?schema=)
    if (connectionId) {
      const match = allConnections.find((c) => c.id === connectionId)
      if (match) return match
    }

    // 2. Use the server-side activeConnectionId (stored in DynamoDB)
    if (serverActiveConnectionId) {
      const match = allConnections.find((c) => c.id === serverActiveConnectionId)
      if (match) return match
    }

    // 3. Final fallback: first OAuth connection, then first warehouse
    const oauthConn = allConnections.find((c) => c.type === 'oauth')
    if (oauthConn) return oauthConn

    return allConnections[0] || null
  }, [allConnections, connectionId, serverActiveConnectionId])

  const isLoading = status === 'loading'

  return {
    activeConnection,
    allConnections,
    connectionId,
    hasConnections: allConnections.length > 0,
    isLoading,
    isOAuth: activeConnection?.type === 'oauth',
    isWarehouse: activeConnection?.type === 'warehouse',
  }
}

/**
 * Build a BC route URL with the ?bc= parameter for the given connection.
 */
export function buildBCUrl(basePath: string, connectionId: string): string {
  if (!connectionId || connectionId === 'default') return basePath
  const separator = basePath.includes('?') ? '&' : '?'
  return `${basePath}${separator}bc=${encodeURIComponent(connectionId)}`
}
