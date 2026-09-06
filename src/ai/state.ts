// src/ai/state.ts
// Stateful agent annotation for LangGraph with persistence
// Enables self-aware context across conversation threads

import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import type { BaseMessage } from '@langchain/core/messages'

/**
 * Tool execution result for tracking
 */
export interface ToolResult {
  toolName: string
  toolCallId: string
  success: boolean
  data?: unknown
  error?: string
  duration: number
}

/**
 * Extended Agent State Annotation
 *
 * Unlike MessagesAnnotation (just messages), this stores:
 * - messages: conversation history
 * - prefetchedData: cached financial data (persists across thread)
 * - memories: user memories/preferences
 * - toolResults: accumulated tool execution results
 *
 * With MemorySaver checkpointer, this state persists across
 * multiple requests within the same thread_id.
 */
export const AgentState = Annotation.Root({
  // Core conversation messages (uses LangGraph's built-in reducer)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Pre-fetched financial data (merged across updates)
  // Key: report type, Value: report data
  // Persists so we don't re-fetch same data within a conversation
  prefetchedData: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // Formatted memories string from memory service
  // Replaced on each update (latest wins)
  memories: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // Tool execution results (accumulated for self-awareness)
  // Agent can see what tools succeeded/failed
  // LIMITED TO 10 ENTRIES to prevent unbounded growth
  // Keeps most recent results (FIFO eviction)
  toolResults: Annotation<ToolResult[]>({
    reducer: (prev, next) => {
      const MAX_TOOL_RESULTS = 10
      const combined = [...prev, ...next]
      // Keep only the most recent entries
      return combined.length > MAX_TOOL_RESULTS ? combined.slice(-MAX_TOOL_RESULTS) : combined
    },
    default: () => [],
  }),

  // Context metadata (company info, currency, etc.)
  // Stored so agent remembers context across messages
  contextMeta: Annotation<{
    companyName?: string
    currency?: string
    userId?: string
    organizationId?: string
    currentTheme?: 'light' | 'dark'
  }>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
})

// Export the state type for use in nodes and route
export type AgentStateType = typeof AgentState.State
