// src/app/api/users/[userId]/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { User } from '@/lib/data';

// Initialize DynamoDB DocumentClient
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};
const unmarshallOptions = {
  wrapNumbers: false,
};
const translateConfig = { marshallOptions, unmarshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(client, translateConfig);
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;

interface UpdateProfileRequestBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleTitle?: string;
  preferences?: User['preferences'];
  organization_id?: string;
}

interface RouteParams {
  params: Promise<{
    userId: string;
  }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return withAuth(async (req: NextRequest, context) => {
    try {
      const { userId: authenticatedUserId } = context;
      const { userId: pathUserId } = await params;

    // Authorization: Ensure the authenticated user is updating their own profile.
    if (authenticatedUserId !== pathUserId) {
      return NextResponse.json({ error: 'Forbidden. You can only update your own profile.' }, { status: 403 });
    }

    if (!USERS_TABLE_NAME || !process.env.AWS_REGION) {
      console.error('Server configuration error: Missing USERS_TABLE_NAME or AWS_REGION');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const body = await req.json() as UpdateProfileRequestBody;

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'Request body cannot be empty.' }, { status: 400 });
    }
    // Add any other validation as needed...

    // --- Prepare DynamoDB Update ---
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build the update expression dynamically
    const fields: (keyof UpdateProfileRequestBody)[] = ['firstName', 'lastName', 'phone', 'roleTitle', 'preferences', 'organization_id'];
    const attributeNameMapping: Record<keyof UpdateProfileRequestBody, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        phone: 'phone',
        roleTitle: 'role_title',
        preferences: 'preferences',
        organization_id: 'organization_id'
    };

    for (const field of fields) {
        if (body[field] !== undefined) {
            const attributeName = attributeNameMapping[field];
            updateExpressions.push(`#${attributeName} = :${attributeName}`);
            expressionAttributeNames[`#${attributeName}`] = attributeName;
            expressionAttributeValues[`:${attributeName}`] = body[field];
        }
    }

    if (updateExpressions.length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updated_at';
    expressionAttributeValues[':updatedAt'] = Math.floor(Date.now() / 1000);

    const updateCommand = new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${pathUserId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const { Attributes: updatedUserProfile } = await ddbDocClient.send(updateCommand);

    if (!updatedUserProfile) {
      return NextResponse.json({ error: 'User profile not found or failed to update.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Profile updated successfully.',
      userProfile: updatedUserProfile,
    });

    } catch (error) {
      console.error(`Error in PUT /api/users/[userId]/profile:`, error);
      if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      let errorMessage = 'An unknown error occurred while updating user profile.';
      if (error instanceof Error) { errorMessage = error.message; }
      if (error instanceof SyntaxError) {
          errorMessage = 'Invalid request body: Could not parse JSON.';
          return NextResponse.json({ error: errorMessage }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to update user profile.', details: errorMessage }, { status: 500 });
    }
  })(req);
}
