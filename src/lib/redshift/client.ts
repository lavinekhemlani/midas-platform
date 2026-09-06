import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  GetStatementResultCommand,
  DescribeStatementCommand,
  StatusString,
} from '@aws-sdk/client-redshift-data'

// Initialize the Redshift Data API client
const client = new RedshiftDataClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Configuration for Redshift Serverless
const WORKGROUP_NAME = process.env.REDSHIFT_WORKGROUP_NAME || 'shopify-analytics'
const DATABASE = process.env.REDSHIFT_DATABASE || 'dev'
const DB_USER = process.env.REDSHIFT_DB_USER || 'fivetran_user'

export interface QueryResult<T = Record<string, unknown>> {
  success: boolean
  data: T[]
  count: number
  columns: string[]
  error?: string
  executionTime?: number
}

/**
 * Wait for a statement to complete
 */
async function waitForStatement(statementId: string): Promise<{ status: string; error?: string }> {
  const maxAttempts = 60 // 60 seconds max wait
  let attempts = 0

  while (attempts < maxAttempts) {
    const describeCommand = new DescribeStatementCommand({ Id: statementId })
    const response = await client.send(describeCommand)

    const status = response.Status

    if (status === StatusString.FINISHED) {
      return { status: 'FINISHED' }
    }

    if (status === StatusString.FAILED) {
      return { status: 'FAILED', error: response.Error || 'Query failed' }
    }

    if (status === StatusString.ABORTED) {
      return { status: 'ABORTED', error: 'Query was aborted' }
    }

    // Wait 1 second before checking again
    await new Promise((resolve) => setTimeout(resolve, 1000))
    attempts++
  }

  return { status: 'TIMEOUT', error: 'Query timed out after 60 seconds' }
}

/**
 * Parse the result from Redshift Data API into a more usable format
 */
function parseResults(response: any): { data: Record<string, unknown>[]; columns: string[] } {
  const columns = response.ColumnMetadata?.map((col: any) => col.name) || []
  const data: Record<string, unknown>[] = []

  if (response.Records) {
    for (const record of response.Records) {
      const row: Record<string, unknown> = {}
      record.forEach((field: any, index: number) => {
        const columnName = columns[index]
        // Extract the value from the field object
        // The Data API returns values in a typed format like { stringValue: "..." } or { longValue: 123 }
        if (field.stringValue !== undefined) {
          row[columnName] = field.stringValue
        } else if (field.longValue !== undefined) {
          row[columnName] = field.longValue
        } else if (field.doubleValue !== undefined) {
          row[columnName] = field.doubleValue
        } else if (field.booleanValue !== undefined) {
          row[columnName] = field.booleanValue
        } else if (field.isNull) {
          row[columnName] = null
        } else {
          row[columnName] = null
        }
      })
      data.push(row)
    }
  }

  return { data, columns }
}

/**
 * Execute a query against the Redshift warehouse using the Data API
 */
export async function executeQuery<T = Record<string, unknown>>(
  sql: string
): Promise<QueryResult<T>> {
  const startTime = Date.now()

  try {
    // Execute the statement
    // Note: Redshift Serverless uses IAM auth, no DbUser needed
    const executeCommand = new ExecuteStatementCommand({
      WorkgroupName: WORKGROUP_NAME,
      Database: DATABASE,
      Sql: sql,
    })

    const executeResponse = await client.send(executeCommand)
    const statementId = executeResponse.Id

    if (!statementId) {
      return {
        success: false,
        data: [],
        count: 0,
        columns: [],
        error: 'No statement ID returned',
      }
    }

    // Wait for the statement to complete
    const waitResult = await waitForStatement(statementId)

    if (waitResult.status !== 'FINISHED') {
      return {
        success: false,
        data: [],
        count: 0,
        columns: [],
        error: waitResult.error,
        executionTime: Date.now() - startTime,
      }
    }

    // Get the results
    const getResultCommand = new GetStatementResultCommand({ Id: statementId })
    const resultResponse = await client.send(getResultCommand)

    const { data, columns } = parseResults(resultResponse)

    return {
      success: true,
      data: data as T[],
      count: data.length,
      columns,
      executionTime: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[Redshift Data API] Query error:', error)
    return {
      success: false,
      data: [],
      count: 0,
      columns: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    }
  }
}

/**
 * Get table schema information
 */
export async function getTableSchema(
  schemaName: string,
  tableName: string
): Promise<{ column_name: string; data_type: string }[]> {
  const sql = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = '${schemaName}'
    AND table_name = '${tableName}'
    ORDER BY ordinal_position
  `

  const result = await executeQuery<{ column_name: string; data_type: string }>(sql)
  return result.data
}

/**
 * List all tables in a schema
 */
export async function listTables(schemaName: string): Promise<string[]> {
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schemaName}'
    ORDER BY table_name
  `

  const result = await executeQuery<{ table_name: string }>(sql)
  return result.data.map((row) => row.table_name)
}
