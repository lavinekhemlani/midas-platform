// src/lib/providers/database.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME

export interface ProviderCredentials {
  access_token: string
  refresh_token?: string
  expires_at: number
  connected: boolean
  last_synced: number
  home_currency?: string // Stored at connection time to avoid repeated API calls
  company_name?: string // Stored at connection time to avoid repeated API calls
  [key: string]: any // For provider-specific fields like realm_id for QuickBooks
}

export interface ProviderInfo {
  providerName: string
  credentials: ProviderCredentials
  // QuickBooks plan information
  plan?: 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown'
  planLastChecked?: number
  features?: string[]
  // Multi-entity QuickBooks support
  activeRealmId?: string
  connections?: Record<string, QBConnectionInfo>
}

export type QuickBooksPlanType = 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown'

export interface QBConnectionInfo {
  credentials: ProviderCredentials
  plan?: QuickBooksPlanType
  planLastChecked?: number
  features?: string[]
  connectedAt?: number
  connectedBy?: string
}

export interface QBConnectionSummary {
  realmId: string
  companyName: string | null
  currency: string | null
  connected: boolean
  lastSynced: number | null
  lastError: string | null
  isActive: boolean
}

export type ProviderID = 'zoho' | 'quickbooks' | 'xero' | 'stripe' | 'dynamics' | 'shopify'

export interface OAuthStateRecord {
  stateId: string
  nonce: string
  userId: string
  organizationId: string
  provider: string
  redirect: string
  timestamp: number
  expiresAt: number
  codeVerifier?: string // PKCE code verifier for Azure AD OAuth
  shopDomain?: string // Shopify store domain
  shopifyClientId?: string // Per-app Shopify Client ID (custom distribution)
  shopifyClientSecret?: string // Per-app Shopify Client Secret (custom distribution)
}

/**
 * Get provider credentials from database for a specific provider.
 * For QuickBooks: reads from connections[activeRealmId] first, falls back to legacy credentials.
 */
export async function getProviderCredentialsFromDB(
  organizationId: string,
  providerId: ProviderID
): Promise<ProviderCredentials | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) return null

    const providers = Item.providers
    if (!providers || !providers[providerId]) return null

    const providerData = providers[providerId]

    // Multi-entity QB: read from connections map
    if (providerId === 'quickbooks' && providerData.connections) {
      const activeRealmId = providerData.activeRealmId
      // Prefer activeRealmId if it points to a connected entry
      if (activeRealmId && providerData.connections[activeRealmId]?.credentials?.connected) {
        return providerData.connections[activeRealmId].credentials
      }
      // Fallback: find any connected entry in the connections map
      for (const conn of Object.values(providerData.connections) as QBConnectionInfo[]) {
        if (conn.credentials?.connected) {
          return conn.credentials
        }
      }
    }

    // Multi-store Shopify: read from connections map
    if (providerId === 'shopify' && providerData.connections) {
      const activeShopDomain = providerData.activeShopDomain
      if (activeShopDomain && providerData.connections[activeShopDomain]?.credentials?.connected) {
        return providerData.connections[activeShopDomain].credentials
      }
      // Fallback: find any connected entry
      for (const conn of Object.values(providerData.connections) as any[]) {
        if (conn?.credentials?.connected) {
          return conn.credentials
        }
      }
    }

    // Multi-connection BC OAuth: read from oauthConnections map
    if (providerId === 'dynamics' && providerData.oauthConnections) {
      const activeConnId = providerData.activeConnectionId
      // Prefer activeConnectionId if it points to a connected entry
      if (activeConnId && providerData.oauthConnections[activeConnId]?.credentials?.connected) {
        return providerData.oauthConnections[activeConnId].credentials
      }
      // Fallback: find any connected entry in the oauthConnections map
      for (const conn of Object.values(providerData.oauthConnections) as any[]) {
        if (conn?.credentials?.connected) {
          return conn.credentials
        }
      }
    }

    // Legacy fallback: single credentials object (faux_credentials for BC, others)
    if (providerData.credentials) {
      return providerData.credentials
    }

    return null
  } catch (error) {
    throw new Error(`Failed to fetch ${providerId} credentials: ${error}`)
  }
}

/**
 * Get full provider info including plan details.
 * For QuickBooks with multi-entity: returns ProviderInfo shaped from the active connection,
 * plus activeRealmId and connections for callers that need multi-entity awareness.
 */
export async function getProviderInfoFromDB(
  organizationId: string,
  providerId: ProviderID
): Promise<ProviderInfo | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) return null

    const providers = Item.providers
    if (!providers || !providers[providerId]) return null

    const providerData = providers[providerId]

    // Multi-entity QB: build ProviderInfo from active connection
    if (providerId === 'quickbooks' && providerData.connections) {
      const activeRealmId = providerData.activeRealmId
      let activeConn: QBConnectionInfo | null = null

      if (activeRealmId && providerData.connections[activeRealmId]) {
        activeConn = providerData.connections[activeRealmId]
      } else {
        // Fallback: first connected entry
        for (const conn of Object.values(providerData.connections) as QBConnectionInfo[]) {
          if (conn.credentials?.connected) {
            activeConn = conn
            break
          }
        }
      }

      if (activeConn) {
        return {
          providerName: providerData.providerName || 'QuickBooks Online',
          credentials: activeConn.credentials,
          plan: activeConn.plan,
          planLastChecked: activeConn.planLastChecked,
          features: activeConn.features,
          activeRealmId: activeRealmId || activeConn.credentials?.realm_id,
          connections: providerData.connections,
        }
      }
    }

    // Legacy fallback
    return providerData
  } catch (error) {
    throw new Error(`Failed to fetch ${providerId} info: ${error}`)
  }
}

/**
 * Store provider credentials in database
 */
export async function storeProviderCredentialsInDB(
  organizationId: string,
  providerId: ProviderID,
  providerName: string,
  credentials: Partial<ProviderCredentials>
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) {
      console.warn(
        `Cannot store ${providerId} credentials: Organization ${organizationId} not found`
      )
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {
      '#providers': 'providers',
      '#updatedAt': 'updated_at',
    }

    // Preserve the 'connected' value from credentials if provided, otherwise default to true
    const connectedValue = credentials.connected !== undefined ? credentials.connected : true

    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': now,
      ':providerInfo': {
        providerName,
        credentials: {
          ...credentials,
          connected: connectedValue, // Respect provided value
          last_synced: now,
        },
      },
    }

    // Update the providers map
    updateExpressions.push(`#providers.#${providerId} = :providerInfo`)
    expressionAttributeNames[`#${providerId}`] = providerId
    updateExpressions.push('#updatedAt = :updatedAt')

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'UPDATED_NEW',
      })
    )

    return true
  } catch (error) {
    throw new Error(`Failed to store ${providerId} credentials: ${error}`)
  }
}

