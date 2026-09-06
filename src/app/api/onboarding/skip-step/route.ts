// src/app/api/onboarding/skip-step/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { User } from '@/lib/data'

const client = new DynamoDBClient({ region: process.env.AWS_REGION })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME

interface SkipStepRequestBody {
  stepId: string // No specific steps can be skipped anymore
}

function getNextStep(currentStepId: string): string {
  const stepsOrder = ['personal_info', 'organization_details', 'provider_connect', 'review_finish']
  const currentIndex = stepsOrder.indexOf(currentStepId)
  if (currentIndex === -1 || currentIndex === stepsOrder.length - 1) {
    return 'review_finish'
  }
  return stepsOrder[currentIndex + 1]
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(req)

    if (!USERS_TABLE_NAME) {
      console.error('USERS_TABLE_NAME not configured in environment variables.')
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

    const body = (await req.json()) as SkipStepRequestBody
    const { stepId } = body

    console.log(`[Onboarding API] Skipping step "${stepId}" for user ${userId}`)

    if (!stepId) {
      return NextResponse.json({ error: 'Missing stepId' }, { status: 400 })
    }

    // Provider connection cannot be skipped
    if (stepId === 'provider_connect') {
      console.warn(
        `[Onboarding API] User ${userId} attempted to skip required step: provider_connect`
      )
      return NextResponse.json(
        { error: 'Provider connection is required and cannot be skipped' },
        { status: 400 }
      )
    }

    let userRecord: User | undefined
    try {
      const getUserCommand = new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
      const { Item } = await ddbDocClient.send(getUserCommand)

      if (!Item) {
        return NextResponse.json(
          { error: 'User profile not found. Please refresh or try again.' },
          { status: 404 }
        )
      }
      userRecord = Item as User
    } catch (dbError) {
      console.error('Error fetching user from DynamoDB:', dbError)
      return NextResponse.json({ error: 'Failed to retrieve user data' }, { status: 500 })
    }

    const onboardingAudit = userRecord.onboarding_audit || {
      current_step: stepId,
      completed_steps: [],
      skipped_steps: [],
      started_at: Math.floor(Date.now() / 1000),
      completed_at: null,
      step_data: {},
    }

    if (!onboardingAudit.skipped_steps.includes(stepId)) {
      onboardingAudit.skipped_steps.push(stepId)
    }

    onboardingAudit.completed_steps = onboardingAudit.completed_steps.filter((s) => s !== stepId)
    onboardingAudit.current_step = getNextStep(stepId)

    try {
      const updateUserCommand = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET #onboardingAudit = :onboardingAudit, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#onboardingAudit': 'onboarding_audit',
          '#updatedAt': 'updated_at',
        },
        ExpressionAttributeValues: {
          ':onboardingAudit': onboardingAudit,
          ':updatedAt': Math.floor(Date.now() / 1000),
        },
        ReturnValues: 'ALL_NEW',
      })
      const { Attributes: updatedUser } = await ddbDocClient.send(updateUserCommand)

      // The block for updating Clerk metadata has been removed.
      console.log(
        `[Onboarding API] Step "${stepId}" skipped successfully → next step: ${onboardingAudit.current_step}`
      )

      return NextResponse.json({
        success: true,
        nextStepId: onboardingAudit.current_step,
        onboardingAudit: updatedUser?.onboarding_audit || onboardingAudit,
        user: updatedUser,
        skipped: stepId,
      })
    } catch (dbError) {
      console.error('Error updating user onboarding audit in DynamoDB:', dbError)
      return NextResponse.json({ error: 'Failed to update onboarding progress' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in /api/onboarding/skip-step:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to skip onboarding step.', details: msg },
      { status: 500 }
    )
  }
}
