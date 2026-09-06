import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  RedshiftDataClient,
  ExecuteStatementCommand,
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

async function execSQL(sql: string): Promise<string> {
  console.log(`Executing: ${sql}`)
  const exec = await client.send(
    new ExecuteStatementCommand({ WorkgroupName: workgroup, Database: database, Sql: sql })
  )
  let status = 'SUBMITTED'
  while (status === 'SUBMITTED' || status === 'PICKED' || status === 'STARTED') {
    await new Promise((r) => setTimeout(r, 1000))
    const desc = await client.send(new DescribeStatementCommand({ Id: exec.Id }))
    status = desc.Status || 'FAILED'
    if (status === 'FAILED') {
      console.log(`  FAILED: ${desc.Error}`)
      return `FAILED: ${desc.Error}`
    }
  }
  console.log(`  ${status}`)
  return status
}

async function main() {
  const schema = process.argv[2] || 'bc_aquaculture'
  const user = '"IAM:zenith-os-dev"'

  console.log(`\nGranting access to schema '${schema}' for ${user}\n`)

  // Grant USAGE on schema
  await execSQL(`GRANT USAGE ON SCHEMA ${schema} TO ${user}`)

  // Grant SELECT on all tables
  await execSQL(`GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${user}`)

  // Also grant for fivetran_metadata if it exists
  console.log('\nAlso granting fivetran_metadata access...')
  await execSQL(`GRANT USAGE ON SCHEMA fivetran_metadata TO ${user}`)
  await execSQL(`GRANT SELECT ON ALL TABLES IN SCHEMA fivetran_metadata TO ${user}`)

  // And fivetran_shopify
  console.log('\nAlso granting fivetran_shopify access...')
  await execSQL(`GRANT USAGE ON SCHEMA fivetran_shopify TO ${user}`)
  await execSQL(`GRANT SELECT ON ALL TABLES IN SCHEMA fivetran_shopify TO ${user}`)

  console.log('\n✅ Done! Now testing access...')
  await execSQL(`SELECT COUNT(*) FROM bc_aquaculture.g_l_entry`)
}

main().catch((e) => console.error('Error:', e))
