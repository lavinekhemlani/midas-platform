# Warehouse Config Access Control: Reconciliation Analysis

## Current State: Two Systems

### System 1: Script-Based (Legacy)

**File:** `scripts/update-warehouse-config-v2.ts`

- Admin manually runs script to grant warehouse access
- Hard-codes organization IDs and schemas
- Updates `warehouse_config` directly in org record

```typescript
// Example from script
await updateOrg('ORG#d49faafe-5b8a-4616-9fd2-95e5278de9be', 'CFO Org')
```

**Pros:**

- Admin has full control
- Can set multiple schemas at once (bc_aquaculture + d365_mock)
- Works for any data source type

**Cons:**

- Requires developer intervention
- Not self-service
- No audit trail of who granted access
- Prone to typos/errors

### System 2: BC Auth (New)

**File:** `src/app/api/providers/dynamics/login/route.ts`

- User self-service via credentials modal
- First-claim model (secure, no pre-assignment needed)
- Automatically updates `warehouse_config` on successful auth

```typescript
// On successful login, adds schema to warehouse_config
warehouseConfig.schemas.push({
  provider: 'dynamics',
  schema_name: schemaName,
  display_name: displayName,
  connected_at: now,
})
```

**Pros:**

- Self-service for customers
- Secure with rate limiting, lockout
- Audit trail of all auth attempts
- First-claim prevents unauthorized access

**Cons:**

- Only handles Dynamics BC
- One schema per credential

## How They Interact

The `warehouse_config` structure in org records:

```json
{
  "warehouse_config": {
    "enabled": true,
    "default_schema": "bc_aquaculture",
    "schemas": [
      {
        "schema_name": "bc_aquaculture",
        "source_type": "business_central",
        "display_name": "Premium Aquaculture BC",
        "connected_at": 1707840000
      },
      {
        "schema_name": "d365_mock",
        "source_type": "d365",
        "display_name": "D365 Mock Data",
        "connected_at": 1738627200
      }
    ]
  }
}
```

Both systems write to `warehouse_config.schemas[]`. The BC auth system:

1. Checks if dynamics schema already exists
2. Updates existing or adds new entry
3. Also updates `providers.dynamics.credentials` for connection status

## Recommendation: Keep Both (Hybrid Approach)

### Why Not Remove Scripts?

1. **Non-BC Data Sources**: d365_mock, shopify, meta_ads, etc. don't have auth flows yet
2. **Initial Setup**: Scripts useful for bulk onboarding or testing
3. **Emergency Access**: Admin override capability useful for support

### How to Use Each

| Scenario                     | Use                    |
| ---------------------------- | ---------------------- |
| Customer connecting their BC | BC Auth (self-service) |
| Adding non-BC schemas        | Script-based           |
| Testing/development          | Script-based           |
| Bulk customer onboarding     | Script-based           |
| Support resetting access     | Script-based           |

### Migration Path

```
Phase 1 (Current): Both systems coexist
  └── BC: Self-service auth
  └── Other: Script-based

Phase 2 (Future): Add auth flows for other providers
  └── D365: Self-service auth (similar to BC)
  └── Shopify: OAuth flow
  └── Meta Ads: OAuth flow

Phase 3 (Long-term): Scripts become admin-only tools
  └── Self-service for all supported providers
  └── Scripts for support/emergency/bulk ops
```

## Code Changes Made

The BC login route already integrates with warehouse_config:

```typescript
// src/app/api/providers/dynamics/login/route.ts (lines 163-199)

// Update warehouse_config to include the BC schema
const warehouseConfig = Item.warehouse_config || { schemas: [] }
const existingSchemaIndex = warehouseConfig.schemas?.findIndex(
  (s: any) => s.provider === 'dynamics'
)

if (existingSchemaIndex >= 0) {
  warehouseConfig.schemas[existingSchemaIndex] = {
    provider: 'dynamics',
    schema_name: schemaName,
    display_name: displayName,
    connected_at: now,
  }
} else {
  warehouseConfig.schemas = warehouseConfig.schemas || []
  warehouseConfig.schemas.push({
    provider: 'dynamics',
    schema_name: schemaName,
    display_name: displayName,
    connected_at: now,
  })
}
```

## Action Items

### Immediate (No Changes Needed)

- [x] BC auth system already updates warehouse_config
- [x] Scripts still work for non-BC schemas
- [x] Both systems compatible

### Near-Term (Optional Improvements)

- [ ] Add `source` field to schema entries to track how access was granted
- [ ] Create admin UI for managing warehouse_config instead of scripts
- [ ] Add logging to scripts for audit trail

### Long-Term

- [ ] Build similar auth flows for other data sources (D365, etc.)
- [ ] Deprecate manual scripts in favor of admin UI
- [ ] Centralized access control dashboard

## Summary

**No code changes needed for reconciliation.** The systems are already compatible:

1. BC Auth writes to `warehouse_config.schemas[]` with `provider: 'dynamics'`
2. Scripts write to `warehouse_config.schemas[]` with `source_type` field
3. Warehouse access validation (`warehouse-access.ts`) checks `schema_name` regardless of how it was added

The BC auth flow is the secure, self-service future. Scripts remain useful for admin operations and non-BC data sources until we build out auth flows for those.
