/**
 * QuickBooks Query API Route
 * Fetch entities from QuickBooks for testing/development
 * Uses the existing QuickBooksClient from src/lib/providers/quickbooks
 */

import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'

// Supported entity types for querying
const SUPPORTED_ENTITY_TYPES = [
  // Financial transactions
  'Invoice',
  'Bill',
  'Payment',
  'BillPayment',
  'Deposit',
  'Transfer',
  'JournalEntry',
  // Purchase transactions
  'Purchase',
  'PurchaseOrder',
  'VendorCredit',
  // Sales transactions
  'Estimate',
  'SalesReceipt',
  'CreditMemo',
  'RefundReceipt',
  // Reference entities
  'Customer',
  'Vendor',
  'Employee',
  'Account',
  'Item',
  'Class',
  'Department',
  // Configuration entities
  'Term',
  'PaymentMethod',
  'TaxCode',
  'TaxRate',
  'TaxAgency',
  // System entities
  'CompanyInfo',
  'Preferences',
  // Other entities
  'TimeActivity',
  'Budget',
  'Attachable',
  'ExchangeRate',
]

/**
 * GET handler to query entities
 * Query params: organizationId, entityType, entityId?, limit?, where?
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams
  const organizationId = searchParams.get('organizationId')
  const realmId = searchParams.get('realmId') || undefined
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')

  if (!organizationId) {
    return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 })
  }

  if (!entityType) {
    return NextResponse.json({ error: 'Missing entityType parameter' }, { status: 400 })
  }

  // Validate entity type
  if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json(
      {
        error: `Unsupported entity type: ${entityType}`,
        supportedTypes: SUPPORTED_ENTITY_TYPES,
      },
      { status: 400 }
    )
  }

  try {
    const client = new QuickBooksClient({ organizationId, realmId })

    // If entityId provided, fetch single entity
    if (entityId) {
      const entity = await client.request(`/${entityType.toLowerCase()}/${entityId}`)
      return NextResponse.json({
        success: true,
        entityType,
        entityId,
        data: entity,
      })
    }

    // Otherwise, query with optional filters
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)
    const where = searchParams.get('where') ?? ''

    // Build query
    let query = `SELECT * FROM ${entityType}`
    if (where) {
      query += ` WHERE ${where}`
    }
    if (offset > 0) {
      query += ` STARTPOSITION ${offset + 1}` // QuickBooks uses 1-based
    }
    query += ` MAXRESULTS ${limit}`

    const result = await client.query<{ QueryResponse: Record<string, unknown[]> }>(query)
    const entities = result.QueryResponse?.[entityType] ?? []

    return NextResponse.json({
      success: true,
      entityType,
      count: Array.isArray(entities) ? entities.length : 0,
      limit,
      offset,
      data: entities,
    })
  } catch (error) {
    console.error('[QuickBooks Query] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check for auth errors
    if (errorMessage.includes('not connected') || errorMessage.includes('authentication')) {
      return NextResponse.json(
        { error: 'QuickBooks not connected', message: errorMessage },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'Query failed', message: errorMessage }, { status: 500 })
  }
}

/**
 * POST handler for raw queries
 * Body: { organizationId, query }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { organizationId, query } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    const client = new QuickBooksClient({ organizationId, realmId })
    const result = await client.query(query)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[QuickBooks Query POST] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('not connected') || errorMessage.includes('authentication')) {
      return NextResponse.json(
        { error: 'QuickBooks not connected', message: errorMessage },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'Query failed', message: errorMessage }, { status: 500 })
  }
}

/**
 * Query route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
