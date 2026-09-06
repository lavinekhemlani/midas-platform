# Testing the Token Heartbeat Implementation

**Date**: 2025-10-10
**Component**: Client-Side Token Heartbeat
**Status**: ⚠️ Temporary Solution (See QUICKBOOKS_TOKEN_EXPIRATION_FIX.md)

---

## ⚠️ Important Notice

This client-side heartbeat is a **temporary solution** with known limitations:

- Unreliable in background tabs (browser throttling)
- Doesn't work when browser is closed
- Battery drain on mobile devices
- See `QUICKBOOKS_TOKEN_EXPIRATION_FIX.md` for full analysis and recommendation to use Lambda instead

---

## What Was Implemented

### 1. Token Heartbeat Hook (`src/hooks/useTokenHeartbeat.ts`)

- Pings `/api/oauth/health?type=heartbeat` every 45 minutes
- Also checks token health when tab becomes visible
- Runs automatically on all pages within `(main)` layout
- Includes debug mode for development

### 2. Updated Health Endpoint (`src/app/api/oauth/health/route.ts`)

- Added `type=heartbeat` mode
- Checks token expiration status
- Triggers refresh if needed (< 30 min to expiry)
- Returns detailed status information

### 3. Main Layout Integration (`src/app/(main)/layout.tsx`)

- Hook enabled for all authenticated pages
- Debug mode ON in development
- Debug mode OFF in production

---

## How to Test

### Test 1: Verify Heartbeat is Running (5 minutes)

**Objective**: Confirm the heartbeat timer is active and making requests

**Steps**:

1. Open your application in development mode
2. Log in and navigate to the dashboard
3. Open browser DevTools (F12) → Console tab
4. Look for initial heartbeat log:
   ```
   [TokenHeartbeat] Pinging backend to refresh tokens...
   [TokenHeartbeat] Health check completed
   [TokenHeartbeat] Started { interval: "45 minutes", nextPing: "..." }
   ```

**Expected Results**:

- ✅ See heartbeat initialization message
- ✅ See health check completed successfully
- ✅ No errors in console

**If it fails**:

- Check that you're on a page under `(main)` layout
- Verify you're logged in with valid QuickBooks connection
- Check Network tab for `/api/oauth/health` request

---

### Test 2: Check Network Requests (5 minutes)

**Objective**: Verify the API endpoint is being called correctly

**Steps**:

1. Open DevTools → Network tab
2. Filter by "health" or "oauth"
3. Wait for the heartbeat to fire (or refresh the page to trigger immediate ping)
4. Click on the `/api/oauth/health` request

**Expected Results**:

- ✅ Request URL: `/api/oauth/health?type=heartbeat&provider=quickbooks`
- ✅ Method: `GET`
- ✅ Status: `200 OK`
- ✅ Response includes:
  ```json
  {
    "success": true,
    "healthy": true,
    "provider": "quickbooks",
    "connected": true,
    "tokenRefreshed": false,
    "needsRefresh": false,
    "timeUntilExpiry": 3456,
    "expiresAt": "2025-10-10T15:30:00.000Z",
    "timestamp": "2025-10-10T14:30:00.000Z"
  }
  ```

**If it fails**:

- Status 401: Authentication issue - verify you're logged in
- Status 500: Check server logs for error details
- No request: Hook might not be initialized

---

### Test 3: Force Token Refresh Test (15 minutes)

**Objective**: Verify the heartbeat triggers token refresh when needed

**⚠️ WARNING**: This test requires database access to manually adjust token expiration

**Steps**:

#### Option A: Using DynamoDB Console (Recommended)

1. Open AWS DynamoDB Console
2. Navigate to your Organizations table
3. Find your organization record
4. Edit `providers.quickbooks.expires_at` to a value 20 minutes in the future
   ```javascript
   // Current time in seconds
   Math.floor(Date.now() / 1000) + 20 * 60
   ```
5. Save the change
6. Wait for heartbeat to fire (or refresh page)
7. Check console logs:
   ```
   [OAuth Health] Token refreshed via heartbeat
   ```
8. Check response:
   ```json
   {
     "tokenRefreshed": true,
     "needsRefresh": true,
     "timeUntilExpiry": 1200
   }
   ```

