// src/lib/providers/quickbooks/client.ts
import { getProviderInfoFromDB, storeProviderError } from '../database'
import { getValidAccessToken } from './oauthClient'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { qbLogger } from './logger'
import { qbRateLimiter } from './rateLimiter'

// Proxy configuration - Always use proxy for QuickBooks API calls
const QUICKBOOKS_PROXY_URL = process.env.QUICKBOOKS_PROXY_URL || 'https://52.206.83.137'
const USE_PROXY = process.env.QUICKBOOKS_USE_PROXY === 'true'
const USE_SANDBOX = process.env.QUICKBOOKS_ENVIRONMENT !== 'production'
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development'
const ALLOW_SELF_SIGNED = process.env.QUICKBOOKS_ALLOW_SELF_SIGNED === 'true'

// Legacy direct API URLs (kept for reference but not used when proxy is enabled)
const QUICKBOOKS_API_BASE_URL = USE_PROXY
  ? QUICKBOOKS_PROXY_URL
  : process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

export type QuickBooksPlan = 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown'

export interface QuickBooksApiConfig {
  organizationId: string
  realmId?: string
}

// Feature availability matrix
const PLAN_FEATURES: Record<QuickBooksPlan, string[]> = {
  SimpleStart: ['invoices', 'expenses', 'reports', 'banking'],
  Essentials: ['invoices', 'expenses', 'reports', 'banking', 'bills', 'time'],
  Plus: [
    'invoices',
    'expenses',
    'reports',
    'banking',
    'bills',
    'time',
    'projects',
    'classes',
    'locations',
    'budgets',
  ],
  Advanced: [
    'invoices',
    'expenses',
    'reports',
    'banking',
    'bills',
    'time',
    'projects',
    'classes',
    'locations',
    'budgets',
    'custom_fields',
    'batch_transactions',
  ],
  Unknown: ['invoices', 'expenses', 'reports', 'banking'], // Assume basic features
}

export class QuickBooksClient {
  private organizationId: string
  private realmId: string | null = null
  private accessToken: string | null = null
  private refreshToken: string | null = null
  private expiresAt: number = 0
  private plan: QuickBooksPlan = 'Unknown'
  private planLastChecked: number = 0
  private features: string[] = []

  // Cache for company info to minimize API calls
  private companyInfoCache: { data: any; timestamp: number } | null = null
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours cache

  constructor(config: QuickBooksApiConfig) {
    this.organizationId = config.organizationId
    this.realmId = config.realmId || null
  }

  /**
   * Ensures we have a valid access token, refreshing if necessary
   * Uses the official Intuit OAuth SDK for all token operations
   *
   * @param forceRefresh - If true, forces a token refresh regardless of expiry time.
   *                       Used when receiving 401 errors indicating the token is invalid.
   */
  private async ensureValidToken(forceRefresh: boolean = false): Promise<string> {
    qbLogger.section('Token Validation')

    try {
      if (forceRefresh) {
        qbLogger.warning('Force refresh requested (likely due to 401 error)', {
          organizationId: this.organizationId,
          realmId: this.realmId,
        })
      }

      // Get a valid access token — passes realmId for multi-entity support
      // IMPORTANT: Always use getValidAccessToken which handles distributed locking
      // to prevent race conditions during token refresh. The forceRefresh flag
      // tells it to refresh even if the token appears valid (e.g., after a 401).
      const { accessToken, realmId } = await getValidAccessToken(
        this.organizationId,
        this.realmId || undefined,
        forceRefresh
      )

      this.accessToken = accessToken
      this.realmId = realmId

      qbLogger.logAuthFlow('Token obtained via SDK', {
        hasAccessToken: !!this.accessToken,
        realmId: this.realmId,
        organizationId: this.organizationId,
      })

      return this.accessToken
    } catch (error: any) {
      qbLogger.error(
        'Token validation failed',
        {
          organizationId: this.organizationId,
          realmId: this.realmId,
        },
        error
      )

      if (error.code === 'PROVIDER_INVALID_GRANT' || error.requiresReconnect) {
        throw error
      }

      throw new Error(`Failed to get valid access token: ${error.message}`)
    }
  }