/**
 * Remove provider credentials from database
 */
export async function removeProviderCredentialsFromDB(
  organizationId: string,
  providerId: ProviderID
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const now = Math.floor(Date.now() / 1000)

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `REMOVE #providers.#${providerId} SET #updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          [`#${providerId}`]: providerId,
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':updatedAt': now,
        },
        ReturnValues: 'UPDATED_NEW',
      })
    )

    return true
  } catch (error) {
    throw new Error(`Failed to remove ${providerId} credentials: ${error}`)
  }
}

/**
 * Store provider error in database
 */
export async function storeProviderError(
  organizationId: string,
  providerId: ProviderID,
  error: string
): Promise<void> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) {
      console.warn(`Cannot store ${providerId} error: Organization ${organizationId} not found`)
      return
    }

    const now = Math.floor(Date.now() / 1000)

    // Check if providers and the specific provider path exist to avoid ValidationException
    const existingProviders = Item.providers || {}
    const existingProvider = existingProviders[providerId] || {}
    const existingCredentials = existingProvider.credentials || {}

    // Build the updated structure
    const updatedCredentials = {
      ...existingCredentials,
      lastError: error,
      connected: false,
    }

    const updatedProvider = {
      ...existingProvider,
      credentials: updatedCredentials,
    }

    // If providers doesn't exist, create it
    if (!Item.providers) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers = :providers, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':providers': { [providerId]: updatedProvider },
            ':updatedAt': now,
          },
        })
      )
    } else {
      // providers exists, set the specific provider
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers.#providerId = :provider, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#providerId': providerId,
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':provider': updatedProvider,
            ':updatedAt': now,
          },
        })
      )
    }
  } catch (dbError) {
    console.error(`Failed to store ${providerId} error:`, dbError)
  }
}

/**
 * Get user organization ID
 * Returns active_organization_id if set (for multi-org users who switched orgs),
 * otherwise falls back to organization_id (primary/default org)
 */
export async function getUserOrganizationId(userId: string): Promise<string | null> {
  if (!USERS_TABLE_NAME) {
    throw new Error('USERS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
    )

    // Use active_organization_id if set (for multi-org users who switched orgs)
    // Otherwise fall back to organization_id (primary/default org)
    return (Item?.active_organization_id as string) || (Item?.organization_id as string) || null
  } catch (error) {
    throw new Error(`Failed to fetch user organization ID: ${error}`)
  }
}

/**
 * Store OAuth state for CSRF protection
 */
export async function storeOAuthState(state: OAuthStateRecord): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.warn('ORGANIZATIONS_TABLE_NAME not configured - using in-memory storage')
    return false
  }

  try {
    // Store state in DynamoDB with TTL
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `OAUTH_STATE#${state.stateId}`, SK: 'STATE' },
        UpdateExpression: 'SET #data = :data, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#data': 'data',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':data': state,
          ':ttl': Math.floor(state.expiresAt / 1000), // TTL in seconds
        },
      })
    )

    return true
  } catch (error) {
    console.error('Failed to store OAuth state:', error)
    return false
  }
}

/**
 * Retrieve and validate OAuth state
 */
export async function getOAuthState(stateId: string): Promise<OAuthStateRecord | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.warn('ORGANIZATIONS_TABLE_NAME not configured - using in-memory storage')
    return null
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `OAUTH_STATE#${stateId}`, SK: 'STATE' },
      })
    )

    if (!Item || !Item.data) {
      return null
    }

    const state = Item.data as OAuthStateRecord

    // Check if state has expired
    if (Date.now() > state.expiresAt) {
      // Clean up expired state
      await deleteOAuthState(stateId)
      return null
    }

    return state
  } catch (error) {
    console.error('Failed to retrieve OAuth state:', error)
    return null
  }
}

/**
 * Delete OAuth state after use
 */
export async function deleteOAuthState(stateId: string): Promise<void> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    return
  }

  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `OAUTH_STATE#${stateId}`, SK: 'STATE' },
        UpdateExpression: 'REMOVE #data',
        ExpressionAttributeNames: {
          '#data': 'data',
        },
      })
    )
  } catch (error) {
    console.error('Failed to delete OAuth state:', error)
  }
}

/**
 * Get all connected providers for an organization.
 * For QuickBooks multi-entity: considers QB "connected" if ANY connection in the map is connected.
 */
