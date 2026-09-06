# Midas — AI-Powered Financial Management Platform

## What Midas Is

Midas is an **AI CFO (Chief Financial Officer) platform** that connects to a business's accounting software, pulls in all their financial data, and provides real-time dashboards, AI-powered analysis, and a conversational chat interface for natural-language financial queries. The tagline is "Turn Data Into Gold."

It is a **Next.js 15 web application** (React 19, TypeScript) hosted with a serverless backend. The codebase is called `zenith-os`.

## Who Midas Is For

Small-to-medium businesses, e-commerce companies, professional services firms, PE/multi-entity organizations, and SaaS companies that want institutional-grade financial insights without hiring a full finance team.

## Core Product Capabilities

### 1. Multi-Provider Accounting Integration

Midas connects to multiple accounting/ERP systems via OAuth or credentials:

- **QuickBooks Online** — Primary integration. OAuth 2.0 via Intuit. Supports **multi-entity** (multiple QB companies/realms per organization). Real-time sync via webhooks + CDC (Change Data Capture) polling. Full REST API access to all QB entities.
- **Microsoft Dynamics 365 Business Central** — Username/password auth. Data flows through Fivetran ETL into AWS Redshift, then queried at runtime. Supports **multi-schema** (multiple company datasets per org).
- **Zoho Books** — OAuth integration with direct API calls.
- **Xero** — Listed as supported provider (minimal implementation).
- **Stripe** — Payment data integration.

Users connect providers during onboarding and can add/remove them from settings. Each provider stores credentials in DynamoDB. The system is **provider-agnostic** at the interface level — standardized interfaces (`InvoiceProvider`, `CustomerProvider`, `PaymentProvider`, etc.) abstract away provider-specific differences.

### 2. Financial Dashboards & Reports

The main authenticated experience provides:

- **Dashboard** (`/dashboard`) — Connection hub showing all connected providers, per-entity financial snapshots (revenue, expenses, net income, cash), last sync times, and status.
- **Profit & Loss Statement** — Full P&L with trends, period-over-period comparison, sankey flow visualization.
- **Balance Sheet** — Assets, liabilities, equity with trends and drill-down.
- **Cash Flow Statement** — Operating, investing, financing activities with trends.
- **Summary/KPI View** — Key financial metrics at a glance with financial health scoring.
- **Sales Analytics** — Customer analytics, product/service breakdown, receipt tracking, outstanding payments, top customers by revenue.
- **Expense Management** — Vendor tracking, bill management, expense categorization, spending analysis.
- **Aged Receivables & Payables** — Aging buckets (current, 1-30, 31-60, 61-90, 90+ days), DSO calculations.
- **Journal Entries** — Access to general ledger journal entries.

Routes are prefixed by provider: `/qb/reports/pnl` for QuickBooks P&L, `/bc/pnl` for Business Central P&L. Legacy routes (`/reports`, `/sales`, `/expenses`) redirect to the QB-prefixed versions.

### 3. AI Chat & Analysis (The "AI CFO")

This is the signature feature. A chat panel (dockable on the right side or fullscreen) provides a conversational interface to all financial data.

**Architecture:**

- Built on **LangChain + LangGraph** (stateful multi-agent system)
- LLMs: **Groq** and **OpenAI** (configurable)
- **Router system** with tiered matching: exact patterns → keyword matching → intent detection → fallback
- **Query intents**: analysis, comparison, breakdown, forecasting, general
- **Circuit breaker** pattern for fault tolerance
- **Prompt injection prevention** and input sanitization

**AI Tools (14+):**

- **QuickBooks Data Tool** — Queries reports (P&L, Balance Sheet, Cash Flow, Aged AR/AP), entities (customers, vendors, invoices, bills, accounts), metrics (100+ financial metrics like revenue, margins, ratios, cash metrics), comparisons (period-over-period, trend analysis), and natural language search across all QB data.
- **Business Central Data Tool** — Same capabilities for Dynamics BC, builds dynamic Redshift SQL queries based on schema.
- **Memory Tool** — Persistent memory storage (remember, search, update, forget). Types: expense, income, goal, deadline, context, preference, decision. Stored in DynamoDB (`ai_cfo_memories` table), scoped per company/realm.
- **Suggest Actions Tool** — Generates follow-up suggestions (drill_down, compare, clarify) as clickable buttons.
- **UI Action Tool** — Navigates pages, opens/closes panels, toggles theme from chat.
- **Visualization Tool** — Generates charts rendered inline in chat via `[[WIDGET:N]]` markers.
- **Web Search Tool** — External information lookup for market/industry context.
- **Stock Price Tool** — Financial market data enrichment.
- **Calculator Tool** — Numeric computations.
- **Dates Tool** — Date manipulation and period calculations.

