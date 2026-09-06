# Missing Learn Terms for Reports Pages

This document contains the content for learn terms that are displayed in the reports pages but don't yet have corresponding entries in the `zenith-learn-terms` DynamoDB table.

---

## 1. Operating Margin

**Term ID**: `operating-margin`
**Category**: Fundamentals
**Contextual Subtitle**: "Your operating margin is {operating_margin_pct}%, showing your operational efficiency."

### Definitions

- **Basic**: "Operating margin is the percentage of revenue remaining after deducting cost of goods sold (COGS) and operating expenses, but before interest and taxes."
- **Contextual**: "This metric reveals how efficiently your core business operates. A healthy operating margin means you're covering both direct costs and overhead from your main operations, before considering financing costs."
- **Metaphor**: "Think of operating margin as what's left in your wallet after buying ingredients (COGS) and paying the chef and rent (operating expenses), but before you make your loan payment. It shows if your restaurant itself is profitable."

### Examples

- **Generic**: "A company with $1M revenue, $200k COGS, and $500k operating expenses has a 30% operating margin."
- **Startup**: "With {total_revenue} in revenue, your operating margin of {operating_margin_pct}% indicates your core business efficiency before financing costs."

### Related Terms

`["gross-margin", "net_profit_margin", "ebitda"]`

### Difficulty

2

### Visual Cue

`"RevenueChart"`

---

## 2. Expense Ratio

**Term ID**: `expense-ratio`
**Category**: Fundamentals
**Contextual Subtitle**: "Your expense ratio is {expense_ratio}%, showing how much of revenue goes to expenses."

### Definitions

- **Basic**: "Expense ratio is the percentage of revenue consumed by total operating expenses. It shows what portion of each dollar earned goes toward running the business."
- **Contextual**: "For founders, keeping expense ratio under control is crucial for profitability. A lower ratio means more revenue converts to profit. High-growth companies often have higher ratios as they invest in growth."
- **Metaphor**: "Expense ratio is like checking how much of every dollar you earn gets eaten up by your bills and expenses. If it's 60%, then 60 cents of every dollar goes right back out the door."

### Examples

- **Generic**: "A company with $1M revenue and $600k in operating expenses has a 60% expense ratio."
- **Startup**: "Your expense ratio of {expense_ratio}% means that for every dollar of revenue, {expense_ratio} cents go to operating expenses."

### Related Terms

`["gross-margin", "operating-margin", "burn-rate"]`

### Difficulty

2

### Visual Cue

`"RevenueChart"`

---

## 3. Revenue Growth

**Term ID**: `revenue-growth`
**Category**: Growth
**Contextual Subtitle**: "Your revenue grew by {revenue_growth}% compared to the previous period."

### Definitions

- **Basic**: "Revenue growth is the percentage increase or decrease in revenue compared to a previous period."
- **Contextual**: "For founders and investors, revenue growth is a key indicator of market demand and business momentum. Consistent growth shows product-market fit and scalability."
- **Metaphor**: "Think of revenue growth as measuring how much faster you're running this lap compared to the last one. A 50% growth rate means you're running 1.5x faster than before."

### Examples

- **Generic**: "A company that grew from $100k to $150k in quarterly revenue has 50% revenue growth."
- **Startup**: "Your revenue increased by {revenue_growth}% this period, demonstrating {revenue_growth > 20 ? 'strong' : revenue_growth > 0 ? 'positive' : 'challenging'} market traction."

### Related Terms

`["revenue", "arr", "mrr"]`

### Difficulty

2

### Visual Cue

`"RevenueChart"`

---

## 4. Expense Growth

**Term ID**: `expense-growth`
**Category**: Fundamentals
**Contextual Subtitle**: "Your expenses grew by {expense_growth}% compared to the previous period."

### Definitions

