// src/app/api/validate/organization/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/providers/handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME; // <-- Use ORGANIZATIONS_TABLE_NAME

export const GET = withAuth(async (req: NextRequest, context) => {
  try {
    const { userId } = context;

    if (!TABLE_NAME) {
      console.error('ORGANIZATIONS_TABLE_NAME is not set in environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const searchParams = req.nextUrl.searchParams;
    const name = searchParams.get('name');
    const orgId = searchParams.get('orgId'); // Optional: current org ID to exclude from check

    if (!name) {
      return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
    }

    // Normalize the name for comparison (lowercase, trim)
    const normalizedName = name.trim().toLowerCase();

    // Query DynamoDB for organizations with the same name
    // NOTE: This assumes you have a GSI named 'by_normalized_name' on your organizations table
    // with `normalized_name` as the partition key.
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'by_normalized_name', 
      KeyConditionExpression: 'normalized_name = :normalizedName',
      ExpressionAttributeValues: {
        ':normalizedName': normalizedName,
      },
    };

    const result = await docClient.send(new QueryCommand(params));
    
    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json({ available: true });
    }
    
    // If we're editing an existing org, exclude it from the check
    if (orgId) {
      const filteredItems = result.Items.filter(item => item.organization_id !== orgId);
      if (filteredItems.length === 0) {
        return NextResponse.json({ available: true });
      }
    }
    
    // Name is already in use
    return NextResponse.json({ available: false, message: 'Organization name is already in use.' });

  } catch (error) {
    console.error('Error validating organization name:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
});
