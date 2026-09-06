// src/ai/tools/quickbooks-data/query-planner.ts
// Plans optimal data fetching strategy based on query intent

import type { QuickBooksDataInput, QueryType } from './types'
import { METRIC_DEPENDENCIES, getMetricById, METRICS_REGISTRY } from './metrics-registry'
import { logger } from '@/lib/logger'

// =============================================================================
// Input Normalization Helpers
// =============================================================================

/**
 * Normalize summarizeBy value to PascalCase
 * LLMs sometimes pass lowercase values like 'month' instead of 'Month'
 */
function normalizeSummarizeBy(
  value: string | null | undefined
): 'Month' | 'Quarter' | 'Year' | 'Total' | undefined {
  if (!value) return undefined

  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

  const validValues = ['Month', 'Quarter', 'Year', 'Total']
  if (validValues.includes(normalized)) {
    return normalized as 'Month' | 'Quarter' | 'Year' | 'Total'
  }

  // Return undefined for invalid values
  return undefined
}

// =============================================================================
// Intent Types (moved from intent-detector.ts)
// =============================================================================

export type QueryIntent =
  | 'report_fetch'
  | 'metric_calculation'
  | 'entity_lookup'
  | 'comparison'
  | 'analysis'
  | 'search'

export interface DetectedIntent {
  intent: QueryIntent
  confidence: number
  suggestedReports: string[]
  suggestedMetrics: string[]
  estimatedComplexity: 'low' | 'medium' | 'high'
  requiresMultipleDataSources: boolean
}

// =============================================================================
// Query Plan Types
// =============================================================================

export interface QueryOperation {
  type: 'fetch' | 'transform' | 'calculate' | 'aggregate'
  target: string
  params: Record<string, any>
  dependsOn?: string[]
}

export interface QueryPlan {
  queryType: string
  operations: QueryOperation[]
  metadata: Record<string, any>
  dataSources: string[]
}

export interface DataSource {
  type: 'report' | 'entity' | 'metric' | 'derived'
  source: string
  params: Record<string, any>
  priority: 'critical' | 'high' | 'medium' | 'low'
  dependsOn?: string[]
}

// =============================================================================
// Query Type Mappings
// =============================================================================

/**
 * Maps query types to primary intents
 */
const QUERY_TYPE_TO_INTENT: Record<QueryType, QueryIntent> = {
  report: 'report_fetch',
  analyze: 'analysis',
  compare: 'comparison',
  entity: 'entity_lookup',
  metric: 'metric_calculation',
  search: 'search',
}

/**
 * Maps report types to required data sources
 */
const REPORT_TO_SOURCES: Record<string, string[]> = {
  executive_summary: ['profit_loss', 'balance_sheet', 'cash_flow'],
  profit_loss: ['profit_loss'],
  balance_sheet: ['balance_sheet'],
  cash_flow: ['cash_flow'],
  sales: ['profit_loss', 'invoices'],
  bills: ['bills'],
  revenue_trend: ['profit_loss'],
  aged_receivables: ['invoices', 'balance_sheet'],
  aged_payables: ['bills', 'balance_sheet'],
  financial_health: ['profit_loss', 'balance_sheet', 'cash_flow'],
  pnl_comparison: ['profit_loss'],
  trial_balance: ['balance_sheet'],
}

/**
 * Maps focus areas to suggested reports
 */
const FOCUS_AREA_TO_REPORTS: Record<string, string[]> = {
  revenue: ['profit_loss', 'revenue_trend'], // Removed 'sales' - revenue queries should use P&L, not invoice breakdown
  expenses: ['profit_loss', 'bills'],
  cash_flow: ['cash_flow', 'balance_sheet'],
  profitability: ['profit_loss', 'balance_sheet'],
  liquidity: ['balance_sheet', 'cash_flow'],
}

/**
 * Maps focus areas to relevant metrics
 */
const FOCUS_AREA_TO_METRICS: Record<string, string[]> = {
  revenue: ['revenue_growth', 'gross_margin', 'gross_profit'],
  expenses: ['expense_growth', 'operating_margin', 'net_margin'],
  cash_flow: [
    'operating_cash_flow',
    'free_cash_flow',
    'burn_rate',
    'runway_months',
    'cash_flow_margin',
  ],
  profitability: ['gross_margin', 'net_margin', 'operating_margin', 'roa', 'roe', 'ebitda_margin'],
  liquidity: ['current_ratio', 'quick_ratio', 'cash_ratio', 'working_capital', 'cash_balance'],
}

// =============================================================================
// Intent Detection Helpers (essential functions from intent-detector.ts)
// =============================================================================

/**
 * Detects the intent of a QuickBooks data query
 */
