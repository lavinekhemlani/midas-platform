// src/lib/zoho-dynamo.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { ZohoError } from './types'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const API_TIMEOUT = 10000

// Simple in-memory cache to prevent duplicate requests
const requestCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60000 // 1 minute cache for organization data
const REQUEST_QUEUE = new Map<string, Promise<any>>() // Prevent concurrent identical requests

interface ZohoTokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
  organizationId?: string
}

// Add this function after the interfaces
function getCacheKey(organizationId: string, endpoint: string): string {
  return `${organizationId}:${endpoint}`
}

export async function getZohoTokensFromDB(organizationId: string): Promise<ZohoTokenData | null> {
  if (!ORGANIZATIONS_TABLE_NAME) throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )
    const credentials = Item?.zoho_credentials
    if (!credentials?.access_token || !credentials?.refresh_token) return null
    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiresAt: credentials.expires_at || 0,
      organizationId,
    }
  } catch (error) {
    throw new ZohoError('Failed to fetch Zoho tokens', { cause: error })
  }
}

export async function storeZohoTokensInDB(
  organizationId: string,
  tokens: Partial<ZohoTokenData>
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )
    if (!Item) {
      console.warn(`Cannot store Zoho tokens: Organization ${organizationId} not found`)
      return false
    }
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {
      '#zohoCredentials': 'zoho_credentials',
      '#updatedAt': 'updated_at',
    }
    const expressionAttributeValues: Record<string, any> = {
      ':lastSynced': Math.floor(Date.now() / 1000),
      ':connected': true,
      ':updatedAt': Math.floor(Date.now() / 1000),
    }
    if (tokens.accessToken) {
      updateExpressions.push('#zohoCredentials.#accessToken = :accessToken')
      expressionAttributeNames['#accessToken'] = 'access_token'
      expressionAttributeValues[':accessToken'] = tokens.accessToken
    }
    if (tokens.refreshToken) {
      updateExpressions.push('#zohoCredentials.#refreshToken = :refreshToken')
      expressionAttributeNames['#refreshToken'] = 'refresh_token'
      expressionAttributeValues[':refreshToken'] = tokens.refreshToken
    }
    if (tokens.expiresAt) {
      updateExpressions.push('#zohoCredentials.#expiresAt = :expiresAt')
      expressionAttributeNames['#expiresAt'] = 'expires_at'
      expressionAttributeValues[':expiresAt'] = tokens.expiresAt
    }
    updateExpressions.push(
      '#zohoCredentials.#lastSynced = :lastSynced',
      '#zohoCredentials.#connected = :connected',
      '#updatedAt = :updatedAt'
    )
    expressionAttributeNames['#lastSynced'] = 'last_synced'
    expressionAttributeNames['#connected'] = 'connected'
    if (updateExpressions.length === 0) return false
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
    throw new ZohoError('Failed to store Zoho tokens', { cause: error })
  }
}

export async function getUserOrganizationId(userId: string): Promise<string | null> {
  if (!USERS_TABLE_NAME) throw new Error('USERS_TABLE_NAME not configured')
  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({ TableName: USERS_TABLE_NAME, Key: { PK: `USER#${userId}`, SK: 'PROFILE' } })
    )
    // Use active_organization_id if set (for multi-org users who switched orgs)
    // Otherwise fall back to organization_id (primary/default org)
    return (Item?.active_organization_id as string) || (Item?.organization_id as string) || null
  } catch (error) {
    throw new ZohoError('Failed to fetch user organization ID', { cause: error })
  }
}

export async function storeZohoError(organizationId: string, error: string): Promise<void> {
  if (!ORGANIZATIONS_TABLE_NAME) throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  try {
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
      })
    )
    if (!Item) {
      console.warn(`Cannot store Zoho error: Organization ${organizationId} not found`)
      return
    }
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: `${organizationId}`, SK: 'PROFILE' },
        UpdateExpression:
          'SET #zohoCredentials.#lastError = :error, #zohoCredentials.#connected = :connected, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#zohoCredentials': 'zoho_credentials',
          '#lastError': 'lastError',
          '#connected': 'connected',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':error': error,
          ':connected': false,
          ':updatedAt': Math.floor(Date.now() / 1000),
        },
      })
    )
  } catch (dbError) {
    console.error('Failed to store Zoho error:', dbError)
  }
}

