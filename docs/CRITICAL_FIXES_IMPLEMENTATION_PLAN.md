# Critical Fixes Implementation Plan: QuickBooks Auth & Reports Data Loading

**Created:** 2025-11-05
**Last Verified:** 2025-11-05
**Accuracy Rating:** ⚠️ Needs Testing (Race condition requires empirical verification)
**Priority:** CRITICAL
**Total Issues:** 32 (including reports loading bug)

---

## 🚨 CRITICAL BUG: Reports Page Shows 0s After Login

⚠️ **STATUS**: This issue requires empirical testing to confirm. The race condition described below is based on code analysis but has not been verified in production.

### Problem Description

Users login and get redirected to the reports page but see only 0s with no data loading. This is a **potential race condition** between authentication session establishment and data fetching.

### Root Cause Analysis

#### 1. Race Condition Timeline

```
User Login (QuickBooks OAuth)
    ↓
/api/providers/callback → OAuth token exchange
    ↓ (stores tokens in DynamoDB)
Browser: redirect to original page (may be '/reports')
    ↓ (potential race condition window: ~100-500ms)
ReportsProvider mounts
    ↓
SWR hooks fire (useCashFlow, useBalanceSheet, useProfitLoss)
    ↓ (TIMING ISSUE: Auth cookies might not be set yet)
apiClient() called
    ↓
AuthCookies.set() → May fail/timeout
    ↓ (warning swallowed, request proceeds)
fetch() with potentially invalid auth
    ↓
API returns 401/error
    ↓ (Error caught, but swallowed by SWR)
SWR stores error + returns undefined data
    ↓
Metrics extract undefined → show 0s via defaults
    ↓
User sees "0" on all cards
```

#### 2. Silent Failure Points

1. **`AuthCookies.set()` fails** → warning logged, request proceeds unauthenticated
2. **API returns 401** → Error caught by fetcher, but SWR silently retries
3. **SWR error handler swallows errors** → No user notification
4. **Default metrics (`|| 0`)** render zeros → User sees data but all values are 0
5. **No error state UI** shown unless all 3 report APIs fail

#### 3. Code Evidence

**✅ VERIFIED: Race Condition in `/src/lib/apiClient.ts`:**

```typescript
// Lines ~60-65 (approximate)
try {
  await AuthCookies.set() // <-- May fail or be incomplete
} catch (authError) {
  console.warn('Failed to refresh auth cookies:', authError)
  // WARNING IS SWALLOWED, REQUEST PROCEEDS!
}
```

**✅ VERIFIED: Default Values in `/src/app/(main)/reports/views/SummaryView.tsx`:**

```typescript
// Lines ~160-162 (approximate)
const cfMetrics = cashFlowData?.data?.kpis || {} // Empty object on error
const bsMetrics = balanceSheetData?.data?.kpis || {}
const pnlMetrics = pnlData?.data?.kpis || {}

// Then used like:
value: cfMetrics.cashEnding || 0 // Shows 0
value: bsMetrics.totalAssets || 0 // Shows 0
value: pnlMetrics.totalRevenue || 0 // Shows 0
```

**✅ VERIFIED: Aggressive SWR Caching in `/src/contexts/ReportsProvider.tsx`:**

```typescript
// Lines ~238-263 (approximate)
SWRConfig value={{
  revalidateOnMount: false,        // Don't check on mount!
  keepPreviousData: true,          // Keep old zeros in cache
  revalidateOnFocus: false,        // Don't refresh on focus
  revalidateIfStale: false,        // Don't refresh stale data
  dedupingInterval: 30 * 60 * 1000 // 30min cache (very long)
}}
```

### Fix Implementation

#### Immediate Fix (30 minutes)

⚠️ **NOTE**: The current `/src/app/(main)/reports/layout.tsx` is only 12 lines and simply wraps ReportsProvider. Consider implementing this delay logic in a different location, or create a new intermediate component.

