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

  let status = 'SUBMITTED'
  while (status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') {
    await new Promise((r) => setTimeout(r, 1000))
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
  console.log('\n📋 Listing all schemas in Redshift\n')

  const schemas = await query(`
    SELECT schema_name, schema_owner
    FROM information_schema.schemata
    ORDER BY schema_name
  `)

  console.log('Schemas found:')
  console.log('─'.repeat(50))
  for (const s of schemas) {
    console.log(`  ${s.schema_name} (owner: ${s.schema_owner})`)
  }

  // For each non-system schema, count tables
  console.log('\n\nTable counts per schema:')
  console.log('─'.repeat(50))

  for (const s of schemas) {
    if (!['information_schema', 'pg_catalog', 'pg_internal'].includes(s.schema_name)) {
      const tables = await query(`
        SELECT COUNT(*) as cnt
        FROM information_schema.tables
        WHERE table_schema = '${s.schema_name}'
      `)
      console.log(`  ${s.schema_name}: ${tables[0]?.cnt || 0} tables`)
    }
  }
}

main().catch((e) => console.error('Error:', e))
