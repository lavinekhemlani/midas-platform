/**
 * QuickBooks Raw Entity Type Definitions
 * These types represent the raw data structures returned by the QuickBooks API
 */

// All QuickBooks entity types
export type QBEntityType =
  | 'Account'
  | 'Attachable'
  | 'Bill'
  | 'BillPayment'
  | 'Budget'
  | 'Class'
  | 'CompanyInfo'
  | 'CreditMemo'
  | 'Customer'
  | 'Department'
  | 'Deposit'
  | 'Employee'
  | 'Estimate'
  | 'ExchangeRate'
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

// Base interface all QB entities share
export interface QBBaseEntity {
  Id: string
  SyncToken: string
  MetaData: {
    CreateTime: string
    LastUpdatedTime: string
  }
}

// Reference pattern used throughout QB API
export interface QBRef {
  value: string
  name?: string
  type?: string
}

// Address structure
export interface QBAddress {
  Id?: string
  Line1?: string
  Line2?: string
  Line3?: string
  City?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  Country?: string
  Lat?: string
  Long?: string
}

// Email address
export interface QBEmailAddress {
  Address: string
}

// Phone number
export interface QBPhoneNumber {
  FreeFormNumber: string
}

// Line item base
export interface QBLineItem {
  Id?: string
  LineNum?: number
  Description?: string
  Amount: number
  DetailType: string
}

// Linked transaction reference
export interface QBLinkedTxn {
  TxnId: string
  TxnType: string
  TxnLineId?: string
}

// Sales item line detail
export interface QBSalesItemLineDetail {
  ItemRef?: QBRef
  UnitPrice?: number
  Qty?: number
  TaxCodeRef?: QBRef
  ServiceDate?: string
}

// Account-based expense line detail
export interface QBAccountBasedExpenseLineDetail {
  AccountRef: QBRef
  TaxCodeRef?: QBRef
  BillableStatus?: 'Billable' | 'NotBillable' | 'HasBeenBilled'
  CustomerRef?: QBRef
}

// Raw Invoice
export interface QBRawInvoice extends QBBaseEntity {
  DocNumber?: string
  TxnDate: string
  DueDate?: string
  CustomerRef: QBRef
  Line: QBLineItem[]
  TotalAmt: number
  Balance: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent'
  BillEmail?: QBEmailAddress
  ShipAddr?: QBAddress
  BillAddr?: QBAddress
  PrivateNote?: string
  CustomerMemo?: { value: string }
  TxnTaxDetail?: {
    TotalTax?: number
    TaxLine?: Array<{
      Amount: number
      DetailType: string
      TaxLineDetail?: {
        TaxRateRef: QBRef
        PercentBased?: boolean
        TaxPercent?: number
        NetAmountTaxable?: number
      }
    }>
  }
  LinkedTxn?: QBLinkedTxn[]
  ClassRef?: QBRef
  DepartmentRef?: QBRef
}

// Raw Customer
export interface QBRawCustomer extends QBBaseEntity {
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  FullyQualifiedName?: string
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  Mobile?: QBPhoneNumber
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  Balance?: number
  BalanceWithJobs?: number
  Active: boolean
  CurrencyRef?: QBRef
  PreferredDeliveryMethod?: string
  Taxable?: boolean
  Notes?: string
  Job?: boolean
  ParentRef?: QBRef
}

// Raw Vendor
export interface QBRawVendor extends QBBaseEntity {
  DisplayName: string
  CompanyName?: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  Mobile?: QBPhoneNumber
  BillAddr?: QBAddress
  Balance?: number
  Active: boolean
  CurrencyRef?: QBRef
  TaxIdentifier?: string
  Vendor1099?: boolean
  AcctNum?: string
  TermRef?: QBRef
}

// Raw Bill
export interface QBRawBill extends QBBaseEntity {
  VendorRef: QBRef
  TxnDate: string
  DueDate?: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  Balance: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  APAccountRef?: QBRef
  PrivateNote?: string
  LinkedTxn?: QBLinkedTxn[]
  DepartmentRef?: QBRef
}