#### Option B: Wait Naturally (50+ minutes)

1. Connect to QuickBooks fresh
2. Leave browser tab open
3. Don't interact for 20 minutes
4. At ~20 minutes, heartbeat should trigger
5. Monitor console logs for refresh activity

**Expected Results**:

- ✅ `tokenRefreshed: true` in response
- ✅ Console log: "[OAuth Health] Token refreshed via heartbeat"
- ✅ New `expiresAt` time is ~1 hour in future
- ✅ No errors in console

**If it fails**:

- Check QuickBooks credentials in DynamoDB
- Verify refresh token is valid
- Check server logs: `npm run logs` or CloudWatch
- Review QuickBooks API rate limiting

---

### Test 4: Background Tab Behavior (60 minutes)

**Objective**: Test reliability in background tabs (known limitation)

**Steps**:

1. Open application in Chrome/Edge
2. Log in and navigate to dashboard
3. Note current time: ****\_\_****
4. Open DevTools → Console
5. Switch to a different tab (put app in background)
6. After 45 minutes, switch back to app tab
7. Check console logs

**Expected Results (Chrome/Edge)**:

- ⚠️ Timer may have been throttled
- ⚠️ Heartbeat may have fired late or not at all
- ⚠️ May fire immediately when tab becomes visible (visibilitychange event)

**Expected Results (Safari)**:

- ⚠️ Likely more aggressive throttling
- ⚠️ Timer may not fire at all in background

**Notes**:

- This demonstrates the primary limitation of client-side heartbeat
- Browser throttling is intentional for battery/performance
- This is why Lambda solution is recommended

---

### Test 5: Multi-Tab Scenario (10 minutes)

**Objective**: Verify distributed locking prevents race conditions

**Steps**:

1. Open application in 3 browser tabs
2. Log in to all tabs
3. Open DevTools Console in all tabs
4. Wait for heartbeat to fire in all tabs (~45 min or refresh to trigger)
5. Monitor logs for lock acquisition messages

**Expected Results**:

- ✅ All tabs attempt heartbeat around same time
- ✅ Only one tab successfully refreshes token
- ✅ Other tabs see "token was already refreshed" message
- ✅ No duplicate refresh operations

**Check DynamoDB for lock entries**:

- Key: `TOKEN_REFRESH_LOCK#{organizationId}#quickbooks`
- Should be created and released properly

**If it fails**:

- Multiple refreshes happening: Distributed locking issue
- Check `tokenLock.ts` implementation
- Review DynamoDB permissions

---

### Test 6: Inactive Session Test (70 minutes) ⭐ CRITICAL

**Objective**: Simulate the real user scenario that prompted this fix

**Steps**:

1. Fresh QuickBooks connection (token expires in 60 min)
2. Open dashboard at exactly 9:00 AM
3. Leave browser tab **open** but **don't interact**
4. At 10:05 AM (65 minutes later), try to:
   - View a report
   - Access QuickBooks data
   - Navigate to any page with QuickBooks integration

**Expected Results (SUCCESS)**:

- ✅ No "disconnected" error
- ✅ Data loads normally
- ✅ Token was refreshed by heartbeat at ~9:45 AM
- ✅ Console shows:
  ```
  [TokenHeartbeat] Token refreshed at 9:45 AM
  [TokenHeartbeat] Token still valid at 10:05 AM
  ```

**Expected Results (FAILURE - Known Limitation)**:

- ❌ If tab was in background: May have been throttled
- ❌ User sees disconnection error
- ❌ Demonstrates need for Lambda solution

**Timing Breakdown**:

```
9:00 AM  - Token obtained (expires 10:00 AM)
9:45 AM  - Heartbeat fires (if tab active)
9:45 AM  - Token refreshed (new expiry 10:45 AM)
10:05 AM - User action succeeds ✅

If heartbeat failed:
9:00 AM  - Token obtained (expires 10:00 AM)
9:45 AM  - Heartbeat throttled (tab in background)
10:05 AM - User action fails ❌ (token expired)
```

---

### Test 7: Mobile Device Test (Optional)

