import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * GET /api/providers/dynamics/customer-detail
 *
 * Per-customer detail endpoint — fetches a customer's sales invoices,
 * credit memos, sales shipments, and aged receivable row from BC.
 *
 * NOTE: BC's standard v2.0 API does NOT expose customerLedgerEntries or
 * detailedCustomerLedgerEntries. The aged AR balance may include amounts
 * from journal entries (JV) that don't appear as salesInvoice documents.
 * generalLedgerEntries also lacks sourceNumber, so we cannot filter GL by customer.
 *
 * Query params:
 *   connectionId    — BC OAuth connection ID
 *   customerNumber  — the BC customer number to fetch detail for
 *   customerId      — the BC customer GUID (alternative to customerNumber)
 */

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  const t0 = Date.now()

  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined
    const customerNumber = url.searchParams.get('customerNumber')
    const customerId = url.searchParams.get('customerId')

    if (!customerNumber && !customerId) {
      return NextResponse.json(
        { error: 'customerNumber or customerId is required' },
        { status: 400 }
      )
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
    const escapedNumber = customerNumber ? customerNumber.replace(/'/g, "''") : null

    // Build filters based on whether we have customerId (GUID) or customerNumber
    const customerFilter = customerId ? `id eq ${customerId}` : `number eq '${escapedNumber}'`
    // For sales documents, customerId is a GUID field (no quotes needed)
    const docFilterByNumber = escapedNumber ? `customerNumber eq '${escapedNumber}'` : null
    const docFilterById = customerId ? `customerId eq ${customerId}` : null
    // Prefer customerId filter for docs when available, fall back to customerNumber
    const docFilter = docFilterById || docFilterByNumber!
    // Aged AR: customerId filter when available, otherwise customerNumber
    const agedFilter = customerId
      ? `customerId eq ${customerId}`
      : `customerNumber eq '${escapedNumber}'`

    // Warm up token before parallel requests
    await client.warmUp()

    const [
      customerResult,
      invoicesResult,
      creditMemosResult,
      agedARResult,
      shipmentsResult,
      companyInfoResult,
    ] = await Promise.allSettled([
      client.listCustomers({
        $filter: customerFilter,
      }),
      // Sales invoices — includes remainingAmount for outstanding tracking
      client.listSalesInvoices({
        $filter: docFilter,
        $select:
          'id,number,customerNumber,customerName,postingDate,dueDate,currencyCode,remainingAmount,totalAmountExcludingTax,totalTaxAmount,totalAmountIncludingTax,status,orderNumber',
        $orderby: 'postingDate desc',
      }),
      client
        .queryAll('salesCreditMemos', {
          $filter: docFilter,
          $select:
            'id,number,customerNumber,customerName,postingDate,currencyCode,totalAmountIncludingTax,invoiceNumber',
          $orderby: 'postingDate desc',
        })
        .catch(() => []),
      // Aged AR filtered to this customer (avoids fetching all customers)
      client
        .query('agedAccountsReceivables', {
          $filter: agedFilter,
        })
        .then((r) => r.value || [])
        .catch(() => []),
      // Sales shipments — shows fulfilled orders
      client
        .queryAll('salesShipments', {
          $filter: docFilter,
          $select: 'id,number,postingDate,orderNumber,currencyCode',
          $orderby: 'postingDate desc',
        })
        .catch(() => []),
      // Company info — to get the actual LCY currency code
      client
        .query('companyInformation', { $top: 1 })
        .then((r) => r.value?.[0] || null)
        .catch(() => null),
    ])

    const customers: any[] = customerResult.status === 'fulfilled' ? customerResult.value : []
    const customer = customers[0] || null
    const invoices: any[] = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []
    const creditMemos: any[] =
      creditMemosResult.status === 'fulfilled' ? creditMemosResult.value : []
    const agedARRecords: any[] = agedARResult.status === 'fulfilled' ? agedARResult.value : []
    const shipments: any[] = shipmentsResult.status === 'fulfilled' ? shipmentsResult.value : []
    const companyInfo: any =
      companyInfoResult.status === 'fulfilled' ? companyInfoResult.value : null

    // Resolve the LCY currency code from company info
    // BC's agedAccountsReceivables.currencyCode is the CUSTOMER's trading currency,
    // but the monetary values are always in LCY. We need the actual LCY code.
    const lcyCurrencyCode = companyInfo?.currencyCode || companyInfo?.localCurrencyCode || ''

    // Find this customer's aged AR row (exclude the total row)
    const customerAgedAR =
      agedARRecords.find((r: any) => r.customerId !== '00000000-0000-0000-0000-000000000000') ||
      null

    // Process invoices — include remainingAmount for outstanding tracking
    const processedInvoices = invoices.map((inv: any) => ({
      id: inv.id || '',
      number: inv.number || '',
      postingDate: inv.postingDate || '',
      dueDate: inv.dueDate || '',
      currencyCode: inv.currencyCode || '',
      amount: inv.totalAmountIncludingTax ?? 0,
      remainingAmount: inv.remainingAmount ?? 0,
      status: inv.status || 'Posted',
      orderNumber: inv.orderNumber || '',
    }))

    // Process credit memos
    const processedCreditMemos = creditMemos.map((cm: any) => ({
      id: cm.id || '',
      number: cm.number || '',
      postingDate: cm.postingDate || '',
      currencyCode: cm.currencyCode || '',
      amount: cm.totalAmountIncludingTax ?? 0,
      invoiceNumber: cm.invoiceNumber || '',
    }))

    // Process shipments
    const processedShipments = shipments.map((s: any) => ({
      id: s.id || '',
      number: s.number || '',
      postingDate: s.postingDate || '',
      orderNumber: s.orderNumber || '',
    }))

    // Summary from sales invoices (these are document-level totals, not the full AR picture)
    const totalInvoiced = processedInvoices.reduce((s, inv) => s + inv.amount, 0)
    const totalCredited = processedCreditMemos.reduce((s, cm) => s + cm.amount, 0)
    const totalRemaining = processedInvoices.reduce((s, inv) => s + inv.remainingAmount, 0)

    logger.info('BC customer detail fetched', {
      organizationId,
      connectionId: resolvedConnectionId,
      customerNumber,
      invoiceCount: processedInvoices.length,
      creditMemoCount: processedCreditMemos.length,
      shipmentCount: processedShipments.length,
      agedARBalance: customerAgedAR?.balanceDue ?? 0,
    })

    return NextResponse.json({
      data: {
        customer: customer
          ? {
              number: customer.number || '',
              displayName: customer.displayName || '',
              email: customer.email || '',
              phoneNumber: customer.phoneNumber || '',
              balanceDue: customer.balanceDue ?? 0,
              creditLimit: customer.creditLimit ?? 0,
              currencyCode: customer.currencyCode || '',
            }
          : null,
        invoices: processedInvoices,
        creditMemos: processedCreditMemos,
        shipments: processedShipments,
        // LCY code from company info — the aged AR values are always in this currency
        lcyCurrencyCode,
        agedReceivable: customerAgedAR
          ? {
              balanceDue: customerAgedAR.balanceDue ?? 0,
              currentAmount: customerAgedAR.currentAmount ?? 0,
              period1Amount: customerAgedAR.period1Amount ?? 0,
              period2Amount: customerAgedAR.period2Amount ?? 0,
              period3Amount: customerAgedAR.period3Amount ?? 0,
              agedAsOfDate: customerAgedAR.agedAsOfDate || '',
            }
          : null,
        summary: {
          totalInvoiced: Math.round(totalInvoiced * 100) / 100,
          totalCredited: Math.round(totalCredited * 100) / 100,
          netInvoiceSales: Math.round((totalInvoiced - totalCredited) * 100) / 100,
          totalRemaining: Math.round(totalRemaining * 100) / 100,
          invoiceCount: processedInvoices.length,
          creditMemoCount: processedCreditMemos.length,
          shipmentCount: processedShipments.length,
        },
      },
      durationMs: Date.now() - t0,
    })
  } catch (error) {
    logger.error('Failed to fetch BC customer detail', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to fetch customer detail',
        details: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - t0,
      },
      { status: 500 }
    )
  }
})
