# Transaction Support for Bulk Upsert Operations

## Overview

The `SupabaseLoader` now supports database transactions for bulk upsert operations, providing atomic all-or-nothing semantics while maintaining backward compatibility with partial success mode.

## Features

### 1. Transactional Mode (Default)

By default, all bulk upsert operations are wrapped in a database transaction. This ensures that either all entities are successfully upserted or none are, maintaining data consistency.

```typescript
const loader = new SupabaseLoader()

// All entities will be upserted atomically
// If any one fails, all operations are rolled back
const result = await loader.bulkUpsert('org-123', 'Customer', [customer1, customer2, customer3])

if (result.failed === 0) {
  console.log(`Successfully upserted ${result.success} customers`)
} else {
  console.error('Transaction failed, all changes rolled back')
  console.error(result.errors)
}
```

**Benefits:**

- Data consistency: All-or-nothing semantics
- Atomic operations: Either all succeed or all fail
- Simplified error handling: Single point of failure
- Database integrity: No partial states

### 2. Partial Mode (Backward Compatible)

For scenarios where you want to continue processing even if some entities fail, you can enable partial mode. This is the original behavior and is useful for importing large datasets where some failures are acceptable.

```typescript
const loader = new SupabaseLoader()

// Continue processing even if some entities fail
const result = await loader.bulkUpsert('org-123', 'Customer', [customer1, customer2, customer3], {
  allowPartial: true,
})

console.log(`Success: ${result.success}, Failed: ${result.failed}`)
if (result.errors) {
  result.errors.forEach((error) => {
    console.error(`Failed to upsert ${error.entityId}: ${error.error}`)
  })
}
```

**Benefits:**

- Partial success: Continue processing on errors
- Detailed error tracking: Per-entity error information
- Useful for imports: Handle large batches with some failures
- Backward compatible: Existing behavior preserved

## API Reference

### `bulkUpsert<T extends QBEntityType>`

```typescript
async bulkUpsert<T extends QBEntityType>(
  organizationId: string,
  entityType: T,
  entities: NormalizedEntityMap[T][],
  options?: { allowPartial?: boolean }
): Promise<BulkResult>
```

**Parameters:**

- `organizationId`: The organization ID for the entities
- `entityType`: The type of QuickBooks entity (Customer, Vendor, Invoice, etc.)
- `entities`: Array of normalized entities to upsert
- `options.allowPartial`: (Optional) Enable partial success mode. Default: `false`

**Returns:** `BulkResult`

```typescript
interface BulkResult {
  success: number // Number of successfully upserted entities
  failed: number // Number of failed upserts
  errors?: Array<{
    // Detailed error information (if any failures)
    entityId: string // Entity ID that failed (or 'transaction' in transactional mode)
    error: string // Error message
  }>
}
```

## Implementation Details

### Transaction Flow

1. **Transactional Mode:**

   ```
   BEGIN TRANSACTION
     -> Upsert Entity 1
     -> Upsert Entity 2
     -> Upsert Entity 3
     -> ... (all entities)
   COMMIT TRANSACTION
   ```

   If any operation fails, the entire transaction is rolled back.

2. **Partial Mode:**
   ```
   Upsert Entity 1 (success)
   Upsert Entity 2 (fail - logged, continue)
   Upsert Entity 3 (success)
   ... (continue regardless of failures)
   ```

### Supported Entity Types

All QuickBooks entity types are supported in both modes:

**Typed Entities (Dedicated Tables):**

- Customer
- Vendor
- Account
- Item
- Invoice
- Bill
- Payment

**Generic Entities (Generic Table):**

- TaxCode
- PaymentMethod
- Term
- Department
- Class
- And any other QuickBooks entity type

### Error Handling

#### Transactional Mode

```typescript
const result = await loader.bulkUpsert('org-123', 'Customer', entities)

if (result.failed > 0) {
  // Transaction failed - all operations rolled back
  const error = result.errors?.[0]
  console.error(`Transaction failed: ${error?.error}`)
  // entityId will be 'transaction' in this mode
}
```

#### Partial Mode

```typescript
const result = await loader.bulkUpsert('org-123', 'Customer', entities, { allowPartial: true })

if (result.failed > 0) {
  // Some entities failed, but others may have succeeded
  result.errors?.forEach((error) => {
    console.error(`Entity ${error.entityId} failed: ${error.error}`)
  })
}
```

## Use Cases

### Use Case 1: Initial Sync (Transactional Mode)

When performing an initial sync of critical data where consistency is paramount:

```typescript
// Ensure all customers are synced atomically
const result = await loader.bulkUpsert('org-123', 'Customer', customers)

if (result.failed > 0) {
  // Log failure and retry entire batch
  logger.error('Customer sync failed, retrying...')
  await retrySync()
}
```

