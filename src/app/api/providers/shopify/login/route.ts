// src/app/api/providers/shopify/login/route.ts
// POST — faux_credentials (username/password) login for Shopify custom app clients
// Verifies credentials against shopify_credentials table, then returns OAuth URL
// using the stored client_id/client_secret for that credential.
import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { z } from 'zod'
import { verifyPassword } from '@/lib/providers/dynamics/password'
import { TokenVerifier } from '@/lib/auth'
import { getUserOrganizationId } from '@/lib/providers/database'
import { generateSecureState, isValidRedirectUri } from '@/lib/providers/oauth-security'
import { getProvider } from '@/lib/providers'
import { logger } from '@/lib/logger'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

const SHOPIFY_CREDENTIALS_TABLE =
  process.env.SHOPIFY_CREDENTIALS_TABLE_NAME || 'shopify_credentials'

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Input validation schemas
const fauxLoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
  redirect_uri: z.string().optional(),
})

const manualLoginSchema = z.object({
  shop_domain: z.string().min(1),
  shopify_client_id: z.string().min(1),
  shopify_client_secret: z.string().min(1),
  redirect_uri: z.string().optional(),
})

interface ShopifyCredential {
  PK: string
  SK: string
  username: string
  password_hash: string
  client_id: string // Shopify app Client ID
  client_secret: string // Shopify app Client Secret
  shop_domain: string // e.g. my-store.myshopify.com
  display_name: string // Human-readable name shown in UI
  status: 'active' | 'disabled'
  login_attempts: number
  locked_until: number | null
  last_login_at: number | null
  created_at: number
  created_by: string
}

/**
 * Log authentication attempt for audit trail
 */
async function logAuthAttempt(
  username: string,
  organizationId: string,
  success: boolean,
  reason?: string
) {
  logger.info('Shopify faux auth attempt', {
    username,
    organizationId,
    success,
    reason,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Check if account is locked
 */
function isAccountLocked(credential: ShopifyCredential): boolean {
  if (!credential.locked_until) return false
  return Date.now() < credential.locked_until
}

/**
 * Update login attempts and lock status
 */
async function updateLoginAttempts(
  username: string,
  success: boolean,
  currentAttempts: number
): Promise<void> {
  const now = Date.now()
  const newAttempts = success ? 0 : currentAttempts + 1
  const lockUntil = newAttempts >= MAX_ATTEMPTS ? now + LOCKOUT_DURATION_MS : null

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: SHOPIFY_CREDENTIALS_TABLE,
      Key: { PK: `CRED#${username}`, SK: 'CREDENTIAL' },
      UpdateExpression:
        'SET #attempts = :attempts, #locked = :locked' +
        (success ? ', #lastLogin = :lastLogin' : ''),
      ExpressionAttributeNames: {
        '#attempts': 'login_attempts',
        '#locked': 'locked_until',
        ...(success && { '#lastLogin': 'last_login_at' }),
      },
      ExpressionAttributeValues: {
        ':attempts': newAttempts,
        ':locked': lockUntil,
        ...(success && { ':lastLogin': Math.floor(now / 1000) }),
      },
    })
  )
}

/**
 * Generate an OAuth login URL and return it as JSON.
 * Shared by both faux and manual modes.
 */
async function buildOAuthLoginUrl(
  userId: string,
  organizationId: string,
  shopDomain: string,
  shopifyClientId: string,
  shopifyClientSecret: string,
  redirectUri?: string
): Promise<NextResponse> {
  const redirectUrl = redirectUri || '/onboarding/connect'
  if (!isValidRedirectUri(redirectUrl)) {
    return NextResponse.json({ error: 'Invalid redirect URI' }, { status: 400 })
  }

  const provider = getProvider('shopify', organizationId)
  if (!provider) {
    return NextResponse.json({ error: 'Shopify provider not available' }, { status: 500 })
  }

  const stateData = {
    userId,
    organizationId,
    provider: 'shopify',
    redirect: redirectUrl,
    shopDomain,
    shopifyClientId,
    shopifyClientSecret,
  }
  const state = await generateSecureState(stateData)

  const loginUrl = provider.auth.getLoginUrl(state, shopDomain, shopifyClientId)

  return NextResponse.json({ success: true, loginUrl })
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

    const body = await request.json()

    // ─── Manual mode: body has shop_domain + shopify_client_id + shopify_client_secret ───
    const manualResult = manualLoginSchema.safeParse(body)
    if (manualResult.success) {
      const { shop_domain, shopify_client_id, shopify_client_secret, redirect_uri } =
        manualResult.data
      logger.info('Shopify manual login', { organizationId, shopDomain: shop_domain })
      return buildOAuthLoginUrl(
        userId,
        organizationId,
        shop_domain,
        shopify_client_id,
        shopify_client_secret,
        redirect_uri
      )
    }

    // ─── Faux mode: body has username + password ───
    const fauxResult = fauxLoginSchema.safeParse(body)
    if (!fauxResult.success) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 })
    }

    const { username, password, redirect_uri } = fauxResult.data

    // Fetch credential from DynamoDB
    const { Item: credential } = await ddbDocClient.send(
      new GetCommand({
        TableName: SHOPIFY_CREDENTIALS_TABLE,
        Key: { PK: `CRED#${username}`, SK: 'CREDENTIAL' },
      })
    )

    // Generic error message to prevent username enumeration
    const genericError = 'Invalid username or password'

    if (!credential) {
      await logAuthAttempt(username, organizationId, false, 'user_not_found')
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    const shopifyCredential = credential as ShopifyCredential

    // Check if account is disabled
    if (shopifyCredential.status === 'disabled') {
      await logAuthAttempt(username, organizationId, false, 'account_disabled')
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    // Check if account is locked
    if (isAccountLocked(shopifyCredential)) {
      const remainingTime = Math.ceil(((shopifyCredential.locked_until || 0) - Date.now()) / 60000)
      await logAuthAttempt(username, organizationId, false, 'account_locked')
      return NextResponse.json(
        {
          error: 'Account temporarily locked due to too many failed attempts',
          retry_after_minutes: remainingTime,
        },
        { status: 429 }
      )
    }

    // Verify password
    const passwordValid = await verifyPassword(password, shopifyCredential.password_hash)

    if (!passwordValid) {
      await updateLoginAttempts(username, false, shopifyCredential.login_attempts)
      await logAuthAttempt(username, organizationId, false, 'invalid_password')

      const newAttempts = shopifyCredential.login_attempts + 1
      if (newAttempts >= MAX_ATTEMPTS) {
        return NextResponse.json(
          {
            error: 'Account temporarily locked due to too many failed attempts',
            retry_after_minutes: 30,
          },
          { status: 429 }
        )
      }

      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    // Credential valid — generate OAuth URL using stored client_id/client_secret/shop_domain
    await updateLoginAttempts(username, true, 0)
    await logAuthAttempt(username, organizationId, true)

    return buildOAuthLoginUrl(
      userId,
      organizationId,
      shopifyCredential.shop_domain,
      shopifyCredential.client_id,
      shopifyCredential.client_secret,
      redirect_uri
    )
  } catch (error) {
    logger.error('Shopify login error', { error })
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
