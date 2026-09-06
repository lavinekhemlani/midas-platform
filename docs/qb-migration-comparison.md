# QuickBooks Reports: OLD vs NEW - Feature Comparison

## Quick Reference Table

| Feature Category  | OLD Routes        | NEW Routes        | Priority      |
| ----------------- | ----------------- | ----------------- | ------------- |
| **Lines of Code** | 667-963 per route | 90-97 per route   | -             |
| **Architecture**  | Monolithic        | Transformer-based | ✅ NEW Better |

## Profit & Loss Report

| Feature                  | OLD                                 | NEW              | Migration Effort |
| ------------------------ | ----------------------------------- | ---------------- | ---------------- |
| **Core Data**            |
| QuickBooks API call      | ✅ Provider abstraction             | ✅ Direct client | Equal            |
| Report parsing           | ✅ Custom parser                    | ✅ Transformer   | ✅ NEW Better    |
| Date validation          | ✅ Comprehensive                    | ❌ None          | HIGH             |
| **KPI Calculations**     |
| Total revenue/expenses   | ✅                                  | ❌               | MEDIUM           |
| Profit margin            | ✅ `calculateProfitMargin()`        | ❌               | MEDIUM           |
| Expense ratio            | ✅ `calculateExpenseRatio()`        | ❌               | MEDIUM           |
| Gross margin             | ✅ `calculateGrossMargin()`         | ❌               | MEDIUM           |
| Operating margin         | ✅ `calculateOperatingMargin()`     | ❌               | MEDIUM           |
| EBITDA calculation       | ✅ `extractEBITDAComponents()`      | ❌               | HIGH             |
| Burn rate                | ✅                                  | ❌               | HIGH             |
| Gross burn rate          | ✅                                  | ❌               | MEDIUM           |
| Cash balance             | ✅ `getCashAndEquivalents()`        | ❌               | MEDIUM           |
| **Data Enrichment**      |
| Revenue categorization   | ✅ With percentages                 | ❌               | HIGH             |
| Contra-revenue detection | ✅ Regex + sign check               | ❌               | HIGH             |
| Expense breakdown        | ✅ COGS/Operating/Other             | ❌               | HIGH             |
| True total expenses      | ✅ Sum of all 3 sections            | ❌               | HIGH             |
| Percentage calculations  | ✅ All categories                   | ❌               | MEDIUM           |
| **Insights**             |
| AI insights generation   | ✅ `generatePnLInsights()`          | ❌               | HIGH             |
| Positive findings        | ✅                                  | ❌               | HIGH             |
| Concerns detection       | ✅                                  | ❌               | HIGH             |
| Detailed statements      | ✅ `generatePnLDetailedStatement()` | ❌               | MEDIUM           |
| Variance analysis        | ✅                                  | ❌               | MEDIUM           |
| **Error Handling**       |
| Rate limit retry         | ✅ Exponential backoff              | ❌               | HIGH             |
| Auth error handling      | ✅ Detailed codes                   | ✅ Basic         | MEDIUM           |
| Date range validation    | ✅ Max 5 years                      | ❌               | LOW              |
| Error messages           | ✅ User-friendly                    | ✅ Basic         | MEDIUM           |
| Retry-After header       | ✅                                  | ❌               | MEDIUM           |
| **Performance**          |
| Performance tracking     | ✅ `createReportTracker()`          | ❌               | MEDIUM           |
| Metadata caching         | ✅ `getProviderCompanyMetadata()`   | ❌               | HIGH             |
| Query time tracking      | ✅                                  | ❌               | LOW              |
| Data quality metadata    | ✅                                  | ❌               | MEDIUM           |

**Total Features:** OLD: 35 ✅ | NEW: 2 ✅ (94% gap)

---

## Balance Sheet Report