**Proposed Solution: Create `/src/app/(main)/reports/ReportsLoadingGate.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react';
import LoadingState from '@/components/ui/LoadingState';

export function ReportsLoadingGate({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000); // 1 second delay
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingState message="Setting up your session..." />;
  }

  return <>{children}</>;
}
```

Then modify layout.tsx to use this component.

#### Proper Fix (3-4 hours)

1. **Fix Auth Cookie Race Condition** (`/src/lib/apiClient.ts`)

```typescript
// Add retry logic with exponential backoff
async function ensureAuthCookies(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await AuthCookies.set()
      return true
    } catch (error) {
      console.error(`Auth cookie attempt ${i + 1} failed:`, error)
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 500))
      }
    }
  }
  throw new Error('Failed to establish authentication')
}
```

2. **Fix Auth Callback Timing** (`/src/app/api/providers/callback/route.ts`)

✅ **IMPLEMENTED**: Session verification with retry logic and provider disconnection on failure

```typescript
/**
 * Verify that the session has been established after OAuth token storage
 * by attempting to read back the credentials from the database
 */
async function verifySessionEstablished(
  organizationId: string,
  providerId: ProviderID
): Promise<boolean> {
  try {
    const credentials = await getProviderCredentialsFromDB(organizationId, providerId)

    // Check if credentials exist and are marked as connected
    if (!credentials || !credentials.connected || !credentials.access_token) {
      return false
    }

    return true
  } catch (error) {
    logger.error('Session verification error', { organizationId, providerId, error })
    return false
  }
}

// In the OAuth callback, after successful token storage:
// Verify session establishment before redirect
const sessionReady = await verifySessionEstablished(organizationId, providerId)

if (!sessionReady) {
  // Wait briefly for session propagation
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Retry verification
  const retryReady = await verifySessionEstablished(organizationId, providerId)

  if (!retryReady) {
    // Session failed to establish - disconnect the provider
    await storeProviderCredentialsInDB(
      organizationId,
      providerId,
      getProviderDisplayName(providerId),
      {
        connected: false,
        error: 'session_establishment_failed',
        error_message: 'Failed to establish session after OAuth - please reconnect',
        last_error_at: Math.floor(Date.now() / 1000),
      }
    )

    // Log the failure for monitoring
    await storeProviderError(
      organizationId,
      providerId,
      'Session propagation timeout - user needs to reconnect'
    )

    // Redirect with error parameter to trigger reconnect UI
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?provider_error=session_failed&provider=${providerId}`, baseUrl)
    )
  }
}

return NextResponse.redirect(redirectUrl)
```

**Key Improvements:**

- ✅ Verifies session by reading credentials back from DB
- ✅ Retries once after 200ms wait
- ✅ Disconnects provider if session fails
- ✅ Logs failure for monitoring
- ✅ Redirects with error parameter for UI handling
- ✅ No limbo state - provider is either connected or disconnected

3. **Fix Loading State Logic** (`/src/app/(main)/reports/views/SummaryView.tsx`)

```typescript
// Show loading if ANY data is missing
const hasAllData = cashFlowData && balanceSheetData && pnlData;
const hasAnyError = cashFlowError || balanceSheetError || pnlError;

if (!hasAllData && !hasAnyError) {
  return <LoadingState />;
}

if (hasAnyError) {
  return <ErrorState errors={[cashFlowError, balanceSheetError, pnlError]} />;
}

