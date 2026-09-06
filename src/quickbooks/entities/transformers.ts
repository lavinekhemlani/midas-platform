/**
 * QuickBooks Entity Transformers
 * Transform functions for converting raw QB entities to normalized format
 */

import type {
  QBRawInvoice,
  QBRawCustomer,
  QBRawVendor,
  QBRawBill,
  QBRawPayment,
  QBRawBillPayment,
  QBRawAccount,
  QBRawItem,
  QBRawDeposit,
  QBRawTransfer,
  QBRawJournalEntry,
  QBRawPurchase,
  QBRawPurchaseOrder,
  QBRawEstimate,
  QBRawSalesReceipt,
  QBRawCreditMemo,
  QBRawRefundReceipt,
  QBRawVendorCredit,
  QBRawClass,
  QBRawDepartment,
  QBRawEmployee,
  QBRawTerm,
  QBRawPaymentMethod,
  QBRawTaxCode,
  QBRawTaxRate,
  QBRawTimeActivity,
  QBRawBudget,
  QBRawCompanyInfo,
  QBRawPreferences,
  QBRawTaxAgency,
  QBRawAttachable,
  QBRawExchangeRate,
  QBAddress,
  QBLinkedTxn,
} from '../types/entities'

import type {
  NormalizedInvoice,
  NormalizedCustomer,
  NormalizedVendor,
  NormalizedBill,
  NormalizedPayment,
  NormalizedBillPayment,
  NormalizedAccount,
  NormalizedItem,
  NormalizedDeposit,
  NormalizedTransfer,
  NormalizedJournalEntry,
  NormalizedPurchase,
  NormalizedPurchaseOrder,
  NormalizedEstimate,
  NormalizedSalesReceipt,
  NormalizedCreditMemo,
  NormalizedRefundReceipt,
  NormalizedVendorCredit,
  NormalizedClass,
  NormalizedDepartment,
  NormalizedEmployee,
  NormalizedTerm,
  NormalizedPaymentMethod,
  NormalizedTaxCode,
  NormalizedTaxRate,
  NormalizedTimeActivity,
  NormalizedBudget,
  NormalizedCompanyInfo,
  NormalizedPreferences,
  NormalizedTaxAgency,
  NormalizedAttachable,
  NormalizedExchangeRate,
  NormalizedAddress,
  NormalizedLineItem,
  NormalizedLinkedTxn,
  InvoiceStatus,
  BillStatus,
  EstimateStatus,
  AccountClassification,
  ItemType,
} from '../types/normalized'

// ============================================================================
// Helper Functions
// ============================================================================

function transformAddress(addr?: QBAddress): NormalizedAddress | undefined {
  if (!addr) return undefined
  return {
    line1: addr.Line1,
    line2: addr.Line2,
    line3: addr.Line3,
    city: addr.City,
    state: addr.CountrySubDivisionCode,
    postalCode: addr.PostalCode,
    country: addr.Country,
  }
}

function transformLinkedTxns(linkedTxns?: QBLinkedTxn[]): NormalizedLinkedTxn[] {
  if (!linkedTxns || linkedTxns.length === 0) return []
  return linkedTxns.map((txn) => ({
    transactionId: txn.TxnId,
    transactionType: txn.TxnType,
    lineId: txn.TxnLineId,
  }))
}

function getBaseFields(raw: {
  Id: string
  SyncToken: string
  MetaData: { CreateTime: string; LastUpdatedTime: string }
}) {
  return {
    id: raw.Id,
    sourceId: raw.Id,
    syncToken: raw.SyncToken,
    createdAt: raw.MetaData.CreateTime,
    updatedAt: raw.MetaData.LastUpdatedTime,
    source: 'quickbooks' as const,
  }
}

// Helper for safe floating-point comparison (money amounts)
const EPSILON = 0.001 // $0.001 tolerance for financial precision

