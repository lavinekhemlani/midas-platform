// src/ai/tools/quickbooks-data/entity-accessor.ts
// Entity CRUD operations for QuickBooks entities (Customers, Vendors, Invoices, Bills, etc.)

import { listAccounts } from '@/lib/providers/quickbooks/accounts'
import { ClassesLocationsProvider } from '@/lib/providers/quickbooks/classes'
import { getHandler, isSupported } from '@/quickbooks/etl/registry'
import type { QBEntityType } from '@/quickbooks/types/entities'
import { QuickBooksClient, type QueryOptions } from '@/quickbooks/client/client'

// =============================================================================
// Types
// =============================================================================

export type EntityType =
  | 'Customer'
  | 'Vendor'
  | 'Invoice'
  | 'Bill'
  | 'Account'
  | 'Item'
  | 'Class'
  | 'Department'
  | 'Purchase'

// =============================================================================
// Security & Normalization Helpers
// =============================================================================

/**
 * Sanitize user input for QuickBooks SQL queries to prevent SQL injection
 * QuickBooks uses a SQL-like query language that requires proper escaping
 *
 * Security measures:
 * - Escapes single quotes by doubling them (QuickBooks SQL dialect)
 * - Escapes backslashes to prevent escape sequence attacks
 * - Removes SQL comment characters and semicolons
 * - Limits input length to prevent buffer overflow attacks
 * - Trims whitespace
 */
function sanitizeQueryValue(value: string): string {
  if (!value) return ''

  return value
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/'/g, "''") // Escape single quotes (SQL standard)
    .replace(/[;\-\-]/g, '') // Remove SQL comment/injection chars (semicolons, double dashes)
    .trim()
    .slice(0, 200) // Limit length to prevent overflow attacks
}

/**
 * Validate and sanitize field names for ORDER BY clauses
 * Only allows alphanumeric characters and underscores
 * Returns default field if invalid
 * @internal Reserved for future raw query support if needed
 */
function _sanitizeFieldName(fieldName: string | undefined, defaultField: string): string {
  if (!fieldName) return defaultField

  // Only allow alphanumeric characters, underscores, and periods (for qualified names)
  const sanitized = fieldName.replace(/[^a-zA-Z0-9_.]/g, '')

  // Prevent excessively long field names
  if (sanitized.length === 0 || sanitized.length > 50) {
    return defaultField
  }

  return sanitized
}

/**
 * Validate sort order to prevent injection
 * Only allows 'ASC' or 'DESC'
 * @internal Reserved for future raw query support if needed
 */
function _sanitizeSortOrder(sortOrder: string | undefined): 'ASC' | 'DESC' {
  if (!sortOrder) return 'ASC'

  const upper = sortOrder.toUpperCase()
  return upper === 'DESC' ? 'DESC' : 'ASC'
}

/**
 * Normalize entity type from lowercase schema format to PascalCase implementation format
 * This bridges the gap between user-friendly schema ('customer', 'vendor') and
 * internal implementation ('Customer', 'Vendor', 'Purchase')
 */
export function normalizeEntityType(type: string): EntityType {
  const mapping: Record<string, EntityType> = {
    customer: 'Customer',
    vendor: 'Vendor',
    account: 'Account',
    invoice: 'Invoice',
    bill: 'Bill',
    payment: 'Purchase', // Map 'payment' to Purchase for backwards compatibility
    transaction: 'Purchase', // Map 'transaction' to Purchase
    item: 'Item',
    class: 'Class',
    department: 'Department',
    purchase: 'Purchase',
  }

  const normalized = mapping[type.toLowerCase()]
  if (!normalized) {
    // If already PascalCase or unrecognized, return as-is (will be caught by switch statements)
    return type as EntityType
  }
  return normalized
}

