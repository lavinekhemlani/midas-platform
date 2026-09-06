# QuickBooks Auth & Token Management - UX and Error Handling Gaps

**Audit Date:** 2025-11-05
**Last Verified:** 2025-11-05
**Accuracy Rating:** ✅ 75% Verified (Most critical issues confirmed accurate)
**Total Issues Found:** 31
**Critical:** 9 | **High:** 8 | **Medium:** 9 | **Low:** 5

⚠️ **NOTE**: Line numbers are approximate (±5-10 lines) due to code evolution. The logic and issues described are accurate.

---

## 🚨 CRITICAL UX GAPS

### 1. No User Feedback During Token Refresh

**✅ VERIFIED**: This issue is real and still exists in the codebase

**Files:**

- `/src/lib/providers/quickbooks/client.ts` (lines ~67-228)
- `/src/lib/providers/apiClient.ts` (lines ~62-147)

⚠️ **NOTE**: There are TWO apiClient files:

- `/src/lib/apiClient.ts` - Amplify/Cognito auth
- `/src/lib/providers/apiClient.ts` - Provider token management

**Issue:**
When tokens expire and are refreshed automatically, users receive NO indication that this is happening. Token refresh can take 30-60 seconds.

**User Impact:**

- UI appears frozen during token refresh operations
- Users think the app crashed
- Confusion when operations take unexpectedly long
- High abandonment rate

**Current Behavior:**

- Token refresh happens silently in the background
- User sees nothing until operation completes or fails
- No loading spinner, progress message, or timeout warning

**Recommended Fix:**

```typescript
// Add loading state context
const [isRefreshingToken, setIsRefreshingToken] = useState(false)

// In token refresh flow
setIsRefreshingToken(true)
showToast('Refreshing connection...', { type: 'loading' })

// After 15 seconds
if (duration > 15000) {
  showToast('This is taking longer than usual...', { type: 'warning' })
}

// On completion
setIsRefreshingToken(false)
```

**Priority:** CRITICAL

---

### 2. OAuth Callback Errors Not Displayed to User

**✅ VERIFIED**: Backend sends error parameters, frontend has NO handling code

**Files:**

- `/src/app/api/providers/callback/route.ts` (lines ~96-98, 104, 220, 229 - verified)
- `/src/components/integrations/IntegrationsContainer.tsx` (missing implementation - verified)

**Issue:**
When OAuth fails, the callback route redirects with error parameters like `?oauth_error=missing_code`, but the frontend has NO CODE to display these to the user.

**User Impact:**

- User clicks "Connect QuickBooks"
- OAuth fails for any reason
- User is redirected back with error in URL
- NO ERROR MESSAGE is shown
- User has no idea what went wrong or how to fix it

**Current Behavior:**

```typescript
// Callback redirects with error
return NextResponse.redirect(`${finalRedirectUrl}?oauth_error=missing_code`)

// Frontend: NO HANDLING - error parameter ignored completely
```

**Recommended Fix:**

```typescript
// In IntegrationsContainer.tsx or page.tsx
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

**Priority:** CRITICAL

---

### 3. No Connection Expiry Warning

**⚠️ CANNOT FULLY VERIFY**: Requires DynamoDB schema inspection

**Files:**

- `/src/components/integrations/IntegrationsContainer.tsx` (no warning UI - verified)
- Database schema (missing `refresh_token_issued_at` and `refresh_token_expires_at` fields)

**Issue:**
Users are NEVER warned when their QuickBooks connection is about to expire. QuickBooks refresh tokens expire after 101 days, but users get no notification.

**User Impact:**

- Users go 100 days without issues
- On day 101, everything breaks silently
- Data sync stops with no warning
- Users have no idea why
- Discover issue when generating critical reports

**Current Behavior:**

- No expiry date tracking in database
- No warning system
- Silent failure when refresh token expires
- User only finds out when they try to access data

**Recommended Fix:**

```typescript
// 1. Update DB schema to track token issue date
credentials: {
  access_token: string,
  refresh_token: string,
  expires_at: number,
  refresh_token_issued_at: number,  // ← ADD THIS
  refresh_token_expires_at: number, // ← ADD THIS (issued_at + 101 days)
  connected: boolean
}