- **Basic**: "Expense growth is the percentage increase or decrease in total operating expenses compared to a previous period."
- **Contextual**: "For founders, expense growth should be watched carefully relative to revenue growth. Expenses growing faster than revenue erode margins and burn cash faster. Controlled expense growth shows operational discipline."
- **Metaphor**: "Expense growth is like your household bills getting bigger each month. If your bills grow 30% but your salary only grows 10%, you're heading for trouble."

### Examples

- **Generic**: "A company's expenses increased from $80k to $100k, showing 25% expense growth."
- **Startup**: "Your expenses grew by {expense_growth}% while revenue grew by {revenue_growth}%. {expense_growth > revenue_growth ? 'Consider optimizing spending to improve unit economics.' : 'You're maintaining good expense discipline.'}"

### Related Terms

`["burn-rate", "expense-ratio", "revenue-growth"]`

### Difficulty

2

### Visual Cue

`"RevenueChart"`

---

## 5. EBITDA

**Term ID**: `ebitda`
**Category**: Fundamentals
**Contextual Subtitle**: "Your EBITDA is {ebitda}, showing operational profitability."

### Definitions

- **Basic**: "EBITDA stands for Earnings Before Interest, Taxes, Depreciation, and Amortization. It measures a company's operating performance by focusing on earnings from core operations."
- **Contextual**: "For founders, EBITDA provides a clearer picture of operational profitability by removing the effects of financing decisions, accounting rules, and tax structures. It's particularly useful for comparing companies across different tax jurisdictions or capital structures."
- **Metaphor**: "Think of EBITDA as your business's raw earning power - like a runner's speed before considering the weight of their backpack (debt), the friction of the track (taxes), or their worn-out shoes (depreciation). It's pure operational strength."

### Examples

- **Generic**: "A company with $500k operating income, $50k depreciation, and $20k amortization has $570k EBITDA."
- **Startup**: "Your EBITDA of {ebitda} shows how much cash your core operations generate before accounting for financing and non-cash expenses."

### Related Terms

`["operating-margin", "profit", "cash-flow"]`

### Difficulty

3

### Visual Cue

`"RevenueChart"`

---

## 6. Net Income

**Term ID**: `net-income`
**Category**: Fundamentals
**Contextual Subtitle**: "Your net income is {net_income}, the bottom line after all expenses."

### Definitions

- **Basic**: "Net income, also called the 'bottom line,' is what remains after all expenses, including operating costs, interest, taxes, and depreciation, have been subtracted from total revenue."
- **Contextual**: "For founders, net income is the ultimate measure of profitability. Positive net income means your business is truly profitable. Negative net income (a loss) indicates you're burning more than you're earning, which is common for growth-stage startups but unsustainable long-term."
- **Metaphor**: "Net income is the bottom of the funnel - everything flows in at the top (revenue), but after the business, the tax man, and the bank all take their cut, this is what actually lands in your pocket."

### Examples

- **Generic**: "A company with $1M revenue and $900k in all expenses has $100k net income."
- **Startup**: "Your net income of {net_income} represents your true profitability after accounting for every cost of doing business."

### Related Terms

`["profit", "revenue", "gross-margin"]`

### Difficulty

2

### Visual Cue

`"RevenueChart"`

---

## 7. OCF Ratio (Operating Cash Flow Ratio)

**Term ID**: `ocf-ratio`
**Category**: Cash Flow
**Contextual Subtitle**: "Your OCF ratio is {ocf_ratio}, measuring ability to cover liabilities."

### Definitions

- **Basic**: "Operating Cash Flow Ratio measures how many times a company can pay off its current liabilities with the cash generated from operations in a given period."
- **Contextual**: "For founders, this ratio reveals your ability to meet short-term obligations from operating cash flow alone, without relying on external financing. A ratio above 1.0 indicates strong liquidity from operations."
- **Metaphor**: "Think of OCF ratio as asking: can I pay this month's bills with this month's paycheck? A ratio of 2.0 means your paycheck is twice your bills - comfortable. Below 1.0 means you can't cover your bills from what you're earning."

### Examples

