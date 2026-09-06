// src/lib/providers/dynamics/client.ts
/**
 * Business Central API Client
 * Provides OData v4 API access with auto token refresh, rate limiting, and 401 retry.
 * Mirrors QuickBooksClient pattern.
 */
import { getValidAccessToken } from './oauthClient'
import { getBCConnectionCredentials } from '../database'
import { bcLogger } from './logger'
import { getBCRateLimiter } from './rateLimiter'
import { logger } from '@/lib/logger'

const BC_API_BASE = 'https://api.businesscentral.dynamics.com'

/** Default page size for parallel pagination (BC OData default is ~2000) */
const BC_PAGE_SIZE = 2000

export interface BCApiConfig {
  organizationId: string
  connectionId?: string // envName_companyId
}

export interface ODataParams {
  $filter?: string
  $select?: string
  $orderby?: string
  $top?: number
  $skip?: number
  $expand?: string
  $count?: boolean
}

export interface ODataResponse<T = any> {
  value: T[]
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

export class BusinessCentralClient {
  private organizationId: string
  private connectionId: string | null = null
  private accessToken: string | null = null

  // BC-specific: tenant + environment + company define the API base
  private tenantId: string | null = null
  private environmentName: string | null = null
  private companyId: string | null = null
  private companyName: string | null = null

  // Deduplicates concurrent token fetch calls within this client instance
  private tokenPromise: Promise<string> | null = null

