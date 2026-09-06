import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'

/**
 * GET /api/providers/dynamics/ledger-entries
 *
 * Returns Item Ledger Entries from Business Central with optional date filtering.
 *
 * Strategy:
 *   1. Try OData Web Service (ODataV4) — returns full table including Location_Code, Lot_No
 *   2. Fall back to standard API v2.0 — limited fields, no location/lot
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   startDate     — period start (YYYY-MM-DD)
 *   endDate       — period end (YYYY-MM-DD)
 */

// Decode BC OData encoded strings: _xHHHH_ → char
function decodeOData(s: string): string {
  return s.replace(/_x([0-9a-fA-F]{4})_/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
}

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const startDate = url.searchParams.get('startDate') || undefined
    const endDate = url.searchParams.get('endDate') || undefined

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

    const client = new BusinessCentralClient({ organizationId, connectionId: resolvedConnectionId })
    await client.warmUp()

    // Build OData filter — OData WS uses Posting_Date, API v2.0 uses postingDate
    const apiFilters: string[] = []
    const wsFilters: string[] = []
    if (startDate) {
      apiFilters.push(`postingDate ge ${startDate}`)
      wsFilters.push(`Posting_Date ge ${startDate}`)
    }
    if (endDate) {
      apiFilters.push(`postingDate le ${endDate}`)
      wsFilters.push(`Posting_Date le ${endDate}`)
    }

    let rawEntries: any[] = []
    let source: 'odata_ws' | 'api_v2' = 'api_v2'

    // ── Strategy 1: Try OData Web Service (has Location_Code, Lot_No) ──
    try {
      const wsParams: any = {}
      if (wsFilters.length > 0) wsParams.$filter = wsFilters.join(' and ')
      // Common published names for Item Ledger Entries web service
      const wsEntityNames = [
        'ILE_Web_Service',
        'ILEWebService',
        'ILE',
        'ItemLedgerEntries',
        'Item_Ledger_Entries',
        'Item_Ledger_Entry',
      ]

      for (const entityName of wsEntityNames) {
        try {
          rawEntries = await client.queryODataWS(entityName, wsParams)
          source = 'odata_ws'
          console.log(
            `[ledger-entries] OData WS '${entityName}' succeeded — ${rawEntries.length} entries`
          )
          if (rawEntries.length > 0) {
            console.log('[ledger-entries] OData WS fields:', Object.keys(rawEntries[0]).join(', '))
            // Log sample with location/lot values
            const sample = rawEntries.find((e: any) => e.Lot_No || e.Location_Code)
            if (sample) {
              console.log('[ledger-entries] Sample with location/lot:', {
                Item_No: sample.Item_No,
                Location_Code: sample.Location_Code,
                Lot_No: sample.Lot_No,
                Quantity: sample.Quantity,
              })
            }
          }
          break
        } catch {
          // Entity name not published, try next
        }
      }
    } catch {
      // OData WS not available
    }

    // ── Strategy 2: Fall back to standard API v2.0 ──
    if (rawEntries.length === 0 && source === 'api_v2') {
      const apiParams: any = {}
      if (apiFilters.length > 0) apiParams.$filter = apiFilters.join(' and ')
      rawEntries = await client.queryAll('itemLedgerEntries', apiParams)
      console.log(`[ledger-entries] API v2.0 fallback — ${rawEntries.length} entries`)
      if (rawEntries.length > 0) {
        console.log('[ledger-entries] API v2.0 fields:', Object.keys(rawEntries[0]).join(', '))
      }
    }

    // Process entries — handle both OData WS field names (PascalCase/underscore) and API v2.0 (camelCase)
    const entries = rawEntries.map((e: any) => ({
      entryNumber: e.entryNumber ?? e.Entry_No ?? e.entryNo ?? 0,
      itemNumber: e.itemNumber || e.Item_No || e.itemNo || '',
      postingDate: e.postingDate || e.Posting_Date || '',
      entryType: decodeOData(e.entryType || e.Entry_Type || ''),
      documentNumber: e.documentNumber || e.Document_No || e.documentNo || '',
      documentType: decodeOData(e.documentType || e.Document_Type || ''),
      description: e.Item_Description || e.description || e.Description || '',
      quantity: e.quantity ?? e.Quantity ?? 0,
      remainingQuantity: e.remainingQuantity ?? e.Remaining_Quantity ?? 0,
      costAmountActual: e.costAmountActual ?? e.Cost_Amount_Actual ?? e.Cost_Amount__Actual_ ?? 0,
      salesAmountActual:
        e.salesAmountActual ?? e.Sales_Amount_Actual ?? e.Sales_Amount__Actual_ ?? 0,
      sourceNumber: e.sourceNumber || e.Source_No || e.sourceNo || '',
      sourceType: decodeOData(e.sourceType || e.Source_Type || ''),
      locationCode: e.locationCode || e.Location_Code || '',
      lotNo: e.lotNo || e.Lot_No || e.lotNumber || '',
      unitOfMeasureCode: e.unitOfMeasureCode || e.Unit_of_Measure_Code || '',
      open: e.open ?? e.Open ?? false,
    }))

    // Log mapped sample to verify lotNo/locationCode flow through
    const mappedWithLot = entries.find((e: any) => e.lotNo)
    const mappedWithLoc = entries.find((e: any) => e.locationCode)
    console.log('[ledger-entries] Mapped sample:', {
      hasLotNo: !!mappedWithLot,
      sampleLotNo: mappedWithLot?.lotNo || '(none)',
      hasLocationCode: !!mappedWithLoc,
      sampleLocationCode: mappedWithLoc?.locationCode || '(none)',
      totalEntries: entries.length,
    })

    // Sort by posting date descending, then entry number descending
    entries.sort((a: any, b: any) => {
      const dateCompare = b.postingDate.localeCompare(a.postingDate)
      if (dateCompare !== 0) return dateCompare
      return b.entryNumber - a.entryNumber
    })

    // Summary stats
    let totalPurchaseQty = 0
    let totalPurchaseCost = 0
    let totalSaleQty = 0
    let totalSaleCost = 0
    let totalAdjQty = 0
    let totalAdjCost = 0

    for (const e of entries) {
      const type = (e.entryType || '').toLowerCase()
      if (type.includes('purchase') || type.includes('positive')) {
        totalPurchaseQty += Math.abs(e.quantity)
        totalPurchaseCost += Math.abs(e.costAmountActual)
      } else if (type.includes('sale') || type.includes('negative')) {
        totalSaleQty += Math.abs(e.quantity)
        totalSaleCost += Math.abs(e.costAmountActual)
      } else {
        totalAdjQty += Math.abs(e.quantity)
        totalAdjCost += Math.abs(e.costAmountActual)
      }
    }

    return NextResponse.json({
      data: {
        entries,
        summary: {
          totalEntries: entries.length,
          purchases: {
            quantity: Math.round(totalPurchaseQty * 100) / 100,
            cost: Math.round(totalPurchaseCost * 100) / 100,
          },
          sales: {
            quantity: Math.round(totalSaleQty * 100) / 100,
            cost: Math.round(totalSaleCost * 100) / 100,
          },
          adjustments: {
            quantity: Math.round(totalAdjQty * 100) / 100,
            cost: Math.round(totalAdjCost * 100) / 100,
          },
        },
        source,
        currency: credentials.currency || 'USD',
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch ledger entries',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
