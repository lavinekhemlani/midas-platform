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

const client = new RedshiftDataClient({ region: 'us-east-1' })

async function query(sql: string): Promise<any[]> {
  console.log('Executing:', sql.slice(0, 100) + '...')

  const exec = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics',
      Database: process.env.REDSHIFT_DATABASE || 'dev',
      Sql: sql,
    })
  )

  // Wait for completion
  let status = 'SUBMITTED'
  let attempts = 0
  while ((status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') && attempts < 60) {
    await new Promise((r) => setTimeout(r, 1000))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec.Id }))
    status = desc.Status || 'FAILED'
    attempts++
    if (status === 'FAILED') {
      console.error('Query failed:', desc.Error)
      throw new Error(desc.Error)
    }
  }

  if (status !== 'FINISHED') {
    throw new Error(`Query timed out with status: ${status}`)
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
  console.log('\n📋 Listing all tables in bc_aquaculture schema\n')

  // First, list all tables
  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'bc_aquaculture'
    ORDER BY table_name
  `)

  console.log(`\nFound ${tables.length} tables:\n`)
  for (const t of tables) {
    console.log(`  - ${t.table_name}`)
  }

  // Now get counts for key tables
  console.log('\n\n📊 Getting row counts for key tables...\n')

  const keyTables = [
    'g_l_entry',
    'g_l_account',
    'customer',
    'vendor',
    'sales_invoice_header',
    'item',
  ]

  for (const tableName of keyTables) {
    // Check if table exists
    const exists = tables.some((t: any) => t.table_name === tableName)
    if (exists) {
      try {
        const countResult = await query(`SELECT COUNT(*) as cnt FROM bc_aquaculture.${tableName}`)
        console.log(`${tableName}: ${Number(countResult[0]?.cnt || 0).toLocaleString()} rows`)
      } catch (e: any) {
        console.log(`${tableName}: Error - ${e.message}`)
      }
    } else {
      console.log(`${tableName}: Table not found`)
    }
  }
}

main().catch((e) => console.error('Error:', e))