- **Generic**: "A company with $100k operating cash flow and $50k current liabilities has an OCF ratio of 2.0."
- **Startup**: "Your OCF ratio of {ocf_ratio} means your operations generate {ocf_ratio}x the cash needed to cover current liabilities."

### Related Terms

`["ocf", "current-ratio", "quick-ratio"]`

### Difficulty

3

### Visual Cue

`"DailyCashFlowChart"`

---

## 8. Free Cash Flow

**Term ID**: `free-cash-flow`
**Category**: Cash Flow
**Contextual Subtitle**: "Your free cash flow is {free_cash_flow}, showing cash available after investments."

### Definitions

- **Basic**: "Free Cash Flow (FCF) is the cash a company generates after accounting for cash outflows to support operations and maintain capital assets. It's calculated as Operating Cash Flow minus Capital Expenditures."
- **Contextual**: "For founders, FCF represents the cash you truly have available to grow the business, pay down debt, return to investors, or save for a rainy day. Positive FCF means you're generating more cash than you're spending on keeping the business running."
- **Metaphor**: "Free cash flow is like your spending money after paying rent, groceries, and fixing your car. It's the cash that's truly yours to decide what to do with - save it, invest it, or treat yourself."

### Examples

- **Generic**: "A company with $150k operating cash flow and $50k in equipment purchases has $100k free cash flow."
- **Startup**: "Your free cash flow of {free_cash_flow} represents the cash available after maintaining and investing in your assets."

### Related Terms

`["ocf", "cash-flow", "runway"]`

### Difficulty

3

### Visual Cue

`"DailyCashFlowChart"`

---

## 9. Cash Conversion Cycle

**Term ID**: `cash-conversion-cycle`
**Category**: Efficiency
**Contextual Subtitle**: "Your cash conversion cycle is {cash_conversion_cycle} days."

### Definitions

- **Basic**: "Cash Conversion Cycle (CCC) measures how many days it takes to convert investments in inventory and other resources into cash from sales. It's calculated as Days Inventory Outstanding + Days Sales Outstanding - Days Payable Outstanding."
- **Contextual**: "For founders, a shorter CCC means faster cash flow turnover and less working capital needed. It shows how efficiently you're converting investments into cash. Negative CCC (like Dell or Amazon) means you collect cash before paying suppliers - the holy grail of cash management."
- **Metaphor**: "Think of CCC as the journey from buying ingredients at the store, cooking dinner, serving guests, and finally getting paid. The faster you complete this loop, the sooner you can buy more ingredients and keep growing. Some businesses (like Amazon) get paid before they even pay for their ingredients!"

### Examples

- **Generic**: "A company with 30 days inventory, 45 days receivables, and 30 days payables has a 45-day CCC (30+45-30)."
- **Startup**: "Your {cash_conversion_cycle}-day cash conversion cycle shows you're turning investments into cash in {cash_conversion_cycle < 30 ? 'an efficient' : cash_conversion_cycle < 60 ? 'a reasonable' : 'an extended'} timeframe."

### Related Terms

`["dso", "dpo", "working-capital"]`

### Difficulty

4

### Visual Cue

`null`

---

## 10. OCF Margin (Operating Cash Flow Margin)

**Term ID**: `ocf-margin`
**Category**: Cash Flow
**Contextual Subtitle**: "Your OCF margin is {ocf_margin}%, showing cash generation efficiency."

### Definitions

- **Basic**: "Operating Cash Flow Margin is the percentage of revenue that converts into operating cash flow. It's calculated as (Operating Cash Flow ÷ Revenue) × 100."
- **Contextual**: "For founders, OCF margin reveals how efficiently you convert sales into actual cash. While profit margin uses accounting numbers, OCF margin shows real cash generation. High OCF margin means your business model efficiently generates cash from revenue."
- **Metaphor**: "Think of OCF margin as what percentage of the money customers give you actually makes it to your bank account. A 25% OCF margin means for every $100 in sales, $25 becomes real spendable cash in your business."

### Examples

