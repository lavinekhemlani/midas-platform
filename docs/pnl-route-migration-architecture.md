# P&L Route Migration Architecture Documentation

**Date**: December 12, 2025
**Research Agent**: Research and Analysis Agent
**Status**: Migration Complete

---

## Executive Summary

The Profit and Loss (P&L) report migration represents a comprehensive refactoring of the QuickBooks reporting infrastructure in the Midas Next.js application. This migration introduces a clean, provider-agnostic architecture with separation of concerns between data transformation, business logic enrichment, and presentation.

**Key Improvements:**

- ✅ Provider abstraction through `withActiveProvider` HOC
- ✅ Clean separation: transformation → enrichment → presentation
- ✅ Dedicated currency handling endpoint with caching
- ✅ Comprehensive error handling with retry logic
- ✅ SWR-based data fetching with intelligent caching
- ✅ Modular utility functions for reusability

---

## Architecture Overview

### 1. File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── quickbooks/reports/
│   │   │   ├── profit-loss/
│   │   │   │   ├── route.ts           # Main P&L endpoint
│   │   │   │   └── trend/
│   │   │   │       └── route.ts       # Monthly trend endpoint
│   │   └── organization/
│   │       └── currency/
│   │           └── route.ts            # Currency metadata endpoint
│   ├── (main)/reports/
│   │   ├── views/
│   │   │   └── PnLView.tsx             # Main view component
│   │   └── components/pnl/
│   │       └── PnLMetricsGrid.tsx      # Metrics display component
├── hooks/
│   └── useReportData.ts                # SWR hooks for data fetching
├── quickbooks/
│   ├── reports/
│   │   ├── transformers.ts             # Data normalization
│   │   └── enrichers/
│   │       └── profit-loss.ts          # Business logic enrichment
│   └── utils/
│       ├── route-helpers.ts            # Shared route utilities
│       └── report-helpers.ts           # Report-specific helpers
└── lib/
    └── providers/
        ├── withActiveProvider.ts       # Provider abstraction HOC
        └── quickbooks/
            └── client.ts                # QuickBooks API client
```

---

## Data Flow Architecture

### Complete Request Flow

```
User Interaction
    ↓
Frontend: PnLView.tsx
    ↓
Hooks: useProfitLossData() + usePnLMonthlyTrend()
    ↓
API Routes: /api/quickbooks/reports/profit-loss
    ↓
Provider Abstraction: withActiveProvider()
    ↓
QuickBooks Client: request() with retry logic
    ↓
Transform: transformProfitAndLoss()
    ↓
Enrich: enrichProfitAndLoss()
    ↓
Response: JSON with normalized data
    ↓
