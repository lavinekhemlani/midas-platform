# Slow-Moving Inventory — Technical Documentation

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Flow](#2-data-flow)
3. [Redshift Tables](#3-redshift-tables)
4. [SQL Query — Exact Source](#4-sql-query--exact-source)
5. [Join Strategy](#5-join-strategy)
6. [Risk Classification Logic](#6-risk-classification-logic)
7. [UI Components](#7-ui-components)
8. [File Reference](#8-file-reference)
9. [Known Issues & Improvements](#9-known-issues--improvements)
10. [Dashboard vs Agent — Number Divergence](#10-dashboard-vs-agent--number-divergence-analysis)
11. [Blast Radius Analysis](#11-blast-radius-analysis--what-breaks-if-we-touch-shared-code)
12. [Complete Fix List](#12-complete-fix-list--isolation-first-approach)
13. [Redshift Column Discovery Results](#13-redshift-column-discovery-results-2026-02-26)

---

## 1. Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  InventoryView.tsx   │────▶│  useSlowMovingInventory  │────▶│  POST /api/redshift  │────▶│  Redshift         │
│  (dashboard page)    │     │  (SWR hook, builds SQL)   │     │  /query (route.ts)   │     │  Serverless       │
└─────────────────────┘     └──────────────────────────┘     └─────────────────────┘     └──────────────────┘
         │                            │                              │                          │
         │                            │                              │                          │
   Renders two components:      Raw SQL string               Validates:                  Fivetran-synced
   - SlowMovingInventoryDonut   sent via fetch()             - Auth (Cognito)            from Business
   - SlowMovingInventoryCard                                 - Schema access (DynamoDB)  Central
                                                             - Query syntax (no DML)
                                                             - LIMIT enforcement (1000)
```

**Key design decisions:**

- SQL is built client-side in the React hook and sent as a raw string to the API
- The API route is a generic Redshift query proxy — no slow-moving-specific server logic
- Risk classification and summary aggregation happen entirely client-side in TypeScript
- Redshift connection uses AWS SDK `RedshiftDataClient` (Data API, not JDBC) with async polling

---

## 2. Data Flow

### Step-by-step:

1. **InventoryView** mounts, resolves warehouse schema via `useWarehouseConfig()`
2. `useSlowMovingInventory(schema, dateRange, limit=20)` constructs the SQL string
3. SWR calls `warehouseFetcher()` → `POST /api/redshift/query` with `{ query: sqlString }`
4. API route validates auth → validates schema access → validates SQL syntax → executes via Redshift Data API
5. Redshift Data API: `ExecuteStatementCommand` → poll `DescribeStatementCommand` (1s intervals, 60s timeout) → `GetStatementResultCommand`
6. Raw rows returned to hook, mapped to `SlowMovingItemRow[]`
7. Client-side summary computed: `totalItems`, `totalValue`, `zeroSalesCount`, `zeroSalesValue`
8. Data flows to `SlowMovingInventoryDonut` (donut chart) and `SlowMovingInventoryCard` (item list)

### Date range handling:

| Period selector value              | Date filter applied                                                         |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `all_time`                         | `posting_date >= CURRENT_DATE - INTERVAL '12 months'` (default fallback)    |
| `this_month` / `last_month` / etc. | `getDateRangeForPeriod()` computes `startDate`/`endDate`, injected into SQL |
| `custom`                           | User-supplied `startDate`/`endDate` from `DateRangeInputs` component        |

---

## 3. Redshift Tables

Only **2 tables** are queried for slow-moving inventory:

### `{schema}.item` — Master inventory table

| Column              | Type    | Usage                                            |
| ------------------- | ------- | ------------------------------------------------ |
| `no`                | VARCHAR | Primary key, aliased as `item_no`                |
| `description`       | VARCHAR | Item name                                        |
| `inventory`         | INTEGER | **Current** on-hand quantity (Fivetran snapshot) |
| `unit_cost`         | DECIMAL | Cost per unit                                    |
| `company_id`        | VARCHAR | Multi-tenant key                                 |
| `_fivetran_deleted` | BOOLEAN | Soft-delete flag from Fivetran sync              |

### `{schema}.item_ledger_entry` — Inventory movement ledger

| Column              | Type    | Usage                                                                                                       |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `item_no`           | VARCHAR | FK to `item.no`                                                                                             |
| `posting_date`      | DATE    | Transaction date (used for period filtering + last sale date)                                               |
| `entry_type`        | VARCHAR | `'Sale'`, `'Purchase'`, `'Positive Adjmt.'`, `'Negative Adjmt.'`, `'Transfer'`, `'Output'`, `'Consumption'` |
| `quantity`          | INTEGER | Signed quantity (negative for sales)                                                                        |
| `company_id`        | VARCHAR | Multi-tenant key                                                                                            |
| `_fivetran_deleted` | BOOLEAN | Soft-delete flag                                                                                            |

### Tables NOT queried (but related):

| Table                                         | Why not used                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `sales_invoice_header` / `sales_invoice_line` | Sales are derived from `item_ledger_entry.entry_type = 'Sale'` instead |
| `purch_inv_header` / `purch_inv_line`         | Purchases derived from `item_ledger_entry.entry_type = 'Purchase'`     |
| `g_l_entry` / `g_l_account`                   | Only used by `useInventoryTurnover` for COGS, not slow-moving          |

---

## 4. SQL Query — Exact Source

**Source file:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts` (lines 397–438)

```sql
WITH period_sales AS (
  -- Aggregate sales and purchases per item within the date window
  SELECT
    item_no,
    company_id,
    COALESCE(SUM(CASE WHEN entry_type = 'Sale' THEN ABS(quantity) ELSE 0 END), 0)
      AS period_sales_qty,
    COALESCE(SUM(CASE WHEN entry_type = 'Purchase' THEN quantity ELSE 0 END), 0)
      AS period_purchases_qty,
    MAX(CASE WHEN entry_type = 'Sale' THEN posting_date END)
      AS last_sale_date
  FROM {schema}.item_ledger_entry ile
  WHERE COALESCE(_fivetran_deleted, false) = false
    AND ile.posting_date >= CURRENT_DATE - INTERVAL '12 months'   -- or custom range
  GROUP BY item_no, company_id
)
SELECT
  i.no                                          AS item_no,
  COALESCE(i.description, '')                   AS description,
  COALESCE(i.inventory, 0)                      AS inventory,
  COALESCE(i.unit_cost, 0)                      AS unit_cost,
  COALESCE(i.inventory, 0)
    * COALESCE(i.unit_cost, 0)                  AS inventory_value,
  COALESCE(ps.period_sales_qty, 0)              AS sales_qty,
  COALESCE(ps.period_purchases_qty, 0)          AS purchases_qty,
  CASE
    WHEN COALESCE(i.inventory, 0) > 0
     AND COALESCE(ps.period_sales_qty, 0) > 0
    THEN COALESCE(ps.period_sales_qty, 0)
       / COALESCE(i.inventory, 0)               -- ⚠️ integer division
    ELSE 0
  END                                           AS turnover_ratio,
  CASE
    WHEN ps.last_sale_date IS NULL THEN NULL
    ELSE DATEDIFF(day, ps.last_sale_date, CURRENT_DATE)
  END                                           AS days_since_last_sale
FROM {schema}.item i
LEFT JOIN period_sales ps
  ON i.no = ps.item_no
  AND i.company_id = ps.company_id
WHERE COALESCE(i._fivetran_deleted, false) = false
  AND COALESCE(i.inventory, 0) > 0
ORDER BY
  CASE
    WHEN COALESCE(ps.period_sales_qty, 0) = 0 THEN 0
    ELSE COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
  END ASC,
  COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) DESC
LIMIT 20
```

---

## 5. Join Strategy

### The single join:

```sql
FROM {schema}.item i
LEFT JOIN period_sales ps
  ON i.no = ps.item_no
  AND i.company_id = ps.company_id
```

| Aspect           | Detail                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **Join type**    | `LEFT JOIN` — items with zero ledger entries still appear (get NULL → "No Sales")           |
| **Join keys**    | `item_no` + `company_id` (composite, multi-tenant safe)                                     |
| **Cardinality**  | 1:1 — the CTE pre-aggregates `item_ledger_entry` by `(item_no, company_id)` before the join |
| **Pre-filter**   | CTE filters `_fivetran_deleted = false` and applies date range before aggregation           |
| **Outer filter** | `item._fivetran_deleted = false AND inventory > 0` — only items currently in stock          |

### Why LEFT JOIN is correct:

Items that have **never been sold** (no matching rows in `item_ledger_entry` with `entry_type = 'Sale'`) will have `ps.period_sales_qty = NULL` → `COALESCE(..., 0) = 0` → `turnover_ratio = 0`. These are the highest-risk items and must not be excluded. An `INNER JOIN` would silently drop them.

### Sort order:

```sql
ORDER BY turnover_ratio ASC, inventory_value DESC
```

Zero-turnover items float to the top (worst first), then sorted by value descending (biggest $ exposure first within the same turnover tier).

---

## 6. Risk Classification Logic

### Server-side (SQL)

The SQL only computes raw metrics. No risk levels are assigned in the query.

| Metric                 | Computation                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `turnover_ratio`       | `period_sales_qty / inventory` (0 when no sales)                    |
| `days_since_last_sale` | `DATEDIFF(day, last_sale_date, CURRENT_DATE)` or `NULL` if no sales |

### Client-side — SlowMovingInventoryCard

**Source:** `SlowMovingInventoryCard.tsx` (lines 42–80)

```typescript
function getRiskLevel(daysSinceSale: number | null) {
  if (daysSinceSale === null)  → "No Sales"   (Red,    XCircle icon)
  if (daysSinceSale > 180)     → "Critical"   (Red,    AlertTriangle icon)
  if (daysSinceSale > 90)      → "High"       (Orange, AlertTriangle icon)
  else                         → "Medium"     (Yellow, Clock icon)
}
```

| Risk Level   | Condition                      | Color            | Meaning                                       |
| ------------ | ------------------------------ | ---------------- | --------------------------------------------- |
| **No Sales** | `days_since_last_sale IS NULL` | Red (#ef4444)    | Item has never been sold in the period        |
| **Critical** | `days_since_last_sale > 180`   | Red (#ef4444)    | No sale for 6+ months                         |
| **High**     | `days_since_last_sale > 90`    | Orange (#f97316) | No sale for 3–6 months                        |
| **Medium**   | `days_since_last_sale ≤ 90`    | Yellow (#eab308) | Sale within 2–3 months but still low turnover |

### Client-side — SlowMovingInventoryDonut

**Source:** `SlowMovingInventoryDonut.tsx` (lines 71–96)

Simplified to 2 buckets:

| Bucket           | Filter            | Color            |
| ---------------- | ----------------- | ---------------- |
| **No Sales**     | `sales_qty === 0` | Red (#ef4444)    |
| **Low Turnover** | `sales_qty > 0`   | Orange (#f97316) |

Distribution is by `inventory_value` (dollar-weighted, not count-weighted).

### Client-side — Summary aggregation

**Source:** `useInventoryData.ts` (lines 463–473)

```typescript
summary = {
  totalItems:     items.length,                              // ⚠️ capped at LIMIT 20
  totalValue:     items.reduce(sum → inventory_value),       // ⚠️ only sums the 20 rows
  zeroSalesCount: items.filter(sales_qty === 0).length,
  zeroSalesValue: items.filter(sales_qty === 0).reduce(sum → inventory_value),
}
```

---

## 7. UI Components

### Dashboard layout (InventoryView.tsx, line 950–962)

Slow-moving inventory occupies the **bottom-left** panel in a 2-column grid:

```
┌──────────────────────────┬──────────────────────────┐
│  Stock by Category       │  Turnover & Valuation    │
├──────────────────────────┼──────────────────────────┤
│  Top Items by Value      │  Valuation Comparison    │
├──────────────────────────┼──────────────────────────┤
│  Slow Moving Inventory   │  Movement Trend          │
│  (Donut + Legend)        │  (Flow visualization)    │
└──────────────────────────┴──────────────────────────┘
```

### SlowMovingInventoryDonut

- SVG donut chart (120×120px, 20px stroke)
- Interactive hover on segments
- Legend with item count, value, and percentage per bucket
- "Total at Risk" footer

### SlowMovingInventoryCard

- Summary strip: "No Sales Items" count + "Total Items" count
- Scrollable list (max 10 items, max-height 200px)
- Per-item: description (truncated 22 chars), days since last sale, inventory value, risk badge
- Color-coded risk legend at bottom

---

## 8. File Reference

| File                             | Path                                                                  | Lines   | Role                                                       |
| -------------------------------- | --------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| **useInventoryData.ts**          | `src/app/(main)/bc/inventory/hooks/useInventoryData.ts`               | 385–476 | SQL query builder + SWR hook + summary computation         |
| **SlowMovingInventoryCard.tsx**  | `src/app/(main)/bc/inventory/components/SlowMovingInventoryCard.tsx`  | 1–215   | Item list card with risk levels                            |
| **SlowMovingInventoryDonut.tsx** | `src/app/(main)/bc/inventory/components/SlowMovingInventoryDonut.tsx` | 1–257   | Donut chart with 2-bucket distribution                     |
| **InventoryView.tsx**            | `src/app/(main)/bc/inventory/views/InventoryView.tsx`                 | 950–962 | Dashboard layout, passes data to both components           |
| **route.ts**                     | `src/app/api/redshift/query/route.ts`                                 | 1–216   | Generic Redshift query proxy (auth, validation, execution) |
| **client.ts**                    | `src/lib/redshift/client.ts`                                          | 1–203   | Redshift Data API client (AWS SDK, async polling)          |
| **warehouse-access.ts**          | `src/lib/redshift/warehouse-access.ts`                                | 1–229   | Schema/table access control (DynamoDB-backed)              |
| **index.ts**                     | `src/app/(main)/bc/inventory/components/index.ts`                     | 1–32    | Component barrel exports                                   |

---

## 9. Known Issues & Improvements

### BUG: Integer division on turnover_ratio

**Location:** `useInventoryData.ts:421`

```sql
THEN COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
```

Both operands are integers in Redshift. `3 / 10 = 0`, not `0.3`. Every item with fewer sales units than inventory units gets `turnover_ratio = 0`, making it indistinguishable from items with truly zero sales.

**Fix:**

```sql
THEN CAST(ps.period_sales_qty AS FLOAT) / NULLIF(i.inventory, 0)
```

---

### BUG: LIMIT 20 corrupts summary totals

**Location:** `useInventoryData.ts:438` (LIMIT) + lines 463–473 (summary)

The query returns at most 20 rows. The summary (`totalItems`, `totalValue`) is computed from those 20 rows only. If 500 items have stock, the dashboard reports "20 items at risk" with their combined value, not the true total.

**Fix:** Add a window function or separate count query:

```sql
-- Option A: window function
COUNT(*) OVER() AS total_matching_items,
SUM(inventory_value) OVER() AS total_matching_value

-- Option B: separate summary CTE
WITH totals AS (
  SELECT COUNT(*) AS total_items,
         SUM(inventory * unit_cost) AS total_value,
         COUNT(CASE WHEN ps.period_sales_qty = 0 OR ps.period_sales_qty IS NULL THEN 1 END) AS zero_sales_count
  FROM item i LEFT JOIN period_sales ps ...
  WHERE inventory > 0
)
```

---

### BUG: `last_sale_date` scoped to date filter — misclassifies old sales as "No Sales"

**Location:** `useInventoryData.ts:405`

```sql
MAX(CASE WHEN entry_type = 'Sale' THEN posting_date END) AS last_sale_date
```

This only looks within the filtered period. If an item was last sold 14 months ago and the period is "last 12 months", `last_sale_date` returns `NULL` → item is classified as **"No Sales"** instead of **"Critical (14 months)"**.

**Fix:** Use a separate subquery for `last_sale_date` without the date filter:

```sql
-- In CTE or as a separate subquery:
(SELECT MAX(posting_date)
 FROM item_ledger_entry
 WHERE entry_type = 'Sale'
   AND item_no = i.no
   AND company_id = i.company_id
   AND _fivetran_deleted = false
) AS last_sale_date_global
```

---

### ISSUE: `item.inventory` is a point-in-time snapshot

**Location:** `useInventoryData.ts:414`

`item.inventory` reflects the **current** on-hand quantity (Fivetran sync). When comparing against historical periods (e.g., "Last Year"), the turnover ratio compares **today's inventory** against **last year's sales** — a cross-temporal mismatch.

**Fix:** For historical periods, compute period-end inventory from `item_ledger_entry` running totals:

```sql
-- Period-end inventory from ledger:
SUM(quantity) as period_end_inventory
FROM item_ledger_entry
WHERE posting_date <= endDate
GROUP BY item_no
```

---

### ISSUE: No ABC / Pareto classification

All slow-moving items are treated equally regardless of value. A $50k slow-mover gets the same risk label as a $50 one.

**Fix:** Add cumulative value percentage to classify items:

```sql
SUM(inventory_value) OVER (ORDER BY inventory_value DESC) /
  SUM(inventory_value) OVER () AS cumulative_pct

-- Then:
-- A class: cumulative_pct <= 0.80  (top 80% of value)
-- B class: cumulative_pct <= 0.95  (next 15%)
-- C class: cumulative_pct > 0.95   (bottom 5%)
```

---

### ISSUE: No aging buckets in donut chart

The donut only shows 2 categories (No Sales vs Low Turnover). There's no breakdown by aging bands (0–30, 31–60, 61–90, 91–180, 180+ days).

**Fix:** Expand the donut distribution to use the same bands as the card's `getRiskLevel()`:

```typescript
const agingBuckets = [
  { key: 'noSales', filter: (d) => d.days_since_last_sale === null, color: '#ef4444' },
  { key: 'critical', filter: (d) => d.days_since_last_sale > 180, color: '#dc2626' },
  { key: 'high', filter: (d) => d.days_since_last_sale > 90, color: '#f97316' },
  { key: 'medium', filter: (d) => d.days_since_last_sale > 60, color: '#eab308' },
  {
    key: 'low',
    filter: (d) => d.days_since_last_sale != null && d.days_since_last_sale <= 60,
    color: '#22c55e',
  },
]
```

---

### ISSUE: SQL injection via string interpolation

**Location:** `useInventoryData.ts:393`

```typescript
;`AND ile.posting_date >= '${dateRange.startDate}' AND ile.posting_date <= '${dateRange.endDate}'`
```

Date strings are interpolated directly. While the API route blocks DML keywords, a crafted date value like `'; DROP TABLE--` would be caught by the keyword filter but more subtle injection is possible.

**Fix:** Use parameterized queries via the Redshift Data API's `Parameters` field in `ExecuteStatementCommand`, or at minimum validate date format server-side with a strict regex.

---

### IMPROVEMENT: No `COALESCE(_fivetran_deleted, false) = false` index

The `_fivetran_deleted` filter appears on every query but likely has no dedicated index. For large `item_ledger_entry` tables, this scan can be expensive.

**Fix:** Add a partial index or ensure the Fivetran-managed schema includes:

```sql
CREATE INDEX idx_ile_active_items ON item_ledger_entry(item_no, posting_date)
WHERE _fivetran_deleted = false;
```

---

### IMPROVEMENT: `useInventoryTurnover` uses current inventory as average

**Location:** `useInventoryData.ts:573`

```sql
inv.current_inventory AS average_inventory
```

Average inventory should be `(opening_inventory + closing_inventory) / 2`. Using only current inventory skews turnover ratio depending on whether inventory is trending up or down.

---

### Summary of severity

| #   | Issue                              | Severity   | Type        |
| --- | ---------------------------------- | ---------- | ----------- |
| 1   | Integer division on turnover_ratio | **High**   | Bug         |
| 2   | LIMIT 20 corrupts summary totals   | **High**   | Bug         |
| 3   | last_sale_date scoped to period    | **Medium** | Bug         |
| 4   | item.inventory is point-in-time    | **Medium** | Design      |
| 5   | No ABC classification              | **Low**    | Feature gap |
| 6   | No aging buckets in donut          | **Low**    | Feature gap |
| 7   | SQL string interpolation           | **Medium** | Security    |
| 8   | No index on \_fivetran_deleted     | **Low**    | Performance |
| 9   | Average inventory = current        | **Low**    | Accuracy    |

---

## 10. Dashboard vs Agent — Number Divergence Analysis

The inventory dashboard and the AI agent both query the same Redshift database but produce different numbers because they use different SQL, different date ranges, different valuation methods, and different item populations.

### 10.1 The Two Data Paths

```
PATH A: DASHBOARD (inventory page)
  InventoryView.tsx → useSlowMovingInventory() → raw SQL → POST /api/redshift/query → Redshift

PATH B: AGENT (chat)
  User question → LLM picks reportType="inventory_valuation" → query-builder.ts → POST /api/redshift/query → Redshift
```

Both hit the same Redshift endpoint and the same underlying tables. The divergence is in the SQL they generate.

### 10.2 Five Reasons The Numbers Differ

#### Reason 1: Different default date ranges (CRITICAL)

|                       | Dashboard                                       | Agent                                       |
| --------------------- | ----------------------------------------------- | ------------------------------------------- |
| Default period        | `CURRENT_DATE - INTERVAL '12 months'` (rolling) | Last calendar year (hardcoded)              |
| Code location         | `useInventoryData.ts:394`                       | `query-builder.ts:86` + `schema.ts:207-217` |
| If today = 2026-02-26 | Queries **2025-02-26 → 2026-02-26**             | Queries **2025-01-01 → 2025-12-31**         |

Dashboard uses a rolling 12-month window. Agent uses a fixed calendar year. They overlap but don't match.

Agent hardcoding at `schema.ts:207-208`:

```typescript
.describe(
  `Start date ... Otherwise, default to start of last year: ${new Date().getFullYear() - 1}-01-01.`
)
```

And `query-builder.ts:85-86`:

```typescript
// Default: last calendar year
return { startDate: `${year - 1}-01-01`, endDate: `${year - 1}-12-31` }
```

#### Reason 2: Different valuation basis

|                   | Dashboard                         | Agent                                              |
| ----------------- | --------------------------------- | -------------------------------------------------- |
| Value calculation | `item.inventory × item.unit_cost` | `SUM(cost_amount_actual)` from `item_ledger_entry` |
| Source table      | `item` (master data snapshot)     | `item_ledger_entry` (transaction accumulation)     |
| Code location     | `useInventoryData.ts:416`         | `query-builder.ts:546,558-564`                     |

`item.unit_cost` is the ERP's current cost field. `cost_amount_actual` is the actual cost recorded on each historical ledger entry. If cost changed over time, these diverge.

#### Reason 3: Different item populations

|               | Dashboard                     | Agent                                                     |
| ------------- | ----------------------------- | --------------------------------------------------------- |
| Filter        | `WHERE item.inventory > 0`    | `HAVING SUM(ABS(quantity)) > 0` in period                 |
| Effect        | Only items currently in stock | Items with activity in the period (even if stock = 0 now) |
| Code location | `useInventoryData.ts:431`     | `query-builder.ts:567`                                    |

#### Reason 4: Agent has no slow-moving report

The agent only has `inventory_valuation` (opening → changes → closing). It has no turnover ratio, no days-since-last-sale, no risk classification. When a user asks about slow-moving inventory, the agent improvises from the valuation report — not using the same logic as the dashboard.

#### Reason 5: LEFT JOIN + revenue filtering gap

Neither path computes actual revenue (selling price × qty). Dashboard uses unit quantity sold. Agent uses `cost_amount_actual`. If a user asks "items below 1M revenue", neither can answer correctly. Adding a revenue filter on a LEFT JOIN without COALESCE silently drops all zero-sale items because `NULL < 1000000` evaluates to `NULL`, not `TRUE`.

### 10.3 Which Source Gives The Right Answer?

| Question                             | Trust         | Why                                                                     |
| ------------------------------------ | ------------- | ----------------------------------------------------------------------- |
| Current inventory value              | **Dashboard** | Reads `item.inventory × unit_cost` — ERP's current truth                |
| How inventory flowed during a period | **Agent**     | Reconstructs opening→increases→decreases→closing from full ledger       |
| Which items are slow-moving          | **Dashboard** | Only source that computes turnover ratio and days-since-last-sale       |
| Historical valuation (past date)     | **Agent**     | `closing_value` from ledger accumulation; dashboard can't do historical |
| Period-specific revenue by item      | **Agent**     | `sales_by_item` report queries `sales_invoice_line` with date range     |

---

## 11. Blast Radius Analysis — What Breaks If We Touch Shared Code

Before implementing fixes, we must understand what shared code each fix touches and whether it affects other working queries (P&L, balance sheet, cash flow, etc.).

### 11.1 Shared Code Dependency Map

```
resolveDateRange() ← called by ALL 12 report types:
  ├── trial_balance       │
  ├── profit_loss         │  Changing the default here
  ├── balance_sheet       │  breaks ALL of these.
  ├── cash_flow           │  A "rolling 12 months" default
  ├── aged_receivables    │  is nonsensical for a
  ├── aged_payables       │  point-in-time balance sheet.
  ├── sales_by_customer   │
  ├── purchases_by_vendor │
  ├── sales_by_item       │
  ├── purchases_by_item   │
  ├── inventory_valuation │
  └── monthly_pnl_trend   │

schema.ts startDate/endDate .describe() ← read by LLM for ALL queries
  └── Changing "default to last year" affects every query type

period enum ← available to LLM for ALL queries
  └── Adding values risks LLM picking wrong period for non-inventory queries

/api/redshift/query route ← called by 7 frontend hook files:
  ├── useInventoryData.ts
  ├── useCashFlowData.ts
  ├── useWarehousePnLStatement.ts
  ├── useWarehouseData.ts
  ├── useCustomerInsights.ts
  ├── useVendorInsights.ts
  └── EntityExportDropdown.tsx

executeQuery() in client.ts ← called by:
  ├── handlers.ts (BC tool)
  ├── route.ts (query endpoint)
  └── validate-warehouse-data.ts (script)
```

### 11.2 What WILL break vs What WON'T

| Change                                    | Breaks other queries?     | Why                                                         |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| Change `resolveDateRange()` default       | **YES — all 12 reports**  | P&L, BS, CF all use it                                      |
| Change `schema.ts` date descriptions      | **YES — all LLM queries** | LLM uses new default for everything                         |
| Add vague period enum value               | **RISKY**                 | LLM may pick it for non-inventory queries                   |
| Modify SQL in `useInventoryData.ts` hooks | **NO**                    | Isolated — only inventory page uses them                    |
| Add `slow_moving_inventory` reportType    | **NO**                    | Additive — new case in switch, doesn't touch existing cases |
| Add optional params to `executeQuery()`   | **NO**                    | Backward-compatible if params are optional                  |
| Change `SlowMovingInventoryDonut.tsx`     | **NO**                    | Only used by InventoryView                                  |

### 11.3 The Dashboard hooks are isolated from the Agent

```
Dashboard path:  useInventoryData.ts → builds own SQL → /api/redshift/query → Redshift
Agent path:      schema.ts → LLM → query-builder.ts → resolveDateRange() → handlers.ts → Redshift
```

The dashboard hooks do NOT use `resolveDateRange()`, do NOT use `schema.ts`, and do NOT use the period enum. They build SQL strings directly with their own hardcoded date logic (`CURRENT_DATE - INTERVAL '12 months'`). So fixing dashboard hooks is always safe.

---

## 12. Complete Fix List — Isolation-First Approach

Fixes are designed to NEVER touch shared defaults. Inventory-specific changes only. Each fix is tagged with its blast radius.

### FIX 1 — Add `slow_moving_inventory` report to agent with its OWN date default [HIGH / Agent]

**Problem:** Agent has no slow-moving report AND uses a different date default than the dashboard.

**Blast radius:** NONE — adds a new `case` in the switch, doesn't touch existing cases or `resolveDateRange()`.

**Files to change:**

- `src/ai/tools/business-central-data/schema.ts` — add `'slow_moving_inventory'` to `reportType` enum with explicit description
- `src/ai/tools/business-central-data/query-builder.ts` — add new `case 'slow_moving_inventory':` block

**Critical design: the new case handles its own date range internally, NOT via `resolveDateRange()`:**

```typescript
case 'slow_moving_inventory': {
  // Inventory-specific default: rolling 12 months (matches dashboard)
  // Does NOT call resolveDateRange() — avoids changing shared default
  const invDateRange = (input.startDate && input.endDate)
    ? { startDate: input.startDate, endDate: input.endDate }
    : input.period
      ? resolveDateRange(input)  // user explicitly chose a period, respect it
      : {
          startDate: fmt(new Date(Date.now() - 365 * 24*60*60*1000)),
          endDate: fmt(new Date())
        }
  // Use same SQL as useSlowMovingInventory dashboard hook
  return { sql: `...`, description: `Slow Moving Inventory for ${invDateRange.startDate} to ${invDateRange.endDate}` }
}
```

**Schema description must be specific to prevent LLM confusion:**

```typescript
'slow_moving_inventory: items with low turnover ratio and days since last sale — ' +
  'use ONLY for slow-moving, dead-stock, or inventory-aging questions. ' +
  'Defaults to rolling 12 months if no period specified. ' +
  'Do NOT use for revenue, P&L, or valuation questions.'
```

**What stays untouched:**

- `resolveDateRange()` default (last calendar year) — unchanged, P&L/BS/CF unaffected
- `schema.ts` `startDate`/`endDate` descriptions — unchanged, LLM behavior for other queries unaffected
- `period` enum — unchanged, no new values added

### FIX 2 — Integer division on turnover_ratio [HIGH / Dashboard]

**Problem:** `period_sales_qty / inventory` is integer division in Redshift. `3 / 10 = 0`.

**Blast radius:** NONE — only changes SQL inside `useSlowMovingInventory()` hook. No other hook, page, or agent code calls this.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:421` and `:435`

**Change:**

```sql
-- FROM (line 421, SELECT):
THEN COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
-- TO:
THEN CAST(COALESCE(ps.period_sales_qty, 0) AS FLOAT) / NULLIF(COALESCE(i.inventory, 0), 0)

-- FROM (line 435, ORDER BY):
ELSE COALESCE(ps.period_sales_qty, 0) / COALESCE(i.inventory, 0)
-- TO:
ELSE CAST(COALESCE(ps.period_sales_qty, 0) AS FLOAT) / NULLIF(COALESCE(i.inventory, 0), 0)
```

### FIX 3 — LIMIT 20 corrupts summary totals [HIGH / Dashboard]

**Problem:** Summary computed from only 20 returned rows, not full dataset.

**Blast radius:** NONE — only changes SQL inside `useSlowMovingInventory()` and its client-side summary logic. Column additions are backward-compatible (extra columns don't break existing destructuring).

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:411-473`

**Change:** Add window functions to the SELECT (before LIMIT):

```sql
  COUNT(*) OVER() AS total_matching_items,
  SUM(COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0)) OVER() AS total_matching_value,
  SUM(CASE WHEN COALESCE(ps.period_sales_qty, 0) = 0 THEN 1 ELSE 0 END) OVER() AS total_zero_sales_count,
  SUM(CASE WHEN COALESCE(ps.period_sales_qty, 0) = 0
    THEN COALESCE(i.inventory, 0) * COALESCE(i.unit_cost, 0) ELSE 0 END) OVER() AS total_zero_sales_value
```

Then use these in the client-side summary instead of re-aggregating the limited rows:

```typescript
const summary = {
  totalItems: items[0]?.total_matching_items ?? items.length,
  totalValue: items[0]?.total_matching_value ?? totalSlowMovingValue,
  zeroSalesCount: items[0]?.total_zero_sales_count ?? zeroSalesItems.length,
  zeroSalesValue: items[0]?.total_zero_sales_value ?? zeroSalesValue,
}
```

### FIX 4 — `last_sale_date` scoped to period misclassifies items [MEDIUM / Dashboard]

**Problem:** Items last sold 14 months ago show as "No Sales" instead of "Critical".

**Blast radius:** NONE — only changes SQL inside `useSlowMovingInventory()`.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:398-427`

**Change:** Add a second CTE for global last sale date (no date filter):

```sql
WITH period_sales AS (
  -- existing CTE, unchanged
  ...
),
global_last_sale AS (
  SELECT item_no, company_id, MAX(posting_date) AS last_sale_date
  FROM {schema}.item_ledger_entry
  WHERE entry_type = 'Sale'
    AND COALESCE(_fivetran_deleted, false) = false
  GROUP BY item_no, company_id
)
SELECT
  ...,
  CASE
    WHEN gls.last_sale_date IS NULL THEN NULL
    ELSE DATEDIFF(day, gls.last_sale_date, CURRENT_DATE)
  END AS days_since_last_sale
FROM {schema}.item i
LEFT JOIN period_sales ps ON i.no = ps.item_no AND i.company_id = ps.company_id
LEFT JOIN global_last_sale gls ON i.no = gls.item_no AND i.company_id = gls.company_id
```

### FIX 5 — Add revenue computation for filtering [MEDIUM / Dashboard]

**Problem:** Can't filter "items below 1M revenue". LEFT JOIN breaks without COALESCE.

**Blast radius:** NONE — adds a column to the existing `period_sales` CTE inside `useSlowMovingInventory()`. Existing columns unchanged.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:398-409`

**Change:** Add `cost_amount_actual` aggregation to existing CTE:

```sql
COALESCE(SUM(CASE WHEN entry_type = 'Sale' THEN ABS(cost_amount_actual) ELSE 0 END), 0) AS period_sales_value,
```

When filtering, always wrap in COALESCE:

```sql
WHERE COALESCE(ps.period_sales_value, 0) < 1000000
```

### FIX 6 — `item.inventory` snapshot vs historical period mismatch [MEDIUM / Dashboard]

**Problem:** When user selects "Last Year", turnover compares today's inventory against last year's sales.

**Blast radius:** NONE — only changes SQL inside `useSlowMovingInventory()`.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:414`

**Change:** Add period-end inventory to `period_sales` CTE:

```sql
-- Inside period_sales CTE (computed from ALL ledger entries up to endDate, not just the period):
-- This requires a separate CTE or correlated subquery since period_sales is date-filtered
```

Use `period_end_inventory` instead of `item.inventory` for turnover when a historical period is selected. When period is current (no custom dateRange), continue using `item.inventory`.

### FIX 7 — SQL string interpolation [MEDIUM / Dashboard]

**Problem:** Date strings interpolated directly into SQL.

**Blast radius:** LOW if using client-side regex validation. MEDIUM if changing `executeQuery()` signature (but safe if params are optional).

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:393`

**Safest change:** Add client-side validation before interpolation:

```typescript
function safeDateParam(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format')
  return date
}
```

This avoids touching `executeQuery()` or `client.ts` which are shared by all hooks.

### FIX 8 — `useInventoryTurnover` uses current inventory as average [LOW / Dashboard]

**Problem:** `average_inventory = current_inventory` instead of `(opening + closing) / 2`.

**Blast radius:** NONE — only changes SQL inside `useInventoryTurnover()`. Only consumed by `InventoryView.tsx`.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:549-583`

### FIX 9 — Add aging buckets to donut chart [LOW / Dashboard]

**Problem:** Donut only shows 2 categories (No Sales vs Low Turnover).

**Blast radius:** NONE — only changes `SlowMovingInventoryDonut.tsx`. Only consumed by `InventoryView.tsx`.

**File:** `src/app/(main)/bc/inventory/components/SlowMovingInventoryDonut.tsx:71-96`

### FIX 10 — Add ABC / Pareto classification [LOW / Dashboard]

**Problem:** All slow-moving items treated equally regardless of value.

**Blast radius:** NONE — adds a column to `useSlowMovingInventory()` SQL. Extra columns don't break existing consumers.

**File:** `src/app/(main)/bc/inventory/hooks/useInventoryData.ts:411`

### FIX 11 — Add partial index for performance [LOW / Redshift]

**Blast radius:** NONE — DDL-only, doesn't change application code.

---

### Fix Priority Summary

| #   | Fix                                                     | Severity   | Blast Radius                                         | Files                           |
| --- | ------------------------------------------------------- | ---------- | ---------------------------------------------------- | ------------------------------- |
| 1   | Add `slow_moving_inventory` to agent (own date default) | **High**   | **None** — new case block, doesn't touch shared code | `schema.ts`, `query-builder.ts` |
| 2   | Integer division on turnover_ratio                      | **High**   | **None** — isolated hook                             | `useInventoryData.ts`           |
| 3   | LIMIT 20 corrupts summary                               | **High**   | **None** — isolated hook                             | `useInventoryData.ts`           |
| 4   | last_sale_date scoped to period                         | **Medium** | **None** — isolated hook                             | `useInventoryData.ts`           |
| 5   | Add revenue computation                                 | **Medium** | **None** — adds column to existing CTE               | `useInventoryData.ts`           |
| 6   | Snapshot vs historical mismatch                         | **Medium** | **None** — isolated hook                             | `useInventoryData.ts`           |
| 7   | SQL string interpolation                                | **Medium** | **Low** — client-side validation only                | `useInventoryData.ts`           |
| 8   | Average inventory = current                             | **Low**    | **None** — isolated hook                             | `useInventoryData.ts`           |
| 9   | Aging buckets in donut                                  | **Low**    | **None** — isolated component                        | `SlowMovingInventoryDonut.tsx`  |
| 10  | ABC classification                                      | **Low**    | **None** — adds column                               | `useInventoryData.ts`           |
| 11  | Partial index                                           | **Low**    | **None** — DDL only                                  | Redshift migration              |

**Key principle:** Every fix has NONE or LOW blast radius. No fix touches `resolveDateRange()` default, `schema.ts` global descriptions, or the shared `period` enum. P&L, balance sheet, cash flow, and all other queries remain completely unaffected.

---

## 13. Redshift Column Discovery Results (2026-02-26)

Ran `scripts/discover-inventory-columns.ts` against `bc_aquaculture` schema to determine what inventory data actually exists in Redshift.

### 13.1 Tables Synced vs Missing

**8 of 26 inventory-related tables exist in Redshift:**

| Status     | Table                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synced     | `item`, `item_ledger_entry`, `item_category`, `item_variant`, `item_budget_entry`, `location`, `inventory_posting_group`, `unit_of_measure`                                                                                                                                                                                                                               |
| NOT synced | `item_vendor`, `item_cross_reference`, `item_tracking_code`, `lot_no_information`, `serial_no_information`, `reservation_entry`, `planning_component`, `requisition_line`, `warehouse_entry`, `warehouse_receipt_line`, `value_entry`, `stockkeeping_unit`, `transfer_header`, `transfer_line`, `production_order`, `prod_order_line`, `assembly_header`, `assembly_line` |

### 13.2 `item` Table — 225 Columns (ALL wanted fields exist structurally)

**BUT: Key fields are 0% populated (columns exist, data is empty/zero in source BC)**

| Field                   | Exists in Redshift | Data Populated | Status                                          |
| ----------------------- | ------------------ | -------------- | ----------------------------------------------- |
| `reorder_point`         | Yes                | **0%**         | Column exists but no item has a value set in BC |
| `vendor_no`             | Yes                | **0%**         | Column exists but empty                         |
| `safety_stock_quantity` | Yes                | **0%**         | Column exists but empty                         |
| `maximum_inventory`     | Yes                | **0%**         | Column exists but empty                         |
| `lead_time_calculation` | Yes                | **0%**         | Column exists but empty                         |
| `unit_price`            | Yes                | **0%**         | Column exists but empty                         |
| `standard_cost`         | Yes                | **0%**         | Column exists but empty                         |
| `inventory`             | Yes                | **Yes**        | Currently used by dashboard                     |
| `unit_cost`             | Yes                | **Yes**        | Currently used by dashboard                     |
| `base_unit_of_measure`  | Yes                | **Yes**        | Available for use                               |
| `shelf_no`              | Yes                | Unknown        | Needs data check                                |
| `item_tracking_code`    | Yes                | Unknown        | Needs data check                                |
| `item_category_code`    | Yes                | Unknown        | Needs data check                                |
| `costing_method`        | Yes                | Unknown        | Needs data check                                |
| `last_direct_cost`      | Yes                | Unknown        | Needs data check                                |

### 13.3 `item_ledger_entry` Table — 102 Columns (ALL wanted fields exist)

**Rich data — most fields are fully populated:**

| Field                | Exists in Redshift | Data Populated | Status                                   |
| -------------------- | ------------------ | -------------- | ---------------------------------------- |
| `expiration_date`    | Yes                | **100%**       | Ready to use NOW                         |
| `lot_no`             | Yes                | **100%**       | Ready to use NOW                         |
| `remaining_quantity` | Yes                | **100%**       | Ready to use NOW                         |
| `location_code`      | Yes                | **100%**       | Ready to use NOW                         |
| `serial_no`          | Yes                | **0%**         | Column exists but not used in BC         |
| `entry_type`         | Yes                | **Yes**        | Already used by slow-moving query        |
| `quantity`           | Yes                | **Yes**        | Already used by slow-moving query        |
| `cost_amount_actual` | Yes                | **Yes**        | Available (used by agent, not dashboard) |
| `posting_date`       | Yes                | **Yes**        | Already used by slow-moving query        |
| `document_no`        | Yes                | **Yes**        | Available for traceability               |
| `source_type`        | Yes                | Unknown        | Needs data check                         |
| `open`               | Yes                | Unknown        | Needs data check                         |
| `warranty_date`      | Yes                | Unknown        | Needs data check                         |

### 13.4 What This Means — Build vs Wait

#### CAN BUILD NOW (data is populated in Redshift):

| Feature                            | Data Source                             | Fields Used                           |
| ---------------------------------- | --------------------------------------- | ------------------------------------- |
| Expired product alerts             | `item_ledger_entry`                     | `expiration_date` (100% populated)    |
| Lot tracking / traceability        | `item_ledger_entry`                     | `lot_no` (100% populated)             |
| Remaining quantity analysis        | `item_ledger_entry`                     | `remaining_quantity` (100% populated) |
| Location-based inventory breakdown | `item_ledger_entry`                     | `location_code` (100% populated)      |
| ROI on product                     | `sales_invoice_line` + `purch_inv_line` | Already available                     |
| Demand trends / forecasting        | `sales_invoice_line`                    | `posting_date` already available      |
| Cost amount analysis               | `item_ledger_entry`                     | `cost_amount_actual` (populated)      |

#### CANNOT BUILD (source BC data not entered — NOT a code or Fivetran problem):

| Feature                                | Missing Data                                | Root Cause                                      |
| -------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Reorder point alerts                   | `item.reorder_point` = 0% populated         | Business hasn't configured reorder points in BC |
| Safety stock alerts                    | `item.safety_stock_quantity` = 0% populated | Business hasn't set safety stock levels in BC   |
| Vendor-item mapping (from item master) | `item.vendor_no` = 0% populated             | Business hasn't assigned vendors to items in BC |
| Lead time analysis                     | `item.lead_time_calculation` = 0% populated | Business hasn't entered lead times in BC        |
| Max inventory alerts                   | `item.maximum_inventory` = 0% populated     | Business hasn't set max inventory in BC         |

#### CANNOT BUILD (tables not synced by Fivetran):

| Feature                     | Missing Table                                    | Action Required                  |
| --------------------------- | ------------------------------------------------ | -------------------------------- |
| Vendor-item cross-reference | `item_vendor` table not synced                   | Add to Fivetran connector config |
| Serial number tracking      | `serial_no_information` not synced               | Add to Fivetran + populate in BC |
| Warehouse movements         | `warehouse_entry` not synced                     | Add to Fivetran connector config |
| Production order tracking   | `production_order`, `prod_order_line` not synced | Add to Fivetran connector config |
| Transfer tracking           | `transfer_header`, `transfer_line` not synced    | Add to Fivetran connector config |
| Value entry details         | `value_entry` not synced                         | Add to Fivetran connector config |

### 13.5 Recommended Priority

1. **Immediate** — Build expired product alerts, lot tracking, location breakdown (data is there, just unused)
2. **Short-term** — Ask business to populate `reorder_point`, `safety_stock_quantity`, `vendor_no` in BC for at least high-value items
3. **Medium-term** — Add `item_vendor`, `value_entry`, `warehouse_entry` to Fivetran sync
4. **Derive where possible** — Vendor-item mapping can be derived from `purch_inv_line` (vendor_no + item_no from purchase invoices) even without `item_vendor` table

### 13.6 Discovery Script

**Location:** `scripts/discover-inventory-columns.ts`

**Run command:** `npx tsx scripts/discover-inventory-columns.ts [schema_name]`

**Default schema:** `bc_aquaculture`

Re-run this script periodically to check if the business has started populating the empty fields in BC.
