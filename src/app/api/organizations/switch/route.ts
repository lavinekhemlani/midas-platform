// src/app/api/organizations/switch/route.ts
// API endpoint to switch the user's active organization
// This updates active_organization_id in the user's profile

import { NextRequest, NextResponse } from 'next/server'
import { verifyCognitoToken } from '@/lib/cognito-auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { Organization } from '@/lib/data'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
}
const unmarshallOptions = { wrapNumbers: false }
const translateConfig = { marshallOptions, unmarshallOptions }
const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig)

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

interface SwitchOrganizationRequestBody {
  organizationId: string
}

/**
 * POST /api/organizations/switch
 * Switch the user's active organization
 *
 * Request body: { organizationId: "ORG#uuid" }
 * Response: { success: true, activeOrganization: Organization }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await verifyCognitoToken(req)

    if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME) {
      console.error('Table names not configured in environment variables.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing table name.' },
        { status: 500 }
      )
    }

    const body = (await req.json()) as SwitchOrganizationRequestBody
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required.' }, { status: 400 })
    }

    // Validate organization ID format
    if (!organizationId.startsWith('ORG#')) {
      return NextResponse.json(
        { error: 'Invalid organizationId format. Expected format: ORG#uuid' },
        { status: 400 }
      )
    }

    // Verify the organization exists
    const getOrgCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME,
      Key: { PK: organizationId, SK: 'PROFILE' },
    })
    const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)

    if (!orgItem) {
      return NextResponse.json(
        { error: `Organization ${organizationId} not found.` },
        { status: 404 }
      )
    }

    const organization = orgItem as Organization

    // TODO: In the future, verify that the user has access to this organization
    // This could be done via organization_members table or by checking if they're the owner
    // For now, we allow switching to any existing organization

    // Update the user's active_organization_id
    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET #active_org = :orgId, #updated = :now',
      ExpressionAttributeNames: {
        '#active_org': 'active_organization_id',
        '#updated': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':orgId': organizationId,
        ':now': Math.floor(Date.now() / 1000),
      },
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    })

    const { Attributes: updatedUser } = await ddbDocClient.send(updateCommand)

    if (!updatedUser) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      activeOrganization: organization,
      message: `Switched to organization: ${organization.name}`,
    })
  } catch (error) {
    console.error('Error in POST /api/organizations/switch:', error)

    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Handle ConditionalCheckFailedException (user not found)
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
    }

    let errorMessage = 'An unknown error occurred while switching organization.'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: 'Failed to switch organization.', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * GET /api/organizations/switch
 * Get the user's current active organization
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await verifyCognitoToken(req)

    if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME) {
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    // Get user profile
    const getUserCommand = new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    })
    const { Item: userItem } = await ddbDocClient.send(getUserCommand)

    if (!userItem) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 })
    }

    // Get the active organization ID (or fall back to primary)
    const activeOrgId = userItem.active_organization_id || userItem.organization_id

    if (!activeOrgId) {
      return NextResponse.json({
        activeOrganization: null,
        primaryOrganization: null,
      })
    }

    // Fetch the organization details
    const getOrgCommand = new GetCommand({
      TableName: ORGANIZATIONS_TABLE_NAME,
      Key: { PK: activeOrgId, SK: 'PROFILE' },
    })
    const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)

    return NextResponse.json({
      activeOrganization: orgItem as Organization | null,
      activeOrganizationId: activeOrgId,
      primaryOrganizationId: userItem.organization_id,
    })
  } catch (error) {
    console.error('Error in GET /api/organizations/switch:', error)

    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Failed to get active organization.' }, { status: 500 })
  }
}
