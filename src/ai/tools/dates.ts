// src/ai/tools/dates.ts
// Date calculation and parsing utilities

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// =============================================================================
// Date Range Helper
// =============================================================================

export function getDateRange(period?: string): { start: string; end: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  // Use local date formatting to avoid UTC timezone conversion issues
  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  switch (period) {
    case 'this_month':
      return {
        start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        end: formatDate(now),
      }
    case 'last_month': {
      const lastMonth = month === 0 ? 11 : month - 1
      const lastMonthYear = month === 0 ? year - 1 : year
      const lastDay = new Date(year, month, 0).getDate()
      return {
        start: `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`,
        end: `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${lastDay}`,
      }
    }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3
      return {
        start: `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`,
        end: formatDate(now),
      }
    }
    case 'last_quarter': {
      const currentQuarter = Math.floor(month / 3)
      const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
      const lastQuarterYear = currentQuarter === 0 ? year - 1 : year
      const quarterStartMonth = lastQuarter * 3
      const quarterEndMonth = quarterStartMonth + 2
      const lastDay = new Date(lastQuarterYear, quarterEndMonth + 1, 0).getDate()
      return {
        start: `${lastQuarterYear}-${String(quarterStartMonth + 1).padStart(2, '0')}-01`,
        end: `${lastQuarterYear}-${String(quarterEndMonth + 1).padStart(2, '0')}-${lastDay}`,
      }
    }
    case 'this_year':
      return { start: `${year}-01-01`, end: formatDate(now) }
    case 'last_year':
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` }
    default:
      // Default to This Year (YTD) when no period specified
      return {
        start: `${year}-01-01`,
        end: formatDate(now),
      }
  }
}

// =============================================================================
// Date Calculator Tool
// =============================================================================

export const dateCalculator = tool(
  async (input: {
    action: string
    dateExpression?: string
    date1?: string
    date2?: string
  }): Promise<string> => {
    try {
      const now = new Date()

      switch (input.action) {
        case 'parse': {
          const expr = input.dateExpression?.toLowerCase().trim() || ''
          let result: Date | null = null

          if (expr === 'today') result = now
          else if (expr === 'tomorrow') {
            result = new Date(now)
            result.setDate(result.getDate() + 1)
          } else if (expr === 'yesterday') {
            result = new Date(now)
            result.setDate(result.getDate() - 1)
          } else if (expr.includes('next week')) {
            result = new Date(now)
            result.setDate(result.getDate() + 7)
          } else if (expr.includes('next month')) {
            result = new Date(now)
            result.setMonth(result.getMonth() + 1)
          } else if (expr.includes('end of month')) {
            result = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          } else if (expr.includes('end of quarter')) {
            const quarter = Math.floor(now.getMonth() / 3)
            result = new Date(now.getFullYear(), (quarter + 1) * 3, 0)
          } else if (expr.includes('end of year')) {
            result = new Date(now.getFullYear(), 11, 31)
          } else {
            result = new Date(expr)
            if (isNaN(result.getTime())) result = null
          }

          if (!result) {
            return JSON.stringify({
              success: false,
              error: `Could not parse date expression: ${input.dateExpression}`,
            })
          }

          return JSON.stringify({
            success: true,
            dateExpression: input.dateExpression,
            parsedDate: result.toISOString(),
            isoDate: result.toISOString().split('T')[0],
            humanReadable: result.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
          })
        }

        case 'days_between': {
          const d1 = new Date(input.date1 || now)
          const d2 = new Date(input.date2 || now)
          const days = Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24))

          return JSON.stringify({
            success: true,
            date1: d1.toISOString().split('T')[0],
            date2: d2.toISOString().split('T')[0],
            daysBetween: days,
            description:
              days > 0
                ? `${days} days in the future`
                : days < 0
                  ? `${Math.abs(days)} days in the past`
                  : 'Same day',
          })
        }

        case 'current_date': {
          return JSON.stringify({
            success: true,
            currentDate: now.toISOString().split('T')[0],
            fullDate: now.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            time: now.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
            }),
            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
            month: now.toLocaleDateString('en-US', { month: 'long' }),
            year: now.getFullYear(),
          })
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown action: ${input.action}`,
            code: 'VALIDATION',
            retryable: false,
            hint: 'Use one of: parse, days_between, current_date',
          })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('[DateCalculator] Failed', { action: input.action, error: errorMessage })
      return JSON.stringify({
        success: false,
        error: `Date calculation failed: ${errorMessage}`,
        code: 'TOOL_EXECUTION',
        retryable: false,
        hint: 'Check that date formats are valid (YYYY-MM-DD).',
      })
    }
  },
  {
    name: 'date_calculator',
    description: `Handles date operations:
- parse: Parse relative date expressions (e.g., "next week", "end of month")
- days_between: Calculate days between two dates
- current_date: Get current date and time information`,
    schema: z.object({
      action: z
        .enum(['parse', 'days_between', 'current_date'])
        .describe('The date operation to perform'),
      dateExpression: z
        .string()
        .optional()
        .describe('Relative date expression to parse (for parse action)'),
      date1: z.string().optional().describe('First date for comparison (YYYY-MM-DD)'),
      date2: z.string().optional().describe('Second date for comparison (YYYY-MM-DD)'),
    }),
  }
)
