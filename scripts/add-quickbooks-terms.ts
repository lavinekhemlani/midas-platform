// scripts/add-quickbooks-terms.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { quickBooksTerms } from '../src/lib/learn/quickbooks-terms';
import type { GlossaryEntry } from '../src/lib/data';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const TERMS_TABLE_NAME = process.env.TERMS_TABLE_NAME || 'zenith-learn-terms';

async function addQuickBooksTerms() {
  console.log('Adding QuickBooks terms to database...');
  
  for (const term of quickBooksTerms) {
    const fullTerm: GlossaryEntry = {
      ...term as GlossaryEntry,
      PK: `TERM#${term.id}`,
      SK: 'META',
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000)
    };
    
    try {
      await ddbDocClient.send(new PutCommand({
        TableName: TERMS_TABLE_NAME,
        Item: fullTerm
      }));
      console.log(`✓ Added term: ${term.title}`);
    } catch (error) {
      console.error(`✗ Failed to add term ${term.title}:`, error);
    }
  }
  
  console.log('QuickBooks terms addition complete!');
}

// Run the script
if (require.main === module) {
  addQuickBooksTerms().catch(console.error);
}

export { addQuickBooksTerms };