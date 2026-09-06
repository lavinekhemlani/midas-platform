// src/app/api/users/me/onboarding-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { User } from '@/lib/data';

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

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!USERS_TABLE_NAME) {
      console.error('[ONBOARDING-STATUS] USERS_TABLE_NAME not configured.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Fetch only the onboarding_audit field from the user profile
    const getUserCommand = new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      ProjectionExpression: 'onboarding_audit',
    });

    const { Item } = await ddbDocClient.send(getUserCommand);
    
    if (!Item) {
      // User doesn't exist, so onboarding is not complete
      return NextResponse.json({ onboardingComplete: false });
    }

    const user = Item as Partial<User>;
    const onboardingComplete = !!(user.onboarding_audit?.completed_at);
    
    return NextResponse.json({ onboardingComplete });

  } catch (error) {
    console.error('[ONBOARDING-STATUS] Error checking onboarding status:', error);
    // Return false on error to be safe
    return NextResponse.json({ onboardingComplete: false });
  }
}
