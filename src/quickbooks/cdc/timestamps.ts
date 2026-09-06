/**
 * CDC Change Timestamps
 *
 * Stores last change timestamps per entity type in DynamoDB.
 * Used for polling-based change detection without Redis.
 *
 * Note: These functions handle the case where the nested path
 * (providers.quickbooks.changeTimestamps) doesn't exist yet by
 * first ensuring the structure exists before updating.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { QBWebhookEntityType } from '../types/events'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

/**
 * Change timestamps per entity type
 */
export type ChangeTimestamps = Partial<Record<QBWebhookEntityType, string>>

/**
 * Get change timestamps for an organization
 *
 * @param orgId - Organization ID (e.g., "ORG#abc123")
 * @returns Map of entity type → last change timestamp
 */
export async function getChangeTimestamps(orgId: string): Promise<ChangeTimestamps | null> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[CDC] ORGANIZATIONS_TABLE_NAME not configured')
    return null
  }

  try {
    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        ProjectionExpression: '#providers.#quickbooks.#changeTimestamps',
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#changeTimestamps': 'changeTimestamps',
        },
      })
    )

    return result.Item?.providers?.quickbooks?.changeTimestamps || {}
  } catch (error) {
    console.error(`[CDC] Error fetching change timestamps for ${orgId}:`, error)
    return null
  }
}

/**
 * Ensure the nested CDC structure exists in the organization document.
 * Creates providers.quickbooks.changeTimestamps if it doesn't exist.
 */
async function ensureCdcStructure(orgId: string): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) return false

  try {
    // Use if_not_exists to create the nested structure without overwriting existing data
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression: `
          SET #providers = if_not_exists(#providers, :emptyMap),
              #updatedAt = :now
        `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':emptyMap': {},
          ':now': Math.floor(Date.now() / 1000),
        },
      })
    )

    // Now ensure quickbooks exists under providers
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression: `
          SET #providers.#quickbooks = if_not_exists(#providers.#quickbooks, :emptyMap)
        `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
        },
        ExpressionAttributeValues: {
          ':emptyMap': {},
        },
      })
    )

    // Now ensure changeTimestamps exists under quickbooks
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression: `
          SET #providers.#quickbooks.#changeTimestamps = if_not_exists(#providers.#quickbooks.#changeTimestamps, :emptyMap)
        `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#changeTimestamps': 'changeTimestamps',
        },
        ExpressionAttributeValues: {
          ':emptyMap': {},
        },
      })
    )

    return true
  } catch (error) {
    console.error(`[CDC] Error ensuring CDC structure for ${orgId}:`, error)
    return false
  }
}

/**
 * Update change timestamp for a single entity type
 *
 * @param orgId - Organization ID
 * @param entityType - Entity type that changed
 * @param timestamp - ISO timestamp of the change (defaults to now)
 */
export async function updateChangeTimestamp(
  orgId: string,
  entityType: QBWebhookEntityType,
  timestamp?: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[CDC] ORGANIZATIONS_TABLE_NAME not configured')
    return false
  }

  const ts = timestamp || new Date().toISOString()

  try {
    // First attempt the update directly
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression: `
          SET #providers.#quickbooks.#changeTimestamps.#entityType = :timestamp,
              #providers.#quickbooks.#lastWebhookAt = :timestamp,
              #updatedAt = :now
        `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#quickbooks': 'quickbooks',
          '#changeTimestamps': 'changeTimestamps',
          '#entityType': entityType,
          '#lastWebhookAt': 'lastWebhookAt',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':timestamp': ts,
          ':now': Math.floor(Date.now() / 1000),
        },
      })
    )

    return true
  } catch (error: unknown) {
    // If the path doesn't exist, create it and retry
    const isValidationError =
      error instanceof Error &&
      (error.name === 'ValidationException' ||
        error.message.includes('document path provided in the update expression is invalid'))

    if (isValidationError) {
      console.log(`[CDC] Path doesn't exist for ${orgId}, creating structure...`)
      const structureCreated = await ensureCdcStructure(orgId)

      if (structureCreated) {
        // Retry the update
        try {
          await ddbDocClient.send(
            new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: orgId, SK: 'PROFILE' },
              UpdateExpression: `
                SET #providers.#quickbooks.#changeTimestamps.#entityType = :timestamp,
                    #providers.#quickbooks.#lastWebhookAt = :timestamp,
                    #updatedAt = :now
              `,
              ExpressionAttributeNames: {
                '#providers': 'providers',
                '#quickbooks': 'quickbooks',
                '#changeTimestamps': 'changeTimestamps',
                '#entityType': entityType,
                '#lastWebhookAt': 'lastWebhookAt',
                '#updatedAt': 'updated_at',
              },
              ExpressionAttributeValues: {
                ':timestamp': ts,
                ':now': Math.floor(Date.now() / 1000),
              },
            })
          )
          return true
        } catch (retryError) {
          console.error(`[CDC] Retry failed for ${orgId}/${entityType}:`, retryError)
          return false
        }
      }
    }

    console.error(`[CDC] Error updating change timestamp for ${orgId}/${entityType}:`, error)
    return false
  }
}

/**
 * Update change timestamps for multiple entity types
 *
 * @param orgId - Organization ID
 * @param changes - Map of entity type → timestamp
 */
export async function updateChangeTimestamps(
  orgId: string,
  changes: ChangeTimestamps
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[CDC] ORGANIZATIONS_TABLE_NAME not configured')
    return false
  }

  if (Object.keys(changes).length === 0) {
    return true
  }

  const now = new Date().toISOString()

  // Build update expression for all changed entity types
  const updateParts: string[] = [
    '#providers.#quickbooks.#lastWebhookAt = :now',
    '#updatedAt = :updatedAtNum',
  ]

  const expressionAttributeNames: Record<string, string> = {
    '#providers': 'providers',
    '#quickbooks': 'quickbooks',
    '#changeTimestamps': 'changeTimestamps',
    '#lastWebhookAt': 'lastWebhookAt',
    '#updatedAt': 'updated_at',
  }

  const expressionAttributeValues: Record<string, unknown> = {
    ':now': now,
    ':updatedAtNum': Math.floor(Date.now() / 1000),
  }

  // Add each entity type change
  Object.entries(changes).forEach(([entityType, timestamp], index) => {
    const nameKey = `#et${index}`
    const valueKey = `:ts${index}`

    expressionAttributeNames[nameKey] = entityType
    expressionAttributeValues[valueKey] = timestamp || now

    updateParts.push(`#providers.#quickbooks.#changeTimestamps.${nameKey} = ${valueKey}`)
  })

  try {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: orgId, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateParts.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    )

    return true
  } catch (error: unknown) {
    // If the path doesn't exist, create it and retry
    const isValidationError =
      error instanceof Error &&
      (error.name === 'ValidationException' ||
        error.message.includes('document path provided in the update expression is invalid'))

    if (isValidationError) {
      console.log(`[CDC] Path doesn't exist for ${orgId}, creating structure...`)
      const structureCreated = await ensureCdcStructure(orgId)

      if (structureCreated) {
        // Retry the update
        try {
          await ddbDocClient.send(
            new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: orgId, SK: 'PROFILE' },
              UpdateExpression: `SET ${updateParts.join(', ')}`,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues,
            })
          )
          return true
        } catch (retryError) {
          console.error(`[CDC] Retry failed for ${orgId}:`, retryError)
          return false
        }
      }
    }

    console.error(`[CDC] Error updating change timestamps for ${orgId}:`, error)
    return false
  }
}
