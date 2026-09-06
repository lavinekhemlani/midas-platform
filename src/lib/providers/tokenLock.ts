// src/lib/providers/tokenLock.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { logger } from '@/lib/logger'

/**
 * Distributed token refresh locking mechanism using DynamoDB
 * Prevents race conditions when multiple processes try to refresh the same token
 */
export class TokenRefreshLock {
  private client: DynamoDBDocumentClient
  private tableName: string

  constructor() {
    const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION })
    this.client = DynamoDBDocumentClient.from(dynamoClient)
    this.tableName = process.env.ORGANIZATIONS_TABLE_NAME!

    if (!this.tableName) {
      throw new Error('ORGANIZATIONS_TABLE_NAME environment variable is required for token locking')
    }
  }

  /**
   * Attempt to acquire a distributed lock for token refresh.
   * For multi-entity QB, pass realmId to scope the lock per-company.
   */
  async acquireLock(
    organizationId: string,
    providerId: string,
    realmId?: string
  ): Promise<{
    acquired: boolean
    lockId?: string
    existingLockAge?: number
  }> {
    const lockId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
    const lockKey = realmId
      ? `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}#${realmId}`
      : `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}`
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minute timeout
    const ttl = Math.floor(expiresAt / 1000) // DynamoDB TTL in seconds

    try {
      logger.debug('[TokenLock] Acquiring lock', {
        organizationId,
        providerId,
        lockId,
        expiresAt,
      })

      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: lockKey, SK: 'LOCK' },
          UpdateExpression:
            'SET #lockId = :lockId, #expiresAt = :expiresAt, #ttl = :ttl, #acquiredAt = :acquiredAt',
          ConditionExpression: 'attribute_not_exists(#lockId) OR #expiresAt < :now',
          ExpressionAttributeNames: {
            '#lockId': 'lockId',
            '#expiresAt': 'expiresAt',
            '#ttl': 'ttl',
            '#acquiredAt': 'acquiredAt',
          },
          ExpressionAttributeValues: {
            ':lockId': lockId,
            ':expiresAt': expiresAt,
            ':now': Date.now(),
            ':ttl': ttl,
            ':acquiredAt': Date.now(),
          },
        })
      )

      logger.info('[TokenLock] Lock acquired', {
        organizationId,
        providerId,
        lockId,
      })
      return { acquired: true, lockId }
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.debug('[TokenLock] Lock already held', {
          organizationId,
          providerId,
        })

        // Try to get information about the existing lock
        try {
          const existingLock = await this.getLockInfo(organizationId, providerId, realmId)
          const existingLockAge = existingLock ? Date.now() - existingLock.acquiredAt : 0

          return {
            acquired: false,
            existingLockAge: existingLockAge,
          }
        } catch (getLockError) {
          logger.warn('[TokenLock] Could not retrieve existing lock info', {
            organizationId,
            providerId,
            error: getLockError,
          })
          return { acquired: false }
        }
      }

      logger.error('[TokenLock] Failed to acquire lock', {
        organizationId,
        providerId,
        error,
      })
      throw new Error(`Failed to acquire token refresh lock: ${error.message}`)
    }
  }

  /**
   * Release a previously acquired lock
   */
  async releaseLock(organizationId: string, providerId: string, lockId: string, realmId?: string): Promise<void> {
    const lockKey = realmId
      ? `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}#${realmId}`
      : `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}`

    try {
      logger.debug('[TokenLock] Releasing lock', {
        organizationId,
        providerId,
        lockId,
      })

      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: lockKey, SK: 'LOCK' },
          UpdateExpression: 'REMOVE #lockId, #expiresAt, #acquiredAt SET #releasedAt = :releasedAt',
          ConditionExpression: '#lockId = :lockId',
          ExpressionAttributeNames: {
            '#lockId': 'lockId',
            '#expiresAt': 'expiresAt',
            '#acquiredAt': 'acquiredAt',
            '#releasedAt': 'releasedAt',
          },
          ExpressionAttributeValues: {
            ':lockId': lockId,
            ':releasedAt': Date.now(),
          },
        })
      )

      logger.debug('[TokenLock] Lock released', {
        organizationId,
        providerId,
        lockId,
      })
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        logger.debug('[TokenLock] Lock already released or expired', {
          organizationId,
          providerId,
          lockId,
        })
        return // This is okay - lock was already released
      }

      logger.error('[TokenLock] Failed to release lock', {
        organizationId,
        providerId,
        lockId,
        error,
      })
      // Don't throw here - we don't want to fail the main operation if lock release fails
    }
  }

  /**
   * Force release a lock (for emergency cleanup or expired locks)
   */
  async forceReleaseLock(organizationId: string, providerId: string, realmId?: string): Promise<void> {
    const lockKey = realmId
      ? `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}#${realmId}`
      : `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}`

    try {
      logger.info('[TokenLock] Force releasing lock', {
        organizationId,
        providerId,
      })

      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: lockKey, SK: 'LOCK' },
        })
      )

      logger.info('[TokenLock] Lock force released', {
        organizationId,
        providerId,
      })
    } catch (error) {
      logger.error('[TokenLock] Failed to force release lock', {
        organizationId,
        providerId,
        error,
      })
      throw new Error(`Failed to force release lock: ${(error as Error).message}`)
    }
  }

  /**
   * Get information about an existing lock
   */
  private async getLockInfo(
    organizationId: string,
    providerId: string,
    realmId?: string
  ): Promise<{
    lockId: string
    acquiredAt: number
    expiresAt: number
  } | null> {
    const lockKey = realmId
      ? `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}#${realmId}`
      : `TOKEN_REFRESH_LOCK#${organizationId}#${providerId}`

    try {
      const result = await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: lockKey, SK: 'LOCK' },
          UpdateExpression: 'SET #lastChecked = :now',
          ExpressionAttributeNames: {
            '#lastChecked': 'lastChecked',
          },
          ExpressionAttributeValues: {
            ':now': Date.now(),
          },
          ReturnValues: 'ALL_NEW',
        })
      )

      const item = result.Attributes
      if (item && item.lockId) {
        return {
          lockId: item.lockId,
          acquiredAt: item.acquiredAt || 0,
          expiresAt: item.expiresAt || 0,
        }
      }

      return null
    } catch (error) {
      logger.error('[TokenLock] Failed to get lock info', {
        organizationId,
        providerId,
        error,
      })
      return null
    }
  }

  /**
   * Wait for an existing lock to be released, with timeout
   */
  async waitForLockRelease(
    organizationId: string,
    providerId: string,
    maxWaitMs: number = 30000,
    checkIntervalMs: number = 1000,
    realmId?: string
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitMs) {
      const lockResult = await this.acquireLock(organizationId, providerId, realmId)

      if (lockResult.acquired) {
        // We got the lock, release it immediately since we were just waiting
        await this.releaseLock(organizationId, providerId, lockResult.lockId!, realmId)
        return true
      }

      // If the existing lock is very old (>10 minutes), consider it stale
      if (lockResult.existingLockAge && lockResult.existingLockAge > 10 * 60 * 1000) {
        logger.warn('[TokenLock] Detected stale lock, force releasing', {
          organizationId,
          providerId,
          lockAge: lockResult.existingLockAge,
        })
        try {
          await this.forceReleaseLock(organizationId, providerId, realmId)
          return true
        } catch (forceReleaseError) {
          logger.error('[TokenLock] Failed to force release stale lock', {
            organizationId,
            providerId,
            error: forceReleaseError,
          })
        }
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
    }

    logger.warn('[TokenLock] Timed out waiting for lock', {
      organizationId,
      providerId,
      maxWaitMs,
    })
    return false
  }
}

