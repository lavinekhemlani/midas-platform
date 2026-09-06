import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  ListDatabasesCommand,
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

async function query(sql: string, database = 'dev'): Promise<any[]> {
  const exec = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: workgroup,
      Database: database,
      Sql: sql,
    })
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

async function main() {
  console.log('\n🔍 Exploring Redshift for BC Data\n')

  // List all databases
  console.log('1. Listing databases...')
  try {
    const dbs = await client.send(
      new ListDatabasesCommand({
        WorkgroupName: workgroup,
        Database: 'dev',
      })
    )
    console.log('   Databases:', dbs.Databases?.join(', ') || 'None found')
  } catch (e: any) {
    console.log('   Could not list databases:', e.message)
  }

  // List all schemas in dev
  console.log('\n2. Schemas in dev database:')
  const schemas = await query('SELECT schema_name FROM svv_all_schemas ORDER BY schema_name')
  for (const s of schemas) {
    console.log(`   - ${s.schema_name}`)
  }

  // List tables in d365_mock (the mock data)
  console.log('\n3. Tables in d365_mock schema:')
  const d365Tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'd365_mock'
    ORDER BY table_name
  `)
  for (const t of d365Tables) {
    console.log(`   - ${t.table_name}`)
  }

  // List tables in public schema (might have BC data)
  console.log('\n4. Tables in public schema:')
  const publicTables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `)
  if (publicTables.length === 0) {
    console.log('   (empty)')
  } else {
    for (const t of publicTables) {
      console.log(`   - ${t.table_name}`)
    }
  }

  // Search for any table with 'ledger' or 'customer' in the name (BC tables)
  console.log('\n5. Searching for BC-like tables across all schemas...')
  const bcTables = await query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE LOWER(table_name) LIKE '%ledger%'
       OR LOWER(table_name) LIKE '%customer%'
       OR LOWER(table_name) LIKE '%vendor%'
       OR LOWER(table_name) LIKE '%g_l_%'
    ORDER BY table_schema, table_name
  `)
  if (bcTables.length === 0) {
    console.log('   No BC-like tables found in any schema')
  } else {
    for (const t of bcTables) {
      console.log(`   - ${t.table_schema}.${t.table_name}`)
    }
  }

  // Check row counts for d365_mock tables
  console.log('\n6. Row counts for d365_mock tables:')
  for (const t of d365Tables) {
    try {
      const countResult = await query(`SELECT COUNT(*) as cnt FROM d365_mock.${t.table_name}`)
      console.log(`   ${t.table_name}: ${Number(countResult[0]?.cnt || 0).toLocaleString()} rows`)
    } catch (e) {
      console.log(`   ${t.table_name}: Error`)
    }
  }
}

main().catch((e) => console.error('Error:', e))
