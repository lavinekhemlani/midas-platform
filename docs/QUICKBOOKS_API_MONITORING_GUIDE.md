# QuickBooks API Call Monitoring - Implementation Guide

## 🔍 Current Monitoring Infrastructure

### Existing Logging System

Your application already has a **comprehensive logging system** in place:

```typescript
// src/lib/providers/quickbooks/logger.ts - Full-featured logging utility
✅ Color-coded console output with timestamps
✅ API request/response tracking with unique IDs
✅ Token refresh monitoring and retry logic
✅ Error classification and stack traces
✅ Rate limit status tracking
✅ Session summary with metrics
```

### Current API Client Features

The `QuickBooksClient` already includes monitoring capabilities:

```typescript
// src/lib/providers/quickbooks/client.ts
✅ Request ID generation for tracking
✅ Response time measurement
✅ Error handling with retry logic
✅ Rate limit error detection (HTTP 429)
✅ Proxy vs direct API monitoring
✅ Token expiration tracking
✅ Plan detection and feature availability
```

## 📊 QuickBooks API Rate Limits (2024)

### Primary Limits

| Limit Type              | Threshold    | Time Window    |
| ----------------------- | ------------ | -------------- |
| **Standard Requests**   | 500 requests | per minute     |
| **Concurrent Requests** | 10 requests  | simultaneously |
| **Batch Operations**    | 40 requests  | per minute     |
| **Heavy Endpoints**     | 200 requests | per minute     |

### Error Responses

- **HTTP 429**: "Too Many Requests" - immediate throttling
- **Retry-After Header**: Time to wait before next request
- **Reset timing**: Rate limits reset every minute

## 🔧 Monitoring Implementation Options

### Option 1: Enhanced Client-Level Monitoring ⭐ **Recommended**

**Extend existing QuickBooksClient with rate limit tracking:**

```typescript
interface RateLimitStatus {
  requestsThisMinute: number
  concurrentRequests: number
  lastResetTime: number
  nextResetTime: number
  remaining: number
  isThrottled: boolean
}

class QuickBooksClient {
  private rateLimitStatus: RateLimitStatus = {
    requestsThisMinute: 0,
    concurrentRequests: 0,
    lastResetTime: Date.now(),
    nextResetTime: Date.now() + 60000,
    remaining: 500,
    isThrottled: false,
  }

  // Track requests in existing request() method
  // Update rate limit counters
  // Log rate limit warnings
}
```

**Benefits:**

- ✅ Builds on existing architecture
- ✅ Zero additional database tables
- ✅ Works with current logging system
- ✅ Immediate implementation

### Option 2: Database-Backed Monitoring

**Create dedicated monitoring table:**

```typescript
// QUICKBOOKS_API_USAGE_TABLE
{
  PK: organizationId,
  SK: timestamp#requestId,
  endpoint: string,
  method: string,
  responseTime: number,
  statusCode: number,
  rateLimitRemaining?: number,
  errorType?: string,
  timestamp: number
}
```

**Benefits:**

- ✅ Historical analysis
- ✅ Cross-session tracking
- ✅ Usage analytics
- ✅ Billing/cost tracking

### Option 3: Real-Time Dashboard

**AWS CloudWatch/Custom Analytics:**

- Stream API metrics to monitoring service
- Real-time rate limit dashboards
- Automated alerts for threshold breaches
- Historical usage reports

## 🚀 Recommended Implementation Steps

### Phase 1: Enhance Existing Client (1-2 days)

1. **Extend Rate Limit Tracking in QuickBooksClient:**

   ```typescript
   // Add to src/lib/providers/quickbooks/client.ts
   private updateRateLimitCounters(response: Response) {
     this.rateLimitStatus.requestsThisMinute++
     this.rateLimitStatus.remaining = 500 - this.rateLimitStatus.requestsThisMinute

     // Check for rate limit headers (if QB provides them)
     const remaining = response.headers.get('X-RateLimit-Remaining')
     if (remaining) {
       this.rateLimitStatus.remaining = parseInt(remaining)
     }

     // Log warnings when approaching limits
     qbLogger.logRateLimit(
       this.rateLimitStatus.remaining,
       500,
       new Date(this.rateLimitStatus.nextResetTime)
     )
   }
   ```

2. **Add Pre-Request Rate Limit Checks:**
   ```typescript
   private async checkRateLimit(): Promise<void> {
     // Reset counters every minute
     if (Date.now() > this.rateLimitStatus.nextResetTime) {
       this.rateLimitStatus.requestsThisMinute = 0
       this.rateLimitStatus.nextResetTime = Date.now() + 60000
     }

     // Wait if approaching limits
     if (this.rateLimitStatus.remaining < 10) {
       const waitTime = this.rateLimitStatus.nextResetTime - Date.now()
       qbLogger.warning(`Rate limit low, waiting ${waitTime}ms`)
       await new Promise(resolve => setTimeout(resolve, waitTime))
     }
   }
   ```

