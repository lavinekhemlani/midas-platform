# Rate Limiting and Error Handling Improvements

## Overview

This document outlines the improvements made to handle QuickBooks rate limiting and prevent "0" values from showing when API calls fail.

## Problem Statement

Previously, when QuickBooks API calls failed due to rate limiting:

1. Errors were silently swallowed and empty arrays/zeros were returned
2. Frontend displayed "0" values as if they were legitimate data
3. Users had no indication that data was incomplete or unavailable
4. Retry attempts were exhausted without informing the user

## Changes Made

### 1. Backend API Routes

#### Profit & Loss Route (`src/app/api/reports/profit-loss/route.ts`)

**Changes:**

- Updated `queryWithPagination()` to throw errors instead of silently failing when rate limits are exceeded
- Added structured error tracking for monthly trend data
- Added `dataQuality` metadata to API responses
- Enhanced error responses with `retryAfter` field and `Retry-After` HTTP header
- Rate limit errors now return HTTP 429 with clear user messaging

**Before:**

```typescript
catch (error) {
  logger.error('Max retries exceeded...')
  hasMore = false  // Silent failure
}
```

**After:**

```typescript
catch (error) {
  logger.error('Max retries exceeded...')
  const rateLimitError = new Error('QuickBooks rate limit exceeded...')
  rateLimitError.code = 'RATE_LIMIT_EXCEEDED'
  throw rateLimitError  // Propagate error
}
```

#### Balance Sheet Route (`src/app/api/reports/balance-sheet/route.ts`)

**Changes:**

- Added error tracking array for supplementary data queries
- Wrapped supplementary queries with error handlers that track failures
- Added `dataQuality` metadata with detailed error information
- Enhanced error responses with rate limit detection and retry guidance

**Key Addition:**

```typescript
const dataErrors: any[] = []
const supplementaryQueries = [
  () => getAssetComposition(...).catch(err => {
    dataErrors.push({ component: 'asset_composition', error: err });
    return [];
  }),
  // ...
]
```

#### Cash Flow Route (`src/app/api/reports/cash-flow/route.ts`)

**Changes:**

- Added `dataQuality` metadata to track partial data issues
- Enhanced error categorization (rate_limit vs fetch_error)
- Added retry guidance in error responses
- Improved error message clarity

### 2. Frontend Components

#### New Component: DataQualityAlert (`src/app/(main)/reports/components/DataQualityAlert.tsx`)

**Purpose:** Display user-friendly warnings when data is incomplete

**Features:**

- Shows rate limit warnings with retry button
- Lists specific components that failed to load
- Differentiates between rate limit and other errors
- Provides actionable guidance to users

**Usage:**

```typescript
<DataQualityAlert
  metadata={pnlData.data.metadata}
  onRetry={() => mutatePnL()}
/>
```

#### Updated: SummaryView (`src/app/(main)/reports/views/SummaryView.tsx`)

**Changes:**

- Imported and integrated `DataQualityAlert` component
- Added alerts for P&L, Balance Sheet, and Cash Flow data quality issues
- Alerts appear at the top of the page when partial data is detected

### 3. Data Fetching Hooks

#### Updated: useReportData (`src/hooks/useReportData.ts`)

**Changes:**

- Enhanced error object to include `retryAfter` field
- Extracts `Retry-After` HTTP header value
- Properly propagates all error metadata to components

## API Response Structure

### Success with Complete Data

```json
{
  "reportType": "profit_loss",
  "data": {
    "kpis": {
      /* ... */
    },
    "metadata": {
      "dataQuality": {
        "isComplete": true,
        "hasPartialData": false,
        "errors": [],
        "warnings": []
      }
    }
  }
}
```

### Success with Partial Data (Rate Limited)

```json
{
  "reportType": "profit_loss",
  "data": {
    "kpis": {
      /* core data available */
    },
    "monthlyTrend": [], // Empty due to rate limit
    "metadata": {
      "dataQuality": {
        "isComplete": false,
        "hasPartialData": true,
        "errors": [
          {
            "type": "rate_limit",
            "message": "QuickBooks rate limit exceeded after 3 retries...",
            "component": "monthly_trend",
            "severity": "warning"
          }
        ],
        "warnings": [
          "Monthly trend data unavailable due to QuickBooks rate limiting. Please try again in a few minutes."
        ]
      }
    }
  }
}
```

### Complete Failure (Rate Limited)

