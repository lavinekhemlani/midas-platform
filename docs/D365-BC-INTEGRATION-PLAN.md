# D365 / Business Central Integration Plan

## Status & Context (February 2026)

### What Exists Today

#### Infrastructure (Working)
| Component | Status | Location |
|-----------|--------|----------|
| Fivetran BC Connector | Syncing to Redshift | `bc_aquaculture` schema, 50 tables, 890K+ GL entries |
| Redshift Serverless | Running | Workgroup: `shopify-analytics`, DB: `dev` |
| Redshift API Route | Working | `src/app/api/redshift/query/route.ts` |
| Warehouse Access Control | Working | `src/lib/redshift/warehouse-access.ts` (org-based schema ACL) |
| DynamoDB warehouse_config | Working | On 3 orgs: CFO Org, Anu Gmorg, mivale's Org |
| Auth chain (user -> org -> warehouse) | Fixed | `src/lib/db/queries.ts` now handles snake_case DynamoDB fields |

#### Aqua Dashboard (Working Prototype)
| Component | Status | Location |
|-----------|--------|----------|
| P&L Dashboard (metrics, charts) | Working | `src/app/(main)/aqua/pnl/page.tsx` |
| Income Statement (hierarchical) | Working | `aqua/pnl/components/WarehousePnLStatement.tsx` |
| Balance Sheet (with balance check) | Working | `aqua/pnl/components/WarehouseBalanceSheet.tsx` |
| Trial Balance Table | Working | `aqua/pnl/components/TrialBalanceTable.tsx` |
| Department Breakdown | Working | `aqua/pnl/components/DepartmentBreakdown.tsx` |
| Top Customers Chart | Working | `aqua/pnl/components/TopCustomersChart.tsx` |
| Document Type Chart | Working | `aqua/pnl/components/DocumentTypeChart.tsx` |
| Monthly Revenue Trend | Working | `aqua/pnl/components/TopCustomersChart.tsx` |
| Warehouse Data Hooks | Working | `aqua/pnl/hooks/useWarehouseData.ts` (8 hooks) |
| P&L Statement Hook | Working | `aqua/pnl/hooks/useWarehousePnLStatement.ts` |
| Date Range Filtering | Working | Preset periods + custom range |
| Dev Warehouse Explorer | Working | `src/app/dev/warehouse/page.tsx` (12 query presets) |

#### QuickBooks Dashboard (Production)
| Component | Status |
|-----------|--------|
| P&L Report | Production (`/reports/pnl`) |
| Balance Sheet | Production (`/reports/balance-sheet`) |
| Cash Flow | Production (`/reports/cash-flow`) |
| Summary/KPIs | Production (`/reports/`) |
| Sales (customers, products) | Production (`/sales`) |
| Expenses (bills, vendors) | Production (`/expenses/*`) |
| Journal | Production (`/journal`) |
| Chart of Accounts | Production (`/coa`) |
| Forecasting | Production (`/forecasting`) |
| AI Agent (100+ metrics) | Production |

#### Existing Architecture Guide
- `docs/BUSINESS-CENTRAL-INTEGRATION-GUIDE.md` — 1,586-line blueprint covering dbt, BC OAuth, multi-source, cross-entity consolidation
- Largely unimplemented — provides dbt SQL models, API route designs, and BC OAuth patterns on paper

### What's NOT on Main Yet
All warehouse/D365 work lives on `anu-warehouse` branch only. Zero warehouse code has been merged to main.

---

## Data Architecture Assessment

### BC Data Available in Redshift (`bc_aquaculture` schema)

