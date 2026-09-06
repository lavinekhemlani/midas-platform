// scripts/seed-learn-data.js
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb')
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

async function waitForTableToBeActive(maxRetries = 10) {
  console.log('⏳ Checking if table is ready...')
  for (let i = 0; i < maxRetries; i++) {
    try {
      const command = new DescribeTableCommand({ TableName: tableName })
      const response = await client.send(command)
      console.log(`📊 Table status: ${response.Table.TableStatus}`)
      if (response.Table.TableStatus === 'ACTIVE') {
        console.log('✅ Table is ready!')
        return true
      }
      console.log(`⏳ Waiting 2 seconds... (attempt ${i + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error) {
      console.log(`❌ Error checking table status (attempt ${i + 1}): ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  throw new Error('Table did not become active within the expected time')
}

const financialTerms = [
  // --- Fundamentals ---
  {
    id: 'revenue',
    title: 'Revenue',
    category: 'Fundamentals',
    contextualSubtitle:
      "Your total revenue last period was {total_revenue}. Let's break that down.",
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Revenue is the total amount of money your business brings in from selling products or services.',
      contextual:
        "For founders, revenue is your business's lifeline - it's proof that customers value what you're building and are willing to pay for it.",
      metaphor:
        'Think of revenue like water flowing into a bucket. The faster it flows and the bigger the stream, the fuller your bucket gets.',
    },
    examples: {
      generic: 'A coffee shop sells 100 cups at $5 each, generating $500 in revenue for the day.',
      startup:
        'In the last reporting period, your business generated {total_revenue} in total revenue.',
    },
    relatedTerms: ['profit', 'gross-margin', 'arr'],
  },
  {
    id: 'profit',
    title: 'Profit',
    category: 'Fundamentals',
    contextualSubtitle: 'You generated {gross_profit} in profit last month.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Profit, also known as net income, is the money a business has left over after accounting for all expenses, including taxes and interest.',
      contextual:
        'Profit is the ultimate measure of sustainability. While revenue shows demand, profit shows efficiency and the long-term viability of your business model.',
      metaphor:
        "If revenue is the food you gather, profit is what's left after you've fed yourself and your family. It's the surplus you can store for the winter.",
    },
    examples: {
      generic: 'A company with $500k revenue and $400k in total expenses has $100k profit.',
      startup: 'After all expenses, your business achieved a profit of {gross_profit}.',
    },
    relatedTerms: ['revenue', 'expenses', 'ebitda'],
  },
  {
    id: 'gross-margin',
    title: 'Gross Margin',
    category: 'Fundamentals',
    contextualSubtitle: 'Your gross margin is currently {gross_margin_pct}.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Gross margin represents the portion of revenue left over after subtracting the cost of goods sold (COGS). It is usually expressed as a percentage.',
      contextual:
        'This is a critical indicator of your pricing power and production efficiency. A healthy gross margin means you have a strong foundation to cover operating expenses and eventually turn a profit.',
      metaphor:
        "If revenue is all the money coming in the front door, gross margin is what's left after paying for the raw materials and direct labor to make your product.",
    },
    examples: {
      generic:
        'A software company with $100k revenue and $20k server costs has an 80% gross margin.',
      startup:
        'With {total_revenue} in revenue and a gross profit of {gross_profit}, your current gross margin is {gross_margin_pct}.',
    },
    relatedTerms: ['revenue', 'cogs', 'profit'],
  },
  // --- Cash Flow ---
  {
    id: 'cash-flow',
    title: 'Cash Flow',
    category: 'Cash Flow',
    contextualSubtitle: 'Your operating cash flow last month was {ocf}.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Cash flow is the net amount of cash and cash-equivalents being transferred into and out of a business.',
      contextual:
        'Cash is king. Unlike profit, which can include non-cash items, cash flow is the real money you have to pay bills, salaries, and invest in growth. A profitable company can go bankrupt from poor cash flow.',
      metaphor:
        'Think of cash flow as the breathing of your business. Cash in is inhaling, cash out is exhaling. You need to inhale more than you exhale to stay alive.',
    },
    examples: {
      generic:
        'A business receives $100k and spends $80k in a month, resulting in $20k positive cash flow.',
      startup: 'Last month, your operations generated a net cash flow of {ocf}.',
    },
    relatedTerms: ['burn-rate', 'runway', 'working-capital'],
  },
  {
    id: 'runway',
    title: 'Cash Runway',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your current runway is {runway_months} months, with a cash balance of {cash_balance}.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Runway is the length of time your company can operate before it runs out of money, assuming your current income and expenses remain constant.',
      contextual:
        "For founders, your runway is your lifeline. It is the exact number of months you have to reach profitability, secure new funding, or make difficult decisions. It's the ultimate clock you're racing against.",
      metaphor:
        "Like an airplane on a runway, it's the distance you have before you either take off (become profitable) or crash (run out of money).",
    },
    examples: {
      generic:
        'A company with $500k in the bank and a gross burn rate of $50k per month has 10 months of runway.',
      startup:
        'With your current cash balance of {cash_balance} and a gross burn rate of {burn_rate} per month, your runway is {runway_months} months.',
    },
    relatedTerms: ['burn-rate', 'cash-flow', 'profit'],
  },
  {
    id: 'burn-rate',
    title: 'Gross Burn Rate',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your gross burn rate is {burn_rate} per month, affecting your runway of {runway_months} months.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Gross burn rate is the total amount of operating expenses a company incurs each month, regardless of revenue. It represents your total monthly cash outflow from operations.',
      contextual:
        "Understanding your gross burn rate is essential for managing your runway. It tells you exactly how much cash you need each month to keep the lights on, regardless of how much revenue you're generating. This metric helps you plan for worst-case scenarios and understand your true cost structure.",
      metaphor:
        'Think of gross burn rate as your monthly "cost of existence" - like knowing your total monthly bills at home regardless of your income. It\'s the baseline amount you need to survive each month.',
    },
    examples: {
      generic:
        'A startup with $30k in salaries, $10k in rent, and $10k in other monthly expenses has a gross burn rate of $50k/month.',
      startup:
        'Your current gross burn rate is {burn_rate} per month. This is calculated as the sum of all your monthly operating expenses. With {cash_balance} in the bank, this gives you approximately {runway_months} months of runway.',
    },
    relatedTerms: ['runway', 'cash-flow', 'expenses'],
  },
  {
    id: 'cash-balance',
    title: 'Cash Balance',
    category: 'Cash Flow',
    contextualSubtitle: 'Your current cash balance across all accounts is {cash_balance}.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Cash balance is the total amount of money a company has on hand, including cash in bank accounts and any other cash equivalents.',
      contextual:
        "This is your most critical asset. It's the real, liquid capital you have available to run your business day-to-day.",
      metaphor:
        'Your cash balance is the amount of water you have in your canteen. It determines how far you can travel before you need to find a new spring.',
    },
    examples: {
      generic: 'A company has $1M in its bank accounts.',
      startup:
        'Your real-time cash balance is currently {cash_balance}. This is the total liquid capital available for operations.',
    },
    relatedTerms: ['runway', 'cash-flow', 'ocf'],
  },
  {
    id: 'ocf',
    title: 'Operating Cash Flow',
    category: 'Cash Flow',
    contextualSubtitle: "Last month's operating cash flow was {ocf}.",
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        "Operating Cash Flow (OCF) is the amount of cash generated by a company's normal business operations.",
      contextual:
        "OCF is a key indicator of a company's financial health. A positive OCF means your core business is generating enough cash to sustain and grow itself without needing external financing.",
      metaphor:
        'If your business is a tree, OCF is the fruit it produces naturally each season, separate from any money you might borrow or get from investors.',
    },
    examples: {
      generic:
        'A business generated $50,000 from its main operations after accounting for cash expenses.',
      startup:
        'The cash generated from your core business last month was {ocf}. A positive number indicates operational health.',
    },
    relatedTerms: ['cash-balance', 'profit', 'revenue'],
  },
  // --- Operational Efficiency ---
  {
    id: 'dso',
    title: 'Days Sales Outstanding (DSO)',
    category: 'Efficiency',
    contextualSubtitle: 'It currently takes you an average of {dso} days to get paid.',
    visualCue: null,
    definitions: {
      basic:
        'DSO measures the average number of days it takes for a company to collect payment after a sale has been made.',
      contextual:
        'For founders, a high DSO means your cash is tied up in unpaid invoices, impacting your cash flow. A lower DSO is better.',
      metaphor:
        'Think of DSO as the lag time between doing the work and getting the reward. The shorter the lag, the faster you can use your earnings.',
    },
    examples: {
      generic:
        'A company with a DSO of 45 days takes, on average, a month and a half to collect its receivables.',
      startup:
        'Your current DSO is {dso} days. Shortening this cycle can significantly improve your cash position without increasing sales.',
    },
    relatedTerms: ['dpo', 'cash-flow', 'revenue'],
  },
  {
    id: 'dpo',
    title: 'Days Payable Outstanding (DPO)',
    category: 'Efficiency',
    contextualSubtitle: 'You are currently taking an average of {dpo} days to pay your bills.',
    visualCue: null,
    definitions: {
      basic:
        'DPO measures the average number of days it takes for a company to pay its own bills and invoices.',
      contextual:
        "For founders, a higher DPO can be a form of short-term financing, but stretching it too far can damage supplier relationships. It's a balancing act.",
      metaphor:
        'Think of DPO as how long you can "float" on your suppliers\' money before you have to pay up. A longer float gives you more cash flexibility.',
    },
    examples: {
      generic:
        'A company with a DPO of 60 days takes, on average, two months to pay its suppliers.',
      startup:
        'Your current DPO is {dpo} days. This means you are effectively using your payables to manage cash flow over this period.',
    },
    relatedTerms: ['dso', 'cash-flow', 'expenses'],
  },
  // --- Profitability & Cost Metrics ---
  {
    id: 'cogs-ratio',
    title: 'COGS Ratio',
    category: 'Fundamentals',
    contextualSubtitle: 'Your COGS ratio is {cogs_ratio}%, showing cost efficiency.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'COGS Ratio is the percentage of revenue consumed by the direct costs of producing goods or services sold.',
      contextual:
        'For founders, COGS ratio reveals how much of each revenue dollar goes directly to production costs. A lower ratio means more gross profit margin to cover operating expenses and generate profit.',
      metaphor:
        'Think of COGS ratio as the raw ingredients cost of a dish - if you sell a meal for $20 and ingredients cost $6, your COGS ratio is 30%. The rest is what you have to work with.',
    },
    examples: {
      generic: 'A company with $1M revenue and $300k in direct costs has a 30% COGS ratio.',
      startup:
        'Your COGS ratio of {cogs_ratio}% means {cogs_ratio} cents of every dollar goes to direct production costs.',
    },
    relatedTerms: ['gross-margin', 'expense-ratio', 'operating-margin'],
    difficulty: 2,
  },
  {
    id: 'net-profit-margin',
    title: 'Net Profit Margin',
    category: 'Fundamentals',
    contextualSubtitle:
      'Your net profit margin is {net_profit_margin}%, showing your bottom line efficiency.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Net Profit Margin is the percentage of revenue that remains as profit after all expenses, including operating costs, interest, and taxes, have been deducted.',
      contextual:
        'For founders, net profit margin is the ultimate measure of profitability efficiency. It shows how many cents of every revenue dollar actually become profit. A higher margin means more profit per sale, giving you more capital for growth, debt repayment, or reserves.',
      metaphor:
        'Net profit margin is like measuring what percentage of your paycheck you actually get to keep after rent, groceries, utilities, and everything else is paid. If you earn $100 and keep $15, your net margin is 15%.',
    },
    examples: {
      generic: 'A company with $1M revenue and $150k net profit has a 15% net profit margin.',
      startup:
        'Your net profit margin of {net_profit_margin}% means you keep {net_profit_margin} cents as profit from every dollar of revenue.',
    },
    relatedTerms: ['gross-margin', 'operating-margin', 'profit'],
    difficulty: 2,
  },
  {
    id: 'return-on-assets',
    title: 'Return on Assets (ROA)',
    category: 'Profitability',
    contextualSubtitle: 'Your ROA is {roa}%, measuring asset efficiency.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Return on Assets measures how efficiently a company uses its assets to generate profit. It is calculated as (Net Income ÷ Total Assets) × 100.',
      contextual:
        'For founders, ROA shows how well you are using everything the company owns to make money. Higher ROA means your assets are working harder for you. Compare to industry benchmarks as asset-light businesses naturally have higher ROA.',
      metaphor:
        'ROA is like measuring how much rent you can generate from your property - if you own $100k in assets and make $15k profit, you are getting a 15% return on what you own.',
    },
    examples: {
      generic: 'A company with $500k net income and $5M in total assets has a 10% ROA.',
      startup:
        'Your ROA of {roa}% means you generate {roa} cents of profit for every dollar of assets.',
    },
    relatedTerms: ['return-on-equity', 'asset-turnover', 'net-income'],
    difficulty: 3,
  },
]

async function seedData() {
  console.log('Starting to seed financial terms data...')

  try {
    await waitForTableToBeActive()
  } catch (error) {
    console.error('❌ Table is not ready:', error.message)
    process.exit(1)
  }

  console.log('🚀 Starting to seed data...')
  let successCount = 0
  let errorCount = 0

  for (const term of financialTerms) {
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
      console.log(`✅ Seeded term: ${term.title}`)
      successCount++
    } catch (error) {
      console.error(`❌ Error seeding term ${term.title}:`, error.message)
      errorCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`✅ Successfully seeded: ${successCount} terms`)
  console.log(`❌ Failed to seed: ${errorCount} terms`)

  if (errorCount === 0) {
    console.log('🎉 All data seeded successfully!')
  } else {
    console.log('⚠️  Some terms failed to seed. Check the errors above.')
  }
}

seedData().catch((error) => {
  console.error('Failed to seed data:', error.message)
  process.exit(1)
})
