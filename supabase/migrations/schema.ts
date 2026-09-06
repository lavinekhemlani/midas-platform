import {
  pgTable,
  index,
  foreignKey,
  unique,
  uuid,
  timestamp,
  text,
  jsonb,
  numeric,
  boolean,
  date,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const billStatus = pgEnum('bill_status', ['unpaid', 'partial', 'paid', 'overdue'])
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
export const jobStatus = pgEnum('job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
])
export const memberStatus = pgEnum('member_status', ['pending', 'active', 'suspended'])
export const syncStatus = pgEnum('sync_status', ['idle', 'running', 'failed', 'paused'])

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
    status: memberStatus().default('active').notNull(),
    joinedAt: timestamp('joined_at', { mode: 'string' }).defaultNow(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_org_members_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_org_members_user').using('btree', table.userId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'organization_members_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'organization_members_role_id_roles_id_fk',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'organization_members_user_id_users_id_fk',
    }).onDelete('cascade'),
    unique('organization_members_organization_id_user_id_unique').on(
      table.organizationId,
      table.userId
    ),
  ]
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id'),
    userId: uuid('user_id'),
    action: text().notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    changes: jsonb(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('timestamp_ops'),
      table.createdAt.asc().nullsLast().op('timestamp_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'audit_logs_organization_id_organizations_id_fk',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'audit_logs_user_id_users_id_fk',
    }),
  ]
)

export const qbAccounts = pgTable(
  'qb_accounts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    name: text().notNull(),
    accountType: text('account_type').notNull(),
    accountSubType: text('account_sub_type'),
    currentBalance: numeric('current_balance', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_accounts_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_accounts_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_accounts_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const organizations = pgTable(
  'organizations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    settings: jsonb().default({}),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [unique('organizations_slug_unique').on(table.slug)]
)

export const providerConnections = pgTable(
  'provider_connections',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    providerId: text('provider_id').default('quickbooks').notNull(),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
    realmId: text('realm_id'),
    connectionStatus: connectionStatus('connection_status').default('active').notNull(),
    lastSyncAt: timestamp('last_sync_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'provider_connections_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('provider_connections_organization_id_provider_id_unique').on(
      table.organizationId,
      table.providerId
    ),
  ]
)

export const qbBills = pgTable(
  'qb_bills',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    docNumber: text('doc_number'),
    txnDate: date('txn_date').notNull(),
    dueDate: date('due_date'),
    vendorId: uuid('vendor_id'),
    vendorName: text('vendor_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    balance: numeric({ precision: 19, scale: 4 }).notNull(),
    status: billStatus().notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_bills_org').using('btree', table.organizationId.asc().nullsLast().op('uuid_ops')),
    index('idx_qb_bills_status').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.status.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_bills_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.vendorId],
      foreignColumns: [qbVendors.id],
      name: 'qb_bills_vendor_id_qb_vendors_id_fk',
    }),
    unique('qb_bills_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const qbEntities = pgTable(
  'qb_entities',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    entityType: text('entity_type').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_entities_org_type').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.entityType.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_entities_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_entities_organization_id_entity_type_qb_id_unique').on(
      table.organizationId,
      table.entityType,
      table.qbId
    ),
  ]
)

export const qbInvoices = pgTable(
  'qb_invoices',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    docNumber: text('doc_number'),
    txnDate: date('txn_date').notNull(),
    dueDate: date('due_date'),
    customerId: uuid('customer_id'),
    customerName: text('customer_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    balance: numeric({ precision: 19, scale: 4 }).notNull(),
    status: invoiceStatus().notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_invoices_date').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops'),
      table.txnDate.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_qb_invoices_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_qb_invoices_status').using(
      'btree',
      table.organizationId.asc().nullsLast().op('enum_ops'),
      table.status.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [qbCustomers.id],
      name: 'qb_invoices_customer_id_qb_customers_id_fk',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_invoices_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_invoices_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const qbItems = pgTable(
  'qb_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    name: text().notNull(),
    sku: text(),
    itemType: text('item_type').notNull(),
    unitPrice: numeric('unit_price', { precision: 19, scale: 4 }).default('0'),
    purchaseCost: numeric('purchase_cost', { precision: 19, scale: 4 }).default('0'),
    quantityOnHand: numeric('quantity_on_hand', { precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_items_org').using('btree', table.organizationId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_items_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_items_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const qbPayments = pgTable(
  'qb_payments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    txnDate: date('txn_date').notNull(),
    customerId: uuid('customer_id'),
    customerName: text('customer_name'),
    totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_payments_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [qbCustomers.id],
      name: 'qb_payments_customer_id_qb_customers_id_fk',
    }),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_payments_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_payments_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const qbCustomers = pgTable(
  'qb_customers',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    displayName: text('display_name').notNull(),
    companyName: text('company_name'),
    email: text(),
    phone: text(),
    balance: numeric({ precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_customers_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_customers_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_customers_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const qbVendors = pgTable(
  'qb_vendors',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    qbId: text('qb_id').notNull(),
    syncToken: text('sync_token').notNull(),
    displayName: text('display_name').notNull(),
    companyName: text('company_name'),
    email: text(),
    phone: text(),
    balance: numeric({ precision: 19, scale: 4 }).default('0'),
    isActive: boolean('is_active').default(true),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_qb_vendors_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'qb_vendors_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('qb_vendors_organization_id_qb_id_unique').on(table.organizationId, table.qbId),
  ]
)

export const syncJobs = pgTable(
  'sync_jobs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    jobType: text('job_type').notNull(),
    status: jobStatus().default('pending').notNull(),
    startedAt: timestamp('started_at', { mode: 'string' }),
    completedAt: timestamp('completed_at', { mode: 'string' }),
    recordsProcessed: integer('records_processed').default(0),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_sync_jobs_org').using(
      'btree',
      table.organizationId.asc().nullsLast().op('uuid_ops')
    ),
    index('idx_sync_jobs_status').using('btree', table.status.asc().nullsLast().op('enum_ops')),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'sync_jobs_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
  ]
)

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    permissions: jsonb().default([]).notNull(),
  },
  (table) => [unique('roles_name_unique').on(table.name)]
)

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [unique('users_email_unique').on(table.email)]
)

export const syncCursors = pgTable(
  'sync_cursors',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    organizationId: uuid('organization_id').notNull(),
    entityType: text('entity_type').notNull(),
    lastSyncTime: timestamp('last_sync_time', { mode: 'string' }).defaultNow().notNull(),
    syncStatus: syncStatus('sync_status').default('idle').notNull(),
    recordsSynced: integer('records_synced').default(0),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
      name: 'sync_cursors_organization_id_organizations_id_fk',
    }).onDelete('cascade'),
    unique('sync_cursors_organization_id_entity_type_unique').on(
      table.organizationId,
      table.entityType
    ),
  ]
)
