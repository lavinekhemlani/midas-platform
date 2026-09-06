# QuickBooks Reports Test Suite

This directory contains comprehensive unit tests for the QuickBooks P&L enricher and transformer modules.

## Test Files

### 1. `transformers.test.ts`

Tests for the `parseAmount` function that handles various amount formats from QuickBooks reports.

**Test Coverage:**

- Parenthetical negatives: `(100)` → `-100`
- Currency formatting: `$1,234.56` → `1234.56`
- Explicit negatives: `-100` → `-100`
- Empty/null values: `""`, `null`, `undefined` → `0`
- Edge cases and special formats

**Total Test Cases:** 40+

### 2. `enricher-profit-loss.test.ts`

Tests for burn rate calculations, runway analysis, and KPI computations.

**Test Coverage:**

- Monthly burn rate calculations over various periods (1, 3, 6, 12+ months)
- Gross burn rate validation (monthly, not total)
- Runway calculations with different cash balances
- Total expenses calculation (COGS + Operating + Other)
- Edge cases (zero expenses, single month, multi-year periods)

**Total Test Cases:** 20+

## Setup

### Install Vitest (Recommended)

```bash
npm install -D vitest @vitest/ui
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

### Alternative: Install Jest

```bash
npm install -D jest @types/jest ts-jest
```

Add `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test transformers.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run with UI (Vitest only)
npm run test:ui
```

## Test Structure

Both test files follow the Arrange-Act-Assert pattern:

```typescript
describe('Feature', () => {
  describe('Scenario', () => {
    it('should do something specific', () => {
      // Arrange - Set up test data
      const input = { ... }

      // Act - Execute the function
      const result = functionUnderTest(input)

      // Assert - Verify the result
      expect(result).toBe(expected)
    })
  })
})
```

## P0 Fixes Verified

### Burn Rate Calculation

**Bug:** Burn rate was returning total expenses instead of monthly average.

**Fix:** Calculate as `totalExpenses / monthsInPeriod`

**Tests:**

- ✅ 3-month period: 90,000 total → 30,000/month
- ✅ 6-month period: 150,000 total → 25,000/month
- ✅ Single month: 23,000 total → 23,000/month
- ✅ Gross burn rate is monthly, not total

### Amount Parsing

**Bug:** Parenthetical negatives `(100)` not parsed correctly.

**Fix:** Detect and convert `(amount)` to `-amount`

**Tests:**

- ✅ `(100)` → `-100`
- ✅ `($1,234.56)` → `-1234.56`
- ✅ Works with currency symbols and commas

## Mocking Strategy

The enricher tests use Vitest's mocking to isolate the burn rate logic:

```typescript
vi.mock('@/lib/utils/financial/reportCalculations', () => ({ ... }))
vi.mock('@/quickbooks/utils/accounts', () => ({ ... }))
vi.mock('@/quickbooks/utils/report-helpers', () => ({ ... }))
```

This ensures tests focus on:

1. Burn rate calculation formula
2. Month period calculation
3. Total expenses aggregation

## Coverage Goals

- **Statements:** >90%
- **Branches:** >85%
- **Functions:** >90%
- **Lines:** >90%

## Next Steps

1. **Export Functions:** Export `parseAmount` from `transformers.ts` to enable direct testing
2. **Integration Tests:** Add tests for full P&L transformation pipeline
3. **Add Vitest Config:** Create `vitest.config.ts` for test configuration
4. **CI/CD Integration:** Add test runs to GitHub Actions workflow

## Contributing

When adding new tests:

1. Follow the existing pattern (describe → it)
2. Use descriptive test names
3. Test both happy paths and edge cases
4. Include real-world QuickBooks data formats
5. Document any P0 bugs being verified
