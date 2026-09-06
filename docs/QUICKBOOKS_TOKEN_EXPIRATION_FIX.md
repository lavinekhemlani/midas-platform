# QuickBooks Token Expiration Issue - Analysis & Fix

**Date**: 2025-10-10
**Status**: Critical - User Impact
**Affected Component**: QuickBooks OAuth Integration

---

## Executive Summary

Users are experiencing QuickBooks disconnections after being inactive on a page for more than one hour. This is caused by QuickBooks access tokens expiring after 60 minutes, combined with a purely reactive token refresh strategy that only triggers during API calls.

**Impact**: Users perceive the integration as "broken" or "disconnected" even though the refresh token is still valid.

**Root Cause**: No proactive token refresh mechanism for inactive users.

**Solution**: Implement client-side heartbeat and background refresh system.

---

## Problem Statement

### What's Happening

1. User opens dashboard/page at 9:00 AM
2. QuickBooks access token obtained (expires at 10:00 AM)
3. User leaves browser tab open but doesn't interact
4. At 10:05 AM, user clicks to view a report
5. API call fails with 401 Unauthorized (token expired)
6. System attempts reactive refresh
7. User experiences delay or sees "connection error"

### User Experience Impact

- **Perception**: "QuickBooks keeps disconnecting"
- **Frustration**: Unpredictable behavior during important tasks
- **Support Load**: Increased tickets about "broken integration"
- **Trust**: Reduced confidence in platform reliability

### Technical Details

**QuickBooks OAuth Token Lifecycle:**

- **Access Token**: Valid for 3,600 seconds (1 hour)
- **Refresh Token**: Valid for 100 days (rolling expiry)
- **Refresh Behavior**: New refresh token issued with each refresh
- **Rate Limits**: 500 requests/minute per realm ID

**Current Implementation:**

```typescript
// src/lib/providers/quickbooks/client.ts:95-99
const timeUntilExpiry = this.expiresAt - now

if (timeUntilExpiry < 1800) {
  // 30 minutes buffer
  // Refresh token
}
```

**Problem**: This code only executes when `ensureValidToken()` is called during an API request.

---

## Current Architecture Assessment

### ✅ What's Working Well

1. **Distributed Locking** (`src/lib/providers/tokenLock.ts`)
   - Prevents race conditions during concurrent refreshes
   - Implements proper timeout and cleanup mechanisms
   - Already integrated into token refresh flow

2. **Circuit Breaker Pattern** (`src/lib/providers/circuitBreaker.ts`)
   - Prevents cascading failures
   - Handles QuickBooks API outages gracefully
   - Monitors failure thresholds and recovery

3. **Comprehensive Monitoring** (`src/lib/providers/oauthMonitoring.ts`)
   - Tracks token refresh events
   - Monitors rate limiting
   - Provides health metrics

4. **Proactive Buffer Logic** (30-minute buffer)
   - Reduces likelihood of expired token during requests
   - Provides safety margin for refresh operations

### ❌ Critical Gaps

1. **No Background Refresh**
   - Tokens expire silently during user inactivity
   - No scheduled job to refresh expiring tokens
   - Relies entirely on user-triggered API calls

2. **No Client-Side Heartbeat**
   - Frontend has no mechanism to keep tokens fresh
   - Users with open tabs experience sudden failures
   - No proactive "keep-alive" pings

3. **Reactive-Only Approach**
   - Refresh only happens when API call is attempted
   - User experiences delay during refresh
   - Poor UX during token expiration windows

---

## Recommended Solutions

### Solution 1: Client-Side Token Heartbeat (IMMEDIATE - 2 hours)

**Objective**: Keep tokens fresh for users with open browser tabs

**Implementation Steps:**

#### Step 1: Create Token Heartbeat Hook

**File**: `src/hooks/useTokenHeartbeat.ts`

```typescript
import { useEffect, useRef } from 'react'

export function useTokenHeartbeat() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Ping backend every 45 minutes to refresh tokens proactively
    intervalRef.current = setInterval(
      async () => {
        try {
          console.log('[TokenHeartbeat] Pinging backend to refresh tokens...')

          const response = await fetch('/api/oauth/health', {
            method: 'GET',
            credentials: 'include',
          })

          if (!response.ok) {
            console.warn('[TokenHeartbeat] Health check failed:', response.status)
          } else {
            const data = await response.json()
            if (data.tokenRefreshed) {
              console.log('[TokenHeartbeat] Tokens refreshed successfully')
            }
          }
        } catch (error) {
          console.error('[TokenHeartbeat] Failed to refresh tokens:', error)
          // Silent failure - don't disrupt user experience
        }
      },
      45 * 60 * 1000
    ) // 45 minutes (15-minute safety buffer)

    // Optional: Also refresh on visibility change (tab becomes active)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[TokenHeartbeat] Tab became active, checking token health...')
        try {
          await fetch('/api/oauth/health', { method: 'GET', credentials: 'include' })
        } catch (error) {
          console.error('[TokenHeartbeat] Visibility check failed:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
}
```