```json
{
  "error": "QuickBooks rate limit exceeded",
  "suggestion": "QuickBooks has rate limited your requests. Please wait a few minutes and try again.",
  "retryAfter": 120,
  "timestamp": "2025-11-20T..."
}
```

**HTTP Response:**

- Status: 429 Too Many Requests
- Header: `Retry-After: 120`

## Error Types

### Rate Limit Errors

- **Code:** `RATE_LIMIT_EXCEEDED`
- **Type:** `rate_limit`
- **Severity:** `warning`
- **User Action:** Wait and retry
- **HTTP Status:** 429

### Fetch Errors

- **Type:** `fetch_error`
- **Severity:** `error`
- **User Action:** Report or try again
- **HTTP Status:** Varies

## User Experience Improvements

### Before

1. User sees "0" for revenue, expenses, etc.
2. No indication that data is incomplete
3. User might make decisions based on incorrect "0" values
4. No guidance on how to fix the issue

### After

1. User sees clear warning: "Some data is unavailable due to rate limiting"
2. Core financial data (KPIs) are still displayed
3. Specific components that failed are listed
4. "Retry" button available to attempt refetch
5. Guidance provided: "Please wait a few minutes and try again"

## Testing Recommendations

### Manual Testing

1. **Trigger Rate Limit:**
   - Rapidly refresh executive summary page 10+ times
   - Observe partial data alerts appear

2. **Verify Error Messages:**
   - Check that warnings are clear and actionable
   - Verify retry button functionality

3. **Check Data Quality:**
   - Ensure KPIs still display even when supplementary data fails
   - Verify "0" doesn't appear for missing data components

### Automated Testing

```typescript
describe('Rate Limit Handling', () => {
  it('should show partial data warning when rate limited', async () => {
    // Mock rate limit error
    const response = await fetch('/api/reports/profit-loss')
    expect(response.data.metadata.dataQuality.hasPartialData).toBe(true)
  })

  it('should return 429 status for complete rate limit failure', async () => {
    const response = await fetch('/api/reports/profit-loss')
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('120')
  })
})
```

## Rate Limit Strategy

### Current Implementation

- **Throttling:** Max 2-3 concurrent requests
- **Batch Processing:** 2-3 items per batch with 500-750ms delays
- **Retry Logic:** Exponential backoff (2s, 4s, 8s) with max 3 retries
- **Circuit Breaking:** Errors propagated instead of silently failing

### Recommendations for Production

1. **Implement Request Queue:** Global queue to manage all QuickBooks requests
2. **Token Bucket Algorithm:** Track request rate across the application
3. **Caching:** Increase cache TTL for reports (currently 5-30 minutes)
4. **Background Jobs:** Move non-critical data fetching to background tasks
5. **User Feedback:** Show "Fetching data..." indicators during retries

## Files Modified

### Backend

- `src/app/api/reports/profit-loss/route.ts`
- `src/app/api/reports/balance-sheet/route.ts`
- `src/app/api/reports/cash-flow/route.ts`

### Frontend

- `src/app/(main)/reports/views/SummaryView.tsx`
- `src/app/(main)/reports/components/DataQualityAlert.tsx` (new)
- `src/hooks/useReportData.ts`

## Backward Compatibility

✅ All changes are backward compatible:

- Existing error handling still works
- New `metadata.dataQuality` field is optional
- Components gracefully handle missing metadata
- No breaking changes to existing API contracts

## Next Steps

1. ✅ Implement proper error propagation (DONE)
2. ✅ Add data quality metadata (DONE)
3. ✅ Create frontend alerts (DONE)
4. 🔄 Deploy and monitor
5. 📊 Collect metrics on rate limit frequency
6. 🔧 Tune throttling parameters based on real-world data
7. 💾 Consider implementing request queue for better rate limit management

## Monitoring

### Metrics to Track

- Rate limit error frequency
- Which endpoints hit limits most often
- Time of day patterns for rate limiting
- User retry behavior
- Data completeness percentage

### Logging

All rate limit errors are now logged with context:

```
[P&L Report] Rate limited on Invoice, retry 3/3 after 8000ms
Max retries exceeded for P&L Report after rate limiting { entity: 'Invoice' }
```

## Conclusion

These improvements ensure that rate limiting errors are:

1. **Visible** - Users see clear warnings
2. **Actionable** - Users know how to fix the issue
3. **Non-blocking** - Core data still displays
4. **Recoverable** - Easy retry mechanism
5. **Informative** - Specific components that failed are identified

The system no longer silently fails with "0" values, significantly improving data integrity and user trust.
