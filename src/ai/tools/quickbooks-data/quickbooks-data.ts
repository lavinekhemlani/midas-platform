// src/ai/tools/quickbooks-data/quickbooks-data.ts
// Main LangChain tool for intelligent QuickBooks data access

import { tool } from '@langchain/core/tools'
import { quickbooksDataSchema } from './schema'
import { planQuery } from './query-planner'
import {
  handleReportQuery,
  handleAnalysisQuery,
  handleComparisonQuery,
  handleEntityQuery,
  handleMetricQuery,
  handleSearchQuery,
  type HandlerContext,
  type AggregatedResult,
} from './handlers'
import type { ToolContext, QuickBooksDataInput } from './types'
import { QuickBooksClient } from '@/lib/providers/quickbooks/client'
import type { z } from 'zod'
import { logger } from '@/lib/logger'
import { withExtraLongTimeout } from '../utils'

/** Resolve the display symbol for a currency code (e.g. "NGN" → "₦", "USD" → "$") */
function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value || currencyCode
  } catch {
    return currencyCode
  }
}
import { classifyError, type ErrorType } from '@/lib/errors/classifier'

/**
 * Report capabilities for agent context.
 * This helps the agent understand what data each report provides.
 */
const REPORT_CAPABILITIES = {
  profit_loss: {
    description: 'Income statement showing revenue, expenses, and profitability',
    fields: ['revenue', 'cost_of_goods_sold', 'gross_profit', 'operating_expenses', 'net_income'],
    metrics: ['gross_margin', 'net_margin', 'operating_margin'],
    supportsTrends: true,
  },
  balance_sheet: {
    description: 'Financial position showing assets, liabilities, and equity',
    fields: [
      'total_assets',
      'current_assets',
      'fixed_assets',
      'total_liabilities',
      'current_liabilities',
      'equity',
    ],
    metrics: ['current_ratio', 'quick_ratio', 'debt_to_equity'],
    supportsTrends: true,
  },
  cash_flow: {
    description: 'Cash movements from operating, investing, and financing activities',
    fields: [
      'operating_cash_flow',
      'investing_cash_flow',
      'financing_cash_flow',
      'net_cash_change',
    ],
    metrics: ['free_cash_flow', 'cash_flow_margin', 'burn_rate'],
    supportsTrends: true,
  },
  aged_receivables: {
    description: 'Summary of outstanding customer invoices by age bucket',
    fields: ['current', '1_30_days', '31_60_days', '61_90_days', 'over_90_days', 'total'],
    metrics: ['days_sales_outstanding'],
    supportsTrends: false,
  },
  aged_receivables_detail: {
    description: 'Detailed list of individual invoices with dates, due dates, terms, and aging',
    fields: [
      'invoice_date',
      'due_date',
      'days_past_due',
      'amount',
      'balance',
      'terms',
      'doc_number',
    ],
    metrics: ['days_sales_outstanding', 'avg_days_past_due', 'transaction_count'],
    supportsTrends: false,
  },
  aged_payables: {
    description: 'Summary of outstanding vendor bills by age bucket',
    fields: ['current', '1_30_days', '31_60_days', '61_90_days', 'over_90_days', 'total'],
    metrics: ['days_payable_outstanding'],
    supportsTrends: false,
  },
  aged_payables_detail: {
    description: 'Detailed list of individual bills with dates, due dates, terms, and aging',
    fields: ['bill_date', 'due_date', 'days_past_due', 'amount', 'balance', 'terms', 'doc_number'],
    metrics: ['days_payable_outstanding', 'avg_days_past_due', 'transaction_count'],
    supportsTrends: false,
  },
} as const

/**
 * QuickBooks Data Tool
 *
 * Intelligent data access tool that supports multiple query types:
 * - report: Fetch standard financial reports (P&L, Balance Sheet, Cash Flow, etc.)
 * - analyze: Deep dive analysis with AI insights
 * - compare: Period-over-period or budget comparisons
 * - entity: Fetch specific entities (customers, vendors, invoices, etc.)
 * - metric: Calculate single KPIs or metrics
 * - search: Natural language search across QuickBooks data
 *
 * @example
 * // Fetch profit & loss report
 * {
 *   queryType: 'report',
 *   reportType: 'profit_loss',
 *   period: 'last_month'
 * }
 *
 * @example
 * // Get specific metric with history
 * {
 *   queryType: 'metric',
 *   metricName: 'gross_margin',
 *   period: 'this_quarter',
 *   includeHistory: true
 * }
 *
 * @example
 * // Search for customer
 * {
 *   queryType: 'search',
 *   searchText: 'Acme Corp',
 *   searchScope: 'entities'
 * }
 */
