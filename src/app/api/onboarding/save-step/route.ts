// src/app/api/onboarding/save-step/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { User, Organization, StoredFile } from '@/lib/data'
import { randomUUID } from 'crypto'
import { TokenVerifier } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { withRequestContext } from '@/lib/middleware/requestContext'
import { createOrgPK, createUserPK } from '@/lib/db/keys'

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

interface PersonalInfoData {
  firstName: string
  lastName: string
  email: string
  roleTitle: string
  proficiencyLevel: string
}

interface MetricTarget {
  metric_id: string
  target: number
  unit: string
}

interface OrganizationDetailsData {
  name: string
  jurisdiction: string
  incorporation_date?: string
  revenue_model?: string
  default_currency?: string
  corporateS3Key?: string
  corporateFileName?: string
  financial_health_metrics?: string[]
  financial_health_targets?: MetricTarget[]
}

interface FileUploadData {
  s3Key: string
  fileName: string
  fileSize: number
  uploadedAt: number
}

type StepData = PersonalInfoData | OrganizationDetailsData | FileUploadData | Record<string, any>

interface SetupData {
  revenue_model: string
  financial_health_metrics?: string[]
  financial_health_targets?: MetricTarget[]
}

interface SaveStepRequestBody {
  stepId: 'setup' | 'connect' | 'personal_info' | 'organization_details' | 'provider_connect'
  data: StepData | SetupData
}

function getNextStep(currentStepId: string): string {
  const stepsOrder = ['setup', 'connect']
  const currentIndex = stepsOrder.indexOf(currentStepId)
  if (currentIndex === -1 || currentIndex === stepsOrder.length - 1) {
    return 'connect'
  }
  return stepsOrder[currentIndex + 1]
}

