// src/ai/context-manager.ts
// Token estimation and context management utilities
// Prevents context_length_exceeded errors by trimming messages to fit within model limits

import type { BaseMessage } from '@langchain/core/messages'
import { MODEL_CONFIG } from '@/lib/llm'

// =============================================================================
// Configuration Constants
// =============================================================================

/**
 * Maximum number of messages to keep in context (hard limit as safety net)
 * Even if token budget allows more, we cap at this to prevent extreme cases
 */
export const MAX_CONTEXT_MESSAGES = 50

/**
 * Reserved tokens for the completion/response
 * This ensures the model has room to generate a full response
 */
export const RESERVED_FOR_COMPLETION = 8192

/**
 * Reserved tokens for system prompt overhead
 * Accounts for base system prompt, prefetched data, and memories
 */
export const RESERVED_FOR_SYSTEM = 15000

/**
 * Average characters per token (rough approximation)
 * GPT-style models average ~4 chars per token for English text
 */
const CHARS_PER_TOKEN = 4

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for a given text
 * Uses a rough approximation of ~4 characters per token
 *
 * Note: This is an approximation. For exact counts, use tiktoken,
 * but this is faster and good enough for context management.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Estimate total tokens for a message (content + overhead)
 * Adds ~10 tokens overhead per message for role/formatting
 */
export function estimateMessageTokens(message: BaseMessage): number {
  const content =
    typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

  const contentTokens = estimateTokenCount(content)
  const overheadTokens = 10 // Role, formatting, etc.

  return contentTokens + overheadTokens
}

// =============================================================================
// Context Trimming
// =============================================================================

/**
 * Trim messages to fit within a token budget
 * Keeps the newest messages (from the end of the array) to preserve recent context
 *
 * @param messages - Array of messages to trim
 * @param maxTokens - Maximum tokens allowed for messages
 * @returns Trimmed array of messages that fit within the budget
 */
export function trimMessagesToFitContext(
  messages: BaseMessage[],
  maxTokens: number
): BaseMessage[] {
  if (!messages || messages.length === 0) return []

  // Safety: never exceed MAX_CONTEXT_MESSAGES
  const cappedMessages = messages.slice(-MAX_CONTEXT_MESSAGES)

  let totalTokens = 0
  const result: BaseMessage[] = []

  // Iterate from newest to oldest, adding messages that fit within budget.
  // Skip oversized messages (e.g. huge tool responses) instead of stopping —
  // this ensures the user's latest message is always preserved.
  for (let i = cappedMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(cappedMessages[i])

    if (totalTokens + msgTokens > maxTokens) {
      // Skip this message but keep looking for smaller ones that fit
      continue
    }

    result.unshift(cappedMessages[i])
    totalTokens += msgTokens
  }

  return result
}

/**
 * Calculate available tokens for messages given system prompt size
 * Takes into account the model's context window and reserved tokens
 *
 * @param systemPromptTokens - Tokens used by the system prompt
 * @returns Available tokens for conversation messages
 */
export function calculateAvailableTokens(systemPromptTokens: number): number {
  const available =
    MODEL_CONFIG.contextWindow - systemPromptTokens - RESERVED_FOR_COMPLETION - RESERVED_FOR_SYSTEM

  // Ensure we don't return negative (shouldn't happen, but safety first)
  return Math.max(available, 0)
}

/**
 * Get context management info for logging/debugging
 */
export function getContextInfo(
  messages: BaseMessage[],
  systemPromptTokens: number
): {
  totalMessages: number
  estimatedTokens: number
  availableTokens: number
  willTrim: boolean
  maxMessages: number
} {
  const availableTokens = calculateAvailableTokens(systemPromptTokens)
  const estimatedTokens = messages.reduce((sum, msg) => sum + estimateMessageTokens(msg), 0)

  return {
    totalMessages: messages.length,
    estimatedTokens,
    availableTokens,
    willTrim: estimatedTokens > availableTokens || messages.length > MAX_CONTEXT_MESSAGES,
    maxMessages: MAX_CONTEXT_MESSAGES,
  }
}
