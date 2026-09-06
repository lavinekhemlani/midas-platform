# QuickBooks Report Migration Template

This template provides a step-by-step guide for migrating Balance Sheet and Cash Flow reports (or any new QuickBooks report) to the unified API architecture, based on proven P&L implementation patterns.

## Table of Contents

1. [File Structure Template](#1-file-structure-template)
2. [Common Patterns to Implement](#2-common-patterns-to-implement)
3. [Bug Prevention Checklist](#3-bug-prevention-checklist)
4. [Step-by-Step Migration Guide](#4-step-by-step-migration-guide)
5. [Code Templates](#5-code-templates)
6. [Testing & Verification](#6-testing--verification)

---

## 1. File Structure Template

### 1.1 API Route Structure

```
src/app/api/quickbooks/reports/
├── balance-sheet/
│   ├── route.ts                    # Main API endpoint
│   └── trend/
│       └── route.ts                # Trend/time-series endpoint
├── cash-flow/
│   ├── route.ts                    # Main API endpoint
│   └── trend/
│       └── route.ts                # Trend/time-series endpoint
└── profit-loss/                    # Reference implementation
    ├── route.ts
    └── trend/route.ts
```

**Key Files:**

- `route.ts` - Main report endpoint with full enrichment
- `trend/route.ts` - Time-series data for charts

### 1.2 Backend/QuickBooks Structure

```
src/quickbooks/
├── reports/
│   ├── transformers.ts            # Raw QB → Normalized data
│   ├── enrichers/
│   │   ├── index.ts
│   │   ├── balance-sheet.ts       # Business logic & KPIs
│   │   ├── cash-flow.ts
│   │   └── profit-loss.ts         # Reference implementation
│   ├── fetcher.ts                 # Generic report fetcher
│   └── index.ts
├── utils/
│   ├── route-helpers.ts           # withRetry, validateDateRange, etc.
│   ├── report-helpers.ts          # formatReportDate, insights, etc.
│   └── accounts.ts                # getCashAndEquivalents, etc.
└── client/
    └── client.ts                  # QuickBooksClient
```

### 1.3 Frontend Structure (Future)

```
src/app/(dashboard)/quickbooks/
├── balance-sheet/
│   ├── page.tsx                   # View component
│   ├── components/
│   │   ├── BalanceSheetGrid.tsx   # Metrics grid
│   │   └── AssetPieChart.tsx      # Visualizations
│   └── hooks/
│       ├── useBalanceSheet.ts     # Main data hook
│       └── useBalanceSheetTrend.ts # Trend data hook
└── cash-flow/
    ├── page.tsx
    ├── components/
    │   ├── CashFlowGrid.tsx
    │   └── WaterfallChart.tsx
    └── hooks/
        ├── useCashFlow.ts
        └── useCashFlowTrend.ts
```

---

## 2. Common Patterns to Implement

### 2.1 QuickBooksClient Usage

```typescript
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withRetry } from '@/quickbooks/utils/route-helpers'

// Initialize client with organizationId
const client = new QuickBooksClient({ organizationId })

// Fetch report with retry logic
const rawReport = await withRetry(() =>
  client.request(`/reports/BalanceSheet?${reportParams.toString()}`)
)
```

**Key Points:**

- Always use `withRetry()` for API resilience
- Client handles token management automatically
- Use query string parameters for report options

### 2.2 Provider-Agnostic Patterns

```typescript
import { withActiveProvider } from '@/lib/providers/withActiveProvider'

// Middleware provides organizationId and apiClient
export const GET = withActiveProvider(async (request, { organizationId, apiClient }) => {
  // Route logic here
})
```

**Benefits:**

- Future-proof for Zoho/Xero integration
- Handles authentication automatically
- Provides consistent error handling

### 2.3 Currency Extraction with getCurrency()

```typescript
// Get organization info for currency and name
const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
  console.error('[Report] Failed to fetch org info:', err)
  return null
})

// Robust currency extraction function
const getCurrency = (info: any): string => {
  // QuickBooks returns HomeCurrency as { value: "HKD" }
  if (info?.HomeCurrency?.value) return info.HomeCurrency.value
  // Fallback to currency_code if adapter normalized it
  if (info?.currency_code) return info.currency_code
  // Country-based fallback
  if (info?.Country === 'US') return 'USD'
  if (info?.Country === 'CA') return 'CAD'
  if (info?.Country === 'GB') return 'GBP'
  if (info?.Country === 'AU') return 'AUD'
  if (info?.Country === 'HK') return 'HKD'
  return 'USD'
}

const currency = getCurrency(orgInfo)
const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'
```

**Why This Pattern:**

- QuickBooks API structure: `{ HomeCurrency: { value: "HKD" } }`
- Country-based fallbacks for reliability
- Prevents hardcoded "USD" defaults

### 2.4 Date Handling

```typescript
import { formatReportDate, validateDateRange } from '@/quickbooks/utils/route-helpers'

// Parse query parameters
const startDate = searchParams.get('start') || getDefaultStartDate()
const endDate = searchParams.get('end') || getDefaultEndDate()

// Validate date range
const startDateObj = new Date(startDate)
const endDateObj = new Date(endDate)

const dateValidation = validateDateRange(startDateObj, endDateObj)
if (!dateValidation.valid && dateValidation.error) {
  return NextResponse.json(
    {
      error: dateValidation.error.message,
      suggestion: dateValidation.error.suggestion,
      timestamp: new Date().toISOString(),
    },
    { status: dateValidation.error.statusCode }
  )
}

// Format for QuickBooks API
function formatDate(date: Date): string {
  return formatReportDate(date) // Returns YYYY-MM-DD
}
```

### 2.5 Data Transformation Pipeline

```typescript
import { transformBalanceSheet } from '@/quickbooks/reports'
import { enrichBalanceSheet } from '@/quickbooks/reports/enrichers'

// Step 1: Fetch raw QuickBooks data
const rawReport = await withRetry(() =>
  client.request(`/reports/BalanceSheet?${reportParams.toString()}`)
)

// Step 2: Transform to normalized format
const normalized = transformBalanceSheet(rawReport)

// Step 3: Enrich with business logic
const enriched = enrichBalanceSheet(normalized, plData, currency)
```

**Pipeline Stages:**

1. **Raw QB Data** - Direct from API
2. **Normalized Data** - Consistent structure across reports
3. **Enriched Data** - KPIs, calculations, insights

### 2.6 SWR Hooks for Data Fetching (Frontend)

```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useBalanceSheet(startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)

  const { data, error, isLoading, mutate } = useSWR(
    `/api/quickbooks/reports/balance-sheet?${params.toString()}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  return {
    report: data,
    isLoading,
    isError: error,
    mutate,
  }
}
```

### 2.7 useMemo for Data Merging

```typescript
import { useMemo } from 'react'

export function useBalanceSheetWithTrend(startDate?: string, endDate?: string) {
  const { report, isLoading: reportLoading } = useBalanceSheet(startDate, endDate)
  const { trendData, isLoading: trendLoading } = useBalanceSheetTrend(startDate, endDate)

  // Merge data with useMemo to prevent re-renders
  const mergedData = useMemo(() => {
    if (!report || !trendData) return null
    return {
      ...report,
      trend: trendData.data.monthlyTrend,
    }
  }, [report, trendData])

  return {
    data: mergedData,
    isLoading: reportLoading || trendLoading,
  }
}
```

---

## 3. Bug Prevention Checklist

### 3.1 Currency Display Issues

- [ ] **Use `getCurrency()` helper function** - Don't hardcode "USD"
- [ ] **Check `HomeCurrency.value` first** - QB structure: `{ HomeCurrency: { value: "HKD" } }`
- [ ] **Implement country-based fallbacks** - US→USD, HK→HKD, etc.
- [ ] **Fetch `orgInfo` with retry logic** - Use `withRetry(() => client.getCompanyInfo())`
- [ ] **Handle fetch failures gracefully** - `.catch()` and return fallback

### 3.2 Company Name Display

- [ ] **Extract from `CompanyName` field** - Primary source
- [ ] **Fallback to `name` field** - Normalized adapter format
- [ ] **Default to "Organization"** - Last resort fallback
- [ ] **Pass to enricher** - Include in enrichment options

### 3.3 Trend Chart Data

- [ ] **Create separate `/trend` endpoint** - Don't mix with main report
- [ ] **Use `summarize_column_by: "Month"`** - For time-series data
- [ ] **Map column data correctly** - QB returns columns as arrays
- [ ] **Frontend expects `month` and `revenue`** - Check field naming
- [ ] **Include period count in metadata** - For validation

### 3.4 Grid Layout Balance

- [ ] **Use responsive grid classes** - `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- [ ] **Balance metric distribution** - 4-6 metrics per report
- [ ] **Consistent card heights** - Use flexbox or grid auto-rows
- [ ] **Test on mobile** - Verify single-column layout works

### 3.5 TypeScript Compilation

- [ ] **Import types from `@/quickbooks/types/reports`** - Don't duplicate
- [ ] **Define enricher return types** - Clear interfaces
- [ ] **Use type guards for optional data** - Check before accessing
- [ ] **Avoid `any` types** - Be explicit
- [ ] **Run `npm run typecheck`** - Before committing

### 3.6 Console Errors

- [ ] **Check browser console** - No React warnings
- [ ] **Verify API responses** - 200 status codes
- [ ] **Look for undefined errors** - Optional chaining `?.`
- [ ] **Test error states** - Disconnect QB and verify error UI
- [ ] **Add error boundaries** - Catch React errors

### 3.7 Data Accuracy

- [ ] **Reconcile totals** - Assets = Liabilities + Equity
- [ ] **Validate KPI calculations** - Test with known values
- [ ] **Check for double-counting** - Use reconciliation helpers
- [ ] **Test with real data** - Not just mock data
- [ ] **Compare with QuickBooks UI** - Numbers should match

---

## 4. Step-by-Step Migration Guide

### Step 1: Create API Route with QuickBooksClient

**File:** `src/app/api/quickbooks/reports/balance-sheet/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { transformBalanceSheet } from '@/quickbooks/reports'
import { enrichBalanceSheet } from '@/quickbooks/reports/enrichers'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import type { QBBalanceSheetParams } from '@/quickbooks/types/reports'
import {
  formatReportDate,
  withRetry,
  validateDateRange,
  formatErrorResponse,
} from '@/quickbooks/utils/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Default date helpers
function formatDate(date: Date): string {
  return formatReportDate(date)
}

function getDefaultDate(): string {
  return formatDate(new Date())
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  // Parse query parameters
  const endDate = searchParams.get('date') || getDefaultDate()
  const includeDetails = searchParams.get('details') !== 'false'

  // Validate date
  const endDateObj = new Date(endDate)
  if (isNaN(endDateObj.getTime())) {
    return NextResponse.json(
      {
        error: 'Invalid date format',
        suggestion: 'Please provide date in YYYY-MM-DD format',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    )
  }

  try {
    // Build report parameters
    const params: QBBalanceSheetParams = {
      date: endDate,
    }

    // Optional parameters
    const accountingMethod = searchParams.get('accounting_method')
    if (accountingMethod) {
      params.accounting_method = accountingMethod as QBBalanceSheetParams['accounting_method']
    }

    // Build report URL
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw Balance Sheet report with retry logic
    const client = new QuickBooksClient({ organizationId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/BalanceSheet?${reportParams.toString()}`)
    )

    // Transform to normalized format
    const normalized = transformBalanceSheet(rawReport)

    // Get organization info for currency and name
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[Balance Sheet] Failed to fetch org info:', err)
      return null
    })

    // Extract currency and company name
    const getCurrency = (info: any): string => {
      if (info?.HomeCurrency?.value) return info.HomeCurrency.value
      if (info?.currency_code) return info.currency_code
      if (info?.Country === 'US') return 'USD'
      if (info?.Country === 'CA') return 'CAD'
      if (info?.Country === 'GB') return 'GBP'
      if (info?.Country === 'AU') return 'AUD'
      if (info?.Country === 'HK') return 'HKD'
      return 'USD'
    }

    const currency = getCurrency(orgInfo)
    const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

    // Enrich with business logic
    const enriched = await enrichBalanceSheet(normalized, undefined, {
      currency,
      organizationName,
      includeDetails,
    })

    // Add query time to metadata
    enriched.data.metadata = {
      ...enriched.data.metadata,
      queryTime: Date.now() - startTime,
    }

    return NextResponse.json(enriched)
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate balance sheet report')
  }
})
```

### Step 2: Create Transformer for Raw QB Data

**File:** `src/quickbooks/reports/transformers.ts` (add to existing file)

```typescript
/**
 * Transform Balance Sheet report
 */
