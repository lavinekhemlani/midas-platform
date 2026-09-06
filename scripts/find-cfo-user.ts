import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env
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

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const ddbDocClient = DynamoDBDocumentClient.from(client)

async function main() {
  const usersTable = process.env.USERS_TABLE_NAME || 'zenith-users'
  const orgsTable = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

  console.log('\n🔍 Searching for CFO users...\n')
  console.log(`Users table: ${usersTable}`)
  console.log(`Orgs table: ${orgsTable}\n`)

  // Get all users
  const result = await ddbDocClient.send(new ScanCommand({
    TableName: usersTable,
    FilterExpression: 'SK = :profile',
    ExpressionAttributeValues: { ':profile': 'PROFILE' },
  }))

  const users = result.Items || []
  console.log(`Total users found: ${users.length}\n`)

  // Find CFO users
  const cfoUsers = users.filter(u => {
    const name = (u.name || u.first_name || '').toLowerCase()
    const email = (u.email || '').toLowerCase()
    return name.includes('cfo') || email.includes('cfo')
  })

  if (cfoUsers.length === 0) {
    console.log('No users with "CFO" in name or email found.')
    console.log('\nShowing all users with their organizations:\n')
    console.log('─'.repeat(100))

    for (const user of users.slice(0, 30)) {
      const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'
      console.log(`User: ${name}`)
      console.log(`  PK: ${user.PK}`)
      console.log(`  Email: ${user.email || 'N/A'}`)
      console.log(`  Org ID: ${user.organization_id || user.organizationId || 'None'}`)
      console.log('─'.repeat(100))
    }
  } else {
    console.log(`Found ${cfoUsers.length} CFO user(s):\n`)
    console.log('─'.repeat(100))

    for (const user of cfoUsers) {
      const name = user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A'
      console.log(`User: ${name}`)
      console.log(`  PK: ${user.PK}`)
      console.log(`  Email: ${user.email || 'N/A'}`)
      console.log(`  Org ID: ${user.organization_id || user.organizationId || 'None'}`)
      console.log('─'.repeat(100))
    }
  }
}

main().catch(e => console.error('Error:', e))