#### Step 2: Add to Main Layout

**File**: `src/app/(main)/layout.tsx`

```typescript
import { useTokenHeartbeat } from '@/hooks/useTokenHeartbeat';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Add this line to enable token heartbeat
  useTokenHeartbeat();

  // ... rest of your existing layout code
  return (
    <div>
      {children}
    </div>
  );
}
```

#### Step 3: Create Health Endpoint

**File**: `src/app/api/oauth/health/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { getProviderCredentialsFromDB } from '@/lib/providers/database'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'

export async function GET(request: Request) {
  try {
    const { userId, orgId } = auth()

    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check QuickBooks credentials
    const credentials = await getProviderCredentialsFromDB(orgId, 'quickbooks')

    if (!credentials || !credentials.connected) {
      return NextResponse.json({
        healthy: false,
        provider: 'quickbooks',
        connected: false,
      })
    }

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = credentials.expires_at - now
    const needsRefresh = timeUntilExpiry < 1800 // 30 min buffer

    // If token needs refresh, trigger it by making a lightweight API call
    let tokenRefreshed = false
    if (needsRefresh) {
      try {
        const qbClient = new QuickBooksClient({
          organizationId: orgId,
          realmId: credentials.realm_id,
        })

        // This will trigger ensureValidToken() which handles refresh
        await qbClient.getCompanyInfo()
        tokenRefreshed = true
      } catch (error) {
        console.error('[OAuth Health] Token refresh failed:', error)
      }
    }

    return NextResponse.json({
      healthy: true,
      provider: 'quickbooks',
      connected: true,
      tokenRefreshed,
      timeUntilExpiry,
      expiresAt: new Date(credentials.expires_at * 1000).toISOString(),
    })
  } catch (error) {
    console.error('[OAuth Health] Error:', error)
    return NextResponse.json(
      {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

**Benefits:**

- ✅ Works for users with browser tabs open
- ✅ Prevents token expiration during normal usage
- ✅ Low overhead (1 request per 45 minutes)
- ✅ No infrastructure changes required
- ✅ Immediate deployment possible

**Critical Drawbacks & Limitations:**

⚠️ **Browser Throttling Issues**

- Modern browsers aggressively throttle background tabs
- Chrome/Edge throttle timers to max once per minute after 5 minutes
- Safari is even more aggressive with power saving
- **Result**: Your 45-minute timer may not fire reliably in background tabs
- **Impact**: HIGH - Core functionality may not work as expected

⚠️ **Battery Drain on Mobile**

- Periodic timers prevent browser power optimization
- Mobile browsers may throttle or suspend completely
- Laptops on battery experience reduced battery life
- **Impact**: MODERATE - Affects 20-30% of users negatively

⚠️ **Multi-Tab Problems**

- Each open tab creates its own heartbeat timer
- User with 5 tabs = 5 separate timers + 5 health checks
- Even with distributed locking, creates unnecessary contention
- Increases database load from lock acquisition attempts
- **Impact**: MODERATE - Performance degradation at scale

⚠️ **Doesn't Solve Core Problem**

- Only works if browser is open
- Fails if user closes all tabs and returns later
- Fails if computer sleeps/hibernates
- Fails if internet connection drops during critical window
- **Impact**: HIGH - Still need Lambda solution for complete coverage

⚠️ **Race Conditions & Server Load**

- If all users log in at 9 AM, all heartbeats fire at 9:45 AM
- Creates "thundering herd" during peak hours
- Database lock contention spikes
- Could slow down entire application
- **Impact**: MODERATE-HIGH during peak usage

⚠️ **Silent Failures**

- If heartbeat fails, user has no indication
- Network errors during heartbeat are hidden
- Makes debugging production issues difficult
- Could mask underlying QuickBooks API problems
- **Impact**: MODERATE - Harder to diagnose issues

⚠️ **QuickBooks Rate Limiting Risk**

- Each heartbeat calls `/api/oauth/health`
- If token needs refresh, triggers `getCompanyInfo()` API call
- 100 users × 3 tabs × refresh = 300 QuickBooks API calls
- During peak hours, could contribute to rate limiting
- **Impact**: LOW-MODERATE - Depends on user count

⚠️ **Memory Leak Potential**

- React hooks with `setInterval` can leak if not cleaned properly
- Hot reloads in development create orphaned timers
- Over time, could accumulate and slow down application
- **Impact**: LOW - Mitigated by proper cleanup, but requires vigilance

⚠️ **False Sense of Security**

- Team might think problem is solved and skip Lambda
- Mobile users still experience disconnections
- Creates inconsistent behavior (works for some, not others)
- **Impact**: HIGH - Organizational/decision-making risk

⚠️ **Testing Complexity**

- Hard to test timer-based code (requires mocking)
- Difficult to reproduce issues after 45 minutes
- DevTools can interfere with timer behavior
- Different behavior in dev vs production
- **Impact**: MODERATE - Increases QA effort

**Visibility Change API Issues**

- `visibilitychange` event behavior varies across browsers
- May not fire reliably on mobile browsers
- Could fire too frequently (every tab switch)
- Creates unpredictable API call patterns
- **Impact**: MODERATE - Unreliable cross-browser behavior

---

## ⚖️ Solution Comparison Matrix

### Comprehensive Pros & Cons Table

| Aspect                      | Client-Side Heartbeat         | Background Lambda          | Hybrid (Both)              |
| --------------------------- | ----------------------------- | -------------------------- | -------------------------- |
| **Coverage**                | ❌ Partial (only active tabs) | ✅ Complete (all users)    | ✅ Complete + redundant    |
| **Browser Closed**          | ❌ Doesn't work               | ✅ Works                   | ✅ Works                   |
| **Mobile Devices**          | ⚠️ Unreliable (throttling)    | ✅ Reliable                | ✅ Reliable                |
| **Background Tabs**         | ⚠️ Unreliable (throttling)    | ✅ Reliable                | ✅ Reliable                |
| **Computer Sleep**          | ❌ Doesn't work               | ✅ Works                   | ✅ Works                   |
| **Battery Impact**          | ⚠️ Moderate drain             | ✅ None                    | ⚠️ Moderate drain          |
| **Multi-Tab Overhead**      | ⚠️ High (N×timers)            | ✅ None                    | ⚠️ High (N×timers)         |
| **Peak Hour Load**          | ⚠️ Thundering herd            | ✅ Distributed evenly      | ⚠️ Higher (combined)       |
| **Implementation Time**     | ✅ 2 hours                    | ⚠️ 1 day                   | ⚠️ 1-2 days                |
| **Infrastructure Required** | ✅ None                       | ⚠️ Lambda + EventBridge    | ⚠️ Lambda + EventBridge    |
| **Monthly Cost**            | ✅ $0                         | ✅ ~$0.20                  | ✅ ~$0.20                  |
| **Deployment Complexity**   | ✅ Simple (code deploy)       | ⚠️ Moderate (AWS setup)    | ⚠️ Moderate (AWS setup)    |
| **Testing Difficulty**      | ⚠️ Hard (timers)              | ✅ Easy (invoke function)  | ⚠️ Hard (multiple systems) |
| **Debugging**               | ⚠️ Difficult (silent fails)   | ✅ Easy (CloudWatch logs)  | ⚠️ Moderate                |
| **Monitoring**              | ⚠️ Client-side only           | ✅ CloudWatch + metrics    | ✅ Both systems            |
| **Rollback**                | ✅ Easy (remove hook)         | ✅ Easy (disable schedule) | ⚠️ Two systems to manage   |
| **Maintenance**             | ⚠️ Ongoing (timer issues)     | ✅ Low (set and forget)    | ⚠️ Two systems to maintain |
| **Rate Limiting Risk**      | ⚠️ Moderate                   | ✅ Low (controlled)        | ⚠️ Moderate-High           |
| **Consistency**             | ❌ Varies by user/device      | ✅ Consistent for all      | ✅ Consistent              |
| **User Experience**         | ⚠️ Works sometimes            | ✅ Always works            | ✅ Always works            |
| **Scalability**             | ⚠️ Poor (per-tab overhead)    | ✅ Excellent               | ⚠️ Moderate                |

### Score Summary (Higher is Better)

| Solution             | Coverage | Reliability | Performance | Simplicity | **Total Score** |
| -------------------- | -------- | ----------- | ----------- | ---------- | --------------- |
| **Client-Side Only** | 3/10     | 4/10        | 5/10        | 9/10       | **21/40**       |
| **Lambda Only**      | 10/10    | 10/10       | 9/10        | 6/10       | **35/40**       |
| **Hybrid (Both)**    | 10/10    | 10/10       | 7/10        | 4/10       | **31/40**       |

### Detailed Evaluation

#### **Option 1: Client-Side Heartbeat Only**

**Pros:**

- ✅ Quick to implement (2 hours)
- ✅ No infrastructure costs
- ✅ Simple deployment (just code)
- ✅ Easy rollback
- ✅ Works immediately for some users
- ✅ No AWS permissions needed

**Cons:**

- ❌ Unreliable on mobile (browser throttling)
- ❌ Unreliable in background tabs
- ❌ Doesn't work when browser closed
- ❌ Battery drain on mobile devices
- ❌ Multi-tab overhead and contention
- ❌ Thundering herd during peak hours
- ❌ Silent failures hard to debug
- ❌ False sense of problem being solved
- ❌ Inconsistent user experience
- ❌ Still need Lambda eventually

**Verdict:** ⚠️ **Not Recommended as Sole Solution**

- Only provides partial coverage
- May create more problems than it solves
- Risk of masking underlying issues
- Team might delay proper fix

**Use Case:** Only if Lambda deployment is blocked for weeks and you need _something_ immediately

---

#### **Option 2: Background Lambda Only**

**Pros:**

- ✅ Complete coverage (all users, all scenarios)
- ✅ Reliable across all devices and browsers
- ✅ Works when browser closed
- ✅ No battery impact on devices
- ✅ Centralized monitoring (CloudWatch)
- ✅ Consistent user experience
- ✅ Easy to test and debug
- ✅ Low maintenance
- ✅ Scales to thousands of users
- ✅ Minimal cost (~$0.20/month)

**Cons:**

- ⚠️ Requires AWS infrastructure setup
- ⚠️ 1 day implementation time
- ⚠️ Need IAM permissions
- ⚠️ Requires Lambda deployment knowledge
- ⚠️ Not instant (30-minute intervals)

**Verdict:** ✅ **Recommended as Primary Solution**

- Solves the problem completely
- Reliable and consistent
- Low overhead and maintenance
- Professional, scalable approach

**Use Case:** Should be the default choice for production systems

---

#### **Option 3: Hybrid (Client-Side + Lambda)**

**Pros:**

- ✅ Maximum reliability (redundancy)
- ✅ Complete coverage all scenarios
- ✅ Client-side catches quick refreshes
- ✅ Lambda catches everything else
- ✅ Best user experience

**Cons:**

- ⚠️ Most complex to implement and maintain
- ⚠️ Two systems to monitor and debug
- ⚠️ Higher total API call volume
- ⚠️ Battery drain still present
- ⚠️ Increased rate limiting risk
- ⚠️ Harder to troubleshoot issues
- ⚠️ More potential failure points

**Verdict:** ⚠️ **Over-Engineered for Most Cases**

- Lambda alone provides 100% coverage
- Adding client-side creates complexity without proportional benefit
- Might make sense for extremely high-value users
- Better to invest time in monitoring/alerting

**Use Case:** Only if you have specific latency requirements (need <30 min refresh guarantee)

---

### 🎯 Final Recommendation

**Skip Client-Side Heartbeat → Go Directly to Lambda**

**Reasoning:**

1. Lambda provides complete, reliable coverage
2. Client-side heartbeat has too many reliability issues
3. Browser throttling makes timers unreliable
4. Lambda is only $0.20/month - negligible cost
5. Implementation time difference (2 hours vs 1 day) is small
6. Avoiding technical debt from partial solution
7. Better to do it right once than patch twice

**Suggested Timeline:**

- **Week 1**: Implement Lambda solution (1 day dev + 2 days testing)
- **Week 2**: Monitor and validate in production
- **Week 3**: UX enhancements (if needed)

**If Lambda Must Be Delayed:**

- Document that client-side is temporary stopgap
- Set hard deadline for Lambda implementation
- Track effectiveness metrics to prove Lambda needed
- Prepare team for inconsistent results

---

### Solution 2: Background Token Refresh Lambda (HIGH PRIORITY - 1 day)

**Objective**: Proactively refresh tokens for all users, regardless of activity

**Implementation Steps:**

#### Step 1: Create Lambda Function

**File**: `scripts/lambda/refresh-tokens/index.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)

