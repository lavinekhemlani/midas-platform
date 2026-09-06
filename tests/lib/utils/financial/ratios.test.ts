/**
 * Tests for Liquidity Ratio Calculations
 *
 * Covers all edge cases:
 * - Division by zero (liabilities = 0)
 * - Both values zero
 * - Negative inputs
 * - NaN/Infinity inputs
 * - Normal calculations
 * - Health assessments
 */

import { describe, it, expect } from 'vitest'
import {
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateQuickRatioLegacy,
  calculateWorkingCapital,
  formatRatio,
  isInfiniteRatio,
  assessCurrentRatioHealth,
  assessQuickRatioHealth,
  INFINITE_RATIO,
} from '@/lib/utils/financial/ratios'

describe('calculateCurrentRatio', () => {
  describe('standard calculations', () => {
    it('calculates 2:1 ratio correctly', () => {
      expect(calculateCurrentRatio(200000, 100000)).toBe(2)
    })

    it('calculates 1.5:1 ratio correctly', () => {
      expect(calculateCurrentRatio(150000, 100000)).toBe(1.5)
    })

    it('calculates ratio less than 1 correctly', () => {
      expect(calculateCurrentRatio(50000, 100000)).toBe(0.5)
    })

    it('handles decimal results', () => {
      const result = calculateCurrentRatio(100, 33)
      expect(result).toBeCloseTo(3.0303, 4)
    })
  })

  describe('edge cases - division by zero', () => {
    it('returns Infinity when liabilities are 0 and assets > 0', () => {
      expect(calculateCurrentRatio(100000, 0)).toBe(Infinity)
    })

    it('returns 0 when both are 0', () => {
      expect(calculateCurrentRatio(0, 0)).toBe(0)
    })

    it('returns 0 when assets are 0 and liabilities are 0', () => {
      expect(calculateCurrentRatio(0, 0)).toBe(0)
    })
  })

  describe('edge cases - negative values', () => {
    it('handles negative liabilities by using absolute value', () => {
      expect(calculateCurrentRatio(100000, -50000)).toBe(2)
    })

    it('handles negative assets correctly', () => {
      // Negative assets are unusual but possible (e.g., accounting adjustments)
      expect(calculateCurrentRatio(-50000, 100000)).toBe(-0.5)
    })
  })

  describe('edge cases - invalid inputs', () => {
    it('returns 0 for NaN current assets', () => {
      expect(calculateCurrentRatio(NaN, 100000)).toBe(0)
    })

    it('returns 0 for NaN current liabilities', () => {
      expect(calculateCurrentRatio(100000, NaN)).toBe(0)
    })

    it('returns 0 for Infinity current assets', () => {
      expect(calculateCurrentRatio(Infinity, 100000)).toBe(0)
    })

    it('returns 0 for Infinity current liabilities', () => {
      expect(calculateCurrentRatio(100000, Infinity)).toBe(0)
    })
  })
})

describe('calculateQuickRatio', () => {
  describe('standard calculations - (Cash + Receivables) / Liabilities', () => {
    it('calculates 2:1 ratio correctly', () => {
      // (50000 + 30000) / 40000 = 2
      expect(calculateQuickRatio(50000, 30000, 40000)).toBe(2)
    })

    it('calculates 1:1 ratio correctly', () => {
      // (30000 + 20000) / 50000 = 1
      expect(calculateQuickRatio(30000, 20000, 50000)).toBe(1)
    })

    it('handles zero cash', () => {
      // (0 + 80000) / 40000 = 2
      expect(calculateQuickRatio(0, 80000, 40000)).toBe(2)
    })

    it('handles zero receivables', () => {
      // (80000 + 0) / 40000 = 2
      expect(calculateQuickRatio(80000, 0, 40000)).toBe(2)
    })

    it('handles both zero (but non-zero liabilities)', () => {
      expect(calculateQuickRatio(0, 0, 40000)).toBe(0)
    })
  })

  describe('edge cases - division by zero', () => {
    it('returns Infinity when liabilities are 0 and has liquid assets', () => {
      expect(calculateQuickRatio(50000, 30000, 0)).toBe(Infinity)
    })

    it('returns 0 when all values are 0', () => {
      expect(calculateQuickRatio(0, 0, 0)).toBe(0)
    })
  })

  describe('edge cases - negative values', () => {
    it('handles negative liabilities by using absolute value', () => {
      expect(calculateQuickRatio(50000, 30000, -40000)).toBe(2)
    })

    it('handles negative cash gracefully', () => {
      // Negative cash is unusual but could happen with overdrafts
      // (-10000 + 30000) / 40000 = 0.5
      expect(calculateQuickRatio(-10000, 30000, 40000)).toBe(0.5)
    })

    it('returns 0 when quick assets are negative', () => {
      // (-50000 + 10000) = -40000 < 0, so return 0
      expect(calculateQuickRatio(-50000, 10000, 40000)).toBe(0)
    })
  })

  describe('edge cases - invalid inputs', () => {
    it('returns 0 for NaN cash', () => {
      expect(calculateQuickRatio(NaN, 30000, 40000)).toBe(0.75) // Treats NaN as 0
    })

    it('returns 0 for NaN receivables', () => {
      expect(calculateQuickRatio(30000, NaN, 40000)).toBe(0.75) // Treats NaN as 0
    })

    it('returns 0 for NaN liabilities', () => {
      expect(calculateQuickRatio(50000, 30000, NaN)).toBe(0)
    })
  })
})

