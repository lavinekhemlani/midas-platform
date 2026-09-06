// src/lib/providers/apiClient.ts
import {
  getProviderCredentialsFromDB,
  storeProviderCredentialsInDB,
  storeProviderError,
} from './database'
import { ProviderID } from './index'
import { RateLimiter } from '../rateLimiter'
import { apiMonitoring } from './monitoring'
import { withTokenRefreshLock } from './tokenLock'
import { getTokenRefreshCircuitBreaker } from './circuitBreaker'
import { oauthMonitoring, categorizeTokenError } from './oauthMonitoring'
import {
  TOKEN_REFRESH_BUFFER_SECONDS,
  TOKEN_LOCK_MAX_WAIT_MS,
  TOKEN_REFRESH_TIMEOUT_MS,
  NETWORK_ERROR_CODES,
} from './constants'

export interface ProviderApiClientOptions {
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
}

export interface ProviderTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export class ProviderApiClient {
  private organizationId: string
  private providerId: ProviderID
  private baseUrl: string
  private options: Required<ProviderApiClientOptions>
  private requestCache = new Map<string, { data: any; timestamp: number }>()
  private requestQueue = new Map<string, Promise<any>>()
  private readonly CACHE_TTL = 60000 // 1 minute
  private rateLimiter: RateLimiter
  private readonly REPORT_CACHE_TTL = 300000 // 5 minutes for reports

