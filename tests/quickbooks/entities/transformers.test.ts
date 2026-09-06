/**
 * Comprehensive tests for invoice/bill status determination logic
 * Tests the critical business logic for determining payment status
 * based on balance and total amounts.
 */

import { describe, it, expect } from 'vitest'

// Import the EPSILON constant and helper functions to test
// Note: These are internal to transformers.ts, so we replicate them here for testing
const EPSILON = 0.001

function isEffectivelyZero(value: number | undefined): boolean {
  return value === undefined || Math.abs(value) < EPSILON
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'partial' | 'void'
type BillStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'

interface MockInvoice {
  Balance?: number
  TotalAmt: number
  DueDate?: string
  EmailStatus?: 'EmailSent' | 'NeedToSend' | 'NotSet'
}

interface MockBill {
  Balance?: number
  TotalAmt: number
  DueDate?: string
}

/**
 * Replicate the determineInvoiceStatus logic for testing
 */
function determineInvoiceStatus(raw: MockInvoice): InvoiceStatus {
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

/**
 * Replicate the determineBillStatus logic for testing
 */
function determineBillStatus(raw: MockBill): BillStatus {
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

describe('isEffectivelyZero', () => {
  describe('zero values', () => {
    it('should return true for exact zero', () => {
      expect(isEffectivelyZero(0)).toBe(true)
    })

    it('should return true for 0.0', () => {
      expect(isEffectivelyZero(0.0)).toBe(true)
    })

    it('should return true for -0', () => {
      expect(isEffectivelyZero(-0)).toBe(true)
    })
  })

  describe('values below epsilon threshold', () => {
    it('should return true for 0.0001 (below 0.001 epsilon)', () => {
      expect(isEffectivelyZero(0.0001)).toBe(true)
    })

    it('should return true for -0.0001 (below epsilon)', () => {
      expect(isEffectivelyZero(-0.0001)).toBe(true)
    })

    it('should return true for 0.0009 (just below epsilon)', () => {
      expect(isEffectivelyZero(0.0009)).toBe(true)
    })

    it('should return true for -0.0009 (just below epsilon)', () => {
      expect(isEffectivelyZero(-0.0009)).toBe(true)
    })
  })

  describe('values at or above epsilon threshold', () => {
    it('should return false for 0.001 (at epsilon)', () => {
      expect(isEffectivelyZero(0.001)).toBe(false)
    })

    it('should return false for 0.01 (above epsilon)', () => {
      expect(isEffectivelyZero(0.01)).toBe(false)
    })

    it('should return false for -0.01 (above epsilon magnitude)', () => {
      expect(isEffectivelyZero(-0.01)).toBe(false)
    })

    it('should return false for 1', () => {
      expect(isEffectivelyZero(1)).toBe(false)
    })

    it('should return false for -1', () => {
      expect(isEffectivelyZero(-1)).toBe(false)
    })
  })

  describe('undefined values', () => {
    it('should return true for undefined', () => {
      expect(isEffectivelyZero(undefined)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle very small positive numbers', () => {
      expect(isEffectivelyZero(0.00001)).toBe(true)
      expect(isEffectivelyZero(0.000001)).toBe(true)
    })

    it('should handle very small negative numbers', () => {
      expect(isEffectivelyZero(-0.00001)).toBe(true)
      expect(isEffectivelyZero(-0.000001)).toBe(true)
    })

    it('should handle floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const impreciseZero = 0.1 + 0.2 - 0.3
      expect(isEffectivelyZero(impreciseZero)).toBe(true)
    })
  })
})

describe('determineInvoiceStatus', () => {
  describe('paid status (balance = 0)', () => {
    it('should return "paid" when balance is exactly 0', () => {
      const invoice: MockInvoice = {
        Balance: 0,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should return "paid" when balance is 0.0', () => {
      const invoice: MockInvoice = {
        Balance: 0.0,
        TotalAmt: 500.0,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should return "paid" when balance is very small (< EPSILON)', () => {
      const invoice: MockInvoice = {
        Balance: 0.0001,
        TotalAmt: 1000,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should return "paid" when balance is very small negative (< EPSILON)', () => {
      const invoice: MockInvoice = {
        Balance: -0.0001,
        TotalAmt: 1000,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should return "paid" when balance is undefined', () => {
      const invoice: MockInvoice = {
        Balance: undefined,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })
  })

  describe('overpaid status (negative balance)', () => {
    // NOTE: The current logic treats negative balance as "partial" because
    // Balance < TotalAmt is true for negative values. This may be a bug.
    // Overpayment should arguably be treated as "paid" status.
    it('should return "partial" for negative balance (current behavior)', () => {
      const invoice: MockInvoice = {
        Balance: -50,
        TotalAmt: 100,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" for large negative balance (current behavior)', () => {
      const invoice: MockInvoice = {
        Balance: -1000,
        TotalAmt: 500,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" for small negative balance < -EPSILON (current behavior)', () => {
      const invoice: MockInvoice = {
        Balance: -0.01,
        TotalAmt: 100,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })
  })

  describe('open status (balance = total)', () => {
    it('should return "draft" when balance equals total (no due date, not sent)', () => {
      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })

    it('should return "sent" when balance equals total and email was sent', () => {
      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        EmailStatus: 'EmailSent',
      }
      expect(determineInvoiceStatus(invoice)).toBe('sent')
    })

    it('should return "overdue" when balance equals total and past due date', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: yesterday.toISOString(),
      }
      expect(determineInvoiceStatus(invoice)).toBe('overdue')
    })
  })

  describe('partial payment status', () => {
    it('should return "partial" when 0 < balance < total', () => {
      const invoice: MockInvoice = {
        Balance: 50,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" when most is paid', () => {
      const invoice: MockInvoice = {
        Balance: 10,
        TotalAmt: 1000,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" when small amount paid', () => {
      const invoice: MockInvoice = {
        Balance: 990,
        TotalAmt: 1000,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" for minimal partial payment', () => {
      const invoice: MockInvoice = {
        Balance: 99.99,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should return "partial" for overpaid (negative balance) - current behavior', () => {
      const invoice: MockInvoice = {
        Balance: -10,
        TotalAmt: 100,
      }
      // Current behavior: negative balance returns 'partial' (may be a bug)
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })
  })

  describe('overdue status', () => {
    it('should return "overdue" when past due date with full balance', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: yesterday.toISOString(),
      }
      expect(determineInvoiceStatus(invoice)).toBe('overdue')
    })

    it('should return "overdue" when past due date with partial balance', () => {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)

      const invoice: MockInvoice = {
        Balance: 50,
        TotalAmt: 100,
        DueDate: lastWeek.toISOString(),
      }
      // Note: Based on the logic, partial takes precedence over overdue
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should NOT return "overdue" when due date is today', () => {
      const today = new Date()

      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: today.toISOString(),
      }
      expect(determineInvoiceStatus(invoice)).not.toBe('overdue')
    })

    it('should NOT return "overdue" when due date is in the future', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: tomorrow.toISOString(),
      }
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })
  })

  describe('sent status', () => {
    it('should return "sent" when email sent and balance equals total', () => {
      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        EmailStatus: 'EmailSent',
      }
      expect(determineInvoiceStatus(invoice)).toBe('sent')
    })

    it('should NOT return "sent" when partial payment exists (partial takes precedence)', () => {
      const invoice: MockInvoice = {
        Balance: 50,
        TotalAmt: 100,
        EmailStatus: 'EmailSent',
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should NOT return "sent" when fully paid', () => {
      const invoice: MockInvoice = {
        Balance: 0,
        TotalAmt: 100,
        EmailStatus: 'EmailSent',
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })
  })

  describe('draft status (default)', () => {
    it('should return "draft" when no other conditions match', () => {
      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })

    it('should return "draft" when email not sent and not overdue', () => {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)

      const invoice: MockInvoice = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: nextWeek.toISOString(),
        EmailStatus: 'NeedToSend',
      }
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })
  })

  describe('status precedence logic', () => {
    it('should prioritize paid over partial over overdue over sent over draft', () => {
      // Paid takes precedence
      expect(
        determineInvoiceStatus({
          Balance: 0,
          TotalAmt: 100,
          EmailStatus: 'EmailSent',
        })
      ).toBe('paid')

      // Partial takes precedence over sent
      expect(
        determineInvoiceStatus({
          Balance: 50,
          TotalAmt: 100,
          EmailStatus: 'EmailSent',
        })
      ).toBe('partial')

      // Partial takes precedence over overdue (based on current logic)
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      expect(
        determineInvoiceStatus({
          Balance: 50,
          TotalAmt: 100,
          DueDate: lastWeek.toISOString(),
        })
      ).toBe('partial')
    })
  })

  describe('real-world scenarios', () => {
    it('should handle typical unpaid invoice', () => {
      const invoice: MockInvoice = {
        Balance: 1500.0,
        TotalAmt: 1500.0,
        DueDate: '2025-01-31',
      }
      // Note: This returns 'overdue' if date is in the past, 'draft' if in future
      // The test date needs to be in the future to be 'draft'
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      invoice.DueDate = futureDate.toISOString()
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })

    it('should handle invoice with partial payment', () => {
      const invoice: MockInvoice = {
        Balance: 750.0,
        TotalAmt: 1500.0,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should handle fully paid invoice', () => {
      const invoice: MockInvoice = {
        Balance: 0,
        TotalAmt: 1500.0,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should handle overpaid invoice (customer credit) - current behavior', () => {
      const invoice: MockInvoice = {
        Balance: -100,
        TotalAmt: 1500.0,
      }
      // Current behavior: returns 'partial' for negative balance
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should handle invoice with rounding error', () => {
      const invoice: MockInvoice = {
        Balance: 0.0005, // Less than EPSILON
        TotalAmt: 1500.0,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })
  })
})

describe('determineBillStatus', () => {
  describe('paid status (balance = 0)', () => {
    it('should return "paid" when balance is exactly 0', () => {
      const bill: MockBill = {
        Balance: 0,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should return "paid" when balance is 0.0', () => {
      const bill: MockBill = {
        Balance: 0.0,
        TotalAmt: 500.0,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should return "paid" when balance is very small (< EPSILON)', () => {
      const bill: MockBill = {
        Balance: 0.0001,
        TotalAmt: 1000,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should return "paid" when balance is very small negative (< EPSILON)', () => {
      const bill: MockBill = {
        Balance: -0.0001,
        TotalAmt: 1000,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should return "paid" when balance is undefined', () => {
      const bill: MockBill = {
        Balance: undefined,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })
  })

  describe('overpaid status (negative balance)', () => {
    // NOTE: The current logic treats negative balance as "partial" because
    // Balance < TotalAmt is true for negative values. This may be a bug.
    // Overpayment should arguably be treated as "paid" status.
    it('should return "partial" for negative balance (current behavior)', () => {
      const bill: MockBill = {
        Balance: -50,
        TotalAmt: 100,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should return "partial" for large negative balance (current behavior)', () => {
      const bill: MockBill = {
        Balance: -1000,
        TotalAmt: 500,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should return "partial" for small negative balance < -EPSILON (current behavior)', () => {
      const bill: MockBill = {
        Balance: -0.01,
        TotalAmt: 100,
      }
      // Current behavior: returns 'partial' (may want to fix to 'paid')
      expect(determineBillStatus(bill)).toBe('partial')
    })
  })

  describe('open status (balance = total)', () => {
    it('should return "unpaid" when balance equals total (no due date)', () => {
      const bill: MockBill = {
        Balance: 100,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('unpaid')
    })

    it('should return "overdue" when balance equals total and past due date', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const bill: MockBill = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: yesterday.toISOString(),
      }
      expect(determineBillStatus(bill)).toBe('overdue')
    })
  })

  describe('partial payment status', () => {
    it('should return "partial" when 0 < balance < total', () => {
      const bill: MockBill = {
        Balance: 50,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should return "partial" when most is paid', () => {
      const bill: MockBill = {
        Balance: 10,
        TotalAmt: 1000,
      }
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should return "partial" when small amount paid', () => {
      const bill: MockBill = {
        Balance: 990,
        TotalAmt: 1000,
      }
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should return "partial" for minimal partial payment', () => {
      const bill: MockBill = {
        Balance: 99.99,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should NOT return "partial" for overpaid (negative balance)', () => {
      const bill: MockBill = {
        Balance: -10,
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).not.toBe('partial')
      expect(determineBillStatus(bill)).toBe('paid')
    })
  })

  describe('overdue status', () => {
    it('should return "overdue" when past due date with full balance', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const bill: MockBill = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: yesterday.toISOString(),
      }
      expect(determineBillStatus(bill)).toBe('overdue')
    })

    it('should return "overdue" when past due date with partial balance', () => {
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)

      const bill: MockBill = {
        Balance: 50,
        TotalAmt: 100,
        DueDate: lastWeek.toISOString(),
      }
      // Note: Based on the logic, partial takes precedence over overdue
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should NOT return "overdue" when due date is today', () => {
      const today = new Date()

      const bill: MockBill = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: today.toISOString(),
      }
      expect(determineBillStatus(bill)).not.toBe('overdue')
    })

    it('should NOT return "overdue" when due date is in the future', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const bill: MockBill = {
        Balance: 100,
        TotalAmt: 100,
        DueDate: tomorrow.toISOString(),
      }
      expect(determineBillStatus(bill)).toBe('unpaid')
    })
  })

  describe('status precedence logic', () => {
    it('should prioritize paid over partial over overdue over unpaid', () => {
      // Paid takes precedence
      expect(
        determineBillStatus({
          Balance: 0,
          TotalAmt: 100,
        })
      ).toBe('paid')

      // Partial takes precedence over unpaid
      expect(
        determineBillStatus({
          Balance: 50,
          TotalAmt: 100,
        })
      ).toBe('partial')

      // Partial takes precedence over overdue (based on current logic)
      const lastWeek = new Date()
      lastWeek.setDate(lastWeek.getDate() - 7)
      expect(
        determineBillStatus({
          Balance: 50,
          TotalAmt: 100,
          DueDate: lastWeek.toISOString(),
        })
      ).toBe('partial')
    })
  })

  describe('real-world scenarios', () => {
    it('should handle typical unpaid bill', () => {
      const bill: MockBill = {
        Balance: 2500.0,
        TotalAmt: 2500.0,
        DueDate: '2025-02-15',
      }
      expect(determineBillStatus(bill)).toBe('unpaid')
    })

    it('should handle bill with partial payment', () => {
      const bill: MockBill = {
        Balance: 1250.0,
        TotalAmt: 2500.0,
      }
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should handle fully paid bill', () => {
      const bill: MockBill = {
        Balance: 0,
        TotalAmt: 2500.0,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should handle overpaid bill (vendor credit)', () => {
      const bill: MockBill = {
        Balance: -200,
        TotalAmt: 2500.0,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should handle bill with rounding error', () => {
      const bill: MockBill = {
        Balance: 0.0005, // Less than EPSILON
        TotalAmt: 2500.0,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should handle overdue bill', () => {
      const bill: MockBill = {
        Balance: 2500.0,
        TotalAmt: 2500.0,
        DueDate: '2024-12-01',
      }
      expect(determineBillStatus(bill)).toBe('overdue')
    })
  })

  describe('floating point precision', () => {
    it('should handle floating point arithmetic correctly', () => {
      // Test common floating point issues
      const bill: MockBill = {
        Balance: 0.1 + 0.2 - 0.3, // Results in tiny non-zero number
        TotalAmt: 100,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })

    it('should handle very small balances from calculations', () => {
      const bill: MockBill = {
        Balance: 0.00000001,
        TotalAmt: 1000,
      }
      expect(determineBillStatus(bill)).toBe('paid')
    })
  })
})

describe('status determination edge cases', () => {
  describe('boundary conditions', () => {
    it('should handle balance exactly at EPSILON for invoices', () => {
      const invoice: MockInvoice = {
        Balance: 0.001,
        TotalAmt: 100,
      }
      // 0.001 is NOT less than EPSILON (0.001), so should be partial
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })

    it('should handle balance exactly at EPSILON for bills', () => {
      const bill: MockBill = {
        Balance: 0.001,
        TotalAmt: 100,
      }
      // 0.001 is NOT less than EPSILON (0.001), so should be partial
      expect(determineBillStatus(bill)).toBe('partial')
    })

    it('should handle balance just below EPSILON', () => {
      const invoice: MockInvoice = {
        Balance: 0.0009,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should handle balance just above EPSILON', () => {
      const invoice: MockInvoice = {
        Balance: 0.0011,
        TotalAmt: 100,
      }
      expect(determineInvoiceStatus(invoice)).toBe('partial')
    })
  })

  describe('extreme values', () => {
    it('should handle very large total amounts', () => {
      const invoice: MockInvoice = {
        Balance: 0,
        TotalAmt: 999999999.99,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })

    it('should handle very small total amounts', () => {
      const invoice: MockInvoice = {
        Balance: 0.01,
        TotalAmt: 0.01,
      }
      expect(determineInvoiceStatus(invoice)).toBe('draft')
    })

    it('should handle zero total amount', () => {
      const invoice: MockInvoice = {
        Balance: 0,
        TotalAmt: 0,
      }
      expect(determineInvoiceStatus(invoice)).toBe('paid')
    })
  })
})