### Use Case 2: Incremental Updates (Transactional Mode)

For webhook-based incremental updates where atomicity is important:

```typescript
// Process webhook batch atomically
const changes = await processWebhookBatch(webhookEvents)
const result = await loader.bulkUpsert('org-123', 'Invoice', changes)

if (result.success === changes.length) {
  await updateWebhookCursor(lastEventId)
}
```

### Use Case 3: Large Import (Partial Mode)

When importing large datasets where some failures are acceptable:

```typescript
// Import large customer list, log failures for manual review
const result = await loader.bulkUpsert('org-123', 'Customer', largeCustomerList, {
  allowPartial: true,
})

logger.info(`Imported ${result.success} customers`)
if (result.failed > 0) {
  await saveFailedRecordsForReview(result.errors)
}
```

### Use Case 4: Batch Processing (Partial Mode)

For background jobs where you want to maximize throughput:

```typescript
// Process as many records as possible
const batches = chunk(entities, 100)

for (const batch of batches) {
  const result = await loader.bulkUpsert('org-123', 'Customer', batch, { allowPartial: true })

  await updateProgress({
    processed: result.success,
    failed: result.failed,
  })
}
```

## Performance Considerations

### Transactional Mode

- **Pros:**
  - Guaranteed atomicity
  - Database-level rollback (no manual cleanup)
  - Simpler error handling
- **Cons:**
  - All-or-nothing: One failure invalidates all work
  - May hold locks longer for large batches
  - Higher memory usage for large transactions

**Recommendation:** Use for critical operations with small to medium batches (<1000 entities)

### Partial Mode

- **Pros:**
  - Maximum throughput
  - Partial success in case of failures
  - Better for very large batches
- **Cons:**
  - Requires manual tracking of failures
  - Potential partial state if job is interrupted
  - More complex error handling

**Recommendation:** Use for bulk imports, background jobs, or very large batches (>1000 entities)

## Migration Guide

### Existing Code

If you have existing code using `bulkUpsert`, no changes are required. The default behavior is now transactional, which provides better data consistency.

```typescript
// Before (no transaction support)
const result = await loader.bulkUpsert('org-123', 'Customer', entities)

// After (automatic transactional mode)
const result = await loader.bulkUpsert('org-123', 'Customer', entities)
```

### Opting into Partial Mode

If you need the old partial success behavior:

```typescript
// Enable partial mode explicitly
const result = await loader.bulkUpsert('org-123', 'Customer', entities, { allowPartial: true })
```

## Testing

Comprehensive tests are provided in `supabase-loader.test.ts`:

```bash
# Run tests
npm test src/quickbooks/etl/supabase-loader.test.ts

# Run with coverage
npm test -- --coverage src/quickbooks/etl/supabase-loader.test.ts
```

## Technical Details

### Database Context

The implementation uses a `DbContext` type that can be either the main database connection or a transaction context:

```typescript
type DbContext = typeof db | TransactionContext
```

All upsert methods accept a `DbContext` parameter, allowing them to work seamlessly in both regular and transactional modes.

### Transaction Context

Drizzle ORM provides first-class transaction support through the `db.transaction()` API:

```typescript
await db.transaction(async (tx) => {
  // tx is a transaction context
  // All operations using tx are part of the same transaction
  await tx.insert(table).values(...)
})
```

### Type Safety

The implementation maintains full TypeScript type safety across both modes:

```typescript
// Typed entities use specific normalized types
const customers: NormalizedEntityMap['Customer'][] = [...]
await loader.bulkUpsert('org-123', 'Customer', customers)

// Generic entities also maintain type safety
const taxCodes: NormalizedEntityMap['TaxCode'][] = [...]
await loader.bulkUpsert('org-123', 'TaxCode', taxCodes)
```

## Future Enhancements

Potential improvements for future versions:

1. **Configurable batch sizes**: Automatically split large arrays into optimal transaction sizes
2. **Retry logic**: Built-in retry with exponential backoff for transactional failures
3. **Progress callbacks**: Real-time progress updates for long-running operations
4. **Parallel transactions**: Process multiple independent batches in parallel
5. **Savepoints**: Support for nested transactions and partial rollbacks
6. **Performance metrics**: Track transaction duration and success rates

## Related Files

- `/home/proud/code/midas/zenith-os/src/quickbooks/etl/supabase-loader.ts` - Main implementation
- `/home/proud/code/midas/zenith-os/src/quickbooks/etl/supabase-loader.test.ts` - Test suite
- `/home/proud/code/midas/zenith-os/src/quickbooks/etl/loader.ts` - Interface definition
- `/home/proud/code/midas/zenith-os/src/db/index.ts` - Database configuration
