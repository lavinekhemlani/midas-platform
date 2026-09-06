# Zenith OS Caching Architecture

## Table of Contents

- [Commit Investigation: Report Cache Removal](#commit-investigation-report-cache-removal)
- [Caching Strategies Overview](#caching-strategies-overview)
- [Cache Implementations](#cache-implementations)
- [TTL Settings](#ttl-settings)
- [Cache Monitoring](#cache-monitoring)
- [Recent Changes](#recent-changes)
- [Key Files Reference](#key-files-reference)

---

## Commit Investigation: Report Cache Removal

### Commit: 20c2ed54cf66ca19f2a589018f91600d174c810f

**Author:** joeltheai
**Date:** October 28, 2025 13:08:47 +0530
**Impact:** -609 lines of code across 10 files

### Summary

This commit removed the report caching service from the codebase, simplifying the report fetching logic by eliminating caching checks and related code.

### What Was Removed

#### 1. Complete Caching Service Deletion

**File:** `src/lib/services/reportCache.ts` (397 lines deleted)

The sophisticated `ReportCacheService` class included:

- LRU (Least Recently Used) eviction strategy
- TTL-based expiration (default 30 minutes)
- Tag-based invalidation
- Memory usage tracking
- Cache warmup capabilities
- Data integrity hashing
- Compression support
- Pattern-based cache clearing

#### 2. Report Routes Cache Removal

| Route                       | Lines Removed |
| --------------------------- | ------------- |
| `aged-payables/route.ts`    | 21            |
| `aged-receivables/route.ts` | 21            |
| `balance-sheet/route.ts`    | 21            |
| `cash-flow/route.ts`        | 21            |
| `journal-report/route.ts`   | 20            |
| `profit-loss/route.ts`      | 25            |
| `route.ts` (main reports)   | 31            |

Each route had:

- Cache initialization with config
- Cache key generation
- Cache hit checks before data fetch
- Cache set after data fetch

#### 3. Service Cache Removal

| Service                 | Lines Removed |
| ----------------------- | ------------- |
| `expenseDataService.ts` | 25            |
| `unifiedDataTool.ts`    | 31            |

### Impact Analysis

**Simplification:**

- Reports are now fetched fresh on each request
- Reduced code complexity and maintenance burden
- No more cache invalidation concerns for report data
- Clearer data flow path

**Responsibility Shift:**

- Moved from server-side caching to client-side SWR caching
- Better separation of concerns
- Client controls cache lifetime and revalidation

**Performance Considerations:**

- Server load may increase (no server-side cache buffer)
- Client-side caching (30-minute SWR) mitigates most concerns
- More consistent data freshness

---

## Caching Strategies Overview

Zenith OS implements a **multi-layered caching architecture** with different strategies optimized for different data types and access patterns.

### Architecture Layers

```
┌─────────────────────────────────────────┐
│   Layer 1: Request Deduplication        │
│   (10 seconds TTL)                      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   Layer 2: Server-Side In-Memory        │
│   (KPI Cache: 5 min, JWKS: 1 hour)     │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   Layer 3: Client-Side SWR              │
│   (30 min dedup, custom revalidation)   │
└─────────────────────────────────────────┘
```

---

## Cache Implementations

### 1. KPI In-Memory Cache (Primary Server Cache)

**Location:** `src/lib/kpis/engine/cache.ts`

**Type:** LRU (Least Recently Used)

**Configuration:**

```typescript
{
  ttl: 5 minutes (300 seconds),
  maxEntries: 100,
  maxMemoryMB: 50,
  evictionStrategy: 'LRU'
}
```

**Features:**

- Automatic eviction when size or memory limits reached
- TTL-based expiration
- Per-entry hit counting
- Memory usage tracking
- Cache statistics API

**API Endpoints:**

- `GET /api/v2/kpis/cache-stats` - View cache performance
- `DELETE /api/v2/kpis/cache-stats?pattern=*` - Clear cache with pattern matching

**Monitoring Metrics:**

- Hit/miss counts and rates
- Cache size and utilization
- Memory usage (total, average, largest entry)
- Eviction counts
- Top entries by hit count

**Health Scoring:**

```
Score = (hitRate × 0.6) + ((1 - size/maxSize) × 0.4)

Status Levels:
- Healthy: >60%
- Warning: 40-60%
- Critical: <40%
```

**HTTP Response Headers:**

```
Cache-Control: private, max-age=60
```

### 2. Client-Side SWR Cache

**Location:** `src/contexts/ReportsProvider.tsx`

**Configuration:**

```typescript
{
  dedupingInterval: 30 * 60 * 1000,  // 30 minutes
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnMount: false,
  keepPreviousData: true,
  revalidateOnReconnect: true
}
```

**Behavior:**

- Prevents duplicate requests within 30-minute window
- Keeps previous data during revalidation (no loading states)
- Only revalidates on network reconnect
- No automatic revalidation on focus or mount

**Use Cases:**

- Report data (P&L, Balance Sheet, Cash Flow)
- Executive summaries
- Financial statements

### 3. AI Tool Cache (Query-Aware TTLs)

**Location:** `src/lib/ai/tools/cachedUnifiedDataTool.ts`

**Configuration:**

```typescript
{
  defaultTTL: 5 minutes,
  maxEntries: 100,
  evictionStrategy: 'FIFO'
}
```

**Smart TTL by Query Type:**

| Query Type         | TTL        | Rationale                              |
| ------------------ | ---------- | -------------------------------------- |
| Cash/Balance       | 1 minute   | Most volatile, time-sensitive          |
| KPI/Metrics        | 10 minutes | Calculated values, moderate volatility |
| Trends/Analysis    | 15 minutes | Historical comparisons                 |
| Reports/Historical | 30 minutes | Least volatile data                    |

**Special Features:**

- Dashboard sync detection via localStorage
- Stale cache fallback on errors
- Query intent detection for TTL selection

### 4. Authentication Caches

#### JWKS Cache

**Location:** `src/lib/auth/jwks/cache-manager.ts`

**Type:** Singleton JWT Key Set cache

**Configuration:**

```typescript
{
  cacheLifetime: 1 hour (3600 seconds),
  maxCacheSize: 10 keys,
  keyMaxAge: 10 minutes (600 seconds),
  backoffSeconds: 30
}
```

**Features:**

- Singleton pattern ensures single cache instance
- Backoff mechanism for failed fetches
- Automatic cache recreation
- Min fetch interval: 5 seconds

**HTTP Headers:**

```
Cache-Control: no-cache
```

#### QuickBooks Company Info Cache

**Location:** `src/lib/providers/quickbooks/client.ts`

**Configuration:**

```typescript
{
  ttl: 24 hours (86400 seconds),
  type: 'instance-level'
}
```

**Purpose:**

- Minimizes API calls to QuickBooks
- Company data rarely changes
- Simple timestamp-based expiration

### 5. Request Deduplication Cache

**Location:** `src/app/api/reports/cash-flow/route.ts`

**Type:** In-flight request deduplication

**Configuration:**

```typescript
{
  ttl: 10 seconds,
  type: Map<string, Promise<any>>
}
```

**Behavior:**

- Prevents duplicate API calls for identical requests
- Auto-cleanup after request completion
- Short-lived (10 seconds)

**Use Cases:**

- Purchase queries in cash flow reports
- Any endpoint with potential duplicate requests

---

## TTL Settings

### Complete TTL Reference Table

| Cache Type             | TTL           | Location                                       | Use Case                 |
| ---------------------- | ------------- | ---------------------------------------------- | ------------------------ |
| KPI Cache              | 5 minutes     | `src/lib/kpis/engine/cache.ts:18`              | Calculated KPI values    |
| JWKS Cache Lifetime    | 1 hour        | `src/lib/auth/constants.ts:17`                 | JWT verification keys    |
| JWKS Key Max Age       | 10 minutes    | `src/lib/auth/constants.ts:26`                 | Individual key rotation  |
| JWKS Backoff           | 30 seconds    | `src/lib/auth/constants.ts:44`                 | Failed fetch retry delay |
| AI Tool - Default      | 5 minutes     | `src/lib/ai/tools/cachedUnifiedDataTool.ts:42` | General AI queries       |
| AI Tool - Cash/Balance | 1 minute      | `src/lib/ai/tools/cachedUnifiedDataTool.ts:83` | Real-time balances       |
| AI Tool - KPI/Metrics  | 10 minutes    | `src/lib/ai/tools/cachedUnifiedDataTool.ts:88` | Performance metrics      |
| AI Tool - Reports      | 30 minutes    | `src/lib/ai/tools/cachedUnifiedDataTool.ts:93` | Historical reports       |
| AI Tool - Trends       | 15 minutes    | `src/lib/ai/tools/cachedUnifiedDataTool.ts:98` | Trend analysis           |
| QB Company Info        | 24 hours      | `src/lib/providers/quickbooks/client.ts:56`    | Organization data        |
| Reports (SWR)          | 30 min dedup  | `src/contexts/ReportsProvider.tsx:224`         | Financial reports        |
| KPI Catalog (SWR)      | 1 min dedup   | `src/hooks/kpis/useKPICatalog.ts:50`           | KPI metadata             |
| Data Staleness         | 30-45 minutes | `src/contexts/ReportsProvider.tsx:105-107`     | Stale data threshold     |
| Request Dedup          | 10 seconds    | `src/app/api/reports/cash-flow/route.ts`       | In-flight requests       |
| Auth Cookies           | 1 hour        | `src/lib/auth/constants.ts:14`                 | Session cookies          |
| Cache Refresh          | 5 minutes     | `src/lib/auth/constants.ts:20`                 | Auth cache refresh       |

### TTL Selection Rationale

**Short TTL (1-5 minutes):**

- Real-time balances
- Current cash positions
- Session-based data
- Frequently changing metrics

**Medium TTL (10-15 minutes):**

- Calculated KPIs
- Performance metrics
- Trend analyses
- JWT verification keys (rotation)

**Long TTL (30 minutes - 1 hour):**

- Historical reports
- Financial statements
- Report data
- Authentication tokens

**Very Long TTL (24+ hours):**

- Company/organization info
- Static configuration
- Rarely changing metadata

---

## Cache Monitoring

### KPI Cache Monitoring Hook

**Location:** `src/hooks/kpis/useKPICache.ts`

**Available Metrics:**

```typescript
interface KPICacheStats {
  hitCount: number
  missCount: number
  hitRate: number
  size: number
  maxSize: number
  memoryUsage: {
    total: number
    average: number
    largest: number
  }
  evictionCount: number
  topEntries: Array<{
    key: string
    hits: number
  }>
}
```

### Health Scoring Algorithm

```typescript
const score = hitRate * 0.6 + (1 - size / maxSize) * 0.4

const status = score > 60 ? 'healthy' : score > 40 ? 'warning' : 'critical'
```

**Weight Distribution:**

- Hit Rate: 60% - Primary performance indicator
- Utilization: 40% - Prevents size limit issues

### Performance Monitor Component

**Location:** `src/components/kpis/PerformanceMonitor.tsx`

**Displays:**

- Cache utilization percentage
- Memory usage in MB
- Hit rate percentage
- Eviction metrics
- Health status indicator

### Cache Statistics API

**Endpoint:** `GET /api/v2/kpis/cache-stats`

**Response Format:**

```json
{
  "hitCount": 1250,
  "missCount": 320,
  "hitRate": 79.6,
  "size": 45,
  "maxSize": 100,
  "memoryUsage": {
    "total": 12582912,
    "average": 279620,
    "largest": 1048576
  },
  "evictionCount": 5,
  "topEntries": [{ "key": "org123:revenue:2024-01", "hits": 45 }]
}
```

### Cache Management API

**Clear Cache:** `DELETE /api/v2/kpis/cache-stats`

**Pattern-based Clearing:**

```bash
DELETE /api/v2/kpis/cache-stats?pattern=org123:*
```

**Response:**

```json
{
  "success": true,
  "cleared": 15,
  "message": "Cleared 15 cache entries"
}
```

---

## Recent Changes

### Last 20 Commits Affecting Caching

| Commit      | Date         | Message                                                              | Impact                                      |
| ----------- | ------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| 35e9e2c     | Recent       | refactor: changed swr cache ttl to 30 minutes for reports data       | Increased client cache duration             |
| a41af9a     | Recent       | refactor: remove report caching logic from various report routes     | Removed redundant caching                   |
| **20c2ed5** | Oct 28, 2025 | **refactor: remove report caching logic from various report routes** | **-609 lines, deleted reportCache service** |
| 6203e18     | Earlier      | fix: implemented jwks common cache                                   | Added auth caching                          |

### Change Analysis

#### 1. SWR Cache TTL Update (commit 35e9e2c)

**File:** `src/contexts/ReportsProvider.tsx`

**Change:**

```typescript
// Before
dedupingInterval: 5 * 60 * 1000 // 5 minutes

// After
dedupingInterval: 30 * 60 * 1000 // 30 minutes
```

**Rationale:**

- Report data changes infrequently
- Reduces server load
- Improves user experience (faster navigation)

#### 2. Report Caching Refactor (commits a41af9a, 20c2ed5)

**Impact:**

- Removed server-side report cache service
- Simplified route handlers
- Centralized caching at client layer
- Eliminated cache invalidation complexity

**Before:**

```typescript
// Check cache
const cached = reportCache.get(orgId, 'profit_loss', cacheKey)
if (cached) return cached

// Fetch data
const data = await fetchData()

// Store in cache
reportCache.set(orgId, 'profit_loss', cacheKey, data)
```

**After:**

```typescript
// Simply fetch data
const data = await fetchData()
return data
```

**Benefits:**

- Cleaner code
- Easier to debug
- Client controls caching behavior
- No server-side memory pressure

#### 3. JWKS Cache Implementation (commit 6203e18)

**Added:**

- Singleton cache manager
- Backoff mechanism for failed fetches
- Configurable cache lifetime
- Key rotation support

**Benefits:**

- Reduces external API calls
- Improves authentication performance
- Better error handling

---

## Data Being Cached

### By Category

#### A. KPI Data

- Calculated KPI values with metadata
- Calculation timestamps
- Cache hit status
- Data freshness indicators
- Component breakdowns
- Trend data
- All KPI categories:
  - Revenue metrics
  - Profitability metrics
  - Cash flow metrics
  - Liquidity ratios
  - Efficiency ratios
  - Balance sheet metrics
  - Receivables analysis
  - Payables analysis

#### B. Authentication Data

- JWKS (JSON Web Key Set) for JWT verification
- Company information from QuickBooks
- Session/authentication tokens
- User authorization data

#### C. Report Data (Client-Side Only)

- Profit & Loss reports
- Balance Sheet data
- Cash Flow statements
- Executive summaries
- Aged receivables reports
- Aged payables reports
- Journal reports

#### D. AI/Chat Data

- Unified data tool responses
- Query results with intent detection
- Dashboard data synchronization
- Conversation context

#### E. Static/Catalog Data

- KPI catalog and metadata
- KPI benchmarks and definitions
- Learning terms and progress
- Organization preferences

---

## Eviction Strategies

### 1. LRU (Least Recently Used)

**Used By:** KPI Cache, AI Tool Cache

**Implementation:**

- Tracks last access time for each entry
- Evicts oldest accessed entries when limits reached
- Balances frequency and recency

**Triggers:**

- Max entries limit reached (100 entries)
- Max memory limit reached (50MB)

### 2. FIFO (First In, First Out)

**Used By:** AI Tool Cache size enforcement

**Implementation:**

- Removes oldest entries by creation time
- Simple, predictable behavior

### 3. TTL-Based Expiration

**Used By:** All caches

**Implementation:**

- Automatic removal when TTL expires
- Background cleanup processes
- Lazy evaluation on access

### 4. Memory-Based Eviction

**Used By:** KPI Cache

**Configuration:**

```typescript
maxMemoryMB: 50
```

**Behavior:**

- Monitors total cache memory usage
- Evicts LRU entries when limit approached
- Prevents memory overflow

---

## Invalidation Strategies

### 1. TTL Expiration (Automatic)

- All caches support automatic TTL-based expiration
- Background cleanup every 60 seconds (KPI cache)
- Lazy cleanup on access

### 2. Pattern-Based Clearing

```bash
DELETE /api/v2/kpis/cache-stats?pattern=org123:*
```

- Supports wildcard patterns
- Useful for organization-wide invalidation

### 3. Full Cache Clear

```bash
DELETE /api/v2/kpis/cache-stats
```

- Clears entire cache
- Use sparingly (nuclear option)

### 4. Dashboard Sync Detection

**Location:** `src/lib/ai/tools/cachedUnifiedDataTool.ts`

- AI tool detects dashboard updates via localStorage
- Invalidates related cached queries
- Ensures consistency between chat and dashboard

### 5. Manual Refresh

```bash
GET /api/v2/kpis?useCache=false
```

- Query parameter to bypass cache
- Forces fresh data fetch
- Client-controlled cache busting

### 6. Maintenance Scheduler

- KPI cache runs periodic cleanup every 60 seconds
- Removes expired entries
- Monitors memory usage
- Evicts old entries if needed

---

## Cache Endpoints Reference

### Caching-Aware API Routes

| Endpoint                         | Method | Cache Type    | TTL    | Query Params                                    |
| -------------------------------- | ------ | ------------- | ------ | ----------------------------------------------- |
| `/api/v2/kpis`                   | GET    | Server LRU    | 5 min  | `useCache`, `includeTrends`, `includeBreakdown` |
| `/api/v2/kpis/[kpiId]`           | GET    | Server LRU    | 5 min  | `useCache`, `includeHistory`                    |
| `/api/v2/kpis/cache-stats`       | GET    | N/A           | -      | Returns cache statistics                        |
| `/api/v2/kpis/cache-stats`       | DELETE | N/A           | -      | `pattern` for selective clearing                |
| `/api/reports/cash-flow`         | GET    | Request dedup | 10 sec | None                                            |
| `/api/reports/executive-summary` | GET    | SWR client    | 30 min | `cache` parameter                               |
| `/api/reports/balance-sheet`     | GET    | SWR client    | 30 min | None                                            |
| `/api/reports/profit-loss`       | GET    | SWR client    | 30 min | None                                            |
| `/api/reports/aged-receivables`  | GET    | SWR client    | 30 min | `date`, `details`                               |
| `/api/reports/aged-payables`     | GET    | SWR client    | 30 min | `date`, `details`                               |
| `/api/reports/journal-report`    | GET    | SWR client    | 30 min | `start`, `end`                                  |

### Cache Control Headers

| Endpoint         | Header        | Value                 |
| ---------------- | ------------- | --------------------- |
| `/api/v2/kpis/*` | Cache-Control | `private, max-age=60` |
| JWKS Fetcher     | Cache-Control | `no-cache`            |

---

## Implementation Status

| Feature                    | Status             | Details                                               |
| -------------------------- | ------------------ | ----------------------------------------------------- |
| **In-Memory KPI Cache**    | ✅ Implemented     | LRU with 5 min TTL, 100 entries, 50MB limit           |
| **JWKS Cache**             | ✅ Implemented     | Singleton pattern, 1 hour lifetime, backoff support   |
| **AI Tool Cache**          | ✅ Implemented     | Query-aware TTL, dashboard sync detection             |
| **Request Deduplication**  | ✅ Implemented     | Cash-flow route, 10 sec TTL                           |
| **SWR Client Cache**       | ✅ Implemented     | 30 min dedup, custom revalidation rules               |
| **Cache Stats API**        | ✅ Implemented     | Full GET/DELETE support with pattern clearing         |
| **Cache Maintenance**      | ✅ Implemented     | Scheduler runs every 60 seconds                       |
| **Cache Monitoring**       | ✅ Implemented     | Health scoring, metrics, component visualization      |
| **Performance Monitor UI** | ✅ Implemented     | Real-time cache stats display                         |
| **Documented Strategy**    | ⚠️ Partial         | Comprehensive docs exist but not fully implemented    |
| **Cache Warming**          | ⚠️ Partial         | Implemented for KPI prefetching, not general          |
| **Webhook Invalidation**   | ❌ Not Implemented | Documented but not active                             |
| **Multi-layer Caching**    | ✅ Implemented     | Layers 1 & 2 done, Layer 3 (SWR) replaces React Query |

---

## Key Files Reference

### Core Cache Implementation

| File                                        | Purpose                       | Lines |
| ------------------------------------------- | ----------------------------- | ----- |
| `src/lib/kpis/engine/cache.ts`              | Main LRU cache implementation | ~400  |
| `src/lib/auth/jwks/cache-manager.ts`        | Auth caching with backoff     | ~100  |
| `src/lib/ai/tools/cachedUnifiedDataTool.ts` | AI query caching              | ~200  |

### API Endpoints

| File                                       | Purpose                         |
| ------------------------------------------ | ------------------------------- |
| `src/app/api/v2/kpis/route.ts`             | KPI batch endpoint with caching |
| `src/app/api/v2/kpis/[kpiId]/route.ts`     | Single KPI with caching         |
| `src/app/api/v2/kpis/cache-stats/route.ts` | Cache stats and management      |
| `src/app/api/reports/cash-flow/route.ts`   | Request deduplication example   |

### Client-Side Caching

| File                               | Purpose                       |
| ---------------------------------- | ----------------------------- |
| `src/contexts/ReportsProvider.tsx` | SWR configuration for reports |
| `src/hooks/kpis/useKPICache.ts`    | Cache management hook         |
| `src/hooks/kpis/useKPICatalog.ts`  | Catalog caching with SWR      |

### Configuration & Constants

| File                           | Purpose                  |
| ------------------------------ | ------------------------ |
| `src/lib/auth/constants.ts`    | Auth cache configuration |
| `src/lib/auth/jwks/fetcher.ts` | JWKS fetch configuration |

### Monitoring & UI

| File                                         | Purpose                       |
| -------------------------------------------- | ----------------------------- |
| `src/components/kpis/PerformanceMonitor.tsx` | Cache visualization component |
| `src/hooks/kpis/useKPICache.ts`              | Cache monitoring utilities    |

### Documentation

| File                                        | Purpose                        | Status         |
| ------------------------------------------- | ------------------------------ | -------------- |
| `docs/api-v2/maintenance/cache-strategy.md` | Caching strategy documentation | 🔴 Not Started |
| `docs/CACHING_ARCHITECTURE.md`              | This document                  | ✅ Current     |

---

## Best Practices

### When to Cache

1. **High Computation Cost**
   - KPI calculations
   - Complex aggregations
   - Multi-step data processing

2. **External API Calls**
   - QuickBooks API requests
   - Third-party integrations
   - Rate-limited services

3. **Infrequently Changing Data**
   - Organization info
   - Historical reports
   - Static metadata

4. **High Access Frequency**
   - Dashboard KPIs
   - Common queries
   - Frequently accessed reports

### When NOT to Cache

1. **Real-Time Critical Data**
   - Live transaction feeds
   - Real-time notifications
   - Current sync status

2. **User-Specific Sensitive Data**
   - Temporary authentication flows
   - One-time tokens
   - CSRF tokens

3. **Rapidly Changing Data**
   - Live stock prices (if implemented)
   - Real-time collaboration state
   - Active webhook payloads

### Cache Invalidation Guidelines

1. **Data Sync Events**
   - Clear related KPIs after QuickBooks sync
   - Invalidate reports after data import
   - Refresh cached aggregations

2. **User Actions**
   - Clear cache after manual refresh request
   - Invalidate on settings changes
   - Refresh after data modifications

3. **Time-Based**
   - Background cleanup every 60 seconds
   - TTL expiration (automatic)
   - Scheduled nightly purge (if needed)

4. **Error Conditions**
   - Clear on authentication failures
   - Invalidate on API errors
   - Purge on stale data detection

---

## Future Enhancements

### Planned (Documented but Not Implemented)

1. **Webhook-Based Invalidation**
   - QuickBooks webhook listeners
   - Automatic cache invalidation on remote changes
   - Event-driven cache updates

2. **Multi-Layer Optimization**
   - Better coordination between layers
   - Cache warming strategies
   - Predictive prefetching

3. **Cache Warming**
   - Background prefetch of common queries
   - Scheduled report generation
   - Predictive KPI calculation

4. **Redis Integration** (Optional)
   - Distributed caching for multi-instance deployments
   - Shared cache across server instances
   - Persistence for expensive calculations

### Potential Improvements

1. **Advanced Analytics**
   - Cache effectiveness by route
   - Cost/benefit analysis per endpoint
   - Optimization recommendations

2. **Smart TTL Adjustment**
   - Auto-adjust TTL based on access patterns
   - Machine learning for optimal TTL
   - Time-of-day based adjustments

3. **Cache Compression**
   - Reduce memory footprint
   - Faster serialization
   - Network transfer optimization

4. **Progressive Cache Warming**
   - Intelligent prefetching
   - User behavior prediction
   - Off-peak calculation scheduling

---

## Troubleshooting

### Common Issues

#### High Memory Usage

**Symptoms:**

- Cache health shows critical status
- Memory usage approaching 50MB limit
- Frequent evictions

**Solutions:**

1. Check cache stats: `GET /api/v2/kpis/cache-stats`
2. Clear specific patterns: `DELETE /api/v2/kpis/cache-stats?pattern=org123:*`
3. Reduce TTL for large objects
4. Increase cleanup frequency

#### Low Hit Rate

**Symptoms:**

- Hit rate below 40%
- Frequent cache misses
- Poor performance

**Solutions:**

1. Verify query parameter consistency
2. Check TTL settings (may be too short)
3. Review cache key generation
4. Consider cache warming

#### Stale Data

**Symptoms:**

- Users seeing outdated information
- Data doesn't match QuickBooks
- Reports out of sync

**Solutions:**

1. Force refresh: `?useCache=false`
2. Reduce TTL for volatile data
3. Clear cache after sync: `DELETE /api/v2/kpis/cache-stats`
4. Check dashboard sync detection

### Debug Commands

```bash
# View cache statistics
curl http://localhost:3000/api/v2/kpis/cache-stats

# Clear all cache
curl -X DELETE http://localhost:3000/api/v2/kpis/cache-stats

# Clear organization-specific cache
curl -X DELETE "http://localhost:3000/api/v2/kpis/cache-stats?pattern=org123:*"

# Bypass cache for single request
curl "http://localhost:3000/api/v2/kpis?useCache=false"
```

---

## Conclusion

Zenith OS implements a sophisticated multi-layered caching architecture that balances performance, data freshness, and system complexity. The recent removal of the report caching service (commit 20c2ed5) represents a strategic shift toward client-side caching, simplifying server-side logic while maintaining excellent performance through SWR.

**Key Strengths:**

- Multiple specialized caching layers
- Smart TTL selection based on data volatility
- Comprehensive monitoring and health scoring
- Flexible invalidation strategies

**Opportunities:**

- Implement webhook-based invalidation
- Add distributed caching (Redis) for multi-instance deployments
- Enhance cache warming capabilities
- Complete documented strategy implementation

This architecture demonstrates a mature understanding of caching trade-offs and provides a solid foundation for future scalability improvements.
