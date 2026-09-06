// src/app/api/learn/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TERMS_TABLE_NAME = process.env.TERMS_TABLE_NAME || 'zenith-learn-terms';

function calculateRelevance(item: any, query: string): number {
  let score = 0;
  if (item.title?.toLowerCase().includes(query)) score += 10;
  if (item.definitions?.basic?.toLowerCase().includes(query)) score += 5;
  if (item.category?.toLowerCase().includes(query)) score += 3;
  if (item.examples?.startup?.toLowerCase().includes(query)) score += 2;
  return score;
}

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    const { userId } = context;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase();
    
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const command = new ScanCommand({
      TableName: TERMS_TABLE_NAME,
    });

    const { Items } = await ddbDocClient.send(command);

    const results = (Items || [])
      .map(item => ({
        ...item,
        relevance: calculateRelevance(item, query),
      }))
      .filter(item => item.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10);

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Error searching terms:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to search terms' },
      { status: 500 }
    );
  }
});
