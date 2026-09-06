/**
 * QuickBooks API Response Validation Schemas
 *
 * Zod schemas for runtime validation of QuickBooks API responses.
 * This ensures type safety beyond TypeScript's compile-time checks.
 *
 * @module quickbooks/validation/schemas
 */

import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * QuickBooks reference schema (used throughout API)
 */
export const QBRefSchema = z.object({
  value: z.string(),
  name: z.string().optional(),
})

/**
 * QuickBooks metadata schema
 */
export const QBMetaDataSchema = z.object({
  CreateTime: z.string(),
  LastUpdatedTime: z.string(),
})

/**
 * QuickBooks address schema
 */
export const QBAddressSchema = z.object({
  Id: z.string().optional(),
  Line1: z.string().optional(),
  Line2: z.string().optional(),
  Line3: z.string().optional(),
  City: z.string().optional(),
  CountrySubDivisionCode: z.string().optional(),
  PostalCode: z.string().optional(),
  Country: z.string().optional(),
  Lat: z.string().optional(),
  Long: z.string().optional(),
})

/**
 * QuickBooks email address schema
 */
export const QBEmailAddressSchema = z.object({
  Address: z.string(),
})

/**
 * QuickBooks phone number schema
 */
export const QBPhoneNumberSchema = z.object({
  FreeFormNumber: z.string(),
})

// ============================================================================
// Token Response Schema
// ============================================================================

/**
 * OAuth token response from intuit-oauth library
 */
export const QBTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  token_type: z.string().optional(),
  x_refresh_token_expires_in: z.number().optional(),
  realmId: z.string().optional(),
})

/**
 * Internal QBToken schema
 */
export const QBTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  realmId: z.string(),
})

// ============================================================================
// Query Response Schema
// ============================================================================

/**
 * QuickBooks Query Response schema
 * The API returns: { QueryResponse: { EntityType: [...entities] }, time: "..." }
 */
export const QBQueryResponseSchema = z.object({
  QueryResponse: z.record(z.array(z.unknown())).optional(),
  time: z.string().optional(),
})

// ============================================================================
// Company Info Schema
// ============================================================================

/**
 * QuickBooks CompanyInfo response schema
 */
export const QBCompanyInfoSchema = z.object({
  CompanyInfo: z.object({
    Id: z.string(),
    SyncToken: z.string(),
    MetaData: QBMetaDataSchema,
    CompanyName: z.string(),
    LegalName: z.string().optional(),
    CompanyAddr: QBAddressSchema.optional(),
    CustomerCommunicationAddr: QBAddressSchema.optional(),
    LegalAddr: QBAddressSchema.optional(),
    PrimaryPhone: QBPhoneNumberSchema.optional(),
    CompanyStartDate: z.string().optional(),
    FiscalYearStartMonth: z.string().optional(),
    Country: z.string().optional(),
    Email: QBEmailAddressSchema.optional(),
    WebAddr: z.object({ URI: z.string() }).optional(),
    SupportedLanguages: z.string().optional(),
    NameValue: z.array(z.object({ Name: z.string(), Value: z.string() })).optional(),
  }),
})

// ============================================================================
// Base Entity Schema
// ============================================================================

/**
 * Base entity schema that all QB entities share
 */
export const QBBaseEntitySchema = z.object({
  Id: z.string(),
  SyncToken: z.string(),
  MetaData: QBMetaDataSchema,
})

// ============================================================================
// Report Response Schemas
// ============================================================================

/**
 * Report column schema
 */
export const QBReportColumnSchema = z.object({
  ColTitle: z.string(),
  ColType: z.string(),
  MetaData: z
    .array(
      z.object({
        Name: z.string(),
        Value: z.string(),
      })
    )
    .optional(),
})

/**
 * Report row data schema
 */
export const QBReportRowDataSchema = z.object({
  ColData: z.array(
    z.object({
      value: z.string(),
      id: z.string().optional(),
      href: z.string().optional(),
    })
  ),
})

/**
 * Report row schema (recursive)
 */
export const QBReportRowSchema: z.ZodType<{
  type?: string
  group?: string
  Header?: { ColData: Array<{ value: string; id?: string; href?: string }> }
  Rows?: { Row: Array<unknown> }
  ColData?: Array<{ value: string; id?: string; href?: string }>
  Summary?: { ColData: Array<{ value: string; id?: string; href?: string }> }
}> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    group: z.string().optional(),
    Header: QBReportRowDataSchema.optional(),
    Rows: z.object({ Row: z.array(QBReportRowSchema) }).optional(),
    ColData: z
      .array(
        z.object({
          value: z.string(),
          id: z.string().optional(),
          href: z.string().optional(),
        })
      )
      .optional(),
    Summary: QBReportRowDataSchema.optional(),
  })
)

/**
 * Base report response schema
 */
export const QBReportResponseSchema = z.object({
  Header: z.object({
    Time: z.string(),
    ReportName: z.string(),
    ReportBasis: z.enum(['Accrual', 'Cash']).optional(),
    StartPeriod: z.string(),
    EndPeriod: z.string(),
    Currency: z.string(),
    Option: z
      .array(
        z.object({
          Name: z.string(),
          Value: z.string(),
        })
      )
      .optional(),
  }),
  Columns: z.object({
    Column: z.array(QBReportColumnSchema),
  }),
  Rows: z.object({
    Row: z.array(QBReportRowSchema),
  }),
})

