// src/app/api/onboarding/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { User, Organization } from '@/lib/data'
import { logger } from '@/lib/logger'
import { withRequestContext } from '@/lib/middleware/requestContext'

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

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME
const INITIAL_SYNC_LAMBDA_NAME = process.env.INITIAL_SYNC_LAMBDA_NAME

interface CompleteOnboardingRequestBody {
  acceptTerms: boolean
}

export const POST = withRequestContext(async (req: NextRequest) => {
  try {
    const { userId } = await TokenVerifier.verify(req)

    logger.workflow('onboarding', 'complete_started', { userId })

    // Environment check
    if (!USERS_TABLE_NAME || !process.env.AWS_REGION) {
      logger.error('Server configuration error: Missing USERS_TABLE_NAME or AWS_REGION')
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
    }

    const body = (await req.json()) as CompleteOnboardingRequestBody
    const { acceptTerms } = body

    console.log(`[Onboarding API] Completing onboarding for user ${userId}`)

    if (acceptTerms !== true) {
      return NextResponse.json(
        { error: 'Terms must be accepted to complete onboarding.' },
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
        logger.error('User record not found during onboarding completion', { userId })
        return NextResponse.json(
          { error: 'User profile not found. Please restart onboarding or contact support.' },
          { status: 404 }
        )
      }
      userRecord = Item as User
    } catch (dbError) {
      logger.error('Error fetching user from DynamoDB', { userId, error: dbError })
      return NextResponse.json({ error: 'Failed to retrieve user data' }, { status: 500 })
    }

    // Verify that all required steps are completed
    const requiredSteps = ['setup']
    const completedSteps = userRecord.onboarding_audit?.completed_steps || []
    const missingSteps = requiredSteps.filter((step) => !completedSteps.includes(step))

    if (missingSteps.length > 0) {
      console.warn(`[Onboarding API] Missing required steps for user ${userId}:`, missingSteps)
      logger.warn('User attempted to complete onboarding with missing steps', {
        userId,
        missingSteps,
      })
      return NextResponse.json(
        {
          error: 'Cannot complete onboarding. Please complete all required steps first.',
          missingSteps,
        },
        { status: 400 }
      )
    }

    console.log(`[Onboarding API] All required steps completed:`, completedSteps)

    // Verify that a provider is actually connected
    if (userRecord.organization_id && ORGANIZATIONS_TABLE_NAME) {
      console.log(
        `[Onboarding API] Verifying provider connection for org ${userRecord.organization_id}`
      )
      try {
        const getOrgCommand = new GetCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
        })
        const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)

        if (orgItem) {
          const organization = orgItem as Organization
          const hasConnectedProvider =
            organization.providers &&
            Object.entries(organization.providers).some(([id, p]: [string, any]) => {
              // Multi-entity QB: check connections map
              if (id === 'quickbooks' && p?.connections) {
                return Object.values(p.connections).some((c: any) => c?.credentials?.connected)
              }
              // BC OAuth: check oauthConnections map
              if (id === 'dynamics' && p?.oauthConnections) {
                return Object.entries(p.oauthConnections).some(
                  ([key, conn]: [string, any]) =>
                    key !== '_pending_oauth' && conn?.credentials?.connected === true
                )
              }
              return p?.credentials?.connected
            })

          if (!hasConnectedProvider) {
            console.warn(
              `[Onboarding API] No connected provider found for org ${userRecord.organization_id}`
            )
            logger.warn('User attempted to complete onboarding without a connected provider', {
              userId,
            })
            return NextResponse.json(
              {
                error: 'Cannot complete onboarding. Please connect an accounting provider first.',
                requiresProvider: true,
              },
              { status: 400 }
            )
          }
          console.log(
            `[Onboarding API] Provider connection verified for org ${userRecord.organization_id}`
          )
        }
      } catch (dbError) {
        console.warn(
          '[Onboarding API] Error checking provider connection, continuing anyway:',
          dbError
        )
        logger.warn('Error checking provider connection status', { userId, error: dbError })
        // Continue anyway - don't block completion due to check failure
      }
    }

    const onboardingAudit = userRecord.onboarding_audit || {
      current_step: 'connect',
      completed_steps: [],
      skipped_steps: [],
      started_at: Math.floor(Date.now() / 1000),
      completed_at: null,
      terms_accepted: false,
    }

    const finalStepId = 'connect'
    if (!onboardingAudit.completed_steps.includes(finalStepId)) {
      onboardingAudit.completed_steps.push(finalStepId)
    }
    onboardingAudit.skipped_steps = onboardingAudit.skipped_steps.filter((s) => s !== finalStepId)

    // Save that terms were accepted
    ;(onboardingAudit as any).terms_accepted = true
    ;(onboardingAudit as any).terms_accepted_at = Math.floor(Date.now() / 1000)

    onboardingAudit.completed_at = Math.floor(Date.now() / 1000)
    onboardingAudit.current_step = 'completed'

    try {
      // Update user with both onboarding_audit AND new terms_accepted fields (dual-write for backward compatibility)
      const updateUserCommand = new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression:
          'SET #onboardingAudit = :onboardingAudit, #updatedAt = :updatedAt, #termsAccepted = :termsAccepted, #termsAcceptedAt = :termsAcceptedAt',
        ExpressionAttributeNames: {
          '#onboardingAudit': 'onboarding_audit',
          '#updatedAt': 'updated_at',
          '#termsAccepted': 'terms_accepted',
          '#termsAcceptedAt': 'terms_accepted_at',
        },
        ExpressionAttributeValues: {
          ':onboardingAudit': onboardingAudit,
          ':updatedAt': Math.floor(Date.now() / 1000),
          ':termsAccepted': true,
          ':termsAcceptedAt': Math.floor(Date.now() / 1000),
        },
        ReturnValues: 'ALL_NEW',
      })
      const { Attributes: updatedUser } = await ddbDocClient.send(updateUserCommand)

      // The block for updating Clerk metadata has been removed as it's no longer necessary.
      logger.workflow('onboarding', 'completed', {
        userId,
        organizationId: userRecord.organization_id,
      })

      // Trigger sync lambda if configured
      if (INITIAL_SYNC_LAMBDA_NAME && userRecord.organization_id) {
        try {
          const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION })
          const invokeCommand = new InvokeCommand({
            FunctionName: INITIAL_SYNC_LAMBDA_NAME,
            Payload: JSON.stringify({
              userId: userId,
              organizationId: userRecord.organization_id.replace('ORG#', ''),
            }),
            InvocationType: 'Event',
          })
          await lambdaClient.send(invokeCommand)
          logger.info('Successfully triggered initial sync lambda', {
            lambdaName: INITIAL_SYNC_LAMBDA_NAME,
            userId,
            organizationId: userRecord.organization_id,
          })
        } catch (lambdaError) {
          logger.error('Error triggering initial sync lambda', {
            lambdaName: INITIAL_SYNC_LAMBDA_NAME,
            userId,
            error: lambdaError,
          })
        }
      } else if (INITIAL_SYNC_LAMBDA_NAME && !userRecord.organization_id) {
        logger.warn('Initial sync lambda configured but no organization_id found', {
          lambdaName: INITIAL_SYNC_LAMBDA_NAME,
          userId,
        })
      }

      console.log(`[Onboarding API] ✓ Onboarding completed successfully for user ${userId}`)

      return NextResponse.json({
        success: true,
        message: 'Onboarding completed successfully!',
        user: updatedUser,
      })
    } catch (dbError) {
      logger.error('Error updating user onboarding completion in DynamoDB', { error: dbError })
      return NextResponse.json({ error: 'Failed to complete onboarding process' }, { status: 500 })
    }
  } catch (error) {
    logger.error('Error in /api/onboarding/complete', { error })
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to complete onboarding.', details: msg },
      { status: 500 }
    )
  }
})
