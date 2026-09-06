/**
 * Script to disconnect Dynamics BC for a user's organization
 *
 * This script properly disconnects Dynamics BC by:
 * 1. Setting providers.dynamics.credentials.connected = false
 * 2. Removing business_central schemas from warehouse_config
 * 3. Setting warehouse_config.enabled = false if no schemas remain
 *
 * Run with: npx tsx scripts/disconnect-dynamics.ts <email>
 *
 * Example:
 *   npx tsx scripts/disconnect-dynamics.ts redacted-user@example.com
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load environment variables from .env.local
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=')
        if (idx > 0) {
          const key = trimmed.slice(0, idx)
          let value = trimmed.slice(idx + 1)
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }
          process.env[key] = value
        }
      }
    }
  } catch (e) {
    console.error('Could not load .env.local:', e)
    process.exit(1)
  }
}

loadEnv()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})
const ddbDocClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
})

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'users'
const ORGS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

interface User {
  PK: string
  SK: string
  email?: string
  name?: string
  first_name?: string
  last_name?: string
  organization_id?: string
  organizationId?: string
}

interface Organization {
  PK: string
  SK: string
  name?: string
  providers?: {
    dynamics?: {
      providerName?: string
      credentials?: {
        connected?: boolean
        schema_name?: string
        company_name?: string
      }
    }
  }
  warehouse_config?: {
    enabled?: boolean
    default_schema?: string
    schemas?: Array<{
      schema_name: string
      source_type?: string
      provider?: string
      display_name?: string
      connected_at?: number
    }>
  }
}

async function findUserByEmail(email: string): Promise<User | null> {
  console.log(`\n🔍 Searching for user: ${email}`)

  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'SK = :profile AND email = :email',
      ExpressionAttributeValues: {
        ':profile': 'PROFILE',
        ':email': email,
      },
    })
  )

  const users = result.Items || []
  if (users.length === 0) {
    return null
  }

  return users[0] as User
}

async function getOrganization(orgId: string): Promise<Organization | null> {
  // Construct PK - add ORG# prefix if not present
  const pk = orgId.startsWith('ORG#') ? orgId : `ORG#${orgId}`

  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: ORGS_TABLE,
      Key: { PK: pk, SK: 'PROFILE' },
    })
  )

  return (result.Item as Organization) || null
}

async function disconnectDynamics(orgPK: string, org: Organization): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  // Step 1: Mark dynamics as disconnected
  console.log('\n📝 Step 1: Marking Dynamics as disconnected...')

  if (org.providers?.dynamics) {
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ORGS_TABLE,
        Key: { PK: orgPK, SK: 'PROFILE' },
        UpdateExpression: `
        SET #providers.#dynamics.#credentials.#connected = :connected,
            #providers.#dynamics.#credentials.#disconnected_at = :disconnectedAt,
            #updatedAt = :updatedAt
      `,
        ExpressionAttributeNames: {
          '#providers': 'providers',
          '#dynamics': 'dynamics',
          '#credentials': 'credentials',
          '#connected': 'connected',
          '#disconnected_at': 'disconnected_at',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':connected': false,
          ':disconnectedAt': now,
          ':updatedAt': now,
        },
      })
    )
    console.log('   ✅ providers.dynamics.credentials.connected = false')
  } else {
    console.log('   ⚠️  No dynamics provider found in org')
  }

  // Step 2: Remove business_central schemas and disable warehouse if empty
  console.log('\n📝 Step 2: Removing Business Central schemas...')

  const warehouseConfig = org.warehouse_config || { enabled: false, schemas: [] }
  const originalSchemas = warehouseConfig.schemas || []

  // Filter out business_central schemas (by source_type or provider)
  warehouseConfig.schemas = originalSchemas.filter(
    (s) => s.source_type !== 'business_central' && s.provider !== 'dynamics'
  )

  const removedCount = originalSchemas.length - warehouseConfig.schemas.length
  console.log(`   Removed ${removedCount} schema(s)`)

  // If no schemas remain, disable warehouse access
  if (warehouseConfig.schemas.length === 0) {
    warehouseConfig.enabled = false
    warehouseConfig.default_schema = null
    console.log('   ✅ No schemas remaining - warehouse_config.enabled = false')
  } else {
    console.log(`   ℹ️  ${warehouseConfig.schemas.length} schema(s) remaining`)
  }

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: orgPK, SK: 'PROFILE' },
      UpdateExpression: 'SET #warehouseConfig = :warehouseConfig, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#warehouseConfig': 'warehouse_config',
        '#updatedAt': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':warehouseConfig': warehouseConfig,
        ':updatedAt': now,
      },
    })
  )

  console.log('\n✅ Dynamics BC disconnected successfully!')
}

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.log('Usage: npx tsx scripts/disconnect-dynamics.ts <email>')
    console.log('')
    console.log('Example:')
    console.log('  npx tsx scripts/disconnect-dynamics.ts redacted-user@example.com')
    process.exit(1)
  }

  // Step 1: Find user
  const user = await findUserByEmail(email)
  if (!user) {
    console.error(`\n❌ User not found: ${email}`)
    process.exit(1)
  }

  console.log('\n✅ Found user:')
  console.log(
    `   Name: ${user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'}`
  )
  console.log(`   PK: ${user.PK}`)
  console.log(`   Org ID: ${user.organization_id || user.organizationId || 'None'}`)

  // Step 2: Get organization
  const orgId = user.organization_id || user.organizationId
  if (!orgId) {
    console.error('\n❌ User has no organization assigned')
    process.exit(1)
  }

  const org = await getOrganization(orgId)
  if (!org) {
    console.error(`\n❌ Organization not found: ${orgId}`)
    process.exit(1)
  }

  console.log('\n📦 Current organization state:')
  console.log(`   PK: ${org.PK}`)
  console.log(`   Name: ${org.name || 'N/A'}`)
  console.log(`   Dynamics connected: ${org.providers?.dynamics?.credentials?.connected ?? 'N/A'}`)
  console.log(`   warehouse_config.enabled: ${org.warehouse_config?.enabled ?? 'N/A'}`)
  console.log(
    `   Schemas: ${org.warehouse_config?.schemas?.map((s) => `${s.schema_name} (${s.source_type || s.provider || 'unknown'})`).join(', ') || 'None'}`
  )

  // Step 3: Check if already disconnected
  const dynamicsConnected = org.providers?.dynamics?.credentials?.connected
  const hasBusinessCentralSchema = org.warehouse_config?.schemas?.some(
    (s) => s.source_type === 'business_central' || s.provider === 'dynamics'
  )

  if (!dynamicsConnected && !hasBusinessCentralSchema && !org.warehouse_config?.enabled) {
    console.log('\n✅ Dynamics BC is already disconnected! No changes needed.')
    return
  }

  // Step 4: Disconnect Dynamics
  console.log('\n⚠️  Disconnecting Dynamics BC...')
  await disconnectDynamics(org.PK, org)

  // Step 5: Verify
  const updatedOrg = await getOrganization(orgId)
  console.log('\n🔍 Verification:')
  console.log(
    `   Dynamics connected: ${updatedOrg?.providers?.dynamics?.credentials?.connected ?? 'N/A'}`
  )
  console.log(`   warehouse_config.enabled: ${updatedOrg?.warehouse_config?.enabled ?? 'N/A'}`)
  console.log(`   Schemas remaining: ${updatedOrg?.warehouse_config?.schemas?.length ?? 0}`)

  console.log('\n📋 Next steps:')
  console.log('   1. Clear browser cache or use incognito mode')
  console.log('   2. Sign out and sign back in')
  console.log('   3. Navigate to /bc/reports - should see "Warehouse not enabled" error')
  console.log('   4. Go to /settings to reconnect Dynamics BC if needed')
}

main().catch((e) => {
  console.error('\n❌ Error:', e.message || e)
  process.exit(1)
})