export interface EntityFilters {
  status?: 'open' | 'paid' | 'overdue' | 'all' | 'active' | 'inactive'
  minAmount?: number
  maxAmount?: number
  dateFrom?: string // Legacy name
  dateTo?: string // Legacy name
  startDate?: string // Schema name (alias for dateFrom)
  endDate?: string // Schema name (alias for dateTo)
  accountType?: string
  classification?: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue'
  activeOnly?: boolean
  customerId?: string
  vendorId?: string
  customerName?: string // For name-based lookup (partial match)
  vendorName?: string // For name-based lookup (partial match)
  docNumber?: string // Invoice/Bill document number (e.g., INV-2099, BILL-1234)
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface EntityConfig {
  organizationId: string
  /** @internal Optional QuickBooksClient for testing - if not provided, creates a new client */
  client?: QuickBooksClient
}

/**
 * Get a QuickBooksClient instance for entity operations
 * The client has queryEntities() which is required by the handler system
 * @internal Uses injected client if provided (for testing), otherwise creates new client
 */
function getQuickBooksClient(
  organizationId: string,
  injectedClient?: QuickBooksClient
): QuickBooksClient {
  return injectedClient ?? new QuickBooksClient({ organizationId })
}

export interface EntityListResult {
  success: boolean
  data: {
    entities: any[]
    summary?: {
      total: number
      count: number
      [key: string]: any
    }
  }
  error?: string
}

export interface EntityResult {
  success: boolean
  data?: any
  error?: string
}

export interface EntitySearchResult {
  success: boolean
  data: {
    entities: any[]
    matchCount: number
    query: string
  }
  error?: string
}

// =============================================================================
// Entity Query Configuration
// =============================================================================

interface EntityQueryConfig {
  entityType: string
  queryResponseKey: string
  baseQuery: string
  defaultSortField: string
  buildConditions: (filters: EntityFilters) => string[]
  mapEntity: (raw: any) => any
  calculateSummary: (entities: any[]) => Record<string, any>
  postFilter?: (entities: any[], filters: EntityFilters) => any[]
}

// Helper builders for common condition patterns
const buildActiveConditions = (filters: EntityFilters): string[] => {
  const conditions: string[] = []
  if (filters.status === 'active') conditions.push('Active = true')
  else if (filters.status === 'inactive') conditions.push('Active = false')
  return conditions
}

const buildCustomerConditions = (filters: EntityFilters): string[] => {
  const conditions = buildActiveConditions(filters)
  if (filters.customerName) {
    const sanitized = sanitizeQueryValue(filters.customerName)
    conditions.push(`DisplayName LIKE '%${sanitized}%'`)
  }
  return conditions
}

const buildVendorConditions = (filters: EntityFilters): string[] => {
  const conditions = buildActiveConditions(filters)
  if (filters.vendorName) {
    const sanitized = sanitizeQueryValue(filters.vendorName)
    conditions.push(`DisplayName LIKE '%${sanitized}%'`)
  }
  return conditions
}

const buildTransactionConditions = (filters: EntityFilters, refField?: string): string[] => {
  const conditions: string[] = []

  // Document number filter (e.g., INV-2099, BILL-1234, 2099)
  // Use LIKE for flexible matching since users may provide with or without prefix
  if (filters.docNumber) {
    const sanitized = sanitizeQueryValue(filters.docNumber)
    // Use LIKE to match both "INV-2360" and "2360" formats
    conditions.push(`DocNumber LIKE '%${sanitized}%'`)
  }

  // Status filter
  if (filters.status === 'open') conditions.push("Balance > '0'")
  else if (filters.status === 'paid') conditions.push("Balance = '0'")
  else if (filters.status === 'overdue') conditions.push("Balance > '0' AND DueDate < CURRENT_DATE")

  // Date range (support both schema names and legacy names)
  const fromDate = filters.startDate || filters.dateFrom
  const toDate = filters.endDate || filters.dateTo
  if (fromDate) conditions.push(`TxnDate >= '${sanitizeQueryValue(fromDate)}'`)
  if (toDate) conditions.push(`TxnDate <= '${sanitizeQueryValue(toDate)}'`)

  // Entity reference filter (by ID)
  if (refField && filters.customerId)
    conditions.push(`${refField} = '${sanitizeQueryValue(filters.customerId)}'`)
  if (refField && filters.vendorId)
    conditions.push(`${refField} = '${sanitizeQueryValue(filters.vendorId)}'`)

  return conditions
}

const buildDateConditions = (filters: EntityFilters): string[] => {
  const conditions: string[] = []
  // Support both schema names and legacy names
  const fromDate = filters.startDate || filters.dateFrom
  const toDate = filters.endDate || filters.dateTo
  if (fromDate) conditions.push(`TxnDate >= '${sanitizeQueryValue(fromDate)}'`)
  if (toDate) conditions.push(`TxnDate <= '${sanitizeQueryValue(toDate)}'`)
  return conditions
}

const calculateBalanceSummary = (entities: any[], field: string = 'balance') => ({
  count: entities.length,
  total: entities.reduce((sum, e) => sum + (e[field] || 0), 0),
  activeCount: entities.filter((e) => e.active).length,
})

const calculateTransactionSummary = (entities: any[]) => {
  const totalAmount = entities.reduce((sum, e) => sum + e.total, 0)
  const totalBalance = entities.reduce((sum, e) => sum + e.balance, 0)
  return {
    count: entities.length,
    total: totalAmount,
    totalBalance,
    totalPaid: totalAmount - totalBalance,
  }
}

/**
 * Post-filter entities by amount and customer/vendor name
 * Name filtering uses case-insensitive partial matching
 */
const filterTransactionEntities = (entities: any[], filters: EntityFilters) => {
  let filtered = entities

  // Amount filters
  if (filters.minAmount !== undefined)
    filtered = filtered.filter((e) => e.total >= filters.minAmount!)
  if (filters.maxAmount !== undefined)
    filtered = filtered.filter((e) => e.total <= filters.maxAmount!)

  // Customer name filter (for invoices) - case-insensitive partial match
  if (filters.customerName) {
    const searchName = filters.customerName.toLowerCase()
    filtered = filtered.filter((e) => e.customerName?.toLowerCase().includes(searchName))
  }

  // Vendor name filter (for bills) - case-insensitive partial match
  if (filters.vendorName) {
    const searchName = filters.vendorName.toLowerCase()
    filtered = filtered.filter((e) => e.vendorName?.toLowerCase().includes(searchName))
  }

  return filtered
}

const ENTITY_CONFIGS: Record<string, EntityQueryConfig> = {
  Customer: {
    entityType: 'Customer',
    queryResponseKey: 'Customer',
    baseQuery: 'SELECT * FROM Customer',
    defaultSortField: 'DisplayName',
    buildConditions: buildCustomerConditions,
    mapEntity: mapCustomer,
    calculateSummary: (entities) => calculateBalanceSummary(entities, 'balance'),
  },
  Vendor: {
    entityType: 'Vendor',
    queryResponseKey: 'Vendor',
    baseQuery: 'SELECT * FROM Vendor',
    defaultSortField: 'DisplayName',
    buildConditions: buildVendorConditions,
    mapEntity: mapVendor,
    calculateSummary: (entities) => calculateBalanceSummary(entities, 'balance'),
  },
  Invoice: {
    entityType: 'Invoice',
    queryResponseKey: 'Invoice',
    baseQuery: 'SELECT * FROM Invoice',
    defaultSortField: 'TxnDate',
    buildConditions: (filters) => buildTransactionConditions(filters, 'CustomerRef'),
    mapEntity: mapInvoice,
    calculateSummary: calculateTransactionSummary,
    postFilter: filterTransactionEntities,
  },
  Bill: {
    entityType: 'Bill',
    queryResponseKey: 'Bill',
    baseQuery: 'SELECT * FROM Bill',
    defaultSortField: 'TxnDate',
    buildConditions: (filters) => buildTransactionConditions(filters, 'VendorRef'),
    mapEntity: mapBill,
    calculateSummary: calculateTransactionSummary,
    postFilter: filterTransactionEntities,
  },
  Item: {
    entityType: 'Item',
    queryResponseKey: 'Item',
    baseQuery: 'SELECT * FROM Item',
    defaultSortField: 'Name',
    buildConditions: buildActiveConditions,
    mapEntity: mapItem,
    calculateSummary: (entities) => ({
      total: entities.length,
      count: entities.length,
      activeCount: entities.filter((i) => i.active).length,
    }),
  },
  Purchase: {
    entityType: 'Purchase',
    queryResponseKey: 'Purchase',
    baseQuery: 'SELECT * FROM Purchase',
    defaultSortField: 'TxnDate',
    buildConditions: buildDateConditions,
    mapEntity: mapPurchase,
    calculateSummary: (entities) => ({
      count: entities.length,
      total: entities.reduce((sum, p) => sum + p.total, 0),
    }),
  },
}

// =============================================================================
// Generic Entity List Function
// =============================================================================

/**
 * Generic entity list function that uses entity-specific configurations
 * Uses entity handlers from src/quickbooks/etl/registry for typed access
 */
async function listEntitiesGeneric(
  entityType: string,
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  const config = ENTITY_CONFIGS[entityType]
  if (!config) {
    throw new Error(`No configuration found for entity type: ${entityType}`)
  }

  // Verify entity type is supported by handler system
  if (!isSupported(entityType)) {
    return {
      success: false,
      data: { entities: [] },
      error: `[EntityAccessor] Entity type '${entityType}' is not supported by the handler system`,
    }
  }

  // Get handler for this entity type (now type-safe)
  const handler = getHandler(entityType as QBEntityType)
  if (!handler) {
    return {
      success: false,
      data: { entities: [] },
      error: `[EntityAccessor] No handler available for entity type: ${entityType}`,
    }
  }

  try {
    // Get client that has queryEntities method (injected for testing or new instance)
    const client = getQuickBooksClient(organizationId, injectedClient)

    // Build conditions from filters
    const conditions = config.buildConditions(filters)

    // Build QueryOptions for the handler
    const queryOptions: QueryOptions = {
      limit: filters.limit || 100,
      where: conditions.length > 0 ? conditions.join(' AND ') : undefined,
    }

    // Run COUNT queries to get real totals (e.g., 473 customers, not just 100)
    let realTotalCount: number | null = null
    let realActiveCount: number | null = null
    const ACTIVE_ENTITY_TYPES = ['Customer', 'Vendor', 'Item']
    try {
      // Build total COUNT query with same WHERE conditions
      let countQuery = `SELECT COUNT(*) FROM ${entityType}`
      if (queryOptions.where) {
        countQuery += ` WHERE ${queryOptions.where}`
      }
      const countResponse = await client.query<{ QueryResponse: { totalCount?: number } }>(
        countQuery
      )
      if (countResponse.QueryResponse?.totalCount !== undefined) {
        realTotalCount = countResponse.QueryResponse.totalCount
      }

      // For entity types that have Active field, run a separate active COUNT
      if (ACTIVE_ENTITY_TYPES.includes(entityType)) {
        let activeCountQuery = `SELECT COUNT(*) FROM ${entityType} WHERE Active = true`
        if (queryOptions.where) {
          activeCountQuery += ` AND ${queryOptions.where}`
        }
        const activeCountResponse = await client.query<{ QueryResponse: { totalCount?: number } }>(
          activeCountQuery
        )
        if (activeCountResponse.QueryResponse?.totalCount !== undefined) {
          realActiveCount = activeCountResponse.QueryResponse.totalCount
        }
      }
    } catch {
      // COUNT queries failed — non-critical, fall back to entities.length
    }

    // Use handler's queryAndTransform for typed access
    const normalizedEntities = await handler.queryAndTransform(client, queryOptions)

    // Map normalized entities to legacy format for backwards compatibility
    let entities = normalizedEntities.map((n) => mapNormalizedToLegacy(entityType, n))

    // Apply post-filtering if configured (for amount ranges, etc.)
    if (config.postFilter) {
      entities = config.postFilter(entities, filters)
    }

    // Calculate summary
    const summary = config.calculateSummary(entities)

    return {
      success: true,
      data: {
        entities,
        summary: {
          // Spread summary first, then override with real totals from COUNT queries
          ...summary,
          count: summary.count ?? entities.length,
          total: realTotalCount ?? summary.total ?? 0,
          totalCount: realTotalCount ?? summary.count ?? 0,
          showing: entities.length,
          // Override summary.activeCount with real count from COUNT query
          ...(realActiveCount !== null ? { activeCount: realActiveCount } : {}),
        },
      },
    }
  } catch (error) {
    console.error(`[EntityAccessor] Handler error for ${entityType}:`, error)
    return {
      success: false,
      data: { entities: [] },
      error: error instanceof Error ? error.message : 'Handler query failed',
    }
  }
}

// =============================================================================
// Entity List Functions
// =============================================================================

/**
 * List entities of a specific type with filters
 */
export async function listEntities(
  entityType: EntityType,
  filters: EntityFilters,
  config: EntityConfig
): Promise<EntityListResult> {
  const normalizedType = normalizeEntityType(entityType)

  try {
    const { organizationId, client } = config

    switch (normalizedType) {
      case 'Customer':
        return await listCustomers(organizationId, filters, client)

      case 'Vendor':
        return await listVendors(organizationId, filters, client)

      case 'Invoice':
        return await listInvoices(organizationId, filters, client)

      case 'Bill':
        return await listBills(organizationId, filters, client)

      case 'Account':
        return await listAccountsEntity(organizationId, filters)

      case 'Item':
        return await listItems(organizationId, filters, client)

      case 'Class':
        return await listClasses(organizationId, filters)

      case 'Department':
        return await listDepartments(organizationId, filters)

      case 'Purchase':
        return await listPurchases(organizationId, filters, client)

      default:
        return {
          success: false,
          data: { entities: [] },
          error: `Unknown entity type: ${entityType} (normalized to: ${normalizedType})`,
        }
    }
  } catch (error) {
    console.error(
      `[EntityAccessor] Error listing ${entityType} (normalized: ${normalizedType}):`,
      error
    )
    return {
      success: false,
      data: { entities: [] },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get a single entity by ID
 * Uses entity handlers from src/quickbooks/etl/registry for typed access
 */
export async function getEntity(
  entityType: EntityType,
  entityId: string,
  config: EntityConfig
): Promise<EntityResult> {
  const normalizedType = normalizeEntityType(entityType)

  try {
    const { organizationId, client: injectedClient } = config
    const client = getQuickBooksClient(organizationId, injectedClient)
    let entity: any

    switch (normalizedType) {
      case 'Customer':
        entity = await client.get('Customer', entityId)
        if (!entity) {
          return { success: false, error: `Customer with ID ${entityId} not found` }
        }
        return { success: true, data: mapCustomer(entity) }

      case 'Vendor':
        entity = await client.get('Vendor', entityId)
        if (!entity) {
          return { success: false, error: `Vendor with ID ${entityId} not found` }
        }
        return { success: true, data: mapVendor(entity) }

      case 'Invoice':
        entity = await client.get('Invoice', entityId)
        if (!entity) {
          return { success: false, error: `Invoice with ID ${entityId} not found` }
        }
        return { success: true, data: mapInvoice(entity) }

      case 'Bill':
        entity = await client.get('Bill', entityId)
        if (!entity) {
          return { success: false, error: `Bill with ID ${entityId} not found` }
        }
        return { success: true, data: mapBill(entity) }

      case 'Account':
        const accounts = await listAccounts(organizationId, { limit: 1000 })
        entity = accounts.find((acc) => acc.id === entityId)
        return {
          success: !!entity,
          data: entity,
          error: entity ? undefined : `Account with ID ${entityId} not found`,
        }

      case 'Item':
        entity = await client.get('Item', entityId)
        if (!entity) {
          return { success: false, error: `Item with ID ${entityId} not found` }
        }
        return { success: true, data: mapItem(entity) }

      case 'Class':
        entity = await ClassesLocationsProvider.getClass(organizationId, entityId)
        return {
          success: !!entity,
          data: entity,
          error: entity ? undefined : `Class with ID ${entityId} not found`,
        }

      case 'Department':
        entity = await ClassesLocationsProvider.getLocation(organizationId, entityId)
        return {
          success: !!entity,
          data: entity,
          error: entity ? undefined : `Department with ID ${entityId} not found`,
        }

      case 'Purchase':
        entity = await client.get('Purchase', entityId)
        if (!entity) {
          return { success: false, error: `Purchase with ID ${entityId} not found` }
        }
        return { success: true, data: mapPurchase(entity) }

      default:
        return {
          success: false,
          error: `Unknown entity type: ${entityType} (normalized to: ${normalizedType})`,
        }
    }
  } catch (error) {
    console.error(
      `[EntityAccessor] Error getting ${entityType} (normalized: ${normalizedType}) ${entityId}:`,
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Build search WHERE clause for a given entity type
 */
function buildSearchWhereClause(entityType: EntityType, sanitizedTerm: string): string | undefined {
  const searchFields: Record<string, string[]> = {
    Customer: ['DisplayName', 'CompanyName'],
    Vendor: ['DisplayName', 'CompanyName'],
    Invoice: ['DocNumber'],
    Bill: ['DocNumber'],
    Account: ['Name', 'FullyQualifiedName'],
    Item: ['Name'],
    Class: ['Name', 'FullyQualifiedName'],
    Department: ['Name'],
  }

  const fields = searchFields[entityType]
  if (!fields) return undefined

  const conditions = fields.map((field) => `${field} LIKE '%${sanitizedTerm}%'`)
  // QuickBooks API requires parentheses around OR conditions to parse correctly
  return conditions.length > 1 ? `(${conditions.join(' OR ')})` : conditions[0]
}

/**
 * Search entities by query string
 * Uses entity handlers from src/quickbooks/etl/registry for typed access
 */
export async function searchEntities(
  entityType: EntityType,
  query: string,
  filters: EntityFilters,
  config: EntityConfig
): Promise<EntitySearchResult> {
  const normalizedType = normalizeEntityType(entityType)

  try {
    const { organizationId, client: injectedClient } = config
    const searchTerm = query.trim()

    if (!searchTerm) {
      return {
        success: false,
        data: { entities: [], matchCount: 0, query },
        error: 'Search query is required',
      }
    }

    // SECURITY FIX: Sanitize user input to prevent SQL injection
    const sanitizedTerm = sanitizeQueryValue(searchTerm)

    // Build search WHERE clause
    const searchWhere = buildSearchWhereClause(normalizedType, sanitizedTerm)
    if (!searchWhere) {
      return {
        success: false,
        data: { entities: [], matchCount: 0, query },
        error: `Search not supported for entity type: ${entityType} (normalized to: ${normalizedType})`,
      }
    }

    // Verify entity type is supported by handler system
    if (!isSupported(normalizedType)) {
      return {
        success: false,
        data: { entities: [], matchCount: 0, query },
        error: `[EntityAccessor] Entity type '${normalizedType}' is not supported by the handler system`,
      }
    }

    // Get handler for this entity type (now type-safe)
    const handler = getHandler(normalizedType as QBEntityType)
    if (!handler) {
      return {
        success: false,
        data: { entities: [], matchCount: 0, query },
        error: `[EntityAccessor] No handler available for entity type: ${normalizedType}`,
      }
    }

    // Get client that has queryEntities method (injected for testing or new instance)
    const client = getQuickBooksClient(organizationId, injectedClient)

    const queryOptions: QueryOptions = {
      limit: filters.limit || 100,
      where: searchWhere,
    }

    const normalizedEntities = await handler.queryAndTransform(client, queryOptions)
    const entities = normalizedEntities.map((n) => mapNormalizedToLegacy(normalizedType, n))

    return {
      success: true,
      data: {
        entities,
        matchCount: entities.length,
        query: searchTerm,
      },
    }
  } catch (error) {
    console.error(
      `[EntityAccessor] Error searching ${entityType} (normalized: ${normalizedType}):`,
      error
    )
    return {
      success: false,
      data: { entities: [], matchCount: 0, query },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// =============================================================================
// Entity-Specific List Functions (Backward Compatibility Wrappers)
// =============================================================================

/**
 * List customers - uses handler system
 */
async function listCustomers(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Customer', organizationId, filters, injectedClient)
}

/**
 * List vendors - uses handler system
 */
async function listVendors(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Vendor', organizationId, filters, injectedClient)
}

/**
 * List invoices - uses handler system
 */
async function listInvoices(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Invoice', organizationId, filters, injectedClient)
}

/**
 * List bills - uses handler system
 */
async function listBills(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Bill', organizationId, filters, injectedClient)
}

/**
 * List items - uses handler system
 */
async function listItems(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Item', organizationId, filters, injectedClient)
}

/**
 * List purchases - uses handler system
 */
async function listPurchases(
  organizationId: string,
  filters: EntityFilters,
  injectedClient?: QuickBooksClient
): Promise<EntityListResult> {
  return listEntitiesGeneric('Purchase', organizationId, filters, injectedClient)
}

/**
 * List accounts - uses different data source (not query-based)
 * Kept separate as it uses listAccounts provider instead of client.query
 */
async function listAccountsEntity(
  organizationId: string,
  filters: EntityFilters
): Promise<EntityListResult> {
  const accounts = await listAccounts(organizationId, {
    account_type: filters.accountType,
    classification: filters.classification,
    active: filters.status === 'active' ? true : filters.status === 'inactive' ? false : undefined,
    limit: filters.limit || 500,
  })

  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0)

  return {
    success: true,
    data: {
      entities: accounts,
      summary: {
        count: accounts.length,
        total: totalBalance,
        activeCount: accounts.filter((a) => a.active).length,
      },
    },
  }
}

/**
 * List classes - uses different data source (ClassesLocationsProvider)
 * Kept separate as it uses ClassesLocationsProvider instead of client.query
 */
async function listClasses(
  organizationId: string,
  filters: EntityFilters
): Promise<EntityListResult> {
  const classes = await ClassesLocationsProvider.listClasses(organizationId, {
    active_only: filters.activeOnly,
    per_page: filters.limit || 100,
  })

  return {
    success: true,
    data: {
      entities: classes,
      summary: {
        total: classes.length,
        count: classes.length,
        activeCount: classes.filter((c) => c.active).length,
      },
    },
  }
}

/**
 * List departments - uses different data source (ClassesLocationsProvider)
 * Kept separate as it uses ClassesLocationsProvider instead of client.query
 */
async function listDepartments(
  organizationId: string,
  filters: EntityFilters
): Promise<EntityListResult> {
  const departments = await ClassesLocationsProvider.listLocations(organizationId, {
    active_only: filters.activeOnly,
    per_page: filters.limit || 100,
  })

  return {
    success: true,
    data: {
      entities: departments,
      summary: {
        total: departments.length,
        count: departments.length,
        activeCount: departments.filter((d) => d.active).length,
      },
    },
  }
}

// =============================================================================
// Mapping Functions
// =============================================================================

function mapCustomer(customer: any) {
  return {
    id: customer.Id,
    name: customer.DisplayName || customer.CompanyName || '',
    companyName: customer.CompanyName,
    email: customer.PrimaryEmailAddr?.Address,
    phone: customer.PrimaryPhone?.FreeFormNumber,
    balance: parseFloat(customer.Balance || '0'),
    active: customer.Active !== false,
    createdTime: customer.MetaData?.CreateTime,
    lastModifiedTime: customer.MetaData?.LastUpdatedTime,
  }
}

function mapVendor(vendor: any) {
  return {
    id: vendor.Id,
    name: vendor.DisplayName || vendor.CompanyName || '',
    companyName: vendor.CompanyName,
    email: vendor.PrimaryEmailAddr?.Address,
    phone: vendor.PrimaryPhone?.FreeFormNumber,
    balance: parseFloat(vendor.Balance || '0'),
    active: vendor.Active !== false,
    createdTime: vendor.MetaData?.CreateTime,
    lastModifiedTime: vendor.MetaData?.LastUpdatedTime,
  }
}

function mapInvoice(invoice: any) {
  return {
    id: invoice.Id,
    docNumber: invoice.DocNumber,
    customerId: invoice.CustomerRef?.value,
    customerName: invoice.CustomerRef?.name,
    txnDate: invoice.TxnDate,
    dueDate: invoice.DueDate,
    total: parseFloat(invoice.TotalAmt || '0'),
    balance: parseFloat(invoice.Balance || '0'),
    status: parseFloat(invoice.Balance || '0') === 0 ? 'paid' : 'open',
    lineItems: invoice.Line?.filter((l: any) => l.DetailType === 'SalesItemLineDetail').length || 0,
    createdTime: invoice.MetaData?.CreateTime,
    lastModifiedTime: invoice.MetaData?.LastUpdatedTime,
  }
}

function mapBill(bill: any) {
  return {
    id: bill.Id,
    docNumber: bill.DocNumber,
    vendorId: bill.VendorRef?.value,
    vendorName: bill.VendorRef?.name,
    txnDate: bill.TxnDate,
    dueDate: bill.DueDate,
    total: parseFloat(bill.TotalAmt || '0'),
    balance: parseFloat(bill.Balance || '0'),
    status: parseFloat(bill.Balance || '0') === 0 ? 'paid' : 'open',
    lineItems:
      bill.Line?.filter((l: any) => l.DetailType === 'AccountBasedExpenseLineDetail').length || 0,
    createdTime: bill.MetaData?.CreateTime,
    lastModifiedTime: bill.MetaData?.LastUpdatedTime,
  }
}

function mapItem(item: any) {
  return {
    id: item.Id,
    name: item.Name,
    type: item.Type,
    description: item.Description,
    unitPrice: parseFloat(item.UnitPrice || '0'),
    incomeAccountId: item.IncomeAccountRef?.value,
    expenseAccountId: item.ExpenseAccountRef?.value,
    active: item.Active !== false,
    createdTime: item.MetaData?.CreateTime,
    lastModifiedTime: item.MetaData?.LastUpdatedTime,
  }
}

function mapPurchase(purchase: any) {
  return {
    id: purchase.Id,
    docNumber: purchase.DocNumber,
    txnDate: purchase.TxnDate,
    accountId: purchase.AccountRef?.value,
    accountName: purchase.AccountRef?.name,
    paymentType: purchase.PaymentType,
    total: parseFloat(purchase.TotalAmt || '0'),
    entityId: purchase.EntityRef?.value,
    entityName: purchase.EntityRef?.name,
    createdTime: purchase.MetaData?.CreateTime,
    lastModifiedTime: purchase.MetaData?.LastUpdatedTime,
  }
}

/**
 * @internal Reserved for future raw query support if needed
 */
function _mapEntityByType(entityType: EntityType, entity: any): any {
  switch (entityType) {
    case 'Customer':
      return mapCustomer(entity)
    case 'Vendor':
      return mapVendor(entity)
    case 'Invoice':
      return mapInvoice(entity)
    case 'Bill':
      return mapBill(entity)
    case 'Item':
      return mapItem(entity)
    case 'Purchase':
      return mapPurchase(entity)
    default:
      return entity
  }
}

/**
 * Map normalized entity (from handler) to legacy format for backwards compatibility
 * Normalized entities use different field names (displayName vs name, createdAt vs createdTime)
 */
function mapNormalizedToLegacy(entityType: string, normalized: any): any {
  const base = {
    id: normalized.id,
    active: normalized.active,
    createdTime: normalized.createdAt,
    lastModifiedTime: normalized.updatedAt,
  }

  switch (entityType) {
    case 'Customer':
      return {
        ...base,
        name: normalized.displayName,
        companyName: normalized.companyName,
        email: normalized.email,
        phone: normalized.phone,
        balance: normalized.balance,
      }
    case 'Vendor':
      return {
        ...base,
        name: normalized.displayName,
        companyName: normalized.companyName,
        email: normalized.email,
        phone: normalized.phone,
        balance: normalized.balance,
      }
    case 'Invoice':
      return {
        ...base,
        docNumber: normalized.invoiceNumber,
        customerId: normalized.customerId,
        customerName: normalized.customerName,
        txnDate: normalized.date,
        dueDate: normalized.dueDate,
        total: normalized.total,
        balance: normalized.balance,
        status: normalized.status === 'paid' ? 'paid' : 'open',
        lineItems: normalized.lineItems?.length || 0,
      }
    case 'Bill':
      return {
        ...base,
        docNumber: normalized.billNumber,
        vendorId: normalized.vendorId,
        vendorName: normalized.vendorName,
        txnDate: normalized.date,
        dueDate: normalized.dueDate,
        total: normalized.total,
        balance: normalized.balance,
        status: normalized.status === 'paid' ? 'paid' : 'open',
        lineItems: normalized.lineItems?.length || 0,
      }
    case 'Item':
      return {
        ...base,
        name: normalized.name,
        type: normalized.itemType,
        description: normalized.description,
        unitPrice: normalized.unitPrice,
        incomeAccountId: normalized.incomeAccountId,
        expenseAccountId: normalized.expenseAccountId,
      }
    case 'Purchase':
      return {
        ...base,
        docNumber: normalized.referenceNumber,
        txnDate: normalized.date,
        accountId: normalized.accountId,
        accountName: normalized.accountName,
        paymentType: normalized.paymentType,
        total: normalized.amount,
        entityId: normalized.vendorId,
        entityName: normalized.vendorName,
      }
    default:
      return normalized
  }
}