| Feature                  | OLD                                          | NEW                | Migration Effort |
| ------------------------ | -------------------------------------------- | ------------------ | ---------------- |
| **Core Data**            |
| QuickBooks API call      | ✅                                           | ✅                 | Equal            |
| Report parsing           | ✅ Custom                                    | ✅ Transformer     | ✅ NEW Better    |
| International support    | ❌                                           | ✅ GAAP/IFRS/HK PE | ✅ NEW Better    |
| **Ratio Calculations**   |
| Current ratio            | ✅ `calculateCurrentRatio()`                 | ❌                 | HIGH             |
| Quick ratio              | ✅ `calculateQuickRatio()`                   | ❌                 | HIGH             |
| Debt-to-equity           | ✅ `calculateDebtToEquity()`                 | ❌                 | HIGH             |
| ROA (Return on Assets)   | ✅ `calculateROA()` + P&L                    | ❌                 | VERY HIGH        |
| ROE (Return on Equity)   | ✅ `calculateROE()` + P&L                    | ❌                 | VERY HIGH        |
| Working capital          | ✅ `calculateWorkingCapital()`               | ❌                 | HIGH             |
| Asset turnover           | ✅ `calculateAssetTurnover()`                | ❌                 | HIGH             |
| Equity multiplier        | ✅ `calculateEquityMultiplier()`             | ❌                 | MEDIUM           |
| Debt ratio               | ✅ `calculateDebtRatio()`                    | ❌                 | MEDIUM           |
| **Composition Analysis** |
| Asset composition        | ✅ With percentages                          | ❌                 | HIGH             |
| Liability breakdown      | ✅ With classification                       | ❌                 | HIGH             |
| Equity composition       | ✅ With percentages                          | ❌                 | HIGH             |
| Color coding             | ✅ Green/Red/Blue                            | ❌                 | LOW              |
| Negative handling        | ✅ Contra accounts                           | ❌                 | MEDIUM           |
| **Classification**       |
| Current assets calc      | ✅ `calculateCurrentAssetsFromBsData()`      | ❌                 | HIGH             |
| Current liabilities calc | ✅ `calculateCurrentLiabilitiesFromBsData()` | ❌                 | HIGH             |
| Cash extraction          | ✅ `calculateCashFromBsData()`               | ❌                 | MEDIUM           |
| Inventory extraction     | ✅ `calculateInventoryFromBsData()`          | ❌                 | MEDIUM           |
| Multi-currency safe      | ✅ Uses report data                          | ❌                 | HIGH             |
| **Detailed Tables**      |
| Assets table             | ✅ `getDetailedAccountsTable()`              | ❌                 | MEDIUM           |
| Liabilities table        | ✅ With grouping                             | ❌                 | MEDIUM           |
| Equity table             | ✅ With percentages                          | ❌                 | MEDIUM           |
| Account grouping         | ✅ By type/subtype                           | ❌                 | MEDIUM           |
| **Rate Limiting**        |
| Throttled requests       | ✅ 2 concurrent max                          | ❌                 | HIGH             |
| Request deduplication    | ✅ Cache map                                 | ❌                 | MEDIUM           |
| Batch processing         | ✅ With delays                               | ❌                 | HIGH             |
| Component error tracking | ✅ Per-component errors                      | ❌                 | MEDIUM           |
| **Integration**          |
| P&L data fetch           | ✅ For ROA/ROE                               | ❌                 | VERY HIGH        |
| Revenue integration      | ✅ For asset turnover                        | ❌                 | HIGH             |
| Net income integration   | ✅ For ROA/ROE                               | ❌                 | HIGH             |

**Total Features:** OLD: 33 ✅ | NEW: 2 ✅ (94% gap)

---

## Cash Flow Report

| Feature                 | OLD                            | NEW            | Migration Effort |
| ----------------------- | ------------------------------ | -------------- | ---------------- |
| **Core Data**           |
| QuickBooks API call     | ✅                             | ✅             | Equal            |
| Report parsing          | ✅ Custom                      | ✅ Transformer | ✅ NEW Better    |
| Activity extraction     | ✅                             | ✅ Basic       | MEDIUM           |
| **Advanced Metrics**    |
| Burn rate               | ✅ `calculateCashMetrics()`    | ❌             | HIGH             |
| Runway months           | ✅                             | ❌             | HIGH             |
| Days cash               | ✅                             | ❌             | HIGH             |
| Operating CF ratio      | ✅                             | ❌             | HIGH             |
| Free cash flow          | ✅ OCF - CapEx                 | ❌             | HIGH             |
| Cash conversion cycle   | ✅                             | ❌             | VERY HIGH        |
| Operating CF margin     | ✅                             | ❌             | HIGH             |
| CF coverage ratio       | ✅                             | ❌             | HIGH             |
| **Days Metrics**        |
| Days receivable         | ✅ `calculateDaysReceivable()` | ❌             | HIGH             |
| Days payable            | ✅ `calculateDaysPayable()`    | ❌             | HIGH             |
| Days inventory          | ✅ `calculateDaysInventory()`  | ❌             | HIGH             |
| **Activity Details**    |
| Operating activities    | ✅ `getOperatingActivities()`  | ✅ Basic lines | HIGH             |
| AR/AP changes           | ✅ Beginning vs ending         | ❌             | HIGH             |
| Inventory changes       | ✅ Beginning vs ending         | ❌             | HIGH             |
| Depreciation            | ✅ Journal entry extraction    | ❌             | HIGH             |
| Investing activities    | ✅ `getInvestingActivities()`  | ✅ Basic lines | MEDIUM           |
| Equipment purchases     | ✅ Purchase query              | ❌             | MEDIUM           |
| Financing activities    | ✅ `getFinancingActivities()`  | ✅ Basic lines | MEDIUM           |
| Loan proceeds           | ✅ Deposit query               | ❌             | MEDIUM           |
| Owner contributions     | ✅ Journal entry               | ❌             | MEDIUM           |
| **Visualizations**      |
| Waterfall chart         | ✅ Formatted data              | ❌             | MEDIUM           |
| Beginning cash          | ✅ Calculation                 | ✅ Extraction  | Equal            |
| Ending cash             | ✅ Calculation                 | ✅ Extraction  | Equal            |
| Activity sections       | ✅ Name/value pairs            | ❌             | MEDIUM           |
| **Integration**         |
| P&L data fetch          | ✅ For net income              | ❌             | HIGH             |
| Balance sheet fetch     | ✅ For current liabilities     | ❌             | HIGH             |
| True total expenses     | ✅ COGS + Operating + Other    | ❌             | HIGH             |
| Monthly expenses calc   | ✅ Period-based                | ❌             | MEDIUM           |
| **Transaction Queries** |
| Journal entries         | ✅ Paginated query             | ❌             | HIGH             |
| Purchases               | ✅ With caching                | ❌             | HIGH             |
| Deposits                | ✅ With caching                | ❌             | HIGH             |
| Cache management        | ✅ 60s TTL                     | ❌             | MEDIUM           |

