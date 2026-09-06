import { readFileSync } from 'fs'
import { resolve } from 'path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

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
const TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME || 'zenith-organizations'

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

async function updateOrg(pk: string, name: string) {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: 'PROFILE' },
      UpdateExpression: 'SET warehouse_config = :wc',
      ExpressionAttributeValues: { ':wc': warehouseConfig },
    })
  )
  console.log(`Updated ${name} (${pk})`)
}

async function main() {
  console.log('\nUpdating warehouse configs with bc_aquaculture + d365_mock...\n')

  // CFO Org
  await updateOrg('ORG#d49faafe-5b8a-4616-9fd2-95e5278de9be', 'CFO Org')

  // Anu Gmorg
  await updateOrg('ORG#04d53cbc-7e6a-468c-befd-2e5e2d620fe5', 'Anu Gmorg')

  console.log('\nDone!')
}

main().catch((e) => console.error('Error:', e))
