// src/app/api/learn/terms/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TERMS_TABLE_NAME = process.env.TERMS_TABLE_NAME || 'zenith-learn-terms';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  return withAuth(async (req: NextRequest, authContext) => {
    try {
      const { userId } = authContext;

    const command = new GetCommand({
      TableName: TERMS_TABLE_NAME,
      Key: {
        PK: `TERM#${id}`,
        SK: 'META',
      },
    });

    const { Item } = await ddbDocClient.send(command);

    if (!Item) {
      return NextResponse.json(
        { error: 'Term not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ term: Item });

  } catch (error) {
    console.error('Error fetching term:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch term' },
      { status: 500 }
    );
    }
  })(req);
}