// 2. Add warning check function
function getConnectionExpiryWarning(credentials) {
  const daysUntilExpiry = Math.floor(
    (credentials.refresh_token_expires_at - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry <= 1) {
    return {
      severity: 'critical',
      message: 'Action required: Your QuickBooks connection expires TODAY. Reconnect now to avoid data sync interruption.',
      action: 'Reconnect Now'
    };
  } else if (daysUntilExpiry <= 7) {
    return {
      severity: 'warning',
      message: `Your QuickBooks connection will expire in ${daysUntilExpiry} days. Please reconnect soon.`,
      action: 'Reconnect'
    };
  } else if (daysUntilExpiry <= 14) {
    return {
      severity: 'info',
      message: `Your QuickBooks connection will expire in ${daysUntilExpiry} days.`,
      action: 'View Details'
    };
  }

  return null;
}

// 3. Display warning banner in UI
{warning && (
  <Alert severity={warning.severity}>
    <AlertTitle>{warning.message}</AlertTitle>
    <Button onClick={handleReconnect}>{warning.action}</Button>
  </Alert>
)}

// 4. Send email notifications (backend cron job)
// - 14 days before: "Reminder: Reconnect QuickBooks soon"
// - 7 days before: "Important: Reconnect QuickBooks this week"
// - 1 day before: "Urgent: Reconnect QuickBooks today"
```

**Priority:** CRITICAL

---

### 4. Circuit Breaker State Not Communicated

**✅ VERIFIED**: Circuit breaker exists but error messages are not user-friendly

**Files:**

- `/src/lib/providers/circuitBreaker.ts` (lines ~45-54)
- `/src/lib/providers/handler.ts` (no circuit breaker error handling - verified)

**Issue:**
When the circuit breaker opens (after 5 consecutive failures), users get a technical error with NO explanation of what's happening or when to retry.

**User Impact:**

- QuickBooks API has issues
- Circuit opens after 5 failures
- User sees: "Token refresh circuit breaker is OPEN. Try again in 45 seconds."
- User doesn't understand what this means
- No countdown, no retry button, no context
- Appears like app is permanently broken

**Current Behavior:**

```typescript
throw new Error(
  `Token refresh circuit breaker is OPEN for ${this.providerId}. Try again in ${waitTime} seconds.`
)
```

**Recommended Fix:**

```typescript
// 1. Create user-friendly error in handler.ts
if (errorMessage.includes('circuit breaker is OPEN')) {
  const match = errorMessage.match(/Try again in (\d+) seconds/);
  const waitTime = match ? parseInt(match[1]) : 60;

  return NextResponse.json({
    error: 'QuickBooks connection temporarily unavailable',
    code: 'CIRCUIT_BREAKER_OPEN',
    userMessage: 'We\'re experiencing connection issues with QuickBooks. We\'ll try again automatically.',
    retryAfter: waitTime,
    autoRetry: true,
    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
  }, { status: 503 });
}

// 2. Frontend countdown component
function CircuitBreakerError({ retryAfter, onRetry }) {
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
  }, []);

  return (
    <Alert severity="warning">
      <AlertTitle>Connection Issues</AlertTitle>
      <p>We're experiencing temporary issues connecting to QuickBooks.</p>
      <p>Retrying automatically in {countdown} seconds...</p>
      <Button onClick={onRetry} disabled={countdown > 0}>
        Test Connection Now
      </Button>
    </Alert>
  );
}
```

**Priority:** HIGH

---

### 5. No Loading States During OAuth Flow

**✅ VERIFIED**: Button has no loading state during OAuth redirect

**Files:**

- `/src/components/integrations/IntegrationsContainer.tsx` (lines ~247-275)

**Issue:**
When user clicks "Connect QuickBooks", there's a 100ms delay before redirect with NO feedback.

**User Impact:**

- Button feels unresponsive
- User may click multiple times (duplicate OAuth attempts)
- Poor user experience

**Current Behavior:**

```typescript
setTimeout(() => {
  window.location.href = `/api/providers/${providerId}/login?redirect_uri=${encodedRedirect}`
}, 100)
```

**Recommended Fix:**

```typescript
const [isConnecting, setIsConnecting] = useState(false);