export function transformBalanceSheet(report: QBReportResponse): NormalizedBalanceSheet {
  const rows = report.Rows?.Row || []
  const columns = extractColumnHeaders(report)

  // Find main sections
  const assetsSection = findSection(rows, 'Assets')
  const liabilitiesSection = findSection(rows, 'Liabilities')
  let equitySection = findSection(rows, 'Equity')

  // For HK PE and similar standards, liabilities and equity are combined
  if (liabilitiesSection && !equitySection) {
    const liabRows = liabilitiesSection.Rows?.Row || []
    equitySection = findSection(liabRows, 'Equity')
  }

  // Process assets with sub-sections
  const assetsRows = assetsSection?.Rows?.Row || []
  const currentAssetsSection = findSection(assetsRows, 'CurrentAssets')
  const fixedAssetsSection = findSection(assetsRows, 'FixedAssets')
  const otherAssetsSection = findSection(assetsRows, 'OtherAssets')

  const currentAssets = currentAssetsSection
    ? processSection(currentAssetsSection)
    : { lines: [], total: 0 }
  const fixedAssets = fixedAssetsSection
    ? processSection(fixedAssetsSection)
    : { lines: [], total: 0 }
  const otherAssets = otherAssetsSection
    ? processSection(otherAssetsSection)
    : { lines: [], total: 0 }

  const totalAssets =
    getSectionTotal(assetsSection) || currentAssets.total + fixedAssets.total + otherAssets.total

  // Process liabilities with sub-sections
  const liabilitiesRows = liabilitiesSection?.Rows?.Row || []
  const currentLiabilitiesSection = findSection(liabilitiesRows, 'CurrentLiabilities')
  const longTermLiabilitiesSection = findSection(liabilitiesRows, 'LongTermLiabilities')

  const currentLiabilities = currentLiabilitiesSection
    ? processSection(currentLiabilitiesSection)
    : { lines: [], total: 0 }
  const longTermLiabilities = longTermLiabilitiesSection
    ? processSection(longTermLiabilitiesSection)
    : { lines: [], total: 0 }

  let totalLiabilities = currentLiabilities.total + longTermLiabilities.total

  // Process equity
  const equity = equitySection ? processSection(equitySection) : { lines: [], total: 0 }
  const totalEquity = getSectionTotal(equitySection) || equity.total

  // Get grand total from liabilities+equity section if available
  const grandTotal = getSectionTotal(liabilitiesSection) || totalLiabilities + totalEquity

  // If liabilities total is 0 but we have grand total and equity, calculate liabilities
  if (totalLiabilities === 0 && grandTotal > 0 && totalEquity !== 0) {
    totalLiabilities = grandTotal - totalEquity
  }

  return {
    reportName: report.Header.ReportName,
    reportBasis: report.Header.ReportBasis || 'Accrual',
    asOfDate: report.Header.EndPeriod,
    currency: report.Header.Currency,
    generatedAt: report.Header.Time,

    assets: {
      current: {
        lines: currentAssets.lines,
        total: currentAssets.total,
      },
      fixed: {
        lines: fixedAssets.lines,
        total: fixedAssets.total,
      },
      other: {
        lines: otherAssets.lines,
        total: otherAssets.total,
      },
      total: totalAssets,
    },

    liabilities: {
      current: {
        lines: currentLiabilities.lines,
        total: currentLiabilities.total,
      },
      longTerm: {
        lines: longTermLiabilities.lines,
        total: longTermLiabilities.total,
      },
      total: totalLiabilities,
    },

    equity: {
      lines: equity.lines,
      total: totalEquity,
    },

    totalLiabilitiesAndEquity: grandTotal,
    columns,
  }
}
```

**Key Transformer Responsibilities:**

- Parse raw QuickBooks JSON structure
- Extract sections (Assets, Liabilities, Equity)
- Handle international accounting standards (US GAAP, IFRS, HK PE)
- Calculate sub-totals and grand totals
- Return consistent normalized structure

### Step 3: Create Enricher for Computed Fields

**File:** `src/quickbooks/reports/enrichers/balance-sheet.ts` (already exists - reference for patterns)

```typescript
import {
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDebtToEquity,
  calculateROA,
  calculateROE,
  calculateWorkingCapital,
} from '@/lib/utils/financial/reportCalculations'

