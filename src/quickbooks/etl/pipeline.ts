/**
 * QuickBooks ETL Pipeline
 * Orchestrates extract, transform, and load operations
 */

import type { QBEntityType, QBRawEntity } from '../types/entities'
import type { NormalizedEntityMap } from '../types/normalized'
import type { QBWebhookEvent } from '../types/events'
import type { TokenManager } from '../auth/token-manager'
import type { QueryOptions } from '../client/client'
import { QuickBooksClient } from '../client/client'
import { getHandler, isSupported, getSupportedEntityTypes } from './registry'
import type { Loader, BulkResult } from './loader'
import { getOrganizationByRealmId } from '../../lib/db/organizations'

/**
 * ETL pipeline configuration
 */
export interface ETLPipelineConfig {
  tokenManager: TokenManager
  loader: Loader
  batchSize?: number
}

/**
 * Sync result for a single entity type
 */
export interface SyncResult {
  entityType: QBEntityType
  processed: number
  failed: number
  errors: Array<{ entityId: string; error: string }>
}

/**
 * Full sync result
 */
export interface FullSyncResult {
  results: SyncResult[]
  totalProcessed: number
  totalFailed: number
}

/**
 * ETL Pipeline for QuickBooks data
 */
export class ETLPipeline {
  private tokenManager: TokenManager
  private loader: Loader
  private batchSize: number
  private clients = new Map<string, { client: QuickBooksClient; lastUsed: number }>()
  private static readonly MAX_CACHED_CLIENTS = 50
  private static readonly CLIENT_TTL_MS = 30 * 60 * 1000 // 30 minutes

  constructor(config: ETLPipelineConfig) {
    this.tokenManager = config.tokenManager
    this.loader = config.loader
    this.batchSize = config.batchSize ?? 100
  }

  /**
   * Handle a webhook change event (Create/Update/Merge/Void)
   */
  async handleChange(event: QBWebhookEvent): Promise<void> {
    const { entityType, entityId, realmId } = event

    if (!isSupported(entityType)) {
      console.warn(`Unsupported entity type: ${entityType}`)
      return
    }

    const handler = getHandler(entityType)
    if (!handler) {
      console.warn(`No handler for entity type: ${entityType}`)
      return
    }

    // Get organization ID from realm ID (you may need to map this in your app)
    const organizationId = await this.getOrganizationIdFromRealm(realmId)
    const client = await this.getClient(organizationId)

    // Fetch and transform
    const normalized = await handler.fetchAndTransform(client, entityId)

    // Load
    await this.loader.upsert(organizationId, entityType, normalized)
  }

  /**
   * Handle a webhook delete event
   */
  async handleDelete(event: QBWebhookEvent): Promise<void> {
    const { entityType, entityId, realmId } = event

    if (!isSupported(entityType)) {
      console.warn(`Unsupported entity type: ${entityType}`)
      return
    }

    const organizationId = await this.getOrganizationIdFromRealm(realmId)
    await this.loader.delete(organizationId, entityType, entityId)
  }

