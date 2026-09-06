# AR Aging API Endpoint Comparison - Research Findings

## Executive Summary

The AR aging data **works in `/dev/qb` page but fails in `useAgedReceivables` hook** because they use **completely different API endpoints** with different authentication mechanisms and data flow.

---

## The Two Different Endpoints

### 1. `/api/quickbooks/reports` (Working - used by /dev/qb)

**Location:** `/src/app/api/quickbooks/reports/route.ts`

**Authentication:**

- Requires explicit `orgId` parameter in query string
- Creates its own QuickBooksClient instance
- Direct token management via DynamoDB

**Key Characteristics:**

```typescript
// Line 59-64: Requires orgId parameter
const orgId = searchParams.get('orgId')
if (!orgId) {
  return NextResponse.json({ error: 'Missing orgId parameter' }, { status: 400 })
}

// Line 123: Creates own QuickBooks client
const client = new QuickBooksClient({ organizationId: orgId })

// Line 138: Directly fetches from QuickBooks API
const rawReport = await client.request(endpoint)
```

**Parameters:**

- `orgId` (REQUIRED) - Organization ID
- `type` (REQUIRED) - Report type (e.g., "AgedReceivables")
- `start_date` (optional) - YYYY-MM-DD format
- `end_date` (optional) - YYYY-MM-DD format
- `summarize_column_by` (optional) - Total, Month, Quarter, Year
- `accounting_method` (optional) - Accrual or Cash
- `normalized` (optional) - Whether to return normalized data (default: true)

**Call from /dev/qb page (line 932-942):**

```typescript
const params = new URLSearchParams({
  orgId: organizationId, // ✅ Explicit orgId
  type: selectedReportType, // ✅ Type parameter
})

if (reportStartDate) params.set('start_date', reportStartDate)
if (reportEndDate) params.set('end_date', reportEndDate)

const response = await fetch(`/api/quickbooks/reports?${params}`)
```

---

### 2. `/api/reports/aged-receivables` (Failing - used by useAgedReceivables)

**Location:** `/src/app/api/reports/aged-receivables/route.ts`

**Authentication:**

- Uses `withActiveProvider` HOC wrapper
- Automatic authentication via JWT token from cookies/headers
- Auto-resolves organizationId from authenticated user
- Auto-determines active provider

**Key Characteristics:**

```typescript
// Line 338: Wrapped with withActiveProvider HOC
export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    // ✅ organizationId automatically provided by HOC
    // ✅ provider automatically determined
    // ✅ apiClient pre-configured with auth

    // Line 342: Only needs date parameter
    const asOfDate = searchParams.get('date') || getDefaultAsOfDate()

    // Line 366: Uses provider abstraction layer
    const arData = await (provider.reports.agedReceivables as any)(
      organizationId,
      { end_date: asOfDate },
      apiClient
    )
  }
)
```

**Parameters:**

- `date` (optional) - As-of date for the report (defaults to today)
- `details` (optional) - Include detailed invoice data (default: true)
- **NO orgId needed** - automatically extracted from JWT token

**Call from useAgedReceivables hook (line 397-402):**

```typescript
const params = new URLSearchParams()
if (asOfDate) params.append('date', asOfDate) // ✅ Only date parameter
params.append('details', 'true')

const { data, error, isLoading, mutate } = useSWR<ReportResponse>(
  asOfDate ? `/api/reports/aged-receivables?${params.toString()}` : null,
  fetcher
)
```

---

## Why One Works and One Fails

### ✅ /dev/qb Page Works Because:

1. **Explicit authentication** - Passes `orgId` directly in URL
2. **Self-contained** - Creates its own QB client, doesn't rely on session
3. **Direct API access** - Goes straight to QuickBooks without abstraction
4. **No provider abstraction** - Bypasses the provider layer entirely

### ❌ useAgedReceivables Fails Because:

1. **Depends on JWT authentication** - Requires valid session cookie/token
2. **Provider abstraction layer** - Goes through `withActiveProvider` → provider interface
3. **Active provider resolution** - Must determine which provider is active for user
4. **More complex auth chain:**
   ```
   Request → withActiveProvider → TokenVerifier.verify() →
   getUserOrganizationId() → getActiveProviderForUser() →
   getProviderCredentialsFromDB() → ProviderApiClient →
   provider.reports.agedReceivables()
   ```

---

## Authentication Flow Comparison

### /api/quickbooks/reports (Simple)

```
1. Client provides orgId in URL
2. Create QuickBooksClient(orgId)
3. Fetch tokens from DynamoDB
4. Make API request
5. Return data
```

### /api/reports/aged-receivables (Complex)

```
1. Extract JWT from request headers/cookies
2. Verify JWT signature and expiration
3. Extract userId from JWT
4. Look up user's organizationId in database
5. Determine active provider for user
6. Validate provider is connected
7. Get provider credentials from database
8. Create ProviderApiClient with credentials
9. Call provider.reports.agedReceivables()
10. Provider makes API request
11. Return data
```

---

## Detailed withActiveProvider Flow

The `withActiveProvider` HOC (Higher Order Component) performs these steps:

```typescript
// Line 64: 1. Verify authentication
const { userId } = await TokenVerifier.verify(request)

// Line 82: 2. Get organization ID
const organizationId = await getUserOrganizationId(userId)

// Line 88: 3. Determine active provider
const providerId = await getActiveProviderForUser(userId)

// Line 108: 4. Get provider credentials
const credentials = await getProviderCredentialsFromDB(organizationId, providerId)

// Line 119: 5. Get provider instance
const provider = getProvider(providerId, organizationId)

// Line 146: 6. Create API client
const apiClient = new ProviderApiClient(organizationId, providerId, apiBaseUrl)

// Line 184: 7. Call handler with context
return await handler(request, context)
```

**Each step can fail:**

- Invalid JWT → 401 "Authentication required"
- No organizationId → 404 "No organization found for user"
- No active provider → 400 "No financial provider connected"
- Invalid provider credentials → 404 "quickbooks not connected"
- Provider instance unavailable → 500 "Provider not available"

---

## Root Cause Analysis

The failure likely occurs at one of these points in the `withActiveProvider` chain:

### Most Likely Causes:

1. **JWT Token Issues** (Line 64)
   - Cookie not being sent with request
   - Token expired but not refreshed
   - Token signature invalid
   - Token missing userId claim

2. **Provider Not Connected** (Line 109-116)

   ```typescript
   if (!credentials || !credentials.connected) {
     return NextResponse.json(
       { error: `${providerId} not connected for this organization` },
       { status: 404 }
     )
   }
   ```

3. **No Active Provider Set** (Line 89-98)

   ```typescript
   if (!providerId) {
     return NextResponse.json({ error: 'No financial provider connected' }, { status: 400 })
   }
   ```

4. **QuickBooks Token Expired** (in ProviderApiClient)
   - Access token expired and refresh failed
   - Refresh token expired/revoked → requires reconnect
   - Invalid grant error from QuickBooks OAuth

---

## Data Flow Differences

### /api/quickbooks/reports

```
Client → API Route → QuickBooksClient → QB API → Transform → Response
         (orgId)     (DynamoDB tokens)
```

### /api/reports/aged-receivables

```
Client → API Route → withActiveProvider → Provider Layer → QB API → Response
         (JWT)       (auth chain)         (abstraction)
```

---

## QuickBooks API Parameters

Based on official Intuit documentation and code analysis:

### Standard Report Parameters (Line 87-117 in route.ts):

- `start_date` - Start date in YYYY-MM-DD format
- `end_date` - End date in YYYY-MM-DD format
- `date_macro` - Predefined date ranges ("This Fiscal Year-to-date", etc.)
- `summarize_column_by` - Total, Month, Quarter, Year
- `accounting_method` - Accrual or Cash
- `customer` - Filter by customer
- `vendor` - Filter by vendor
- `department` - Filter by department
- `class` - Filter by class
- `minorversion` - API version (set to 65 for latest features)

### AgedReceivables Specific:

The aged receivables report typically uses:

- `end_date` or `date` - The "as of" date for aging calculation
- No `start_date` needed (it's a snapshot at a point in time)
- Aging is calculated from invoice due dates to the as-of date

---

## Recommendations

### To Fix the useAgedReceivables Hook:

1. **Add Debug Logging** to identify exact failure point:

   ```typescript
   // In withActiveProvider.ts
   console.log('Auth step:', { userId })
   console.log('Org step:', { organizationId })
   console.log('Provider step:', { providerId })
   console.log('Credentials step:', { connected: credentials?.connected })
   ```

2. **Check JWT Token Propagation:**
   - Verify SWR fetcher includes credentials
   - Check if cookies are being sent with request
   - Validate token hasn't expired

3. **Verify Provider Connection:**
   - Check database for provider credentials
   - Ensure `connected: true` flag is set
   - Validate active provider is set for user

4. **Alternative Solution - Use Working Endpoint:**
   If fixing the auth chain is complex, consider updating the hook to use the working endpoint:

   ```typescript
   export function useAgedReceivables(asOfDate?: string) {
     const { user } = useUser() // Get user's org ID
     const params = new URLSearchParams({
       orgId: user?.organizationId,
       type: 'AgedReceivables',
     })
     if (asOfDate) params.set('end_date', asOfDate)

     return useSWR(
       user?.organizationId ? `/api/quickbooks/reports?${params.toString()}` : null,
       fetcher
     )
   }
   ```

---

## Sources

Research based on:

- QuickBooks API Documentation: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/apagingdetail
- Intuit Reports API: https://help.developer.intuit.com/s/topic/0TOG00000004qzjOAA/reports-api
- QuickBooks Online Accounting API: https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api
- Local codebase analysis of:
  - `/src/app/dev/qb/page.tsx` (lines 920-954)
  - `/src/hooks/useReportData.ts` (lines 396-419)
  - `/src/app/api/quickbooks/reports/route.ts` (full file)
  - `/src/app/api/reports/aged-receivables/route.ts` (full file)
  - `/src/lib/providers/withActiveProvider.ts` (full file)

---

## Next Steps

1. **Immediate debugging**: Add console logs at each step of withActiveProvider chain
2. **Check authentication**: Verify JWT token is valid and contains userId
3. **Validate provider**: Ensure QuickBooks is connected and active for the user
4. **Test credentials**: Check database for valid, non-expired provider credentials
5. **Consider consolidation**: Evaluate if both endpoints are needed or if one pattern should be standardized

---

**Generated:** 2025-12-26
**Research Agent:** Claude Sonnet 4.5
**Codebase:** zenith-os
**Branch:** sales-crash
