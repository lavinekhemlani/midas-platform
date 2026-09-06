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
    await new Promise((r) => setTimeout(r, 500))
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
  // Tables to explore for additional features
  const tablesToCheck = [
    'customer',
    'vendor',
    'item',
    'item_ledger_entry',
    'bank_account',
    'dimension',
    'dimension_value',
    'currency_exchange_rate',
    'employee',
    'job',
    'sales_invoice_header',
    'purch_inv_header',
  ]

  console.log('🔍 Exploring table columns for potential new features\n')
  console.log('═'.repeat(70))

  for (const table of tablesToCheck) {
    console.log(`\n📋 ${table.toUpperCase()} columns:\n`)
    const cols = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'bc_aquaculture' AND table_name = '${table}'
      ORDER BY ordinal_position
    `)
    for (const c of cols) {
      console.log(`  - ${c.column_name} (${c.data_type})`)
    }
  }

  // Get sample data from some key tables
  console.log('\n' + '═'.repeat(70))
  console.log('\n📊 Sample data counts:\n')

  const countQueries = [
    {
      name: 'Customers',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.customer WHERE _fivetran_deleted = false',
    },
    {
      name: 'Vendors',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.vendor WHERE _fivetran_deleted = false',
    },
    {
      name: 'Items',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.item WHERE _fivetran_deleted = false',
    },
    {
      name: 'GL Entries',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.g_l_entry WHERE _fivetran_deleted = false',
    },
    {
      name: 'Item Ledger Entries',
      query:
        'SELECT COUNT(*) as cnt FROM bc_aquaculture.item_ledger_entry WHERE _fivetran_deleted = false',
    },
    {
      name: 'Bank Accounts',
      query:
        'SELECT COUNT(*) as cnt FROM bc_aquaculture.bank_account WHERE _fivetran_deleted = false',
    },
    {
      name: 'Employees',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.employee WHERE _fivetran_deleted = false',
    },
    {
      name: 'Jobs',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.job WHERE _fivetran_deleted = false',
    },
    {
      name: 'Dimensions',
      query: 'SELECT COUNT(*) as cnt FROM bc_aquaculture.dimension WHERE _fivetran_deleted = false',
    },
    {
      name: 'Sales Invoices',
      query:
        'SELECT COUNT(*) as cnt FROM bc_aquaculture.sales_invoice_header WHERE _fivetran_deleted = false',
    },
    {
      name: 'Purchase Invoices',
      query:
        'SELECT COUNT(*) as cnt FROM bc_aquaculture.purch_inv_header WHERE _fivetran_deleted = false',
    },
  ]

  for (const q of countQueries) {
    try {
      const result = await query(q.query)
      console.log(`  ${q.name}: ${result[0]?.cnt || 0}`)
    } catch (e: any) {
      console.log(`  ${q.name}: Error - ${e.message}`)
    }
  }
}

main().catch((e) => console.error('Error:', e))
