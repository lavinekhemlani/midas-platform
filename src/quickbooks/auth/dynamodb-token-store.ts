/**
 * DynamoDB Token Store for QuickBooks
 *
 * Implements TokenStore interface using the existing DynamoDB structure
 * where tokens are stored in the organization's profile under providers.quickbooks.credentials
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { TokenStore } from './token-manager'
import { logger } from '@/lib/logger'
import type { QBToken } from './oauth'
import { createOrgPK, normalizeOrgId } from '@/lib/db/keys'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)

/**
 * DynamoDB-backed token store for QuickBooks
 * Reads/writes tokens from the existing organization.providers.quickbooks.credentials structure
 */
export class DynamoDBTokenStore implements TokenStore {
  private tableName: string

  constructor(tableName?: string) {
    this.tableName = tableName || process.env.ORGANIZATIONS_TABLE_NAME || ''
    if (!this.tableName) {
      console.warn('[DynamoDBTokenStore] ORGANIZATIONS_TABLE_NAME not configured')
    }
  }

  /**
   * Get token for an organization from DynamoDB
   */
  async getToken(organizationId: string): Promise<QBToken | null> {
    if (!this.tableName) {
      console.error('[DynamoDBTokenStore] Table name not configured')
      return null
    }

    try {
      // Normalize the organization ID and create proper PK
      const normalizedOrgId = normalizeOrgId(organizationId)
      const pk = createOrgPK(normalizedOrgId)

      const { Item } = await ddbDocClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: 'PROFILE' },
          ConsistentRead: true,
        })
      )

      if (!Item) {
        console.log(`[DynamoDBTokenStore] Organization not found: ${pk}`)
        return null
      }

      // Get QuickBooks credentials from providers structure
      const credentials = Item.providers?.quickbooks?.credentials
      if (!credentials || !credentials.connected) {
        // console.log(`[DynamoDBTokenStore] QuickBooks not connected for: ${pk}`)
        logger.warn(`[DynamoDBTokenStore] QuickBooks not connected for: ${pk}`)
        return null
      }

      // Map DynamoDB structure to QBToken
      const token: QBToken = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token,
        expiresAt: credentials.expires_at,
        realmId: credentials.realm_id,
        createdAt: credentials.last_synced || Math.floor(Date.now() / 1000),
      }

      return token
    } catch (error) {
      console.error('[DynamoDBTokenStore] Error getting token:', error)
      return null
    }
  }

  /**
   * Store token for an organization in DynamoDB
   */
  async setToken(organizationId: string, token: QBToken): Promise<void> {
    if (!this.tableName) {
      throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
    }

    try {
      const normalizedOrgId = normalizeOrgId(organizationId)
      const pk = createOrgPK(normalizedOrgId)
      const now = Math.floor(Date.now() / 1000)

      // Build the full credentials object to set at once
      // This avoids issues with nested path not existing
      const credentials = {
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_at: token.expiresAt,
        realm_id: token.realmId,
        connected: true,
        last_synced: now,
      }

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: 'PROFILE' },
          UpdateExpression: `
            SET #providers.#quickbooks = if_not_exists(#providers.#quickbooks, :emptyMap),
                #providers.#quickbooks.#credentials = :credentials,
                #updatedAt = :updatedAt
          `,
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#credentials': 'credentials',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':credentials': credentials,
            ':updatedAt': now,
            ':emptyMap': {},
          },
        })
      )

      console.log(`[DynamoDBTokenStore] Token stored for: ${pk}`)
    } catch (error) {
      // If the above fails (providers might not exist), try creating the full structure
      if ((error as any)?.__type?.includes('ValidationException')) {
        console.log('[DynamoDBTokenStore] Nested path missing, creating full structure...')
        const normalizedOrgId = normalizeOrgId(organizationId)
        const pk = createOrgPK(normalizedOrgId)
        const now = Math.floor(Date.now() / 1000)

        const credentials = {
          access_token: token.accessToken,
          refresh_token: token.refreshToken,
          expires_at: token.expiresAt,
          realm_id: token.realmId,
          connected: true,
          last_synced: now,
        }

        await ddbDocClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: pk, SK: 'PROFILE' },
            UpdateExpression: `
              SET #providers = if_not_exists(#providers, :emptyMap),
                  #updatedAt = :updatedAt
            `,
            ExpressionAttributeNames: {
              '#providers': 'providers',
              '#updatedAt': 'updated_at',
            },
            ExpressionAttributeValues: {
              ':emptyMap': { quickbooks: { credentials } },
              ':updatedAt': now,
            },
          })
        )

        // Now set the nested value
        await ddbDocClient.send(
          new UpdateCommand({
            TableName: this.tableName,
            Key: { PK: pk, SK: 'PROFILE' },
            UpdateExpression: `
              SET #providers.#quickbooks.#credentials = :credentials,
                  #updatedAt = :updatedAt
            `,
            ExpressionAttributeNames: {
              '#providers': 'providers',
              '#quickbooks': 'quickbooks',
              '#credentials': 'credentials',
              '#updatedAt': 'updated_at',
            },
            ExpressionAttributeValues: {
              ':credentials': credentials,
              ':updatedAt': now,
            },
          })
        )

        console.log(`[DynamoDBTokenStore] Token stored (with structure creation) for: ${pk}`)
      } else {
        console.error('[DynamoDBTokenStore] Error storing token:', error)
        throw error
      }
    }
  }

  /**
   * Mark an organization as disconnected
   */
  async markDisconnected(organizationId: string, error: string): Promise<void> {
    if (!this.tableName) {
      console.error('[DynamoDBTokenStore] Table name not configured')
      return
    }

    try {
      const normalizedOrgId = normalizeOrgId(organizationId)
      const pk = createOrgPK(normalizedOrgId)
      const now = Math.floor(Date.now() / 1000)

      await ddbDocClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: 'PROFILE' },
          UpdateExpression: `
            SET #providers.#quickbooks.#credentials.#connected = :connected,
                #providers.#quickbooks.#credentials.#lastError = :error,
                #updatedAt = :updatedAt
          `,
          ExpressionAttributeNames: {
            '#providers': 'providers',
            '#quickbooks': 'quickbooks',
            '#credentials': 'credentials',
            '#connected': 'connected',
            '#lastError': 'lastError',
            '#updatedAt': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':connected': false,
            ':error': error,
            ':updatedAt': now,
          },
        })
      )

      console.log(`[DynamoDBTokenStore] Organization disconnected: ${pk}, reason: ${error}`)
    } catch (dbError) {
      console.error('[DynamoDBTokenStore] Error marking disconnected:', dbError)
    }
  }
}
