// src/ai/tools/webSearch.ts
// Web search tool using Tavily API
// Following Tavily Best Practices: https://docs.tavily.com/documentation/best-practices/

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { withLongTimeout } from './utils'
import { logger } from '@/lib/logger'

const WEB_SEARCH_TIMEOUT_MS = 30000 // 30 seconds for web search

interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilySearchResponse {
  query: string
  answer?: string
  results: SearchResult[]
  response_time: string
}

// Simple in-memory cache for search results
interface CacheEntry {
  results: string
  timestamp: number
}

// Rate limiting configuration
const MIN_SEARCH_INTERVAL_MS = 1000
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// Global state
let lastSearchTime = 0
const searchCache = new Map<string, CacheEntry>()

// Tavily API configuration
const TAVILY_API_KEY = process.env.TAVILY_API_KEY
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanCache(): void {
  const now = Date.now()
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      searchCache.delete(key)
    }
  }
}

function buildRequest(
  query: string,
  maxResults: number,
  searchType: string,
  timeRange?: string
): Record<string, unknown> {
  // Best practices:
  // - max_results: 10 recommended for better relevance
  // - search_depth: basic (1 credit) unless need advanced
  // - include_answer: true for AI summary
  // - Don't use auto_parameters (unpredictable cost)
  // - Don't use include_raw_content (use Extract API instead)

  const request: Record<string, unknown> = {
    query,
    max_results: Math.min(maxResults, 10), // Cap at 10 per best practices
    search_depth: 'basic', // 1 credit, use advanced only when needed
    include_answer: true, // Get AI-generated answer
  }

  // Set topic based on search type
  switch (searchType) {
    case 'news':
      request.topic = 'news' // Includes published dates
      break
    case 'financial':
      request.topic = 'finance'
      break
    case 'competitors':
    case 'general':
    default:
      request.topic = 'general'
      break
  }

  // Add time range if specified (useful for news)
  if (timeRange) {
    request.time_range = timeRange
  }

  return request
}

// Core search logic
async function performWebSearch(input: {
  query: string
  maxResults?: number
  searchType?: 'general' | 'news' | 'financial' | 'competitors'
  timeRange?: 'day' | 'week' | 'month' | 'year'
}): Promise<string> {
  try {
    if (!TAVILY_API_KEY) {
      logger.error('[webSearch] TAVILY_API_KEY not configured')
      return JSON.stringify({
        success: false,
        error: 'Web search not configured',
        code: 'CONFIG',
        retryable: false,
        hint: 'Use your existing knowledge to answer.',
      })
    }

    const { query, maxResults = 10, searchType = 'general', timeRange } = input

    // Best practice: Keep queries under 400 characters
    const truncatedQuery = query.slice(0, 400)

    // Check cache
    const cacheKey = `${truncatedQuery}:${maxResults}:${searchType}:${timeRange || ''}`
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug('[webSearch] Cache hit', { query: truncatedQuery.slice(0, 50) })
      return cached.results
    }

    // Rate limiting
    const now = Date.now()
    if (now - lastSearchTime < MIN_SEARCH_INTERVAL_MS) {
      await sleep(MIN_SEARCH_INTERVAL_MS - (now - lastSearchTime))
    }
    lastSearchTime = Date.now()

    // Build request following best practices
    const requestBody = buildRequest(truncatedQuery, maxResults, searchType, timeRange)

    logger.info('[webSearch] Searching', { query: truncatedQuery.slice(0, 60), searchType })

    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[webSearch] API error', { status: response.status, error: errorText })
      throw new Error(`Tavily API error: ${response.status}`)
    }

    const data: TavilySearchResponse = await response.json()

    if (!data.results?.length) {
      return JSON.stringify({
        success: true, // No results is not an error, just empty
        query: truncatedQuery,
        resultCount: 0,
        results: [],
        message: 'No results found. Try different search terms.',
      })
    }

    // Format results - include score for relevance filtering
    const formattedResults = data.results
      .filter((r) => r.score >= 0.3) // Filter low-relevance results
      .map((r, i) => ({
        rank: i + 1,
        title: r.title,
        url: r.url,
        snippet: r.content,
        score: r.score,
      }))

    const result = JSON.stringify({
      success: true,
      query: truncatedQuery,
      searchType,
      answer: data.answer || null, // AI-generated summary
      resultCount: formattedResults.length,
      results: formattedResults,
      responseTime: data.response_time,
      timestamp: new Date().toISOString(),
    })

    // Cache result
    searchCache.set(cacheKey, { results: result, timestamp: Date.now() })
    cleanCache()

    logger.info('[webSearch] Success', {
      resultCount: formattedResults.length,
      responseTime: data.response_time,
    })
    return result
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Search failed'
    const isTimeout = msg.toLowerCase().includes('timeout')
    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate limit')
    const isNetwork =
      msg.toLowerCase().includes('network') || msg.toLowerCase().includes('econnrefused')

    logger.error('[webSearch] Error', { error: msg })

    return JSON.stringify({
      success: false,
      error: msg,
      code: isTimeout
        ? 'TIMEOUT'
        : isRateLimit
          ? 'RATE_LIMIT'
          : isNetwork
            ? 'NETWORK'
            : 'TOOL_EXECUTION',
      retryable: isTimeout || isRateLimit || isNetwork,
      hint: 'Use your existing knowledge or try a different query.',
    })
  }
}

// Wrap with timeout for protection against hanging API calls
const performWebSearchWithTimeout = withLongTimeout(performWebSearch, 'web_search')

export const webSearch = tool(performWebSearchWithTimeout, {
  name: 'web_search',
  description: `Search the web for current information using Tavily Search API.

Use this tool for:
- Current news and events
- Industry trends and benchmarks
- Competitor information and analysis
- Regulatory updates and compliance info
- Market research and reports
- Any information that needs to be current/verified

Search types:
- "general": Broad web search
- "news": Recent news articles (includes published dates)
- "financial": Financial/business data using finance topic
- "competitors": Company comparisons

IMPORTANT:
- Keep queries concise (under 400 characters)
- Use ONE search per topic - don't retry same query
- For stock PRICES, use the stock_price tool instead (this returns articles, not prices)
- Returns AI-generated answer + source articles`,
  schema: z.object({
    query: z.string().describe('Concise search query under 400 characters'),
    maxResults: z.number().optional().default(10).describe('Maximum results to return (max 10)'),
    searchType: z
      .enum(['general', 'news', 'financial', 'competitors'])
      .optional()
      .default('general')
      .describe('Type of search to perform'),
    timeRange: z
      .enum(['day', 'week', 'month', 'year'])
      .optional()
      .describe('Time range filter for results'),
  }),
})
