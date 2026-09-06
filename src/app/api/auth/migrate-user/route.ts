// src/app/api/auth/migrate-user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// Old pool configuration
const OLD_USER_POOL_ID = 'us-east-1_McfBX9Eit';
const OLD_CLIENT_ID = '2oi2bvkep5j0p4be2fnjcm3dif';

// New pool configuration
const NEW_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const REGION = 'us-east-1';

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

// DynamoDB setup for creating user profiles
const dynamoClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

/**
 * POST /api/auth/migrate-user
 *
 * Migrates a user from the old Cognito pool to the new pool
 * Called when sign-in fails in the new pool
 */
export async function POST(request: NextRequest) {
  let email = '';

  try {
    const body = await request.json();
    email = body.email;
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log(`[Migration] Attempting to migrate user: ${email}`);

    // Step 1: Authenticate user in OLD pool
    const isAuthenticated = await authenticateInOldPool(email, password);

    if (!isAuthenticated) {
      console.log(`[Migration] ✗ User ${email} not found or incorrect password in old pool`);
      return NextResponse.json(
        { error: 'Incorrect username or password', migrated: false },
        { status: 401 }
      );
    }

    console.log(`[Migration] ✓ User ${email} authenticated in old pool`);

    // Step 2: Get user attributes from old pool
    const userAttributes = await getUserFromOldPool(email);

    // Step 3: Create user in NEW pool (returns the Cognito user ID)
    const userId = await createUserInNewPool(email, password, userAttributes);

    console.log(`[Migration] ✓ User ${email} successfully migrated to new pool`);

    // Step 4: Migrate existing DynamoDB profile to use new user ID
    await migrateUserProfile(userId, userAttributes);

    console.log(`[Migration] ✓ User profile migrated in DynamoDB for ${email}`);

    return NextResponse.json({
      success: true,
      migrated: true,
      message: 'User migrated successfully. Please sign in again.',
    });

  } catch (error: any) {
    console.error('[Migration] Error:', error);

    // Handle specific error cases
    if (error.name === 'UsernameExistsException') {
      console.log(`[Migration] User ${email} already exists in new pool (likely manually migrated)`);
      return NextResponse.json(
        {
          error: 'User already exists in new pool',
          migrated: false,
          alreadyExists: true,
          message: 'This account was recently migrated. Please use the "Forgot Password" link to reset your password.'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Migration failed. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Authenticate user in the OLD Cognito pool
 */
async function authenticateInOldPool(email: string, password: string): Promise<boolean> {
  try {
    const command = new AdminInitiateAuthCommand({
      UserPoolId: OLD_USER_POOL_ID,
      ClientId: OLD_CLIENT_ID,
      AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    // Check if authentication was successful
    if (response.AuthenticationResult) {
      return true;
    }

    // Handle NEW_PASSWORD_REQUIRED challenge
    // User exists but has temporary password - still count as authenticated
    if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      console.log(`[Migration] User ${email} has temporary password in old pool`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('[Migration] Authentication error in old pool:', error);

    // User not found or incorrect password
    if (
      error.name === 'NotAuthorizedException' ||
      error.name === 'UserNotFoundException'
    ) {
      return false;
    }

    // For other errors, re-throw
    throw error;
  }
}

/**
 * Get user attributes from OLD Cognito pool
 */
async function getUserFromOldPool(email: string) {
  try {
    const command = new AdminGetUserCommand({
      UserPoolId: OLD_USER_POOL_ID,
      Username: email,
    });

    const response = await cognitoClient.send(command);

    // Convert attributes array to object
    const attributes: Record<string, string> = {};
    response.UserAttributes?.forEach((attr) => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    console.log('[Migration] Retrieved user attributes from old pool');

    return {
      email: attributes.email || email,
      email_verified: attributes.email_verified === 'true',
      given_name: attributes.given_name || 'User',
      family_name: attributes.family_name,
      picture: attributes.picture,
    };
  } catch (error: any) {
    console.error('[Migration] Error getting user from old pool:', error);

    // If user not found, return minimal attributes
    if (error.name === 'UserNotFoundException') {
      return {
        email,
        email_verified: true,
        given_name: 'User',
      };
    }

    throw error;
  }
}

/**
 * Create user in NEW Cognito pool with same password
 * Returns the user's Cognito sub (user ID)
 */
async function createUserInNewPool(
  email: string,
  password: string,
  attributes: {
    email: string;
    email_verified: boolean;
    given_name: string;
    family_name?: string;
    picture?: string;
  }
): Promise<string> {
  try {
    // Step 1: Create the user (with temporary password)
    const userAttributesArray = [
      { Name: 'email', Value: attributes.email },
      { Name: 'email_verified', Value: String(attributes.email_verified) },
      { Name: 'given_name', Value: attributes.given_name },
    ];

    // Only add family_name if it exists (it's optional in new pool)
    if (attributes.family_name) {
      userAttributesArray.push({ Name: 'family_name', Value: attributes.family_name });
    }

    // Add picture if exists
    if (attributes.picture) {
      userAttributesArray.push({ Name: 'picture', Value: attributes.picture });
    }

    const createCommand = new AdminCreateUserCommand({
      UserPoolId: NEW_USER_POOL_ID,
      Username: email,
      UserAttributes: userAttributesArray,
      MessageAction: 'SUPPRESS', // Don't send welcome email
      TemporaryPassword: generateRandomPassword(),
    });

    const createResponse = await cognitoClient.send(createCommand);
    console.log(`[Migration] ✓ User ${email} created in new pool`);

    // Step 2: Set their actual password (the one they just used to sign in)
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: NEW_USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true, // Make it permanent, not temporary
    });

    await cognitoClient.send(setPasswordCommand);
    console.log(`[Migration] ✓ Password set for user ${email} in new pool`);

    // Step 3: Confirm the user to skip email verification requirement
    try {
      const confirmCommand = new AdminConfirmSignUpCommand({
        UserPoolId: NEW_USER_POOL_ID,
        Username: email,
      });

      await cognitoClient.send(confirmCommand);
      console.log(`[Migration] ✓ User ${email} confirmed in new pool`);
    } catch (confirmError: any) {
      // Log but don't fail migration if confirmation fails
      // Some Cognito setups may not support AdminConfirmSignUp
      console.warn(`[Migration] ⚠️ Could not auto-confirm user ${email}:`, confirmError.message);
    }

    // Extract the user's Cognito sub (user ID) from the response
    const subAttribute = createResponse.User?.Attributes?.find(attr => attr.Name === 'sub');
    const userId = subAttribute?.Value;

    if (!userId) {
      throw new Error('Failed to get user ID from Cognito response');
    }

    return userId;

  } catch (error: any) {
    console.error('[Migration] Error creating user in new pool:', error);
    throw error;
  }
}

/**
 * Migrate existing user profile in DynamoDB to use new Cognito user ID
 */
async function migrateUserProfile(
  newUserId: string,
  attributes: {
    email: string;
    given_name: string;
    family_name?: string;
    picture?: string;
  }
) {
  try {
    if (!USERS_TABLE_NAME || !ORGANIZATIONS_TABLE_NAME) {
      console.warn('[Migration] ⚠️ DynamoDB tables not configured, skipping profile migration');
      return;
    }

    // Step 1: Find existing profile by email
    console.log(`[Migration] 🔍 Searching for existing profile with email: ${attributes.email}`);

    const scanCommand = new ScanCommand({
      TableName: USERS_TABLE_NAME,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': attributes.email,
      },
    });

    const scanResult = await ddbDocClient.send(scanCommand);

    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.warn(`[Migration] ⚠️ No existing profile found for ${attributes.email}, user will need to complete onboarding`);
      return;
    }

    const oldProfile = scanResult.Items[0];
    const oldUserId = oldProfile.user_id;

    console.log(`[Migration] ✓ Found existing profile with old user ID: ${oldUserId}`);

    // Step 2: Create new profile with same data but new user ID
    const newProfile = {
      ...oldProfile,
      PK: `USER#${newUserId}`,  // Update primary key
      user_id: newUserId,        // Update user_id field
      updated_at: Math.floor(Date.now() / 1000),
    };

    // Step 3: Get the user's organization and update ownership
    let organizationItem = null;
    if (oldProfile.organization_id) {
      try {
        const orgCommand = new ScanCommand({
          TableName: ORGANIZATIONS_TABLE_NAME,
          FilterExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': oldProfile.organization_id,
          },
        });
        const orgResult = await ddbDocClient.send(orgCommand);
        if (orgResult.Items && orgResult.Items.length > 0) {
          organizationItem = {
            ...orgResult.Items[0],
            owner_user_id: newUserId,  // Update owner to new user ID
            updated_at: Math.floor(Date.now() / 1000),
          };
          console.log(`[Migration] ✓ Found organization: ${oldProfile.organization_id}`);
        }
      } catch (error) {
        console.warn('[Migration] ⚠️ Could not find organization, will skip org update');
      }
    }

    // Step 4: Delete old profile and create new one atomically
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
          Item: newProfile,
        },
      },
    ];

    // Also update organization ownership if found
    if (organizationItem) {
      transactItems.push({
        Put: {
          TableName: ORGANIZATIONS_TABLE_NAME,
          Item: organizationItem,
        },
      });
    }

    const transactCommand = new TransactWriteCommand({
      TransactItems: transactItems,
    });

    await ddbDocClient.send(transactCommand);
    console.log(`[Migration] ✓ Profile migrated from USER#${oldUserId} to USER#${newUserId}`);

  } catch (error: any) {
    console.error('[Migration] Error migrating user profile in DynamoDB:', error);
    // Don't throw - user can still sign in even if DynamoDB migration fails
    console.warn('[Migration] ⚠️ User may be prompted to complete onboarding on first sign-in');
  }
}

/**
 * Generate a random temporary password (won't be used, but required by AdminCreateUser)
 */
function generateRandomPassword(): string {
  const length = 16;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure password meets requirements
  password += 'A'; // uppercase
  password += 'a'; // lowercase
  password += '1'; // number
  password += '!'; // symbol

  for (let i = password.length; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
