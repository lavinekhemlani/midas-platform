// src/app/api/providers/dynamics/disconnect/route.ts
//
// IMPORTANT: BC OAuth and BC Warehouse are COMPLETELY INDEPENDENT.
// - OAuth = Direct Microsoft BC API access (stored in oauthConnections)
// - Warehouse = Fivetran/Redshift sync (stored in credentials + warehouse_config)
//
// Disconnecting one should NEVER affect the other.

import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { TokenVerifier } from '@/lib/auth'
import { getUserOrganizationId } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME

/**
 * Check if any other providers are connected (excluding the one being disconnected)
 */
function checkOtherConnectedProviders(
  orgItem: any,
  excludeOAuth: boolean,
  excludeWarehouse: boolean
): boolean {
  const dynamicsProvider = orgItem.providers?.dynamics

  // Check if BC OAuth remains connected (if not being excluded)
  if (!excludeOAuth && dynamicsProvider?.oauthConnections) {
    const hasOAuth = Object.values(dynamicsProvider.oauthConnections).some(
      (c: any) => c?.credentials?.connected
    )
    if (hasOAuth) return true
  }

  // Check if BC Warehouse remains connected (if not being excluded)
  if (!excludeWarehouse && dynamicsProvider?.credentials?.connected) {
    return true
  }

  // Check other providers
  if (orgItem.providers) {
    for (const [provId, provInfo] of Object.entries(orgItem.providers)) {
      if (provId === 'dynamics') continue

      // Multi-entity QB
      if (provId === 'quickbooks' && (provInfo as any)?.connections) {
        const hasQBConnected = Object.values((provInfo as any).connections).some(
          (c: any) => c?.credentials?.connected
        )
        if (hasQBConnected) return true
      }

      // Other providers
      if ((provInfo as any)?.credentials?.connected) {
        return true
      }
    }
  }

  return false
}

/**
 * Update onboarding audit when no providers remain connected
 */
async function resetOnboardingIfNeeded(userId: string): Promise<void> {
  try {
    const { Item: userItem } = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
    )

    if (userItem?.onboarding_audit) {
      const onboardingAudit = userItem.onboarding_audit
      const hasConnectStep =
        onboardingAudit.completed_steps?.includes('connect') ||
        onboardingAudit.completed_steps?.includes('provider_connect')

      if (!onboardingAudit.completed_at && hasConnectStep) {
        onboardingAudit.completed_steps = onboardingAudit.completed_steps.filter(
          (step: string) => step !== 'connect' && step !== 'provider_connect'
        )
        onboardingAudit.current_step = 'connect'

        await ddbDocClient.send(
          new UpdateCommand({
            TableName: process.env.USERS_TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
            UpdateExpression: 'SET #onboardingAudit = :onboardingAudit, #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#onboardingAudit': 'onboarding_audit',
              '#updatedAt': 'updated_at',
            },
            ExpressionAttributeValues: {
              ':onboardingAudit': onboardingAudit,
              ':updatedAt': Math.floor(Date.now() / 1000),
            },
          })
        )
      }
    }
  } catch (error) {
    logger.error('Failed to update user onboarding audit', { error })
  }
}

/**
 * Disconnect a single OAuth connection (does NOT touch warehouse)
 */
async function disconnectOAuthConnection(
  organizationId: string,
  connectionId: string,
  orgItem: any,
  userId: string
): Promise<NextResponse> {
  const { removeBCConnection } = await import('@/lib/providers/database')
  await removeBCConnection(organizationId, connectionId)

  logger.info('Dynamics BC OAuth connection disconnected', {
    organizationId,
    connectionId,
  })

  // Check remaining connections
  const hasOtherProviders = checkOtherConnectedProviders(orgItem, false, false)

  if (!hasOtherProviders) {
    // Re-check after removal
    const { listBCConnections } = await import('@/lib/providers/database')
    const remaining = await listBCConnections(organizationId)
    const hasRemainingOAuth = remaining.connections.some((c) => c.connected)
    const hasWarehouse = orgItem.providers?.dynamics?.credentials?.connected

    if (!hasRemainingOAuth && !hasWarehouse) {
      await resetOnboardingIfNeeded(userId)
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Dynamics BC OAuth connection disconnected',
    disconnectedType: 'oauth',
    hasOtherProviders,
  })
}

/**
 * Disconnect all OAuth connections (does NOT touch warehouse)
 */