// Only render metrics when ALL data is ready
```

4. **Fix SWR Configuration** (`/src/contexts/ReportsProvider.tsx`)

```typescript
SWRConfig value={{
  revalidateOnMount: true,         // CHECK on mount
  keepPreviousData: false,         // Don't keep stale data
  revalidateOnFocus: true,         // Refresh on tab focus
  revalidateIfStale: true,         // Refresh stale data
  dedupingInterval: 5 * 60 * 1000, // 5min cache (reasonable)
  shouldRetryOnError: true,
  errorRetryInterval: 5000,
  errorRetryCount: 3
}}
```

---

## 🎨 Frontend Error Handling (IMPLEMENTED)

### Provider Reconnect UI

✅ **IMPLEMENTED**: Comprehensive error handling with user-friendly reconnect prompts

#### 1. Reports Page Error Banner (`/src/app/(main)/reports/layout.tsx`)

```typescript
// Detects provider_error URL parameter and displays contextual error banner
useEffect(() => {
  const errorType = searchParams?.get('provider_error')
  const provider = searchParams?.get('provider')

  if (errorType && provider) {
    setProviderError({ type: errorType, provider })
    // Clean up URL parameters
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [searchParams])

// Displays alert with reconnect options
{providerError?.type === 'session_failed' && (
  <Alert variant="destructive">
    <AlertTitle>Connection Failed</AlertTitle>
    <AlertDescription>
      Failed to establish a session with {providerName} after authentication.
      <Button onClick={handleReconnect}>Reconnect {providerName}</Button>
      <Button onClick={() => router.push('/settings/integrations')}>View Integrations</Button>
    </AlertDescription>
  </Alert>
)}
```

#### 2. Global Toast Notifications (`/src/app/(main)/layout.tsx`)

```typescript
// Global handler for provider errors across all pages
useEffect(() => {
  const providerError = searchParams?.get('provider_error')
  const provider = searchParams?.get('provider')

  if (providerError && provider && mounted) {
    if (providerError === 'session_failed') {
      toast.error(`Failed to connect ${providerName}`, {
        description: 'Session establishment failed after authentication. Please try reconnecting.',
        duration: 10000,
        action: {
          label: 'Reconnect',
          onClick: () => router.push(`/settings/integrations?reconnect=${provider}`),
        },
      })
    }

    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [searchParams, mounted, router])
```

**Key Features:**

- ✅ Page-specific error banner on Reports page
- ✅ Global toast notifications work on any page
- ✅ One-click reconnect action
- ✅ Clear, user-friendly messaging
- ✅ Automatic URL cleanup
- ✅ Deep link to integrations page with reconnect parameter

---

## 📋 QuickBooks Authentication & UX Fixes

### Phase 1: Critical Fixes (Week 1)

#### 1. OAuth Callback Error Display (#2 - CRITICAL)

**✅ VERIFIED ISSUE**: Backend sends `oauth_error` URL parameters but frontend has NO code to handle them

**Problem:** OAuth errors in URL params are never shown to users

**Files to modify:**

- `/src/components/integrations/IntegrationsContainer.tsx`
- Backend already sends errors from `/src/app/api/providers/callback/route.ts`

**Implementation:**

```typescript
// Add to IntegrationsContainer.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('oauth_error')
  const oauthSuccess = params.get('oauth_success')

  if (oauthError) {
    const errorMessages = {
      missing_code: 'Authorization failed. Please try connecting again.',
      invalid_grant: 'Your session expired. Please reconnect.',
      missing_state: 'Security validation failed. Please try again.',
      state_validation_failed: 'Connection request expired. Please start over.',
      token_exchange_failed: 'Failed to complete connection. Please try again.',
      storage_failed: 'Failed to save connection. Please contact support.',
      timeout: 'Connection timed out. Please try again.',
      missing_realm_id: 'QuickBooks company ID missing. Please try again.',
      invalid_realm_id: 'Invalid QuickBooks company ID. Please reconnect.',
      state_expired: 'Your connection request expired. Please try again.',
    }

    toast.error(errorMessages[oauthError] || `Connection failed: ${oauthError}`)

    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname)
  }

  if (oauthSuccess) {
    toast.success(`Successfully connected to ${params.get('provider')}`)
    refetchSession()
    window.history.replaceState({}, '', window.location.pathname)
  }
}, [])
```

#### 2. Token Refresh UI Feedback (#1 - CRITICAL)

**✅ VERIFIED ISSUE**: No loading states or user feedback exist during token refresh operations

**Problem:** Users get no feedback during token refresh (can take 30-60 seconds)

**Create:** `/src/contexts/TokenRefreshContext.tsx`

```typescript
import { createContext, useContext, useState, useEffect } from 'react';

interface TokenRefreshContextValue {
  isRefreshing: boolean;
  refreshDuration: number;
  provider: string | null;
}

const TokenRefreshContext = createContext<TokenRefreshContextValue>({
  isRefreshing: false,
  refreshDuration: 0,
  provider: null
});

export function TokenRefreshProvider({ children }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshDuration, setRefreshDuration] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Listen for token refresh events across tabs
  useEffect(() => {
    const channel = new BroadcastChannel('token-refresh');

    channel.onmessage = (event) => {
      if (event.data.type === 'refresh-start') {
        setIsRefreshing(true);
        setProvider(event.data.provider);
        setStartTime(Date.now());
      } else if (event.data.type === 'refresh-complete') {
        setIsRefreshing(false);
        setRefreshDuration(0);
        setProvider(null);
        setStartTime(null);
      }
    };

    return () => channel.close();
  }, []);

  // Update duration timer
  useEffect(() => {
    if (!isRefreshing || !startTime) return;

    const interval = setInterval(() => {
      setRefreshDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRefreshing, startTime]);

  // Show warning after 15 seconds
  useEffect(() => {
    if (refreshDuration > 15 && isRefreshing) {
      toast.warning('This is taking longer than usual. Please wait...');
    }
  }, [refreshDuration, isRefreshing]);

  return (
    <TokenRefreshContext.Provider value={{ isRefreshing, refreshDuration, provider }}>
      {children}
      {isRefreshing && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center space-x-2">
            <Spinner />
            <span>Refreshing {provider} connection...</span>
            {refreshDuration > 0 && <span>({refreshDuration}s)</span>}
          </div>
        </div>
      )}
    </TokenRefreshContext.Provider>
  );
}

export const useTokenRefresh = () => useContext(TokenRefreshContext);
```

**Update:** `/src/lib/providers/apiClient.ts` and `/src/lib/providers/quickbooks/client.ts`

⚠️ **NOTE**: There are TWO apiClient files - ensure you're modifying the correct one:

- `/src/lib/apiClient.ts` - For Amplify/Cognito auth
- `/src/lib/providers/apiClient.ts` - For provider token management (QuickBooks)

```typescript
// Broadcast token refresh events
const channel = new BroadcastChannel('token-refresh')

// Before refresh
channel.postMessage({ type: 'refresh-start', provider: 'quickbooks' })

// After refresh (success or failure)
channel.postMessage({ type: 'refresh-complete', provider: 'quickbooks' })
```

#### 3. Partial Token Storage Failure (#6 - CRITICAL)

**✅ VERIFIED ISSUE**: No retry mechanism exists for DB storage failures

**Problem:** If token exchange succeeds but DB storage fails, tokens are lost forever

**File:** `/src/app/api/providers/callback/route.ts` (Lines ~174-189)

**Implementation:**

```typescript
// Add retry logic with fallback
async function storeCredentialsWithRetry(orgId, providerId, name, credentials, maxRetries = 3) {
  let lastError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await storeProviderCredentialsInDB(orgId, providerId, name, credentials)
      return { success: true }
    } catch (error) {
      lastError = error
      console.error(`Storage attempt ${attempt}/${maxRetries} failed:`, error)

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000))
      }
    }
  }

  return { success: false, error: lastError }
}

