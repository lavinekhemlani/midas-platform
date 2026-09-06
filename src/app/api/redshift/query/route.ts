import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getTableSchema, listTables } from '@/lib/redshift/client'
import { getCurrentUser } from '@/lib/auth-utils'
import {
  getWarehouseAccessForUser,
  validateSchemaAccess,
  validateTableAccess,
  validateQuerySchemas,
} from '@/lib/redshift/warehouse-access'

// ANSI color codes for terminal output
const BC = '\x1b[34m' // Blue for Business Central / Warehouse
const RST = '\x1b[0m' // Reset
const DIM = '\x1b[2m' // Dim

// Forbidden SQL keywords to prevent destructive operations
const FORBIDDEN_KEYWORDS = [
  'drop',
  'delete',
  'insert',
  'update',
  'truncate',
  'alter',
  'create',
  'grant',
  'revoke',
  'exec',
  'execute',
  'copy',
  'unload',
  'call',
]

function validateQuerySyntax(query: string): { valid: boolean; error?: string } {
  const normalizedQuery = query.toLowerCase().trim()

  // Must start with SELECT or WITH (CTEs that end with SELECT)
  if (!normalizedQuery.startsWith('select') && !normalizedQuery.startsWith('with')) {
    return { valid: false, error: 'Only SELECT queries are allowed' }
  }

  // If it starts with WITH, ensure it contains a SELECT
  if (normalizedQuery.startsWith('with') && !normalizedQuery.includes('select')) {
    return { valid: false, error: 'WITH clause must contain a SELECT statement' }
  }

  // Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Use word boundary check to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(normalizedQuery)) {
      return { valid: false, error: `Forbidden keyword detected: ${keyword.toUpperCase()}` }
    }
  }

  return { valid: true }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const reqStart = Date.now()
  try {
    // Verify user is authenticated
    const user = await getCurrentUser()
    if (!user) {
      console.warn(`${BC}[BC/Warehouse]${RST} Auth failed — no valid session`)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's warehouse access
    const warehouseAccess = await getWarehouseAccessForUser(user.userId)

    if (!warehouseAccess.hasAccess || !warehouseAccess.config) {
      console.warn(
        `${BC}[BC/Warehouse]${RST} Access denied for ${user.email}: ${warehouseAccess.error}`
      )
      return NextResponse.json(
        {
          success: false,
          error: warehouseAccess.error || 'Warehouse access not configured',
          organizationId: warehouseAccess.organizationId,
        },
        { status: 403 }
      )
    }

    const { config, organizationId, organizationName } = warehouseAccess

    const body = await request.json()
    const { query, table, schema, limit = 100, offset = 0, action } = body

    // Use requested schema or default to org's default schema
    const targetSchema = schema || config.default_schema || config.schemas[0]?.schema_name

    if (!targetSchema) {
      console.warn(`${BC}[BC/Warehouse]${RST} No target schema available`)
      return NextResponse.json(
        { success: false, error: 'No schema specified and no default configured' },
        { status: 400 }
      )
    }

    // Handle different actions
    if (action === 'list_tables') {
      const schemaValidation = validateSchemaAccess(config, targetSchema)
      if (!schemaValidation.valid) {
        return NextResponse.json({ success: false, error: schemaValidation.error }, { status: 403 })
      }

      const tables = await listTables(targetSchema)
      console.log(
        `${BC}[BC/Warehouse]${RST} list_tables ${DIM}schema=${targetSchema} → ${tables.length} tables (${Date.now() - reqStart}ms)${RST}`
      )
      return NextResponse.json({ success: true, tables, schema: targetSchema })
    }

    if (action === 'get_schema') {
      if (!table) {
        return NextResponse.json({ success: false, error: 'Table name required' }, { status: 400 })
      }

      const tableValidation = validateTableAccess(config, targetSchema, table)
      if (!tableValidation.valid) {
        return NextResponse.json({ success: false, error: tableValidation.error }, { status: 403 })
      }

      const columns = await getTableSchema(targetSchema, table)
      console.log(
        `${BC}[BC/Warehouse]${RST} get_schema ${DIM}${targetSchema}.${table} → ${columns.length} columns (${Date.now() - reqStart}ms)${RST}`
      )
      return NextResponse.json({ success: true, columns })
    }

    if (action === 'get_warehouse_config') {
      // Validate default_schema is actually in the schemas list (may be stale after disconnect)
      const schemaNames = config.schemas.map((s) => s.schema_name)
      const validDefaultSchema =
        config.default_schema && schemaNames.includes(config.default_schema)
          ? config.default_schema
          : schemaNames[0] || null

      console.log(
        `${BC}[BC/Warehouse]${RST} config ${DIM}org="${organizationName}" schemas=[${schemaNames.join(',')}] default=${validDefaultSchema} (${Date.now() - reqStart}ms)${RST}`
      )
      return NextResponse.json({
        success: true,
        organizationId,
        organizationName,
        config: {
          enabled: config.enabled && config.schemas.length > 0,
          schemas: config.schemas.map((s) => ({
            schema_name: s.schema_name,
            source_type: s.source_type,
            display_name: s.display_name,
            connected_at: s.connected_at,
            last_synced: s.last_synced,
            tables: s.tables,
          })),
          default_schema: validDefaultSchema,
        },
      })
    }

    // Handle custom query
    if (query) {
      const syntaxValidation = validateQuerySyntax(query)
      if (!syntaxValidation.valid) {
        console.warn(`${BC}[BC/Warehouse]${RST} Query rejected: ${syntaxValidation.error}`)
        return NextResponse.json({ success: false, error: syntaxValidation.error }, { status: 400 })
      }

      const schemaValidation = validateQuerySchemas(config, query)
      if (!schemaValidation.valid) {
        console.warn(`${BC}[BC/Warehouse]${RST} Schema access denied: ${schemaValidation.error}`)
        return NextResponse.json({ success: false, error: schemaValidation.error }, { status: 403 })
      }

      let finalQuery = query.trim()
      if (!/\blimit\b/i.test(finalQuery)) {
        finalQuery = `${finalQuery} LIMIT 1000`
      }

      const result = await executeQuery(finalQuery)
      console.log(
        `${BC}[BC/Warehouse]${RST} query ${DIM}→ ${result.data?.length ?? 0} rows, ${result.columns?.length ?? 0} cols (${Date.now() - reqStart}ms)${RST}`
      )
      return NextResponse.json(result)
    }

    // Handle table query
    if (table) {
      const tableValidation = validateTableAccess(config, targetSchema, table)
      if (!tableValidation.valid) {
        return NextResponse.json({ success: false, error: tableValidation.error }, { status: 403 })
      }

      const safeLimit = Math.min(Math.max(1, limit), 1000)
      const safeOffset = Math.max(0, offset)

      const sql = `SELECT * FROM ${targetSchema}.${table} LIMIT ${safeLimit} OFFSET ${safeOffset}`
      const result = await executeQuery(sql)

      const countResult = await executeQuery<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${targetSchema}.${table}`
      )
      const totalCount = countResult.data[0]?.count ?? 0
      console.log(
        `${BC}[BC/Warehouse]${RST} table ${DIM}${targetSchema}.${table} → ${result.data?.length ?? 0}/${totalCount} rows (${Date.now() - reqStart}ms)${RST}`
      )

      return NextResponse.json({
        ...result,
        totalCount,
        limit: safeLimit,
        offset: safeOffset,
        schema: targetSchema,
      })
    }

    console.warn(`${BC}[BC/Warehouse]${RST} No action matched`)
    return NextResponse.json(
      { success: false, error: 'Either query or table parameter is required' },
      { status: 400 }
    )
  } catch (error) {
    console.error(`${BC}[BC/Warehouse]${RST} Error (${Date.now() - reqStart}ms):`, error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
