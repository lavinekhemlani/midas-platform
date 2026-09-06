// src/ai/tools/quickbooks-data/handlers.ts
// Simple, direct query handlers - no abstraction layers

import { fetchEnrichedReport } from './report-accessor'
import type { ReportParams } from './report-accessor'
import { listEntities, getEntity, searchEntities, normalizeEntityType } from './entity-accessor'
import { getMetricById, formatMetricValue, type MetricFormat } from './metrics-registry'
import type { QuickBooksDataInput, ToolContext } from './types'
import type { InvoiceActionsWidget } from '@/ai/widgets/types'
import { logger } from '@/lib/logger'
import { toTwoDecimals } from '@/lib/utils/financial/reportCalculations'

/**
 * Round value based on metric format to ensure consistency between
 * raw values and formatted display values.
 */
function roundByFormat(value: number, format: MetricFormat): number {
  switch (format) {
    case 'percent':
      // Match formatMetricValue which uses .toFixed(1) for percent
      return Math.round(value * 10) / 10
    case 'ratio':
      // Match formatMetricValue which uses .toFixed(2) for ratio
      return Math.round(value * 100) / 100
    case 'days':
      return Math.round(value)
    default:
      return toTwoDecimals(value)
  }
}

// =============================================================================
// Handler Context Interface
// =============================================================================

export interface HandlerContext {
  organizationId: string
  apiClient: any
  currency: string
  realmId?: string
}

// =============================================================================
// Result Interface
// =============================================================================

export interface AggregatedResult {
  success: boolean
  queryType: string
  data: any
  summary: Record<string, any>
  currency: string
  sources: string[]
  metadata?: Record<string, any>
  error?: string
  generated: string
  /** Invoice widgets for PDF actions (only for invoice entity queries) */
  widgets?: InvoiceActionsWidget[]
  /** Widget markers string e.g. "[[WIDGET:1]] [[WIDGET:2]]" */
  markers?: string
  /** Instruction for LLM to include widget markers in response */
  instruction?: string
}

// =============================================================================
// Handler: Report Query
// =============================================================================

