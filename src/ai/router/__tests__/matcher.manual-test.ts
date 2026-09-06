// src/ai/router/__tests__/matcher.test.ts
// Unit tests for the query router
// Run with: npx tsx src/ai/router/__tests__/matcher.test.ts

import { routeQuery } from '../matcher'

// =============================================================================
// Test Utilities
// =============================================================================

let passCount = 0
let failCount = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
    passCount++
  } catch (error) {
    console.log(`✗ ${name}`)
    console.log(`  Error: ${error instanceof Error ? error.message : error}`)
    failCount++
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`)
      }
    },
    toContain(expected: unknown) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${expected}, got ${JSON.stringify(actual)}`)
      }
    },
    toHaveLength(expected: number) {
      if (!Array.isArray(actual) || actual.length !== expected) {
        throw new Error(
          `Expected array of length ${expected}, got ${Array.isArray(actual) ? actual.length : 'non-array'}`
        )
      }
    },
    not: {
      toBe(expected: T) {
        if (actual === expected) {
          throw new Error(`Expected not ${expected}, but got it`)
        }
      },
    },
  }
}

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`)
  console.log('='.repeat(name.length))
  fn()
}

// =============================================================================
// Tests
// =============================================================================

describe('Tier 1: Exact Pattern Matching', () => {
  test('routes "what\'s my revenue" to profit_loss with high confidence', () => {
    const result = routeQuery("what's my revenue")
    expect(result.intent).toBe('point_query')
    expect(result.reports).toContain('profit_loss')
    expect(result.confidence).toBe('high')
    expect(result.matchedTier).toBe('exact')
  })

  test('routes "What is my revenue?" with capitalization', () => {
    const result = routeQuery('What is my revenue?')
    expect(result.intent).toBe('point_query')
    expect(result.reports).toContain('profit_loss')
    expect(result.confidence).toBe('high')
  })

  test('routes "what is my runway" to forecast with cash_flow and balance_sheet', () => {
    const result = routeQuery('what is my runway')
    expect(result.intent).toBe('forecast')
    expect(result.reports).toContain('cash_flow')
    expect(result.reports).toContain('balance_sheet')
    expect(result.confidence).toBe('high')
  })

  test('routes "how long will cash last" to forecast', () => {
    const result = routeQuery('how long will cash last')
    expect(result.intent).toBe('forecast')
    expect(result.confidence).toBe('high')
  })

  test('routes "how are we doing" to health_check', () => {
    const result = routeQuery('how are we doing')
    expect(result.intent).toBe('health_check')
    expect(result.reports).toContain('financial_health')
    expect(result.confidence).toBe('high')
  })

  test('routes "show me the P&L" to profit_loss', () => {
    const result = routeQuery('show me the P&L')
    expect(result.intent).toBe('point_query')
    expect(result.reports).toContain('profit_loss')
    expect(result.confidence).toBe('high')
  })

  test('routes "revenue trend" to trend with revenue_trend report', () => {
    const result = routeQuery('revenue trend')
    expect(result.intent).toBe('trend')
    expect(result.reports).toContain('revenue_trend')
    expect(result.confidence).toBe('high')
  })

  test('routes "who owes us" to aged_receivables', () => {
    const result = routeQuery('who owes us')
    expect(result.intent).toBe('point_query')
    expect(result.reports).toContain('aged_receivables')
    expect(result.confidence).toBe('high')
  })

  test('routes "compare this month to last month" to comparison', () => {
    const result = routeQuery('compare this month to last month')
    expect(result.intent).toBe('comparison')
    expect(result.confidence).toBe('high')
  })
})

describe('Tier 2: Keyword Matching', () => {
  test('routes "can you show me the profit and loss statement" via keywords', () => {
    const result = routeQuery('can you show me the profit and loss statement')
    expect(result.reports).toContain('profit_loss')
    expect(result.confidence).not.toBe('low')
  })

  test('routes "I want to see how things have changed over time" as trend', () => {
    const result = routeQuery('I want to see how things have changed over time')
    expect(result.intent).toBe('trend')
  })

  test('routes "tell me about our expenses" to profit_loss', () => {
    const result = routeQuery('tell me about our expenses')
    expect(result.reports).toContain('profit_loss')
  })

  test('routes "what about our cash position" to cash_flow', () => {
    const result = routeQuery('what about our cash position')
    expect(result.reports).toContain('cash_flow')
  })
})

describe('Tier 3: Fallback', () => {
  test('returns low confidence for ambiguous queries', () => {
    const result = routeQuery('help me understand something')
    expect(result.confidence).toBe('low')
    expect(result.matchedTier).toBe('fallback')
    expect(result.reports).toHaveLength(0)
  })

  test('returns low confidence for greeting', () => {
    const result = routeQuery('hello')
    expect(result.confidence).toBe('low')
  })

  test('returns general intent for unclear questions', () => {
    const result = routeQuery('what do you think about that')
    expect(result.intent).toBe('general')
  })
})

describe('Period Detection', () => {
  test('detects "this month"', () => {
    const result = routeQuery("what's my revenue this month")
    expect(result.periods).toContain('this_month')
  })

  test('detects "last quarter"', () => {
    const result = routeQuery('compare to last quarter')
    expect(result.periods).toContain('last_quarter')
  })

  test('detects "this year"', () => {
    const result = routeQuery('revenue this year')
    expect(result.periods).toContain('this_year')
  })

  test('defaults to this_month when no period specified', () => {
    const result = routeQuery("what's my revenue")
    expect(result.periods).toContain('this_month')
  })

  test('detects multiple periods', () => {
    const result = routeQuery('compare this month to last month')
    expect(result.periods).toContain('this_month')
    expect(result.periods).toContain('last_month')
  })
})

describe('Memory Alignment', () => {
  test('includes expense/income memories for forecast queries', () => {
    const result = routeQuery("what's my runway")
    expect(result.memoryTypes).toContain('expense')
    expect(result.memoryTypes).toContain('income')
    expect(result.memoryTypes).toContain('goal')
  })

  test('includes goal memories for comparison queries', () => {
    const result = routeQuery('compare this month to last month')
    expect(result.memoryTypes).toContain('goal')
  })

  test('includes context memories for health_check queries', () => {
    const result = routeQuery('how are we doing')
    expect(result.memoryTypes).toContain('goal')
    expect(result.memoryTypes).toContain('deadline')
  })

  test('point queries have empty memory types', () => {
    const result = routeQuery("what's my revenue")
    expect(result.memoryTypes).toHaveLength(0)
  })
})

describe('Natural Language Variations', () => {
  test('handles "how much money did we make"', () => {
    const result = routeQuery('how much money did we make')
    expect(result.reports).toContain('profit_loss')
  })

  test('handles "give me an overview"', () => {
    const result = routeQuery('give me an overview')
    expect(result.intent).toBe('health_check')
  })

  test('handles "what happened to expenses"', () => {
    const result = routeQuery('what happened to expenses')
    expect(result.intent).toBe('anomaly')
  })

  test('handles "break down revenue by customer"', () => {
    const result = routeQuery('break down revenue by customer')
    expect(result.intent).toBe('drill_down')
  })
})

describe('Edge Cases', () => {
  test('handles empty string gracefully', () => {
    const result = routeQuery('')
    expect(result.confidence).toBe('low')
    expect(result.matchedTier).toBe('fallback')
  })

  test('handles very long query', () => {
    const longQuery =
      'I want to understand our financial position and see how revenue has been trending over the last few months'
    const result = routeQuery(longQuery)
    // Should pick up trend intent from keywords
    expect(result.intent).toBe('trend')
  })

  test('handles special characters', () => {
    const result = routeQuery("what's my P&L?")
    expect(result.reports).toContain('profit_loss')
  })

  test('handles mixed case', () => {
    const result = routeQuery('WHAT IS MY REVENUE')
    expect(result.reports).toContain('profit_loss')
  })
})

// =============================================================================
// Run Tests
// =============================================================================

console.log('\n' + '='.repeat(50))
console.log(`Tests complete: ${passCount} passed, ${failCount} failed`)
console.log('='.repeat(50))

if (failCount > 0) {
  process.exit(1)
}
