import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/warehouse-entries-webservice
 *
 * Fetches Warehouse Entries via BC's ODataV4 Web Services endpoint
 * (Warehouse_Entries_Excel) which exposes ALL columns from the
 * BC warehouse entries table.
 *
 * URL pattern:
 *   /v2.0/{tenantId}/{envName}/ODataV4/Company('{companyName}')/Warehouse_Entries_Excel
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 *   top           — max records to return (default 50 for safety)
 */

const BC_API_BASE = 'https://api.businesscentral.dynamics.com'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined
    const top = parseInt(url.searchParams.get('top') || '50', 10)

    let resolvedConnectionId = connectionId
    if (!resolvedConnectionId) {
      resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
    }
    if (!resolvedConnectionId) {
      return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
    }

    const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
    if (!credentials?.connected || !credentials?.access_token) {
      return NextResponse.json({ error: 'Connection not active' }, { status: 404 })
    }

    const { tenant_id, environment_name, company_name } = credentials
    if (!tenant_id || !environment_name || !company_name) {
      return NextResponse.json(
        { error: 'Missing tenant_id, environment_name, or company_name in credentials' },
        { status: 400 }
      )
    }

    // Build the ODataV4 Web Services URL
    const encodedCompany = encodeURIComponent(company_name)
    const odataBaseUrl = `${BC_API_BASE}/v2.0/${tenant_id}/${environment_name}/ODataV4/Company('${encodedCompany}')/Warehouse_Entries_Excel`

    // Build query params
    const queryParts: string[] = []
    const filters: string[] = []
    if (startDate) filters.push(`Registering_Date ge ${startDate}`)
    if (endDate) filters.push(`Registering_Date le ${endDate}`)
    if (filters.length > 0) queryParts.push(`$filter=${encodeURIComponent(filters.join(' and '))}`)
    queryParts.push(`$top=${top}`)

    const fullUrl = `${odataBaseUrl}?${queryParts.join('&')}`

    // Use the BC client's request method (supports full URLs, handles auth + rate limiting)
    const client = new BusinessCentralClient({ organizationId, connectionId: resolvedConnectionId })
    const rawResponse = await client.request<any>(fullUrl)

    const entries = rawResponse.value || []

    // Discover all fields from first entry
    const allFields = entries.length > 0 ? Object.keys(entries[0]) : []
    const sampleEntry = entries.length > 0 ? entries[0] : null

    console.log(
      `[warehouse-entries-ws] ODataV4 Web Services returned ${entries.length} entries with ${allFields.length} fields`
    )
    console.log(`[warehouse-entries-ws] Fields: ${allFields.join(', ')}`)
    if (sampleEntry) {
      console.log(`[warehouse-entries-ws] Sample entry:`, JSON.stringify(sampleEntry, null, 2))
    }

    return NextResponse.json({
      data: {
        entries,
        meta: {
          totalReturned: entries.length,
          fieldCount: allFields.length,
          fields: allFields,
          sampleEntry,
          source: 'ODataV4 Web Services (Warehouse_Entries_Excel)',
          url: odataBaseUrl,
        },
        currency: credentials.currency || 'USD',
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[warehouse-entries-ws] Error:`, message)

    return NextResponse.json(
      {
        error: 'Failed to fetch Warehouse Entries via ODataV4 Web Services',
        details: message,
        hint: 'The Warehouse_Entries_Excel page may not be published as a Web Service in this BC environment. Go to BC → Web Services to verify.',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