| Table | Rows | Purpose | Used By Aqua Dashboard? |
|-------|------|---------|------------------------|
| `g_l_entry` | 890,555 | All GL transactions | Yes (P&L, BS, Trial Balance, Monthly Trend) |
| `g_l_account` | ~200 | Chart of Accounts | Yes (P&L Statement, BS classification) |
| `sales_invoice_header` | 29,102 | Sales invoices | Yes (Top Customers) |
| `sales_invoice_line` | 54,080 | Invoice line items | Yes (Top Customers, Monthly Revenue) |
| `purch_inv_header` | ~5,000 | Purchase invoices | No (preset exists in dev explorer) |
| `purch_inv_line` | ~10,000 | Purchase line items | No |
| `customer` | ~500 | Customer master | No |
| `vendor` | ~300 | Vendor master | No |
| `item` | ~2,000 | Product master | No |
| `item_ledger_entry` | 54,411 | Inventory movements | No |
| `cust_ledger_entry` | ~20,000 | Customer ledger (AR) | No |
| `vendor_ledger_entry` | ~10,000 | Vendor ledger (AP) | No |
| `bank_account` | ~10 | Bank accounts | No |
| `bank_account_ledger_entry` | ~5,000 | Bank transactions | No |
| `dimension` / `dimension_value` | ~100 | Cost centers/departments | Partially (Department Breakdown) |
| `currency` / `currency_exchange_rate` | ~20 | Multi-currency | No |
| `company_information` | 1 | Company settings | No |

**Data Date Range:** 2024-12-31 to 2055-09-06 (14 months of data)

### Fivetran Column Naming

Fivetran renames BC fields from PascalCase/`No.` to snake_case/`no`:
- `No.` becomes `no` (NOT `no_`)
- `G/L Account No.` becomes `g_laccount_no`
- `Posting Date` becomes `posting_date`
- `_fivetran_deleted` added for soft deletes
- `_fivetran_synced` added for sync timestamps
- `company_id` added for multi-company support

### BC Account Classification System

Business Central uses a **3-level classification** for the Chart of Accounts:

**Level 1: `account_type`** (filter to `Posting` only)
| Value | Include in Reports? | Notes |
|-------|-------------------|-------|
| `Posting` | **YES** | Only type with actual GL entries |
| `Heading` | No | Display grouping only |
| `Total` | No | Computed sum |
| `Begin-Total` | No | Structural marker |
| `End-Total` | No | Structural marker |

**Level 2: `account_category`** (maps to financial statements)
| Category | Financial Statement | P&L Section |
|----------|-------------------|-------------|
| `Income` | Income Statement | Revenue |
| `Cost of Goods Sold` | Income Statement | COGS |
| `Expense` | Income Statement | Operating Expenses |
| `Assets` | Balance Sheet | Assets |
| `Liabilities` | Balance Sheet | Liabilities |
| `Equity` | Balance Sheet | Equity |

**Level 3: `account_subcategory_descript`** (user-defined granularity)
- Provides line items like "Cash", "Accounts Receivable", "Inventory", "Payroll", etc.
- Pre-populated in US localization; may be empty in other locales
- If empty, need fallback mapping by account number ranges

### Critical Query Rules (Validated by Research)

1. **Always filter** `WHERE account_type = 'Posting'` when joining to `g_l_account`
2. **Always filter** `WHERE _fivetran_deleted = false` on all tables
3. **Exclude reversed entries** `WHERE reversed = false` on `g_l_entry` (prevents double-counting)
4. **Income accounts**: Net = Credits - Debits (positive = revenue)
5. **Expense/COGS accounts**: Net = Debits - Credits (positive = expense)
6. **Asset accounts**: Balance = Debits - Credits (debit-normal)
7. **Liability/Equity accounts**: Balance = Credits - Debits (credit-normal)
8. **P&L is period-based** (filter by posting_date range)
9. **Balance Sheet is cumulative** (all entries up to the as-of date)

---

## Gap Analysis: Aqua Dashboard vs QuickBooks Dashboard

### What Aqua Has That Matches QB

