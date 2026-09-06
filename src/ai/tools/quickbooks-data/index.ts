// src/ai/tools/quickbooks-data/index.ts
// Main exports for QuickBooks data tool module

// Export the main tool
export { quickbooksData } from './quickbooks-data'

// Export all types
export type {
  ToolContext,
  QueryType,
  ReportQuery,
  AnalyzeQuery,
  CompareQuery,
  EntityQuery,
  MetricQuery,
  SearchQuery,
  QuickBooksDataInput,
  QuickBooksDataResult,
} from './types'

// Export all schemas
export { quickbooksDataSchema } from './schema'

// Export utility functions
export { planQuery, type QueryPlan, type QueryOperation } from './query-planner'

export {
  fetchEnrichedReport,
  type ReportAccessorConfig,
  type ReportParams,
  type EnrichedReportResult,
} from './report-accessor'

export {
  listEntities,
  getEntity,
  searchEntities,
  type EntityType,
  type EntityFilters,
  type EntityConfig,
  type EntityListResult,
  type EntitySearchResult,
} from './entity-accessor'

export {
  METRICS_REGISTRY,
  METRIC_DEPENDENCIES,
  getMetricsByCategory,
  getMetricById,
  getCriticalMetrics,
  getRequiredDataSources,
  getCalculableMetrics,
  groupMetricsByCategory,
  getRecommendedMetrics,
  formatMetricValue,
  interpretMetricValue,
  type MetricDefinition,
  type MetricCategory,
  type MetricFormat,
} from './metrics-registry'

// Export handler functions and result type
export {
  handleReportQuery,
  handleAnalysisQuery,
  handleComparisonQuery,
  handleEntityQuery,
  handleMetricQuery,
  handleSearchQuery,
  type HandlerContext,
  type AggregatedResult,
} from './handlers'
