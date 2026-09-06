// scripts/setup-bc-globics-credential.ts
// Adds a bc_globics credential to the existing bc_credentials table.
// Run with: npx tsx scripts/setup-bc-globics-credential.ts
//
// Prerequisites:
//   1. bc_credentials table exists (created by setup-bc-credentials.ts)
//   2. Fivetran has synced Globics BC data to Redshift schema bc_globics
//   3. Redshift IAM user has GRANT USAGE/SELECT on bc_globics schema
//
// After running:
//   Go to Settings > Integrations > Business Central > "Connect Another Data Source"
//   Enter username: bc_globics, password: GlobicsBC2024!

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import bcrypt from 'bcrypt'

const REGION = process.env.AWS_REGION || 'us-east-1'
const TABLE_NAME = process.env.BC_CREDENTIALS_TABLE_NAME || 'bc_credentials'

const client = new DynamoDBClient({ region: REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)

const CREDENTIAL_CONFIG = {
  username: 'bc_globics',
  password: 'GlobicsBC2024!', // Change this in production!
  organizationId: null, // First-claim model: assigned on first successful login
  schemaName: 'bc_globics',
  displayName: 'Globics Shipping Business Central',
  createdBy: 'system-setup',
}

async function main() {
  console.log('=== BC Globics Credential Setup ===\n')

  // Verify table exists
  try {
    const { Table } = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }))
    console.log(`Table ${TABLE_NAME} exists (status: ${Table?.TableStatus})`)
  } catch (err: any) {
    if (err.name === 'ResourceNotFoundException') {
      console.error(`Table ${TABLE_NAME} does not exist. Run setup-bc-credentials.ts first.`)
      process.exit(1)
    }
    throw err
  }

  // Check if credential already exists
  const { Item: existing } = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `CRED#${CREDENTIAL_CONFIG.username}`, SK: 'CREDENTIAL' },
    })
  )

  if (existing) {
    console.log(`\nCredential for "${CREDENTIAL_CONFIG.username}" already exists:`)
    console.log(`  Schema: ${existing.schema_name}`)
    console.log(`  Display Name: ${existing.display_name}`)
    console.log(`  Organization: ${existing.organization_id || '(unclaimed)'}`)
    console.log(`  Status: ${existing.status}`)
    console.log(`\nNo changes made. Delete the item first if you want to recreate it.`)
    return
  }

  // Hash password and create credential
  const passwordHash = await bcrypt.hash(CREDENTIAL_CONFIG.password, 12)
  const now = Math.floor(Date.now() / 1000)

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `CRED#${CREDENTIAL_CONFIG.username}`,
        SK: 'CREDENTIAL',
        username: CREDENTIAL_CONFIG.username,
        password_hash: passwordHash,
        organization_id: CREDENTIAL_CONFIG.organizationId,
        schema_name: CREDENTIAL_CONFIG.schemaName,
        display_name: CREDENTIAL_CONFIG.displayName,
        status: 'active',
        login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: now,
        created_by: CREDENTIAL_CONFIG.createdBy,
      },
    })
  )

  console.log(`\nCredential created successfully!`)
  console.log(`  Username: ${CREDENTIAL_CONFIG.username}`)
  console.log(`  Password: ${CREDENTIAL_CONFIG.password}`)
  console.log(`  Schema:   ${CREDENTIAL_CONFIG.schemaName}`)
  console.log(`  Display:  ${CREDENTIAL_CONFIG.displayName}`)
  console.log(`  Org:      (unclaimed — first-claim model)`)
  console.log(`\n=== Next Steps ===`)
  console.log(`1. Ensure Fivetran has synced bc_globics to Redshift`)
  console.log(`2. GRANT USAGE ON SCHEMA bc_globics TO "IAM:zenith-os-dev"`)
  console.log(`3. GRANT SELECT ON ALL TABLES IN SCHEMA bc_globics TO "IAM:zenith-os-dev"`)
  console.log(`4. Go to Settings > Integrations > Business Central > Connect Another Data Source`)
  console.log(`5. Enter username: ${CREDENTIAL_CONFIG.username}, password: ${CREDENTIAL_CONFIG.password}`)
}

main().catch(console.error)