- **Generic**: "A company with $1M revenue and $250k operating cash flow has a 25% OCF margin."
- **Startup**: "Your {ocf_margin}% OCF margin means you convert {ocf_margin}% of each revenue dollar into operating cash flow."

### Related Terms

`["ocf", "net_profit_margin", "cash-flow"]`

### Difficulty

3

### Visual Cue

`"DailyCashFlowChart"`

---

## 11. Cash Flow Coverage Ratio

**Term ID**: `cf-coverage`
**Category**: Cash Flow
**Contextual Subtitle**: "Your CF coverage ratio is {cf_coverage}, measuring debt serviceability."

### Definitions

- **Basic**: "Cash Flow Coverage Ratio measures how many times a company can pay its total debt with its operating cash flow. It's calculated as Operating Cash Flow ÷ Total Debt."
- **Contextual**: "For founders with debt, this ratio shows your ability to pay it off from operations. A ratio above 0.2 (20%) is generally considered healthy. Higher is better - it means you could theoretically pay off your debt faster."
- **Metaphor**: "CF coverage is like asking: if I put all my salary toward my credit card debt, what fraction could I pay off this year? A ratio of 0.5 means you could pay off half your debt with this year's earnings."

### Examples

- **Generic**: "A company with $500k annual operating cash flow and $2M total debt has a 0.25 CF coverage ratio."
- **Startup**: "Your CF coverage ratio of {cf_coverage} indicates you could {cf_coverage > 0.2 ? 'comfortably service' : 'face challenges servicing'} your debt from operations."

### Related Terms

`["ocf", "debt-ratio", "debt-to-equity"]`

### Difficulty

4

### Visual Cue

`null`

---

## 12. Current Ratio

**Term ID**: `current-ratio`
**Category**: Liquidity
**Contextual Subtitle**: "Your current ratio is {current_ratio}, measuring short-term financial health."

### Definitions

- **Basic**: "Current Ratio measures a company's ability to pay short-term obligations with short-term assets. It's calculated as Current Assets ÷ Current Liabilities."
- **Contextual**: "For founders, current ratio is a key liquidity indicator. A ratio above 1.0 means you have more current assets than current liabilities. Between 1.5-3.0 is generally considered healthy. Below 1.0 suggests potential liquidity problems."
- **Metaphor**: "Current ratio is like comparing your checking account balance to your credit card bill that's due next month. A ratio of 2.0 means you have twice the money needed to pay what you owe."

### Examples

- **Generic**: "A company with $300k in current assets and $200k in current liabilities has a current ratio of 1.5."
- **Startup**: "Your current ratio of {current_ratio} means you have {current_ratio}x the short-term assets needed to cover short-term obligations."

### Related Terms

`["quick-ratio", "working-capital", "cash_balance"]`

### Difficulty

2

### Visual Cue

`null`

---

## 13. Quick Ratio (Acid Test)

**Term ID**: `quick-ratio`
**Category**: Liquidity
**Contextual Subtitle**: "Your quick ratio is {quick_ratio}, the acid test of liquidity."

### Definitions

- **Basic**: "Quick Ratio, also called the Acid Test, measures the ability to pay short-term obligations with the most liquid assets (excluding inventory). It's calculated as (Current Assets - Inventory) ÷ Current Liabilities."
- **Contextual**: "For founders, quick ratio is a more conservative liquidity test than current ratio because it excludes inventory, which can be hard to convert to cash quickly. A ratio above 1.0 is ideal, meaning you can cover all short-term debts with highly liquid assets."
- **Metaphor**: "Quick ratio asks: can you pay your bills right now with just your wallet and bank account, without having to run a garage sale first? It's the real test of immediate liquidity."

### Examples

- **Generic**: "A company with $250k current assets, $50k inventory, and $200k current liabilities has a quick ratio of 1.0."
- **Startup**: "Your quick ratio of {quick_ratio} shows {quick_ratio >= 1.0 ? 'strong' : 'tight'} immediate liquidity without relying on selling inventory."

### Related Terms

