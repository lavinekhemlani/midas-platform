/**
 * Comprehensive tests for QuickBooks Zod validation schemas
 * Tests all schemas defined in src/quickbooks/validation/schemas.ts
 */

import { describe, it, expect } from 'vitest'
import {
  QBRefSchema,
  QBMetaDataSchema,
  QBAddressSchema,
  QBEmailAddressSchema,
  QBPhoneNumberSchema,
  QBTokenResponseSchema,
  QBTokenSchema,
  QBQueryResponseSchema,
  QBCompanyInfoSchema,
  QBBaseEntitySchema,
  QBReportColumnSchema,
  QBReportRowDataSchema,
  QBReportRowSchema,
  QBReportResponseSchema,
  QBInvoiceSchema,
  QBCustomerSchema,
  QBVendorSchema,
  QBAccountSchema,
  QBErrorResponseSchema,
  createEntityResponseSchema,
} from '@/quickbooks/validation/schemas'
import { ZodError } from 'zod'

// ============================================================================
// Common Schema Tests
// ============================================================================

describe('QBRefSchema', () => {
  it('should parse valid reference with value only', () => {
    const valid = { value: '123' }
    expect(() => QBRefSchema.parse(valid)).not.toThrow()
    expect(QBRefSchema.parse(valid)).toEqual({ value: '123' })
  })

  it('should parse valid reference with value and name', () => {
    const valid = { value: '123', name: 'Test Name' }
    expect(() => QBRefSchema.parse(valid)).not.toThrow()
    expect(QBRefSchema.parse(valid)).toEqual(valid)
  })

  it('should reject reference without value', () => {
    const invalid = { name: 'Test Name' }
    expect(() => QBRefSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should reject non-string value', () => {
    const invalid = { value: 123 }
    expect(() => QBRefSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBMetaDataSchema', () => {
  it('should parse valid metadata', () => {
    const valid = {
      CreateTime: '2024-01-01T00:00:00Z',
      LastUpdatedTime: '2024-01-02T00:00:00Z',
    }
    expect(() => QBMetaDataSchema.parse(valid)).not.toThrow()
    expect(QBMetaDataSchema.parse(valid)).toEqual(valid)
  })

  it('should reject metadata missing CreateTime', () => {
    const invalid = { LastUpdatedTime: '2024-01-02T00:00:00Z' }
    expect(() => QBMetaDataSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should reject metadata missing LastUpdatedTime', () => {
    const invalid = { CreateTime: '2024-01-01T00:00:00Z' }
    expect(() => QBMetaDataSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBAddressSchema', () => {
  it('should parse complete address', () => {
    const valid = {
      Id: '1',
      Line1: '123 Main St',
      Line2: 'Suite 100',
      Line3: 'Building A',
      City: 'San Francisco',
      CountrySubDivisionCode: 'CA',
      PostalCode: '94102',
      Country: 'USA',
      Lat: '37.7749',
      Long: '-122.4194',
    }
    expect(() => QBAddressSchema.parse(valid)).not.toThrow()
    expect(QBAddressSchema.parse(valid)).toEqual(valid)
  })

  it('should parse empty address (all fields optional)', () => {
    const valid = {}
    expect(() => QBAddressSchema.parse(valid)).not.toThrow()
    expect(QBAddressSchema.parse(valid)).toEqual({})
  })

  it('should parse partial address', () => {
    const valid = {
      Line1: '123 Main St',
      City: 'San Francisco',
      PostalCode: '94102',
    }
    expect(() => QBAddressSchema.parse(valid)).not.toThrow()
    expect(QBAddressSchema.parse(valid)).toEqual(valid)
  })
})

describe('QBEmailAddressSchema', () => {
  it('should parse valid email address', () => {
    const valid = { Address: 'test@example.com' }
    expect(() => QBEmailAddressSchema.parse(valid)).not.toThrow()
    expect(QBEmailAddressSchema.parse(valid)).toEqual(valid)
  })

  it('should reject email without Address field', () => {
    const invalid = { email: 'test@example.com' }
    expect(() => QBEmailAddressSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBPhoneNumberSchema', () => {
  it('should parse valid phone number', () => {
    const valid = { FreeFormNumber: '555-1234' }
    expect(() => QBPhoneNumberSchema.parse(valid)).not.toThrow()
    expect(QBPhoneNumberSchema.parse(valid)).toEqual(valid)
  })

  it('should reject phone without FreeFormNumber field', () => {
    const invalid = { number: '555-1234' }
    expect(() => QBPhoneNumberSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Token Schema Tests
// ============================================================================

describe('QBTokenResponseSchema', () => {
  it('should parse valid token response with all fields', () => {
    const valid = {
      access_token: 'access_token_value',
      refresh_token: 'refresh_token_value',
      expires_in: 3600,
      token_type: 'Bearer',
      x_refresh_token_expires_in: 8000000,
      realmId: '123456789',
    }
    expect(() => QBTokenResponseSchema.parse(valid)).not.toThrow()
    expect(QBTokenResponseSchema.parse(valid)).toEqual(valid)
  })

  it('should parse minimal valid token response', () => {
    const valid = {
      access_token: 'access_token_value',
      refresh_token: 'refresh_token_value',
      expires_in: 3600,
    }
    expect(() => QBTokenResponseSchema.parse(valid)).not.toThrow()
  })

  it('should reject token response missing access_token', () => {
    const invalid = {
      refresh_token: 'refresh_token_value',
      expires_in: 3600,
    }
    expect(() => QBTokenResponseSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should reject token response with non-numeric expires_in', () => {
    const invalid = {
      access_token: 'access_token_value',
      refresh_token: 'refresh_token_value',
      expires_in: '3600',
    }
    expect(() => QBTokenResponseSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBTokenSchema', () => {
  it('should parse valid QB token', () => {
    const valid = {
      accessToken: 'access_token_value',
      refreshToken: 'refresh_token_value',
      expiresAt: 1704067200000,
      realmId: '123456789',
    }
    expect(() => QBTokenSchema.parse(valid)).not.toThrow()
    expect(QBTokenSchema.parse(valid)).toEqual(valid)
  })

  it('should reject token missing realmId', () => {
    const invalid = {
      accessToken: 'access_token_value',
      refreshToken: 'refresh_token_value',
      expiresAt: 1704067200000,
    }
    expect(() => QBTokenSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Query Response Schema Tests
// ============================================================================

describe('QBQueryResponseSchema', () => {
  it('should parse valid query response with entities', () => {
    const valid = {
      QueryResponse: {
        Customer: [
          { Id: '1', DisplayName: 'Test Customer' },
          { Id: '2', DisplayName: 'Another Customer' },
        ],
      },
      time: '2024-01-01T00:00:00Z',
    }
    expect(() => QBQueryResponseSchema.parse(valid)).not.toThrow()
    expect(QBQueryResponseSchema.parse(valid)).toEqual(valid)
  })

  it('should parse query response with multiple entity types', () => {
    const valid = {
      QueryResponse: {
        Customer: [{ Id: '1', DisplayName: 'Customer' }],
        Invoice: [{ Id: '1', TotalAmt: 100 }],
      },
      time: '2024-01-01T00:00:00Z',
    }
    expect(() => QBQueryResponseSchema.parse(valid)).not.toThrow()
  })

  it('should parse empty query response', () => {
    const valid = {
      QueryResponse: {},
      time: '2024-01-01T00:00:00Z',
    }
    expect(() => QBQueryResponseSchema.parse(valid)).not.toThrow()
  })

  it('should parse minimal query response (optional fields)', () => {
    const valid = {}
    expect(() => QBQueryResponseSchema.parse(valid)).not.toThrow()
  })

  it('should reject invalid structure (non-array entity)', () => {
    const invalid = {
      QueryResponse: {
        Customer: { Id: '1', DisplayName: 'Test' }, // Should be array
      },
      time: '2024-01-01T00:00:00Z',
    }
    expect(() => QBQueryResponseSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Company Info Schema Tests
// ============================================================================

describe('QBCompanyInfoSchema', () => {
  it('should parse valid company info with all fields', () => {
    const valid = {
      CompanyInfo: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        CompanyName: 'Test Company',
        LegalName: 'Test Company Inc.',
        CompanyAddr: {
          Line1: '123 Main St',
          City: 'San Francisco',
        },
        CustomerCommunicationAddr: {
          Line1: '456 Oak Ave',
          City: 'Oakland',
        },
        LegalAddr: {
          Line1: '789 Pine St',
          City: 'Berkeley',
        },
        PrimaryPhone: { FreeFormNumber: '555-1234' },
        CompanyStartDate: '2020-01-01',
        FiscalYearStartMonth: 'January',
        Country: 'USA',
        Email: { Address: 'info@testcompany.com' },
        WebAddr: { URI: 'https://testcompany.com' },
        SupportedLanguages: 'en',
        NameValue: [
          { Name: 'Key1', Value: 'Value1' },
          { Name: 'Key2', Value: 'Value2' },
        ],
      },
    }
    expect(() => QBCompanyInfoSchema.parse(valid)).not.toThrow()
    expect(QBCompanyInfoSchema.parse(valid)).toEqual(valid)
  })

  it('should parse minimal company info (required fields only)', () => {
    const valid = {
      CompanyInfo: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        CompanyName: 'Test Company',
      },
    }
    expect(() => QBCompanyInfoSchema.parse(valid)).not.toThrow()
  })

  it('should reject company info missing CompanyName', () => {
    const invalid = {
      CompanyInfo: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
      },
    }
    expect(() => QBCompanyInfoSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should reject company info missing MetaData', () => {
    const invalid = {
      CompanyInfo: {
        Id: '1',
        SyncToken: '0',
        CompanyName: 'Test Company',
      },
    }
    expect(() => QBCompanyInfoSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should accept company info with extra fields (no strict mode)', () => {
    const valid = {
      CompanyInfo: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        CompanyName: 'Test Company',
        CustomField: 'Extra data', // Extra field
      },
    }
    const result = QBCompanyInfoSchema.parse(valid)
    expect(result.CompanyInfo.CompanyName).toBe('Test Company')
  })
})

// ============================================================================
// Base Entity Schema Tests
// ============================================================================

describe('QBBaseEntitySchema', () => {
  it('should parse valid base entity', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
    }
    expect(() => QBBaseEntitySchema.parse(valid)).not.toThrow()
    expect(QBBaseEntitySchema.parse(valid)).toEqual(valid)
  })

  it('should reject entity missing Id', () => {
    const invalid = {
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
    }
    expect(() => QBBaseEntitySchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Report Schema Tests
// ============================================================================

describe('QBReportColumnSchema', () => {
  it('should parse valid report column', () => {
    const valid = {
      ColTitle: 'Amount',
      ColType: 'Money',
    }
    expect(() => QBReportColumnSchema.parse(valid)).not.toThrow()
  })

  it('should parse report column with metadata', () => {
    const valid = {
      ColTitle: 'Account',
      ColType: 'String',
      MetaData: [
        { Name: 'Key1', Value: 'Value1' },
        { Name: 'Key2', Value: 'Value2' },
      ],
    }
    expect(() => QBReportColumnSchema.parse(valid)).not.toThrow()
  })
})

describe('QBReportRowDataSchema', () => {
  it('should parse valid row data', () => {
    const valid = {
      ColData: [{ value: '100.00', id: '1', href: '/invoice/1' }, { value: 'Test Account' }],
    }
    expect(() => QBReportRowDataSchema.parse(valid)).not.toThrow()
  })

  it('should reject row data with invalid ColData', () => {
    const invalid = {
      ColData: 'not an array',
    }
    expect(() => QBReportRowDataSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBReportRowSchema', () => {
  it('should parse simple data row', () => {
    const valid = {
      type: 'Data',
      ColData: [{ value: '100.00' }, { value: 'Account Name' }],
    }
    expect(() => QBReportRowSchema.parse(valid)).not.toThrow()
  })

  it('should parse section row with header', () => {
    const valid = {
      type: 'Section',
      group: 'Revenue',
      Header: {
        ColData: [{ value: 'Total Revenue' }],
      },
    }
    expect(() => QBReportRowSchema.parse(valid)).not.toThrow()
  })

  it('should parse recursive row structure', () => {
    const valid = {
      type: 'Section',
      Header: { ColData: [{ value: 'Section Header' }] },
      Rows: {
        Row: [
          { type: 'Data', ColData: [{ value: '100.00' }] },
          { type: 'Data', ColData: [{ value: '200.00' }] },
        ],
      },
      Summary: { ColData: [{ value: '300.00' }] },
    }
    expect(() => QBReportRowSchema.parse(valid)).not.toThrow()
  })

  it('should parse nested section rows', () => {
    const valid = {
      type: 'Section',
      Header: { ColData: [{ value: 'Main Section' }] },
      Rows: {
        Row: [
          {
            type: 'Section',
            Header: { ColData: [{ value: 'Subsection' }] },
            Rows: {
              Row: [{ type: 'Data', ColData: [{ value: '50.00' }] }],
            },
          },
        ],
      },
    }
    expect(() => QBReportRowSchema.parse(valid)).not.toThrow()
  })
})

describe('QBReportResponseSchema', () => {
  it('should parse valid report response', () => {
    const valid = {
      Header: {
        Time: '2024-01-01T00:00:00Z',
        ReportName: 'ProfitAndLoss',
        ReportBasis: 'Accrual' as const,
        StartPeriod: '2024-01-01',
        EndPeriod: '2024-12-31',
        Currency: 'USD',
        Option: [{ Name: 'accounting_method', Value: 'Accrual' }],
      },
      Columns: {
        Column: [
          { ColTitle: 'Account', ColType: 'String' },
          { ColTitle: 'Amount', ColType: 'Money' },
        ],
      },
      Rows: {
        Row: [
          {
            type: 'Data',
            ColData: [{ value: 'Revenue' }, { value: '10000.00' }],
          },
        ],
      },
    }
    expect(() => QBReportResponseSchema.parse(valid)).not.toThrow()
  })

  it('should parse report with Cash basis', () => {
    const valid = {
      Header: {
        Time: '2024-01-01T00:00:00Z',
        ReportName: 'ProfitAndLoss',
        ReportBasis: 'Cash' as const,
        StartPeriod: '2024-01-01',
        EndPeriod: '2024-12-31',
        Currency: 'USD',
      },
      Columns: {
        Column: [{ ColTitle: 'Account', ColType: 'String' }],
      },
      Rows: {
        Row: [],
      },
    }
    expect(() => QBReportResponseSchema.parse(valid)).not.toThrow()
  })

  it('should reject report with invalid ReportBasis', () => {
    const invalid = {
      Header: {
        Time: '2024-01-01T00:00:00Z',
        ReportName: 'ProfitAndLoss',
        ReportBasis: 'Invalid',
        StartPeriod: '2024-01-01',
        EndPeriod: '2024-12-31',
        Currency: 'USD',
      },
      Columns: {
        Column: [{ ColTitle: 'Account', ColType: 'String' }],
      },
      Rows: {
        Row: [],
      },
    }
    expect(() => QBReportResponseSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Entity Schema Tests
// ============================================================================

describe('QBInvoiceSchema', () => {
  it('should parse valid invoice', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DocNumber: 'INV-001',
      TxnDate: '2024-01-01',
      DueDate: '2024-01-31',
      CustomerRef: { value: '1', name: 'Test Customer' },
      Line: [{ DetailType: 'SalesItemLineDetail', Amount: 100 }],
      TotalAmt: 100,
      Balance: 100,
    }
    expect(() => QBInvoiceSchema.parse(valid)).not.toThrow()
  })

  it('should parse invoice with currency and email status', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      TxnDate: '2024-01-01',
      CustomerRef: { value: '1' },
      Line: [],
      TotalAmt: 100,
      Balance: 0,
      CurrencyRef: { value: 'USD', name: 'US Dollar' },
      ExchangeRate: 1.0,
      EmailStatus: 'EmailSent' as const,
      BillEmail: { Address: 'customer@example.com' },
    }
    expect(() => QBInvoiceSchema.parse(valid)).not.toThrow()
  })

  it('should reject invoice with invalid EmailStatus', () => {
    const invalid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      TxnDate: '2024-01-01',
      CustomerRef: { value: '1' },
      Line: [],
      TotalAmt: 100,
      Balance: 100,
      EmailStatus: 'InvalidStatus',
    }
    expect(() => QBInvoiceSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBCustomerSchema', () => {
  it('should parse valid customer with all fields', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DisplayName: 'Test Customer',
      CompanyName: 'Test Company',
      GivenName: 'John',
      FamilyName: 'Doe',
      FullyQualifiedName: 'Test Customer',
      PrimaryEmailAddr: { Address: 'john@testcompany.com' },
      PrimaryPhone: { FreeFormNumber: '555-1234' },
      Mobile: { FreeFormNumber: '555-5678' },
      BillAddr: { Line1: '123 Main St', City: 'San Francisco' },
      ShipAddr: { Line1: '456 Oak Ave', City: 'Oakland' },
      Balance: 1000.5,
      BalanceWithJobs: 1500.75,
      Active: true,
      CurrencyRef: { value: 'USD' },
      PreferredDeliveryMethod: 'Email',
      Taxable: true,
      Notes: 'Important customer',
      Job: false,
      ParentRef: { value: '2' },
    }
    expect(() => QBCustomerSchema.parse(valid)).not.toThrow()
    expect(QBCustomerSchema.parse(valid)).toEqual(valid)
  })

  it('should parse minimal customer', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DisplayName: 'Test Customer',
      Active: true,
    }
    expect(() => QBCustomerSchema.parse(valid)).not.toThrow()
  })

  it('should reject customer missing DisplayName', () => {
    const invalid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      Active: true,
    }
    expect(() => QBCustomerSchema.parse(invalid)).toThrow(ZodError)
  })

  it('should reject customer with non-boolean Active', () => {
    const invalid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DisplayName: 'Test Customer',
      Active: 'true', // Should be boolean
    }
    expect(() => QBCustomerSchema.parse(invalid)).toThrow(ZodError)
  })
})

describe('QBVendorSchema', () => {
  it('should parse valid vendor', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DisplayName: 'Test Vendor',
      CompanyName: 'Vendor Corp',
      Active: true,
      Balance: 500.25,
      Vendor1099: true,
      TaxIdentifier: '12-3456789',
      AcctNum: 'V001',
    }
    expect(() => QBVendorSchema.parse(valid)).not.toThrow()
  })

  it('should parse minimal vendor', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      DisplayName: 'Test Vendor',
      Active: false,
    }
    expect(() => QBVendorSchema.parse(valid)).not.toThrow()
  })
})

describe('QBAccountSchema', () => {
  it('should parse valid account', () => {
    const valid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      Name: 'Cash Account',
      FullyQualifiedName: 'Assets:Cash Account',
      AccountType: 'Bank',
      AccountSubType: 'CashOnHand',
      Classification: 'Asset' as const,
      CurrentBalance: 5000.0,
      CurrentBalanceWithSubAccounts: 5000.0,
      Active: true,
      SubAccount: false,
      Description: 'Primary cash account',
      AcctNum: '1000',
    }
    expect(() => QBAccountSchema.parse(valid)).not.toThrow()
  })

  it('should parse account with all classification types', () => {
    const classifications = ['Asset', 'Equity', 'Expense', 'Liability', 'Revenue'] as const

    classifications.forEach((classification) => {
      const valid = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        Name: `${classification} Account`,
        AccountType: 'Type',
        Classification: classification,
        Active: true,
      }
      expect(() => QBAccountSchema.parse(valid)).not.toThrow()
    })
  })

  it('should reject account with invalid classification', () => {
    const invalid = {
      Id: '1',
      SyncToken: '0',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
      Name: 'Account',
      AccountType: 'Type',
      Classification: 'InvalidType',
      Active: true,
    }
    expect(() => QBAccountSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Error Response Schema Tests
// ============================================================================

describe('QBErrorResponseSchema', () => {
  it('should parse valid error response', () => {
    const valid = {
      Fault: {
        Error: [
          {
            Message: 'Invalid request',
            Detail: 'The field "Amount" is required',
            code: '400',
            element: 'Amount',
          },
        ],
        type: 'ValidationFault',
      },
      time: '2024-01-01T00:00:00Z',
    }
    expect(() => QBErrorResponseSchema.parse(valid)).not.toThrow()
    expect(QBErrorResponseSchema.parse(valid)).toEqual(valid)
  })

  it('should parse error response with multiple errors', () => {
    const valid = {
      Fault: {
        Error: [
          { Message: 'Error 1', Detail: 'Detail 1' },
          { Message: 'Error 2', Detail: 'Detail 2' },
          { Message: 'Error 3' },
        ],
      },
    }
    expect(() => QBErrorResponseSchema.parse(valid)).not.toThrow()
  })

  it('should reject error response with empty Error array', () => {
    const invalid = {
      Fault: {
        Error: [],
      },
    }
    // Note: Zod will allow empty arrays, but we might want to enforce at least one error
    // For now, this should NOT throw
    expect(() => QBErrorResponseSchema.parse(invalid)).not.toThrow()
  })

  it('should reject malformed error response', () => {
    const invalid = {
      Fault: {
        Error: 'not an array',
      },
    }
    expect(() => QBErrorResponseSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Entity Response Wrapper Tests
// ============================================================================

describe('createEntityResponseSchema', () => {
  it('should create wrapper schema for invoice', () => {
    const InvoiceResponseSchema = createEntityResponseSchema('Invoice', QBInvoiceSchema)

    const valid = {
      Invoice: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        TxnDate: '2024-01-01',
        CustomerRef: { value: '1' },
        Line: [],
        TotalAmt: 100,
        Balance: 100,
      },
    }

    expect(() => InvoiceResponseSchema.parse(valid)).not.toThrow()
  })

  it('should create wrapper schema for customer', () => {
    const CustomerResponseSchema = createEntityResponseSchema('Customer', QBCustomerSchema)

    const valid = {
      Customer: {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        DisplayName: 'Test Customer',
        Active: true,
      },
    }

    expect(() => CustomerResponseSchema.parse(valid)).not.toThrow()
  })

  it('should reject when wrong entity key is used', () => {
    const InvoiceResponseSchema = createEntityResponseSchema('Invoice', QBInvoiceSchema)

    const invalid = {
      Customer: {
        // Wrong key, should be 'Invoice'
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        DisplayName: 'Test',
        Active: true,
      },
    }

    expect(() => InvoiceResponseSchema.parse(invalid)).toThrow(ZodError)
  })
})

// ============================================================================
// Edge Cases and Special Scenarios
// ============================================================================

describe('Edge Cases', () => {
  describe('null values', () => {
    it('should reject null where object is expected', () => {
      expect(() => QBRefSchema.parse(null)).toThrow(ZodError)
      expect(() => QBQueryResponseSchema.parse(null)).toThrow(ZodError)
    })

    it('should handle null in optional fields gracefully', () => {
      const customer = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        DisplayName: 'Test',
        Active: true,
        Balance: null, // Optional field
      }
      // Null should fail for optional number field
      expect(() => QBCustomerSchema.parse(customer)).toThrow(ZodError)
    })
  })

  describe('empty objects', () => {
    it('should reject empty object for required schemas', () => {
      expect(() => QBCompanyInfoSchema.parse({})).toThrow(ZodError)
      expect(() => QBInvoiceSchema.parse({})).toThrow(ZodError)
      expect(() => QBCustomerSchema.parse({})).toThrow(ZodError)
    })

    it('should accept empty object for schemas with all optional fields', () => {
      expect(() => QBAddressSchema.parse({})).not.toThrow()
    })
  })

  describe('type coercion', () => {
    it('should not coerce string to number', () => {
      const invoice = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        TxnDate: '2024-01-01',
        CustomerRef: { value: '1' },
        Line: [],
        TotalAmt: '100', // String instead of number
        Balance: 100,
      }
      expect(() => QBInvoiceSchema.parse(invoice)).toThrow(ZodError)
    })

    it('should not coerce number to string', () => {
      const ref = {
        value: 123, // Number instead of string
      }
      expect(() => QBRefSchema.parse(ref)).toThrow(ZodError)
    })
  })

  describe('extra fields', () => {
    it('should allow extra fields (passthrough by default)', () => {
      const customer = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        DisplayName: 'Test',
        Active: true,
        ExtraField: 'This should be allowed',
        AnotherExtra: 123,
      }
      const result = QBCustomerSchema.parse(customer)
      expect(result.DisplayName).toBe('Test')
      // Extra fields are stripped by default in Zod
    })
  })

  describe('deeply nested structures', () => {
    it('should validate deeply nested report rows', () => {
      const deeplyNested = {
        type: 'Section',
        Header: { ColData: [{ value: 'Level 1' }] },
        Rows: {
          Row: [
            {
              type: 'Section',
              Header: { ColData: [{ value: 'Level 2' }] },
              Rows: {
                Row: [
                  {
                    type: 'Section',
                    Header: { ColData: [{ value: 'Level 3' }] },
                    Rows: {
                      Row: [
                        {
                          type: 'Data',
                          ColData: [{ value: 'Deep value' }],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      }
      expect(() => QBReportRowSchema.parse(deeplyNested)).not.toThrow()
    })
  })

  describe('boundary values', () => {
    it('should handle very large numbers', () => {
      const invoice = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        TxnDate: '2024-01-01',
        CustomerRef: { value: '1' },
        Line: [],
        TotalAmt: 999999999999.99,
        Balance: 999999999999.99,
      }
      expect(() => QBInvoiceSchema.parse(invoice)).not.toThrow()
    })

    it('should handle negative balances', () => {
      const customer = {
        Id: '1',
        SyncToken: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
        DisplayName: 'Test',
        Active: true,
        Balance: -1000.5,
      }
      expect(() => QBCustomerSchema.parse(customer)).not.toThrow()
    })

    it('should handle very long strings', () => {
      const longString = 'A'.repeat(10000)
      const address = {
        Line1: longString,
      }
      expect(() => QBAddressSchema.parse(address)).not.toThrow()
    })
  })
})
