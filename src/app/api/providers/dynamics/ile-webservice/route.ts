import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/ile-webservice
 *
 * Fetches Item Ledger Entries via BC's ODataV4 Web Services endpoint
 * (Page 38 — Item Ledger Entries) which exposes ALL columns from the
 * BC table, unlike the standard /api/v2.0/itemLedgerEntries entity
 * which only returns 15 fields.
 *
 * URL pattern:
 *   /v2.0/{tenantId}/{envName}/ODataV4/Company('{companyName}')/ItemLedgerEntries
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
    const odataBaseUrl = `${BC_API_BASE}/v2.0/${tenant_id}/${environment_name}/ODataV4/Company('${encodedCompany}')/ItemLedgerEntries`

    // Build query params
    const queryParts: string[] = []
    const filters: string[] = []
    if (startDate) filters.push(`Posting_Date ge ${startDate}`)
    if (endDate) filters.push(`Posting_Date le ${endDate}`)
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
      `[ile-webservice] ODataV4 Web Services returned ${entries.length} entries with ${allFields.length} fields`
    )
    console.log(`[ile-webservice] Fields: ${allFields.join(', ')}`)
    if (sampleEntry) {
      console.log(`[ile-webservice] Sample entry:`, JSON.stringify(sampleEntry, null, 2))
    }

    return NextResponse.json({
      data: {
        entries,
        meta: {
          totalReturned: entries.length,
          fieldCount: allFields.length,
          fields: allFields,
          sampleEntry,
          source: 'ODataV4 Web Services (Page 38)',
          url: odataBaseUrl,
        },
        currency: credentials.currency || 'USD',
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[ile-webservice] Error:`, message)

    return NextResponse.json(
      {
        error: 'Failed to fetch ILE via ODataV4 Web Services',
        details: message,
        hint: 'The ItemLedgerEntries page may not be published as a Web Service in this BC environment. Go to BC → Web Services → add Page 38 (Item Ledger Entries).',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
