// src/ai/tools/memory.ts
// Unified memory tool for LangGraph agent
// Returns [[WIDGET:N]] markers for visual display in chat

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { MemoryService } from '../memory/memoryService'
import { MEMORY_TYPE_DESCRIPTIONS, MEMORY_TYPE_LABELS } from '../memory/types'
import type { MemoryType, Memory } from '../memory/types'
import type { WidgetBlock, MemoryDisplayItem } from '../widgets/types'
import { logger } from '@/lib/logger'

// =============================================================================
// Widget Index Tracking (session-scoped to prevent race conditions)
// =============================================================================

// Session-scoped widget index storage to prevent race conditions in concurrent requests.
// Previously, a global `currentWidgetIndex` variable caused widget indexes to corrupt
// when multiple requests ran simultaneously. Now each session maintains its own counter.
const sessionWidgetIndexes = new Map<string, number>()

/**
 * Get the current widget index for a session
 */
function getSessionWidgetIndex(sessionId: string): number {
  return sessionWidgetIndexes.get(sessionId) || 0
}

/**
 * Increment and return the widget index for a session
 */
function incrementSessionWidgetIndex(sessionId: string): number {
  const current = getSessionWidgetIndex(sessionId)
  const next = current + 1
  sessionWidgetIndexes.set(sessionId, next)
  return next
}

/**
 * Reset widget index for a specific session or all sessions
 * @param sessionId - Optional session ID. If not provided, clears all sessions.
 */
export function resetWidgetIndex(sessionId?: string) {
  if (sessionId) {
    sessionWidgetIndexes.delete(sessionId)
  } else {
    sessionWidgetIndexes.clear()
  }
}

// =============================================================================
// Schema
// =============================================================================

const memorySchema = z.object({
  action: z
    .enum(['remember', 'search', 'update', 'forget', 'list'])
    .describe('The action to perform on memories'),

  // For 'remember' action
  type: z
    .enum(['expense', 'income', 'goal', 'deadline', 'context', 'preference', 'decision'])
    .optional()
    .describe('Type of memory to store'),
  content: z.string().optional().describe('The content/description of the memory'),
  amount: z.number().optional().describe('Financial amount if applicable'),
  currency: z.string().optional().describe('Currency code (e.g., USD, EUR)'),
  date: z
    .string()
    .optional()
    .describe(
      'Date in YYYY-MM-DD format. For expenses/income: when it is due. For deadlines: the deadline date. ' +
        'For goals/KPIs/budgets: the start date of when the target takes effect (use today if not specified). ' +
        'For decisions/context: use today. Never use query date ranges as the memory date.'
    ),
  category: z.string().optional().describe('Category for organization'),
  priority: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('Priority level for deadlines/goals'),
  recurring: z.boolean().optional().describe('Whether this is a recurring item'),
  frequency: z
    .enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
    .optional()
    .describe('Recurrence frequency'),

  // For 'search' action
  query: z.string().optional().describe('Search query to find memories'),

  // For 'update' and 'forget' actions
  memoryId: z.string().optional().describe('ID of the memory to update or delete'),
})

// =============================================================================
// Tool Description
// =============================================================================

const typeDescriptions = Object.entries(MEMORY_TYPE_DESCRIPTIONS)
  .map(([type, desc]) => `  - ${type}: ${desc}`)
  .join('\n')

const toolDescription = `Store, search, update, or delete user memories. Returns a [[WIDGET:N]] marker to display results visually.

**Actions:**
- remember: Store a new memory (requires type and content) → shows confirmation widget
- search: Find memories matching a query → shows list widget
- update: Modify an existing memory (requires memoryId) → shows update confirmation
- forget: Delete a memory (requires memoryId) → shows deletion confirmation
- list: Get recent memories → shows list widget

**Memory Types:**
${typeDescriptions}

**Guidelines:**
- For expenses/income: always include amount, date (when due), and currency
- For deadlines: include date and priority
- For goals/KPIs/budgets: include amount, date (when it takes effect — use today if not specified), and set recurring + frequency if it's an ongoing target
- For decisions/context: date should be today (when the decision was made)
- The returned [[WIDGET:N]] marker will render a visual widget in the chat
- Include the marker in your response where you want the widget to appear

**Examples:**
- User: "remember I have a $10k payment due Dec 15" → action: "remember", type: "expense", content: "Payment due", amount: 10000, date: "2024-12-15"
- User: "what expenses do I have coming up?" → action: "search", type: "expense"
- User: "forget about the software renewal" → first search, then action: "forget", memoryId: "<found_id>"`

// =============================================================================
// Main Tool
// =============================================================================

