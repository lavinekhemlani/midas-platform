/**
 * QuickBooks Integration Module
 *
 * A fresh, clean implementation of QuickBooks ETL using:
 * - Webhooks for real-time push notifications
 * - Direct REST API for data fetching
 * - intuit-oauth for token management
 *
 * @example
 * ```typescript
 * import { QuickBooksClient, ETLPipeline, WebhookHandler } from '@/quickbooks';
 *
 * // Create a client for an organization
 * const client = new QuickBooksClient({
 *   organizationId: 'org-123',
 *   tokenManager,
 * });
 *
 * // Fetch invoices
 * const invoices = await client.query('Invoice', { limit: 100 });
 * ```
 */

// ============================================================================
// Types - Re-export all types
// ============================================================================

export * from './types'

// ============================================================================
// Errors - Re-export all error classes
// ============================================================================

export * from './errors'

// ============================================================================
// Auth - OAuth and token management
// ============================================================================

export { QuickBooksOAuth, getOAuthConfig } from './auth/oauth'
export type { QBToken, QBOAuthConfig } from './auth/oauth'

export { TokenManager, InMemoryTokenStore, InMemoryLock } from './auth/token-manager'
export { DynamoDBTokenStore } from './auth/dynamodb-token-store'
export type { TokenStore, DistributedLock, TokenManagerConfig } from './auth/token-manager'

// ============================================================================
// Client - API client and rate limiting
// ============================================================================

export { QuickBooksClient, createClient } from './client/client'
export type { QBClientConfig, QueryOptions } from './client/client'

export { RateLimiter, getGlobalRateLimiter, resetGlobalRateLimiter } from './client/rate-limiter'
export type { RateLimiterConfig } from './client/rate-limiter'

// ============================================================================
// Entities - Entity handlers and transformers
// ============================================================================

export { createEntityHandler } from './entities/handler'
export type { EntityHandler, EntityTransformer, HandlerRegistry } from './entities/handler'

// Re-export individual transformers for custom use
export * from './entities/transformers'

// ============================================================================
// ETL - Pipeline, loaders, and registry
// ============================================================================

export { ETLPipeline, createPipeline } from './etl/pipeline'
export type { ETLPipelineConfig, SyncResult, FullSyncResult } from './etl/pipeline'

export { NoOpLoader, EventEmitterLoader, InMemoryLoader } from './etl/loader'
export { SupabaseLoader } from './etl/supabase-loader'
export type {
  Loader,
  BulkResult,
  LoaderEvent,
  LoaderEventType,
  LoaderEventHandler,
} from './etl/loader'

export {
  getHandler,
  isSupported,
  getSupportedEntityTypes,
  getHandlersByCategory,
} from './etl/registry'

// ============================================================================
// Webhook - Webhook handling
// ============================================================================

export { WebhookHandler, createWebhookHandler } from './webhook/handler'
export type { WebhookHandlerConfig, WebhookResult } from './webhook/handler'

export { verifyWebhookSignature, createWebhookSignature } from './webhook/signature'

// ============================================================================
// CDC - Change Data Capture (Polling-based, no Redis required)
// ============================================================================

export { getChangeTimestamps, updateChangeTimestamp, updateChangeTimestamps } from './cdc'
export type { ChangeTimestamps } from './cdc'

// ============================================================================
// Reports - Financial reports API
// ============================================================================

export { ReportFetcher, createReportFetcher } from './reports'
export type { ReportFetcherConfig, FetchReportOptions } from './reports'

export {
  transformProfitAndLoss,
  transformBalanceSheet,
  transformCashFlow,
  transformAgedReport,
  transformTrialBalance,
} from './reports'

// ============================================================================
// OpenAPI Spec - For API documentation
// ============================================================================

export { quickbooksOpenApiSpec } from './openapi'

// ============================================================================
// Singleton Instances - Convenience factories for common use cases
// ============================================================================

import { QuickBooksOAuth } from './auth/oauth'
import { TokenManager } from './auth/token-manager'
import { DynamoDBTokenStore } from './auth/dynamodb-token-store'
import { ETLPipeline } from './etl/pipeline'
import { NoOpLoader } from './etl/loader'
import { SupabaseLoader } from './etl/supabase-loader'
import { WebhookHandler } from './webhook/handler'

// Singleton instances
let _oauth: QuickBooksOAuth | null = null
let _tokenManager: TokenManager | null = null
let _pipeline: ETLPipeline | null = null
let _webhookHandler: WebhookHandler | null = null

/**
 * Get or create the OAuth client singleton
 */
export function getOAuth(): QuickBooksOAuth {
  if (!_oauth) {
    _oauth = new QuickBooksOAuth()
  }
  return _oauth
}

/**
 * Get or create the token manager singleton
 *
 * Uses DynamoDBTokenStore by default to read tokens from the existing
 * organization.providers.quickbooks.credentials structure.
 */
export function getTokenManager(): TokenManager {
  if (!_tokenManager) {
    // Use DynamoDB-backed store that reads from existing token structure
    const store = new DynamoDBTokenStore()
    _tokenManager = new TokenManager({
      oauth: getOAuth(),
      store,
    })
  }
  return _tokenManager
}

/**
 * Set a custom token manager
 * Use this to provide your own TokenStore implementation
 */
export function setTokenManager(tokenManager: TokenManager): void {
  _tokenManager = tokenManager
}

/**
 * Get or create the ETL pipeline singleton
 *
 * Uses SupabaseLoader for production data persistence via Drizzle ORM.
 * Set USE_NOOP_LOADER=true environment variable to use NoOpLoader for development.
 */
export function getPipeline(): ETLPipeline {
  if (!_pipeline) {
    // Use SupabaseLoader for production, NoOpLoader for development/testing
    const useNoOpLoader = process.env.USE_NOOP_LOADER === 'true'
    const loader = useNoOpLoader ? new NoOpLoader({ debug: true }) : new SupabaseLoader()

    if (process.env.NODE_ENV === 'development') {
      console.log(`[QuickBooks ETL] Using ${useNoOpLoader ? 'NoOpLoader' : 'SupabaseLoader'}`)
    }

    _pipeline = new ETLPipeline({
      tokenManager: getTokenManager(),
      loader,
    })
  }
  return _pipeline
}

/**
 * Set a custom ETL pipeline
 * Use this to provide your own Loader implementation
 */
export function setPipeline(pipeline: ETLPipeline): void {
  _pipeline = pipeline
}

/**
 * Get or create the webhook handler singleton
 */
export function getWebhookHandler(): WebhookHandler {
  if (!_webhookHandler) {
    const webhookVerifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN

    if (!webhookVerifierToken) {
      throw new Error('QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN environment variable is required')
    }

    _webhookHandler = new WebhookHandler({
      webhookVerifierToken,
      pipeline: getPipeline(),
      onError: (event, error) => {
        console.error('[QuickBooks Webhook] Event processing failed:', {
          event,
          error: error.message,
        })
      },
    })
  }
  return _webhookHandler
}

/**
 * Set a custom webhook handler
 */
export function setWebhookHandler(handler: WebhookHandler): void {
  _webhookHandler = handler
}

/**
 * Reset all singleton instances (useful for testing)
 */
export function resetSingletons(): void {
  _oauth = null
  _tokenManager = null
  _pipeline = null
  _webhookHandler = null
}
