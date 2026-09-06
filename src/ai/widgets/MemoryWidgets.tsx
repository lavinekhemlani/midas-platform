// src/ai/widgets/MemoryWidgets.tsx
// React components for memory widgets in chat

'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Brain,
  Calendar,
  DollarSign,
  Target,
  Briefcase,
  Settings,
  Lightbulb,
  Check,
  Trash2,
  Edit3,
  RefreshCw,
  ExternalLink,
  FileText,
  Eye,
  Download,
} from 'lucide-react'
import type {
  WidgetBlock,
  MemoryListWidget,
  MemoryCreatedWidget,
  MemoryUpdatedWidget,
  MemoryDeletedWidget,
  InvoiceActionsWidget,
  MemoryDisplayItem,
} from './types'
import type { MemoryType } from '../memory/types'

// =============================================================================
// Icon Map for Memory Types
// =============================================================================

const memoryTypeIcons: Record<MemoryType, React.ReactNode> = {
  expense: <DollarSign className="w-4 h-4" />,
  income: <DollarSign className="w-4 h-4" />,
  goal: <Target className="w-4 h-4" />,
  deadline: <Calendar className="w-4 h-4" />,
  context: <Briefcase className="w-4 h-4" />,
  preference: <Settings className="w-4 h-4" />,
  decision: <Lightbulb className="w-4 h-4" />,
}

const memoryTypeColors: Record<MemoryType, string> = {
  expense: 'text-red-400 bg-transparent border-transparent',
  income: 'text-emerald-400 bg-transparent border-transparent',
  goal: 'text-blue-400 bg-transparent border-transparent',
  deadline: 'text-amber-400 bg-transparent border-transparent',
  context: 'text-purple-400 bg-transparent border-transparent',
  preference: 'text-cyan-400 bg-transparent border-transparent',
  decision: 'text-orange-400 bg-transparent border-transparent',
}

// =============================================================================
// Main Widget Renderer
// =============================================================================

interface WidgetRendererProps {
  widget: WidgetBlock
  className?: string
  onMemoryClick?: (memoryId: string) => void
}

export function WidgetRenderer({ widget, className, onMemoryClick }: WidgetRendererProps) {
  switch (widget.type) {
    case 'memory:list':
      return (
        <MemoryListRenderer widget={widget} className={className} onMemoryClick={onMemoryClick} />
      )
    case 'memory:created':
      return <MemoryCreatedRenderer widget={widget} className={className} />
    case 'memory:updated':
      return <MemoryUpdatedRenderer widget={widget} className={className} />
    case 'memory:deleted':
      return <MemoryDeletedRenderer widget={widget} className={className} />
    case 'invoice:actions':
      return <InvoiceActionsRenderer widget={widget} className={className} />
    default:
      return null
  }
}

// =============================================================================
// Memory List Widget
// =============================================================================

interface MemoryListRendererProps {
  widget: MemoryListWidget
  className?: string
  onMemoryClick?: (memoryId: string) => void
}