Frontend: Display with PnLMetricsGrid
```

### Layer-by-Layer Breakdown

#### **Layer 1: API Routes** (`src/app/api/quickbooks/reports/profit-loss/route.ts`)

**Responsibilities:**

- Request validation
- Date range processing
- Coordinate transformation and enrichment
- Error handling

**Key Features:**

```typescript
// Provider-agnostic with automatic authentication
export const GET = withActiveProvider(async (request, { organizationId, apiClient }) => {
  // 1. Date validation
  const dateValidation = validateDateRange(startDateObj, endDateObj)

  // 2. Fetch raw data with retry logic
  const rawReport = await withRetry(() =>
    client.request(`/reports/ProfitAndLoss?${reportParams.toString()}`)
  )

  // 3. Transform raw data
  const normalized = transformProfitAndLoss(rawReport)

  // 4. Get currency metadata
  const orgInfo = await withRetry(() => client.getCompanyInfo())
  const currency = getCurrency(orgInfo)

  // 5. Enrich with business logic
  const enriched = await enrichProfitAndLoss(normalized, organizationId, {
    includeDetails,
    startDate,
    endDate,
    currency,
    organizationName,
  })

  return NextResponse.json(enriched)
})
```

**Trend Endpoint** (`src/app/api/quickbooks/reports/profit-loss/trend/route.ts`):

- Fetches monthly aggregated P&L data
- Separate endpoint to allow core P&L to load faster
- Smart aggregation based on date range

---

#### **Layer 2: Provider Abstraction** (`src/lib/providers/withActiveProvider.ts`)

**Purpose:** Generic HOC for any provider-based route

**Flow:**

```typescript
withActiveProvider(handler) {
  // 1. Verify authentication
  const { userId } = await TokenVerifier.verify(request)

  // 2. Get organization ID
  const organizationId = await getUserOrganizationId(userId)

  // 3. Determine active provider (QuickBooks, Zoho, Xero)
  const providerId = await getActiveProviderForUser(userId)

  // 4. Get provider credentials
  const credentials = await getProviderCredentialsFromDB(organizationId, providerId)

  // 5. Create provider-specific API client
  const apiClient = new ProviderApiClient(organizationId, providerId, apiBaseUrl)

  // 6. Execute handler with context
  return handler(request, {
    provider,
    apiClient,
    organizationId,
    userId,
    providerId
  })
}
```

**Benefits:**

- Single source of truth for authentication
- Easy to add new providers
- Automatic error handling for auth issues
- Plan detection for QuickBooks (SimpleStart, Essentials, Plus, Advanced)

---

#### **Layer 3: QuickBooks Client** (`src/lib/providers/quickbooks/client.ts`)

**Key Features:**

1. **Token Management:**

   ```typescript
   // Auto-refresh with force option for 401 errors
   private async ensureValidToken(forceRefresh: boolean = false)

   // If 401 received, force token refresh and retry once
   if (response.status === 401 && retryCount === 0) {
     await this.ensureValidToken(true)
     return this.request(endpoint, options, retryCount + 1)
   }
   ```

2. **Rate Limiting:**
   - Global rate limiter across all requests
   - Exponential backoff for rate limit errors
   - Respects `Retry-After` headers

3. **Error Recovery:**
   - Automatic token refresh on 401
   - Retry logic with exponential backoff
   - Self-signed certificate support for proxy

4. **Proxy Support:**
   ```typescript
   // Routes through proxy with /qb prefix
   url = `${QUICKBOOKS_PROXY_URL}/qb/v3/company/${realmId}${endpoint}`
   headers['x-qb-sandbox'] = USE_SANDBOX ? 'true' : 'false'
   ```

---

#### **Layer 4: Data Transformation** (`src/quickbooks/reports/transformers.ts`)

**Purpose:** Normalize raw QuickBooks data into a consistent format

**Process:**

```typescript
export function transformProfitAndLoss(report: QBReportResponse): NormalizedProfitAndLoss {
  // 1. Extract column headers (for multi-period reports)
  const columns = extractColumnHeaders(report)

  // 2. Find main sections using aliases for international standards
  const incomeSection = findSection(rows, 'Income') // Supports 'Revenue', 'TotalIncome', etc.
  const cogsSection = findSection(rows, 'COGS')
  const expensesSection = findSection(rows, 'Expenses')

  // 3. Process each section recursively
  const income = processSection(incomeSection)
  const cogs = processSection(cogsSection)

  // 4. Calculate derived values
  const grossProfit = income.total - cogs.total
  const netIncome = grossProfit - expenses.total + otherIncome.total - otherExpenses.total

  // 5. Return normalized structure
  return {
    reportName,
    startDate,
    endDate,
    currency,
    income: { lines, total },
    costOfGoodsSold: { lines, total },
    grossProfit,
    expenses: { lines, total },
    netIncome,
    columns,
  }
}
```

**Key Patterns:**

1. **International Support:**

   ```typescript
   const groupAliases: Record<string, string[]> = {
     Income: ['Income', 'Revenue', 'TotalIncome', 'GrossIncome'],
     COGS: ['COGS', 'CostOfGoodsSold', 'CostOfSales'],
     Expenses: ['Expenses', 'TotalExpenses', 'OperatingExpenses'],
   }
   ```

2. **Recursive Section Processing:**
   - Handles nested account structures
   - Preserves hierarchy for display
   - Aggregates summaries correctly

3. **Value Parsing:**
   ```typescript
   function parseAmount(value: string): number {
     // Handle currency symbols, commas
     let cleaned = value.replace(/[$,\s]/g, '')
     // Handle parenthetical negatives: (100) → -100
     if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
       cleaned = '-' + cleaned.slice(1, -1)
     }
     return parseFloat(cleaned)
   }
   ```

---

#### **Layer 5: Business Logic Enrichment** (`src/quickbooks/reports/enrichers/profit-loss.ts`)

**Purpose:** Add calculated metrics, insights, and validation

**Process:**

```typescript
export async function enrichProfitAndLoss(normalizedData, organizationId, options) {
  // 1. Reconcile data (detect double-counting issues)
  const validatedPL = reconcilePnLData(normalizedData)

  // 2. Build revenue breakdown with contra-revenue detection
  const revenueByCategory = validatedPL.income?.lines.map(item => ({
    name: item.name,
    value: item.value,  // Preserve sign for contra-revenue (discounts, refunds)
    isContraRevenue: item.value < 0,
    percentage: (Math.abs(item.value) / validatedPL.total_income) * 100
  }))

  // 3. Calculate TRUE total expenses (COGS + Operating + Other)
  const trueTotalExpenses = calculateTotalExpenses(
    validatedPL.cogs_total,
    validatedPL.total_expenses,
    validatedPL.other_expenses
  )

  // 4. Build expense categories with proper section labels
  const expenseCategories = [
    ...validatedPL.costOfGoodsSold?.lines.map(item => ({
      name: item.name,
      section: 'COGS',
      amount: Math.abs(item.value)
    })),
    ...validatedPL.expenses?.lines.map(item => ({
      name: item.name,
      section: 'Operating',
      amount: Math.abs(item.value)
    })),
    ...validatedPL.otherExpenses?.lines.map(item => ({
      name: item.name,
      section: 'Other',
      amount: Math.abs(item.value)
    }))
  ]

  // 5. Calculate KPIs
  const kpis = {
    totalRevenue: validatedPL.total_income,
    totalExpenses: trueTotalExpenses,
    netIncome: validatedPL.net_income,
    grossProfit: validatedPL.gross_profit,
    costOfGoodsSold: validatedPL.cogs_total,
    grossMargin: calculateGrossMargin(validatedPL.gross_profit, validatedPL.total_income),
    operatingMargin: calculateOperatingMargin(...),
    // EBITDA components
    interestExpense,
    taxExpense,
    depreciationAmortization,
    ebitda: netIncome + interestExpense + taxExpense + depreciationAmortization,
    // Burn rate calculations
    grossBurnRate: trueTotalExpenses / monthsInPeriod,
    netBurnRate: (trueTotalExpenses - totalRevenue) / monthsInPeriod,
    cashBalance: await getCashAndEquivalents(organizationId)
  }

  // 6. Generate insights
  const insights = generatePnLInsights(validatedPL)

  return { reportType, organizationId, data: { kpis, ... } }
}
```

**Key Calculations:**

| Metric            | Formula                              | Notes                                 |
| ----------------- | ------------------------------------ | ------------------------------------- |
| Gross Margin      | `(Gross Profit ÷ Revenue) × 100`     | Pricing power & production efficiency |
| Operating Margin  | `(Operating Income ÷ Revenue) × 100` | Core business efficiency              |
| Net Profit Margin | `(Net Income ÷ Revenue) × 100`       | Ultimate profitability measure        |
| Expense Ratio     | `(Total Expenses ÷ Revenue) × 100`   | Overall cost efficiency               |
| COGS Ratio        | `(COGS ÷ Revenue) × 100`             | Direct production costs               |
| Gross Burn Rate   | `Total Expenses ÷ Months`            | Monthly cash outflow                  |
| Net Burn Rate     | `(Expenses - Revenue) ÷ Months`      | Net monthly cash change               |
| Runway            | `Cash Balance ÷ Gross Burn Rate`     | Months until cash depletion           |

---

#### **Layer 6: Currency Handling** (`src/app/api/organization/currency/route.ts`)

**Purpose:** Lightweight endpoint for currency and organization metadata

**Strategy:**

```typescript
export const GET = withActiveProvider(async (request, { organizationId, providerId }) => {
  // 1. Check DynamoDB cache first (stored during OAuth connection)
  const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)

  if (storedMetadata.homeCurrency) {
    return NextResponse.json({
      currency: storedMetadata.homeCurrency,
      organizationName: storedMetadata.companyName,
      source: 'stored',
    })
  }

  // 2. Migration path: fetch from provider API if not cached
  const orgInfo = await qbClient.getCompanyInfo()

  // 3. Extract currency with fallback logic
  const getCurrency = (info) => {
    if (info?.HomeCurrency?.value) return info.HomeCurrency.value // QuickBooks
    if (info?.currency_code) return info.currency_code // Zoho
    // Country-based inference
    if (info?.Country === 'US') return 'USD'
    if (info?.Country === 'HK') return 'HKD'
    return 'USD'
  }

  const currency = getCurrency(orgInfo)

  // 4. Store for future requests
  await updateProviderCompanyMetadata(organizationId, providerId, {
    homeCurrency: currency,
    companyName: orgInfo?.CompanyName || orgInfo?.name,
  })

  return NextResponse.json({ currency, source: 'api' })
})
```

**Benefits:**

- **Performance:** Avoids repeated QuickBooks API calls
- **Caching:** Stored in DynamoDB during OAuth connection
- **Fallback:** Country-based inference if direct extraction fails
- **Migration:** Automatically caches on first request for existing users

---

#### **Layer 7: Frontend Data Fetching** (`src/hooks/useReportData.ts`)

**Purpose:** SWR-based hooks with intelligent caching

**Main P&L Hook:**

```typescript
export function useProfitLossData(options: {
  startDate?: string
  endDate?: string
  enabled?: boolean
}) {
  const params = new URLSearchParams()
  if (options.startDate) params.append('start', options.startDate)
  if (options.endDate) params.append('end', options.endDate)
  params.append('details', 'true')

  const { data, error, isLoading, isValidating, mutate } = useSWR<ReportResponse>(
    options.enabled && options.startDate && options.endDate
      ? `/api/quickbooks/reports/profit-loss?${params.toString()}`
      : null,
    fetcher,
    baseConfig
  )

  return { reportData: data, isLoading, isValidating, error, mutate }
}
```

**Trend Data Hook:**

```typescript
export function usePnLMonthlyTrend(startDate?: string, endDate?: string) {
  const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
    startDate && endDate ? `/api/quickbooks/reports/profit-loss/trend?${params}` : null,
    fetcher,
    {
      ...baseConfig,
      dedupingInterval: 30 * 60 * 1000, // 30 min cache (historical data)
    }
  )

  return { trendData: data?.data?.monthlyTrend || [], isLoading, error, mutate }
}
```

**SWR Configuration:**

```typescript
const baseConfig = {
  dedupingInterval: 30 * 60 * 1000, // 30 min cache
  focusThrottleInterval: 5 * 60 * 1000, // 5 min before revalidation
  revalidateOnFocus: false, // Prevent refetch spam
  revalidateOnMount: true, // Fresh data on page load
  revalidateIfStale: true, // Allow revalidation if stale
  revalidateOnReconnect: true, // Revalidate on network recovery
  keepPreviousData: true, // Smooth UX during revalidation
  errorRetryCount: 2, // 2 retries
  errorRetryInterval: 3000, // 3 second base interval
  // Custom retry with Retry-After respect for rate limits
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    if (error.status === 401 || error.status === 403) return // Don't retry auth errors
    if (error.status === 404) return // Don't retry 404s
    if (retryCount >= 2) return // Max 2 retries

    // Respect Retry-After for 429 rate limits
    if (error.status === 429 && error.retryAfter) {
      setTimeout(() => revalidate({ retryCount }), error.retryAfter * 1000)
      return
    }

    // Exponential backoff: 3s, 6s
    const delay = 3000 * Math.pow(2, retryCount)
    setTimeout(() => revalidate({ retryCount }), delay)
  },
}
```

**Error Handling:**

```typescript
const fetcher = async (url: string) => {
  const response = await apiClient(url)

  if (!response.ok) {
    let errorData = {}
    try {
      errorData = await response.json()
    } catch {
      errorData = { message: 'Failed to fetch report data' }
    }

    const error: any = new Error(errorData.error || errorData.message)
    error.status = response.status
    error.requiresReconnect = errorData.requiresReconnect
    error.provider = errorData.provider

    // For rate limits, attach Retry-After header
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      if (retryAfter) error.retryAfter = parseInt(retryAfter, 10)
    }

    throw error
  }

  return response.json()
}
```

---

#### **Layer 8: Frontend Presentation** (`src/app/(main)/reports/views/PnLView.tsx`)

**Architecture:**

```typescript
export function PnLView() {
  // 1. Get date range from context
  const { dateRange } = useReportsContext()
  const { currency } = useCurrency()

  // 2. Fetch data with SWR hooks
  const { reportData, isLoading, error, mutate } = useProfitLossData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: !!dateRange.start && !!dateRange.end
  })

  const { trendData, isLoading: trendLoading } = usePnLMonthlyTrend(
    dateRange.start,
    dateRange.end
  )

  // 3. Extract and calculate metrics from backend KPIs
  const data = reportData?.data || {}
  const kpis = isKpiData(data.kpis) ? data.kpis : {}

  const totalRevenue = kpis.totalRevenue || 0
  const totalExpenses = kpis.totalExpenses || 0
  const netIncome = kpis.netIncome || 0
  const grossMargin = kpis.grossMargin ?? 0  // Backend provides these
  const operatingMargin = kpis.operatingMargin ?? 0

  // 4. Build income statement table data with collapsible sections
  const incomeStatementData = useMemo(() => {
    const data: PnLItem[] = []

    // Revenue section
    data.push({
      category: 'Revenue',
      name: 'Revenue',
      amount: 0,
      isHeader: true,
      isCollapsible: true,
      isExpanded: expandedSections.has('Revenue')
    })

    if (expandedSections.has('Revenue')) {
      incomeBreakdown.forEach(item => {
        data.push({
          category: 'Revenue',
          name: item.name,
          amount: item.value,  // Preserves sign for contra-revenue
          isChild: true
        })
      })
    }

    data.push({
      name: 'Total Revenue',
      amount: totalRevenue,
      isSubtotal: true
    })

    // ... COGS, Gross Profit, Operating Expenses, Operating Income, Other Income/Expenses ...

    data.push({
      name: 'Net Income',
      amount: netIncome,
      isTotal: true,
      isFinalTotal: true
    })

    return data
  }, [expandedSections, incomeBreakdown, totalRevenue, netIncome, ...])

  // 5. Render components
  return (
    <div>
      {/* Bookkeeping validation alerts */}
      {validationIssues.length > 0 && (
        <BookkeepingValidationAlert issues={validationIssues} />
      )}

      {/* P&L metrics grid */}
      <PnLMetricsGrid
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        netIncome={netIncome}
        data={{ ...data, monthlyTrend: trendData }}
        currency={currency}
        contextData={contextData}
      />

      {/* AI analysis card */}
      <AIAnalysisCard pageType="pnl" data={...} />

      {/* Income statement table */}
      <IncomeStatementTable
        data={incomeStatementData}
        toggleSection={toggleSection}
        currency={currency}
      />
    </div>
  )
}
```

**Metrics Grid Component** (`src/app/(main)/reports/components/pnl/PnLMetricsGrid.tsx`):

```typescript
export function PnLMetricsGrid({
  totalRevenue,
  totalExpenses,
  netIncome,
  grossMarginRaw,
  operatingMarginRaw,
  data,
  currency
}) {
  return (
    <div className="grid grid-cols-1 @5xl:grid-cols-3 gap-6">
      {/* Revenue Breakdown Card */}
      <ReportCard>
        <FinancialChart
          type="horizontal-bar"
          data={incomeBreakdown}
          formatValue={(value) => formatPnLCurrency(value, currency)}
        />
      </ReportCard>

      {/* Expense Breakdown Card */}
      <ReportCard>
        <FinancialChart
          type="horizontal-bar"
          data={expenseBreakdown}
          formatValue={(value) => formatPnLCurrency(value, currency)}
          color="#ef4444"
        />
      </ReportCard>

      {/* P&L Flow Card */}
      <ReportCard>
        <FinancialChart
          type="horizontal-bar"
          data={plFlowData}  // Revenue, -COGS, -OpEx, +Other Income, -Other Expenses, Net Income
        />
      </ReportCard>

      {/* Monthly Trend Chart */}
      <div className="col-span-3 grid grid-cols-2 gap-6">
        <ReportCard>
          <ReportChart
            type="area"
            data={data.monthlyTrend || []}
            dataKeys={[
              { key: 'revenue', color: '#10b981', name: 'Revenue' },
              { key: 'expenses', color: '#ef4444', name: 'Expenses' },
              { key: 'netIncome', color: '#f59e0b', name: 'Net Income' }
            ]}
            xKey="month"
          />
        </ReportCard>

        {/* Key Performance Metrics */}
        <Card>
          {/* Gross Margin, Operating Margin, Net Profit Margin, Expense Ratio */}
          {/* COGS Ratio, Gross Burn Rate, EBITDA, Cash Runway */}
          <MetricTooltip calculationTooltip={...}>
            <span>Gross Margin</span>
          </MetricTooltip>
          <MetricLearnDialog termId="gross-margin" contextData={contextData} />
        </Card>
      </div>
    </div>
  )
}
```

---

## Key Patterns & Improvements

### 1. **Provider Abstraction Pattern**

**Before:**

```typescript
// Route directly coupled to QuickBooks
const credentials = await getQuickBooksCredentials(organizationId)
const qbClient = new QuickBooksClient(credentials)
const report = await qbClient.getProfitAndLoss(...)
```

**After:**

```typescript
// Generic provider abstraction
export const GET = withActiveProvider(async (request, { apiClient, organizationId }) => {
  // Works with QuickBooks, Zoho, Xero - same code!
  const report = await client.request('/reports/ProfitAndLoss?...')
})
```

**Benefits:**

- Easy to add new providers (Zoho, Xero, etc.)
- Consistent authentication handling
- Automatic plan detection
- Error handling centralized

---

### 2. **Transformer → Enricher Pattern**

**Separation of Concerns:**

| Layer           | Responsibility     | Input                    | Output                     |
| --------------- | ------------------ | ------------------------ | -------------------------- |
| **Transformer** | Normalize raw data | Provider-specific format | Consistent structure       |
| **Enricher**    | Add business logic | Normalized data          | KPIs, insights, validation |

**Example:**

```typescript
// Transformer: Pure data normalization
export function transformProfitAndLoss(rawReport) {
  return {
    income: { lines: [...], total: 0 },
    expenses: { lines: [...], total: 0 },
    netIncome: 0
  }
}

