/**
 * QuickBooks API Constants and Enumerations
 * Valid values for QuickBooks API queries
 */

// Valid AccountType enumerations for QuickBooks API
export const QUICKBOOKS_ACCOUNT_TYPES = {
  // Asset types
  BANK: 'Bank',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
  OTHER_CURRENT_ASSET: 'Other Current Asset',
  FIXED_ASSET: 'Fixed Asset',
  OTHER_ASSET: 'Other Asset',

  // Liability types
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  CREDIT_CARD: 'Credit Card',
  OTHER_CURRENT_LIABILITY: 'Other Current Liability',
  LONG_TERM_LIABILITY: 'Long Term Liability',

  // Equity and income/expense types
  EQUITY: 'Equity',
  INCOME: 'Income',
  OTHER_INCOME: 'Other Income',
  EXPENSE: 'Expense',
  COST_OF_GOODS_SOLD: 'Cost of Goods Sold',
  OTHER_EXPENSE: 'Other Expense'
} as const

// Valid AccountSubType values for inventory
export const INVENTORY_SUBTYPES = [
  'Inventory',
  'AssetsAvailableForSale',
  'InventoryInTransit',
  'RawMaterialsAndSupplies',
  'WorkInProcess'
] as const

// Valid JournalEntry PostingTypes
export const POSTING_TYPES = {
  DEBIT: 'Debit',
  CREDIT: 'Credit'
} as const

// Valid Item types
export const ITEM_TYPES = {
  INVENTORY: 'Inventory',
  NON_INVENTORY: 'NonInventory',
  SERVICE: 'Service',
  BUNDLE: 'Bundle',
  CATEGORY: 'Category',
  GROUP: 'Group'
} as const

// Depreciation and amortization keywords for detection
export const DEPRECIATION_KEYWORDS = [
  'depreciation',
  'amortization',
  'accumulated depreciation',
  'depreciation expense',
  'amortization expense'
] as const

// Cash flow activity categories
export const CASH_FLOW_CATEGORIES = {
  OPERATING: 'Operating',
  INVESTING: 'Investing',
  FINANCING: 'Financing'
} as const

// Query limits
export const QUERY_LIMITS = {
  MAX_RESULTS: 1000,
  DEFAULT_BATCH_SIZE: 500,
  MAX_RETRY_ATTEMPTS: 3,
  RATE_LIMIT_DELAY_MS: 200,
  CACHE_TTL_SECONDS: 300
} as const

// Helper function to validate account type
export function isValidAccountType(accountType: string): boolean {
  return Object.values(QUICKBOOKS_ACCOUNT_TYPES).includes(accountType as any)
}

// Helper function to check if keyword indicates depreciation
export function isDepreciationRelated(text: string): boolean {
  const lowerText = text.toLowerCase()
  return DEPRECIATION_KEYWORDS.some(keyword => lowerText.includes(keyword))
}

// Helper function to validate query fields
export function validateQueryField(entity: string, field: string): boolean {
  // This is a simplified validation - could be expanded with full field mappings
  const invalidFields = {
    JournalEntry: ['Line.AccountRef.name', 'Line.AccountRef.value'],
    Invoice: ['Line.ItemRef.name'],
    Bill: ['Line.ItemRef.name']
  }

  const entityInvalidFields = invalidFields[entity as keyof typeof invalidFields]
  return !entityInvalidFields || !entityInvalidFields.includes(field)
}