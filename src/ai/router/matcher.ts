// src/ai/router/matcher.ts
// Tiered matching logic - clean, testable, no side effects

import type { RouteResult, QueryIntent, ReportType, RoutePeriod, RouteConfidence } from './types'
import {
  EXACT_PATTERNS,
  REPORT_KEYWORDS,
  INTENT_PATTERNS,
  INTENT_PRIORITY,
  PERIOD_PATTERNS,
  INTENT_MEMORY_ALIGNMENT,
  AMBIGUOUS_TERMS,
} from './patterns'

// =============================================================================
// Main Router Function
// =============================================================================

/**
 * Routes a query through the tiered matching system
 *
 * Tier 1: Exact pattern matching (< 1ms, high confidence)
 * Tier 2: Keyword-based matching (< 1ms, medium confidence)
 * Tier 3: Fallback (no pre-fetch, let agent decide)
 *
 * @param query - The user's query string
 * @returns RouteResult with intent, suggested reports, and confidence
 */
export function routeQuery(query: string): RouteResult {
  const normalizedQuery = normalizeQuery(query)

  // Detect ambiguous terms in the query
  const ambiguousTerms = detectAmbiguousTerms(normalizedQuery)
  const requiresClarification = ambiguousTerms.length > 0 && !hasSpecificContext(normalizedQuery)

  // Tier 1: Exact pattern matching
  const exactMatch = tryExactPatterns(normalizedQuery, query, ambiguousTerms, requiresClarification)
  if (exactMatch) {
    return exactMatch
  }

  // Tier 2: Keyword-based matching
  const keywordMatch = tryKeywordMatch(normalizedQuery, ambiguousTerms, requiresClarification)
  if (keywordMatch.confidence !== 'low') {
    return keywordMatch
  }

  // Tier 3: Fallback - let agent decide everything
  return createFallbackResult(ambiguousTerms, requiresClarification)
}

// =============================================================================
// Tier 1: Exact Pattern Matching
// =============================================================================

/**
 * Attempts to match the query against exact patterns
 * Returns null if no exact match found
 */
function tryExactPatterns(
  normalizedQuery: string,
  originalQuery: string,
  ambiguousTerms: string[],
  requiresClarification: boolean
): RouteResult | null {
  for (const { pattern, intent, reports } of EXACT_PATTERNS) {
    if (pattern.test(normalizedQuery) || pattern.test(originalQuery)) {
      const periods = detectPeriods(normalizedQuery)

      return {
        intent,
        reports: [...reports], // Create new array to avoid mutation
        periods: periods.length > 0 ? periods : ['this_year'],
        memoryTypes: [...(INTENT_MEMORY_ALIGNMENT[intent] || [])],
        confidence: 'high',
        matchedTier: 'exact',
        matchedPattern: pattern.source,
        ambiguousTerms,
        requiresClarification,
      }
    }
  }

  return null
}

// =============================================================================
// Tier 2: Keyword-Based Matching
// =============================================================================

/**
 * Attempts keyword-based matching
 * Returns medium confidence if reports or specific intent detected
 */
function tryKeywordMatch(
  query: string,
  ambiguousTerms: string[],
  requiresClarification: boolean
): RouteResult {
  // Detect reports from keywords
  const reports = detectReports(query)

  // Detect intent from patterns
  const intent = detectIntent(query)

  // Detect time periods
  const periods = detectPeriods(query)

  // Calculate confidence based on what we found
  const confidence = calculateConfidence(reports, intent)

  return {
    intent,
    reports,
    periods: periods.length > 0 ? periods : ['this_year'],
    memoryTypes: [...(INTENT_MEMORY_ALIGNMENT[intent] || [])],
    confidence,
    matchedTier: 'keyword',
    ambiguousTerms,
    requiresClarification,
  }
}

// =============================================================================
// Tier 3: Fallback
// =============================================================================

/**
 * Creates a fallback result when no patterns match
 * Agent has full autonomy to decide what to fetch
 */