function isEffectivelyZero(value: number | undefined): boolean {
  return value === undefined || Math.abs(value) < EPSILON
}

function determineInvoiceStatus(raw: QBRawInvoice): InvoiceStatus {
  if (isEffectivelyZero(raw.Balance)) return 'paid'
  if (raw.Balance !== undefined && raw.Balance < raw.TotalAmt) return 'partial'
  if (raw.DueDate) {
    // Use UTC date comparison to avoid timezone-dependent race conditions
    const nowUTC = new Date().toISOString().split('T')[0]
    const dueDateUTC = raw.DueDate.split('T')[0]
    if (dueDateUTC < nowUTC) return 'overdue'
  }
  if (raw.EmailStatus === 'EmailSent') return 'sent'
  return 'draft'
}

function determineBillStatus(raw: QBRawBill): BillStatus {
  if (isEffectivelyZero(raw.Balance)) return 'paid'
  if (raw.Balance !== undefined && raw.Balance < raw.TotalAmt) return 'partial'
  if (raw.DueDate) {
    // Use UTC date comparison to avoid timezone-dependent race conditions
    const nowUTC = new Date().toISOString().split('T')[0]
    const dueDateUTC = raw.DueDate.split('T')[0]
    if (dueDateUTC < nowUTC) return 'overdue'
  }
  return 'unpaid'
}

function determineEstimateStatus(raw: QBRawEstimate): EstimateStatus {
  switch (raw.TxnStatus) {
    case 'Accepted':
      return 'accepted'
    case 'Closed':
      return 'closed'
    case 'Rejected':
      return 'rejected'
    default:
      return 'pending'
  }
}

function transformLineItems(lines: any[]): NormalizedLineItem[] {
  return lines
    .filter((line) => line.DetailType !== 'SubTotalLineDetail')
    .map((line) => {
      const salesDetail = line.SalesItemLineDetail as
        | { ItemRef?: { value: string; name?: string }; UnitPrice?: number; Qty?: number }
        | undefined
      const accountDetail = line.AccountBasedExpenseLineDetail as
        | { AccountRef?: { value: string; name?: string } }
        | undefined

      return {
        id: line.Id,
        lineNumber: line.LineNum,
        description: line.Description,
        quantity: salesDetail?.Qty ?? 1,
        unitPrice: salesDetail?.UnitPrice ?? line.Amount,
        amount: line.Amount,
        itemId: salesDetail?.ItemRef?.value,
        itemName: salesDetail?.ItemRef?.name,
        accountId: accountDetail?.AccountRef?.value,
        accountName: accountDetail?.AccountRef?.name,
      }
    })
}

// ============================================================================
// Entity Transformers
// ============================================================================

export function transformInvoice(raw: QBRawInvoice): NormalizedInvoice {
  return {
    ...getBaseFields(raw),
    type: 'invoice',
    invoiceNumber: raw.DocNumber,
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    dueDate: raw.DueDate,
    status: determineInvoiceStatus(raw),
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    subtotal: raw.TotalAmt - (raw.TxnTaxDetail?.TotalTax ?? 0),
    tax: raw.TxnTaxDetail?.TotalTax ?? 0,
    total: raw.TotalAmt,
    balance: raw.Balance,
    lineItems: transformLineItems(raw.Line),
    billingAddress: transformAddress(raw.BillAddr),
    shippingAddress: transformAddress(raw.ShipAddr),
    email: raw.BillEmail?.Address,
    memo: raw.CustomerMemo?.value,
    privateNote: raw.PrivateNote,
    classId: raw.ClassRef?.value,
    className: raw.ClassRef?.name,
    departmentId: raw.DepartmentRef?.value,
    departmentName: raw.DepartmentRef?.name,
  }
}