export async function handleReportQuery(
  input: QuickBooksDataInput,
  context: HandlerContext,
  params: {
    startDate: string
    endDate: string
    period?: string
    summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
  }
): Promise<AggregatedResult> {
  const startTime = Date.now()
  const reportType = input.reportType!

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Report query started', {
  //   reportType,
  //   organizationId: context.organizationId,
  // })

  const reportParams: ReportParams = {
    startDate: params.startDate,
    endDate: params.endDate,
    period: params.period,
    summarizeBy: params.summarizeBy,
  }

  const reportResult = await fetchEnrichedReport(reportType, reportParams, {
    organizationId: context.organizationId,
    client: context.apiClient,
    currency: context.currency,
  })

  if (!reportResult.success) {
    throw new Error(reportResult.error || 'Failed to fetch report')
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Report query completed', {
  //   duration: Date.now() - startTime,
  // })

  return {
    success: true,
    queryType: 'report',
    data: {
      kpis: reportResult.data.kpis,
      breakdown: reportResult.data.breakdown || [],
      // Include hierarchy data for proper parent-child account aggregation
      // Use revenueHierarchy/expenseHierarchy when filtering by account category
      revenueHierarchy: reportResult.data.revenueHierarchy,
      expenseHierarchy: reportResult.data.expenseHierarchy,
      monthlyTrend: reportResult.data.monthlyTrend || [],
      lineItemMonthlyDetail: reportResult.data.lineItemMonthlyDetail,
      details: reportResult.data.details,
    },
    summary: reportResult.summary || {},
    currency: context.currency,
    sources: [reportType],
    metadata: {
      fromDate: reportResult.fromDate,
      toDate: reportResult.toDate,
      asOfDate: reportResult.asOfDate,
    },
    generated: new Date().toISOString(),
  }
}

// =============================================================================
// Handler: Analysis Query
// =============================================================================

export async function handleAnalysisQuery(
  input: QuickBooksDataInput,
  context: HandlerContext,
  requiredReports: Array<{
    target: string
    params: {
      startDate: string
      endDate: string
      period?: string
      summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
    }
  }>
): Promise<AggregatedResult> {
  const startTime = Date.now()

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Analysis query started', {
  //   analysisType: input.analysisType,
  //   reportCount: requiredReports.length,
  // })

  // Fetch all required reports in parallel with graceful failure handling
  const reportSettledResults = await Promise.allSettled(
    requiredReports.map((op) => {
      const reportParams: ReportParams = {
        startDate: op.params.startDate,
        endDate: op.params.endDate,
        period: op.params.period,
        summarizeBy: op.params.summarizeBy,
      }
      return fetchEnrichedReport(op.target, reportParams, {
        organizationId: context.organizationId,
        client: context.apiClient,
        currency: context.currency,
      })
    })
  )

  // Extract successful results and track failures
  const reportResults = reportSettledResults
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.success)

  const failedReports = reportSettledResults.filter((r) => r.status === 'rejected')

  // If all reports failed, throw error
  if (reportResults.length === 0) {
    const firstError = failedReports[0] as PromiseRejectedResult | undefined
    throw new Error(firstError?.reason?.message || 'Failed to fetch all required reports')
  }

  // Use first report's data (pass-through KPIs)
  const firstReport = reportResults[0]
  const kpis = firstReport?.data?.kpis || {}

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Analysis query completed', {
  //   duration: Date.now() - startTime,
  // })

  return {
    success: true,
    queryType: 'analyze',
    data: {
      kpis,
      breakdown: firstReport?.data?.breakdown || [],
      revenueHierarchy: firstReport?.data?.revenueHierarchy,
      expenseHierarchy: firstReport?.data?.expenseHierarchy,
      monthlyTrend: firstReport?.data?.monthlyTrend || [],
      lineItemMonthlyDetail: firstReport?.data?.lineItemMonthlyDetail,
    },
    summary: firstReport?.summary || {},
    currency: context.currency,
    sources: requiredReports.map((r) => r.target),
    metadata: {
      analysisType: input.analysisType,
      insights: kpis,
      recommendations: [],
    },
    generated: new Date().toISOString(),
  }
}

// =============================================================================
// Handler: Comparison Query
// =============================================================================

