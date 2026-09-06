/**
 * QuickBooks Entity Handler Registry
 * Centralized registry of all entity handlers
 */

import type { QBEntityType } from '../types/entities'
import { createEntityHandler, type EntityHandler, type HandlerRegistry } from '../entities/handler'
import * as transformers from '../entities/transformers'

// Handler registry
const handlers: HandlerRegistry = {}

/**
 * Register all entity handlers
 */
function registerHandlers(): void {
  // Financial transactions
  handlers.Invoice = createEntityHandler('Invoice', transformers.transformInvoice)
  handlers.Bill = createEntityHandler('Bill', transformers.transformBill)
  handlers.Payment = createEntityHandler('Payment', transformers.transformPayment)
  handlers.BillPayment = createEntityHandler('BillPayment', transformers.transformBillPayment)
  handlers.Deposit = createEntityHandler('Deposit', transformers.transformDeposit)
  handlers.Transfer = createEntityHandler('Transfer', transformers.transformTransfer)
  handlers.JournalEntry = createEntityHandler('JournalEntry', transformers.transformJournalEntry)

  // Purchase transactions
  handlers.Purchase = createEntityHandler('Purchase', transformers.transformPurchase)
  handlers.PurchaseOrder = createEntityHandler('PurchaseOrder', transformers.transformPurchaseOrder)
  handlers.VendorCredit = createEntityHandler('VendorCredit', transformers.transformVendorCredit)

  // Sales transactions
  handlers.Estimate = createEntityHandler('Estimate', transformers.transformEstimate)
  handlers.SalesReceipt = createEntityHandler('SalesReceipt', transformers.transformSalesReceipt)
  handlers.CreditMemo = createEntityHandler('CreditMemo', transformers.transformCreditMemo)
  handlers.RefundReceipt = createEntityHandler('RefundReceipt', transformers.transformRefundReceipt)

  // Reference entities
  handlers.Customer = createEntityHandler('Customer', transformers.transformCustomer)
  handlers.Vendor = createEntityHandler('Vendor', transformers.transformVendor)
  handlers.Employee = createEntityHandler('Employee', transformers.transformEmployee)
  handlers.Account = createEntityHandler('Account', transformers.transformAccount)
  handlers.Item = createEntityHandler('Item', transformers.transformItem)
  handlers.Class = createEntityHandler('Class', transformers.transformClass)
  handlers.Department = createEntityHandler('Department', transformers.transformDepartment)

  // Configuration entities
  handlers.Term = createEntityHandler('Term', transformers.transformTerm)
  handlers.PaymentMethod = createEntityHandler('PaymentMethod', transformers.transformPaymentMethod)
  handlers.TaxCode = createEntityHandler('TaxCode', transformers.transformTaxCode)
  handlers.TaxRate = createEntityHandler('TaxRate', transformers.transformTaxRate)
  handlers.TaxAgency = createEntityHandler('TaxAgency', transformers.transformTaxAgency)

  // Other entities
  handlers.TimeActivity = createEntityHandler('TimeActivity', transformers.transformTimeActivity)
  handlers.Budget = createEntityHandler('Budget', transformers.transformBudget)
  handlers.Attachable = createEntityHandler('Attachable', transformers.transformAttachable)
  handlers.ExchangeRate = createEntityHandler('ExchangeRate', transformers.transformExchangeRate)

  // Company/System entities (typically read-only)
  handlers.CompanyInfo = createEntityHandler('CompanyInfo', transformers.transformCompanyInfo)
  handlers.Preferences = createEntityHandler('Preferences', transformers.transformPreferences)
}

// Initialize handlers
registerHandlers()

/**
 * Get handler for an entity type
 */
export function getHandler<T extends QBEntityType>(entityType: T): EntityHandler<T> | undefined {
  return handlers[entityType] as EntityHandler<T> | undefined
}

/**
 * Check if an entity type is supported
 */
export function isSupported(entityType: string): entityType is QBEntityType {
  return entityType in handlers
}

/**
 * Get all supported entity types
 */
export function getSupportedEntityTypes(): QBEntityType[] {
  return Object.keys(handlers) as QBEntityType[]
}

/**
 * Get handlers grouped by category
 */
export function getHandlersByCategory(): Record<string, QBEntityType[]> {
  return {
    financial: ['Invoice', 'Bill', 'Payment', 'BillPayment', 'Deposit', 'Transfer', 'JournalEntry'],
    purchase: ['Purchase', 'PurchaseOrder', 'VendorCredit'],
    sales: ['Estimate', 'SalesReceipt', 'CreditMemo', 'RefundReceipt'],
    reference: ['Customer', 'Vendor', 'Employee', 'Account', 'Item', 'Class', 'Department'],
    configuration: ['Term', 'PaymentMethod', 'TaxCode', 'TaxRate', 'TaxAgency'],
    system: ['CompanyInfo', 'Preferences'],
    other: ['TimeActivity', 'Budget', 'Attachable', 'ExchangeRate'],
  }
}