  /**
   * Sync a single entity type for an organization
   */
  async syncEntityType<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    options?: {
      since?: Date
      where?: string
    }
  ): Promise<SyncResult> {
    const handler = getHandler(entityType)
    if (!handler) {
      throw new Error(`No handler for entity type: ${entityType}`)
    }

    const client = await this.getClient(organizationId)
    const result: SyncResult = {
      entityType,
      processed: 0,
      failed: 0,
      errors: [],
    }

    let offset = 0
    let hasMore = true

    while (hasMore) {
      // Build query options
      // Note: QuickBooks doesn't support ASC/DESC, default is ascending
      const queryOptions: QueryOptions = {
        limit: this.batchSize,
        offset,
        orderBy: 'MetaData.LastUpdatedTime',
      }

      // Add where clause
      const whereClauses: string[] = []
      if (options?.since) {
        whereClauses.push(`MetaData.LastUpdatedTime > '${options.since.toISOString()}'`)
      }
      if (options?.where) {
        whereClauses.push(options.where)
      }
      if (whereClauses.length > 0) {
        queryOptions.where = whereClauses.join(' AND ')
      }

      // Fetch batch
      const raws = await handler.query(client, queryOptions)

      if (raws.length === 0) {
        hasMore = false
        continue
      }

      // Transform and load each entity
      const batch: NormalizedEntityMap[T][] = []
      for (const raw of raws) {
        try {
          const normalized = handler.transform(raw)
          batch.push(normalized)
        } catch (error) {
          result.failed++
          result.errors.push({
            entityId: (raw as { Id?: string }).Id ?? 'unknown',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Bulk load
      if (batch.length > 0) {
        const bulkResult = await this.loader.bulkUpsert(organizationId, entityType, batch)
        result.processed += bulkResult.success
        result.failed += bulkResult.failed
        if (bulkResult.errors) {
          result.errors.push(...bulkResult.errors)
        }
      }

      // Check if we have more
      if (raws.length < this.batchSize) {
        hasMore = false
      } else {
        offset += this.batchSize
      }
    }

    return result
  }

  /**
   * Full sync of all entity types for an organization
   */
  async fullSync(
    organizationId: string,
    options?: {
      entityTypes?: QBEntityType[]
      since?: Date
    }
  ): Promise<FullSyncResult> {
    const entityTypes = options?.entityTypes ?? getSupportedEntityTypes()
    const results: SyncResult[] = []
    let totalProcessed = 0
    let totalFailed = 0

    for (const entityType of entityTypes) {
      try {
        const result = await this.syncEntityType(organizationId, entityType, {
          since: options?.since,
        })
        results.push(result)
        totalProcessed += result.processed
        totalFailed += result.failed
      } catch (error) {
        results.push({
          entityType,
          processed: 0,
          failed: 1,
          errors: [
            {
              entityId: 'sync',
              error: error instanceof Error ? error.message : String(error),
            },
          ],
        })
        totalFailed++
      }
    }

    return {
      results,
      totalProcessed,
      totalFailed,
    }
  }

  /**
   * Fetch and transform a single entity (without loading)
   */
  async extract<T extends QBEntityType>(
    organizationId: string,
    entityType: T,
    entityId: string
  ): Promise<NormalizedEntityMap[T]> {
    const handler = getHandler(entityType)
    if (!handler) {
      throw new Error(`No handler for entity type: ${entityType}`)
    }

    const client = await this.getClient(organizationId)
    return handler.fetchAndTransform(client, entityId)
  }

  /**
   * Get or create a client for an organization with LRU eviction
   */
  private async getClient(organizationId: string): Promise<QuickBooksClient> {
    const now = Date.now()
    const cached = this.clients.get(organizationId)

    if (cached) {
      cached.lastUsed = now
      return cached.client
    }

    // Evict stale and overflow entries before adding new client
    this.evictStaleClients()

    // Note: The legacy QuickBooksClient handles tokens internally via DB lookup.
    // The tokenManager in ETLPipelineConfig is for future migration to the new architecture.
    const client = new QuickBooksClient({
      organizationId,
    })

    this.clients.set(organizationId, { client, lastUsed: now })
    return client
  }

  /**
   * Evict stale and overflow clients from cache
   */
  private evictStaleClients(): void {
    const now = Date.now()

    // Remove expired entries
    for (const [orgId, { lastUsed }] of this.clients) {
      if (now - lastUsed > ETLPipeline.CLIENT_TTL_MS) {
        this.clients.delete(orgId)
      }
    }

    // If still over limit, remove oldest entries
    while (this.clients.size >= ETLPipeline.MAX_CACHED_CLIENTS) {
      let oldest: [string, { lastUsed: number }] | null = null
      for (const entry of this.clients) {
        if (!oldest || entry[1].lastUsed < oldest[1].lastUsed) {
          oldest = entry as [string, { lastUsed: number }]
        }
      }
      if (oldest) {
        this.clients.delete(oldest[0])
      } else {
        break
      }
    }
  }

  /**
   * Map realm ID to organization ID
   * Looks up organization by QuickBooks realm_id in the database
   */
  protected async getOrganizationIdFromRealm(realmId: string): Promise<string> {
    // Look up organization by realm ID
    const org = await getOrganizationByRealmId(realmId)

    if (!org) {
      // In development, fall back to using realm ID as organization ID for easier testing
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[ETLPipeline] No organization found for realm ${realmId}. ` +
            'Falling back to realmId as organizationId (development mode only).'
        )
        return realmId
      }

      // In production, throw error if no mapping found
      throw new Error(
        `No organization found for QuickBooks realm ${realmId}. ` +
          'Ensure the organization is properly connected to QuickBooks.'
      )
    }

    // Return the organization ID (PK format: ORG#<uuid>)
    return org.PK
  }

  /**
   * Clear cached clients (useful for testing)
   */
  clearClients(): void {
    this.clients.clear()
  }
}

/**
 * Create an ETL pipeline
 */
export function createPipeline(config: ETLPipelineConfig): ETLPipeline {
  return new ETLPipeline(config)
}