export function enrichBalanceSheet(
  bsData: NormalizedBalanceSheet,
  plData?: NormalizedProfitAndLoss,
  options: {
    currency?: string
    organizationName?: string
    includeDetails?: boolean
  } = {}
): EnrichedBalanceSheet {
  const { currency = 'USD', organizationName = 'Organization', includeDetails = true } = options

  // Calculate current assets/liabilities
  const currentAssets = calculateCurrentAssets(bsData)
  const currentLiabilities = calculateCurrentLiabilities(bsData)
  const inventory = calculateInventory(bsData)

  // Calculate KPIs
  const workingCapital = calculateWorkingCapital(currentAssets, currentLiabilities)
  const currentRatio = calculateCurrentRatio(currentAssets, currentLiabilities)
  const quickRatio = calculateQuickRatio(currentAssets, inventory, currentLiabilities)
  const debtToEquity = calculateDebtToEquity(bsData.total_liabilities, bsData.total_equity)

  // Calculate ROA and ROE if P&L data provided
  const netIncome = plData?.net_income || 0
  const roa = calculateROA(netIncome, bsData.total_assets)
  const roe = calculateROE(netIncome, bsData.total_equity)

  // Build composition arrays
  const assetComposition = buildAssetComposition(bsData)
  const liabilityBreakdown = buildLiabilityBreakdown(bsData)
  const equityComposition = buildEquityComposition(bsData)

  return {
    reportType: 'balance_sheet',
    reportDate: bsData.reportDate,
    currency,
    organizationName,
    generated: new Date().toISOString(),
    data: {
      kpis: {
        totalAssets: bsData.total_assets,
        totalLiabilities: bsData.total_liabilities,
        totalEquity: bsData.total_equity,
        workingCapital,
        currentAssets,
        currentLiabilities,
        inventory,
        currentRatio,
        debtToEquity,
        quickRatio,
        roa,
      },
      assetComposition,
      liabilityBreakdown,
      equityComposition,
      ratios: {
        assetTurnover: calculateAssetTurnover(revenue, bsData.total_assets),
        equityMultiplier: calculateEquityMultiplier(bsData.total_assets, bsData.total_equity),
        returnOnEquity: roe,
        debtRatio: calculateDebtRatio(bsData.total_liabilities, bsData.total_assets),
      },
    },
  }
}
```

**Key Enricher Responsibilities:**

- Calculate business KPIs (ratios, margins, etc.)
- Add percentage breakdowns for categories
- Generate insights and recommendations
- Format data for frontend consumption
- Handle optional related data (P&L for ROA/ROE)

### Step 4: Create SWR Hook for Data Fetching

**File:** `src/hooks/quickbooks/useBalanceSheet.ts` (future)

```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface UseBalanceSheetOptions {
  date?: string
  accountingMethod?: 'Accrual' | 'Cash'
  includeDetails?: boolean
}

