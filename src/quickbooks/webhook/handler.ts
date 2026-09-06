/**
 * QuickBooks Webhook Handler
 * Processes incoming webhook notifications from QuickBooks
 */

import type {
  QBWebhookPayload,
  QBWebhookEvent,
  QBWebhookEntityType,
  QBOperation,
} from '../types/events'
import type { ETLPipeline } from '../etl/pipeline'
import { QBWebhookError } from '../errors'
import { verifyWebhookSignature } from './signature'

/**
 * Webhook handler configuration
 */
export interface WebhookHandlerConfig {
  /**
   * Webhook verifier token from QuickBooks developer portal
   */
  webhookVerifierToken: string

  /**
   * ETL pipeline for processing events
   */
  pipeline: ETLPipeline

  /**
   * Optional: Skip signature verification (for testing only)
   */
  skipSignatureVerification?: boolean

  /**
   * Optional: Custom error handler
   */
  onError?: (event: QBWebhookEvent, error: Error) => void
}

/**
 * Result of webhook processing
 */
export interface WebhookResult {
  processed: number
  failed: number
  events: Array<{
    entityType: string
    entityId: string
    operation: string
    success: boolean
    error?: string
  }>
}

/**
 * Webhook handler for processing QuickBooks webhook notifications
 */
export class WebhookHandler {
  private config: WebhookHandlerConfig

  constructor(config: WebhookHandlerConfig) {
    this.config = config
  }

  /**
   * Handle an incoming webhook request
   *
   * @param payload - Raw request body as string
   * @param signature - Value of intuit-signature header
   * @returns Processing result
   */
  async handle(payload: string, signature: string): Promise<WebhookResult> {
    // Verify signature
    if (!this.config.skipSignatureVerification) {
      if (!signature) {
        throw new QBWebhookError('INVALID_SIGNATURE', 'Missing intuit-signature header')
      }

      const isValid = verifyWebhookSignature(payload, signature, this.config.webhookVerifierToken)

      if (!isValid) {
        throw new QBWebhookError('INVALID_SIGNATURE', 'Webhook signature verification failed')
      }
    }

    // Parse payload
    let data: QBWebhookPayload
    try {
      data = JSON.parse(payload)
    } catch {
      throw new QBWebhookError('INVALID_PAYLOAD', 'Failed to parse webhook payload as JSON')
    }

    // Validate payload structure
    if (!data.eventNotifications || !Array.isArray(data.eventNotifications)) {
      throw new QBWebhookError('INVALID_PAYLOAD', 'Invalid webhook payload structure')
    }

    // Process events
    const result: WebhookResult = {
      processed: 0,
      failed: 0,
      events: [],
    }

    for (const notification of data.eventNotifications) {
      const realmId = notification.realmId

      if (!notification.dataChangeEvent?.entities) {
        continue
      }

      for (const entity of notification.dataChangeEvent.entities) {
        const event: QBWebhookEvent = {
          realmId,
          entityType: entity.name as QBWebhookEntityType,
          entityId: entity.id,
          operation: entity.operation as QBOperation,
          lastUpdated: entity.lastUpdated,
        }

        const eventResult = await this.processEvent(event)
        result.events.push(eventResult)

        if (eventResult.success) {
          result.processed++
        } else {
          result.failed++
        }
      }
    }

    return result
  }

  /**
   * Process a single webhook event
   */
  private async processEvent(event: QBWebhookEvent): Promise<{
    entityType: string
    entityId: string
    operation: string
    success: boolean
    error?: string
  }> {
    try {
      if (event.operation === 'Delete') {
        await this.config.pipeline.handleDelete(event)
      } else {
        // Create, Update, Merge, Void all fetch and update the entity
        await this.config.pipeline.handleChange(event)
      }

      return {
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Call error handler if provided
      if (this.config.onError) {
        this.config.onError(event, error instanceof Error ? error : new Error(errorMessage))
      }

      return {
        entityType: event.entityType,
        entityId: event.entityId,
        operation: event.operation,
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Parse events from a webhook payload without processing
   * Useful for inspection/debugging
   */
  parseEvents(payload: string): QBWebhookEvent[] {
    const data: QBWebhookPayload = JSON.parse(payload)
    const events: QBWebhookEvent[] = []

    for (const notification of data.eventNotifications) {
      for (const entity of notification.dataChangeEvent.entities) {
        events.push({
          realmId: notification.realmId,
          entityType: entity.name as QBWebhookEntityType,
          entityId: entity.id,
          operation: entity.operation as QBOperation,
          lastUpdated: entity.lastUpdated,
        })
      }
    }

    return events
  }
}

/**
 * Create a webhook handler
 */
export function createWebhookHandler(config: WebhookHandlerConfig): WebhookHandler {
  return new WebhookHandler(config)
}
