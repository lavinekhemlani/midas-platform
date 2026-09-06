/**
 * QuickBooks ETL Loader
 * Interface for loading normalized data to storage backends
 */

import type { QBEntityType } from '../types/entities'
import type { NormalizedEntity, NormalizedEntityMap } from '../types/normalized'

/**
 * Loader interface for ETL pipeline
 * Implement this interface for your storage backend
 */
export interface Loader {
  /**
   * Upsert (insert or update) a normalized entity
   */
  upsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void>

  /**
   * Delete an entity
   */
  delete(organizationId: string, entityType: QBEntityType, entityId: string): Promise<void>

  /**
   * Bulk upsert multiple entities
   */
  bulkUpsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entities: NormalizedEntityMap[T][]
  ): Promise<BulkResult>
}

/**
 * Result of bulk operations
 */
export interface BulkResult {
  success: number
  failed: number
  errors?: Array<{ entityId: string; error: string }>
}

/**
 * Loader event types
 */
export type LoaderEventType = 'upsert' | 'delete' | 'bulk_upsert'

/**
 * Loader event for monitoring
 */
export interface LoaderEvent {
  type: LoaderEventType
  organizationId: string
  entityType: QBEntityType
  entityId?: string
  count?: number
  timestamp: Date
}

/**
 * Event handler function
 */
export type LoaderEventHandler = (event: LoaderEvent) => void

/**
 * No-op loader for development/testing
 * Logs operations but doesn't persist data
 */
export class NoOpLoader implements Loader {
  private debug: boolean

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false
  }

  async upsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    if (this.debug) {
      console.log(`[NoOpLoader] Upsert ${entityType}:`, entity.id)
    }
  }

  async delete(organizationId: string, entityType: QBEntityType, entityId: string): Promise<void> {
    if (this.debug) {
      console.log(`[NoOpLoader] Delete ${entityType}:`, entityId)
    }
  }

  async bulkUpsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entities: NormalizedEntityMap[T][]
  ): Promise<BulkResult> {
    if (this.debug) {
      console.log(`[NoOpLoader] Bulk upsert ${entityType}:`, entities.length, 'entities')
    }
    return { success: entities.length, failed: 0 }
  }
}

/**
 * Event emitter loader wrapper
 * Wraps another loader and emits events for monitoring
 */
export class EventEmitterLoader implements Loader {
  constructor(
    private innerLoader: Loader,
    private onEvent: LoaderEventHandler
  ) {}

  async upsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    await this.innerLoader.upsert(organizationId, entityType, entity)
    this.onEvent({
      type: 'upsert',
      organizationId,
      entityType,
      entityId: entity.id,
      timestamp: new Date(),
    })
  }

  async delete(organizationId: string, entityType: QBEntityType, entityId: string): Promise<void> {
    await this.innerLoader.delete(organizationId, entityType, entityId)
    this.onEvent({
      type: 'delete',
      organizationId,
      entityType,
      entityId,
      timestamp: new Date(),
    })
  }

  async bulkUpsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entities: NormalizedEntityMap[T][]
  ): Promise<BulkResult> {
    const result = await this.innerLoader.bulkUpsert(organizationId, entityType, entities)
    this.onEvent({
      type: 'bulk_upsert',
      organizationId,
      entityType,
      count: entities.length,
      timestamp: new Date(),
    })
    return result
  }
}

/**
 * In-memory loader for testing
 * Stores entities in memory for verification
 */
export class InMemoryLoader implements Loader {
  private storage = new Map<string, Map<string, NormalizedEntity>>()

  private getStore(
    organizationId: string,
    entityType: QBEntityType
  ): Map<string, NormalizedEntity> {
    const key = `${organizationId}:${entityType}`
    if (!this.storage.has(key)) {
      this.storage.set(key, new Map())
    }
    return this.storage.get(key)!
  }

  async upsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entity: NormalizedEntityMap[T]
  ): Promise<void> {
    const store = this.getStore(organizationId, entityType)
    store.set(entity.id, entity)
  }

  async delete(organizationId: string, entityType: QBEntityType, entityId: string): Promise<void> {
    const store = this.getStore(organizationId, entityType)
    store.delete(entityId)
  }

  async bulkUpsert<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entities: NormalizedEntityMap[T][]
  ): Promise<BulkResult> {
    const store = this.getStore(organizationId, entityType)
    for (const entity of entities) {
      store.set(entity.id, entity)
    }
    return { success: entities.length, failed: 0 }
  }

  // Test helpers
  get<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entityId: string
  ): NormalizedEntityMap[T] | undefined {
    const store = this.getStore(organizationId, entityType)
    return store.get(entityId) as NormalizedEntityMap[T] | undefined
  }

  getAll<T extends QBEntityType>(organizationId: string, entityType: T): NormalizedEntityMap[T][] {
    const store = this.getStore(organizationId, entityType)
    return Array.from(store.values()) as NormalizedEntityMap[T][]
  }

  clear(): void {
    this.storage.clear()
  }
}
