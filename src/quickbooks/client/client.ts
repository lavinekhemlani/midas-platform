/**
 * QuickBooks API Client
 *
 * Standalone client for making authenticated requests to QuickBooks Online API.
 * Uses TokenManager for authentication and RateLimiter for throttling.
 *
 * NO DEPENDENCIES on src/lib/providers - this is fully self-contained.
 */

import type { TokenManager } from '../auth/token-manager'
import type { QBToken } from '../auth/oauth'
import type { QBEntityType, QBRawEntity } from '../types/entities'
import { QBApiError, QBAuthError, QBRateLimitError, QBNetworkError } from '../errors'
import { getGlobalRateLimiter } from './rate-limiter'

// Lazy import to avoid circular dependencies
let _getTokenManager: (() => TokenManager) | null = null
async function getDefaultTokenManager(): Promise<TokenManager> {
  if (!_getTokenManager) {
    const mod = await import('../index')
    _getTokenManager = mod.getTokenManager
  }
  return _getTokenManager()
}

// ============================================================================
// Configuration
// ============================================================================

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

// Proxy configuration (optional)
const PROXY_URL = process.env.QUICKBOOKS_PROXY_URL
const USE_PROXY = process.env.QUICKBOOKS_USE_PROXY === 'true'
const USE_SANDBOX = process.env.QUICKBOOKS_ENVIRONMENT !== 'production'
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
const ALLOW_SELF_SIGNED = process.env.QUICKBOOKS_ALLOW_SELF_SIGNED === 'true'

// Request timeout
const REQUEST_TIMEOUT_MS = 30000

// ============================================================================
// Types
// ============================================================================

/**
 * Client configuration
 */
export interface QBClientConfig {
  organizationId: string
  /** TokenManager instance. If not provided, uses the global singleton. */
  tokenManager?: TokenManager
  realmId?: string
  sandbox?: boolean
}

/**
 * Query options for entity queries
 */
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: string
  since?: string // ISO date for incremental sync
  where?: string // Additional WHERE clause
}

// ============================================================================
// QuickBooks Client
// ============================================================================

/**
 * QuickBooks API Client
 *
 * Handles authenticated requests to QuickBooks Online API with:
 * - Automatic token refresh via TokenManager
 * - Rate limiting via global RateLimiter
 * - Retry logic for transient errors
 * - Proxy support for development
 */
export class QuickBooksClient {
  private organizationId: string
  private tokenManager: TokenManager | null
  private realmId: string | null
  private sandbox: boolean
  private baseUrl: string

  constructor(config: QBClientConfig) {
    this.organizationId = config.organizationId
    this.tokenManager = config.tokenManager ?? null
    this.realmId = config.realmId ?? null
    this.sandbox = config.sandbox ?? USE_SANDBOX

    // Determine base URL
    if (USE_PROXY && PROXY_URL) {
      this.baseUrl = PROXY_URL
    } else {
      this.baseUrl = this.sandbox ? QB_SANDBOX_API_BASE : QB_API_BASE
    }
  }

  /**
   * Get the token manager, lazily initializing if needed
   */
  private async getTokenManager(): Promise<TokenManager> {
    if (!this.tokenManager) {
      this.tokenManager = await getDefaultTokenManager()
    }
    return this.tokenManager
  }

  /**
   * Get a valid token, refreshing if necessary
   * This is the core auth method - delegates to TokenManager
   */
  private async ensureValidToken(forceRefresh = false): Promise<QBToken> {
    try {
      const tokenManager = await this.getTokenManager()
      if (forceRefresh) {
        return await tokenManager.forceRefresh(this.organizationId)
      }
      return await tokenManager.getValidToken(this.organizationId)
    } catch (error) {
      if (error instanceof QBAuthError) {
        throw error
      }
      throw new QBAuthError('REFRESH_FAILED', `Failed to get valid token: ${error}`)
    }
  }

  /**
   * Make an authenticated request to QuickBooks API
   *
   * @param endpoint - API endpoint (e.g., '/invoice/123' or '/query?query=...')
   * @param options - Fetch options (method, body, headers)
   * @param retryCount - Internal retry counter
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // Get valid token
    const token = await this.ensureValidToken()

    // Store realmId from token if not set
    if (!this.realmId && token.realmId) {
      this.realmId = token.realmId
    }

    if (!this.realmId) {
      throw new QBAuthError(
        'NOT_CONNECTED',
        'No realmId available - QuickBooks may not be connected'
      )
    }

    // Build URL
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    let url: string

    if (USE_PROXY && PROXY_URL) {
      // Route through proxy with /qb prefix
      url = `${PROXY_URL}/qb/v3/company/${this.realmId}${normalizedEndpoint}`
    } else {
      url = `${this.baseUrl}/${this.realmId}${normalizedEndpoint}`
    }

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.accessToken}`,
      ...(options.headers as Record<string, string>),
    }

    // Add proxy headers if needed
    if (USE_PROXY && PROXY_URL) {
      headers['x-qb-sandbox'] = this.sandbox ? 'true' : 'false'
    }

    // Execute request through rate limiter
    const rateLimiter = getGlobalRateLimiter()

    const executeRequest = async (): Promise<Response> => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        // Use custom fetch for self-signed certificates (proxy in development)
        if ((IS_DEVELOPMENT || ALLOW_SELF_SIGNED) && USE_PROXY) {
          const https = await import('https')
          const nodeFetch = (await import('node-fetch')).default

          const agent = new https.Agent({ rejectUnauthorized: false })

          const fetchOptions: Record<string, unknown> = {
            method: options.method ?? 'GET',
            headers,
            agent,
            signal: controller.signal,
          }

          if (options.body) {
            fetchOptions.body = options.body
          }

          return nodeFetch(url, fetchOptions) as unknown as Response
        }

        // Standard fetch
        return fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new QBNetworkError(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    }

    let response: Response

    try {
      response = await rateLimiter.execute(executeRequest)
    } catch (error: unknown) {
      // Handle network errors
      if (error instanceof Error) {
        if (error.message.includes('DEPTH_ZERO_SELF_SIGNED_CERT')) {
          throw new QBNetworkError(
            'Self-signed certificate error. Set QUICKBOOKS_ALLOW_SELF_SIGNED=true to bypass.',
            error
          )
        }
        throw new QBNetworkError(`Network request failed: ${error.message}`, error)
      }
      throw new QBNetworkError(`Network request failed: ${error}`)
    }

    // Handle response
    if (!response.ok) {
      return this.handleErrorResponse(response, endpoint, options, retryCount)
    }

    return response.json() as Promise<T>
  }

  /**
   * Handle error responses with retry logic
   */
  private async handleErrorResponse<T>(
    response: Response,
    endpoint: string,
    options: RequestInit,
    retryCount: number
  ): Promise<T> {
    const errorText = await response.text()
    let errorData: unknown = {}

    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { message: errorText }
    }

