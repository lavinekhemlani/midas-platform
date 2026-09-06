// src/lib/ai/tools/intentAnalyzer.ts
// Intent analysis types and utilities for memory retrieval

export interface IntentTopic {
  name: string
  confidence: number
}

export interface EnrichedIntent {
  primaryIntent: string
  topics: IntentTopic[]
  confidence: number
  context?: {
    timeframe?: string
    entities?: string[]
  }
}

/**
 * Analyze user query to extract intent and topics
 * This is a placeholder implementation - can be enhanced with ML models
 */
export function analyzeIntent(query: string): EnrichedIntent {
  const queryLower = query.toLowerCase()

  // Simple rule-based intent detection
  let primaryIntent = 'general_query'
  const topics: IntentTopic[] = []

  if (
    queryLower.includes('expense') ||
    queryLower.includes('cost') ||
    queryLower.includes('spend')
  ) {
    primaryIntent = 'expense_query'
    topics.push({ name: 'expenses', confidence: 0.9 })
  } else if (
    queryLower.includes('revenue') ||
    queryLower.includes('income') ||
    queryLower.includes('sales')
  ) {
    primaryIntent = 'revenue_query'
    topics.push({ name: 'revenue', confidence: 0.9 })
  } else if (queryLower.includes('goal') || queryLower.includes('target')) {
    primaryIntent = 'goal_query'
    topics.push({ name: 'goals', confidence: 0.9 })
  } else if (
    queryLower.includes('deadline') ||
    queryLower.includes('date') ||
    queryLower.includes('due')
  ) {
    primaryIntent = 'date_query'
    topics.push({ name: 'dates', confidence: 0.9 })
  }

  return {
    primaryIntent,
    topics,
    confidence: topics.length > 0 ? 0.8 : 0.5,
    context: {
      timeframe: extractTimeframe(queryLower),
      entities: extractEntities(queryLower),
    },
  }
}

function extractTimeframe(query: string): string | undefined {
  if (query.includes('next month')) return 'next_month'
  if (query.includes('this month')) return 'this_month'
  if (query.includes('next quarter')) return 'next_quarter'
  if (query.includes('this quarter')) return 'this_quarter'
  if (query.includes('next year')) return 'next_year'
  if (query.includes('this year')) return 'this_year'
  return undefined
}

function extractEntities(query: string): string[] {
  const entities: string[] = []
  // Simple entity extraction - can be enhanced
  const words = query.split(/\s+/)
  for (const word of words) {
    if (word.startsWith('$') || /^\d+(\.\d+)?$/.test(word)) {
      entities.push(word)
    }
  }
  return entities
}