/**
 * Utility function to execute a function with distributed locking.
 * For multi-entity QB, pass realmId to scope the lock per-company.
 */
export async function withTokenRefreshLock<T>(
  organizationId: string,
  providerId: string,
  operation: () => Promise<T>,
  options: {
    maxWaitMs?: number
    timeoutMs?: number
    realmId?: string
  } = {}
): Promise<T> {
  const lockManager = new TokenRefreshLock()
  const { maxWaitMs = 30000, timeoutMs = 120000, realmId } = options

  // First, try to acquire the lock
  let lockResult = await lockManager.acquireLock(organizationId, providerId, realmId)

  if (!lockResult.acquired) {
    // If we can't get the lock, wait for it to be released
    logger.info('[TokenLock] Waiting for existing operation', {
      organizationId,
      providerId,
      realmId,
    })
    const lockReleased = await lockManager.waitForLockRelease(organizationId, providerId, maxWaitMs, 1000, realmId)

    if (!lockReleased) {
      logger.info('[TokenLock] Lock wait timed out, attempting final acquisition', {
        organizationId,
        providerId,
        realmId,
      })
      lockResult = await lockManager.acquireLock(organizationId, providerId, realmId)

      if (!lockResult.acquired) {
        throw new Error(
          `Token refresh operation timed out waiting for lock after ${maxWaitMs}ms and lock is still held`
        )
      }

      logger.info('[TokenLock] Lock acquired after timeout', {
        organizationId,
        providerId,
        realmId,
      })
    } else {
      lockResult = await lockManager.acquireLock(organizationId, providerId, realmId)
      if (!lockResult.acquired) {
        throw new Error('Failed to acquire token refresh lock after waiting')
      }
    }
  }

  // We have the lock, execute the operation with timeout
  const lockId = lockResult.lockId!

  try {
    logger.info('[TokenLock] Token refresh started', {
      organizationId,
      providerId,
      realmId,
      lockId,
    })

    // Set up operation timeout
    const operationPromise = operation()
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Token refresh operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    })

    const result = await Promise.race([operationPromise, timeoutPromise])
    logger.info('[TokenLock] Token refresh completed', {
      organizationId,
      providerId,
      realmId,
      lockId,
    })

    return result
  } finally {
    // Always release the lock
    try {
      await lockManager.releaseLock(organizationId, providerId, lockId, realmId)
    } catch (releaseError) {
      logger.error('[TokenLock] Failed to release lock in finally', {
        organizationId,
        providerId,
        realmId,
        lockId,
        error: releaseError,
      })
    }
  }
}
