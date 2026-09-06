// src/app/api/providers/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getActiveProvider } from '@/lib/providers/active-provider'
import { listQBConnections } from '@/lib/providers/database'
import type { ProviderID } from '@/lib/providers/database'
import type { User, Organization } from '@/lib/data'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
}
const unmarshallOptions = {
  wrapNumbers: false,
}
const translateConfig = { marshallOptions, unmarshallOptions }
const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig)

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await TokenVerifier.verify(request)

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME) {
      console.error('[/api/providers/status] Table names not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Get user profile to get organization_id
    const getUserCommand = new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    })
    const { Item: userItem } = await ddbDocClient.send(getUserCommand)

    if (!userItem || !userItem.organization_id) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 })
    }

    const user = userItem as User

    // Get organization data
    // Note: user.organization_id already includes the 'ORG#' prefix
    const getOrgCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME,
      Key: { PK: user.organization_id, SK: 'PROFILE' },
    })
    const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)

    if (!orgItem) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const organization = orgItem as Organization

    // Get active provider (server-side version with org ID)
    const activeProvider = user.organization_id
      ? await getActiveProvider(user.organization_id)
      : null

    // Check if any provider is connected
    let connectedProvider: ProviderID | null = null
    let providerInfo = null

    // Helper to extract providerInfo from a provider entry (multi-entity aware)
    const extractProviderInfo = (providerId: string, provider: any) => {
      // Multi-entity QB: resolve from connections map
      if (providerId === 'quickbooks' && provider?.connections) {
        const activeRealmId = provider.activeRealmId
        let activeCreds = null
        if (activeRealmId && provider.connections[activeRealmId]?.credentials?.connected) {
          activeCreds = provider.connections[activeRealmId].credentials
        } else {
          // Find first connected entity
          for (const conn of Object.values(provider.connections) as any[]) {
            if (conn?.credentials?.connected) {
              activeCreds = conn.credentials
              break
            }
          }
        }
        if (activeCreds) {
          return {
            providerName: providerId,
            organizationName:
              activeCreds.company_name ||
              activeCreds.provider_organization_id ||
              activeCreds.realm_id ||
              null,
            connected: true,
            lastSync: activeCreds.last_synced || null,
            credentials: {
              connected: activeCreds.connected,
              expires_at: activeCreds.expires_at || null,
            },
          }
        }
      }

      // BC OAuth: check oauthConnections map
      if (providerId === 'dynamics' && provider?.oauthConnections) {
        const connectedOAuth = Object.entries(provider.oauthConnections).filter(
          ([key, conn]: [string, any]) =>
            key !== '_pending_oauth' && conn?.credentials?.connected === true
        )
        if (connectedOAuth.length > 0) {
          const [, firstConn] = connectedOAuth[0] as [string, any]
          return {
            providerName: providerId,
            organizationName:
              firstConn.credentials.company_name ||
              firstConn.credentials.provider_organization_id ||
              null,
            connected: true,
            lastSync: firstConn.credentials.last_synced || null,
            credentials: {
              connected: firstConn.credentials.connected,
              expires_at: firstConn.credentials.expires_at || null,
            },
          }
        }
      }

      // Legacy / other providers
      if (provider?.credentials?.connected) {
        return {
          providerName: providerId,
          organizationName:
            provider.credentials.provider_organization_id ||
            provider.credentials.realm_id ||
            provider.credentials.organization_id ||
            null,
          connected: true,
          lastSync: provider.credentials?.last_synced || null,
          credentials: {
            connected: provider.credentials.connected,
            expires_at: provider.credentials.expires_at || null,
          },
        }
      }

      return null
    }

    if (activeProvider && organization.providers?.[activeProvider]) {
      const provider = organization.providers[activeProvider]
      const info = extractProviderInfo(activeProvider, provider)
      if (info) {
        connectedProvider = activeProvider
        providerInfo = info
      }
    }

    // If no active provider, check all providers for any connected one
    if (!providerInfo && organization.providers) {
      for (const [providerId, provider] of Object.entries(organization.providers)) {
        const info = extractProviderInfo(providerId, provider as any)
        if (info) {
          connectedProvider = providerId as ProviderID
          providerInfo = info
          break
        }
      }
    }

    // For QuickBooks, include multi-entity connection summary
    let qbConnections = null
    if (connectedProvider === 'quickbooks' || organization.providers?.quickbooks) {
      try {
        const qbResult = await listQBConnections(user.organization_id)
        if (qbResult.connections.length > 0) {
          const connectedCount = qbResult.connections.filter((c) => c.connected).length
          const issueCount = qbResult.connections.filter((c) => !c.connected).length
          qbConnections = {
            activeRealmId: qbResult.activeRealmId,
            companyCount: qbResult.connections.length,
            connectedCount,
            issueCount,
            companies: qbResult.connections,
          }
        }
      } catch (qbError) {
        console.error('[/api/providers/status] Failed to get QB connections:', qbError)
      }
    }

    // Return status
    return NextResponse.json({
      connected: !!providerInfo,
      provider: providerInfo,
      activeProvider: connectedProvider,
      availableProviders: ['quickbooks', 'zoho', 'dynamics'], // List of supported providers
      qbConnections,
    })
  } catch (error) {
    console.error('[/api/providers/status] Error:', error)

    if (error instanceof Error && error.message.includes('Token')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to check provider status' }, { status: 500 })
  }
}
