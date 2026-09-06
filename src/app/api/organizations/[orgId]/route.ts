// src/app/api/organizations/[orgId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyCognitoToken } from '@/lib/cognito-auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { Organization, StoredFile } from '@/lib/data'
import { createOrgPK } from '@/lib/db/keys'

// Initialize DynamoDB and S3 Clients
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION })

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
}
const unmarshallOptions = {
  wrapNumbers: false,
}
const translateConfig = { marshallOptions, unmarshallOptions }
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig)

const s3Client = new S3Client({ region: process.env.AWS_S3_REGION })

const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME
const S3_DECKS_BUCKET_NAME = process.env.S3_DECKS_BUCKET_NAME
const S3_UPLOADS_BUCKET_NAME = process.env.S3_UPLOADS_BUCKET_NAME

export async function GET(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { userId } = await verifyCognitoToken(req)

    const { orgId } = await context.params

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required.' }, { status: 400 })
    }

    if (!ORGANIZATIONS_TABLE_NAME || !process.env.AWS_REGION) {
      console.error('Server configuration error: Missing ORGANIZATIONS_TABLE_NAME or AWS_REGION')
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    const getCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME,
      Key: { PK: createOrgPK(orgId), SK: 'PROFILE' },
    })
    const { Item } = await ddbDocClient.send(getCommand)

    if (!Item) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 })
    }

    // Authorization check: Use generic 'owner_user_id'
    if (Item.owner_user_id !== userId) {
      return NextResponse.json({ error: 'Access denied to this organization.' }, { status: 403 })
    }

    const organization = Item as Organization
    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error in GET /api/organizations/[orgId]:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch organization details.', details: msg },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { userId } = await verifyCognitoToken(req)
    const { orgId } = await context.params
    const body: {
      file?: StoredFile
      type?: 'corp_profile' | 'manual_financials'
      organizationData?: Partial<Organization>
    } = await req.json()

    const getCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME!,
      Key: { PK: createOrgPK(orgId), SK: 'PROFILE' },
    })
    const { Item: existingOrg } = await ddbDocClient.send(getCommand)
    if (!existingOrg || existingOrg.owner_user_id !== userId) {
      // Use generic 'owner_user_id'
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let updateExpression = 'SET #updatedAt = :now'
    const expressionAttributeNames: Record<string, string> = { '#updatedAt': 'updated_at' }
    const expressionAttributeValues: Record<string, any> = { ':now': Math.floor(Date.now() / 1000) }

    if (body.file && body.type) {
      if (body.type === 'corp_profile') {
        updateExpression += ', #corp_profile = :file'
        expressionAttributeNames['#corp_profile'] = 'corp_profile'
        expressionAttributeValues[':file'] = body.file
      } else if (body.type === 'manual_financials') {
        updateExpression +=
          ', #manual_financials = list_append(if_not_exists(#manual_financials, :empty_list), :file)'
        expressionAttributeNames['#manual_financials'] = 'manual_financials'
        expressionAttributeValues[':file'] = [body.file]
        expressionAttributeValues[':empty_list'] = []
      }
    } else if (body.organizationData) {
      const orgData = body.organizationData

      // Validate revenue_model (case-insensitive)
      const ALLOWED_REVENUE_MODELS = [
        'SaaS',
        'Retail',
        'Services',
        'Marketplace',
        'Subscription',
        'Hardware',
        'Freemium',
        'Advertising',
        'Commission',
        'Licensing',
        'Other',
      ]
      if (orgData.revenue_model) {
        // Normalize to capitalized format (case-insensitive validation)
        const revenueModelValue = orgData.revenue_model
        const normalizedModel =
          revenueModelValue.charAt(0).toUpperCase() + revenueModelValue.slice(1).toLowerCase()
        const matchedModel = ALLOWED_REVENUE_MODELS.find(
          (model) => model.toLowerCase() === revenueModelValue.toLowerCase()
        )

        if (!matchedModel) {
          return NextResponse.json(
            {
              error: 'Invalid revenue model. Must be one of: ' + ALLOWED_REVENUE_MODELS.join(', '),
            },
            { status: 400 }
          )
        }

        // Normalize the value before saving (use the properly cased version from allowed list)
        orgData.revenue_model = matchedModel
      }

      // Validate financial_health_metrics
      if (orgData.financial_health_metrics) {
        if (!Array.isArray(orgData.financial_health_metrics)) {
          return NextResponse.json(
            { error: 'financial_health_metrics must be an array' },
            { status: 400 }
          )
        }
        if (orgData.financial_health_metrics.length !== 4) {
          return NextResponse.json(
            { error: 'financial_health_metrics must contain exactly 4 metric IDs' },
            { status: 400 }
          )
        }
        // Check for duplicates
        const uniqueMetrics = new Set(orgData.financial_health_metrics)
        if (uniqueMetrics.size !== 4) {
          return NextResponse.json(
            { error: 'financial_health_metrics must not contain duplicates' },
            { status: 400 }
          )
        }
      }

      // Validate financial_health_targets
      if (orgData.financial_health_targets) {
        if (!Array.isArray(orgData.financial_health_targets)) {
          return NextResponse.json(
            { error: 'financial_health_targets must be an array' },
            { status: 400 }
          )
        }
        for (const target of orgData.financial_health_targets) {
          if (!target.metric_id || typeof target.target !== 'number' || !target.unit) {
            return NextResponse.json(
              {
                error:
                  'Each target must have metric_id (string), target (number), and unit (string)',
              },
              { status: 400 }
            )
          }
          if (isNaN(target.target) || target.target < 0) {
            return NextResponse.json(
              { error: `Target value for ${target.metric_id} must be a non-negative number` },
              { status: 400 }
            )
          }
        }
      }

      const allowedFields: Array<keyof Organization> = [
        'name',
        'legal_name',
        'jurisdiction',
        'incorporation_date',
        'revenue_model',
        'financial_health_metrics',
        'financial_health_targets',
      ]
      for (const field of allowedFields) {
        if (orgData[field] !== undefined) {
          updateExpression += `, #${field} = :${field}`
          expressionAttributeNames[`#${field}`] = field
          expressionAttributeValues[`:${field}`] = orgData[field]
        }
      }
    } else {
      return NextResponse.json({ error: 'Invalid update payload.' }, { status: 400 })
    }

    const updateCommand = new UpdateCommand({
      TableName: ORGANIZATIONS_TABLE_NAME!,
      Key: { PK: createOrgPK(orgId), SK: 'PROFILE' },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const { Attributes } = await ddbDocClient.send(updateCommand)
    return NextResponse.json({ success: true, organization: Attributes })
  } catch (error) {
    console.error('Error in PUT /api/organizations/[orgId]:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to update organization.', details: msg },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { userId } = await verifyCognitoToken(req)
    const { orgId } = await context.params
    const { s3Key, type }: { s3Key: string; type: 'corp_profile' | 'manual_financials' } =
      await req.json()

    if (!s3Key || !type) {
      return NextResponse.json(
        { error: 'Missing s3Key or upload type to delete.' },
        { status: 400 }
      )
    }

    const getCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME!,
      Key: { PK: createOrgPK(orgId), SK: 'PROFILE' },
    })
    const { Item: existingOrg } = await ddbDocClient.send(getCommand)
    if (!existingOrg || existingOrg.owner_user_id !== userId) {
      // Use generic 'owner_user_id'
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let updateExpression: string
    const expressionAttributeNames: Record<string, string> = { '#updatedAt': 'updated_at' }
    const expressionAttributeValues: Record<string, any> = { ':now': Math.floor(Date.now() / 1000) }
    let bucketName: string | undefined

    if (type === 'corp_profile') {
      updateExpression = 'REMOVE #corp_profile SET #updatedAt = :now'
      expressionAttributeNames['#corp_profile'] = 'corp_profile'
      bucketName = S3_UPLOADS_BUCKET_NAME
    } else {
      const financials: StoredFile[] = existingOrg.manual_financials || []
      const fileIndex = financials.findIndex((f) => f.s3Key === s3Key)
      if (fileIndex === -1) {
        return NextResponse.json(
          { error: 'File not found in organization record.' },
          { status: 404 }
        )
      }
      updateExpression = `REMOVE #manual_financials[${fileIndex}] SET #updatedAt = :now`
      expressionAttributeNames['#manual_financials'] = 'manual_financials'
      bucketName = S3_UPLOADS_BUCKET_NAME
    }

    if (bucketName) {
      const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: s3Key })
      await s3Client.send(deleteCommand)
    }

    const updateCommand = new UpdateCommand({
      TableName: ORGANIZATIONS_TABLE_NAME!,
      Key: { PK: createOrgPK(orgId), SK: 'PROFILE' },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const { Attributes } = await ddbDocClient.send(updateCommand)
    return NextResponse.json({ success: true, organization: Attributes })
  } catch (error) {
    console.error(`Error in DELETE /api/organizations/[orgId]:`, error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to delete file reference.', details: msg },
      { status: 500 }
    )
  }
}