export async function getConnectedProviders(
  organizationId: string
): Promise<Partial<Record<ProviderID, ProviderInfo>>> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return {}

    const providers = Item.providers || {}
    const connectedProviders: Partial<Record<ProviderID, ProviderInfo>> = {}

    for (const [providerId, providerInfo] of Object.entries(providers)) {
      if (!providerInfo || typeof providerInfo !== 'object') continue

      const pInfo = providerInfo as any

      // Multi-entity QB: check if any connection in the map is connected
      if (providerId === 'quickbooks' && pInfo.connections) {
        const hasAnyConnected = Object.values(pInfo.connections).some(
          (conn: any) => conn?.credentials?.connected
        )
        if (hasAnyConnected) {
          // Build ProviderInfo from active connection
          const activeRealmId = pInfo.activeRealmId
          let activeCreds = null
          let activePlan = undefined
          let activePlanLastChecked = undefined
          let activeFeatures = undefined

          if (activeRealmId && pInfo.connections[activeRealmId]?.credentials?.connected) {
            const conn = pInfo.connections[activeRealmId]
            activeCreds = conn.credentials
            activePlan = conn.plan
            activePlanLastChecked = conn.planLastChecked
            activeFeatures = conn.features
          } else {
            // First connected entry
            for (const conn of Object.values(pInfo.connections) as QBConnectionInfo[]) {
              if (conn.credentials?.connected) {
                activeCreds = conn.credentials
                activePlan = conn.plan
                activePlanLastChecked = conn.planLastChecked
                activeFeatures = conn.features
                break
              }
            }
          }

          if (activeCreds) {
            connectedProviders[providerId as ProviderID] = {
              providerName: pInfo.providerName || 'QuickBooks Online',
              credentials: activeCreds,
              plan: activePlan,
              planLastChecked: activePlanLastChecked,
              features: activeFeatures,
              activeRealmId: activeRealmId,
              connections: pInfo.connections,
            }
          }
          continue
        }
      }

      // Dynamics BC: Check BOTH OAuth connections AND warehouse credentials
      // Both can coexist - user may have OAuth for direct API + warehouse for Fivetran data
      if (providerId === 'dynamics') {
        const hasAnyOAuthConnected =
          pInfo.oauthConnections &&
          Object.entries(pInfo.oauthConnections).some(
            ([key, conn]: [string, any]) => key !== '_pending_oauth' && conn?.credentials?.connected
          )
        const hasWarehouseConnected = pInfo.credentials?.connected

        // Provider is connected if EITHER OAuth OR warehouse (or both) are connected
        if (hasAnyOAuthConnected || hasWarehouseConnected) {
          // Determine which credentials to use as "active" - prefer OAuth if both exist
          let activeCreds = null
          let activeConnId = null

          if (hasAnyOAuthConnected) {
            activeConnId = pInfo.activeConnectionId
            if (
              activeConnId &&
              activeConnId !== '_pending_oauth' &&
              (pInfo.oauthConnections[activeConnId] as any)?.credentials?.connected
            ) {
              activeCreds = (pInfo.oauthConnections[activeConnId] as any).credentials
            } else {
              // Find first connected OAuth connection
              for (const [connId, conn] of Object.entries(pInfo.oauthConnections) as [
                string,
                any,
              ][]) {
                if (connId !== '_pending_oauth' && conn?.credentials?.connected) {
                  activeCreds = conn.credentials
                  activeConnId = connId
                  break
                }
              }
            }
          }

          // Fall back to warehouse credentials if no OAuth
          if (!activeCreds && hasWarehouseConnected) {
            activeCreds = pInfo.credentials
          }

          if (activeCreds) {
            connectedProviders[providerId as ProviderID] = {
              providerName: pInfo.providerName || 'Microsoft Dynamics 365 BC',
              credentials: activeCreds,
              activeRealmId: activeConnId,
              // Include both connection types so consumers know what's available
              oauthConnections: pInfo.oauthConnections,
              warehouseCredentials: hasWarehouseConnected ? pInfo.credentials : undefined,
            }
          }
          continue
        }
      }

      // Legacy / other providers: check credentials.connected
      if ('credentials' in pInfo && pInfo.credentials?.connected) {
        connectedProviders[providerId as ProviderID] = pInfo as ProviderInfo
      }
    }

    return connectedProviders
  } catch (error) {
    throw new Error(`Failed to fetch connected providers: ${error}`)
  }
}

/**
 * Get stored home currency for a provider
 * Returns null if not found or not stored
 */
export async function getProviderHomeCurrency(
  organizationId: string,
  providerId: ProviderID
): Promise<string | null> {
  const credentials = await getProviderCredentialsFromDB(organizationId, providerId)
  return credentials?.home_currency || null
}

/**
 * Get stored company name for a provider
 * Returns null if not found or not stored
 */
export async function getProviderCompanyName(
  organizationId: string,
  providerId: ProviderID
): Promise<string | null> {
  const credentials = await getProviderCredentialsFromDB(organizationId, providerId)
  return credentials?.company_name || null
}

/**
 * Get stored company metadata (currency and name) for a provider
 * Returns both values in a single DB call for efficiency
 */
export async function getProviderCompanyMetadata(
  organizationId: string,
  providerId: ProviderID
): Promise<{ homeCurrency: string | null; companyName: string | null }> {
  const credentials = await getProviderCredentialsFromDB(organizationId, providerId)
  return {
    homeCurrency: credentials?.home_currency || null,
    companyName: credentials?.company_name || null,
  }
}

/**
 * Update home currency for a provider
 * Used to store currency at connection time or update it later
 */
export async function updateProviderHomeCurrency(
  organizationId: string,
  providerId: ProviderID,
  homeCurrency: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const now = Math.floor(Date.now() / 1000)

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `SET #providers.#${providerId}.#credentials.#homeCurrency = :homeCurrency, #updatedAt = :updatedAt`,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          [`#${providerId}`]: providerId,
          '#credentials': 'credentials',
          '#homeCurrency': 'home_currency',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':homeCurrency': homeCurrency,
          ':updatedAt': now,
        },
        ConditionExpression: 'attribute_exists(#providers.#' + providerId + ')',
      })
    )

    return true
  } catch (error) {
    console.error(`Failed to update home currency for ${providerId}:`, error)
    return false
  }
}

/**
 * Update company metadata (currency and name) for a provider
 * Used to store both values at connection time in a single DB call
 */
export async function updateProviderCompanyMetadata(
  organizationId: string,
  providerId: ProviderID,
  metadata: { homeCurrency?: string; companyName?: string }
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  if (!metadata.homeCurrency && !metadata.companyName) {
    return true // Nothing to update
  }

  try {
    const now = Math.floor(Date.now() / 1000)

    const updateExpressions: string[] = ['#updatedAt = :updatedAt']
    const expressionAttributeNames: Record<string, string> = {
      '#providers': 'providers',
      [`#${providerId}`]: providerId,
      '#credentials': 'credentials',
      '#updatedAt': 'updated_at',
    }
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': now,
    }

    if (metadata.homeCurrency) {
      updateExpressions.push(
        '#providers.#' + providerId + '.#credentials.#homeCurrency = :homeCurrency'
      )
      expressionAttributeNames['#homeCurrency'] = 'home_currency'
      expressionAttributeValues[':homeCurrency'] = metadata.homeCurrency
    }

    if (metadata.companyName) {
      updateExpressions.push(
        '#providers.#' + providerId + '.#credentials.#companyName = :companyName'
      )
      expressionAttributeNames['#companyName'] = 'company_name'
      expressionAttributeValues[':companyName'] = metadata.companyName
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(#providers.#' + providerId + ')',
      })
    )

    return true
  } catch (error) {
    console.error(`Failed to update company metadata for ${providerId}:`, error)
    return false
  }
}

// ============================================================================
// Multi-Entity QuickBooks Functions
// ============================================================================

/**
 * Get QB credentials for a specific company (realmId).
 * Falls back to legacy credentials if connections map doesn't exist.
 */
