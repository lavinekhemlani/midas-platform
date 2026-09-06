// scripts/setup-bc-credentials.ts
// Run with: npx ts-node scripts/setup-bc-credentials.ts
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import bcrypt from 'bcrypt'

const REGION = process.env.AWS_REGION || 'us-east-1'
const TABLE_NAME = 'bc_credentials'

const client = new DynamoDBClient({ region: REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)

async function createTable() {
  console.log(`Creating table: ${TABLE_NAME}...`)

  try {
    // Check if table already exists
    try {
      await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }))
      console.log(`Table ${TABLE_NAME} already exists.`)
      return true
    } catch (err: any) {
      if (err.name !== 'ResourceNotFoundException') {
        throw err
      }
    }

    // Create the table
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
          { Key: 'Application', Value: 'zenith-os' },
          { Key: 'Purpose', Value: 'Dynamics BC faux credentials' },
        ],
      })
    )

    console.log(`Table ${TABLE_NAME} created successfully!`)

    // Wait for table to be active
    console.log('Waiting for table to become active...')
    let isActive = false
    while (!isActive) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const { Table } = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }))
      if (Table?.TableStatus === 'ACTIVE') {
        isActive = true
        console.log('Table is now ACTIVE.')
      }
    }

    return true
  } catch (error) {
    console.error('Error creating table:', error)
    return false
  }
}

async function addCredential(config: {
  username: string
  password: string
  organizationId?: string | null // null = unclaimed (first-claim model)
  schemaName: string
  displayName: string
  createdBy: string
}) {
  const { username, password, organizationId, schemaName, displayName, createdBy } = config

  console.log(`\nAdding credential for: ${username}`)

  // Hash the password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12)
  const now = Math.floor(Date.now() / 1000)

  const item: Record<string, any> = {
    PK: `CRED#${username}`,
    SK: 'CREDENTIAL',
    username,
    password_hash: passwordHash,
    organization_id: organizationId || null, // null = unclaimed
    schema_name: schemaName,
    display_name: displayName,
    status: 'active',
    login_attempts: 0,
    locked_until: null,
    last_login_at: null,
    created_at: now,
    created_by: createdBy,
  }

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    )
    console.log(`Credential created successfully!`)
    console.log(`  Username: ${username}`)
    console.log(`  Schema: ${schemaName}`)
    console.log(`  Display Name: ${displayName}`)
    console.log(`  Organization: ${organizationId}`)
    return true
  } catch (error) {
    console.error('Error adding credential:', error)
    return false
  }
}

async function main() {
  console.log('=== BC Credentials Setup ===\n')

  // Step 1: Create the table
  const tableCreated = await createTable()
  if (!tableCreated) {
    process.exit(1)
  }

  // Step 2: Add bc_aquaculture credential (using first-claim model - no org ID)
  const aquacultureCredential = {
    username: 'bc_aquaculture',
    password: 'AquaBC2024!', // Change this in production!
    organizationId: null, // First-claim model: will be assigned on first successful login
    schemaName: 'bc_aquaculture',
    displayName: 'Aquaculture Business Central',
    createdBy: 'system-setup',
  }

  await addCredential(aquacultureCredential)

  console.log('\n=== Setup Complete ===')
  console.log('\nCredential created with FIRST-CLAIM model:')
  console.log('  - No organization assigned yet')
  console.log('  - First user to successfully login will claim it for their org')
  console.log('  - After claimed, only users from that org can use it')
  console.log('\nTest credentials:')
  console.log('  Username: bc_aquaculture')
  console.log('  Password: AquaBC2024!')
}

main().catch(console.error)
