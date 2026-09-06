// src/lib/pdf/components/PDFMemoryWidget.tsx
// PDF component for rendering memory widgets (created, updated, deleted, list)

import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { WidgetBlock, MemoryDisplayItem } from '@/ai/widgets/types'
import { PDF_FONTS } from '../fontConfig'

// =============================================================================
// Styles - Clean, professional design without emojis
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#f8fafc', // slate-50
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0', // slate-200
  },
  containerStored: {
    backgroundColor: '#ecfdf5', // emerald-50
    borderWidth: 1,
    borderColor: '#10b98133', // emerald-500/20
    borderLeftWidth: 4,
    borderLeftColor: '#10b981', // emerald-500
  },
  containerUpdated: {
    backgroundColor: '#eff6ff', // blue-50
    borderWidth: 1,
    borderColor: '#3b82f633', // blue-500/20
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6', // blue-500
  },
  containerDeleted: {
    backgroundColor: '#fef2f2', // red-50
    borderWidth: 1,
    borderColor: '#ef444433', // red-500/20
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444', // red-500
  },
  containerList: {
    borderLeftWidth: 4,
    borderLeftColor: '#6b7280', // gray-500
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    fontSize: 7,
    fontFamily: PDF_FONTS.BOLD,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeStored: {
    backgroundColor: '#d1fae5', // emerald-100
    color: '#065f46', // emerald-800
  },
  badgeUpdated: {
    backgroundColor: '#dbeafe', // blue-100
    color: '#1e40af', // blue-800
  },
  badgeDeleted: {
    backgroundColor: '#fee2e2', // red-100
    color: '#991b1b', // red-800
  },
  badgeList: {
    backgroundColor: '#f3f4f6', // gray-100
    color: '#374151', // gray-700
  },
  content: {
    fontSize: 10,
    fontFamily: PDF_FONTS.REGULAR,
    color: '#334155', // slate-700
    lineHeight: 1.4,
  },
  contentLabel: {
    fontSize: 9,
    fontFamily: PDF_FONTS.BOLD,
    color: '#64748b', // slate-500
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  memoryDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0', // slate-200
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  detailLabel: {
    fontSize: 9,
    fontFamily: PDF_FONTS.BOLD,
    color: '#64748b', // slate-500
    width: 70,
  },
  detailValue: {
    fontSize: 9,
    fontFamily: PDF_FONTS.REGULAR,
    color: '#334155', // slate-700
    flex: 1,
  },
  listItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemType: {
    fontSize: 8,
    fontFamily: PDF_FONTS.BOLD,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  listItemContent: {
    fontSize: 10,
    fontFamily: PDF_FONTS.REGULAR,
    color: '#334155',
  },
  listItemMeta: {
    fontSize: 8,
    fontFamily: PDF_FONTS.REGULAR,
    color: '#94a3b8', // slate-400
    marginTop: 3,
  },
  emptyMessage: {
    fontSize: 10,
    fontFamily: PDF_FONTS.ITALIC,
    color: '#94a3b8',
    textAlign: 'center',
    padding: 12,
  },
})

// =============================================================================
// Helper Components
// =============================================================================

const MemoryDetails: React.FC<{ memory: MemoryDisplayItem; currency?: string }> = ({
  memory,
  currency = 'USD',
}) => {
  const details: Array<{ label: string; value: string }> = []

  if (memory.amount !== undefined) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(memory.amount)
    details.push({ label: 'Amount', value: formatted })
  }

  if (memory.date) {
    const date = new Date(memory.date)
    details.push({ label: 'Date', value: date.toLocaleDateString() })
  }

  if (memory.category) {
    details.push({ label: 'Category', value: memory.category })
  }

  if (memory.priority) {
    details.push({
      label: 'Priority',
      value: memory.priority.charAt(0).toUpperCase() + memory.priority.slice(1),
    })
  }

  if (memory.recurring && memory.frequency) {
    details.push({
      label: 'Recurring',
      value: memory.frequency.charAt(0).toUpperCase() + memory.frequency.slice(1),
    })
  }

  if (details.length === 0) return null

  return (
    <View style={styles.memoryDetails}>
      {details.map((detail, idx) => (
        <View key={idx} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{detail.label}:</Text>
          <Text style={styles.detailValue}>{detail.value}</Text>
        </View>
      ))}
    </View>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface PDFMemoryWidgetProps {
  widget: WidgetBlock
  currency?: string
}

// Safe currency formatter to handle invalid currency codes
function safeFormatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }
}