export async function getQBConnectionCredentials(
  organizationId: string,
  realmId: string
): Promise<ProviderCredentials | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) return null

    const qb = Item.providers?.quickbooks
    if (!qb) return null

    // Check connections map first
    if (qb.connections?.[realmId]) {
      return qb.connections[realmId].credentials
    }

    // Legacy fallback: if the single credentials match this realmId
    if (qb.credentials?.realm_id === realmId) {
      return qb.credentials
    }

    return null
  } catch (error) {
    throw new Error(`Failed to fetch QB credentials for realm ${realmId}: ${error}`)
  }
}

/**
 * Store QB credentials for a specific company (realmId) in the connections map.
 * This is ADDITIVE — it doesn't affect other connections.
 * Auto-sets activeRealmId if this is the first connection.
 */
export async function storeQBConnectionCredentials(
  organizationId: string,
  realmId: string,
  providerName: string,
  credentials: Partial<ProviderCredentials>,
  userId?: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    // First, check if org exists and get current QB state
    // IMPORTANT: Use ConsistentRead to avoid race conditions during token refresh
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) {
      console.warn(`Cannot store QB credentials: Organization ${organizationId} not found`)
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const connectedValue = credentials.connected !== undefined ? credentials.connected : true

    const connectionInfo: QBConnectionInfo = {
      credentials: {
        ...credentials,
        connected: connectedValue,
        last_synced: now,
        realm_id: realmId,
        provider_organization_id: realmId,
      } as ProviderCredentials,
      connectedAt: now,
      connectedBy: userId || undefined,
    }

    const qb = Item.providers?.quickbooks
    const hasConnections = qb?.connections && Object.keys(qb.connections).length > 0
    const hasExistingActiveRealm = qb?.activeRealmId

    // Find any disconnected connections to clean up (e.g., from invalid_grant errors)
    const disconnectedRealmIds: string[] = []
    if (hasConnections) {
      for (const [existingRealmId, conn] of Object.entries(qb.connections)) {
        if ((conn as any)?.credentials?.connected === false && existingRealmId !== realmId) {
          disconnectedRealmIds.push(existingRealmId)
        }
      }
    }

    console.log('[storeQBConnectionCredentials]', {
      organizationId,
      realmId,
      hasQB: !!qb,
      hasConnections,
      existingConnectionCount: hasConnections ? Object.keys(qb.connections).length : 0,
      hasExistingActiveRealm: !!hasExistingActiveRealm,
      activeRealmId: qb?.activeRealmId,
      hasLegacyCredentials: !!qb?.credentials,
      legacyRealmId: qb?.credentials?.realm_id,
      hasProvidersMap: !!Item.providers,
      disconnectedToCleanup: disconnectedRealmIds,
    })

    // Build legacy credentials object to keep in sync (for backward compatibility)
    // IMPORTANT: We write BOTH connections map AND legacy credentials in a SINGLE atomic update
    // to prevent race conditions where another process reads stale legacy credentials
    const legacyCreds: Record<string, any> = {
      connected: connectedValue,
      realm_id: realmId,
      last_synced: now,
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expires_at: credentials.expires_at,
    }
    if (credentials.home_currency) legacyCreds.home_currency = credentials.home_currency
    if (credentials.company_name) legacyCreds.company_name = credentials.company_name

    // If no providers.quickbooks exists at all, initialize the full structure
    if (!qb) {
      console.log(
        '[storeQBConnectionCredentials] No QB exists, creating full structure with connections map'
      )
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers.#quickbooks = :qbData, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':qbData': {
              providerName,
              activeRealmId: realmId,
              connections: {
                [realmId]: connectionInfo,
              },
              // Include legacy credentials in the same atomic write
              credentials: legacyCreds,
            },
            ':updatedAt': now,
          },
        })
      )
      console.log(
        '[storeQBConnectionCredentials] Created QB with connections map, activeRealmId:',
        realmId
      )
      return true
    }

    // QB exists — add/update the specific connection AND legacy credentials in ONE atomic write
    // CRITICAL: Both must be written together to prevent race conditions during token refresh
    // Use expression attribute names to handle dynamic realmId key
    const updateExpressions: string[] = [
      '#providers.#quickbooks.#connections.#realmId = :connectionInfo',
      '#providers.#quickbooks.#providerName = :providerName',
      '#providers.#quickbooks.#creds = :legacyCreds', // Write legacy creds atomically with connections
      '#updatedAt = :updatedAt',
    ]

    const expressionAttributeNames: Record<string, string> = {
      '#providers': 'providers',
      '#quickbooks': 'quickbooks',
      '#connections': 'connections',
      '#realmId': realmId,
      '#providerName': 'providerName',
      '#creds': 'credentials',
      '#updatedAt': 'updated_at',
    }

    const expressionAttributeValues: Record<string, any> = {
      ':connectionInfo': connectionInfo,
      ':providerName': providerName,
      ':legacyCreds': legacyCreds,
      ':updatedAt': now,
    }

    // Set activeRealmId if this is the first connection or none set
    if (!hasExistingActiveRealm) {
      updateExpressions.push('#providers.#quickbooks.#activeRealmId = :activeRealmId')
      expressionAttributeNames['#activeRealmId'] = 'activeRealmId'
      expressionAttributeValues[':activeRealmId'] = realmId
    }

    // Ensure connections map exists if it doesn't
    if (!hasConnections) {
      console.log('[storeQBConnectionCredentials] No connections map, initializing empty map')
      // Initialize connections map first, then set the specific key
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression:
            'SET #providers.#quickbooks.#connections = if_not_exists(#providers.#quickbooks.#connections, :emptyMap)',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#connections': 'connections',
          },
          ExpressionAttributeValues: {
            ':emptyMap': {},
          },
        })
      )
    }

    console.log('[storeQBConnectionCredentials] Storing connection for realm', realmId, {
      updateExpression: `SET ${updateExpressions.join(', ')}`,
      settingActiveRealmId: !hasExistingActiveRealm,
      atomicLegacySync: true, // Both connections and legacy written together
    })

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    console.log(
      '[storeQBConnectionCredentials] Successfully stored connection + legacy credentials for realm',
      realmId
    )

    // Clean up any disconnected connections (e.g., from invalid_grant errors)
    // This prevents stale disconnected accounts from cluttering the UI
    if (disconnectedRealmIds.length > 0) {
      console.log(
        '[storeQBConnectionCredentials] Cleaning up disconnected connections:',
        disconnectedRealmIds
      )
      for (const disconnectedRealmId of disconnectedRealmIds) {
        try {
          await ddbDocClient.send(
            new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: `${organizationId}`, SK: 'PROFILE' },
              UpdateExpression: 'REMOVE #providers.#quickbooks.#connections.#realmId',
              ExpressionAttributeNames: {
                '#providers': 'providers',
                '#quickbooks': 'quickbooks',
                '#connections': 'connections',
                '#realmId': disconnectedRealmId,
              },
            })
          )
          console.log(
            '[storeQBConnectionCredentials] Cleaned up disconnected connection:',
            disconnectedRealmId
          )
        } catch (cleanupErr) {
          // Non-fatal - log and continue
          console.warn(
            '[storeQBConnectionCredentials] Failed to cleanup disconnected connection:',
            disconnectedRealmId,
            cleanupErr
          )
        }
      }
    }

    return true
  } catch (error) {
    console.error('[storeQBConnectionCredentials] FAILED:', error)
    throw new Error(`Failed to store QB credentials for realm ${realmId}: ${error}`)
  }
}

