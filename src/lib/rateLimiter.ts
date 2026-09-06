// src/lib/rateLimiter.ts
interface RateLimitConfig {
  identifier: string
  limit: number
  window: number // in seconds
}

class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  async check(config: RateLimitConfig): Promise<{
    success: boolean
    remaining: number
    reset: number
  }> {
    const now = Date.now()
    const windowMs = config.window * 1000
    const userRequests = this.requests.get(config.identifier) || []
    
    // Filter out old requests
    const recentRequests = userRequests.filter(time => now - time < windowMs)
    
    if (recentRequests.length >= config.limit) {
      const oldestRequest = recentRequests[0]
      const reset = Math.floor((oldestRequest + windowMs) / 1000)
      
      return {
        success: false,
        remaining: 0,
        reset
      }
    }
    
    // Add current request
    recentRequests.push(now)
    this.requests.set(config.identifier, recentRequests)
    
    // Cleanup old entries periodically (1% chance)
    if (Math.random() < 0.01) {
      this.cleanup()
    }
    
    return {
      success: true,
      remaining: config.limit - recentRequests.length,
      reset: Math.floor((now + windowMs) / 1000)
    }
  }
  
  private cleanup() {
    const now = Date.now()
    for (const [key, times] of this.requests.entries()) {
      const recent = times.filter(t => now - t < 3600000) // Keep last hour
      if (recent.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, recent)
      }
    }
  }
}

export class RateLimiter extends InMemoryRateLimiter {}

import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

const TOKEN_USAGE_TABLE = process.env.TOKEN_USAGE_TABLE || 'TokenUsage'
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
})

export class TokenCounter {
  // Estimate tokens from text (rough approximation: 1 token ≈ 4 characters)
  static estimate(text: string): number {
    if (!text) return 0;
    // More accurate estimation based on common tokenization patterns
    // Average is roughly 1 token per 4 characters for English text
    // Adjust for whitespace and punctuation
    const charCount = text.length;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    // Use a weighted average of character and word-based estimates
    const charBasedEstimate = Math.ceil(charCount / 4);
    const wordBasedEstimate = Math.ceil(wordCount * 1.3); // Average 1.3 tokens per word
    return Math.max(charBasedEstimate, wordBasedEstimate);
  }

  static async trackUsage(userId: string, tokens: number) {
    const timestamp = Date.now()

    try {
      await dynamoClient.send(new PutItemCommand({
        TableName: TOKEN_USAGE_TABLE,
        Item: marshall({
          PK: userId,
          SK: timestamp,
          tokens
        })
      }))
    } catch (error) {
      console.error('Failed to track token usage to DynamoDB:', error)
      // Don't throw - continue execution even if tracking fails
    }
  }

  static async getUsage(userId: string, days: number = 30): Promise<number> {
    const startTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000)

    try {
      const result = await dynamoClient.send(new QueryCommand({
        TableName: TOKEN_USAGE_TABLE,
        KeyConditionExpression: 'PK = :userId AND SK >= :startTime',
        ExpressionAttributeValues: marshall({
          ':userId': userId,
          ':startTime': startTimestamp
        })
      }))

      const items = (result.Items || []).map(item => unmarshall(item))
      return items.reduce((sum, item) => sum + (item.tokens || 0), 0)
    } catch (error) {
      console.error('Failed to get token usage from DynamoDB:', error)
      return 0 // Return 0 if query fails
    }
  }
}