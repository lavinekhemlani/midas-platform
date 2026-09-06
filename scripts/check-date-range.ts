/**
 * Quick check: what date range does the BC data actually cover?
 * Run: npx tsx scripts/check-date-range.ts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  StatusString,
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

const client = new RedshiftDataClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const WORKGROUP = process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics'
const DATABASE = process.env.REDSHIFT_DATABASE || 'dev'
const SCHEMA = 'bc_aquaculture'

async function runQuery(sql: string, label: string): Promise<any[]> {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`${label}`)
  console.log(`${'='.repeat(70)}`)

  const executeResponse = await client.send(
    new ExecuteStatementCommand({ WorkgroupName: WORKGROUP, Database: DATABASE, Sql: sql })
  )
  const statementId = executeResponse.Id!

  for (let i = 0; i < 60; i++) {
    const desc = await client.send(new DescribeStatementCommand({ Id: statementId }))
    if (desc.Status === StatusString.FINISHED) break
    if (desc.Status === StatusString.FAILED) {
      console.error(`  FAILED: ${desc.Error}`)
      return []
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  const result = await client.send(new GetStatementResultCommand({ Id: statementId }))
  const columns = result.ColumnMetadata?.map(c => c.name!) || []
  const rows: any[] = []

  for (const record of result.Records || []) {
    const row: any = {}
    record.forEach((field, i) => {
      if (field.stringValue !== undefined) row[columns[i]] = field.stringValue
      else if (field.longValue !== undefined) row[columns[i]] = field.longValue
      else if (field.doubleValue !== undefined) row[columns[i]] = field.doubleValue
      else if (field.booleanValue !== undefined) row[columns[i]] = field.booleanValue
      else row[columns[i]] = null
    })
    rows.push(row)
  }

  return rows
}

async function main() {
  console.log(`\nChecking data date range in schema: ${SCHEMA}`)
  console.log(`Today: ${new Date().toISOString().split('T')[0]}`)
  console.log(`"Last Year" filter would be: 2025-01-01 to 2025-12-31`)

  // 1. Overall date range
  const dateRange = await runQuery(
    `SELECT
       MIN(posting_date) AS earliest,
       MAX(posting_date) AS latest,
       COUNT(*) AS total_entries,
       COUNT(DISTINCT DATE_TRUNC('year', posting_date)) AS distinct_years
     FROM ${SCHEMA}.g_l_entry
     WHERE _fivetran_deleted = false AND reversed = false`,
    '1. Overall GL entry date range'
  )
  for (const row of dateRange) {
    console.log(`  Earliest: ${row.earliest}`)
    console.log(`  Latest:   ${row.latest}`)
    console.log(`  Total entries: ${row.total_entries}`)
    console.log(`  Distinct years: ${row.distinct_years}`)
  }

  // 2. Entries per year
  const perYear = await runQuery(
    `SELECT
       DATE_TRUNC('year', posting_date) AS year,
       COUNT(*) AS entry_count,
       SUM(CASE WHEN a.account_category = 'Income' THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
       SUM(CASE WHEN a.account_category IN ('Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold') THEN e.debit_amount - e.credit_amount ELSE 0 END) AS total_expenses
     FROM ${SCHEMA}.g_l_entry e
     JOIN ${SCHEMA}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
     WHERE e._fivetran_deleted = false AND e.reversed = false
       AND a._fivetran_deleted = false AND a.account_type = 'Posting'
       AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
     GROUP BY DATE_TRUNC('year', posting_date)
     ORDER BY year`,
    '2. P&L entries per year (Revenue & Expenses)'
  )
  console.log('\n  Year            | Entries   | Revenue              | Expenses')
  console.log('  ' + '-'.repeat(75))
  for (const row of perYear) {
    const year = row.year?.substring(0, 4) || 'NULL'
    const rev = Number(row.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })
    const exp = Number(row.total_expenses).toLocaleString('en-US', { minimumFractionDigits: 2 })
    console.log(`  ${year}            | ${String(row.entry_count).padStart(9)} | ${rev.padStart(20)} | ${exp.padStart(20)}`)
  }

  // 3. Specifically check 2025 vs all-time P&L totals
  const comparison = await runQuery(
    `SELECT
       'All Time' AS period,
       SUM(CASE WHEN a.account_category = 'Income' THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
       SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS cogs,
       SUM(CASE WHEN a.account_category = 'Expense' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS expenses
     FROM ${SCHEMA}.g_l_entry e
     JOIN ${SCHEMA}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
     WHERE e._fivetran_deleted = false AND e.reversed = false
       AND a._fivetran_deleted = false AND a.account_type = 'Posting'
       AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
     UNION ALL
     SELECT
       'Last Year (2025)' AS period,
       SUM(CASE WHEN a.account_category = 'Income' THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
       SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS cogs,
       SUM(CASE WHEN a.account_category = 'Expense' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS expenses
     FROM ${SCHEMA}.g_l_entry e
     JOIN ${SCHEMA}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
     WHERE e._fivetran_deleted = false AND e.reversed = false
       AND a._fivetran_deleted = false AND a.account_type = 'Posting'
       AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
       AND e.posting_date >= '2025-01-01' AND e.posting_date <= '2025-12-31'
     UNION ALL
     SELECT
       'Year 2024' AS period,
       SUM(CASE WHEN a.account_category = 'Income' THEN e.credit_amount - e.debit_amount ELSE 0 END) AS revenue,
       SUM(CASE WHEN a.account_category = 'Cost_x0020_of_x0020_Goods_x0020_Sold' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS cogs,
       SUM(CASE WHEN a.account_category = 'Expense' THEN e.debit_amount - e.credit_amount ELSE 0 END) AS expenses
     FROM ${SCHEMA}.g_l_entry e
     JOIN ${SCHEMA}.g_l_account a ON e.g_laccount_no = a.no AND e.company_id = a.company_id
     WHERE e._fivetran_deleted = false AND e.reversed = false
       AND a._fivetran_deleted = false AND a.account_type = 'Posting'
       AND a.account_category IN ('Income', 'Expense', 'Cost_x0020_of_x0020_Goods_x0020_Sold')
       AND e.posting_date >= '2024-01-01' AND e.posting_date <= '2024-12-31'`,
    '3. P&L comparison: All Time vs 2025 vs 2024'
  )
  console.log('\n  Period            | Revenue              | COGS                 | Expenses             | Net Income')
  console.log('  ' + '-'.repeat(105))
  for (const row of comparison) {
    const rev = Number(row.revenue)
    const cogs = Number(row.cogs)
    const exp = Number(row.expenses)
    const net = rev - cogs - exp
    console.log(`  ${(row.period || '').padEnd(18)} | ${rev.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(20)} | ${cogs.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(20)} | ${exp.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(20)} | ${net.toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(20)}`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('DONE')
  console.log('='.repeat(70))
}

main().catch(console.error)
