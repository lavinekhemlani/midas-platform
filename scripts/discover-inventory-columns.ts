// scripts/discover-inventory-columns.ts
// Discovers what inventory-related columns and tables actually exist in Redshift
// Run with: npx tsx scripts/discover-inventory-columns.ts [schema_name]

import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  StatusString,
} from '@aws-sdk/client-redshift-data'
import * as fs from 'fs'
import * as path from 'path'

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const REGION = process.env.AWS_REGION || 'us-east-1'
const WORKGROUP = process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics'
const DATABASE = process.env.REDSHIFT_DATABASE || 'dev'
const SCHEMA = process.argv[2] || 'bc_aquaculture'

const client = new RedshiftDataClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

interface Row {
  [key: string]: string | number | boolean | null
}

async function query(sql: string): Promise<Row[]> {
  const resp = await client.send(
    new ExecuteStatementCommand({ WorkgroupName: WORKGROUP, Database: DATABASE, Sql: sql })
  )
  const id = resp.Id!
  for (let i = 0; i < 60; i++) {
    const desc = await client.send(new DescribeStatementCommand({ Id: id }))
    if (desc.Status === StatusString.FINISHED) break
    if (desc.Status === StatusString.FAILED) throw new Error(`Query failed: ${desc.Error}`)
    if (desc.Status === StatusString.ABORTED) throw new Error('Query aborted')
    await new Promise((r) => setTimeout(r, 1000))
  }
  const result = await client.send(new GetStatementResultCommand({ Id: id }))
  const columns = result.ColumnMetadata?.map((c: any) => c.name) || []
  return (result.Records || []).map((record) => {
    const row: Row = {}
    record.forEach((field: any, i: number) => {
      if (field.stringValue !== undefined) row[columns[i]] = field.stringValue
      else if (field.longValue !== undefined) row[columns[i]] = field.longValue
      else if (field.doubleValue !== undefined) row[columns[i]] = field.doubleValue
      else if (field.booleanValue !== undefined) row[columns[i]] = field.booleanValue
      else row[columns[i]] = null
    })
    return row
  })
}

// Fields we're looking for
const WANTED_ITEM_FIELDS = [
  'reorder_point',
  'reorder_quantity',
  'safety_stock_quantity',
  'safety_lead_time',
  'maximum_inventory',
  'minimum_order_quantity',
  'maximum_order_quantity',
  'lead_time_calculation',
  'vendor_no',
  'vendor_item_no',
  'shelf_no',
  'item_tracking_code',
  'lot_nos',
  'serial_nos',
  'expiration_calculation',
  'item_category_code',
  'costing_method',
  'unit_price',
  'standard_cost',
  'last_direct_cost',
  'inventory',
  'unit_cost',
  'base_unit_of_measure',
]

const WANTED_ILE_FIELDS = [
  'expiration_date',
  'lot_no',
  'serial_no',
  'remaining_quantity',
  'warranty_date',
  'item_tracking',
  'entry_type',
  'quantity',
  'cost_amount_actual',
  'posting_date',
  'document_no',
  'source_type',
  'location_code',
  'open',
]

const INVENTORY_TABLES = [
  'item',
  'item_ledger_entry',
  'item_vendor',
  'item_category',
  'item_variant',
  'item_budget_entry',
  'item_cross_reference',
  'item_tracking_code',
  'lot_no_information',
  'serial_no_information',
  'reservation_entry',
  'planning_component',
  'requisition_line',
  'warehouse_entry',
  'warehouse_receipt_line',
  'location',
  'inventory_posting_group',
  'unit_of_measure',
  'value_entry',
  'stockkeeping_unit',
  'transfer_header',
  'transfer_line',
  'production_order',
  'prod_order_line',
  'assembly_header',
  'assembly_line',
]

