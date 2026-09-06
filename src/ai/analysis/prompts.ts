// src/lib/ai/analysis/prompts.ts
// Simplified prompts for AI analysis - backward compatibility stub

import type { PageType } from '@/components/ai-analysis/types'

/**
 * Build system prompt for financial analysis
 */
export function buildSystemPrompt(pageType: PageType, currency: string = 'USD'): string {
  const basePrompt = `You are an expert financial analyst providing actionable insights for business owners.
Your analysis should be:
- Data-driven and specific to the numbers provided
- Actionable with clear recommendations
- Formatted as valid JSON

Currency: ${currency}

CRITICAL FORMATTING RULES:
- NEVER use LaTeX, TeX, or any mathematical markup (no \\textbf{}, \\text{}, \\frac{}, etc.)
- Use plain text only - no special formatting commands
- Write numbers and formulas in plain English (e.g., "Revenue: $1,234,567" not "\\textbf{Revenue}: $1,234,567")
- Bold and formatting will be applied by the UI - just provide clean text

Always respond with valid JSON in this exact structure:
{
  "strategicInsights": [
    "Insight 1 with specific data points and analysis",
    "Insight 2 with specific data points and analysis"
  ],
  "forwardLooking": [
    "Prediction or trend 1 with confidence level if applicable",
    "Prediction or trend 2 with confidence level if applicable"
  ],
  "prioritizedActions": [
    { "action": "Specific action to take", "impact": "Expected business impact", "timeline": "When to implement" }
  ]
}`

  const pagePrompts: Record<PageType, string> = {
    pnl: `${basePrompt}

Focus on:
- Revenue trends and growth patterns
- Cost management and margin analysis
- Profitability drivers and concerns
- Comparison to industry benchmarks where applicable`,

    cashflow: `${basePrompt}

Focus on:
- Cash position and liquidity
- Operating cash flow efficiency
- Investing and financing activities
- Cash runway and burn rate if applicable`,

    balancesheet: `${basePrompt}

Focus on:
- Asset composition and quality
- Liability management
- Working capital position
- Financial health ratios (current ratio, debt-to-equity)`,

    sales: `${basePrompt}

Focus on:
- Sales trends and patterns
- Top customers and revenue concentration
- Sales velocity and conversion
- Opportunities for growth`,

    expenses: `${basePrompt}

Focus on:
- Expense categorization and trends
- Cost reduction opportunities
- Fixed vs variable cost analysis
- Unusual or concerning expenses`,

    journal: `${basePrompt}

Focus on:
- Transaction patterns
- Accounting accuracy
- Unusual entries
- Reconciliation status`,

    summary: `${basePrompt}

Provide a comprehensive overview covering:
- Overall financial health
- Key performance indicators
- Major concerns requiring attention
- Strategic recommendations`,
  }

  return pagePrompts[pageType] || basePrompt
}

/**
 * Build user prompt with data context
 */
export function buildUserPrompt(
  pageType: PageType,
  data: any,
  dateRange: { start: string; end: string },
  context: Record<string, any> = {}
): string {
  const currency = context.currency || 'USD'

  const prompt = `Analyze the following ${pageType.toUpperCase()} data for the period ${dateRange.start} to ${dateRange.end}.

Currency: ${currency}

Data:
${JSON.stringify(data, null, 2)}

${context.additionalContext ? `Additional Context: ${context.additionalContext}` : ''}

Provide your analysis as valid JSON following the structure specified in the system prompt.`

  return prompt
}
