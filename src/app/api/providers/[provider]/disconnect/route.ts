// src/app/api/providers/[provider]/disconnect/route.ts
//
// IMPORTANT: This route uses withAuth (NOT withProvider) because disconnect
// must work even when credentials are already marked as disconnected or invalid.
// Using withProvider would create a Catch-22 where you can't disconnect a
// provider whose credentials are in a bad state.

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getProvider } from '@/lib/providers'
import {
  removeProviderCredentialsFromDB,
  getProviderCredentialsFromDB,
  removeQBConnection,
  getQBConnectionCredentials,
  removeShopifyConnection,
  getShopifyConnectionCredentials,
  ProviderID,
} from '@/lib/providers/database'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { TokenVerifier } from '@/lib/auth'
import { logger } from '@/lib/logger'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

const VALID_PROVIDERS: ProviderID[] = [
  'zoho',
  'quickbooks',
  'xero',
  'stripe',
  'dynamics',
  'shopify',
]

/**
 * Extract provider ID from the URL path.
 * Route pattern: /api/providers/[provider]/disconnect
 */
function extractProviderFromUrl(request: NextRequest): ProviderID | null {
  const url = new URL(request.url)
  const pathSegments = url.pathname.split('/')
  const providerIndex = pathSegments.findIndex((segment) => segment === 'providers')
  if (providerIndex !== -1 && pathSegments[providerIndex + 1]) {
    return pathSegments[providerIndex + 1] as ProviderID
  }
  return null
}

/**
 * Reset onboarding audit when no providers remain connected
 */
