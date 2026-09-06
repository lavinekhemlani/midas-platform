// scripts/fix-qb-legacy.ts
// Fix the stale legacy credentials.connected = false
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
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

const region = envVars.AWS_REGION || 'us-east-1'
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

  console.log('Fixing legacy credentials.connected for org:', orgId)

  await ddb.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: orgId, SK: 'PROFILE' },
      UpdateExpression: 'SET #providers.#quickbooks.#creds.#connected = :t',
      ExpressionAttributeNames: {
        '#providers': 'providers',
        '#quickbooks': 'quickbooks',
        '#creds': 'credentials',
        '#connected': 'connected',
      },
      ExpressionAttributeValues: {
        ':t': true,
      },
    })
  )

  console.log('Done! Legacy credentials.connected = true')
}

main().catch(console.error)
