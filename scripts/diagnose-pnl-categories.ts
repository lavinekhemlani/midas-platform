/**
 * Diagnostic script to investigate why COGS accounts are missing from the P&L report.
 *
 * Run: npx tsx scripts/diagnose-pnl-categories.ts
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
  console.log(`\n${'='.repeat(80)}`)
  console.log(`QUERY: ${label}`)
  console.log(`${'='.repeat(80)}`)

  const executeResponse = await client.send(
    new ExecuteStatementCommand({
      WorkgroupName: WORKGROUP,
      Database: DATABASE,
      Sql: sql,
    })
  )

  const statementId = executeResponse.Id!

  // Wait for completion
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

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return 'NULL'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function main() {
  console.log(`\nDiagnosing P&L data in schema: ${SCHEMA}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  // ============================================================
  // 1. ALL distinct account_category values
  // ============================================================
  const categories = await runQuery(
    `SELECT DISTINCT account_category, COUNT(*) as cnt
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
     GROUP BY account_category
     ORDER BY account_category`,
    '1. ALL distinct account_category values in g_l_account'
  )
  console.log('\nAll account categories:')
  for (const row of categories) {
    console.log(`  "${row.account_category}" => ${row.cnt} accounts`)
  }

  // ============================================================
  // 2. ALL distinct account_category + account_type combos for P&L accounts
  // ============================================================
  const catTypeCombos = await runQuery(
    `SELECT account_category, account_type, COUNT(*) as cnt
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
       AND account_category IN ('Income', 'Expense', 'Cost of Goods Sold',
                                 'income', 'expense', 'cost of goods sold',
                                 'COGS', 'cogs', 'CostOfGoodsSold')
     GROUP BY account_category, account_type
     ORDER BY account_category, account_type`,
    '2. account_category + account_type combos for P&L-related categories'
  )
  console.log('\nP&L category + type combos:')
  for (const row of catTypeCombos) {
    console.log(`  category="${row.account_category}", type="${row.account_type}" => ${row.cnt} accounts`)
  }

  // ============================================================
  // 3. Search for COGS-like accounts by name or category
  // ============================================================
  const cogsSearch = await runQuery(
    `SELECT no, name, account_type, account_category, account_subcategory_descript, debit_credit
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
       AND (
         LOWER(account_category) LIKE '%cost%'
         OR LOWER(name) LIKE '%cost of goods%'
         OR LOWER(name) LIKE '%cogs%'
         OR LOWER(name) LIKE '%cost of sales%'
         OR LOWER(account_subcategory_descript) LIKE '%cost of goods%'
       )
     ORDER BY no
     LIMIT 50`,
    '3. Accounts matching COGS-related keywords'
  )
  console.log(`\nCOGS-related accounts found: ${cogsSearch.length}`)
  for (const row of cogsSearch) {
    console.log(`  ${row.no} | ${row.name} | type=${row.account_type} | cat=${row.account_category} | subcat=${row.account_subcategory_descript} | dc=${row.debit_credit}`)
  }

  // ============================================================
  // 4. All subcategory descriptions for P&L categories
  // ============================================================
  const subcats = await runQuery(
    `SELECT account_category, account_subcategory_descript, COUNT(*) as cnt
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
       AND account_type = 'Posting'
     GROUP BY account_category, account_subcategory_descript
     ORDER BY account_category, account_subcategory_descript`,
    '4. All category + subcategory combinations (Posting accounts only)'
  )
  console.log(`\nAll category/subcategory combos for Posting accounts:`)
  let currentCat = ''
  for (const row of subcats) {
    if (row.account_category !== currentCat) {
      currentCat = row.account_category
      console.log(`\n  [${currentCat}]`)
    }
    console.log(`    "${row.account_subcategory_descript}" => ${row.cnt} accounts`)
  }

  // ============================================================
  // 5. COGS totals - if category exists, show the actual amounts
  // ============================================================
  const cogsTotals = await runQuery(
    `SELECT
       a.account_category,
       a.account_subcategory_descript,
       COUNT(DISTINCT a.no) as account_count,
       SUM(e.debit_amount) as total_debits,
       SUM(e.credit_amount) as total_credits,
       SUM(e.amount) as net_amount
     FROM ${SCHEMA}.g_l_account a
     JOIN ${SCHEMA}.g_l_entry e
       ON a.no = e.g_laccount_no AND a.company_id = e.company_id
     WHERE a._fivetran_deleted = false
       AND e._fivetran_deleted = false
       AND e.reversed = false
       AND a.account_type = 'Posting'
       AND (
         LOWER(a.account_category) LIKE '%cost%'
         OR a.account_category = 'Cost of Goods Sold'
       )
     GROUP BY a.account_category, a.account_subcategory_descript
     ORDER BY a.account_category, a.account_subcategory_descript`,
    '5. COGS account totals (if any exist)'
  )
  console.log(`\nCOGS category totals:`)
  if (cogsTotals.length === 0) {
    console.log('  *** NO COGS ACCOUNTS FOUND WITH ENTRIES ***')
  }
  for (const row of cogsTotals) {
    console.log(`  cat="${row.account_category}" subcat="${row.account_subcategory_descript}" => ${row.account_count} accounts, debits=${formatNumber(row.total_debits)}, credits=${formatNumber(row.total_credits)}, net=${formatNumber(row.net_amount)}`)
  }

  // ============================================================
  // 6. Full P&L summary by category (what our query actually returns)
  // ============================================================
  const pnlSummary = await runQuery(
    `SELECT
       a.account_category,
       COUNT(DISTINCT a.no) as account_count,
       COALESCE(SUM(e.debit_amount), 0) as total_debits,
       COALESCE(SUM(e.credit_amount), 0) as total_credits,
       COALESCE(SUM(e.amount), 0) as net_amount
     FROM ${SCHEMA}.g_l_account a
     LEFT JOIN ${SCHEMA}.g_l_entry e
       ON a.no = e.g_laccount_no AND a.company_id = e.company_id
       AND e._fivetran_deleted = false AND e.reversed = false
     WHERE a._fivetran_deleted = false
       AND a.account_type = 'Posting'
       AND a.account_category IN ('Income', 'Expense', 'Cost of Goods Sold')
     GROUP BY a.account_category
     ORDER BY a.account_category`,
    '6. P&L summary by category (exact filter our hook uses)'
  )
  console.log('\nP&L summary (matches our hook query filter):')
  for (const row of pnlSummary) {
    const debits = Number(row.total_debits)
    const credits = Number(row.total_credits)
    const isIncome = row.account_category === 'Income'
    const displayAmount = isIncome ? credits - debits : debits - credits
    console.log(`  ${row.account_category}: ${row.account_count} accounts | debits=${formatNumber(debits)} | credits=${formatNumber(credits)} | display=${formatNumber(displayAmount)}`)
  }

  // ============================================================
  // 7. Check for non-Posting COGS accounts we might be filtering out
  // ============================================================
  const nonPostingCogs = await runQuery(
    `SELECT account_type, COUNT(*) as cnt
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
       AND (
         LOWER(account_category) LIKE '%cost%'
         OR LOWER(name) LIKE '%cost of goods%'
         OR LOWER(name) LIKE '%cost of sales%'
       )
     GROUP BY account_type
     ORDER BY account_type`,
    '7. COGS-related accounts by account_type (are we filtering them out?)'
  )
  console.log('\nCOGS-related accounts by account_type:')
  for (const row of nonPostingCogs) {
    console.log(`  type="${row.account_type}" => ${row.cnt} accounts`)
  }

  // ============================================================
  // 8. Top 20 accounts by absolute GL entry amount (to find the $202B COGS)
  // ============================================================
  const topAccounts = await runQuery(
    `SELECT
       a.no,
       a.name,
       a.account_category,
       a.account_subcategory_descript,
       a.account_type,
       COALESCE(SUM(e.debit_amount), 0) as total_debits,
       COALESCE(SUM(e.credit_amount), 0) as total_credits,
       COALESCE(SUM(e.amount), 0) as net_amount
     FROM ${SCHEMA}.g_l_account a
     LEFT JOIN ${SCHEMA}.g_l_entry e
       ON a.no = e.g_laccount_no AND a.company_id = e.company_id
       AND e._fivetran_deleted = false AND e.reversed = false
     WHERE a._fivetran_deleted = false
       AND a.account_type = 'Posting'
     GROUP BY a.no, a.name, a.account_category, a.account_subcategory_descript, a.account_type
     HAVING ABS(COALESCE(SUM(e.amount), 0)) > 1000000000
     ORDER BY ABS(COALESCE(SUM(e.amount), 0)) DESC
     LIMIT 20`,
    '8. Top 20 accounts by absolute amount (>$1B) - where is the $202B?'
  )
  console.log('\nTop accounts by absolute amount:')
  for (const row of topAccounts) {
    console.log(`  ${row.no} | ${row.name} | cat=${row.account_category} | subcat=${row.account_subcategory_descript} | debits=${formatNumber(Number(row.total_debits))} | credits=${formatNumber(Number(row.total_credits))} | net=${formatNumber(Number(row.net_amount))}`)
  }

  // ============================================================
  // 9. Check the exact account_category column data type
  // ============================================================
  const colType = await runQuery(
    `SELECT column_name, data_type, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = '${SCHEMA}'
       AND table_name = 'g_l_account'
       AND column_name = 'account_category'`,
    '9. Data type of account_category column'
  )
  console.log('\naccount_category column info:')
  for (const row of colType) {
    console.log(`  type=${row.data_type}, max_length=${row.character_maximum_length}`)
  }

  // ============================================================
  // 10. Raw distinct values with hex/length (check for hidden chars)
  // ============================================================
  const rawValues = await runQuery(
    `SELECT DISTINCT
       account_category,
       LENGTH(account_category) as len,
       LENGTH(TRIM(account_category)) as trimmed_len
     FROM ${SCHEMA}.g_l_account
     WHERE _fivetran_deleted = false
     ORDER BY account_category`,
    '10. account_category values with length check (hidden chars?)'
  )
  console.log('\naccount_category values with length:')
  for (const row of rawValues) {
    const hasPadding = row.len !== row.trimmed_len
    console.log(`  "${row.account_category}" len=${row.len} trimmed=${row.trimmed_len}${hasPadding ? ' *** HAS PADDING ***' : ''}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('DIAGNOSIS COMPLETE')
  console.log('='.repeat(80))
}

main().catch(console.error)
