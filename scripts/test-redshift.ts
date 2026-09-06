import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
} from '@aws-sdk/client-redshift-data'

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

console.log('Environment:')
console.log('  AWS_REGION:', process.env.AWS_REGION)
console.log('  REDSHIFT_WORKGROUP_NAME:', process.env.REDSHIFT_WORKGROUP_NAME)
console.log('  REDSHIFT_DATABASE:', process.env.REDSHIFT_DATABASE)

const client = new RedshiftDataClient({ region: process.env.AWS_REGION || 'us-east-1' })

async function main() {
  console.log('\n🔌 Testing Redshift connection...\n')

  // Simple test query
  const sql = 'SELECT current_database(), current_schema(), current_user'

  console.log('Executing:', sql)

  const exec = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics',
      Database: process.env.REDSHIFT_DATABASE || 'dev',
      Sql: sql,
    })
  )

  console.log('Statement ID:', exec.Id)

  let status = 'SUBMITTED'
  let attempts = 0
  while ((status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec.Id }))
    status = desc.Status || 'FAILED'
    console.log(`  Status: ${status}`)
    attempts++
    if (status === 'FAILED') {
      console.error('Query failed:', desc.Error)
      return
    }
  }

  if (status === 'FINISHED') {
    const result = await client.send(new GetStatementResultCommand({ Id: exec.Id }))
    console.log('\nResult:')
    console.log('  Columns:', result.ColumnMetadata?.map((c) => c.name).join(', '))
    console.log('  Records:', result.Records)
  }

  // Now try to list schemas
  console.log('\n\nListing schemas with SVV_ALL_SCHEMAS...')
  const exec2 = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics',
      Database: process.env.REDSHIFT_DATABASE || 'dev',
      Sql: 'SELECT schema_name FROM svv_all_schemas ORDER BY schema_name',
    })
  )

  status = 'SUBMITTED'
  attempts = 0
  while ((status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') && attempts < 30) {
    await new Promise((r) => setTimeout(r, 1000))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec2.Id }))
    status = desc.Status || 'FAILED'
    attempts++
  }

  if (status === 'FINISHED') {
    const result = await client.send(new GetStatementResultCommand({ Id: exec2.Id }))
    console.log('\nSchemas:')
    for (const row of result.Records || []) {
      console.log('  -', row[0]?.stringValue)
    }
  }
}

main().catch((e) => console.error('Error:', e))