export function useBalanceSheet(options: UseBalanceSheetOptions = {}) {
  const { date, accountingMethod, includeDetails = true } = options

  // Build query parameters
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (accountingMethod) params.set('accounting_method', accountingMethod)
  if (!includeDetails) params.set('details', 'false')

  const queryString = params.toString()
  const url = `/api/quickbooks/reports/balance-sheet${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000, // Cache for 30 seconds
  })

  return {
    balanceSheet: data,
    isLoading,
    isError: error,
    currency: data?.currency,
    organizationName: data?.organizationName,
    reportDate: data?.reportDate,
    kpis: data?.data?.kpis,
    assetComposition: data?.data?.assetComposition,
    liabilityBreakdown: data?.data?.liabilityBreakdown,
    equityComposition: data?.data?.equityComposition,
    mutate, // For manual revalidation
  }
}
```

**Key Hook Responsibilities:**

- Fetch data from API with SWR
- Build query parameters from options
- Provide loading/error states
- Extract and expose nested data fields
- Cache responses for performance

### Step 5: Create Trend Hook for Time-Series Data

**File:** `src/hooks/quickbooks/useBalanceSheetTrend.ts` (future)

```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface UseBalanceSheetTrendOptions {
  startDate?: string
  endDate?: string
  summarizeBy?: 'Month' | 'Quarter' | 'Year'
}

export function useBalanceSheetTrend(options: UseBalanceSheetTrendOptions = {}) {
  const { startDate, endDate, summarizeBy = 'Month' } = options

  // Build query parameters
  const params = new URLSearchParams()
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)
  params.set('summarize_column_by', summarizeBy)

  const queryString = params.toString()
  const url = `/api/quickbooks/reports/balance-sheet/trend${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Cache for 60 seconds
  })

  return {
    trendData: data?.data?.monthlyTrend,
    isLoading,
    isError: error,
    currency: data?.currency,
    periodCount: data?.metadata?.periodCount,
    mutate,
  }
}
```

### Step 6: Create View Component

**File:** `src/app/(dashboard)/quickbooks/balance-sheet/page.tsx` (future)

```typescript
'use client'

