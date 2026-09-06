// src/lib/chatHistory.ts
// Dynamo helpers for saving / fetching chat messages
// PK = userId, SK = timestamp (ISO)

import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { logger } from '@/lib/logger'

// Check for table name at module load time
const TABLE = process.env.CHAT_HISTORY_TABLE || process.env.CHAT_TABLE_NAME
if (!TABLE) {
  logger.error('[ChatHistory] Table not configured', {
    checkEnvVars: ['CHAT_HISTORY_TABLE', 'CHAT_TABLE_NAME'],
  })
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
})

export interface StoredMessage {
  id: string // uuid
  role: 'user' | 'assistant'
  content: string
  ts: number // epoch millis for fast range-query
  realmId?: string // QuickBooks realm ID for scoping chat history by account
  status?: 'streaming' | 'complete' // Message status: streaming during generation, complete when done
  memories?: Array<{
    // optional array of memories created from this message
    id: string
    type: string
    content: string
  }>
  updatedMemories?: Array<{
    // optional array of memories updated in this message
    id: string
    type: string
    content: string
  }>
  deletedMemories?: Array<{
    // optional array of memories deleted in this message
    id: string
    type: string
    content: string
  }>
  learnTerms?: Array<{
    // optional array of detected learn terms
    termId: string
    matchedPhrase: string
    confidence: number
    reason: string
  }>
  tokenUsage?: {
    // token usage for this message (for cost tracking)
    inputTokens: number
    outputTokens: number
    totalTokens: number
    model: string
    provider: string
  }
  // Visualization components (charts, tables, etc.) for [[VIZ:N]] markers
  components?: Array<any>
  // Widget data (memory widgets, etc.) for [[WIDGET:N]] markers
  widgets?: Array<any>
}

export interface SaveResult {
  success: boolean
  messageId: string
  error?: string
  retryCount?: number
}