// Raw Payment
export interface QBRawPayment extends QBBaseEntity {
  CustomerRef: QBRef
  TxnDate: string
  TotalAmt: number
  UnappliedAmt?: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  PaymentMethodRef?: QBRef
  DepositToAccountRef?: QBRef
  PrivateNote?: string
  LinkedTxn?: QBLinkedTxn[]
  Line?: Array<{
    Amount: number
    LinkedTxn: QBLinkedTxn[]
  }>
}

// Raw BillPayment
export interface QBRawBillPayment extends QBBaseEntity {
  VendorRef: QBRef
  TxnDate: string
  TotalAmt: number
  PayType: 'Check' | 'CreditCard'
  CurrencyRef?: QBRef
  ExchangeRate?: number
  APAccountRef?: QBRef
  PrivateNote?: string
  LinkedTxn?: QBLinkedTxn[]
  Line: Array<{
    Amount: number
    LinkedTxn: QBLinkedTxn[]
  }>
  CheckPayment?: {
    BankAccountRef: QBRef
  }
  CreditCardPayment?: {
    CCAccountRef: QBRef
  }
}

// Raw Account
export interface QBRawAccount extends QBBaseEntity {
  Name: string
  FullyQualifiedName?: string
  AccountType: string
  AccountSubType?: string
  Classification?: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue'
  CurrentBalance?: number
  CurrentBalanceWithSubAccounts?: number
  CurrencyRef?: QBRef
  Active: boolean
  SubAccount?: boolean
  ParentRef?: QBRef
  Description?: string
  AcctNum?: string
}

// Raw Item
export interface QBRawItem extends QBBaseEntity {
  Name: string
  FullyQualifiedName?: string
  Type: 'Inventory' | 'NonInventory' | 'Service' | 'Bundle' | 'Category'
  Active: boolean
  UnitPrice?: number
  PurchaseCost?: number
  QtyOnHand?: number
  IncomeAccountRef?: QBRef
  ExpenseAccountRef?: QBRef
  AssetAccountRef?: QBRef
  Description?: string
  PurchaseDesc?: string
  Taxable?: boolean
  TrackQtyOnHand?: boolean
  SubItem?: boolean
  ParentRef?: QBRef
  Sku?: string
}

// Raw Deposit
export interface QBRawDeposit extends QBBaseEntity {
  TxnDate: string
  DepositToAccountRef: QBRef
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  PrivateNote?: string
  LinkedTxn?: QBLinkedTxn[]
  Line: Array<{
    Amount: number
    DetailType: string
    DepositLineDetail?: {
      AccountRef?: QBRef
      PaymentMethodRef?: QBRef
    }
    LinkedTxn?: QBLinkedTxn[]
  }>
}

// Raw Transfer
export interface QBRawTransfer extends QBBaseEntity {
  TxnDate: string
  FromAccountRef: QBRef
  ToAccountRef: QBRef
  Amount: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  PrivateNote?: string
}

// Raw JournalEntry
export interface QBRawJournalEntry extends QBBaseEntity {
  TxnDate: string
  DocNumber?: string
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  PrivateNote?: string
  Line: Array<{
    Id?: string
    Description?: string
    Amount: number
    DetailType: 'JournalEntryLineDetail'
    JournalEntryLineDetail: {
      PostingType: 'Debit' | 'Credit'
      AccountRef: QBRef
      Entity?: {
        Type: string
        EntityRef: QBRef
      }
      ClassRef?: QBRef
      DepartmentRef?: QBRef
    }
  }>
}

// Raw Purchase (expense/check)
export interface QBRawPurchase extends QBBaseEntity {
  PaymentType: 'Cash' | 'Check' | 'CreditCard'
  TxnDate: string
  AccountRef: QBRef
  EntityRef?: QBRef
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  DocNumber?: string
  PrivateNote?: string
  Line: QBLineItem[]
  Credit?: boolean
  DepartmentRef?: QBRef
}

