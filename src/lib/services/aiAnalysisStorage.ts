// src/lib/services/aiAnalysisStorage.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { AIAnalysis, AnalysisType } from '@/lib/data'
import { normalizeOrgId } from '@/lib/db/keys'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = process.env.AI_ANALYSIS_TABLE_NAME || 'ai_analysis'
const TTL_MINUTES = 15 // 15-minute TTL for analyses

// Log table name on module load
console.log('[AIAnalysisStorage] Using table:', TABLE_NAME)

/**
 * Generate a unique analysis ID
 */
export function generateAnalysisId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if an analysis has expired
 */
export function isExpired(analysis: AIAnalysis): boolean {
  return Date.now() > analysis.expires_at
}

/**
 * Calculate TTL values for a new analysis
 */
function calculateTTL(
  createdAt: number = Date.now(),
  ttlMinutes: number = TTL_MINUTES
): {
  created_at: number
  TTL: number
  expires_at: number
} {
  const ttlSeconds = Math.floor(createdAt / 1000) + ttlMinutes * 60

  return {
    created_at: createdAt,
    TTL: ttlSeconds,
    expires_at: ttlSeconds * 1000,
  }
}

/**
 * Save an AI analysis to DynamoDB
 */
export async function saveAnalysis(
  organizationId: string,
  userId: string,
  analysisType: AnalysisType,
  analysisText: string,
  dateRange: { start: string; end: string },
  financialData: Record<string, any>,
  providerId?: string,
  modelUsed?: string,
  ttlMinutes?: number
): Promise<AIAnalysis> {
  const analysisId = generateAnalysisId()
  const timestamp = Date.now()
  const ttlData = calculateTTL(timestamp, ttlMinutes)

  // Normalize organizationId to handle ORG# prefix variations
  const normalizedOrgId = normalizeOrgId(organizationId)

  // Create the analysis object
  const analysis: AIAnalysis = {
    // DynamoDB Keys
    PK: `ORG#${normalizedOrgId}#${analysisType}#${dateRange.start}_${dateRange.end}`,
    SK: `ANALYSIS#${timestamp}#${analysisId}`,

    // Core Fields
    analysis_id: analysisId,
    organization_id: normalizedOrgId,
    user_id: userId,
    analysis_type: analysisType,

    // Content
    analysis_text: analysisText,

    // Context
    date_range: dateRange,
    financial_data: financialData,

    // Metadata
    provider_id: providerId,
    model_used: modelUsed || 'openai/gpt-oss-120b',

    // TTL and timestamps
    ...ttlData,
  }

  console.log('[AIAnalysisStorage] Saving analysis:', {
    PK: analysis.PK,
    SK: analysis.SK,
    analysisId,
    organizationId,
    analysisType,
    TTL: ttlData.TTL,
    expiresIn: `${TTL_MINUTES} minutes`,
  })

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: analysis,
      })
    )

    console.log('[AIAnalysisStorage] Analysis saved successfully:', analysisId)
    return analysis
  } catch (error) {
    console.error('[AIAnalysisStorage] Failed to save analysis:', error)
    throw new Error('Failed to save AI analysis')
  }
}

/**
 * Get the most recent analysis for an organization and type
 */
export async function getLatestAnalysis(
  organizationId: string,
  analysisType: AnalysisType,
  dateRange: { start: string; end: string }
): Promise<AIAnalysis | null> {
  const normalizedOrgId = normalizeOrgId(organizationId)
  const PK = `ORG#${normalizedOrgId}#${analysisType}#${dateRange.start}_${dateRange.end}`

  console.log('[AIAnalysisStorage] Getting latest analysis:', {
    organizationId: normalizedOrgId,
    analysisType,
    PK,
  })

  try {
    // Query for the most recent analysis (sorted by SK which includes timestamp)
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': PK,
        },
        ScanIndexForward: false, // Get newest first
        Limit: 1,
      })
    )

    if (result.Items && result.Items.length > 0) {
      const analysis = result.Items[0] as AIAnalysis

      // Check if the analysis has expired
      if (isExpired(analysis)) {
        console.log('[AIAnalysisStorage] Analysis expired:', {
          analysisId: analysis.analysis_id,
          expiredAt: new Date(analysis.expires_at).toISOString(),
        })
        return null
      }

      console.log('[AIAnalysisStorage] Found valid analysis:', {
        analysisId: analysis.analysis_id,
        expiresAt: new Date(analysis.expires_at).toISOString(),
        remainingMinutes: Math.floor((analysis.expires_at - Date.now()) / 60000),
      })

      return analysis
    }

    console.log('[AIAnalysisStorage] No analysis found')
    return null
  } catch (error) {
    console.error('[AIAnalysisStorage] Failed to get analysis:', error)
    return null
  }
}

/**
 * Get all analyses for an organization and type (including expired ones)
 * Useful for debugging or historical analysis
 */
export async function getAnalysisHistory(
  organizationId: string,
  analysisType: AnalysisType,
  dateRange: { start: string; end: string },
  limit: number = 10
): Promise<AIAnalysis[]> {
  const normalizedOrgId = normalizeOrgId(organizationId)
  const PK = `ORG#${normalizedOrgId}#${analysisType}#${dateRange.start}_${dateRange.end}`

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': PK,
        },
        ScanIndexForward: false, // Get newest first
        Limit: limit,
      })
    )

    return (result.Items || []) as AIAnalysis[]
  } catch (error) {
    console.error('[AIAnalysisStorage] Failed to get analysis history:', error)
    return []
  }
}

/**
 * Get all analyses for a specific user (across all organizations)
 * This would require a GSI in production, but for now we'll document it
 */
export async function getUserAnalyses(userId: string, limit: number = 10): Promise<AIAnalysis[]> {
  // Note: This function would require a Global Secondary Index (GSI) with:
  // - GSI PK: USER#<user_id>
  // - GSI SK: TIMESTAMP#<created_at>
  // For now, this is a placeholder that documents the intended functionality

  console.warn('[AIAnalysisStorage] getUserAnalyses requires a GSI to be implemented')
  return []

  // Future implementation with GSI:
  /*
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'UserAnalysisIndex',
      KeyConditionExpression: 'GSI_PK = :userId',
      ExpressionAttributeValues: {
        ':userId': `USER#${userId}`
      },
      ScanIndexForward: false,
      Limit: limit
    }))

    return (result.Items || []) as AIAnalysis[]
  } catch (error) {
    console.error('[AIAnalysisStorage] Failed to get user analyses:', error)
    return []
  }
  */
}
