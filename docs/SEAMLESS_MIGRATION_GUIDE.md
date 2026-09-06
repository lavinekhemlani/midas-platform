# Seamless User Migration - Implementation Guide

## Overview

We've implemented **zero-friction user migration** from the old Cognito pool to the new one. Users can sign in with their existing credentials and are automatically migrated behind the scenes.

**No Lambda required** - uses Next.js API routes instead!

---

## How It Works

### User Experience (Completely Seamless)

```
1. User visits sign-in page
   ↓
2. Enters their OLD credentials (email + password)
   ↓
3. System attempts sign-in to NEW pool
   ↓
4. If user not found → Auto-migration triggered
   ↓
5. System authenticates against OLD pool
   ↓
6. If successful → User created in NEW pool with same password
   ↓
7. Sign-in retried automatically in NEW pool
   ↓
8. User is signed in - MIGRATION COMPLETE ✓
```

**Result**: User doesn't even know migration happened!

---

## Technical Implementation

### 1. API Route: `/api/auth/migrate-user`

**File**: `src/app/api/auth/migrate-user/route.ts`

**What it does**:

- Receives email + password from frontend
- Authenticates user against OLD Cognito pool using AWS SDK
- If successful, retrieves user attributes from old pool
- Creates user in NEW pool with:
  - Same password (permanent, not temporary)
  - All their attributes (email, given_name, family_name, picture)
  - Email marked as verified
  - No welcome email sent
- Returns success/failure status

**Key Features**:

- Uses `AdminInitiateAuthCommand` to auth against old pool
- Uses `AdminGetUserCommand` to get user attributes
- Uses `AdminCreateUserCommand` to create user in new pool
- Uses `AdminSetUserPasswordCommand` to set their actual password
- Handles `family_name` as optional (key fix!)

### 2. Updated Sign-In Page

**File**: `src/app/(shell)/sign-in/[[...sign_in]]/page.tsx`

**Enhanced flow**:

```typescript
try {
  // Try to sign in to NEW pool
  await signIn({ username: email, password })
} catch (err) {
  // If NotAuthorizedException or UserNotFoundException
  if (isAuthError(err)) {
    // Attempt migration
    const migrated = await attemptUserMigration(email, password)

    if (migrated) {
      // Retry sign-in to NEW pool
      await signIn({ username: email, password })
      // SUCCESS - user is now signed in!
    }
  }
}
```

**User-facing changes**:

- Loading state shows during migration
- If migration fails, shows "Incorrect username or password"
- If successful, user is signed in seamlessly
- Console logs show migration progress (for debugging)

---

## Migration States

### State 1: User Already Migrated

- User exists in NEW pool
- Direct sign-in succeeds ✓
- **Action**: None needed

### State 2: User Not Yet Migrated

- User doesn't exist in NEW pool
- Sign-in fails with `NotAuthorizedException`
- API checks OLD pool
- If credentials valid → User created in NEW pool
- Sign-in retried → Success ✓
- **Action**: Auto-migration complete

### State 3: User Doesn't Exist Anywhere

- User doesn't exist in OLD or NEW pool
- API returns 401
- Frontend shows "Incorrect username or password"
- **Action**: None - user needs to sign up

### State 4: User Has Temporary Password

- User was manually migrated with temp password
- Sign-in returns `CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED`
- Frontend shows password reset form
- **Action**: User sets new password

---

## OAuth Users (Google)

**12 OAuth users** will auto-migrate on first Google sign-in:

- They click "Sign in with Google"
- Google authenticates them
- Cognito checks if user exists in NEW pool
- If not, creates them automatically
- **No manual action needed** ✓

**Note**: OAuth users never go through the password migration flow since they don't have passwords in Cognito.

---

## Security Considerations

### ✅ Secure Implementation

1. **Password Never Stored**: Password is sent to API, used for auth, never logged or saved
2. **Server-Side Only**: Migration API uses AWS Admin SDK (requires AWS credentials)
3. **One-Time Migration**: Once migrated, user never touches old pool again
4. **No Downgrade**: Users can't be "un-migrated" back to old pool
5. **Audit Trail**: All migration attempts logged to console

### 🔒 Credentials Required

