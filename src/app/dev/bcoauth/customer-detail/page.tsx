'use client'

import React, { useState, useCallback } from 'react'
import { useBCOAuthDev } from '../_shared/BCOAuthDevLayout'

interface ProbeResult {
  status: 'idle' | 'loading' | 'success' | 'error'
  label: string
  entity: string
  params: string
  recordCount?: number
  fields?: string[]
  sample?: any[]
  error?: string
  durationMs?: number
}

export default function CustomerDetailProbePage() {
  const { connectionId } = useBCOAuthDev()
  const [customerNumber, setCustomerNumber] = useState('C00001')
  const [probes, setProbes] = useState<ProbeResult[]>([])
  const [running, setRunning] = useState(false)
  const [rawJson, setRawJson] = useState<string>('')

  const runProbe = useCallback(
    async (label: string, entity: string, params: Record<string, string>): Promise<ProbeResult> => {
      const t0 = Date.now()
      try {
        const qs = new URLSearchParams({
          connectionId,
          entity,
          ...params,
        }).toString()
        const res = await fetch(`/api/providers/dynamics/entity-probe?${qs}`)
        const json = await res.json()
        const durationMs = Date.now() - t0

        if (!res.ok) {
          return {
            status: 'error',
            label,
            entity,
            params: JSON.stringify(params),
            error: json.error || json.details || `HTTP ${res.status}`,
            durationMs,
          }
        }

        const data = json.data || {}
        const records = data.records || []
        const fields = data.fields || (records.length > 0 ? Object.keys(records[0]) : [])

        return {
          status: 'success',
          label,
          entity,
          params: JSON.stringify(params),
          recordCount: data.recordCount ?? records.length,
          fields,
          sample: records.slice(0, 5),
          durationMs,
        }
      } catch (err) {
        return {
          status: 'error',
          label,
          entity,
          params: JSON.stringify(params),
          error: err instanceof Error ? err.message : 'Network error',
          durationMs: Date.now() - t0,
        }
      }
    },
    [connectionId]
  )

  const runAllProbes = useCallback(async () => {
    if (!connectionId || !customerNumber) return
    setRunning(true)
    setProbes([])
    setRawJson('')

    const escapedNum = customerNumber.replace(/'/g, "''")

    const probeDefs: { label: string; entity: string; params: Record<string, string> }[] = [
      // 1. GL entries — NO filter, just $top=3 to see all field names
      {
        label: 'generalLedgerEntries (schema discovery, $top=3)',
        entity: 'generalLedgerEntries',
        params: { $top: '3' },
      },
      // 2. GL entries — filter by sourceNumber
      {
        label: `generalLedgerEntries (sourceNumber eq '${escapedNum}', $top=5)`,
        entity: 'generalLedgerEntries',
        params: {
          $filter: `sourceNumber eq '${escapedNum}'`,
          $top: '5',
        },
      },
      // 3. GL entries — filter by description contains customer name
      {
        label: `generalLedgerEntries (description contains '${escapedNum}', $top=5)`,
        entity: 'generalLedgerEntries',
        params: {
          $filter: `contains(description,'${escapedNum}')`,
          $top: '5',
        },
      },
      // 4. salesInvoices — for this customer
      {
        label: `salesInvoices (customerNumber eq '${escapedNum}')`,
        entity: 'salesInvoices',
        params: {
          $filter: `customerNumber eq '${escapedNum}'`,
          $top: '5',
        },
      },
      // 5. salesInvoices — ALL, unfiltered, just top 3 to see field names
      {
        label: 'salesInvoices (schema discovery, $top=3)',
        entity: 'salesInvoices',
        params: { $top: '3' },
      },
      // 6. salesOrders — for this customer (may not exist)
      {
        label: `salesOrders (customerNumber eq '${escapedNum}', $top=5)`,
        entity: 'salesOrders',
        params: {
          $filter: `customerNumber eq '${escapedNum}'`,
          $top: '5',
        },
      },
      // 7. salesShipments — for this customer
      {
        label: `salesShipments (customerNumber eq '${escapedNum}', $top=5)`,
        entity: 'salesShipments',
        params: {
          $filter: `customerNumber eq '${escapedNum}'`,
          $top: '5',
        },
      },
      // 8. customerLedgerEntries (likely 404 but try)
      {
        label: 'customerLedgerEntries ($top=3)',
        entity: 'customerLedgerEntries',
        params: { $top: '3' },
      },
      // 9. detailedCustomerLedgerEntries (likely 404 but try)
      {
        label: 'detailedCustomerLedgerEntries ($top=3)',
        entity: 'detailedCustomerLedgerEntries',
        params: { $top: '3' },
      },
      // 10. Customer record itself
      {
        label: `customers (number eq '${escapedNum}')`,
        entity: 'customers',
        params: { $filter: `number eq '${escapedNum}'` },
      },
      // 11. agedAccountsReceivables filtered by customer
      {
        label: `agedAccountsReceivables (customerNumber eq '${escapedNum}')`,
        entity: 'agedAccountsReceivables',
        params: { $filter: `customerNumber eq '${escapedNum}'` },
      },
      // 12. salesCreditMemos for this customer
      {
        label: `salesCreditMemos (customerNumber eq '${escapedNum}', $top=5)`,
        entity: 'salesCreditMemos',
        params: {
          $filter: `customerNumber eq '${escapedNum}'`,
          $top: '5',
        },
      },
      // 13. salesInvoiceLines — if entity exists (lines with item detail)
      {
        label: 'salesInvoiceLines ($top=3, schema discovery)',
        entity: 'salesInvoiceLines',
        params: { $top: '3' },
      },
      // 14. postedSalesInvoices — alternative entity name
      {
        label: `postedSalesInvoices ($top=3)`,
        entity: 'postedSalesInvoices',
        params: { $top: '3' },
      },
    ]

    const results: ProbeResult[] = []
    for (const def of probeDefs) {
      const loadingProbe: ProbeResult = {
        status: 'loading',
        label: def.label,
        entity: def.entity,
        params: JSON.stringify(def.params),
      }
      setProbes([...results, loadingProbe])
      const result = await runProbe(def.label, def.entity, def.params)
      results.push(result)
      setProbes([...results])
    }

    // Build full JSON dump for debugging
    setRawJson(JSON.stringify(results, null, 2))
    setRunning(false)
  }, [connectionId, customerNumber, runProbe])

  return (
    <div className="space-y-6">
      <div className="glass-luxury-card p-6">
        <h2 className="text-xl font-semibold theme-text-primary mb-2">
          Customer Detail — Entity Probe Diagnostic
        </h2>
        <p className="theme-text-secondary text-sm mb-4">
          Discovers which BC API entities are available for customer-level drill-down, what fields
          they expose, and whether filtering by customer number works. This helps diagnose why
          customer detail data may be missing or incomplete.
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm theme-text-secondary mb-1">Customer Number</label>
            <input
              type="text"
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
              placeholder="C00001"
              className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 theme-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-40"
            />
          </div>
          <button
            onClick={runAllProbes}
            disabled={running || !connectionId}
            className="px-5 py-2 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? 'Running Probes...' : 'Run All Probes'}
          </button>
        </div>
      </div>

      {/* Probe Results */}
      {probes.length > 0 && (
        <div className="glass-luxury-card p-6">
          <h3 className="text-lg font-medium theme-text-primary mb-4">
            Probe Results ({probes.filter((p) => p.status === 'success').length}/{probes.length}{' '}
            succeeded)
          </h3>

          <div className="space-y-4">
            {probes.map((probe, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg border ${
                  probe.status === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : probe.status === 'error'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-white/10 bg-white/5'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        probe.status === 'success'
                          ? 'bg-emerald-500'
                          : probe.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-500 animate-pulse'
                      }`}
                    />
                    <span className="font-medium theme-text-primary text-sm">{probe.label}</span>
                  </div>
                  {probe.durationMs != null && (
                    <span className="text-xs theme-text-secondary">{probe.durationMs}ms</span>
                  )}
                </div>

                {probe.status === 'error' && (
                  <p className="text-sm text-red-400 font-mono">{probe.error}</p>
                )}

                {probe.status === 'success' && (
                  <div className="space-y-2">
                    <div className="flex gap-4 text-sm">
                      <span className="theme-text-secondary">
                        Records:{' '}
                        <span className="theme-text-primary font-mono">{probe.recordCount}</span>
                      </span>
                      <span className="theme-text-secondary">
                        Fields:{' '}
                        <span className="theme-text-primary font-mono">
                          {probe.fields?.length ?? 0}
                        </span>
                      </span>
                    </div>

                    {/* Field names */}
                    {probe.fields && probe.fields.length > 0 && (
                      <div>
                        <span className="text-xs theme-text-secondary block mb-1">Fields:</span>
                        <div className="flex flex-wrap gap-1">
                          {probe.fields.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 theme-text-secondary"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample data */}
                    {probe.sample && probe.sample.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs theme-text-secondary cursor-pointer hover:text-white transition-colors">
                          Sample data ({probe.sample.length} records)
                        </summary>
                        <pre className="mt-2 p-3 rounded-lg bg-black/30 text-xs font-mono theme-text-secondary overflow-x-auto max-h-[300px] overflow-y-auto">
                          {JSON.stringify(probe.sample, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON dump */}
      {rawJson && (
        <div className="glass-luxury-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium theme-text-primary">
              Raw JSON (copy for debugging)
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(rawJson)}
              className="px-3 py-1 text-xs rounded border border-white/10 theme-text-secondary hover:bg-white/5 transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
          <pre className="p-4 rounded-lg bg-black/30 text-xs font-mono theme-text-secondary overflow-x-auto max-h-[500px] overflow-y-auto">
            {rawJson}
          </pre>
        </div>
      )}
    </div>
  )
}
