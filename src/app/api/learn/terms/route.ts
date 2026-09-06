// src/app/api/learn/terms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TERMS_TABLE_NAME = process.env.TERMS_TABLE_NAME || 'zenith-learn-terms';

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    const { userId } = context;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');

    let command;
    
    if (category) {
      // Query by category using GSI
      command = new QueryCommand({
        TableName: TERMS_TABLE_NAME,
        IndexName: 'CategoryIndex',
        KeyConditionExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': category,
        },
      });
    } else {
      // Scan all terms
      command = new ScanCommand({
        TableName: TERMS_TABLE_NAME,
        FilterExpression: difficulty ? 'difficulty = :difficulty' : undefined,
        ExpressionAttributeValues: difficulty ? {
          ':difficulty': parseInt(difficulty),
        } : undefined,
      });
    }

    const { Items } = await ddbDocClient.send(command);
    
    // Filter by search term if provided
    let filteredItems = Items || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.definitions.basic.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      terms: filteredItems,
      total: filteredItems.length,
    });

  } catch (error) {
    console.error('Error fetching terms:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch terms' },
      { status: 500 }
    );
  }
});