export function transformCustomer(raw: QBRawCustomer): NormalizedCustomer {
  return {
    ...getBaseFields(raw),
    type: 'customer',
    displayName: raw.DisplayName,
    companyName: raw.CompanyName,
    firstName: raw.GivenName,
    lastName: raw.FamilyName,
    email: raw.PrimaryEmailAddr?.Address,
    phone: raw.PrimaryPhone?.FreeFormNumber,
    mobile: raw.Mobile?.FreeFormNumber,
    balance: raw.Balance ?? 0,
    active: raw.Active,
    currency: raw.CurrencyRef?.value ?? 'USD',
    billingAddress: transformAddress(raw.BillAddr),
    shippingAddress: transformAddress(raw.ShipAddr),
    notes: raw.Notes,
    taxable: raw.Taxable,
    isJob: raw.Job ?? false,
    parentId: raw.ParentRef?.value,
  }
}

export function transformVendor(raw: QBRawVendor): NormalizedVendor {
  return {
    ...getBaseFields(raw),
    type: 'vendor',
    displayName: raw.DisplayName,
    companyName: raw.CompanyName,
    firstName: raw.GivenName,
    lastName: raw.FamilyName,
    email: raw.PrimaryEmailAddr?.Address,
    phone: raw.PrimaryPhone?.FreeFormNumber,
    mobile: raw.Mobile?.FreeFormNumber,
    balance: raw.Balance ?? 0,
    active: raw.Active,
    currency: raw.CurrencyRef?.value ?? 'USD',
    billingAddress: transformAddress(raw.BillAddr),
    taxId: raw.TaxIdentifier,
    track1099: raw.Vendor1099 ?? false,
    accountNumber: raw.AcctNum,
    termId: raw.TermRef?.value,
  }
}

export function transformBill(raw: QBRawBill): NormalizedBill {
  return {
    ...getBaseFields(raw),
    type: 'bill',
    billNumber: raw.DocNumber,
    vendorId: raw.VendorRef?.value ?? null,
    vendorName: raw.VendorRef?.name ?? '',
    date: raw.TxnDate,
    dueDate: raw.DueDate,
    status: determineBillStatus(raw),
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    total: raw.TotalAmt,
    balance: raw.Balance,
    lineItems: transformLineItems(raw.Line),
    privateNote: raw.PrivateNote,
    apAccountId: raw.APAccountRef?.value,
    departmentId: raw.DepartmentRef?.value,
    departmentName: raw.DepartmentRef?.name,
  }
}

export function transformPayment(raw: QBRawPayment): NormalizedPayment {
  return {
    ...getBaseFields(raw),
    type: 'payment',
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    amount: raw.TotalAmt,
    unappliedAmount: raw.UnappliedAmt ?? 0,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    paymentMethodId: raw.PaymentMethodRef?.value,
    paymentMethodName: raw.PaymentMethodRef?.name,
    depositAccountId: raw.DepositToAccountRef?.value,
    privateNote: raw.PrivateNote,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    appliedToInvoices: (raw.Line ?? []).flatMap((line) =>
      (line.LinkedTxn ?? [])
        .filter((txn) => txn.TxnType === 'Invoice')
        .map((txn) => ({
          invoiceId: txn.TxnId,
          amount: line.Amount,
        }))
    ),
  }
}

export function transformBillPayment(raw: QBRawBillPayment): NormalizedBillPayment {
  return {
    ...getBaseFields(raw),
    type: 'bill_payment',
    vendorId: raw.VendorRef?.value ?? null,
    vendorName: raw.VendorRef?.name ?? '',
    date: raw.TxnDate,
    amount: raw.TotalAmt,
    paymentType: raw.PayType === 'Check' ? 'check' : 'credit_card',
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    apAccountId: raw.APAccountRef?.value,
    privateNote: raw.PrivateNote,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    appliedToBills: raw.Line.flatMap((line) =>
      (line.LinkedTxn ?? [])
        .filter((txn) => txn.TxnType === 'Bill')
        .map((txn) => ({
          billId: txn.TxnId,
          amount: line.Amount,
        }))
    ),
  }
}

