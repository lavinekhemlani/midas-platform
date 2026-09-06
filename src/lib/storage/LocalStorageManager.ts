// src/lib/storage/LocalStorageManager.ts

import { logger } from '@/lib/logger'

export interface StorageOptions {
  /** Maximum items to store (default: 50) */
  maxItems?: number
  /** Logger component name */
  component?: string
  /** Enable logging (default: true) */
  enableLogging?: boolean
}

export interface TimestampedItem {
  id?: string
  timestamp?: Date | string
  [key: string]: unknown
}

/**
 * Generic localStorage manager with scoping, pending queue, and automatic serialization.
 *
 * @example
 * const storage = new LocalStorageManager<Message>('midas_chat', { maxItems: 50 })
 * storage.save(messages, scopeId)
 * const loaded = storage.load(scopeId)
 */
export class LocalStorageManager<T extends TimestampedItem> {
  private baseKey: string
  private pendingKey: string
  private maxItems: number
  private component: string
  private enableLogging: boolean

  constructor(baseKey: string, options?: StorageOptions) {
    this.baseKey = baseKey
    this.pendingKey = `${baseKey}_pending`
    this.maxItems = options?.maxItems ?? 50
    this.component = options?.component ?? 'LocalStorageManager'
    this.enableLogging = options?.enableLogging ?? true
  }

  /**
   * Save data to localStorage with optional scope
   */
  save(data: T[], scopeId?: string | null): void {
    try {
      const key = this.getKey(scopeId)
      const itemsToStore = data.slice(-this.maxItems).map((item) => this.serializeItem(item))
      localStorage.setItem(key, JSON.stringify(itemsToStore))

      this.log('debug', 'Saved data to localStorage', { count: itemsToStore.length, scopeId })
    } catch (e) {
      this.log('warn', 'Failed to save to localStorage', { error: e })
    }
  }

  /**
   * Load data from localStorage with optional scope
   */
  load(scopeId?: string | null): T[] {
    try {
      const key = this.getKey(scopeId)
      const stored = localStorage.getItem(key)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      const items = parsed.map((item: unknown) => this.deserializeItem(item))

      this.log('debug', 'Loaded data from localStorage', { count: items.length, scopeId })
      return items
    } catch (e) {
      this.log('warn', 'Failed to load from localStorage', { error: e })
      return []
    }
  }

  /**
   * Save a single item to the pending queue
   */
  savePending(item: T, scopeId?: string | null): void {
    try {
      const key = this.getPendingKey(scopeId)
      const stored = localStorage.getItem(key)
      const pending = stored ? JSON.parse(stored) : []

      pending.push(this.serializeItem(item))
      localStorage.setItem(key, JSON.stringify(pending))

      this.log('debug', 'Saved pending item', { itemId: item.id, scopeId })
    } catch (e) {
      this.log('warn', 'Failed to save pending item', { error: e })
    }
  }

  /**
   * Remove a specific item from pending queue by ID
   */
  clearPending(itemId: string, scopeId?: string | null): void {
    try {
      const key = this.getPendingKey(scopeId)
      const stored = localStorage.getItem(key)
      if (!stored) return

      const pending = JSON.parse(stored)
      const filtered = pending.filter((item: { id?: string }) => item.id !== itemId)
      localStorage.setItem(key, JSON.stringify(filtered))

      this.log('debug', 'Cleared pending item', { itemId, scopeId })
    } catch (e) {
      this.log('warn', 'Failed to clear pending item', { error: e })
    }
  }

  /**
   * Get all pending items
   */
  getPending(scopeId?: string | null): T[] {
    try {
      const key = this.getPendingKey(scopeId)
      const stored = localStorage.getItem(key)
      if (!stored) return []

      const pending = JSON.parse(stored)
      const items = pending.map((item: unknown) => this.deserializeItem(item))

      this.log('debug', 'Retrieved pending items', { count: items.length, scopeId })
      return items
    } catch (e) {
      this.log('warn', 'Failed to get pending items', { error: e })
      return []
    }
  }

  /**
   * Clear all data for a scope
   */
  clear(scopeId?: string | null): void {
    try {
      localStorage.removeItem(this.getKey(scopeId))
      localStorage.removeItem(this.getPendingKey(scopeId))
      this.log('debug', 'Cleared localStorage', { scopeId })
    } catch (e) {
      this.log('warn', 'Failed to clear localStorage', { error: e })
    }
  }

  private getKey(scopeId?: string | null): string {
    return scopeId ? `${this.baseKey}_${scopeId}` : this.baseKey
  }

  private getPendingKey(scopeId?: string | null): string {
    return scopeId ? `${this.pendingKey}_${scopeId}` : this.pendingKey
  }

  private serializeItem(item: T): unknown {
    return {
      ...item,
      timestamp:
        item.timestamp && typeof (item.timestamp as Date).toISOString === 'function'
          ? (item.timestamp as Date).toISOString()
          : item.timestamp,
    }
  }

  private deserializeItem(item: unknown): T {
    const obj = item as Record<string, unknown>
    return {
      ...obj,
      timestamp: obj.timestamp ? new Date(obj.timestamp as string) : undefined,
    } as T
  }

  private log(level: 'debug' | 'warn', message: string, meta?: Record<string, unknown>): void {
    if (!this.enableLogging) return

    const logMeta = { ...meta, component: this.component }

    if (level === 'debug') {
      logger.debug(message, logMeta)
    } else {
      logger.warn(message, logMeta)
    }
  }
}