export const POST = withRequestContext(async (req: NextRequest) => {
  let body: SaveStepRequestBody | undefined

  try {
    const { userId } = await TokenVerifier.verify(req)

    if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME) {
      logger.error('DynamoDB table names not configured in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error: Missing table names.' },
        { status: 500 }
      )
    }
    if (!process.env.AWS_REGION) {
      logger.error('AWS_REGION not configured in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error: Missing AWS region.' },
        { status: 500 }
      )
    }

    body = (await req.json()) as SaveStepRequestBody
    const { stepId, data } = body

    if (!stepId || !data) {
      return NextResponse.json({ error: 'Missing stepId or data' }, { status: 400 })
    }

    console.log(`[Onboarding API] Saving step "${stepId}" for user ${userId}`)
    logger.workflow('onboarding', 'save_step', { userId, stepId })

    let userRecord: User | undefined
    try {
      const getUserCommand = new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
      const { Item } = await ddbDocClient.send(getUserCommand)

      if (!Item) {
        logger.warn('User profile not found during save-step', { userId })
        return NextResponse.json(
          { error: 'User profile not initialized. Please refresh or try again.' },
          { status: 404 }
        )
      }
      userRecord = Item as User
    } catch (dbError) {
      logger.error('Error fetching user from DynamoDB', { error: dbError })
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

    if (!onboardingAudit.step_data) {
      onboardingAudit.step_data = {}
    }

    const updateExpressions: string[] = ['#updatedAt = :updatedAt']
    const expressionAttributeNames: Record<string, string> = { '#updatedAt': 'updated_at' }
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': Math.floor(Date.now() / 1000),
    }
    let updatedUserAttributes: Partial<User> = {}
    let newOrUpdatedOrganization: Organization | null = null

    switch (stepId) {
      case 'setup':
        const setupData = data as SetupData
        if (!setupData.revenue_model) {
          return NextResponse.json({ error: 'Revenue model is required.' }, { status: 400 })
        }

        let setupOrgPK: `ORG#${string}`
        const setupNow = Math.floor(Date.now() / 1000)

        if (userRecord.organization_id) {
          // Update existing organization with revenue model and financial health metrics
          setupOrgPK = userRecord.organization_id
          console.log(`[Onboarding API] Updating existing organization ${setupOrgPK}`)

          try {
            const updateOrgCmd = new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: setupOrgPK, SK: 'PROFILE' },
              UpdateExpression:
                'SET #revenue_model = :revenue_model, #financial_health_metrics = :financial_health_metrics, #financial_health_targets = :financial_health_targets, #providers = if_not_exists(#providers, :empty_providers), #updated_at = :updated_at',
              ExpressionAttributeNames: {
                '#revenue_model': 'revenue_model',
                '#financial_health_metrics': 'financial_health_metrics',
                '#financial_health_targets': 'financial_health_targets',
                '#providers': 'providers',
                '#updated_at': 'updated_at',
              },
              ExpressionAttributeValues: {
                ':revenue_model': setupData.revenue_model,
                ':financial_health_metrics': setupData.financial_health_metrics || null,
                ':financial_health_targets': setupData.financial_health_targets || null,
                ':empty_providers': {},
                ':updated_at': setupNow,
              },
              ReturnValues: 'ALL_NEW',
            })
            const { Attributes } = await ddbDocClient.send(updateOrgCmd)
            newOrUpdatedOrganization = Attributes as Organization
            console.log(`[Onboarding API] Organization ${setupOrgPK} updated successfully`)
          } catch (dbError) {
            console.error('Error updating organization in DynamoDB:', dbError)
            return NextResponse.json(
              { error: 'Failed to update organization details' },
              { status: 500 }
            )
          }
        } else {
          // Create new organization with revenue model and financial health metrics
          const orgId = randomUUID()
          setupOrgPK = createOrgPK(orgId)
          console.log(`[Onboarding API] Creating new organization ${setupOrgPK} for user ${userId}`)

          const newOrganization: Organization = {
            PK: setupOrgPK,
            SK: 'PROFILE',
            organization_id: orgId,
            owner_user_id: userId,
            name: `${userRecord.first_name || 'User'}'s Organization`, // Temporary name
            jurisdiction: 'US', // Default jurisdiction
            revenue_model: setupData.revenue_model,
            financial_health_metrics: setupData.financial_health_metrics,
            financial_health_targets: setupData.financial_health_targets,
            created_at: setupNow,
            updated_at: setupNow,
            providers: {},
          }

          try {
            const transactCommand = new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: ORGANIZATIONS_TABLE_NAME,
                    Item: newOrganization,
                  },
                },
                {
                  Update: {
                    TableName: USERS_TABLE_NAME,
                    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                    UpdateExpression: 'SET #organizationId = :organizationId, #updatedAt = :now',
                    ExpressionAttributeNames: {
                      '#organizationId': 'organization_id',
                      '#updatedAt': 'updated_at',
                    },
                    ExpressionAttributeValues: {
                      ':organizationId': setupOrgPK,
                      ':now': setupNow,
                    },
                  },
                },
              ],
            })
            await ddbDocClient.send(transactCommand)

            console.log(
              `[Onboarding API] Organization ${setupOrgPK} created and linked to user successfully`
            )
            updatedUserAttributes.organization_id = setupOrgPK
            newOrUpdatedOrganization = newOrganization
          } catch (dbError) {
            console.error('Error in transaction to create organization:', dbError)
            return NextResponse.json(
              { error: 'Failed to save organization details' },
              { status: 500 }
            )
          }
        }

        onboardingAudit.step_data.setup = setupData
        break

      case 'connect':
        // This step doesn't save anything directly - the completion is handled by the complete endpoint
        // Just mark it as completed
        break

      case 'personal_info':
        const personalData = data as PersonalInfoData
        if (
          !personalData.firstName ||
          personalData.firstName.length < 2 ||
          personalData.firstName.length > 50
        ) {
          return NextResponse.json(
            { error: 'First name must be between 2 and 50 characters.' },
            { status: 400 }
          )
        }
        if (
          !personalData.lastName ||
          personalData.lastName.length < 2 ||
          personalData.lastName.length > 50
        ) {
          return NextResponse.json(
            { error: 'Last name must be between 2 and 50 characters.' },
            { status: 400 }
          )
        }
        if (
          (personalData as any).phone &&
          !/^\+?[1-9]\d{1,14}$/.test((personalData as any).phone)
        ) {
          return NextResponse.json({ error: 'Invalid phone number format.' }, { status: 400 })
        }
        if (personalData.roleTitle && personalData.roleTitle.length > 60) {
          return NextResponse.json(
            { error: 'Role/Title must be 60 characters or less.' },
            { status: 400 }
          )
        }

        expressionAttributeNames['#firstName'] = 'first_name'
        expressionAttributeValues[':firstName'] = personalData.firstName
        updateExpressions.push('#firstName = :firstName')
        updatedUserAttributes.first_name = personalData.firstName

        expressionAttributeNames['#lastName'] = 'last_name'
        expressionAttributeValues[':lastName'] = personalData.lastName
        updateExpressions.push('#lastName = :lastName')
        updatedUserAttributes.last_name = personalData.lastName

        if ((personalData as any).phone) {
          expressionAttributeNames['#phone'] = 'phone'
          expressionAttributeValues[':phone'] = (personalData as any).phone
          updateExpressions.push('#phone = :phone')
          updatedUserAttributes.phone = (personalData as any).phone
        }
        if (personalData.roleTitle) {
          expressionAttributeNames['#roleTitle'] = 'role_title'
          expressionAttributeValues[':roleTitle'] = personalData.roleTitle
          updateExpressions.push('#roleTitle = :roleTitle')
          updatedUserAttributes.role_title = personalData.roleTitle
        }

        onboardingAudit.step_data.personal_info = personalData
        break

      case 'organization_details':
        const orgData = data as OrganizationDetailsData
        if (!orgData.name || orgData.name.length < 2 || orgData.name.length > 140) {
          return NextResponse.json(
            { error: 'Organization name must be between 2 and 140 characters.' },
            { status: 400 }
          )
        }
        if (!orgData.jurisdiction) {
          return NextResponse.json({ error: 'Jurisdiction is required.' }, { status: 400 })
        }
        if (orgData.incorporation_date && !/^\d{4}-\d{2}-\d{2}$/.test(orgData.incorporation_date)) {
          return NextResponse.json(
            { error: 'Incorporation date must be in YYYY-MM-DD format.' },
            { status: 400 }
          )
        }

        let orgPK: `ORG#${string}`
        const now = Math.floor(Date.now() / 1000)

        if (userRecord.organization_id) {
          orgPK = userRecord.organization_id
          console.log(`[Onboarding API] Updating existing organization ${orgPK}`)

          try {
            const updateOrgCmd = new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: orgPK, SK: 'PROFILE' },
              UpdateExpression:
                'SET #name = :name, #jurisdiction = :jurisdiction, #incorporation_date = :incorporation_date, #revenue_model = :revenue_model, #corp_profile = :corp_profile, #financial_health_metrics = :financial_health_metrics, #financial_health_targets = :financial_health_targets, #providers = if_not_exists(#providers, :empty_providers), #updated_at = :updated_at',
              ExpressionAttributeNames: {
                '#name': 'name',
                '#jurisdiction': 'jurisdiction',
                '#incorporation_date': 'incorporation_date',
                '#revenue_model': 'revenue_model',
                '#corp_profile': 'corp_profile',
                '#financial_health_metrics': 'financial_health_metrics',
                '#financial_health_targets': 'financial_health_targets',
                '#providers': 'providers',
                '#updated_at': 'updated_at',
              },
              ExpressionAttributeValues: {
                ':name': orgData.name,
                ':jurisdiction': orgData.jurisdiction,
                ':incorporation_date': orgData.incorporation_date || null,
                ':revenue_model': orgData.revenue_model || null,
                ':corp_profile':
                  orgData.corporateS3Key && orgData.corporateFileName
                    ? {
                        s3Key: orgData.corporateS3Key,
                        fileName: orgData.corporateFileName,
                        uploadedAt: now,
                      }
                    : null,
                ':financial_health_metrics': orgData.financial_health_metrics || null,
                ':financial_health_targets': orgData.financial_health_targets || null,
                ':empty_providers': {},
                ':updated_at': now,
              },
              ReturnValues: 'ALL_NEW',
            })
            const { Attributes } = await ddbDocClient.send(updateOrgCmd)
            newOrUpdatedOrganization = Attributes as Organization
            console.log(`[Onboarding API] Organization ${orgPK} updated successfully`)
          } catch (dbError) {
            console.error('Error updating organization in DynamoDB:', dbError)
            return NextResponse.json(
              { error: 'Failed to update organization details' },
              { status: 500 }
            )
          }
        } else {
          const orgId = randomUUID()
          orgPK = createOrgPK(orgId)
          console.log(`[Onboarding API] Creating new organization ${orgPK} for user ${userId}`)
          const newOrganization: Organization = {
            PK: orgPK,
            SK: 'PROFILE',
            organization_id: orgId,
            owner_user_id: userId, // Changed from owner_clerk_id
            name: orgData.name,
            jurisdiction: orgData.jurisdiction,
            incorporation_date: orgData.incorporation_date,
            revenue_model: orgData.revenue_model,
            financial_health_metrics: orgData.financial_health_metrics,
            financial_health_targets: orgData.financial_health_targets,
            corp_profile:
              orgData.corporateS3Key && orgData.corporateFileName
                ? {
                    s3Key: orgData.corporateS3Key,
                    fileName: orgData.corporateFileName,
                    uploadedAt: now,
                    fileSize: 0, // Add default fileSize
                  }
                : undefined,
            created_at: now,
            updated_at: now,
            providers: {}, // Initialize empty providers map for new provider-agnostic structure
          }

          try {
            const transactCommand = new TransactWriteCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: ORGANIZATIONS_TABLE_NAME,
                    Item: newOrganization,
                  },
                },
                {
                  Update: {
                    TableName: USERS_TABLE_NAME,
                    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                    UpdateExpression: 'SET #organizationId = :organizationId, #updatedAt = :now',
                    ExpressionAttributeNames: {
                      '#organizationId': 'organization_id',
                      '#updatedAt': 'updated_at',
                    },
                    ExpressionAttributeValues: {
                      ':organizationId': orgPK,
                      ':now': now,
                    },
                  },
                },
              ],
            })
            await ddbDocClient.send(transactCommand)

            console.log(
              `[Onboarding API] Organization ${orgPK} created and linked to user successfully`
            )
            updatedUserAttributes.organization_id = orgPK
            newOrUpdatedOrganization = newOrganization
          } catch (dbError) {
            console.error('Error in transaction to create organization:', dbError)
            return NextResponse.json(
              { error: 'Failed to save organization details' },
              { status: 500 }
            )
          }
        }

        onboardingAudit.step_data.organization_details = orgData
        break

      case 'provider_connect':
        if (!userRecord.organization_id) {
          return NextResponse.json(
            { error: 'Organization details must be completed before connecting a provider.' },
            { status: 400 }
          )
        }

        console.log(
          `[Onboarding API] Verifying provider connection for org ${userRecord.organization_id}`
        )

        // Verify that a provider is actually connected before marking step as complete
        let hasConnectedProvider = false
        try {
          const orgGetCommand = new GetCommand({
            TableName: ORGANIZATIONS_TABLE_NAME,
            Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
          })
          const { Item: orgItem } = await ddbDocClient.send(orgGetCommand)
          // Check for any connected provider
          hasConnectedProvider =
            orgItem?.providers &&
            Object.entries(orgItem.providers).some(([id, p]: [string, any]) => {
              // Multi-entity QB: check connections map
              if (id === 'quickbooks' && p?.connections) {
                return Object.values(p.connections).some((c: any) => c?.credentials?.connected)
              }
              return p?.credentials?.connected
            })
          if (!hasConnectedProvider) {
            console.warn(
              `[Onboarding API] Provider connection verification failed - no connected provider for org ${userRecord.organization_id}`
            )
            return NextResponse.json(
              {
                error: 'No provider is connected. Please connect a provider before continuing.',
                requiresConnection: true,
              },
              { status: 400 }
            )
          }
          console.log(
            `[Onboarding API] Provider connection verified for org ${userRecord.organization_id}`
          )
        } catch (e) {
          console.error('[Onboarding API] Error verifying provider connection:', e)
          return NextResponse.json(
            { error: 'Failed to verify provider connection status' },
            { status: 500 }
          )
        }
        break

      // Legacy case - not part of current flow but kept for backward compatibility
      case 'manual_financials' as any:
        const manualData = data as StoredFile
        if (!manualData.s3Key || !manualData.fileName) {
          return NextResponse.json({ error: 'S3 key and file name are required.' }, { status: 400 })
        }
        if (!userRecord.organization_id) {
          return NextResponse.json({ error: 'Organization must be set first.' }, { status: 400 })
        }
        try {
          const orgGetCommand = new GetCommand({
            TableName: ORGANIZATIONS_TABLE_NAME,
            Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
          })
          const { Item: orgItem } = await ddbDocClient.send(orgGetCommand)
          const organization = orgItem as Organization

          if (organization?.manual_financials?.length) {
            console.log(
              `Organization ${userRecord.organization_id} already has ${organization.manual_financials.length} financial documents. Adding new one: ${manualData.s3Key}`
            )
          }

          await ddbDocClient.send(
            new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
              UpdateExpression:
                'SET #manual_financials = list_append(if_not_exists(#manual_financials, :empty_list), :file), #orgUpdatedAt = :orgUpdatedAtVal',
              ExpressionAttributeNames: {
                '#manual_financials': 'manual_financials',
                '#orgUpdatedAt': 'updated_at',
              },
              ExpressionAttributeValues: {
                ':file': [manualData],
                ':empty_list': [],
                ':orgUpdatedAtVal': Math.floor(Date.now() / 1000),
              },
            })
          )
        } catch (dbError) {
          console.error('Error updating org with manual financials:', dbError)
          return NextResponse.json({ error: 'Failed to save financials link' }, { status: 500 })
        }
        break

      // Legacy case - not part of current flow but kept for backward compatibility
      case 'corp_profile_upload' as any:
        const corpProfileData = data as StoredFile
        if (!corpProfileData.s3Key || !corpProfileData.fileName) {
          return NextResponse.json({ error: 'S3 key and file name are required.' }, { status: 400 })
        }
        if (!userRecord.organization_id) {
          return NextResponse.json({ error: 'Organization must be set first.' }, { status: 400 })
        }

        try {
          const orgGetCommand = new GetCommand({
            TableName: ORGANIZATIONS_TABLE_NAME,
            Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
          })
          const { Item: orgItem } = await ddbDocClient.send(orgGetCommand)
          const organization = orgItem as Organization

          if (organization?.corp_profile?.s3Key) {
            console.log(
              `Replacing existing corp profile ${organization.corp_profile.s3Key} with new one ${corpProfileData.s3Key} for org ${userRecord.organization_id}`
            )
          }

          await ddbDocClient.send(
            new UpdateCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: userRecord.organization_id, SK: 'PROFILE' },
              UpdateExpression:
                'SET #corp_profile = :corpProfile, #orgUpdatedAt = :orgUpdatedAtVal',
              ExpressionAttributeNames: {
                '#corp_profile': 'corp_profile',
                '#orgUpdatedAt': 'updated_at',
              },
              ExpressionAttributeValues: {
                ':corpProfile': corpProfileData,
                ':orgUpdatedAtVal': Math.floor(Date.now() / 1000),
              },
            })
          )
        } catch (dbError) {
          console.error('Error updating org with corp profile key:', dbError)
          return NextResponse.json({ error: 'Failed to save corp profile link' }, { status: 500 })
        }
        break

      default:
        return NextResponse.json({ error: `Invalid stepId: ${stepId}` }, { status: 400 })
    }

    if (!onboardingAudit.completed_steps.includes(stepId)) {
      onboardingAudit.completed_steps.push(stepId)
    }
    onboardingAudit.skipped_steps = onboardingAudit.skipped_steps.filter((s) => s !== stepId)
    onboardingAudit.current_step = getNextStep(stepId)

    expressionAttributeNames['#onboardingAudit'] = 'onboarding_audit'
    expressionAttributeValues[':onboardingAudit'] = onboardingAudit
    updateExpressions.push('#onboardingAudit = :onboardingAudit')

    try {
      if (stepId !== 'organization_details' || userRecord.organization_id) {
        const updateUserCommand = new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
        const { Attributes: updatedUser } = await ddbDocClient.send(updateUserCommand)
        updatedUserAttributes = updatedUser as Partial<User>
      } else {
        const res = await ddbDocClient.send(
          new GetCommand({
            TableName: USERS_TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
          })
        )
        updatedUserAttributes = res.Item as Partial<User>
      }

      console.log(
        `[Onboarding API] Step "${stepId}" saved successfully → next step: ${onboardingAudit.current_step}`
      )

      return NextResponse.json({
        success: true,
        nextStepId: onboardingAudit.current_step,
        onboardingAudit: updatedUserAttributes.onboarding_audit || onboardingAudit,
        user: updatedUserAttributes,
        ...(newOrUpdatedOrganization && { organization: newOrUpdatedOrganization }),
      })
    } catch (dbError) {
      console.error('Error updating user onboarding audit in DynamoDB:', dbError)
      return NextResponse.json({ error: 'Failed to update onboarding progress' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in /api/onboarding/save-step:', error)

    // Handle authentication errors
    if (
      error instanceof Error &&
      (error.message.includes('Authorization header is missing') ||
        error.message.includes('Token is not valid'))
    ) {
      return NextResponse.json(
        { error: 'Authentication failed', message: 'Please sign in again' },
        { status: 401 }
      )
    }

    // Handle validation errors
    if (error instanceof Error && error.message.includes('must be between')) {
      return NextResponse.json(
        { error: 'Validation failed', message: error.message },
        { status: 400 }
      )
    }

    // Handle AWS/DynamoDB errors
    if (
      error instanceof Error &&
      (error.name === 'ResourceNotFoundException' ||
        error.name === 'ConditionalCheckFailedException')
    ) {
      return NextResponse.json(
        { error: 'Database error', message: 'Unable to save data. Please try again.' },
        { status: 500 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    console.error('[API] Save-step error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stepId: body?.stepId,
    })

    return NextResponse.json(
      {
        error: 'Failed to save onboarding step',
        message: 'Please try again or contact support if the issue persists',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
})