  constructor(config: BCApiConfig) {
    this.organizationId = config.organizationId
    this.connectionId = config.connectionId || null
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary.
   * Deduplicates concurrent calls — when multiple parallel requests
   * call this simultaneously, only the first one hits DynamoDB/lock.
   */
  private async ensureValidToken(forceRefresh: boolean = false): Promise<string> {
    // Fast path: return cached token if available and not force-refreshing
    if (this.accessToken && !forceRefresh) {
      return this.accessToken
    }

    // Deduplicate concurrent token fetches — all parallel callers share one promise
    if (!forceRefresh && this.tokenPromise) {
      return this.tokenPromise
    }

    this.tokenPromise = this._fetchToken(forceRefresh)
    try {
      return await this.tokenPromise
    } finally {
      this.tokenPromise = null
    }
  }

  private async _fetchToken(forceRefresh: boolean): Promise<string> {
    try {
      const result = await getValidAccessToken(
        this.organizationId,
        this.connectionId || undefined,
        forceRefresh
      )
      this.accessToken = result.accessToken

      // Only adopt the resolved connectionId if we didn't have one explicitly set.
      // This prevents a fallback resolution (e.g. activeConnectionId) from overwriting
      // an explicit connectionId, which would cause the wrong tenantId/companyId/environmentName
      // to be loaded — leading to data cross-contamination between companies.
      if (!this.connectionId) {
        this.connectionId = result.connectionId
      }

      // Load connection metadata if not yet loaded, OR if the connectionId changed
      // (force reload to ensure tenantId/companyId/environmentName match this connection)
      const needsMetadataLoad = !this.tenantId || !this.companyId || !this.environmentName
      if (needsMetadataLoad && this.connectionId) {
        const credentials = await getBCConnectionCredentials(this.organizationId, this.connectionId)
        if (credentials) {
          this.tenantId = credentials.tenant_id || null
          this.environmentName = credentials.environment_name || null
          this.companyId = credentials.company_id || null
          this.companyName = credentials.company_name || null
        }
      }

      return this.accessToken
    } catch (error) {
      bcLogger.error('Failed to get valid access token', {
        organizationId: this.organizationId,
        connectionId: this.connectionId || undefined,
      })
      throw error
    }
  }

  /**
   * Pre-fetch and cache the access token so subsequent parallel requests
   * don't all compete for the distributed lock. Call before Promise.allSettled().
   */
  async warmUp(): Promise<void> {
    await this.ensureValidToken()
  }

  /**
   * Build the base URL for BC API calls.
   * Format: https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{envName}/api/v2.0
   */
  private getBaseUrl(): string {
    if (!this.tenantId || !this.environmentName) {
      throw new Error('BC connection not fully configured — missing tenantId or environmentName')
    }
    return `${BC_API_BASE}/v2.0/${this.tenantId}/${this.environmentName}/api/v2.0`
  }

  /**
   * Build the full URL for a company-scoped endpoint.
   * Format: .../companies({companyId})/{endpoint}
   */
  private getCompanyUrl(endpoint: string): string {
    const base = this.getBaseUrl()
    if (!this.companyId) {
      throw new Error('BC connection not fully configured — missing companyId')
    }
    return `${base}/companies(${this.companyId})/${endpoint}`
  }

  /**
   * Build URL for OData Web Services (ODataV4) endpoint.
   * Format: https://api.businesscentral.dynamics.com/v2.0/{tenantId}/{envName}/ODataV4/Company('{companyName}')/{entity}
   *
   * OData Web Services expose the full BC table (all fields including Location_Code, Lot_No)
   * unlike the standard API v2.0 which only exposes a subset of fields.
   */
  private getODataWSUrl(entity: string): string {
    if (!this.tenantId || !this.environmentName) {
      throw new Error('BC connection not fully configured — missing tenantId or environmentName')
    }
    if (!this.companyName) {
      throw new Error('BC connection not fully configured — missing companyName for OData WS')
    }
    const encodedCompany = encodeURIComponent(this.companyName)
    return `${BC_API_BASE}/v2.0/${this.tenantId}/${this.environmentName}/ODataV4/Company('${encodedCompany}')/${entity}`
  }

  /**
   * Query OData Web Service entity with pagination.
   * Same as queryAll but uses the ODataV4 web service URL pattern.
   */
  async queryODataWS<T = any>(entity: string, params?: ODataParams): Promise<T[]> {
    const queryParts: string[] = []
    if (params?.$filter) queryParts.push(`$filter=${encodeURIComponent(params.$filter)}`)
    if (params?.$select) queryParts.push(`$select=${encodeURIComponent(params.$select)}`)
    if (params?.$orderby) queryParts.push(`$orderby=${encodeURIComponent(params.$orderby)}`)
    if (params?.$top !== undefined) queryParts.push(`$top=${params.$top}`)
    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''

    const url = `${this.getODataWSUrl(entity)}${queryString}`
    const allResults: T[] = []
    let nextLink: string | undefined

    const firstResponse = await this.request<ODataResponse<T>>(url)
    allResults.push(...firstResponse.value)
    nextLink = firstResponse['@odata.nextLink']

    while (nextLink) {
      const response = await this.request<ODataResponse<T>>(nextLink)
      allResults.push(...response.value)
      nextLink = response['@odata.nextLink']
    }

    return allResults
  }

  /**
   * Core API request method with auto-refresh, rate limiting, and 401 retry.
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const accessToken = await this.ensureValidToken()

    const url = endpoint.startsWith('http') ? endpoint : this.getCompanyUrl(endpoint)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    const { requestId, startTime } = bcLogger.logApiRequest(options.method || 'GET', url)

    const rateLimiter = getBCRateLimiter(this.organizationId)
    const response = await rateLimiter.request(
      async () => {
        return fetch(url, { ...options, headers })
      },
      { organizationId: this.organizationId, endpoint }
    )

    if (response.status === 401 && retryCount < 1) {
      // Token might be invalid — force refresh and retry once
      bcLogger.warning('401 received, forcing token refresh and retrying', {
        organizationId: this.organizationId,
        connectionId: this.connectionId || undefined,
      })
      this.accessToken = null
      await this.ensureValidToken(true)
      return this.request<T>(endpoint, options, retryCount + 1)
    }

    if (response.status === 429) {
      // Rate limited — the rate limiter should handle retries
      const retryAfter = response.headers.get('Retry-After')
      const err: any = new Error(`BC API rate limited. Retry-After: ${retryAfter || 'unknown'}`)
      err.status = 429
      throw err
    }

    if (!response.ok) {
      const errorBody = await response.text()
      let errorMessage = `BC API error: ${response.status}`
      try {
        const parsed = JSON.parse(errorBody)
        errorMessage = parsed.error?.message || parsed.message || errorMessage
      } catch {}

      bcLogger.logApiResponse(requestId, startTime, response.status, undefined, errorMessage)

      const err: any = new Error(errorMessage)
      err.status = response.status
      throw err
    }

    // Handle 204 No Content
    if (response.status === 204) {
      bcLogger.logApiResponse(requestId, startTime, 204)
      return {} as T
    }

    const data = await response.json()
    bcLogger.logApiResponse(requestId, startTime, response.status)
    return data as T
  }

  /**
   * OData query helper — builds URL with query params.
   */
  async query<T = any>(entity: string, params?: ODataParams): Promise<ODataResponse<T>> {
    const queryParts: string[] = []

    if (params?.$filter) queryParts.push(`$filter=${encodeURIComponent(params.$filter)}`)
    if (params?.$select) queryParts.push(`$select=${encodeURIComponent(params.$select)}`)
    if (params?.$orderby) queryParts.push(`$orderby=${encodeURIComponent(params.$orderby)}`)
    if (params?.$top !== undefined) queryParts.push(`$top=${params.$top}`)
    if (params?.$skip !== undefined) queryParts.push(`$skip=${params.$skip}`)
    if (params?.$expand) queryParts.push(`$expand=${encodeURIComponent(params.$expand)}`)
    if (params?.$count) queryParts.push('$count=true')

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
    const endpoint = `${entity}${queryString}`

    return this.request<ODataResponse<T>>(endpoint)
  }

  /**
   * Pagination helper — fetches all pages of results.
   *
   * Uses a two-phase strategy:
   * 1. First request with $count=true to learn total record count
   * 2. If multiple pages exist, fetch remaining pages in parallel using $skip/$top
   *    instead of following @odata.nextLink sequentially.
   *
   * For a company with 100K GL entries (~50 pages), this turns 50 sequential
   * round-trips (~25s) into ~9 parallel batches (~5s), a ~5x speedup.
   * For small datasets (1 page), behavior is unchanged.
   */
  async queryAll<T = any>(entity: string, params?: ODataParams): Promise<T[]> {
    const startMs = Date.now()

    // Phase 1: First request — ask for total count
    const firstResponse = await this.query<T>(entity, {
      ...params,
      $count: true,
      $top: params?.$top ?? BC_PAGE_SIZE,
    })
    const firstPage = firstResponse.value || []
    const totalCount = firstResponse['@odata.count']
    const hasNextLink = !!firstResponse['@odata.nextLink']

    // If everything fits in one page, return immediately (fast company path)
    if (!hasNextLink && firstPage.length < (params?.$top ?? BC_PAGE_SIZE)) {
      return firstPage
    }

    // Phase 2: Determine remaining pages
    const pageSize = firstPage.length || BC_PAGE_SIZE
    const allResults: T[] = [...firstPage]

    if (totalCount != null && totalCount > pageSize) {
      // We know the total — fetch remaining pages in parallel using $skip/$top
      const remainingPages = Math.ceil((totalCount - pageSize) / pageSize)

      // Batch parallel requests to stay within rate limiter (6 concurrent max)
      const PARALLEL_BATCH = 6
      for (let batch = 0; batch < remainingPages; batch += PARALLEL_BATCH) {
        const batchSize = Math.min(PARALLEL_BATCH, remainingPages - batch)
        const pagePromises: Promise<T[]>[] = []

        for (let i = 0; i < batchSize; i++) {
          const pageIndex = batch + i
          const skip = (pageIndex + 1) * pageSize // +1 because we already have page 0
          pagePromises.push(
            this.query<T>(entity, {
              ...params,
              $skip: skip,
              $top: pageSize,
            }).then((r) => r.value || [])
          )
        }

        const batchResults = await Promise.all(pagePromises)
        for (const pageResults of batchResults) {
          allResults.push(...pageResults)
        }
      }

      logger.info('[BC:queryAll] Parallel pagination complete', {
        entity,
        totalCount,
        pages: remainingPages + 1,
        resultCount: allResults.length,
        durationMs: Date.now() - startMs,
      })
    } else {
      // Fallback: $count not supported or not returned — follow nextLink sequentially
      let nextLink = firstResponse['@odata.nextLink']
      let pageNum = 1
      while (nextLink) {
        const response = await this.request<ODataResponse<T>>(nextLink)
        allResults.push(...(response.value || []))
        nextLink = response['@odata.nextLink']
        pageNum++
      }

      logger.info('[BC:queryAll] Sequential pagination complete', {
        entity,
        pages: pageNum,
        resultCount: allResults.length,
        durationMs: Date.now() - startMs,
      })
    }

    return allResults
  }

  // ─── Entity Methods ─────────────────────────────────────────────────────────

  async getCompanyInfo(): Promise<any> {
    const base = this.getBaseUrl()
    if (!this.companyId) {
      throw new Error('companyId not set')
    }
    const url = `${base}/companies(${this.companyId})`
    return this.request(url)
  }

  async listCustomers(params?: ODataParams): Promise<any[]> {
    return this.queryAll('customers', params)
  }

  async listVendors(params?: ODataParams): Promise<any[]> {
    return this.queryAll('vendors', params)
  }

  async listItems(params?: ODataParams): Promise<any[]> {
    return this.queryAll('items', params)
  }

  async listAccounts(params?: ODataParams): Promise<any[]> {
    return this.queryAll('accounts', params)
  }

  async listSalesInvoices(params?: ODataParams): Promise<any[]> {
    return this.queryAll('salesInvoices', params)
  }

  async listPurchaseInvoices(params?: ODataParams): Promise<any[]> {
    return this.queryAll('purchaseInvoices', params)
  }

  async listGeneralLedgerEntries(params?: ODataParams): Promise<any[]> {
    return this.queryAll('generalLedgerEntries', params)
  }

  async getTrialBalance(params?: ODataParams): Promise<any[]> {
    const result = await this.query('trialBalance', params)
    return result.value
  }

  async getAgedAccountsReceivable(params?: ODataParams): Promise<{
    total: any | null
    records: any[]
  }> {
    const result = await this.query('agedAccountsReceivables', params)
    const all = result.value || []
    // BC includes a summary "Total" row (customerId = all-zeros) with LCY-converted aggregates
    const totalRow =
      all.find((r: any) => r.customerId === '00000000-0000-0000-0000-000000000000') ?? null
    const records = all.filter((r: any) => r.customerId !== '00000000-0000-0000-0000-000000000000')
    return { total: totalRow, records }
  }

  async getAgedAccountsPayable(params?: ODataParams): Promise<{
    total: any | null
    records: any[]
  }> {
    const result = await this.query('agedAccountsPayables', params)
    const all = result.value || []
    // BC includes a summary "Total" row (vendorId = all-zeros) with LCY-converted aggregates
    const totalRow =
      all.find((r: any) => r.vendorId === '00000000-0000-0000-0000-000000000000') ?? null
    const records = all.filter((r: any) => r.vendorId !== '00000000-0000-0000-0000-000000000000')
    return { total: totalRow, records }
  }

  async getBalanceSheet(params?: ODataParams): Promise<any[]> {
    const result = await this.query('balanceSheet', params)
    return result.value
  }

  async getIncomeStatement(params?: ODataParams): Promise<any[]> {
    const result = await this.query('incomeStatement', params)
    return result.value
  }

  async getCashFlowStatement(params?: ODataParams): Promise<any[]> {
    const result = await this.query('cashFlowStatement', params)
    return result.value
  }

  async listBankAccounts(params?: ODataParams): Promise<any[]> {
    return this.queryAll('bankAccounts', params)
  }

  async listDimensions(params?: ODataParams): Promise<any[]> {
    return this.queryAll('dimensions', params)
  }

  async listJournalLines(params?: ODataParams): Promise<any[]> {
    return this.queryAll('journalLines', params)
  }

  async getVendor(vendorId: string, params?: ODataParams): Promise<any | null> {
    const result = await this.query('vendors', {
      ...params,
      $filter: `id eq ${vendorId}`,
    })
    return result.value?.[0] ?? null
  }

  async getCustomer(customerId: string, params?: ODataParams): Promise<any | null> {
    const result = await this.query('customers', {
      ...params,
      $filter: `id eq ${customerId}`,
    })
    return result.value?.[0] ?? null
  }

  async listPurchaseOrders(params?: ODataParams): Promise<any[]> {
    return this.queryAll('purchaseOrders', params)
  }

  async listPurchaseCreditMemos(params?: ODataParams): Promise<any[]> {
    return this.queryAll('purchaseCreditMemos', params)
  }

  async listPurchaseReceipts(params?: ODataParams): Promise<any[]> {
    return this.queryAll('purchaseReceipts', params)
  }

  async listVendorPaymentJournals(params?: ODataParams): Promise<any[]> {
    return this.queryAll('vendorPaymentJournals', params)
  }
}