// Enricher: Business logic
export async function enrichProfitAndLoss(normalized, orgId, options) {
  return {
    kpis: {
      grossMargin: calculateGrossMargin(...),
      burnRate: calculateBurnRate(...),
      cashBalance: await getCashBalance(orgId)
    },
    insights: generateInsights(normalized)
  }
}
```

**Benefits:**

- Transformers are pure functions (testable)
- Enrichers handle async operations (DB queries, API calls)
- Easy to compose transformers for different reports

---

### 3. **Currency Handling Strategy**

**Three-Tier Approach:**

1. **DynamoDB Cache** (fastest, stored during OAuth)

   ```typescript
   const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
   if (storedMetadata.homeCurrency) return storedMetadata.homeCurrency
   ```

2. **Provider API** (fallback for migration)

   ```typescript
   const orgInfo = await qbClient.getCompanyInfo()
   const currency = orgInfo?.HomeCurrency?.value || orgInfo?.currency_code
   ```

3. **Country Inference** (last resort)
   ```typescript
   if (orgInfo?.Country === 'US') return 'USD'
   if (orgInfo?.Country === 'HK') return 'HKD'
   ```

**Benefits:**

- Minimal API calls (DynamoDB is milliseconds, QuickBooks is seconds)
- Graceful degradation
- Automatic migration for existing users

---

### 4. **Error Handling & Retry Logic**

**Route-Level Error Handling:**

```typescript
// src/quickbooks/utils/route-helpers.ts
export function formatErrorResponse(error: unknown, defaultMessage: string) {
  const config: ErrorResponseConfig = {
    message: defaultMessage,
    suggestion: 'Please try again',
    statusCode: 500,
  }

  // Authentication errors
  if (errorMessage.includes('invalid_grant')) {
    config.statusCode = 401
    config.message = 'QuickBooks authentication required'
    config.suggestion = 'Please reconnect your QuickBooks account'
  }

  // Rate limit errors
  else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    config.statusCode = 429
    config.message = 'QuickBooks rate limit exceeded'
    config.suggestion = 'Please wait a few minutes and try again'
    config.retryAfter = 120
  }

  return NextResponse.json(config, { status: config.statusCode })
}
```

**Client-Level Retry Logic:**

```typescript
// src/quickbooks/utils/route-helpers.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const isRateLimited = error?.message.includes('429')
      if (!isRateLimited || attempt === maxRetries) throw error

      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