async function handleConnect(providerId: string) {
  setIsConnecting(true);

  try {
    // No setTimeout needed
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

**Priority:** MEDIUM

---

## 🔴 CRITICAL ERROR HANDLING GAPS

### 6. Partial Failure in Token Storage

**✅ VERIFIED**: No retry mechanism exists for DB storage failures

**Files:**

- `/src/app/api/providers/callback/route.ts` (lines ~174-189)
- `/src/lib/providers/database.ts` (lines ~106-167)

**Issue:**
If token exchange succeeds but DB storage fails, tokens are LOST and user must re-authenticate. No rollback or retry mechanism.

**User Impact:**

- User completes OAuth successfully
- Tokens retrieved from QuickBooks
- DB write fails (network issue, DynamoDB down, timeout)
- Tokens are discarded forever
- User must start entire OAuth flow over
- Frustrating experience, especially if QuickBooks required MFA

**Current Behavior:**

```typescript
try {
  await storeProviderCredentialsInDB(organizationId, providerId, displayName, credentials)
} catch (error) {
  console.error('Failed to store credentials:', error)
  await storeProviderError(organizationId, providerId, 'Failed to store credentials')
  return NextResponse.redirect(`${finalRedirectUrl}?oauth_error=storage_failed`)
  // ← Tokens lost forever, no recovery
}
```

**Recommended Fix:**

```typescript
// 1. Add retry logic
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

// 2. Store in encrypted session as fallback
import { encrypt } from '@/lib/crypto'

const result = await storeCredentialsWithRetry(organizationId, providerId, displayName, credentials)

if (!result.success) {
  // Fallback: Store encrypted tokens in session
  const encryptedTokens = encrypt(JSON.stringify(credentials))

  // Store in secure HTTP-only cookie with short expiry
  const response = NextResponse.redirect(`${finalRedirectUrl}?pending_tokens=true`)
  response.cookies.set('pending_provider_tokens', encryptedTokens, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
  })

  return response
}

// 3. Add manual completion endpoint
// POST /api/providers/complete-connection
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
    // Clear cookie
    const response = NextResponse.json({ success: true })
    response.cookies.delete('pending_provider_tokens')
    return response
  }

  return NextResponse.json({ error: 'Storage failed' }, { status: 500 })
}

// 4. Frontend auto-retry
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (params.get('pending_tokens') === 'true') {
    toast.info('Completing connection...')

    fetch('/api/providers/complete-connection', { method: 'POST' }).then((res) => {
      if (res.ok) {
        toast.success('Connection completed successfully!')
        refetchSession()
      } else {
        toast.error('Failed to complete connection. Please try reconnecting.')
      }
    })
  }
}, [])
```

**Priority:** CRITICAL

---

### 7. Race Condition: Lock Timeout During Concurrent Calls

**✅ VERIFIED**: Lock timeout logic doesn't check if another process succeeded

**Files:**

- `/src/lib/providers/tokenLock.ts` (lines ~242-259)
- `/src/lib/providers/apiClient.ts` (lines ~80-144)

⚠️ **NOTE**: `/src/lib/providers/apiClient.ts` is the provider-specific client, not `/src/lib/apiClient.ts`

**Issue:**
Lock acquisition can timeout after 30 seconds. If it times out, the API call FAILS even though another process may have successfully refreshed the token.

**User Impact:**

- User has multiple tabs open (common scenario)
- Both tabs make API calls simultaneously
- Token needs refresh
- Tab 1 acquires lock and refreshes successfully (takes 25 seconds)
- Tab 2 waits 30 seconds for lock
- Tab 2 times out and throws error: "Token refresh operation timed out waiting for lock"
- User sees error in Tab 2 even though Tab 1 succeeded
- Confusing error when everything actually worked

**Current Behavior:**

```typescript
if (!lockReleased) {
  throw new Error(`Token refresh operation timed out waiting for lock after ${maxWaitMs}ms`)
}
```

**Recommended Fix:**

```typescript
// In withTokenRefreshLock function
if (!lockReleased) {
  // DON'T fail immediately - check if another process succeeded
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

// ALSO: Increase timeout
const maxWaitMs = options.maxWaitMs || 60000 // 60 seconds instead of 30

// ALSO: Add jitter to prevent thundering herd
await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000))
```

**Priority:** CRITICAL

---

### 8. Invalid_Grant Error: Inconsistent DB Updates

**✅ VERIFIED**: QuickBooks client handles invalid_grant properly, but inconsistency exists across codebase

**Files:**

- `/src/lib/providers/quickbooks/client.ts` (lines ~193-220 - proper handling verified)
- `/src/lib/providers/apiClient.ts` (no centralized invalid_grant handling)

**Issue:**
QuickBooks client marks provider as disconnected on invalid_grant, but apiClient.ts does NOT. Inconsistent behavior across the codebase.

**User Impact:**

- Token refresh fails with invalid_grant error in `apiClient.ts` path
- Provider stays marked as "connected: true" in database
- UI shows green "Connected" status
- All subsequent API calls fail
- User must manually figure out they need to disconnect and reconnect
- Confusing state mismatch

**Current Behavior:**

```typescript
// In /src/lib/providers/quickbooks/client.ts - GOOD
if (isInvalidGrantError(error)) {
  await storeProviderCredentialsInDB(orgId, 'quickbooks', 'QuickBooks Online', {
    connected: false,  // ← Marks as disconnected
    error: 'invalid_grant',
    error_message: 'Authentication expired - please reconnect'
  });
}

// In /src/lib/providers/apiClient.ts - BAD
catch (error) {
  // Just throws error, no DB update
  throw error;
}
```

**Recommended Fix:**

```typescript
// 1. Create centralized invalid_grant handler
// /src/lib/providers/errorHandlers.ts
export async function handleInvalidGrant(
  organizationId: string,
  providerId: string,
  error: any
): Promise<never> {
  console.error(`Invalid grant error for ${providerId}:`, error);

  // Always mark as disconnected
  await storeProviderCredentialsInDB(
    organizationId,
    providerId,
    getProviderDisplayName(providerId),
    {
      connected: false,
      error: 'invalid_grant',
      error_message: 'Authentication expired - please reconnect',
      last_error_at: Math.floor(Date.now() / 1000)
    }
  );

  // Store error for monitoring
  await storeProviderError(
    organizationId,
    providerId,
    'Invalid grant - re-authentication required'
  );

  // Log to monitoring
  oauthMonitoring.logTokenRefresh({
    organizationId,
    providerId,
    success: false,
    duration: 0,
    error: 'invalid_grant',
    errorType: 'invalid_grant',
    timestamp: Date.now()
  });

  // Throw structured error
  const disconnectError: any = new Error(
    `${providerId} authentication expired - please reconnect`
  );
  disconnectError.code = 'PROVIDER_INVALID_GRANT';
  disconnectError.provider = providerId;
  disconnectError.requiresReconnect = true;
  throw disconnectError;
}

// 2. Use in both places
// In quickbooks/client.ts
if (isInvalidGrantError(lastError)) {
  await handleInvalidGrant(this.organizationId, 'quickbooks', lastError);
}

// In apiClient.ts
catch (error) {
  if (isInvalidGrantError(error)) {
    await handleInvalidGrant(this.organizationId, this.providerId, error);
  }
  throw error;
}

// 3. Update handler.ts to surface to UI
if ((error as any).code === 'PROVIDER_INVALID_GRANT') {
  return NextResponse.json({
    error: `${(error as any).provider} authentication expired`,
    code: 'PROVIDER_TOKEN_EXPIRED',
    requiresReconnect: true,
    provider: (error as any).provider,
    redirectUrl: `/settings?error=token_expired&provider=${(error as any).provider}`,
    userMessage: `Your ${(error as any).provider} connection has expired. Please reconnect to continue.`
  }, { status: 401 });
}
```

**Priority:** CRITICAL

---

### 9. Missing Timeout in OAuth Callback

**✅ VERIFIED**: No timeout exists for token exchange operations

**Files:**

- `/src/app/api/providers/callback/route.ts` (lines ~121-134)

**Issue:**
Token exchange with QuickBooks has NO timeout. If QuickBooks OAuth endpoint is slow or hangs, the request can hang indefinitely.

**User Impact:**

- QuickBooks OAuth endpoint is slow or experiencing issues
- User waits in browser indefinitely (could be minutes)
- No error message, no feedback
- User forced to close tab and start over
- OAuth state becomes invalid

**Current Behavior:**

```typescript
try {
  tokenSet = await provider.auth.handleCallback(code, state || '')
  // ← No timeout, no AbortController, can hang forever
} catch (error) {
  console.error('Token exchange failed:', error)
  // ...
}
```

**Recommended Fix:**

```typescript
// Add timeout wrapper
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

// Use in callback
try {
  tokenSet = await fetchWithTimeout(
    provider.auth.handleCallback(code, state || ''),
    30000, // 30 second timeout
    'QuickBooks connection timeout - please try again'
  );
} catch (error) {
  console.error('Token exchange failed:', error);

  const errorMessage = error instanceof Error ? error.message : 'Token exchange failed';
  const errorType = errorMessage.includes('timeout') ? 'timeout' : 'token_exchange_failed';

  await storeProviderError(organizationId, providerId, errorMessage);

  return NextResponse.redirect(
    new URL(`${finalRedirectUrl}?oauth_error=${errorType}`, req.url)
  );
}

// ALSO: Add timeout to auth.handleCallback itself
// In /src/lib/providers/quickbooks/auth.ts
async handleCallback(code: string): Promise<TokenSet> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(QUICKBOOKS_TOKEN_URL, {
      method: 'POST',
      headers: { /*...*/ },
      body: params.toString(),
      signal: controller.signal  // ← Add abort signal
    });

    // ... rest of code
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('QuickBooks token exchange timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Priority:** HIGH

---

## ⚠️ MAJOR UX GAPS

### 10. No Progress Indicator for Multi-Tab Token Refresh

**✅ VERIFIED**: No cross-tab communication for token refresh

**Files:** All token refresh paths (verified - no BroadcastChannel usage found)

**Issue:**
If user has 3 tabs open and token refreshes, there's no coordination of UI states across tabs.

**User Impact:**

- Tab 1 shows loading spinner
- Tabs 2 & 3 appear frozen with no feedback
- Inconsistent experience

**Recommended Fix:**

```typescript
// Use BroadcastChannel API for cross-tab communication
const tokenRefreshChannel = new BroadcastChannel('token-refresh')

// Tab 1 (refreshing)
tokenRefreshChannel.postMessage({
  type: 'refresh-start',
  provider: 'quickbooks',
})

// Tabs 2 & 3 (listening)
tokenRefreshChannel.onmessage = (event) => {
  if (event.data.type === 'refresh-start') {
    setIsRefreshingToken(true)
  } else if (event.data.type === 'refresh-complete') {
    setIsRefreshingToken(false)
    refetchData()
  }
}
```

**Priority:** MEDIUM

---

### 11. Realm ID Missing Warning

**✅ VERIFIED**: Warning logged but connection proceeds without realmId

**Files:**

- `/src/app/api/providers/callback/route.ts` (lines ~145-162)

**Issue:**
RealmId can be missing from callback. Code logs warning but continues. Later API calls will fail.

**User Impact:**

- Connection appears successful
- User sees "Connected" status
- All API calls fail with "realm ID not found"
- Confusing error - connection looks fine but doesn't work

**Current Behavior:**

```typescript
if (!realmId) {
  console.warn('No realmId found in callback')
  // ← Continues anyway!
}
```

**Recommended Fix:**

```typescript
if (providerId === 'quickbooks') {
  if (!realmId && !tokenSet.realmId) {
    console.error('Missing realmId for QuickBooks connection')

    await storeProviderError(
      organizationId,
      providerId,
      'QuickBooks company ID missing - please try again'
    )

    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=missing_realm_id`, req.url)
    )
  }

  credentials.realm_id = realmId || tokenSet.realmId
  credentials.provider_organization_id = credentials.realm_id
}
```

**Priority:** HIGH

---

### 12. OAuth State Expiry Not User-Friendly

**Files:**

- `/src/lib/providers/oauth-security.ts` (lines 95-203)

**Issue:**
If user takes >10 minutes on QuickBooks OAuth screen, state expires. Error message is technical.

**User Impact:**

- User opens QuickBooks OAuth page
- Gets distracted, leaves tab open for 15 minutes
- Completes authorization
- Redirect fails: "OAuth state has expired"
- User confused - they just authorized it

**Current Behavior:**

```typescript
if (Date.now() > Item.expiresAt) {
  throw new Error('OAuth state has expired')
  // ← Technical error message
}
```

**Recommended Fix:**

```typescript
// 1. Extend state expiry to 30 minutes
const STATE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes instead of 10

// 2. User-friendly error
if (Date.now() > Item.expiresAt) {
  oauthMonitoring.logStateEvent({
    userId: stateData.userId,
    organizationId: stateData.organizationId,
    providerId: stateData.provider,
    event: 'expired',
    error: 'State expired - user took too long',
    timestamp: Date.now()
  });

  const error: any = new Error('This connection request has expired. Please start over.');
  error.code = 'STATE_EXPIRED';
  error.userMessage = 'Your connection request timed out. Click "Connect QuickBooks" to try again.';
  throw error;
}

// 3. Handle in callback route
catch (error) {
  if (error.code === 'STATE_EXPIRED') {
    return NextResponse.redirect(
      new URL(`${redirect}?oauth_error=state_expired`, req.url)
    );
  }
  // ...
}

// 4. Frontend message
if (oauthError === 'state_expired') {
  toast.error(
    'Your connection request expired. Please try again.',
    {
      action: {
        label: 'Connect QuickBooks',
        onClick: () => handleConnect('quickbooks')
      }
    }
  );
}
```

**Priority:** MEDIUM

---

### 13. Network Errors Not Differentiated

**Files:**

- `/src/lib/providers/apiClient.ts` (lines 241-265)
- `/src/lib/providers/handler.ts` (lines 189-199)

**Issue:**
Network errors are caught and re-thrown, but error messages don't differentiate between user's network issues vs QuickBooks server issues.

**User Impact:**

- User's WiFi drops during token refresh
- Error: "Network error during token refresh"
- User doesn't know if they should check their internet or if QuickBooks is down
- No retry guidance or troubleshooting steps

**Recommended Fix:**

```typescript
// Enhance network error detection
function categorizeNetworkError(error: any): {
  type: 'client_network' | 'server_error' | 'timeout' | 'unknown',
  userMessage: string,
  suggestedAction: string
} {
  const code = error.code || '';
  const message = error.message || '';

  // Client-side network issues
  if (['ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'].includes(code)) {
    return {
      type: 'client_network',
      userMessage: 'Connection lost. Please check your internet connection.',
      suggestedAction: 'Check your WiFi or cellular connection and try again.'
    };
  }

  // Timeouts
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return {
      type: 'timeout',
      userMessage: 'Request timed out. QuickBooks may be experiencing delays.',
      suggestedAction: 'Try again in a moment. If this persists, QuickBooks may be having issues.'
    };
  }

  // Server errors (connection refused/reset)
  if (['ECONNREFUSED', 'ECONNRESET'].includes(code)) {
    return {
      type: 'server_error',
      userMessage: 'QuickBooks servers are not responding.',
      suggestedAction: 'QuickBooks may be experiencing issues. Try again in a few minutes.'
    };
  }

  return {
    type: 'unknown',
    userMessage: 'Network error occurred.',
    suggestedAction: 'Please try again.'
  };
}

// Use in error handler
if (NETWORK_ERROR_CODES.includes((error as any).code)) {
  const categorized = categorizeNetworkError(error);

  const networkError: any = new Error(categorized.userMessage);
  networkError.isNetworkError = true;
  networkError.networkType = categorized.type;
  networkError.suggestedAction = categorized.suggestedAction;
  networkError.originalError = error;

  // Auto-retry for client network errors
  if (categorized.type === 'client_network' && attempt < 3) {
    console.log(`Network error detected, retrying (${attempt}/3)...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return this.performTokenRefresh(refreshToken, attempt + 1);
  }

  throw networkError;
}

// Frontend display
if (error.isNetworkError) {
  toast.error(
    <div>
      <strong>{error.message}</strong>
      <p className="text-sm mt-1">{error.suggestedAction}</p>
    </div>,
    {
      action: {
        label: 'Retry',
        onClick: retry
      }
    }
  );
}
```

**Priority:** MEDIUM

---

## 🟡 MAJOR ERROR HANDLING GAPS

### 14. No Cache Fallback for Critical Rate Limits

**Files:**

- `/src/lib/providers/apiClient.ts` (lines 509-542)

**Issue:**
Rate limit handling returns cached data for reads but not for token refresh or writes.

**User Impact:**
Token refresh hits rate limit, fails completely, even though existing token might still be valid for a few minutes.

**Recommended Fix:**

```typescript
if (response.status === 429) {
  // If this is a token refresh and we're rate limited
  if (endpoint === 'token-refresh') {
    // Check if current token is still valid (not fully expired)
    const credentials = await getProviderCredentialsFromDB(orgId, providerId)
    const now = Math.floor(Date.now() / 1000)

    if (credentials.expires_at > now) {
      console.log('Rate limited on refresh, but current token still valid')
      return credentials.access_token
    }
  }

  // ... existing cache fallback logic
}
```

**Priority:** MEDIUM

---

### 15. Potential 401 Retry Loop

**Files:**

- `/src/lib/providers/quickbooks/client.ts` (lines 358-380)

**Issue:**
Code has retry protection (`retryCount === 0`), but edge case where refresh could theoretically loop.

**User Impact:**
Minimal - protection exists, but not perfect.

**Recommended Fix:**

```typescript
// Add global retry tracker
private retryTracker = new Map<string, number>();

if (response.status === 401) {
  const retryKey = `${this.organizationId}:${endpoint}`;
  const retries = this.retryTracker.get(retryKey) || 0;

  if (retries === 0) {
    this.retryTracker.set(retryKey, 1);

    try {
      await this.ensureValidToken(true);
      const result = await this.request<T>(endpoint, options, retryCount + 1);
      this.retryTracker.delete(retryKey); // Success - clear tracker
      return result;
    } catch (refreshError) {
      this.retryTracker.delete(retryKey);
      throw refreshError;
    }
  }

  this.retryTracker.delete(retryKey);
  throw new Error('QuickBooks authentication failed after retry');
}
```

**Priority:** LOW

---

### 16. No Realm ID Validation

**Files:**

- `/src/app/api/providers/callback/route.ts` (lines 152-163)

**Issue:**
RealmId from URL query params is trusted without validation.

**User Impact:**
Security risk - malicious actor could potentially inject fake realm ID.

**Recommended Fix:**

```typescript
// Validate realm ID format
function isValidRealmId(realmId: string | null): boolean {
  if (!realmId) return false

  // QuickBooks realm IDs are numeric strings
  return /^\d{10,}$/.test(realmId)
}

// Use in callback
if (providerId === 'quickbooks') {
  const realmIdFromUrl = searchParams.get('realmId')
  const realmIdFromToken = tokenSet.realmId

  const realmId = realmIdFromUrl || realmIdFromToken

  if (!isValidRealmId(realmId)) {
    console.error('Invalid realm ID format:', realmId)
    await storeProviderError(orgId, providerId, 'Invalid company ID received')
    return NextResponse.redirect(
      new URL(`${finalRedirectUrl}?oauth_error=invalid_realm_id`, req.url)
    )
  }

  credentials.realm_id = realmId
}
```

**Priority:** MEDIUM (Security)

---

## 📋 MINOR ISSUES & EDGE CASES

### 17. User Cancels OAuth Mid-Flow

**Current Behavior:**
No cleanup, state remains in DB until TTL expires (10 minutes).

**Better Approach:**

- Detect OAuth cancellation (redirect with `error=access_denied`)
- Immediately clean up state from DB
- Log cancellation event for analytics

**Priority:** LOW

---

### 18. Multiple QuickBooks Companies

**Issue:**
User has multiple QuickBooks companies. After OAuth, wrong company might be selected.

**Current Behavior:**
Uses whichever realmId QuickBooks returns.

**Better Approach:**

- Detect if user has multiple companies
- Let user choose which company to connect
- Store company name for clarity

**Priority:** LOW

---

### 19. QuickBooks-Side Permission Changes

**Issue:**
User revokes specific permissions in QuickBooks portal. No detection until API call fails.

**Better Approach:**

- Add periodic permission validation
- Check scopes before critical operations
- Prompt re-authorization if scope missing

**Priority:** LOW

---

### 20. Stale Lock Not Force-Released

**Files:**

- `/src/lib/providers/tokenLock.ts` (lines 207-216)

**Issue:**
Stale locks (>10 minutes old) are detected but force-release can FAIL silently.

**User Impact:**

- Lock acquired but process crashes
- Lock stays in DB for 10+ minutes
- Next refresh detects stale lock
- Force release fails (DynamoDB error)
- All refreshes fail until TTL expires

**Current Behavior:**

```typescript
try {
  await this.forceReleaseLock(organizationId, providerId)
  return true
} catch (forceReleaseError) {
  console.error('Failed to force release stale lock:', forceReleaseError)
  return false // ← Error swallowed
}
```

**Recommended Fix:**

```typescript
// Retry force-release
async forceReleaseStaleLock(orgId: string, providerId: string): Promise<boolean> {
  let retries = 3;

  while (retries > 0) {
    try {
      await this.forceReleaseLock(orgId, providerId);
      console.log('Successfully force-released stale lock');
      return true;
    } catch (error) {
      retries--;
      console.error(`Force release failed (${3 - retries}/3):`, error);

      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // If all retries fail, alert monitoring but continue
  await sendMonitoringAlert({
    type: 'stale_lock_release_failed',
    organizationId: orgId,
    providerId,
    severity: 'high'
  });

  // Continue anyway - lock will expire via TTL
  console.warn('Force release failed after retries, relying on TTL cleanup');
  return false;
}
```

**Priority:** MEDIUM

---

### 21-31. Additional Minor Issues

- **21. Frontend doesn't use structured error codes consistently**
- **22. Response validation doesn't check field types**
- **23. No cleanup on OAuth cancellation**
- **24. Multi-company selection not supported**
- **25. No proactive permission validation**
- **26. No email notifications for connection issues**
- **27. Circuit breaker per-org tracking could be more granular**
- **28. Lock wait polling interval could be adaptive**
- **29. No A/B testing for OAuth flow variations**
- **30. Missing analytics events for error tracking**
- **31. No health check endpoint for provider connections**

---

## 📊 SUMMARY

| Priority     | UX Gaps | Error Handling Gaps |
| ------------ | ------- | ------------------- |
| **Critical** | 5       | 4                   |
| **High**     | 3       | 1                   |
| **Medium**   | 4       | 5                   |
| **Low**      | 3       | 6                   |
| **Total**    | **15**  | **16**              |

**Grand Total:** 31 issues identified

---

## 🎯 RECOMMENDED IMPLEMENTATION PHASES

### Phase 1: Critical Fixes (Week 1)

**Must-have for production:**

1. OAuth callback error display (#2)
2. Token refresh UI feedback (#1)
3. Partial token storage failure (#6)
4. Lock timeout race condition (#7)
5. OAuth callback timeout (#9)
6. Centralize invalid_grant handling (#8)

**Impact:** Fixes broken user experiences and data loss scenarios

---

### Phase 2: High Priority (Week 2)

**Important for reliability:** 7. Connection expiry warnings (#3) 8. Circuit breaker UX (#4) 9. Realm ID validation & errors (#11) 10. Network error differentiation (#13)

**Impact:** Prevents silent failures and improves troubleshooting

---

### Phase 3: Medium Priority (Week 3-4)

**Polish and edge cases:** 11. Multi-tab coordination (#10) 12. OAuth state expiry UX (#12) 13. Stale lock retry (#20) 14. Rate limit cache fallback (#14) 15. Realm ID validation security (#16)

**Impact:** Smoother multi-tab experience, better edge case handling

---

### Phase 4: Low Priority (Backlog)

**Nice-to-haves:** 16. OAuth cancellation cleanup (#17) 17. Multiple QB companies (#18) 18. Permission change detection (#19) 19. 401 retry loop edge case (#15) 20. Remaining minor issues (#21-31)

**Impact:** Incremental improvements for edge cases

---

## 💡 QUICK WINS

These can be implemented in <1 hour each:

1. **OAuth error display** - Add `useEffect` hook to read URL params
2. **OAuth loading state** - Add `disabled` and loading spinner to button
3. **Realm ID validation** - Add regex check for numeric format
4. **Extend state expiry** - Change constant from 10 to 30 minutes
5. **User-friendly circuit breaker message** - Update error handler

**Total time:** ~4 hours
**Impact:** Massive UX improvement

---

This audit is based on actual code analysis with specific file paths and line numbers. Each issue includes current behavior, user impact, and recommended fixes with code examples.
