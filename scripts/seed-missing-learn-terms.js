// scripts/seed-missing-learn-terms.js
// Seeds only the 4 missing financial health score card terms to DynamoDB
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb')
const fs = require('fs')
const path = require('path')

function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    const envFile = fs.readFileSync(envPath, 'utf8')

    envFile.split('\n').forEach((line) => {
      line = line.trim()
      if (!line || line.startsWith('#')) return
      const [key, ...valueParts] = line.split('=')
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim()
        const commentIndex = value.indexOf(' #')
        if (commentIndex !== -1) {
          value = value.substring(0, commentIndex).trim()
        }
        const cleanValue = value.replace(/^["']|["']$/g, '')
        process.env[key.trim()] = cleanValue
      }
    })
  } catch (error) {
    console.log('⚠️  Could not load .env.local file. Using system environment variables instead.')
  }
}

loadEnvLocal()

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
const ddbDocClient = DynamoDBDocumentClient.from(client)
const tableName = process.env.TERMS_TABLE_NAME || 'zenith-learn-terms'

// Only the 4 missing terms for Financial Health Score Card
const missingTerms = [
  {
    id: 'inventory-turnover',
    title: 'Inventory Turnover',
    category: 'Efficiency',
    contextualSubtitle:
      'Your inventory turnover ratio is {inventory_turnover}x, showing how efficiently you sell through stock.',
    visualCue: null,
    definitions: {
      basic:
        'Inventory Turnover measures how many times a company sells and replaces its inventory during a period. It is calculated as Cost of Goods Sold ÷ Average Inventory.',
      contextual:
        'For founders in retail or hardware businesses, inventory turnover is critical. A higher ratio means you are efficiently converting inventory into sales, reducing holding costs and the risk of obsolete stock. A lower ratio may indicate overstocking or weak sales.',
      metaphor:
        'Think of inventory turnover like a revolving door - the faster products spin through (in as inventory, out as sales), the more efficiently your business operates. A slow door means products are sitting idle, tying up cash.',
    },
    examples: {
      generic:
        'A retailer with $1M in COGS and $200k average inventory has an inventory turnover of 5x, meaning they sell through their entire inventory 5 times per year.',
      startup:
        'Your inventory turnover of {inventory_turnover}x means you cycle through your entire inventory approximately {inventory_turnover} times per year. Higher is generally better for cash flow.',
    },
    relatedTerms: ['cogs-ratio', 'working-capital', 'dso'],
    difficulty: 2,
  },
  {
    id: 'operating-cash-flow-ratio',
    title: 'Operating Cash Flow Ratio',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your operating cash flow ratio is {operating_cash_flow_ratio}, indicating your ability to cover current liabilities.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        "Operating Cash Flow Ratio measures a company's ability to pay off its current liabilities using the cash generated from core operations. It is calculated as Operating Cash Flow ÷ Current Liabilities.",
      contextual:
        'For founders, this ratio reveals whether your day-to-day operations generate enough cash to meet short-term obligations. A ratio above 1.0 means your operations alone can cover current debts, signaling strong financial health and reduced reliance on external financing.',
      metaphor:
        'Think of this ratio as measuring whether your regular paycheck covers your monthly bills. If the ratio is above 1, you can pay all bills from your salary alone. Below 1 means you need to dip into savings or borrow.',
    },
    examples: {
      generic:
        'A company with $500k operating cash flow and $400k current liabilities has an operating cash flow ratio of 1.25, meaning operations generate 25% more cash than needed for short-term obligations.',
      startup:
        'Your operating cash flow ratio of {operating_cash_flow_ratio} means your operations generate {operating_cash_flow_ratio}x your current liabilities. Above 1.0 indicates strong operational cash generation.',
    },
    relatedTerms: ['ocf', 'current-ratio', 'quick-ratio'],
    difficulty: 2,
  },
  {
    id: 'cash-flow-coverage-ratio',
    title: 'Cash Flow Coverage Ratio',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your cash flow coverage ratio is {cash_flow_coverage_ratio}x, showing your ability to service debt obligations.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        "Cash Flow Coverage Ratio measures how well a company's operating cash flow can cover its debt obligations, including interest and principal payments. It is calculated as Operating Cash Flow ÷ Total Debt Service.",
      contextual:
        'For founders with debt financing, this ratio is crucial for understanding your ability to meet loan obligations. Lenders closely watch this metric. A ratio above 1.0 means you can cover debt payments from operations; higher ratios provide a safety margin and may improve borrowing terms.',
      metaphor:
        'This ratio is like measuring whether your monthly income can cover your mortgage and car payments. A ratio of 2.0 means you earn twice what you need for debt payments, giving you breathing room for unexpected expenses.',
    },
    examples: {
      generic:
        'A company with $300k operating cash flow and $150k annual debt service has a cash flow coverage ratio of 2.0x, comfortably covering debt obligations twice over.',
      startup:
        'Your cash flow coverage ratio of {cash_flow_coverage_ratio}x indicates you generate {cash_flow_coverage_ratio} times the cash needed to service your debt. Higher ratios signal lower default risk.',
    },
    relatedTerms: ['ocf', 'debt-to-equity', 'interest-coverage'],
    difficulty: 3,
  },
  {
    id: 'operating-cash-flow-margin',
    title: 'Operating Cash Flow Margin',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your operating cash flow margin is {operating_cash_flow_margin}%, showing cash generation efficiency.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Operating Cash Flow Margin measures what percentage of revenue is converted into operating cash flow. It is calculated as (Operating Cash Flow ÷ Revenue) × 100.',
      contextual:
        'For founders, this margin reveals how efficiently your business converts sales into actual cash. Unlike profit margins which can include non-cash items, OCF margin shows real cash generation. A higher margin means more cash available for growth, debt repayment, or building reserves.',
      metaphor:
        'Think of OCF margin as the efficiency of your money-making machine. If you put $100 of sales in, how much actual cash comes out? A 20% margin means $20 of real, spendable cash from every $100 in revenue.',
    },
    examples: {
      generic:
        'A company with $1M revenue and $200k operating cash flow has a 20% operating cash flow margin, meaning 20 cents of every revenue dollar becomes operational cash.',
      startup:
        'Your operating cash flow margin of {operating_cash_flow_margin}% means {operating_cash_flow_margin} cents of every revenue dollar converts to operational cash. Compare this to your profit margin to understand cash vs. accounting differences.',
    },
    relatedTerms: ['ocf', 'net-profit-margin', 'gross-margin'],
    difficulty: 2,
  },
]

async function seedMissingTerms() {
  console.log('🚀 Seeding 4 missing financial health score card terms...\n')

  let successCount = 0
  let errorCount = 0

  for (const term of missingTerms) {
    const itemToPut = {
      ...term,
      PK: `TERM#${term.id}`,
      SK: 'META',
      difficulty: term.difficulty || 2,
      learningPaths: term.learningPaths || ['fundamentals'],
      created_at: Math.floor(Date.now() / 1000),
      updated_at: Math.floor(Date.now() / 1000),
    }

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: tableName,
          Item: itemToPut,
        })
      )
      console.log(`✅ Seeded: ${term.title} (${term.id})`)
      successCount++
    } catch (error) {
      console.error(`❌ Error seeding ${term.title}:`, error.message)
      errorCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`✅ Successfully seeded: ${successCount} terms`)
  console.log(`❌ Failed: ${errorCount} terms`)

  if (errorCount === 0) {
    console.log('\n🎉 All missing terms seeded successfully!')
  }
}

seedMissingTerms().catch((error) => {
  console.error('Failed to seed data:', error.message)
  process.exit(1)
})