export function transformAccount(raw: QBRawAccount): NormalizedAccount {
  const classificationMap: Record<string, AccountClassification> = {
    Asset: 'asset',
    Liability: 'liability',
    Equity: 'equity',
    Revenue: 'revenue',
    Expense: 'expense',
  }

  return {
    ...getBaseFields(raw),
    type: 'account',
    name: raw.Name,
    fullyQualifiedName: raw.FullyQualifiedName,
    accountType: raw.AccountType,
    accountSubType: raw.AccountSubType,
    classification: raw.Classification ? classificationMap[raw.Classification] : undefined,
    balance: raw.CurrentBalance ?? 0,
    balanceWithSubAccounts: raw.CurrentBalanceWithSubAccounts ?? 0,
    currency: raw.CurrencyRef?.value ?? 'USD',
    active: raw.Active,
    isSubAccount: raw.SubAccount ?? false,
    parentId: raw.ParentRef?.value,
    description: raw.Description,
    accountNumber: raw.AcctNum,
  }
}

export function transformItem(raw: QBRawItem): NormalizedItem {
  const typeMap: Record<string, ItemType> = {
    Inventory: 'inventory',
    NonInventory: 'non_inventory',
    Service: 'service',
    Bundle: 'bundle',
    Category: 'category',
  }

  return {
    ...getBaseFields(raw),
    type: 'item',
    name: raw.Name,
    fullyQualifiedName: raw.FullyQualifiedName,
    itemType: typeMap[raw.Type] ?? 'service',
    active: raw.Active,
    unitPrice: raw.UnitPrice,
    purchaseCost: raw.PurchaseCost,
    quantityOnHand: raw.QtyOnHand,
    incomeAccountId: raw.IncomeAccountRef?.value,
    expenseAccountId: raw.ExpenseAccountRef?.value,
    assetAccountId: raw.AssetAccountRef?.value,
    description: raw.Description,
    purchaseDescription: raw.PurchaseDesc,
    taxable: raw.Taxable ?? false,
    trackQuantity: raw.TrackQtyOnHand ?? false,
    isSubItem: raw.SubItem ?? false,
    parentId: raw.ParentRef?.value,
    sku: raw.Sku,
  }
}

export function transformDeposit(raw: QBRawDeposit): NormalizedDeposit {
  return {
    ...getBaseFields(raw),
    type: 'deposit',
    date: raw.TxnDate,
    depositAccountId: raw.DepositToAccountRef?.value ?? null,
    depositAccountName: raw.DepositToAccountRef?.name ?? '',
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    privateNote: raw.PrivateNote,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    lineItems: raw.Line.map((line) => ({
      amount: line.Amount,
      accountId: line.DepositLineDetail?.AccountRef?.value,
      accountName: line.DepositLineDetail?.AccountRef?.name,
      paymentMethodId: line.DepositLineDetail?.PaymentMethodRef?.value,
      linkedTransactionId: line.LinkedTxn?.[0]?.TxnId,
      linkedTransactionType: line.LinkedTxn?.[0]?.TxnType,
    })),
  }
}

export function transformTransfer(raw: QBRawTransfer): NormalizedTransfer {
  return {
    ...getBaseFields(raw),
    type: 'transfer',
    date: raw.TxnDate,
    fromAccountId: raw.FromAccountRef?.value ?? null,
    fromAccountName: raw.FromAccountRef?.name ?? '',
    toAccountId: raw.ToAccountRef?.value ?? null,
    toAccountName: raw.ToAccountRef?.name ?? '',
    amount: raw.Amount,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    privateNote: raw.PrivateNote,
  }
}

