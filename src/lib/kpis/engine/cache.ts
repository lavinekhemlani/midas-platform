import { KPIBatchResponse, KPIId, CacheEntry } from '../types'

/**
 * In-memory cache for KPI calculations
 * Implements LRU eviction and TTL expiration
 * See: docs/api-v2/maintenance/cache-strategy.md
 */
export class KPICache {
  private cache: Map<string, CacheEntry>
  private maxSize: number
  private defaultTTL: number
  private stats: {
    hits: number
    misses: number
    evictions: number
  }

  constructor(maxSize: number = 100, defaultTTL: number = 5 * 60 * 1000) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(
    organizationId: string,
    kpiIds: KPIId[],
    period?: { start: string; end: string }
  ): string {
    const sortedKpis = [...kpiIds].sort().join(',')
    const periodKey = period ? `${period.start}_${period.end}` : 'current'
    return `${organizationId}:${periodKey}:${sortedKpis}`
  }

  /**
   * Get cached data if available and not expired
   */
  get(key: string): any | null {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    const age = now - entry.timestamp.getTime()

    if (age > entry.ttl) {
      // Entry has expired, remove it
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, {
      ...entry,
      hits: entry.hits + 1
    })

    this.stats.hits++
    return entry.data
  }

  /**
   * Store data in cache
   */
  set(key: string, data: any, ttl?: number): void {
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key,
      data,
      timestamp: new Date(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    }

    this.cache.set(key, entry)
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const data = this.get(key)
    return data !== null
  }

  /**
   * Clear specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now()
    let cleared = 0

    for (const [key, entry] of this.cache) {
      const age = now - entry.timestamp.getTime()
      if (age > entry.ttl) {
        this.cache.delete(key)
        cleared++
      }
    }

    return cleared
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let invalidated = 0

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    return invalidated
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hits: number
    misses: number
    hitRate: number
    evictions: number
    entries: Array<{
      key: string
      age: number
      hits: number
      size: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((now - entry.timestamp.getTime()) / 1000), // Age in seconds
      hits: entry.hits,
      size: JSON.stringify(entry.data).length
    }))

    const totalRequests = this.stats.hits + this.stats.misses
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 10) / 10,
      evictions: this.stats.evictions,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10) // Top 10 by hits
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Map maintains insertion order, so first entry is oldest
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.cache.delete(firstKey)
      this.stats.evictions++
    }
  }

  /**
   * Warm up cache with frequently used data
   */
  async warmup(
    fetchFunction: (kpiIds: KPIId[]) => Promise<any>,
    organizationId: string,
    commonKpiSets: KPIId[][]
  ): Promise<void> {
    const warmupPromises = commonKpiSets.map(async kpiIds => {
      try {
        const key = this.generateKey(organizationId, kpiIds)
        if (!this.has(key)) {
          const data = await fetchFunction(kpiIds)
          this.set(key, data)
        }
      } catch (error) {
        console.error(`Cache warmup failed for KPIs: ${kpiIds}`, error)
      }
    })

    await Promise.allSettled(warmupPromises)
  }

  /**
   * Get memory usage estimate
   */
  getMemoryUsage(): {
    total: number
    average: number
    largest: { key: string; size: number }
  } {
    let totalSize = 0
    let largestEntry = { key: '', size: 0 }

    for (const [key, entry] of this.cache) {
      const size = JSON.stringify(entry.data).length
      totalSize += size

      if (size > largestEntry.size) {
        largestEntry = { key, size }
      }
    }

    return {
      total: totalSize,
      average: this.cache.size > 0 ? Math.round(totalSize / this.cache.size) : 0,
      largest: largestEntry
    }
  }
}

/**
 * Global cache instance
 */
let globalCache: KPICache | null = null

/**
 * Get or create global cache instance
 */
export function getKPICache(): KPICache {
  if (!globalCache) {
    globalCache = new KPICache()
  }
  return globalCache
}

/**
 * Cache-aware KPI fetcher wrapper
 */
export class CachedKPIFetcher {
  private cache: KPICache
  private fetchFunction: (kpiIds: KPIId[]) => Promise<any>
  private organizationId: string

