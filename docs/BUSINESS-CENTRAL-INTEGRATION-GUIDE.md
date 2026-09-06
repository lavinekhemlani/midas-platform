# Midas CFO Data Warehouse & Integration Architecture

## Vision & Goals

Build a **multi-entity, cross-source analytics platform** that enables:
- **Business Central** as the primary accounting/ERP data source
- **Multi-entity analysis** - compare companies within groups/portfolios
- **Cross-source analytics** - correlate Shopify sales, Meta ad spend, Amazon revenue with BC financials
- **Group-level consolidation** - holding company views across subsidiaries
- **Historical trend analysis** - 12+ months of data without API rate limits

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Source Priority](#data-source-priority)
3. [Multi-Tenancy & Entity Model](#multi-tenancy--entity-model)
4. [Phase 1: Business Central Foundation](#phase-1-business-central-foundation)
5. [Phase 2: Multi-Source Integration](#phase-2-multi-source-integration)
6. [Phase 3: Cross-Entity Analytics](#phase-3-cross-entity-analytics)
7. [Phase 4: Advanced Features](#phase-4-advanced-features)
8. [Technical Implementation Details](#technical-implementation-details)
9. [dbt Transformation Layer](#dbt-transformation-layer)
10. [API vs Warehouse Decision Matrix](#api-vs-warehouse-decision-matrix)
11. [Existing Codebase Patterns](#existing-codebase-patterns)
12. [File Reference Map](#file-reference-map)
13. [External Resources](#external-resources)

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                        │
├─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────┤
│  Business       │    Shopify      │    Meta Ads     │     Amazon      │  Other  │
│  Central        │    Orders       │    Campaigns    │     Seller      │  (QB,   │
│  (PRIMARY)      │    Products     │    Ad Insights  │     Sales       │  Xero)  │
│                 │    Customers    │    Conversions  │     Inventory   │         │
└────────┬────────┴────────┬────────┴────────┬────────┴────────┬────────┴────┬────┘
         │                 │                 │                 │             │
         └─────────────────┴─────────────────┴─────────────────┴─────────────┘
                                            │
                                            ▼
                           ┌────────────────────────────────┐
                           │          FIVETRAN              │
                           │     (Managed ETL Pipeline)     │
                           │                                │
                           │  • Per-org connectors          │
                           │  • Automatic schema detection  │
                           │  • Incremental sync            │
                           │  • Error handling & retry      │
                           └───────────────┬────────────────┘
                                           │
                                           ▼
                           ┌────────────────────────────────┐
                           │      REDSHIFT SERVERLESS       │
                           │      (Data Warehouse)          │
                           │                                │
                           │  RAW LAYER (Fivetran schemas)  │
                           │  ├── bc_raw.customers          │
                           │  ├── bc_raw.gl_entries         │
                           │  ├── shopify_raw.orders        │
                           │  ├── meta_raw.ad_insights      │
                           │  └── amazon_raw.orders         │
                           └───────────────┬────────────────┘
                                           │
                                           ▼
                           ┌────────────────────────────────┐
                           │            dbt                 │
                           │    (Transform & Model)         │
                           │                                │
                           │  STAGING (cleaned + org_id)    │
                           │  ├── stg_bc_customers          │
                           │  ├── stg_bc_gl_entries         │
                           │  ├── stg_shopify_orders        │
                           │  └── stg_meta_ad_insights      │
                           │                                │
                           │  INTERMEDIATE (business logic) │
                           │  ├── int_daily_revenue         │
                           │  ├── int_daily_ad_spend        │
                           │  └── int_customer_cohorts      │
                           │                                │
                           │  ANALYTICS (final tables)      │
                           │  ├── fct_revenue               │
                           │  ├── fct_expenses              │
                           │  ├── fct_ad_performance        │
                           │  ├── dim_accounts              │
                           │  ├── dim_customers             │
                           │  ├── rpt_profit_loss           │
                           │  ├── rpt_balance_sheet         │
                           │  └── rpt_consolidated_pnl      │
                           └───────────────┬────────────────┘
                                           │
                                           ▼
                           ┌────────────────────────────────┐
                           │      REDSHIFT DATA API         │
                           │    (Secure Query Interface)    │
                           │                                │
                           │  • IAM authentication          │
                           │  • No IP whitelist needed      │
                           │  • Works from Vercel/local     │
                           └───────────────┬────────────────┘
                                           │
                                           ▼
                           ┌────────────────────────────────┐
                           │        MIDAS CFO APP           │
                           │       (Next.js + API)          │
                           │                                │
                           │  /api/warehouse/*              │
                           │  • Org-based filtering         │
                           │  • Group-level aggregation     │
                           │  • Cross-source joins          │
                           │                                │
                           │  Frontend Views                │
                           │  • Financial reports           │
                           │  • Multi-entity dashboards     │
                           │  • Ad spend attribution        │
                           │  • Revenue analytics           │
                           └────────────────────────────────┘
```

### Why Warehouse-First (Not API-First)

| Requirement | API Calls | Warehouse |
|-------------|-----------|-----------|
| Single company, single source | ✅ Works | ⚠️ Overkill |
| **Multi-entity comparison** | ❌ Impossible | ✅ SQL JOIN |
| **Cross-source analytics** | ❌ Impossible | ✅ SQL JOIN |
| **Group consolidation** | ❌ Very complex | ✅ Simple |
| Historical data (12+ months) | ⚠️ Rate limits | ✅ All available |
| Ad spend → Revenue attribution | ❌ Cannot join | ✅ Native |
| Real-time single record | ✅ Best | ⚠️ 5-15 min delay |

**Your goals require warehouse. API is supplementary for real-time needs.**

---

## Data Source Priority

### Priority 1: Business Central (Foundation)
```
┌─────────────────────────────────────────────────────────────────┐
│  BUSINESS CENTRAL - Core Financial Data                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chart of Accounts          General Ledger Entries              │
│  ├── Assets                 ├── All transactions                │
│  ├── Liabilities            ├── Posting dates                   │
│  ├── Equity                 ├── Debit/Credit amounts            │
│  ├── Revenue                └── Account mappings                │
│  ├── COGS                                                       │
│  └── Expenses               Financial Reports (derived)         │
│                             ├── Profit & Loss                   │
│  Customers & Vendors        ├── Balance Sheet                   │
│  ├── Master data            ├── Cash Flow                       │
│  ├── Balances               └── Trial Balance                   │
│  └── Aging                                                      │
│                             Operational Data                    │
│  Sales & Purchase Orders    ├── Inventory                       │
│  ├── Order headers          ├── Items                           │
│  ├── Line items             └── Dimensions                      │
│  └── Fulfillment status                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why BC First:**
- Contains the **source of truth** for financial data
- All other sources (Shopify, Meta, Amazon) flow INTO BC eventually
- Financial reports (P&L, Balance Sheet) come from BC's GL
- Most complex integration (sets the pattern for others)

### Priority 2: Shopify (Revenue Detail)
```
┌─────────────────────────────────────────────────────────────────┐
│  SHOPIFY - E-commerce Revenue                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Orders                     Products                            │
│  ├── Order ID, dates        ├── SKU, title                      │
│  ├── Customer info          ├── Variants                        │
│  ├── Line items             ├── Inventory                       │
│  ├── Discounts              └── Collections                     │
│  ├── Shipping                                                   │
│  └── Financial status       Customers                           │
│                             ├── Customer ID                     │
│  Transactions               ├── Email, name                     │
│  ├── Payments               ├── Order history                   │
│  ├── Refunds                └── Lifetime value                  │
│  └── Payouts                                                    │
│                                                                  │
│  USE CASES:                                                     │
│  • Revenue by product/category                                  │
│  • Customer acquisition cost (with Meta)                        │
│  • Cohort analysis                                              │
│  • Order-level profitability                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Priority 3: Meta Ads (Marketing Spend)
```
┌─────────────────────────────────────────────────────────────────┐
│  META ADS - Marketing Performance                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Campaigns                  Ad Insights (daily)                 │
│  ├── Campaign ID, name      ├── Date                            │
│  ├── Objective              ├── Spend                           │
│  ├── Status                 ├── Impressions                     │
│  └── Budget                 ├── Clicks                          │
│                             ├── Conversions                     │
│  Ad Sets                    ├── Purchase value                  │
│  ├── Targeting              └── ROAS                            │
│  ├── Placement                                                  │
│  └── Schedule               Actions                             │
│                             ├── Action types                    │
│  Ads                        ├── Action values                   │
│  ├── Creative               └── Conversion windows              │
│  ├── Copy                                                       │
│  └── URLs                                                       │
│                                                                  │
│  USE CASES:                                                     │
│  • Ad spend vs BC revenue attribution                           │
│  • CAC calculation (with Shopify)                               │
│  • ROAS by campaign                                             │
│  • Marketing efficiency trends                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Priority 4: Amazon (Multi-Channel)
```
┌─────────────────────────────────────────────────────────────────┐
│  AMAZON SELLER - Marketplace Revenue                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Orders                     Inventory                           │
│  ├── Order ID               ├── FBA inventory                   │
│  ├── Purchase date          ├── Stock levels                    │
│  ├── Item details           └── Restock recommendations         │
│  ├── Shipping                                                   │
│  └── Status                 Settlements                         │
│                             ├── Financial settlements           │
│  Returns                    ├── Fees breakdown                  │
│  ├── Return reasons         └── Net proceeds                    │
│  ├── Refund amounts                                             │
│  └── Return dates           Advertising                         │
│                             ├── Sponsored Products              │
│                             ├── Sponsored Brands                │
│                             └── Campaign performance            │
│                                                                  │
│  USE CASES:                                                     │
│  • Multi-channel revenue (Shopify + Amazon)                     │
│  • Channel profitability comparison                             │
│  • Amazon fees analysis                                         │
│  • Inventory planning                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenancy & Entity Model

### Entity Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENTITY HIERARCHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  HOLDING COMPANY / GROUP                                         │
│  └── org_id: "group_acme_holdings"                              │
│      │                                                          │
│      ├── SUBSIDIARY 1: Acme Retail                              │
│      │   └── org_id: "org_acme_retail"                          │
│      │       ├── BC Tenant: acme-retail.bc.dynamics.com         │
│      │       ├── Shopify Store: acme-retail.myshopify.com       │
│      │       └── Meta Ad Account: 123456789                     │
│      │                                                          │
│      ├── SUBSIDIARY 2: Acme Wholesale                           │
│      │   └── org_id: "org_acme_wholesale"                       │
│      │       ├── BC Tenant: acme-wholesale.bc.dynamics.com      │
│      │       └── Amazon Seller: AXXXXXX                         │
│      │                                                          │
│      └── SUBSIDIARY 3: Acme Digital                             │
│          └── org_id: "org_acme_digital"                         │
│              ├── BC Tenant: acme-digital.bc.dynamics.com        │
│              └── Shopify Store: acme-digital.myshopify.com      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema for Multi-Entity

```sql
-- ORGANIZATIONS TABLE (DynamoDB - existing)
-- PK: org_id, SK: PROFILE
{
  "org_id": "org_acme_retail",
  "name": "Acme Retail Inc.",
  "parent_org_id": "group_acme_holdings",  -- For group rollups
  "entity_type": "subsidiary",              -- "group" | "subsidiary" | "standalone"
  "providers": {
    "businesscentral": {
      "tenant_id": "acme-retail",
      "environment": "production",
      "company_id": "...",
      "credentials": { ... }
    },
    "shopify": {
      "store_domain": "acme-retail.myshopify.com",
      "credentials": { ... }
    },
    "meta_ads": {
      "ad_account_id": "123456789",
      "credentials": { ... }
    }
  },
  "warehouse": {
    "fivetran_connector_ids": {
      "businesscentral": "connector_abc123",
      "shopify": "connector_def456",
      "meta_ads": "connector_ghi789"
    },
    "schema_prefix": "acme_retail"  -- Used in Redshift
  }
}
```

### Redshift Schema Strategy

**Option A: Schema per Organization (Recommended for Isolation)**
```sql
-- Each org gets its own schema
acme_retail.bc_customers
acme_retail.bc_gl_entries
acme_retail.shopify_orders
acme_retail.meta_ad_insights

acme_wholesale.bc_customers
acme_wholesale.bc_gl_entries
acme_wholesale.amazon_orders

-- Analytics layer uses org_id for cross-org queries
analytics.fct_revenue  -- Contains org_id column
analytics.rpt_consolidated_pnl  -- Aggregates across orgs
```

**Option B: Shared Schema with org_id Column**
```sql
-- Single schema, all data mixed
warehouse.bc_customers (org_id, customer_id, name, ...)
warehouse.bc_gl_entries (org_id, entry_id, ...)
warehouse.shopify_orders (org_id, order_id, ...)

-- Every query must filter
SELECT * FROM warehouse.bc_customers WHERE org_id = 'acme_retail'
```

**Recommendation**: Use **Option A** (schema per org) for:
- Better data isolation
- Simpler Fivetran setup (one connector = one schema)
- Easier debugging
- Clear ownership

Then use **dbt** to create the analytics layer with `org_id` for cross-org queries.

---

## Phase 1: Business Central Foundation

### Timeline: Week 1-2

### Goals
1. Connect first BC tenant via Fivetran
2. Build financial reports from GL data
3. Establish multi-tenancy pattern
4. Create BC-specific dashboard

### Step 1.1: Fivetran BC Connector Setup

**Prerequisites:**
- Business Central tenant with API access
- Azure AD app registration (for OAuth)
- Fivetran destination (Redshift) configured

**Fivetran Configuration:**
```yaml
Connector: Microsoft Dynamics 365 Business Central
Destination Schema: bc_${org_id}  # e.g., bc_acme_retail
Tenant ID: From BC URL (e.g., "acme-retail")
Environment: "production" or "sandbox"
Sync Frequency: Every 6 hours (or as needed)

Tables to Sync:
  - accounts (Chart of Accounts)
  - generalLedgerEntries
  - customers
  - vendors
  - items
  - salesOrders
  - salesOrderLines
  - purchaseOrders
  - purchaseOrderLines
  - agedAccountsReceivable
  - agedAccountsPayable
  - dimensions
  - dimensionValues
```

### Step 1.2: dbt Models for BC

```
dbt_project/
├── dbt_project.yml
├── models/
│   ├── sources/
│   │   └── bc_sources.yml           # Source definitions
│   ├── staging/
│   │   ├── stg_bc_accounts.sql      # Chart of accounts
│   │   ├── stg_bc_gl_entries.sql    # General ledger
│   │   ├── stg_bc_customers.sql     # Customer master
│   │   └── stg_bc_vendors.sql       # Vendor master
│   ├── intermediate/
│   │   ├── int_bc_account_balances.sql  # Period balances
│   │   ├── int_bc_daily_revenue.sql     # Daily aggregates
│   │   └── int_bc_daily_expenses.sql    # Daily expenses
│   └── analytics/
│       ├── rpt_bc_profit_loss.sql       # P&L report
│       ├── rpt_bc_balance_sheet.sql     # Balance sheet
│       ├── rpt_bc_cash_flow.sql         # Cash flow
│       └── rpt_bc_trial_balance.sql     # Trial balance
└── macros/
    └── get_org_id.sql               # Org ID injection
```

**Example: stg_bc_gl_entries.sql**
```sql
{{ config(
    materialized='incremental',
    unique_key='gl_entry_id',
    schema='staging'
) }}

WITH source AS (
    SELECT * FROM {{ source('business_central', 'generalLedgerEntries') }}
    {% if is_incremental() %}
    WHERE _fivetran_synced > (SELECT MAX(_fivetran_synced) FROM {{ this }})
    {% endif %}
)

SELECT
    -- Organization context
    '{{ var("org_id") }}' AS org_id,

    -- Primary key
    id AS gl_entry_id,

    -- Foreign keys
    accountId AS account_id,

    -- Attributes
    postingDate AS posting_date,
    documentNumber AS document_number,
    documentType AS document_type,
    description,

    -- Amounts
    debitAmount AS debit_amount,
    creditAmount AS credit_amount,
    (creditAmount - debitAmount) AS net_amount,

    -- Metadata
    _fivetran_synced AS synced_at,
    CURRENT_TIMESTAMP AS dbt_updated_at

FROM source
```

**Example: rpt_bc_profit_loss.sql**
```sql
{{ config(
    materialized='table',
    schema='analytics'
) }}

WITH accounts AS (
    SELECT * FROM {{ ref('stg_bc_accounts') }}
    WHERE org_id = '{{ var("org_id") }}'
),

gl_entries AS (
    SELECT * FROM {{ ref('stg_bc_gl_entries') }}
    WHERE org_id = '{{ var("org_id") }}'
      AND posting_date >= '{{ var("start_date") }}'
      AND posting_date <= '{{ var("end_date") }}'
),

account_totals AS (
    SELECT
        a.org_id,
        a.account_id,
        a.account_number,
        a.account_name,
        a.account_type,
        a.account_category,
        COALESCE(SUM(g.net_amount), 0) AS total_amount
    FROM accounts a
    LEFT JOIN gl_entries g ON a.account_id = g.account_id
    GROUP BY 1, 2, 3, 4, 5, 6
),

categorized AS (
    SELECT
        org_id,
        account_type,
        account_category,
        account_number,
        account_name,
        total_amount,
        CASE
            WHEN account_type = 'Income' THEN 'revenue'
            WHEN account_type = 'Cost of Goods Sold' THEN 'cogs'
            WHEN account_type = 'Expense' THEN 'expenses'
            ELSE 'other'
        END AS report_section
    FROM account_totals
)

SELECT
    org_id,
    '{{ var("start_date") }}' AS start_date,
    '{{ var("end_date") }}' AS end_date,

    -- Revenue
    SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END) AS total_revenue,

    -- COGS
    SUM(CASE WHEN report_section = 'cogs' THEN total_amount ELSE 0 END) AS total_cogs,

    -- Gross Profit
    SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END) -
    SUM(CASE WHEN report_section = 'cogs' THEN total_amount ELSE 0 END) AS gross_profit,

    -- Operating Expenses
    SUM(CASE WHEN report_section = 'expenses' THEN total_amount ELSE 0 END) AS total_expenses,

    -- Net Income
    SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END) -
    SUM(CASE WHEN report_section = 'cogs' THEN total_amount ELSE 0 END) -
    SUM(CASE WHEN report_section = 'expenses' THEN total_amount ELSE 0 END) AS net_income,

    -- Margins
    CASE
        WHEN SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END) > 0
        THEN (SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END) -
              SUM(CASE WHEN report_section = 'cogs' THEN total_amount ELSE 0 END)) /
             SUM(CASE WHEN report_section = 'revenue' THEN total_amount ELSE 0 END)
        ELSE 0
    END AS gross_margin,

    CURRENT_TIMESTAMP AS generated_at

FROM categorized
GROUP BY org_id
```

### Step 1.3: API Routes for BC Data

**New File: `src/app/api/warehouse/bc/reports/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-utils'
import { executeQuery } from '@/lib/redshift/client'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const reportType = searchParams.get('type') || 'profit_loss'
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const orgId = user.organizationId

  // Build report query based on type
  let sql: string
  switch (reportType) {
    case 'profit_loss':
      sql = `
        SELECT * FROM analytics.rpt_bc_profit_loss
        WHERE org_id = '${orgId}'
          AND start_date = '${startDate}'
          AND end_date = '${endDate}'
      `
      break
    case 'balance_sheet':
      sql = `
        SELECT * FROM analytics.rpt_bc_balance_sheet
        WHERE org_id = '${orgId}'
          AND as_of_date = '${endDate}'
      `
      break
    // ... other report types
  }

  const result = await executeQuery(sql)

  return NextResponse.json({
    success: true,
    data: result.data[0],
    metadata: {
      org_id: orgId,
      report_type: reportType,
      generated_at: new Date().toISOString()
    }
  })
}
```

### Step 1.4: Update Frontend

**Update Report Hooks to Support Warehouse:**
```typescript
// src/hooks/useWarehouseReports.ts

export function useBCProfitLoss({ startDate, endDate, enabled = true }) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/warehouse/bc/reports?type=profit_loss&start_date=${startDate}&end_date=${endDate}` : null,
    fetcher
  )

  return {
    reportData: data?.data,
    isLoading,
    error,
    mutate
  }
}

export function useBCBalanceSheet({ asOfDate, enabled = true }) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? `/api/warehouse/bc/reports?type=balance_sheet&end_date=${asOfDate}` : null,
    fetcher
  )

  return {
    reportData: data?.data,
    isLoading,
    error,
    mutate
  }
}
```

### Step 1.5: BC OAuth for Real-Time (Optional)

For real-time data needs (not historical reports), implement direct BC API:

**New File: `src/lib/providers/businesscentral/auth.ts`**
```typescript
const BC_CLIENT_ID = process.env.BC_CLIENT_ID!
const BC_CLIENT_SECRET = process.env.BC_CLIENT_SECRET!

export const auth = {
  getLoginUrl(state: string, tenantId: string = 'common'): string {
    const params = new URLSearchParams({
      client_id: BC_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback`,
      response_mode: 'query',
      scope: 'https://api.businesscentral.dynamics.com/.default offline_access',
      state,
    })
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`
  },

  async handleCallback(code: string, tenantId: string): Promise<TokenSet> {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: BC_CLIENT_ID,
          client_secret: BC_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/providers/callback`,
          grant_type: 'authorization_code',
        }),
      }
    )
    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      createdAt: Date.now(),
    }
  },

  async refreshAccessToken(refreshToken: string, tenantId: string): Promise<TokenSet> {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: BC_CLIENT_ID,
          client_secret: BC_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      }
    )
    const data = await response.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      createdAt: Date.now(),
    }
  },
}
```

---

## Phase 2: Multi-Source Integration

### Timeline: Week 3-4

### Goals
1. Add Shopify connector
2. Add Meta Ads connector
3. Build cross-source metrics (CAC, ROAS)
4. Create unified revenue view

### Step 2.1: Fivetran Shopify Connector

```yaml
Connector: Shopify
Destination Schema: shopify_${org_id}
Store Domain: example.myshopify.com
Sync Frequency: Every 1 hour

Tables to Sync:
  - orders
  - order_line_items
  - customers
  - products
  - product_variants
  - transactions
  - refunds
  - inventory_levels
  - collections
```

### Step 2.2: Fivetran Meta Ads Connector

```yaml
Connector: Facebook Ads (Meta)
Destination Schema: meta_${org_id}
Ad Account ID: 123456789
Sync Frequency: Daily

Tables to Sync:
  - campaigns
  - ad_sets
  - ads
  - ad_insights  # Daily performance
  - actions      # Conversion events
```

### Step 2.3: Cross-Source dbt Models

**unified_daily_revenue.sql**
```sql
{{ config(
    materialized='table',
    schema='analytics'
) }}

-- Shopify Revenue
SELECT
    org_id,
    DATE(created_at) AS date,
    'shopify' AS channel,
    SUM(total_price) AS revenue,
    COUNT(DISTINCT id) AS order_count,
    COUNT(DISTINCT customer_id) AS customer_count
FROM {{ ref('stg_shopify_orders') }}
WHERE financial_status IN ('paid', 'partially_refunded')
GROUP BY 1, 2, 3

UNION ALL

-- Amazon Revenue (when added)
SELECT
    org_id,
    DATE(purchase_date) AS date,
    'amazon' AS channel,
    SUM(item_price) AS revenue,
    COUNT(DISTINCT order_id) AS order_count,
    COUNT(DISTINCT buyer_email) AS customer_count
FROM {{ ref('stg_amazon_orders') }}
GROUP BY 1, 2, 3

UNION ALL

-- BC Revenue (for non-ecommerce)
SELECT
    org_id,
    posting_date AS date,
    'direct_sales' AS channel,
    SUM(net_amount) AS revenue,
    NULL AS order_count,
    NULL AS customer_count
FROM {{ ref('stg_bc_gl_entries') }} g
JOIN {{ ref('stg_bc_accounts') }} a ON g.account_id = a.account_id
WHERE a.account_type = 'Income'
GROUP BY 1, 2, 3
```

**marketing_attribution.sql**
```sql
{{ config(
    materialized='table',
    schema='analytics'
) }}

WITH daily_spend AS (
    SELECT
        org_id,
        date_start AS date,
        SUM(spend) AS ad_spend,
        SUM(impressions) AS impressions,
        SUM(clicks) AS clicks,
        SUM(purchases) AS attributed_purchases,
        SUM(purchase_value) AS attributed_revenue
    FROM {{ ref('stg_meta_ad_insights') }}
    GROUP BY 1, 2
),

daily_revenue AS (
    SELECT
        org_id,
        date,
        SUM(revenue) AS total_revenue,
        SUM(order_count) AS total_orders,
        SUM(customer_count) AS new_customers
    FROM {{ ref('unified_daily_revenue') }}
    WHERE channel = 'shopify'  -- Or all channels
    GROUP BY 1, 2
)

SELECT
    r.org_id,
    r.date,

    -- Revenue
    r.total_revenue,
    r.total_orders,
    r.new_customers,

    -- Ad Spend
    COALESCE(s.ad_spend, 0) AS ad_spend,
    s.impressions,
    s.clicks,

    -- Attribution
    s.attributed_purchases,
    s.attributed_revenue,

    -- Calculated Metrics
    CASE
        WHEN COALESCE(s.ad_spend, 0) > 0
        THEN r.total_revenue / s.ad_spend
        ELSE NULL
    END AS roas,

    CASE
        WHEN COALESCE(r.new_customers, 0) > 0
        THEN s.ad_spend / r.new_customers
        ELSE NULL
    END AS cac,

    CASE
        WHEN COALESCE(s.clicks, 0) > 0
        THEN s.ad_spend / s.clicks
        ELSE NULL
    END AS cpc,

    CASE
        WHEN COALESCE(s.impressions, 0) > 0
        THEN (s.clicks::FLOAT / s.impressions) * 100
        ELSE NULL
    END AS ctr

FROM daily_revenue r
LEFT JOIN daily_spend s ON r.org_id = s.org_id AND r.date = s.date
```

### Step 2.4: API Routes for Cross-Source Data

**New File: `src/app/api/warehouse/analytics/route.ts`**
```typescript
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const metric = searchParams.get('metric')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const orgId = user.organizationId

  let sql: string
  switch (metric) {
    case 'revenue_by_channel':
      sql = `
        SELECT channel, SUM(revenue) as revenue, SUM(order_count) as orders
        FROM analytics.unified_daily_revenue
        WHERE org_id = '${orgId}'
          AND date BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY channel
        ORDER BY revenue DESC
      `
      break

    case 'marketing_performance':
      sql = `
        SELECT
          date,
          ad_spend,
          total_revenue,
          roas,
          cac,
          new_customers
        FROM analytics.marketing_attribution
        WHERE org_id = '${orgId}'
          AND date BETWEEN '${startDate}' AND '${endDate}'
        ORDER BY date
      `
      break

    case 'cac_trend':
      sql = `
        SELECT
          DATE_TRUNC('week', date) as week,
          SUM(ad_spend) as total_spend,
          SUM(new_customers) as total_customers,
          SUM(ad_spend) / NULLIF(SUM(new_customers), 0) as cac
        FROM analytics.marketing_attribution
        WHERE org_id = '${orgId}'
          AND date BETWEEN '${startDate}' AND '${endDate}'
        GROUP BY 1
        ORDER BY 1
      `
      break
  }

  const result = await executeQuery(sql)
  return NextResponse.json({ success: true, data: result.data })
}
```

---

## Phase 3: Cross-Entity Analytics

### Timeline: Week 5-6

### Goals
1. Enable group-level consolidation
2. Build entity comparison dashboards
3. Implement portfolio analytics

### Step 3.1: Group Consolidation Model

**consolidated_pnl.sql**
```sql
{{ config(
    materialized='table',
    schema='analytics'
) }}

WITH org_hierarchy AS (
    -- From your DynamoDB org table, replicated to Redshift
    SELECT
        org_id,
        parent_org_id,
        org_name,
        entity_type
    FROM {{ ref('dim_organizations') }}
),

entity_pnl AS (
    SELECT
        org_id,
        start_date,
        end_date,
        total_revenue,
        total_cogs,
        gross_profit,
        total_expenses,
        net_income,
        gross_margin
    FROM {{ ref('rpt_bc_profit_loss') }}
)

-- Individual entity P&L
SELECT
    h.parent_org_id AS group_id,
    h.org_id,
    h.org_name,
    'entity' AS level,
    p.start_date,
    p.end_date,
    p.total_revenue,
    p.total_cogs,
    p.gross_profit,
    p.total_expenses,
    p.net_income,
    p.gross_margin
FROM entity_pnl p
JOIN org_hierarchy h ON p.org_id = h.org_id

UNION ALL

-- Group-level consolidation
SELECT
    h.parent_org_id AS group_id,
    h.parent_org_id AS org_id,
    'Consolidated' AS org_name,
    'group' AS level,
    p.start_date,
    p.end_date,
    SUM(p.total_revenue) AS total_revenue,
    SUM(p.total_cogs) AS total_cogs,
    SUM(p.gross_profit) AS gross_profit,
    SUM(p.total_expenses) AS total_expenses,
    SUM(p.net_income) AS net_income,
    SUM(p.gross_profit) / NULLIF(SUM(p.total_revenue), 0) AS gross_margin
FROM entity_pnl p
JOIN org_hierarchy h ON p.org_id = h.org_id
WHERE h.parent_org_id IS NOT NULL
GROUP BY h.parent_org_id, p.start_date, p.end_date
```

### Step 3.2: Entity Comparison API

**New File: `src/app/api/warehouse/compare/route.ts`**
```typescript
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const orgIds = searchParams.get('org_ids')?.split(',') || []
  const metric = searchParams.get('metric') || 'revenue'
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const groupId = user.groupId // User's group for access control

  // Verify user has access to all requested orgs
  const accessCheck = `
    SELECT org_id FROM analytics.dim_organizations
    WHERE org_id IN (${orgIds.map(id => `'${id}'`).join(',')})
      AND (parent_org_id = '${groupId}' OR org_id = '${groupId}')
  `
  const accessResult = await executeQuery(accessCheck)
  const allowedOrgs = accessResult.data.map((r: any) => r.org_id)

  // Compare entities
  const sql = `
    SELECT
      org_id,
      org_name,
      DATE_TRUNC('month', start_date) as month,
      ${metric === 'revenue' ? 'total_revenue' :
        metric === 'margin' ? 'gross_margin' :
        metric === 'net_income' ? 'net_income' : 'total_revenue'} as value
    FROM analytics.consolidated_pnl
    WHERE org_id IN (${allowedOrgs.map(id => `'${id}'`).join(',')})
      AND level = 'entity'
      AND start_date >= '${startDate}'
      AND end_date <= '${endDate}'
    ORDER BY org_id, month
  `

  const result = await executeQuery(sql)
  return NextResponse.json({ success: true, data: result.data })
}
```

### Step 3.3: Portfolio Dashboard Component

```typescript
// src/app/(main)/portfolio/page.tsx

export default function PortfolioDashboard() {
  const { groupId } = useSession()
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])
  const [dateRange, setDateRange] = useState({ start: '2025-01-01', end: '2025-12-31' })

  const { data: consolidatedPnL } = useConsolidatedPnL({
    groupId,
    ...dateRange
  })

  const { data: comparison } = useEntityComparison({
    orgIds: selectedOrgs,
    metric: 'revenue',
    ...dateRange
  })

  return (
    <div className="space-y-6">
      {/* Group Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Consolidated P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricsGrid
            metrics={[
              { label: 'Total Revenue', value: consolidatedPnL?.total_revenue },
              { label: 'Gross Profit', value: consolidatedPnL?.gross_profit },
              { label: 'Net Income', value: consolidatedPnL?.net_income },
              { label: 'Gross Margin', value: consolidatedPnL?.gross_margin, format: 'percent' },
            ]}
          />
        </CardContent>
      </Card>

      {/* Entity Selector */}
      <EntitySelector
        groupId={groupId}
        selected={selectedOrgs}
        onChange={setSelectedOrgs}
      />

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparisonChart data={comparison} />
        </CardContent>
      </Card>

      {/* Entity Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <EntityPerformanceTable
            data={consolidatedPnL?.entities}
            sortBy="net_income"
          />
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Phase 4: Advanced Features

### Timeline: Week 7+

### Goals
1. Add Amazon Seller connector
2. Implement forecasting
3. Build custom report builder
4. Add alerting/anomaly detection

### 4.1: Amazon Seller Integration

```yaml
Connector: Amazon Seller Partner
Destination Schema: amazon_${org_id}
Seller ID: AXXXXXXXXXXXXX
Marketplaces: US, CA, MX

Tables to Sync:
  - orders
  - order_items
  - returns
  - settlements
  - inventory
  - fba_inventory
  - advertising_campaigns
  - advertising_reports
```

### 4.2: Forecasting Model

```sql
-- Simple linear regression forecast
WITH historical AS (
    SELECT
        org_id,
        DATE_TRUNC('month', date) as month,
        SUM(revenue) as monthly_revenue
    FROM analytics.unified_daily_revenue
    WHERE date >= DATEADD(month, -12, CURRENT_DATE)
    GROUP BY 1, 2
),

regression AS (
    SELECT
        org_id,
        REGR_SLOPE(monthly_revenue, EXTRACT(EPOCH FROM month)) as slope,
        REGR_INTERCEPT(monthly_revenue, EXTRACT(EPOCH FROM month)) as intercept
    FROM historical
    GROUP BY 1
)

SELECT
    org_id,
    DATEADD(month, n, CURRENT_DATE) as forecast_month,
    intercept + (slope * EXTRACT(EPOCH FROM DATEADD(month, n, CURRENT_DATE))) as forecast_revenue
FROM regression
CROSS JOIN (SELECT generate_series(1, 6) as n) months
```

### 4.3: Anomaly Detection

```sql
-- Z-score based anomaly detection
WITH daily_stats AS (
    SELECT
        org_id,
        AVG(revenue) as mean_revenue,
        STDDEV(revenue) as stddev_revenue
    FROM analytics.unified_daily_revenue
    WHERE date >= DATEADD(day, -90, CURRENT_DATE)
    GROUP BY 1
),

scored AS (
    SELECT
        r.org_id,
        r.date,
        r.revenue,
        s.mean_revenue,
        s.stddev_revenue,
        (r.revenue - s.mean_revenue) / NULLIF(s.stddev_revenue, 0) as z_score
    FROM analytics.unified_daily_revenue r
    JOIN daily_stats s ON r.org_id = s.org_id
    WHERE r.date = CURRENT_DATE - 1
)

SELECT
    org_id,
    date,
    revenue,
    z_score,
    CASE
        WHEN z_score > 2 THEN 'HIGH_POSITIVE'
        WHEN z_score < -2 THEN 'HIGH_NEGATIVE'
        ELSE 'NORMAL'
    END as anomaly_type
FROM scored
WHERE ABS(z_score) > 2
```

---

## API vs Warehouse Decision Matrix

### When to Use Warehouse (Redshift)

| Scenario | Use Warehouse |
|----------|---------------|
| Historical reports (P&L, Balance Sheet) | ✅ Always |
| Cross-source analytics (Shopify + Meta) | ✅ Always |
| Multi-entity comparison | ✅ Always |
| Group consolidation | ✅ Always |
| Trend analysis (12+ months) | ✅ Always |
| Dashboard widgets | ✅ Preferred |
| Scheduled reports/exports | ✅ Always |
| Ad spend attribution | ✅ Always |

### When to Use Direct API

| Scenario | Use API |
|----------|---------|
| Single record lookup | ✅ Faster |
| Real-time balance check | ✅ Current |
| Creating/updating records | ✅ Required |
| Webhooks/notifications | ✅ Required |
| User-triggered actions | ✅ Immediate |
| OAuth connection status | ✅ Required |

### Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA ACCESS LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Dashboard / Reports ────────────► WAREHOUSE (Redshift)          │
│  • P&L, Balance Sheet              • Pre-aggregated              │
│  • Trends, comparisons             • Optimized for reads         │
│  • Cross-source analytics          • Historical data             │
│                                                                  │
│  Real-time Actions ──────────────► DIRECT API (BC/Shopify)       │
│  • Create invoice                  • Current balances            │
│  • Update customer                 • Write operations            │
│  • Check stock level               • Single records              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Details

### Business Central API Reference

**Base URL**: `https://api.businesscentral.dynamics.com/v2.0/{tenant}/{environment}/api/v2.0`

**Key Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `/companies` | List companies in tenant |
| `/companies({id})/accounts` | Chart of accounts |
| `/companies({id})/generalLedgerEntries` | All GL transactions |
| `/companies({id})/customers` | Customer master |
| `/companies({id})/vendors` | Vendor master |
| `/companies({id})/items` | Product/inventory items |
| `/companies({id})/salesOrders` | Sales orders |
| `/companies({id})/purchaseOrders` | Purchase orders |
| `/companies({id})/agedAccountsReceivable` | AR aging |
| `/companies({id})/agedAccountsPayable` | AP aging |

**OData Query Examples:**
```
# Filter by date
$filter=postingDate ge 2025-01-01 and postingDate le 2025-12-31

# Select specific fields
$select=id,postingDate,debitAmount,creditAmount

# Expand related entities
$expand=account

# Pagination
$top=1000&$skip=0

# Order results
$orderby=postingDate desc
```

### BC vs QuickBooks Key Differences

| Aspect | QuickBooks | Business Central |
|--------|------------|------------------|
| **Report Endpoints** | Direct (`/reports/ProfitAndLoss`) | None - aggregate from GL |
| **Query Language** | SQL-like | OData ($filter, $select) |
| **Pagination** | `startPosition` + `maxResults` | `$top` + `$skip` or `@odata.nextLink` |
| **Auth Identifier** | `realmId` | `tenant` + `environment` + `companyId` |
| **Token Refresh** | 100 days | 90 days |
| **Rate Limits** | 500/min | Throttled per tenant |
| **Webhooks** | Yes | Yes (via subscriptions) |

---

## Existing Codebase Patterns

### QuickBooks OAuth Flow (Reference)

**Connect Route**: `src/app/api/quickbooks/connect/route.ts`
```
1. Generate secure state with CSRF token
2. Store state in cookie (httpOnly)
3. Redirect to Intuit OAuth URL
```

**Callback Route**: `src/app/api/quickbooks/callback/route.ts`
```
1. Validate state parameter
2. Exchange code for tokens
3. Store in DynamoDB: providers.quickbooks.credentials
4. Fetch company metadata (name, currency)
5. Redirect to app with success flag
```

### Token Management

**Token Manager**: `src/quickbooks/auth/token-manager.ts`
- `getValidToken()`: Returns fresh token, auto-refreshes if expiring within 5 minutes
- `refreshWithLock()`: Distributed lock prevents race conditions in serverless
- `disconnect()`: Revokes token and marks disconnected

**Storage Structure**: `src/quickbooks/auth/dynamodb-token-store.ts`
```json
{
  "providers": {
    "quickbooks": {
      "credentials": {
        "access_token": "...",
        "refresh_token": "...",
        "expires_at": 1234567890,
        "realm_id": "xyz789",
        "connected": true,
        "home_currency": "USD",
        "company_name": "Acme Corp"
      }
    }
  }
}
```

### Report Transformation Pattern

**Transformer**: `src/quickbooks/reports/transformers.ts`
- `transformProfitAndLoss()`: Lines 545-630
- `transformBalanceSheet()`: Lines 641-833
- `transformCashFlow()`: Lines 838-927

**Enricher**: `src/quickbooks/reports/enrichers/profit-loss.ts`
- Adds KPIs, margins, burn rate, insights

### Provider Interface

```typescript
// src/lib/providers/interfaces/auth.ts
export interface AuthAndTokenProvider {
  getLoginUrl(state: string): string
  handleCallback(code: string, state: string): Promise<TokenSet>
  refreshAccessToken(refreshToken: string): Promise<TokenSet>
  disconnect(accessToken: string): Promise<void>
  getTokens(): Promise<TokenSet | null>
}
```

---

## File Reference Map

### QuickBooks Implementation (Reference)

| Purpose | File | Key Lines |
|---------|------|-----------|
| OAuth Client | `src/quickbooks/auth/oauth.ts` | 61-182 |
| Token Manager | `src/quickbooks/auth/token-manager.ts` | 67-249 |
| DynamoDB Storage | `src/quickbooks/auth/dynamodb-token-store.ts` | 21-239 |
| API Client | `src/quickbooks/client/client.ts` | 82-404 |
| Report Fetcher | `src/quickbooks/reports/fetcher.ts` | 40-256 |
| P&L Transformer | `src/quickbooks/reports/transformers.ts` | 545-630 |
| Balance Sheet Transformer | `src/quickbooks/reports/transformers.ts` | 641-833 |
| Connect Route | `src/app/api/quickbooks/connect/route.ts` | 23-88 |
| Callback Route | `src/app/api/quickbooks/callback/route.ts` | 22-111 |
| P&L Report Route | `src/app/api/quickbooks/reports/profit-loss/route.ts` | 51-157 |

### Provider Framework

| Purpose | File | Key Lines |
|---------|------|-----------|
| OAuth Security | `src/lib/providers/oauth-security.ts` | 30-203 |
| Provider Callback | `src/app/api/providers/callback/route.ts` | 159-491 |
| Token Storage Schema | `src/lib/providers/database.ts` | 10-28 |
| Token Refresh Logic | `src/lib/providers/apiClient.ts` | 64-284 |
| Distributed Locking | `src/lib/providers/tokenLock.ts` | 27-400 |
| Circuit Breaker | `src/lib/providers/circuitBreaker.ts` | 27-232 |
| Provider Registry | `src/lib/providers/index.ts` | 21-138 |

### Report System

| Purpose | File | Key Lines |
|---------|------|-----------|
| Reports API Route | `src/app/api/reports/route.ts` | 1-737 |
| P&L View | `src/app/(main)/reports/views/PnLView.tsx` | 1-1476 |
| Balance Sheet View | `src/app/(main)/reports/views/BalanceSheetView.tsx` | 1-2016 |
| Summary View | `src/app/(main)/reports/views/SummaryView.tsx` | 1-1542 |
| Report Data Hooks | `src/hooks/useReportData.ts` | All |

### Redshift Integration (New)

| Purpose | File |
|---------|------|
| Redshift Client | `src/lib/redshift/client.ts` |
| Query API Route | `src/app/api/redshift/query/route.ts` |
| Warehouse Explorer | `src/app/dev/warehouse/page.tsx` |

### To Be Created (Business Central)

| Purpose | File |
|---------|------|
| BC OAuth | `src/lib/providers/businesscentral/auth.ts` |
| BC API Client | `src/lib/providers/businesscentral/client.ts` |
| BC Reports | `src/lib/providers/businesscentral/reports.ts` |
| BC Connect Route | `src/app/api/businesscentral/connect/route.ts` |
| Warehouse BC API | `src/app/api/warehouse/bc/reports/route.ts` |
| Cross-Source API | `src/app/api/warehouse/analytics/route.ts` |
| Entity Compare API | `src/app/api/warehouse/compare/route.ts` |

---

## External Resources

### Microsoft Documentation
- [Business Central API v2.0 Reference](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/)
- [API Endpoints](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/endpoints-apis-for-dynamics)
- [OAuth Authentication](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/authenticate-web-services-using-oauth)
- [Microsoft Graph Financial Reports](https://learn.microsoft.com/en-us/graph/dynamics-business-central-concept-overview)

### Fivetran Documentation
- [Business Central Connector](https://fivetran.com/docs/connectors/applications/microsoft-dynamics/business-central)
- [Business Central Setup Guide](https://fivetran.com/docs/connectors/applications/microsoft-dynamics/business-central/setup-guide)
- [Shopify Connector](https://fivetran.com/docs/connectors/applications/shopify)
- [Facebook Ads Connector](https://fivetran.com/docs/connectors/applications/facebook-ads)
- [Amazon Seller Connector](https://fivetran.com/docs/connectors/applications/amazon-seller-partner)

### dbt Resources
- [dbt Documentation](https://docs.getdbt.com/)
- [dbt Redshift Adapter](https://docs.getdbt.com/docs/core/connect-data-platform/redshift-setup)

### Comparison Resources
- [Business Central API Integration Guide 2025](https://www.apideck.com/blog/microsoft-dynamics-business-central-api-integration-guide-2025)
- [QuickBooks vs Business Central](https://www.journeyteam.com/resources/blog/quickbooks-vs-microsoft-dynamics-365-business-central/)
- [Understanding BC Authorization](https://www.apideck.com/blog/understanding-authorization-in-microsoft-business-central-api)

---

## Summary: Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          IMPLEMENTATION ROADMAP                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PHASE 1: BC Foundation (Week 1-2)                                              │
│  ├── [1.1] Fivetran BC connector setup                                          │
│  ├── [1.2] dbt models for BC data (staging, analytics)                          │
│  ├── [1.3] API routes for BC reports from warehouse                             │
│  ├── [1.4] Update frontend hooks for warehouse data                             │
│  └── [1.5] BC OAuth for real-time (optional)                                    │
│                                                                                  │
│  PHASE 2: Multi-Source (Week 3-4)                                               │
│  ├── [2.1] Fivetran Shopify connector                                           │
│  ├── [2.2] Fivetran Meta Ads connector                                          │
│  ├── [2.3] dbt models for cross-source (unified revenue, attribution)           │
│  └── [2.4] API routes for analytics (CAC, ROAS, channel performance)            │
│                                                                                  │
│  PHASE 3: Cross-Entity (Week 5-6)                                               │
│  ├── [3.1] Group consolidation dbt models                                       │
│  ├── [3.2] Entity comparison API routes                                         │
│  └── [3.3] Portfolio dashboard UI                                               │
│                                                                                  │
│  PHASE 4: Advanced (Week 7+)                                                    │
│  ├── [4.1] Amazon Seller connector                                              │
│  ├── [4.2] Forecasting models                                                   │
│  ├── [4.3] Anomaly detection                                                    │
│  └── [4.4] Custom report builder                                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

*Document updated: January 2026*
*For: Midas CFO Platform - Multi-Source Data Warehouse Architecture*
*Primary Focus: Microsoft Dynamics 365 Business Central*