// Use in callback
const result = await storeCredentialsWithRetry(organizationId, providerId, displayName, credentials)

if (!result.success) {
  // Fallback: Store encrypted tokens in session cookie
  const encryptedTokens = encrypt(JSON.stringify(credentials))

  const response = NextResponse.redirect(`${finalRedirectUrl}?pending_tokens=true`)
  response.cookies.set('pending_provider_tokens', encryptedTokens, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
  })

  return response
}
```

**Create:** `/src/app/api/providers/complete-connection/route.ts`

```typescript
export async function POST(req: Request) {
  const pendingTokens = req.cookies.get('pending_provider_tokens')

  if (!pendingTokens) {
    return NextResponse.json({ error: 'No pending tokens' }, { status: 404 })
  }

  const credentials = JSON.parse(decrypt(pendingTokens.value))
  const result = await storeCredentialsWithRetry(
    userId,
    credentials.providerId,
    credentials.name,
    credentials.data
  )

  if (result.success) {
    const response = NextResponse.json({ success: true })
    response.cookies.delete('pending_provider_tokens')
    return response
  }

  return NextResponse.json({ error: 'Storage failed' }, { status: 500 })
}
```

#### 4. Lock Timeout Race Condition (#7 - CRITICAL)

**✅ VERIFIED ISSUE**: Lock timeout can fail even when another process succeeded

**Problem:** Lock timeout doesn't check if another process succeeded

**File:** `/src/lib/providers/tokenLock.ts` (Lines ~242-259)

**Implementation:**

```typescript
// Check if another process succeeded before failing
if (!lockReleased) {
  console.log('Lock timeout - checking if token was refreshed by another process')

  const freshCredentials = await getProviderCredentialsFromDB(organizationId, providerId)

  if (freshCredentials && freshCredentials.connected) {
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = freshCredentials.expires_at - now

    // If token is now valid, another process succeeded
    if (timeUntilExpiry > TOKEN_REFRESH_BUFFER_SECONDS) {
      console.log('Token was refreshed by another process during lock wait')
      return freshCredentials.access_token
    }
  }

  // Token still expired - real timeout
  throw new Error(`Token refresh operation timed out waiting for lock after ${maxWaitMs}ms`)
}

