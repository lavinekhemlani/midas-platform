import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { BusinessCentralClient } from '@/lib/providers/dynamics/client'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { logger } from '@/lib/logger'

/**
 * Aged Receivables Diagnostic — Probe multiple endpoint variations
 *
 * Tests many entity name / approach combinations to find what works:
 *  1. agedAccountsReceivable (current code — singular)
 *  2. agedAccountsReceivables (BC docs — plural)
 *  3. customers with $select including balanceDue, currencyCode
 *  4. salesInvoices filtered to Open status
 *  5. generalLedgerEntries filtered to receivable accounts
 *
 * For each probe: returns success/fail, HTTP status, record count,
 * sample record with all fields, and timing.
 */
export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId') || undefined

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

    // ── Helper: probe an entity and return structured result ──
    async function probe(id: string, label: string, description: string, fn: () => Promise<any>) {
      const t0 = Date.now()
      try {
        const result = await fn()
        const durationMs = Date.now() - t0
        // Handle both array results and OData response objects
        const records = Array.isArray(result) ? result : (result?.value ?? [])
        const sample = records[0] ?? null
        return {
          id,
          label,
          description,
          success: true,
          durationMs,
          recordCount: records.length,
          fields: sample ? Object.keys(sample) : [],
          sampleRecord: sample,
          records,
        }
      } catch (err: any) {
        return {
          id,
          label,
          description,
          success: false,
          durationMs: Date.now() - t0,
          error: err?.message || String(err),
          httpStatus: err?.status || err?.statusCode || null,
          recordCount: 0,
          fields: [],
          sampleRecord: null,
          records: [],
        }
      }
    }

    // ── Run all probes in parallel ──
    const probes = await Promise.all([
      // Probe 1: Current code entity name (singular)
      probe(
        'aged-ar-singular',
        'agedAccountsReceivable (singular)',
        'Current code entity name — may be wrong per BC docs',
        () => client.query('agedAccountsReceivable').then((r) => r.value)
      ),

      // Probe 2: BC docs entity name (plural)
      probe(
        'aged-ar-plural',
        'agedAccountsReceivables (plural)',
        'Official BC API v2.0 entity name per Microsoft docs',
        () => client.query('agedAccountsReceivables').then((r) => r.value)
      ),

      // Probe 3: Try with $top=5 to limit response
      probe(
        'aged-ar-plural-top5',
        'agedAccountsReceivables?$top=5',
        'Plural name with $top=5 — tests OData params work',
        () => client.query('agedAccountsReceivables', { $top: 5 }).then((r) => r.value)
      ),

      // Probe 4: Customers with all financial fields
      probe(
        'customers-full',
        'customers (full financial fields)',
        'Customer list with balanceDue, currencyCode, creditLimit',
        () =>
          client.listCustomers({
            $select: 'id,number,displayName,balanceDue,currencyCode,creditLimit',
            $orderby: 'displayName',
          })
      ),

      // Probe 5: Open sales invoices (alternative aging source)
      probe(
        'open-sales-invoices',
        "salesInvoices (status eq 'Open')",
        'Open invoices — can compute aging from dueDate. Has currencyCode per invoice.',
        () =>
          client.listSalesInvoices({
            $filter: "status eq 'Open'",
          })
      ),

      // Probe 6: All sales invoices (small sample)
      probe(
        'sales-invoices-sample',
        'salesInvoices ($top=5, all statuses)',
        'Sample of all invoices to see available fields and statuses',
        () =>
          client.listSalesInvoices({
            $top: 5,
          })
      ),

      // Probe 7: Company info (to get LCY currency code)
      probe(
        'company-info',
        'companyInformation',
        'Company info — shows currencyCode (LCY), country, name',
        () => client.query('companyInformation', { $top: 1 }).then((r) => r.value)
      ),

      // Probe 8: Try customerLedgerEntries (may be beta / unavailable)
      probe(
        'customer-ledger-entries',
        'customerLedgerEntries ($top=5)',
        'Finance Reports API (Beta) — detailed customer transactions with remaining amounts',
        () => client.query('customerLedgerEntries', { $top: 5 }).then((r) => r.value)
      ),

      // Probe 9: Try detailedCustomerLedgerEntries
      probe(
        'detailed-customer-ledger',
        'detailedCustomerLedgerEntries ($top=5)',
        'Finance Reports API (Beta) — granular applications and adjustments',
        () => client.query('detailedCustomerLedgerEntries', { $top: 5 }).then((r) => r.value)
      ),

      // Probe 10: GL entries for receivables accounts (account category filter)
      probe(
        'gl-entries-sample',
        'generalLedgerEntries ($top=10)',
        'Sample GL entries to inspect available fields',
        () =>
          client.listGeneralLedgerEntries({
            $top: 10,
            $orderby: 'postingDate desc',
          })
      ),
    ])

    // ── Summary ──
    const successCount = probes.filter((p) => p.success).length
    const failedCount = probes.filter((p) => !p.success).length

    // Build a compact summary of which worked
    const summary = probes.map((p) => ({
      id: p.id,
      label: p.label,
      success: p.success,
      recordCount: p.recordCount,
      durationMs: p.durationMs,
      error: (p as any).error || null,
      fieldCount: p.fields.length,
    }))

    logger.info('Aged AR diagnostic probes complete', {
      organizationId,
      connectionId: resolvedConnectionId,
      successCount,
      failedCount,
    })

    return NextResponse.json({
      data: {
        companyName: credentials.company_name || null,
        totalProbes: probes.length,
        successCount,
        failedCount,
        summary,
        probes,
      },
    })
  } catch (error) {
    logger.error('Aged AR diagnostic failed', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Aged receivables diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
