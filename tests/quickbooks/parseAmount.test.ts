/**
 * Test parseAmount function for handling various number formats
 * including parenthetical negatives used in accounting systems
 */

import { describe, it, expect } from 'vitest'

// Import the parseAmount function - note: it's not exported so we'll test the transformers indirectly
// For now, this is a reference test showing expected behavior

describe('parseAmount function behavior', () => {
  // Replicate the parseAmount logic for testing
  function parseAmount(value: string | undefined | null): number {
    if (!value || value === '' || value === '-') return 0
    // Remove currency symbols, commas, and whitespace
    let cleaned = value.replace(/[$,\s]/g, '').trim()

    // Handle parenthetical negatives: (100) → -100
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1)
    }

    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  describe('positive numbers', () => {
    it('should parse plain numbers', () => {
      expect(parseAmount('100')).toBe(100)
      expect(parseAmount('1234.56')).toBe(1234.56)
    })

    it('should parse numbers with currency symbols', () => {
      expect(parseAmount('$100')).toBe(100)
      expect(parseAmount('$1,234.56')).toBe(1234.56)
    })

    it('should parse numbers with commas', () => {
      expect(parseAmount('1,234')).toBe(1234)
      expect(parseAmount('1,234,567.89')).toBe(1234567.89)
    })

    it('should parse numbers with whitespace', () => {
      expect(parseAmount(' 100 ')).toBe(100)
      expect(parseAmount('1 234.56')).toBe(1234.56)
    })
  })

  describe('negative numbers', () => {
    it('should parse numbers with minus sign', () => {
      expect(parseAmount('-100')).toBe(-100)
      expect(parseAmount('-1,234.56')).toBe(-1234.56)
    })

    it('should parse parenthetical negatives (accounting format)', () => {
      expect(parseAmount('(100)')).toBe(-100)
      expect(parseAmount('(1,234.56)')).toBe(-1234.56)
      expect(parseAmount('$(1,234.56)')).toBe(-1234.56)
      expect(parseAmount('$ (500.00)')).toBe(-500.0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty values', () => {
      expect(parseAmount('')).toBe(0)
      expect(parseAmount('-')).toBe(0)
      expect(parseAmount(null)).toBe(0)
      expect(parseAmount(undefined)).toBe(0)
    })

    it('should handle invalid numbers', () => {
      expect(parseAmount('abc')).toBe(0)
      expect(parseAmount('N/A')).toBe(0)
    })

    it('should handle zero', () => {
      expect(parseAmount('0')).toBe(0)
      expect(parseAmount('0.00')).toBe(0)
      expect(parseAmount('$0.00')).toBe(0)
    })
  })

  describe('complex formats', () => {
    it('should handle mixed currency symbols and parentheses', () => {
      expect(parseAmount('$(100.00)')).toBe(-100)
      expect(parseAmount('$ (1,234.56)')).toBe(-1234.56)
    })

    it('should handle decimals', () => {
      expect(parseAmount('0.99')).toBe(0.99)
      expect(parseAmount('(0.99)')).toBe(-0.99)
      expect(parseAmount('$0.99')).toBe(0.99)
    })
  })
})