  /**
   * Makes an authenticated request to QuickBooks API with retry logic
   * All requests go through the global rate limiter to prevent rate limit errors
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const token = await this.ensureValidToken()

    // Construct URL based on whether we're using the proxy
    let url: string
    const baseHeaders: HeadersInit = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }

    const headers: HeadersInit = options.headers
      ? { ...baseHeaders, ...options.headers }
      : baseHeaders

    if (USE_PROXY) {
      // Route through proxy with /qb prefix
      // Ensure endpoint starts with / for proper concatenation
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      url = `${QUICKBOOKS_PROXY_URL}/qb/v3/company/${this.realmId}${normalizedEndpoint}`
      // Add header to indicate sandbox vs production environment
      ;(headers as any)['x-qb-sandbox'] = USE_SANDBOX ? 'true' : 'false'

      qbLogger.logProxyDetails(QUICKBOOKS_PROXY_URL, USE_SANDBOX, {
        'x-qb-sandbox': USE_SANDBOX ? 'true' : 'false',
        Authorization: 'Bearer ***',
      })
    } else {
      // Direct API call (legacy mode)
      // Ensure endpoint starts with / for proper concatenation
      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
      url = `${QUICKBOOKS_API_BASE_URL}/${this.realmId}${normalizedEndpoint}`
      qbLogger.warning('Using direct API call (proxy disabled)', {
        environment: process.env.QUICKBOOKS_ENVIRONMENT,
        url: url,
      })
    }

    // Log the API request
    const { requestId, startTime } = qbLogger.logApiRequest(options.method || 'GET', url, {
      headers,
      body: options.body,
    })

    // Log when bypassing certificate validation
    if ((IS_DEVELOPMENT || ALLOW_SELF_SIGNED) && USE_PROXY) {
      qbLogger.warning('Bypassing SSL certificate validation for proxy', {
        proxyUrl: QUICKBOOKS_PROXY_URL,
        reason: IS_DEVELOPMENT ? 'Development mode' : 'QUICKBOOKS_ALLOW_SELF_SIGNED is enabled',
        environment: process.env.NODE_ENV,
      })
    }

    // Request timeout - 30 seconds to prevent hanging requests
    const REQUEST_TIMEOUT_MS = 30000

    // Wrap the actual API call in the global rate limiter
    // This ensures all QuickBooks requests across the application are throttled together
    const executeRequest = async (): Promise<Response> => {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
      }, REQUEST_TIMEOUT_MS)

      try {
        // For self-signed certificates, we need to use a custom fetch implementation
        // This works in both development and production when QUICKBOOKS_ALLOW_SELF_SIGNED=true
        if ((IS_DEVELOPMENT || ALLOW_SELF_SIGNED) && USE_PROXY) {
          // Create a custom fetch that allows self-signed certificates
          const https = await import('https')
          const nodeFetch = (await import('node-fetch')).default

          const agent = new https.Agent({
            rejectUnauthorized: false,
          })

          const fetchOptions: any = {
            ...options,
            headers: headers as any,
            agent,
            signal: controller.signal,
          }

          // Remove body if it's null or undefined
          if (fetchOptions.body === null || fetchOptions.body === undefined) {
            delete fetchOptions.body
          }

          return nodeFetch(url, fetchOptions) as any
        } else {
          // Use regular fetch when certificate validation is required
          return fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
          })
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw new Error(
            `QuickBooks API request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`
          )
        }
        throw error
      } finally {
        clearTimeout(timeoutId)
      }
    }

    let response: Response

    try {
      // Execute the request through the global rate limiter
      response = await qbRateLimiter.request(executeRequest, {
        organizationId: this.organizationId,
        endpoint,
      })
    } catch (error: any) {
      qbLogger.error('Fetch failed', { url, error: error.message }, error)

      // If it's a certificate error, provide helpful message
      if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
        qbLogger.error('Self-signed certificate error', {
          solution:
            'Set QUICKBOOKS_ALLOW_SELF_SIGNED=true in your environment variables to bypass certificate validation',
          proxyUrl: QUICKBOOKS_PROXY_URL,
          currentEnvironment: process.env.NODE_ENV,
        })
        throw new Error(
          'Self-signed certificate error. Set QUICKBOOKS_ALLOW_SELF_SIGNED=true in your environment to bypass.'
        )
      }
      throw error
    }

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: any = {}

      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      qbLogger.logApiResponse(requestId, startTime, response.status, undefined, errorData)
      qbLogger.error(
        'QuickBooks API error',
        {
          organizationId: this.organizationId,
          realmId: this.realmId || undefined,
          status: response.status,
          endpoint,
        },
        errorData
      )

      // Handle 401 Unauthorized - token is invalid regardless of expiry timestamp
      if (response.status === 401) {
        // Only retry once to avoid infinite loops
        if (retryCount === 0) {
          qbLogger.warning('Got 401, forcing token refresh and retrying...', {
            organizationId: this.organizationId,
            endpoint,
          })

          try {
            // Force token refresh even if DB says token is not expired
            // A 401 means the token is definitely invalid
            await this.ensureValidToken(true)

            // Retry the request with new token
            return this.request<T>(endpoint, options, retryCount + 1)
          } catch (refreshError) {
            // If refresh fails with invalid_grant, ensureValidToken() already handled disconnection
            // Just re-throw the error so it propagates correctly
            throw refreshError
          }
        }

        // Create error with proper code for frontend handling
        const authError: any = new Error('QuickBooks authentication failed after retry')
        authError.code = 'PROVIDER_INVALID_GRANT'
        authError.requiresReconnect = true
        authError.provider = 'quickbooks'
        throw authError
      }

      // Handle other error types
      if (response.status === 403) {
        throw new Error(
          `QuickBooks API permission denied: ${errorData.message || response.statusText}`
        )
      }

      if (response.status === 429) {
        // Rate limit errors are now handled by the rate limiter with retries
        // If we still get here, it means retries were exhausted
        const rateLimitError: any = new Error(
          'QuickBooks API rate limit exceeded - please try again later'
        )
        rateLimitError.code = 'RATE_LIMIT_EXCEEDED'
        throw rateLimitError
      }

      throw new Error(`QuickBooks API error: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    qbLogger.logApiResponse(requestId, startTime, response.status, data)

    return data
  }

  /**
   * Makes a query request to QuickBooks API
   */
  async query<T = any>(query: string): Promise<T> {
    const encodedQuery = encodeURIComponent(query)
    return this.request<T>(`/query?query=${encodedQuery}`)
  }

