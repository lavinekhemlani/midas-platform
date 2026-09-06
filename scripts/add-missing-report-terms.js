// scripts/add-missing-report-terms.js
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

const newReportTerms = [
  // --- P&L View Terms ---
  {
    id: 'operating-margin',
    title: 'Operating Margin',
    category: 'Fundamentals',
    contextualSubtitle:
      'Your operating margin is {operating_margin_pct}%, showing your operational efficiency.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Operating margin is the percentage of revenue remaining after deducting cost of goods sold (COGS) and operating expenses, but before interest and taxes.',
      contextual:
        "This metric reveals how efficiently your core business operates. A healthy operating margin means you're covering both direct costs and overhead from your main operations, before considering financing costs.",
      metaphor:
        "Think of operating margin as what's left in your wallet after buying ingredients (COGS) and paying the chef and rent (operating expenses), but before you make your loan payment. It shows if your restaurant itself is profitable.",
    },
    examples: {
      generic:
        'A company with $1M revenue, $200k COGS, and $500k operating expenses has a 30% operating margin.',
      startup:
        'With {total_revenue} in revenue, your operating margin of {operating_margin_pct}% indicates your core business efficiency before financing costs.',
    },
    relatedTerms: ['gross-margin', 'net-profit-margin', 'ebitda'],
    difficulty: 2,
  },
  {
    id: 'expense-ratio',
    title: 'Expense Ratio',
    category: 'Fundamentals',
    contextualSubtitle:
      'Your expense ratio is {expense_ratio}%, showing how much of revenue goes to expenses.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Expense ratio is the percentage of revenue consumed by total operating expenses. It shows what portion of each dollar earned goes toward running the business.',
      contextual:
        'For founders, keeping expense ratio under control is crucial for profitability. A lower ratio means more revenue converts to profit. High-growth companies often have higher ratios as they invest in growth.',
      metaphor:
        "Expense ratio is like checking how much of every dollar you earn gets eaten up by your bills and expenses. If it's 60%, then 60 cents of every dollar goes right back out the door.",
    },
    examples: {
      generic:
        'A company with $1M revenue and $600k in operating expenses has a 60% expense ratio.',
      startup:
        'Your expense ratio of {expense_ratio}% means that for every dollar of revenue, {expense_ratio} cents go to operating expenses.',
    },
    relatedTerms: ['gross-margin', 'operating-margin', 'burn-rate'],
    difficulty: 2,
  },
  {
    id: 'revenue-growth',
    title: 'Revenue Growth',
    category: 'Growth',
    contextualSubtitle: 'Your revenue grew by {revenue_growth}% compared to the previous period.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Revenue growth is the percentage increase or decrease in revenue compared to a previous period.',
      contextual:
        'For founders and investors, revenue growth is a key indicator of market demand and business momentum. Consistent growth shows product-market fit and scalability.',
      metaphor:
        "Think of revenue growth as measuring how much faster you're running this lap compared to the last one. A 50% growth rate means you're running 1.5x faster than before.",
    },
    examples: {
      generic:
        'A company that grew from $100k to $150k in quarterly revenue has 50% revenue growth.',
      startup:
        "Your revenue increased by {revenue_growth}% this period, demonstrating {revenue_growth > 20 ? 'strong' : revenue_growth > 0 ? 'positive' : 'challenging'} market traction.",
    },
    relatedTerms: ['revenue', 'arr', 'mrr'],
    difficulty: 2,
  },
  {
    id: 'expense-growth',
    title: 'Expense Growth',
    category: 'Fundamentals',
    contextualSubtitle: 'Your expenses grew by {expense_growth}% compared to the previous period.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        'Expense growth is the percentage increase or decrease in total operating expenses compared to a previous period.',
      contextual:
        'For founders, expense growth should be watched carefully relative to revenue growth. Expenses growing faster than revenue erode margins and burn cash faster. Controlled expense growth shows operational discipline.',
      metaphor:
        "Expense growth is like your household bills getting bigger each month. If your bills grow 30% but your salary only grows 10%, you're heading for trouble.",
    },
    examples: {
      generic: "A company's expenses increased from $80k to $100k, showing 25% expense growth.",
      startup:
        "Your expenses grew by {expense_growth}% while revenue grew by {revenue_growth}%. {expense_growth > revenue_growth ? 'Consider optimizing spending to improve unit economics.' : 'You're maintaining good expense discipline.'}",
    },
    relatedTerms: ['burn-rate', 'expense-ratio', 'revenue-growth'],
    difficulty: 2,
  },
  {
    id: 'ebitda',
    title: 'EBITDA',
    category: 'Fundamentals',
    contextualSubtitle: 'Your EBITDA is {ebitda}, showing operational profitability.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        "EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization. It measures a company's operating performance by focusing on earnings from core operations.",
      contextual:
        "For founders, EBITDA provides a clearer picture of operational profitability by removing the effects of financing decisions, accounting rules, and tax structures. It's particularly useful for comparing companies across different tax jurisdictions or capital structures.",
      metaphor:
        "Think of EBITDA as your business's raw earning power - like a runner's speed before considering the weight of their backpack (debt), the friction of the track (taxes), or their worn-out shoes (depreciation). It's pure operational strength.",
    },
    examples: {
      generic:
        'A company with $500k operating income, $50k depreciation, and $20k amortization has $570k EBITDA.',
      startup:
        'Your EBITDA of {ebitda} shows how much cash your core operations generate before accounting for financing and non-cash expenses.',
    },
    relatedTerms: ['operating-margin', 'profit', 'cash-flow'],
    difficulty: 3,
  },
  {
    id: 'net-income',
    title: 'Net Income',
    category: 'Fundamentals',
    contextualSubtitle: 'Your net income is {net_income}, the bottom line after all expenses.',
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        "Net income, also called the 'bottom line,' is what remains after all expenses, including operating costs, interest, taxes, and depreciation, have been subtracted from total revenue.",
      contextual:
        "For founders, net income is the ultimate measure of profitability. Positive net income means your business is truly profitable. Negative net income (a loss) indicates you're burning more than you're earning, which is common for growth-stage startups but unsustainable long-term.",
      metaphor:
        'Net income is the bottom of the funnel - everything flows in at the top (revenue), but after the business, the tax man, and the bank all take their cut, this is what actually lands in your pocket.',
    },
    examples: {
      generic: 'A company with $1M revenue and $900k in all expenses has $100k net income.',
      startup:
        'Your net income of {net_income} represents your true profitability after accounting for every cost of doing business.',
    },
    relatedTerms: ['profit', 'revenue', 'gross-margin'],
    difficulty: 2,
  },
  // --- Cash Flow View Terms ---
  {
    id: 'ocf-ratio',
    title: 'OCF Ratio',
    category: 'Cash Flow',
    contextualSubtitle: 'Your OCF ratio is {ocf_ratio}, measuring ability to cover liabilities.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        'Operating Cash Flow Ratio measures how many times a company can pay off its current liabilities with the cash generated from operations in a given period.',
      contextual:
        'For founders, this ratio reveals your ability to meet short-term obligations from operating cash flow alone, without relying on external financing. A ratio above 1.0 indicates strong liquidity from operations.',
      metaphor:
        "Think of OCF ratio as asking: can I pay this month's bills with this month's paycheck? A ratio of 2.0 means your paycheck is twice your bills - comfortable. Below 1.0 means you can't cover your bills from what you're earning.",
    },
    examples: {
      generic:
        'A company with $100k operating cash flow and $50k current liabilities has an OCF ratio of 2.0.',
      startup:
        'Your OCF ratio of {ocf_ratio} means your operations generate {ocf_ratio}x the cash needed to cover current liabilities.',
    },
    relatedTerms: ['ocf', 'current-ratio', 'quick-ratio'],
    difficulty: 3,
  },
  {
    id: 'free-cash-flow',
    title: 'Free Cash Flow',
    category: 'Cash Flow',
    contextualSubtitle:
      'Your free cash flow is {free_cash_flow}, showing cash available after investments.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        "Free Cash Flow (FCF) is the cash a company generates after accounting for cash outflows to support operations and maintain capital assets. It's calculated as Operating Cash Flow minus Capital Expenditures.",
      contextual:
        "For founders, FCF represents the cash you truly have available to grow the business, pay down debt, return to investors, or save for a rainy day. Positive FCF means you're generating more cash than you're spending on keeping the business running.",
      metaphor:
        "Free cash flow is like your spending money after paying rent, groceries, and fixing your car. It's the cash that's truly yours to decide what to do with - save it, invest it, or treat yourself.",
    },
    examples: {
      generic:
        'A company with $150k operating cash flow and $50k in equipment purchases has $100k free cash flow.',
      startup:
        'Your free cash flow of {free_cash_flow} represents the cash available after maintaining and investing in your assets.',
    },
    relatedTerms: ['ocf', 'cash-flow', 'runway'],
    difficulty: 3,
  },
  {
    id: 'cash-conversion-cycle',
    title: 'Cash Conversion Cycle',
    category: 'Efficiency',
    contextualSubtitle: 'Your cash conversion cycle is {cash_conversion_cycle} days.',
    visualCue: null,
    definitions: {
      basic:
        "Cash Conversion Cycle (CCC) measures how many days it takes to convert investments in inventory and other resources into cash from sales. It's calculated as Days Inventory Outstanding + Days Sales Outstanding - Days Payable Outstanding.",
      contextual:
        "For founders, a shorter CCC means faster cash flow turnover and less working capital needed. It shows how efficiently you're converting investments into cash. Negative CCC (like Dell or Amazon) means you collect cash before paying suppliers - the holy grail of cash management.",
      metaphor:
        'Think of CCC as the journey from buying ingredients at the store, cooking dinner, serving guests, and finally getting paid. The faster you complete this loop, the sooner you can buy more ingredients and keep growing. Some businesses (like Amazon) get paid before they even pay for their ingredients!',
    },
    examples: {
      generic:
        'A company with 30 days inventory, 45 days receivables, and 30 days payables has a 45-day CCC (30+45-30).',
      startup:
        "Your {cash_conversion_cycle}-day cash conversion cycle shows you're turning investments into cash in {cash_conversion_cycle < 30 ? 'an efficient' : cash_conversion_cycle < 60 ? 'a reasonable' : 'an extended'} timeframe.",
    },
    relatedTerms: ['dso', 'dpo', 'working-capital'],
    difficulty: 4,
  },
  {
    id: 'ocf-margin',
    title: 'OCF Margin',
    category: 'Cash Flow',
    contextualSubtitle: 'Your OCF margin is {ocf_margin}%, showing cash generation efficiency.',
    visualCue: 'DailyCashFlowChart',
    definitions: {
      basic:
        "Operating Cash Flow Margin is the percentage of revenue that converts into operating cash flow. It's calculated as (Operating Cash Flow ÷ Revenue) × 100.",
      contextual:
        'For founders, OCF margin reveals how efficiently you convert sales into actual cash. While profit margin uses accounting numbers, OCF margin shows real cash generation. High OCF margin means your business model efficiently generates cash from revenue.',
      metaphor:
        'Think of OCF margin as what percentage of the money customers give you actually makes it to your bank account. A 25% OCF margin means for every $100 in sales, $25 becomes real spendable cash in your business.',
    },
    examples: {
      generic: 'A company with $1M revenue and $250k operating cash flow has a 25% OCF margin.',
      startup:
        'Your {ocf_margin}% OCF margin means you convert {ocf_margin}% of each revenue dollar into operating cash flow.',
    },
    relatedTerms: ['ocf', 'net-profit-margin', 'cash-flow'],
    difficulty: 3,
  },
  {
    id: 'cf-coverage',
    title: 'Cash Flow Coverage Ratio',
    category: 'Cash Flow',
    contextualSubtitle: 'Your CF coverage ratio is {cf_coverage}, measuring debt serviceability.',
    visualCue: null,
    definitions: {
      basic:
        "Cash Flow Coverage Ratio measures how many times a company can pay its total debt with its operating cash flow. It's calculated as Operating Cash Flow ÷ Total Debt.",
      contextual:
        'For founders with debt, this ratio shows your ability to pay it off from operations. A ratio above 0.2 (20%) is generally considered healthy. Higher is better - it means you could theoretically pay off your debt faster.',
      metaphor:
        "CF coverage is like asking: if I put all my salary toward my credit card debt, what fraction could I pay off this year? A ratio of 0.5 means you could pay off half your debt with this year's earnings.",
    },
    examples: {
      generic:
        'A company with $500k annual operating cash flow and $2M total debt has a 0.25 CF coverage ratio.',
      startup:
        "Your CF coverage ratio of {cf_coverage} indicates you could {cf_coverage > 0.2 ? 'comfortably service' : 'face challenges servicing'} your debt from operations.",
    },
    relatedTerms: ['ocf', 'debt-ratio', 'debt-to-equity'],
    difficulty: 4,
  },
  // --- Balance Sheet View Terms ---
  {
    id: 'current-ratio',
    title: 'Current Ratio',
    category: 'Liquidity',
    contextualSubtitle:
      'Your current ratio is {current_ratio}, measuring short-term financial health.',
    visualCue: null,
    definitions: {
      basic:
        "Current Ratio measures a company's ability to pay short-term obligations with short-term assets. It's calculated as Current Assets ÷ Current Liabilities.",
      contextual:
        'For founders, current ratio is a key liquidity indicator. A ratio above 1.0 means you have more current assets than current liabilities. Between 1.5-3.0 is generally considered healthy. Below 1.0 suggests potential liquidity problems.',
      metaphor:
        "Current ratio is like comparing your checking account balance to your credit card bill that's due next month. A ratio of 2.0 means you have twice the money needed to pay what you owe.",
    },
    examples: {
      generic:
        'A company with $300k in current assets and $200k in current liabilities has a current ratio of 1.5.',
      startup:
        'Your current ratio of {current_ratio} means you have {current_ratio}x the short-term assets needed to cover short-term obligations.',
    },
    relatedTerms: ['quick-ratio', 'working-capital', 'cash-balance'],
    difficulty: 2,
  },
  {
    id: 'quick-ratio',
    title: 'Quick Ratio',
    category: 'Liquidity',
    contextualSubtitle: 'Your quick ratio is {quick_ratio}, the acid test of liquidity.',
    visualCue: null,
    definitions: {
      basic:
        "Quick Ratio, also called the Acid Test, measures the ability to pay short-term obligations with the most liquid assets (excluding inventory). It's calculated as (Current Assets - Inventory) ÷ Current Liabilities.",
      contextual:
        'For founders, quick ratio is a more conservative liquidity test than current ratio because it excludes inventory, which can be hard to convert to cash quickly. A ratio above 1.0 is ideal, meaning you can cover all short-term debts with highly liquid assets.',
      metaphor:
        "Quick ratio asks: can you pay your bills right now with just your wallet and bank account, without having to run a garage sale first? It's the real test of immediate liquidity.",
    },
    examples: {
      generic:
        'A company with $250k current assets, $50k inventory, and $200k current liabilities has a quick ratio of 1.0.',
      startup:
        "Your quick ratio of {quick_ratio} shows {quick_ratio >= 1.0 ? 'strong' : 'tight'} immediate liquidity without relying on selling inventory.",
    },
    relatedTerms: ['current-ratio', 'cash-balance', 'working-capital'],
    difficulty: 3,
  },
  {
    id: 'working-capital',
    title: 'Working Capital',
    category: 'Liquidity',
    contextualSubtitle: 'Your working capital is {working_capital}, funding daily operations.',
    visualCue: null,
    definitions: {
      basic:
        'Working Capital is the difference between current assets and current liabilities. It represents the capital available to fund day-to-day operations.',
      contextual:
        'For founders, working capital is the cushion that keeps your business running smoothly. Positive working capital means you have more short-term assets than obligations. Negative working capital can signal liquidity issues unless you have a business model that collects cash before paying suppliers (like Amazon).',
      metaphor:
        "Working capital is like the cash cushion in your wallet after setting aside money for upcoming bills. It's your financial breathing room for daily operations - buying supplies, paying salaries, keeping the lights on.",
    },
    examples: {
      generic:
        'A company with $500k current assets and $300k current liabilities has $200k working capital.',
      startup:
        'Your working capital of {working_capital} represents the liquid resources available for day-to-day operations.',
    },
    relatedTerms: ['current-ratio', 'cash-balance', 'quick-ratio'],
    difficulty: 2,
  },
  {
    id: 'debt-to-equity',
    title: 'Debt to Equity',
    category: 'Solvency',
    contextualSubtitle:
      'Your debt to equity ratio is {debt_to_equity}, showing financial leverage.',
    visualCue: null,
    definitions: {
      basic:
        "Debt to Equity Ratio measures the relative proportion of shareholders' equity and debt used to finance a company's assets. It's calculated as Total Liabilities ÷ Total Equity.",
      contextual:
        "For founders, this ratio shows how much you're relying on debt versus equity to finance operations. Higher ratios mean more leverage and risk, but can amplify returns. Tech startups typically have lower ratios, while capital-intensive businesses may have higher ratios.",
      metaphor:
        "Think of debt to equity as buying a car - if you put $10k down and borrow $30k, your debt to equity is 3.0. You're leveraging 3x as much borrowed money as your own skin in the game.",
    },
    examples: {
      generic:
        'A company with $1M in liabilities and $2M in equity has a 0.5 debt to equity ratio.',
      startup:
        "Your debt to equity ratio of {debt_to_equity} indicates you're using {debt_to_equity < 1.0 ? 'more equity than debt' : 'more debt than equity'} to finance operations.",
    },
    relatedTerms: ['debt-ratio', 'equity-multiplier', 'cf-coverage'],
    difficulty: 3,
  },
  {
    id: 'asset-turnover',
    title: 'Asset Turnover',
    category: 'Efficiency',
    contextualSubtitle: 'Your asset turnover is {asset_turnover}, measuring asset efficiency.',
    visualCue: null,
    definitions: {
      basic:
        "Asset Turnover measures how efficiently a company uses its assets to generate revenue. It's calculated as Revenue ÷ Total Assets.",
      contextual:
        "For founders, higher asset turnover means you're generating more revenue per dollar of assets - a sign of operational efficiency. Software companies typically have high ratios, while capital-intensive businesses have lower ratios. What matters is the trend and comparison to industry peers.",
      metaphor:
        "Asset turnover is like measuring how many miles you get per gallon of gas - it shows how efficiently you're using your resources.",
    },
    examples: {
      generic: 'A company with $2M revenue and $1M in assets has an asset turnover of 2.0.',
      startup:
        'Your asset turnover of {asset_turnover} means you generate ${asset_turnover} in revenue for every dollar of assets.',
    },
    relatedTerms: ['revenue', 'return-on-equity', 'equity-multiplier'],
    difficulty: 3,
  },
  {
    id: 'equity-multiplier',
    title: 'Equity Multiplier',
    category: 'Solvency',
    contextualSubtitle:
      'Your equity multiplier is {equity_multiplier}, showing financial leverage.',
    visualCue: null,
    definitions: {
      basic:
        "Equity Multiplier measures the portion of a company's assets that are financed by equity. It's calculated as Total Assets ÷ Total Equity.",
      contextual:
        "For founders, the equity multiplier shows your leverage - how much you're using debt versus equity financing. A multiplier of 2.0 means you have $2 in assets for every $1 in equity. Higher multipliers indicate more leverage, which amplifies both gains and losses.",
      metaphor:
        "Equity multiplier is like a lever - if you invest $100 of your own money (equity) and control $300 in total assets, your multiplier is 3.0. You're using that lever to control 3x what you put in, but the lever swings both ways!",
    },
    examples: {
      generic: 'A company with $3M assets and $1.5M equity has an equity multiplier of 2.0.',
      startup:
        'Your equity multiplier of {equity_multiplier} indicates you control ${equity_multiplier} in assets for every dollar of equity.',
    },
    relatedTerms: ['debt-to-equity', 'return-on-equity', 'asset-turnover'],
    difficulty: 4,
  },
  {
    id: 'return-on-equity',
    title: 'Return on Equity (ROE)',
    category: 'Profitability',
    contextualSubtitle: "Your ROE is {roe}%, measuring return on shareholders' investment.",
    visualCue: 'RevenueChart',
    definitions: {
      basic:
        "Return on Equity (ROE) measures how efficiently a company generates profit from shareholders' equity. It's calculated as (Net Income ÷ Total Equity) × 100.",
      contextual:
        'For founders and investors, ROE is a key profitability metric that shows the return generated on invested capital. Higher ROE indicates more efficient use of equity capital. An ROE above 15% is generally considered good, though this varies by industry.',
      metaphor:
        'ROE is like the interest rate on your investment. If you and your investors put in $100k (equity) and the business generates $20k profit, you earned a 20% return - better than most savings accounts!',
    },
    examples: {
      generic: 'A company with $200k net income and $1M equity has a 20% ROE.',
      startup:
        'Your ROE of {roe}% means you generated {roe}% return on every dollar of shareholder equity this period.',
    },
    relatedTerms: ['net-income', 'equity-multiplier', 'asset-turnover'],
    difficulty: 3,
  },
  {
    id: 'debt-ratio',
    title: 'Debt Ratio',
    category: 'Solvency',
    contextualSubtitle: 'Your debt ratio is {debt_ratio}%, showing asset financing structure.',
    visualCue: null,
    definitions: {
      basic:
        "Debt Ratio measures what portion of a company's assets are financed by debt. It's calculated as (Total Liabilities ÷ Total Assets) × 100.",
      contextual:
        'For founders, the debt ratio shows your reliance on borrowed money. A ratio of 40% means 40% of assets are financed by debt, 60% by equity. Lower ratios mean less risk but potentially slower growth. Higher ratios mean more leverage and risk.',
      metaphor:
        'Debt ratio is like buying a $100k house - if you borrowed $40k (mortgage) and paid $60k cash, your debt ratio is 40%. It shows what slice of everything you own is actually owed to someone else.',
    },
    examples: {
      generic: 'A company with $1M liabilities and $2M assets has a 50% debt ratio.',
      startup:
        'Your debt ratio of {debt_ratio}% means {debt_ratio}% of your assets are financed by debt, {100 - debt_ratio}% by equity.',
    },
    relatedTerms: ['debt-to-equity', 'cf-coverage', 'equity-multiplier'],
    difficulty: 2,
  },
]