```

**SWR Error Retry:**

```typescript
onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
  // Don't retry auth errors
  if (error.status === 401 || error.status === 403) return

  // Respect Retry-After for 429
  if (error.status === 429 && error.retryAfter) {
    setTimeout(() => revalidate({ retryCount }), error.retryAfter * 1000)
    return
  }

  // Exponential backoff
  const delay = 3000 * Math.pow(2, retryCount)
  setTimeout(() => revalidate({ retryCount }), delay)
}
```

---

### 5. **SWR Caching Strategy**

**Cache Configuration by Data Type:**

| Data Type         | Deduping Interval | Revalidate Strategy    | Rationale                            |
| ----------------- | ----------------- | ---------------------- | ------------------------------------ |
| **P&L Report**    | 30 min            | On mount, not on focus | Historical data, infrequent changes  |
| **Monthly Trend** | 30 min            | On mount, not on focus | Historical aggregation, stable       |
| **Balance Sheet** | 30 min            | On mount, not on focus | Point-in-time snapshot, stable       |
| **AR/AP Aging**   | 5 min             | On mount & reconnect   | Changes frequently with transactions |
| **Bills Data**    | 5 min             | Force on mount         | Real-time operational data           |

**Benefits:**

- Reduced API calls (QuickBooks has strict rate limits)
- Fast initial render with `keepPreviousData`
- Automatic revalidation on tab focus (when enabled)
- Intelligent retry with exponential backoff

---

### 6. **Date Validation Pattern**

```typescript
export function validateDateRange(start: Date, end: Date, maxYears: number = 5) {
  // Invalid dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      valid: false,
      error: {
        message: 'Invalid date format',
        suggestion: 'Please provide dates in YYYY-MM-DD format',
        statusCode: 400,
      },
    }
  }

  // Start after end
  if (start > end) {
    return {
      valid: false,
      error: {
        message: 'Invalid date range',
        suggestion: 'Start date must be before end date',
        statusCode: 400,
      },
    }
  }

  // Range too large
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > maxYears * 365) {
    return {
      valid: false,
      error: {
        message: 'Date range too large',
        suggestion: `Please select a period of ${maxYears} years or less`,
        statusCode: 400,
      },
    }
  }

  return { valid: true }
}
```

---

## Migration Benefits

### Performance Improvements

1. **Reduced API Calls:**
   - Currency cached in DynamoDB (eliminates repeated `getCompanyInfo()` calls)
   - SWR deduplication prevents duplicate requests
   - Trend data fetched separately (core P&L loads faster)

2. **Parallel Data Fetching:**

   ```typescript
   // Frontend fetches both in parallel
   const { reportData } = useProfitLossData(...)
   const { trendData } = usePnLMonthlyTrend(...)
   ```

3. **Intelligent Caching:**
   - 30-minute cache for historical reports
   - 5-minute cache for real-time data
   - `keepPreviousData` for smooth UX during revalidation

### Code Quality Improvements

1. **Separation of Concerns:**
   - Routes handle request/response
   - Transformers normalize data
   - Enrichers add business logic
   - Hooks manage client state
   - Components render UI

2. **Reusability:**
   - `withActiveProvider` used across all provider routes
   - `withRetry` used for any rate-limited API
   - `formatErrorResponse` standardizes error handling
   - Transformers work with any provider

3. **Testability:**
   - Pure transformation functions
   - Mocked provider clients
   - SWR hooks with mock responses

### Developer Experience

1. **Type Safety:**

   ```typescript
   interface EnrichedProfitAndLoss {
     reportType: string
     data: {
       kpis: {
         totalRevenue: number
         grossMargin: number
         // ... all metrics typed
       }
     }
   }
   ```

2. **Error Messages:**
   - Clear, actionable suggestions
   - Development mode shows full error details
   - Production mode hides sensitive information

3. **Documentation:**
   - Inline JSDoc comments
   - Type annotations
   - This architecture document

---

## Future Enhancements

### 1. **Provider Expansion**

**Zoho Books:**

```typescript
// Transformer already supports Zoho aliases
const groupAliases = {
  Income: ['Income', 'Revenue'], // Zoho uses 'Revenue'
  COGS: ['COGS', 'CostOfSales'], // Zoho uses 'CostOfSales'
}
```

**Xero:**

- Add Xero client to `/lib/providers/xero/client.ts`
- Implement transformer aliases for Xero report structure
- Update `withActiveProvider` to include Xero

### 2. **Caching Improvements**

**Redis Integration:**

```typescript
// Cache enriched reports in Redis
const cacheKey = `pnl:${organizationId}:${startDate}:${endDate}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)

const enriched = await enrichProfitAndLoss(...)
await redis.setex(cacheKey, 1800, JSON.stringify(enriched))  // 30 min TTL
```