// Raw PurchaseOrder
export interface QBRawPurchaseOrder extends QBBaseEntity {
  VendorRef: QBRef
  TxnDate: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  APAccountRef?: QBRef
  PrivateNote?: string
  POStatus?: 'Open' | 'Closed'
  DepartmentRef?: QBRef
  ShipAddr?: QBAddress
}

// Raw Estimate
export interface QBRawEstimate extends QBBaseEntity {
  CustomerRef: QBRef
  TxnDate: string
  ExpirationDate?: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  BillEmail?: QBEmailAddress
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  PrivateNote?: string
  CustomerMemo?: { value: string }
  TxnStatus?: 'Pending' | 'Accepted' | 'Closed' | 'Rejected'
  AcceptedBy?: string
  AcceptedDate?: string
}

// Raw SalesReceipt
export interface QBRawSalesReceipt extends QBBaseEntity {
  CustomerRef: QBRef
  TxnDate: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  DepositToAccountRef?: QBRef
  PaymentMethodRef?: QBRef
  BillEmail?: QBEmailAddress
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  PrivateNote?: string
  CustomerMemo?: { value: string }
}

// Raw CreditMemo
export interface QBRawCreditMemo extends QBBaseEntity {
  CustomerRef: QBRef
  TxnDate: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  Balance: number
  RemainingCredit: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  BillEmail?: QBEmailAddress
  BillAddr?: QBAddress
  PrivateNote?: string
  CustomerMemo?: { value: string }
  LinkedTxn?: QBLinkedTxn[]
}

// Raw RefundReceipt
export interface QBRawRefundReceipt extends QBBaseEntity {
  CustomerRef: QBRef
  TxnDate: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  DepositToAccountRef?: QBRef
  PaymentMethodRef?: QBRef
  BillEmail?: QBEmailAddress
  BillAddr?: QBAddress
  PrivateNote?: string
  CustomerMemo?: { value: string }
  LinkedTxn?: QBLinkedTxn[]
}

// Raw VendorCredit
export interface QBRawVendorCredit extends QBBaseEntity {
  VendorRef: QBRef
  TxnDate: string
  DocNumber?: string
  Line: QBLineItem[]
  TotalAmt: number
  Balance: number
  CurrencyRef?: QBRef
  ExchangeRate?: number
  APAccountRef?: QBRef
  PrivateNote?: string
  LinkedTxn?: QBLinkedTxn[]
}

// Raw Class
export interface QBRawClass extends QBBaseEntity {
  Name: string
  FullyQualifiedName?: string
  Active: boolean
  SubClass?: boolean
  ParentRef?: QBRef
}

// Raw Department
export interface QBRawDepartment extends QBBaseEntity {
  Name: string
  FullyQualifiedName?: string
  Active: boolean
  SubDepartment?: boolean
  ParentRef?: QBRef
}

// Raw Employee
export interface QBRawEmployee extends QBBaseEntity {
  DisplayName: string
  GivenName?: string
  FamilyName?: string
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  Mobile?: QBPhoneNumber
  PrimaryAddr?: QBAddress
  Active: boolean
  HiredDate?: string
  ReleasedDate?: string
  SSN?: string
  EmployeeNumber?: string
}

// Raw Term
export interface QBRawTerm extends QBBaseEntity {
  Name: string
  Active: boolean
  Type?: 'STANDARD' | 'DATE_DRIVEN'
  DueDays?: number
  DiscountPercent?: number
  DiscountDays?: number
}

// Raw PaymentMethod
export interface QBRawPaymentMethod extends QBBaseEntity {
  Name: string
  Active: boolean
  Type?: string
}

// Raw TaxCode
export interface QBRawTaxCode extends QBBaseEntity {
  Name: string
  Active: boolean
  Taxable?: boolean
  TaxGroup?: boolean
  Description?: string
  SalesTaxRateList?: {
    TaxRateDetail: Array<{
      TaxRateRef: QBRef
      TaxTypeApplicable: string
      TaxOrder: number
    }>
  }
  PurchaseTaxRateList?: {
    TaxRateDetail: Array<{
      TaxRateRef: QBRef
      TaxTypeApplicable: string
      TaxOrder: number
    }>
  }
}