import { useState } from 'react'
import { useBalanceSheet } from '@/hooks/quickbooks/useBalanceSheet'
import { useBalanceSheetTrend } from '@/hooks/quickbooks/useBalanceSheetTrend'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import BalanceSheetGrid from './components/BalanceSheetGrid'
import AssetPieChart from './components/AssetPieChart'

export default function BalanceSheetPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })

  const { balanceSheet, isLoading, isError, currency, organizationName } = useBalanceSheet({
    date: selectedDate,
  })

  const { trendData, isLoading: trendLoading } = useBalanceSheetTrend({
    endDate: selectedDate,
  })

  if (isLoading) {
    return <div>Loading balance sheet...</div>
  }

  if (isError) {
    return <div>Error loading balance sheet. Please try again.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{organizationName} - Balance Sheet</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      {/* KPIs Grid */}
      <BalanceSheetGrid kpis={balanceSheet.data.kpis} currency={currency} />

      {/* Asset Composition */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Composition</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetPieChart data={balanceSheet.data.assetComposition} currency={currency} />
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {!trendLoading && trendData && (
        <Card>
          <CardHeader>
            <CardTitle>Asset Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Add trend chart component here */}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### Step 7: Create Grid/Metrics Component

**File:** `src/app/(dashboard)/quickbooks/balance-sheet/components/BalanceSheetGrid.tsx` (future)

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatPercentage } from '@/lib/utils/currency'

interface BalanceSheetGridProps {
  kpis: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    workingCapital: number
    currentRatio: number
    debtToEquity: number
    quickRatio: number
    roa: number
  }
  currency: string
}

export default function BalanceSheetGrid({ kpis, currency }: BalanceSheetGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.totalAssets, currency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.totalLiabilities, currency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Equity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.totalEquity, currency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Working Capital</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.workingCapital, currency)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Current Ratio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.currentRatio.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Healthy: &gt; 1.5</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Ratio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.quickRatio.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Healthy: &gt; 1.0</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Debt-to-Equity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.debtToEquity.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Healthy: &lt; 2.0</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Return on Assets (ROA)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(kpis.roa)}</div>
          <p className="text-xs text-muted-foreground">Healthy: &gt; 5%</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 8: Wire Up Currency and Company Name

**In API Route:**

```typescript
// CORRECT: Get currency from orgInfo
const orgInfo = await withRetry(() => client.getCompanyInfo())
const currency = getCurrency(orgInfo)
const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

// Pass to enricher
const enriched = enrichBalanceSheet(normalized, plData, {
  currency,
  organizationName,
})
```

**In Enricher:**

```typescript
export function enrichBalanceSheet(
  bsData: NormalizedBalanceSheet,
  plData?: NormalizedProfitAndLoss,
  options: {
    currency?: string
    organizationName?: string
  } = {}
) {
  const { currency = 'USD', organizationName = 'Organization' } = options

  return {
    reportType: 'balance_sheet',
    reportDate: bsData.reportDate,
    currency, // Include in response
    organizationName, // Include in response
    generated: new Date().toISOString(),
    data: {
      // ...
    },
  }
}
```

**In Frontend Hook:**

```typescript
export function useBalanceSheet() {
  const { data } = useSWR('/api/quickbooks/reports/balance-sheet', fetcher)

  return {
    currency: data?.currency, // Extract from API response
    organizationName: data?.organizationName,
    // ...
  }
}
```

**In View Component:**

```typescript
export default function BalanceSheetPage() {
  const { balanceSheet, currency, organizationName } = useBalanceSheet()

  return (
    <div>
      <h1>{organizationName} - Balance Sheet</h1>
      <BalanceSheetGrid kpis={balanceSheet.data.kpis} currency={currency} />
    </div>
  )
}
```

### Step 9: Test and Verify

#### 9.1 Manual Testing Checklist