export async function handleComparisonQuery(
  input: QuickBooksDataInput,
  context: HandlerContext,
  reportType: string,
  currentParams: {
    startDate: string
    endDate: string
    period?: string
    summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
  },
  comparisonParams: {
    startDate: string
    endDate: string
    period?: string
    summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total'
  }
): Promise<AggregatedResult> {
  const startTime = Date.now()

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Comparison query started', {
  //   reportType,
  //   metric: input.metric,
  // })

  // Convert params to ReportParams
  const currentReportParams: ReportParams = {
    startDate: currentParams.startDate,
    endDate: currentParams.endDate,
    period: currentParams.period,
    summarizeBy: currentParams.summarizeBy,
  }
  const comparisonReportParams: ReportParams = {
    startDate: comparisonParams.startDate,
    endDate: comparisonParams.endDate,
    period: comparisonParams.period,
    summarizeBy: comparisonParams.summarizeBy,
  }

  // Fetch both periods in parallel with better error handling
  const [currentSettled, comparisonSettled] = await Promise.allSettled([
    fetchEnrichedReport(reportType, currentReportParams, {
      organizationId: context.organizationId,
      client: context.apiClient,
      currency: context.currency,
    }),
    fetchEnrichedReport(reportType, comparisonReportParams, {
      organizationId: context.organizationId,
      client: context.apiClient,
      currency: context.currency,
    }),
  ])

  // Check which period(s) failed for better error messages
  const currentFailed = currentSettled.status === 'rejected' || !currentSettled.value?.success
  const comparisonFailed =
    comparisonSettled.status === 'rejected' || !comparisonSettled.value?.success

  if (currentFailed && comparisonFailed) {
    throw new Error('Failed to fetch both comparison periods')
  } else if (currentFailed) {
    throw new Error(
      `Failed to fetch current period (${currentParams.startDate} to ${currentParams.endDate})`
    )
  } else if (comparisonFailed) {
    throw new Error(
      `Failed to fetch comparison period (${comparisonParams.startDate} to ${comparisonParams.endDate})`
    )
  }

  const currentResult = (currentSettled as PromiseFulfilledResult<any>).value
  const comparisonResult = (comparisonSettled as PromiseFulfilledResult<any>).value

  // Inline variance calculation (previously calculateVariance helper)
  const currentValue = input.metric
    ? currentResult.data?.kpis?.[input.metric] || 0
    : currentResult.summary?.total || 0
  const comparisonValue = input.metric
    ? comparisonResult.data?.kpis?.[input.metric] || 0
    : comparisonResult.summary?.total || 0

  // Ensure numeric values for arithmetic operations
  const currentNumeric = typeof currentValue === 'number' ? currentValue : 0
  const comparisonNumeric = typeof comparisonValue === 'number' ? comparisonValue : 0

  const absolute = currentNumeric - comparisonNumeric
  const percentage = comparisonNumeric !== 0 ? (absolute / comparisonNumeric) * 100 : 0

  const variance = {
    absolute,
    percentage,
    direction: absolute > 0 ? 'increase' : absolute < 0 ? 'decrease' : 'unchanged',
    current: currentValue,
    comparison: comparisonValue,
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Comparison query completed', {
  //   duration: Date.now() - startTime,
  // })

  return {
    success: true,
    queryType: 'compare',
    data: {
      current: currentResult.data,
      comparison: comparisonResult.data,
      variance,
      trendComparison: {
        current: currentResult.data?.monthlyTrend || [],
        comparison: comparisonResult.data?.monthlyTrend || [],
      },
    },
    summary: {
      currentTotal: currentResult.summary?.total || 0,
      comparisonTotal: comparisonResult.summary?.total || 0,
      change: variance.absolute,
      changePercent: variance.percentage,
    },
    currency: context.currency,
    sources: [reportType],
    metadata: {
      metric: input.metric,
      currentPeriod: input.currentPeriod,
      comparisonPeriod: input.comparisonPeriod,
    },
    generated: new Date().toISOString(),
  }
}

// =============================================================================
// Handler: Entity Query
// =============================================================================

export async function handleEntityQuery(
  input: QuickBooksDataInput,
  context: HandlerContext
): Promise<AggregatedResult> {
  const startTime = Date.now()
  const entityType = input.entityType!

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Entity query started', {
  //   entityType,
  //   entityId: input.entityId,
  //   hasFilters: !!input.filters,
  // })

  // NOTE: Don't pass context.apiClient here - it's a ProviderApiClient but
  // entity-accessor expects QuickBooksClient from @/quickbooks/client/client
  // Let entity-accessor create its own QuickBooksClient internally
  const entityConfig = {
    organizationId: context.organizationId,
  }

  let entityResult

  // Normalize entityType from lowercase schema to PascalCase format
  const normalizedEntityType = normalizeEntityType(entityType)

  if (input.entityId) {
    // Fetch single entity
    entityResult = await getEntity(normalizedEntityType, input.entityId, entityConfig)
  } else if (input.searchText) {
    // Search entities by text (e.g., invoice number, customer name)
    // This enables filtering by DocNumber for invoices, DisplayName for customers, etc.
    entityResult = await searchEntities(
      normalizedEntityType,
      input.searchText,
      input.filters || {},
      entityConfig
    )
  } else {
    // List entities with filters
    entityResult = await listEntities(normalizedEntityType, input.filters || {}, entityConfig)
  }

  if (!entityResult.success) {
    throw new Error(entityResult.error || 'Failed to fetch entities')
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Entity query completed', {
  //   duration: Date.now() - startTime,
  // })

  const entities = Array.isArray(entityResult.data)
    ? entityResult.data
    : entityResult.data?.entities || [entityResult.data]

  // Generate invoice widgets for PDF actions - ONLY when explicitly requested
  const widgets: InvoiceActionsWidget[] = []
  let instruction: string | undefined
  let markers: string | undefined

  // Only generate PDF widgets if user explicitly asked for PDF actions
  const shouldIncludePdfWidgets = input.includePdfActions === true

  if (normalizedEntityType === 'Invoice' && entities.length > 0 && shouldIncludePdfWidgets) {
    // Start widget indices at 100 to avoid collision with memory widgets (which use 1-99)
    const INVOICE_WIDGET_BASE_INDEX = 100
    for (let index = 0; index < entities.length; index++) {
      const invoice = entities[index]
      // Determine status based on balance and due date
      let status: 'open' | 'paid' | 'overdue' = 'open'
      if (invoice.balance === 0 || invoice.status === 'paid') {
        status = 'paid'
      } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
        status = 'overdue'
      }

      widgets.push({
        type: 'invoice:actions' as const,
        widgetIndex: INVOICE_WIDGET_BASE_INDEX + index,
        invoiceId: invoice.id,
        invoiceNumber: invoice.docNumber || `INV-${invoice.id}`,
        customerName: invoice.customerName || 'Unknown Customer',
        amount: invoice.total || 0,
        currency: context.currency || 'USD',
        date: invoice.txnDate || new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate || invoice.txnDate || new Date().toISOString().split('T')[0],
        status,
      })
    }

    // Generate instruction for LLM to include widget markers (following memory tool pattern)
    if (widgets.length > 0) {
      markers = widgets.map((w) => `[[WIDGET:${w.widgetIndex}]]`).join(' ')
      instruction = `Found ${entities.length} invoice(s) with PDF actions. Include ${markers} in your response to display invoice cards with PDF download buttons.`
    }
  }

  // Put instruction and markers FIRST so the LLM sees them prominently
  return {
    // CRITICAL: Instruction appears first to ensure LLM follows it
    ...(instruction && { instruction }),
    ...(markers && { markers }),
    success: true,
    queryType: 'entity',
    data: {
      entities,
      ...('summary' in entityResult.data ? { summary: entityResult.data.summary } : {}),
    },
    summary: entityResult.data?.summary || {},
    currency: context.currency,
    sources: [entityType.toLowerCase()],
    metadata: {
      entityType,
      entityId: input.entityId,
    },
    generated: new Date().toISOString(),
    // Widgets at end (actual data for rendering)
    ...(widgets.length > 0 && { widgets }),
  }
}

// =============================================================================
// Handler: Metric Query
// =============================================================================

export async function handleMetricQuery(
  input: QuickBooksDataInput,
  context: HandlerContext,
  requiredSources: Array<{
    target: string
    isEntity: boolean
    params: any
  }>
): Promise<AggregatedResult> {
  const startTime = Date.now()
  const metricId = input.metricName!
  const metric = getMetricById(metricId)

  if (!metric) {
    throw new Error(`Unknown metric: ${metricId}`)
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Metric query started', {
  //   metricId,
  //   sourceCount: requiredSources.length,
  // })

  // NOTE: Don't pass context.apiClient for entities - entity-accessor needs QuickBooksClient from @/quickbooks/client/client
  const entityConfig = {
    organizationId: context.organizationId,
  }

  // Reports can use ProviderApiClient
  const reportConfig = {
    organizationId: context.organizationId,
    client: context.apiClient,
    currency: context.currency,
  }

  // Fetch all sources in parallel with partial failure handling
  const sourceSettledResults = await Promise.allSettled(
    requiredSources.map((source) =>
      source.isEntity
        ? listEntities(source.target as any, source.params.filters || {}, entityConfig)
        : fetchEnrichedReport(source.target, source.params, reportConfig)
    )
  )

  // Extract successful results
  const sourceResults = sourceSettledResults
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r) => r.success)

  // If all sources failed, throw error
  if (sourceResults.length === 0) {
    const failures = sourceSettledResults.filter((r) => r.status === 'rejected')
    const firstError = failures[0] as PromiseRejectedResult | undefined
    throw new Error(firstError?.reason?.message || 'Failed to fetch metric data sources')
  }

  // Extract metric from report KPIs or metadata (for cash flow metrics)
  let metricValue = 0
  for (const result of sourceResults) {
    if (result.success && 'kpis' in result.data) {
      // First check kpis
      if (result.data.kpis?.[metricId] !== undefined) {
        metricValue = result.data.kpis[metricId]
        break
      }
      // Fallback: check metadata for cash flow metrics (runway_months, ocf_ratio, etc.)
      if (result.data.metadata?.[metricId] !== undefined) {
        metricValue = result.data.metadata[metricId]
        break
      }
    }
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Metric query completed', {
  //   duration: Date.now() - startTime,
  //   value: metricValue,
  // })

  // Round value based on metric format for consistency with UI display
  const roundedValue = roundByFormat(metricValue, metric.format)

  return {
    success: true,
    queryType: 'metric',
    data: {
      metricName: metric.name,
      metricId,
      value: roundedValue,
      formattedValue: formatMetricValue(roundedValue, metric.format),
      unit: metric.format,
      category: metric.category,
      description: metric.description,
    },
    summary: {
      value: roundedValue,
      metric: metric.shortName,
    },
    currency: context.currency,
    sources: requiredSources.map((s) => s.target),
    metadata: {
      interpretation: metric.interpretation,
    },
    generated: new Date().toISOString(),
  }
}

// =============================================================================
// Handler: Search Query
// =============================================================================

export async function handleSearchQuery(
  input: QuickBooksDataInput,
  context: HandlerContext
): Promise<AggregatedResult> {
  const startTime = Date.now()
  const searchText = input.searchText!
  const searchScope = input.searchScope || 'all'
  const limit = input.limit || 10
  const offset = input.offset || 0

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Search query started', {
  //   searchText,
  //   searchScope,
  //   limit,
  // })

  // NOTE: Don't pass context.apiClient - entity-accessor needs QuickBooksClient from @/quickbooks/client/client
  const entityConfig = {
    organizationId: context.organizationId,
  }

  // Search across entity types
  const searchPromises: Promise<any>[] = []

  if (searchScope === 'all' || searchScope === 'entities') {
    searchPromises.push(
      searchEntities('Customer', searchText, { limit: Math.ceil(limit / 3) }, entityConfig),
      searchEntities('Vendor', searchText, { limit: Math.ceil(limit / 3) }, entityConfig)
    )
  }

  if (searchScope === 'all' || searchScope === 'transactions') {
    searchPromises.push(
      searchEntities('Invoice', searchText, { limit: Math.ceil(limit / 3) }, entityConfig),
      searchEntities('Bill', searchText, { limit: Math.ceil(limit / 3) }, entityConfig)
    )
  }

  const searchResults = await Promise.allSettled(searchPromises)

  // Aggregate all results
  const allResults: any[] = []
  searchResults.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.success) {
      allResults.push(
        ...result.value.data.entities.map((e: any) => ({
          ...e,
          relevance: 1.0,
        }))
      )
    }
  })

  // Apply offset and limit
  const topResults = allResults.slice(offset, offset + limit)

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Handler] Search query completed', {
  //   duration: Date.now() - startTime,
  //   totalResults: allResults.length,
  // })

  return {
    success: true,
    queryType: 'search',
    data: {
      results: topResults,
      query: searchText,
    },
    summary: {
      totalResults: allResults.length,
      displayedResults: topResults.length,
      offset,
      limit,
      hasMore: offset + limit < allResults.length,
    },
    currency: context.currency,
    sources: searchScope === 'all' ? ['customers', 'vendors', 'invoices', 'bills'] : [searchScope],
    metadata: {
      searchText,
      searchScope,
    },
    generated: new Date().toISOString(),
  }
}