**Benefits:**

- Share cache across multiple users
- Reduce database queries
- Faster response times

### 3. **Variance Analysis**

**Compare Periods:**

```typescript
// Enrich with previous period data
const enriched = await enrichProfitAndLoss(normalized, orgId, {
  previousPeriod: {
    startDate: '2024-01-01',
    endDate: '2024-03-31'
  }
})

// Frontend displays
<MetricCard
  value={totalRevenue}
  change={+12.5}  // % change from previous period
  trend="up"
/>
```

### 4. **Batch Report Generation**

**Multiple Reports in One Request:**

```typescript
// QuickBooks batch API
const batch = await qbClient.batch([
  { bId: '1', Query: 'SELECT * FROM ProfitAndLoss' },
  { bId: '2', Query: 'SELECT * FROM BalanceSheet' },
  { bId: '3', Query: 'SELECT * FROM CashFlow' },
])

// Counts as 1 request against rate limit instead of 3
```

### 5. **Real-Time Updates**

**WebSocket for Live Data:**

```typescript
// Subscribe to transaction changes
const ws = new WebSocket('wss://api.midas.com/realtime')
ws.on('transaction', (event) => {
  // Invalidate affected report caches
  mutate('/api/quickbooks/reports/profit-loss')
})
```

---

## Testing Strategy