- [ ] **API Response**: Visit `/api/quickbooks/reports/balance-sheet` in browser
- [ ] **Currency**: Check that `currency` field is correct (not "USD" for HKD accounts)
- [ ] **Company Name**: Verify `organizationName` field is correct
- [ ] **KPIs**: Validate calculations match QuickBooks UI
- [ ] **Totals**: Check that Assets = Liabilities + Equity
- [ ] **Error Handling**: Disconnect QB and verify error messages
- [ ] **Date Validation**: Test invalid dates return 400 errors
- [ ] **Rate Limiting**: Test retry logic with rapid requests

#### 9.2 Automated Testing

```typescript
// tests/api/reports/balance-sheet.test.ts
import { GET } from '@/app/api/quickbooks/reports/balance-sheet/route'
import { mockRequest, mockProvider } from '@/tests/utils/mocks'

describe('Balance Sheet API', () => {
  it('should return balance sheet with correct currency', async () => {
    const request = mockRequest({ date: '2024-12-31' })
    const response = await GET(request, mockProvider({ organizationId: 'test' }))
    const data = await response.json()

    expect(data.currency).toBe('HKD') // Or whatever test org uses
    expect(data.data.kpis.totalAssets).toBeGreaterThan(0)
  })

  it('should validate invalid dates', async () => {
    const request = mockRequest({ date: 'invalid' })
    const response = await GET(request, mockProvider({ organizationId: 'test' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toHaveProperty('error')
  })

  it('should reconcile accounting equation', async () => {
    const request = mockRequest({ date: '2024-12-31' })
    const response = await GET(request, mockProvider({ organizationId: 'test' }))
    const data = await response.json()

    const assets = data.data.kpis.totalAssets
    const liabilities = data.data.kpis.totalLiabilities
    const equity = data.data.kpis.totalEquity

    // Assets = Liabilities + Equity (allow 1 cent rounding error)
    expect(Math.abs(assets - (liabilities + equity))).toBeLessThan(0.01)
  })
})
```

#### 9.3 Integration Testing

```bash
# Test with real QuickBooks account
npm run test:integration

# Check TypeScript compilation
npm run typecheck

# Run linter
npm run lint

# Build production bundle
npm run build
```

---

## 5. Code Templates

### 5.1 API Route Template

```typescript
/**
 * [Report Name] API
 *
 * [Description of what this report does]
 *
 * GET /api/quickbooks/reports/[report-name]
 *
 * Query Parameters:
 * - [param]: [description] (optional/required, default: [value])
 */

import { NextRequest, NextResponse } from 'next/server'
import { transform[ReportName] } from '@/quickbooks/reports'
import { enrich[ReportName] } from '@/quickbooks/reports/enrichers'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import type { QB[ReportName]Params } from '@/quickbooks/types/reports'
import {
  formatReportDate,
  withRetry,
  validateDateRange,
  formatErrorResponse,
} from '@/quickbooks/utils/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Default date helpers
function formatDate(date: Date): string {
  return formatReportDate(date)
}

function getDefaultStartDate(): string {
  const date = new Date()
  date.setDate(1) // First day of current month
  return formatDate(date)
}

function getDefaultEndDate(): string {
  return formatDate(new Date())
}

export const GET = withActiveProvider(async (request, { organizationId, apiClient }) => {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams

  // Parse query parameters
  const startDate = searchParams.get('start') || getDefaultStartDate()
  const endDate = searchParams.get('end') || getDefaultEndDate()

  // Validate dates
  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)

  const dateValidation = validateDateRange(startDateObj, endDateObj)
  if (!dateValidation.valid && dateValidation.error) {
    return NextResponse.json(
      {
        error: dateValidation.error.message,
        suggestion: dateValidation.error.suggestion,
        timestamp: new Date().toISOString(),
      },
      { status: dateValidation.error.statusCode }
    )
  }

  try {
    // Build params
    const params: QB[ReportName]Params = {
      start_date: startDate,
      end_date: endDate,
    }

    // Build report URL
    const reportParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        reportParams.set(key, String(value))
      }
    })
    reportParams.set('minorversion', '65')

    // Fetch raw report with retry
    const client = new QuickBooksClient({ organizationId })
    const rawReport = await withRetry(() =>
      client.request(`/reports/[ReportName]?${reportParams.toString()}`)
    )

    // Transform to normalized format
    const normalized = transform[ReportName](rawReport)

    // Get organization info
    const orgInfo = await withRetry(() => client.getCompanyInfo()).catch((err) => {
      console.error('[[ReportName]] Failed to fetch org info:', err)
      return null
    })

    // Extract currency and company name
    const getCurrency = (info: any): string => {
      if (info?.HomeCurrency?.value) return info.HomeCurrency.value
      if (info?.currency_code) return info.currency_code
      if (info?.Country === 'US') return 'USD'
      if (info?.Country === 'CA') return 'CAD'
      if (info?.Country === 'GB') return 'GBP'
      if (info?.Country === 'AU') return 'AUD'
      if (info?.Country === 'HK') return 'HKD'
      return 'USD'
    }

    const currency = getCurrency(orgInfo)
    const organizationName = orgInfo?.CompanyName || orgInfo?.name || 'Organization'

    // Enrich with business logic
    const enriched = await enrich[ReportName](normalized, organizationId, {
      startDate,
      endDate,
      currency,
      organizationName,
    })

    // Add query time
    enriched.data.metadata = {
      ...enriched.data.metadata,
      queryTime: Date.now() - startTime,
    }

    return NextResponse.json(enriched)
  } catch (error) {
    return formatErrorResponse(error, 'Failed to generate [report name] report')
  }
})
```

