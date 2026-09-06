/**
 * Script to update organization warehouse_config in DynamoDB
 *
 * Run with: npx tsx scripts/update-warehouse-config.ts
 *
 * What this does:
 * - Lists all organizations
 * - Updates the specified org with warehouse_config for bc_aquaculture schema
 *
 * Safety notes:
 * - Only adds/updates the warehouse_config field
 * - Does NOT modify any other organization fields
 * - The warehouse_config is only used by /dev/warehouse page
 * - No impact on existing functionality (QuickBooks, auth, etc.)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Simple env loader
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=')
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          process.env[key] = value
        }
      }
    }
  } catch (e) {
    console.error('Could not load .env.local:', e)
  }
}

loadEnv()

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
})
const ddbDocClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

interface Organization {
  PK: string
  SK: string
  name?: string
  owner_user_id?: string
  warehouse_config?: any
}

async function listOrganizations(): Promise<Organization[]> {
  console.log(`\n📋 Scanning table: ${TABLE_NAME}\n`)

  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :profile',
      ExpressionAttributeValues: {
        ':profile': 'PROFILE',
      },
    })
  )

  return (result.Items || []) as Organization[]
}

async function getOrganization(pk: string): Promise<Organization | null> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: 'PROFILE' },
    })
  )
  return (result.Item as Organization) || null
}

async function updateWarehouseConfig(pk: string): Promise<void> {
  const warehouseConfig = {
    enabled: true,
    default_schema: 'bc_aquaculture',
    schemas: [
      {
        schema_name: 'bc_aquaculture',
        source_type: 'business_central',
        display_name: 'Premium Aquaculture BC',
        connected_at: Math.floor(Date.now() / 1000),
        // Note: Not restricting tables - user can access all tables in the schema
      },
    ],
  }

  console.log('\n📝 Updating with warehouse_config:')
  console.log(JSON.stringify(warehouseConfig, null, 2))

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: 'PROFILE' },
      UpdateExpression: 'SET warehouse_config = :wc, updated_at = :now',
      ExpressionAttributeValues: {
        ':wc': warehouseConfig,
        ':now': Math.floor(Date.now() / 1000),
      },
    })
  )

  console.log('\n✅ Successfully updated warehouse_config')
}

async function main() {
  const args = process.argv.slice(2)
  const action = args[0]
  const orgPK = args[1]

  if (action === 'list' || !action) {
    // List all organizations
    const orgs = await listOrganizations()

    console.log('Found organizations:\n')
    console.log('─'.repeat(80))

    for (const org of orgs) {
      console.log(`PK: ${org.PK}`)
      console.log(`Name: ${org.name || 'N/A'}`)
      console.log(`Owner: ${org.owner_user_id || 'N/A'}`)
      console.log(`Has warehouse_config: ${org.warehouse_config ? 'Yes' : 'No'}`)
      if (org.warehouse_config) {
        console.log(`  Enabled: ${org.warehouse_config.enabled}`)
        console.log(`  Schemas: ${org.warehouse_config.schemas?.map((s: any) => s.schema_name).join(', ')}`)
      }
      console.log('─'.repeat(80))
    }

    console.log(`\nTotal: ${orgs.length} organization(s)`)
    console.log('\nTo update an organization, run:')
    console.log('  npx tsx scripts/update-warehouse-config.ts update "ORG#<id>"')

  } else if (action === 'update') {
    if (!orgPK) {
      console.error('❌ Please provide organization PK')
      console.log('Usage: npx tsx scripts/update-warehouse-config.ts update "ORG#<id>"')
      process.exit(1)
    }

    // First show current state
    const org = await getOrganization(orgPK)
    if (!org) {
      console.error(`❌ Organization not found: ${orgPK}`)
      process.exit(1)
    }

    console.log('\n📦 Current organization state:')
    console.log(`PK: ${org.PK}`)
    console.log(`Name: ${org.name || 'N/A'}`)
    console.log(`Current warehouse_config: ${org.warehouse_config ? JSON.stringify(org.warehouse_config, null, 2) : 'None'}`)

    // Update
    await updateWarehouseConfig(orgPK)

    // Verify
    const updated = await getOrganization(orgPK)
    console.log('\n📦 Updated organization state:')
    console.log(`warehouse_config: ${JSON.stringify(updated?.warehouse_config, null, 2)}`)

  } else {
    console.log('Usage:')
    console.log('  npx tsx scripts/update-warehouse-config.ts list')
    console.log('  npx tsx scripts/update-warehouse-config.ts update "ORG#<id>"')
  }
}

main().catch(console.error)