**Objective**: Test battery impact and reliability on mobile

**Steps**:

1. Open application on mobile device (iOS/Android)
2. Log in and navigate to dashboard
3. Leave app open for 1 hour
4. Monitor battery usage
5. Check if token refresh occurred

**Expected Results**:

- ⚠️ Likely throttled aggressively on mobile
- ⚠️ May see increased battery drain
- ⚠️ Timer may not fire reliably

**Notes**:

- Mobile browsers are most aggressive with throttling
- This is a primary reason to use Lambda solution
- Consider disabling heartbeat on mobile if battery complaints

---

## Debugging Tips

### Enable Debug Mode

**Development**: Already enabled in layout

```typescript
useTokenHeartbeat({
  enabled: true,
  intervalMinutes: 45,
  debug: true, // Shows detailed logs
})
```

**Production**: Add query parameter to enable

```typescript
const searchParams = new URLSearchParams(window.location.search)
const debugMode = searchParams.has('debug-heartbeat')

useTokenHeartbeat({
  enabled: true,
  intervalMinutes: 45,
  debug: debugMode,
})
```

Then visit: `https://yourdomain.com/dashboard?debug-heartbeat`

### Check Heartbeat Status

Run in browser console:

```javascript
// Check if timer is running
console.log(
  'Heartbeat timers:',
  Array.from(document.querySelectorAll('script')).filter((s) =>
    s.textContent?.includes('TokenHeartbeat')
  )
)

// Manually trigger heartbeat
fetch('/api/oauth/health?type=heartbeat&provider=quickbooks', {
  credentials: 'include',
})
  .then((r) => r.json())
  .then(console.log)
```

### Monitor Server Logs

**Local Development**:

```bash
# Watch server logs
npm run dev

# Look for these messages:
# [OAuth Health] Token refreshed via heartbeat
# [OAuth Health] Token refresh failed
```

**Production (AWS CloudWatch)**:

```bash
# If using AWS
aws logs tail /aws/lambda/your-app --follow --filter "[OAuth Health]"
```

### Check Token Expiration in DynamoDB

```javascript
// Query to check token status
{
  TableName: "zenith-organizations",
  Key: {
    PK: "ORG#your-org-id",
    SK: "PROFILE"
  },
  ProjectionExpression: "providers.quickbooks.expires_at, providers.quickbooks.connected"
}

// Convert timestamp to readable date
const expiresAt = 1728576000; // from DynamoDB
console.log(new Date(expiresAt * 1000).toISOString());
```

---

## Common Issues & Solutions

### Issue 1: Heartbeat Not Running

**Symptoms**:

- No console logs
- No network requests to `/api/oauth/health`

**Solutions**:

1. Verify you're on a page using `(main)` layout
2. Check if hook is disabled in layout
3. Clear browser cache and reload
4. Check for JavaScript errors in console

### Issue 2: 401 Unauthorized

**Symptoms**:

- Health check returns 401
- Console error: "Unauthorized"

**Solutions**:

1. Verify you're logged in (Clerk/Amplify session active)
2. Check authentication cookies exist
3. Try logging out and back in
4. Verify `withAuth` wrapper is working

### Issue 3: Token Refresh Fails

**Symptoms**:

- `refreshError` in response
- Console: "[OAuth Health] Token refresh failed"

**Solutions**:

1. Check QuickBooks refresh token is valid
2. Verify QuickBooks credentials in environment variables
3. Check QuickBooks API rate limits
4. Review server logs for detailed error
5. Try disconnecting and reconnecting QuickBooks

### Issue 4: Heartbeat Doesn't Fire in Background

**Symptoms**:

- Timer works when tab active
- No activity when tab in background

**Solutions**:

- ⚠️ This is expected browser behavior
- ⚠️ Known limitation of client-side approach
- ✅ Implement Lambda solution for reliable background refresh
- Workaround: Visibilitychange event will fire when tab becomes active

### Issue 5: Multiple Refreshes (Race Condition)

**Symptoms**:

- Multiple refresh operations at same time
- DynamoDB errors about concurrent updates

**Solutions**:

1. Check distributed locking is working
2. Verify `tokenLock.ts` has proper permissions
3. Check DynamoDB `TOKEN_REFRESH_LOCK` entries
4. Ensure only one instance of hook per page

---

## Performance Monitoring

### Metrics to Track

1. **Heartbeat Success Rate**
   - Target: >95% in active tabs
   - Track: Console logs over 24 hours

2. **Token Refresh Success Rate**
   - Target: >99%
   - Track: Server logs + CloudWatch

3. **API Call Latency**
   - Target: <500ms for health check
   - Track: Network tab timing

4. **Battery Impact**
   - Track: User complaints (mobile)
   - Monitor: Device battery stats

### Sample CloudWatch Query

```sql
fields @timestamp, @message
| filter @message like /\[OAuth Health\]/
| stats count() by bin(5m) as success_count
```

---

## When to Consider Lambda Solution

You should implement the Lambda background refresh if:

1. ❌ Users still report disconnections after 1 week
2. ❌ Heartbeat fails >10% of the time
3. ❌ Mobile users complain about battery drain
4. ❌ Many users have background tabs (analytics show this)
5. ❌ Need 100% reliable token refresh (enterprise customers)

**Cost/Benefit**:

- Lambda cost: ~$0.20/month
- Development time: 1 day
- Benefit: 100% coverage, no browser dependency

**See**: `QUICKBOOKS_TOKEN_EXPIRATION_FIX.md` for Lambda implementation guide

---

## Success Criteria

### Immediate (Week 1)

- ✅ Heartbeat running on all pages
- ✅ Health endpoint responding correctly
- ✅ No errors in production logs
- ✅ Reduced user complaints about disconnections

### Short-term (Week 2-3)

- ✅ 80% reduction in token expiration errors
- ✅ Heartbeat success rate >90%
- ✅ No critical bugs reported
- ✅ Performance metrics within targets

### Long-term (Month 1+)

- ✅ Evaluate effectiveness data
- ✅ Decide on Lambda implementation
- ✅ Plan migration if needed

---

## Rollback Procedure

If the heartbeat causes more problems than it solves:

### Step 1: Disable Hook (5 minutes)

```typescript
// In src/app/(main)/layout.tsx
useTokenHeartbeat({
  enabled: false, // <-- Change this
  intervalMinutes: 45,
  debug: process.env.NODE_ENV === 'development',
})
```

### Step 2: Deploy

```bash
git add src/app/(main)/layout.tsx
git commit -m "Disable token heartbeat temporarily"
git push
# Deploy to production
```

### Step 3: Monitor

- Check error rates return to baseline
- Verify no new issues introduced
- Plan Lambda implementation

### Step 4: Remove Code (Optional)

If permanently reverting:

```bash
rm src/hooks/useTokenHeartbeat.ts
# Revert changes to layout.tsx and health endpoint
```

---

## Next Steps

After testing client-side heartbeat:

1. **Week 1**: Gather metrics and user feedback
2. **Week 2**: Analyze effectiveness data
3. **Week 3**: Decision point
   - If effective: Keep running, plan Lambda for completeness
   - If ineffective: Accelerate Lambda implementation
4. **Week 4**: Begin Lambda development (see QUICKBOOKS_TOKEN_EXPIRATION_FIX.md)

---

## Useful Commands

```bash
# Run development server with logs
npm run dev

# Test health endpoint directly
curl -X GET 'http://localhost:3000/api/oauth/health?type=heartbeat&provider=quickbooks' \
  -H 'Cookie: your-session-cookie'

# Check browser console for heartbeat
# Open DevTools → Console, then:
localStorage.setItem('debug-heartbeat', 'true')
location.reload()

# Monitor network requests
# DevTools → Network → Filter: "oauth"

# Check DynamoDB for locks
aws dynamodb query \
  --table-name zenith-organizations \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"TOKEN_REFRESH_LOCK#org-id#quickbooks"}}'
```

---

## Contact & Support

**Questions?**

- See: `QUICKBOOKS_TOKEN_EXPIRATION_FIX.md`
- Review: `QUICKBOOKS_OAUTH_ANALYSIS.md`

**Issues?**

- Check server logs first
- Review this testing guide
- Consider Lambda solution

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Author**: Engineering Team
