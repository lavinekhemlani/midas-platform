# What is the point of Midas? Arguments against its existence

- The moment intuit decides to compete in the "ai space" (which they already do btw) we are fucked.
- Nobody in the team is exactly sure what the purpose of midas is at the moment.
- Tech is especially hard + devs are expensive.
- Companies with a single end goal tend to succeed, right now we seem to be fragmented.
- INTUIT QB HAS 18K employees with stable revenue (im assuming), a really big uphill battle for midas

# Potential Integrations that could set us apart (our unique selling point) (cope sesh)?

- News articles: relevant to the industry
- Comms platform for Zenith: Integrate ability to see assigned CFO and communicate through platform
- AWESOME DEV RESPONSE TIME - like we can move faster potentially (but also we dont wanna hire more devs so what now)

# Roadmap

- DEFINE THE FINAL STATE FOR THE MVP
- Customizable Dashboard (qb already has it btw)
- Identification of ineffective bookkeeping methodologies.
- Onboarding customized
- Prompting and prompt bubbles (suggested prompts) (qb already has it kinda but could add)
- Vector database : separate dbs for each field, chat history, budget and forecasting etc (investigate) (qb could do it as well)
- Payroll + Employee management
- program and activate features for different tiers of quickbooks plan (qb still)
- Integration of memories into quantitative data
- Entering and managing invoices / bookkeeping
- Track token usage for quickbooks and LLM
- Alerts and notifications

---

# Slack Integrations

Integrating with Slack can embed Midas into the user's daily workflow, making financial insights more accessible and timely.

| Feature                          | Description                                                                                                                                                                     |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Proactive Notifications**   | Push key financial data directly to users in Slack. <br> - Daily/Weekly financial summary. <br> - Alerts for large transactions or low cash. <br> - Report-ready notifications. |
| **2. Interactive Commands**      | Pull information from Midas without leaving Slack. <br> - `/ask-midas [question]`: Query the Midas AI. <br> - `/get-report [name]`: Request a report delivered to Slack.        |
| **3. Rich Previews (Unfurling)** | When a Midas link is shared, show a preview with key metrics or a chart thumbnail to add context to conversations.                                                              |

### Implementation Approach

1. **Start with Notifications:** Begin with sending alerts and summaries, as this provides the most immediate value.
2. **Use Slack's APIs:** Create a Midas Slack App. Use Incoming Webhooks for notifications and the Slash Commands API for interactivity.
3. **In-App Configuration:** Add a settings page in Midas for users to connect their Slack workspace and manage notification preferences.

---

# Unsorted - to deal with for future self

- Same thing with routes or api calls
- A smart way of loading older chats to not have a million convos up
- forecasting and expense prediction and budgeting with memorized expenses
-
- Financial health score editable fields
-
- Conversation history search etc
-
- Building Shopify essentially with 100's of modules
- Prompting and prompt bubbles - check ten top
-

# Joel's honest thoughts

- Competing against big companies is "hard" (it is an understatement)
- This is especially true when it is building on top of an existing product
- But there are success stories although the reality is a lot more complicated

## Positioning yourself as a power-user tool

