# Midas Agentic System Architecture - Comprehensive Analysis

## Executive Summary

The Midas (formerly Zenith OS) agentic AI system is a sophisticated multi-agent financial analysis platform built on LangChain, featuring deep QuickBooks integration. The system employs a hierarchical agent architecture with specialized sub-agents, persistent memory via AWS DynamoDB, intelligent context management, and dynamic visualization generation. It provides comprehensive financial analysis through natural language interactions while maintaining **exact data consistency** with the application's Reports Pages through aligned calculation methods and date range handling.

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Complete Request Flow](#complete-request-flow)
3. [Agent Communication Architecture](#agent-communication-architecture)
4. [Chat History & Context Management](#chat-history--context-management)
5. [Memory System & DynamoDB Integration](#memory-system--dynamodb-integration)
6. [Financial Data Access Architecture](#financial-data-access-architecture)
7. [Agent Tools vs Reports Pages Comparison](#agent-tools-vs-reports-pages-comparison)
8. [Current State Assessment](#current-state-assessment)

## System Architecture Overview

### Core Components

#### 1. Entry Point

- **Primary Route**: `/api/chat/route.ts`
- **Rate Limiting**: 15 requests per minute per user
- **Response Format**: Server-Sent Events (SSE) streaming
- **Authentication**: Token-based via `withActiveProvider` wrapper

#### 2. LLM Configuration

- **Default Provider**: Groq (Llama 3.3 70B)
- **Fallback Chain**: Groq → OpenAI → Anthropic
- **Context Windows**:
  - Llama 3.3: 32K tokens
  - Llama 3.1: 131K tokens
  - GPT-5: 400K tokens
  - Claude 3 Opus: 200K tokens

#### 3. Agent Hierarchy

```
CFO Agent (Primary Orchestrator)
├── Multi-Agent Orchestrator
│   ├── Report Generator Agent
│   ├── Data Analyst Agent
│   ├── Visualizer Agent
│   ├── Project Manager Agent (QuickBooks Plus+)
│   └── Tax Planning Agent
└── Direct Tools
    ├── UnifiedDataTool (Rate-limited: 50/60s)
    ├── ComponentRenderTool
    ├── FlexibleVisualizationTool
    ├── FinancialCalculatorTool
    ├── MemorySearchTool
    ├── MemoryManagementTool
    ├── MultiAgentReportTool
    ├── CriticalAnalysisTool
    └── LearnTermDetector
```

## Complete Request Flow

### Phase 1: Request Initialization (route.ts:181-208)

```typescript
1. Rate limit check → User bucket validation
2. Request parsing → Extract input, useAgent flag, LLM preferences
3. Stream initialization → Create SSE response stream
4. Message persistence → Save user message to DynamoDB
```

### Phase 2: Context Preparation (route.ts:329-444)

```typescript
1. Financial data fetch (parallel):
   - Organization info
   - Bank accounts
   - Recent invoices (50)
   - Recent expenses (50)
   - KPI calculation

2. LLM creation:
   - Priority: User-specified → Groq → Fallback
   - Model: openai/gpt-oss-120b (default)

3. Memory search:
   - Query: User input
   - Relevance threshold: 0.5
   - Limit: 5 memories
   - Scoring: Recency + Amount + Type

4. Context optimization:
   - Fetch last N messages (12-30 based on model)
   - Token estimation (1 token ≈ 4 chars)
   - Summarization if >70% context used
   - Message truncation (800 char limit)
```

### Phase 3: Agent Execution (route.ts:496-744)

```typescript
1. Agent initialization:
   - CFO Agent with system prompt (386 lines)
   - Tool registration and brace escaping
   - Max iterations: 20

2. Query classification:
   - Pure greetings → No report saving
   - Financial queries → Full tool engagement
   - Complex requests → Multi-agent orchestration

3. Tool execution flow:
   - unified_data → Financial data fetch
   - visualization_hints extraction
   - render_component → UI component generation
   - memory_management → Context persistence

4. Status updates:
   - Every 2 seconds during processing
   - Max 20 updates to prevent loops
```

### Phase 4: Response Processing (route.ts:745-904)

```typescript
1. Memory extraction:
   - Parse response for memory patterns
   - Store in DynamoDB with relevance scores
   - Types: expense, goal, decision, context, date, preference

2. Visualization processing:
   - Extract hints from intermediate steps
   - Auto-render if agent missed render_component
   - Fallback creation for unified_data results

3. Report generation:
   - Trigger: Components.length > 0 && !greeting
   - Auto-title generation
   - Type inference from components
   - Insight extraction (5 key points)

4. Response streaming:
   - Chunk size: 15 characters
   - Delay: 20ms (30ms at punctuation)
   - Final payload with components & memories
```

## Agent Communication Architecture

### Multi-Agent Orchestrator (multiAgentOrchestrator.ts)

#### Agent Communication Protocol

```typescript
class AgentCommunicationTool {
  // Enables inter-agent messaging
  Input: {
    targetAgent: "report_generator|data_analyst|visualizer|project_manager|tax_planner"
    request: string
    context: any
  }

  // Execution flow:
  1. Parse target agent ID
  2. Retrieve agent instance from Map
  3. Invoke agent with request + context
  4. Return structured response with steps
}
```

#### Report Composition Tool

```typescript
class ReportCompositionTool {
  // Aggregates multi-agent outputs
  Input: {
    structure: ReportStructure
    analysis: AnalysisResults
    visualizations: VizSpecs[]
    narrative: string
  }

  // Composition process:
  1. Calculate confidence scores
  2. Organize sections with content
  3. Filter visualizations per section
  4. Generate executive summary
  5. Return unified report spec
}
```

#### Agent Initialization Sequence

```typescript
1. Parallel agent creation:
   - Report Generator (narrative focus)
   - Data Analyst (metrics focus)
   - Visualizer (chart selection)

2. Conditional agents (QuickBooks Plus+):
   - Project Manager (project profitability)
   - Tax Planner (tax optimization)

3. Orchestrator setup:
   - System prompt with intent detection
   - Communication tools registration
   - Max iterations: 10
```

## Chat History & Context Management

### Chat History Storage (chatHistory.ts)

#### DynamoDB Schema

```typescript
Table: chat_history (via CHAT_HISTORY_TABLE env)
PK: userId (string)
SK: timestamp (number - epoch millis)
Attributes:
  - id: UUID
  - role: "user" | "assistant"
  - content: string
  - ts: number
  - memories?: Memory[]
  - hasReport?: boolean
  - learnTerms?: LearnTerm[]
```

#### Retrieval Strategy

```typescript
fetchLastN(userId, n):
  1. Query with PK = userId
  2. ScanIndexForward = false (newest first)
  3. Limit = n (default: 12)
  4. Reverse for chronological order
  5. Fallback to empty array in dev mode
```

### Context Manager (contextManager.ts)

#### Token Optimization

```typescript
class ContextManager {
  // Model-aware optimization
  getOptimalMessageCount():
    - 131K context → 30 messages
    - 32K context → 12 messages
    - <30K context → 8 messages

  // Context analysis
  analyzeContext():
    - Estimate tokens (chars/4)
    - Reserve 20% for output
    - Trigger summarization at 70%

  // Message processing
  optimizeChatHistory():
    - Keep recent N messages
    - Summarize older messages
    - Smart truncation (400 start + 200 end)
    - Extract topics, decisions, questions
}
```

#### Summarization Intelligence

```typescript
summarizeMessages():
  Topics detected:
    - revenue, expense, cash flow, profit, customer

  Pattern extraction:
    - Decisions: "will", "should", "plan to"
    - Questions: role="user" && contains("?")

  Output format:
    "Discussed topics: [topics]
     Key questions: [count] asked
     Decisions made: [count]"
```

## Memory System & DynamoDB Integration

### Memory Storage Architecture

#### DynamoDB Schema (memoryManager.ts)

```typescript
Table: ai_cfo_memories (via MEMORY_TABLE_NAME env)
Primary Key:
  PK: USER#${userId}#${organizationId}
  SK: ${type}#${timestamp}

GSI1 (Organization Index):
  GSI1PK: ${organizationId}
  GSI1SK: TYPE#${type}#${timestamp}

TTL: 1 year default (configurable)
```

#### Memory Types & Structure

```typescript
interface Memory {
  id: string // MEM#uuid
  type: MemoryType // See types below
  content: string // Human-readable description
  metadata: {
    amount?: number
    date?: string
    category?: string
    priority?: 'critical' | 'high' | 'normal'
    recurring?: boolean
    confidence?: number
    tags?: string[]
  }
  relevanceScore: number // 0-1 dynamic score
  archived: boolean
  createdAt: number
  updatedAt: number
  expiresAt?: number
}

MemoryTypes: -future_expense - // Upcoming costs with dates
  financial_goal - // Revenue/profit targets
  strategic_decision - // Business decisions
  business_context - // Company info
  user_preference - // User settings
  key_date // Important dates
```

#### Relevance Scoring Algorithm

```typescript
calculateRelevance(memory):
  Base score: 0.5

  Time-based modifiers:
    - Future expense <7 days: +0.45
    - Past due expense: 0.95
    - Created <1 day: +0.2
    - Created <7 days: +0.15

  Amount-based modifiers:
    - >$100K: +0.4
    - >$50K: +0.35
    - >$25K: +0.3
    - >$10K: +0.25

  Type-based modifiers:
    - strategic_decision: +0.35
    - financial_goal: +0.3
    - future_expense: +0.25
    - business_context: +0.2

  Priority modifiers:
    - critical: +0.3
    - high: +0.2
    - urgent: +0.25

  Recurring flag: +0.15

  Max score: 1.0
```

### Memory Operations

#### Storage Flow

```typescript
memoryManager.store():
  1. Generate ID: MEM#${uuid}
  2. Calculate relevance score
  3. Set composite keys (PK, SK, GSI)
  4. Add TTL (365 days default)
  5. Conditional put (no overwrites)
```

#### Search Strategy

```typescript
memoryManager.search():
  1. Query by PK (user+org)
  2. Optional SK prefix (type filter)
  3. Apply filters:
     - minRelevance (default 0.5)
     - archived exclusion
     - date range
     - text search in content
  4. Sort by relevance
  5. Limit results (default 50)
```

#### Memory Extraction (memoryExtractor.ts)

```typescript
Natural language patterns:
  - "Remember that..." → Extract and store
  - "I have X employees" → business_context
  - "Expected $X next month" → financial_goal
  - "$X expense on DATE" → future_expense
  - "Plan to sell at X%" → strategic_decision

Auto-extraction thresholds:
  - Expenses > $200
  - Goals > $10,000
  - All specific dates
  - Team size mentions
```

## Financial Data Access Architecture

### UnifiedDataTool Intent Routing

#### Intent Detection System (unifiedDataTool.ts:111-166)

```typescript
Query Classification:
  1. Keyword extraction and scoring
  2. Exact word bonus (+10 points)
  3. Score by match length
  4. Fallback to general analysis

Intent Mappings:
  Formal Reports:
    - "balance sheet" → Balance Sheet API
    - "profit and loss" → P&L Report API
    - "cash flow" → Cash Flow Statement API
    - "executive summary" → Health Score API

  Analyses:
    - "revenue analysis" → Revenue breakdown
    - "expense analysis" → Expense categories
    - "customer analysis" → Top customers
    - "cash position" → Cash flow + runway

  Specialized:
    - "burn rate" → Quarterly P&L ÷ 3
    - "runway" → Cash ÷ Monthly burn
    - "aged receivables" → Aging report
    - "top customers" → Revenue ranking
```

#### API Method Optimization

```typescript
Optimized Methods (lines 146-162):
  provider.customers.getTopCustomersByRevenue(10)
    vs listCustomers() + manual sort

  provider.expenses.getRecentExpenses(30)
    vs listExpenses() + date filter

  provider.invoices.getInvoicesDueThisWeek()
    vs listInvoices() + date calc

  provider.banking.getCashFlowAnalysis(30)
    vs manual transaction aggregation
```

#### Data Priority & Fallbacks

```typescript
Cash Balance Priority:
  1. Cash Flow Report (most accurate)
  2. Balance Sheet (as-of date)
  3. Bank Account sum (real-time)

Burn Rate Calculation:
  1. Quarterly P&L ÷ 3 (consistent)
  2. Monthly average (if available)
  3. Total expenses ÷ months

Date Range Strategy:
  - P&L: Complete months only
  - Balance Sheet: Current date
  - Cash Flow: 30-day default
```

### Report Generation Flow

#### P&L Report (profit-loss/route.ts)

```typescript
Data Assembly:
  1. Parallel fetch (3 concurrent):
     - Organization info
     - Current period P&L
     - Previous period P&L

  2. Sequential monthly trend:
     - Batch process (2 months/batch)
     - 750ms delay between batches
     - Rate limit handling

  3. Validation & calculation:
     - COGS + Operating + Other = Total
     - Revenue growth comparison
     - Margin calculations
     - EBITDA extraction

  4. Cache strategy:
     - 5-minute TTL
     - Key: date_range + details flag
     - Compression enabled
```

#### Balance Sheet (balance-sheet/route.ts)

```typescript
Structure:
  Assets:
    - Current (cash, AR, inventory)
    - Non-current (fixed, intangible)

  Liabilities:
    - Current (AP, short-term debt)
    - Non-current (long-term debt)

  Equity:
    - Owner's equity
    - Retained earnings

  Ratios:
    - Current ratio
    - Quick ratio
    - Debt-to-equity
    - Asset turnover
    - ROE
```

#### Cash Flow Statement (cash-flow/route.ts)

```typescript
Three-section format:
  Operating Activities:
    - Net income base
    - AR/AP adjustments
    - Non-cash items

  Investing Activities:
    - Asset purchases/sales
    - Investment changes

  Financing Activities:
    - Debt changes
    - Equity transactions

  Metrics:
    - OCF ratio
    - Free cash flow
    - Burn rate
    - Runway months
```

## Agent Tools vs Reports Pages Comparison

### Data Access Comparison

| Aspect             | Agent (UnifiedDataTool)       | Reports Pages              |
| ------------------ | ----------------------------- | -------------------------- |
| **Architecture**   | Intent-based routing with NLP | Direct API calls via hooks |
| **Caching**        | ReportCache (5 min TTL)       | 5-15 min SWR cache         |
| **Date Range**     | 'this_year' default (aligned) | 'this_year' default        |
| **Calculation**    | COGS + Operating + Other      | COGS + Operating + Other   |
| **Optimization**   | Specialized API methods       | Batch parallel fetching    |
| **Error Handling** | QuickBooks focused            | User-friendly messages     |
| **Data Priority**  | Report → Calculated → Raw     | Direct report APIs         |
| **Context**        | Memory + Chat history         | URL parameters only        |

### Capability Matrix

#### Financial Reports

| Report Type       | Agent Support      | UI Support            | Data Source       |
| ----------------- | ------------------ | --------------------- | ----------------- |
| Balance Sheet     | ✅ Full with hints | ✅ Interactive view   | Same API          |
| P&L Statement     | ✅ Full with hints | ✅ Detailed breakdown | Same API          |
| Cash Flow         | ✅ Full with hints | ✅ Waterfall chart    | Same API          |
| Executive Summary | ✅ Health score    | ✅ Dashboard          | Same calculations |

#### Analytical Capabilities

| Feature           | Agent              | Reports UI             | Notes                     |
| ----------------- | ------------------ | ---------------------- | ------------------------- |
| Trend Analysis    | ✅ 6-month default | ✅ Configurable        | Agent uses fixed windows  |
| Customer Analysis | ✅ Top 10          | ✅ Full list + sorting | Agent optimized for speed |
| Expense Breakdown | ✅ Categories      | ✅ Detailed + vendors  | UI has more granularity   |
| Revenue Analysis  | ✅ By source       | ✅ By product/customer | Different dimensions      |
| Burn Rate         | ✅ Quarterly ÷ 3   | ✅ Same formula        | Consistent calculation    |
| Runway            | ✅ Cash/burn       | ✅ Same + scenarios    | UI adds projections       |

#### Unique Agent Capabilities

1. **Natural Language Understanding**: Intent detection from queries
2. **Memory Context**: Persistent business context across sessions
3. **Multi-dimensional Analysis**: Combines multiple data sources
4. **Narrative Generation**: Explains data with insights
5. **Proactive Suggestions**: Based on patterns and history
6. **Educational Content**: Learn term detection and display

#### Unique UI Capabilities

1. **Interactive Filtering**: Date ranges, categories, statuses
2. **Drill-down Navigation**: Click through to details
3. **Export Functions**: PDF, CSV, Excel formats
4. **Real-time Updates**: Live data refresh
5. **Bulk Operations**: Multi-select actions
6. **Visual Customization**: Chart types, colors, layouts

### Data Consistency Patterns

#### Shared Calculations

```typescript
// Both systems use identical formulas:
Burn Rate = Total Expenses / Months in Period
Runway = Cash Balance / Monthly Burn Rate
Gross Margin = (Revenue - COGS) / Revenue
Current Ratio = Current Assets / Current Liabilities
```

#### Shared Data Structures

```typescript
// KPI Format
{
  value: number
  label: string
  trend?: number
  format: "currency" | "percentage" | "number"
}

// Breakdown Format
{
  name: string
  amount: number
  percentage: number
  category?: string
}

// Trend Format
{
  month: string
  revenue: number
  expenses: number
  netIncome: number
}
```

## Current State Assessment

### System Strengths

1. **Architecture**
   - Clean separation of concerns
   - Parallel processing optimization
   - Comprehensive error handling
   - Rate limiting protection

2. **Data Access**
   - Consistent calculations across agent/UI
   - Smart fallback chains
   - Optimized API usage
   - Report-first strategy

3. **Context Management**
   - Model-aware optimization
   - Intelligent summarization
   - Persistent memory system
   - Relevance-based retrieval

4. **User Experience**
   - Streaming responses
   - Status updates
   - Auto-visualization
   - Natural language interface

### Current Limitations

1. **Performance**
   - No agent-side caching (always real-time)
   - Sequential monthly trends (rate limit risk)
   - Memory search not indexed

2. **Data Scope**
   - Agent limited to top 10 customers
   - Fixed 6-month trends
   - No custom date ranges in NLP

3. **Integration**
   - Chat history separate from memory
   - No cross-session agent state
   - Limited multi-organization support

4. **Scalability**
   - Single DynamoDB table for all memories
   - No memory pagination
   - Fixed rate limits

### Technical Debt Areas

1. **Code Duplication**
   - Report calculations in multiple places
   - Similar data fetching patterns
   - Repeated validation logic

2. **Type Safety**
   - Many `any` types in providers
   - Inconsistent error types
   - Missing interface definitions

3. **Testing Coverage**
   - No unit tests for agents
   - Limited integration tests
   - No load testing

4. **Documentation**
   - Missing API documentation
   - No agent behavior specs
   - Limited inline comments

### Infrastructure Dependencies

#### AWS Services

- **DynamoDB**: Chat history + Memory storage
- **Region**: us-east-1 (hardcoded)
- **Tables**:
  - `chat_history` (chat messages)
  - `ai_cfo_memories` (agent memories)

#### External APIs

- **QuickBooks**: Primary financial data (ONLY)
- **Groq**: LLM inference
- **OpenAI**: Fallback LLM
- **Anthropic**: Secondary fallback

#### Configuration Requirements

```env
# Required Environment Variables
CHAT_HISTORY_TABLE=chat_history
MEMORY_TABLE_NAME=ai_cfo_memories
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# LLM Providers
GROQ_API_KEY=xxx
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
```

### Monitoring & Observability

#### Current Logging

- Console logs with prefixes
- Color-coded debug output
- Timing measurements
- Error stack traces

#### Metrics Tracked

- Query response times
- Tool execution counts
- Memory hit rates
- Token usage estimates
- Cache hit/miss ratios

#### Missing Observability

- No centralized logging
- No performance metrics dashboard
- No error alerting
- No usage analytics
- No cost tracking

## Recent Architectural Improvements

### October 2025 Critical Fix

- **Issue Fixed**: Agent was displaying monthly averages as period totals
- **Root Cause**: `calculateKPIsFromReports()` was dividing totals by months but returning as "revenue"/"totalRevenue"
- **Solution**: Method now returns both period totals (for display) and monthly averages (for burn rate)
- **Result**: Agent correctly shows $10,200.77 revenue instead of $4,282.62 (monthly average)

### December 2024 Data Consistency Alignment

- **UnifiedDataTool** now uses exact same date range defaults as Reports Pages (`'this_year'`)
- **Expense calculations** aligned: Total = COGS + Operating Expenses + Other Expenses
- **P&L extraction** returns complete data structure including `other_expenses` field
- **Removed** all Zoho-specific code paths for cleaner QuickBooks-only focus

### Key Technical Changes

1. **Date Range Management**: Uses `getDateRangeForPeriod` utility (same as Reports Pages)
2. **Cache Integration**: Added ReportCache with 5-minute TTL matching UI caching
3. **Monthly Calculations**: Properly divides by actual period months (not hardcoded 3)
4. **Data Structure**: `extractPnLData` returns all required fields for visualizers
5. **Value Separation**: Clear distinction between period totals and monthly averages

## Conclusion

The Midas agentic system represents a sophisticated implementation of multi-agent AI architecture with deep QuickBooks integration. The system successfully balances real-time data access with intelligent context management, providing users with comprehensive financial analysis through natural language interaction. The architecture demonstrates strong separation of concerns, extensive optimization strategies, and thoughtful error handling throughout the stack.

Recent improvements ensure **complete data consistency** between AI agent responses and Reports Pages UI, with identical calculations, date ranges, and data structures. The system's ability to maintain exact consistency between AI-driven insights and traditional UI-based reports ensures data integrity and user trust.

---

_Document Updated: December 2024_
_Analysis Version: 2.0_
_System Version: Production (Midas)_
