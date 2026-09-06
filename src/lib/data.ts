// src/lib/data.ts
// Typed models for DynamoDB tables: users, organizations, financial_snapshots, financial_metrics_flat

/* ─────────────────────── UPLOADS ─────────────────────── */
export interface StoredFile {
  s3Key: string
  fileName: string
  fileSize: number // Storing file size is good practice
  uploadedAt: number // epoch timestamp
}

/* ─────────────────────── USERS ─────────────────────── */

export interface User {
  PK: `USER#${string}` // Partition key, e.g., USER#<clerk_user_id>
  SK: 'PROFILE' // Sort key

  user_id: string // Clerk User ID, e.g., user_xxxx
  email: string // Lowercase, from Clerk primary email
  first_name?: string
  last_name?: string
  phone?: string // E.164 format
  role_title?: string // User's role/title in their primary organization
  picture?: string
  oauth_provider?: string

  password_hash?: string // Stored if not solely relying on Clerk for all auth flows (Clerk handles primary auth)

  organization_id?: `ORG#${string}` // FK to the user's primary/default organization
  active_organization_id?: `ORG#${string}` // FK to the currently active organization (for multi-org users)
  // For users with access to multiple orgs, active_organization_id is used for scoping data (memories, etc.)

  subscription_type: 'trial' | 'free' | 'pro' | 'enterprise'

  preferences: {
    theme: 'classic' | 'midnight' | 'emerald'
    language?: string // e.g., 'en'
    strategic_focus: 'growth' | 'profitability' | 'runway' | 'cashflow'
    proficiency_level: 'beginner' | 'intermediate' | 'expert'
    pii_mode?: boolean // When true, sensitive data like company names will be blurred
  }

  assistant_confidence?: {
    // Renamed from original 'score' to 'value' for consistency
    value: number // 0-1
    reason: string
  }

  onboarding_audit: {
    current_step: string // Identifier for the current onboarding step (e.g., 'personal_info', 'company_details')
    completed_steps: string[] // List of completed step identifiers
    skipped_steps: string[] // List of skipped step identifiers
    started_at: number // Epoch seconds
    completed_at?: number | null // Epoch seconds when fully completed
    step_data?: Record<string, any> // Add this line to store step-specific data
  }

  // Terms acceptance fields (added for explicit terms tracking)
  terms_accepted?: boolean // Whether user has accepted terms of service
  terms_accepted_at?: number // Epoch seconds when terms were accepted

  refresh_tokens?: Record<string, { hash: string; exp: number }> // For external service refresh tokens if managed here
  learn_state?: any

  created_at: number // Epoch seconds
  updated_at: number // Epoch seconds
}

/* ───────────────────── ORGANIZATION ───────────────────── */

export interface Organization {
  PK: `ORG#${string}` // Partition key, e.g., ORG#<uuid>
  SK: 'PROFILE' // Sort key (was 'META' in original guidelines, 'PROFILE' is fine)

  organization_id: string // UUID for the organization
  owner_user_id: string // User ID of the user who created/owns the organization

  name: string // Primary display name of the organization
  legal_name?: string // Official legal name, if different
  registration_no?: string
  jurisdiction: string // e.g., ISO-3166-2 code like "US-DE" or "AE-DXB"
  incorporation_date?: string // ISO 8601-MM-DD
  vat_registered?: boolean
  revenue_model?: 'SaaS' | 'retail' | 'services' | string // Allow 'string' for "Other"

  // Financial health metrics configuration - 4 selected metric IDs
  financial_health_metrics?: string[] // Array of financial metric IDs (e.g., ['mrr_growth_rate', 'customer_churn_rate', 'cash_runway', 'gross_revenue_retention'])

  // Financial health targets - custom target values for each metric
  financial_health_targets?: Array<{
    metric_id: string
    target: number
    unit: string // 'currency' | '%' | 'ratio' | 'days' | 'months' | 'count'
  }>

  // Pitch Deck is now a single object
  pitch_deck?: StoredFile
  corp_profile?: StoredFile

  // Manual Financials is now an array of objects
  manual_financials?: StoredFile[]

  // Provider-agnostic credentials structure
  providers?: {
    [providerId: string]: {
      providerName: string
      credentials: {
        access_token: string
        refresh_token: string
        expires_at: number // Epoch seconds when access_token expires
        connected: boolean // Flag indicating if provider is actively connected
        last_synced: number // Epoch seconds of last successful sync/refresh
        lastError?: string | null
        // Provider-specific fields can be added here
        [key: string]: any
      }
      // QuickBooks-specific plan information
      plan?: 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown'
      planLastChecked?: number // Epoch seconds of last plan check
      features?: string[] // Cached list of available features
      // CDC (Change Data Capture) - polling-based change detection
      changeTimestamps?: Record<string, string> // Entity type → ISO timestamp of last change
      lastWebhookAt?: string // ISO timestamp of last webhook received
      syncCursors?: Record<string, string> // Entity type → sync cursor/timestamp
    }
  }

  // Warehouse configuration - links organization to Redshift schemas
  warehouse_config?: {
    enabled: boolean
    schemas: Array<{
      schema_name: string // Redshift schema name, e.g., "bc_aquaculture"
      source_type: 'business_central' | 'd365' | 'shopify' | 'meta_ads' | 'amazon' | 'tally' | 'manual'
      display_name: string // Human-readable name, e.g., "Premium Aquaculture BC"
      connected_at: number // Epoch seconds when schema was connected
      last_synced?: number // Epoch seconds of last Fivetran sync
      tables?: string[] // Optional: specific tables allowed (if empty, all tables in schema)
    }>
    default_schema?: string // Default schema to use for this org
  }

