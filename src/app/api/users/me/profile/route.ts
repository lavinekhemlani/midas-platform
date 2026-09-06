// src/app/api/users/me/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyCognitoToken } from '@/lib/cognito-auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  TransactWriteCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { User, Organization } from '@/lib/data'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { withRequestContext } from '@/lib/middleware/requestContext'
import { createOrgPK, createUserPK } from '@/lib/db/keys'

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

export const GET = withRequestContext(async (req: NextRequest) => {
  logger.debug('GET /api/users/me/profile called', {
    hasCookie: !!req.headers.get('cookie'),
    hasAuth: !!req.headers.get('authorization'),
  })

  let userId: string | undefined
  let cognitoPayload: any

  try {
    const authResult = await verifyCognitoToken(req)
    userId = authResult.userId
    cognitoPayload = authResult.cognitoPayload
    logger.workflow('auth', 'user_profile_auth_success', {
      userId,
      hasCognitoPayload: !!cognitoPayload,
    })
  } catch (authError) {
    logger.warn('Auth failed for user profile', { error: authError })
    // For debugging - extract userId from cookies if available
    const cookies = req.headers.get('cookie')
    if (cookies && cookies.includes('idToken=')) {
      // Extract userId from token payload without verification (temporary)
      try {
        const idTokenMatch = cookies.match(/idToken=([^;]+)/)
        if (idTokenMatch) {
          const token = decodeURIComponent(idTokenMatch[1])
          const payload = JSON.parse(atob(token.split('.')[1]))
          userId = payload.sub
          logger.debug('Extracted userId from token payload', { userId })
        }
      } catch (e) {
        logger.error('Failed to extract userId from cookie', { error: e })
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication failed', message: 'Please sign in again' },
        { status: 401 }
      )
    }
  }

  try {
    if (!USERS_TABLE_NAME) {
      logger.error('USERS_TABLE_NAME not configured')
      return NextResponse.json(
        { error: 'Server configuration error: Missing table name.' },
        { status: 500 }
      )
    }

    try {
      const getUserCommand = new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      })
      const { Item } = await ddbDocClient.send(getUserCommand)

      if (Item) {
        logger.info('Found existing user profile in DB', { userId })
        let user = Item as User

        // Auto-fix missing terms_accepted for existing users who have completed onboarding
        // This handles users who completed onboarding before the terms_accepted field was added
        if (user.terms_accepted === undefined || user.terms_accepted === null) {
          // Check if user has completed onboarding based on other indicators:
          // 1. Has an organization_id
          // 2. Has completed onboarding steps
          // 3. Has connected providers (checked later)
          const hasCompletedOnboarding =
            user.organization_id && user.onboarding_audit?.completed_steps?.length > 0

          if (hasCompletedOnboarding) {
            logger.info(
              'Auto-fixing missing terms_accepted for existing user who completed onboarding',
              {
                userId,
                organizationId: user.organization_id,
                completedSteps: user.onboarding_audit?.completed_steps,
              }
            )

            // Update the user record to set terms_accepted = true
            try {
              const updateCommand = new UpdateCommand({
                TableName: USERS_TABLE_NAME,
                Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                UpdateExpression:
                  'SET terms_accepted = :termsAccepted, terms_accepted_at = :termsAcceptedAt, updated_at = :updatedAt',
                ExpressionAttributeValues: {
                  ':termsAccepted': true,
                  ':termsAcceptedAt':
                    user.onboarding_audit?.completed_at || Math.floor(Date.now() / 1000),
                  ':updatedAt': Math.floor(Date.now() / 1000),
                },
                ReturnValues: 'ALL_NEW',
              })

              const result = await ddbDocClient.send(updateCommand)
              user = result.Attributes as User
              logger.info('Successfully set terms_accepted for existing user', { userId })
            } catch (updateError) {
              logger.warn('Failed to update terms_accepted for existing user', {
                userId,
                error: updateError,
              })
              // Set it in memory for this session even if DB update fails
              user.terms_accepted = true
              user.terms_accepted_at =
                user.onboarding_audit?.completed_at || Math.floor(Date.now() / 1000)
            }
          }
        }

        // Check if oauth_provider needs to be corrected based on actual Cognito identities
        const identities = cognitoPayload?.identities
          ? Array.isArray(cognitoPayload.identities)
            ? cognitoPayload.identities
            : typeof cognitoPayload.identities === 'string'
              ? JSON.parse(cognitoPayload.identities)
              : []
          : []
        const isOAuthUser = identities.length > 0
        const actualOAuthProvider = isOAuthUser ? identities[0]?.providerName : undefined

        // Fix incorrectly set oauth_provider for existing users
        if (user.oauth_provider !== actualOAuthProvider) {
          logger.info('Correcting oauth_provider', {
            userId,
            oldProvider: user.oauth_provider,
            newProvider: actualOAuthProvider || 'undefined',
          })

          try {
            const updateCommand = new UpdateCommand({
              TableName: USERS_TABLE_NAME,
              Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
              UpdateExpression: actualOAuthProvider
                ? 'SET oauth_provider = :provider, updated_at = :updatedAt'
                : 'REMOVE oauth_provider SET updated_at = :updatedAt',
              ExpressionAttributeValues: actualOAuthProvider
                ? { ':provider': actualOAuthProvider, ':updatedAt': Math.floor(Date.now() / 1000) }
                : { ':updatedAt': Math.floor(Date.now() / 1000) },
              ReturnValues: 'ALL_NEW',
            })

            const result = await ddbDocClient.send(updateCommand)
            user = result.Attributes as User
            logger.info('Successfully corrected oauth_provider', { userId })
          } catch (updateError) {
            logger.warn('Failed to update oauth_provider', { userId, error: updateError })
            // Continue with existing user data even if update fails
          }
        }

        // Fetch organization data if user has an organization_id
        let organization: Organization | null = null
        if (user.organization_id && ORGANIZATIONS_TABLE_NAME) {
          try {
            const getOrgCommand = new GetCommand({
              TableName: ORGANIZATIONS_TABLE_NAME,
              Key: { PK: user.organization_id, SK: 'PROFILE' },
              ConsistentRead: true,
            })
            const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)
            if (orgItem) {
              organization = orgItem as Organization
              // Log QB connection state for debugging multi-entity
              logger.debug('Found organization data for user', {
                userId,
                organizationId: user.organization_id,
              })
            }
          } catch (orgError) {
            logger.warn('Failed to fetch organization data', {
              error: orgError,
              userId,
              organizationId: user.organization_id,
            })
          }
        }

        return NextResponse.json({ ...user, organization })
      }

      logger.debug('User profile not found in DB', { userId })
      const now = Math.floor(Date.now() / 1000)

      // Extract user attributes from Cognito payload (if available)
      const email = cognitoPayload?.email || undefined
      const firstName =
        cognitoPayload?.given_name || cognitoPayload?.name?.split(' ')[0] || undefined
      const lastName =
        cognitoPayload?.family_name ||
        cognitoPayload?.name?.split(' ').slice(1).join(' ') ||
        undefined
      const picture = cognitoPayload?.picture || undefined
      const identities = cognitoPayload?.identities
        ? Array.isArray(cognitoPayload.identities)
          ? cognitoPayload.identities
          : typeof cognitoPayload.identities === 'string'
            ? JSON.parse(cognitoPayload.identities)
            : []
        : []
      const isOAuthUser = identities.length > 0
      const oauthProvider = isOAuthUser ? identities[0]?.providerName : undefined

      console.log('[API] 📋 Extracted user data:', {
        email,
        firstName,
        lastName,
        picture,
        oauthProvider,
        isOAuthUser,
        hasCognitoPayload: !!cognitoPayload,
      })

      // Check if there's an existing profile with this email (migration scenario)
      if (email && email !== `user-${userId}@example.com`) {
        // Obfuscate email in logs for privacy
        const obfuscatedEmail = email.replace(/(.{2}).*(@.*)/, '$1***$2')
        console.log('[API] 🔍 Checking for existing profile with email:', obfuscatedEmail)
        try {
          const scanCommand = new ScanCommand({
            TableName: USERS_TABLE_NAME,
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
              ':email': email,
            },
          })

          const scanResult = await ddbDocClient.send(scanCommand)

          if (scanResult.Items && scanResult.Items.length > 0) {
            const oldProfile = scanResult.Items[0] as User
            const oldUserId = oldProfile.user_id

            logger.info('Migrating existing profile to new user ID', {
              oldUserId,
              newUserId: userId,
            })

            // Create new profile with same data but new user ID
            const migratedProfile = {
              ...oldProfile,
              PK: `USER#${userId}`,
              user_id: userId,
              picture: picture || oldProfile.picture, // Update picture if OAuth provides one
              oauth_provider: oauthProvider || oldProfile.oauth_provider, // Update OAuth provider if applicable
              updated_at: now,
            }

            // Get the user's organization and update ownership
            let organizationItem = null
            if (oldProfile.organization_id && ORGANIZATIONS_TABLE_NAME) {
              try {
                const orgCommand = new ScanCommand({
                  TableName: ORGANIZATIONS_TABLE_NAME,
                  FilterExpression: 'PK = :pk',
                  ExpressionAttributeValues: {
                    ':pk': oldProfile.organization_id,
                  },
                })
                const orgResult = await ddbDocClient.send(orgCommand)
                if (orgResult.Items && orgResult.Items.length > 0) {
                  organizationItem = {
                    ...orgResult.Items[0],
                    owner_user_id: userId,
                    updated_at: now,
                  }
                  console.log('[API] ✓ Found organization:', oldProfile.organization_id)
                }
              } catch (error) {
                console.warn('[API] ⚠️ Could not find organization, will skip org update')
              }
            }

            // Delete old profile and create new one atomically
            const transactItems: any[] = [
              {
                Delete: {
                  TableName: USERS_TABLE_NAME,
                  Key: {
                    PK: `USER#${oldUserId}`,
                    SK: 'PROFILE',
                  },
                },
              },
              {
                Put: {
                  TableName: USERS_TABLE_NAME,
                  Item: migratedProfile,
                },
              },
            ]

            // Also update organization ownership if found
            if (organizationItem && ORGANIZATIONS_TABLE_NAME) {
              transactItems.push({
                Put: {
                  TableName: ORGANIZATIONS_TABLE_NAME,
                  Item: organizationItem,
                },
              })
            }

            const transactCommand = new TransactWriteCommand({
              TransactItems: transactItems,
            })

            await ddbDocClient.send(transactCommand)
            console.log('[API] ✅ Profile migrated successfully')

            // Fetch the organization for the response
            let organization: Organization | null = null
            if (migratedProfile.organization_id && ORGANIZATIONS_TABLE_NAME) {
              try {
                const getOrgCommand = new GetCommand({
                  TableName: ORGANIZATIONS_TABLE_NAME,
                  Key: { PK: migratedProfile.organization_id, SK: 'PROFILE' },
                })
                const { Item: orgItem } = await ddbDocClient.send(getOrgCommand)
                if (orgItem) {
                  organization = orgItem as Organization
                }
              } catch (orgError) {
                console.error('[API] ⚠️ Failed to fetch organization data:', orgError)
              }
            }

            return NextResponse.json({ ...migratedProfile, organization })
          } else {
            console.log('[API] ℹ️ No existing profile found, will create new one')
          }
        } catch (scanError) {
          console.error('[API] ⚠️ Error checking for existing profile:', scanError)
          console.log('[API] ℹ️ Will create new profile')
        }
      }

      // No existing profile found - create a new one
      logger.info('Creating new user profile', { userId })

      // Create placeholder organization
      const orgId = randomUUID()
      const orgPK = createOrgPK(orgId)
      const displayName = `${firstName || 'User'} ${lastName || 'Name'}`

      const newOrganization: Organization = {
        PK: orgPK,
        SK: 'PROFILE',
        organization_id: orgId,
        owner_user_id: userId!,
        name: `${displayName}'s Organization`,
        jurisdiction: '',
        created_at: now,
        updated_at: now,
      }

      const newUser: User = {
        PK: createUserPK(userId),
        SK: 'PROFILE',
        user_id: userId,
        email: email || `user-${userId}@example.com`,
        first_name: firstName || 'User',
        last_name: lastName || 'Name',
        picture: picture,
        oauth_provider: oauthProvider, // Only set if actually an OAuth user
        organization_id: orgPK,
        active_organization_id: orgPK, // Set active org to primary org initially
        subscription_type: 'trial',
        terms_accepted: false, // New users haven't accepted terms yet
        preferences: {
          theme: 'midnight',
          strategic_focus: 'growth',
          proficiency_level: 'beginner',
        },
        onboarding_audit: {
          current_step: 'personal_info',
          completed_steps: [],
          skipped_steps: [],
          started_at: now,
          completed_at: null,
        },
        learn_state: {
          current_path: null,
          completed_terms: [],
          preferred_mode: 'founder',
          reading_history: [],
          preferences: {
            format: 'text',
            complexity: 'beginner',
            notifications: true,
          },
        },
        created_at: now,
        updated_at: now,
      }

      console.log('[API] 💾 Creating user and organization atomically')

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
              Put: {
                TableName: USERS_TABLE_NAME,
                Item: newUser,
              },
            },
          ],
        })

        await ddbDocClient.send(transactCommand)
        console.log(`[API] ✅ Successfully created user ${userId} and organization ${orgPK}`)
        return NextResponse.json({ ...newUser, organization: newOrganization }, { status: 201 })
      } catch (putError) {
        console.error('[API] ❌ Failed to save user and organization to DynamoDB:', putError)
        // Return the user object anyway for immediate use, but log the error
        console.warn('[API] ⚠️ Returning user profile without persisting to DB')
        return NextResponse.json({ ...newUser, organization: newOrganization }, { status: 201 })
      }
    } catch (dbError) {
      console.error('[API] ❌ Error fetching/creating user profile from DynamoDB:', dbError)

      // If DB fails, return a minimal user profile to allow onboarding to proceed
      console.warn('[API] ⚠️ Returning minimal user profile due to DB error')
      const now = Math.floor(Date.now() / 1000)
      const minimalUser = {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        user_id: userId,
        email: `user-${userId}@example.com`,
        first_name: 'User',
        last_name: 'Name',
        subscription_type: 'trial',
        terms_accepted: false, // Minimal user hasn't accepted terms yet
        onboarding_audit: {
          current_step: 'personal_info',
          completed_steps: [],
          skipped_steps: [],
          started_at: now,
          completed_at: null,
        },
        created_at: now,
        updated_at: now,
      }
      return NextResponse.json(minimalUser, { status: 200 })
    }
  } catch (error) {
    logger.error('Global error in GET /api/users/me/profile', {
      error,
      userId,
      errorName: error instanceof Error ? error.name : 'Unknown',
    })

    // Handle authentication errors
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing') ||
        error.message.includes('Token expired'))
    ) {
      return NextResponse.json(
        { error: 'Authentication failed', message: 'Please sign in again' },
        { status: 401 }
      )
    }

    // Handle specific AWS/DynamoDB errors
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return NextResponse.json(
        { error: 'Database table not found', message: 'System configuration error' },
        { status: 500 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'

    return NextResponse.json(
      {
        error: 'Failed to get user profile',
        message: 'Please try again or contact support if the issue persists',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
})

export const PUT = withRequestContext(async (req: NextRequest) => {
  try {
    const { userId } = await verifyCognitoToken(req)

    if (!USERS_TABLE_NAME) {
      logger.error('USERS_TABLE_NAME not configured in environment variables')
      return NextResponse.json(
        { error: 'Server configuration error: Missing table name.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const updateExpressions: string[] = []
    const expressionAttributeNames: Record<string, string> = {}
    const expressionAttributeValues: Record<string, any> = {}

    if (body.firstName !== undefined) {
      updateExpressions.push('#firstName = :firstName')
      expressionAttributeNames['#firstName'] = 'first_name'
      expressionAttributeValues[':firstName'] = body.firstName
    }
    if (body.lastName !== undefined) {
      updateExpressions.push('#lastName = :lastName')
      expressionAttributeNames['#lastName'] = 'last_name'
      expressionAttributeValues[':lastName'] = body.lastName
    }
    if (body.phone !== undefined) {
      updateExpressions.push('#phone = :phone')
      expressionAttributeNames['#phone'] = 'phone'
      expressionAttributeValues[':phone'] = body.phone
    }
    if (body.role_title !== undefined) {
      updateExpressions.push('#roleTitle = :roleTitle')
      expressionAttributeNames['#roleTitle'] = 'role_title'
      expressionAttributeValues[':roleTitle'] = body.role_title
    }
    if (body.picture !== undefined) {
      updateExpressions.push('#picture = :picture')
      expressionAttributeNames['#picture'] = 'picture'
      expressionAttributeValues[':picture'] = body.picture
    }
    if (body.preferences !== undefined) {
      updateExpressions.push('#preferences = :preferences')
      expressionAttributeNames['#preferences'] = 'preferences'
      expressionAttributeValues[':preferences'] = body.preferences
    }
    if (body.learn_state !== undefined) {
      updateExpressions.push('#learnState = :learnState')
      expressionAttributeNames['#learnState'] = 'learn_state'
      expressionAttributeValues[':learnState'] = body.learn_state
    }

    if (updateExpressions.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 })
    }

    updateExpressions.push('#updatedAt = :updatedAt')
    expressionAttributeNames['#updatedAt'] = 'updated_at'
    expressionAttributeValues[':updatedAt'] = Math.floor(Date.now() / 1000)

    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const { Attributes: updatedUserProfile } = await ddbDocClient.send(updateCommand)

    if (!updatedUserProfile) {
      return NextResponse.json(
        { error: 'User profile not found or failed to update.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Profile updated successfully.',
      userProfile: updatedUserProfile,
    })
  } catch (error) {
    logger.error('Error in PUT /api/users/me/profile', { error })
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    let errorMessage = 'An unknown error occurred while updating user profile.'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    return NextResponse.json(
      { error: 'Failed to update user profile.', details: errorMessage },
      { status: 500 }
    )
  }
})