  /**
   * Get company info with logging for token usage tracking
   */
  async getCompanyInfo() {
    const startTime = Date.now()
    // console.log('[QuickBooks] Fetching company info...');

    try {
      const result = await this.request('/companyinfo/1')
      const duration = Date.now() - startTime

      // console.log('[QuickBooks] Company info request completed:', {
      //   duration: `${duration}ms`,
      //   environment: USE_SANDBOX ? 'sandbox' : 'production',
      //   proxy: USE_PROXY,
      //   proxyUrl: USE_PROXY ? QUICKBOOKS_PROXY_URL : 'direct',
      //   companyName: result.CompanyInfo?.CompanyName || 'Unknown',
      //   cached: false
      // });

      return result.CompanyInfo || result
    } catch (error) {
      console.error('[QuickBooks] Failed to fetch company info:', error)
      throw error
    }
  }

  /**
   * Get company info with caching to minimize API calls
   */
  async getCompanyInfoCached() {
    // Check if we have valid cached data
    if (this.companyInfoCache && Date.now() - this.companyInfoCache.timestamp < this.CACHE_TTL) {
      // console.log('[QuickBooks] Returning cached company info', {
      //   cachedAt: new Date(this.companyInfoCache.timestamp).toISOString(),
      //   ageMinutes: Math.round((Date.now() - this.companyInfoCache.timestamp) / 60000)
      // });
      return this.companyInfoCache.data
    }

    // Fetch fresh data and cache it
    // console.log('[QuickBooks] Cache miss or expired, fetching fresh company info...');
    const data = await this.getCompanyInfo()

    // Store in cache
    this.companyInfoCache = {
      data,
      timestamp: Date.now(),
    }

    // console.log('[QuickBooks] Company info cached for 24 hours');
    return data
  }