The API route needs AWS credentials with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminInitiateAuth",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword"
      ],
      "Resource": [
        "arn:aws:cognito-idp:us-east-1:*:userpool/us-east-1_McfBX9Eit",
        "arn:aws:cognito-idp:us-east-1:*:userpool/us-east-1_1DEosp9bS"
      ]
    }
  ]
}
```

**These credentials are already set** in your `.env.local`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

---

## Testing Checklist

### Test Scenarios

- [ ] **New user signs in for first time**
  - User exists in OLD pool only
  - Signs in with old credentials
  - Should be migrated automatically
  - Should land on dashboard
  - Check NEW pool - user should exist now

- [ ] **User signs in second time**
  - User now exists in NEW pool
  - Direct sign-in should work
  - Should NOT trigger migration
  - Should land on dashboard quickly

- [ ] **Wrong password**
  - User enters incorrect password
  - Migration should fail
  - Should show "Incorrect username or password"

- [ ] **User doesn't exist**
  - Email not in OLD or NEW pool
  - Migration should fail
  - Should show "Incorrect username or password"

- [ ] **Google OAuth**
  - Click "Continue with Google"
  - Authenticate with Google
  - Should auto-create in NEW pool
  - Should land on dashboard

- [ ] **Manually migrated user (temp password)**
  - User was created via CLI with temp password
  - Signs in with temp password
  - Should see password reset form
  - Sets new password
  - Should land on dashboard

---

## Monitoring & Debugging

### Console Logs

**Successful migration**:

```
[Migration] Attempting to migrate user from old pool...
[Migration] ✓ User authenticated in old pool
[Migration] Retrieved user attributes from old pool
[Migration] ✓ User email@example.com created in new pool
[Migration] ✓ Password set for user email@example.com in new pool
[Migration] ✓ User email@example.com successfully migrated to new pool
[Migration] ✓ Migration successful, retrying sign-in...
[Migration] ✓ Sign-in successful after migration
```

**Failed migration**:

```
[Migration] Attempting to migrate user from old pool...
[Migration] ✗ User email@example.com not found or incorrect password in old pool
[Migration] ✗ Migration failed: Incorrect username or password
```

### API Endpoint Testing

Test the migration API directly:

```bash
curl -X POST http://localhost:3000/api/auth/migrate-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "OldPassword123!"
  }'
```

**Expected responses**:

Success:

```json
{
  "success": true,
  "migrated": true,
  "message": "User migrated successfully. Please sign in again."
}
```

Failure (wrong password):

```json
{
  "error": "Incorrect username or password",
  "migrated": false
}
```

---

## Migration Timeline

### Phase 1: Initial Deployment ✓

- New pool created
- Manual migration of 16 password users (with temp passwords)
- 12 OAuth users ready for auto-migration

### Phase 2: Seamless Migration (Current)

- API route deployed
- Frontend updated
- Users can sign in with old credentials
- Auto-migration on first sign-in

### Phase 3: Monitor (2 weeks)

- Track migration rate
- Monitor for errors
- Check user feedback

### Phase 4: Cleanup (After validation)

- Decommission old pool
- Remove migration code
- Update documentation

---

## Advantages Over Lambda

| Feature          | Lambda Trigger         | Next.js API Route (Our Approach) |
| ---------------- | ---------------------- | -------------------------------- |
| Setup Complexity | Medium-High            | Low                              |
| Deployment       | Separate Lambda deploy | Part of app deploy               |
| Debugging        | CloudWatch Logs        | Local console + server logs      |
| Testing          | Requires AWS setup     | Test locally easily              |
| Cost             | Lambda invocations     | Included in app hosting          |
| Cold Starts      | Yes (Lambda)           | No (already running)             |
| Code Location    | Separate repo          | Same codebase                    |
| Maintenance      | Separate service       | Part of app                      |

**Winner**: Next.js API Route ✓

---

## Rollback Plan

If issues occur:

1. **Disable migration**: Comment out migration attempt in sign-in page
2. **Revert env vars**: Switch back to old pool IDs
3. **Users who migrated**: Will stay in new pool (safe)
4. **Users not yet migrated**: Will use old pool

---

## Success Metrics

Track these to validate migration:

- ✅ Users migrated successfully: 0 → 28 (over 2 weeks)
- ✅ Migration errors: Should be < 1%
- ✅ Sign-in success rate: Should remain same or improve
- ✅ User complaints: Should be zero (seamless!)

---

## Next Steps

1. **Deploy to dev/staging** - Test with a few accounts
2. **Monitor logs** - Watch for migration activity
3. **Deploy to production** - Let users migrate naturally
4. **Track metrics** - Monitor success rate
5. **After 2 weeks** - Decommission old pool if 100% migrated

---

## Support

**Common Issues**:

**Q: User says "incorrect password" but password is correct**

- Check if user exists in OLD pool
- Check AWS credentials are valid
- Check API route logs for errors

**Q: Migration works but sign-in still fails**

- Check user was created in NEW pool (AWS Console)
- Verify password was set correctly
- Try signing in directly (without migration trigger)

**Q: OAuth users can't sign in**

- This is unrelated to password migration
- Check Google OAuth configuration
- Verify redirect URLs in Cognito

---

**Migration Status**: ✅ Ready for Testing
**Last Updated**: 2025-10-29
