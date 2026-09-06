# Test Suite Setup Guide

## Quick Start

Install Vitest and run tests:

```bash
# Install test dependencies
npm install -D vitest @vitest/ui @vitest/coverage-v8

# Update package.json scripts (already provided below)

# Run tests
npm test
```

## Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run"
  }
}
```

## Configuration

A `vitest.config.ts` file has been created in the project root with:

- Path aliases (`@/` → `./src/`)
- Node environment
- Coverage settings (v8 provider)
- Proper exclusions

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Run tests once (CI mode)
npm run test:run

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test transformers.test

# Run tests matching pattern
npm test -- burn
```

## Test Files Created

1. **`tests/quickbooks/reports/transformers.test.ts`**
   - 40+ test cases for `parseAmount` function
   - Tests parenthetical negatives, currency formats, edge cases
   - 207 lines

2. **`tests/quickbooks/reports/enricher-profit-loss.test.ts`**
   - 20+ test cases for burn rate calculations
   - Tests runway analysis, KPI computations
   - 409 lines

## What's Tested

### P0 Bug Fixes

#### 1. Burn Rate Calculation

**Problem:** Returned total expenses instead of monthly average

**Solution:** `burnRate = totalExpenses / monthsInPeriod`

**Test Coverage:**

```typescript
// ✅ 3 months: $90,000 total → $30,000/month
// ✅ 6 months: $150,000 total → $25,000/month
// ✅ 1 month: $23,000 total → $23,000/month
// ✅ Gross burn rate is monthly, not total
```

#### 2. Amount Parsing

**Problem:** Parenthetical negatives not handled: `(100)` → `0`

**Solution:** Detect `(amount)` format and convert to `-amount`

**Test Coverage:**

```typescript
// ✅ "(100)" → -100
// ✅ "($1,234.56)" → -1234.56
// ✅ "(999,999.99)" → -999999.99
```

## Viewing Results

### Terminal Output

```bash
npm test
```

### Coverage Report

```bash
npm run test:coverage
open coverage/index.html
```

### Interactive UI

```bash
npm run test:ui
# Opens browser at http://localhost:51204
```

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Troubleshooting

### Module Resolution Errors

If you see `Cannot find module '@/...'`:

- Verify `vitest.config.ts` has the `@` alias configured
- Check that `tsconfig.json` includes the same alias

### Mock Errors

If mocks aren't working:

- Ensure you're using `vi.mock()` before importing the module
- Check that mock paths match actual module paths

### Type Errors

If TypeScript complains about test types:

```bash
npm install -D @types/node
```

## Next Steps

1. **Export Functions**: Update source files to export testable functions
2. **Integration Tests**: Add end-to-end tests for full workflows
3. **Snapshot Tests**: Add snapshot tests for complex data structures
4. **Performance Tests**: Benchmark critical calculations

## Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Test Structure Guide](./quickbooks/reports/README.md)
- Coverage Goals: >90% statements, >85% branches