| Feature | QB Dashboard | Aqua Dashboard | Parity? |
|---------|-------------|----------------|---------|
| P&L with hierarchy | `PnLView` with enricher | `WarehousePnLStatement` | ~80% (aqua missing KPIs like EBITDA, margins, insights) |
| Balance Sheet | `BalanceSheetView` with enricher | `WarehouseBalanceSheet` | ~70% (aqua missing KPI ratios, liquidity metrics) |
| Trial Balance | Via CoA page | `TrialBalanceTable` | 90% |
| Monthly Trend | Via trend endpoint | `WarehouseMetricsGrid` | 70% |
| Date Filtering | Period presets + custom | Period presets + custom | 100% |

### What Aqua is Missing

| Feature | QB Has It | Available in BC Data? | Complexity |
|---------|-----------|----------------------|------------|
| **Cash Flow Statement** | Full (operating/investing/financing) | Yes (indirect method from GL + bank ledger) | High |
| **KPI Metrics Grid** (10 metrics) | ARR, gross margin, burn rate, runway, DSO, DPO, etc. | Yes (derived from P&L + BS) | Medium |
| **AR Aging Report** | By customer, by bucket | Yes (`cust_ledger_entry` + `sales_invoice_header`) | Medium |
| **AP Aging Report** | By vendor, by bucket | Yes (`vendor_ledger_entry` + `purch_inv_header`) | Medium |
| **Sales Page** (customers, products, outstanding) | Full tab view | Yes (`sales_invoice_*` + `customer` + `item`) | Medium |
| **Expenses Page** (bills, vendors) | Full tab view | Yes (`purch_inv_*` + `vendor`) | Medium |
| **Journal Entries** | Virtualized table with drill-down | Yes (`g_l_entry` directly) | Low |
| **Chart of Accounts** | Hierarchical with validation | Yes (`g_l_account`) | Low |
| **Forecasting** | 13-week / 6-month projection | Yes (from historical P&L/CF data) | Medium |
| **AI Agent Integration** | 100+ metrics via query planner | Not yet | High |
| **PDF Export** | P&L, BS, CF statements | Not yet | Medium |
| **Insights Generation** | Automated variance analysis | Not yet | Medium |

### Architecture Gap: No Provider Abstraction

The biggest gap is that the aqua dashboard is a **standalone parallel implementation**. It doesn't share:
- The `NormalizedProfitAndLoss` / `NormalizedBalanceSheet` types
- The enricher pipeline (KPIs, insights, hierarchy building, EBITDA)
- The `useReportData` hooks
- The existing report views (`PnLView`, `BalanceSheetView`)

The QB dashboard goes: Raw QB API -> Transform -> Normalize -> Enrich -> UI
The aqua dashboard goes: Raw Redshift SQL -> Custom hooks -> Custom components

**This means feature parity requires either:**
- **Option A**: Build a provider abstraction so BC data feeds into the existing QB pipeline (reuse all enrichers + views)
- **Option B**: Continue building aqua as a parallel dashboard with its own components (duplicate all enricher logic)

**Recommendation: Option A** — build the provider abstraction. The enricher pipeline has thousands of lines of battle-tested business logic (EBITDA extraction, contra-revenue detection, hierarchy building, insights generation, KPI calculations). Duplicating this is expensive and error-prone.

---

## Implementation Plan

### Phase 0: Stabilize Current Work (1-2 days)
**Goal:** Get existing aqua dashboard production-ready and merged to main.

- [ ] Fix remaining query preset bugs (column naming — `no` vs `no_`)
- [ ] Add `reversed = false` filter to all GL queries (currently missing)
- [ ] Add `account_type = 'Posting'` filter to P&L Statement hook (currently missing)
- [ ] Verify all 8 hooks work with the 3 configured orgs
- [ ] Add error boundaries to aqua components
- [ ] Merge `anu-warehouse` to main

### Phase 1: Provider Abstraction Layer (1 week)
**Goal:** Create a source-agnostic data provider that routes between QB API and Redshift.

#### 1a. Define Provider Interface
```
src/lib/providers/
  types.ts              — FinancialDataProvider interface
  quickbooks/            — Existing QB implementation (refactor to conform)
  warehouse/             — New Redshift/BC implementation
  router.ts             — Routes to correct provider based on org config
```