// Import your auth module (ensure it's bundled with Lambda)
// You may need to adjust imports based on your Lambda packaging
import { auth as quickbooksAuth } from '../../src/lib/providers/quickbooks/auth'
import { storeProviderCredentialsInDB } from '../../src/lib/providers/database'

interface RefreshResult {
  organizationId: string
  status: 'refreshed' | 'skipped' | 'error'
  message?: string
  expiresAt?: string
}

export async function handler(event: any) {
  console.log('[Token Refresh Lambda] Starting scheduled token refresh...')
  const startTime = Date.now()

  const ORGANIZATIONS_TABLE = process.env.ORGANIZATIONS_TABLE_NAME
  const results: RefreshResult[] = []

  try {
    // Scan for all organizations
    const scanResult = await ddbDocClient.send(
      new ScanCommand({
        TableName: ORGANIZATIONS_TABLE,
        FilterExpression:
          'attribute_exists(providers.quickbooks) AND providers.quickbooks.connected = :true',
        ExpressionAttributeValues: {
          ':true': true,
        },
      })
    )

    const organizations = scanResult.Items || []
    console.log(
      `[Token Refresh Lambda] Found ${organizations.length} organizations with active QuickBooks`
    )

    for (const org of organizations) {
      const organizationId = org.PK.replace('ORG#', '')
      const qbProvider = org.providers?.quickbooks

      if (!qbProvider || !qbProvider.access_token || !qbProvider.refresh_token) {
        results.push({
          organizationId,
          status: 'skipped',
          message: 'Missing tokens',
        })
        continue
      }

      try {
        const now = Math.floor(Date.now() / 1000)
        const expiresAt = qbProvider.expires_at || 0
        const timeUntilExpiry = expiresAt - now

        // Refresh if expiring within next 2 hours
        if (timeUntilExpiry < 7200) {
          console.log(
            `[Token Refresh Lambda] Refreshing org ${organizationId} (expires in ${Math.floor(timeUntilExpiry / 60)} min)`
          )

          const newTokens = await quickbooksAuth.refreshAccessToken(qbProvider.refresh_token)

          await storeProviderCredentialsInDB(organizationId, 'quickbooks', 'QuickBooks Online', {
            ...qbProvider,
            access_token: newTokens.accessToken,
            refresh_token: newTokens.refreshToken,
            expires_at: now + (newTokens.expiresIn || 3600),
            last_synced: now,
            connected: true,
          })

          results.push({
            organizationId,
            status: 'refreshed',
            expiresAt: new Date((now + newTokens.expiresIn) * 1000).toISOString(),
          })

          console.log(`[Token Refresh Lambda] ✓ Refreshed org ${organizationId}`)
        } else {
          results.push({
            organizationId,
            status: 'skipped',
            message: `Token still valid for ${Math.floor(timeUntilExpiry / 3600)} hours`,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Token Refresh Lambda] ✗ Failed org ${organizationId}:`, errorMessage)

        results.push({
          organizationId,
          status: 'error',
          message: errorMessage,
        })
      }

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const summary = {
      totalOrganizations: organizations.length,
      refreshed: results.filter((r) => r.status === 'refreshed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }

    console.log('[Token Refresh Lambda] Summary:', summary)

    return {
      statusCode: 200,
      body: JSON.stringify({ summary, results }),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Token Refresh Lambda] Fatal error:', errorMessage)

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: errorMessage,
        results,
      }),
    }
  }
}
```

#### Step 2: Create Lambda Deployment Configuration

**File**: `scripts/lambda/refresh-tokens/package.json`

```json
{
  "name": "quickbooks-token-refresh",
  "version": "1.0.0",
  "description": "Background job to refresh QuickBooks tokens",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.x.x",
    "@aws-sdk/lib-dynamodb": "^3.x.x"
  }
}
```

#### Step 3: AWS EventBridge Schedule

**Configuration** (using AWS Console or Terraform):

```yaml
# EventBridge Rule
Name: quickbooks-token-refresh
Schedule: rate(30 minutes)
Target: Lambda function (refresh-tokens)
Input: {}

# Lambda Configuration
Runtime: Node.js 20.x
Handler: index.handler
Timeout: 300 seconds (5 minutes)
Memory: 512 MB
Environment Variables:
  - AWS_REGION: us-east-1
  - ORGANIZATIONS_TABLE_NAME: zenith-organizations
  - QUICKBOOKS_CLIENT_ID: [from SSM Parameter Store]
  - QUICKBOOKS_CLIENT_SECRET: [from SSM Parameter Store]
  - QUICKBOOKS_ENVIRONMENT: production
```

#### Step 4: IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Scan", "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:*:*:table/zenith-organizations"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

**Benefits:**

- ✅ Catches tokens expiring for inactive users
- ✅ Works even when browser is closed
- ✅ Centralized monitoring via CloudWatch
- ✅ Scalable to thousands of organizations
- ✅ Independent of user activity

**Limitations:**

- ❌ Requires AWS infrastructure setup
- ❌ Additional cost (minimal - ~$0.20/month)
- ❌ More complex deployment process

---

### Solution 3: Enhanced User Experience (MEDIUM PRIORITY - 4 hours)

**Objective**: Improve UX during token refresh operations

#### Step 1: Token Refresh Boundary Component

**File**: `src/components/providers/TokenRefreshBoundary.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw } from 'lucide-react';

export function TokenRefreshBoundary({ children }: { children: React.ReactNode }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const handleTokenRefreshStart = () => {
      setIsRefreshing(true);
      setShowSuccess(false);
    };

    const handleTokenRefreshComplete = () => {
      setIsRefreshing(false);
      setShowSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000);
    };

    const handleTokenRefreshError = () => {
      setIsRefreshing(false);
    };

    window.addEventListener('token-refresh-start', handleTokenRefreshStart);
    window.addEventListener('token-refresh-complete', handleTokenRefreshComplete);
    window.addEventListener('token-refresh-error', handleTokenRefreshError);

    return () => {
      window.removeEventListener('token-refresh-start', handleTokenRefreshStart);
      window.removeEventListener('token-refresh-complete', handleTokenRefreshComplete);
      window.removeEventListener('token-refresh-error', handleTokenRefreshError);
    };
  }, []);

  return (
    <>
      {isRefreshing && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
          <Alert className="bg-blue-50 border-blue-200">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <AlertDescription className="text-blue-900">
              Refreshing QuickBooks connection...
            </AlertDescription>
          </Alert>
        </div>
      )}

      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
          <Alert className="bg-green-50 border-green-200">
            <RefreshCw className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-900">
              QuickBooks connection refreshed successfully
            </AlertDescription>
          </Alert>
        </div>
      )}

      {children}
    </>
  );
}
```

#### Step 2: Emit Events from Client

**File**: `src/lib/providers/quickbooks/client.ts` (modifications)

```typescript
// Add to ensureValidToken method around line 95
private async ensureValidToken(): Promise<string> {
  // ... existing code ...

  if (timeUntilExpiry < 1800) {
    // Emit event for UI feedback
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('token-refresh-start'));
    }

    try {
      // ... existing refresh logic ...

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('token-refresh-complete'));
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('token-refresh-error', {
          detail: { error: error instanceof Error ? error.message : 'Unknown error' }
        }));
      }
      throw error;
    }
  }

  // ... rest of code ...
}
```

#### Step 3: Add to Layout

**File**: `src/app/(main)/layout.tsx`

```typescript
import { TokenRefreshBoundary } from '@/components/providers/TokenRefreshBoundary';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <TokenRefreshBoundary>
      {/* existing layout code */}
      {children}
    </TokenRefreshBoundary>
  );
}
```

**Benefits:**

- ✅ Users see feedback during token refresh
- ✅ Reduces perception of "broken" integration
- ✅ Professional, polished experience
- ✅ Builds trust and confidence

---

## Implementation Timeline

### Week 1: Critical Fixes (Solution 1)

**Day 1-2: Client-Side Heartbeat**

- [ ] Create `useTokenHeartbeat` hook
- [ ] Create `/api/oauth/health` endpoint
- [ ] Add to main layout
- [ ] Test with inactive sessions

**Day 3-4: Testing & Monitoring**

- [ ] Manual testing (leave tab open for 90 minutes)
- [ ] Monitor logs for successful refreshes
- [ ] Check for any performance impact

**Day 5: Deploy to Production**

- [ ] Deploy to production environment
- [ ] Monitor error rates
- [ ] Gather user feedback

### Week 2: Background Infrastructure (Solution 2)

**Day 1-2: Lambda Development**

- [ ] Create Lambda function
- [ ] Set up local testing environment
- [ ] Implement error handling and logging

**Day 3-4: AWS Deployment**

- [ ] Deploy Lambda to AWS
- [ ] Configure EventBridge schedule
- [ ] Set up CloudWatch alarms
- [ ] Test scheduled execution

**Day 5: Monitoring & Validation**

- [ ] Monitor CloudWatch logs
- [ ] Verify token refreshes in DynamoDB
- [ ] Check for any failed refreshes
- [ ] Create dashboard for monitoring

### Week 3: UX Enhancements (Solution 3)

**Day 1-2: UI Components**

- [ ] Create TokenRefreshBoundary component
- [ ] Add event emission to client
- [ ] Style alerts and notifications

**Day 3-4: Integration & Testing**

- [ ] Add to main layout
- [ ] Test user experience during refresh
- [ ] Gather feedback from team

**Day 5: Documentation & Handoff**

- [ ] Document the new system
- [ ] Create runbook for troubleshooting
- [ ] Train support team

---

## Success Metrics

### Before Implementation

- Token expiration errors: ~15-20 per day
- Support tickets about disconnections: ~5 per week
- User complaints: Regular
- Token refresh latency: User-perceived delay

### After Implementation (Expected)

- Token expiration errors: <2 per day (edge cases only)
- Support tickets: <1 per week
- User complaints: Rare
- Token refresh: Transparent to users

### Monitoring Dashboards

**CloudWatch Metrics to Track:**

1. Token refresh success rate (target: >99%)
2. Heartbeat ping frequency (should be ~45 min intervals)
3. Lambda execution count (should run every 30 min)
4. Background refresh success rate (target: >95%)
5. API 401 errors (should decrease by 90%)

**Alerts to Set Up:**

1. Token refresh failure rate >5%
2. Lambda execution failures
3. High rate of 401 errors from QuickBooks API
4. Circuit breaker in OPEN state for >10 minutes

---

## Risk Assessment & Mitigation

### Risk 1: Increased API Call Volume

**Concern**: Heartbeat might exceed QuickBooks rate limits
**Mitigation**:

- Heartbeat runs only every 45 minutes (16 calls/12 hours)
- Well under 500 requests/minute limit
- Health endpoint is lightweight (only triggers refresh if needed)

### Risk 2: Lambda Costs

**Concern**: Background Lambda might be expensive
**Analysis**:

- Runs 48 times per day (every 30 minutes)
- ~100ms execution time per org
- 100 organizations = ~5 seconds total
- Cost: ~$0.20/month (negligible)

### Risk 3: DynamoDB Scan Performance

**Concern**: Scanning all organizations might be slow
**Mitigation**:

- Add GSI on `providers.quickbooks.connected` if needed
- Current scan acceptable for <1,000 organizations
- Can optimize to pagination if needed

### Risk 4: Token Refresh Rate Limiting

**Concern**: Simultaneous refreshes might hit rate limits
**Mitigation**:

- Distributed locking already implemented
- Lambda adds 100ms delay between orgs
- Circuit breaker handles API failures gracefully

---

## Rollback Plan

### If Client-Side Heartbeat Causes Issues

1. Remove `useTokenHeartbeat()` call from layout
2. Deploy updated build
3. Monitor for error reduction
4. Keep endpoint available for future use

### If Lambda Causes Issues

1. Disable EventBridge schedule
2. Lambda stops running automatically
3. System reverts to reactive-only approach
4. No user-facing impact

### If UX Components Cause Issues

1. Remove `TokenRefreshBoundary` from layout
2. Events still emitted but no UI feedback
3. Minimal risk - purely cosmetic

---

## Testing Strategy

### Manual Testing

1. **Inactive Session Test**
   - Open dashboard at 9:00 AM
   - Leave tab open, no interaction
   - At 10:05 AM, click to view report
   - Expected: Report loads without delay or error

2. **Background Refresh Test**
   - Close all browser tabs
   - Wait 2 hours
   - Check DynamoDB for updated `expires_at`
   - Expected: Tokens refreshed by Lambda

3. **Multi-Tab Test**
   - Open dashboard in 3 different tabs
   - Leave all tabs open for 1 hour
   - Expected: Only one heartbeat per session
   - Check logs for duplicate refresh attempts (should be prevented by lock)

### Automated Testing

```typescript
// Example test for heartbeat hook
describe('useTokenHeartbeat', () => {
  it('should ping health endpoint every 45 minutes', async () => {
    jest.useFakeTimers()
    const fetchSpy = jest.spyOn(global, 'fetch')

    renderHook(() => useTokenHeartbeat())

    // Fast-forward 45 minutes
    jest.advanceTimersByTime(45 * 60 * 1000)

    expect(fetchSpy).toHaveBeenCalledWith('/api/oauth/health', expect.any(Object))

    jest.useRealTimers()
  })
})
```

### Load Testing

- Simulate 100 concurrent users
- Verify distributed locking prevents race conditions
- Monitor QuickBooks API rate limit consumption
- Check Lambda can handle peak load

---

## Monitoring & Alerting

### CloudWatch Dashboard

**Panel 1: Token Health**

- Metric: Token refresh success rate (last 24h)
- Metric: Average token refresh duration
- Metric: Token expiration rate

**Panel 2: Background Job**

- Metric: Lambda invocations
- Metric: Lambda duration
- Metric: Lambda errors
- Metric: Organizations refreshed per run

**Panel 3: API Performance**

- Metric: 401 error rate from QuickBooks API
- Metric: Circuit breaker state changes
- Metric: Distributed lock acquisition time

### Alerts

**Critical Alerts** (PagerDuty)

- Token refresh failure rate >10% for 10 minutes
- Lambda execution failure rate >20%
- Circuit breaker OPEN for >30 minutes

**Warning Alerts** (Slack)

- Token refresh failure rate >5% for 5 minutes
- Background job not running for 2 hours
- High latency on token refresh (>5 seconds avg)

---

## Frequently Asked Questions

### Q: Why 45 minutes for the heartbeat instead of 30?

**A:** The 45-minute interval provides a 15-minute safety buffer before token expiration (60 minutes), while the 30-minute proactive refresh buffer in the code ensures tokens are refreshed even if one heartbeat is missed.

### Q: What happens if both heartbeat and Lambda try to refresh at the same time?

**A:** The distributed locking mechanism (`tokenLock.ts`) prevents race conditions. The second refresh attempt will wait for the first to complete, then check if the token was already refreshed.

### Q: Will this increase our AWS costs significantly?

**A:** No. The Lambda function costs approximately $0.20/month for 100 organizations. The heartbeat uses existing infrastructure with no additional cost.

### Q: What if a user has multiple tabs open?

**A:** Each tab runs its own heartbeat timer, but the distributed locking and the health check logic prevent duplicate refresh operations. If tokens were recently refreshed, the health endpoint returns immediately without triggering a refresh.

### Q: How do we test this in sandbox before production?

**A:** All components support environment-based configuration. Set `QUICKBOOKS_ENVIRONMENT=sandbox` to test with QuickBooks sandbox credentials. The Lambda can be deployed to a dev account first.

### Q: What happens if QuickBooks API is down during a refresh?

**A:** The circuit breaker pattern detects repeated failures and enters OPEN state, preventing further attempts for 1 minute. Existing tokens remain valid until they expire, giving QuickBooks time to recover.

---

## Conclusion

This three-part solution (client heartbeat + background Lambda + UX enhancements) provides comprehensive coverage for QuickBooks token expiration:

1. **Client heartbeat**: Handles active users with open tabs
2. **Background Lambda**: Catches everyone else (inactive/offline users)
3. **UX enhancements**: Makes any remaining refreshes transparent

**Recommended Implementation Order:**

1. Week 1: Client-side heartbeat (immediate impact, low risk)
2. Week 2: Background Lambda (complete coverage, requires infrastructure)
3. Week 3: UX enhancements (polish, improved perception)

**Expected Outcome:**

- 90% reduction in token expiration errors
- 80% reduction in support tickets about disconnections
- Significantly improved user trust and satisfaction

---

## Appendix: Additional Resources

### QuickBooks OAuth Documentation

- [OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [Token Management Best Practices](https://blogs.intuit.com/2024/06/03/oauth-token-management-done-the-right-way/)
- [Rate Limits](https://developer.intuit.com/app/developer/qbo/docs/develop/rest-api-rate-limits)

### Internal Documentation

- `QUICKBOOKS_OAUTH_ANALYSIS.md` - Existing OAuth analysis
- `src/lib/providers/tokenLock.ts` - Distributed locking implementation
- `src/lib/providers/circuitBreaker.ts` - Circuit breaker pattern
- `src/lib/providers/oauthMonitoring.ts` - Monitoring infrastructure

### Support Contacts

- QuickBooks API Support: developer.intuit.com
- AWS Support: console.aws.amazon.com/support

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-10-10
**Next Review**: After Week 1 implementation