### Unit Tests

**Transformers:**

```typescript
describe('transformProfitAndLoss', () => {
  it('should normalize QuickBooks P&L report', () => {
    const rawReport = mockQBReport
    const normalized = transformProfitAndLoss(rawReport)

    expect(normalized.income.total).toBe(100000)
    expect(normalized.expenses.total).toBe(80000)
    expect(normalized.netIncome).toBe(20000)
  })

  it('should handle contra-revenue accounts', () => {
    const normalized = transformProfitAndLoss(mockReportWithDiscounts)
    const discounts = normalized.income.lines.find((l) => l.name === 'Discounts')
    expect(discounts.value).toBeLessThan(0)
  })
})
```

**Enrichers:**

```typescript
describe('enrichProfitAndLoss', () => {
  it('should calculate KPIs correctly', async () => {
    const normalized = mockNormalizedPL
    const enriched = await enrichProfitAndLoss(normalized, 'org-123', options)

    expect(enriched.data.kpis.grossMargin).toBe(20) // (20k / 100k) * 100
    expect(enriched.data.kpis.netProfitMargin).toBe(20)
  })
})
```

### Integration Tests

**API Routes:**

```typescript
describe('GET /api/quickbooks/reports/profit-loss', () => {
  it('should return enriched P&L report', async () => {
    const response = await fetch(
      '/api/quickbooks/reports/profit-loss?start=2025-01-01&end=2025-03-31',
      {
        headers: { Authorization: `Bearer ${testToken}` },
      }
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.reportType).toBe('profit_loss')
    expect(data.data.kpis).toBeDefined()
  })

  it('should handle invalid date ranges', async () => {
    const response = await fetch(
      '/api/quickbooks/reports/profit-loss?start=2025-03-31&end=2025-01-01'
    )
    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error.suggestion).toContain('Start date must be before end date')
  })
})
```