  /**
   * List all invoices
   */
  async listInvoices(params?: { startPosition?: number; maxResults?: number; orderBy?: string }) {
    let query = 'SELECT * FROM Invoice'

    if (params?.orderBy) {
      query += ` ORDERBY ${params.orderBy}`
    }

    if (params?.startPosition !== undefined) {
      query += ` STARTPOSITION ${params.startPosition}`
    }

    if (params?.maxResults !== undefined) {
      query += ` MAXRESULTS ${params.maxResults}`
    }

    const result = await this.query<{ QueryResponse: { Invoice: any[] } }>(query)
    return result.QueryResponse?.Invoice || []
  }

  /**
   * Get a single invoice
   */
  async getInvoice(id: string) {
    return this.request(`/invoice/${id}`)
  }

  /**
   * List all bills (vendor expenses)
   */
  async listBills(params?: { startPosition?: number; maxResults?: number; orderBy?: string }) {
    let query = 'SELECT * FROM Bill'

    if (params?.orderBy) {
      query += ` ORDERBY ${params.orderBy}`
    }

    if (params?.startPosition !== undefined) {
      query += ` STARTPOSITION ${params.startPosition}`
    }

    if (params?.maxResults !== undefined) {
      query += ` MAXRESULTS ${params.maxResults}`
    }

    const result = await this.query<{ QueryResponse: { Bill: any[] } }>(query)
    return result.QueryResponse?.Bill || []
  }

  /**
   * List all purchases (expenses)
   */
  async listPurchases(params?: { startPosition?: number; maxResults?: number; orderBy?: string }) {
    let query = 'SELECT * FROM Purchase'

    if (params?.orderBy) {
      query += ` ORDERBY ${params.orderBy}`
    }

    if (params?.startPosition !== undefined) {
      query += ` STARTPOSITION ${params.startPosition}`
    }

    if (params?.maxResults !== undefined) {
      query += ` MAXRESULTS ${params.maxResults}`
    }

    const result = await this.query<{ QueryResponse: { Purchase: any[] } }>(query)
    return result.QueryResponse?.Purchase || []
  }

  /**
   * List all accounts (including bank accounts)
   */
  async listAccounts(params?: {
    accountType?: string
    startPosition?: number
    maxResults?: number
  }) {
    let query = 'SELECT * FROM Account'

    if (params?.accountType) {
      query += ` WHERE AccountType = '${params.accountType}'`
    }

    if (params?.startPosition !== undefined) {
      query += ` STARTPOSITION ${params.startPosition}`
    }

    if (params?.maxResults !== undefined) {
      query += ` MAXRESULTS ${params.maxResults}`
    }

    const result = await this.query<{ QueryResponse: { Account: any[] } }>(query)
    return result.QueryResponse?.Account || []
  }

  /**
   * List all customers
   */
  async listCustomers(params?: { startPosition?: number; maxResults?: number; orderBy?: string }) {
    let query = 'SELECT * FROM Customer'

    if (params?.orderBy) {
      query += ` ORDERBY ${params.orderBy}`
    }

    if (params?.startPosition !== undefined) {
      query += ` STARTPOSITION ${params.startPosition}`
    }

    if (params?.maxResults !== undefined) {
      query += ` MAXRESULTS ${params.maxResults}`
    }

    const result = await this.query<{ QueryResponse: { Customer: any[] } }>(query)
    return result.QueryResponse?.Customer || []
  }

  /**
   * Get a report (e.g., Profit and Loss, Balance Sheet)
   */
  async getReport(reportType: string, params?: Record<string, string>) {
    const queryParams = new URLSearchParams(params).toString()
    const endpoint = `/reports/${reportType}${queryParams ? `?${queryParams}` : ''}`
    console.log(
      `[QuickBooksClient] getReport ${reportType} - endpoint: ${endpoint}, params:`,
      params
    )
    return this.request(endpoint)
  }

  /**
   * Get Profit and Loss report
   */
  async getProfitAndLoss(params?: {
    start_date?: string
    end_date?: string
    accounting_method?: 'Cash' | 'Accrual'
    summarize_column_by?: string
  }) {
    return this.getReport('ProfitAndLoss', params)
  }

  /**
   * Get Balance Sheet report
   */
  async getBalanceSheet(params?: {
    start_date?: string
    end_date?: string
    accounting_method?: 'Cash' | 'Accrual'
    summarize_column_by?: string
  }) {
    return this.getReport('BalanceSheet', params)
  }