/**
 * Store Shopify connection credentials using the shop domain as the connection key.
 * Supports multiple stores per organization — each store is stored under its domain
 * in a connections map (same pattern as QB multi-entity).
 */
export async function storeShopifyConnectionCredentials(
  organizationId: string,
  shopDomain: string,
  providerName: string,
  credentials: Partial<ProviderCredentials>,
  userId?: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) {
      console.warn(`Cannot store Shopify credentials: Organization ${organizationId} not found`)
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const connectedValue = credentials.connected !== undefined ? credentials.connected : true

    const connectionInfo = {
      credentials: {
        ...credentials,
        connected: connectedValue,
        last_synced: now,
        shop_domain: shopDomain,
      } as ProviderCredentials,
      connectedAt: now,
      connectedBy: userId || undefined,
    }

    const shopify = Item.providers?.shopify
    const hasConnections = shopify?.connections && Object.keys(shopify.connections).length > 0

    // Legacy credentials for backward compat with getProviderCredentialsFromDB fallback
    const legacyCreds: Record<string, any> = {
      connected: connectedValue,
      shop_domain: shopDomain,
      last_synced: now,
      access_token: credentials.access_token,
    }
    if (credentials.refresh_token) legacyCreds.refresh_token = credentials.refresh_token
    if (credentials.expires_at) legacyCreds.expires_at = credentials.expires_at

    // If no providers.shopify exists, create the full structure
    if (!shopify) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers.#shopify = :shopifyData, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#shopify': 'shopify',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':shopifyData': {
              providerName,
              activeShopDomain: shopDomain,
              connections: {
                [shopDomain]: connectionInfo,
              },
              credentials: legacyCreds,
            },
            ':updatedAt': now,
          },
        })
      )
      console.log(
        '[storeShopifyConnectionCredentials] Created Shopify with connections map, activeShopDomain:',
        shopDomain
      )
      return true
    }

    // Shopify exists — add/update the specific connection
    const updateExpressions: string[] = [
      '#providers.#shopify.#connections.#shopDomain = :connectionInfo',
      '#providers.#shopify.#providerName = :providerName',
      '#providers.#shopify.#creds = :legacyCreds',
      '#providers.#shopify.#activeShopDomain = :activeShopDomain',
      '#updatedAt = :updatedAt',
    ]

    const expressionAttributeNames: Record<string, string> = {
      '#providers': 'providers',
      '#shopify': 'shopify',
      '#connections': 'connections',
      '#shopDomain': shopDomain,
      '#providerName': 'providerName',
      '#creds': 'credentials',
      '#activeShopDomain': 'activeShopDomain',
      '#updatedAt': 'updated_at',
    }

    const expressionAttributeValues: Record<string, any> = {
      ':connectionInfo': connectionInfo,
      ':providerName': providerName,
      ':legacyCreds': legacyCreds,
      ':activeShopDomain': shopDomain,
      ':updatedAt': now,
    }

    // Ensure connections map exists
    if (!hasConnections) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression:
            'SET #providers.#shopify.#connections = if_not_exists(#providers.#shopify.#connections, :emptyMap)',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#shopify': 'shopify',
            '#connections': 'connections',
          },
          ExpressionAttributeValues: {
            ':emptyMap': {},
          },
        })
      )
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    console.log('[storeShopifyConnectionCredentials] Stored connection for shop:', shopDomain)
    return true
  } catch (error) {
    console.error('[storeShopifyConnectionCredentials] FAILED:', error)
    throw new Error(`Failed to store Shopify credentials for shop ${shopDomain}: ${error}`)
  }
}

/**
 * Get Shopify connection credentials for a specific shop domain.
 */
export async function getShopifyConnectionCredentials(
  organizationId: string,
  shopDomain: string
): Promise<ProviderCredentials | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) return null

    const shopify = Item.providers?.shopify
    if (!shopify) return null

    if (shopify.connections?.[shopDomain]) {
      return shopify.connections[shopDomain].credentials
    }

    // Legacy fallback: single credentials matching this domain
    if (shopify.credentials?.shop_domain === shopDomain) {
      return shopify.credentials
    }

    return null
  } catch (error) {
    throw new Error(`Failed to fetch Shopify credentials for shop ${shopDomain}: ${error}`)
  }
}

/**
 * Remove a specific QB connection by realmId.
 * If the removed connection was the active one, auto-promotes the next healthy connection.
 * Returns the new activeRealmId (or null if no connections remain).
 */
