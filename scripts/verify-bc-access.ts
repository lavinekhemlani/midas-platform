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

async function main() {
  console.log('\n=== Verifying BC Aquaculture Access ===\n')

  // 1. List all tables
  console.log('1. Tables in bc_aquaculture:')
  const tables = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'bc_aquaculture'
    ORDER BY table_name
  `)
  for (const t of tables) {
    console.log(`   - ${t.table_name}`)
  }
  console.log(`   Total: ${tables.length} tables\n`)

  // 2. Row counts for key financial tables
  console.log('2. Row counts for key tables:')
  const keyTables = [
    'g_l_entry', 'g_l_account', 'customer', 'vendor',
    'sales_invoice_header', 'sales_invoice_line',
    'sales_cr_memo_header', 'sales_cr_memo_line',
    'purch_inv_header', 'purch_inv_line',
    'item', 'item_ledger_entry',
    'bank_account', 'bank_account_ledger_entry',
    'cust_ledger_entry', 'vendor_ledger_entry',
    'company_information', 'dimension', 'dimension_value',
    'currency', 'currency_exchange_rate', 'payment_terms',
    'value_entry', 'location', 'item_category',
  ]

  const counts: { name: string; count: number }[] = []
  for (const t of keyTables) {
    if (tables.some((tt: any) => tt.table_name === t)) {
      try {
        const result = await query(`SELECT COUNT(*) as cnt FROM bc_aquaculture.${t}`)
        counts.push({ name: t, count: Number(result[0]?.cnt || 0) })
      } catch {
        counts.push({ name: t, count: -1 })
      }
    }
  }

  counts.sort((a, b) => b.count - a.count)
  for (const c of counts) {
    console.log(`   ${c.name.padEnd(30)} ${c.count === -1 ? 'ERROR' : c.count.toLocaleString().padStart(12)}`)
  }

  // 3. Data date range
  console.log('\n3. GL Entry date range:')
  const dateRange = await query(`
    SELECT MIN(posting_date) as earliest, MAX(posting_date) as latest,
           COUNT(DISTINCT DATE_TRUNC('month', posting_date)) as months
    FROM bc_aquaculture.g_l_entry
    WHERE _fivetran_deleted = false
  `)
  console.log(`   Earliest: ${dateRange[0]?.earliest}`)
  console.log(`   Latest:   ${dateRange[0]?.latest}`)
  console.log(`   Months:   ${dateRange[0]?.months}`)

  // 4. Quick Shopify check
  console.log('\n4. Fivetran Shopify tables:')
  const shopifyTables = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'fivetran_shopify'
    ORDER BY table_name
  `)
  for (const t of shopifyTables) {
    console.log(`   - ${t.table_name}`)
  }
  console.log(`   Total: ${shopifyTables.length} tables`)
}

main().catch((e) => console.error('Error:', e))
