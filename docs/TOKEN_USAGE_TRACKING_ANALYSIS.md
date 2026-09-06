# LLM Token Usage Tracking - Research & Implementation Guide

## 🔍 Current System Analysis

### Chat Message Storage

Your application currently uses **DynamoDB** for chat history with this structure:

```typescript
// Current StoredMessage interface (src/lib/chatHistory.ts)
interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  memories?: Array<{ id: string; type: string; content: string }>
  hasReport?: boolean
  learnTerms?: Array<{ termId: string; matchedPhrase: string; confidence: number; reason: string }>
}
```

**Storage Pattern:**

- **Table**: `CHAT_HISTORY_TABLE` (from env)
- **Partition Key**: `userId`
- **Sort Key**: `timestamp` (for chronological ordering)

### LLM Integration Architecture

Your system uses a **multi-provider approach** via LangChain:

```typescript
// Current providers (src/lib/llm-factory.ts)
Groq:      openai/gpt-oss-120b (default), llama-3.1-70b-versatile, mixtral-8x7b-32768
OpenAI:    gpt-5, gpt-5-mini, gpt-5-nano, gpt-4.1
Anthropic: claude-3-opus, claude-3-sonnet, claude-3-haiku
```

### Existing Token Usage Interface

You already have a basic token usage structure in the frontend:

```typescript
// src/hooks/useChat.ts
interface TokenUsage {
  tokens: number
  monthlyUsage: number
  monthlyLimit: number
  remainingTokens?: number
}
```

**Current Gap**: Token usage is calculated in the frontend but **not persisted** to the database.

## 📊 Token Tracking Methods by Provider

### LangChain Standardized Approach

All providers return token usage through LangChain's unified interface:

```typescript
// Standard across all providers
response.usage_metadata = {
  input_tokens: number,
  output_tokens: number,
  total_tokens: number,
}
```

### Provider-Specific Formats

| Provider      | Response Format                                               | Notes                                  |
| ------------- | ------------------------------------------------------------- | -------------------------------------- |
| **OpenAI**    | `tokenUsage: { completionTokens, promptTokens, totalTokens }` | Most detailed, includes finish_reason  |
| **Anthropic** | `usage: { input_tokens, output_tokens }`                      | Clean, simple format                   |
| **Groq**      | Uses LangChain standard                                       | Normalized through LangChain interface |

### Streaming Token Usage

- **OpenAI**: Supports `stream_usage=True` for real-time token counts
- **Others**: Token usage typically returned at end of stream

## 🏗️ Implementation Options

### Option 1: Extend Current Chat Table ⭐ **Recommended**

**Pros:**

- ✅ Simple migration - just add fields to existing `StoredMessage`
- ✅ Maintains current single-table design
- ✅ All message data stays together
- ✅ Minimal code changes required

**Cons:**

- ❌ Less flexible for complex usage analytics
- ❌ Harder to query usage across all messages

**Implementation:**

```typescript
interface StoredMessage {
  // ... existing fields
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    model: string
    provider: 'groq' | 'openai' | 'anthropic'
    estimatedCost?: number
    timestamp: number
  }
}
```

### Option 2: Dedicated Token Usage Table

**Pros:**

- ✅ Optimized for usage analytics and reporting
- ✅ Better performance for usage queries
- ✅ Follows DynamoDB time-series best practices
- ✅ Can easily aggregate usage by user, time period, model

**Cons:**

- ❌ More complex implementation
- ❌ Additional DynamoDB table to manage
- ❌ Need to join data for complete message view

**Schema Design:**

```typescript
// TOKEN_USAGE_TABLE
{
  PK: userId,
  SK: messageId#timestamp,  // Composite sort key
  messageId: string,
  model: string,
  provider: string,
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
  estimatedCost: number,
  timestamp: number,
  // Optional: message metadata for context
  messageType?: 'user' | 'assistant',
  hasComponents?: boolean
}
```

## 🔧 Implementation Steps

### Phase 1: Basic Token Tracking

1. **Extend StoredMessage Interface**
   - Add `tokenUsage` field to interface
   - Update `saveMessage()` function to accept token data

2. **Modify LLM Factory**
   - Extract token usage from LangChain responses
   - Normalize across providers
   - Add cost estimation logic

3. **Update Chat Route** (`src/app/api/chat/route.ts`)
   - Capture token usage from agent responses
   - Include usage in saved message
   - Stream usage data to frontend

### Phase 2: Frontend Integration

1. **Update useChat Hook**
   - Handle token usage in streaming responses
   - Update `TokenUsage` state from message data
   - Add usage display components

2. **Add Usage Analytics**
   - Create usage dashboard/widget
   - Show per-message costs
   - Display daily/monthly usage totals

### Phase 3: Advanced Features (Optional)

1. **Usage Analytics API**
   - Endpoint for usage queries
   - Aggregation by time period, model, user

2. **Cost Optimization**
   - Model recommendation based on usage patterns
   - Budget alerts and limits
   - Usage forecasting

## 💡 Technical Considerations

### DynamoDB Best Practices

- **Partition Key**: Use `userId` for user-scoped queries
- **Sort Key**: Include timestamp for chronological ordering
- **Hot Partition Avoidance**: User-based partitioning should distribute load well
- **Query Patterns**: Design for common access patterns (user history, usage by date)

### Cost Estimation

You'll need to maintain pricing data for each model:

```typescript
const MODEL_PRICING = {
  'gpt-5': { input: 0.01, output: 0.03 }, // per 1K tokens
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'openai/gpt-oss-120b': { input: 0.0006, output: 0.0006 },
  // etc...
}
```

### Error Handling

- Handle cases where token usage isn't available
- Graceful degradation if tracking fails
- Retry logic for DynamoDB writes

## 🚀 Recommended Implementation Path

**Start Simple, Scale Smart:**

1. **Immediate** (1-2 days): Extend current chat table with token usage
2. **Short-term** (1 week): Add frontend usage display
3. **Medium-term** (2-3 weeks): Add usage analytics and cost tracking
4. **Long-term** (if needed): Migrate to dedicated usage table for advanced analytics

This approach lets you start tracking tokens immediately while keeping options open for more sophisticated usage analytics later.

## 📂 Files to Modify

### Core Implementation

- `src/lib/chatHistory.ts` - Update StoredMessage interface and save logic
- `src/lib/llm-factory.ts` - Add token usage extraction
- `src/app/api/chat/route.ts` - Capture and store usage data
- `src/hooks/useChat.ts` - Handle usage in frontend

### Supporting Files

- `src/lib/types.ts` - Add token usage types
- Environment variables - Add pricing configuration
- Database migration script (if using dedicated table)

This research provides a clear foundation for implementing comprehensive token usage tracking while maintaining your existing architecture and patterns.
