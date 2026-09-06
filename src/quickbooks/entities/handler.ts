/**
 * QuickBooks Entity Handler
 * Generic entity handler factory for all QuickBooks entity types
 */

import type { QBEntityType, QBRawEntity } from '../types/entities'
import type { NormalizedEntity, NormalizedEntityMap } from '../types/normalized'
import type { QuickBooksClient, QueryOptions } from '../client/client'

/**
 * Transformer function type
 */
export type EntityTransformer<T extends QBEntityType> = (
  raw: QBRawEntity<T>
) => NormalizedEntityMap[T]

/**
 * Entity handler interface
 */
export interface EntityHandler<T extends QBEntityType> {
  readonly entityType: T

  /**
   * Fetch a single entity by ID
   */
  fetch(client: QuickBooksClient, id: string): Promise<QBRawEntity<T>>

  /**
   * Query entities with options
   */
  query(client: QuickBooksClient, options?: QueryOptions): Promise<QBRawEntity<T>[]>

  /**
   * Transform raw entity to normalized format
   */
  transform(raw: QBRawEntity<T>): NormalizedEntityMap[T]

  /**
   * Fetch and transform a single entity
   */
  fetchAndTransform(client: QuickBooksClient, id: string): Promise<NormalizedEntityMap[T]>

  /**
   * Query and transform entities
   */
  queryAndTransform(
    client: QuickBooksClient,
    options?: QueryOptions
  ): Promise<NormalizedEntityMap[T][]>
}

/**
 * Create an entity handler with a transformer function
 */
export function createEntityHandler<T extends QBEntityType>(
  entityType: T,
  transformer: EntityTransformer<T>
): EntityHandler<T> {
  return {
    entityType,

    async fetch(client: QuickBooksClient, id: string): Promise<QBRawEntity<T>> {
      return client.get<T>(entityType, id)
    },

    async query(client: QuickBooksClient, options?: QueryOptions): Promise<QBRawEntity<T>[]> {
      return client.queryEntities<T>(entityType, options)
    },

    transform(raw: QBRawEntity<T>): NormalizedEntityMap[T] {
      return transformer(raw)
    },

    async fetchAndTransform(client: QuickBooksClient, id: string): Promise<NormalizedEntityMap[T]> {
      const raw = await this.fetch(client, id)
      return this.transform(raw)
    },

    async queryAndTransform(
      client: QuickBooksClient,
      options?: QueryOptions
    ): Promise<NormalizedEntityMap[T][]> {
      const raws = await this.query(client, options)
      return raws.map((raw) => this.transform(raw))
    },
  }
}

/**
 * Handler registry type
 */
export type HandlerRegistry = {
  [K in QBEntityType]?: EntityHandler<K>
}