  // LLM-related context and pre-computed insights for the organization
  llm_prompt_map?: {
    company_summary?: string
    recent_metrics?: string // Textual summary of recent key metrics
    tone?: string // e.g., "precise", "encouraging" for AI responses related to this org
  }
  insight_blocks?: {
    cashflow_alerts?: Array<{
      id: string
      title: string
      body: string
      severity: 'positive' | 'warning' | 'critical'
      last_updated: number
    }>
    pitch_deck_summary?: {
      summary?: string
      why_now?: string
      // Potentially more structured data from pitch deck analysis
    }
  }

  created_at: number // Epoch seconds
  updated_at: number // Epoch seconds
}

/* ────────────── FINANCIAL SNAPSHOTS ────────────── */

export interface FinancialSnapshot {
  PK: `ORG#${string}` // References Organization
  SK: `SNAP#${number}` // Sort key using epoch timestamp for chronological order

  snapshot_timestamp: number // Epoch seconds, also part of SK
  source: 'zoho' | 'manual'

  data: {
    income: Record<string, number> // e.g., { "MRR": 50000, "Service Revenue": 12000 }
    balance: Record<string, number> // e.g., { "Cash": 100000, "Accounts Receivable": 25000 }
    cash_flow: Record<string, number> // e.g., { "Operating Cash Flow": 15000, "Investing Cash Flow": -5000 }
    // You might add more structured financial data categories here as needed
    raw_blob?: any // Optional: to store the original raw data for audit/reprocessing
  }
}

/* ────────────── FINANCIAL METRICS FLAT ────────────── */
// This structure is more normalized and flexible than the original "flattened_kpis"
// and is good for querying individual metrics over time.
export interface FinancialMetricFlat {
  PK: `ORG#${string}` // References Organization
  SK: `METRIC#${string}#${string}` // e.g., METRIC#total_revenue#2025-05-31

  metric_name: string // e.g., "total_revenue", "gross_margin_pct"
  period_end_date: string // ISO date string, e.g., "2025-05-31"
  period_type: 'month' | 'quarter' | 'year'
  value: number
  is_calculated?: boolean // True if this metric was derived from other data
  source_snapshot_sk?: `SNAP#${number}` // Optional: links to the snapshot SK it was derived from
  last_updated: number // Epoch seconds
}

/* ─────────────────────── LEARN MODULE ─────────────────────── */

export interface LearnState {
  PK: `USER#${string}`
  SK: 'STATE#LEARN'
  currentPath?: string
  completedTerms: string[]
  preferredMode: 'gentle' | 'founder' | 'expert'
  readingHistory: Array<{
    termId: string
    timestamp: number
    timeSpent: number
  }>
  preferences: {
    format: 'text' | 'audio' | 'both'
    complexity: 'beginner' | 'intermediate' | 'advanced'
    notifications: boolean
  }
  created_at: number
  updated_at: number
}

export interface GlossaryEntry {
  PK: `TERM#${string}`
  SK: 'META'
  id: string
  title: string
  category: string
  // New optional fields to support our dynamic UI
  visualCue?: string | null
  contextualSubtitle?: string
  definitions: {
    basic: string
    contextual: string
    metaphor: string
  }
  examples: {
    generic: string
    startup: string
    industry?: string
  }
  audioUrl?: string
  relatedTerms: string[]
  learningPaths: string[]
  vectorEmbedding?: number[]
  difficulty: 1 | 2 | 3 | 4 | 5
  created_at: number
  updated_at: number
}

export interface LearningPath {
  PK: `PATH#${string}`
  SK: `STEP#${string}`
  pathId: string
  stepOrder: number
  title: string
  content: LessonBlock[]
  prerequisites: string[]
  estimatedTime: number
  completionCriteria: {
    type: 'quiz' | 'reflection' | 'application'
    data: any
  }
  created_at: number
  updated_at: number
}

export interface LessonBlock {
  type: 'text' | 'term' | 'example' | 'quiz' | 'reflection'
  content: string
  metadata?: {
    termId?: string
    exampleType?: string
    quizOptions?: string[]
    correctAnswer?: string
  }
}

/* ─────────────────────── AI ANALYSIS ─────────────────────── */

export type AnalysisType =
  | 'EXEC_SUMMARY'
  | 'PNL'
  | 'CF'
  | 'BALANCE_SHEET'
  | 'PNL_ANALYSIS'
  | 'CASHFLOW_ANALYSIS'
  | 'BALANCE_SHEET_ANALYSIS'
  | 'SALES_ANALYSIS'
  | 'EXPENSES_ANALYSIS'
  | 'JOURNAL_ANALYSIS'

export interface AIAnalysis {
  // DynamoDB Keys
  PK: string // "ORG#<org_id>#<analysis_type>"
  SK: string // "ANALYSIS#<timestamp>#<analysis_id>"

  // Core Fields
  analysis_id: string // UUID
  organization_id: string
  user_id: string
  analysis_type: AnalysisType

  // Analysis Content
  analysis_text: string // The generated analysis text

  // Context Data
  date_range: {
    start: string // ISO date string
    end: string // ISO date string
  }
  financial_data: Record<string, any> // Snapshot of financial data used for analysis

  // Metadata
  provider_id?: string // Which provider's data was used
  model_used?: string // e.g., "llama-3.3-70b-groq"

  // TTL and Timestamps
  created_at: number // Milliseconds
  TTL: number // Unix timestamp in seconds (for DynamoDB TTL)
  expires_at: number // Milliseconds (for application-level validation)
}
