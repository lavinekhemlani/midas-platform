# Onboarding Reset on Provider Disconnect - Test Plan

## Issue

After disconnecting and reconnecting a provider, the onboarding workflow was not being reset properly. Users could still access the review page and tick marks showed on integration even after disconnection.

## Solution Implemented

### 1. Modified `/src/app/api/providers/[provider]/disconnect/route.ts`

- Added logic to update user's onboarding audit when a provider is disconnected
- Removes `provider_connect` from `completed_steps` array
- Resets `current_step` to `provider_connect`
- This ensures the integration checkmark is removed and user cannot proceed to review

### 2. Modified `/src/components/onboarding/ReviewAndFinishStep.tsx`

- Added a redirect check at the beginning of the component
- If `provider_connect` is not in `completed_steps`, redirects user back to `/onboarding/provider_connect`
- Prevents direct URL access to review step when provider is not connected

### 3. Existing Protection in `/src/app/(shell)/onboarding/components/OnboardingNav.tsx`

- Already has logic to lock Review step if `provider_connect` is not completed (line 49)
- Shows lock icon and prevents navigation

## Test Steps

1. **Complete onboarding flow with provider connection**
   - Complete personal info
   - Complete organization details
   - Connect a provider (QuickBooks or Zoho)
   - Navigate to Review step
   - Verify checkmark shows on provider_connect step

2. **Disconnect the provider**
   - Go to provider connection step
   - Click disconnect button
   - Confirm disconnection

3. **Verify reset behavior**
   - Check that provider_connect checkmark is removed
   - Try to click on Review step in nav - should be locked
   - Try to access `/onboarding/review_finish` directly - should redirect to provider_connect
   - Verify you're now on provider_connect step

4. **Reconnect provider**
   - Connect provider again
   - Verify checkmark appears on provider_connect
   - Verify Review step is now accessible
   - Navigate to Review step successfully

## Expected Results

After disconnecting:

- ✅ Checkmark removed from provider_connect step
- ✅ Review step becomes locked/inaccessible
- ✅ Direct URL access to review redirects to provider_connect
- ✅ User must reconnect provider to proceed

After reconnecting:

- ✅ Checkmark reappears on provider_connect
- ✅ Review step becomes accessible again
- ✅ User can complete onboarding normally
