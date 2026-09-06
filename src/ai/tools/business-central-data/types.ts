// src/ai/tools/business-central-data/types.ts
// Type definitions for Business Central data tool

import type { z } from 'zod'
import type { businessCentralDataSchema } from './schema'

export type BCDataInput = z.infer<typeof businessCentralDataSchema>

export interface BCToolContext {
  organizationId: string
  userId: string
  bcSchemas: string[] // Redshift schemas the org has access to (e.g., ['bc_aquaculture'])
  defaultSchema: string // Default schema to query
  currency?: string
  companyName?: string
  correlationId?: string
  // OAuth direct API connection (alternative to Redshift path)
  bcOAuthConnection?: {
    connectionId: string
    tenantId: string
    environmentName: string
    companyId: string
  }
}

export interface BCQueryResult {
  success: boolean
  queryType: string
  data: Record<string, unknown> | unknown[]
  summary: Record<string, unknown>
  currency?: string
  currencySymbol?: string // Display symbol (₦, $, £) for use in text responses
  sources: string[]
  generated: string
  error?: string
  metadata?: Record<string, unknown>
}
