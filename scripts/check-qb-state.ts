// scripts/check-qb-state.ts
// Quick script to check the QB state in DynamoDB for the org
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'
import * as fs from 'fs'

// Parse .env.local
const envPath = '.env.local'
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  const key = trimmed.substring(0, eqIdx).trim()
  let val = trimmed.substring(eqIdx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  envVars[key] = val
}

const region = envVars.AWS_REGION || envVars.NEXT_PUBLIC_AWS_REGION || 'us-east-1'
const tableName = envVars.ORGANIZATIONS_TABLE_NAME || 'organizations'
const orgId = 'ORG#04d53cbc-7e6a-468c-befd-2e5e2d620fe5'

async function main() {
  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: envVars.AWS_ACCESS_KEY_ID!,
      secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY!,
    },
  })
  const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  })

  console.log(`Querying org: ${orgId}`)
  console.log(`Table: ${tableName}, Region: ${region}`)
  console.log('---')

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: orgId, SK: 'PROFILE' },
      ConsistentRead: true,
    })
  )

  if (!Item) {
    console.log('Organization NOT FOUND')
    return
  }

  console.log('Organization name:', Item.name)
  console.log('Provider keys:', Item.providers ? Object.keys(Item.providers) : 'NO PROVIDERS')
  console.log('---')

  const qb = Item.providers?.quickbooks
  if (!qb) {
    console.log('NO QuickBooks provider data at all')
    console.log('\nFull providers object:')
    console.log(JSON.stringify(Item.providers, null, 2))
    return
  }

  console.log('=== QuickBooks Provider State ===')
  console.log('providerName:', qb.providerName)
  console.log('activeRealmId:', qb.activeRealmId)
  console.log('')

  // Check connections map
  if (qb.connections) {
    const connKeys = Object.keys(qb.connections)
    console.log(`connections map: ${connKeys.length} entries`)
    for (const [realmId, conn] of Object.entries(qb.connections) as [string, any][]) {
      console.log(`  [${realmId}]:`)
      console.log(`    connected: ${conn?.credentials?.connected}`)
      console.log(`    company_name: ${conn?.credentials?.company_name}`)
      console.log(`    home_currency: ${conn?.credentials?.home_currency}`)
      console.log(`    realm_id: ${conn?.credentials?.realm_id}`)
      console.log(`    has_access_token: ${!!conn?.credentials?.access_token}`)
      console.log(`    has_refresh_token: ${!!conn?.credentials?.refresh_token}`)
      console.log(`    last_synced: ${conn?.credentials?.last_synced}`)
      console.log(`    connectedAt: ${conn?.connectedAt}`)
      console.log(`    connectedBy: ${conn?.connectedBy}`)
      console.log(`    plan: ${conn?.plan}`)
    }
  } else {
    console.log('connections map: NOT PRESENT')
  }
  console.log('')

  // Check legacy credentials
  if (qb.credentials) {
    console.log('=== Legacy credentials ===')
    console.log('  connected:', qb.credentials.connected)
    console.log('  realm_id:', qb.credentials.realm_id)
    console.log('  company_name:', qb.credentials.company_name)
    console.log('  home_currency:', qb.credentials.home_currency)
    console.log('  has_access_token:', !!qb.credentials.access_token)
    console.log('  has_refresh_token:', !!qb.credentials.refresh_token)
    console.log('  last_synced:', qb.credentials.last_synced)
  } else {
    console.log('Legacy credentials: NOT PRESENT')
  }

  console.log('')
  console.log('=== Other QB fields ===')
  console.log('plan:', qb.plan)
  console.log('planLastChecked:', qb.planLastChecked)
  console.log('syncCursors:', qb.syncCursors)

  // Also dump the full QB object keys for completeness
  console.log('\nAll QB top-level keys:', Object.keys(qb))
}

main().catch(console.error)
