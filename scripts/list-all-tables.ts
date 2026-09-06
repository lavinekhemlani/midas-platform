import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
} from '@aws-sdk/client-redshift-data'

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

async function main() {
  console.log('\n📊 All Tables in business_central_aquaculture Schema\n')
  console.log('═'.repeat(70))

  // Get all tables
  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'business_central_aquaculture'
    ORDER BY table_name
  `)

  console.log(`\nFound ${tables.length} tables:\n`)

  for (const t of tables) {
    console.log(`  - ${t.table_name}`)
  }

  // Check for ledger-related tables
  console.log('\n' + '═'.repeat(70))
  console.log('\n🔍 Looking for ledger-related tables:\n')

  const ledgerTables = tables.filter(
    (t: any) =>
      t.table_name.toLowerCase().includes('ledger') || t.table_name.toLowerCase().includes('entry')
  )

  if (ledgerTables.length > 0) {
    for (const t of ledgerTables) {
      console.log(`  ✓ ${t.table_name}`)
    }
  } else {
    console.log('  ❌ No ledger/entry tables found')
  }

  // Also check bc_aquaculture schema
  console.log('\n' + '═'.repeat(70))
  console.log('\n📊 Checking bc_aquaculture schema:\n')

  try {
    const bcTables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'bc_aquaculture'
      ORDER BY table_name
    `)

    console.log(`Found ${bcTables.length} tables:\n`)

    for (const t of bcTables) {
      console.log(`  - ${t.table_name}`)
    }

    const bcLedgerTables = bcTables.filter(
      (t: any) =>
        t.table_name.toLowerCase().includes('ledger') ||
        t.table_name.toLowerCase().includes('entry')
    )

    console.log('\n🔍 Ledger-related tables in bc_aquaculture:\n')
    if (bcLedgerTables.length > 0) {
      for (const t of bcLedgerTables) {
        console.log(`  ✓ ${t.table_name}`)
      }
    } else {
      console.log('  ❌ No ledger/entry tables found')
    }
  } catch (e: any) {
    console.log(`  Schema bc_aquaculture not accessible: ${e.message}`)
  }
}

main().catch((e) => console.error('Error:', e))
