import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/vendor-detail
 *
 * Fetches granular detail for a single vendor: profile, purchase invoices,
 * purchase orders, credit memos, purchase receipts, and aged payables.
 *
 * Query params:
 *   connectionId  — BC OAuth connection ID
 *   vendorId      — BC vendor GUID
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const vendorId = url.searchParams.get('vendorId')

    if (!vendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }

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

    // ── Phase 1: Fetch vendor profile (need vendorNumber for receipts) ──
    const vendor = await client.getVendor(vendorId, {
      $expand: 'currency,paymentTerm,paymentMethod',
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const vendorNumber = vendor.number

    // ── Phase 2: Parallel fetches for all related data ──
    const [
      invoicesResult,
      ordersResult,
      creditMemosResult,
      receiptsResult,
      agedPayableResult,
      companyInfoResult,
    ] = await Promise.allSettled([
      client.listPurchaseInvoices({
        $filter: `vendorId eq ${vendorId}`,
        $select:
          'id,number,invoiceDate,postingDate,dueDate,vendorInvoiceNumber,status,currencyCode,totalAmountExcludingTax,totalTaxAmount,totalAmountIncludingTax,orderId,orderNumber,lastModifiedDateTime',
        $orderby: 'postingDate desc',
      }),
      client.listPurchaseOrders({
        $filter: `vendorId eq ${vendorId}`,
        $select:
          'id,number,orderDate,postingDate,status,fullyReceived,currencyCode,totalAmountExcludingTax,totalTaxAmount,totalAmountIncludingTax,lastModifiedDateTime',
        $orderby: 'orderDate desc',
      }),
      client.listPurchaseCreditMemos({
        $filter: `vendorId eq ${vendorId}`,
        $select:
          'id,number,creditMemoDate,postingDate,dueDate,status,currencyCode,invoiceNumber,totalAmountExcludingTax,totalTaxAmount,totalAmountIncludingTax,lastModifiedDateTime',
        $orderby: 'creditMemoDate desc',
      }),
      vendorNumber
        ? client.listPurchaseReceipts({
            $filter: `vendorNumber eq '${vendorNumber}'`,
            $select: 'id,number,postingDate,orderNumber,vendorName,lastModifiedDateTime',
            $orderby: 'postingDate desc',
          })
        : Promise.resolve([]),
      client.getAgedAccountsPayable({
        $filter: `vendorId eq ${vendorId}`,
      }),
      // Company info — to get the actual LCY currency code
      client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0] || null)
        .catch(() => null),
    ])

    const invoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []
    const orders = ordersResult.status === 'fulfilled' ? ordersResult.value : []
    const creditMemos = creditMemosResult.status === 'fulfilled' ? creditMemosResult.value : []
    const receipts = receiptsResult.status === 'fulfilled' ? receiptsResult.value : []
    const agedPayable =
      agedPayableResult.status === 'fulfilled' ? (agedPayableResult.value.records[0] ?? null) : null
    const companyInfo: any =
      companyInfoResult.status === 'fulfilled' ? companyInfoResult.value : null

    // Resolve the LCY currency code from BC companyInformation entity
    // companyInformation.currencyCode is the company's local currency (LCY)
    const lcyCurrencyCode = companyInfo?.currencyCode || ''
    if (!lcyCurrencyCode) {
      logger.warn('BC companyInformation missing currencyCode — LCY unknown', {
        organizationId,
        connectionId: resolvedConnectionId,
        companyInfoKeys: companyInfo ? Object.keys(companyInfo) : null,
      })
    }

    // ── Compute summary stats ──
    const totalInvoiced = invoices.reduce(
      (sum: number, inv: any) => sum + (inv.totalAmountIncludingTax || 0),
      0
    )
    const totalCreditMemos = creditMemos.reduce(
      (sum: number, cm: any) => sum + (cm.totalAmountIncludingTax || 0),
      0
    )
    const openOrders = orders.filter((o: any) => !o.fullyReceived).length

    const companyName = credentials.company_name || null

    logger.info('BC vendor detail fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      vendorId,
      invoiceCount: invoices.length,
      orderCount: orders.length,
      creditMemoCount: creditMemos.length,
      receiptCount: receipts.length,
      durationMs: Date.now() - t0,
    })

    return NextResponse.json({
      data: {
        vendor: {
          id: vendor.id,
          number: vendor.number,
          displayName: vendor.displayName,
          addressLine1: vendor.addressLine1 || '',
          addressLine2: vendor.addressLine2 || '',
          city: vendor.city || '',
          state: vendor.state || '',
          country: vendor.country || '',
          postalCode: vendor.postalCode || '',
          phoneNumber: vendor.phoneNumber || '',
          email: vendor.email || '',
          website: vendor.website || '',
          taxRegistrationNumber: vendor.taxRegistrationNumber || '',
          currencyCode: vendor.currencyCode || '',
          balance: vendor.balance || 0,
          blocked: vendor.blocked || ' ',
          taxLiable: vendor.taxLiable || false,
          lastModifiedDateTime: vendor.lastModifiedDateTime || '',
          // Expanded relations
          paymentTerms: vendor.paymentTerm
            ? {
                code: vendor.paymentTerm.code || '',
                displayName: vendor.paymentTerm.displayName || '',
                dueDateCalculation: vendor.paymentTerm.dueDateCalculation || '',
                discountPercent: vendor.paymentTerm.discountPercent || 0,
              }
            : null,
          paymentMethod: vendor.paymentMethod
            ? {
                code: vendor.paymentMethod.code || '',
                displayName: vendor.paymentMethod.displayName || '',
              }
            : null,
          currency: vendor.currency
            ? {
                code: vendor.currency.code || '',
                displayName: vendor.currency.displayName || '',
                symbol: vendor.currency.symbol || '',
              }
            : null,
        },
        invoices,
        orders,
        creditMemos,
        receipts,
        agedPayable,
        lcyCurrencyCode,
        summary: {
          totalInvoiced,
          totalCreditMemos,
          openOrders,
          invoiceCount: invoices.length,
          orderCount: orders.length,
          creditMemoCount: creditMemos.length,
          receiptCount: receipts.length,
        },
        companyName,
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('Failed to fetch BC vendor detail', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch vendor detail',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