export function detectIntent(input: QuickBooksDataInput): DetectedIntent {
  const baseIntent = QUERY_TYPE_TO_INTENT[input.queryType]

  switch (input.queryType) {
    case 'report':
      return detectReportIntent(input)
    case 'analyze':
      return detectAnalyzeIntent(input)
    case 'compare':
      return detectCompareIntent(input)
    case 'entity':
      return detectEntityIntent(input)
    case 'metric':
      return detectMetricIntent(input)
    case 'search':
      return detectSearchIntent(input)
    default:
      return createDefaultIntent(baseIntent)
  }
}

function detectReportIntent(input: QuickBooksDataInput): DetectedIntent {
  const { reportType } = input
  if (!reportType) {
    throw new Error('reportType is required for report queries')
  }
  const suggestedReports = REPORT_TO_SOURCES[reportType] || [reportType]
  const isFinancialHealth = reportType === 'financial_health'
  const isAgedReport = reportType === 'aged_receivables' || reportType === 'aged_payables'
  const complexity = isFinancialHealth ? 'high' : isAgedReport ? 'medium' : 'low'
  const requiresMultiple = suggestedReports.length > 1

  return {
    intent: 'report_fetch',
    confidence: 0.95,
    suggestedReports,
    suggestedMetrics: [],
    estimatedComplexity: complexity,
    requiresMultipleDataSources: requiresMultiple,
  }
}

function detectAnalyzeIntent(input: QuickBooksDataInput): DetectedIntent {
  const { analysisType, focusArea } = input
  if (!analysisType) {
    throw new Error('analysisType is required for analyze queries')
  }

  let suggestedReports: string[] = []
  let suggestedMetrics: string[] = []

  if (focusArea) {
    suggestedReports = FOCUS_AREA_TO_REPORTS[focusArea] || []
    suggestedMetrics = FOCUS_AREA_TO_METRICS[focusArea] || []
  } else {
    suggestedReports = ['profit_loss', 'balance_sheet', 'cash_flow']
  }

  const complexity =
    analysisType === 'trends' || analysisType === 'breakdown'
      ? 'medium'
      : analysisType === 'forecast' || analysisType === 'performance'
        ? 'high'
        : 'low'

  return {
    intent: 'analysis',
    confidence: 0.9,
    suggestedReports,
    suggestedMetrics,
    estimatedComplexity: complexity,
    requiresMultipleDataSources: true,
  }
}

function detectCompareIntent(input: QuickBooksDataInput): DetectedIntent {
  const { compareType, metric } = input
  if (!compareType) {
    throw new Error('compareType is required for compare queries')
  }

  let suggestedReports: string[] = []
  let suggestedMetrics: string[] = []

  if (metric) {
    switch (metric) {
      case 'revenue':
        suggestedReports = ['profit_loss']
        suggestedMetrics = ['revenue', 'revenue_growth']
        break
      case 'expenses':
        suggestedReports = ['profit_loss']
        suggestedMetrics = ['expense_growth', 'operating_margin']
        break
      case 'profit':
        suggestedReports = ['profit_loss']
        suggestedMetrics = ['net_margin', 'gross_margin', 'operating_margin']
        break
      case 'cash_flow':
        suggestedReports = ['cash_flow', 'balance_sheet']
        suggestedMetrics = ['operating_cash_flow', 'free_cash_flow']
        break
      case 'margins':
        suggestedReports = ['profit_loss']
        suggestedMetrics = ['gross_margin', 'net_margin', 'operating_margin']
        break
    }
  } else {
    suggestedReports = ['profit_loss', 'balance_sheet']
  }

  return {
    intent: 'comparison',
    confidence: 0.92,
    suggestedReports,
    suggestedMetrics,
    estimatedComplexity: 'medium',
    requiresMultipleDataSources: true,
  }
}

function detectEntityIntent(input: QuickBooksDataInput): DetectedIntent {
  const { entityType, entityId, filters } = input
  if (!entityType) {
    throw new Error('entityType is required for entity queries')
  }

  const isSimpleLookup = !!entityId
  const hasComplexFilters =
    filters &&
    (filters.minAmount !== undefined ||
      filters.maxAmount !== undefined ||
      filters.startDate !== undefined ||
      filters.endDate !== undefined)

  const complexity = isSimpleLookup ? 'low' : hasComplexFilters ? 'medium' : 'low'

  return {
    intent: 'entity_lookup',
    confidence: 0.98,
    suggestedReports: [entityType],
    suggestedMetrics: [],
    estimatedComplexity: complexity,
    requiresMultipleDataSources: false,
  }
}

