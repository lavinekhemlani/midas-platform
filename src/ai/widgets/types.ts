// src/ai/widgets/types.ts
// Types for memory widgets displayed in chat

import type { Memory, MemoryType } from '../memory/types'

/**
 * Widget types for memory operations and invoice actions
 * - memory:list - Display a list of memories
 * - memory:created - Confirmation of newly created memory
 * - memory:updated - Confirmation of updated memory
 * - memory:deleted - Confirmation of deleted memory
 * - invoice:actions - Invoice with PDF view/download actions
 */
export type WidgetType =
  | 'memory:list'
  | 'memory:created'
  | 'memory:updated'
  | 'memory:deleted'
  | 'invoice:actions'

/**
 * Base widget block structure
 */
export interface BaseWidgetBlock {
  type: WidgetType
  widgetIndex: number
}

/**
 * Memory list widget - shows multiple memories
 */
export interface MemoryListWidget extends BaseWidgetBlock {
  type: 'memory:list'
  title?: string
  memories: MemoryDisplayItem[]
  filterType?: MemoryType
  emptyMessage?: string
}

/**
 * Memory created widget - confirmation card
 */
export interface MemoryCreatedWidget extends BaseWidgetBlock {
  type: 'memory:created'
  memory: MemoryDisplayItem
  message?: string
}

/**
 * Memory updated widget - confirmation card
 */
export interface MemoryUpdatedWidget extends BaseWidgetBlock {
  type: 'memory:updated'
  memory: MemoryDisplayItem
  changes?: string[]
  message?: string
}

/**
 * Memory deleted widget - confirmation card
 */
export interface MemoryDeletedWidget extends BaseWidgetBlock {
  type: 'memory:deleted'
  memoryContent: string
  memoryType: MemoryType
  message?: string
}

/**
 * Invoice actions widget - displays invoice with PDF view/download buttons
 */
export interface InvoiceActionsWidget extends BaseWidgetBlock {
  type: 'invoice:actions'
  invoiceId: string
  invoiceNumber: string
  customerName: string
  amount: number
  currency: string
  date: string
  dueDate: string
  status: 'open' | 'paid' | 'overdue'
}

/**
 * Union type for all widget blocks
 */
export type WidgetBlock =
  | MemoryListWidget
  | MemoryCreatedWidget
  | MemoryUpdatedWidget
  | MemoryDeletedWidget
  | InvoiceActionsWidget

/**
 * Simplified memory item for display (no internal IDs shown)
 */
export interface MemoryDisplayItem {
  id: string // Internal ID for operations
  type: MemoryType
  typeLabel: string
  content: string
  amount?: number
  currency?: string
  date?: string
  category?: string
  priority?: 'low' | 'medium' | 'high'
  recurring?: boolean
  frequency?: string
  createdAt: string
  isNew?: boolean // Highlight newly created
}

/**
 * Widget marker pattern for chat messages
 * Example: [[WIDGET:1]], [[WIDGET:2]]
 */
export const WIDGET_MARKER_PATTERN = /\[\[WIDGET:(\d+)\]\]/g

/**
 * Extract widget markers from text
 */
export function extractWidgetMarkers(text: string): number[] {
  const markers: number[] = []
  let match
  while ((match = WIDGET_MARKER_PATTERN.exec(text)) !== null) {
    markers.push(parseInt(match[1], 10))
  }
  return markers
}

/**
 * Replace widget markers with placeholders for rendering
 */
export function replaceWidgetMarkers(text: string, replacer: (index: number) => string): string {
  return text.replace(WIDGET_MARKER_PATTERN, (_, index) => replacer(parseInt(index, 10)))
}