export function transformJournalEntry(raw: QBRawJournalEntry): NormalizedJournalEntry {
  return {
    ...getBaseFields(raw),
    type: 'journal_entry',
    date: raw.TxnDate,
    entryNumber: raw.DocNumber,
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    privateNote: raw.PrivateNote,
    lines: raw.Line.map((line) => ({
      id: line.Id,
      description: line.Description,
      amount: line.Amount,
      postingType: line.JournalEntryLineDetail.PostingType.toLowerCase() as 'debit' | 'credit',
      accountId: line.JournalEntryLineDetail.AccountRef?.value ?? null,
      accountName: line.JournalEntryLineDetail.AccountRef?.name ?? '',
      entityType: line.JournalEntryLineDetail.Entity?.Type,
      entityId: line.JournalEntryLineDetail.Entity?.EntityRef?.value,
      entityName: line.JournalEntryLineDetail.Entity?.EntityRef?.name,
      classId: line.JournalEntryLineDetail.ClassRef?.value,
      departmentId: line.JournalEntryLineDetail.DepartmentRef?.value,
    })),
  }
}

export function transformPurchase(raw: QBRawPurchase): NormalizedPurchase {
  const paymentTypeMap: Record<string, 'cash' | 'check' | 'credit_card'> = {
    Cash: 'cash',
    Check: 'check',
    CreditCard: 'credit_card',
  }

  return {
    ...getBaseFields(raw),
    type: 'purchase',
    paymentType: paymentTypeMap[raw.PaymentType] ?? 'cash',
    date: raw.TxnDate,
    accountId: raw.AccountRef?.value ?? null,
    accountName: raw.AccountRef?.name ?? '',
    vendorId: raw.EntityRef?.value,
    vendorName: raw.EntityRef?.name,
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    referenceNumber: raw.DocNumber,
    privateNote: raw.PrivateNote,
    lineItems: transformLineItems(raw.Line),
    isRefund: raw.Credit ?? false,
    departmentId: raw.DepartmentRef?.value,
    departmentName: raw.DepartmentRef?.name,
  }
}

export function transformPurchaseOrder(raw: QBRawPurchaseOrder): NormalizedPurchaseOrder {
  return {
    ...getBaseFields(raw),
    type: 'purchase_order',
    vendorId: raw.VendorRef?.value ?? null,
    vendorName: raw.VendorRef?.name ?? '',
    date: raw.TxnDate,
    poNumber: raw.DocNumber,
    status: raw.POStatus === 'Closed' ? 'closed' : 'open',
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    apAccountId: raw.APAccountRef?.value,
    privateNote: raw.PrivateNote,
    lineItems: transformLineItems(raw.Line),
    shippingAddress: transformAddress(raw.ShipAddr),
    departmentId: raw.DepartmentRef?.value,
    departmentName: raw.DepartmentRef?.name,
  }
}

export function transformEstimate(raw: QBRawEstimate): NormalizedEstimate {
  return {
    ...getBaseFields(raw),
    type: 'estimate',
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    expirationDate: raw.ExpirationDate,
    estimateNumber: raw.DocNumber,
    status: determineEstimateStatus(raw),
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    email: raw.BillEmail?.Address,
    billingAddress: transformAddress(raw.BillAddr),
    shippingAddress: transformAddress(raw.ShipAddr),
    privateNote: raw.PrivateNote,
    memo: raw.CustomerMemo?.value,
    lineItems: transformLineItems(raw.Line),
    acceptedBy: raw.AcceptedBy,
    acceptedDate: raw.AcceptedDate,
  }
}

export function transformSalesReceipt(raw: QBRawSalesReceipt): NormalizedSalesReceipt {
  return {
    ...getBaseFields(raw),
    type: 'sales_receipt',
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    receiptNumber: raw.DocNumber,
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    depositAccountId: raw.DepositToAccountRef?.value,
    paymentMethodId: raw.PaymentMethodRef?.value,
    paymentMethodName: raw.PaymentMethodRef?.name,
    email: raw.BillEmail?.Address,
    billingAddress: transformAddress(raw.BillAddr),
    shippingAddress: transformAddress(raw.ShipAddr),
    privateNote: raw.PrivateNote,
    memo: raw.CustomerMemo?.value,
    lineItems: transformLineItems(raw.Line),
  }
}

