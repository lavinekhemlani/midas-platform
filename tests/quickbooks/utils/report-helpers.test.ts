/**
 * Unit Tests for QuickBooks Report Helper Functions
 *
 * Tests for P1/P2 fixes:
 * - EBITDA estimation with isEstimated flag
 * - reconcilePnLData returns NEW object (immutability)
 * - validatePnLData deprecated alias still works
 * - Edge cases (zero values, negative values)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateKeyMetrics,
  reconcilePnLData,
  validatePnLData,
  extractEBITDAComponents,
} from '@/quickbooks/utils/report-helpers'

describe('calculateKeyMetrics - EBITDA estimation', () => {
  describe('isEstimated flag for cash flow', () => {
    it('should set isEstimated to false when cash flow data is available', () => {
      const pnl = {
        total_income: 100000,
        total_expenses: 60000,
        net_income: 40000,
        gross_profit: 70000,
        cost_of_goods_sold: 30000,
      }
      const balanceSheet = {
        total_assets: 200000,
        total_liabilities: 80000,
        total_equity: 120000,
        cash_and_equivalents: 50000,
      }
      const cashFlow = {
        net_cash_from_operating_activities: 35000,
        net_cash_from_investing_activities: -5000,
        net_cash_from_financing_activities: 2000,
        cash_at_end: 52000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, cashFlow, {}, {})

      expect(metrics.cashFlow.isEstimated).toBe(false)
      expect(metrics.cashFlow.operating).toBe(35000)
    })

    it('should set isEstimated to true when cash flow data is null', () => {
      const pnl = {
        total_income: 100000,
        total_expenses: 60000,
        net_income: 40000,
      }
      const balanceSheet = {
        total_assets: 200000,
        total_liabilities: 80000,
        cash_and_equivalents: 50000,
      }
      const cashFlow = {
        net_cash_from_operating_activities: null,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, cashFlow, {}, {})

      expect(metrics.cashFlow.isEstimated).toBe(true)
      expect(metrics.cashFlow.operating).toBe(null)
    })

    it('should set isEstimated to true when cash flow data is undefined', () => {
      const pnl = {
        total_income: 100000,
        total_expenses: 60000,
        net_income: 40000,
      }
      const balanceSheet = {
        total_assets: 200000,
        total_liabilities: 80000,
      }
      const cashFlow = {} // No operating cash flow data

      const metrics = calculateKeyMetrics(pnl, balanceSheet, cashFlow, {}, {})

      expect(metrics.cashFlow.isEstimated).toBe(true)
      expect(metrics.cashFlow.operating).toBe(null)
    })

    it('should set isEstimated to true when cash flow object is null', () => {
      const pnl = {
        total_income: 100000,
        total_expenses: 60000,
        net_income: 40000,
      }
      const balanceSheet = {
        total_assets: 200000,
        total_liabilities: 80000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, null, {}, {})

      expect(metrics.cashFlow.isEstimated).toBe(true)
      expect(metrics.cashFlow.operating).toBe(null)
    })
  })

  describe('edge cases with zero values', () => {
    it('should handle zero revenue gracefully', () => {
      const pnl = {
        total_income: 0,
        total_expenses: 5000,
        net_income: -5000,
      }
      const balanceSheet = {
        total_assets: 10000,
        total_liabilities: 5000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, {}, {}, {})

      expect(metrics.revenue.current).toBe(0)
      expect(metrics.revenue.grossMargin).toBe(0)
      expect(metrics.revenue.netMargin).toBe(0)
      expect(metrics.profitability.netIncome).toBe(-5000)
    })

    it('should handle zero expenses', () => {
      const pnl = {
        total_income: 10000,
        total_expenses: 0,
        net_income: 10000,
      }
      const balanceSheet = {
        total_assets: 20000,
        total_liabilities: 5000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, {}, {}, {})

      expect(metrics.expenses.current).toBe(0)
      expect(metrics.expenses.ratio).toBe(0)
      expect(metrics.profitability.netIncome).toBe(10000)
    })

    it('should handle zero cash balance', () => {
      const pnl = {
        total_income: 10000,
        total_expenses: 5000,
        net_income: 5000,
      }
      const balanceSheet = {
        total_assets: 10000,
        total_liabilities: 5000,
        cash_and_equivalents: 0,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, {}, {}, {})

      expect(metrics.liquidity.cashBalance).toBe(0)
      expect(metrics.liquidity.runwayMonths).toBeLessThanOrEqual(999)
    })
  })

  describe('edge cases with negative values', () => {
    it('should handle negative revenue (contra-revenue)', () => {
      const pnl = {
        total_income: -5000,
        total_expenses: 10000,
        net_income: -15000,
      }
      const balanceSheet = {
        total_assets: 50000,
        total_liabilities: 20000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, {}, {}, {})

      expect(metrics.revenue.current).toBe(-5000)
      expect(metrics.profitability.netIncome).toBe(-15000)
    })

    it('should handle negative cash flow', () => {
      const pnl = {
        total_income: 10000,
        total_expenses: 15000,
        net_income: -5000,
      }
      const balanceSheet = {
        total_assets: 50000,
        total_liabilities: 20000,
        cash_and_equivalents: 10000,
      }
      const cashFlow = {
        net_cash_from_operating_activities: -8000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, cashFlow, {}, {})

      expect(metrics.cashFlow.operating).toBe(-8000)
      expect(metrics.cashFlow.isEstimated).toBe(false)
    })

    it('should handle negative equity', () => {
      const pnl = {
        total_income: 10000,
        total_expenses: 5000,
        net_income: 5000,
      }
      const balanceSheet = {
        total_assets: 50000,
        total_liabilities: 60000,
        total_equity: -10000,
      }

      const metrics = calculateKeyMetrics(pnl, balanceSheet, {}, {}, {})

      expect(metrics.balanceSheet.totalEquity).toBe(-10000)
      expect(metrics.balanceSheet.totalAssets).toBe(50000)
      expect(metrics.balanceSheet.totalLiabilities).toBe(60000)
    })
  })
})

describe('reconcilePnLData - immutability and double-counting fixes', () => {
  describe('returns NEW object without mutation', () => {
    it('should return a new object, not mutate the original', () => {
      const originalData = {
        total_income: 100000,
        total_expenses: 50000,
        other_expenses: 10000,
        cogs_total: 30000,
        gross_profit: 70000,
        net_income: 10000, // 100k - 30k - 50k - 10k = 10k
      }

      const reconciledData = reconcilePnLData(originalData)

      // Should be a different object
      expect(reconciledData).not.toBe(originalData)

      // Original should be unchanged
      expect(originalData.total_expenses).toBe(50000)
      expect(originalData.other_expenses).toBe(10000)
    })

    it('should create a shallow copy with spread operator', () => {
      const originalData = {
        total_income: 100000,
        total_expenses: 50000,
        other_expenses: 0,
        cogs_total: 30000,
        net_income: 20000,
      }

      const reconciledData = reconcilePnLData(originalData)

      // Different reference
      expect(reconciledData).not.toBe(originalData)

      // Same values if no adjustments needed
      expect(reconciledData.total_income).toBe(originalData.total_income)
    })
  })

  describe('detects and corrects double-counting', () => {
    it('should adjust total_expenses when other_expenses is included', () => {
      const data = {
        total_income: 100000,
        total_expenses: 60000, // Includes other_expenses
        other_expenses: 10000,
        cogs_total: 30000,
        gross_profit: 70000,
        net_income: 10000, // 100k - 30k - 50k - 10k = 10k
      }

      const reconciledData = reconcilePnLData(data)

      // Should have adjusted total_expenses to remove other_expenses
      expect(reconciledData.total_expenses).toBe(50000) // 60k - 10k
      expect(reconciledData.other_expenses).toBe(0) // Set to 0 to avoid double-count
    })

    it('should not adjust if other_expenses is not included in total_expenses', () => {
      const data = {
        total_income: 100000,
        total_expenses: 50000, // Does NOT include other_expenses
        other_expenses: 10000,
        cogs_total: 30000,
        gross_profit: 70000,
        net_income: 10000, // 100k - 30k - 50k - 10k = 10k
      }

      const reconciledData = reconcilePnLData(data)

      // Should not adjust since calculation matches
      expect(reconciledData.total_expenses).toBe(50000)
      expect(reconciledData.other_expenses).toBe(10000)
    })

    it('should not adjust if it would result in negative operating expenses', () => {
      const data = {
        total_income: 100000,
        total_expenses: 5000, // Smaller than other_expenses
        other_expenses: 10000,
        cogs_total: 30000,
        gross_profit: 70000,
        net_income: 55000,
      }

      const reconciledData = reconcilePnLData(data)

      // Should keep original values to avoid negative
      expect(reconciledData.total_expenses).toBe(5000)
      expect(reconciledData.other_expenses).toBe(10000)
    })
  })

  describe('handles edge cases', () => {
    it('should handle zero values', () => {
      const data = {
        total_income: 0,
        total_expenses: 0,
        other_expenses: 0,
        cogs_total: 0,
        gross_profit: 0,
        net_income: 0,
      }

      const reconciledData = reconcilePnLData(data)

      expect(reconciledData.total_income).toBe(0)
      expect(reconciledData.total_expenses).toBe(0)
      expect(reconciledData.other_expenses).toBe(0)
    })

    it('should handle missing other_expenses field', () => {
      const data = {
        total_income: 100000,
        total_expenses: 50000,
        cogs_total: 30000,
        gross_profit: 70000,
        net_income: 20000,
      }

      const reconciledData = reconcilePnLData(data)

      expect(reconciledData.total_expenses).toBe(50000)
      // reconcilePnLData doesn't add other_expenses if it's not present
      expect(reconciledData.other_expenses).toBeUndefined()
    })

    it('should handle small rounding differences', () => {
      const data = {
        total_income: 100000.99,
        total_expenses: 50000.5,
        other_expenses: 10000.25,
        cogs_total: 30000.1,
        gross_profit: 70000.89,
        net_income: 10000.14, // Small rounding diff
      }

      const reconciledData = reconcilePnLData(data)

      // Should handle small discrepancies (< 1) without warnings
      expect(reconciledData).toBeDefined()
    })
  })
})

describe('validatePnLData - deprecated alias', () => {
  it('should be an alias for reconcilePnLData', () => {
    expect(validatePnLData).toBe(reconcilePnLData)
  })

  it('should work exactly like reconcilePnLData', () => {
    const data = {
      total_income: 100000,
      total_expenses: 60000,
      other_expenses: 10000,
      cogs_total: 30000,
      gross_profit: 70000,
      net_income: 10000,
    }

    const reconciledData = reconcilePnLData(data)
    const validatedData = validatePnLData(data)

    expect(validatedData).toEqual(reconciledData)
  })

  it('should return a new object like reconcilePnLData', () => {
    const originalData = {
      total_income: 100000,
      total_expenses: 50000,
      other_expenses: 10000,
      cogs_total: 30000,
      net_income: 10000,
    }

    const validatedData = validatePnLData(originalData)

    // Should not mutate original
    expect(validatedData).not.toBe(originalData)
  })
})

describe('extractEBITDAComponents', () => {
  it('should extract interest expense from P&L report', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Interest Expense' }, { value: '5000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    expect(components.interestExpense).toBe(5000)
  })

  it('should extract tax expense from P&L report', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Income Tax' }, { value: '15000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    expect(components.taxExpense).toBe(15000)
  })

  it('should extract depreciation and amortization', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Depreciation' }, { value: '8000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    expect(components.depreciationAmortization).toBe(8000)
  })

  it('should handle missing components', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Some Other Expense' }, { value: '1000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    expect(components.interestExpense).toBe(0)
    expect(components.taxExpense).toBe(0)
    expect(components.depreciationAmortization).toBe(0)
  })

  it('should handle negative values (negative sign format)', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Interest Expense' }, { value: '-5000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    // Should convert to absolute value (expenses are shown as negative in QB)
    expect(components.interestExpense).toBe(5000)
  })

  it('should sum multiple matching rows', () => {
    const plReport = {
      Rows: {
        Row: [
          {
            ColData: [{ value: 'Interest Expense' }, { value: '3000.00' }],
          },
          {
            ColData: [{ value: 'Interest Paid' }, { value: '2000.00' }],
          },
        ],
      },
    }

    const components = extractEBITDAComponents(plReport)

    expect(components.interestExpense).toBe(5000) // 3000 + 2000
  })
})