// ============================================================================
// Entity Response Schemas
// ============================================================================

/**
 * Generic entity wrapper response schema
 * QB API returns single entities as: { EntityType: { ...data } }
 */
export function createEntityResponseSchema<T extends z.ZodType>(entityType: string, schema: T) {
  return z.object({
    [entityType]: schema,
  })
}

/**
 * Invoice schema
 */
export const QBInvoiceSchema = QBBaseEntitySchema.extend({
  DocNumber: z.string().optional(),
  TxnDate: z.string(),
  DueDate: z.string().optional(),
  CustomerRef: QBRefSchema,
  Line: z.array(z.unknown()), // Line items can be complex, using unknown for flexibility
  TotalAmt: z.number(),
  Balance: z.number(),
  CurrencyRef: QBRefSchema.optional(),
  ExchangeRate: z.number().optional(),
  EmailStatus: z.enum(['NotSet', 'NeedToSend', 'EmailSent']).optional(),
  BillEmail: QBEmailAddressSchema.optional(),
  ShipAddr: QBAddressSchema.optional(),
  BillAddr: QBAddressSchema.optional(),
  PrivateNote: z.string().optional(),
  CustomerMemo: z.object({ value: z.string() }).optional(),
})

/**
 * Customer schema
 */
export const QBCustomerSchema = QBBaseEntitySchema.extend({
  DisplayName: z.string(),
  CompanyName: z.string().optional(),
  GivenName: z.string().optional(),
  FamilyName: z.string().optional(),
  FullyQualifiedName: z.string().optional(),
  PrimaryEmailAddr: QBEmailAddressSchema.optional(),
  PrimaryPhone: QBPhoneNumberSchema.optional(),
  Mobile: QBPhoneNumberSchema.optional(),
  BillAddr: QBAddressSchema.optional(),
  ShipAddr: QBAddressSchema.optional(),
  Balance: z.number().optional(),
  BalanceWithJobs: z.number().optional(),
  Active: z.boolean(),
  CurrencyRef: QBRefSchema.optional(),
  PreferredDeliveryMethod: z.string().optional(),
  Taxable: z.boolean().optional(),
  Notes: z.string().optional(),
  Job: z.boolean().optional(),
  ParentRef: QBRefSchema.optional(),
})

/**
 * Vendor schema
 */
export const QBVendorSchema = QBBaseEntitySchema.extend({
  DisplayName: z.string(),
  CompanyName: z.string().optional(),
  GivenName: z.string().optional(),
  FamilyName: z.string().optional(),
  PrimaryEmailAddr: QBEmailAddressSchema.optional(),
  PrimaryPhone: QBPhoneNumberSchema.optional(),
  Mobile: QBPhoneNumberSchema.optional(),
  BillAddr: QBAddressSchema.optional(),
  Balance: z.number().optional(),
  Active: z.boolean(),
  CurrencyRef: QBRefSchema.optional(),
  TaxIdentifier: z.string().optional(),
  Vendor1099: z.boolean().optional(),
  AcctNum: z.string().optional(),
  TermRef: QBRefSchema.optional(),
})

/**
 * Account schema
 */
export const QBAccountSchema = QBBaseEntitySchema.extend({
  Name: z.string(),
  FullyQualifiedName: z.string().optional(),
  AccountType: z.string(),
  AccountSubType: z.string().optional(),
  Classification: z.enum(['Asset', 'Equity', 'Expense', 'Liability', 'Revenue']).optional(),
  CurrentBalance: z.number().optional(),
  CurrentBalanceWithSubAccounts: z.number().optional(),
  CurrencyRef: QBRefSchema.optional(),
  Active: z.boolean(),
  SubAccount: z.boolean().optional(),
  ParentRef: QBRefSchema.optional(),
  Description: z.string().optional(),
  AcctNum: z.string().optional(),
})

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * QuickBooks API error response schema
 */
export const QBErrorResponseSchema = z.object({
  Fault: z.object({
    Error: z.array(
      z.object({
        Message: z.string(),
        Detail: z.string().optional(),
        code: z.string().optional(),
        element: z.string().optional(),
      })
    ),
    type: z.string().optional(),
  }),
  time: z.string().optional(),
})

// ============================================================================
// Schema Type Exports
// ============================================================================

export type QBQueryResponse = z.infer<typeof QBQueryResponseSchema>
export type QBCompanyInfoResponse = z.infer<typeof QBCompanyInfoSchema>
export type QBReportResponse = z.infer<typeof QBReportResponseSchema>
export type QBTokenResponse = z.infer<typeof QBTokenResponseSchema>
export type QBErrorResponse = z.infer<typeof QBErrorResponseSchema>
export type QBInvoice = z.infer<typeof QBInvoiceSchema>
export type QBCustomer = z.infer<typeof QBCustomerSchema>
export type QBVendor = z.infer<typeof QBVendorSchema>
export type QBAccount = z.infer<typeof QBAccountSchema>
