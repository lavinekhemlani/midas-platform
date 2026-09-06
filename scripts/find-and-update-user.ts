import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

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

const USERS_TABLE = process.env.USERS_TABLE_NAME || 'zenith-users'
const ORGS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

async function main() {
  const targetEmail = 'redacted-user2@example.com'
  console.log(`\n=== Looking up user: ${targetEmail} ===\n`)
  console.log(`Users table: "${USERS_TABLE}"`)
  console.log(`Orgs table: "${ORGS_TABLE}"`)

  // Step 1: Find the user
  const userScan = await ddbDocClient.send(
    new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': targetEmail },
    })
  )

  if (!userScan.Items || userScan.Items.length === 0) {
    console.log(`\nNo user found with email "${targetEmail}"`)
    return
  }

  const user = userScan.Items[0]
  console.log(`\nUser found:`)
  console.log(`  PK: ${user.PK}`)
  console.log(`  email: ${user.email}`)
  console.log(`  first_name: ${user.first_name}`)
  console.log(`  last_name: ${user.last_name}`)
  console.log(`  role_title: ${user.role_title}`)
  console.log(`  organization_id: ${user.organization_id}`)
  console.log(`  organizationId: ${user.organizationId}`)

  const orgId = user.organization_id || user.organizationId
  if (!orgId) {
    console.log(`\nNo organization_id on this user record!`)
    return
  }

  // Step 2: Find their organization
  const orgPK = orgId.startsWith('ORG#') ? orgId : `ORG#${orgId}`
  console.log(`\n=== Looking up organization: ${orgPK} ===`)

  const { GetCommand } = await import('@aws-sdk/lib-dynamodb')
  const orgResult = await ddbDocClient.send(
    new GetCommand({ TableName: ORGS_TABLE, Key: { PK: orgPK, SK: 'PROFILE' } })
  )

  if (!orgResult.Item) {
    console.log(`No org found for PK: "${orgPK}"`)
    return
  }

  const org = orgResult.Item
  console.log(`\nOrganization found:`)
  console.log(`  PK: ${org.PK}`)
  console.log(`  name: ${org.name}`)
  console.log(`  organization_id: ${org.organization_id}`)
  console.log(`  warehouse_config: ${org.warehouse_config ? 'EXISTS' : 'MISSING'}`)

  if (org.warehouse_config) {
    console.log(`  warehouse_config.enabled: ${org.warehouse_config.enabled}`)
    console.log(`  warehouse_config.schemas: ${JSON.stringify(org.warehouse_config.schemas?.map((s: any) => s.schema_name))}`)
    console.log(`\nThis org already has warehouse_config!`)
    return
  }

  // Step 3: Add warehouse_config
  console.log(`\n=== Adding warehouse_config to org "${org.name}" (${orgPK}) ===`)

  const warehouseConfig = {
    enabled: true,
    default_schema: 'bc_aquaculture',
    schemas: [
      {
        schema_name: 'bc_aquaculture',
        source_type: 'business_central',
        display_name: 'Premium Aquaculture BC',
        connected_at: Math.floor(Date.now() / 1000),
      },
      {
        schema_name: 'd365_mock',
        source_type: 'd365',
        display_name: 'D365 Mock Data',
        connected_at: 1738627200,
      },
    ],
  }

  await ddbDocClient.send(
    new UpdateCommand({
      TableName: ORGS_TABLE,
      Key: { PK: orgPK, SK: 'PROFILE' },
      UpdateExpression: 'SET warehouse_config = :wc',
      ExpressionAttributeValues: { ':wc': warehouseConfig },
    })
  )

  console.log(`\nWarehouse config added successfully!`)
  console.log(`  enabled: true`)
  console.log(`  schemas: bc_aquaculture, d365_mock`)
  console.log(`  default_schema: bc_aquaculture`)
}

main().catch((e) => console.error('Error:', e))
