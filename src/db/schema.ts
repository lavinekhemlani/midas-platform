import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  integer,
  jsonb,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core'

// ============================================
// ENUMS
// ============================================

export const memberStatus = pgEnum('member_status', ['pending', 'active', 'suspended'])
export const connectionStatus = pgEnum('connection_status', [
  'active',
  'expired',
  'revoked',
  'error',
])
export const invoiceStatus = pgEnum('invoice_status', [
  'draft',
  'pending',
  'sent',
  'partial',
  'paid',
  'overdue',
  'voided',
])
export const billStatus = pgEnum('bill_status', ['unpaid', 'partial', 'paid', 'overdue'])
export const syncStatus = pgEnum('sync_status', ['idle', 'running', 'failed', 'paused'])
export const jobStatus = pgEnum('job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
])

// ============================================
// CORE: Users & Organizations
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  permissions: jsonb('permissions').default([]).notNull(),
})

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id),
    status: memberStatus('status').default('active').notNull(),
    joinedAt: timestamp('joined_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueMember: unique().on(t.organizationId, t.userId),
    orgIdx: index('idx_org_members_org').on(t.organizationId),
    userIdx: index('idx_org_members_user').on(t.userId),
  })
)

// ============================================
// PROVIDERS: QuickBooks Connection
// ============================================

export const providerConnections = pgTable(
  'provider_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull().default('quickbooks'),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at').notNull(),
    realmId: text('realm_id'),
    connectionStatus: connectionStatus('connection_status').default('active').notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueProvider: unique().on(t.organizationId, t.providerId),
  })
)

// ============================================
// QUICKBOOKS: Financial Entities
// ============================================

export const qbCustomers = pgTable(
  'qb_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    displayName: text('display_name').notNull(),
    companyName: text('company_name'),
    email: text('email'),
    phone: text('phone'),
    balance: numeric('balance', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_customers_org').on(t.organizationId),
  })
)

export const qbVendors = pgTable(
  'qb_vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    displayName: text('display_name').notNull(),
    companyName: text('company_name'),
    email: text('email'),
    phone: text('phone'),
    balance: numeric('balance', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_vendors_org').on(t.organizationId),
  })
)

export const qbAccounts = pgTable(
  'qb_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    name: text('name').notNull(),
    accountType: text('account_type').notNull(),
    accountSubType: text('account_sub_type'),
    currentBalance: numeric('current_balance', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_accounts_org').on(t.organizationId),
  })
)

export const qbItems = pgTable(
  'qb_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    name: text('name').notNull(),
    sku: text('sku'),
    itemType: text('item_type').notNull(),
    unitPrice: numeric('unit_price', { precision: 19, scale: 4 }).default('0'),
    purchaseCost: numeric('purchase_cost', { precision: 19, scale: 4 }).default('0'),
    quantityOnHand: numeric('quantity_on_hand', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_items_org').on(t.organizationId),
  })
)

// ============================================
// QUICKBOOKS: Transactions
// ============================================

export const qbInvoices = pgTable(
  'qb_invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    docNumber: text('doc_number'),
    txnDate: date('txn_date').notNull(),
    dueDate: date('due_date'),
    customerId: uuid('customer_id').references(() => qbCustomers.id),
    customerName: text('customer_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    balance: numeric('balance', { precision: 19, scale: 4 }).notNull(),
    status: invoiceStatus('status').notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_invoices_org').on(t.organizationId),
    statusIdx: index('idx_qb_invoices_status').on(t.organizationId, t.status),
    dateIdx: index('idx_qb_invoices_date').on(t.organizationId, t.txnDate),
  })
)

export const qbBills = pgTable(
  'qb_bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    docNumber: text('doc_number'),
    txnDate: date('txn_date').notNull(),
    dueDate: date('due_date'),
    vendorId: uuid('vendor_id').references(() => qbVendors.id),
    vendorName: text('vendor_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    balance: numeric('balance', { precision: 19, scale: 4 }).notNull(),
    status: billStatus('status').notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_bills_org').on(t.organizationId),
    statusIdx: index('idx_qb_bills_status').on(t.organizationId, t.status),
  })
)

export const qbPayments = pgTable(
  'qb_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    txnDate: date('txn_date').notNull(),
    customerId: uuid('customer_id').references(() => qbCustomers.id),
    customerName: text('customer_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueQbId: unique().on(t.organizationId, t.qbId),
    orgIdx: index('idx_qb_payments_org').on(t.organizationId),
  })
)

// Generic table for other QB entity types (Estimate, CreditMemo, etc.)
export const qbEntities = pgTable(
  'qb_entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueEntity: unique().on(t.organizationId, t.entityType, t.qbId),
    orgTypeIdx: index('idx_qb_entities_org_type').on(t.organizationId, t.entityType),
  })
)

// ============================================
// SYNC: CDC Tracking
// ============================================

export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    lastSyncTime: timestamp('last_sync_time').defaultNow().notNull(),
    syncStatus: syncStatus('sync_status').default('idle').notNull(),
    recordsSynced: integer('records_synced').default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqueCursor: unique().on(t.organizationId, t.entityType),
  })
)

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    jobType: text('job_type').notNull(),
    status: jobStatus('status').default('pending').notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    recordsProcessed: integer('records_processed').default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('idx_sync_jobs_org').on(t.organizationId),
    statusIdx: index('idx_sync_jobs_status').on(t.status),
  })
)

// ============================================
// AUDIT: Simple audit log
// ============================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    changes: jsonb('changes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('idx_audit_org').on(t.organizationId, t.createdAt),
  })
)

// ============================================
// TYPE EXPORTS
// ============================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type OrganizationMember = typeof organizationMembers.$inferSelect
export type ProviderConnection = typeof providerConnections.$inferSelect
export type QbCustomer = typeof qbCustomers.$inferSelect
export type NewQbCustomer = typeof qbCustomers.$inferInsert
export type QbVendor = typeof qbVendors.$inferSelect
export type NewQbVendor = typeof qbVendors.$inferInsert
export type QbAccount = typeof qbAccounts.$inferSelect
export type QbItem = typeof qbItems.$inferSelect
export type QbInvoice = typeof qbInvoices.$inferSelect
export type NewQbInvoice = typeof qbInvoices.$inferInsert
export type QbBill = typeof qbBills.$inferSelect
export type NewQbBill = typeof qbBills.$inferInsert
export type QbPayment = typeof qbPayments.$inferSelect
export type QbEntity = typeof qbEntities.$inferSelect
export type SyncCursor = typeof syncCursors.$inferSelect
export type SyncJob = typeof syncJobs.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