### 5.2 Enricher Template

```typescript
/**
 * [Report Name] Enricher
 *
 * Takes normalized [report name] data and enriches it with:
 * - KPIs: [list key metrics]
 * - Calculations: [list calculations]
 * - Breakdowns: [list category breakdowns]
 * - Insights: [list insights generated]
 */

import { /* import calculation functions */ } from '@/lib/utils/financial/reportCalculations'

interface Normalized[ReportName] {
  // Define normalized structure
}

interface Enriched[ReportName] {
  reportType: string
  organizationId: string
  organizationName: string
  fromDate: string
  toDate: string
  currency: string
  generated: string
  data: {
    kpis: {
      // Define KPI structure
    }
    // Define other data structures
    metadata: {
      dataCompleteness: {
        // Define completeness checks
      }
      dataQuality: {
        isComplete: boolean
        hasPartialData: boolean
        errors: any[]
        warnings: any[]
      }
    }
  }
}

export async function enrich[ReportName](
  normalizedData: Normalized[ReportName],
  organizationId: string,
  options: {
    startDate: string
    endDate: string
    currency?: string
    organizationName?: string
  }
): Promise<Enriched[ReportName]> {
  const { startDate, endDate, currency = 'USD', organizationName = 'Organization' } = options

  // Calculate KPIs
  const kpi1 = calculateKPI1(normalizedData.field1, normalizedData.field2)
  const kpi2 = calculateKPI2(normalizedData.field3, normalizedData.field4)

  // Build category breakdowns
  const categoryBreakdown = normalizedData.items.map((item) => ({
    name: item.name,
    value: item.value,
    percentage: normalizedData.total > 0 ? (item.value / normalizedData.total) * 100 : 0,
  }))

  // Build enriched response
  return {
    reportType: '[report_type]',
    organizationId,
    organizationName,
    fromDate: startDate,
    toDate: endDate,
    currency,
    generated: new Date().toISOString(),
    data: {
      kpis: {
        // Return calculated KPIs
      },
      categoryBreakdown,
      metadata: {
        dataCompleteness: {
          // Check data completeness
        },
        dataQuality: {
          isComplete: true,
          hasPartialData: false,
          errors: [],
          warnings: [],
        },
      },
    },
  }
}
```

### 5.3 SWR Hook Template

```typescript
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Use[ReportName]Options {
  startDate?: string
  endDate?: string
  // Add other options
}

export function use[ReportName](options: Use[ReportName]Options = {}) {
  const { startDate, endDate } = options

  // Build query parameters
  const params = new URLSearchParams()
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)

  const queryString = params.toString()
  const url = `/api/quickbooks/reports/[report-name]${queryString ? `?${queryString}` : ''}`

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000, // 30 seconds
  })

  return {
    report: data,
    isLoading,
    isError: error,
    currency: data?.currency,
    organizationName: data?.organizationName,
    kpis: data?.data?.kpis,
    mutate,
  }
}
```

---

## 6. Testing & Verification

### 6.1 Manual Testing Steps

1. **Start Development Server**

   ```bash
   npm run dev
   ```

2. **Test API Endpoint**
   - Visit: `http://localhost:3000/api/quickbooks/reports/balance-sheet`
   - Verify JSON response structure
   - Check that `currency` is correct (not USD for HKD accounts)
   - Check that `organizationName` is correct

3. **Test with Query Parameters**
   - `?date=2024-12-31` - Specific date
   - `?accounting_method=Cash` - Cash basis
   - `?details=false` - No detailed breakdown

4. **Test Error Scenarios**
   - Invalid date: `?date=invalid`
   - No QuickBooks connection
   - Rate limiting (rapid requests)

5. **Verify Frontend Integration** (once implemented)
   - Navigate to Balance Sheet page
   - Check that data displays correctly
   - Verify currency formatting
   - Check trend chart (if applicable)
   - Test date picker

### 6.2 Automated Tests

```typescript
// tests/api/reports/balance-sheet.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/quickbooks/reports/balance-sheet/route'

describe('Balance Sheet API', () => {
  beforeEach(() => {
    // Setup mocks
  })

  describe('Query Parameters', () => {
    it('should use default date if not provided', async () => {
      // Test implementation
    })

    it('should accept custom date', async () => {
      // Test implementation
    })

    it('should validate date format', async () => {
      // Test implementation
    })
  })

  describe('Data Transformation', () => {
    it('should transform QuickBooks data to normalized format', async () => {
      // Test implementation
    })

    it('should handle different accounting standards', async () => {
      // Test implementation
    })
  })

  describe('Enrichment', () => {
    it('should calculate KPIs correctly', async () => {
      // Test implementation
    })

    it('should include currency from orgInfo', async () => {
      // Test implementation
    })

    it('should include organization name', async () => {
      // Test implementation
    })
  })

  describe('Error Handling', () => {
    it('should return 400 for invalid dates', async () => {
      // Test implementation
    })

    it('should return 401 for authentication errors', async () => {
      // Test implementation
    })

    it('should retry on rate limit errors', async () => {
      // Test implementation
    })
  })
})
```