export const memoryTool = tool(
  async (input, config): Promise<string> => {
    const { organizationId, userId, sessionId, realmId } = (config?.configurable || {}) as {
      organizationId?: string
      userId?: string
      sessionId?: string
      realmId?: string // QuickBooks realm ID for scoping (like chat history)
    }

    if (!organizationId || !userId) {
      return JSON.stringify({
        success: false,
        error: 'Missing user context. Unable to access memories.',
      })
    }

    // Use sessionId for widget tracking, fallback to 'default' if not provided
    const effectiveSessionId = sessionId || 'default'
    // Pass realmId for QuickBooks company-scoped memories (like chat history)
    const service = new MemoryService(userId, organizationId, realmId)

    try {
      switch (input.action) {
        case 'remember': {
          if (!input.type || !input.content) {
            return JSON.stringify({
              success: false,
              error: 'Both type and content are required to store a memory',
            })
          }

          const memory = await service.create({
            type: input.type as MemoryType,
            content: input.content,
            metadata: {
              amount: input.amount,
              currency: input.currency,
              date: input.date,
              category: input.category,
              priority: input.priority,
              recurring: input.recurring,
              frequency: input.frequency,
            },
            source: 'user',
          })

          const widgetIndex = incrementSessionWidgetIndex(effectiveSessionId)

          const widget: WidgetBlock = {
            type: 'memory:created',
            widgetIndex,
            memory: formatMemoryForDisplay(memory),
          }

          return JSON.stringify({
            success: true,
            action: 'remember',
            widget,
            widgetIndex,
            marker: `[[WIDGET:${widgetIndex}]]`,
            instruction: `Memory stored. Include [[WIDGET:${widgetIndex}]] in your response to show the confirmation.`,
          })
        }

        case 'search': {
          const memories = await service.search({
            type: input.type as MemoryType | undefined,
            searchQuery: input.query,
            limit: 10,
          })

          const widgetIndex = incrementSessionWidgetIndex(effectiveSessionId)

          const widget: WidgetBlock = {
            type: 'memory:list',
            widgetIndex,
            title: input.query
              ? `Memories matching "${input.query}"`
              : input.type
                ? `${MEMORY_TYPE_LABELS[input.type as MemoryType]}s`
                : 'Stored Memories',
            memories: memories.map(formatMemoryForDisplay),
            filterType: input.type as MemoryType | undefined,
            emptyMessage: 'No matching memories found.',
          }

          return JSON.stringify({
            success: true,
            action: 'search',
            count: memories.length,
            widget,
            widgetIndex,
            marker: `[[WIDGET:${widgetIndex}]]`,
            instruction:
              memories.length > 0
                ? `Found ${memories.length} memories. Include [[WIDGET:${widgetIndex}]] to display them.`
                : `No memories found. Include [[WIDGET:${widgetIndex}]] to show the empty state.`,
            // Also include raw data for AI to reference
            memories: memories.map((m) => ({
              id: m.id,
              type: m.type,
              content: m.content,
              amount: m.metadata.amount,
              date: m.metadata.date,
            })),
          })
        }

        case 'list': {
          const memories = await service.search({
            type: input.type as MemoryType | undefined,
            limit: 20,
          })

          const widgetIndex = incrementSessionWidgetIndex(effectiveSessionId)

          const widget: WidgetBlock = {
            type: 'memory:list',
            widgetIndex,
            title: input.type
              ? `${MEMORY_TYPE_LABELS[input.type as MemoryType]}s`
              : 'All Stored Memories',
            memories: memories.map(formatMemoryForDisplay),
            filterType: input.type as MemoryType | undefined,
            emptyMessage: 'No memories stored yet.',
          }

          return JSON.stringify({
            success: true,
            action: 'list',
            count: memories.length,
            widget,
            widgetIndex,
            marker: `[[WIDGET:${widgetIndex}]]`,
            instruction: `Include [[WIDGET:${widgetIndex}]] to display the ${memories.length} stored memories.`,
          })
        }

        case 'update': {
          if (!input.memoryId) {
            return JSON.stringify({
              success: false,
              error: 'Memory ID is required for update. Use search first to find the memory.',
            })
          }

          // Get original memory for comparison
          const original = await service.get(input.memoryId)
          if (!original) {
            return JSON.stringify({
              success: false,
              error: 'Memory not found',
            })
          }

          const updated = await service.update(input.memoryId, {
            content: input.content,
            metadata: {
              ...(input.amount !== undefined && { amount: input.amount }),
              ...(input.currency && { currency: input.currency }),
              ...(input.date && { date: input.date }),
              ...(input.category && { category: input.category }),
              ...(input.priority && { priority: input.priority }),
              ...(input.recurring !== undefined && { recurring: input.recurring }),
              ...(input.frequency && { frequency: input.frequency }),
            },
          })

          if (!updated) {
            return JSON.stringify({
              success: false,
              error: 'Failed to update memory',
            })
          }

          // Track what changed
          const changes: string[] = []
          if (input.content && input.content !== original.content) changes.push('content')
          if (input.amount !== undefined && input.amount !== original.metadata.amount)
            changes.push('amount')
          if (input.date && input.date !== original.metadata.date) changes.push('date')
          if (input.category && input.category !== original.metadata.category)
            changes.push('category')

          const widgetIndex = incrementSessionWidgetIndex(effectiveSessionId)

          const widget: WidgetBlock = {
            type: 'memory:updated',
            widgetIndex,
            memory: formatMemoryForDisplay(updated),
            changes,
          }

          return JSON.stringify({
            success: true,
            action: 'update',
            widget,
            widgetIndex,
            marker: `[[WIDGET:${widgetIndex}]]`,
            instruction: `Memory updated. Include [[WIDGET:${widgetIndex}]] to show the changes.`,
          })
        }

        case 'forget': {
          if (!input.memoryId) {
            return JSON.stringify({
              success: false,
              error: 'Memory ID is required for deletion. Use search first to find the memory.',
            })
          }

          // Get memory before deleting for confirmation display
          const toDelete = await service.get(input.memoryId)
          if (!toDelete) {
            return JSON.stringify({
              success: false,
              error: 'Memory not found',
            })
          }

          const deleted = await service.delete(input.memoryId)

          const widgetIndex = incrementSessionWidgetIndex(effectiveSessionId)

          const widget: WidgetBlock = {
            type: 'memory:deleted',
            widgetIndex,
            memoryContent: toDelete.content,
            memoryType: toDelete.type,
          }

          return JSON.stringify({
            success: deleted,
            action: 'forget',
            widget,
            widgetIndex,
            marker: `[[WIDGET:${widgetIndex}]]`,
            instruction: deleted
              ? `Memory deleted. Include [[WIDGET:${widgetIndex}]] to confirm.`
              : 'Failed to delete memory.',
          })
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown action: ${input.action}`,
          })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      logger.error('[MemoryTool] Error', { action: input.action, error: errorMessage })
      return JSON.stringify({
        success: false,
        error: errorMessage,
        code: 'TOOL_EXECUTION',
        retryable: false,
        hint: 'Memory operation failed. Try again or use a different action.',
      })
    }
  },
  {
    name: 'memory',
    description: toolDescription,
    schema: memorySchema,
  }
)

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format memory for widget display
 */
function formatMemoryForDisplay(memory: Memory): MemoryDisplayItem {
  return {
    id: memory.id,
    type: memory.type,
    typeLabel: MEMORY_TYPE_LABELS[memory.type],
    content: memory.content,
    amount: memory.metadata.amount,
    currency: memory.metadata.currency,
    date: memory.metadata.date,
    category: memory.metadata.category,
    priority: memory.metadata.priority,
    recurring: memory.metadata.recurring,
    frequency: memory.metadata.frequency,
    createdAt: new Date(memory.createdAt).toISOString(),
  }
}

/**
 * Get memories for AI context injection
 * Called by the chat API to provide relevant memories to the agent
 *
 * @param userId - User ID
 * @param organizationId - Organization ID
 * @param realmId - QuickBooks realm ID for scoping (like chat history)
 * @param priorityTypes - Optional array of memory types to prioritize (for query-aligned retrieval)
 * @param limit - Maximum number of memories to return
 */
export async function getMemoriesForContext(
  userId: string,
  organizationId: string,
  realmId?: string,
  priorityTypes: MemoryType[] = [],
  limit = 10
): Promise<string> {
  // Pass realmId for QuickBooks company-scoped memories (like chat history)
  const service = new MemoryService(userId, organizationId, realmId)

  let memories: Memory[]

  if (priorityTypes.length > 0) {
    // Query-aligned retrieval: prioritize specific memory types
    // This improves context relevance for specific intents (e.g., forecast queries get expense/income memories)
    const priorityLimit = Math.ceil(limit * 0.7) // 70% priority types
    const otherLimit = limit - priorityLimit

    // Fetch priority type memories
    const priorityPromises = priorityTypes.slice(0, 2).map((type) =>
      service.search({
        type,
        limit: Math.ceil(priorityLimit / Math.min(priorityTypes.length, 2)),
      })
    )

    const [priorityResults, otherMemories] = await Promise.all([
      Promise.all(priorityPromises),
      service.getRelevantForContext(otherLimit),
    ])

    // Combine priority results
    const priorityMemories = priorityResults.flat()

    // Dedupe by ID and combine
    const seen = new Set<string>()
    memories = []

    // Priority memories first
    for (const m of priorityMemories) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        memories.push(m)
      }
    }

    // Then other relevant memories
    for (const m of otherMemories) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        memories.push(m)
      }
    }

    memories = memories.slice(0, limit)
  } else {
    // Default behavior: relevance-based retrieval
    memories = await service.getRelevantForContext(limit)
  }

  if (memories.length === 0) {
    return ''
  }

  const sections: string[] = []

  // Group by type
  const byType = new Map<MemoryType, Memory[]>()
  for (const m of memories) {
    const list = byType.get(m.type) || []
    list.push(m)
    byType.set(m.type, list)
  }

  // Format each section
  for (const [type, items] of byType) {
    const label = MEMORY_TYPE_LABELS[type]
    const lines = items.map((m) => {
      let line = `- ${m.content}`
      if (m.metadata.amount) {
        line += ` (${m.metadata.currency || 'USD'} ${m.metadata.amount.toLocaleString()})`
      }
      if (m.metadata.date) {
        const date = new Date(m.metadata.date)
        line += ` [${date.toLocaleDateString()}]`
      }
      return line
    })
    sections.push(`**${label}s:**\n${lines.join('\n')}`)
  }

  return `\n## Stored Memories\n${sections.join('\n\n')}`
}