    // Handle 401 Unauthorized - token may be invalid
    if (response.status === 401) {
      if (retryCount === 0) {
        // Force token refresh and retry once
        try {
          await this.ensureValidToken(true)
          return this.request<T>(endpoint, options, retryCount + 1)
        } catch (refreshError) {
          // If refresh fails, propagate the auth error
          throw refreshError
        }
      }
      throw new QBAuthError('TOKEN_EXPIRED', 'Authentication failed after token refresh')
    }

    // Handle 429 Rate Limit
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
      throw new QBRateLimitError(retryMs)
    }

    // Handle other errors
    throw new QBApiError(response.status, errorData)
  }

  /**
   * Execute a QuickBooks Query Language query
   *
   * @param queryString - The query (e.g., "SELECT * FROM Invoice WHERE TxnDate > '2024-01-01'")
   */
  async query<T = unknown>(queryString: string): Promise<T> {
    const encodedQuery = encodeURIComponent(queryString)
    return this.request<T>(`/query?query=${encodedQuery}`)
  }

  /**
   * Generic fetch by entity type and ID
   */
  async get<T extends QBEntityType>(entityType: T, id: string): Promise<QBRawEntity<T>> {
    const endpoint = `/${entityType.toLowerCase()}/${id}`
    const response = await this.request<Record<string, unknown>>(endpoint)
    // QB API returns { EntityType: { ...data } }
    return response[entityType] as QBRawEntity<T>
  }

  /**
   * Generic query by entity type with options
   * Builds a QuickBooks Query Language query from options
   */
  async queryEntities<T extends QBEntityType>(
    entityType: T,
    options?: QueryOptions
  ): Promise<QBRawEntity<T>[]> {
    let queryString = `SELECT * FROM ${entityType}`

    // Build WHERE clause
    const conditions: string[] = []
    if (options?.since) {
      conditions.push(`MetaData.LastUpdatedTime > '${options.since}'`)
    }
    if (options?.where) {
      conditions.push(options.where)
    }
    if (conditions.length > 0) {
      queryString += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add ORDER BY
    if (options?.orderBy) {
      queryString += ` ORDERBY ${options.orderBy}`
    }

    // Add pagination (QB uses 1-based indexing)
    if (options?.offset !== undefined) {
      queryString += ` STARTPOSITION ${options.offset + 1}`
    }
    if (options?.limit !== undefined) {
      queryString += ` MAXRESULTS ${options.limit}`
    }

    const response = await this.query<{ QueryResponse: Record<string, unknown[]> }>(queryString)
    return (response.QueryResponse?.[entityType] ?? []) as QBRawEntity<T>[]
  }

  /**
   * Fetch a report from QuickBooks
   *
   * @param reportType - Report type (e.g., 'ProfitAndLoss', 'BalanceSheet', 'CashFlow')
   * @param params - Report parameters (start_date, end_date, etc.)
   */
  async getReport<T = unknown>(reportType: string, params?: Record<string, string>): Promise<T> {
    const queryParams = params ? new URLSearchParams(params).toString() : ''
    const endpoint = `/reports/${reportType}${queryParams ? `?${queryParams}` : ''}`
    return this.request<T>(endpoint)
  }

  /**
   * Get company info
   */
  async getCompanyInfo(): Promise<unknown> {
    // Ensure we have a valid realmId before building the endpoint
    // The realmId is needed in the URL: /companyinfo/{realmId}
    if (!this.realmId) {
      // Fetch token to get realmId
      const token = await this.ensureValidToken()
      if (token.realmId) {
        this.realmId = token.realmId
      }
    }

    if (!this.realmId) {
      throw new QBAuthError('NOT_CONNECTED', 'No realmId available for company info request')
    }

    const response = await this.request<{ CompanyInfo: unknown }>('/companyinfo/' + this.realmId)
    return response.CompanyInfo
  }

  /**
   * Get the current realmId
   */
  getRealmId(): string | null {
    return this.realmId
  }

  /**
   * Get the organization ID
   */
  getOrganizationId(): string {
    return this.organizationId
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a QuickBooks client instance
 */
export function createClient(config: QBClientConfig): QuickBooksClient {
  return new QuickBooksClient(config)
}
