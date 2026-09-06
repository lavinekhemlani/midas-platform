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

const client = new RedshiftDataClient({ region: process.env.AWS_REGION || 'us-east-1' })
const workgroup = process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics'
const database = process.env.REDSHIFT_DATABASE || 'dev'

async function query(sql: string): Promise<any[]> {
  const exec = await client.send(
    new ExecuteStatementCommand({ WorkgroupName: workgroup, Database: database, Sql: sql })
  )
  let status = 'SUBMITTED'
  while (status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') {
    await new Promise((r) => setTimeout(r, 1000))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec.Id }))
    status = desc.Status || 'FAILED'
    if (status === 'FAILED') throw new Error(desc.Error || 'Query failed')
  }
  const result = await client.send(new GetStatementResultCommand({ Id: exec.Id }))
  return (
    result.Records?.map((row) => {
      const obj: any = {}
      row.forEach((field, i) => {
        const col = result.ColumnMetadata?.[i]?.name || String(i)
        obj[col] = field.stringValue ?? field.longValue ?? field.doubleValue ?? null
      })
      return obj
    }) || []
  )
}

async function tryQuery(label: string, sql: string) {
  try {
    const result = await query(sql)
    console.log(`${label}: ${JSON.stringify(result)}`)
    return result
  } catch (e: any) {
    console.log(`${label}: ERROR - ${e.message}`)
    return null
  }
}

async function main() {
  console.log(`\nDB: ${database}, Workgroup: ${workgroup}\n`)

  // 1. List ALL schemas including ones we might not have access to
  console.log('=== 1. ALL schemas (pg_namespace) ===')
  await tryQuery('schemas', `SELECT nspname FROM pg_catalog.pg_namespace ORDER BY nspname`)

  // 2. Try direct access to bc_aquaculture
  console.log('\n=== 2. Direct bc_aquaculture access ===')
  await tryQuery('direct', `SELECT COUNT(*) as cnt FROM bc_aquaculture.g_l_entry`)

  // 3. Try different possible schema names
  console.log('\n=== 3. Try possible schema names ===')
  const possibleNames = [
    'bc_aquaculture',
    'business_central',
    'business_central_aquaculture',
    'fivetran_business_central',
    'aquaculture',
  ]
  for (const name of possibleNames) {
    await tryQuery(name, `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${name}'`)
  }

  // 4. Check all non-system schemas from pg_namespace
  console.log('\n=== 4. Non-system schemas with table counts ===')
  await tryQuery(
    'all schemas with tables',
    `SELECT schemaname, COUNT(*) as table_count
     FROM pg_catalog.pg_tables
     WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_internal')
     GROUP BY schemaname
     ORDER BY schemaname`
  )

  // 5. Check if there are any tables with 'g_l' in the name anywhere
  console.log('\n=== 5. Search for g_l tables ===')
  await tryQuery(
    'g_l tables',
    `SELECT schemaname, tablename
     FROM pg_catalog.pg_tables
     WHERE tablename LIKE '%g_l%'`
  )
}

main().catch((e) => console.error('Fatal:', e))