  constructor(
    fetchFunction: (kpiIds: KPIId[]) => Promise<any>,
    organizationId: string,
    cache?: KPICache
  ) {
    this.cache = cache || getKPICache()
    this.fetchFunction = fetchFunction
    this.organizationId = organizationId
  }

  /**
   * Fetch KPIs with caching
   */
  async fetch(
    kpiIds: KPIId[],
    options?: {
      period?: { start: string; end: string }
      useCache?: boolean
      ttl?: number
    }
  ): Promise<any> {
    const { period, useCache = true, ttl } = options || {}

    // Generate cache key
    const cacheKey = this.cache.generateKey(this.organizationId, kpiIds, period)

    // Check cache if enabled
    if (useCache) {
      const cached = this.cache.get(cacheKey)
      if (cached) {
        console.log(`[Cache] Hit for key: ${cacheKey}`)
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cacheHit: true,
            cachedAt: cached.metadata?.calculatedAt
          }
        }
      }
    }

    console.log(`[Cache] Miss for key: ${cacheKey}`)

    // Fetch fresh data
    const startTime = Date.now()
    const data = await this.fetchFunction(kpiIds)
    const fetchTime = Date.now() - startTime

    // Add metadata
    const result = {
      ...data,
      metadata: {
        ...data.metadata,
        cacheHit: false,
        fetchTime,
        calculatedAt: new Date()
      }
    }

    // Store in cache
    if (useCache) {
      this.cache.set(cacheKey, result, ttl)
    }

    return result
  }

  /**
   * Invalidate cache for this organization
   */
  invalidate(): void {
    this.cache.invalidatePattern(this.organizationId)
  }

  /**
   * Prefetch common KPI combinations
   */
  async prefetch(): Promise<void> {
    const commonSets = [
      ['revenue', 'arr', 'mrr'],
      ['gross_margin', 'net_margin'],
      ['burn_rate', 'runway_months', 'cash_balance'],
      ['current_ratio', 'quick_ratio'],
      ['dso', 'dpo', 'cash_conversion_cycle']
    ] as KPIId[][]

    await this.cache.warmup(this.fetchFunction, this.organizationId, commonSets)
  }
}

/**
 * Cache maintenance scheduler
 */
export class CacheMaintenanceScheduler {
  private cache: KPICache
  private intervalId: NodeJS.Timeout | null = null

  constructor(cache?: KPICache) {
    this.cache = cache || getKPICache()
  }

  /**
   * Start periodic cache maintenance
   */
  start(intervalMs: number = 60000): void {
    // Clear any existing interval
    this.stop()

    this.intervalId = setInterval(() => {
      this.performMaintenance()
    }, intervalMs)
  }

  /**
   * Stop cache maintenance
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Perform cache maintenance tasks
   */
  private performMaintenance(): void {
    // Clear expired entries
    const expired = this.cache.clearExpired()
    if (expired > 0) {
      console.log(`[Cache] Cleared ${expired} expired entries`)
    }

    // Check memory usage and evict if needed
    const memUsage = this.cache.getMemoryUsage()
    const maxMemoryBytes = 50 * 1024 * 1024 // 50MB limit

    if (memUsage.total > maxMemoryBytes) {
      console.log(`[Cache] Memory limit exceeded (${memUsage.total} bytes), clearing oldest entries`)
      // Clear 20% of cache
      const entriesToClear = Math.floor(this.cache.getStats().size * 0.2)
      for (let i = 0; i < entriesToClear; i++) {
        // This will trigger LRU eviction
        this.cache['evictLRU']()
      }
    }

    // Log stats periodically
    const stats = this.cache.getStats()
    if (stats.hits + stats.misses > 0) {
      console.log(`[Cache] Stats - Size: ${stats.size}/${stats.maxSize}, Hit rate: ${stats.hitRate}%`)
    }
  }
}

// Export convenience function to create cached fetcher
export function createCachedKPIFetcher(
  fetchFunction: (kpiIds: KPIId[]) => Promise<any>,
  organizationId: string
): CachedKPIFetcher {
  return new CachedKPIFetcher(fetchFunction, organizationId)
}