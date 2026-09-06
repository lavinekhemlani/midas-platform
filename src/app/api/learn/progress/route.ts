//src/app/api/learn/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || 'zenith-users';

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    const { userId } = context;

    const command = new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    });

    const { Item } = await ddbDocClient.send(command);

    if (!Item || !Item.learn_state) {
      // Return default state if no learn state exists
      return NextResponse.json({
        learnState: {
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
      });
    }

    return NextResponse.json({ learnState: Item.learn_state });

  } catch (error) {
    console.error('Error fetching learn progress:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req: NextRequest, context) => {
  try {
    const { userId } = context;

    const body = await req.json();
    const { termId, timeSpent, action } = body;
    const now = Math.floor(Date.now() / 1000);
    
    // First, ensure learn_state exists
    await ddbDocClient.send(new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET #learnState = if_not_exists(#learnState, :defaultLearnState), #updatedAt = :now',
      ExpressionAttributeNames: { '#learnState': 'learn_state', '#updatedAt': 'updated_at' },
      ExpressionAttributeValues: {
        ':defaultLearnState': {
          current_path: null,
          completed_terms: [],
          preferred_mode: 'founder',
          reading_history: [],
          preferences: { format: 'text', complexity: 'beginner', notifications: true }
        },
        ':now': now
      }
    }));
    
    // Then update specific fields
    const updates = [];
    const names: any = {};
    const values: any = {};
    
    if (action === 'complete_term' && termId) {
      updates.push('#learnState.#completedTerms = list_append(if_not_exists(#learnState.#completedTerms, :empty_list), :term)');
      names['#completedTerms'] = 'completed_terms';
      values[':term'] = [termId];
      values[':empty_list'] = [];
    }
    
    if (timeSpent && termId) {
      updates.push('#learnState.#readingHistory = list_append(if_not_exists(#learnState.#readingHistory, :empty_list2), :history)');
      names['#readingHistory'] = 'reading_history';
      values[':history'] = [{ term_id: termId, timestamp: now, time_spent: timeSpent }];
      values[':empty_list2'] = [];
    }
    
    if (updates.length > 0) {
      names['#learnState'] = 'learn_state';
      const { Attributes } = await ddbDocClient.send(new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW'
      }));
      
      return NextResponse.json({
        message: 'Progress updated successfully',
        learnState: Attributes?.learn_state
      });
    }
    
    // If no updates, just return current state
    const { Item } = await ddbDocClient.send(new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    }));
    
    return NextResponse.json({
      message: 'No updates needed',
      learnState: Item?.learn_state
    });

  } catch (error) {
    console.error('Error updating learn progress:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
});