The provider interface should expose:
```typescript
interface FinancialDataProvider {
  getProfitAndLoss(params: ReportParams): Promise<NormalizedProfitAndLoss>
  getBalanceSheet(params: ReportParams): Promise<NormalizedBalanceSheet>
  getCashFlow(params: ReportParams): Promise<NormalizedCashFlow>
  getTrialBalance(params: ReportParams): Promise<NormalizedTrialBalance>
  getAgedReceivables(params: ReportParams): Promise<NormalizedAgedReport>
  getAgedPayables(params: ReportParams): Promise<NormalizedAgedReport>
  getSalesByCustomer(params: ReportParams): Promise<SalesByCustomerResult>
  getSalesByProduct(params: ReportParams): Promise<SalesByProductResult>
  getBills(params: ReportParams): Promise<BillsResult>
  getVendorAnalysis(params: ReportParams): Promise<VendorAnalysisResult>
  getJournalEntries(params: ReportParams): Promise<JournalResult>
  getChartOfAccounts(): Promise<ChartOfAccountsResult>
}
```

#### 1b. BC Report Generators (Redshift SQL -> Normalized Types)
```
src/lib/providers/warehouse/
  reports/
    profit-loss.ts       — GL query -> NormalizedProfitAndLoss
    balance-sheet.ts     — GL cumulative -> NormalizedBalanceSheet
    cash-flow.ts         — Indirect method -> NormalizedCashFlow
    trial-balance.ts     — Account balances
    aged-receivables.ts  — cust_ledger_entry aging
    aged-payables.ts     — vendor_ledger_entry aging
  entities/
    sales.ts             — sales_invoice_* -> Sales data
    expenses.ts          — purch_inv_* -> Bills/vendor data
    journal.ts           — g_l_entry -> Journal entries
    accounts.ts          — g_l_account -> Chart of accounts
  account-mapper.ts      — BC account_category -> financial statement mapping
```

#### 1c. Provider Router in API Routes
Update existing `/api/quickbooks/reports/*` routes (or create parallel `/api/reports/*` routes) that:
1. Check org's connected providers
2. If `warehouse_config.enabled` and source_type is `business_central` -> use warehouse provider
3. If `providers.quickbooks.credentials.connected` -> use QB provider
4. Feed result into existing enricher pipeline

### Phase 2: Unify Dashboard Pages (1 week)
**Goal:** Make existing QB dashboard pages work with BC data seamlessly.

- [ ] Update `/reports/pnl` to use provider-routed API (QB or BC)
- [ ] Update `/reports/balance-sheet` to use provider-routed API
- [ ] Update `/reports/cash-flow` to use provider-routed API
- [ ] Update `/reports/` summary to use provider-routed KPIs
- [ ] Update `/sales` page to use provider-routed sales data
- [ ] Update `/expenses/*` pages to use provider-routed expense data
- [ ] Update `/journal` page to use provider-routed journal data
- [ ] Update `/coa` page to use provider-routed accounts data
- [ ] Add provider indicator badge (shows "QuickBooks" or "Business Central" source)
- [ ] Keep aqua dashboard as an optional "warehouse explorer" for power users

### Phase 3: Missing BC Reports (1-2 weeks)
**Goal:** Implement BC-specific reports that don't exist yet.

#### Cash Flow Statement (Indirect Method)
```sql
-- Start with Net Income from P&L
-- Then calculate working capital changes:
--   Change in AR = AR(end) - AR(start)
--   Change in AP = AP(end) - AP(start)
--   Change in Inventory = Inv(end) - Inv(start)
-- Add back depreciation (non-cash expense)
-- Investing = Fixed asset changes
-- Financing = Debt + equity changes
```

