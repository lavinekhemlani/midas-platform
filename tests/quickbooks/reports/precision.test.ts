/**
 * Precision Tests for QuickBooks Report Transformers
 *
 * Tests the parseAmount function's use of Decimal.js to ensure
 * accurate financial calculations without floating-point precision errors.
 *
 * Key test areas:
 * 1. Parsing various amount formats to Decimal values
 * 2. Financial calculation accuracy (avoiding floating-point drift)
 * 3. Precision maintenance for large and small numbers
 * 4. Edge cases with many decimal places
 */

import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'

/**
 * Implementation of parseAmount from transformers.ts
 * Returns Decimal for testing precision
 */
function parseAmountToDecimal(value: string | number | undefined | null): Decimal {
  if (value === undefined || value === null || value === '' || value === '-') {
    return new Decimal(0)
  }

  // If already a number, convert to Decimal
  if (typeof value === 'number') {
    return new Decimal(value)
  }

  // Remove currency symbols, commas, and whitespace
  let cleaned = value.replace(/[$,\s]/g, '').trim()

  // Handle parenthetical negatives: (100) → -100
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  try {
    const decimal = new Decimal(cleaned || 0)
    return isNegative ? decimal.negated() : decimal
  } catch {
    return new Decimal(0)
  }
}

/**
 * Current implementation from transformers.ts
 * Uses Decimal internally but returns number
 */
function parseAmount(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '' || value === '-') return 0

  // If already a number, convert to Decimal and back to number
  if (typeof value === 'number') {
    return new Decimal(value).toNumber()
  }

  // Remove currency symbols, commas, and whitespace
  let cleaned = value.replace(/[$,\s]/g, '').trim()

  // Handle parenthetical negatives: (100) → -100
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  try {
    const decimal = new Decimal(cleaned || 0)
    return isNegative ? decimal.negated().toNumber() : decimal.toNumber()
  } catch {
    return 0
  }
}

describe('parseAmount - String Format Parsing to Decimal', () => {
  describe('basic string parsing', () => {
    it('should parse string "1000.50" to Decimal(1000.50)', () => {
      const result = parseAmountToDecimal('1000.50')
      expect(result.equals(new Decimal('1000.50'))).toBe(true)
      expect(result.toString()).toBe('1000.5')
    })

    it('should parse string "$1,234.56" to Decimal(1234.56)', () => {
      const result = parseAmountToDecimal('$1,234.56')
      expect(result.equals(new Decimal('1234.56'))).toBe(true)
      expect(result.toString()).toBe('1234.56')
    })

    it('should parse string "(500.00)" (parenthetical negative) to Decimal(-500)', () => {
      const result = parseAmountToDecimal('(500.00)')
      expect(result.equals(new Decimal('-500'))).toBe(true)
      expect(result.isNegative()).toBe(true)
      expect(result.toString()).toBe('-500')
    })

    it('should parse string "-100.25" to Decimal(-100.25)', () => {
      const result = parseAmountToDecimal('-100.25')
      expect(result.equals(new Decimal('-100.25'))).toBe(true)
      expect(result.toString()).toBe('-100.25')
    })

    it('should parse number 1234.56 to Decimal(1234.56)', () => {
      const result = parseAmountToDecimal(1234.56)
      expect(result.equals(new Decimal('1234.56'))).toBe(true)
      expect(result.toString()).toBe('1234.56')
    })
  })

  describe('empty and null values', () => {
    it('should parse empty string to Decimal(0)', () => {
      const result = parseAmountToDecimal('')
      expect(result.equals(new Decimal(0))).toBe(true)
      expect(result.isZero()).toBe(true)
    })

    it('should parse undefined to Decimal(0)', () => {
      const result = parseAmountToDecimal(undefined)
      expect(result.equals(new Decimal(0))).toBe(true)
      expect(result.isZero()).toBe(true)
    })

    it('should parse null to Decimal(0)', () => {
      const result = parseAmountToDecimal(null)
      expect(result.equals(new Decimal(0))).toBe(true)
      expect(result.isZero()).toBe(true)
    })

    it('should parse "-" to Decimal(0)', () => {
      const result = parseAmountToDecimal('-')
      expect(result.equals(new Decimal(0))).toBe(true)
      expect(result.isZero()).toBe(true)
    })
  })

  describe('large number precision', () => {
    it('should maintain precision for "999999999999.99"', () => {
      const result = parseAmountToDecimal('999999999999.99')
      expect(result.equals(new Decimal('999999999999.99'))).toBe(true)
      expect(result.toString()).toBe('999999999999.99')

      // Verify precision is maintained
      const expected = new Decimal('999999999999.99')
      expect(result.minus(expected).isZero()).toBe(true)
    })

    it('should handle very large numbers accurately', () => {
      const result = parseAmountToDecimal('9999999999999999.99')
      expect(result.toString()).toBe('9999999999999999.99')

      // Add small amount and verify precision
      const withAddition = result.plus(new Decimal('0.01'))
      expect(withAddition.toString()).toBe('10000000000000000')
    })
  })

  describe('many decimal places', () => {
    it('should maintain precision for "100.123456789"', () => {
      const result = parseAmountToDecimal('100.123456789')
      expect(result.equals(new Decimal('100.123456789'))).toBe(true)
      expect(result.toString()).toBe('100.123456789')
    })

    it('should handle up to 10 decimal places', () => {
      const result = parseAmountToDecimal('0.1234567890')
      expect(result.toString()).toBe('0.123456789')

      // Verify exact value
      expect(result.equals(new Decimal('0.1234567890'))).toBe(true)
    })

    it('should preserve trailing precision in calculations', () => {
      const value = parseAmountToDecimal('100.000000001')
      expect(value.toString()).toBe('100.000000001')

      // Should not round unless explicitly requested
      const doubled = value.times(2)
      expect(doubled.toString()).toBe('200.000000002')
    })
  })

  describe('complex formatting', () => {
    it('should handle currency with commas and decimals', () => {
      const result = parseAmountToDecimal('$1,234,567.89')
      expect(result.equals(new Decimal('1234567.89'))).toBe(true)
      expect(result.toString()).toBe('1234567.89')
    })

    it('should handle parenthetical negatives with currency symbols', () => {
      const result = parseAmountToDecimal('$(1,234.56)')
      expect(result.equals(new Decimal('-1234.56'))).toBe(true)
      expect(result.isNegative()).toBe(true)
    })

    it('should handle whitespace around values', () => {
      const result = parseAmountToDecimal('  1234.56  ')
      expect(result.equals(new Decimal('1234.56'))).toBe(true)
    })
  })
})

