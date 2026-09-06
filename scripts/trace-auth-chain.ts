import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

// Load env
const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
for (const line of content.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx)
      let value = trimmed.slice(idx + 1)
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
      process.env[key] = value
    }
  }
}

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const ddbDocClient = DynamoDBDocumentClient.from(client)

async function main() {
  const usersTable = process.env.USERS_TABLE_NAME || 'zenith-users'
  const orgsTable = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

  console.log('=== AUTH CHAIN TRACE ===\n')
  console.log('ENV VARS:')
  console.log(`  USERS_TABLE_NAME env: "${process.env.USERS_TABLE_NAME}" → resolved: "${usersTable}"`)
  console.log(`  ORGANIZATIONS_TABLE_NAME env: "${process.env.ORGANIZATIONS_TABLE_NAME}" → resolved: "${orgsTable}"`)

  // Step 1: Check user record - raw DynamoDB item
  const userId = '84488418-6051-70e3-efe2-fbcdb84e4e6c' // redacted-owner@example.com
  const userPK = `USER#${userId}`

  console.log(`\n--- STEP 1: Fetch user from "${usersTable}" ---`)
  console.log(`  PK: ${userPK}, SK: PROFILE`)

  const userResult = await ddbDocClient.send(
    new GetCommand({ TableName: usersTable, Key: { PK: userPK, SK: 'PROFILE' } })
  )

  if (!userResult.Item) {
    console.log('  ❌ USER NOT FOUND!')
    console.log('  This means getUserProfile() would return null → "User profile not found"')
    return
  }

  console.log('  ✅ User found. ALL fields:')
  for (const [key, value] of Object.entries(userResult.Item)) {
    const display = typeof value === 'object' ? JSON.stringify(value) : value
    console.log(`    ${key}: ${display}`)
  }

  // Step 2: Check what getUserProfile would return
  const orgId = userResult.Item.organizationId || userResult.Item.organization_id
  console.log(`\n--- STEP 2: Organization ID resolution ---`)
  console.log(`  Item.organizationId (camelCase): ${userResult.Item.organizationId ?? 'undefined'}`)
  console.log(`  Item.organization_id (snake_case): ${userResult.Item.organization_id ?? 'undefined'}`)
  console.log(`  Resolved orgId: ${orgId || 'NONE - THIS IS THE PROBLEM'}`)

  if (!orgId) {
    console.log('\n  ❌ No organizationId found on user record!')
    console.log('  getUserProfile returns { organizationId: undefined }')
    console.log('  → getWarehouseAccessForUser returns "User has no organization"')
    return
  }

  // Step 3: Fetch organization from orgs table
  const orgPK = orgId.startsWith('ORG#') ? orgId : `ORG#${orgId}`
  console.log(`\n--- STEP 3: Fetch org from "${orgsTable}" ---`)
  console.log(`  PK: ${orgPK}, SK: PROFILE`)

  const orgResult = await ddbDocClient.send(
    new GetCommand({ TableName: orgsTable, Key: { PK: orgPK, SK: 'PROFILE' } })
  )

  if (!orgResult.Item) {
    console.log('  ❌ ORGANIZATION NOT FOUND!')
    return
  }

  console.log('  ✅ Organization found:')
  console.log(`    name: ${orgResult.Item.name}`)
  console.log(`    warehouse_config: ${orgResult.Item.warehouse_config ? 'EXISTS' : 'MISSING'}`)

  if (orgResult.Item.warehouse_config) {
    console.log(`    enabled: ${orgResult.Item.warehouse_config.enabled}`)
    console.log(`    schemas: ${JSON.stringify(orgResult.Item.warehouse_config.schemas?.map((s: any) => s.schema_name))}`)
    console.log('\n  ✅ FULL CHAIN WORKS - user should have warehouse access')
  } else {
    console.log('\n  ❌ No warehouse_config on this organization!')
  }
}

main().catch((e) => console.error('Error:', e))