// Raw TaxRate
export interface QBRawTaxRate extends QBBaseEntity {
  Name: string
  Active: boolean
  RateValue?: number
  AgencyRef?: QBRef
  Description?: string
  SpecialTaxType?: string
  DisplayType?: string
}

// Raw TimeActivity
export interface QBRawTimeActivity extends QBBaseEntity {
  TxnDate: string
  NameOf: 'Employee' | 'Vendor'
  EmployeeRef?: QBRef
  VendorRef?: QBRef
  CustomerRef?: QBRef
  ItemRef?: QBRef
  ClassRef?: QBRef
  BillableStatus?: 'Billable' | 'NotBillable' | 'HasBeenBilled'
  Taxable?: boolean
  HourlyRate?: number
  Hours?: number
  Minutes?: number
  Description?: string
  StartTime?: string
  EndTime?: string
}

// Raw Budget
export interface QBRawBudget extends QBBaseEntity {
  Name: string
  Active: boolean
  BudgetType: 'ProfitAndLoss' | 'BalanceSheet'
  StartDate: string
  EndDate: string
  BudgetEntryType?: 'Monthly' | 'Quarterly' | 'Yearly'
}

// Raw CompanyInfo - Company details (read-only, singleton)
export interface QBRawCompanyInfo extends QBBaseEntity {
  CompanyName: string
  LegalName?: string
  CompanyAddr?: QBAddress
  CustomerCommunicationAddr?: QBAddress
  LegalAddr?: QBAddress
  PrimaryPhone?: QBPhoneNumber
  Mobile?: QBPhoneNumber
  Fax?: QBPhoneNumber
  CompanyStartDate?: string
  FiscalYearStartMonth?: string
  Country?: string
  Email?: QBEmailAddress
  WebAddr?: { URI: string }
  SupportedLanguages?: string
  NameValue?: Array<{ Name: string; Value: string }>
  QBVersion?: string
  CompanyFileName?: string
  ResaleNum?: string
  HomeCurrency?: QBRef
  DefaultTimeZone?: string
  PreferredDeliveryMethod?: string
  TaxYearEndMonth?: string
}

// Raw Preferences - Company settings (read-only, singleton)
export interface QBRawPreferences extends QBBaseEntity {
  AccountingInfoPrefs?: {
    FirstMonthOfFiscalYear?: string
    UseAccountNumbers?: boolean
    TaxYearMonth?: string
    ClassTrackingPerTxn?: boolean
    ClassTrackingPerTxnLine?: boolean
    TrackDepartments?: boolean
    DepartmentTerminology?: string
    BookCloseDate?: string
  }
  ProductAndServicesPrefs?: {
    ForSales?: boolean
    ForPurchase?: boolean
    QuantityWithPriceAndRate?: boolean
    QuantityOnHand?: boolean
  }
  SalesFormsPrefs?: {
    CustomField?: Array<{ Name: string; Type: string; StringValue?: string }>
    CustomTxnNumbers?: boolean
    AllowDeposit?: boolean
    AllowDiscount?: boolean
    DefaultDiscountAccount?: string
    AllowEstimates?: boolean
    ETransactionEnabledStatus?: string
    ETransactionPaymentEnabled?: boolean
    IPNSupportEnabled?: boolean
    AllowServiceDate?: boolean
    AllowShipping?: boolean
    DefaultShippingAccount?: string
    DefaultTerms?: QBRef
    DefaultCustomerMessage?: string
  }
  EmailMessagesPrefs?: {
    InvoiceMessage?: { Subject?: string; Message?: string }
    EstimateMessage?: { Subject?: string; Message?: string }
    SalesReceiptMessage?: { Subject?: string; Message?: string }
    StatementMessage?: { Subject?: string; Message?: string }
    AllowServiceAutoInvoicing?: boolean
  }
  VendorAndPurchasesPrefs?: {
    TrackingByCustomer?: boolean
    BillableExpenseTracking?: boolean
    DefaultTerms?: QBRef
    DefaultMarkup?: number
    POCustomField?: Array<{ Name: string; Type: string; StringValue?: string }>
  }
  TimeTrackingPrefs?: {
    UseServices?: boolean
    BillCustomers?: boolean
    ShowBillRateToAll?: boolean
    WorkWeekStartDate?: string
    MarkTimeEntriesBillable?: boolean
  }
  TaxPrefs?: {
    UsingSalesTax?: boolean
    TaxGroupCodeRef?: QBRef
  }
  CurrencyPrefs?: {
    MultiCurrencyEnabled?: boolean
    HomeCurrency?: QBRef
  }
  ReportPrefs?: {
    ReportBasis?: 'Accrual' | 'Cash'
    CalcAgingReportFromTxnDate?: boolean
  }
  OtherPrefs?: {
    NameValue?: Array<{ Name: string; Value: string }>
  }
}

