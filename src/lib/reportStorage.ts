// src/lib/reportStorage.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
})

const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = process.env.REPORTS_TABLE_NAME || 'zenith-reports'

export interface StoredReport {
  reportId: string
  userId: string
  messageId: string
  title: string
  type: 'financial' | 'cashflow' | 'performance' | 'comprehensive'
  timeframe: string
  focusAreas?: string[]
  confidence: number
  components: Array<{
    id: string
    type: string
    props: any
    layout?: any
    metadata?: any
    timestamp: number
  }>
  narrative: string
  structure?: any
  keyInsights: string[]
  metadata?: any
  chatResponse?: string
  createdAt: number
}

export interface ReportSummary {
  reportId: string
  messageId: string
  title: string
  type: string
  createdAt: number
}

/**
 * Save a report to DynamoDB
 */
export async function saveReport(report: StoredReport): Promise<void> {
  const PK = `${report.userId}#${report.reportId}`
  const SK = report.createdAt

  try {
    const item = {
      PK,
      SK,
      ...report,
      userId: report.userId,
      type: report.type,
      createdAt: report.createdAt,
    }

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    )

    console.log(
      `[ReportStorage] Saved: ${report.reportId} (${report.components.length} components)`
    )
  } catch (error) {
    console.error('[ReportStorage] Failed to save:', error)
    throw new Error('Failed to save report')
  }
}

/**
 * Get a specific report by ID
 */
export async function getReport(userId: string, reportId: string): Promise<StoredReport | null> {
  const PK = `${userId}#${reportId}`

  try {
    // Query using the PK prefix to find the report regardless of SK (timestamp)
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': PK,
        },
        Limit: 1,
      })
    )

    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0]
      // Remove the DynamoDB-specific fields
      const { PK: _, SK: __, ...report } = item
      return report as StoredReport
    }

    return null
  } catch (error) {
    console.error('Failed to get report:', error)
    return null
  }
}

/**
 * Get a report by message ID (for preview chip)
 */
export async function getReportByMessageId(
  userId: string,
  messageId: string
): Promise<StoredReport | null> {
  try {
    const userReports = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'UserReportsIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false,
      })
    )

    const matchingReport = userReports.Items?.find((item) => {
      return item.messageId === messageId || item.messageId?.trim() === messageId?.trim()
    })

    if (matchingReport) {
      const { PK: _, SK: __, ...report } = matchingReport
      return report as StoredReport
    }

    return null
  } catch (error) {
    console.error('[ReportStorage] Failed to get report by messageId:', error)
    return null
  }
}

/**
 * List recent reports for a user
 */
export async function listUserReports(
  userId: string,
  limit: number = 10
): Promise<ReportSummary[]> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'UserReportsIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Sort by newest first
        Limit: limit,
        ProjectionExpression: 'reportId, messageId, title, #type, createdAt',
        ExpressionAttributeNames: {
          '#type': 'type', // 'type' is a reserved word in DynamoDB
        },
      })
    )

    return (result.Items || []).map((item) => ({
      reportId: item.reportId,
      messageId: item.messageId,
      title: item.title,
      type: item.type,
      createdAt: item.createdAt,
    }))
  } catch (error) {
    console.error('Failed to list user reports:', error)
    return []
  }
}

/**
 * Generate a unique report ID
 */
export function generateReportId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get a report by its ID using direct query
 */
export async function getReportDirectly(
  userId: string,
  reportId: string
): Promise<StoredReport | null> {
  const PK = `${userId}#${reportId}`

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': PK,
        },
      })
    )

    if (result.Items && result.Items.length > 0) {
      const { PK: _, SK: __, ...report } = result.Items[0]
      return report as StoredReport
    }

    return null
  } catch (error) {
    console.error('[ReportStorage] Direct query error:', error)
    return null
  }
}

/**
 * Debug function to check table structure and data
 */
export async function debugReportTable(userId: string): Promise<any> {
  try {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Limit: 10,
      })
    )

    let gsiCount = 0
    try {
      const gsiResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'UserReportsIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
          Limit: 5,
        })
      )
      gsiCount = gsiResult.Items?.length || 0
    } catch {
      // GSI query failed silently
    }

    return {
      scanCount: scanResult.Items?.length || 0,
      gsiCount,
      sampleItems: scanResult.Items?.slice(0, 3),
    }
  } catch (error) {
    console.error('[ReportStorage] Debug failed:', error)
    return null
  }
}
