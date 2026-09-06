import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'
import type { DistributedLock } from './token-manager'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const LOCK_TABLE = process.env.DYNAMODB_LOCK_TABLE || 'quickbooks-locks'
const LOCK_TTL_SECONDS = 30

export class DynamoDBLock implements DistributedLock {
  async acquire(key: string, ttlMs: number = LOCK_TTL_SECONDS * 1000): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + Math.ceil(ttlMs / 1000)

    try {
      await client.send(
        new PutCommand({
          TableName: LOCK_TABLE,
          Item: {
            lockKey: key,
            expiresAt,
            acquiredAt: now,
          },
          ConditionExpression: 'attribute_not_exists(lockKey) OR expiresAt < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
        })
      )
      return key // Return lock key as token
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        return null
      }
      throw error
    }
  }

  async release(key: string): Promise<void> {
    try {
      await client.send(
        new DeleteCommand({
          TableName: LOCK_TABLE,
          Key: { lockKey: key },
        })
      )
    } catch {
      // Ignore errors on release - lock will expire anyway
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000)
    try {
      const result = await client.send(
        new GetCommand({
          TableName: LOCK_TABLE,
          Key: { lockKey: key },
        })
      )
      return !!(result.Item && result.Item.expiresAt > now)
    } catch {
      return false
    }
  }
}