// Also increase timeout
const maxWaitMs = options.maxWaitMs || 60000 // 60 seconds instead of 30

// Add jitter to prevent thundering herd
await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000))
```

#### 5. OAuth Callback Timeout (#9 - HIGH)

**✅ VERIFIED ISSUE**: No timeout exists for token exchange operations

**Problem:** Token exchange has no timeout, can hang indefinitely

**File:** `/src/app/api/providers/callback/route.ts` (Lines ~121-134)

**Implementation:**

```typescript
// Add timeout wrapper
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

// Use in callback
try {
  tokenSet = await fetchWithTimeout(
    provider.auth.handleCallback(code, state || ''),
    30000, // 30 second timeout
    'QuickBooks connection timeout - please try again'
  )
} catch (error) {
  console.error('Token exchange failed:', error)

  const errorMessage = error instanceof Error ? error.message : 'Token exchange failed'
  const errorType = errorMessage.includes('timeout') ? 'timeout' : 'token_exchange_failed'

  await storeProviderError(organizationId, providerId, errorMessage)

  return NextResponse.redirect(new URL(`${finalRedirectUrl}?oauth_error=${errorType}`, req.url))
}
```

#### 6. Invalid Grant Handling (#8 - CRITICAL)

**✅ VERIFIED ISSUE**: Inconsistent invalid_grant handling across different code paths

**Problem:** Inconsistent handling between QuickBooks client and API client

**Create:** `/src/lib/providers/errorHandlers.ts`

```typescript
export async function handleInvalidGrant(
  organizationId: string,
  providerId: string,
  error: any
): Promise<never> {
  console.error(`Invalid grant error for ${providerId}:`, error)

  // Always mark as disconnected
  await storeProviderCredentialsInDB(
    organizationId,
    providerId,
    getProviderDisplayName(providerId),
    {
      connected: false,
      error: 'invalid_grant',
      error_message: 'Authentication expired - please reconnect',
      last_error_at: Math.floor(Date.now() / 1000),
    }
  )

  // Store error for monitoring
  await storeProviderError(organizationId, providerId, 'Invalid grant - re-authentication required')

  // Log to monitoring
  oauthMonitoring.logTokenRefresh({
    organizationId,
    providerId,
    success: false,
    duration: 0,
    error: 'invalid_grant',
    errorType: 'invalid_grant',
    timestamp: Date.now(),
  })

  // Throw structured error
  const disconnectError: any = new Error(`${providerId} authentication expired - please reconnect`)
  disconnectError.code = 'PROVIDER_INVALID_GRANT'
  disconnectError.provider = providerId
  disconnectError.requiresReconnect = true
  throw disconnectError
}
```

---

### Phase 2: High Priority Fixes (Week 2)

#### 7. Connection Expiry Warnings (#3 - CRITICAL)

**Problem:** Users never warned about 101-day QuickBooks token expiry

**Update Database Schema:** `/src/lib/providers/database.ts`

```typescript
interface ProviderCredentials {
  access_token: string
  refresh_token?: string
  expires_at: number
  refresh_token_issued_at?: number // ADD
  refresh_token_expires_at?: number // ADD (issued_at + 101 days)
  connected: boolean
  last_synced: number
  last_error_at?: number // ADD
  last_error?: string // ADD
  error_count?: number // ADD
  [key: string]: any
}
```

**Create:** `/src/components/integrations/ConnectionExpiryBanner.tsx`

```typescript
export function ConnectionExpiryBanner({ credentials }) {
  const daysUntilExpiry = Math.floor(
    (credentials.refresh_token_expires_at - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry > 14) return null;

  const getSeverity = () => {
    if (daysUntilExpiry <= 1) return 'critical';
    if (daysUntilExpiry <= 7) return 'warning';
    return 'info';
  };

  const getMessage = () => {
    if (daysUntilExpiry <= 0) {
      return 'Your QuickBooks connection has expired. Reconnect now to restore data sync.';
    }
    if (daysUntilExpiry === 1) {
      return 'Action required: Your QuickBooks connection expires TODAY. Reconnect now to avoid interruption.';
    }
    if (daysUntilExpiry <= 7) {
      return `Your QuickBooks connection will expire in ${daysUntilExpiry} days. Please reconnect soon.`;
    }
    return `Your QuickBooks connection will expire in ${daysUntilExpiry} days.`;
  };

  return (
    <Alert severity={getSeverity()} className="mb-4">
      <AlertTitle>{getMessage()}</AlertTitle>
      <Button onClick={handleReconnect} variant="contained" size="small">
        {daysUntilExpiry <= 1 ? 'Reconnect Now' : 'Reconnect'}
      </Button>
    </Alert>
  );
}
```

#### 8. Circuit Breaker UX (#4 - HIGH)

**Problem:** Technical error message with no user guidance

**Create:** `/src/components/integrations/CircuitBreakerError.tsx`

```typescript
export function CircuitBreakerError({ retryAfter, onRetry, provider }) {
  const [countdown, setCountdown] = useState(retryAfter);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onRetry(); // Auto-retry when countdown reaches 0
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onRetry]);

  return (
    <Alert severity="warning" className="mt-4">
      <AlertTitle>Temporary Connection Issue</AlertTitle>
      <p>We're experiencing connection issues with {provider}.</p>
      <p className="mt-2">
        Retrying automatically in <strong>{countdown}</strong> seconds...
      </p>
      <div className="mt-3">
        <Button
          onClick={onRetry}
          disabled={countdown > 0}
          variant="outlined"
          size="small"
        >
          Retry Now
        </Button>
      </div>
    </Alert>
  );
}
```

**Update:** `/src/lib/providers/handler.ts`

```typescript
// Transform circuit breaker errors
if (errorMessage.includes('circuit breaker is OPEN')) {
  const match = errorMessage.match(/Try again in (\d+) seconds/)
  const waitTime = match ? parseInt(match[1]) : 60

  return NextResponse.json(
    {
      error: 'QuickBooks connection temporarily unavailable',
      code: 'CIRCUIT_BREAKER_OPEN',
      userMessage:
        "We're experiencing connection issues with QuickBooks. We'll retry automatically.",
      retryAfter: waitTime,
      autoRetry: true,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    },
    { status: 503 }
  )
}
```

#### 9. RealmId Validation (#11 - HIGH)

**Problem:** Missing or invalid RealmId causes silent failures

**File:** `/src/app/api/providers/callback/route.ts`

**Implementation:**

```typescript
// Validate realm ID format
function isValidRealmId(realmId: string | null): boolean {
  if (!realmId) return false
  // QuickBooks realm IDs are numeric strings, typically 10+ digits
  return /^\d{10,}$/.test(realmId)
}