`["current-ratio", "cash_balance", "working-capital"]`

### Difficulty

3

### Visual Cue

`null`

---

## 14. Working Capital

**Term ID**: `working-capital`
**Category**: Liquidity
**Contextual Subtitle**: "Your working capital is {working_capital}, funding daily operations."

### Definitions

- **Basic**: "Working Capital is the difference between current assets and current liabilities. It represents the capital available to fund day-to-day operations."
- **Contextual**: "For founders, working capital is the cushion that keeps your business running smoothly. Positive working capital means you have more short-term assets than obligations. Negative working capital can signal liquidity issues unless you have a business model that collects cash before paying suppliers (like Amazon)."
- **Metaphor**: "Working capital is like the cash cushion in your wallet after setting aside money for upcoming bills. It's your financial breathing room for daily operations - buying supplies, paying salaries, keeping the lights on."

### Examples

- **Generic**: "A company with $500k current assets and $300k current liabilities has $200k working capital."
- **Startup**: "Your working capital of {working_capital} represents the liquid resources available for day-to-day operations."

### Related Terms

`["current-ratio", "cash_balance", "quick-ratio"]`

### Difficulty

2

### Visual Cue

`null`

---

## 15. Debt to Equity

**Term ID**: `debt-to-equity`
**Category**: Solvency
**Contextual Subtitle**: "Your debt to equity ratio is {debt_to_equity}, showing financial leverage."

### Definitions

- **Basic**: "Debt to Equity Ratio measures the relative proportion of shareholders' equity and debt used to finance a company's assets. It's calculated as Total Liabilities ÷ Total Equity."
- **Contextual**: "For founders, this ratio shows how much you're relying on debt versus equity to finance operations. Higher ratios mean more leverage and risk, but can amplify returns. Tech startups typically have lower ratios, while capital-intensive businesses may have higher ratios."
- **Metaphor**: "Think of debt to equity as buying a car - if you put $10k down and borrow $30k, your debt to equity is 3.0. You're leveraging 3x as much borrowed money as your own skin in the game."

### Examples

- **Generic**: "A company with $1M in liabilities and $2M in equity has a 0.5 debt to equity ratio."
- **Startup**: "Your debt to equity ratio of {debt_to_equity} indicates you're using {debt_to_equity < 1.0 ? 'more equity than debt' : 'more debt than equity'} to finance operations."

### Related Terms

`["debt-ratio", "equity-multiplier", "cf-coverage"]`

### Difficulty

3

### Visual Cue

`null`

---

## 16. Asset Turnover

**Term ID**: `asset-turnover`
**Category**: Efficiency
**Contextual Subtitle**: "Your asset turnover is {asset_turnover}, measuring asset efficiency."

### Definitions

- **Basic**: "Asset Turnover measures how efficiently a company uses its assets to generate revenue. It's calculated as Revenue ÷ Total Assets."
- **Contextual**: "For founders, higher asset turnover means you're generating more revenue per dollar of assets - a sign of operational efficiency. Software companies typically have high ratios, while capital-intensive businesses have lower ratios. What matters is the trend and comparison to industry peers."
- **Metaphor**: "Asset turnover is like measuring how many miles you get per gallon of gas - it shows how efficiently you're using your resources."

### Examples

- **Generic**: "A company with $2M revenue and $1M in assets has an asset turnover of 2.0."
- **Startup**: "Your asset turnover of {asset_turnover} means you generate ${asset_turnover} in revenue for every dollar of assets."

### Related Terms

`["revenue", "return-on-equity", "equity-multiplier"]`

### Difficulty

3

### Visual Cue

`null`

---

## 17. Equity Multiplier

**Term ID**: `equity-multiplier`
**Category**: Solvency
**Contextual Subtitle**: "Your equity multiplier is {equity_multiplier}, showing financial leverage."

### Definitions

