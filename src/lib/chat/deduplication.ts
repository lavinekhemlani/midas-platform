/**
 * Utility functions for message deduplication
 */

export interface MessageWithId {
  id: string
  [key: string]: any
}

/**
 * Deduplicates an array of messages by their ID.
 * Uses a Set for O(n) performance.
 * Preserves the order of first occurrence.
 */
export function deduplicateMessages<T extends MessageWithId>(messages: T[]): T[] {
  const seenIds = new Set<string>()
  return messages.filter((msg) => {
    if (seenIds.has(msg.id)) {
      return false
    }
    seenIds.add(msg.id)
    return true
  })
}

/**
 * Merges new messages with existing ones, removing duplicates.
 * New messages are prepended or appended based on the prepend flag.
 * Uses Set for O(n) performance.
 */
export function mergeUniqueMessages<T extends MessageWithId>(
  existingMessages: T[],
  newMessages: T[],
  prepend: boolean = false
): T[] {
  const existingIds = new Set(existingMessages.map((m) => m.id))
  const uniqueNewMessages = newMessages.filter((m) => !existingIds.has(m.id))

  if (prepend) {
    return [...uniqueNewMessages, ...existingMessages]
  } else {
    return [...existingMessages, ...uniqueNewMessages]
  }
}

/**
 * Checks if a message with the given ID exists in the array.
 * Uses Array.some for simplicity, O(n) performance.
 */
export function messageExists<T extends MessageWithId>(messages: T[], messageId: string): boolean {
  return messages.some((msg) => msg.id === messageId)
}