async function disconnectAllOAuth(
  organizationId: string,
  orgItem: any,
  userId: string
): Promise<NextResponse> {
  const dynamicsProvider = orgItem.providers?.dynamics
  const now = Math.floor(Date.now() / 1000)

  if (!ORGANIZATIONS_TABLE) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  // Clear only OAuth-related fields
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGANIZATIONS_TABLE,
      Key: { PK: organizationId, SK: 'PROFILE' },
      UpdateExpression: `
        SET #providers.#dynamics.#oauthConns = :emptyOAuth,
            #providers.#dynamics.#activeConnId = :nullConnId,
            #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#providers': 'providers',
        '#dynamics': 'dynamics',
        '#oauthConns': 'oauthConnections',
        '#activeConnId': 'activeConnectionId',
        '#updatedAt': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':emptyOAuth': {},
        ':nullConnId': null,
        ':updatedAt': now,
      },
    })
  )

  logger.info('All Dynamics BC OAuth connections disconnected', { organizationId })

  // Check if warehouse or other providers remain
  const hasOtherProviders = checkOtherConnectedProviders(orgItem, true, false)

  if (!hasOtherProviders) {
    await resetOnboardingIfNeeded(userId)
  }

  return NextResponse.json({
    success: true,
    message: 'All Dynamics BC OAuth connections disconnected',
    disconnectedType: 'oauth',
    hasOtherProviders,
  })
}

/**
 * Disconnect a single warehouse schema (does NOT touch OAuth)
 */
async function disconnectWarehouseSchema(
  organizationId: string,
  schemaName: string,
  orgItem: any,
  userId: string
): Promise<NextResponse> {
  const dynamicsProvider = orgItem.providers?.dynamics
  const now = Math.floor(Date.now() / 1000)

  if (!ORGANIZATIONS_TABLE) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  // Remove schema from credentials.schemas
  const currentSchemas: Array<{ schema_name: string; [key: string]: any }> =
    dynamicsProvider?.credentials?.schemas || []
  const updatedSchemas = currentSchemas.filter((s) => s.schema_name !== schemaName)
  const stillConnected = updatedSchemas.length > 0

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGANIZATIONS_TABLE,
      Key: { PK: organizationId, SK: 'PROFILE' },
      UpdateExpression: `
        SET #providers.#dynamics.#credentials.#connected = :connected,
            #providers.#dynamics.#credentials.#schemas = :schemas,
            #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#providers': 'providers',
        '#dynamics': 'dynamics',
        '#credentials': 'credentials',
        '#connected': 'connected',
        '#schemas': 'schemas',
        '#updatedAt': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':connected': stillConnected,
        ':schemas': updatedSchemas,
        ':updatedAt': now,
      },
    })
  )

  // Remove from warehouse_config
  const warehouseConfig = orgItem.warehouse_config || { schemas: [] }
  if (warehouseConfig.schemas) {
    warehouseConfig.schemas = warehouseConfig.schemas.filter(
      (s: any) => s.schema_name !== schemaName
    )

    if (warehouseConfig.default_schema === schemaName) {
      warehouseConfig.default_schema = warehouseConfig.schemas[0]?.schema_name || null
    }

    if (warehouseConfig.schemas.length === 0) {
      warehouseConfig.enabled = false
      warehouseConfig.default_schema = null
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { PK: organizationId, SK: 'PROFILE' },
        UpdateExpression: 'SET #warehouseConfig = :warehouseConfig',
        ExpressionAttributeNames: {
          '#warehouseConfig': 'warehouse_config',
        },
        ExpressionAttributeValues: {
          ':warehouseConfig': warehouseConfig,
        },
      })
    )
  }

  logger.info('Dynamics BC warehouse schema disconnected', {
    organizationId,
    schemaName,
  })

  // Check if OAuth or other providers remain
  const hasOtherProviders = checkOtherConnectedProviders(orgItem, false, !stillConnected)

  if (!hasOtherProviders && !stillConnected) {
    await resetOnboardingIfNeeded(userId)
  }

  return NextResponse.json({
    success: true,
    message: 'Dynamics BC warehouse schema disconnected',
    disconnectedType: 'warehouse',
    hasOtherProviders: hasOtherProviders || stillConnected,
  })
}

/**
 * Disconnect all warehouse schemas (does NOT touch OAuth)
 */