async function performQuickbooksQuery(input: QuickBooksDataInput, config: any): Promise<string> {
  const startTime = Date.now()
  const correlationId = config?.configurable?.correlationId || 'unknown'

  // Commented out — styled TOOL box + INPUT in route.ts already shows this
  // logger.info('[Tool:QB] Tool invocation started', {
  //   correlationId,
  //   queryType: input.queryType,
  //   reportType: input.reportType,
  //   period: input.period,
  // })

  try {
    // Extract context from configuration
    const context = config?.configurable as ToolContext | undefined

    // Validate QuickBooks connection
    if (!context?.provider || !context?.apiClient) {
      const duration = Date.now() - startTime
      logger.error('[Tool:QB] Tool invocation failed', {
        correlationId,
        error: 'No QuickBooks connection available',
        queryType: input.queryType,
        duration,
      })
      return JSON.stringify({
        success: false,
        error: 'No QuickBooks connection available. Please connect QuickBooks first.',
        code: 'CONFIG' as ErrorType,
        retryable: false,
        queryType: input.queryType,
      })
    }

    // Validate organization ID
    if (!context.organizationId) {
      const duration = Date.now() - startTime
      logger.error('[Tool:QB] Tool invocation failed', {
        correlationId,
        error: 'Organization ID is required',
        queryType: input.queryType,
        duration,
      })
      return JSON.stringify({
        success: false,
        error: 'Organization ID is required',
        code: 'CONFIG' as ErrorType,
        retryable: false,
        queryType: input.queryType,
      })
    }

    // Step 1: Plan the query
    const plan = planQuery(input)

    if (!plan || plan.operations.length === 0) {
      const duration = Date.now() - startTime
      logger.error('[Tool:QB] Tool invocation failed', {
        correlationId,
        error: 'Unable to create execution plan',
        queryType: input.queryType,
        duration,
      })
      return JSON.stringify({
        success: false,
        error: 'Unable to create execution plan for query',
        code: 'TOOL_VALIDATION' as ErrorType,
        retryable: true,
        hint: 'Try specifying a different queryType or provide more parameters',
        queryType: input.queryType,
      })
    }

    logger.debug('[Tool:QB] Plan created', {
      correlationId,
      planSummary: {
        operationCount: plan.operations.length,
        operationTypes: plan.operations.map((op) => op.type),
        dataSources: plan.dataSources,
      },
    })

    // Step 2: Build handler context
    // realmId from tool input takes priority (agent specified which company),
    // then fall back to context realmId (active entity from withActiveProvider)
    const effectiveRealmId =
      input.realmId ||
      context.realmId ||
      config?.configurable?.realmId ||
      config?.configurable?.activeQbRealmId

    // Verify QB connection is still active before proceeding
    if (effectiveRealmId) {
      try {
        const { getQBConnectionCredentials } = await import('@/lib/providers/database')
        const creds = await getQBConnectionCredentials(context.organizationId, effectiveRealmId)
        if (!creds || (creds as any).connected === false) {
          return JSON.stringify({
            success: false,
            error:
              'QuickBooks connection has been disconnected. Please reconnect from Settings → Integrations.',
            code: 'CONFIG' as ErrorType,
            retryable: false,
            queryType: input.queryType,
          })
        }
      } catch {
        // DB check failed — proceed with existing client (will fail naturally if truly disconnected)
      }
    }

    // If agent requested a different company than the active one, create a new client
    let apiClient = context.apiClient
    const activeRealmId = config?.configurable?.realmId || config?.configurable?.activeQbRealmId
    if (effectiveRealmId && effectiveRealmId !== activeRealmId) {
      try {
        apiClient = new QuickBooksClient({
          organizationId: context.organizationId,
          realmId: effectiveRealmId,
        })
      } catch (err) {
        logger.warn('[Tool:QB] Failed to create client for realmId, using active client', {
          correlationId,
          requestedRealmId: effectiveRealmId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const handlerContext: HandlerContext = {
      organizationId: context.organizationId,
      apiClient,
      currency: context.currency,
      realmId: effectiveRealmId,
    }

    // Helper to extract time params from plan
    const extractTimeParams = (opIndex = 0) => {
      const op = plan.operations[opIndex]
      return {
        startDate: op?.params?.startDate || '',
        endDate: op?.params?.endDate || '',
        period: op?.params?.period,
        summarizeBy: op?.params?.summarizeBy,
      }
    }

    // Helper to check if source is entity
    const ENTITY_SOURCES = ['invoices', 'bills', 'customers', 'vendors', 'payments', 'accounts']
    const isEntitySource = (source: string): boolean => {
      return ENTITY_SOURCES.includes(source.toLowerCase())
    }

    // Step 3: Route to appropriate handler
    let result: AggregatedResult

    switch (plan.queryType) {
      case 'report': {
        result = await handleReportQuery(input, handlerContext, extractTimeParams())
        break
      }

      case 'analyze': {
        const fetchOps = plan.operations.filter((op) => op.type === 'fetch')
        const requiredReports = fetchOps.map((op) => ({
          target: op.target,
          params: {
            startDate: op.params.startDate,
            endDate: op.params.endDate,
            period: op.params.period,
            summarizeBy: op.params.summarizeBy,
          },
        }))
        result = await handleAnalysisQuery(input, handlerContext, requiredReports)
        break
      }

      case 'compare': {
        const fetchOps = plan.operations.filter((op) => op.type === 'fetch')
        if (fetchOps.length < 2) {
          throw new Error('Comparison requires at least 2 periods')
        }
        const reportType = fetchOps[0].target.replace('_current', '').replace('_comparison', '')
        const currentParams = extractTimeParams(0)
        const comparisonParams = {
          startDate: fetchOps[1].params.startDate,
          endDate: fetchOps[1].params.endDate,
          period: fetchOps[1].params.period,
          summarizeBy: fetchOps[1].params.summarizeBy,
        }
        result = await handleComparisonQuery(
          input,
          handlerContext,
          reportType,
          currentParams,
          comparisonParams
        )
        break
      }

      case 'entity': {
        result = await handleEntityQuery(input, handlerContext)
        break
      }

      case 'metric': {
        const fetchOps = plan.operations.filter((op) => op.type === 'fetch')
        const requiredSources = fetchOps.map((op) => ({
          target: op.target,
          isEntity: isEntitySource(op.target),
          params: op.params,
        }))
        result = await handleMetricQuery(input, handlerContext, requiredSources)
        break
      }

      case 'search': {
        result = await handleSearchQuery(input, handlerContext)
        break
      }

      default: {
        result = {
          success: false,
          queryType: plan.queryType,
          data: {},
          summary: {},
          currency: context.currency,
          sources: plan.dataSources,
          generated: new Date().toISOString(),
          error: `Unknown query type: ${plan.queryType}`,
          code: 'TOOL_VALIDATION' as ErrorType,
          retryable: false,
        } as AggregatedResult & { code: ErrorType; retryable: boolean }
      }
    }

    // Step 4: Return chart-ready JSON
    const duration = Date.now() - startTime
    // Commented out — styled TOOL box + OUTPUT in route.ts already shows this
    // logger.info('[Tool:QB] Tool invocation completed', {
    //   correlationId,
    //   duration,
    //   success: result.success !== false,
    //   sourcesUsed: result.sources || [],
    //   operationCount: plan.operations.length,
    // })

    // Add currencySymbol so the agent can use the proper symbol (₦, $, £) in text
    // Include realmId so source attribution badges can resolve the correct company name
    const enrichedResult = {
      ...result,
      currencySymbol: result.currency ? getCurrencySymbol(result.currency) : '$',
      realmId: effectiveRealmId || undefined,
    }

    return JSON.stringify(enrichedResult, null, 2)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorClassification = classifyError(error)
    logger.error('[Tool:QB] Tool invocation failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      errorType: errorClassification.type,
      retryable: errorClassification.retryable,
      queryType: input.queryType,
      duration,
    })
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: errorClassification.type,
      retryable: errorClassification.retryable,
      hint: errorClassification.userMessage,
      queryType: input.queryType,
    })
  }
}

// Wrap with 60s timeout for protection against slow QuickBooks API responses
const performQuickbooksQueryWithTimeout = withExtraLongTimeout(
  performQuickbooksQuery,
  'quickbooks_data'
)

export const quickbooksData = tool(performQuickbooksQueryWithTimeout, {
  name: 'quickbooks_data',
  description: `Intelligent QuickBooks data access tool with advanced query capabilities.

**QUERY TYPES:**

1. **report** - Fetch standard financial reports
   - profit_loss: Revenue/expenses/profitability (fields: revenue, COGS, gross_profit, operating_expenses, net_income; metrics: gross_margin, net_margin, operating_margin; supports trends)
   - balance_sheet: Assets/liabilities/equity (fields: total_assets, current_assets, fixed_assets, total_liabilities, current_liabilities, equity; metrics: current_ratio, quick_ratio, debt_to_equity; supports trends)
   - cash_flow: Cash movements by activity (fields: operating_cash_flow, investing_cash_flow, financing_cash_flow, net_cash_change; metrics: free_cash_flow, cash_flow_margin, burn_rate; supports trends)
   - aged_receivables: AR aging summary by bucket (fields: current, 1_30_days, 31_60_days, 61_90_days, over_90_days, total; metrics: days_sales_outstanding)
   - aged_receivables_detail: Detailed AR with individual invoices (fields: invoice_date, due_date, days_past_due, amount, balance, terms; metrics: avg_days_past_due, transaction_count)
   - aged_payables: AP aging summary by bucket (fields: current, 1_30_days, 31_60_days, 61_90_days, over_90_days, total; metrics: days_payable_outstanding)
   - aged_payables_detail: Detailed AP with individual bills (fields: bill_date, due_date, days_past_due, amount, balance, terms; metrics: avg_days_past_due, transaction_count)
   - financial_health: Composite health score and metrics
   - revenue_trend: Monthly revenue trends (12 months)
   - sales: Sales by customer analysis
   - bills: Accounts payable summary

2. **analyze** - Deep dive analysis with AI insights
   - trends: Identify revenue/expense/cash flow trends
   - anomalies: Detect unusual patterns in financial data
   - breakdown: Category/department level analysis
   - performance: Profitability and efficiency analysis

3. **compare** - Period-over-period comparisons
   - period: Compare current vs previous period
   - budget: Compare actual vs budget
   - forecast: Compare actual vs forecast

4. **entity** - Fetch specific entities with filters
   - customer: Customer list and details
   - vendor: Vendor list and details
   - invoice: Invoice transactions (use filters.customerName or filters.customerId to filter by customer)
   - bill: Bill transactions (use filters.vendorName or filters.vendorId to filter by vendor)
   - account: Chart of accounts
   - item: Products/services

**Entity Filters:**
- status: 'open', 'paid', 'overdue', 'active', 'inactive', 'all'
- minAmount/maxAmount: Filter by transaction amount
- startDate/endDate: Filter by date range (YYYY-MM-DD)
- customerName: Filter invoices by customer name (partial match, case-insensitive)
- customerId: Filter invoices by customer ID
- vendorName: Filter bills by vendor name (partial match, case-insensitive)
- vendorId: Filter bills by vendor ID

**IMPORTANT - Invoice PDF Actions (includePdfActions parameter):**
- Set includePdfActions: true ONLY when user explicitly asks for PDF downloads or viewing invoice documents
- Examples that SHOULD use includePdfActions: true:
  - "download invoice PDFs", "view invoice PDF", "get PDF for invoice #123", "show invoice documents"
- Examples that should NOT use includePdfActions (leave false/omit):
  - "show my invoices", "which customer owes me money", "list unpaid invoices", "what invoices are overdue"
- When includePdfActions is true, response includes [[WIDGET:N]] markers - include them in your response to display PDF buttons

5. **metric** - Calculate single KPIs (33+ metrics available)
   - Profitability: gross_margin, net_margin, operating_margin, roa, roe
   - Liquidity: current_ratio, quick_ratio, cash_balance, working_capital
   - Efficiency: dso, dpo, inventory_turnover, asset_turnover
   - Cash Flow: operating_cash_flow, free_cash_flow, burn_rate, runway_months
   - Growth: revenue_growth, profit_growth, customer_growth

6. **search** - Natural language search
   - Search across customers, vendors, invoices, bills, accounts

**TIME PERIODS:**
- this_month, last_month
- this_quarter, last_quarter
- this_year, last_year
- Custom: startDate/endDate (YYYY-MM-DD)

**IMPORTANT - DEFAULT DATE BEHAVIOR:**
Current date and time: ${new Date().toISOString()} (${new Date().toLocaleString()})
When the user does NOT specify a time period or date range, ALWAYS default to:
- startDate: Start of current year (${new Date().getFullYear()}-01-01)
- endDate: Today's date (${new Date().toISOString().split('T')[0]})
For example, if user asks "show me my finances" or "what's my revenue" without mentioning dates, use the year-to-date range automatically.

**OUTPUT FORMAT:**
Returns chart-ready JSON with:
- data: Main data with name/value pairs for visualization
- summary: Key metrics and totals
- currency: Currency code (USD, etc.)
- sources: Data sources used
- metadata: Additional context (dates, insights, etc.)

**EXAMPLES:**

// Get profit & loss for last month
{
  "queryType": "report",
  "reportType": "profit_loss",
  "period": "last_month"
}

// Calculate gross margin with history
{
  "queryType": "metric",
  "metricName": "gross_margin",
  "period": "this_quarter",
  "includeHistory": true
}

// List open invoices
{
  "queryType": "entity",
  "entityType": "invoice",
  "filters": {
    "status": "open",
    "minAmount": 1000
  }
}

// Get invoices for a specific customer by name
{
  "queryType": "entity",
  "entityType": "invoice",
  "filters": {
    "customerName": "Paulsen Medical",
    "status": "open"
  },
  "includePdfActions": true
}

// Compare Q3 vs Q2 revenue
{
  "queryType": "compare",
  "compareType": "period",
  "metric": "revenue",
  "currentPeriod": "this_quarter",
  "comparisonPeriod": "last_quarter"
}

// Search for customer
{
  "queryType": "search",
  "searchText": "Acme Corp",
  "searchScope": "entities"
}`,
  schema: quickbooksDataSchema as z.ZodType<QuickBooksDataInput>,
})