### Phase 2: Database Monitoring (1 week)

1. **Create API Usage Storage:**

   ```typescript
   // New file: src/lib/providers/quickbooks/monitoring.ts
   interface APICallRecord {
     organizationId: string
     requestId: string
     endpoint: string
     method: string
     startTime: number
     endTime: number
     statusCode: number
     rateLimitRemaining?: number
     errorMessage?: string
   }

   export async function saveAPICall(record: APICallRecord) {
     // Save to DynamoDB using existing patterns
   }
   ```

2. **Integrate with Existing Logger:**
   ```typescript
   // Update qbLogger.logApiResponse() to save to database
   logApiResponse(requestId: string, startTime: number, status: number, data?: any) {
     // Existing logging code...

     // Save to database
     saveAPICall({
       organizationId: this.currentOrgId,
       requestId,
       endpoint: this.currentEndpoint,
       method: this.currentMethod,
       startTime,
       endTime: Date.now(),
       statusCode: status,
       rateLimitRemaining: this.rateLimitStatus.remaining
     })
   }
   ```

### Phase 3: Analytics Dashboard (2-3 weeks)

1. **Usage Analytics API:**

   ```typescript
   // src/app/api/quickbooks/usage/route.ts
   export async function GET(request: NextRequest) {
     // Query usage data by time period
     // Calculate rate limit compliance
     // Generate usage reports
   }
   ```

2. **Frontend Dashboard:**
   - Real-time rate limit status
   - Usage trends and patterns
   - Error frequency analysis
   - Cost estimation by usage

## 🛠️ Advanced Monitoring Features

### Smart Request Spacing

```typescript
class RequestScheduler {
  private requestQueue: Array<() => Promise<any>> = []
  private processing = false

  async scheduleRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return

    this.processing = true
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!
      await request()

      // Smart delay based on rate limit status
      const delay = this.calculateOptimalDelay()
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    this.processing = false
  }
}
```

### Endpoint-Specific Rate Management

```typescript
const ENDPOINT_LIMITS = {
  '/companyinfo': { limit: 500, weight: 1 },
  '/query': { limit: 500, weight: 1 },
  '/reports/ProfitAndLoss': { limit: 200, weight: 2 }, // Heavy endpoint
  '/batch': { limit: 40, weight: 5 }, // Batch operations
}
```

### Webhook Integration

```typescript
// Reduce polling by using QB webhooks when available
// Monitor webhook delivery success rates
// Fallback to polling when webhooks fail
```

## 📈 Monitoring Dashboards

### Real-Time Status Panel

```typescript
interface QuickBooksStatus {
  isConnected: boolean
  rateLimitRemaining: number
  requestsThisMinute: number
  concurrentRequests: number
  lastError?: string
  nextResetTime: Date
  healthScore: number // 0-100
}
```

### Usage Analytics

- **Daily/Monthly request patterns**
- **Peak usage times and bottlenecks**
- **Error frequency by endpoint**
- **Rate limit violations and recovery**
- **Cost analysis by usage volume**

## 🔧 Files to Modify

### Core Monitoring Enhancement

- `src/lib/providers/quickbooks/client.ts` - Add rate limit tracking
- `src/lib/providers/quickbooks/logger.ts` - Enhance with usage metrics
- `src/lib/providers/quickbooks/monitoring.ts` - New monitoring utilities

### API Routes

- `src/app/api/quickbooks/status/route.ts` - New real-time status endpoint
- `src/app/api/quickbooks/usage/route.ts` - New usage analytics endpoint

### Frontend Integration

- `src/hooks/useQuickBooksMonitoring.ts` - Real-time monitoring hook
- `src/components/quickbooks/StatusPanel.tsx` - Status display component

## ⚠️ Current Gaps & Quick Fixes

### Immediate Improvements Needed:

1. **Rate Limit Headers**: QB doesn't always provide rate limit headers - implement client-side tracking
2. **Concurrent Request Tracking**: Add semaphore pattern for 10-request limit
3. **Heavy Endpoint Detection**: Identify and throttle resource-intensive endpoints
4. **Batch Request Optimization**: Group related operations to use 40/minute batch limit

### Configuration Updates:

```bash
# Add to .env.local
QUICKBOOKS_RATE_LIMIT_ENABLED=true
QUICKBOOKS_MONITORING_TABLE_NAME=quickbooks-api-usage
QUICKBOOKS_MAX_CONCURRENT_REQUESTS=8  # Leave 2 requests buffer
QUICKBOOKS_ENABLE_REQUEST_QUEUE=true
```

This implementation builds on your existing robust logging system while adding the missing rate limit monitoring and analytics capabilities essential for production QuickBooks integrations.
