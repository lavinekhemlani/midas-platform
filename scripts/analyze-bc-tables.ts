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
  const exec = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics',
      Database: process.env.REDSHIFT_DATABASE || 'dev',
      Sql: sql,
    })
  )

  // Wait for completion
  let status = 'SUBMITTED'
  while (status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') {
    await new Promise((r) => setTimeout(r, 500))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec.Id }))
    status = desc.Status || 'FAILED'
    if (status === 'FAILED') throw new Error(desc.Error)
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
  console.log('\n📊 Analyzing BC Aquaculture Tables\n')
  console.log('═'.repeat(70))

  // Key tables to analyze
  const tables = [
    // Core GL
    { name: 'g_l_entry', desc: 'General Ledger - ALL transactions' },
    { name: 'g_l_account', desc: 'Chart of Accounts' },

    // Customer/AR
    { name: 'customer', desc: 'Customer master' },
    { name: 'cust_ledger_entry', desc: 'Customer ledger (invoices/payments)' },
    { name: 'detailed_cust_ledg_entry', desc: 'Detailed customer entries' },

    // Vendor/AP
    { name: 'vendor', desc: 'Vendor master' },
    { name: 'vendor_ledger_entry', desc: 'Vendor ledger (bills/payments)' },
    { name: 'detailed_vendor_ledg_entry', desc: 'Detailed vendor entries' },

    // Sales
    { name: 'sales_invoice_header', desc: 'Posted sales invoices' },
    { name: 'sales_invoice_line', desc: 'Sales invoice line items' },
    { name: 'sales_cr_memo_header', desc: 'Sales credit memos' },
    { name: 'sales_cr_memo_line', desc: 'Credit memo lines' },

    // Purchasing
    { name: 'purch_inv_header', desc: 'Purchase invoices' },
    { name: 'purch_inv_line', desc: 'Purchase invoice lines' },

    // Banking
    { name: 'bank_account', desc: 'Bank accounts' },
    { name: 'bank_account_ledger_entry', desc: 'Bank transactions' },

    // Inventory
    { name: 'item', desc: 'Products/Items' },
    { name: 'item_ledger_entry', desc: 'Inventory movements' },
    { name: 'value_entry', desc: 'Inventory value entries' },

    // Reference
    { name: 'company_information', desc: 'Company settings' },
    { name: 'dimension', desc: 'Analysis dimensions' },
    { name: 'dimension_value', desc: 'Dimension values' },
  ]

  const results: { name: string; desc: string; count: number | string }[] = []

  for (const table of tables) {
    try {
      const result = await query(`SELECT COUNT(*) as cnt FROM bc_aquaculture.${table.name}`)
      const count = result[0]?.cnt || 0
      results.push({ name: table.name, desc: table.desc, count: Number(count) })
    } catch (e: any) {
      results.push({ name: table.name, desc: table.desc, count: 'N/A' })
    }
  }

  // Sort by count descending
  results.sort((a, b) => {
    if (typeof a.count === 'string') return 1
    if (typeof b.count === 'string') return -1
    return b.count - a.count
  })

  console.log('\nTable'.padEnd(35) + 'Rows'.padStart(15) + '  Description')
  console.log('─'.repeat(70))

  for (const r of results) {
    const countStr = typeof r.count === 'number' ? r.count.toLocaleString() : r.count
    console.log(`${r.name.padEnd(35)}${countStr.padStart(15)}  ${r.desc}`)
  }

  console.log('\n' + '═'.repeat(70))

  // Summary
  const glCount = results.find((r) => r.name === 'g_l_entry')?.count
  const custLedgerCount = results.find((r) => r.name === 'cust_ledger_entry')?.count
  const vendLedgerCount = results.find((r) => r.name === 'vendor_ledger_entry')?.count
  const salesCount = results.find((r) => r.name === 'sales_invoice_header')?.count
  const purchCount = results.find((r) => r.name === 'purch_inv_header')?.count

  console.log('\n📋 ANALYSIS SUMMARY\n')
  console.log(`GL Entries: ${typeof glCount === 'number' ? glCount.toLocaleString() : glCount}`)
  console.log(
    `Customer Ledger: ${typeof custLedgerCount === 'number' ? custLedgerCount.toLocaleString() : custLedgerCount}`
  )
  console.log(
    `Vendor Ledger: ${typeof vendLedgerCount === 'number' ? vendLedgerCount.toLocaleString() : vendLedgerCount}`
  )
  console.log(
    `Sales Invoices: ${typeof salesCount === 'number' ? salesCount.toLocaleString() : salesCount}`
  )
  console.log(
    `Purchase Invoices: ${typeof purchCount === 'number' ? purchCount.toLocaleString() : purchCount}`
  )
}

main().catch((e) => console.error('Error:', e))