  constructor(
    organizationId: string,
    providerId: ProviderID,
    baseUrl: string,
    options: ProviderApiClientOptions = {}
  ) {
    this.organizationId = organizationId
    this.providerId = providerId
    this.baseUrl = baseUrl
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 3000,
    }
    this.rateLimiter = new RateLimiter()
  }

  private getCacheKey(endpoint: string): string {
    return `${this.organizationId}:${this.providerId}:${endpoint}`
  }

  private async getValidToken(): Promise<string> {
    const credentials = await getProviderCredentialsFromDB(this.organizationId, this.providerId)

    if (!credentials) {
      throw new Error(`No credentials found for ${this.providerId} provider`)
    }

    // Check if token is expired (with buffer from shared constants)
    const now = Math.floor(Date.now() / 1000)
    if (now >= credentials.expires_at - TOKEN_REFRESH_BUFFER_SECONDS) {
      // Token is expired, refresh it with distributed locking to prevent race conditions
      if (!credentials.refresh_token) {
        throw new Error(`No refresh token available for ${this.providerId} provider`)
      }

      console.log(
        `Token expired for ${this.providerId}, initiating refresh with distributed lock...`
      )

      return await withTokenRefreshLock(
        this.organizationId,
        this.providerId,
        async () => {
          // Re-check credentials inside the lock - another process might have already refreshed
          const freshCredentials = await getProviderCredentialsFromDB(
            this.organizationId,
            this.providerId
          )

          if (!freshCredentials) {
            throw new Error(
              `No credentials found for ${this.providerId} provider after acquiring lock`
            )
          }

          // Check if token was refreshed by another process while we were waiting for the lock
          const nowInsideLock = Math.floor(Date.now() / 1000)
          if (nowInsideLock < freshCredentials.expires_at - TOKEN_REFRESH_BUFFER_SECONDS) {
            console.log(`Token was already refreshed by another process for ${this.providerId}`)
            return freshCredentials.access_token
          }

          // Token is still expired, we need to refresh it
          if (!freshCredentials.refresh_token) {
            throw new Error(`No refresh token available for ${this.providerId} provider`)
          }

          const refreshToken = freshCredentials.refresh_token

          // Use circuit breaker for token refresh to prevent cascading failures
          const circuitBreaker = getTokenRefreshCircuitBreaker(this.organizationId, this.providerId)
          const refreshStartTime = Date.now()

          try {
            const result = await circuitBreaker.execute(async () => {
              return await this.performTokenRefresh(refreshToken)
            })

            // Log successful refresh
            oauthMonitoring.logTokenRefresh({
              organizationId: this.organizationId,
              providerId: this.providerId,
              success: true,
              duration: Date.now() - refreshStartTime,
              circuitBreakerState: circuitBreaker.getStatus().state,
            })

            return result
          } catch (error) {
            // Log failed refresh with error categorization
            oauthMonitoring.logTokenRefresh({
              organizationId: this.organizationId,
              providerId: this.providerId,
              success: false,
              duration: Date.now() - refreshStartTime,
              error: error instanceof Error ? error.message : 'Unknown error',
              errorType: categorizeTokenError(error),
              circuitBreakerState: circuitBreaker.getStatus().state,
            })

            throw error
          }
        },
        {
          maxWaitMs: TOKEN_LOCK_MAX_WAIT_MS,
          timeoutMs: TOKEN_REFRESH_TIMEOUT_MS,
        }
      )
    }

    return credentials.access_token
  }

  private async performTokenRefresh(refreshToken: string): Promise<string> {
    if (this.providerId === 'quickbooks') {
      // QuickBooks token refresh - use the official SDK
      try {
        const { refreshAccessToken, tokenToCredentials } = await import('./quickbooks/oauthClient')
        const credentials = await getProviderCredentialsFromDB(this.organizationId, this.providerId)

        console.log(`Refreshing QuickBooks token via SDK for org ${this.organizationId}`)

        // Use the SDK to refresh the token
        const newToken = await refreshAccessToken(refreshToken, this.organizationId)

        // Convert token to credentials format and store
        const newCredentials = {
          ...tokenToCredentials(newToken, credentials?.realm_id),
          connected: true,
          last_synced: Math.floor(Date.now() / 1000),
        }

        await storeProviderCredentialsInDB(
          this.organizationId,
          this.providerId,
          this.getProviderDisplayName(),
          newCredentials
        )

        console.log(
          `QuickBooks token refresh completed successfully via SDK for org ${this.organizationId}`
        )
        return newCredentials.access_token
      } catch (error: any) {
        // Handle invalid_grant error (refresh token expired/revoked)
        if (error.code === 'PROVIDER_INVALID_GRANT' || error.error === 'invalid_grant') {
          console.error(`QuickBooks invalid_grant error for org ${this.organizationId}`)
          await storeProviderError(
            this.organizationId,
            this.providerId,
            'Authentication expired - please reconnect'
          )
          throw error
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown token refresh error'
        await storeProviderError(this.organizationId, this.providerId, errorMessage)
        throw new Error(`Failed to refresh ${this.providerId} tokens: ${errorMessage}`)
      }
    } else if (this.providerId === 'zoho') {
      // Zoho token refresh
      const {
        ZOHO_CLIENT_ID: clientId,
        ZOHO_CLIENT_SECRET: clientSecret,
        ZOHO_DOMAIN: domain,
      } = process.env

      if (!clientId || !clientSecret || !domain) {
        throw new Error('Missing Zoho environment variables for token refresh')
      }

      try {
        const body = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        })

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout)

        const response = await fetch(`https://${domain}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
        }

        const tokenData = await response.json()
        const newCredentials = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
          connected: true,
          last_synced: Math.floor(Date.now() / 1000),
        }

        await storeProviderCredentialsInDB(
          this.organizationId,
          this.providerId,
          this.getProviderDisplayName(),
          newCredentials
        )

        return newCredentials.access_token
      } catch (error) {
        // Check for network errors
        const isNetworkError =
          error instanceof Error &&
          NETWORK_ERROR_CODES.some(
            (code) => (error as any).code === code || error.message.includes(code)
          )

        if (isNetworkError) {
          const networkErrorMessage =
            'Network error during token refresh. Please check your internet connection.'
          console.error(`Network error refreshing ${this.providerId} token:`, error)
          await storeProviderError(this.organizationId, this.providerId, networkErrorMessage)

          const networkError = new Error(networkErrorMessage)
          ;(networkError as any).isNetworkError = true
          ;(networkError as any).originalError = error
          throw networkError
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown token refresh error'
        await storeProviderError(this.organizationId, this.providerId, errorMessage)
        throw new Error(`Failed to refresh ${this.providerId} tokens: ${errorMessage}`)
      }
    } else {
      throw new Error(`Token refresh not implemented for ${this.providerId}`)
    }
  }

  private getProviderDisplayName(): string {
    const displayNames: Record<ProviderID, string> = {
      zoho: 'Zoho Books',
      quickbooks: 'QuickBooks Online',
      xero: 'Xero',
      stripe: 'Stripe',
      dynamics: 'Microsoft Dynamics 365 BC',
      shopify: 'Shopify',
    }
    return displayNames[this.providerId] || this.providerId
  }

  async callApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint)

    // Check if we're already making this exact request
    const existingRequest = this.requestQueue.get(cacheKey)
    if (existingRequest) {
      console.log(`Deduplicating request to: ${endpoint}`)
      return existingRequest
    }

    // Check cache for organization endpoints and reports
    const isReport = endpoint.includes('/reports/')
    const isOrganization = endpoint === '/organizations' || endpoint.startsWith('/organizations/')

    if (isOrganization || isReport) {
      const cached = this.requestCache.get(cacheKey)
      const cacheTTL = isReport ? this.REPORT_CACHE_TTL : this.CACHE_TTL

      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        console.log(`Returning cached data for: ${endpoint}`)
        return cached.data
      }
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(endpoint, options)

    // Store in request queue
    this.requestQueue.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise

      // Cache organization and report data
      const isReport = endpoint.includes('/reports/')
      const isOrganization = endpoint === '/organizations' || endpoint.startsWith('/organizations/')

      if (isOrganization || isReport) {
        this.requestCache.set(cacheKey, { data: result, timestamp: Date.now() })
      }

      return result
    } finally {
      // Remove from request queue
      this.requestQueue.delete(cacheKey)
    }
  }

  private async executeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        // Check rate limit for Zoho provider
        if (this.providerId === 'zoho') {
          const rateLimitResult = await this.rateLimiter.check({
            identifier: `${this.providerId}:${this.organizationId}`,
            limit: 90, // Use 90 instead of 100 to leave buffer
            window: 60, // 60 seconds
          })

          if (!rateLimitResult.success) {
            const waitTime = rateLimitResult.reset - Math.floor(Date.now() / 1000)
            console.log(`Rate limit hit for Zoho. Waiting ${waitTime} seconds...`)

            // Log the rate limit event
            apiMonitoring.logRateLimitHit({
              providerId: this.providerId,
              organizationId: this.organizationId,
              endpoint,
              waitTime,
              recovered: false,
            })

            oauthMonitoring.logRateLimit({
              organizationId: this.organizationId,
              providerId: this.providerId,
              endpoint,
              status: 429,
              retryAfter: waitTime,
              recovered: false,
            })

            // If we have cached data, return it
            const cacheKey = this.getCacheKey(endpoint)
            const cached = this.requestCache.get(cacheKey)
            if (cached) {
              console.log(`Returning stale cached data due to rate limit`)
              apiMonitoring.logRateLimitHit({
                providerId: this.providerId,
                organizationId: this.organizationId,
                endpoint,
                waitTime,
                recovered: true,
              })
              return cached.data
            }

            // Otherwise wait before retrying
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
          }
        }

        const token = await this.getValidToken()

        // Clean and validate endpoint
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`

        // Check for invalid characters or malformed paths
        if (cleanEndpoint.includes('//') || cleanEndpoint.includes(' ')) {
          throw new Error(`Malformed API endpoint: ${cleanEndpoint}`)
        }

        const apiUrl = `${this.baseUrl}${cleanEndpoint}`

        // Validate URL before making request
        try {
          new URL(apiUrl)
        } catch (urlError) {
          throw new Error(`Invalid API URL: ${apiUrl}`)
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout)

        console.log(`Making ${this.providerId} API call to: ${apiUrl}`)

        const response = await fetch(apiUrl, {
          ...options,
          headers: {
            Authorization: this.getAuthHeader(token),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`${this.providerId} API error ${response.status}:`, errorText)

          // Log the API error
          apiMonitoring.logApiError({
            providerId: this.providerId,
            organizationId: this.organizationId,
            endpoint,
            status: response.status,
            error: errorText.substring(0, 200), // Truncate for storage
          })

          if (response.status === 401) {
            await storeProviderError(
              this.organizationId,
              this.providerId,
              `API call unauthorized: ${response.status}`
            )
          } else if (response.status === 404) {
            console.warn(`${this.providerId} API endpoint not found (404): ${apiUrl}`)
            await storeProviderError(
              this.organizationId,
              this.providerId,
              `API endpoint not available: ${cleanEndpoint}`
            )
          } else if (response.status === 429) {
            // Rate limit exceeded - this is retryable
            console.warn(`${this.providerId} rate limit exceeded (429)`)

            // Try to get retry-after header
            const retryAfter = response.headers.get('retry-after')
            const waitTime = retryAfter ? parseInt(retryAfter) : Math.pow(2, attempt) * 2

            // Log the rate limit event
            apiMonitoring.logRateLimitHit({
              providerId: this.providerId,
              organizationId: this.organizationId,
              endpoint,
              waitTime,
              recovered: false,
            })

            // Check if we have cached data to return
            const cacheKey = this.getCacheKey(endpoint)
            const cached = this.requestCache.get(cacheKey)
            if (cached && attempt === this.options.retryAttempts) {
              console.log(`Returning stale cached data after 429 error`)
              apiMonitoring.logRateLimitHit({
                providerId: this.providerId,
                organizationId: this.organizationId,
                endpoint,
                waitTime,
                recovered: true,
              })
              return cached.data
            }

            throw new Error(
              `${this.providerId} rate limit exceeded. Retry after ${waitTime} seconds`
            )
          }

          throw new Error(`${this.providerId} API call failed: ${response.status} - ${errorText}`)
        }

        const data = (await response.json()) as T
        return data
      } catch (error) {
        lastError = error as Error

        // Don't retry on auth errors or client errors (except 429, 502, 503, 504)
        if (
          error instanceof Error &&
          (error.message.includes('401') ||
            error.message.includes('403') ||
            error.message.includes('400')) &&
          !error.message.includes('502') &&
          !error.message.includes('503') &&
          !error.message.includes('504')
        ) {
          throw error
        }

        if (attempt === this.options.retryAttempts) {
          break
        }

        // Special handling for rate limit errors
        if (error instanceof Error && error.message.includes('rate limit exceeded')) {
          // Extract wait time from error message
          const match = error.message.match(/Retry after (\d+) seconds/)
          const waitTime = match ? parseInt(match[1]) : Math.pow(2, attempt) * 2

          console.log(
            `Waiting ${waitTime} seconds before retry (attempt ${attempt}/${this.options.retryAttempts})`
          )
          await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))
        } else {
          // Exponential backoff with jitter: 3s, 6s, 12s (±25%)
          const baseDelay = this.options.retryDelay * Math.pow(2, attempt - 1)
          const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
          const delay = Math.max(1000, baseDelay + jitter)
          console.log(`Retry ${attempt}/${this.options.retryAttempts} after ${Math.round(delay)}ms`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  private getAuthHeader(token: string): string {
    switch (this.providerId) {
      case 'zoho':
        return `Zoho-oauthtoken ${token}`
      case 'quickbooks':
        return `Bearer ${token}`
      case 'xero':
        return `Bearer ${token}`
      case 'stripe':
        return `Bearer ${token}`
      default:
        return `Bearer ${token}`
    }
  }

  /**
   * Clear all cached data for this provider
   * Should be called when provider is disconnected or reconnected
   */
  clearCache(): void {
    console.log(`Clearing cache for ${this.providerId} provider (org: ${this.organizationId})`)
    this.requestCache.clear()
    this.requestQueue.clear()
  }

  /**
   * Clean up expired cache entries (legacy method, prefer clearCache for full cleanup)
   */
  cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL * 2) {
        this.requestCache.delete(key)
      }
    }
  }

  // Helper methods for common HTTP verbs
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.callApi<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.callApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.callApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.callApi<T>(endpoint, { ...options, method: 'DELETE' })
  }

  async query<T = any>(queryString: string): Promise<T> {
    const encodedQuery = encodeURIComponent(queryString)
    return this.callApi<T>(`/query?query=${encodedQuery}`)
  }
}
