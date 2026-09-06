/**
 * QuickBooks Export Samples API Route
 * Fetches sample data from all entity types and saves to JSON files
 */

import { NextRequest, NextResponse } from 'next/server'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// All entity types to fetch
const ENTITY_TYPES = [
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
  // Configuration
  'Term',
  'PaymentMethod',
  'TaxCode',
  'TaxRate',
  // Other
  'TimeActivity',
  'Budget',
]

interface ExportResult {
  entityType: string
  success: boolean
  count: number
  error?: string
}

/**
 * POST handler to export sample data
 * Body: { organizationId, limit? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { organizationId, realmId, limit = 3 } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 })
    }

    const client = new QuickBooksClient({ organizationId, realmId })

    // Create output directory
    const outputDir = join(process.cwd(), 'qb-sample-json')
    await mkdir(outputDir, { recursive: true })

    const results: ExportResult[] = []
    const allData: Record<string, unknown[]> = {}

    // Fetch each entity type sequentially
    for (const entityType of ENTITY_TYPES) {
      try {
        const query = `SELECT * FROM ${entityType} MAXRESULTS ${limit}`
        const result = await client.query<{ QueryResponse: Record<string, unknown[]> }>(query)
        const entities = result.QueryResponse?.[entityType] ?? []

        allData[entityType] = entities

        // Write individual file for this entity type
        const filePath = join(outputDir, `${entityType.toLowerCase()}.json`)
        await writeFile(
          filePath,
          JSON.stringify(
            {
              entityType,
              count: entities.length,
              fetchedAt: new Date().toISOString(),
              data: entities,
            },
            null,
            2
          )
        )

        results.push({
          entityType,
          success: true,
          count: Array.isArray(entities) ? entities.length : 0,
        })

        console.log(`[Export] ${entityType}: ${entities.length} records`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          entityType,
          success: false,
          count: 0,
          error: errorMessage,
        })
        console.error(`[Export] ${entityType} failed:`, errorMessage)

        // Still add empty array to allData
        allData[entityType] = []
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Write combined file with all data
    const combinedFilePath = join(outputDir, '_all-entities.json')
    await writeFile(
      combinedFilePath,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          organizationId,
          limit,
          summary: results,
          data: allData,
        },
        null,
        2
      )
    )

    // Calculate summary
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const totalRecords = results.reduce((sum, r) => sum + r.count, 0)

    return NextResponse.json({
      success: true,
      outputDir,
      summary: {
        totalEntityTypes: ENTITY_TYPES.length,
        successful,
        failed,
        totalRecords,
      },
      results,
    })
  } catch (error) {
    console.error('[QuickBooks Export] Error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('not connected') || errorMessage.includes('authentication')) {
      return NextResponse.json(
        { error: 'QuickBooks not connected', message: errorMessage },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'Export failed', message: errorMessage }, { status: 500 })
  }
}

/**
 * Export route configuration
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