export async function removeQBConnection(
  organizationId: string,
  realmId: string
): Promise<{ success: boolean; newActiveRealmId: string | null; remainingCount: number }> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) {
      return { success: false, newActiveRealmId: null, remainingCount: 0 }
    }

    const qb = Item.providers?.quickbooks
    if (!qb?.connections?.[realmId]) {
      return { success: false, newActiveRealmId: null, remainingCount: 0 }
    }

    const now = Math.floor(Date.now() / 1000)
    const wasActive = qb.activeRealmId === realmId

    // Remove the connection
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression:
          'REMOVE #providers.#quickbooks.#connections.#realmId SET #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#connections': 'connections',
          '#realmId': realmId,
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':updatedAt': now,
        },
      })
    )

    // Calculate remaining connections
    const remaining = { ...qb.connections }
    delete remaining[realmId]
    const remainingCount = Object.keys(remaining).length

    // If the removed connection was active, promote the next healthy one
    let newActiveRealmId: string | null = qb.activeRealmId
    if (wasActive) {
      newActiveRealmId = null
      // Find next connected entry
      for (const [rId, conn] of Object.entries(remaining)) {
        if ((conn as QBConnectionInfo).credentials?.connected) {
          newActiveRealmId = rId
          break
        }
      }

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: newActiveRealmId
            ? 'SET #providers.#quickbooks.#activeRealmId = :newActive'
            : 'REMOVE #providers.#quickbooks.#activeRealmId',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#activeRealmId': 'activeRealmId',
          },
          ...(newActiveRealmId
            ? { ExpressionAttributeValues: { ':newActive': newActiveRealmId } }
            : {}),
        })
      )
    }

    // If no connections remain, remove the entire quickbooks provider entry
    if (remainingCount === 0) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'REMOVE #providers.#quickbooks SET #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':updatedAt': now,
          },
        })
      )
    }

    return { success: true, newActiveRealmId, remainingCount }
  } catch (error) {
    throw new Error(`Failed to remove QB connection for realm ${realmId}: ${error}`)
  }
}

/**
 * Remove a specific Shopify connection by shop domain.
 * If the removed connection was the active one, auto-promotes the next healthy connection.
 * If no connections remain, removes the entire shopify provider entry.
 * Returns the new activeShopDomain (or null if no connections remain).
 */
export async function removeShopifyConnection(
  organizationId: string,
  shopDomain: string
): Promise<{ success: boolean; newActiveShopDomain: string | null; remainingCount: number }> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) {
      return { success: false, newActiveShopDomain: null, remainingCount: 0 }
    }

    const shopify = Item.providers?.shopify
    if (!shopify?.connections?.[shopDomain]) {
      return { success: false, newActiveShopDomain: null, remainingCount: 0 }
    }

    const now = Math.floor(Date.now() / 1000)
    const wasActive = shopify.activeShopDomain === shopDomain

    // Remove the connection
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression:
          'REMOVE #providers.#shopify.#connections.#shopDomain SET #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#shopify': 'shopify',
          '#connections': 'connections',
          '#shopDomain': shopDomain,
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':updatedAt': now,
        },
      })
    )

    // Calculate remaining connections
    const remaining = { ...shopify.connections }
    delete remaining[shopDomain]
    const remainingCount = Object.keys(remaining).length

    // If the removed connection was active, promote the next healthy one
    let newActiveShopDomain: string | null = shopify.activeShopDomain
    if (wasActive) {
      newActiveShopDomain = null
      // Find next connected entry
      for (const [domain, conn] of Object.entries(remaining)) {
        if ((conn as any).credentials?.connected) {
          newActiveShopDomain = domain
          break
        }
      }

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: newActiveShopDomain
            ? 'SET #providers.#shopify.#activeShopDomain = :newActive, #providers.#shopify.#creds = :legacyCreds'
            : 'REMOVE #providers.#shopify.#activeShopDomain, #providers.#shopify.#creds',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#shopify': 'shopify',
            '#activeShopDomain': 'activeShopDomain',
            '#creds': 'credentials',
          },
          ...(newActiveShopDomain
            ? {
                ExpressionAttributeValues: {
                  ':newActive': newActiveShopDomain,
                  ':legacyCreds': (remaining[newActiveShopDomain] as any)?.credentials || {},
                },
              }
            : {}),
        })
      )
    }

    // If no connections remain, remove the entire shopify provider entry
    if (remainingCount === 0) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'REMOVE #providers.#shopify SET #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#shopify': 'shopify',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':updatedAt': now,
          },
        })
      )
    }

    return { success: true, newActiveShopDomain, remainingCount }
  } catch (error) {
    throw new Error(`Failed to remove Shopify connection for shop ${shopDomain}: ${error}`)
  }
}

/**
 * Set the active QB company (realmId) for an organization.
 * Validates that the realmId exists in the connections map.
 */
export async function setActiveRealmId(organizationId: string, realmId: string): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return false

    const qb = Item.providers?.quickbooks
    if (!qb?.connections?.[realmId]) {
      console.warn(`Cannot set active realm: ${realmId} not found in connections`)
      return false
    }

    const now = Math.floor(Date.now() / 1000)

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression:
          'SET #providers.#quickbooks.#activeRealmId = :realmId, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#activeRealmId': 'activeRealmId',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':realmId': realmId,
          ':updatedAt': now,
        },
      })
    )

    return true
  } catch (error) {
    console.error(`Failed to set active realm ID: ${error}`)
    return false
  }
}

/**
 * Get the active realmId for QB.
 * Falls back to legacy credentials.realm_id if no connections map exists.
 */
export async function getActiveRealmId(organizationId: string): Promise<string | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return null

    const qb = Item.providers?.quickbooks
    if (!qb) return null

    // Multi-entity: use activeRealmId
    if (qb.activeRealmId) return qb.activeRealmId

    // Legacy fallback
    if (qb.credentials?.realm_id) return qb.credentials.realm_id

    return null
  } catch (error) {
    throw new Error(`Failed to get active realm ID: ${error}`)
  }
}

/**
 * List all QB connections for an organization with per-entity health status.
 * Returns an array of QBConnectionSummary for UI rendering.
 */
export async function listQBConnections(
  organizationId: string
): Promise<{ activeRealmId: string | null; connections: QBConnectionSummary[] }> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return { activeRealmId: null, connections: [] }

    const qb = Item.providers?.quickbooks
    if (!qb) return { activeRealmId: null, connections: [] }

    const activeRealmId = qb.activeRealmId || null
    const connections: QBConnectionSummary[] = []

    if (qb.connections) {
      for (const [realmId, conn] of Object.entries(qb.connections)) {
        const c = conn as QBConnectionInfo
        connections.push({
          realmId,
          companyName: c.credentials?.company_name || null,
          currency: c.credentials?.home_currency || null,
          connected: c.credentials?.connected || false,
          lastSynced: c.credentials?.last_synced || null,
          lastError: c.credentials?.lastError || null,
          isActive: realmId === activeRealmId,
        })
      }
    } else if (qb.credentials?.realm_id) {
      // Legacy single-connection format
      connections.push({
        realmId: qb.credentials.realm_id,
        companyName: qb.credentials.company_name || null,
        currency: qb.credentials.home_currency || null,
        connected: qb.credentials.connected || false,
        lastSynced: qb.credentials.last_synced || null,
        lastError: qb.credentials.lastError || null,
        isActive: true,
      })
    }

    return { activeRealmId, connections }
  } catch (error) {
    throw new Error(`Failed to list QB connections: ${error}`)
  }
}

