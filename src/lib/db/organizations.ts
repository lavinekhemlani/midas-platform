/**
 * Organization Database Helpers
 *
 * Functions for querying organizations, including lookup by QuickBooks realm ID
 * for webhook processing.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

/**
 * Organization record with QuickBooks connection info
 */
export interface OrganizationWithQB {
  PK: string // ORG#<uuid>
  SK: string
  name?: string
  providers?: {
    quickbooks?: {
      providerName: string
      credentials: {
        realm_id?: string
        connected: boolean
        company_name?: string
        [key: string]: any
      }
    }
  }
}

// Simple in-memory cache for realm-to-org mapping
// TTL: 5 minutes to handle org reconnections
const realmCache = new Map<string, { orgId: string; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get organization by QuickBooks realm ID
 *
 * Used by webhook handler to route incoming events to the correct organization.
 * Uses in-memory cache to avoid repeated DB scans.
 *
 * Note: For production at scale, consider adding a GSI on providers.quickbooks.credentials.realm_id
 *
 * @param realmId - QuickBooks company/realm ID
 * @returns Organization record or null if not found
 */
export async function getOrganizationByRealmId(
  realmId: string
): Promise<OrganizationWithQB | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[Organizations] ORGANIZATIONS_TABLE_NAME not configured')
    return null
  }

  if (!realmId) {
    return null
  }

  // Check cache first
  const cached = realmCache.get(realmId)
  if (cached && cached.expiresAt > Date.now()) {
    // Return cached org by fetching it
    return getOrganizationById(cached.orgId)
  }

  try {
    // Try multi-entity connections map first, then fall back to legacy credentials
    // Check connections map: providers.quickbooks.connections.{realmId} exists
    let result = await ddbDocClient.send(
      new ScanCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        FilterExpression:
          'attribute_exists(#providers.#quickbooks.#connections.#realmId) AND #sk = :profile',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#connections': 'connections',
          '#realmId': realmId,
          '#sk': 'SK',
        },
        ExpressionAttributeValues: {
          ':profile': 'PROFILE',
        },
        Limit: 1,
      })
    )

    // Fall back to legacy credentials.realm_id
    if (!result.Items || result.Items.length === 0) {
      result = await ddbDocClient.send(
        new ScanCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          FilterExpression:
            '#providers.#quickbooks.#credentials.#realmIdField = :realmId AND #sk = :profile',
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#credentials': 'credentials',
            '#realmIdField': 'realm_id',
            '#sk': 'SK',
          },
          ExpressionAttributeValues: {
            ':realmId': realmId,
            ':profile': 'PROFILE',
          },
          Limit: 1,
        })
      )
    }

    if (!result.Items || result.Items.length === 0) {
      console.warn(`[Organizations] No organization found for realm ${realmId}`)
      return null
    }

    const org = result.Items[0] as OrganizationWithQB

    // Update cache
    realmCache.set(realmId, {
      orgId: org.PK,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return org
  } catch (error) {
    console.error(`[Organizations] Error looking up org by realm ${realmId}:`, error)
    return null
  }
}

/**
 * Get organization by ID (PK)
 */
export async function getOrganizationById(orgId: string): Promise<OrganizationWithQB | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[Organizations] ORGANIZATIONS_TABLE_NAME not configured')
    return null
  }

  try {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
      })
    )

    return (result.Item as OrganizationWithQB) || null
  } catch (error) {
    console.error(`[Organizations] Error fetching org ${orgId}:`, error)
    return null
  }
}

/**
 * Clear the realm-to-org cache
 * Call this when an organization disconnects from QuickBooks
 */
export function clearRealmCache(realmId?: string): void {
  if (realmId) {
    realmCache.delete(realmId)
  } else {
    realmCache.clear()
  }
}

/**
 * Get sync cursors for an organization
 * Returns the last sync timestamps for each entity type
 */
export async function getOrganizationSyncCursors(
  orgId: string
): Promise<Record<string, string> | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    return null
  }

  try {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        ProjectionExpression: '#providers.#quickbooks.#syncCursors',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#syncCursors': 'syncCursors',
        },
      })
    )

    return result.Item?.providers?.quickbooks?.syncCursors || null
  } catch (error) {
    console.error(`[Organizations] Error fetching sync cursors for ${orgId}:`, error)
    return null
  }
}

/**
 * Update sync cursor for an entity type
 */
export async function updateOrganizationSyncCursor(
  orgId: string,
  entityType: string,
  timestamp: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    return false
  }

  try {
    const { UpdateCommand } = await import('@aws-sdk/lib-dynamodb')

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression:
          'SET #providers.#quickbooks.#syncCursors.#entityType = :timestamp, #updatedAt = :now',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#syncCursors': 'syncCursors',
          '#entityType': entityType,
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':timestamp': timestamp,
          ':now': Math.floor(Date.now() / 1000),
        },
      })
    )

    return true
  } catch (error) {
    console.error(`[Organizations] Error updating sync cursor for ${orgId}/${entityType}:`, error)
    return false
  }
}