/**
 * Retry utility function with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000ms)
 * @returns The result of the successful function call
 * @throws The last error if all retries fail
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<{ result: T; attempts: number }> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn()
      return { result, attempts: attempt + 1 }
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      const isRetryable = isRetryableError(error)
      if (!isRetryable || attempt >= maxRetries - 1) {
        throw lastError
      }

      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt)
      logger.debug('[ChatHistory] Retrying after error', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message,
      })
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

/**
 * Determines if an error is retryable based on AWS SDK error codes
 * @param error - The error to check
 * @returns true if the error is retryable, false otherwise
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const errorName = (error as any).name || ''
  const errorCode = (error as any).code || ''

  // Retryable AWS SDK errors
  const retryableErrors = [
    'ProvisionedThroughputExceededException',
    'ThrottlingException',
    'RequestLimitExceeded',
    'InternalServerError',
    'ServiceUnavailable',
    'TimeoutError',
    'NetworkingError',
  ]

  return retryableErrors.some(
    (retryable) => errorName.includes(retryable) || errorCode.includes(retryable)
  )
}

// write one line with retry mechanism
export async function saveMessage(userId: string, msg: StoredMessage): Promise<SaveResult> {
  if (!TABLE) {
    const error = 'Chat history table not configured'
    logger.error('[ChatHistory] Cannot save - table not configured', { userId, messageId: msg.id })

    // In development, return failure without throwing
    if (process.env.NODE_ENV === 'development') {
      return {
        success: false,
        messageId: msg.id,
        error,
      }
    }

    return {
      success: false,
      messageId: msg.id,
      error,
    }
  }

  logger.debug('[ChatHistory] Saving message', {
    userId,
    messageId: msg.id,
    role: msg.role,
    contentLength: msg.content.length,
  })

  try {
    const Item = marshall(
      {
        PK: userId,
        SK: msg.ts, // Send as number, not string
        ...msg,
      },
      { removeUndefinedValues: true }
    )

    // Use retry mechanism with exponential backoff
    const { attempts } = await withRetry(
      async () => {
        await client.send(new PutItemCommand({ TableName: TABLE, Item }))
      },
      3, // maxRetries
      1000 // baseDelay (1 second)
    )

    logger.debug('[ChatHistory] Message saved successfully', {
      userId,
      messageId: msg.id,
      attempts,
    })

    return {
      success: true,
      messageId: msg.id,
      retryCount: attempts > 1 ? attempts - 1 : 0,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('[ChatHistory] Error saving message after retries', {
      error: errorMessage,
      userId,
      messageId: msg.id,
    })

    // In development, return failure without throwing
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[ChatHistory] Continuing without save', { env: 'development' })
      return {
        success: false,
        messageId: msg.id,
        error: errorMessage,
      }
    }

    return {
      success: false,
      messageId: msg.id,
      error: errorMessage,
    }
  }
}

// read last N messages (newest->oldest)
// Chat history is unified across all QB entities (not scoped by realmId)
export async function fetchLastN(
  userId: string,
  n = 12
): Promise<StoredMessage[]> {
  if (!TABLE) {
    logger.error('[ChatHistory] Cannot fetch - table not configured', { userId, limit: n })
    // Return empty array in development to allow the app to continue
    if (process.env.NODE_ENV === 'development') {
      return []
    }
    throw new Error('Chat history table not configured')
  }

  try {
    const res = await client.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: userId },
        },
        ScanIndexForward: false, // DESC
        Limit: n,
      })
    )
    const messages = (res.Items ?? []).map((i) => unmarshall(i) as StoredMessage).reverse()
    logger.debug('[ChatHistory] Fetched messages', {
      userId,
      count: messages.length,
      limit: n,
    })
    return messages
  } catch (error) {
    logger.error('[ChatHistory] Error fetching messages', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      limit: n,
    })
    // In development, return empty array to allow the app to continue
    if (process.env.NODE_ENV === 'development') {
      return []
    }
    throw error
  }
}

// Pagination response type
export interface PaginatedMessages {
  messages: StoredMessage[]
  hasMore: boolean
  oldestTimestamp?: number
}

// Fetch messages with pagination support (for infinite scrolling)
// Chat history is unified across all QB entities (not scoped by realmId)
export async function fetchPaginatedMessages(
  userId: string,
  limit = 20,
  beforeTimestamp?: number
): Promise<PaginatedMessages> {
  if (!TABLE) {
    logger.error('[ChatHistory] Cannot fetch paginated - table not configured', {
      userId,
      limit,
      beforeTimestamp,
    })
    if (process.env.NODE_ENV === 'development') {
      return { messages: [], hasMore: false }
    }
    throw new Error('Chat history table not configured')
  }

  try {
    // Build the query
    const queryParams: any = {
      TableName: TABLE,
      KeyConditionExpression: beforeTimestamp
        ? 'PK = :pk AND SK < :before' // Get messages before the timestamp
        : 'PK = :pk', // Get latest messages
      ExpressionAttributeValues: {
        ':pk': { S: userId },
        ...(beforeTimestamp && { ':before': { N: beforeTimestamp.toString() } }),
      },
      ScanIndexForward: false, // DESC order (newest first)
      Limit: limit + 1, // Fetch one extra to check if there are more
    }

    const res = await client.send(new QueryCommand(queryParams))
    const items = res.Items ?? []

    // Check if there are more messages
    const hasMore = items.length > limit
    const messagesToReturn = hasMore ? items.slice(0, limit) : items

    // Convert and reverse to get chronological order (oldest first)
    const messages = messagesToReturn.map((i) => unmarshall(i) as StoredMessage).reverse()

    // Get the oldest timestamp from the returned messages
    const oldestTimestamp = messages.length > 0 ? Math.min(...messages.map((m) => m.ts)) : undefined

    logger.debug('[ChatHistory] Fetched paginated', {
      userId,
      count: messages.length,
      limit,
      hasMore,
      beforeTimestamp,
      oldestTimestamp,
    })

    return {
      messages,
      hasMore,
      oldestTimestamp,
    }
  } catch (error) {
    logger.error('[ChatHistory] Error fetching paginated', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      limit,
      beforeTimestamp,
    })
    if (process.env.NODE_ENV === 'development') {
      return { messages: [], hasMore: false }
    }
    throw error
  }
}

// Clear chat history for a user (all messages, not scoped by entity)
export async function clearUserChatHistory(
  userId: string
): Promise<{ deleted: number }> {
  if (!TABLE) {
    logger.error('[ChatHistory] Cannot clear - table not configured', { userId })
    if (process.env.NODE_ENV === 'development') {
      return { deleted: 0 }
    }
    throw new Error('Chat history table not configured')
  }

  try {
    let totalDeleted = 0
    let lastEvaluatedKey: any = undefined

    // DynamoDB batch delete requires querying first, then deleting in batches of 25
    do {
      const queryRes = await client.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': { S: userId },
          },
          ProjectionExpression: 'PK, SK',
          ExclusiveStartKey: lastEvaluatedKey,
        })
      )

      const items = queryRes.Items ?? []
      if (items.length === 0) break

      // Batch delete in chunks of 25 (DynamoDB limit)
      for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25)
        await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [TABLE]: batch.map((item) => ({
                DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
              })),
            },
          })
        )
        totalDeleted += batch.length
      }

      lastEvaluatedKey = queryRes.LastEvaluatedKey
    } while (lastEvaluatedKey)

    logger.info('[ChatHistory] Cleared user history', { userId, deleted: totalDeleted })
    return { deleted: totalDeleted }
  } catch (error) {
    logger.error('[ChatHistory] Error clearing history', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })
    throw error
  }
}