function MemoryListRenderer({ widget, className, onMemoryClick }: MemoryListRendererProps) {
  const router = useRouter()
  const { title, memories, emptyMessage } = widget

  const handleNavigate = () => {
    router.push('/memories')
  }

  if (!memories || memories.length === 0) {
    return (
      <div
        className={cn(
          'my-4 glass-luxury-card rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-all',
          className
        )}
        onClick={handleNavigate}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-500" />
            <h4 className="text-sm font-semibold theme-text-primary">
              {title || 'Stored Memories'}
            </h4>
          </div>
          <ExternalLink className="w-4 h-4 theme-text-secondary" />
        </div>
        <p className="text-sm theme-text-secondary italic">
          {emptyMessage || 'No memories found.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'my-4 glass-luxury-card rounded-xl p-4 cursor-pointer hover:bg-white/5 transition-all',
        className
      )}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-amber-500" />
          <h4 className="text-sm font-semibold theme-text-primary">
            {title || `${memories.length} Stored ${memories.length === 1 ? 'Memory' : 'Memories'}`}
          </h4>
        </div>
        <ExternalLink className="w-4 h-4 theme-text-secondary" />
      </div>

      <div className="space-y-2">
        {memories.map((memory) => (
          <MemoryItem
            key={memory.id}
            memory={memory}
            onClick={onMemoryClick ? () => onMemoryClick(memory.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Memory Created Widget
// =============================================================================

interface MemoryCreatedRendererProps {
  widget: MemoryCreatedWidget
  className?: string
}

function MemoryCreatedRenderer({ widget, className }: MemoryCreatedRendererProps) {
  const router = useRouter()
  const { memory, message } = widget

  const handleNavigate = () => {
    router.push('/memories')
  }

  return (
    <div
      className={cn(
        'my-4 glass-luxury-card rounded-xl p-4 border border-emerald-500/20 cursor-pointer hover:bg-white/5 transition-all',
        className
      )}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <h4 className="text-sm font-semibold text-emerald-400">Memory Stored</h4>
        </div>
        <ExternalLink className="w-4 h-4 text-emerald-400/60" />
      </div>

      <MemoryItem memory={{ ...memory, isNew: true }} />

      {message && <p className="text-xs theme-text-secondary mt-2">{message}</p>}
    </div>
  )
}

// =============================================================================
// Memory Updated Widget
// =============================================================================

interface MemoryUpdatedRendererProps {
  widget: MemoryUpdatedWidget
  className?: string
}

function MemoryUpdatedRenderer({ widget, className }: MemoryUpdatedRendererProps) {
  const router = useRouter()
  const { memory, changes, message } = widget

  const handleNavigate = () => {
    router.push('/memories')
  }

  return (
    <div
      className={cn(
        'my-4 glass-luxury-card rounded-xl p-4 border border-blue-500/20 cursor-pointer hover:bg-white/5 transition-all',
        className
      )}
      onClick={handleNavigate}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Edit3 className="w-4 h-4 text-blue-400" />
          </div>
          <h4 className="text-sm font-semibold text-blue-400">Memory Updated</h4>
        </div>
        <ExternalLink className="w-4 h-4 text-blue-400/60" />
      </div>

      <MemoryItem memory={memory} />

      {changes && changes.length > 0 && (
        <div className="mt-2 text-xs theme-text-secondary">
          <span className="font-medium">Changes:</span> {changes.join(', ')}
        </div>
      )}

      {message && <p className="text-xs theme-text-secondary mt-2">{message}</p>}
    </div>
  )
}

// =============================================================================
// Memory Deleted Widget
// =============================================================================

interface MemoryDeletedRendererProps {
  widget: MemoryDeletedWidget
  className?: string
}

function MemoryDeletedRenderer({ widget, className }: MemoryDeletedRendererProps) {
  const { memoryContent, memoryType, message } = widget

  return (
    <div
      className={cn('my-4 glass-luxury-card rounded-xl p-4 border border-red-500/20', className)}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-400" />
        </div>
        <h4 className="text-sm font-semibold text-red-400">Memory Deleted</h4>
      </div>

      <div className="p-3 rounded-lg bg-white/5 border border-white/10 opacity-60">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium',
              memoryTypeColors[memoryType]
            )}
          >
            {memoryTypeIcons[memoryType]}
            <span className="capitalize">{memoryType}</span>
          </span>
        </div>
        <p className="text-sm theme-text-secondary mt-2 line-through">{memoryContent}</p>
      </div>

      {message && <p className="text-xs theme-text-secondary mt-2">{message}</p>}
    </div>
  )
}

// =============================================================================
// Shared Memory Item Component
// =============================================================================

interface MemoryItemProps {
  memory: MemoryDisplayItem
  onClick?: () => void
}

function MemoryItem({ memory, onClick }: MemoryItemProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatAmount = (amount: number, currency?: string) => {
    // Validate currency code (must be 3 letter ISO code)
    const isValidCurrency = currency && /^[A-Z]{3}$/i.test(currency)
    const safeCurrency = isValidCurrency ? currency.toUpperCase() : 'USD'

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: safeCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount)
    } catch {
      // Fallback if currency is still invalid
      return `$${amount.toLocaleString()}`
    }
  }

  return (
    <div
      className={cn(
        'p-3 rounded-lg bg-white/5 border border-white/10 transition-all',
        memory.isNew && 'ring-1 ring-emerald-500/30 bg-emerald-500/5'
      )}
      onClick={(e) => {
        // Prevent click if parent is handling navigation
        e.stopPropagation()
        onClick?.()
      }}
    >
      {/* Header row: Type badge + Date */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium',
            memoryTypeColors[memory.type]
          )}
        >
          {memoryTypeIcons[memory.type]}
          <span>{memory.typeLabel}</span>
        </span>

        {memory.date && (
          <span className="text-xs theme-text-secondary flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(memory.date)}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm theme-text-primary">{memory.content}</p>

      {/* Amount + Meta row */}
      <div className="flex items-center gap-3 mt-2">
        {memory.amount !== undefined && (
          <span
            className={cn(
              'text-sm font-medium',
              memory.type === 'expense' ? 'text-red-400' : 'text-emerald-400'
            )}
          >
            {memory.type === 'expense' ? '-' : '+'}
            {formatAmount(memory.amount, memory.currency)}
          </span>
        )}

        {memory.recurring && (
          <span className="text-xs theme-text-secondary flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            {memory.frequency || 'Recurring'}
          </span>
        )}

        {memory.priority && memory.priority !== 'medium' && (
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded',
              memory.priority === 'high'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-gray-500/20 text-gray-400'
            )}
          >
            {memory.priority}
          </span>
        )}

        {memory.category && <span className="text-xs theme-text-secondary">{memory.category}</span>}
      </div>

      {/* Upcoming dates for recurring memories */}
      {memory.recurring &&
        memory.frequency &&
        memory.date &&
        (() => {
          const start = new Date(memory.date)
          const now = new Date()
          const freq = memory.frequency
          const upcoming: Date[] = []
          const d = new Date(start)
          const maxCount =
            freq === 'daily'
              ? 7
              : freq === 'weekly'
                ? 8
                : freq === 'monthly'
                  ? 12
                  : freq === 'quarterly'
                    ? 4
                    : 4
          while (d <= now) {
            if (freq === 'daily') d.setDate(d.getDate() + 1)
            else if (freq === 'weekly') d.setDate(d.getDate() + 7)
            else if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
            else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3)
            else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
          }
          for (let i = 0; i < maxCount; i++) {
            upcoming.push(new Date(d))
            if (freq === 'daily') d.setDate(d.getDate() + 1)
            else if (freq === 'weekly') d.setDate(d.getDate() + 7)
            else if (freq === 'monthly') d.setMonth(d.getMonth() + 1)
            else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3)
            else if (freq === 'yearly') d.setFullYear(d.getFullYear() + 1)
          }
          return upcoming.length > 0 ? (
            <div className="mt-3 border-t border-white/5 pt-2.5">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1 h-1 rounded-full bg-slate-500" />
                <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                  REVIEW SCHEDULE
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {upcoming.map((date, i) => {
                  const isNext = i === 0
                  return (
                    <div
                      key={i}
                      className={cn(
                        'text-center py-1.5 px-1 rounded border',
                        isNext
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-white/5 bg-white/[0.02]'
                      )}
                    >
                      <div
                        className={cn(
                          'text-[10px] font-medium',
                          isNext ? 'text-emerald-400' : 'text-slate-400'
                        )}
                      >
                        {date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      <div
                        className={cn(
                          'text-sm font-semibold font-mono',
                          isNext ? 'text-emerald-300' : 'text-slate-300'
                        )}
                      >
                        {date.getDate()}
                      </div>
                      {isNext && (
                        <div className="text-[9px] text-emerald-500 font-medium mt-0.5">NEXT</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null
        })()}
    </div>
  )
}

// =============================================================================
// Invoice Actions Widget
// =============================================================================

interface InvoiceActionsRendererProps {
  widget: InvoiceActionsWidget
  className?: string
}

function InvoiceActionsRenderer({ widget, className }: InvoiceActionsRendererProps) {
  const { invoiceId, invoiceNumber, customerName, amount, currency, date, dueDate, status } = widget

  const formatAmount = (value: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleViewPdf = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`/api/invoice/${invoiceId}/pdf`, '_blank')
  }

  const handleDownloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/invoice/${invoiceId}/pdf`)
      if (!response.ok) throw new Error('Failed to fetch PDF')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download PDF:', error)
    }
  }

  const statusColors = {
    open: 'text-blue-400 bg-blue-500/10',
    paid: 'text-emerald-400 bg-emerald-500/10',
    overdue: 'text-red-400 bg-red-500/10',
  }

  return (
    <div
      className={cn('my-4 glass-luxury-card rounded-xl p-4 border border-blue-500/20', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold theme-text-primary">Invoice #{invoiceNumber}</h4>
            <p className="text-xs theme-text-secondary">{customerName}</p>
          </div>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded-full capitalize', statusColors[status])}>
          {status}
        </span>
      </div>

      {/* Details */}
      <div className="flex items-center justify-between mb-4 text-sm">
        <div>
          <span className="theme-text-secondary">Amount: </span>
          <span className="font-medium theme-text-primary">{formatAmount(amount, currency)}</span>
        </div>
        <div className="text-right">
          <span className="theme-text-secondary">Due: </span>
          <span className="theme-text-primary">{formatDate(dueDate)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleViewPdf}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm theme-text-primary"
        >
          <Eye className="w-4 h-4" />
          View PDF
        </button>
        <button
          onClick={handleDownloadPdf}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 transition-all text-sm text-blue-400"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Exports
// =============================================================================

export {
  MemoryListRenderer,
  MemoryCreatedRenderer,
  MemoryUpdatedRenderer,
  MemoryDeletedRenderer,
  InvoiceActionsRenderer,
  MemoryItem,
  memoryTypeIcons,
  memoryTypeColors,
}
