'use client'

import { useState } from 'react'
import { useBCDocumentLines, type BCDocumentLine } from '../hooks/useBCDocumentLines'
import { formatCurrency } from '@/lib/utils/currency'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type DocumentType =
  | 'invoice'
  | 'order'
  | 'creditMemo'
  | 'receipt'
  | 'salesInvoice'
  | 'salesCreditMemo'
  | 'salesShipment'

interface DocumentLineItemsProps {
  connectionId: string
  documentType: DocumentType
  documentId: string
  currency: string
  isLight: boolean
  colSpan: number
}

export function DocumentLineItems({
  connectionId,
  documentType,
  documentId,
  currency,
  isLight,
  colSpan,
}: DocumentLineItemsProps) {
  const { lines, isLoading, error } = useBCDocumentLines(connectionId, documentType, documentId)
  const [query, setQuery] = useState('')

  const textMuted = isLight ? 'text-stone-500' : 'text-stone-500'
  const text = isLight ? 'text-stone-900' : 'text-white'
  const bg = isLight ? 'bg-stone-50' : 'bg-white/[0.03]'
  const border = isLight ? 'border-stone-200' : 'border-white/[0.06]'

  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className={cn('py-4 px-2', bg)}>
          <div className="flex items-center justify-center gap-2">
            <Loader2 className={cn('w-3.5 h-3.5 animate-spin', textMuted)} />
            <span className={cn('text-xs', textMuted)}>Loading line items...</span>
          </div>
        </td>
      </tr>
    )
  }

  if (error || lines.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className={cn('py-3 px-2', bg)}>
          <span className={cn('text-xs', textMuted)}>
            {error ? 'Failed to load line items' : 'No line items'}
          </span>
        </td>
      </tr>
    )
  }

  const isOrder = documentType === 'order'
  const isSalesShipment = documentType === 'salesShipment'

  const q = query.toLowerCase().trim()
  const filteredLines = q
    ? lines.filter(
        (line) =>
          (line.description || '').toLowerCase().includes(q) ||
          (line.lineObjectNumber || '').toLowerCase().includes(q) ||
          (line.lineType || '').toLowerCase().includes(q)
      )
    : lines

  return (
    <tr>
      <td colSpan={colSpan} className={cn('p-0', bg)}>
        <div className={cn('mx-4 my-2 rounded-lg border overflow-hidden', border)}>
          {/* Lines header */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider border-b',
              border,
              textMuted,
              isLight ? 'bg-stone-100' : 'bg-white/[0.04]'
            )}
          >
            <span className="w-10">#</span>
            <span className="flex-1">Description</span>
            {isOrder && <span className="w-16 text-right">Received</span>}
            <span className="w-12 text-right">Qty</span>
            <span className="w-20 text-right">{isSalesShipment ? 'Unit Price' : 'Unit Cost'}</span>
            <span className="w-24 text-right">Amount</span>
          </div>
          {/* Inline search — only for 5+ lines */}
          {lines.length >= 5 && (
            <div
              className={cn(
                'px-3 py-1 border-b',
                border,
                isLight ? 'bg-stone-50' : 'bg-white/[0.02]'
              )}
            >
              <div className="relative">
                <Search
                  className={cn(
                    'absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5',
                    isLight ? 'text-stone-300' : 'text-stone-600'
                  )}
                />
                <input
                  type="text"
                  placeholder="Filter lines..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(
                    'w-full pl-5.5 pr-2 py-0.5 text-[10px] rounded border-none outline-none bg-transparent',
                    isLight
                      ? 'text-stone-700 placeholder:text-stone-300'
                      : 'text-stone-300 placeholder:text-stone-600'
                  )}
                />
              </div>
            </div>
          )}
          {/* Lines */}
          {filteredLines.map((line: BCDocumentLine, idx: number) => {
            const qty = line.quantity || 0
            const unitCost = line.unitPrice ?? line.directUnitCost ?? line.unitCost ?? 0
            const amount = line.amountExcludingTax || line.netAmount || qty * unitCost
            const lineTypeLabel =
              line.lineType === 'Item'
                ? line.lineObjectNumber
                : line.lineType === 'Account'
                  ? `G/L ${line.lineObjectNumber}`
                  : line.lineType === 'Comment'
                    ? ''
                    : line.lineObjectNumber || ''

            if (line.lineType === 'Comment' && !line.description) return null

            return (
              <div
                key={line.id || idx}
                className={cn(
                  'flex items-start gap-2 px-3 py-1.5 text-xs',
                  idx % 2 === 0 ? '' : isLight ? 'bg-stone-50' : 'bg-white/[0.02]'
                )}
              >
                <span className={cn('w-10 font-mono tabular-nums shrink-0', textMuted)}>
                  {line.sequence || idx + 1}
                </span>
                <span className={cn('flex-1 min-w-0', text)}>
                  <span className="block truncate">{line.description || '—'}</span>
                  {lineTypeLabel && (
                    <span className={cn('block text-[10px] mt-0.5', textMuted)}>
                      {lineTypeLabel}
                      {line.unitOfMeasureCode ? ` · ${line.unitOfMeasureCode}` : ''}
                    </span>
                  )}
                </span>
                {isOrder && (
                  <span
                    className={cn('w-16 text-right font-mono tabular-nums shrink-0', textMuted)}
                  >
                    {line.receivedQuantity != null ? (
                      <span
                        className={
                          line.receivedQuantity >= qty
                            ? isLight
                              ? 'text-emerald-600'
                              : 'text-emerald-400'
                            : isLight
                              ? 'text-amber-600'
                              : 'text-amber-400'
                        }
                      >
                        {line.receivedQuantity}/{qty}
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                )}
                <span className={cn('w-12 text-right font-mono tabular-nums shrink-0', text)}>
                  {line.lineType === 'Comment' ? '' : qty}
                </span>
                <span className={cn('w-20 text-right font-mono tabular-nums shrink-0', textMuted)}>
                  {line.lineType === 'Comment' ? '' : formatCurrency(unitCost, { currency })}
                </span>
                <span
                  className={cn(
                    'w-24 text-right font-mono tabular-nums font-medium shrink-0',
                    text
                  )}
                >
                  {line.lineType === 'Comment' ? '' : formatCurrency(amount, { currency })}
                </span>
              </div>
            )
          })}
          {query && filteredLines.length === 0 && (
            <div className={cn('px-3 py-2 text-[10px] text-center', textMuted)}>
              No lines match "{query}"
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
