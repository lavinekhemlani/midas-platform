/**
 * Script to fix warehouse access for a user's organization
 *
 * This script addresses the issue where users who connected BC before the fix
 * have warehouse_config that's missing `enabled: true`, causing 403 errors.
 *
 * Run with: npx tsx scripts/fix-warehouse-access.ts <email>
 *
 * Example:
 *   npx tsx scripts/fix-warehouse-access.ts redacted-user@example.com
 *
 * What this does:
 * 1. Finds the user by email
 * 2. Gets their organization
 * 3. Updates warehouse_config to ensure `enabled: true`
 * 4. Preserves existing schema configurations
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
const ddbDocClient = DynamoDBDocumentClient.from(client)

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
  warehouse_config?: {
    enabled?: boolean
    default_schema?: string
    schemas?: Array<{
      schema_name: string
      source_type?: string
      display_name?: string
      connected_at?: number
    }>
  }
  connected_providers?: Record<string, any>
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

async function enableWarehouseAccess(
  orgPK: string,
  currentConfig: Organization['warehouse_config']
): Promise<void> {
  // Preserve existing config but ensure enabled is true
  const newConfig = {
    ...currentConfig,
    enabled: true,
    // If no schemas defined, add an empty array
    schemas: currentConfig?.schemas || [],
  }

  console.log('\n📝 Updating warehouse_config:')
  console.log(
    '   Before:',
    JSON.stringify(currentConfig || {}, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : '   ' + l))
      .join('\n')
  )
  console.log(
    '   After:',
    JSON.stringify(newConfig, null, 2)
      .split('\n')
      .map((l, i) => (i === 0 ? l : '   ' + l))
      .join('\n')
  )

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: orgPK, SK: 'PROFILE' },
      UpdateExpression: 'SET warehouse_config = :wc, updated_at = :now',
      ExpressionAttributeValues: {
        ':wc': newConfig,
        ':now': Math.floor(Date.now() / 1000),
      },
    })
  )

  console.log('\n✅ Successfully enabled warehouse access')
}

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.log('Usage: npx tsx scripts/fix-warehouse-access.ts <email>')
    console.log('')
    console.log('Example:')
    console.log('  npx tsx scripts/fix-warehouse-access.ts redacted-user@example.com')
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

  console.log('\n📦 Found organization:')
  console.log(`   PK: ${org.PK}`)
  console.log(`   Name: ${org.name || 'N/A'}`)
  console.log(`   Has warehouse_config: ${org.warehouse_config ? 'Yes' : 'No'}`)

  if (org.warehouse_config) {
    console.log(`   warehouse_config.enabled: ${org.warehouse_config.enabled}`)
    console.log(
      `   Schemas: ${org.warehouse_config.schemas?.map((s) => s.schema_name).join(', ') || 'None'}`
    )
  }

  if (org.connected_providers) {
    console.log(`   Connected providers: ${Object.keys(org.connected_providers).join(', ')}`)
  }

  // Step 3: Check if fix is needed
  if (org.warehouse_config?.enabled === true) {
    console.log('\n✅ Warehouse access is already enabled! No fix needed.')
    console.log('\n📋 If user is still seeing 403 errors, check:')
    console.log('   1. The connected_providers has the correct BC credentials')
    console.log('   2. The schemas array has the correct schema configured')
    console.log('   3. Clear browser cache and try again')
    return
  }

  // Step 4: Enable warehouse access
  console.log('\n⚠️  warehouse_config.enabled is not true - fixing...')
  await enableWarehouseAccess(org.PK, org.warehouse_config)

  // Step 5: Verify
  const updatedOrg = await getOrganization(orgId)
  console.log('\n🔍 Verification:')
  console.log(`   warehouse_config.enabled: ${updatedOrg?.warehouse_config?.enabled}`)

  if (updatedOrg?.warehouse_config?.enabled === true) {
    console.log('\n✅ Fix applied successfully!')
    console.log('\n📋 Next steps for the user:')
    console.log('   1. Clear browser cache (or use incognito mode)')
    console.log('   2. Sign out and sign back in')
    console.log('   3. Navigate to /bc/reports or /settings')
  } else {
    console.error('\n❌ Fix may have failed - please verify manually')
  }
}

main().catch((e) => {
  console.error('\n❌ Error:', e.message || e)
  process.exit(1)
})