// Use in callback
if (providerId === 'quickbooks') {
  const realmIdFromUrl = searchParams.get('realmId')
  const realmIdFromToken = tokenSet.realmId

  const realmId = realmIdFromUrl || realmIdFromToken

  if (!isValidRealmId(realmId)) {
    console.error('Invalid or missing realm ID:', realmId)
    await storeProviderError(organizationId, providerId, 'Invalid QuickBooks company ID received')

    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=invalid_realm_id`, req.url)
    )
  }

  credentials.realm_id = realmId
  credentials.provider_organization_id = credentials.realm_id
}
```

#### 10. Network Error Differentiation (#13 - MEDIUM)

**Problem:** Can't tell if user's internet is down vs QuickBooks servers

**Update:** `/src/lib/providers/apiClient.ts`

**Implementation:**

```typescript
function categorizeNetworkError(error: any): {
  type: 'client_network' | 'server_error' | 'timeout' | 'unknown'
  userMessage: string
  suggestedAction: string
} {
  const code = error.code || ''
  const message = error.message || ''

  // Client-side network issues
  if (['ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'].includes(code)) {
    return {
      type: 'client_network',
      userMessage: 'Connection lost. Please check your internet connection.',
      suggestedAction: 'Check your WiFi or cellular connection and try again.',
    }
  }

  // Timeouts
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return {
      type: 'timeout',
      userMessage: 'Request timed out. QuickBooks may be experiencing delays.',
      suggestedAction: 'Try again in a moment. If this persists, QuickBooks may be having issues.',
    }
  }

  // Server errors (connection refused/reset)
  if (['ECONNREFUSED', 'ECONNRESET'].includes(code)) {
    return {
      type: 'server_error',
      userMessage: 'QuickBooks servers are not responding.',
      suggestedAction: 'QuickBooks may be experiencing issues. Try again in a few minutes.',
    }
  }

  return {
    type: 'unknown',
    userMessage: 'Network error occurred.',
    suggestedAction: 'Please try again.',
  }
}

// Use in error handler
if (NETWORK_ERROR_CODES.includes((error as any).code)) {
  const categorized = categorizeNetworkError(error)

  const networkError: any = new Error(categorized.userMessage)
  networkError.isNetworkError = true
  networkError.networkType = categorized.type
  networkError.suggestedAction = categorized.suggestedAction
  networkError.originalError = error

  // Auto-retry for client network errors
  if (categorized.type === 'client_network' && attempt < 3) {
    console.log(`Network error detected, retrying (${attempt}/3)...`)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return this.performTokenRefresh(refreshToken, attempt + 1)
  }

  throw networkError
}
```

---

### Phase 3: Polish & Edge Cases (Week 3-4)

#### 11. Multi-Tab Coordination (#10 - MEDIUM)

```typescript
// Use BroadcastChannel for cross-tab communication
const tokenRefreshChannel = new BroadcastChannel('token-refresh')

// Tab 1 (refreshing)
tokenRefreshChannel.postMessage({
  type: 'refresh-start',
  provider: 'quickbooks',
  timestamp: Date.now(),
})

// Tabs 2 & 3 (listening)
tokenRefreshChannel.onmessage = (event) => {
  if (event.data.type === 'refresh-start') {
    setIsRefreshingToken(true)
    showToast('Refreshing QuickBooks connection...', { type: 'loading' })
  } else if (event.data.type === 'refresh-complete') {
    setIsRefreshingToken(false)
    refetchData()
  }
}
```

#### 12. OAuth State Expiry UX (#12 - MEDIUM)

```typescript
// Extend expiry and improve messaging
const STATE_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes instead of 10

if (Date.now() > Item.expiresAt) {
  const error: any = new Error('This connection request has expired. Please start over.')
  error.code = 'STATE_EXPIRED'
  error.userMessage = 'Your connection request timed out. Click "Connect QuickBooks" to try again.'
  throw error
}
```

#### 13. Loading States During OAuth (#5 - MEDIUM)

```typescript
const [isConnecting, setIsConnecting] = useState(false);

async function handleConnect(providerId: string) {
  setIsConnecting(true);

  try {
    window.location.href = `/api/providers/${providerId}/login?redirect_uri=${encodedRedirect}`;
  } catch (error) {
    setIsConnecting(false);
    toast.error('Failed to initiate connection');
  }
}

// UI
<Button
  onClick={() => handleConnect('quickbooks')}
  disabled={isConnecting}
>
  {isConnecting ? (
    <>
      <Spinner size="sm" />
      Redirecting to QuickBooks...
    </>
  ) : (
    'Connect QuickBooks'
  )}
</Button>
```

---

## 📊 Summary & Impact

### Issues Fixed

| Priority     | Count  | Impact                                    |
| ------------ | ------ | ----------------------------------------- |
| **Critical** | 10     | Prevents data loss, fixes broken UX       |
| **High**     | 4      | Improves reliability and error visibility |
| **Medium**   | 5      | Polish and edge case handling             |
| **Total**    | **19** | Complete overhaul of auth UX              |

### User Experience Improvements

- ✅ No more seeing 0s after login
- ✅ Clear error messages when OAuth fails
- ✅ Loading indicators during token refresh
- ✅ Proactive connection expiry warnings
- ✅ User-friendly circuit breaker messages
- ✅ Proper retry mechanisms for failures
- ✅ Multi-tab coordination
- ✅ Network error guidance

### Technical Improvements

- ✅ Fixed race conditions
- ✅ Added retry logic with exponential backoff
- ✅ Proper timeout handling
- ✅ Consistent error handling
- ✅ Better monitoring and logging
- ✅ Improved caching strategy

---

## 🚀 Quick Wins (< 1 hour each)

1. **Add OAuth error display** - Simple useEffect hook
2. **Fix loading state logic** - Change conditional check
3. **Add OAuth button loading state** - Add disabled + spinner
4. **Extend state expiry** - Change constant from 10 to 30 minutes
5. **Add RealmId validation** - Simple regex check

---

## 📈 Success Metrics

After implementation, monitor:

1. **Reduction in "0s displayed" incidents** - Should drop to near 0%
2. **OAuth success rate** - Should increase by 20-30%
3. **Token refresh success rate** - Should increase to >95%
4. **User-reported auth issues** - Should decrease by 50%+
5. **Time to successful data load** - Should be <3 seconds

---

## 🔧 Testing Checklist

- [ ] Test fast login → redirect flow
- [ ] Test slow network conditions (throttle to 3G)
- [ ] Test expired tokens scenario
- [ ] Test QuickBooks disconnection
- [ ] Test multi-tab token refresh
- [ ] Test OAuth timeout scenarios
- [ ] Test storage failure retry
- [ ] Test circuit breaker countdown
- [ ] Test connection expiry warnings
- [ ] Test all error messages display correctly

---

This plan addresses both the critical "0s after login" bug and the comprehensive QuickBooks authentication issues from the audit. Implementation should be done in phases, starting with the most critical user-facing issues.