/**
 * Migrate a legacy single-connection QB org to multi-entity format.
 * Moves credentials into connections[realmId] and sets activeRealmId.
 * Idempotent — safe to call multiple times.
 */
export async function migrateToMultiEntity(organizationId: string): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return false

    const qb = Item.providers?.quickbooks
    if (!qb) return false

    // Already migrated
    if (qb.connections && Object.keys(qb.connections).length > 0) {
      return true
    }

    // No legacy credentials to migrate
    if (!qb.credentials?.realm_id) {
      return false
    }

    const realmId = qb.credentials.realm_id
    const now = Math.floor(Date.now() / 1000)

    const connectionInfo: QBConnectionInfo = {
      credentials: { ...qb.credentials },
      plan: qb.plan,
      planLastChecked: qb.planLastChecked,
      features: qb.features,
      connectedAt: qb.credentials.last_synced || now,
    }

    // Set connections map + activeRealmId, keep legacy credentials for safety
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression:
          'SET #providers.#quickbooks.#connections = :connections, #providers.#quickbooks.#activeRealmId = :activeRealmId, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#connections': 'connections',
          '#activeRealmId': 'activeRealmId',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':connections': { [realmId]: connectionInfo },
          ':activeRealmId': realmId,
          ':updatedAt': now,
        },
      })
    )

    return true
  } catch (error) {
    console.error(`Failed to migrate org ${organizationId} to multi-entity:`, error)
    return false
  }
}

/**
 * Store an error for a specific QB connection (by realmId).
 * Only marks that specific entity as disconnected, not the whole provider.
 */
export async function storeQBConnectionError(
  organizationId: string,
  realmId: string,
  error: string
): Promise<void> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return

    const qb = Item.providers?.quickbooks
    const now = Math.floor(Date.now() / 1000)

    // Multi-entity: update specific connection
    if (qb?.connections?.[realmId]) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression:
            'SET #providers.#quickbooks.#connections.#realmId.#credentials.#lastError = :error, #providers.#quickbooks.#connections.#realmId.#credentials.#connected = :connected, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#connections': 'connections',
            '#realmId': realmId,
            '#credentials': 'credentials',
            '#lastError': 'lastError',
            '#connected': 'connected',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':error': error,
            ':connected': false,
            ':updatedAt': now,
          },
        })
      )
      return
    }

    // Legacy fallback: use the existing storeProviderError behavior
    await storeProviderError(organizationId, 'quickbooks', error)
  } catch (dbError) {
    console.error(`Failed to store QB connection error for realm ${realmId}:`, dbError)
  }
}

/**
 * Update company metadata for a specific QB connection.
 */
export async function updateQBConnectionMetadata(
  organizationId: string,
  realmId: string,
  metadata: { homeCurrency?: string; companyName?: string }
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  if (!metadata.homeCurrency && !metadata.companyName) return true

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    if (!Item) return false

    const qb = Item.providers?.quickbooks
    const now = Math.floor(Date.now() / 1000)

    // Multi-entity: update specific connection
    if (qb?.connections?.[realmId]) {
      const updateExpressions: string[] = ['#updatedAt = :updatedAt']
      const expressionAttributeNames: Record<string, string> = {
        '#providers': 'providers',
        '#quickbooks': 'quickbooks',
        '#connections': 'connections',
        '#realmId': realmId,
        '#credentials': 'credentials',
        '#updatedAt': 'updated_at',
      }
      const expressionAttributeValues: Record<string, any> = {
        ':updatedAt': now,
      }

      if (metadata.homeCurrency) {
        updateExpressions.push(
          '#providers.#quickbooks.#connections.#realmId.#credentials.#homeCurrency = :homeCurrency'
        )
        expressionAttributeNames['#homeCurrency'] = 'home_currency'
        expressionAttributeValues[':homeCurrency'] = metadata.homeCurrency
      }

      if (metadata.companyName) {
        updateExpressions.push(
          '#providers.#quickbooks.#connections.#realmId.#credentials.#companyName = :companyName'
        )
        expressionAttributeNames['#companyName'] = 'company_name'
        expressionAttributeValues[':companyName'] = metadata.companyName
      }

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        })
      )

      return true
    }

    // Legacy fallback
    return updateProviderCompanyMetadata(organizationId, 'quickbooks', metadata)
  } catch (error) {
    console.error(`Failed to update QB connection metadata for realm ${realmId}:`, error)
    return false
  }
}

// ─── Business Central OAuth Connection Functions ────────────────────────────────

/**
 * Get BC OAuth connection credentials for a specific connectionId.
 * connectionId format: "{environmentName}_{companyId}"
 */
export async function getBCConnectionCredentials(
  organizationId: string,
  connectionId: string
): Promise<ProviderCredentials | null> {
  if (!ORGANIZATIONS_TABLE_NAME) return null

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) return null

    const conn = Item.providers?.dynamics?.oauthConnections?.[connectionId]
    if (!conn?.credentials) return null

    return conn.credentials as ProviderCredentials
  } catch (error) {
    console.error(`Failed to get BC connection credentials for ${connectionId}:`, error)
    return null
  }
}

/**
 * Store BC OAuth connection credentials (additive — doesn't overwrite other connections).
 * Mirrors storeQBConnectionCredentials pattern.
 */