**AI-generated page analysis** — Each financial report page (`/qb/reports/pnl`, `/qb/reports/balance-sheet`, `/qb/reports/cash-flow`) has an API endpoint (`/api/analysis/[pageType]`) that generates AI commentary on the data.

### 4. Financial Forecasting

Located at `/forecasting` — projects future cash position based on historical patterns. Includes burn rate analysis, runway calculations, and scenario modeling.

### 5. Multi-Entity / Multi-Schema Support

A key differentiator. Organizations can connect **multiple companies** under one account:

- **QuickBooks**: Multiple realms (company IDs) stored in `providers.quickbooks.connections[realmId]`. An `activeRealmId` tracks which company is currently selected. The TopBar shows entity selection dropdowns.
- **Business Central**: Multiple schemas (company datasets) stored in `providers.dynamics.credentials.schemas[]`. Each schema has a company name, connected timestamp, and last sync time.
- **Dashboard** shows cards for each connected entity with company name, last sync, status, currency, and plan info.
- All data queries are scoped by entity (realmId for QB, schema for BC).

### 6. Learn / Financial Education

Located at `/learn` — an educational module with:

- Financial glossary/terminology definitions
- Course modules on accounting concepts
- Lessons within courses
- Knowledge assessments/tests
- Progress tracking
- Related content suggestions

### 7. Memory System

The AI maintains persistent memory across sessions:

- Stored in DynamoDB
- Types: expenses, income, goals, deadlines, context, preferences, decisions
- Company-scoped (uses realmId for isolation)
- Users can view/manage memories at `/memories`
- The AI automatically recalls relevant memories during conversations

## Tech Stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 15 (App Router)                             |
| UI         | React 19, TypeScript, Tailwind CSS 4                |
| Components | Radix UI primitives, custom component library       |
| Charts     | Recharts, ECharts                                   |
| Animation  | Motion (framer-motion)                              |
| State      | React Context + React Query (@tanstack/react-query) |
| AI/Agents  | LangChain, LangGraph, Groq, OpenAI                  |
| Auth       | AWS Cognito (JWT, JWKS verification)                |
| Database   | AWS DynamoDB (credentials, memories, users, orgs)   |
| Warehouse  | AWS Redshift (Business Central data via Fivetran)   |
| Storage    | AWS S3 (files, uploads)                             |
| ORM        | Drizzle (for Supabase/PostgreSQL)                   |
| PDF        | React PDF Renderer                                  |
| OAuth      | Intuit OAuth SDK (QuickBooks)                       |
| Payments   | Stripe                                              |
| Scheduling | Cal.com embed (demo booking)                        |

## Application Architecture

### Frontend State (React Contexts)

- **SessionContext** — User auth, active provider, connected providers, organization
- **ChatContext** — Chat panel state, messages, conversation history
- **FinancialDataContext** — Cached financial data
- **CurrencyContext** — Currency/locale based on active provider
- **ReportsProvider** — Report parameters, entity params (realmId, schema) in URL query params, caching
- **SalesContext** — Sales period selection
- **AlertsContext** — Financial alerts and notifications
- **SidebarContext** — Navigation sidebar state
- **WelcomeContext** — First-time user experience
- **LLMProviderContext** — LLM selection and configuration

### Backend API Routes

- `/api/auth/` — Authentication flows
- `/api/chat/` — AI conversation endpoint
- `/api/analysis/[pageType]` — AI-generated page analysis
- `/api/sales/` — Sales data (customer, receipt, product, department)
- `/api/expenses/` — Expense data
- `/api/kpis` — Key performance indicators
- `/api/coa` — Chart of accounts
- `/api/classes` — Cost centers/locations
- `/api/providers/` — Provider management (connect, disconnect, status, OAuth callbacks)
- `/api/quickbooks/` — QB-specific (connect, callback, disconnect, webhooks, sync, bills)
- `/api/providers/dynamics/` — BC login/disconnect
- `/api/learn/` — Educational content
- `/api/organization/` — Org management
- `/api/validate/` — Data validation