**Total Features:** OLD: 32 ✅ | NEW: 3 ✅ (91% gap)

---

## Summary Statistics

### Feature Coverage

- **Profit & Loss:** OLD 35 features vs NEW 2 features (94% gap)
- **Balance Sheet:** OLD 33 features vs NEW 2 features (94% gap)
- **Cash Flow:** OLD 32 features vs NEW 3 features (91% gap)
- **Average Gap:** 93%

### Migration Effort Distribution

| Effort Level | P&L | BS  | CF  | Total |
| ------------ | --- | --- | --- | ----- |
| LOW          | 2   | 1   | 0   | 3     |
| MEDIUM       | 13  | 10  | 9   | 32    |
| HIGH         | 18  | 16  | 18  | 52    |
| VERY HIGH    | 2   | 6   | 5   | 13    |
| **Total**    | 35  | 33  | 32  | 100   |

### Critical Dependencies

1. **P&L → BS:** ROA and ROE calculations need net income
2. **P&L → CF:** Cash metrics need net income and expenses
3. **BS → CF:** Cash metrics need current liabilities
4. **All → All:** True total expenses used across reports

### Code Reusability

| Helper Module           | Functions to Reuse       | Lines            |
| ----------------------- | ------------------------ | ---------------- |
| `reportCalculations.ts` | 15 calculation functions | ~300             |
| `reportHelpers.ts`      | 8 helper functions       | ~400             |
| `accounts.ts`           | 6 query functions        | ~200             |
| `reportPerformance.ts`  | Tracking system          | ~150             |
| `database.ts`           | Metadata caching         | ~100             |
| **Total Reusable**      | **35+ functions**        | **~1,150 lines** |

---

## Architecture Comparison

### OLD Routes (Monolithic)

```
route.ts (667-963 lines)
├── API call logic
├── Data parsing
├── Calculations (inline)
├── Categorization (inline)
├── Insights generation (inline)
├── Error handling
├── Performance tracking
└── Response formatting
```

**Pros:**

- ✅ All logic in one place
- ✅ Complete feature set
- ✅ Battle-tested

**Cons:**

- ❌ Hard to maintain
- ❌ Difficult to test
- ❌ Code duplication
- ❌ Tight coupling

### NEW Routes (Transformer-based)

```
route.ts (90-97 lines)
├── API call
├── Transformer call
└── Response formatting

transformers.ts
├── Report parsing
├── Section processing
└── Normalization
```

**Pros:**

- ✅ Clean separation
- ✅ Easy to test
- ✅ Reusable transformers
- ✅ International support

**Cons:**

- ❌ No calculations
- ❌ No insights
- ❌ Minimal error handling
- ❌ No performance tracking

### RECOMMENDED (Enriched)

```
route.ts (150-200 lines)
├── API call
├── Transformer call
├── Enricher call         ← NEW
├── Error handling        ← ENHANCED
├── Performance tracking  ← ADDED
└── Response formatting

transformers.ts
├── Report parsing
├── Section processing
└── Normalization

enrichers.ts (NEW)        ← NEW FILE
├── KPI calculations
├── Categorization
├── Insights generation
├── Metadata enrichment
└── Integration logic
```

**Benefits:**

- ✅ Best of both worlds
- ✅ Maintainable structure
- ✅ Complete feature set
- ✅ Testable components
- ✅ Reusable logic

---

## Migration Timeline

### Phase 1: Calculation Layer (2-3 days)

- Create `/src/quickbooks/reports/enrichers/`
- Port calculation logic from OLD routes
- Write unit tests for all functions
- **Deliverable:** 35+ calculation functions tested

### Phase 2: Route Updates (1-2 days)

- Update NEW routes to use enrichers
- Add error handling and retry logic
- Add performance tracking
- **Deliverable:** Feature parity with OLD routes

### Phase 3: Feature Flag (1 day)

- Add `USE_NEW_REPORTS` environment variable
- Update frontend hooks with conditional routing
- Set up A/B comparison logging
- **Deliverable:** Both routes running in parallel

### Phase 4: Gradual Rollout (2 weeks)

- Days 1-2: Internal testing
- Days 3-5: 10% rollout with monitoring
- Days 6-7: Review and adjust
- Days 8-10: 50% rollout
- Days 11-14: 100% rollout + cleanup
- **Deliverable:** OLD routes deprecated

**Total Time:** 3-4 weeks

---

## References

- **Detailed Analysis:** `/docs/qb-reports-migration-plan.json`
- **Summary:** `/docs/qb-migration-summary.md`
- **This Comparison:** `/docs/qb-migration-comparison.md`
