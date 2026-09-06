// src/app/api/providers/dynamics/login/route.ts
// POST — faux_credentials (username/password) login for Fivetran/Redshift clients
// GET  — OAuth redirect to Azure AD for direct API clients
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

const BC_CREDENTIALS_TABLE = process.env.BC_CREDENTIALS_TABLE_NAME || 'bc_credentials'
const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME

// Rate limiting configuration
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 30 * 60 * 1000 // 30 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

// Input validation schema
const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
})

interface BCCredential {
  PK: string
  SK: string
  username: string
  password_hash: string
  organization_id: string | null // legacy field, not used for access control
  schema_name: string
  display_name: string
  status: 'active' | 'disabled'
  login_attempts: number
  locked_until: number | null
  last_login_at: number
  created_at: number
  created_by: string
  claimed_at?: number // Timestamp when org claimed this credential
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
  logger.info('Dynamics BC auth attempt', {
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
function isAccountLocked(credential: BCCredential): boolean {
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
      TableName: BC_CREDENTIALS_TABLE,
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
 * Update organization's Dynamics BC connection
 */
async function updateOrganizationConnection(
  organizationId: string,
  schemaName: string,
  displayName: string
): Promise<boolean> {
  if (!ORGANIZATIONS_TABLE) {
    throw new Error('ORGANIZATIONS_TABLE_NAME not configured')
  }

  const now = Math.floor(Date.now() / 1000)

  try {
    // First get the current organization to check providers structure
    const { Item } = await ddbDocClient.send(
      new GetCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { PK: organizationId, SK: 'PROFILE' },
      })
    )

    if (!Item) {
      logger.error('Organization not found', { organizationId })
      return false
    }

    // Build update to set dynamics provider with multi-schema credentials
    // Each BC credential login appends to the schemas array rather than replacing
    const existingCredSchemas: Array<{
      schema_name: string
      company_name: string
      connected_at: number
      last_synced: number
    }> = Item?.providers?.dynamics?.credentials?.schemas || []

    // Check if this schema is already in the credentials array
    const credSchemaIndex = existingCredSchemas.findIndex((s) => s.schema_name === schemaName)

    if (credSchemaIndex >= 0) {
      // Update existing entry
      existingCredSchemas[credSchemaIndex] = {
        schema_name: schemaName,
        company_name: displayName,
        connected_at: existingCredSchemas[credSchemaIndex].connected_at,
        last_synced: now,
      }
    } else {
      // Add new schema entry
      existingCredSchemas.push({
        schema_name: schemaName,
        company_name: displayName,
        connected_at: now,
        last_synced: now,
      })
    }

    // Use targeted SET expressions to preserve existing oauthConnections/activeConnectionId.
    // A full replace of providers.dynamics would nuke any OAuth connections.
    const existingDynamics = Item?.providers?.dynamics || {}
    const updatedDynamics = {
      ...existingDynamics,
      providerName: 'Microsoft Dynamics 365 Business Central',
      credentials: {
        connected: true,
        last_synced: now,
        schemas: existingCredSchemas,
        auth_type: 'faux_credentials',
      },
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGANIZATIONS_TABLE,
        Key: { PK: organizationId, SK: 'PROFILE' },
        UpdateExpression: `
          SET #providers.#dynamics = :dynamicsInfo,
              #updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#dynamics': 'dynamics',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':dynamicsInfo': updatedDynamics,
          ':updatedAt': now,
        },
      })
    )

    // Update warehouse_config to include the BC schema
    // Must match expected structure: enabled, default_schema, schemas[] with source_type
    const warehouseConfig = Item.warehouse_config || { enabled: true, schemas: [] }
    warehouseConfig.enabled = true // Ensure warehouse access is enabled
    if (!warehouseConfig.default_schema) {
      warehouseConfig.default_schema = schemaName // Set default schema if not already set
    }

    // Only match by schema_name — NOT source_type — so multiple BC schemas
    // (e.g. bc_aquaculture + bc_globics) can coexist in the same org
    const existingSchemaIndex = warehouseConfig.schemas?.findIndex(
      (s: any) => s.schema_name === schemaName
    )

    if (existingSchemaIndex >= 0) {
      warehouseConfig.schemas[existingSchemaIndex] = {
        schema_name: schemaName,
        source_type: 'business_central',
        display_name: displayName,
        connected_at: now,
      }
    } else {
      warehouseConfig.schemas = warehouseConfig.schemas || []
      warehouseConfig.schemas.push({
        schema_name: schemaName,
        source_type: 'business_central',
        display_name: displayName,
        connected_at: now,
      })
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

    return true
  } catch (error) {
    logger.error('Failed to update organization connection', { organizationId, error })
    return false
  }
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

    // Parse and validate request body
    const body = await request.json()
    const parseResult = loginSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 })
    }

    const { username, password } = parseResult.data

    // Fetch credential from DynamoDB
    const { Item: credential } = await ddbDocClient.send(
      new GetCommand({
        TableName: BC_CREDENTIALS_TABLE,
        Key: { PK: `CRED#${username}`, SK: 'CREDENTIAL' },
      })
    )

    // Generic error message to prevent username enumeration
    const genericError = 'Invalid username or password'

    if (!credential) {
      // Log failed attempt even for non-existent users
      await logAuthAttempt(username, organizationId, false, 'user_not_found')
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    const bcCredential = credential as BCCredential

    // Check if account is disabled
    if (bcCredential.status === 'disabled') {
      await logAuthAttempt(username, organizationId, false, 'account_disabled')
      return NextResponse.json({ error: genericError }, { status: 401 })
    }

    // Check if account is locked
    if (isAccountLocked(bcCredential)) {
      const remainingTime = Math.ceil(((bcCredential.locked_until || 0) - Date.now()) / 60000)
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
    const passwordValid = await verifyPassword(password, bcCredential.password_hash)

    if (!passwordValid) {
      await updateLoginAttempts(username, false, bcCredential.login_attempts)
      await logAuthAttempt(username, organizationId, false, 'invalid_password')

      const newAttempts = bcCredential.login_attempts + 1
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

    // Credential is valid — any org with the correct username/password can connect.
    // The credential maps to a Redshift schema; access control is via knowing the password.

    // Success - update login attempts and organization connection
    await updateLoginAttempts(username, true, 0)

    const connectionSuccess = await updateOrganizationConnection(
      organizationId,
      bcCredential.schema_name,
      bcCredential.display_name
    )

    if (!connectionSuccess) {
      return NextResponse.json(
        { error: 'Failed to establish connection. Please try again.' },
        { status: 500 }
      )
    }

    await logAuthAttempt(username, organizationId, true)

    return NextResponse.json({
      success: true,
      schema_name: bcCredential.schema_name,
      display_name: bcCredential.display_name,
    })
  } catch (error) {
    logger.error('Dynamics BC login error', { error })
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

// ─── GET: OAuth redirect to Azure AD ─────────────────────────────────────────
// This handles the browser redirect from the "Connect with Microsoft Account" flow.
// Static route /api/providers/dynamics/login takes priority over dynamic [provider],
// so the OAuth GET handler must live here.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const organizationId = await getUserOrganizationId(userId)
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const provider = getProvider('dynamics', organizationId)
    if (!provider) {
      return NextResponse.json({ error: 'Dynamics provider not available' }, { status: 500 })
    }

    const url = new URL(request.url)
    const redirectUrl = url.searchParams.get('redirect_uri') || '/onboarding/connect'

    if (!isValidRedirectUri(redirectUrl)) {
      logger.warn('Invalid redirect URI attempted', { redirectUrl })
      return NextResponse.json({ error: 'Invalid redirect URI' }, { status: 400 })
    }

    // Generate PKCE code verifier for BC OAuth
    const { generateCodeVerifier } = await import('@/lib/providers/dynamics/oauthClient')
    const codeVerifier = generateCodeVerifier()

    const stateData = {
      userId,
      organizationId,
      provider: 'dynamics',
      redirect: redirectUrl,
      codeVerifier,
    }
    const state = await generateSecureState(stateData)

    const loginUrl = provider.auth.getLoginUrl(state, codeVerifier)

    logger.info('[BC OAuth] Redirecting to Azure AD', {
      userId,
      organizationId,
      loginUrl,
      clientId: process.env.BC_AZURE_CLIENT_ID,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback`,
    })
    return NextResponse.redirect(loginUrl)
  } catch (error) {
    logger.error('Dynamics OAuth login error', { error })
    return NextResponse.json(
      {
        error: 'Failed to initiate Dynamics login',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