### Data Flow

```
User Query → Router (pattern + intent matching) → Agent (LangGraph state machine)
  → Tools (QB Data, BC Data, Memory, Visualization, etc.)
  → Provider APIs (QuickBooks REST, Redshift SQL, Zoho API)
  → Response with [[WIDGET:N]] markers → Chat UI renders widgets
```

### Provider Data Access Patterns

- **QuickBooks**: Direct REST API calls with OAuth bearer tokens. Token auto-refresh on 401. Webhooks for real-time updates. CDC polling as fallback.
- **Business Central**: Fivetran syncs BC data to Redshift on schedule. App queries Redshift via SQL at runtime.
- **Zoho**: Direct API calls on-demand (stateless).

## Navigation & Layout

- **TopBar** — Dynamic nav with categories (Platform, Industries, More). Shows entity/provider selection. Responsive: full nav on XL, dropdowns on LG, hamburger on mobile.
- **Sidebar** — Left navigation with collapsible provider/entity sections (desktop).
- **BottomNavBar** — Mobile navigation.
- **ChatPanel** — Right-side AI assistant, collapsible/resizable, can go fullscreen.

## User Flow

1. **Landing page** (`/`) → marketing site with features, pricing, industries, integrations pages.
2. **Sign up** (`/sign-up`) → AWS Cognito registration.
3. **Onboarding** (`/onboarding`) → Connect accounting provider via OAuth + accept terms.
4. **Dashboard** (`/dashboard`) → See all connected providers and entity snapshots.
5. **Navigate** to reports, sales, expenses, forecasting, or open the AI chat panel.
6. **Provider routes**: `/qb/*` for QuickBooks views, `/bc/*` for Business Central views.

## Auth & Permissions

- AWS Cognito with JWT tokens (access + ID tokens)
- Cookie-based session management with auto-refresh
- Route protection levels:
  - **Public**: `/`, `/sign-in`, `/sign-up`, `/pricing`, `/about`, etc.
  - **Auth-only**: `/onboarding` (authenticated but no terms yet)
  - **Protected**: `/dashboard`, `/reports`, `/sales`, `/expenses`, `/settings`, etc. (requires auth + terms + provider connection)

## Key Directories

```
src/
├── app/              # Next.js App Router pages & API routes
├── ai/               # LangGraph agent, tools, memory, router
│   ├── agent.ts      # Core agent (37KB+)
│   ├── router/       # Query routing & intent detection
│   ├── tools/        # 14+ AI tools
│   └── memory/       # Persistent memory service
├── components/       # React components
│   ├── layout/       # TopBar, Sidebar, BottomNavBar
│   ├── chat/         # Chat panel
│   ├── reports/      # Report viewers
│   ├── charts/       # Visualization components
│   ├── onboarding/   # Onboarding flow
│   └── ui/           # Base UI primitives (Radix-based)
├── contexts/         # React context providers
├── hooks/            # Custom React hooks
├── lib/              # Core logic
│   ├── providers/    # Provider registry, interfaces, database ops
│   │   ├── interfaces/  # Standardized entity interfaces
│   │   ├── quickbooks/  # QB provider implementation
│   │   ├── zoho/        # Zoho provider implementation
│   │   └── database.ts  # DynamoDB credential operations
│   ├── auth/         # Authentication utilities
│   └── llm.ts        # LLM configuration
├── quickbooks/       # QB integration module
│   ├── client/       # API client
│   ├── auth/         # OAuth flow
│   ├── etl/          # Data pipeline
│   ├── webhook/      # Real-time sync
│   └── cdc/          # Change Data Capture
├── types/            # TypeScript type definitions
└── config/           # Configuration files
```

## What Makes Midas Unique

1. **AI CFO, not just dashboards** — The conversational AI agent with 14+ tools can answer complex financial questions, compare periods, forecast, and remember context across sessions.
2. **Multi-provider, multi-entity** — One platform connects to multiple accounting systems and multiple companies within each system.
3. **Provider-agnostic interfaces** — Standardized data models mean the same UI works across QuickBooks, Business Central, Zoho, and Xero.
4. **Memory system** — The AI learns about the business over time, remembering goals, deadlines, preferences, and decisions.
5. **Financial education built-in** — The Learn module teaches accounting concepts alongside the operational tool.
6. **Widget-based chat** — AI responses include inline charts, tables, and interactive visualizations, not just text.
