/**
 * Warehouse Access Control
 *
 * Handles organization-specific access to Redshift schemas.
 * Validates that users can only query schemas their organization has access to.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import { getUserProfile } from '@/lib/db/queries'
import { Organization } from '@/lib/data'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

export interface WarehouseSchema {
  schema_name: string
  source_type: 'business_central' | 'd365' | 'shopify' | 'meta_ads' | 'amazon' | 'tally' | 'manual'
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

export interface WarehouseAccessResult {
  hasAccess: boolean
  config?: WarehouseConfig
  organizationId?: string
  organizationName?: string
  error?: string
}

/**
 * Get organization's warehouse configuration from DynamoDB
 */
export async function getOrganizationWarehouseConfig(
  organizationId: string
): Promise<{ config: WarehouseConfig | null; orgName?: string }> {
  if (!ORGANIZATIONS_TABLE_NAME) {
    console.error('[WarehouseAccess] ORGANIZATIONS_TABLE_NAME not configured')
    return { config: null }
  }

  try {
    const pk = organizationId.startsWith('ORG#') ? organizationId : `ORG#${organizationId}`

    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: pk, SK: 'PROFILE' },
        ProjectionExpression: '#name, #warehouse_config',
        ExpressionAttributeNames: {
          '#name': 'name',
          '#warehouse_config': 'warehouse_config',
        },
      })
    )

    if (!result.Item) {
      console.warn(`[WarehouseAccess] No org record found for "${pk}"`)
      return { config: null }
    }

    return {
      config: result.Item.warehouse_config || null,
      orgName: result.Item.name,
    }
  } catch (error) {
    console.error(`[WarehouseAccess] Error fetching config for ${organizationId}:`, error)
    return { config: null }
  }
}

/**
 * Get warehouse access for a user
 * Returns the schemas they can query based on their organization
 */
export async function getWarehouseAccessForUser(userId: string): Promise<WarehouseAccessResult> {
  try {
    const userProfile = await getUserProfile(userId)

    if (!userProfile) {
      console.error(`[WarehouseAccess] User not found: ${userId}`)
      return { hasAccess: false, error: 'User profile not found' }
    }

    if (!userProfile.organizationId) {
      console.error(`[WarehouseAccess] No org for user: ${userId}`)
      return { hasAccess: false, error: 'User has no organization' }
    }

    const { config, orgName } = await getOrganizationWarehouseConfig(userProfile.organizationId)

    if (!config || !config.enabled) {
      return {
        hasAccess: false,
        organizationId: userProfile.organizationId,
        organizationName: orgName,
        error: 'Warehouse not enabled for this organization',
      }
    }

    if (!config.schemas || config.schemas.length === 0) {
      return {
        hasAccess: false,
        organizationId: userProfile.organizationId,
        organizationName: orgName,
        error: 'No warehouse schemas configured for this organization',
      }
    }

    return {
      hasAccess: true,
      config,
      organizationId: userProfile.organizationId,
      organizationName: orgName,
    }
  } catch (error) {
    console.error('[WarehouseAccess] Unexpected error:', error)
    return { hasAccess: false, error: 'Failed to verify warehouse access' }
  }
}

/**
 * Validate that a user can access a specific schema
 */
export function validateSchemaAccess(
  config: WarehouseConfig,
  schemaName: string
): { valid: boolean; error?: string } {
  const allowedSchemas = config.schemas.map((s) => s.schema_name)

  if (!allowedSchemas.includes(schemaName)) {
    return {
      valid: false,
      error: `Schema '${schemaName}' is not accessible. Allowed schemas: ${allowedSchemas.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Validate that a user can access a specific table within a schema
 * If the schema has specific tables configured, validate against that list
 */
export function validateTableAccess(
  config: WarehouseConfig,
  schemaName: string,
  tableName: string
): { valid: boolean; error?: string } {
  const schemaConfig = config.schemas.find((s) => s.schema_name === schemaName)

  if (!schemaConfig) {
    return { valid: false, error: `Schema '${schemaName}' is not accessible` }
  }

  // If specific tables are configured, validate against that list
  if (schemaConfig.tables && schemaConfig.tables.length > 0) {
    if (!schemaConfig.tables.includes(tableName)) {
      return {
        valid: false,
        error: `Table '${tableName}' is not accessible in schema '${schemaName}'`,
      }
    }
  }

  return { valid: true }
}

/**
 * Extract schema names from a SQL query to validate access.
 * Strips comments to prevent obfuscation, then matches schema.table patterns
 * after FROM, JOIN, and INTO keywords only.
 * Note: comma-separated FROM (e.g. FROM a, b) is NOT matched because commas
 * also appear in SELECT lists (e.g. h.col1, h.col2) causing false positives
 * with table aliases being misidentified as schemas.
 * CTEs are covered because their internal FROM/JOIN clauses are matched.
 */
export function extractSchemasFromQuery(query: string): string[] {
  const schemas: Set<string> = new Set()

  // Strip comments to prevent obfuscation like: FROM bc_globics/*hidden*/.table
  const strippedQuery = query
    .replace(/--[^\n]*/g, '')         // remove -- single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove /* */ multi-line comments

  // Match schema.table after FROM, JOIN, INTO keywords only
  // This catches CTEs since they contain FROM/JOIN internally
  const schemaTablePattern = /(?:FROM|JOIN|INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi
  let match

  while ((match = schemaTablePattern.exec(strippedQuery)) !== null) {
    schemas.add(match[1].toLowerCase())
  }

  return Array.from(schemas)
}

/**
 * Validate that a custom SQL query only accesses allowed schemas
 */
export function validateQuerySchemas(
  config: WarehouseConfig,
  query: string
): { valid: boolean; error?: string; schemas?: string[] } {
  const queriedSchemas = extractSchemasFromQuery(query)
  const allowedSchemas = config.schemas.map((s) => s.schema_name.toLowerCase())

  const disallowedSchemas = queriedSchemas.filter((s) => !allowedSchemas.includes(s))

  if (disallowedSchemas.length > 0) {
    return {
      valid: false,
      error: `Query references unauthorized schemas: ${disallowedSchemas.join(', ')}`,
      schemas: queriedSchemas,
    }
  }

  return { valid: true, schemas: queriedSchemas }
}