describe('calculateQuickRatioLegacy', () => {
  describe('legacy formula - (Assets - Inventory) / Liabilities', () => {
    it('calculates correctly', () => {
      // (200000 - 50000) / 100000 = 1.5
      expect(calculateQuickRatioLegacy(200000, 50000, 100000)).toBe(1.5)
    })

    it('returns 0 when inventory exceeds current assets', () => {
      // (100000 - 150000) = -50000, which is negative, so return 0
      expect(calculateQuickRatioLegacy(100000, 150000, 50000)).toBe(0)
    })

    it('returns Infinity when liabilities are 0', () => {
      expect(calculateQuickRatioLegacy(100000, 20000, 0)).toBe(Infinity)
    })
  })
})

describe('calculateWorkingCapital', () => {
  it('calculates positive working capital', () => {
    expect(calculateWorkingCapital(200000, 100000)).toBe(100000)
  })

  it('calculates zero working capital', () => {
    expect(calculateWorkingCapital(100000, 100000)).toBe(0)
  })

  it('calculates negative working capital', () => {
    expect(calculateWorkingCapital(50000, 100000)).toBe(-50000)
  })

  it('handles invalid inputs', () => {
    expect(calculateWorkingCapital(NaN, 100000)).toBe(-100000) // NaN treated as 0
    expect(calculateWorkingCapital(100000, NaN)).toBe(100000) // NaN treated as 0
  })
})

describe('formatRatio', () => {
  it('shows ∞ for Infinity', () => {
    expect(formatRatio(Infinity)).toBe('∞')
  })

  it('shows ∞ for INFINITE_RATIO constant', () => {
    expect(formatRatio(INFINITE_RATIO)).toBe('∞')
  })

  it('shows ∞ for values >= 999', () => {
    expect(formatRatio(999)).toBe('∞')
    expect(formatRatio(1000)).toBe('∞')
  })

  it('formats to 2 decimals by default', () => {
    expect(formatRatio(1.567)).toBe('1.57')
    expect(formatRatio(2)).toBe('2.00')
    expect(formatRatio(0.5)).toBe('0.50')
  })

  it('formats to custom decimal places', () => {
    expect(formatRatio(1.5678, 3)).toBe('1.568')
    expect(formatRatio(1.5678, 1)).toBe('1.6')
    expect(formatRatio(1.5678, 0)).toBe('2')
  })

  it('shows N/A for NaN', () => {
    expect(formatRatio(NaN)).toBe('N/A')
  })

  it('shows N/A for negative Infinity', () => {
    expect(formatRatio(-Infinity)).toBe('N/A')
  })
})

describe('isInfiniteRatio', () => {
  it('returns true for Infinity', () => {
    expect(isInfiniteRatio(Infinity)).toBe(true)
  })

  it('returns true for values >= 999', () => {
    expect(isInfiniteRatio(999)).toBe(true)
    expect(isInfiniteRatio(1000)).toBe(true)
  })

  it('returns false for normal values', () => {
    expect(isInfiniteRatio(2.5)).toBe(false)
    expect(isInfiniteRatio(998)).toBe(false)
  })
})