### 6.3 Integration Tests

```typescript
// tests/integration/balance-sheet.test.ts
import { describe, it, expect } from 'vitest'

describe('Balance Sheet Integration', () => {
  it('should fetch real data from QuickBooks', async () => {
    // Test with real QB connection
  })

  it('should reconcile accounting equation', async () => {
    // Assets = Liabilities + Equity
  })

  it('should match QuickBooks UI values', async () => {
    // Compare with known QB values
  })
})
```

### 6.4 Performance Tests

```typescript
// tests/performance/balance-sheet.test.ts
import { describe, it, expect } from 'vitest'

describe('Balance Sheet Performance', () => {
  it('should respond within 3 seconds', async () => {
    const start = Date.now()
    await fetch('/api/quickbooks/reports/balance-sheet')
    const duration = Date.now() - start
    expect(duration).toBeLessThan(3000)
  })

  it('should cache responses for 30 seconds', async () => {
    // Test caching behavior
  })
})
```

---

## 7. Troubleshooting Common Issues

### 7.1 Currency Shows "USD" Instead of Correct Currency

**Problem:** Report shows USD for a HKD account

**Solution:**

1. Check `getCurrency()` function implementation
2. Verify `orgInfo.HomeCurrency.value` is being checked first
3. Add logging to see what QB API returns:
   ```typescript
   console.log('[Currency Debug]', JSON.stringify(orgInfo.HomeCurrency))
   ```
4. Ensure `getCurrency()` is called and passed to enricher

### 7.2 Company Name Not Showing

**Problem:** Organization name shows "Organization" instead of actual name

**Solution:**

1. Check `orgInfo.CompanyName` field
2. Add fallback to `orgInfo.name`
3. Verify enricher receives `organizationName` option
4. Check that enricher includes it in response

### 7.3 Trend Chart Has No Data

**Problem:** Trend chart is empty or not rendering

**Solution:**

1. Verify `/trend` endpoint is implemented
2. Check that `summarize_column_by: "Month"` is set
3. Ensure frontend calls trend hook:
   ```typescript
   const { trendData } = useBalanceSheetTrend()
   ```
4. Verify data mapping in trend endpoint matches frontend expectations

### 7.4 TypeScript Errors

**Problem:** Type errors during compilation

**Solution:**

1. Import types from `@/quickbooks/types/reports`
2. Define return types for all functions
3. Use optional chaining for nested fields: `data?.kpis?.totalAssets`
4. Run `npm run typecheck` to find issues

### 7.5 Rate Limiting Issues

**Problem:** API returns 429 errors

**Solution:**

1. Verify `withRetry()` is used for all QB API calls
2. Check retry configuration (max retries, delay)
3. Add exponential backoff
4. Cache responses with SWR (30-60 seconds)

### 7.6 Totals Don't Balance

**Problem:** Assets ≠ Liabilities + Equity

**Solution:**

1. Check section total extraction in transformer
2. Verify `getSectionTotal()` is used correctly
3. Handle combined liabilities+equity sections
4. Add reconciliation validation in enricher

---

## 8. Best Practices Summary

### 8.1 API Design

- ✅ Use `withActiveProvider` middleware
- ✅ Implement `withRetry` for resilience
- ✅ Validate input parameters
- ✅ Format consistent error responses
- ✅ Include query time in metadata

### 8.2 Data Transformation

- ✅ Separate transformation (normalization) from enrichment (business logic)
- ✅ Handle international accounting standards
- ✅ Support optional data (P&L for BS enrichment)
- ✅ Calculate totals from items if summary missing

### 8.3 Frontend Integration

- ✅ Use SWR for data fetching and caching
- ✅ Extract currency and org name from API
- ✅ Use `useMemo` for derived data
- ✅ Implement loading and error states
- ✅ Responsive grid layouts

### 8.4 Testing

- ✅ Unit test transformers and enrichers
- ✅ Integration test with real QB data
- ✅ Performance test response times
- ✅ Test error scenarios

### 8.5 Code Quality

- ✅ Type everything with TypeScript
- ✅ Document functions with JSDoc
- ✅ Use descriptive variable names
- ✅ Keep functions under 50 lines
- ✅ Extract reusable utilities

---

## Conclusion

This template provides a comprehensive guide for migrating QuickBooks reports to the unified API architecture. By following these patterns from the P&L implementation, you can ensure:

- **Consistency** - All reports follow the same structure
- **Reliability** - Retry logic and error handling built-in
- **Correctness** - Currency and company name extracted properly
- **Performance** - Caching and efficient data fetching
- **Maintainability** - Clear separation of concerns

The P&L report serves as a proven reference implementation. Copy its patterns, adapt for your report's specific needs, and follow the step-by-step guide to avoid common pitfalls.

**Key Takeaways:**

1. Use QuickBooksClient with withRetry for all API calls
2. Transform raw QB data before enriching
3. Extract currency from HomeCurrency.value
4. Pass currency and organizationName to enricher
5. Create separate /trend endpoints for time-series data
6. Use SWR hooks for frontend data fetching
7. Test thoroughly with real QuickBooks accounts