  /**
   * Get Cash Flow report
   */
  async getCashFlow(params?: {
    start_date?: string
    end_date?: string
    summarize_column_by?: string
  }) {
    return this.getReport('CashFlow', params)
  }

  /**
   * Create an invoice
   */
  async createInvoice(invoice: any) {
    return this.request('/invoice', {
      method: 'POST',
      body: JSON.stringify(invoice),
    })
  }

  /**
   * Update an invoice
   */
  async updateInvoice(id: string, invoice: any) {
    return this.request(`/invoice`, {
      method: 'POST',
      body: JSON.stringify(invoice),
    })
  }

  /**
   * Delete an invoice
   */
  async deleteInvoice(id: string, syncToken: string) {
    return this.request(`/invoice?operation=delete`, {
      method: 'POST',
      body: JSON.stringify({
        Id: id,
        SyncToken: syncToken,
      }),
    })
  }

  /**
   * Get current plan
   */
  async getPlan(): Promise<QuickBooksPlan> {
    // Check if we need to refresh plan info (24 hour cache)
    const now = Math.floor(Date.now() / 1000)
    if (this.plan && this.plan !== 'Unknown' && this.planLastChecked > now - 86400) {
      return this.plan
    }

    // Get plan from database first
    const providerInfo = await getProviderInfoFromDB(this.organizationId, 'quickbooks')
    if (
      providerInfo?.plan &&
      providerInfo.planLastChecked &&
      providerInfo.planLastChecked > now - 86400
    ) {
      this.plan = providerInfo.plan
      this.planLastChecked = providerInfo.planLastChecked
      this.features = providerInfo.features || []
      return this.plan
    }

    // Detect plan by trying different endpoints
    await this.detectPlan()
    return this.plan
  }

  /**
   * Detect QuickBooks plan by testing API endpoints
   */
  private async detectPlan(): Promise<void> {
    try {
      // Try Advanced features first
      const customFields = await this.checkCustomFields()
      if (customFields) {
        await this.updatePlanInDB('Advanced')
        return
      }

      // Try Plus features (projects/classes)
      const hasProjects = await this.checkProjects()
      if (hasProjects) {
        await this.updatePlanInDB('Plus')
        return
      }

      // Try Essentials features (bills)
      const hasBills = await this.checkBills()
      if (hasBills) {
        await this.updatePlanInDB('Essentials')
        return
      }

      // Default to SimpleStart
      await this.updatePlanInDB('SimpleStart')
    } catch (error) {
      console.error('Error detecting QuickBooks plan:', error)
      this.plan = 'Unknown'
    }
  }

  /**
   * Check if custom fields are available (Advanced only)
   */
  private async checkCustomFields(): Promise<boolean> {
    try {
      const response = await this.request('/preferences')
      const customFields = response.Preferences?.SalesFormsPrefs?.CustomField || []
      return customFields.length > 2
    } catch {
      return false
    }
  }