export function transformCreditMemo(raw: QBRawCreditMemo): NormalizedCreditMemo {
  return {
    ...getBaseFields(raw),
    type: 'credit_memo',
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    memoNumber: raw.DocNumber,
    amount: raw.TotalAmt,
    balance: raw.Balance,
    remainingCredit: raw.RemainingCredit,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    email: raw.BillEmail?.Address,
    billingAddress: transformAddress(raw.BillAddr),
    privateNote: raw.PrivateNote,
    memo: raw.CustomerMemo?.value,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    lineItems: transformLineItems(raw.Line),
  }
}

export function transformRefundReceipt(raw: QBRawRefundReceipt): NormalizedRefundReceipt {
  return {
    ...getBaseFields(raw),
    type: 'refund_receipt',
    customerId: raw.CustomerRef?.value ?? null,
    customerName: raw.CustomerRef?.name ?? '',
    date: raw.TxnDate,
    refundNumber: raw.DocNumber,
    amount: raw.TotalAmt,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    depositAccountId: raw.DepositToAccountRef?.value,
    paymentMethodId: raw.PaymentMethodRef?.value,
    paymentMethodName: raw.PaymentMethodRef?.name,
    email: raw.BillEmail?.Address,
    billingAddress: transformAddress(raw.BillAddr),
    privateNote: raw.PrivateNote,
    memo: raw.CustomerMemo?.value,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    lineItems: transformLineItems(raw.Line),
  }
}

export function transformVendorCredit(raw: QBRawVendorCredit): NormalizedVendorCredit {
  return {
    ...getBaseFields(raw),
    type: 'vendor_credit',
    vendorId: raw.VendorRef?.value ?? null,
    vendorName: raw.VendorRef?.name ?? '',
    date: raw.TxnDate,
    creditNumber: raw.DocNumber,
    amount: raw.TotalAmt,
    balance: raw.Balance,
    currency: raw.CurrencyRef?.value ?? 'USD',
    exchangeRate: raw.ExchangeRate,
    apAccountId: raw.APAccountRef?.value,
    privateNote: raw.PrivateNote,
    linkedTransactions: transformLinkedTxns(raw.LinkedTxn),
    lineItems: transformLineItems(raw.Line),
  }
}

export function transformClass(raw: QBRawClass): NormalizedClass {
  return {
    ...getBaseFields(raw),
    type: 'class',
    name: raw.Name,
    fullyQualifiedName: raw.FullyQualifiedName,
    active: raw.Active,
    isSubClass: raw.SubClass ?? false,
    parentId: raw.ParentRef?.value,
  }
}

export function transformDepartment(raw: QBRawDepartment): NormalizedDepartment {
  return {
    ...getBaseFields(raw),
    type: 'department',
    name: raw.Name,
    fullyQualifiedName: raw.FullyQualifiedName,
    active: raw.Active,
    isSubDepartment: raw.SubDepartment ?? false,
    parentId: raw.ParentRef?.value,
  }
}

export function transformEmployee(raw: QBRawEmployee): NormalizedEmployee {
  return {
    ...getBaseFields(raw),
    type: 'employee',
    displayName: raw.DisplayName,
    firstName: raw.GivenName,
    lastName: raw.FamilyName,
    email: raw.PrimaryEmailAddr?.Address,
    phone: raw.PrimaryPhone?.FreeFormNumber,
    mobile: raw.Mobile?.FreeFormNumber,
    address: transformAddress(raw.PrimaryAddr),
    active: raw.Active,
    hiredDate: raw.HiredDate,
    releasedDate: raw.ReleasedDate,
    employeeNumber: raw.EmployeeNumber,
  }
}