async function disconnectAllWarehouse(
  organizationId: string,
  orgItem: any,
  userId: string
): Promise<NextResponse> {
  const now = Math.floor(Date.now() / 1000)

  if (!ORGANIZATIONS_TABLE) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  // Clear only warehouse-related fields in dynamics provider
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGANIZATIONS_TABLE,
      Key: { PK: organizationId, SK: 'PROFILE' },
      UpdateExpression: `
        SET #providers.#dynamics.#credentials.#connected = :connected,
            #providers.#dynamics.#credentials.#schemas = :emptySchemas,
            #providers.#dynamics.#credentials.#disconnected_at = :disconnectedAt,
            #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#providers': 'providers',
        '#dynamics': 'dynamics',
        '#credentials': 'credentials',
        '#connected': 'connected',
        '#schemas': 'schemas',
        '#disconnected_at': 'disconnected_at',
        '#updatedAt': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':connected': false,
        ':emptySchemas': [],
        ':disconnectedAt': now,
        ':updatedAt': now,
      },
    })
  )

  // Clear warehouse_config for BC schemas
  const warehouseConfig = orgItem.warehouse_config || { schemas: [] }
  if (warehouseConfig.schemas) {
    warehouseConfig.schemas = warehouseConfig.schemas.filter(
      (s: any) =>
        s.source_type !== 'business_central' &&
        s.provider !== 'dynamics' &&
        !s.schema_name?.startsWith('bc_')
    )

    if (warehouseConfig.schemas.length === 0) {
      warehouseConfig.enabled = false
      warehouseConfig.default_schema = null
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { PK: organizationId, SK: 'PROFILE' },
        UpdateExpression: 'SET #warehouseConfig = :warehouseConfig',
        ExpressionAttributeNames: {
          '#warehouseConfig': 'warehouse_config',
        },
        ExpressionAttributeValues: {
          ':warehouseConfig': warehouseConfig,
        },
      })
    )
  }

  logger.info('All Dynamics BC warehouse schemas disconnected', { organizationId })

  // Check if OAuth or other providers remain
  const hasOtherProviders = checkOtherConnectedProviders(orgItem, false, true)

  if (!hasOtherProviders) {
    await resetOnboardingIfNeeded(userId)
  }

  return NextResponse.json({
    success: true,
    message: 'All Dynamics BC warehouse schemas disconnected',
    disconnectedType: 'warehouse',
    hasOtherProviders,
  })
}

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user's organization
    const organizationId = await getUserOrganizationId(userId)
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    if (!ORGANIZATIONS_TABLE) {
      throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
    }

    // Get current organization data
    const { Item: orgItem } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { PK: organizationId, SK: 'PROFILE' },
      })
    )

    if (!orgItem) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check current connection state
    const dynamicsProvider = orgItem.providers?.dynamics
    const hasOAuthConnections =
      dynamicsProvider?.oauthConnections &&
      Object.values(dynamicsProvider.oauthConnections).some((c: any) => c?.credentials?.connected)
    const hasWarehouseConnections = dynamicsProvider?.credentials?.connected

    if (!hasOAuthConnections && !hasWarehouseConnections) {
      return NextResponse.json(
        { error: 'Dynamics BC not connected for this organization' },
        { status: 404 }
      )
    }

    // Parse request body
    // Supported fields:
    //   - connectionId: Disconnect a specific OAuth connection
    //   - schema_name: Disconnect a specific warehouse schema
    //   - disconnectAllOAuth: true to disconnect all OAuth connections
    //   - disconnectAllWarehouse: true to disconnect all warehouse schemas
    //   - (no body): Smart disconnect - if only one type exists, disconnect that
    let body: {
      connectionId?: string
      schema_name?: string
      disconnectAllOAuth?: boolean
      disconnectAllWarehouse?: boolean
    } = {}
    try {
      body = await request.json()
    } catch {
      // No body - will use smart disconnect logic below
    }

    // ─── Route 1: Disconnect specific OAuth connection ───
    if (body.connectionId) {
      return disconnectOAuthConnection(organizationId, body.connectionId, orgItem, userId)
    }

    // ─── Route 2: Disconnect specific warehouse schema ───
    if (body.schema_name) {
      return disconnectWarehouseSchema(organizationId, body.schema_name, orgItem, userId)
    }

    // ─── Route 3: Disconnect all OAuth (explicit) ───
    if (body.disconnectAllOAuth) {
      if (!hasOAuthConnections) {
        return NextResponse.json({ error: 'No OAuth connections to disconnect' }, { status: 404 })
      }
      return disconnectAllOAuth(organizationId, orgItem, userId)
    }

    // ─── Route 4: Disconnect all warehouse (explicit) ───
    if (body.disconnectAllWarehouse) {
      if (!hasWarehouseConnections) {
        return NextResponse.json(
          { error: 'No warehouse connections to disconnect' },
          { status: 404 }
        )
      }
      return disconnectAllWarehouse(organizationId, orgItem, userId)
    }

    // ─── Route 5: Smart disconnect (no body or empty body) ───
    // If ONLY OAuth exists → disconnect all OAuth
    // If ONLY warehouse exists → disconnect all warehouse
    // If BOTH exist → return error requiring specification

    if (hasOAuthConnections && hasWarehouseConnections) {
      // Both exist - require explicit specification
      logger.warn(
        'Disconnect called without specification when both OAuth and warehouse are connected',
        { organizationId }
      )
      return NextResponse.json(
        {
          error: 'Both OAuth and warehouse connections exist. Please specify which to disconnect.',
          requiresSpecification: true,
          oauthConnected: true,
          warehouseConnected: true,
          hint: 'Use { connectionId } for OAuth or { schema_name } for warehouse',
        },
        { status: 400 }
      )
    }

    if (hasOAuthConnections) {
      // Only OAuth exists - disconnect all OAuth
      return disconnectAllOAuth(organizationId, orgItem, userId)
    }

    if (hasWarehouseConnections) {
      // Only warehouse exists - disconnect all warehouse
      return disconnectAllWarehouse(organizationId, orgItem, userId)
    }

    // Should not reach here due to earlier check
    return NextResponse.json({ error: 'No connections to disconnect' }, { status: 404 })
  } catch (error) {
    logger.error('Dynamics BC disconnect error', { error })
    return NextResponse.json(
      {
        error: 'Failed to disconnect Dynamics BC',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
