// src/ai/tools/quickbooks-data/__tests__/entity-accessor.test.ts
// Comprehensive security tests for sanitization functions in entity-accessor.ts
// These tests prevent SQL injection attacks and validate input sanitization

import { describe, it, expect } from 'vitest'

// =============================================================================
// Test Helpers - Extract private functions for testing
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
 */
function sanitizeFieldName(fieldName: string | undefined, defaultField: string): string {
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
 */
function sanitizeSortOrder(sortOrder: string | undefined): 'ASC' | 'DESC' {
  if (!sortOrder) return 'ASC'

  const upper = sortOrder.toUpperCase()
  return upper === 'DESC' ? 'DESC' : 'ASC'
}

/**
 * Normalize entity type from lowercase schema format to PascalCase implementation format
 */
function normalizeEntityType(type: string): string {
  const mapping: Record<string, string> = {
    customer: 'Customer',
    vendor: 'Vendor',
    account: 'Account',
    invoice: 'Invoice',
    bill: 'Bill',
    payment: 'Purchase',
    transaction: 'Purchase',
    item: 'Item',
    class: 'Class',
    department: 'Department',
    purchase: 'Purchase',
  }

  const normalized = mapping[type.toLowerCase()]
  if (!normalized) {
    return type
  }
  return normalized
}

// =============================================================================
// Security Tests for sanitizeQueryValue
// =============================================================================

describe('sanitizeQueryValue - SQL Injection Prevention', () => {
  describe('Classic SQL Injection Attacks', () => {
    it('should escape SQL injection with OR condition', () => {
      const malicious = "' OR '1'='1"
      const result = sanitizeQueryValue(malicious)

      // Single quotes should be doubled (no dashes to remove in this input)
      expect(result).toBe("'' OR ''1''=''1")
      // After escaping, the dangerous pattern "' OR '" becomes "'' OR ''" which is safe
      expect(result).not.toContain("'1'='1") // Original dangerous pattern is neutralized
    })

    it('should neutralize DROP TABLE attack', () => {
      const malicious = "'; DROP TABLE users; --"
      const result = sanitizeQueryValue(malicious)

      // Semicolons and dashes should be removed, quotes escaped
      // Regex removes individual dashes, so '--' becomes ''
      expect(result).not.toContain(';')
      expect(result).not.toContain('-')
      expect(result).toBe("'' DROP TABLE users")
    })

    it('should escape UNION SELECT injection', () => {
      const malicious = "' UNION SELECT * FROM passwords --"
      const result = sanitizeQueryValue(malicious)

      // Dashes are removed, quotes are escaped
      expect(result).not.toContain('-')
      expect(result).toBe("'' UNION SELECT * FROM passwords")
      // The dangerous pattern "' UNION" becomes "'' UNION" which is safe (can't break out of quotes)
    })

    it('should remove SQL comment sequences', () => {
      const malicious = "admin'-- comment here"
      const result = sanitizeQueryValue(malicious)

      expect(result).not.toContain('-')
      expect(result).toBe("admin'' comment here")
    })
  })

  describe('Quote Escaping', () => {
    it('should double single quotes (SQL standard)', () => {
      const input = "O'Reilly"
      const result = sanitizeQueryValue(input)

      expect(result).toBe("O''Reilly")
      expect(result).not.toContain("O'Reilly")
    })

    it('should escape multiple single quotes', () => {
      const input = "It's a customer's order"
      const result = sanitizeQueryValue(input)

      expect(result).toBe("It''s a customer''s order")
      expect(result.match(/''/g)?.length).toBe(2)
    })

    it('should handle consecutive single quotes', () => {
      const input = "test''test"
      const result = sanitizeQueryValue(input)

      expect(result).toBe("test''''test")
    })
  })

  describe('Backslash Escaping', () => {
    it('should escape backslashes to prevent escape sequence attacks', () => {
      const input = 'test\\nmalicious'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('test\\\\nmalicious')
    })

    it('should escape multiple backslashes', () => {
      const input = 'path\\to\\file'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('path\\\\to\\\\file')
    })

    it('should handle backslash before single quote', () => {
      const input = "test\\'quote"
      const result = sanitizeQueryValue(input)

      // Backslash escaped first, then quote escaped
      expect(result).toBe("test\\\\''quote")
    })
  })

  describe('Dangerous Character Removal', () => {
    it('should remove semicolons', () => {
      const input = 'value1;value2;value3'
      const result = sanitizeQueryValue(input)

      expect(result).not.toContain(';')
      expect(result).toBe('value1value2value3')
    })

    it('should remove double dashes (SQL comments)', () => {
      const input = 'normal--comment'
      const result = sanitizeQueryValue(input)

      expect(result).not.toContain('--')
      expect(result).toBe('normalcomment')
    })

    it('should remove multiple dangerous characters', () => {
      const input = 'test;DROP--TABLE;users--'
      const result = sanitizeQueryValue(input)

      expect(result).not.toContain(';')
      expect(result).not.toContain('--')
      expect(result).toBe('testDROPTABLEusers')
    })
  })

  describe('Length Limiting', () => {
    it('should limit input to 200 characters to prevent buffer overflow', () => {
      const longInput = 'A'.repeat(300)
      const result = sanitizeQueryValue(longInput)

      expect(result.length).toBe(200)
      expect(result).toBe('A'.repeat(200))
    })

    it('should preserve input under 200 characters', () => {
      const normalInput = 'A'.repeat(150)
      const result = sanitizeQueryValue(normalInput)

      expect(result.length).toBe(150)
      expect(result).toBe(normalInput)
    })

    it('should truncate exactly at 200 characters', () => {
      const input = 'B'.repeat(200) + 'EXTRA'
      const result = sanitizeQueryValue(input)

      expect(result.length).toBe(200)
      expect(result).not.toContain('EXTRA')
    })

    it('should apply length limit AFTER escaping', () => {
      // Test that escaping happens before truncation
      const input = "'".repeat(150) // 150 single quotes
      const result = sanitizeQueryValue(input)

      // Each quote becomes '', but total is limited to 200 chars
      expect(result.length).toBe(200)
    })
  })

  describe('Whitespace Handling', () => {
    it('should trim leading whitespace', () => {
      const input = '   leading spaces'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('leading spaces')
      expect(result.startsWith(' ')).toBe(false)
    })

    it('should trim trailing whitespace', () => {
      const input = 'trailing spaces   '
      const result = sanitizeQueryValue(input)

      expect(result).toBe('trailing spaces')
      expect(result.endsWith(' ')).toBe(false)
    })

    it('should trim both leading and trailing whitespace', () => {
      const input = '   both sides   '
      const result = sanitizeQueryValue(input)

      expect(result).toBe('both sides')
    })

    it('should preserve internal whitespace', () => {
      const input = 'keep   internal   spaces'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('keep   internal   spaces')
    })
  })

  describe('Empty and Edge Cases', () => {
    it('should return empty string for empty input', () => {
      const result = sanitizeQueryValue('')
      expect(result).toBe('')
    })

    it('should return empty string for whitespace-only input', () => {
      const result = sanitizeQueryValue('   ')
      expect(result).toBe('')
    })

    it('should handle normal alphanumeric input', () => {
      const input = 'NormalCustomer123'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('NormalCustomer123')
    })

    it('should handle input with special but safe characters', () => {
      const input = 'email@example.com'
      const result = sanitizeQueryValue(input)

      expect(result).toBe('email@example.com')
    })
  })

  describe('Complex Attack Scenarios', () => {
    it('should neutralize stacked injection attack', () => {
      const malicious = "'; DELETE FROM accounts WHERE '1'='1'; --"
      const result = sanitizeQueryValue(malicious)

      expect(result).not.toContain(';')
      expect(result).not.toContain('-')
      expect(result).toBe("'' DELETE FROM accounts WHERE ''1''=''1''")
    })

    it('should handle time-based blind SQL injection', () => {
      const malicious = "' OR SLEEP(5)--"
      const result = sanitizeQueryValue(malicious)

      expect(result).not.toContain('-')
      expect(result).toBe("'' OR SLEEP(5)")
    })

    it('should neutralize boolean-based blind injection', () => {
      const malicious = "' AND 1=1--"
      const result = sanitizeQueryValue(malicious)

      expect(result).toBe("'' AND 1=1")
    })

    it('should handle encoded attack attempts', () => {
      const malicious = "\\'; DROP TABLE users; --"
      const result = sanitizeQueryValue(malicious)

      expect(result).not.toContain(';')
      expect(result).not.toContain('-')
      // Backslash escaped: \\, quote escaped: '', semicolons removed, dashes removed
      expect(result).toBe("\\\\'' DROP TABLE users")
    })
  })
})

// =============================================================================
// Security Tests for sanitizeFieldName
// =============================================================================

describe('sanitizeFieldName - Field Name Validation', () => {
  describe('Valid Field Names', () => {
    it('should allow alphanumeric field names', () => {
      const result = sanitizeFieldName('CustomerName', 'Id')
      expect(result).toBe('CustomerName')
    })

    it('should allow underscores in field names', () => {
      const result = sanitizeFieldName('customer_name', 'Id')
      expect(result).toBe('customer_name')
    })

    it('should allow periods for qualified field names', () => {
      const result = sanitizeFieldName('Customer.Name', 'Id')
      expect(result).toBe('Customer.Name')
    })

    it('should allow mixed alphanumeric with underscores and periods', () => {
      const result = sanitizeFieldName('Table1.Field_Name2', 'Id')
      expect(result).toBe('Table1.Field_Name2')
    })
  })

  describe('Invalid Character Stripping', () => {
    it('should strip SQL injection attempts in field names', () => {
      const malicious = "Name'; DROP TABLE users--"
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('NameDROPTABLEusers')
      expect(result).not.toContain("'")
      expect(result).not.toContain(';')
      expect(result).not.toContain('--')
    })

    it('should strip special characters', () => {
      const input = 'field@name!with#special$chars'
      const result = sanitizeFieldName(input, 'Id')

      expect(result).toBe('fieldnamewithspecialchars')
    })

    it('should strip parentheses (function call attempts)', () => {
      const malicious = 'CONCAT(Name,Password)'
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('CONCATNamePassword')
      expect(result).not.toContain('(')
      expect(result).not.toContain(')')
    })

    it('should strip spaces', () => {
      const input = 'Customer Name'
      const result = sanitizeFieldName(input, 'Id')

      expect(result).toBe('CustomerName')
    })
  })

  describe('Empty and Undefined Handling', () => {
    it('should return default field for undefined input', () => {
      const result = sanitizeFieldName(undefined, 'DefaultField')
      expect(result).toBe('DefaultField')
    })

    it('should return default field for empty string after sanitization', () => {
      const result = sanitizeFieldName('!@#$%', 'DefaultField')

      // All special chars stripped, leaving empty string
      expect(result).toBe('DefaultField')
    })

    it('should return default field for empty string input', () => {
      const result = sanitizeFieldName('', 'DefaultField')
      expect(result).toBe('DefaultField')
    })
  })

  describe('Length Validation', () => {
    it('should accept field names up to 50 characters', () => {
      const input = 'A'.repeat(50)
      const result = sanitizeFieldName(input, 'Id')

      expect(result).toBe(input)
      expect(result.length).toBe(50)
    })

    it('should reject field names over 50 characters', () => {
      const input = 'A'.repeat(51)
      const result = sanitizeFieldName(input, 'DefaultField')

      expect(result).toBe('DefaultField')
      expect(result).not.toBe(input)
    })

    it('should return default for excessively long field names (100+ chars)', () => {
      const input = 'VeryLongFieldName'.repeat(10) // 170 chars
      const result = sanitizeFieldName(input, 'Id')

      expect(result).toBe('Id')
    })
  })

  describe('SQL Injection Prevention in Field Names', () => {
    it('should prevent ORDER BY injection', () => {
      const malicious = 'Name; DROP TABLE Customers--'
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('NameDROPTABLECustomers')
    })

    it('should prevent UNION injection in field name', () => {
      const malicious = 'Id UNION SELECT Password FROM Users'
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('IdUNIONSELECTPasswordFROMUsers')
    })

    it('should prevent function injection', () => {
      const malicious = 'Name,COUNT(*)'
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('NameCOUNT')
      expect(result).not.toContain(',')
      expect(result).not.toContain('(')
      expect(result).not.toContain('*')
    })

    it('should prevent subquery injection', () => {
      const malicious = 'Name,(SELECT Password FROM Users)'
      const result = sanitizeFieldName(malicious, 'Id')

      expect(result).toBe('NameSELECTPasswordFROMUsers')
    })
  })

  describe('Edge Cases', () => {
    it('should handle numeric field names', () => {
      const result = sanitizeFieldName('123', 'Id')
      expect(result).toBe('123')
    })

    it('should handle single character field names', () => {
      const result = sanitizeFieldName('x', 'Id')
      expect(result).toBe('x')
    })

    it('should handle field names with only underscores', () => {
      const result = sanitizeFieldName('___', 'Id')
      expect(result).toBe('___')
    })

    it('should handle field names with only periods', () => {
      const result = sanitizeFieldName('...', 'Id')
      expect(result).toBe('...')
    })
  })
})

// =============================================================================
// Security Tests for sanitizeSortOrder
// =============================================================================

describe('sanitizeSortOrder - Sort Order Validation', () => {
  describe('Valid Sort Orders', () => {
    it('should accept uppercase ASC', () => {
      const result = sanitizeSortOrder('ASC')
      expect(result).toBe('ASC')
    })

    it('should accept uppercase DESC', () => {
      const result = sanitizeSortOrder('DESC')
      expect(result).toBe('DESC')
    })

    it('should convert lowercase asc to ASC', () => {
      const result = sanitizeSortOrder('asc')
      expect(result).toBe('ASC')
    })

    it('should convert lowercase desc to DESC', () => {
      const result = sanitizeSortOrder('desc')
      expect(result).toBe('DESC')
    })

    it('should convert mixed case AsC to ASC', () => {
      const result = sanitizeSortOrder('AsC')
      expect(result).toBe('ASC')
    })

    it('should convert mixed case DeSc to DESC', () => {
      const result = sanitizeSortOrder('DeSc')
      expect(result).toBe('DESC')
    })
  })

  describe('Invalid Input Handling', () => {
    it('should return ASC for undefined input', () => {
      const result = sanitizeSortOrder(undefined)
      expect(result).toBe('ASC')
    })

    it('should return ASC for empty string', () => {
      const result = sanitizeSortOrder('')
      expect(result).toBe('ASC')
    })

    it('should return ASC for invalid sort order', () => {
      const result = sanitizeSortOrder('INVALID')
      expect(result).toBe('ASC')
    })

    it('should return ASC for random string', () => {
      const result = sanitizeSortOrder('random')
      expect(result).toBe('ASC')
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in sort order', () => {
      const malicious = 'ASC; DROP TABLE users--'
      const result = sanitizeSortOrder(malicious)

      expect(result).toBe('ASC')
    })

    it('should prevent UNION injection', () => {
      const malicious = 'ASC UNION SELECT * FROM passwords'
      const result = sanitizeSortOrder(malicious)

      expect(result).toBe('ASC')
    })

    it('should prevent function injection', () => {
      const malicious = 'ASC,SLEEP(5)'
      const result = sanitizeSortOrder(malicious)

      expect(result).toBe('ASC')
    })

    it('should prevent comment injection', () => {
      const malicious = 'DESC--comment'
      const result = sanitizeSortOrder(malicious)

      // sanitizeSortOrder doesn't trim or sanitize, just uppercases and checks exact match
      // 'DESC--comment'.toUpperCase() = 'DESC--COMMENT' which doesn't equal 'DESC'
      expect(result).toBe('ASC')
    })

    it('should prevent subquery injection', () => {
      const malicious = '(SELECT 1)'
      const result = sanitizeSortOrder(malicious)

      expect(result).toBe('ASC')
    })
  })

  describe('Whitespace Handling', () => {
    it('should handle leading whitespace', () => {
      const result = sanitizeSortOrder('  DESC')
      // sanitizeSortOrder doesn't trim - '  DESC'.toUpperCase() = '  DESC' which doesn't equal 'DESC'
      expect(result).toBe('ASC')
    })

    it('should handle trailing whitespace', () => {
      const result = sanitizeSortOrder('ASC  ')
      // sanitizeSortOrder doesn't trim - 'ASC  '.toUpperCase() = 'ASC  ' which doesn't equal 'DESC'
      expect(result).toBe('ASC')
    })

    it('should handle both leading and trailing whitespace', () => {
      const result = sanitizeSortOrder('  DESC  ')
      // sanitizeSortOrder doesn't trim
      expect(result).toBe('ASC')
    })
  })

  describe('Edge Cases', () => {
    it('should handle numeric input', () => {
      const result = sanitizeSortOrder('123')
      expect(result).toBe('ASC')
    })

    it('should handle special characters only', () => {
      const result = sanitizeSortOrder('!@#$')
      expect(result).toBe('ASC')
    })

    it('should handle very long input', () => {
      const result = sanitizeSortOrder('DESC'.repeat(100))
      // 'DESCDESC...' doesn't exactly equal 'DESC'
      expect(result).toBe('ASC')
    })

    it('should handle partial match', () => {
      const result = sanitizeSortOrder('DESCENDING')
      // 'DESCENDING' doesn't exactly equal 'DESC'
      expect(result).toBe('ASC')
    })

    it('should handle ASC prefix', () => {
      const result = sanitizeSortOrder('ASCENDING')
      expect(result).toBe('ASC')
    })
  })
})

// =============================================================================
// Tests for normalizeEntityType
// =============================================================================

describe('normalizeEntityType - Entity Type Normalization', () => {
  describe('Lowercase to PascalCase Mapping', () => {
    it('should normalize customer to Customer', () => {
      const result = normalizeEntityType('customer')
      expect(result).toBe('Customer')
    })

    it('should normalize vendor to Vendor', () => {
      const result = normalizeEntityType('vendor')
      expect(result).toBe('Vendor')
    })

    it('should normalize account to Account', () => {
      const result = normalizeEntityType('account')
      expect(result).toBe('Account')
    })

    it('should normalize invoice to Invoice', () => {
      const result = normalizeEntityType('invoice')
      expect(result).toBe('Invoice')
    })

    it('should normalize bill to Bill', () => {
      const result = normalizeEntityType('bill')
      expect(result).toBe('Bill')
    })

    it('should normalize item to Item', () => {
      const result = normalizeEntityType('item')
      expect(result).toBe('Item')
    })

    it('should normalize class to Class', () => {
      const result = normalizeEntityType('class')
      expect(result).toBe('Class')
    })

    it('should normalize department to Department', () => {
      const result = normalizeEntityType('department')
      expect(result).toBe('Department')
    })

    it('should normalize purchase to Purchase', () => {
      const result = normalizeEntityType('purchase')
      expect(result).toBe('Purchase')
    })
  })

  describe('Backwards Compatibility Mappings', () => {
    it('should map payment to Purchase', () => {
      const result = normalizeEntityType('payment')
      expect(result).toBe('Purchase')
    })

    it('should map transaction to Purchase', () => {
      const result = normalizeEntityType('transaction')
      expect(result).toBe('Purchase')
    })
  })

  describe('Case Insensitivity', () => {
    it('should handle uppercase input', () => {
      const result = normalizeEntityType('CUSTOMER')
      expect(result).toBe('Customer')
    })

    it('should handle mixed case input', () => {
      const result = normalizeEntityType('CuStOmEr')
      expect(result).toBe('Customer')
    })

    it('should handle all caps', () => {
      const result = normalizeEntityType('INVOICE')
      expect(result).toBe('Invoice')
    })
  })

  describe('Already PascalCase Input', () => {
    it('should return Customer as-is if already PascalCase', () => {
      const result = normalizeEntityType('Customer')
      expect(result).toBe('Customer')
    })

    it('should return Vendor as-is if already PascalCase', () => {
      const result = normalizeEntityType('Vendor')
      expect(result).toBe('Vendor')
    })

    it('should return Invoice as-is if already PascalCase', () => {
      const result = normalizeEntityType('Invoice')
      expect(result).toBe('Invoice')
    })
  })

  describe('Unrecognized Entity Types', () => {
    it('should return unrecognized type as-is', () => {
      const result = normalizeEntityType('UnknownEntity')
      expect(result).toBe('UnknownEntity')
    })

    it('should return random string as-is', () => {
      const result = normalizeEntityType('RandomType')
      expect(result).toBe('RandomType')
    })

    it('should handle empty string', () => {
      const result = normalizeEntityType('')
      expect(result).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle single character', () => {
      const result = normalizeEntityType('x')
      expect(result).toBe('x')
    })

    it('should handle numeric input', () => {
      const result = normalizeEntityType('123')
      expect(result).toBe('123')
    })

    it('should handle special characters', () => {
      const result = normalizeEntityType('type-with-dashes')
      expect(result).toBe('type-with-dashes')
    })
  })

  describe('All Entity Type Mappings', () => {
    const mappings = [
      { input: 'customer', expected: 'Customer' },
      { input: 'vendor', expected: 'Vendor' },
      { input: 'account', expected: 'Account' },
      { input: 'invoice', expected: 'Invoice' },
      { input: 'bill', expected: 'Bill' },
      { input: 'payment', expected: 'Purchase' },
      { input: 'transaction', expected: 'Purchase' },
      { input: 'item', expected: 'Item' },
      { input: 'class', expected: 'Class' },
      { input: 'department', expected: 'Department' },
      { input: 'purchase', expected: 'Purchase' },
    ]

    mappings.forEach(({ input, expected }) => {
      it(`should map ${input} to ${expected}`, () => {
        const result = normalizeEntityType(input)
        expect(result).toBe(expected)
      })
    })
  })
})