export function transformTerm(raw: QBRawTerm): NormalizedTerm {
  return {
    ...getBaseFields(raw),
    type: 'term',
    name: raw.Name,
    active: raw.Active,
    termType: raw.Type?.toLowerCase() as 'standard' | 'date_driven' | undefined,
    dueDays: raw.DueDays,
    discountPercent: raw.DiscountPercent,
    discountDays: raw.DiscountDays,
  }
}

export function transformPaymentMethod(raw: QBRawPaymentMethod): NormalizedPaymentMethod {
  return {
    ...getBaseFields(raw),
    type: 'payment_method',
    name: raw.Name,
    active: raw.Active,
    methodType: raw.Type,
  }
}

export function transformTaxCode(raw: QBRawTaxCode): NormalizedTaxCode {
  return {
    ...getBaseFields(raw),
    type: 'tax_code',
    name: raw.Name,
    active: raw.Active,
    taxable: raw.Taxable ?? false,
    isTaxGroup: raw.TaxGroup ?? false,
    description: raw.Description,
  }
}

export function transformTaxRate(raw: QBRawTaxRate): NormalizedTaxRate {
  return {
    ...getBaseFields(raw),
    type: 'tax_rate',
    name: raw.Name,
    active: raw.Active,
    rateValue: raw.RateValue,
    agencyId: raw.AgencyRef?.value,
    description: raw.Description,
  }
}

export function transformTimeActivity(raw: QBRawTimeActivity): NormalizedTimeActivity {
  const billableMap: Record<string, 'billable' | 'not_billable' | 'billed'> = {
    Billable: 'billable',
    NotBillable: 'not_billable',
    HasBeenBilled: 'billed',
  }

  return {
    ...getBaseFields(raw),
    type: 'time_activity',
    date: raw.TxnDate,
    workerType: raw.NameOf.toLowerCase() as 'employee' | 'vendor',
    workerId: raw.EmployeeRef?.value ?? raw.VendorRef?.value ?? '',
    workerName: raw.EmployeeRef?.name ?? raw.VendorRef?.name ?? '',
    customerId: raw.CustomerRef?.value,
    customerName: raw.CustomerRef?.name,
    itemId: raw.ItemRef?.value,
    itemName: raw.ItemRef?.name,
    classId: raw.ClassRef?.value,
    billableStatus: raw.BillableStatus ? billableMap[raw.BillableStatus] : undefined,
    taxable: raw.Taxable ?? false,
    hourlyRate: raw.HourlyRate,
    hours: raw.Hours ?? 0,
    minutes: raw.Minutes ?? 0,
    description: raw.Description,
    startTime: raw.StartTime,
    endTime: raw.EndTime,
  }
}

export function transformBudget(raw: QBRawBudget): NormalizedBudget {
  const entryTypeMap: Record<string, 'monthly' | 'quarterly' | 'yearly'> = {
    Monthly: 'monthly',
    Quarterly: 'quarterly',
    Yearly: 'yearly',
  }

  return {
    ...getBaseFields(raw),
    type: 'budget',
    name: raw.Name,
    active: raw.Active,
    budgetType: raw.BudgetType === 'BalanceSheet' ? 'balance_sheet' : 'profit_and_loss',
    startDate: raw.StartDate,
    endDate: raw.EndDate,
    entryType: raw.BudgetEntryType ? entryTypeMap[raw.BudgetEntryType] : undefined,
  }
}

export function transformCompanyInfo(raw: QBRawCompanyInfo): NormalizedCompanyInfo {
  return {
    ...getBaseFields(raw),
    type: 'company_info',
    displayName: raw.CompanyName || raw.LegalName || '',
    companyName: raw.CompanyName,
    legalName: raw.LegalName,
    companyAddress: transformAddress(raw.CompanyAddr),
    shippingAddress: transformAddress(raw.LegalAddr),
    email: raw.Email?.Address,
    phone: raw.PrimaryPhone?.FreeFormNumber,
    mobile: raw.Mobile?.FreeFormNumber,
    fax: raw.Fax?.FreeFormNumber,
    website: raw.WebAddr?.URI,
    country: raw.Country,
    qbVersion: raw.QBVersion,
    companyFileName: raw.CompanyFileName,
    resaleNumber: raw.ResaleNum,
    defaultCurrency: raw.HomeCurrency?.value,
    defaultTimeZone: raw.DefaultTimeZone,
    preferredDeliveryMethod: raw.PreferredDeliveryMethod,
    taxYearEndMonth: raw.TaxYearEndMonth,
  }
}