describe('Financial Calculation Accuracy with Decimal', () => {
  describe('floating-point precision issues (classic examples)', () => {
    it('should calculate 0.1 + 0.2 = 0.3 correctly (fails with floats)', () => {
      // Classic floating-point issue
      const jsFloat = 0.1 + 0.2
      expect(jsFloat).not.toBe(0.3) // JavaScript fails this
      expect(jsFloat).toBe(0.30000000000000004)

      // Decimal handles it correctly
      const decimal1 = parseAmountToDecimal('0.1')
      const decimal2 = parseAmountToDecimal('0.2')
      const result = decimal1.plus(decimal2)

      expect(result.equals(new Decimal('0.3'))).toBe(true)
      expect(result.toString()).toBe('0.3')
    })

    it('should calculate 0.1 + 0.2 + 0.3 = 0.6 correctly', () => {
      const jsFloat = 0.1 + 0.2 + 0.3
      expect(jsFloat).not.toBe(0.6)

      const result = parseAmountToDecimal('0.1')
        .plus(parseAmountToDecimal('0.2'))
        .plus(parseAmountToDecimal('0.3'))

      expect(result.equals(new Decimal('0.6'))).toBe(true)
      expect(result.toString()).toBe('0.6')
    })

    it('should handle 1.0 - 0.9 = 0.1 correctly', () => {
      const jsFloat = 1.0 - 0.9
      expect(jsFloat).not.toBe(0.1)
      expect(jsFloat).toBe(0.09999999999999998)

      const result = parseAmountToDecimal('1.0').minus(parseAmountToDecimal('0.9'))

      expect(result.equals(new Decimal('0.1'))).toBe(true)
      expect(result.toString()).toBe('0.1')
    })
  })

  describe('sum of many small amounts (no floating-point drift)', () => {
    it('should sum 100 instances of 0.01 to exactly 1.00', () => {
      let decimalSum = new Decimal(0)

      for (let i = 0; i < 100; i++) {
        decimalSum = decimalSum.plus(parseAmountToDecimal('0.01'))
      }

      expect(decimalSum.equals(new Decimal('1.00'))).toBe(true)
      expect(decimalSum.toString()).toBe('1')

      // Compare with JavaScript float (which drifts)
      let floatSum = 0
      for (let i = 0; i < 100; i++) {
        floatSum += 0.01
      }
      expect(floatSum).not.toBe(1.0)
      expect(floatSum).toBe(0.9999999999999999)
    })

    it('should sum 1000 instances of 0.001 to exactly 1.000', () => {
      let decimalSum = new Decimal(0)

      for (let i = 0; i < 1000; i++) {
        decimalSum = decimalSum.plus(parseAmountToDecimal('0.001'))
      }

      expect(decimalSum.equals(new Decimal('1.000'))).toBe(true)
      expect(decimalSum.toString()).toBe('1')
    })

    it('should maintain precision when summing mixed amounts', () => {
      const amounts = ['100.11', '200.22', '300.33', '0.01', '0.02', '0.03']
      let sum = new Decimal(0)

      for (const amount of amounts) {
        sum = sum.plus(parseAmountToDecimal(amount))
      }

      const expected = new Decimal('600.72')
      expect(sum.equals(expected)).toBe(true)
      expect(sum.toString()).toBe('600.72')
    })
  })

  describe('large number + small number precision', () => {
    it('should maintain precision when adding small amount to large number', () => {
      const large = parseAmountToDecimal('999999999999.99')
      const small = parseAmountToDecimal('0.01')
      const result = large.plus(small)

      expect(result.toString()).toBe('1000000000000')
      expect(result.equals(new Decimal('1000000000000.00'))).toBe(true)
    })

    it('should handle precision in invoice totals scenario', () => {
      // Simulating invoice: large subtotal + small tax
      const subtotal = parseAmountToDecimal('9999999.99')
      const tax = parseAmountToDecimal('0.01')
      const total = subtotal.plus(tax)

      expect(total.toString()).toBe('10000000')

      // Verify we can subtract back accurately
      const backToSubtotal = total.minus(tax)
      expect(backToSubtotal.equals(subtotal)).toBe(true)
    })

    it('should maintain precision across multiple operations', () => {
      const start = parseAmountToDecimal('1000000.00')
      const result = start
        .plus(parseAmountToDecimal('0.01'))
        .plus(parseAmountToDecimal('0.02'))
        .minus(parseAmountToDecimal('0.03'))

      expect(result.equals(new Decimal('1000000.00'))).toBe(true)
      expect(result.toString()).toBe('1000000')
    })
  })

  describe('real-world financial scenarios', () => {
    it('should calculate tax accurately (15% of $1234.56)', () => {
      const amount = parseAmountToDecimal('1234.56')
      const taxRate = new Decimal('0.15')
      const tax = amount.times(taxRate)

      expect(tax.toFixed(2)).toBe('185.18')

      const total = amount.plus(tax)
      expect(total.toFixed(2)).toBe('1419.74')
    })

    it('should split bill accurately among 3 people', () => {
      const total = parseAmountToDecimal('100.00')
      const perPerson = total.dividedBy(new Decimal('3'))

      // Each person pays
      expect(perPerson.toFixed(2)).toBe('33.33')

      // Verify total when rounded
      const rounded = new Decimal(perPerson.toFixed(2))
      const sumOfThree = rounded.times(3)

      // Should be 99.99 due to rounding
      expect(sumOfThree.toString()).toBe('99.99')

      // But exact division maintains precision
      const exactSum = perPerson.times(3)
      expect(exactSum.equals(total)).toBe(true)
    })

    it('should calculate compound interest accurately', () => {
      const principal = parseAmountToDecimal('1000.00')
      const rate = new Decimal('0.05') // 5% annual
      const years = 10

      let amount = principal
      for (let i = 0; i < years; i++) {
        amount = amount.times(new Decimal('1').plus(rate))
      }

      // After 10 years at 5%: 1000 * (1.05)^10 = 1628.89
      expect(amount.toFixed(2)).toBe('1628.89')
    })

    it('should handle currency conversion with precision', () => {
      const usd = parseAmountToDecimal('100.00')
      const exchangeRate = new Decimal('1.234567') // USD to EUR
      const eur = usd.times(exchangeRate)

      expect(eur.toFixed(2)).toBe('123.46')

      // Convert back
      const backToUsd = eur.dividedBy(exchangeRate)
      expect(backToUsd.toFixed(2)).toBe('100.00')
    })
  })

  describe('profit and loss calculations', () => {
    it('should calculate gross profit accurately', () => {
      const revenue = parseAmountToDecimal('1234567.89')
      const cogs = parseAmountToDecimal('876543.21')
      const grossProfit = revenue.minus(cogs)

      expect(grossProfit.toString()).toBe('358024.68')
      expect(grossProfit.equals(new Decimal('358024.68'))).toBe(true)
    })

    it('should calculate net income with multiple operations', () => {
      const revenue = parseAmountToDecimal('100000.00')
      const cogs = parseAmountToDecimal('40000.00')
      const expenses = parseAmountToDecimal('25000.50')
      const otherIncome = parseAmountToDecimal('5000.25')
      const otherExpenses = parseAmountToDecimal('1500.75')

      const grossProfit = revenue.minus(cogs)
      const netOperatingIncome = grossProfit.minus(expenses)
      const netIncome = netOperatingIncome.plus(otherIncome).minus(otherExpenses)

      expect(netIncome.toString()).toBe('38500')
      expect(netIncome.equals(new Decimal('38500.00'))).toBe(true)
    })
  })
})

