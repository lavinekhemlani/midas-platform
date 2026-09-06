// src/ai/tools/stockPrice.ts
// Stock price tool using Yahoo Finance API

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { withMediumTimeout } from './utils'
import { logger } from '@/lib/logger'

const STOCK_TIMEOUT_MS = 15000 // 15 seconds

// Cache for stock prices (5 minute TTL)
interface CacheEntry {
  data: StockData
  timestamp: number
}

interface StockData {
  symbol: string
  name: string
  price: number | undefined
  currency: string
  change: number | undefined
  changePercent: number | undefined
  dayHigh: number | undefined
  dayLow: number | undefined
  previousClose: number | undefined
  volume: number | undefined
  marketCap: number | undefined
  fiftyTwoWeekHigh: number | undefined
  fiftyTwoWeekLow: number | undefined
  exchange: string | undefined
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const stockCache = new Map<string, CacheEntry>()

// Yahoo Finance client type
type YahooFinanceClient = InstanceType<typeof import('yahoo-finance2').default>

// Singleton Yahoo Finance client instance
let yahooFinanceClient: YahooFinanceClient | null = null

async function getYahooFinanceClient(): Promise<YahooFinanceClient> {
  if (!yahooFinanceClient) {
    // Dynamic import and instantiate (v3 API requires new YahooFinance())
    const YahooFinance = (await import('yahoo-finance2')).default
    yahooFinanceClient = new YahooFinance({
      suppressNotices: ['yahooSurvey'],
    })
  }
  return yahooFinanceClient
}

// Core stock price fetching logic
async function fetchStockPrices(input: { symbols: string[] }): Promise<string> {
  try {
    let symbols = input.symbols

    // Clean up symbols (uppercase, trim)
    symbols = symbols.map((s) => s.toUpperCase().trim()).filter((s) => s.length > 0)

    if (symbols.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No valid stock symbols provided',
        code: 'VALIDATION',
        retryable: false,
        hint: 'Provide stock ticker symbols like AAPL, GOOGL, MSFT',
      })
    }

    // Limit to 10 symbols per request
    if (symbols.length > 10) {
      symbols = symbols.slice(0, 10)
    }

    logger.info('[stockPrice] Fetching quotes', {
      symbols: symbols.join(', '),
      count: symbols.length,
    })

    // Get the Yahoo Finance client (singleton)
    const yahooFinance = await getYahooFinanceClient()

    const results: Record<string, StockData> = {}
    const errors: string[] = []

    // Fetch quotes for all symbols
    for (const symbol of symbols) {
      // Check cache first
      const cached = stockCache.get(symbol)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        results[symbol] = cached.data
        continue
      }

      try {
        const quote = await yahooFinance.quote(symbol)

        if (quote) {
          const stockData: StockData = {
            symbol: quote.symbol,
            name: quote.shortName || quote.longName || symbol,
            price: quote.regularMarketPrice,
            currency: quote.currency || 'USD',
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            previousClose: quote.regularMarketPreviousClose,
            volume: quote.regularMarketVolume,
            marketCap: quote.marketCap,
            fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
            exchange: quote.exchange,
          }

          results[symbol] = stockData

          // Cache the result
          stockCache.set(symbol, { data: stockData, timestamp: Date.now() })
        } else {
          errors.push(`${symbol}: No data available`)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`${symbol}: ${errorMsg}`)
        logger.warn('[stockPrice] Error fetching symbol', { symbol, error: errorMsg })
      }
    }

    // Format response
    const successCount = Object.keys(results).length
    const response: Record<string, unknown> = {
      success: successCount > 0,
      timestamp: new Date().toISOString(),
      quotesRetrieved: successCount,
      quotes: results,
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    // Add formatted summary for easy reading
    if (successCount > 0) {
      response.summary = Object.values(results)
        .map((q) => {
          const changeSign = (q.change ?? 0) >= 0 ? '+' : ''
          return `${q.symbol} (${q.name}): ${q.currency} ${q.price?.toFixed(2)} ${changeSign}${q.change?.toFixed(2)} (${changeSign}${q.changePercent?.toFixed(2)}%)`
        })
        .join('\n')
    }

    logger.info('[stockPrice] Fetch completed', { successCount, total: symbols.length })
    return JSON.stringify(response)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch stock data'
    const isTimeout = errorMessage.toLowerCase().includes('timeout')
    const isNetwork =
      errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('econnrefused')

    logger.error('[stockPrice] Error', { error: errorMessage })

    return JSON.stringify({
      success: false,
      error: errorMessage,
      code: isTimeout ? 'TIMEOUT' : isNetwork ? 'NETWORK' : 'TOOL_EXECUTION',
      retryable: isTimeout || isNetwork,
      hint: 'Check that the stock symbols are valid (e.g., AAPL for Apple, GOOGL for Google)',
    })
  }
}

// Wrap with timeout for protection against hanging API calls
const fetchStockPricesWithTimeout = withMediumTimeout(fetchStockPrices, 'stock_price')

export const stockPrice = tool(fetchStockPricesWithTimeout, {
  name: 'stock_price',
  description: `Get real-time stock prices and market data for publicly traded companies.

Returns for each stock:
- Current price
- Daily change ($ and %)
- Day high/low
- 52-week high/low
- Market cap
- Volume

Use this tool when the user asks about:
- Stock prices or share prices
- Market cap or valuation
- Stock performance or trading data
- Comparing stock prices between companies

NOTE: This returns actual real-time market data, not search results.`,
  schema: z.object({
    symbols: z
      .array(z.string())
      .describe('Array of stock ticker symbols (e.g., ["AAPL", "GOOGL", "MSFT"])'),
  }),
})
