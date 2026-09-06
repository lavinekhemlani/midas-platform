// src/ai/router/index.ts
// Main export for the query router module

// Export the main routing function
export { routeQuery } from './matcher'

// Export context preparation
export { prepareContext } from './contextPreparer'

// Export types for external use
export type {
  RouteResult,
  PreparedContext,
  QueryIntent,
  ReportType,
  RoutePeriod,
  RouteConfidence,
  MatchTier,
} from './types'

// Export patterns for testing/debugging
export { EXACT_PATTERNS, REPORT_KEYWORDS, INTENT_PATTERNS, PERIOD_PATTERNS } from './patterns'
