/**
 * QuickBooks Webhook Event Types
 */

export type QBOperation = 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void'

// Entities that support webhook notifications
export type QBWebhookEntityType =
  | 'Account'
  | 'Bill'
  | 'BillPayment'
  | 'Budget'
  | 'Class'
  | 'CreditMemo'
  | 'Customer'
  | 'Department'
  | 'Deposit'
  | 'Employee'
  | 'Estimate'
  | 'Invoice'
  | 'Item'
  | 'JournalEntry'
  | 'Payment'
  | 'PaymentMethod'
  | 'Preferences'
  | 'Purchase'
  | 'PurchaseOrder'
  | 'RefundReceipt'
  | 'SalesReceipt'
  | 'TaxAgency'
  | 'TaxCode'
  | 'TaxRate'
  | 'Term'
  | 'TimeActivity'
  | 'Transfer'
  | 'Vendor'
  | 'VendorCredit'

// Individual entity change notification
export interface QBEntityChange {
  name: string
  id: string
  operation: QBOperation
  lastUpdated: string
}

// Data change event containing multiple entity changes
export interface QBDataChangeEvent {
  entities: QBEntityChange[]
}

// Single event notification for a realm
export interface QBEventNotification {
  realmId: string
  dataChangeEvent: QBDataChangeEvent
}

// Complete webhook payload from QuickBooks
export interface QBWebhookPayload {
  eventNotifications: QBEventNotification[]
}

// Parsed webhook event for internal processing
export interface QBWebhookEvent {
  realmId: string
  entityType: QBWebhookEntityType
  entityId: string
  operation: QBOperation
  lastUpdated: string
}

// ============================================================================
// CDC (Change Data Capture) Event Types - For SSE Notifications
// ============================================================================

/**
 * CDC change action types (normalized from QB operations)
 */
export type QBCDCAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'MERGE' | 'VOID'

/**
 * Map QB operation to CDC action
 */
export function operationToCDCAction(operation: QBOperation): QBCDCAction {
  const mapping: Record<QBOperation, QBCDCAction> = {
    Create: 'CREATE',
    Update: 'UPDATE',
    Delete: 'DELETE',
    Merge: 'MERGE',
    Void: 'VOID',
  }
  return mapping[operation]
}

/**
 * CDC change event - emitted when QuickBooks data changes
 * Contains only metadata, no financial data
 */
export interface QBCDCChangeEvent {
  id: string // Unique event ID (e.g., "evt_abc123")
  timestamp: string // ISO timestamp
  action: QBCDCAction
  entityType: QBWebhookEntityType
  entityId: string
  realmId: string
  organizationId: string // Resolved org ID
}

/**
 * CDC heartbeat event - keeps SSE connection alive
 */
export interface QBCDCHeartbeatEvent {
  timestamp: string
}

/**
 * CDC connection event - sent when SSE connects
 */
export interface QBCDCConnectedEvent {
  realmId: string
  companyName: string
  timestamp: string
}

/**
 * CDC disconnection event
 */
export interface QBCDCDisconnectedEvent {
  reason: string
  timestamp: string
}

/**
 * CDC error event
 */
export interface QBCDCErrorEvent {
  code: string
  message: string
  timestamp: string
}

/**
 * Union type for all SSE event types
 */
export type QBSSEEventType =
  | 'qb:change'
  | 'qb:heartbeat'
  | 'qb:connected'
  | 'qb:disconnected'
  | 'qb:error'

/**
 * SSE event wrapper with type discriminator
 */
export type QBSSEEvent =
  | { type: 'qb:change'; data: QBCDCChangeEvent }
  | { type: 'qb:heartbeat'; data: QBCDCHeartbeatEvent }
  | { type: 'qb:connected'; data: QBCDCConnectedEvent }
  | { type: 'qb:disconnected'; data: QBCDCDisconnectedEvent }
  | { type: 'qb:error'; data: QBCDCErrorEvent }

/**
 * Sync cursor for incremental data fetching
 */
export interface QBSyncCursor {
  entityType: QBWebhookEntityType
  lastSyncTime: string // ISO timestamp
  lastEntityId?: string // For pagination within same timestamp
}

/**
 * Sync cursors map for an organization
 */
export type QBSyncCursors = Partial<Record<QBWebhookEntityType, string>>