export async function storeBCConnectionCredentials(
  organizationId: string,
  connectionId: string,
  providerName: string,
  credentials: Partial<ProviderCredentials>,
  userId?: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item) {
      console.warn(`Cannot store BC credentials: Organization ${organizationId} not found`)
      return false
    }

    const now = Math.floor(Date.now() / 1000)
    const connectedValue = credentials.connected !== undefined ? credentials.connected : true

    const connectionInfo = {
      credentials: {
        ...credentials,
        connected: connectedValue,
        last_synced: now,
      } as ProviderCredentials,
      connectedAt: now,
      connectedBy: userId || undefined,
    }

    const existingProviders = Item.providers || {}
    const existingDynamics = existingProviders.dynamics || {}
    const existingConnections = existingDynamics.oauthConnections || {}
    const hasActiveConnection = !!existingDynamics.activeConnectionId

    // Build updated connections map
    const updatedConnections = {
      ...existingConnections,
      [connectionId]: connectionInfo,
    }

    // Set as active if no active connection exists (but not _pending_oauth)
    const activeConnectionId = hasActiveConnection
      ? existingDynamics.activeConnectionId
      : connectionId === '_pending_oauth'
        ? null
        : connectionId

    console.log('[storeBCConnectionCredentials]', {
      organizationId,
      connectionId,
      hasExistingConnections: Object.keys(existingConnections).length,
      activeConnectionId,
      hasExistingProviders: !!Item.providers,
      hasExistingDynamics: !!existingProviders.dynamics,
    })

    // Build the complete dynamics object to avoid nested path issues
    // DynamoDB throws ValidationException if intermediate paths (providers.dynamics) don't exist
    const updatedDynamics = {
      ...existingDynamics,
      providerName,
      authType: 'oauth',
      oauthConnections: updatedConnections,
      activeConnectionId,
    }

    // If providers doesn't exist at all, we need to create the whole structure
    if (!Item.providers) {
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers = :providers',
          ExpressionAttributeNames: {
            '#providers': 'providers',
          },
          ExpressionAttributeValues: {
            ':providers': { dynamics: updatedDynamics },
          },
        })
      )
    } else {
      // providers exists, set dynamics directly
      await ddbDocClient.send(
        new UpdateCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: `${organizationId}`, SK: 'PROFILE' },
          UpdateExpression: 'SET #providers.#dynamics = :dynamics',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#dynamics': 'dynamics',
          },
          ExpressionAttributeValues: {
            ':dynamics': updatedDynamics,
          },
        })
      )
    }

    return true
  } catch (error) {
    console.error(`Failed to store BC connection credentials for ${connectionId}:`, error)
    return false
  }
}

/**
 * Set the active BC OAuth connection
 */
export async function setActiveBCConnection(
  organizationId: string,
  connectionId: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) return false

  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET providers.dynamics.activeConnectionId = :connId',
        ExpressionAttributeValues: { ':connId': connectionId },
      })
    )
    return true
  } catch (error) {
    console.error(`Failed to set active BC connection:`, error)
    return false
  }
}

/**
 * Get the active BC OAuth connection ID
 */
export async function getActiveBCConnectionId(organizationId: string): Promise<string | null> {
  if (!ORGANIZATIONS_TABLE_NAME) return null

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    return Item?.providers?.dynamics?.activeConnectionId || null
  } catch (error) {
    console.error(`Failed to get active BC connection ID:`, error)
    return null
  }
}

/**
 * List all BC OAuth connections for an organization
 */
export async function listBCConnections(organizationId: string): Promise<{
  activeConnectionId: string | null
  connections: Array<{
    connectionId: string
    companyName: string
    environmentName: string
    connected: boolean
    connectedAt?: number
  }>
}> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    return { activeConnectionId: null, connections: [] }
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )

    const dynamics = Item?.providers?.dynamics
    if (!dynamics?.oauthConnections) {
      return { activeConnectionId: null, connections: [] }
    }

    const connections = Object.entries(dynamics.oauthConnections).map(
      ([connId, conn]: [string, any]) => ({
        connectionId: connId,
        companyName: conn?.credentials?.company_name || connId,
        environmentName: conn?.credentials?.environment_name || 'Unknown',
        connected: conn?.credentials?.connected || false,
        connectedAt: conn?.connectedAt,
      })
    )

    return {
      activeConnectionId: dynamics.activeConnectionId || null,
      connections,
    }
  } catch (error) {
    console.error(`Failed to list BC connections:`, error)
    return { activeConnectionId: null, connections: [] }
  }
}

/**
 * Store an error for a specific BC OAuth connection
 */
export async function storeBCConnectionError(
  organizationId: string,
  connectionId: string,
  errorMessage: string
): Promise<void> {
  if (!ORGANIZATIONS_TABLE_NAME) return

  try {
    const now = Math.floor(Date.now() / 1000)

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `
          SET providers.dynamics.oauthConnections.#connId.credentials.connected = :false,
              providers.dynamics.oauthConnections.#connId.credentials.#err = :errMsg,
              providers.dynamics.oauthConnections.#connId.credentials.error_message = :errMsg,
              providers.dynamics.oauthConnections.#connId.credentials.last_error_at = :now
        `,
        ExpressionAttributeNames: {
          '#connId': connectionId,
          '#err': 'error',
        },
        ExpressionAttributeValues: {
          ':false': false,
          ':errMsg': errorMessage,
          ':now': now,
        },
      })
    )
  } catch (error) {
    console.error(`Failed to store BC connection error for ${connectionId}:`, error)
  }
}

/**
 * Remove a specific BC OAuth connection.
 * If the removed connection was active, promote another connected one.
 */
export async function removeBCConnection(
  organizationId: string,
  connectionId: string
): Promise<{ success: boolean; newActiveConnectionId: string | null; remainingCount: number }> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    return { success: false, newActiveConnectionId: null, remainingCount: 0 }
  }

  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        ConsistentRead: true,
      })
    )

    if (!Item?.providers?.dynamics?.oauthConnections) {
      return { success: false, newActiveConnectionId: null, remainingCount: 0 }
    }

    const connections = { ...Item.providers.dynamics.oauthConnections }
    delete connections[connectionId]

    const remainingCount = Object.keys(connections).length
    const wasActive = Item.providers.dynamics.activeConnectionId === connectionId

    // Promote next connected connection if the active one was removed
    let newActiveConnectionId: string | null = null
    if (wasActive && remainingCount > 0) {
      for (const [connId, conn] of Object.entries(connections)) {
        if ((conn as any)?.credentials?.connected) {
          newActiveConnectionId = connId
          break
        }
      }
    } else if (!wasActive) {
      newActiveConnectionId = Item.providers.dynamics.activeConnectionId
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression: `
          SET providers.dynamics.oauthConnections = :connections,
              providers.dynamics.activeConnectionId = :activeConnId
        `,
        ExpressionAttributeValues: {
          ':connections': connections,
          ':activeConnId': newActiveConnectionId,
        },
      })
    )

    return { success: true, newActiveConnectionId, remainingCount }
  } catch (error) {
    console.error(`Failed to remove BC connection ${connectionId}:`, error)
    return { success: false, newActiveConnectionId: null, remainingCount: 0 }
  }
}
