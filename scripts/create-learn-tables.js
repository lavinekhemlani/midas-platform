// scripts/create-learn-tables.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');

// Manually load environment variables from .env.local
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    
    envFile.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        process.env[key.trim()] = cleanValue;
      }
    });
  } catch (error) {
    console.log('⚠️  Could not load .env.local file. Make sure it exists.');
    console.log('Using system environment variables instead.');
  }
}

// Load environment variables
loadEnvLocal();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function createLearnTables() {
  console.log('Creating Learn module DynamoDB tables...');
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  console.log('Terms Table:', process.env.TERMS_TABLE_NAME || 'zenith-learn-terms');

  // Terms Table
  const termsTableParams = {
    TableName: process.env.TERMS_TABLE_NAME || 'zenith-learn-terms',
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CategoryIndex',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  };

  try {
    await client.send(new CreateTableCommand(termsTableParams));
    console.log('✅ Terms table created successfully');
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️  Terms table already exists');
    } else {
      console.error('❌ Error creating terms table:', error.message);
      throw error;
    }
  }

  console.log('🎉 Learn tables setup completed!');
}

createLearnTables().catch(error => {
  console.error('Failed to create tables:', error.message);
  process.exit(1);
});