function detectMetricIntent(input: QuickBooksDataInput): DetectedIntent {
  const { metricName, includeHistory } = input
  if (!metricName) {
    throw new Error('metricName is required for metric queries')
  }

  const requiredSources = METRIC_DEPENDENCIES[metricName] || []
  const complexity =
    includeHistory || requiredSources.length > 2
      ? 'high'
      : requiredSources.length > 1
        ? 'medium'
        : 'low'

  return {
    intent: 'metric_calculation',
    confidence: 0.97,
    suggestedReports: requiredSources,
    suggestedMetrics: [metricName],
    estimatedComplexity: complexity,
    requiresMultipleDataSources: requiredSources.length > 1,
  }
}

function detectSearchIntent(input: QuickBooksDataInput): DetectedIntent {
  const { searchScope, searchText } = input
  if (!searchText) {
    throw new Error('searchText is required for search queries')
  }

  let suggestedReports: string[] = []

  switch (searchScope) {
    case 'transactions':
      suggestedReports = ['invoices', 'bills', 'payments']
      break
    case 'entities':
      suggestedReports = ['customers', 'vendors', 'accounts']
      break
    case 'reports':
      suggestedReports = ['profit_loss', 'balance_sheet', 'cash_flow']
      break
    case 'all':
    default:
      suggestedReports = ['all']
      break
  }

  return {
    intent: 'search',
    confidence: 0.85,
    suggestedReports,
    suggestedMetrics: [],
    estimatedComplexity: 'medium',
    requiresMultipleDataSources: searchScope === 'all',
  }
}

function createDefaultIntent(intent: QueryIntent): DetectedIntent {
  return {
    intent,
    confidence: 0.5,
    suggestedReports: [],
    suggestedMetrics: [],
    estimatedComplexity: 'medium',
    requiresMultipleDataSources: false,
  }
}

/**
 * Gets all data sources needed for a detected intent
 */
export function getRequiredDataSources(detectedIntent: DetectedIntent): string[] {
  const sources = new Set<string>()
  detectedIntent.suggestedReports.forEach((report) => sources.add(report))
  detectedIntent.suggestedMetrics.forEach((metric) => {
    const deps = METRIC_DEPENDENCIES[metric] || []
    deps.forEach((dep) => sources.add(dep))
  })
  return Array.from(sources)
}

/**
 * Checks if an intent requires parallel data fetching
 */
export function requiresParallelFetch(detectedIntent: DetectedIntent): boolean {
  return detectedIntent.requiresMultipleDataSources && detectedIntent.suggestedReports.length > 1
}

// =============================================================================
// Main Query Planning Function
// =============================================================================

/**
 * Plans the optimal execution strategy for a QuickBooks data query
 * @param input - The query input from the user
 * @returns Complete query execution plan
 */
export function planQuery(input: QuickBooksDataInput): QueryPlan {
  const startTime = Date.now()

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Plan] Query planning started', {
  //   queryType: input.queryType,
  //   reportType: 'reportType' in input ? input.reportType : undefined,
  // })

  // Step 1: Detect intent
  const detectedIntent = detectIntent(input)

  logger.debug('[Tool:QB:Plan] Intent detected', {
    intent: detectedIntent.intent,
    suggestedReports: detectedIntent.suggestedReports,
  })

  // Step 2: Determine required data sources
  const requiredSources = getRequiredDataSources(detectedIntent)

  // Step 3: Build data source list with priorities
  const dataSources = buildDataSources(input, detectedIntent, requiredSources)

  // Step 4: Build operations list
  const operations = buildOperations(dataSources, input)

  // Step 5: Build metadata
  const metadata = buildMetadata(input, detectedIntent)

  const plan: QueryPlan = {
    queryType: input.queryType,
    operations,
    metadata,
    dataSources: dataSources.map((ds) => ds.source),
  }

  // Commented out — styled TOOL box in route.ts already covers tool execution
  // logger.info('[Tool:QB:Plan] Query plan completed', {
  //   dataSources: plan.dataSources,
  //   planningDuration: Date.now() - startTime,
  // })

  return plan
}

// =============================================================================
// Query Planning Helper Functions
// =============================================================================

/**
 * Builds the list of data sources with metadata
 */
function buildDataSources(
  input: QuickBooksDataInput,
  detectedIntent: DetectedIntent,
  requiredSources: string[]
): DataSource[] {
  const sources: DataSource[] = []
  const processedSources = new Set<string>()

  // Add primary data sources
  for (const source of requiredSources) {
    if (processedSources.has(source)) continue

    const dataSource: DataSource = {
      type: determineSourceType(source),
      source,
      params: buildSourceParams(input, source),
      priority: determineSourcePriority(source, detectedIntent),
    }

    sources.push(dataSource)
    processedSources.add(source)
  }

  // Add dependent data sources for metrics
  if (input.queryType === 'metric' || input.queryType === 'analyze') {
    const metricDeps = getMetricDependencies(detectedIntent.suggestedMetrics)

    for (const dep of metricDeps) {
      if (processedSources.has(dep)) continue

      sources.push({
        type: 'report',
        source: dep,
        params: buildSourceParams(input, dep),
        priority: 'medium',
        dependsOn: [],
      })

      processedSources.add(dep)
    }
  }

  return sources
}