async function main() {
  console.log('=== Inventory Column Discovery ===')
  console.log(`Schema: ${SCHEMA}`)
  console.log(`Database: ${DATABASE}`)
  console.log(`Workgroup: ${WORKGROUP}`)
  console.log('')

  // 1. Check which inventory tables exist
  console.log('━━━ 1. INVENTORY TABLES IN REDSHIFT ━━━\n')
  const allTables = await query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = '${SCHEMA}' ORDER BY table_name
  `)
  const tableNames = allTables.map((r) => String(r.table_name))

  const found: string[] = []
  const missing: string[] = []
  for (const t of INVENTORY_TABLES) {
    if (tableNames.includes(t)) {
      found.push(t)
      console.log(`  ✓ ${t}`)
    } else {
      missing.push(t)
      console.log(`  ✗ ${t}  (NOT SYNCED)`)
    }
  }
  console.log(`\n  Found: ${found.length}/${INVENTORY_TABLES.length} tables`)
  console.log('')

  // 2. Full column listing for `item` table
  console.log('━━━ 2. ALL COLUMNS ON `item` TABLE ━━━\n')
  const itemCols = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '${SCHEMA}' AND table_name = 'item'
    ORDER BY ordinal_position
  `)
  const itemColNames = itemCols.map((r) => String(r.column_name))

  for (const col of itemCols) {
    const name = String(col.column_name)
    const wanted = WANTED_ITEM_FIELDS.includes(name)
    const marker = wanted ? ' ◄ NEEDED' : ''
    console.log(`  ${name.padEnd(40)} ${String(col.data_type).padEnd(20)}${marker}`)
  }
  console.log(`\n  Total columns: ${itemCols.length}`)

  // Check which wanted fields exist vs missing
  console.log('\n  Wanted fields status:')
  for (const field of WANTED_ITEM_FIELDS) {
    const exists = itemColNames.includes(field)
    console.log(`    ${exists ? '✓' : '✗'} ${field}${exists ? '' : '  (MISSING)'}`)
  }

  // 3. Full column listing for `item_ledger_entry` table
  console.log('\n━━━ 3. ALL COLUMNS ON `item_ledger_entry` TABLE ━━━\n')
  const ileCols = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '${SCHEMA}' AND table_name = 'item_ledger_entry'
    ORDER BY ordinal_position
  `)
  const ileColNames = ileCols.map((r) => String(r.column_name))

  for (const col of ileCols) {
    const name = String(col.column_name)
    const wanted = WANTED_ILE_FIELDS.includes(name)
    const marker = wanted ? ' ◄ NEEDED' : ''
    console.log(`  ${name.padEnd(40)} ${String(col.data_type).padEnd(20)}${marker}`)
  }
  console.log(`\n  Total columns: ${ileCols.length}`)

  console.log('\n  Wanted fields status:')
  for (const field of WANTED_ILE_FIELDS) {
    const exists = ileColNames.includes(field)
    console.log(`    ${exists ? '✓' : '✗'} ${field}${exists ? '' : '  (MISSING)'}`)
  }

  // 4. Check item_vendor table if it exists
  if (tableNames.includes('item_vendor')) {
    console.log('\n━━━ 4. ALL COLUMNS ON `item_vendor` TABLE ━━━\n')
    const ivCols = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = '${SCHEMA}' AND table_name = 'item_vendor'
      ORDER BY ordinal_position
    `)
    for (const col of ivCols) {
      console.log(`  ${String(col.column_name).padEnd(40)} ${String(col.data_type)}`)
    }
    console.log(`\n  Total columns: ${ivCols.length}`)
  }

  // 5. Sample data check — do key fields have actual data?
  console.log('\n━━━ 5. DATA PRESENCE CHECK ━━━\n')

  // Check item fields
  const itemFieldChecks = [
    'reorder_point',
    'vendor_no',
    'safety_stock_quantity',
    'maximum_inventory',
    'lead_time_calculation',
    'unit_price',
    'standard_cost',
  ].filter((f) => itemColNames.includes(f))

  if (itemFieldChecks.length > 0) {
    const selectParts = itemFieldChecks
      .map(
        (f) =>
          `COUNT(CASE WHEN ${f} IS NOT NULL AND CAST(${f} AS VARCHAR) != '' AND CAST(${f} AS VARCHAR) != '0' THEN 1 END) AS ${f}_populated`
      )
      .join(',\n      ')

    const dataCheck = await query(`
      SELECT COUNT(*) AS total_items, ${selectParts}
      FROM ${SCHEMA}.item
      WHERE COALESCE(_fivetran_deleted, false) = false
    `)

    if (dataCheck.length > 0) {
      const total = Number(dataCheck[0].total_items)
      console.log(`  item table: ${total} total items\n`)
      for (const field of itemFieldChecks) {
        const populated = Number(dataCheck[0][`${field}_populated`] || 0)
        const pct = total > 0 ? ((populated / total) * 100).toFixed(1) : '0'
        const status = populated > 0 ? '✓ HAS DATA' : '✗ EMPTY'
        console.log(
          `    ${field.padEnd(30)} ${String(populated).padStart(6)} / ${total} items (${pct}%)  ${status}`
        )
      }
    }
  }

  // Check ILE fields
  const ileFieldChecks = [
    'expiration_date',
    'lot_no',
    'serial_no',
    'remaining_quantity',
    'location_code',
  ].filter((f) => ileColNames.includes(f))

  if (ileFieldChecks.length > 0) {
    const selectParts = ileFieldChecks
      .map(
        (f) =>
          `COUNT(CASE WHEN ${f} IS NOT NULL AND CAST(${f} AS VARCHAR) != '' THEN 1 END) AS ${f}_populated`
      )
      .join(',\n      ')

    const dataCheck = await query(`
      SELECT COUNT(*) AS total_entries, ${selectParts}
      FROM ${SCHEMA}.item_ledger_entry
      WHERE COALESCE(_fivetran_deleted, false) = false
    `)

    if (dataCheck.length > 0) {
      const total = Number(dataCheck[0].total_entries)
      console.log(`\n  item_ledger_entry table: ${total} total entries\n`)
      for (const field of ileFieldChecks) {
        const populated = Number(dataCheck[0][`${field}_populated`] || 0)
        const pct = total > 0 ? ((populated / total) * 100).toFixed(1) : '0'
        const status = populated > 0 ? '✓ HAS DATA' : '✗ EMPTY'
        console.log(
          `    ${field.padEnd(30)} ${String(populated).padStart(6)} / ${total} entries (${pct}%)  ${status}`
        )
      }
    }
  }

  // 6. Summary
  console.log('\n━━━ 6. SUMMARY — WHAT YOU CAN BUILD TODAY ━━━\n')

  const canBuild: string[] = []
  const needsSync: string[] = []
  const needsApi: string[] = []

  // Stock levels
  if (itemColNames.includes('reorder_point'))
    canBuild.push('Stock level alerts (reorder point exists)')
  else needsSync.push('Stock level alerts → need reorder_point on item table')

  // Vendor-item
  if (tableNames.includes('item_vendor'))
    canBuild.push('Vendor-item mapping (item_vendor table exists)')
  else if (itemColNames.includes('vendor_no'))
    canBuild.push('Vendor-item mapping (vendor_no on item table)')
  else canBuild.push('Vendor-item mapping (derive from purch_inv_line — already possible)')

  // Expiry
  if (ileColNames.includes('expiration_date'))
    canBuild.push('Expired products (expiration_date exists on ILE)')
  else needsSync.push('Expired products → need expiration_date on item_ledger_entry')

  // Lot tracking
  if (ileColNames.includes('lot_no')) canBuild.push('Lot tracking (lot_no exists on ILE)')
  else needsSync.push('Lot tracking → need lot_no on item_ledger_entry')

  // Demand/ROI — always available
  canBuild.push('ROI on product (sales_invoice_line + purch_inv_line — already available)')
  canBuild.push('Demand trends (sales_invoice_line with posting_date — already available)')

  // Safety stock
  if (itemColNames.includes('safety_stock_quantity'))
    canBuild.push('Safety stock alerts (safety_stock_quantity exists)')
  else needsSync.push('Safety stock alerts → need safety_stock_quantity on item table')

  // Lead time
  if (itemColNames.includes('lead_time_calculation'))
    canBuild.push('Lead time analysis (lead_time_calculation exists)')
  else needsSync.push('Lead time analysis → need lead_time_calculation on item table')

  console.log('  CAN BUILD NOW (data exists in Redshift):')
  for (const item of canBuild) console.log(`    ✓ ${item}`)

  if (needsSync.length > 0) {
    console.log('\n  NEEDS FIVETRAN SYNC (column/table missing):')
    for (const item of needsSync) console.log(`    ⚠ ${item}`)
  }

  if (needsApi.length > 0) {
    console.log('\n  NEEDS BC API (not available via Fivetran):')
    for (const item of needsApi) console.log(`    ✗ ${item}`)
  }

  console.log('\n=== Discovery Complete ===')
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