function createFallbackResult(
  ambiguousTerms: string[],
  requiresClarification: boolean
): RouteResult {
  return {
    intent: 'general',
    reports: [],
    periods: ['this_year'],
    memoryTypes: [],
    confidence: 'low',
    matchedTier: 'fallback',
    ambiguousTerms,
    requiresClarification,
  }
}

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detects which reports might be needed based on keywords
 */
function detectReports(query: string): ReportType[] {
  const reports: ReportType[] = []
  const reportEntries = Object.entries(REPORT_KEYWORDS) as [ReportType, string[]][]

  for (const [report, keywords] of reportEntries) {
    const hasMatch = keywords.some((keyword) => query.includes(keyword))

    if (hasMatch && !reports.includes(report)) {
      reports.push(report)
    }
  }

  return reports
}

/**
 * Detects the query intent from patterns
 * Checks in priority order, returns first match
 */
function detectIntent(query: string): QueryIntent {
  for (const intent of INTENT_PRIORITY) {
    if (intent === 'general') {
      continue // Skip general, it's the fallback
    }

    const pattern = INTENT_PATTERNS[intent]
    if (pattern && pattern.test(query)) {
      return intent
    }
  }

  return 'general'
}

/**
 * Detects time periods mentioned in the query
 */
function detectPeriods(query: string): RoutePeriod[] {
  const periods: RoutePeriod[] = []
  const periodEntries = Object.entries(PERIOD_PATTERNS) as [RoutePeriod, RegExp][]

  for (const [period, pattern] of periodEntries) {
    if (pattern.test(query) && !periods.includes(period)) {
      periods.push(period)
    }
  }

  return periods
}

/**
 * Calculates routing confidence based on detection results
 *
 * High: Clear report match + clear intent (not general)
 * Medium: Either report OR intent is clear
 * Low: Nothing matched
 */
function calculateConfidence(reports: ReportType[], intent: QueryIntent): RouteConfidence {
  const hasReports = reports.length > 0
  const hasSpecificIntent = intent !== 'general'

  // High: Both report and intent are clear
  if (hasReports && hasSpecificIntent) {
    return 'high'
  }

  // Medium: Either is clear
  if (hasReports || hasSpecificIntent) {
    return 'medium'
  }

  // Low: Nothing matched
  return 'low'
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalizes a query for consistent matching
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes multiple spaces
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ')
}

// =============================================================================
// Ambiguity Detection Functions
// =============================================================================

/**
 * Detects ambiguous financial terms in the query
 * These are terms that could mean different things (e.g., "revenue" could be sales or P&L)
 */
function detectAmbiguousTerms(query: string): string[] {
  const found: string[] = []
  const ambiguousPatterns: Record<string, RegExp> = {
    revenue: /\brevenue\b/i,
    expenses: /\bexpenses?\b/i,
    profit: /\bprofit\b/i,
    cash: /\bcash\b/i,
  }

  for (const [term, pattern] of Object.entries(ambiguousPatterns)) {
    if (pattern.test(query) && AMBIGUOUS_TERMS[term]) {
      found.push(term)
    }
  }
  return found
}

/**
 * Checks if the query already has specific context that resolves ambiguity
 * Returns true if the user has already specified which type they want
 */
function hasSpecificContext(query: string): boolean {
  const specificPatterns = [
    // Revenue specifics
    /\b(p&l|profit.?loss|income statement)\s*(revenue|income)?\b/i,
    /\b(sales|invoice|billing)\s*(revenue|report|data)?\b/i,
    /\btotal\s*income\b/i,
    // Profit specifics
    /\b(gross|net)\s*profit\b/i,
    /\bnet\s*income\b/i,
    /\bgross\s*margin\b/i,
    // Cash specifics
    /\bcash\s*(flow|balance|position)\b/i,
    /\bcash\s*on\s*hand\b/i,
    // Expense specifics
    /\b(operating|total)\s*expenses?\b/i,
    /\b(bills?|payables?|accounts\s*payable)\b/i,
    /\bcost\s*of\s*(goods|sales)\b/i,
  ]
  return specificPatterns.some((p) => p.test(query))
}
