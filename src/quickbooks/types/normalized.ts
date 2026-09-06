/**
 * Normalized Entity Types
 * These are the standardized types used throughout the application
 */

// Base interface for all normalized entities
export interface NormalizedBase {
  id: string
  sourceId: string
  syncToken: string
  createdAt: string
  updatedAt: string
  source: 'quickbooks'
}

// Normalized address
export interface NormalizedAddress {
  line1?: string
  line2?: string
  line3?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

// Normalized line item
export interface NormalizedLineItem {
  id?: string
  lineNumber?: number
  description?: string
  quantity: number
  unitPrice: number
  amount: number
  itemId?: string
  itemName?: string
  accountId?: string
  accountName?: string
}

// Normalized linked transaction
export interface NormalizedLinkedTxn {
  transactionId: string
  transactionType: string
  lineId?: string
}

// Invoice status
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'partial' | 'void'

// Normalized Invoice
export interface NormalizedInvoice extends NormalizedBase {
  type: 'invoice'
  invoiceNumber?: string
  customerId: string | null
  customerName: string
  date: string
  dueDate?: string
  status: InvoiceStatus
  currency: string
  exchangeRate?: number
  subtotal: number
  tax: number
  total: number
  balance: number
  lineItems: NormalizedLineItem[]
  billingAddress?: NormalizedAddress
  shippingAddress?: NormalizedAddress
  email?: string
  memo?: string
  privateNote?: string
  classId?: string
  className?: string
  departmentId?: string
  departmentName?: string
}

// Normalized Customer
export interface NormalizedCustomer extends NormalizedBase {
  type: 'customer'
  displayName: string
  companyName?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  balance: number
  active: boolean
  currency: string
  billingAddress?: NormalizedAddress
  shippingAddress?: NormalizedAddress
  notes?: string
  taxable?: boolean
  isJob?: boolean
  parentId?: string
}

// Normalized Vendor
export interface NormalizedVendor extends NormalizedBase {
  type: 'vendor'
  displayName: string
  companyName?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  balance: number
  active: boolean
  currency: string
  billingAddress?: NormalizedAddress
  taxId?: string
  track1099: boolean
  accountNumber?: string
  termId?: string
}

// Bill status
export type BillStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

// Normalized Bill
export interface NormalizedBill extends NormalizedBase {
  type: 'bill'
  billNumber?: string
  vendorId: string | null
  vendorName: string
  date: string
  dueDate?: string
  status: BillStatus
  currency: string
  exchangeRate?: number
  total: number
  balance: number
  lineItems: NormalizedLineItem[]
  privateNote?: string
  apAccountId?: string
  departmentId?: string
  departmentName?: string
}

// Normalized Payment
export interface NormalizedPayment extends NormalizedBase {
  type: 'payment'
  customerId: string | null
  customerName: string
  date: string
  amount: number
  unappliedAmount: number
  currency: string
  exchangeRate?: number
  paymentMethodId?: string
  paymentMethodName?: string
  depositAccountId?: string
  privateNote?: string
  linkedTransactions: NormalizedLinkedTxn[]
  appliedToInvoices: Array<{
    invoiceId: string
    amount: number
  }>
}

// Normalized BillPayment
export interface NormalizedBillPayment extends NormalizedBase {
  type: 'bill_payment'
  vendorId: string | null
  vendorName: string
  date: string
  amount: number
  paymentType: 'check' | 'credit_card'
  currency: string
  exchangeRate?: number
  apAccountId?: string
  privateNote?: string
  linkedTransactions: NormalizedLinkedTxn[]
  appliedToBills: Array<{
    billId: string
    amount: number
  }>
}

// Account classification
export type AccountClassification = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

// Normalized Account
export interface NormalizedAccount extends NormalizedBase {
  type: 'account'
  name: string
  fullyQualifiedName?: string
  accountType: string
  accountSubType?: string
  classification?: AccountClassification
  balance: number
  balanceWithSubAccounts: number
  currency: string
  active: boolean
  isSubAccount: boolean
  parentId?: string
  description?: string
  accountNumber?: string
}

// Item type
export type ItemType = 'inventory' | 'non_inventory' | 'service' | 'bundle' | 'category'

// Normalized Item
export interface NormalizedItem extends NormalizedBase {
  type: 'item'
  name: string
  fullyQualifiedName?: string
  itemType: ItemType
  active: boolean
  unitPrice?: number
  purchaseCost?: number
  quantityOnHand?: number
  incomeAccountId?: string
  expenseAccountId?: string
  assetAccountId?: string
  description?: string
  purchaseDescription?: string
  taxable: boolean
  trackQuantity: boolean
  isSubItem: boolean
  parentId?: string
  sku?: string
}

// Normalized Deposit
export interface NormalizedDeposit extends NormalizedBase {
  type: 'deposit'
  date: string
  depositAccountId: string | null
  depositAccountName: string
  amount: number
  currency: string
  exchangeRate?: number
  privateNote?: string
  linkedTransactions: NormalizedLinkedTxn[]
  lineItems: Array<{
    amount: number
    accountId?: string
    accountName?: string
    paymentMethodId?: string
    linkedTransactionId?: string
    linkedTransactionType?: string
  }>
}

// Normalized Transfer
export interface NormalizedTransfer extends NormalizedBase {
  type: 'transfer'
  date: string
  fromAccountId: string | null
  fromAccountName: string
  toAccountId: string | null
  toAccountName: string
  amount: number
  currency: string
  exchangeRate?: number
  privateNote?: string
}

// Normalized JournalEntry
export interface NormalizedJournalEntry extends NormalizedBase {
  type: 'journal_entry'
  date: string
  entryNumber?: string
  amount: number
  currency: string
  exchangeRate?: number
  privateNote?: string
  lines: Array<{
    id?: string
    description?: string
    amount: number
    postingType: 'debit' | 'credit'
    accountId: string
    accountName: string
    entityType?: string
    entityId?: string
    entityName?: string
    classId?: string
    departmentId?: string
  }>
}

// Normalized Purchase
export interface NormalizedPurchase extends NormalizedBase {
  type: 'purchase'
  paymentType: 'cash' | 'check' | 'credit_card'
  date: string
  accountId: string | null
  accountName: string
  vendorId?: string
  vendorName?: string
  amount: number
  currency: string
  exchangeRate?: number
  referenceNumber?: string
  privateNote?: string
  lineItems: NormalizedLineItem[]
  isRefund: boolean
  departmentId?: string
  departmentName?: string
}

// Normalized PurchaseOrder
export interface NormalizedPurchaseOrder extends NormalizedBase {
  type: 'purchase_order'
  vendorId: string | null
  vendorName: string
  date: string
  poNumber?: string
  status: 'open' | 'closed'
  amount: number
  currency: string
  exchangeRate?: number
  apAccountId?: string
  privateNote?: string
  lineItems: NormalizedLineItem[]
  shippingAddress?: NormalizedAddress
  departmentId?: string
  departmentName?: string
}

// Estimate status
export type EstimateStatus = 'pending' | 'accepted' | 'closed' | 'rejected'

// Normalized Estimate
export interface NormalizedEstimate extends NormalizedBase {
  type: 'estimate'
  customerId: string | null
  customerName: string
  date: string
  expirationDate?: string
  estimateNumber?: string
  status: EstimateStatus
  amount: number
  currency: string
  exchangeRate?: number
  email?: string
  billingAddress?: NormalizedAddress
  shippingAddress?: NormalizedAddress
  privateNote?: string
  memo?: string
  lineItems: NormalizedLineItem[]
  acceptedBy?: string
  acceptedDate?: string
}

// Normalized SalesReceipt
export interface NormalizedSalesReceipt extends NormalizedBase {
  type: 'sales_receipt'
  customerId: string | null
  customerName: string
  date: string
  receiptNumber?: string
  amount: number
  currency: string
  exchangeRate?: number
  depositAccountId?: string
  paymentMethodId?: string
  paymentMethodName?: string
  email?: string
  billingAddress?: NormalizedAddress
  shippingAddress?: NormalizedAddress
  privateNote?: string
  memo?: string
  lineItems: NormalizedLineItem[]
}

// Normalized CreditMemo
export interface NormalizedCreditMemo extends NormalizedBase {
  type: 'credit_memo'
  customerId: string | null
  customerName: string
  date: string
  memoNumber?: string
  amount: number
  balance: number
  remainingCredit: number
  currency: string
  exchangeRate?: number
  email?: string
  billingAddress?: NormalizedAddress
  privateNote?: string
  memo?: string
  linkedTransactions: NormalizedLinkedTxn[]
  lineItems: NormalizedLineItem[]
}

// Normalized RefundReceipt
export interface NormalizedRefundReceipt extends NormalizedBase {
  type: 'refund_receipt'
  customerId: string | null
  customerName: string
  date: string
  refundNumber?: string
  amount: number
  currency: string
  exchangeRate?: number
  depositAccountId?: string
  paymentMethodId?: string
  paymentMethodName?: string
  email?: string
  billingAddress?: NormalizedAddress
  privateNote?: string
  memo?: string
  linkedTransactions: NormalizedLinkedTxn[]
  lineItems: NormalizedLineItem[]
}

// Normalized VendorCredit
export interface NormalizedVendorCredit extends NormalizedBase {
  type: 'vendor_credit'
  vendorId: string | null
  vendorName: string
  date: string
  creditNumber?: string
  amount: number
  balance: number
  currency: string
  exchangeRate?: number
  apAccountId?: string
  privateNote?: string
  linkedTransactions: NormalizedLinkedTxn[]
  lineItems: NormalizedLineItem[]
}

// Normalized Class
export interface NormalizedClass extends NormalizedBase {
  type: 'class'
  name: string
  fullyQualifiedName?: string
  active: boolean
  isSubClass: boolean
  parentId?: string
}

// Normalized Department
export interface NormalizedDepartment extends NormalizedBase {
  type: 'department'
  name: string
  fullyQualifiedName?: string
  active: boolean
  isSubDepartment: boolean
  parentId?: string
}

// Normalized Employee
export interface NormalizedEmployee extends NormalizedBase {
  type: 'employee'
  displayName: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  mobile?: string
  address?: NormalizedAddress
  active: boolean
  hiredDate?: string
  releasedDate?: string
  employeeNumber?: string
}

// Normalized Term
export interface NormalizedTerm extends NormalizedBase {
  type: 'term'
  name: string
  active: boolean
  termType?: 'standard' | 'date_driven'
  dueDays?: number
  discountPercent?: number
  discountDays?: number
}

// Normalized PaymentMethod
export interface NormalizedPaymentMethod extends NormalizedBase {
  type: 'payment_method'
  name: string
  active: boolean
  methodType?: string
}

// Normalized TaxCode
export interface NormalizedTaxCode extends NormalizedBase {
  type: 'tax_code'
  name: string
  active: boolean
  taxable: boolean
  isTaxGroup: boolean
  description?: string
}

// Normalized TaxRate
export interface NormalizedTaxRate extends NormalizedBase {
  type: 'tax_rate'
  name: string
  active: boolean
  rateValue?: number
  agencyId?: string
  description?: string
}

// Normalized TimeActivity
export interface NormalizedTimeActivity extends NormalizedBase {
  type: 'time_activity'
  date: string
  workerType: 'employee' | 'vendor'
  workerId: string
  workerName: string
  customerId?: string
  customerName?: string
  itemId?: string
  itemName?: string
  classId?: string
  billableStatus?: 'billable' | 'not_billable' | 'billed'
  taxable: boolean
  hourlyRate?: number
  hours: number
  minutes: number
  description?: string
  startTime?: string
  endTime?: string
}

// Normalized Budget
export interface NormalizedBudget extends NormalizedBase {
  type: 'budget'
  name: string
  active: boolean
  budgetType: 'profit_and_loss' | 'balance_sheet'
  startDate: string
  endDate: string
  entryType?: 'monthly' | 'quarterly' | 'yearly'
}

// Normalized CompanyInfo
export interface NormalizedCompanyInfo extends NormalizedBase {
  type: 'company_info'
  displayName: string
  companyName?: string
  legalName?: string
  companyAddress?: NormalizedAddress
  shippingAddress?: NormalizedAddress
  email?: string
  phone?: string
  mobile?: string
  fax?: string
  website?: string
  country?: string
  qbVersion?: string
  companyFileName?: string
  resaleNumber?: string
  defaultCurrency?: string
  defaultTimeZone?: string
  preferredDeliveryMethod?: string
  taxYearEndMonth?: string
}

// Normalized Preferences
export interface NormalizedPreferences extends NormalizedBase {
  type: 'preferences'
  bookCloseDate?: string
  multiCurrencyEnabled: boolean
  isAccountsPaymentEnabled?: boolean
  defaultTermId?: string
  defaultSalesTermId?: string
  defaultCustomerMessage?: string
  isTaxTrackedOnSales?: boolean
  isTaxTrackedOnPurchases?: boolean
  isTimeTrackingEnabled?: boolean
  isEmailEnabled?: boolean
  reportBasis?: string
}

// Normalized TaxAgency
export interface NormalizedTaxAgency extends NormalizedBase {
  type: 'tax_agency'
  displayName: string
  billingAddress?: NormalizedAddress
  email?: string
  phone?: string
  website?: string
  taxIdentifier?: string
  businessNumber?: string
  taxTrackedOnSales: boolean
  taxTrackedOnPurchases: boolean
  taxRegistrationNumber?: string
  taxCountry?: string
  active: boolean
  lastFileDate?: string
}

// Normalized Attachable
export interface NormalizedAttachable extends NormalizedBase {
  type: 'attachable'
  fileName?: string
  fileRef?: string
  contentType?: string
  fileAccessUri?: string
  tempDownloadUri?: string
  latitude?: string
  longitude?: string
  placeName?: string
  note?: string
  tag?: string
  attachedEntities: Array<{
    entityId: string
    entityType: string
    includeOnSend?: boolean
  }>
}

// Normalized ExchangeRate
export interface NormalizedExchangeRate extends NormalizedBase {
  type: 'exchange_rate'
  currencyCode?: string
  exchangeRate?: number
  asOfDate?: string
  sourceCurrency?: string
  targetCurrency?: string
  rate?: number
  effectiveDate?: string
}

// Entity type to normalized type mapping
export interface NormalizedEntityMap {
  Account: NormalizedAccount
  Attachable: NormalizedAttachable
  Bill: NormalizedBill
  BillPayment: NormalizedBillPayment
  Budget: NormalizedBudget
  Class: NormalizedClass
  CompanyInfo: NormalizedCompanyInfo
  CreditMemo: NormalizedCreditMemo
  Customer: NormalizedCustomer
  Department: NormalizedDepartment
  Deposit: NormalizedDeposit
  Employee: NormalizedEmployee
  Estimate: NormalizedEstimate
  ExchangeRate: NormalizedExchangeRate
  Invoice: NormalizedInvoice
  Item: NormalizedItem
  JournalEntry: NormalizedJournalEntry
  Payment: NormalizedPayment
  PaymentMethod: NormalizedPaymentMethod
  Preferences: NormalizedPreferences
  Purchase: NormalizedPurchase
  PurchaseOrder: NormalizedPurchaseOrder
  RefundReceipt: NormalizedRefundReceipt
  SalesReceipt: NormalizedSalesReceipt
  TaxAgency: NormalizedTaxAgency
  TaxCode: NormalizedTaxCode
  TaxRate: NormalizedTaxRate
  Term: NormalizedTerm
  TimeActivity: NormalizedTimeActivity
  Transfer: NormalizedTransfer
  Vendor: NormalizedVendor
  VendorCredit: NormalizedVendorCredit
}

// All normalized entity types union
export type NormalizedEntity = NormalizedEntityMap[keyof NormalizedEntityMap]

// Generic type for getting normalized entity by QB entity type
export type NormalizedEntityFor<T extends keyof NormalizedEntityMap> = NormalizedEntityMap[T]
