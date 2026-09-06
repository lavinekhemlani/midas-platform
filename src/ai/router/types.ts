// src/ai/router/types.ts
// Type definitions for the query router system

import type { MemoryType } from '../memory/types'

// =============================================================================
// Query Intent Types
// =============================================================================

/**
 * The detected intent of a user query
 * Used to determine what kind of analysis is needed
 */
export type QueryIntent =
  | 'point_query' // "What's my revenue?" - Single data point
  | 'trend' // "How has revenue changed?" - Data over time
  | 'comparison' // "Compare this month to last" - Period vs period
  | 'forecast' // "What's my runway?" - Future projection
  | 'anomaly' // "What's unusual about expenses?" - Pattern detection
  | 'health_check' // "How's the business doing?" - Holistic overview
  | 'drill_down' // "Break down payroll costs" - Detailed breakdown
  | 'general' // Fallback - let agent decide

// =============================================================================
// Report Types
// =============================================================================

/**
 * Available financial report types that can be pre-fetched
 * Maps directly to quickbooks_data tool's report parameter
 */
export type ReportType =
  | 'profit_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'revenue_trend'
  | 'aged_receivables'
  | 'aged_payables'
  | 'financial_health'
  | 'sales'
  | 'bills'
  | 'pnl_comparison'
  | 'trial_balance'

// =============================================================================
// Period Types
// =============================================================================

/**
 * Time periods that can be detected from queries
 */
export type RoutePeriod =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'

// =============================================================================
// Confidence Levels
// =============================================================================

/**
 * How confident we are in the routing decision
 * - high: Exact pattern match, safe to pre-fetch
 * - medium: Keyword match, pre-fetch with caution
 * - low: Fallback, let agent decide everything
 */
export type RouteConfidence = 'high' | 'medium' | 'low'

/**
 * Which tier of the router handled this query
 */
export type MatchTier = 'exact' | 'keyword' | 'fallback'

// =============================================================================
// Route Result
// =============================================================================

/**
 * The result of routing a query
 * This is advisory - it helps optimize but doesn't constrain the agent
 */
export interface RouteResult {
  /** Detected query intent */
  intent: QueryIntent

  /** Suggested reports to pre-fetch */
  reports: ReportType[]

  /** Detected time periods */
  periods: RoutePeriod[]

  /** Memory types relevant to this query */
  memoryTypes: MemoryType[]

  /** Confidence in this routing decision */
  confidence: RouteConfidence

  /** Which matching tier was used */
  matchedTier: MatchTier

  /** The pattern that matched (for debugging) */
  matchedPattern?: string

  /** Ambiguous terms detected in the query (e.g., 'revenue', 'profit') */
  ambiguousTerms: string[]

  /** Whether the agent should ask for clarification before fetching data */
  requiresClarification: boolean
}

// =============================================================================
// Prepared Context
// =============================================================================

/**
 * Context prepared for the agent based on routing
 * Includes pre-fetched data and aligned memories
 */
export interface PreparedContext {
  /** The routing decision */
  route: RouteResult

  /** Pre-fetched report data (only for high confidence routes) */
  prefetchedData: Record<string, unknown>

  /** Formatted memory context string */
  memories: string

  /** How long the preparation took (ms) */
  fetchDuration: number
}

// =============================================================================
// Pattern Types (for patterns.ts)
// =============================================================================

/**
 * An exact pattern match configuration
 */
export interface ExactPattern {
  /** Regex pattern to match */
  pattern: RegExp

  /** Intent to assign when matched */
  intent: QueryIntent

  /** Reports to suggest for pre-fetching */
  reports: ReportType[]
}

/**
 * Report keyword configuration
 */
export type ReportKeywords = Record<ReportType, string[]>

/**
 * Intent pattern configuration
 */
export type IntentPatterns = Record<QueryIntent, RegExp>

/**
 * Period pattern configuration
 */
export type PeriodPatterns = Record<RoutePeriod, RegExp>

/**
 * Memory alignment configuration
 */
export type IntentMemoryAlignment = Record<QueryIntent, MemoryType[]>