**CASE STUDY 1 : superhuman (https://superhuman.com/)**

- An extremely fast and powerful email client targeting power users
- A better alternative to gmail
- Was well known among founders and power users and is actively being used by some of the most tech advanced companies (curosr, openai, etc)
- EVEN STILL with the market capture among power-users couldnt sustain itself
- Ended up being acquired by GRAMARLY
- If we are positioning ourselves against quickbooks and our selling point is "a better product than them" its still gonna be difficult but we can try
- BUT WE HAVE TO HAVE THE DEVS TO DO IT. WITHOUT DEVS THEN WE ARE JUST DOOMED TO FAIL

## ALL THAT BEING SAID HERES HOW WE "COULD" SUCCEED

- Be feature complete to quickbooks (as much as possible)
- Build a better front-end (blazingly fast ui is a must and the users would want to use it over QB)
- More responsive to user feedback
- **AUXILIARY FEATURES:**
  - These would be features based on a general QB user workflow, something that mightve taken 4-5 clicks on the QB ui that is regularly dont should be done with a few on midas
    - In order to implement this we need super heavy research and feedback and communication with users and understand their frustrations with QB
- **BETTER AI:**
  - This is a must, and this could possibly be the only avenue where we could win since its a new technology.
  - NO HALF ASS CODEGEN SOLUTION. Every decision and code must be architected for speed and understanding
  - Better memory handling, better context, faster response

---

**DISCLAIMER:**

- **DEV TEAM:**
  - All of this can only work if we have a dope dev team.
  - SO either give us time to learn ORRRR hire senior devs
- **QUICKBOOKS COULD JUST COPY US:**
  - While this could be true, they may not be able to keep up with our iteration speed due to it being a large company and use "having better devs"
  - So this basically hinges on QB being too big and us being too good which circles us back to the first point

**EXAMPLES STORIES WHERE A SMALL TEAM TOOK ON BIG TECH WITH BETTER PRODUCTS**

- T3.chat
- Superhuman (although couldnt make revenue)
- Zero mail is doing something similar. Basically gmail with AI https://0.email/

---

The only thing we have as an advantage rn is QB is too big to implement fast changes (i assume)

## CONCLUSION

- We either need more talent or more time. Otherwise this whole operation is a waste of money and brainpower

# Yash's honest thoughts

- I see it as a proof of concept as to the capability of integrations with providers and being able to provide an interactive interface for the user to interact with their data.
- Right now it doesn't really integrate with other services we provide.
- We should create Midas as AI first web app, which will be easy to get onto for potential clients and start experimenting with their integrated data. We can provide the basic features for a low cost or for free and then have tiers where the user can pay to access advanced features, more tokens, and also other Zenith Services like actual human intervention.
- The app will show a glimpse of what is possible and eventually those interested should be able to see the value in getting higher tier subscriptions.
- It should become the goto app that someone goes to if they have a finance question for their company.
- The current state of the app is good as an MVP that showcases things that are possible but I don't think it is enough to draw a great audience.

# What is midas

- Add the whatsapp thing anu discussed with howard - Midas definition
  - Here are some of our notes:

## Midas AI Platform - Zenith Summary

### What It Does

Midas connects directly to your accounting software and analyzes your financial data in real-time. Instead of looking at reports and figuring out what they mean, you get specific recommendations based on your actual numbers.

### Key Capabilities

**Live Data Analysis**

- Pulls data directly from your accounting platform as it updates
- Analyzes patterns specific to your business operations
- Provides recommendations based on your current financial position

**Custom Reporting & Dashboards**

- Visual dashboards showing cash flow, spending patterns, and key metrics with exportable analysis for presentations or board meetings
- Generate reports by asking questions in plain English instead of manually building complex queries
- Build custom features tailored to your specific business needs and reporting requirements

**Memory System Beyond Standard Books**

- Stores business context that doesn't appear in accounting records
- Tracks future events that will impact finances (planned hires, upcoming purchases, equipment investments) to calculate adjusted cash runway projections
- Maintains historical insights and business decisions for context

**Active System Integration**

- Uses tools and protocols (like MCP) to actually interact with your systems, not just answer questions about static data
- Can execute actions like pulling live bank balances, updating records, or triggering alerts based on financial thresholds
- Goes beyond simple Q&A - actively monitors, analyzes, and takes programmatic actions across your financial ecosystem

### Why This Matters

**From Numbers to Decisions**

- QuickBooks shows you what happened - Midas tells you what to do about it
- Applies your business context to raw financial data
- Turns spreadsheet analysis into simple conversation

### Security & Privacy

**Data Protection**

- Complete privacy and security documentation available
- Models hosted by Groq - enterprise security company specializing in private LLM hosting for large organizations
- QuickBooks handles all authentication - Midas only receives access tokens, never your login credentials

### Bottom Line

Midas converts your accounting platform from a passive data storage system into an active financial advisor that delivers specific recommendations through natural conversation. Using your existing accounting data as the single source of truth ensures all analysis reflects your actual financial position with enterprise-level security.

# Data Privacy

## How Are We Secure Currently?

**Strong Foundation (B+ Security Grade)**

- AWS Infrastructure: TLS 1.3 + AES-256 encryption, DynamoDB + S3 storage
- OAuth Security: Excellent CSRF protection with secure token management
- Data Isolation: Organization-scoped storage prevents cross-tenant access
- Session Management: Financial data cached per session, not permanently stored
- Compliance: CCPA considerations, clear data retention (24 months analytics, 12 months logs)

**Key Strength:** Session-based financial caching minimizes data exposure risk

## Security Enhancement Roadmap (Effort vs Reward)

### 🚨 Critical Fixes (2-4 hours)

1. Fix Refresh Token Bug - Currently violates Intuit requirements, causes auth failures
2. Secure Environment Variables - AWS credentials exposed in .env.local

### 🔴 High Impact (1-2 days each)

3. Token Refresh Locking - Prevent multi-device race conditions
4. Security Monitoring - CloudWatch dashboard for auth failures/rate limits
5. Background Token Refresh - Prevent 100+ day offline expiration

### 🟡 Medium Priority (3-5 days each)

6. SOC 2 Preparation - Enterprise compliance certification
7. Customer-Managed KMS - Enhanced encryption control
8. Advanced Rate Limiting - Per-user API protection

### 🟢 Quick Wins (1-2 hours each)

- Security headers (CSP, HSTS)
- Input validation enhancement
- Error message sanitization
- Session timeout implementation

**Recommendation:** Start with critical fixes this week, implement high-impact items next sprint. Current foundation is solid - most improvements are incremental enhancements rather than fundamental security gaps.

# Competitor research (ai specific)

## Direct CFO/Financial AI Competitors

**Intuit Assist (QuickBooks AI) - Major Threat**

- AI agents for expense categorization, cash flow forecasting, smart reminders
- Email-to-invoice/bill generation, 5 days faster payments with AI reminders
- Available to 45M+ QuickBooks users, heavily funded development
- **Threat Level**: Extreme - same market, massive user base

**Zeni - AI CFO for Startups**

- Full-service AI bookkeeping + human CFOs, real-time dashboards
- Targets our exact audience (startups/SMBs), YC-backed
- **Positioning**: "AI-first accounting platform"
- **Threat Level**: High - direct competitor

**Puzzle - Modern Accounting for Startups**

- AI-powered expense categorization, real-time burn/runway metrics
- Built "by founders for founders", QuickBooks alternative
- Strong startup branding, YC alumni network
- **Threat Level**: High - startup focus

## Enterprise FP&A Players Adding AI

**Cube/Anaplan/Planful**

- Established FP&A platforms integrating AI forecasting
- Target mid-market/enterprise vs our SMB focus
- **Threat Level**: Medium - different market segment

## AI Accounting Automation Startups

**Trullion** - 25% faster reporting, 30% cost savings  
**Numeric** - AI balance sheet reconciliation, flux analysis  
**Vic.ai** - 99% accuracy AP automation, 5X efficiency gains

## Key Insights

- **Market Saturation**: 71% of CFOs not using AI yet - opportunity window closing fast
- **Intuit Advantage**: Massive distribution, can copy our features instantly
- **Startup Positioning**: Several competitors targeting exact same market (Zeni, Puzzle)
- **Differentiation Gap**: Most focus on automation vs. our conversational AI approach

# AI Model Security & Hosting Options

## Industry Security Standards

**OpenAI & Anthropic (Enterprise Grade)**

- **Compliance**: SOC 2 Type II, GDPR, HIPAA BAAs, ISO 27001/27017/27018/27701
- **Enterprise Guarantees**: No training on enterprise data, zero retention policies
- **Data Processing**: Both offer Data Processing Addendums (DPAs) for compliance

**Groq Security**

- **Performance**: 0.14s latency, enterprise-scale deployment
- **Data Handling**: Global processing operations, complies with applicable law
- **Features**: LoRA fine-tuning for Enterprise tier, on-prem + cloud options

## Hosting Options: Pros vs Cons

| Option               | Pros                                                                                                        | Cons                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Groq Cloud**       | • Fastest inference (0.14s latency)<br>• Enterprise support<br>• No infrastructure management               | • Data shared with service providers¹<br>• Less customization control<br>• Ongoing costs                              |
| **Self-Hosted**      | • Complete data control<br>• GDPR/HIPAA compliance<br>• Cost efficiency at scale<br>• Air-gapped capability | • High technical complexity<br>• Infrastructure investment<br>• Security vulnerability risks<br>• Management overhead |
| **OpenAI/Anthropic** | • SOC 2 + enterprise compliance<br>• Proven at scale<br>• Professional support                              | • Higher costs<br>• API dependencies<br>• Data leaves premises                                                        |

## Real-World Examples

**Cursor IDE (AI Coding Tool)**

- **Privacy Mode**: 50% of users enable it, guarantees zero code storage
- **Enterprise**: SOC 2 Type II, SAML SSO, locked privacy mode for business plans
- **Risk**: Still routes through cloud backend even with local models

**Recommendation**: Groq for development/testing, evaluate self-hosting for sensitive financial data at scale

# Machine Learning Opportunities (Anu)

We can leverage machine learning (ML) to provide predictive, proactive insights that set us apart from standard accounting software. Here is a summary of potential features and a plan to implement them.

| Opportunity                  | User Benefit                                                                                        | How to Implement                                                                      |
| :--------------------------- | :-------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| **1. Financial Forecasting** | Predict future cash flow, revenue, and expenses to make better business decisions.                  | Use time-series models (like Prophet) on historical transaction data.                 |
| **2. Anomaly Detection**     | Automatically flag unusual transactions to catch errors and potential fraud early.                  | Use outlier detection algorithms (like Isolation Forest) to find what's not "normal". |
| **3. Smart Categorization**  | Automate bookkeeping by suggesting categories for transactions, saving time and improving accuracy. | Train a classification model on existing categorized data to learn user patterns.     |

### Phased Implementation Plan

1. **Start Small:** Begin with **Financial Forecasting**, as it offers high, immediate value.
2. **Build PoC:** Develop a proof-of-concept and test it with a small group of users.
3. **Iterate & Expand:** Refine the model based on feedback, then expand to other features like **Anomaly Detection**.

# Tech Stack improvements

| Aspect            | Go + React Stack                         | Next.js Full Stack                          |
| ----------------- | ---------------------------------------- | ------------------------------------------- |
| Development Speed | Slower                                   | 🚀 Faster                                   |
| Performance       | ⚡️ Higher (Backend)                     | Very Good                                   |
| Architecture      | Decoupled (Separate frontend/backend)    | Integrated (Unified codebase)               |
| Team Structure    | Best for separate frontend/backend teams | Ideal for full-stack JS/TS developers       |
| Scalability       | Excellent for backend microservices      | Excellent for serverless and edge functions |

- DB - PostgreSQL
- AI agents Langchain

### Third Party Integrations

- Plaid: To connect directly to users' bank accounts. This provides real-time transaction data, which is a powerful addition to the existing QuickBooks/Xero accounting data.
- Stripe: To integrate with payment gateways. This allows you to analyze live revenue and sales data as it happens.
- Sentry: For real-time error tracking. This is crucial for identifying and fixing bugs in a production environment, ensuring application stability.
- Intercom: For in-app customer support and user onboarding. This allows you to provide live chat support and guide users through complex features.
