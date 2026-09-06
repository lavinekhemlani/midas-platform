// src/ai/tools/calculator.ts
// Financial calculations tool

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const financialCalculator = tool(
  async (input: {
    calculation: string
    cashBalance?: number
    monthlyExpenses?: number
    monthlyRevenue?: number
    months?: number
    targetMargin?: number
    growthRate?: number
    changes?: Record<string, number>
  }): Promise<string> => {
    try {
      switch (input.calculation) {
        case 'burn_rate': {
          const months = input.months || 1
          const expenses = input.monthlyExpenses || 0
          return JSON.stringify({
            success: true,
            calculation: 'burn_rate',
            result: {
              monthlyBurnRate: expenses,
              period: `${months} month(s)`,
              projection: {
                '3_months': expenses * 3,
                '6_months': expenses * 6,
                '12_months': expenses * 12,
              },
            },
          })
        }

        case 'runway': {
          const cash = input.cashBalance || 0
          const burn = input.monthlyExpenses || 0
          const runwayMonths = burn > 0 ? cash / burn : 999

          return JSON.stringify({
            success: true,
            calculation: 'runway',
            result: {
              cashBalance: cash,
              monthlyBurn: burn,
              runwayMonths: Math.round(runwayMonths * 100) / 100,
              runoutDate:
                runwayMonths < 999
                  ? new Date(Date.now() + runwayMonths * 30 * 24 * 60 * 60 * 1000).toISOString()
                  : null,
              status:
                runwayMonths >= 999
                  ? 'Infinite (positive cash flow)'
                  : runwayMonths >= 12
                    ? 'Healthy'
                    : runwayMonths >= 6
                      ? 'Caution'
                      : 'Critical',
            },
          })
        }

        case 'break_even': {
          const revenue = input.monthlyRevenue || 0
          const expenses = input.monthlyExpenses || 0
          const targetMargin = input.targetMargin || 0
          const growthRate = input.growthRate || 0.1

          if (revenue >= expenses + targetMargin) {
            return JSON.stringify({
              success: true,
              calculation: 'break_even',
              result: {
                status: 'already_profitable',
                currentMargin: revenue - expenses,
                targetMargin,
              },
            })
          }

          let months = 0
          let projectedRevenue = revenue
          while (projectedRevenue - expenses < targetMargin && months < 120) {
            months++
            projectedRevenue *= 1 + growthRate
          }

          return JSON.stringify({
            success: true,
            calculation: 'break_even',
            result: {
              currentRevenue: revenue,
              currentExpenses: expenses,
              currentMargin: revenue - expenses,
              monthsToBreakEven: months,
              requiredRevenue: expenses + targetMargin,
              projectedDate: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          })
        }

        case 'what_if': {
          const baseline = {
            revenue: input.monthlyRevenue || 0,
            expenses: input.monthlyExpenses || 0,
            cash: input.cashBalance || 0,
          }

          const changes = input.changes || {}
          const projected = {
            revenue: baseline.revenue * (1 + (changes.revenueChange || 0) / 100),
            expenses:
              baseline.expenses * (1 + (changes.expenseChange || 0) / 100) +
              (changes.additionalExpense || 0),
            cash: baseline.cash,
          }

          const baselineRunway =
            baseline.expenses - baseline.revenue > 0
              ? baseline.cash / (baseline.expenses - baseline.revenue)
              : 999

          const projectedRunway =
            projected.expenses - projected.revenue > 0
              ? projected.cash / (projected.expenses - projected.revenue)
              : 999

          return JSON.stringify({
            success: true,
            calculation: 'what_if',
            result: {
              baseline,
              projected,
              impact: {
                runwayChange:
                  projectedRunway === 999 || baselineRunway === 999
                    ? 'N/A'
                    : Math.round((projectedRunway - baselineRunway) * 100) / 100,
                marginChange:
                  projected.revenue - projected.expenses - (baseline.revenue - baseline.expenses),
                status:
                  projected.revenue >= projected.expenses
                    ? 'Achieves profitability'
                    : 'Remains unprofitable',
              },
            },
          })
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown calculation type: ${input.calculation}`,
            code: 'VALIDATION',
            retryable: false,
            hint: 'Use one of: burn_rate, runway, break_even, what_if',
          })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('[Calculator] Calculation failed', {
        calculation: input.calculation,
        error: errorMessage,
      })
      return JSON.stringify({
        success: false,
        error: `Calculation failed: ${errorMessage}`,
        code: 'TOOL_EXECUTION',
        retryable: false,
        hint: 'Check input values are valid numbers.',
      })
    }
  },
  {
    name: 'financial_calculator',
    description: `Performs financial calculations:
- burn_rate: Calculate monthly burn rate from expenses
- runway: Calculate cash runway (months until cash runs out)
- break_even: Calculate months to break-even given growth rate
- what_if: Scenario analysis with revenue/expense changes

Provide the relevant parameters for each calculation type.`,
    schema: z.object({
      calculation: z
        .enum(['burn_rate', 'runway', 'break_even', 'what_if'])
        .describe('Type of calculation'),
      cashBalance: z.number().optional().describe('Current cash balance'),
      monthlyExpenses: z.number().optional().describe('Monthly expenses/burn'),
      monthlyRevenue: z.number().optional().describe('Monthly revenue'),
      months: z.number().optional().describe('Number of months for burn rate calculation'),
      targetMargin: z.number().optional().describe('Target profit margin for break-even'),
      growthRate: z.number().optional().describe('Monthly growth rate (decimal, e.g., 0.1 = 10%)'),
      changes: z
        .object({
          revenueChange: z.number().optional().describe('Percentage change in revenue'),
          expenseChange: z.number().optional().describe('Percentage change in expenses'),
          additionalExpense: z.number().optional().describe('Additional fixed expense'),
        })
        .optional()
        .describe('Changes for what-if analysis'),
    }),
  }
)