export const PDFMemoryWidget: React.FC<PDFMemoryWidgetProps> = ({ widget, currency = 'USD' }) => {
  // Null safety: bail out early if widget is null/undefined
  if (!widget || !widget.type) {
    return null
  }

  switch (widget.type) {
    case 'memory:created': {
      const { memory } = widget
      // Null safety for memory object
      if (!memory) return null
      return (
        <View style={[styles.container, styles.containerStored]}>
          <View style={styles.header}>
            <Text style={[styles.badge, styles.badgeStored]}>Stored</Text>
          </View>
          <Text style={styles.contentLabel}>{memory.typeLabel || 'Memory'}</Text>
          <Text style={styles.content}>{memory.content || ''}</Text>
          <MemoryDetails memory={memory} currency={currency} />
        </View>
      )
    }

    case 'memory:updated': {
      const { memory, changes } = widget
      // Null safety for memory object
      if (!memory) return null
      return (
        <View style={[styles.container, styles.containerUpdated]}>
          <View style={styles.header}>
            <Text style={[styles.badge, styles.badgeUpdated]}>Updated</Text>
          </View>
          <Text style={styles.contentLabel}>{memory.typeLabel || 'Memory'}</Text>
          <Text style={styles.content}>{memory.content || ''}</Text>
          {changes && changes.length > 0 && (
            <Text style={[styles.content, { fontSize: 8, marginTop: 4, color: '#64748b' }]}>
              Changed: {changes.join(', ')}
            </Text>
          )}
          <MemoryDetails memory={memory} currency={currency} />
        </View>
      )
    }

    case 'memory:deleted': {
      const { memoryContent, memoryType } = widget
      return (
        <View style={[styles.container, styles.containerDeleted]}>
          <View style={styles.header}>
            <Text style={[styles.badge, styles.badgeDeleted]}>Deleted</Text>
          </View>
          <Text style={styles.contentLabel}>{memoryType || 'Memory'}</Text>
          <Text style={[styles.content, { color: '#7f1d1d' }]}>{memoryContent || ''}</Text>
        </View>
      )
    }

    case 'memory:list': {
      const { title, memories, emptyMessage } = widget
      // Null safety for memories array
      const safeMemories = memories || []
      return (
        <View style={[styles.container, styles.containerList]}>
          <View style={styles.header}>
            <Text style={[styles.badge, styles.badgeList]}>Memory List</Text>
          </View>
          <Text style={[styles.content, { fontFamily: PDF_FONTS.BOLD, marginBottom: 8 }]}>
            {title || 'Stored Memories'}
          </Text>
          {safeMemories.length === 0 ? (
            <Text style={styles.emptyMessage}>{emptyMessage || 'No memories found.'}</Text>
          ) : (
            safeMemories.map((memory, idx) => (
              <View
                key={memory?.id || idx}
                style={[styles.listItem, idx === safeMemories.length - 1 && styles.listItemLast]}
              >
                <Text style={styles.listItemType}>{memory?.typeLabel || 'Memory'}</Text>
                <Text style={styles.listItemContent}>{memory?.content || ''}</Text>
                {(memory?.amount !== undefined || memory?.date) && (
                  <Text style={styles.listItemMeta}>
                    {memory?.amount !== undefined && safeFormatCurrency(memory.amount, currency)}
                    {memory?.amount !== undefined && memory?.date && ' | '}
                    {memory?.date && new Date(memory.date).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      )
    }

    case 'invoice:actions': {
      const { invoiceNumber, customerName, amount, currency: invCurrency, date, status } = widget
      return (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.badge, styles.badgeList]}>Invoice</Text>
          </View>
          <Text style={[styles.content, { fontFamily: PDF_FONTS.BOLD }]}>
            Invoice #{invoiceNumber}
          </Text>
          <View style={styles.memoryDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer:</Text>
              <Text style={styles.detailValue}>{customerName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount:</Text>
              <Text style={styles.detailValue}>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: invCurrency || currency,
                }).format(amount)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date:</Text>
              <Text style={styles.detailValue}>{new Date(date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={styles.detailValue}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
      )
    }

    default:
      return null
  }
}