export function transformPreferences(raw: QBRawPreferences): NormalizedPreferences {
  return {
    ...getBaseFields(raw),
    type: 'preferences',
    bookCloseDate: raw.AccountingInfoPrefs?.BookCloseDate,
    multiCurrencyEnabled: raw.CurrencyPrefs?.MultiCurrencyEnabled ?? false,
    isAccountsPaymentEnabled: raw.ProductAndServicesPrefs?.ForSales,
    defaultTermId: raw.SalesFormsPrefs?.DefaultTerms?.value,
    defaultSalesTermId: raw.SalesFormsPrefs?.DefaultTerms?.value,
    defaultCustomerMessage: raw.SalesFormsPrefs?.DefaultCustomerMessage,
    isTaxTrackedOnSales: raw.TaxPrefs?.UsingSalesTax,
    isTaxTrackedOnPurchases: raw.TaxPrefs?.UsingSalesTax,
    isTimeTrackingEnabled: raw.TimeTrackingPrefs?.UseServices,
    isEmailEnabled: raw.EmailMessagesPrefs?.AllowServiceAutoInvoicing,
    reportBasis: raw.ReportPrefs?.ReportBasis,
  }
}

export function transformTaxAgency(raw: QBRawTaxAgency): NormalizedTaxAgency {
  return {
    ...getBaseFields(raw),
    type: 'tax_agency',
    displayName: raw.DisplayName,
    billingAddress: transformAddress(raw.BillAddr),
    email: raw.PrimaryEmailAddr?.Address,
    phone: raw.PrimaryPhone?.FreeFormNumber,
    website: raw.WebAddr?.URI,
    taxIdentifier: raw.TaxIdentifier,
    businessNumber: raw.BusinessNumber,
    taxTrackedOnSales: raw.TaxTrackedOnSales ?? false,
    taxTrackedOnPurchases: raw.TaxTrackedOnPurchases ?? false,
    taxRegistrationNumber: raw.TaxRegistrationNumber,
    taxCountry: raw.TaxReportingBasis,
    active: raw.Active ?? true,
    lastFileDate: raw.LastFileDate,
  }
}

export function transformAttachable(raw: QBRawAttachable): NormalizedAttachable {
  return {
    ...getBaseFields(raw),
    type: 'attachable',
    fileName: raw.FileName,
    fileRef: raw.FileAccessUri,
    contentType: raw.ContentType,
    fileAccessUri: raw.FileAccessUri,
    tempDownloadUri: raw.TempDownloadUri,
    latitude: raw.Lat,
    longitude: raw.Long,
    placeName: raw.PlaceName,
    note: raw.Note,
    tag: raw.Tag,
    attachedEntities: (raw.AttachableRef ?? []).map((ref) => ({
      entityId: ref.EntityRef?.value ?? '',
      entityType: ref.EntityRef?.type ?? '',
      includeOnSend: ref.IncludeOnSend,
    })),
  }
}

export function transformExchangeRate(raw: QBRawExchangeRate): NormalizedExchangeRate {
  return {
    ...getBaseFields(raw),
    type: 'exchange_rate',
    currencyCode: raw.SourceCurrencyCode,
    exchangeRate: raw.Rate,
    asOfDate: raw.AsOfDate,
    sourceCurrency: raw.SourceCurrencyCode,
    targetCurrency: raw.TargetCurrencyCode,
    rate: raw.Rate,
    effectiveDate: raw.AsOfDate,
  }
}
