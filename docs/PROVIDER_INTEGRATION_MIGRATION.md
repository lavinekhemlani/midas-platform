# Provider Integration Migration Guide

## Overview

This document outlines the migration from disparate provider integration components to a unified system with improved error handling and user experience.

## Changes Implemented

### 1. Database Schema Updates

- Added `terms_accepted: boolean` field to User model
- Added `terms_accepted_at: number` timestamp field
- Both fields are optional for backward compatibility

### 2. API Enhancements

- `/api/onboarding/complete` now sets both `terms_accepted` and `onboarding_audit.completed_at`
- Dual-write strategy ensures backward compatibility

### 3. New Components

#### ProviderIntegrationManager

Unified component that adapts to different environments:

- **Onboarding**: Clean, guided experience
- **Settings**: Full management interface
- **Dashboard**: Inline connection prompt

#### ConnectionPrompt

Specialized component for dashboard connection failures:

- Shows when provider connection is missing
- Embeds integration UI inline
- Provides clear call-to-action

### 4. Enhanced Error Handling

- FinancialDataContext now categorizes errors as 'connection' or 'general'
- Dashboard shows appropriate UI based on error type
- No more infinite loading states

### 5. Improved Auth Flow

- AuthRedirectHandler checks `terms_accepted` first
- Falls back to `onboarding_audit.completed_at` for existing users
- Redirects `/onboarding` to `/dashboard` when terms already accepted

## Migration Steps

### For Existing Code

1. **Update Provider Integration Usage**

   ```typescript
   // Old
   import IntegrationsContainer from '@/components/integrations/IntegrationsContainer'

   // New (optional - IntegrationsContainer still works)
   import ProviderIntegrationManager from '@/components/integrations/ProviderIntegrationManager'
   ```

2. **Dashboard Error Handling**

   ```typescript
   // Automatically handled - no changes needed
   // Connection errors now show ConnectionPrompt
   ```

3. **Onboarding Flow**
   ```typescript
   // No changes needed - backward compatible
   // New users get terms_accepted field set
   ```

## Testing Checklist

### New User Flow

- [ ] Sign up new account
- [ ] Complete personal info step
- [ ] Complete organization details
- [ ] Connect provider (test both QuickBooks and Zoho)
- [ ] Accept terms on review page
- [ ] Verify redirect to dashboard
- [ ] Try accessing /onboarding - should redirect to dashboard

### Existing User Flow

- [ ] Sign in with existing account
- [ ] Should go directly to dashboard
- [ ] Disconnect provider in settings
- [ ] Dashboard should show ConnectionPrompt
- [ ] Reconnect provider inline
- [ ] Data should load immediately

### Error Scenarios

- [ ] Disconnect provider
- [ ] Go to dashboard - see ConnectionPrompt
- [ ] Try to connect with invalid credentials
- [ ] Appropriate error messages shown
- [ ] Clear browser cookies and retry

### Settings Page

- [ ] Navigate to Account > Integrations
- [ ] Connect/disconnect providers
- [ ] Switch between providers
- [ ] All functions work as before

## Rollback Plan

If issues are encountered, revert to previous commit:

```bash
git revert HEAD~4  # Reverts last 4 commits
```

Or cherry-pick specific fixes while keeping the good changes.

## Environment Variables

No new environment variables required.

## Database Migration

No migration required - new fields are optional and backward compatible.

## Breaking Changes

None - all changes are backward compatible.

## Future Enhancements

1. Add feature flag for gradual rollout
2. Create A/B test for connection prompt vs redirect
3. Add analytics tracking for connection failures
4. Implement retry logic with exponential backoff