### E2E Tests

**Cypress:**

```typescript
describe('P&L Report View', () => {
  it('should load and display P&L metrics', () => {
    cy.visit('/reports/profit-loss')
    cy.get('[data-testid="total-revenue"]').should('contain', '$100,000')
    cy.get('[data-testid="net-income"]').should('contain', '$20,000')
    cy.get('[data-testid="gross-margin"]').should('contain', '20%')
  })

  it('should fetch trend data and render chart', () => {
    cy.intercept('GET', '/api/quickbooks/reports/profit-loss/trend*').as('getTrend')
    cy.visit('/reports/profit-loss')
    cy.wait('@getTrend')
    cy.get('[data-testid="monthly-trend-chart"]').should('be.visible')
  })
})
```

---

## Monitoring & Debugging

### Logging Strategy

**Request Logging:**

```typescript
// QuickBooksClient logs all requests
qbLogger.logApiRequest(method, url, { headers, body })
qbLogger.logApiResponse(requestId, startTime, status, data)
```

**Error Tracking:**

```typescript
// Sentry integration
Sentry.captureException(error, {
  tags: {
    provider: 'quickbooks',
    endpoint: '/reports/ProfitAndLoss',
    organizationId,
  },
})
```

### Performance Monitoring

**API Timing:**

```typescript
const startTime = Date.now()
const report = await qbClient.request('/reports/ProfitAndLoss')
const duration = Date.now() - startTime

// Log slow requests
if (duration > 5000) {
  console.warn(`Slow QuickBooks request: ${duration}ms`)
}
```

**SWR DevTools:**

```typescript
import { SWRDevTools } from '@swr-devtools/react'

<SWRDevTools>
  <App />
</SWRDevTools>
```

---

## Conclusion

The P&L route migration demonstrates a comprehensive approach to building scalable, maintainable financial reporting infrastructure. Key achievements:

1. ✅ **Provider Abstraction** - Easy to add Zoho, Xero, or other providers
2. ✅ **Clean Architecture** - Clear separation of transformation, enrichment, and presentation
3. ✅ **Performance Optimized** - Intelligent caching, parallel fetching, reduced API calls
4. ✅ **Error Resilient** - Retry logic, graceful degradation, actionable error messages
5. ✅ **Developer Friendly** - Type-safe, testable, well-documented

This architecture serves as a template for migrating other financial reports (Balance Sheet, Cash Flow, AR/AP Aging) and can be extended to support additional providers and features.

---

**Research completed by:** Research and Analysis Agent
**Date:** December 12, 2025
**Status:** Documentation Complete ✅
