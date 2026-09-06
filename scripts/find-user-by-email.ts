import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
      process.env[key] = value
    }
  }
}

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const ddbDocClient = DynamoDBDocumentClient.from(client)

const searchEmail = process.argv[2] || 'redacted-owner@example.com'

async function main() {
  console.log(`\nSearching for: ${searchEmail}\n`)

  const result = await ddbDocClient.send(new ScanCommand({
    TableName: 'users',
    FilterExpression: 'SK = :profile',
    ExpressionAttributeValues: { ':profile': 'PROFILE' },
  }))

  const users = result.Items || []
  console.log(`Total users scanned: ${users.length}`)

  // Exact match
  const exactMatch = users.find(u => u.email === searchEmail)
  if (exactMatch) {
    console.log('\n✅ Found exact match:')
    console.log('─'.repeat(60))
    console.log('Name:', exactMatch.name || `${exactMatch.first_name || ''} ${exactMatch.last_name || ''}`.trim())
    console.log('PK:', exactMatch.PK)
    console.log('Email:', exactMatch.email)
    console.log('Org ID:', exactMatch.organization_id || exactMatch.organizationId || 'None')
    console.log('─'.repeat(60))
  } else {
    console.log('\n❌ No exact match found.')

    // Partial matches
    const partials = users.filter(u =>
      (u.email || '').toLowerCase().includes(searchEmail.split('@')[0].toLowerCase())
    )

    if (partials.length > 0) {
      console.log(`\nPartial matches (${partials.length}):`)
      for (const u of partials) {
        console.log('─'.repeat(60))
        console.log('Name:', u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim())
        console.log('Email:', u.email)
        console.log('Org ID:', u.organization_id || u.organizationId || 'None')
      }
    }
  }
}

main().catch(e => console.error('Error:', e))
