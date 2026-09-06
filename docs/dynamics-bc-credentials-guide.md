# Dynamics Business Central Credentials Guide

This document covers how to create BC credentials, hand them over to customers, and how the system works.

## Overview

Dynamics BC uses a "faux credentials" authentication model instead of OAuth. Data flows through Fivetran → Redshift, so we create admin-provisioned credentials that map users to specific Redshift schemas.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Fivetran Sync  │────▶│  Redshift Schema │────▶│  Zenith Queries │
│  (BC → Redshift)│     │  (bc_aquaculture)│     │  (with access)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         ▲
                                                         │
┌─────────────────┐     ┌──────────────────┐             │
│  BC Credentials │────▶│  First-Claim Auth│─────────────┘
│  (DynamoDB)     │     │  (Login API)     │
└─────────────────┘     └──────────────────┘
```

## Creating New Credentials

### Step 1: Prepare Credential Information

Before creating credentials, gather:

- **Username**: A unique identifier (e.g., `bc_acme_corp`, `bc_seafood_inc`)
- **Password**: A strong password (will be hashed with bcrypt)
- **Schema Name**: The Redshift schema name where their data lives (e.g., `bc_acme_corp`)
- **Display Name**: Human-readable name (e.g., "Acme Corporation Business Central")

### Step 2: Create Credential Using Setup Script

```bash
# Run the setup script
npx ts-node scripts/setup-bc-credentials.ts
```

The script creates the `bc_credentials` DynamoDB table (if not exists) and adds credentials.

### Step 3: Add Custom Credentials

To add a new credential, modify the script or use AWS CLI:

**Option A: Modify `scripts/setup-bc-credentials.ts`**

Add another `addCredential()` call:

```typescript
await addCredential({
  username: 'bc_new_customer',
  password: 'SecurePassword123!', // Will be hashed automatically
  organizationId: null, // null = first-claim model
  schemaName: 'bc_new_customer', // Must match Redshift schema
  displayName: 'New Customer Business Central',
  createdBy: 'admin@zenith.com',
})
```

**Option B: Direct AWS CLI**

```bash
# First, hash the password using bcrypt (use a separate script or online tool)
# Then insert into DynamoDB:

aws dynamodb put-item \
  --table-name bc_credentials \
  --item '{
    "PK": {"S": "CRED#bc_new_customer"},
    "SK": {"S": "CREDENTIAL"},
    "username": {"S": "bc_new_customer"},
    "password_hash": {"S": "$2b$12$...hashed..."},
    "organization_id": {"NULL": true},
    "schema_name": {"S": "bc_new_customer"},
    "display_name": {"S": "New Customer BC"},
    "status": {"S": "active"},
    "login_attempts": {"N": "0"},
    "locked_until": {"NULL": true},
    "last_login_at": {"NULL": true},
    "created_at": {"N": "1707840000"},
    "created_by": {"S": "admin@zenith.com"}
  }'
```

## Handover Flow to Customer

### 1. Pre-Handover Checklist

- [ ] Fivetran sync is configured and running for their BC instance
- [ ] Redshift schema exists with their data (e.g., `bc_customer_name`)
- [ ] BC credential created in DynamoDB with matching schema_name
- [ ] Credential has `organization_id: null` (for first-claim)

### 2. Customer Communication Template

```
Subject: Your Zenith Business Central Access Credentials

Hi [Customer Name],

Your Business Central connection is ready for Zenith. Here are your credentials:

  Username: bc_[customer_name]
  Password: [temporary_password]

To connect:
1. Log into Zenith (https://app.zenith.io)
2. Go to Account Settings → Integrations
3. Click "Connect" on Microsoft Dynamics 365 Business Central
4. Enter the credentials above

Important Notes:
- These credentials are single-use: the first organization to log in claims them
- After connecting, only users from your organization can access this data
- If you need to change your password, contact support

Best regards,
Zenith Support
```

### 3. Post-Handover Verification

After customer connects, verify in DynamoDB:

```bash
# Check credential was claimed
aws dynamodb get-item \
  --table-name bc_credentials \
  --key '{"PK": {"S": "CRED#bc_customer_name"}, "SK": {"S": "CREDENTIAL"}}' \
  --projection-expression "organization_id, claimed_at, last_login_at"
```

Expected result shows `organization_id` populated with their org ID.

## First-Claim Model Explained

The first-claim model provides security without admin pre-assignment:

1. **Credential Created**: `organization_id: null` (unclaimed)
2. **Customer Logs In**: First successful login claims credential for their org
3. **Credential Locked**: Future logins verify org matches; other orgs get generic error

```
┌─────────────────┐
│ Credential      │
│ org_id: null    │  ──────────▶  First Login Success
│ (unclaimed)     │               org_id = ORG#abc123
└─────────────────┘               claimed_at = timestamp
         │
         ▼
┌─────────────────┐
│ Credential      │
│ org_id: ORG#abc │  ──────────▶  Future logins must match
│ (claimed)       │               Different org = DENIED
└─────────────────┘
```

## Security Features

| Feature          | Implementation                          |
| ---------------- | --------------------------------------- |
| Password Storage | bcrypt hash (12 rounds)                 |
| Rate Limiting    | 5 failed attempts per 15 minutes        |
| Account Lockout  | 30 minutes after threshold              |
| Error Messages   | Generic (prevents username enumeration) |
| Audit Logging    | All auth attempts logged                |
| Session Required | User must be logged into Zenith         |

## Troubleshooting

### Customer Can't Log In

1. **Check credential exists:**

   ```bash
   aws dynamodb get-item --table-name bc_credentials \
     --key '{"PK": {"S": "CRED#username"}, "SK": {"S": "CREDENTIAL"}}'
   ```

2. **Check if locked:**

   ```bash
   # Look for locked_until > current timestamp
   ```

3. **Check if already claimed by different org:**
   ```bash
   # Look for organization_id != their org ID
   ```

### Reset Account Lockout

```bash
aws dynamodb update-item \
  --table-name bc_credentials \
  --key '{"PK": {"S": "CRED#username"}, "SK": {"S": "CREDENTIAL"}}' \
  --update-expression "SET login_attempts = :zero, locked_until = :null" \
  --expression-attribute-values '{":zero": {"N": "0"}, ":null": {"NULL": true}}'
```

### Change Password

```typescript
// Use the hashPassword function from src/lib/providers/dynamics/password.ts
import { hashPassword } from '@/lib/providers/dynamics/password'

const newHash = await hashPassword('NewPassword123!')
// Then update DynamoDB with the new hash
```

## Environment Variables

Ensure these are set in `.env.local`:

```
BC_CREDENTIALS_TABLE_NAME=bc_credentials
ORGANIZATIONS_TABLE_NAME=zenith-organizations
AWS_REGION=us-east-1
```

## Related Files

| File                                                       | Purpose                      |
| ---------------------------------------------------------- | ---------------------------- |
| `scripts/setup-bc-credentials.ts`                          | Create table and credentials |
| `src/app/api/providers/dynamics/login/route.ts`            | Login endpoint               |
| `src/app/api/providers/dynamics/disconnect/route.ts`       | Disconnect endpoint          |
| `src/lib/providers/dynamics/password.ts`                   | bcrypt utilities             |
| `src/components/integrations/DynamicsCredentialsModal.tsx` | Login modal UI               |