#### AR Aging
```sql
SELECT
  c.name AS customer_name,
  sih.no AS invoice_no,
  sih.posting_date,
  sih.due_date,
  sih.remaining_amount,
  DATEDIFF(day, sih.due_date, CURRENT_DATE) AS days_overdue,
  CASE
    WHEN DATEDIFF(day, sih.due_date, CURRENT_DATE) <= 0 THEN 'Current'
    WHEN DATEDIFF(day, sih.due_date, CURRENT_DATE) <= 30 THEN '1-30'
    WHEN DATEDIFF(day, sih.due_date, CURRENT_DATE) <= 60 THEN '31-60'
    WHEN DATEDIFF(day, sih.due_date, CURRENT_DATE) <= 90 THEN '61-90'
    ELSE '90+'
  END AS aging_bucket
FROM bc_aquaculture.sales_invoice_header sih
JOIN bc_aquaculture.customer c ON sih.sell_to_customer_no = c.no
WHERE sih._fivetran_deleted = false AND sih.remaining_amount > 0
```

#### AP Aging (same pattern with `purch_inv_header` + `vendor`)

#### KPI Calculations
Reuse existing formulas from `src/lib/utils/financial/calculations.ts`:
- Gross margin, net margin, operating margin
- Current ratio, quick ratio, working capital
- DSO, DPO, cash conversion cycle
- Burn rate, runway
- ROA, ROE

### Phase 4: Advanced Features (2-4 weeks)
**Goal:** Leverage warehouse advantages that QB API can't provide.

- [ ] **Departmental P&L** — Full P&L per `global_dimension_1_code` (not possible with QB)
- [ ] **Cross-period comparison** — Arbitrary period comparison (e.g., Q3 2025 vs Q3 2024)
- [ ] **Multi-currency consolidation** — Using `currency_exchange_rate` table
- [ ] **Forecasting from BC data** — Feed historical P&L/CF into existing forecast engine
- [ ] **AI Agent for BC data** — Register BC metrics in the metrics registry
- [ ] **Reconciliation job** — Compare warehouse P&L vs BC Reports API output (monthly automated check)
- [ ] **dbt transformation layer** — Staging + intermediate + analytics models (per existing guide)
- [ ] **Caching layer** — Pre-compute common reports, store in PostgreSQL or DynamoDB for fast reads

---

## Cost & Performance Considerations

### Current Costs
| Service | Cost | Notes |
|---------|------|-------|
| Redshift Serverless | ~$3/hr active, $0 idle | 8 RPU minimum; auto-scales to zero |
| Fivetran (Free plan) | $0 | Moving to GCP; need IP whitelist |
| DynamoDB | Negligible | Already paying for user/org tables |

### At Scale Recommendations
| Stage | Strategy | Estimated Cost |
|-------|----------|---------------|
| Dev/MVP (now) | Redshift Serverless direct queries | <$5/month |
| Early users (<100) | Add Redis/DynamoDB caching for common reports | +$15-30/month |
| Growth (100-1000) | Pre-computed materialized views in Redshift | +$50-100/month |
| Scale (1000+) | PostgreSQL serving layer for dashboards; warehouse for ad-hoc only | +$100-300/month |