  /**
   * Check if projects are available (Plus and Advanced)
   */
  private async checkProjects(): Promise<boolean> {
    try {
      const result = await this.query<{ QueryResponse: { Customer: any[] } }>(
        'SELECT * FROM Customer WHERE Job=true MAXRESULTS 1'
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if bills are available (Essentials, Plus, and Advanced)
   */
  private async checkBills(): Promise<boolean> {
    try {
      const result = await this.query<{ QueryResponse: { Bill: any[] } }>(
        'SELECT * FROM Bill MAXRESULTS 1'
      )
      return true
    } catch {
      return false
    }
  }

  /**
   * Update plan in database
   */
  private async updatePlanInDB(plan: QuickBooksPlan): Promise<void> {
    this.plan = plan
    this.planLastChecked = Math.floor(Date.now() / 1000)
    this.features = PLAN_FEATURES[plan]

    if (!ORGANIZATIONS_TABLE_NAME) return

    try {
      // Multi-entity: write to connections[realmId].plan if realmId available
      if (this.realmId) {
        await ddbDocClient.send(
          new UpdateCommand({
            TableName: ORGANIZATIONS_TABLE_NAME,
            Key: { PK: this.organizationId, SK: 'PROFILE' },
            UpdateExpression:
              'SET providers.quickbooks.#connections.#realmId.#plan = :plan, providers.quickbooks.#connections.#realmId.#planLastChecked = :planLastChecked, providers.quickbooks.#connections.#realmId.#features = :features',
            ExpressionAttributeNames: {
              '#connections': 'connections',
              '#realmId': this.realmId,
              '#plan': 'plan',
              '#planLastChecked': 'planLastChecked',
              '#features': 'features',
            },
            ExpressionAttributeValues: {
              ':plan': plan,
              ':planLastChecked': this.planLastChecked,
              ':features': this.features,
            },
            ConditionExpression: 'attribute_exists(providers.quickbooks.#connections.#realmId)',
          })
        )
      } else {
        // Legacy fallback
        await ddbDocClient.send(
          new UpdateCommand({
            TableName: ORGANIZATIONS_TABLE_NAME,
            Key: { PK: this.organizationId, SK: 'PROFILE' },
            UpdateExpression:
              'SET providers.quickbooks.#plan = :plan, providers.quickbooks.#planLastChecked = :planLastChecked, providers.quickbooks.#features = :features',
            ExpressionAttributeNames: {
              '#plan': 'plan',
              '#planLastChecked': 'planLastChecked',
              '#features': 'features',
            },
            ExpressionAttributeValues: {
              ':plan': plan,
              ':planLastChecked': this.planLastChecked,
              ':features': this.features,
            },
          })
        )
      }
    } catch (error) {
      console.error('Failed to update plan in database:', error)
    }
  }

  /**
   * Check if a feature is available for the current plan
   */
  async isFeatureAvailable(feature: string): Promise<boolean> {
    const plan = await this.getPlan()
    return PLAN_FEATURES[plan].includes(feature)
  }

  /**
   * Test proxy connection health
   */
  static async testProxyConnection(): Promise<{ healthy: boolean; details: any }> {
    if (!USE_PROXY) {
      return {
        healthy: false,
        details: { message: 'Proxy is not enabled. Set QUICKBOOKS_USE_PROXY=true to enable.' },
      }
    }

    try {
      const healthUrl = `${QUICKBOOKS_PROXY_URL}/health`
      // console.log('Testing proxy health at:', healthUrl);

      let response: Response

      try {
        if (IS_DEVELOPMENT || ALLOW_SELF_SIGNED) {
          // Use node-fetch with custom agent for self-signed certificates
          const https = await import('https')
          const nodeFetch = (await import('node-fetch')).default

          const agent = new https.Agent({
            rejectUnauthorized: false,
          })

          // console.log('Bypassing SSL certificate validation for proxy health check');

          response = (await nodeFetch(healthUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            agent,
          })) as any
        } else {
          response = await fetch(healthUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          })
        }
      } catch (error: any) {
        if (error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          console.error(
            'Self-signed certificate error. Set QUICKBOOKS_ALLOW_SELF_SIGNED=true in your environment to bypass.'
          )
        }
        throw error
      }

      if (!response.ok) {
        return {
          healthy: false,
          details: {
            status: response.status,
            statusText: response.statusText,
            message: 'Proxy health check failed',
          },
        }
      }

      const data = await response.json()
      return {
        healthy: data.status === 'healthy',
        details: {
          ...data,
          proxyUrl: QUICKBOOKS_PROXY_URL,
          usingSandbox: USE_SANDBOX,
          environment: process.env.QUICKBOOKS_ENVIRONMENT,
        },
      }
    } catch (error: any) {
      return {
        healthy: false,
        details: {
          error: error.message,
          message: 'Failed to connect to proxy',
          proxyUrl: QUICKBOOKS_PROXY_URL,
        },
      }
    }
  }

  /**
   * Makes a request with soft-fail for plan limitations
   */
  async requestWithSoftFail<T = any>(
    endpoint: string,
    options: RequestInit = {},
    feature?: string
  ): Promise<T | null> {
    try {
      // Check feature availability first
      if (feature && !(await this.isFeatureAvailable(feature))) {
        console.warn(`Feature "${feature}" not available in ${this.plan} plan`)
        return null
      }

      return await this.request<T>(endpoint, options)
    } catch (error: any) {
      // If it's a 403, might be a plan limitation
      if (error.message?.includes('403') || error.status === 403) {
        const plan = await this.getPlan()
        console.warn(`Feature might require a higher plan than ${plan}`)

        // Re-detect plan in case it changed
        await this.detectPlan()
      }

      // Return null instead of throwing
      console.error('QuickBooks API soft-fail:', error)
      return null
    }
  }

  /**
   * Makes a request to QuickBooks API - wrapper for compatibility
   * Used by test endpoints and other modules
   */
  async makeRequest<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    options?: { headers?: Record<string, string>; responseType?: 'json' | 'arraybuffer' }
  ): Promise<T> {
    // For PDF requests, we need to handle binary responses differently
    if (options?.responseType === 'arraybuffer') {
      return this.requestBinary(endpoint, {
        method,
        headers: options.headers || {},
        body: body ? JSON.stringify(body) : undefined,
      }) as any
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    }

    return this.request<T>(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Makes a request for binary data (e.g., PDF)
   */
  private async requestBinary(endpoint: string, options: RequestInit = {}): Promise<ArrayBuffer> {
    const token = await this.ensureValidToken()

    // For PDF requests, bypass proxy and go directly to QuickBooks
    // The proxy doesn't handle binary responses properly
    const DIRECT_API_URL = USE_SANDBOX
      ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
      : 'https://quickbooks.api.intuit.com/v3/company'

    // Use wildcard Accept header for PDF requests
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    }

    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${DIRECT_API_URL}/${this.realmId}${normalizedEndpoint}`

    qbLogger.info('Fetching PDF from QuickBooks (direct, bypassing proxy)', {
      url,
      headers: { ...headers, Authorization: 'Bearer ***' },
    })

    let response: Response

    try {
      // Use standard fetch for direct QuickBooks API calls (no proxy, no custom SSL)
      response = await fetch(url, {
        method: options.method || 'GET',
        headers,
      })
    } catch (error: any) {
      qbLogger.error('Fetch failed', { url, error: error.message }, error)
      throw error
    }

    if (!response.ok) {
      const errorText = await response.text()
      qbLogger.error('PDF request failed', {
        url,
        status: response.status,
        error: errorText,
      })
      throw new Error(`QuickBooks API error: ${errorText || response.statusText}`)
    }

    return await response.arrayBuffer()
  }

  /**
   * Execute multiple operations in a single batch request
   * QuickBooks batch API allows up to 30 operations per request
   * Each batch request counts as 1 against the 500/min rate limit
   */
  async batch(items: BatchItem[]): Promise<BatchResponse> {
    if (items.length === 0) {
      return { BatchItemResponse: [] }
    }

    if (items.length > 30) {
      throw new Error('QuickBooks batch limited to 30 operations per request')
    }

    qbLogger.info('Executing batch request', {
      organizationId: this.organizationId,
      itemCount: items.length,
      operations: items.map((item) => ({
        bId: item.bId,
        type: item.Query ? 'query' : item.operation,
      })),
    })

    const response = await this.request<BatchResponse>('/batch', {
      method: 'POST',
      body: JSON.stringify({ BatchItemRequest: items }),
    })

    // Log any failures within the batch
    const failures = response.BatchItemResponse?.filter((item) => item.Fault) || []
    if (failures.length > 0) {
      qbLogger.warning('Batch request had partial failures', {
        organizationId: this.organizationId,
        totalItems: items.length,
        failedItems: failures.length,
        failures: failures.map((f) => ({
          bId: f.bId,
          error: f.Fault?.Error?.[0]?.Message,
          code: f.Fault?.Error?.[0]?.code,
        })),
      })
    }

    return response
  }
}

/**
 * Batch operation item for QuickBooks batch API
 */
export interface BatchItem {
  bId: string
  operation?: 'create' | 'update' | 'delete'
  Query?: string
  [entity: string]: any
}

/**
 * Response from QuickBooks batch API
 */
export interface BatchResponse {
  BatchItemResponse: BatchItemResult[]
  time?: string
}

/**
 * Individual result from a batch operation
 */
export interface BatchItemResult {
  bId: string
  QueryResponse?: any
  Fault?: {
    Error: Array<{
      Message: string
      Detail?: string
      code: string
      element?: string
    }>
    type?: string
  }
  [entity: string]: any
}