// Raw TaxAgency - Tax authority
export interface QBRawTaxAgency extends QBBaseEntity {
  DisplayName: string
  TaxRegistrationNumber?: string
  TaxAgencyConfig?: string
  TaxTrackedOnPurchases?: boolean
  TaxTrackedOnSales?: boolean
  LastFileDate?: string
  BillAddr?: QBAddress
  PrimaryEmailAddr?: QBEmailAddress
  PrimaryPhone?: QBPhoneNumber
  WebAddr?: { URI: string }
  TaxIdentifier?: string
  BusinessNumber?: string
  TaxReportingBasis?: string
  Active?: boolean
}

// Raw Attachable - File attachment
export interface QBRawAttachable extends QBBaseEntity {
  FileName?: string
  FileAccessUri?: string
  TempDownloadUri?: string
  Size?: number
  ContentType?: string
  Category?: string
  Lat?: string
  Long?: string
  PlaceName?: string
  Note?: string
  Tag?: string
  ThumbnailFileAccessUri?: string
  ThumbnailTempDownloadUri?: string
  AttachableRef?: Array<{
    EntityRef?: QBRef
    IncludeOnSend?: boolean
    LineInfo?: string
    NoRefOnly?: boolean
    CustomField?: Array<{ Name: string; Type: string; StringValue?: string }>
    Inactive?: boolean
  }>
}

// Raw ExchangeRate - Currency exchange rate
export interface QBRawExchangeRate extends QBBaseEntity {
  SourceCurrencyCode: string
  TargetCurrencyCode: string
  Rate: number
  AsOfDate: string
}

// Type mapping for raw entities
export interface QBRawEntityMap {
  Account: QBRawAccount
  Attachable: QBRawAttachable
  Bill: QBRawBill
  BillPayment: QBRawBillPayment
  Budget: QBRawBudget
  Class: QBRawClass
  CompanyInfo: QBRawCompanyInfo
  CreditMemo: QBRawCreditMemo
  Customer: QBRawCustomer
  Department: QBRawDepartment
  Deposit: QBRawDeposit
  Employee: QBRawEmployee
  Estimate: QBRawEstimate
  ExchangeRate: QBRawExchangeRate
  Invoice: QBRawInvoice
  Item: QBRawItem
  JournalEntry: QBRawJournalEntry
  Payment: QBRawPayment
  PaymentMethod: QBRawPaymentMethod
  Preferences: QBRawPreferences
  Purchase: QBRawPurchase
  PurchaseOrder: QBRawPurchaseOrder
  RefundReceipt: QBRawRefundReceipt
  SalesReceipt: QBRawSalesReceipt
  TaxAgency: QBRawTaxAgency
  TaxCode: QBRawTaxCode
  TaxRate: QBRawTaxRate
  Term: QBRawTerm
  TimeActivity: QBRawTimeActivity
  Transfer: QBRawTransfer
  Vendor: QBRawVendor
  VendorCredit: QBRawVendorCredit
}

// Generic type for accessing raw entity by type
export type QBRawEntity<T extends QBEntityType> = T extends keyof QBRawEntityMap
  ? QBRawEntityMap[T]
  : QBBaseEntity