### Query Performance Notes
- Cold start: 2-5s (Redshift waking up)
- Warm queries: 1-3s for aggregations over 890K rows
- GL entry scans are the bottleneck; consider sort keys on `(posting_date, g_laccount_no)`
- Monthly P&L query: ~2s warm
- Trial Balance: ~3s warm (full table scan + group by)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BC subcategories empty for non-US locales | Medium | High (breaks P&L hierarchy) | Build fallback mapping table by account number ranges |
| Fivetran missing tables after free plan migration | Medium | High | Validate table sync after GCP migration |
| Reversed GL entries not excluded | High (currently missing) | Medium (inflated totals) | Add `reversed = false` filter to all GL queries |
| Account_type not filtered to Posting | High (currently missing) | Medium (structural rows in reports) | Add `account_type = 'Posting'` filter |
| Redshift cold start latency | Certain | Low (2-5s) | Add loading states; consider warm-up pings |
| Multi-currency not handled | Low (for now) | Medium | Use currency_exchange_rate table when needed |
| Fivetran sync gaps | Low | Medium | Monthly reconciliation vs BC Reports API |

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Use Fivetran -> Redshift (not BC API) for analytics | Historical data, cross-source joins, no rate limits, dimensional analysis | Feb 2026 |
| Raw GL data over pre-built reports | Full granularity, drill-down, custom periods, cross-system joins | Feb 2026 |
| Option A: Provider abstraction (not parallel dashboard) | Reuse enricher pipeline, KPI calcs, UI components; avoid duplication | Feb 2026 |
| Keep aqua dashboard as power-user explorer | Useful for raw data exploration; doesn't replace main dashboard | Feb 2026 |
| Schema-per-org in Redshift | Better isolation, simpler Fivetran setup, cleaner access control | Per integration guide |
| Redshift Serverless (not RDS PostgreSQL) | Scales to zero, handles large aggregations, already running | Feb 2026 |
| Defer dbt until Phase 4 | Direct SQL queries work for now; dbt adds complexity without immediate value | Feb 2026 |
| Defer BC OAuth until needed for real-time | Fivetran handles sync; OAuth only needed for write-back or live lookups | Feb 2026 |

---

## File Reference

### Existing (on `anu-warehouse` branch)
```
src/app/(main)/aqua/pnl/                    — BC financial dashboard
src/app/api/redshift/query/route.ts          — Redshift query API
src/app/dev/warehouse/page.tsx               — Dev warehouse explorer
src/lib/redshift/warehouse-access.ts         — Org-based access control
src/lib/redshift/client.ts                   — Redshift Data API client
src/lib/db/queries.ts                        — User/org profile queries (fixed snake_case)
src/lib/data.ts                              — Organization interface with warehouse_config
docs/BUSINESS-CENTRAL-INTEGRATION-GUIDE.md   — Full architecture blueprint
scripts/*.ts                                 — 16 utility scripts for Redshift/DynamoDB
```

### To Be Created (Phase 1-3)
```
src/lib/providers/types.ts                   — FinancialDataProvider interface
src/lib/providers/router.ts                  — Provider routing logic
src/lib/providers/warehouse/
  reports/profit-loss.ts                     — BC P&L generator
  reports/balance-sheet.ts                   — BC BS generator
  reports/cash-flow.ts                       — BC CF generator (indirect method)
  reports/trial-balance.ts                   — BC trial balance
  reports/aged-receivables.ts                — AR aging from cust_ledger_entry
  reports/aged-payables.ts                   — AP aging from vendor_ledger_entry
  entities/sales.ts                          — Sales from invoice tables
  entities/expenses.ts                       — Bills/vendors from purchase tables
  entities/journal.ts                        — Journal from g_l_entry
  entities/accounts.ts                       — CoA from g_l_account
  account-mapper.ts                          — BC account_category -> statement mapping
```

### QB Files to Reference (patterns to follow)
```
src/quickbooks/reports/transformers.ts        — transformProfitAndLoss(), transformBalanceSheet()
src/quickbooks/reports/enrichers/profit-loss.ts — enrichProfitAndLoss() (KPIs, hierarchy, insights)
src/quickbooks/reports/enrichers/balance-sheet.ts — enrichBalanceSheet()
src/quickbooks/reports/enrichers/cash-flow.ts  — enrichCashFlow()
src/quickbooks/types/normalized.ts            — 42 normalized entity types
src/quickbooks/types/reports.ts               — Report type definitions
src/quickbooks/entities/transformers.ts       — 71 entity transformers
src/lib/utils/financial/calculations.ts       — Pure financial calculation functions
src/lib/utils/financial/reportCalculations.ts — Report-specific calculations
src/ai/tools/quickbooks-data/metrics-registry.ts — 100+ financial metrics
```
