// src/ai/checkpointer.ts
// Resettable MemorySaver wrapper for clearing thread state on chat delete

import { MemorySaver, type CheckpointTuple } from '@langchain/langgraph'
import { logger } from '@/lib/logger'

/**
 * Extended MemorySaver that supports deleting thread state.
 *
 * The base MemorySaver uses an internal Map to store checkpoints by thread_id.
 * This wrapper tracks cleared threads and returns empty state for them.
 */
class ResettableMemorySaver extends MemorySaver {
  // Track threads that have been cleared - on next access, return empty state
  private clearedThreads = new Set<string>()

  /**
   * Mark a thread for clearing.
   * On next getTuple(), will return undefined to force fresh state.
   */
  markThreadCleared(threadId: string): void {
    this.clearedThreads.add(threadId)
    // logger.info('[Checkpointer] Thread state marked for clearing', { threadId })
    logger.debug('[Checkpointer] Thread state cleared', { threadId })
  }

  /**
   * Override getTuple to return undefined for cleared threads.
   * This forces the agent to start with fresh state.
   */
  async getTuple(config: Record<string, any>): Promise<CheckpointTuple | undefined> {
    const threadId = config?.configurable?.thread_id
    if (threadId && this.clearedThreads.has(threadId)) {
      logger.debug('[Checkpointer] Returning fresh state for cleared thread', { threadId })
      // Remove from cleared set - the next put() will establish new state
      this.clearedThreads.delete(threadId)
      return undefined
    }
    return super.getTuple(config)
  }
}

// Singleton instance used by the agent
export const checkpointer = new ResettableMemorySaver()

/**
 * Clear all checkpointer state for a thread.
 * Call this when chat history is deleted to ensure fresh state.
 */
export async function clearThreadState(threadId: string): Promise<void> {
  checkpointer.markThreadCleared(threadId)
}