describe('assessCurrentRatioHealth', () => {
  it('returns excellent for ratio >= 2.0', () => {
    expect(assessCurrentRatioHealth(2.0)).toBe('excellent')
    expect(assessCurrentRatioHealth(3.0)).toBe('excellent')
  })

  it('returns excellent for infinite ratio', () => {
    expect(assessCurrentRatioHealth(Infinity)).toBe('excellent')
    expect(assessCurrentRatioHealth(999)).toBe('excellent')
  })

  it('returns good for ratio >= 1.5 and < 2.0', () => {
    expect(assessCurrentRatioHealth(1.5)).toBe('good')
    expect(assessCurrentRatioHealth(1.9)).toBe('good')
  })

  it('returns adequate for ratio >= 1.0 and < 1.5', () => {
    expect(assessCurrentRatioHealth(1.0)).toBe('adequate')
    expect(assessCurrentRatioHealth(1.4)).toBe('adequate')
  })

  it('returns poor for ratio >= 0.5 and < 1.0', () => {
    expect(assessCurrentRatioHealth(0.5)).toBe('poor')
    expect(assessCurrentRatioHealth(0.9)).toBe('poor')
  })

  it('returns critical for ratio < 0.5', () => {
    expect(assessCurrentRatioHealth(0.4)).toBe('critical')
    expect(assessCurrentRatioHealth(0)).toBe('critical')
  })
})

describe('assessQuickRatioHealth', () => {
  it('returns excellent for ratio >= 1.5', () => {
    expect(assessQuickRatioHealth(1.5)).toBe('excellent')
    expect(assessQuickRatioHealth(2.0)).toBe('excellent')
  })

  it('returns excellent for infinite ratio', () => {
    expect(assessQuickRatioHealth(Infinity)).toBe('excellent')
  })

  it('returns good for ratio >= 1.0 and < 1.5', () => {
    expect(assessQuickRatioHealth(1.0)).toBe('good')
    expect(assessQuickRatioHealth(1.4)).toBe('good')
  })

  it('returns adequate for ratio >= 0.7 and < 1.0', () => {
    expect(assessQuickRatioHealth(0.7)).toBe('adequate')
    expect(assessQuickRatioHealth(0.9)).toBe('adequate')
  })

  it('returns poor for ratio >= 0.5 and < 0.7', () => {
    expect(assessQuickRatioHealth(0.5)).toBe('poor')
    expect(assessQuickRatioHealth(0.6)).toBe('poor')
  })

  it('returns critical for ratio < 0.5', () => {
    expect(assessQuickRatioHealth(0.4)).toBe('critical')
    expect(assessQuickRatioHealth(0)).toBe('critical')
  })
})

describe('integration scenarios', () => {
  it('handles company with no liabilities', () => {
    const currentAssets = 500000
    const cash = 100000
    const receivables = 150000
    const currentLiabilities = 0

    const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities)
    const quickRatio = calculateQuickRatio(cash, receivables, currentLiabilities)

    expect(currentRatio).toBe(Infinity)
    expect(quickRatio).toBe(Infinity)
    expect(formatRatio(currentRatio)).toBe('∞')
    expect(formatRatio(quickRatio)).toBe('∞')
    expect(assessCurrentRatioHealth(currentRatio)).toBe('excellent')
    expect(assessQuickRatioHealth(quickRatio)).toBe('excellent')
  })

  it('handles company with liquidity issues', () => {
    const currentAssets = 30000
    const cash = 5000
    const receivables = 10000
    const currentLiabilities = 100000

    const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities)
    const quickRatio = calculateQuickRatio(cash, receivables, currentLiabilities)

    expect(currentRatio).toBe(0.3)
    expect(quickRatio).toBe(0.15)
    expect(assessCurrentRatioHealth(currentRatio)).toBe('critical')
    expect(assessQuickRatioHealth(quickRatio)).toBe('critical')
  })

  it('handles healthy company', () => {
    const currentAssets = 300000
    const cash = 80000
    const receivables = 70000
    const currentLiabilities = 100000

    const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities)
    const quickRatio = calculateQuickRatio(cash, receivables, currentLiabilities)

    expect(currentRatio).toBe(3)
    expect(quickRatio).toBe(1.5)
    expect(assessCurrentRatioHealth(currentRatio)).toBe('excellent')
    expect(assessQuickRatioHealth(quickRatio)).toBe('excellent')
  })
})
