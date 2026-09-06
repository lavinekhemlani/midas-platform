/**
 * QuickBooks Reports Fetcher
 *
 * Fetches reports from QuickBooks Online API.
 * Uses the TokenManager for authentication.
 */

import type { TokenManager } from '../auth/token-manager'
import type {
  QBReportType,
  QBReportResponse,
  QBReportQueryParams,
  QBProfitAndLossParams,
  QBBalanceSheetParams,
  QBCashFlowParams,
  QBAgedReportParams,
  QBGeneralLedgerParams,
  QBTrialBalanceParams,
  QBTransactionListParams,
} from '../types/reports'
import { QBApiError, QBAuthError, QBRateLimitError } from '../errors'

const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SANDBOX_API_BASE = 'https://sandbox-quickbooks.api.intuit.com/v3/company'

export interface ReportFetcherConfig {
  tokenManager: TokenManager
  sandbox?: boolean
}

export interface FetchReportOptions<T extends QBReportQueryParams = QBReportQueryParams> {
  organizationId: string
  reportType: QBReportType
  params?: T
}

/**
 * Fetches reports from QuickBooks API
 */
export class ReportFetcher {
  private tokenManager: TokenManager
  private baseUrl: string

  constructor(config: ReportFetcherConfig) {
    this.tokenManager = config.tokenManager
    this.baseUrl = config.sandbox ? QB_SANDBOX_API_BASE : QB_API_BASE
  }

  /**
   * Fetch a report from QuickBooks
   */
  async fetchReport<T extends QBReportQueryParams>(
    options: FetchReportOptions<T>
  ): Promise<QBReportResponse> {
    const { organizationId, reportType, params = {} } = options

    // Get valid token
    const token = await this.tokenManager.getValidToken(organizationId)
    if (!token) {
      throw new QBAuthError('NO_TOKEN', 'No valid token available')
    }

    // Build URL with query parameters
    const url = new URL(`${this.baseUrl}/${token.realmId}/reports/${reportType}`)

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })

    // Add minor version for latest API features
    if (!url.searchParams.has('minorversion')) {
      url.searchParams.set('minorversion', '65')
    }

    // Make request
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    // Handle errors
    if (!response.ok) {
      const errorBody = await response.text()
      let errorData: { Fault?: { Error?: Array<{ code?: string; Message?: string }> } } = {}

      try {
        errorData = JSON.parse(errorBody)
      } catch {
        // Non-JSON error response
      }

      const qbError = errorData?.Fault?.Error?.[0]

      if (response.status === 401) {
        throw new QBAuthError('TOKEN_EXPIRED', qbError?.Message || 'Authentication failed')
      }

      if (response.status === 429) {
        throw new QBRateLimitError(60000) // Default retry after 60 seconds
      }

      throw new QBApiError(response.status, {
        Fault: {
          Error: [
            {
              Message: qbError?.Message || `Report fetch failed: ${response.status}`,
              code: qbError?.code,
            },
          ],
        },
      })
    }

    return response.json()
  }

  /**
   * Fetch Profit and Loss report
   */
  async fetchProfitAndLoss(
    organizationId: string,
    params?: QBProfitAndLossParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'ProfitAndLoss',
      params: {
        ...params,
        // Default to this fiscal year if no dates provided
        date_macro:
          params?.date_macro || (params?.start_date ? undefined : 'This Fiscal Year-to-date'),
      },
    })
  }

  /**
   * Fetch Balance Sheet report
   */
  async fetchBalanceSheet(
    organizationId: string,
    params?: QBBalanceSheetParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'BalanceSheet',
      params: {
        ...params,
        // Default to today if no date provided
        date_macro: params?.date_macro || (params?.start_date ? undefined : 'Today'),
      },
    })
  }

  /**
   * Fetch Cash Flow report
   */
  async fetchCashFlow(
    organizationId: string,
    params?: QBCashFlowParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'CashFlow',
      params: {
        ...params,
        date_macro:
          params?.date_macro || (params?.start_date ? undefined : 'This Fiscal Year-to-date'),
      },
    })
  }

  /**
   * Fetch Aged Receivables report
   */
  async fetchAgedReceivables(
    organizationId: string,
    params?: QBAgedReportParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'AgedReceivables',
      params,
    })
  }

  /**
   * Fetch Aged Payables report
   */
  async fetchAgedPayables(
    organizationId: string,
    params?: QBAgedReportParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'AgedPayables',
      params,
    })
  }

  /**
   * Fetch General Ledger report
   */
  async fetchGeneralLedger(
    organizationId: string,
    params?: QBGeneralLedgerParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'GeneralLedger',
      params: {
        ...params,
        date_macro:
          params?.date_macro || (params?.start_date ? undefined : 'This Fiscal Year-to-date'),
      },
    })
  }

  /**
   * Fetch Trial Balance report
   */
  async fetchTrialBalance(
    organizationId: string,
    params?: QBTrialBalanceParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'TrialBalance',
      params,
    })
  }

  /**
   * Fetch Transaction List report
   */
  async fetchTransactionList(
    organizationId: string,
    params?: QBTransactionListParams
  ): Promise<QBReportResponse> {
    return this.fetchReport({
      organizationId,
      reportType: 'TransactionList',
      params: {
        ...params,
        date_macro:
          params?.date_macro || (params?.start_date ? undefined : 'This Fiscal Year-to-date'),
      },
    })
  }
}

/**
 * Create a report fetcher instance
 */
export function createReportFetcher(config: ReportFetcherConfig): ReportFetcher {
  return new ReportFetcher(config)
}
