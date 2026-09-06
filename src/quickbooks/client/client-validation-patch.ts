/**
 * QuickBooks Client Validation Integration Patch
 *
 * This file contains the code changes needed to integrate Zod validation
 * into the QuickBooks client.
 *
 * CHANGES NEEDED IN client.ts:
 *
 * 1. Add imports after line 14:
 */

// ADD THESE IMPORTS:
import {
  validateQueryResponse,
  validateCompanyInfoResponse,
  validateReportResponse,
  type ValidationOptions,
} from '../validation'
import type { TokenManager } from '../auth/token-manager'
import type { QBEntityType, QBRawEntity } from '../types/entities'
import type { QueryOptions } from './client'
import { QBAuthError } from '../errors'

// Import circuit breaker config from lib/providers
import type { CircuitBreakerConfig } from '@/lib/providers/circuitBreaker'

/**
 * 2. Update QBClientConfig interface (around line 226):
 */
export interface QBClientConfig {
  organizationId: string
  /** TokenManager instance. If not provided, uses the global singleton. */
  tokenManager?: TokenManager
  realmId?: string
  sandbox?: boolean
  /** Circuit breaker configuration. If not provided, uses defaults. */
  circuitBreaker?: Partial<CircuitBreakerConfig>
  /** Validation options for API responses. If not provided, uses defaults. */
  validation?: ValidationOptions
}

/**
 * 3. Add validation field to QuickBooksClient class (after line 265):
 */

// Constants that are defined in client.ts
const USE_SANDBOX = process.env.QUICKBOOKS_ENVIRONMENT !== 'production'
const USE_PROXY = process.env.QUICKBOOKS_USE_PROXY === 'true'
const PROXY_URL = process.env.QUICKBOOKS_PROXY_URL
const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company'
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'

export class QuickBooksClient {
  private organizationId: string
  private tokenManager: TokenManager | null
  private realmId: string | null
  private sandbox: boolean
  private baseUrl: string
  private validationOptions: ValidationOptions // ADD THIS LINE

  constructor(config: QBClientConfig) {
    this.organizationId = config.organizationId
    this.tokenManager = config.tokenManager ?? null
    this.realmId = config.realmId ?? null
    this.sandbox = config.sandbox ?? USE_SANDBOX
    this.validationOptions = config.validation ?? { fallbackOnError: true } // ADD THIS LINE

    // Determine base URL
    if (USE_PROXY && PROXY_URL) {
      this.baseUrl = PROXY_URL
    } else {
      this.baseUrl = this.sandbox ? QB_SANDBOX_API_BASE : QB_API_BASE
    }
  }

  /**
   * Get a valid token, refreshing if necessary (private method from client.ts)
   */
  private async ensureValidToken(): Promise<{ accessToken: string; realmId?: string }> {
    // This is a placeholder - the actual implementation is in client.ts
    throw new Error('This method should be implemented in the actual QuickBooksClient class')
  }

  /**
   * Handle error responses with retry logic (private method from client.ts)
   */
  private async handleErrorResponse<T>(
    response: Response,
    endpoint: string,
    options: RequestInit,
    retryCount: number
  ): Promise<T> {
    // This is a placeholder - the actual implementation is in client.ts
    throw new Error('This method should be implemented in the actual QuickBooksClient class')
  }

  /**
   * 4. Replace the request method's return statement at line 429:
   */
  // REPLACE THIS:
  // return response.json() as Promise<T>

  // WITH THIS:
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    // ... existing code from client.ts ...
    // This is simplified for the patch - the actual implementation
    // should include all the token management, rate limiting, etc.

    // Mock response for demonstration
    const response = new Response()

    // Handle response
    if (!response.ok) {
      return this.handleErrorResponse(response, endpoint, options, retryCount)
    }

    // Parse JSON response
    const data = await response.json()

    // Apply validation based on endpoint type
    return this.validateResponseData<T>(data, endpoint)
  }

  /**
   * 5. Add new validation helper method to QuickBooksClient class:
   */
  /**
   * Validate response data based on endpoint type
   *
   * @param data - The response data to validate
   * @param endpoint - The API endpoint that was called
   * @returns Validated data
   */
  private validateResponseData<T>(data: unknown, endpoint: string): T {
    try {
      // Detect response type from endpoint and validate accordingly
      if (endpoint.includes('/query')) {
        return validateQueryResponse(data, this.validationOptions) as T
      } else if (endpoint.includes('/companyinfo')) {
        const validated = validateCompanyInfoResponse(data, this.validationOptions)
        return validated.CompanyInfo as T
      } else if (endpoint.includes('/reports/')) {
        return validateReportResponse(data, this.validationOptions) as T
      }

      // For endpoints without specific schemas, return unvalidated data
      // This maintains backward compatibility while adding validation where possible
      return data as T
    } catch (error) {
      // If validation fails and fallbackOnError is false, this will throw
      // Otherwise the validator returns the original data
      throw error
    }
  }

  /**
   * 6. Update query method to use validated response (around line 481):
   */
  async query<T = unknown>(queryString: string): Promise<T> {
    const encodedQuery = encodeURIComponent(queryString)
    // The request method now handles validation automatically
    return this.request<T>(`/query?query=${encodedQuery}`)
  }

  /**
   * 7. Update queryEntities method to use validated response (around line 500):
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
   * 8. Update getReport method (around line 541):
   */
  async getReport<T = unknown>(reportType: string, params?: Record<string, string>): Promise<T> {
    const queryParams = params ? new URLSearchParams(params).toString() : ''
    const endpoint = `/reports/${reportType}${queryParams ? `?${queryParams}` : ''}`
    // The request method now handles validation automatically
    return this.request<T>(endpoint)
  }

  /**
   * 9. Update getCompanyInfo method (around line 550):
   */
  async getCompanyInfo(): Promise<unknown> {
    // Ensure we have a valid realmId before building the endpoint
    if (!this.realmId) {
      const token = await this.ensureValidToken()
      if (token.realmId) {
        this.realmId = token.realmId
      }
    }

    if (!this.realmId) {
      throw new QBAuthError('NOT_CONNECTED', 'No realmId available for company info request')
    }

    // The request method now handles validation and unwrapping automatically
    return this.request<unknown>('/companyinfo/' + this.realmId)
  }

  /**
   * 10. Add method to configure validation at runtime:
   */
  /**
   * Update validation options for this client instance
   *
   * @param options - New validation options
   */
  setValidationOptions(options: ValidationOptions): void {
    this.validationOptions = options
  }

  /**
   * Get current validation options
   */
  getValidationOptions(): Readonly<ValidationOptions> {
    return { ...this.validationOptions }
  }
}
