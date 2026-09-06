/**
 * QuickBooks Token Manager
 * Handles token storage, refresh, and distributed locking
 */

import { QBToken, QuickBooksOAuth } from './oauth'
import { QBAuthError } from '../errors'

/**
 * Token storage interface - implement this for your storage backend
 */
export interface TokenStore {
  /**
   * Get token for an organization
   */
  getToken(organizationId: string): Promise<QBToken | null>

  /**
   * Store token for an organization
   */
  setToken(organizationId: string, token: QBToken): Promise<void>

  /**
   * Mark an organization as disconnected (e.g., token expired)
   */
  markDisconnected(organizationId: string, error: string): Promise<void>
}

/**
 * Distributed lock interface - implement for multi-instance deployments
 */
export interface DistributedLock {
  /**
   * Acquire a lock with TTL. Returns lock ID if acquired, null if failed.
   */
  acquire(key: string, ttlMs: number): Promise<string | null>

  /**
   * Release a previously acquired lock
   */
  release(key: string, lockId: string): Promise<void>
}

/**
 * Token manager configuration
 */
export interface TokenManagerConfig {
  oauth: QuickBooksOAuth
  store: TokenStore
  lock?: DistributedLock
  refreshBufferSeconds?: number
  lockTimeoutMs?: number
  lockWaitMs?: number
}

// Default refresh buffer: 5 minutes before expiry
const DEFAULT_REFRESH_BUFFER_SECONDS = 5 * 60
// Default lock timeout: 30 seconds
const DEFAULT_LOCK_TIMEOUT_MS = 30000
// Default wait for lock: 2 seconds
const DEFAULT_LOCK_WAIT_MS = 2000

/**
 * Token manager for handling QuickBooks OAuth tokens
 * Supports distributed locking for multi-instance deployments
 */
export class TokenManager {
  private oauth: QuickBooksOAuth
  private store: TokenStore
  private lock?: DistributedLock
  private refreshBufferSeconds: number
  private lockTimeoutMs: number
  private lockWaitMs: number

  constructor(config: TokenManagerConfig) {
    this.oauth = config.oauth
    this.store = config.store
    this.lock = config.lock
    this.refreshBufferSeconds = config.refreshBufferSeconds ?? DEFAULT_REFRESH_BUFFER_SECONDS
    this.lockTimeoutMs = config.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS
    this.lockWaitMs = config.lockWaitMs ?? DEFAULT_LOCK_WAIT_MS
  }

  /**
   * Get a valid token for an organization, refreshing if necessary
   */
  async getValidToken(organizationId: string): Promise<QBToken> {
    const token = await this.store.getToken(organizationId)

    if (!token) {
      throw new QBAuthError('NOT_CONNECTED', 'QuickBooks is not connected for this organization')
    }

    // Check if token needs refresh
    const now = Math.floor(Date.now() / 1000)
    if (now < token.expiresAt - this.refreshBufferSeconds) {
      return token
    }

    // Token needs refresh
    return this.refreshWithLock(organizationId, token)
  }

  /**
   * Refresh token with distributed locking to prevent race conditions
   */
  private async refreshWithLock(organizationId: string, token: QBToken): Promise<QBToken> {
    const lockKey = `qb:refresh:${organizationId}`
    const maxRetries = 3

    // If no distributed lock, refresh directly (local development)
    if (!this.lock) {
      return this.doRefresh(organizationId, token)
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Try to acquire lock
      const lockId = await this.lock.acquire(lockKey, this.lockTimeoutMs)

      if (!lockId) {
        // Another process is refreshing, wait and check if token was refreshed
        await this.sleep(this.lockWaitMs * (attempt + 1))
        const refreshed = await this.store.getToken(organizationId)
        const now = Math.floor(Date.now() / 1000)

        if (refreshed && refreshed.expiresAt > now + this.refreshBufferSeconds) {
          return refreshed
        }

        // Token still not refreshed, retry acquiring lock
        continue
      }

      try {
        // Re-check after acquiring lock (another process may have refreshed)
        const current = await this.store.getToken(organizationId)
        const now = Math.floor(Date.now() / 1000)

        if (current && current.expiresAt > now + this.refreshBufferSeconds) {
          return current
        }

        return await this.doRefresh(organizationId, token)
      } finally {
        await this.lock.release(lockKey, lockId)
      }
    }

    throw new QBAuthError('REFRESH_TIMEOUT', 'Token refresh timed out after multiple retries')
  }