async function resetOnboardingIfNeeded(userId: string, organizationId: string, providerId: string) {
  const orgCommand = new GetCommand({
    TableName: process.env.ORGANIZATIONS_TABLE_NAME,
    Key: { PK: organizationId, SK: 'PROFILE' },
  })
  const { Item: orgItem } = await ddbDocClient.send(orgCommand)

  // Check if any provider is still connected
  let hasAnyConnectedProvider = false
  if (orgItem?.providers) {
    for (const [provId, provInfo] of Object.entries(orgItem.providers)) {
      if (provId === providerId) {
        // For QB multi-entity, check if any connection in the map is still connected
        if (provId === 'quickbooks' && (provInfo as any)?.connections) {
          const connections = (provInfo as any).connections
          for (const conn of Object.values(connections)) {
            if ((conn as any)?.credentials?.connected) {
              hasAnyConnectedProvider = true
              break
            }
          }
        } else if ((provInfo as any)?.credentials?.connected) {
          hasAnyConnectedProvider = true
        }
      } else if ((provInfo as any)?.credentials?.connected) {
        hasAnyConnectedProvider = true
      }
      if (hasAnyConnectedProvider) break
    }
  }

  if (!hasAnyConnectedProvider) {
    try {
      const getUserCommand = new GetCommand({
        TableName: process.env.USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
      const { Item: userItem } = await ddbDocClient.send(getUserCommand)

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

          const updateUserCommand = new UpdateCommand({
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
          await ddbDocClient.send(updateUserCommand)
          logger.info('[Disconnect] Reset onboarding audit - no providers remain', { userId })
        }
      }
    } catch (userUpdateError) {
      logger.error('[Disconnect] Failed to update onboarding audit', { error: userUpdateError })
    }
  }

  return hasAnyConnectedProvider
}

export const POST = withAuth(async (request, { userId, organizationId }) => {
  // Resolve provider from URL path
  const providerId = extractProviderFromUrl(request)
  if (!providerId || !VALID_PROVIDERS.includes(providerId)) {
    return NextResponse.json({ error: `Unsupported provider: ${providerId}` }, { status: 400 })
  }

  // ─── Dynamics BC: Delegate to dynamics-specific route ───
  // Dynamics has TWO independent connection types (OAuth and warehouse) that
  // must be handled separately. Forward the request to the specialized handler.
  if (providerId === 'dynamics') {
    // Import the dynamics-specific handler
    const { POST: dynamicsHandler } = await import('@/app/api/providers/dynamics/disconnect/route')
    return dynamicsHandler(request)
  }

  // Get provider instance (for token revocation). This can fail for providers
  // that aren't fully configured — that's OK, we still proceed with DB cleanup.
  let provider: ReturnType<typeof getProvider> = null
  try {
    provider = getProvider(providerId, organizationId)
  } catch {
    logger.warn('[Disconnect] Could not get provider instance, skipping token revocation', {
      providerId,
    })
  }

  try {
    logger.info('[Disconnect] Request received', { providerId, organizationId })

    // For QuickBooks, check if this is a per-entity disconnect
    if (providerId === 'quickbooks') {
      let body: any = {}
      try {
        body = await request.json()
      } catch {
        // No body — disconnect all QB entities
      }

      const realmId = body?.realmId || body?.realm_id

      if (realmId) {
        // Per-entity disconnect: remove just this one QB company
        const entityCreds = await getQBConnectionCredentials(organizationId, realmId)
        if (!entityCreds) {
          // Entity not found in connections map — still try removing it in case
          // the connections map has a stale entry without credentials
          logger.warn('[Disconnect] QB entity credentials not found, attempting removal anyway', {
            realmId,
          })
        }

        // Try to revoke tokens for this entity (best effort)
        if (provider && entityCreds?.access_token) {
          try {
            await provider.auth.disconnect(entityCreds.access_token)
          } catch (revokeError) {
            logger.warn('[Disconnect] Failed to revoke QB entity tokens', {
              realmId,
              error: revokeError,
            })
          }
        }

        // Remove just this entity from the connections map
        const result = await removeQBConnection(organizationId, realmId)

        if (!result.success) {
          // If removeQBConnection fails, the entity might not exist — that's OK for disconnect
          logger.warn('[Disconnect] removeQBConnection returned false, entity may not exist', {
            realmId,
          })
        }

        // Check if we need to reset onboarding
        const hasOtherProviders = await resetOnboardingIfNeeded(userId, organizationId, providerId)

        logger.info('[Disconnect] QB entity disconnected', {
          organizationId,
          realmId,
          newActiveRealmId: result.newActiveRealmId,
          remainingCount: result.remainingCount,
        })

        return NextResponse.json({
          success: true,
          message: 'QuickBooks company disconnected',
          newActiveRealmId: result.newActiveRealmId,
          remainingCount: result.remainingCount,
          hasOtherProviders: hasOtherProviders || result.remainingCount > 0,
        })
      }

      // No realmId — disconnect ALL QB entities (full provider disconnect)
      // Fall through to standard disconnect below
    }

    // For Shopify, check if this is a per-store disconnect
    if (providerId === 'shopify') {
      let body: any = {}
      try {
        body = await request.json()
      } catch {
        // No body — disconnect all Shopify stores
      }

      // Accept shopDomain, shop_domain, or realmId (dashboard cards use realmId for the shop domain)
      const shopDomain = body?.shopDomain || body?.shop_domain || body?.realmId

      if (shopDomain) {
        // Per-store disconnect: remove just this one Shopify store
        const storeCreds = await getShopifyConnectionCredentials(organizationId, shopDomain)
        if (!storeCreds) {
          logger.warn(
            '[Disconnect] Shopify store credentials not found, attempting removal anyway',
            {
              shopDomain,
            }
          )
        }

        // Try to revoke tokens for this store (best effort)
        if (provider && storeCreds?.access_token) {
          try {
            await provider.auth.disconnect(storeCreds.access_token)
          } catch (revokeError) {
            logger.warn('[Disconnect] Failed to revoke Shopify store tokens', {
              shopDomain,
              error: revokeError,
            })
          }
        }

        // Remove just this store from the connections map
        const result = await removeShopifyConnection(organizationId, shopDomain)

        if (!result.success) {
          logger.warn('[Disconnect] removeShopifyConnection returned false, store may not exist', {
            shopDomain,
          })
        }

        // Check if we need to reset onboarding
        const hasOtherProviders = await resetOnboardingIfNeeded(userId, organizationId, providerId)

        logger.info('[Disconnect] Shopify store disconnected', {
          organizationId,
          shopDomain,
          newActiveShopDomain: result.newActiveShopDomain,
          remainingCount: result.remainingCount,
        })

        return NextResponse.json({
          success: true,
          message: 'Shopify store disconnected',
          newActiveShopDomain: result.newActiveShopDomain,
          remainingCount: result.remainingCount,
          hasOtherProviders: hasOtherProviders || result.remainingCount > 0,
        })
      }

      // No shopDomain — disconnect ALL Shopify stores (full provider disconnect)
      // Fall through to standard disconnect below
    }

    // Standard disconnect flow (non-QB, non-Shopify per-entity, or full provider disconnect)
    // Get credentials for token revocation — but don't block disconnect if unavailable
    const credentials = await getProviderCredentialsFromDB(organizationId, providerId)

    // Try to revoke tokens (best effort — don't block disconnect on revocation failure)
    if (provider && credentials?.access_token) {
      try {
        await provider.auth.disconnect(credentials.access_token)
      } catch (revokeError) {
        logger.warn(`[Disconnect] Failed to revoke ${providerId} tokens`, { error: revokeError })
      }
    }

    // Remove credentials from database — this is the essential operation
    const success = await removeProviderCredentialsFromDB(organizationId, providerId)

    if (!success) {
      return NextResponse.json({ error: `Failed to disconnect ${providerId}` }, { status: 500 })
    }

    // Check onboarding reset
    const hasOtherProviders = await resetOnboardingIfNeeded(userId, organizationId, providerId)

    logger.info('[Disconnect] Provider disconnected', { providerId, organizationId })
    return NextResponse.json({
      success: true,
      message: `${providerId} disconnected successfully`,
      hasOtherProviders,
    })
  } catch (error) {
    logger.error('[Disconnect] Error', {
      providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json(
      {
        error: `Failed to disconnect ${providerId}`,
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
