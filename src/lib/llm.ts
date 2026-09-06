// src/lib/llm.ts
// Simplified LLM configuration - Groq only with openai/gpt-oss-120b
//
// IMPORTANT: Context Window Management
// ------------------------------------
// The contextWindow and maxCompletionTokens values are used by the
// context-manager.ts to trim messages before sending to the model.
// If you change these values, the context trimming behavior will adjust.
//
// Current limits for openai/gpt-oss-120b on Groq:
// - Context window: 100K tokens (input + output combined)
// - Max completion: 50K tokens (maximum response length)
// - Effective input limit: ~50K tokens after reserving for completion

import { ChatGroq } from '@langchain/groq'
import { logger } from '@/lib/logger'

// =============================================================================
// Model Configuration
// =============================================================================

/**
 * Centralized model configuration used across the application.
 *
 * These values are used by:
 * - src/ai/agent.ts: For creating the LLM instance
 * - src/ai/context-manager.ts: For calculating available tokens and trimming messages
 *
 * @property name - The Groq model identifier
 * @property displayName - Human-readable model name for UI/logs
 * @property contextWindow - Total context window in tokens (input + output)
 * @property maxCompletionTokens - Maximum tokens reserved for model response
 * @property provider - The LLM provider (always 'groq' for now)
 */
export const MODEL_CONFIG = {
  name: 'openai/gpt-oss-120b',
  displayName: 'GPT-OSS 120B',
  contextWindow: 100000, // 100K total context window
  maxCompletionTokens: 50000, // Reserve 50K for response
  provider: 'groq',
} as const

export type LLMProvider = 'groq'
export type LLMModel = 'openai/gpt-oss-120b'

// =============================================================================
// LLM Creation
// =============================================================================

export interface CreateLLMOptions {
  temperature?: number
  maxTokens?: number
  streaming?: boolean
}

export function createLLM(options: CreateLLMOptions = {}): ChatGroq {
  const { temperature = 0.3, maxTokens, streaming = false } = options

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set')
  }

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: MODEL_CONFIG.name,
    temperature,
    maxTokens: maxTokens || MODEL_CONFIG.maxCompletionTokens,
    streaming,
    callbacks: [
      {
        handleLLMEnd: (output) => {
          // Log token usage if available from the response
          const tokenUsage = output.llmOutput?.tokenUsage
          if (tokenUsage) {
            const totalTokens = tokenUsage.totalTokens || 0
            const promptTokens = tokenUsage.promptTokens || 0
            const completionTokens = tokenUsage.completionTokens || 0

            logger.tokenUsage(MODEL_CONFIG.provider, totalTokens, {
              model: MODEL_CONFIG.name,
              promptTokens,
              completionTokens,
              temperature,
              maxTokens: maxTokens || MODEL_CONFIG.maxCompletionTokens,
            })
          }
        },
      },
    ],
  })

  return llm
}

// Convenience function
export function makeGroq(options?: CreateLLMOptions) {
  return createLLM(options)
}

// For backward compatibility with code expecting these exports
export const getDefaultProvider = () => 'groq' as const
export const getDefaultModel = () => MODEL_CONFIG.name