/**
 * Determines the type of data source
 */
function determineSourceType(source: string): DataSource['type'] {
  // Check if it's a metric
  const metric = getMetricById(source)
  if (metric) return 'metric'

  // Check if it's an entity type
  if (
    ['customer', 'vendor', 'account', 'invoice', 'bill', 'payment', 'transaction'].includes(source)
  ) {
    return 'entity'
  }

  // Check if it's a standard report
  if (
    [
      'profit_loss',
      'balance_sheet',
      'cash_flow',
      'aged_receivables',
      'aged_payables',
      'sales',
      'bills',
    ].includes(source)
  ) {
    return 'report'
  }

  // Default to derived
  return 'derived'
}

/**
 * Builds parameters for a data source based on the query
 */
function buildSourceParams(input: QuickBooksDataInput, source: string): Record<string, any> {
  const params: Record<string, any> = {}

  // Add date range if available
  if ('period' in input && input.period) {
    params.period = input.period
  }

  if ('startDate' in input && input.startDate) {
    params.startDate = input.startDate
  }

  if ('endDate' in input && input.endDate) {
    params.endDate = input.endDate
  }

  if ('summarizeBy' in input && input.summarizeBy) {
    // Normalize case-insensitive values from LLM
    params.summarizeBy = normalizeSummarizeBy(input.summarizeBy)
  }

  if ('accountingMethod' in input && input.accountingMethod) {
    params.accountingMethod = input.accountingMethod
  }

  // Add entity-specific params
  if (input.queryType === 'entity') {
    if (input.entityId) params.entityId = input.entityId
    if (input.filters) params.filters = input.filters
    if (input.limit) params.limit = input.limit
    if (input.offset) params.offset = input.offset
  }

  // Add comparison params
  if (input.queryType === 'compare') {
    if (input.currentPeriod) params.currentPeriod = input.currentPeriod
    if (input.comparisonPeriod) params.comparisonPeriod = input.comparisonPeriod
    if (input.currentStartDate) params.currentStartDate = input.currentStartDate
    if (input.currentEndDate) params.currentEndDate = input.currentEndDate
    if (input.comparisonStartDate) params.comparisonStartDate = input.comparisonStartDate
    if (input.comparisonEndDate) params.comparisonEndDate = input.comparisonEndDate
  }

  // Add metric-specific params
  if (input.queryType === 'metric') {
    if (input.includeHistory) params.includeHistory = input.includeHistory
  }

  return params
}

/**
 * Determines priority of a data source
 */
function determineSourcePriority(
  source: string,
  detectedIntent: DetectedIntent
): DataSource['priority'] {
  // Primary reports get high priority
  if (detectedIntent.suggestedReports.includes(source)) {
    return 'critical'
  }

  // Core financial statements
  if (['profit_loss', 'balance_sheet', 'cash_flow'].includes(source)) {
    return 'high'
  }

  // Metrics get medium priority
  if (getMetricById(source)) {
    return 'medium'
  }

  return 'low'
}

/**
 * Gets all dependencies for a list of metrics
 */
function getMetricDependencies(metricNames: string[]): string[] {
  const deps = new Set<string>()

  for (const metricName of metricNames) {
    const metricDeps = METRIC_DEPENDENCIES[metricName] || []
    metricDeps.forEach((dep) => deps.add(dep))
  }

  return Array.from(deps)
}

/**
 * Builds operations list from data sources
 */
function buildOperations(dataSources: DataSource[], input: QuickBooksDataInput): QueryOperation[] {
  return dataSources.map((ds) => ({
    type: 'fetch' as const,
    target: ds.source,
    params: ds.params,
    dependsOn: ds.dependsOn,
  }))
}

/**
 * Builds metadata object for the query plan
 */
function buildMetadata(
  input: QuickBooksDataInput,
  detectedIntent: DetectedIntent
): Record<string, any> {
  const metadata: Record<string, any> = {
    intent: detectedIntent.intent,
    confidence: detectedIntent.confidence,
  }

  // Add query-specific metadata
  if (input.queryType === 'report') {
    metadata.reportType = input.reportType
  }

  if (input.queryType === 'analyze') {
    metadata.analysisType = input.analysisType
    metadata.focusArea = input.focusArea
  }

  if (input.queryType === 'compare') {
    metadata.compareType = input.compareType
    metadata.metric = input.metric
  }

  if (input.queryType === 'entity') {
    metadata.entityType = input.entityType
  }

  if (input.queryType === 'metric') {
    metadata.metricName = input.metricName
  }

  return metadata
}