export async function refreshZohoTokens(organizationId: string): Promise<ZohoTokenData | null> {
  const currentTokens = await getZohoTokensFromDB(organizationId)
  if (!currentTokens?.refreshToken)
    throw new ZohoError(`No refresh token available for organization: ${organizationId}`)
  const {
    ZOHO_CLIENT_ID: clientId,
    ZOHO_CLIENT_SECRET: clientSecret,
    ZOHO_DOMAIN: domain,
  } = process.env
  if (!clientId || !clientSecret || !domain)
    throw new ZohoError('Missing Zoho environment variables for token refresh')
  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentTokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)
    const response = await fetch(`https://${domain}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if (!response.ok)
      throw new ZohoError(`Token refresh failed: ${response.status}`, {
        cause: new Error(await response.text()),
      })
    const tokenData = await response.json()
    const newTokens: ZohoTokenData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || currentTokens.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + tokenData.expires_in,
      organizationId,
    }
    await storeZohoTokensInDB(organizationId, newTokens)
    return newTokens
  } catch (error) {
    await storeZohoError(organizationId, error instanceof Error ? error.message : 'Unknown error')
    throw new ZohoError('Failed to refresh Zoho tokens', { cause: error })
  }
}

export function areTokensExpired(expiresAt: number): boolean {
  return Date.now() / 1000 >= expiresAt - 120
}

export async function getValidZohoToken(organizationId: string): Promise<string> {
  let tokens = await getZohoTokensFromDB(organizationId)
  if (!tokens) throw new ZohoError(`No tokens found for organization: ${organizationId}`)
  if (!areTokensExpired(tokens.expiresAt)) return tokens.accessToken
  tokens = await refreshZohoTokens(organizationId)
  if (!tokens) throw new ZohoError(`Failed to refresh tokens for organization: ${organizationId}`)
  return tokens.accessToken
}

// Modified callZohoAPIWithOrg with caching and deduplication
export async function callZohoAPIWithOrg<T>(
  organizationId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const cacheKey = getCacheKey(organizationId, endpoint)

  // Check if we're already making this exact request
  const existingRequest = REQUEST_QUEUE.get(cacheKey)
  if (existingRequest) {
    console.log(`Deduplicating request to: ${endpoint}`)
    return existingRequest
  }

  // Check cache for organization endpoints (they rarely change)
  if (endpoint === '/organizations' || endpoint.startsWith('/organizations/')) {
    const cached = requestCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`Returning cached data for: ${endpoint}`)
      return cached.data
    }
  }

  // Create the request promise
  const requestPromise = (async () => {
    try {
      const token = await getValidZohoToken(organizationId)

      // Clean and validate endpoint
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

      // Check for invalid characters or malformed paths
      if (cleanEndpoint.includes('//') || cleanEndpoint.includes(' ')) {
        console.error('Malformed endpoint:', cleanEndpoint)
        throw new ZohoError(`Malformed API endpoint: ${cleanEndpoint}`)
      }

      const apiUrl = `https://www.zohoapis.com/books/v3${cleanEndpoint}`

      // Validate URL before making request
      try {
        new URL(apiUrl)
      } catch (urlError) {
        console.error('Invalid URL constructed:', apiUrl)
        throw new ZohoError(`Invalid API URL: ${apiUrl}`, { cause: urlError })
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

      console.log(`Making Zoho API call to: ${apiUrl}`)
      const response = await fetch(apiUrl, {
        ...options,
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Zoho API error ${response.status}:`, errorText)

        if (response.status === 401) {
          await storeZohoError(organizationId, `API call unauthorized: ${response.status}`)
        } else if (response.status === 404) {
          console.warn(`Zoho API endpoint not found (404): ${apiUrl}`)
          await storeZohoError(organizationId, `API endpoint not available: ${cleanEndpoint}`)
        }

        throw new ZohoError(`Zoho API call failed: ${response.status}`, {
          cause: new Error(errorText),
        })
      }

      const data = (await response.json()) as T

      // Cache organization data
      if (endpoint === '/organizations' || endpoint.startsWith('/organizations/')) {
        requestCache.set(cacheKey, { data, timestamp: Date.now() })
      }

      return data
    } finally {
      // Remove from request queue
      REQUEST_QUEUE.delete(cacheKey)
    }
  })()

  // Store in request queue
  REQUEST_QUEUE.set(cacheKey, requestPromise)

  return requestPromise
}

// Add cleanup function to be called periodically
export function cleanupCache() {
  const now = Date.now()
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      requestCache.delete(key)
    }
  }
}