- **Basic**: "Equity Multiplier measures the portion of a company's assets that are financed by equity. It's calculated as Total Assets ÷ Total Equity."
- **Contextual**: "For founders, the equity multiplier shows your leverage - how much you're using debt versus equity financing. A multiplier of 2.0 means you have $2 in assets for every $1 in equity. Higher multipliers indicate more leverage, which amplifies both gains and losses."
- **Metaphor**: "Equity multiplier is like a lever - if you invest $100 of your own money (equity) and control $300 in total assets, your multiplier is 3.0. You're using that lever to control 3x what you put in, but the lever swings both ways!"

### Examples

- **Generic**: "A company with $3M assets and $1.5M equity has an equity multiplier of 2.0."
- **Startup**: "Your equity multiplier of {equity_multiplier} indicates you control ${equity_multiplier} in assets for every dollar of equity."

### Related Terms

`["debt-to-equity", "return-on-equity", "asset-turnover"]`

### Difficulty

4

### Visual Cue

`null`

---

## 18. Return on Equity (ROE)

**Term ID**: `return-on-equity`
**Category**: Profitability
**Contextual Subtitle**: "Your ROE is {roe}%, measuring return on shareholders' investment."

### Definitions

- **Basic**: "Return on Equity (ROE) measures how efficiently a company generates profit from shareholders' equity. It's calculated as (Net Income ÷ Total Equity) × 100."
- **Contextual**: "For founders and investors, ROE is a key profitability metric that shows the return generated on invested capital. Higher ROE indicates more efficient use of equity capital. An ROE above 15% is generally considered good, though this varies by industry."
- **Metaphor**: "ROE is like the interest rate on your investment. If you and your investors put in $100k (equity) and the business generates $20k profit, you earned a 20% return - better than most savings accounts!"

### Examples

- **Generic**: "A company with $200k net income and $1M equity has a 20% ROE."
- **Startup**: "Your ROE of {roe}% means you generated {roe}% return on every dollar of shareholder equity this period."

### Related Terms

`["net-income", "equity-multiplier", "asset-turnover"]`

### Difficulty

3

### Visual Cue

`"RevenueChart"`

---

## 19. Debt Ratio

**Term ID**: `debt-ratio`
**Category**: Solvency
**Contextual Subtitle**: "Your debt ratio is {debt_ratio}%, showing asset financing structure."

### Definitions

- **Basic**: "Debt Ratio measures what portion of a company's assets are financed by debt. It's calculated as (Total Liabilities ÷ Total Assets) × 100."
- **Contextual**: "For founders, the debt ratio shows your reliance on borrowed money. A ratio of 40% means 40% of assets are financed by debt, 60% by equity. Lower ratios mean less risk but potentially slower growth. Higher ratios mean more leverage and risk."
- **Metaphor**: "Debt ratio is like buying a $100k house - if you borrowed $40k (mortgage) and paid $60k cash, your debt ratio is 40%. It shows what slice of everything you own is actually owed to someone else."

### Examples

- **Generic**: "A company with $1M liabilities and $2M assets has a 50% debt ratio."
- **Startup**: "Your debt ratio of {debt_ratio}% means {debt_ratio}% of your assets are financed by debt, {100 - debt_ratio}% by equity."

### Related Terms

`["debt-to-equity", "cf-coverage", "equity-multiplier"]`

### Difficulty

2

### Visual Cue

`null`

---

## DynamoDB CSV Import Format

For bulk import into DynamoDB, here's the data in CSV-compatible format:

```
PK,SK,id,title,category,contextualSubtitle,difficulty,visualCue,created_at,updated_at,definitions,examples,relatedTerms,learningPaths
TERM#operating-margin,META,operating-margin,Operating Margin,Fundamentals,Your operating margin is {operating_margin_pct}%...,2,RevenueChart,1750000000,1750000000,{basic:...,contextual:...,metaphor:...},{generic:...,startup:...},[gross-margin,net_profit_margin,ebitda],[fundamentals]
...
```

Note: The actual DynamoDB import would need the definitions, examples, and relatedTerms fields properly formatted as JSON objects/arrays according to DynamoDB's format.
