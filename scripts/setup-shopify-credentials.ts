// scripts/setup-shopify-credentials.ts
// Creates the shopify_credentials DynamoDB table and seeds a test credential.
// Run with: npx ts-node scripts/setup-shopify-credentials.ts
import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import bcrypt from 'bcrypt'

const REGION = process.env.AWS_REGION || 'us-east-1'
const TABLE_NAME = 'shopify_credentials'

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
          { Key: 'Purpose', Value: 'Shopify faux credentials for custom app auth' },
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
  clientId: string
  clientSecret: string
  shopDomain: string
  displayName: string
  createdBy: string
}) {
  const { username, password, clientId, clientSecret, shopDomain, displayName, createdBy } = config

  console.log(`\nAdding credential for: ${username}`)

  // Hash the password with bcrypt (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12)
  const now = Math.floor(Date.now() / 1000)

  const item: Record<string, any> = {
    PK: `CRED#${username}`,
    SK: 'CREDENTIAL',
    username,
    password_hash: passwordHash,
    client_id: clientId,
    client_secret: clientSecret,
    shop_domain: shopDomain,
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
    console.log(`  Username:     ${username}`)
    console.log(`  Shop Domain:  ${shopDomain}`)
    console.log(`  Display Name: ${displayName}`)
    console.log(`  Client ID:    ${clientId.slice(0, 8)}...`)
    return true
  } catch (error) {
    console.error('Error adding credential:', error)
    return false
  }
}

async function main() {
  console.log('=== Shopify Credentials Setup ===\n')

  // Step 1: Create the table
  const tableCreated = await createTable()
  if (!tableCreated) {
    process.exit(1)
  }

  // Step 2: Add credential
  const sampleCredential = {
    username: 'pininfarinahybridwatch',
    password: 'GlobicsPHW2026!',
    clientId: '63fe1be9658ccdb7151016cbc979d30a',
    clientSecret: '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',
    shopDomain: 'w0zdzz-im.myshopify.com',
    displayName: 'Pininfarina Hybrid Watch',
    createdBy: 'Joel',
  }

  await addCredential(sampleCredential)

  console.log('\n=== Setup Complete ===')
  console.log('\nTo add a real credential, edit this script or run:')
  console.log('  npx ts-node scripts/add-shopify-credential.ts')
  console.log('\nTable: shopify_credentials')
  console.log('Key schema: PK=CRED#{username}, SK=CREDENTIAL')
  console.log('\nEach credential stores:')
  console.log('  - username / password_hash (bcrypt)')
  console.log('  - client_id / client_secret (Shopify app credentials)')
  console.log('  - shop_domain (the store to connect)')
  console.log('  - display_name (shown in UI after connection)')
}

main().catch(console.error)