  /**
   * Perform the actual token refresh
   */
  private async doRefresh(organizationId: string, token: QBToken): Promise<QBToken> {
    try {
      const newToken = await this.oauth.refreshToken(token.refreshToken)

      // Preserve realmId if not returned by refresh
      if (!newToken.realmId && token.realmId) {
        newToken.realmId = token.realmId
      }

      await this.store.setToken(organizationId, newToken)
      return newToken
    } catch (error: unknown) {
      // Handle invalid_grant (refresh token expired)
      if (this.isInvalidGrantError(error)) {
        await this.store.markDisconnected(
          organizationId,
          'QuickBooks authentication expired - please reconnect'
        )
        throw new QBAuthError(
          'INVALID_GRANT',
          'QuickBooks authentication expired - please reconnect'
        )
      }

      throw new QBAuthError('REFRESH_FAILED', `Failed to refresh token: ${String(error)}`)
    }
  }

  /**
   * Check if error is an invalid_grant error
   */
  private isInvalidGrantError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, unknown>
      return (
        err.error === 'invalid_grant' ||
        (err.intuit_tid !== undefined && String(err.error).includes('invalid_grant'))
      )
    }
    return false
  }

  /**
   * Force refresh a token (useful after 401 errors)
   */
  async forceRefresh(organizationId: string): Promise<QBToken> {
    const token = await this.store.getToken(organizationId)

    if (!token) {
      throw new QBAuthError('NOT_CONNECTED', 'QuickBooks is not connected for this organization')
    }

    return this.refreshWithLock(organizationId, token)
  }

  /**
   * Store a new token (after OAuth callback)
   */
  async storeToken(organizationId: string, token: QBToken): Promise<void> {
    await this.store.setToken(organizationId, token)
  }

  /**
   * Disconnect an organization (revoke token)
   */
  async disconnect(organizationId: string): Promise<void> {
    const token = await this.store.getToken(organizationId)

    if (token) {
      try {
        await this.oauth.revokeToken(token)
      } catch (error) {
        // Log but don't throw - token may already be invalid
        console.warn(
          '[TokenManager] Failed to revoke token:',
          error instanceof Error ? error.message : error
        )
      }
    }

    await this.store.markDisconnected(organizationId, 'Disconnected by user')
  }

  /**
   * Check if an organization is connected
   */
  async isConnected(organizationId: string): Promise<boolean> {
    const token = await this.store.getToken(organizationId)
    return token !== null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * In-memory token store for development/testing
 * Has built-in size limit to prevent memory leaks
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, { token: QBToken; lastAccessed: number }>()
  private disconnected = new Map<string, string>()
  private static readonly MAX_ENTRIES = 100

  async getToken(organizationId: string): Promise<QBToken | null> {
    if (this.disconnected.has(organizationId)) {
      return null
    }
    const entry = this.tokens.get(organizationId)
    if (entry) {
      entry.lastAccessed = Date.now()
      return entry.token
    }
    return null
  }

  async setToken(organizationId: string, token: QBToken): Promise<void> {
    this.disconnected.delete(organizationId)

    // Evict oldest entry if at capacity
    if (this.tokens.size >= InMemoryTokenStore.MAX_ENTRIES && !this.tokens.has(organizationId)) {
      let oldest: [string, { lastAccessed: number }] | null = null
      for (const entry of this.tokens) {
        if (!oldest || entry[1].lastAccessed < oldest[1].lastAccessed) {
          oldest = entry as [string, { lastAccessed: number }]
        }
      }
      if (oldest) {
        this.tokens.delete(oldest[0])
      }
    }

    this.tokens.set(organizationId, { token, lastAccessed: Date.now() })
  }

  async markDisconnected(organizationId: string, error: string): Promise<void> {
    this.tokens.delete(organizationId)
    this.disconnected.set(organizationId, error)
  }
}

/**
 * In-memory distributed lock for development/testing
 */
export class InMemoryLock implements DistributedLock {
  private locks = new Map<string, { id: string; expiresAt: number }>()

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const now = Date.now()
    const existing = this.locks.get(key)

    if (existing && existing.expiresAt > now) {
      return null // Lock is held
    }

    const lockId = Math.random().toString(36).substring(2)
    this.locks.set(key, { id: lockId, expiresAt: now + ttlMs })
    return lockId
  }

  async release(key: string, lockId: string): Promise<void> {
    const existing = this.locks.get(key)
    if (existing?.id === lockId) {
      this.locks.delete(key)
    }
  }
}
