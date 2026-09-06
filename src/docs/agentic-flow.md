# Midas Agentic System - Architecture Documentation

> Actual implementation state as of current codebase analysis.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Layer 1: User Input](#layer-1-user-input)
4. [Layer 2: API Processing](#layer-2-api-processing)
5. [Layer 3: AI Agent Execution](#layer-3-ai-agent-execution)
6. [Layer 4: Streaming Response](#layer-4-streaming-response)
7. [Layer 5: UI Rendering](#layer-5-ui-rendering)
8. [Data Persistence](#data-persistence)
9. [Tool Inventory](#tool-inventory)
10. [Inactive Code](#inactive-code)
11. [File Reference](#file-reference)

---

## Overview

The Midas agentic system is a **single-agent** financial AI assistant.

| Feature       | Status                                                   |
| ------------- | -------------------------------------------------------- |
| Architecture  | **Single CFO Agent** (multi-agent orchestrator disabled) |
| Active Tools  | **11 tools**                                             |
| Streaming     | Real-time via Server-Sent Events (SSE)                   |
| Memory        | Intent-aware memory system                               |
| LLM Providers | Groq, OpenAI, Anthropic, Google                          |

---

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER INPUT LAYER                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ User Types   │───▶│ ChatPanel    │───▶│ useChat.send │                  │
│  │ Message      │    │ .tsx         │    │              │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────┼───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ POST         │───▶│ withActive   │───▶│ Rate Limit   │                  │
│  │ /api/chat    │    │ Provider     │    │ Check        │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
│                                                  │                          │
│                                          ┌──────┴──────┐                   │
│                                          ▼             ▼                   │
│                                    ┌─────────┐   ┌─────────┐               │
│                                    │ 429     │   │ handle  │               │
│                                    │ Error   │   │ Agent   │               │
│                                    └─────────┘   │ Response│               │
│                                                  └────┬────┘               │
└───────────────────────────────────────────────────────┼─────────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI AGENT LAYER                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ create       │───▶│ Memory       │───▶│ LangChain    │                  │
│  │ CFOAgent     │    │ Search       │    │ Agent        │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
│                                                  │                          │
│                                          ┌──────┴──────┐                   │
│                                          ▼             │                   │
│                                    ┌─────────┐         │                   │
│                                    │ Tool    │─────────┘                   │
│                                    │ Execute │  (loop)                     │
│                                    └────┬────┘                             │
│                                         │                                  │
│                                         ▼                                  │
│                                    ┌─────────┐                             │
│                                    │ Generate│                             │
│                                    │ Response│                             │
│                                    └────┬────┘                             │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STREAMING LAYER                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ SSE          │───▶│ Chunk        │───▶│ Token        │                  │
│  │ Stream       │    │ Response     │    │ Tracking     │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
└─────────────────────────────────────────────────┼───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UI RENDERING LAYER                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │ useChat      │───▶│ ChatContext  │───▶│ ChatMessage  │───▶ User Sees   │
│  │ Hook         │    │              │    │              │     Response     │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Architecture (Single Agent)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ✅ ACTIVE COMPONENTS                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐  │   │
│  │   │ User Query  │────────▶│  CFO Agent  │────────▶│  Response   │  │   │
│  │   └─────────────┘         └──────┬──────┘         └─────────────┘  │   │
│  │                                  │                                  │   │
│  │                                  ▼                                  │   │
│  │                           ┌─────────────┐                          │   │
│  │                           │  11 Tools   │                          │   │
│  │                           └─────────────┘                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      ❌ DISABLED COMPONENTS                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │   ┌─────────────────────┐    ┌─────────────────────┐               │   │
│  │   │ MultiAgentOrchest-  │    │ MultiAgentReport    │               │   │
│  │   │ rator               │    │ Tool (COMMENTED)    │               │   │
│  │   │ (EXISTS BUT NOT     │    │                     │               │   │
│  │   │  INVOKED)           │    └─────────────────────┘               │   │
│  │   └─────────────────────┘                                          │   │
│  │                                                                     │   │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │   │
│  │   │ Report      │ │ Data        │ │ Visualizer  │ │ Project     │ │   │
│  │   │ Generator   │ │ Analyst     │ │ Agent       │ │ Manager     │ │   │
│  │   │ Agent       │ │ Agent       │ │             │ │ Agent       │ │   │
│  │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: User Input

### Component Flow

```
    ┌──────────┐
    │   User   │
    └────┬─────┘
         │ Types message
         ▼
    ┌──────────────────┐
    │   ChatPanel.tsx  │
    │                  │
    │  ┌────────────┐  │
    │  │  <input>   │  │
    │  └─────┬──────┘  │
    │        │         │
    │        ▼         │
    │  ┌────────────┐  │
    │  │sendMessage │  │
    │  │    ()      │  │
    │  └─────┬──────┘  │
    └────────┼─────────┘
             │
             ▼
    ┌──────────────────┐
    │   useChat.ts     │
    │                  │
    │  ┌────────────┐  │
    │  │  send()    │  │
    │  └─────┬──────┘  │
    │        │         │
    │        ▼         │
    │  • Create user   │
    │    message (UUID)│
    │  • Create temp   │
    │    assistant msg │
    │  • POST request  │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │  POST /api/chat  │
    └──────────────────┘
```

### Key Files

| File              | Location                          | Lines | Purpose                       |
| ----------------- | --------------------------------- | ----- | ----------------------------- |
| `ChatPanel.tsx`   | `src/app/(main)/components/chat/` | 808   | Main chat UI container        |
| `useChat.ts`      | `src/hooks/`                      | 882   | Chat logic & state management |
| `ChatContext.tsx` | `src/contexts/`                   | 206   | Global chat state context     |

### Code References

**Input Field** — `ChatPanel.tsx:762-776`

```typescript
<input
  ref={inputRef}
  type="text"
  value={inputValue}
  onChange={(e) => setInputValue(e.target.value)}
  onKeyPress={handleKeyPress}
  placeholder="Ask about your finances…"
  disabled={loading}
/>
```

**Send Handler** — `ChatPanel.tsx:484-503`

```typescript
const sendMessage = async () => {
  if (!inputValue.trim() || loading) return
  const userInput = inputValue.trim()
  setInputValue('')
  send(userInput, { useAgent: true })
  scrollToBottom(true)
}
```

---

## Layer 2: API Processing

### Request Flow

```
                    ┌─────────────────┐
                    │ POST /api/chat  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ withActive      │
                    │ Provider        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Authenticated?  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │ NO           │              │ YES
              ▼              │              ▼
     ┌─────────────┐         │     ┌─────────────────┐
     │ 401         │         │     │ Detect Provider │
     │ Unauthorized│         │     │ (QB/Zoho/Xero)  │
     └─────────────┘         │     └────────┬────────┘
                             │              │
                             │              ▼
                             │     ┌─────────────────┐
                             │     │ Rate Limited?   │
                             │     └────────┬────────┘
                             │              │
                             │   ┌──────────┼──────────┐
                             │   │ YES      │          │ NO
                             │   ▼          │          ▼
                             │ ┌─────────┐  │  ┌─────────────┐
                             │ │ 429     │  │  │ useAgent?   │
                             │ │ Error   │  │  └──────┬──────┘
                             │ └─────────┘  │         │
                             │              │  ┌──────┴──────┐
                             │              │  │ true  │false│
                             │              │  ▼       ▼     │
                             │              │ ┌─────┐ ┌─────┐│
                             │              │ │Agent│ │Simple│
                             │              │ │Resp │ │Resp ││
                             │              │ └──┬──┘ └──┬──┘│
                             │              │    └───┬───┘   │
                             │              │        ▼       │
                             │              │  ┌───────────┐ │
                             │              │  │SSE Stream │ │
                             │              │  └───────────┘ │
                             │              │                │
```

### Main Entry Point

**File:** `src/app/api/chat/route.ts` (1351 lines)

### Rate Limiting Configuration

| Parameter           | Value         |
| ------------------- | ------------- |
| Requests per window | 15            |
| Window duration     | 60 seconds    |
| Storage             | In-memory Map |

**Code** — `route.ts:27-29`

```typescript
const userRequestBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 15
const RATE_WINDOW = 60 * 1000
```

### handleAgentResponse Flow

```
    START
      │
      ▼
┌─────────────────────┐
│ Start Token         │
│ Tracking Session    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Get Financial Data  │
│ (KPIs, currency)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Create LLM Instance │
│ (Groq/OpenAI/etc)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ createCFOAgent()    │
│ - 11 tools          │
│ - system prompt     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Fetch Chat History  │
│ (last N messages)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Analyze User Intent │
└──────────┬──────────┘
           │
           ▼
    ┌──────────────┐
    │ Confidence   │
    │   > 0.5?     │
    └──────┬───────┘
           │
    ┌──────┴──────┐
    │ YES         │ NO
    ▼             ▼
┌─────────┐  ┌─────────┐
│ Intent- │  │Standard │
│ Aware   │  │ Memory  │
│ Memory  │  │ Search  │
│ Search  │  │         │
└────┬────┘  └────┬────┘
     └──────┬─────┘
            │
            ▼
┌─────────────────────┐
│ Build Context       │
│ (memories + history)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Execute Agent       │◀──┐
│ agent.call()        │   │
└──────────┬──────────┘   │
           │              │
           ▼              │
┌─────────────────────┐   │
│ Tool Execution      │───┘
│ (up to 15 iters)    │ loop
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Process Viz Hints   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Stream Response     │
│ (15 chars/20ms)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Save to DynamoDB    │
└──────────┬──────────┘
           │
           ▼
        END
```

---

## Layer 3: AI Agent Execution

### CFO Agent Creation

**File:** `src/lib/ai/agent/cfoAgent.ts` (467 lines)

### Architecture Decision

> **⚠️ Single-Agent Approach**
>
> The CFO agent handles all queries directly **without** delegating to a multi-agent orchestrator.
>
> **Reasons:**
>
> 1. **Quality** — Comprehensive system prompt provides better responses (vs 85% context loss in orchestrator)
> 2. **Performance** — 2-3X faster, 30-50% fewer tokens
> 3. **Simplicity** — All tools accessible in one agent

**Source** — `cfoAgent.ts:363-382`

### Tool Stack

```
                         ┌─────────────────┐
                         │    CFO Agent    │
                         └────────┬────────┘
                                  │
        ┌─────────┬───────┬───────┼───────┬─────────┬─────────┐
        │         │       │       │       │         │         │
        ▼         ▼       ▼       ▼       ▼         ▼         ▼
   ┌─────────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐ ┌─────┐
   │  DATA   │ │ VIZ │ │ VIZ │ │CALC │ │CALC │ │ MEMORY  │ │ MEM │
   │         │ │  1  │ │  2  │ │  1  │ │  2  │ │ SEARCH  │ │ MGT │
   └─────────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────────┘ └─────┘
   unified_    render_  create_  finan-  calc-   memory_    manage_
   data        compo-   custom_  cial_   ulate_  search     memory
               nent     visual-  calc-   date
                        ization  ulator
        │         │       │       │       │         │         │
        └─────────┴───────┴───────┼───────┴─────────┴─────────┘
                                  │
        ┌─────────┬───────┬───────┴───────┐
        │         │       │               │
        ▼         ▼       ▼               ▼
   ┌─────────┐ ┌─────┐ ┌─────────┐ ┌───────────┐
   │CRITICAL │ │PRED │ │ LEARN   │ │ MARKDOWN  │
   │ANALYSIS │ │ANLY │ │ TERMS   │ │ FORMATTER │
   └─────────┘ └─────┘ └─────────┘ └───────────┘
   critical_   predic-  detect_     format_
   analysis    tive_    learn_      markdown
               analy-   terms
               tics

   ════════════════════════════════════════════════════════
                      11 TOOLS TOTAL
   ════════════════════════════════════════════════════════
```

### Agent Configuration

**Code** — `cfoAgent.ts:443-455`

```typescript
const agent = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: 'chat-conversational-react-description',
  verbose: false,
  maxIterations: 15,
  returnIntermediateSteps: true,
  earlyStoppingMethod: 'generate',
  handleParsingErrors: handleAgentParsingErrors,
  agentArgs: { systemMessage },
})
```

### System Prompt Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM PROMPT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   PERSONALITY   │  │    CONTEXT      │  │     TOOLS       │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • Strategic     │  │ • Current Date  │  │ • unified_data  │             │
│  │   Thinker       │  │ • Company Info  │  │ • render_comp   │             │
│  │ • Proactive     │  │ • User Role     │  │ • calculator    │             │
│  │   Insights      │  │ • Expertise     │  │ • memory_*      │             │
│  │ • Direct        │  │   Level         │  │ • etc...        │             │
│  │   Communication │  │ • Revenue Model │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   GUIDELINES    │  │    MEMORY       │  │  PLAN AWARE     │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • Specificity   │  │ • When to       │  │ • QuickBooks    │             │
│  │   Requirements  │  │   CREATE        │  │   Plan features │             │
│  │ • Markdown      │  │ • When to USE   │  │ • Feature       │             │
│  │   Formatting    │  │ • Memory Types  │  │   availability  │             │
│  │ • Date Aware    │  │ • ID References │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 4: Streaming Response

### SSE Event Flow

```
    SERVER                                              CLIENT
      │                                                    │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"start","messageId":"..."}   │──▶│
      │  └────────────────────────────────────────────┘   │
      │                                                    │
      │         ┌──── Every 2 seconds ────┐               │
      │         │                         │               │
      │         ▼                         │               │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"status","message":"..."}    │──▶│
      │  └────────────────────────────────────────────┘   │
      │         │                         │               │
      │         └─────────────────────────┘               │
      │                                                    │
      │         ┌──── Agent Executes ─────┐               │
      │         │                         │               │
      │         ▼                         │               │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"chunk","content":"..."}     │──▶│  (15 chars)
      │  └────────────────────────────────────────────┘   │
      │         │         20ms delay      │               │
      │         ▼                         │               │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"chunk","content":"..."}     │──▶│  (15 chars)
      │  └────────────────────────────────────────────┘   │
      │         │                         │               │
      │         └─────────────────────────┘  (loop)       │
      │                                                    │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"usage","tokens":...}        │──▶│
      │  └────────────────────────────────────────────┘   │
      │                                                    │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: {"type":"response","components":[]}  │──▶│
      │  └────────────────────────────────────────────┘   │
      │                                                    │
      │  ┌────────────────────────────────────────────┐   │
      │  │ data: [DONE]                               │──▶│
      │  └────────────────────────────────────────────┘   │
      │                                                    │
```

### SSE Event Types

| Event            | Purpose                   | Code Location        |
| ---------------- | ------------------------- | -------------------- |
| `start`          | Initial message with UUID | `route.ts:276-284`   |
| `status`         | Processing status updates | `route.ts:439-446`   |
| `chunk`          | Response text (15 chars)  | `route.ts:966-973`   |
| `usage`          | Token usage information   | `route.ts:778-793`   |
| `components`     | Visualization data        | `route.ts:996-1008`  |
| `memory_created` | Memory creation events    | `route.ts:826-851`   |
| `response`       | Final response + metadata | `route.ts:996-1008`  |
| `error`          | Error messages            | `route.ts:1122-1129` |
| `[DONE]`         | Stream completion         | `route.ts:327`       |

### Chunk Streaming Configuration

| Parameter         | Value         |
| ----------------- | ------------- |
| Chunk size        | 15 characters |
| Base delay        | 20ms          |
| Punctuation delay | 30ms (1.5x)   |

**Code** — `route.ts:959-982`

```typescript
const chunkSize = 15
const delayMs = 20

for (let i = 0; i < responseText.length; i += chunkSize) {
  const chunk = responseText.slice(i, i + chunkSize)
  await writer.enqueue(
    encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
  )

  const hasPunctuation = /[.!?,;:]/.test(chunk)
  const variableDelay = hasPunctuation ? delayMs * 1.5 : delayMs
  await new Promise((resolve) => setTimeout(resolve, variableDelay))
}
```

---

## Layer 5: UI Rendering

### Event Processing Flow

```
                    ┌─────────────────┐
                    │   SSE Event     │
                    │   Received      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Event Type?   │
                    └────────┬────────┘
                             │
     ┌───────┬───────┬───────┼───────┬───────┬───────┬───────┐
     │       │       │       │       │       │       │       │
     ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼
  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
  │start│ │stat-│ │usage│ │chunk│ │comp-│ │mem- │ │resp-│ │error│
  │     │ │us   │ │     │ │     │ │onen-│ │ory  │ │onse │ │     │
  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ │ts   │ └──┬──┘ └──┬──┘ └──┬──┘
     │       │       │       │    └──┬──┘    │       │       │
     ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼
  Set     Update  Track   Append   Add to  Track  Final-  Set
  Msg ID  Status  Tokens  Content  Context Memory  ize    Error
                             │       │               │
                             ▼       ▼               ▼
                          ┌─────┐ ┌─────┐      ┌─────────┐
                          │Batch│ │Update│      │Save to  │
                          │Upd- │ │rend- │      │Messages │
                          │ates │ │ered- │      │Array    │
                          └──┬──┘ │Compo-│      └─────────┘
                             │    │nents │
                             ▼    └──────┘
                          ┌─────────────┐
                          │Render       │
                          │ChatMessage  │
                          └─────────────┘
```

### ChatContext State

```typescript
interface ChatContextState {
  selectedMessageId: string | null
  renderedComponents: Map<string, React.ReactNode[]>
  reportData: Map<string, ReportMetadata>
  messageContent: Map<string, string>
  isProcessingNewMessage: boolean
  aiProcessingStatus: string
  autoNavigateToChat: boolean
}
```

### Key Files

| File              | Location                          | Lines | Purpose                        |
| ----------------- | --------------------------------- | ----- | ------------------------------ |
| `useChat.ts`      | `src/hooks/`                      | 882   | SSE processing (lines 290-808) |
| `ChatContext.tsx` | `src/contexts/`                   | 206   | State management               |
| `ChatMessage.tsx` | `src/app/(main)/components/chat/` | 250   | Message rendering              |
| `chatHistory.ts`  | `src/lib/`                        | 182   | DynamoDB persistence           |

---

## Data Persistence

### Database Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DynamoDB                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐         │
│    │    USER     │         │    USER     │         │    USER     │         │
│    └──────┬──────┘         └──────┬──────┘         └──────┬──────┘         │
│           │                       │                       │                 │
│           │ sends                 │ stores                │ tracks          │
│           │                       │                       │                 │
│           ▼                       ▼                       ▼                 │
│    ┌─────────────┐         ┌─────────────┐         ┌─────────────┐         │
│    │  MESSAGE    │         │   MEMORY    │         │ TOKEN_USAGE │         │
│    ├─────────────┤         ├─────────────┤         ├─────────────┤         │
│    │ id (PK)     │         │ id (PK)     │         │ userId (PK) │         │
│    │ userId (FK) │         │ userId (FK) │         │ ts (SK)     │         │
│    │ role        │         │ type        │         │ inputTokens │         │
│    │ content     │         │ content     │         │ outputTokens│         │
│    │ ts          │         │ relevance   │         │ totalTokens │         │
│    │ memories    │         │ archived    │         │ model       │         │
│    │ hasReport   │         │ createdAt   │         │ provider    │         │
│    │ learnTerms  │         │ expiresAt   │         │             │         │
│    │ tokenUsage  │         │             │         │             │         │
│    └─────────────┘         └─────────────┘         └─────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### DynamoDB Tables

| Table                | Purpose         | Partition Key | Sort Key    |
| -------------------- | --------------- | ------------- | ----------- |
| `CHAT_HISTORY_TABLE` | Message storage | `userId`      | `timestamp` |
| `MEMORY_TABLE_NAME`  | Memory objects  | `userId`      | `memoryId`  |
| `TOKEN_USAGE_TABLE`  | Token tracking  | `userId`      | `timestamp` |

### Message Schema

```typescript
interface StoredMessage {
  id: string // UUID
  role: 'user' | 'assistant' // Message author
  content: string // Full message content
  ts: number // Epoch milliseconds
  memories?: Array<{
    id: string
    type: string
    content: string
  }>
  hasReport?: boolean
  learnTerms?: Array<{
    termId: string
    matchedPhrase: string
    confidence: number
    reason: string
  }>
  tokenUsage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    model: string
    provider: string
  }
}
```

---

## Tool Inventory

### Active Tools (11)

| #   | Tool Name                     | File                           | Purpose                                             |
| --- | ----------------------------- | ------------------------------ | --------------------------------------------------- |
| 1   | `unified_data`                | `cachedUnifiedDataTool.ts`     | Financial data + reports (P&L, Balance Sheet, etc.) |
| 2   | `render_component`            | `componentRenderTool.ts`       | Render predefined charts/dashboards                 |
| 3   | `create_custom_visualization` | `flexibleVisualizationTool.ts` | Dynamic component creation                          |
| 4   | `financial_calculator`        | `calculatorTool.ts`            | Burn rate, runway, break-even calculations          |
| 5   | `calculate_date`              | `dateCalculatorTool.ts`        | Date operations and formatting                      |
| 6   | `memory_search`               | `memorySearchTool.ts`          | Search stored memories                              |
| 7   | `manage_memory`               | `memoryManagementTool.ts`      | Store/update/delete memories                        |
| 8   | `critical_analysis`           | `criticalAnalysisTool.ts`      | Deep financial analysis                             |
| 9   | `predictive_analytics`        | `predictiveAnalyticsTool.ts`   | Forecasting, anomaly detection                      |
| 10  | `detect_learn_terms`          | `learnTermDetector.ts`         | Educational content detection                       |
| 11  | `format_markdown`             | `markdownFormatterTool.ts`     | Format output as rich markdown                      |

### Tool Categories

```
    ┌─────────────────────────────────────────────────────────────┐
    │                    TOOL DISTRIBUTION                        │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  Data Access      ████░░░░░░░░░░░░░░░░░░░░░░░░░░  1 (9%)   │
    │  Visualization    ████████░░░░░░░░░░░░░░░░░░░░░░  2 (18%)  │
    │  Calculations     ████████░░░░░░░░░░░░░░░░░░░░░░  2 (18%)  │
    │  Memory           ████████░░░░░░░░░░░░░░░░░░░░░░  2 (18%)  │
    │  Analysis         ████████░░░░░░░░░░░░░░░░░░░░░░  2 (18%)  │
    │  Other            ████████░░░░░░░░░░░░░░░░░░░░░░  2 (18%)  │
    │                                                             │
    │                                           TOTAL: 11 tools   │
    └─────────────────────────────────────────────────────────────┘
```

### Rate Limits

| Resource         | Limit | Window      |
| ---------------- | ----- | ----------- |
| Chat requests    | 15    | 60 seconds  |
| Data tool calls  | 50    | 60 seconds  |
| Agent iterations | 15    | Per request |

---

## Inactive Code

### Multi-Agent Orchestrator Status

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ╔═══════════════════════════════════════════════════════════════════╗    │
│   ║                     ✅ ACTIVE CODE                                ║    │
│   ╠═══════════════════════════════════════════════════════════════════╣    │
│   ║                                                                   ║    │
│   ║    ┌─────────────┐              ┌─────────────┐                  ║    │
│   ║    │  CFO Agent  │─────────────▶│  11 Tools   │                  ║    │
│   ║    └─────────────┘              └─────────────┘                  ║    │
│   ║                                                                   ║    │
│   ╚═══════════════════════════════════════════════════════════════════╝    │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                     ❌ INACTIVE CODE                              │    │
│   ├───────────────────────────────────────────────────────────────────┤    │
│   │                                                                   │    │
│   │    ┌─────────────────────────┐                                   │    │
│   │    │ MultiAgentOrchestrator  │ ◀── EXISTS BUT NOT INVOKED       │    │
│   │    └─────────────────────────┘                                   │    │
│   │                                                                   │    │
│   │    ┌─────────────────────────┐                                   │    │
│   │    │ MultiAgentReportTool    │ ◀── COMMENTED OUT                │    │
│   │    └─────────────────────────┘                                   │    │
│   │                                                                   │    │
│   │    ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐      │    │
│   │    │ Report    │ │ Data      │ │ Visualizer│ │ Project   │      │    │
│   │    │ Generator │ │ Analyst   │ │ Agent     │ │ Manager   │      │    │
│   │    │ Agent     │ │ Agent     │ │           │ │ Agent     │      │    │
│   │    └───────────┘ └───────────┘ └───────────┘ └───────────┘      │    │
│   │                                                                   │    │
│   │    ┌───────────┐                                                 │    │
│   │    │ Tax       │                                                 │    │
│   │    │ Planning  │                                                 │    │
│   │    │ Agent     │                                                 │    │
│   │    └───────────┘                                                 │    │
│   │                                                                   │    │
│   └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Orchestrator is Disabled

**File:** `src/lib/ai/agent/multiAgentOrchestrator.ts` (607 lines)

| Reason       | Details                                               |
| ------------ | ----------------------------------------------------- |
| Context Loss | 85% context loss through 7-layer delegation           |
| Performance  | Single agent is 2-3X faster                           |
| Token Usage  | Single agent uses 30-50% fewer tokens                 |
| Quality      | Comprehensive system prompt provides better responses |

**Code Reference** — `cfoAgent.ts:395-396`

```typescript
// MultiAgentReportTool disabled - see architecture note above
// new MultiAgentReportTool(multiAgentOrchestrator),
```

### Unused Tool Files

| File                      | Status           | Reason                                   |
| ------------------------- | ---------------- | ---------------------------------------- |
| `forecastingTool.ts`      | ❌ Not imported  | Never added to tool array                |
| `expenseCategorizer.ts`   | ❌ Not imported  | Never added to tool array                |
| `multiAgentReportTool.ts` | ❌ Commented out | Disabled per architecture decision       |
| `unifiedDataTool.ts`      | ⚠️ Replaced      | Superseded by `cachedUnifiedDataTool.ts` |

### Unused Agent Files

| File                      | Status         |
| ------------------------- | -------------- |
| `reportGeneratorAgent.ts` | ❌ Not invoked |
| `dataAnalystAgent.ts`     | ❌ Not invoked |
| `visualizerAgent.ts`      | ❌ Not invoked |
| `projectManagerAgent.ts`  | ❌ Not invoked |
| `taxPlanningAgent.ts`     | ❌ Not invoked |

---

## LLM Provider Configuration

### Supported Providers

```
                        ┌─────────────────┐
                        │   LLM Factory   │
                        └────────┬────────┘
                                 │
         ┌───────────┬───────────┼───────────┬───────────┐
         │           │           │           │           │
         ▼           ▼           ▼           ▼           │
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
    │  Groq   │ │ OpenAI  │ │Anthropic│ │ Google  │     │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘     │
         │           │           │           │           │
         ▼           ▼           ▼           ▼           │
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
    │llama-4- │ │ gpt-5   │ │claude-  │ │gemini-  │     │
    │maverick │ │ gpt-5-  │ │sonnet-  │ │2.5-flash│     │
    │-17b     │ │ mini    │ │4-5      │ │         │     │
    │         │ │ gpt-4.1 │ │claude-3 │ │         │     │
    │llama-   │ │         │ │-sonnet  │ │         │     │
    │3.3-70b  │ │         │ │         │ │         │     │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
```

### Environment Variables

```bash
# LLM Configuration
DEFAULT_LLM_PROVIDER=groq|openai|anthropic|google
DEFAULT_LLM_MODEL=<model-name>

# API Keys
GROQ_API_KEY=<key>
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key>
GOOGLE_API_KEY=<key>

# AWS Configuration
AWS_REGION=<region>
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>

# DynamoDB Tables
CHAT_HISTORY_TABLE=<table-name>
MEMORY_TABLE_NAME=<table-name>
TOKEN_USAGE_TABLE=<table-name>
```

---

## File Reference

### Core Files by Layer

| Layer       | File                    | Lines | Purpose                |
| ----------- | ----------------------- | ----- | ---------------------- |
| **UI**      | `ChatPanel.tsx`         | 808   | Chat container & input |
| **UI**      | `ChatMessage.tsx`       | 250   | Message rendering      |
| **State**   | `useChat.ts`            | 882   | Chat logic & streaming |
| **State**   | `ChatContext.tsx`       | 206   | Global state           |
| **API**     | `api/chat/route.ts`     | 1351  | Main endpoint          |
| **API**     | `withActiveProvider.ts` | 191   | Provider middleware    |
| **Agent**   | `cfoAgent.ts`           | 467   | Single CFO agent       |
| **LLM**     | `llm-factory.ts`        | 320   | Provider factory       |
| **Memory**  | `memoryManager.ts`      | 200+  | Memory system          |
| **Persist** | `chatHistory.ts`        | 182   | DynamoDB operations    |

### Tool Files (Active)

| Tool File                      | Tool Name                     |
| ------------------------------ | ----------------------------- |
| `cachedUnifiedDataTool.ts`     | `unified_data`                |
| `componentRenderTool.ts`       | `render_component`            |
| `flexibleVisualizationTool.ts` | `create_custom_visualization` |
| `calculatorTool.ts`            | `financial_calculator`        |
| `dateCalculatorTool.ts`        | `calculate_date`              |
| `memorySearchTool.ts`          | `memory_search`               |
| `memoryManagementTool.ts`      | `manage_memory`               |
| `criticalAnalysisTool.ts`      | `critical_analysis`           |
| `predictiveAnalyticsTool.ts`   | `predictive_analytics`        |
| `learnTermDetector.ts`         | `detect_learn_terms`          |
| `markdownFormatterTool.ts`     | `format_markdown`             |

---

## Quick Reference

### Complete Message Flow

```
┌──────┐    ┌──────────┐    ┌────────┐    ┌─────┐    ┌────────┐
│ User │───▶│ChatPanel │───▶│useChat │───▶│ API │───▶│Provider│
└──────┘    └──────────┘    └────────┘    └─────┘    └───┬────┘
                                                         │
┌──────────────────────────────────────────────────────┐ │
│                                                      │ │
│  ┌──────────┐    ┌────────┐    ┌───────┐           │ │
│  │Rate Limit│◀───│        │◀───│       │◀──────────┼─┘
│  └────┬─────┘    │        │    │       │           │
│       │          │  CFO   │    │Memory │           │
│       ▼          │ Agent  │◀──▶│       │           │
│  ┌──────────┐    │        │    │       │           │
│  │          │───▶│        │───▶│       │           │
│  │  Tools   │◀───│        │    └───────┘           │
│  │          │    └────────┘                        │
│  └──────────┘         │                            │
│                       ▼                            │
│                 ┌──────────┐                       │
│                 │   SSE    │                       │
│                 │  Stream  │                       │
│                 └────┬─────┘                       │
│                      │                             │
└──────────────────────┼─────────────────────────────┘
                       │
                       ▼
┌──────┐    ┌──────────┐    ┌─────────┐    ┌───────────┐
│ User │◀───│  Message │◀───│ Context │◀───│  useChat  │
└──────┘    └──────────┘    └─────────┘    └───────────┘
```

### Key Architectural Decisions

| Decision          | Value        | Rationale                     |
| ----------------- | ------------ | ----------------------------- |
| Architecture      | Single Agent | Quality + Performance         |
| Active Tools      | 11           | Focused, essential toolset    |
| Max Iterations    | 15           | Prevents runaway loops        |
| Data Rate Limit   | 50/min       | Per-user throttling           |
| Memory Confidence | > 0.5        | Intent-aware search threshold |

---

_Documentation reflects actual codebase state. Multi-agent orchestrator code exists but is not invoked._
