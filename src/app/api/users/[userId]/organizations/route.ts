// src/app/api/users/[userId]/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withUserAuth } from '@/lib/providers/handler'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { User, Organization } from '@/lib/data'

// Initialize DynamoDB DocumentClient
const client = new DynamoDBClient({ region: process.env.AWS_REGION })

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
}
const unmarshallOptions = {
  wrapNumbers: false,
}
const translateConfig = { marshallOptions, unmarshallOptions }
const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig)

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

interface RouteContext {
  params: Promise<{
    userId: string
  }>
}

interface LinkOrganizationRequestBody {
  organizationId: string
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return withAuth(async (req: NextRequest, context) => {
    try {
      const { userId: authenticatedUserId } = context
      const { userId: pathUserId } = await params

      // Authorization check: Ensure user is only modifying their own resource
      if (authenticatedUserId !== pathUserId) {
        return NextResponse.json(
          { error: 'Forbidden. You can only link organizations to your own profile.' },
          { status: 403 }
        )
      }

      if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME || !process.env.AWS_REGION) {
        console.error('Server configuration error: Missing table names or AWS region.')
        return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
      }

      const body = (await req.json()) as LinkOrganizationRequestBody
      const { organizationId } = body

      if (
        !organizationId ||
        typeof organizationId !== 'string' ||
        !organizationId.startsWith('ORG#')
      ) {
        return NextResponse.json(
          { error: 'Valid organizationId (e.g., ORG#<uuid>) is required.' },
          { status: 400 }
        )
      }

      // Step 1: Verify the organization exists
      const orgGetCommand = new GetCommand({
        TableName: ORGANIZATIONS_TABLE_NAME,
        Key: { PK: organizationId, SK: 'PROFILE' },
      })
      const { Item: orgItem } = await ddbDocClient.send(orgGetCommand)
      if (!orgItem) {
        return NextResponse.json(
          { error: `Organization with ID ${organizationId} not found.` },
          { status: 404 }
        )
      }

      // Step 2: Update the user's profile with the organization_id
      const updateCommand = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${pathUserId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET #organization_id = :organizationId, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#organization_id': 'organization_id',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':organizationId': organizationId,
          ':updatedAt': Math.floor(Date.now() / 1000),
        },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(PK)',
      })

      const { Attributes: updatedUserProfile } = await ddbDocClient.send(updateCommand)

      return NextResponse.json({
        message: `User ${pathUserId} successfully linked to organization ${organizationId}.`,
        userProfile: updatedUserProfile,
      })
    } catch (error: any) {
      console.error(`Error in POST /api/users/[userId]/organizations:`, error)
      if (
        error instanceof Error &&
        (error.message.includes('Token is not valid') ||
          error.message.includes('Authorization header is missing'))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.name === 'ConditionalCheckFailedException') {
        return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
      }
      let errorMessage = 'An unknown error occurred.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      if (error instanceof SyntaxError) {
        errorMessage = 'Invalid request body: Could not parse JSON.'
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
      return NextResponse.json(
        { error: 'Failed to link user to organization.', details: errorMessage },
        { status: 500 }
      )
    }
  })(req)
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  return withUserAuth(async (req: NextRequest, context) => {
    try {
      const { userId: authenticatedUserId } = context
      const { userId: pathUserId } = await params

      if (authenticatedUserId !== pathUserId) {
        return NextResponse.json(
          { error: 'Forbidden. You can only retrieve your own organization links.' },
          { status: 403 }
        )
      }

      if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME || !process.env.AWS_REGION) {
        console.error('Server configuration error: Missing table names or AWS region.')
        return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
      }

      const getUserCommand = new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${pathUserId}`, SK: 'PROFILE' },
      })

      const { Item: userItem } = await ddbDocClient.send(getUserCommand)

      if (!userItem) {
        return NextResponse.json({ error: 'User not found.' }, { status: 404 })
      }
      const userProfile = userItem as User

      const organizations: Organization[] = []

      if (userProfile.organization_id) {
        const getOrgCommand = new GetCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: userProfile.organization_id, SK: 'PROFILE' },
        })
        const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)

        if (orgItem) {
          organizations.push(orgItem as Organization)
        } else {
          console.warn(
            `User ${pathUserId} is linked to non-existent organization ${userProfile.organization_id}.`
          )
        }
      }

      return NextResponse.json(organizations)
    } catch (error) {
      console.error(`Error in GET /api/users/[userId]/organizations:`, error)
      if (
        error instanceof Error &&
        (error.message.includes('Token is not valid') ||
          error.message.includes('Authorization header is missing'))
      ) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      let errorMessage = 'An unknown error occurred.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      return NextResponse.json(
        { error: 'Failed to retrieve user organizations.', details: errorMessage },
        { status: 500 }
      )
    }
  })(req)
}