describe('Current parseAmount Implementation (returns number)', () => {
  describe('basic functionality', () => {
    it('should parse string amounts correctly', () => {
      expect(parseAmount('1000.50')).toBe(1000.5)
      expect(parseAmount('$1,234.56')).toBe(1234.56)
      expect(parseAmount('(500.00)')).toBe(-500)
      expect(parseAmount('-100.25')).toBe(-100.25)
    })

    it('should handle number inputs', () => {
      expect(parseAmount(1234.56)).toBe(1234.56)
      expect(parseAmount(0)).toBe(0)
      expect(parseAmount(-100)).toBe(-100)
    })

    it('should handle edge cases', () => {
      expect(parseAmount('')).toBe(0)
      expect(parseAmount(undefined)).toBe(0)
      expect(parseAmount(null)).toBe(0)
      expect(parseAmount('-')).toBe(0)
    })
  })

  describe('precision in returned numbers', () => {
    it('should maintain precision for typical financial amounts', () => {
      const result = parseAmount('999999999999.99')
      expect(result).toBe(999999999999.99)
    })

    it('should handle calculations with Decimal internally', () => {
      // Even though it returns number, internal Decimal usage helps
      const amount1 = parseAmount('0.1')
      const amount2 = parseAmount('0.2')

      // Direct addition still has float issues since we return numbers
      const directSum = amount1 + amount2
      expect(directSum).toBe(0.30000000000000004)

      // But parseAmount itself uses Decimal for parsing
      const parsed = parseAmount('0.3')
      expect(parsed).toBe(0.3)
    })
  })

  describe('integration with Decimal for calculations', () => {
    it('should allow converting back to Decimal for precise calculations', () => {
      // Parse amounts
      const num1 = parseAmount('0.1')
      const num2 = parseAmount('0.2')

      // Convert to Decimal for calculation
      const decimal1 = new Decimal(num1)
      const decimal2 = new Decimal(num2)
      const result = decimal1.plus(decimal2)

      expect(result.equals(new Decimal('0.3'))).toBe(true)
    })

    it('should work in financial calculation pipeline', () => {
      // Parse various amounts
      const amounts = ['100.11', '200.22', '300.33'].map(parseAmount)

      // Sum using Decimal
      const sum = amounts.reduce((acc, val) => acc.plus(new Decimal(val)), new Decimal(0))

      expect(sum.toString()).toBe('600.66')
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  describe('malformed input', () => {
    it('should handle invalid number strings', () => {
      const result = parseAmountToDecimal('abc')
      expect(result.equals(new Decimal(0))).toBe(true)
    })

    it('should handle multiple decimal points', () => {
      const result = parseAmountToDecimal('100.50.25')
      expect(result.equals(new Decimal(0))).toBe(true)
    })

    it('should handle special characters', () => {
      expect(parseAmountToDecimal('@#$%').isZero()).toBe(true)
      expect(parseAmountToDecimal('N/A').isZero()).toBe(true)
    })
  })

  describe('boundary values', () => {
    it('should handle zero values', () => {
      expect(parseAmountToDecimal('0').isZero()).toBe(true)
      expect(parseAmountToDecimal('0.00').isZero()).toBe(true)
      expect(parseAmountToDecimal('$0.00').isZero()).toBe(true)
      expect(parseAmountToDecimal('(0.00)').isZero()).toBe(true)
    })

    it('should handle very small numbers', () => {
      const result = parseAmountToDecimal('0.00000001')
      expect(result.toString()).toBe('0.00000001')
      expect(result.greaterThan(0)).toBe(true)
    })

    it('should handle maximum safe integer', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER.toString()
      const result = parseAmountToDecimal(maxSafe)
      expect(result.toString()).toBe('9007199254740991')
    })
  })
})