// Map categories to learning paths
function getLearningPaths(category) {
  const pathMap = {
    Fundamentals: ['fundamentals'],
    Growth: ['fundamentals', 'growth'],
    'Cash Flow': ['cash-flow'],
    Efficiency: ['efficiency'],
    Liquidity: ['fundamentals'],
    Solvency: ['fundamentals'],
    Profitability: ['fundamentals'],
  }
  return pathMap[category] || ['fundamentals']
}

async function seedData() {
  console.log('Starting to seed missing report terms...')

  try {
    await waitForTableToBeActive()
  } catch (error) {
    console.error('❌ Table is not ready:', error.message)
    process.exit(1)
  }

  console.log('🚀 Starting to seed 19 new terms...')
  let successCount = 0
  let errorCount = 0

  for (const term of newReportTerms) {
    const itemToPut = {
      ...term,
      PK: `TERM#${term.id}`,
      SK: 'META',
      difficulty: term.difficulty || 2,
      learningPaths: getLearningPaths(term.category),
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
      console.log(`✅ Seeded term: ${term.title} (${term.id})`)
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
    console.log('🎉 All 19 missing report terms seeded successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Update report views to add learn modals for these terms')
    console.log('2. Test the modals to ensure placeholders are replaced with actual values')
    console.log('3. Verify term pages load correctly at /learn/[term-id]')
  } else {
    console.log('⚠️  Some terms failed to seed. Check the errors above.')
  }
}

seedData().catch((error) => {
  console.error('Failed to seed data:', error.message)
  process.exit(1)
})
