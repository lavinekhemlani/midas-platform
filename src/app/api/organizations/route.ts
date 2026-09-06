// src/app/api/organizations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyCognitoToken } from '@/lib/cognito-auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Organization } from '@/lib/data'
import { randomUUID } from 'crypto'
import { createOrgPK } from '@/lib/db/keys'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
}
const unmarshallOptions = { wrapNumbers: false }
const translateConfig = { marshallOptions, unmarshallOptions }
const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig)
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME

interface CreateOrganizationRequestBody {
  name: string
  legal_name?: string
  jurisdiction: string
  incorporation_date?: string
  revenue_model?: string
  vat_registered?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await verifyCognitoToken(req)

    if (!ORGANIZATIONS_TABLE_NAME) {
      console.error('ORGANIZATIONS_TABLE_NAME not configured in environment variables.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing table name.' },
        { status: 500 }
      )
    }
    if (!process.env.AWS_REGION) {
      console.error('AWS_REGION not configured in environment variables.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing AWS region.' },
        { status: 500 }
      )
    }

    const body = (await req.json()) as CreateOrganizationRequestBody

    // --- Validation ---
    if (!body.name || body.name.length < 2 || body.name.length > 140) {
      return NextResponse.json(
        { error: 'Organization name must be between 2 and 140 characters.' },
        { status: 400 }
      )
    }
    if (!body.jurisdiction) {
      return NextResponse.json({ error: 'Jurisdiction is required.' }, { status: 400 })
    }
    if (body.incorporation_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.incorporation_date)) {
      return NextResponse.json(
        { error: 'Incorporation date must be in YYYY-MM-DD format.' },
        { status: 400 }
      )
    }

    const organizationId = randomUUID()
    const now = Math.floor(Date.now() / 1000)

    const newOrganization: Organization = {
      PK: createOrgPK(organizationId),
      SK: 'PROFILE',
      organization_id: organizationId,
      owner_user_id: userId, // <-- Updated from owner_clerk_id
      name: body.name,
      legal_name: body.legal_name,
      jurisdiction: body.jurisdiction,
      incorporation_date: body.incorporation_date,
      revenue_model: body.revenue_model,
      vat_registered: body.vat_registered,
      created_at: now,
      updated_at: now,
    }

    const putCommand = new PutCommand({
      TableName: ORGANIZATIONS_TABLE_NAME,
      Item: newOrganization,
    })

    await ddbDocClient.send(putCommand)

    return NextResponse.json(newOrganization, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/organizations:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    let errorMessage = 'An unknown error occurred while creating the organization.'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    if (error instanceof SyntaxError) {
      errorMessage = 'Invalid request body: Could not parse JSON.'
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }
    return NextResponse.json(
      { error: 'Failed to create organization.', details: errorMessage },
      { status: 500 }
    )
  }
}
