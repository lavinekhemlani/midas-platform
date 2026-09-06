// src/ai/tools/suggestActions.ts
// LLM tool for emitting follow-up suggestions and clarification options
// The agent calls this at the end of every response to suggest next actions

import { tool } from '@langchain/core/tools'
import { z } from 'zod'

const suggestActionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        label: z
          .string()
          .describe('Short display text (2-5 words), e.g. "Break down by month"'),
        prompt: z
          .string()
          .describe(
            'Full prompt to send if clicked, e.g. "Break down last year\'s P&L by month and show me the trend"'
          ),
        type: z
          .enum(['follow_up', 'drill_down', 'compare', 'clarify'])
          .optional()
          .describe(
            'Suggestion type. "clarify" renders as inline options in the message. Others render below as follow-up buttons.'
          ),
      })
    )
    .min(2)
    .max(4)
    .describe('2-4 follow-up suggestions for the user'),
})

export const suggestActions = tool(
  async (input) => {
    // This tool is a pass-through — the SSE handler in the chat route
    // picks up the result and emits it as a 'suggestions' event to the client.
    // The tool just validates and returns the suggestions.
    return JSON.stringify({
      success: true,
      suggestions: input.suggestions,
    })
  },
  {
    name: 'suggest_actions',
    description: `Suggest 2-4 follow-up actions the user might want to take next. Call this at the END of every response.

These become clickable buttons for the user. Make them:
- Contextually relevant to what you just discussed
- Progressively deeper (drill-down, compare, forecast)
- Include the user's company name, provider names, and specific data when applicable
- Short labels (2-5 words) but full, detailed prompts

Types:
- "follow_up": General next step (default)
- "drill_down": Deeper analysis of what was just shown
- "compare": Period or cross-provider comparison
- "clarify": Use when asking the user to choose between options (renders inline as clickable pills)

Example:
{
  "suggestions": [
    { "label": "Monthly breakdown", "prompt": "Break down the P&L by month for 2025", "type": "drill_down" },
    { "label": "Compare to 2024", "prompt": "Compare this year's revenue to last year", "type": "compare" },
    { "label": "Top expenses", "prompt": "Show me the top 10 expense categories", "type": "follow_up" }
  ]
}`,
    schema: suggestActionsSchema,
  }
)
