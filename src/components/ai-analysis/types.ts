/**
 * Type definitions for AI Analysis system
 */

import type { AnalysisType as LibAnalysisType } from '@/lib/data'

export type PageType =
  | 'pnl'
  | 'cashflow'
  | 'balancesheet'
  | 'sales'
  | 'expenses'
  | 'journal'
  | 'summary'

export type AnalysisType = Extract<
  LibAnalysisType,
  | 'PNL_ANALYSIS'
  | 'CASHFLOW_ANALYSIS'
  | 'BALANCE_SHEET_ANALYSIS'
  | 'SALES_ANALYSIS'
  | 'EXPENSES_ANALYSIS'
  | 'JOURNAL_ANALYSIS'
  | 'EXEC_SUMMARY'
>

export interface AIAnalysisConfig {
  pageType: PageType
  displayName: string
  analysisType: AnalysisType
  cacheTTL: number // minutes
  description: string
  focusAreas: string[]
}

export interface DateRange {
  start: string // YYYY-MM-DD
  end: string
}

export interface PageAnalysisData {
  // Common fields
  dateRange: DateRange
  organizationId: string
  userId: string

  // Page-specific data (union type)
  pageType: PageType
  data: any // Will be typed more specifically per page
  context?: Record<string, any>
}

export interface AnalysisRequest {
  pageType: PageType
  data: any
  dateRange: DateRange
  context?: Record<string, any>
  forceRegenerate?: boolean
}

export interface ValidationMetadata {
  passed: boolean
  attempts: number
  failedSections: string[]
}

export interface AnalysisData {
  strategicInsights: string[]
  forwardLooking: string[]
  prioritizedActions: Array<{
    action: string
    impact: string
    timeline: string
  }>
}

export interface AnalysisResponse {
  analysis: AnalysisData | string // JSON object or legacy string
  tokensUsed: number
  cached: boolean
  cacheExpiresAt: number
  createdAt: number
  validation?: ValidationMetadata
}
