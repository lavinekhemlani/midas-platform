// src/ai/tools/quickbooks-data/__tests__/query-planner.test.ts
// Comprehensive test suite for Query Planner

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  planQuery,
  detectIntent,
  getRequiredDataSources,
  requiresParallelFetch,
  type DetectedIntent,
  type QueryPlan,
  type QueryIntent,
} from '../query-planner'
import type { QuickBooksDataInput } from '../types'

// Mock logger to avoid console noise during tests
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// =============================================================================
// Test Helpers
// =============================================================================

const createReportQuery = (
  reportType: QuickBooksDataInput['reportType'],
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'report',
  reportType,
  period: 'this_month',
  ...overrides,
})

const createAnalyzeQuery = (
  analysisType: QuickBooksDataInput['analysisType'],
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'analyze',
  analysisType,
  focusArea: 'revenue',
  ...overrides,
})

const createCompareQuery = (
  compareType: QuickBooksDataInput['compareType'],
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'compare',
  compareType,
  metric: 'revenue',
  ...overrides,
})

const createEntityQuery = (
  entityType: QuickBooksDataInput['entityType'],
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'entity',
  entityType,
  ...overrides,
})

const createMetricQuery = (
  metricName: QuickBooksDataInput['metricName'],
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'metric',
  metricName,
  ...overrides,
})

const createSearchQuery = (
  searchText: string,
  overrides: Partial<QuickBooksDataInput> = {}
): QuickBooksDataInput => ({
  queryType: 'search',
  searchText,
  searchScope: 'all',
  ...overrides,
})

// =============================================================================
// planQuery() Tests
// =============================================================================

describe('planQuery', () => {
  describe('Report Queries', () => {
    it('should plan simple profit_loss report query', () => {
      const input = createReportQuery('profit_loss')
      const plan = planQuery(input)

      expect(plan.queryType).toBe('report')
      expect(plan.dataSources).toContain('profit_loss')
      expect(plan.operations).toHaveLength(1)
      expect(plan.operations[0].type).toBe('fetch')
      expect(plan.operations[0].target).toBe('profit_loss')
      expect(plan.metadata.intent).toBe('report_fetch')
      expect(plan.metadata.reportType).toBe('profit_loss')
    })

    it('should plan balance_sheet report query with date range', () => {
      const input = createReportQuery('balance_sheet', {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
      const plan = planQuery(input)

      expect(plan.queryType).toBe('report')
      expect(plan.dataSources).toContain('balance_sheet')
      expect(plan.operations[0].params).toMatchObject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
    })

    it('should plan cash_flow report with summarizeBy', () => {
      const input = createReportQuery('cash_flow', {
        summarizeBy: 'Month',
      })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('cash_flow')
      expect(plan.operations[0].params.summarizeBy).toBe('Month')
    })

    it('should plan financial_health with multiple data sources', () => {
      const input = createReportQuery('financial_health')
      const plan = planQuery(input)

      // Financial health requires multiple reports
      expect(plan.dataSources.length).toBeGreaterThan(1)
      expect(plan.dataSources).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })

    it('should plan aged_receivables with correct data sources', () => {
      const input = createReportQuery('aged_receivables')
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['invoices', 'balance_sheet']))
    })

    it('should plan aged_payables with correct data sources', () => {
      const input = createReportQuery('aged_payables')
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['bills', 'balance_sheet']))
    })
  })

  describe('Analysis Queries', () => {
    it('should plan trends analysis with multiple reports', () => {
      const input = createAnalyzeQuery('trends', { focusArea: 'revenue' })
      const plan = planQuery(input)

      expect(plan.queryType).toBe('analyze')
      expect(plan.dataSources.length).toBeGreaterThan(0)
      expect(plan.metadata.intent).toBe('analysis')
      expect(plan.metadata.analysisType).toBe('trends')
      expect(plan.metadata.focusArea).toBe('revenue')
    })

    it('should plan breakdown analysis with focus area', () => {
      const input = createAnalyzeQuery('breakdown', { focusArea: 'expenses' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['profit_loss']))
    })

    it('should plan forecast analysis with high complexity', () => {
      const input = createAnalyzeQuery('forecast', { focusArea: 'cash_flow' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['cash_flow', 'balance_sheet']))
    })

    it('should plan performance analysis without focus area', () => {
      const input: QuickBooksDataInput = {
        queryType: 'analyze',
        analysisType: 'performance',
      }
      const plan = planQuery(input)

      // Should default to core financial statements
      expect(plan.dataSources).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })

    it('should plan anomalies analysis with profitability focus', () => {
      const input = createAnalyzeQuery('anomalies', { focusArea: 'profitability' })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('profit_loss')
      expect(plan.dataSources).toContain('balance_sheet')
    })
  })

  describe('Comparison Queries', () => {
    it('should plan period comparison with revenue metric', () => {
      const input = createCompareQuery('period', {
        metric: 'revenue',
        currentPeriod: 'this_month',
        comparisonPeriod: 'last_month',
      })
      const plan = planQuery(input)

      expect(plan.queryType).toBe('compare')
      expect(plan.dataSources).toContain('profit_loss')
      expect(plan.operations[0].params).toMatchObject({
        currentPeriod: 'this_month',
        comparisonPeriod: 'last_month',
      })
      expect(plan.metadata.intent).toBe('comparison')
      expect(plan.metadata.compareType).toBe('period')
      expect(plan.metadata.metric).toBe('revenue')
    })

    it('should plan budget comparison with expenses metric', () => {
      const input = createCompareQuery('budget', { metric: 'expenses' })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('profit_loss')
    })

    it('should plan forecast comparison with profit metric', () => {
      const input = createCompareQuery('forecast', { metric: 'profit' })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('profit_loss')
    })

    it('should plan benchmark comparison with cash_flow metric', () => {
      const input = createCompareQuery('benchmark', { metric: 'cash_flow' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['cash_flow', 'balance_sheet']))
    })

    it('should plan comparison with margins metric', () => {
      const input = createCompareQuery('period', { metric: 'margins' })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('profit_loss')
    })

    it('should plan comparison without specific metric', () => {
      const input: QuickBooksDataInput = {
        queryType: 'compare',
        compareType: 'period',
      }
      const plan = planQuery(input)

      // Should default to profit_loss and balance_sheet
      expect(plan.dataSources).toEqual(expect.arrayContaining(['profit_loss', 'balance_sheet']))
    })

    it('should include custom date ranges in comparison params', () => {
      const input = createCompareQuery('period', {
        currentStartDate: '2024-01-01',
        currentEndDate: '2024-01-31',
        comparisonStartDate: '2023-01-01',
        comparisonEndDate: '2023-01-31',
      })
      const plan = planQuery(input)

      expect(plan.operations[0].params).toMatchObject({
        currentStartDate: '2024-01-01',
        currentEndDate: '2024-01-31',
        comparisonStartDate: '2023-01-01',
        comparisonEndDate: '2023-01-31',
      })
    })
  })

  describe('Entity Queries', () => {
    it('should plan customer entity query with ID', () => {
      const input = createEntityQuery('customer', { entityId: 'cust-123' })
      const plan = planQuery(input)

      expect(plan.queryType).toBe('entity')
      expect(plan.dataSources).toContain('customer')
      expect(plan.operations[0].params.entityId).toBe('cust-123')
      expect(plan.metadata.intent).toBe('entity_lookup')
      expect(plan.metadata.entityType).toBe('customer')
    })

    it('should plan vendor entity query with filters', () => {
      const input = createEntityQuery('vendor', {
        filters: {
          status: 'active',
          minAmount: 1000,
          maxAmount: 5000,
        },
      })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('vendor')
      expect(plan.operations[0].params.filters).toMatchObject({
        status: 'active',
        minAmount: 1000,
        maxAmount: 5000,
      })
    })

    it('should plan invoice entity query with date range', () => {
      const input = createEntityQuery('invoice', {
        filters: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      })
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('invoice')
      expect(plan.operations[0].params.filters).toMatchObject({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })
    })

    it('should plan account entity query with limit and offset', () => {
      const input = createEntityQuery('account', {
        limit: 50,
        offset: 100,
      })
      const plan = planQuery(input)

      expect(plan.operations[0].params).toMatchObject({
        limit: 50,
        offset: 100,
      })
    })

    it('should plan bill entity query', () => {
      const input = createEntityQuery('bill')
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('bill')
    })

    it('should plan payment entity query', () => {
      const input = createEntityQuery('payment')
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('payment')
    })

    it('should plan transaction entity query', () => {
      const input = createEntityQuery('transaction')
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('transaction')
    })
  })

  describe('Metric Queries', () => {
    it('should plan gross_margin metric query', () => {
      const input = createMetricQuery('gross_margin')
      const plan = planQuery(input)

      expect(plan.queryType).toBe('metric')
      expect(plan.dataSources.length).toBeGreaterThan(0)
      expect(plan.metadata.intent).toBe('metric_calculation')
      expect(plan.metadata.metricName).toBe('gross_margin')
    })

    it('should plan current_ratio metric query', () => {
      const input = createMetricQuery('current_ratio')
      const plan = planQuery(input)

      expect(plan.dataSources.length).toBeGreaterThan(0)
    })

    it('should plan burn_rate metric with history', () => {
      const input = createMetricQuery('burn_rate', {
        includeHistory: true,
      })
      const plan = planQuery(input)

      expect(plan.operations[0].params.includeHistory).toBe(true)
    })

    it('should plan runway_months metric query', () => {
      const input = createMetricQuery('runway_months')
      const plan = planQuery(input)

      expect(plan.dataSources.length).toBeGreaterThan(0)
    })

    it('should plan debt_to_equity metric query', () => {
      const input = createMetricQuery('debt_to_equity')
      const plan = planQuery(input)

      expect(plan.dataSources.length).toBeGreaterThan(0)
    })

    it('should plan metric query with period', () => {
      const input = createMetricQuery('gross_margin', {
        period: 'this_quarter',
      })
      const plan = planQuery(input)

      expect(plan.operations.length).toBeGreaterThan(0)
      if (plan.operations.length > 0) {
        expect(plan.operations[0].params.period).toBe('this_quarter')
      }
    })
  })

  describe('Search Queries', () => {
    it('should plan search across all data', () => {
      const input = createSearchQuery('invoice 12345', { searchScope: 'all' })
      const plan = planQuery(input)

      expect(plan.queryType).toBe('search')
      expect(plan.dataSources).toContain('all')
      expect(plan.metadata.intent).toBe('search')
    })

    it('should plan transaction search', () => {
      const input = createSearchQuery('payment', { searchScope: 'transactions' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['invoices', 'bills', 'payments']))
    })

    it('should plan entity search', () => {
      const input = createSearchQuery('acme corp', { searchScope: 'entities' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(expect.arrayContaining(['customers', 'vendors', 'accounts']))
    })

    it('should plan report search', () => {
      const input = createSearchQuery('revenue', { searchScope: 'reports' })
      const plan = planQuery(input)

      expect(plan.dataSources).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing optional fields in report query', () => {
      const input: QuickBooksDataInput = {
        queryType: 'report',
        reportType: 'profit_loss',
      }
      const plan = planQuery(input)

      expect(plan.queryType).toBe('report')
      expect(plan.dataSources).toContain('profit_loss')
    })

    it('should handle analyze query without focusArea', () => {
      const input: QuickBooksDataInput = {
        queryType: 'analyze',
        analysisType: 'trends',
      }
      const plan = planQuery(input)

      // Should use default reports
      expect(plan.dataSources).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })

    it('should handle entity query without filters', () => {
      const input = createEntityQuery('customer')
      const plan = planQuery(input)

      expect(plan.dataSources).toContain('customer')
      expect(plan.operations[0].params.filters).toBeUndefined()
    })

    it('should return valid plan with metadata', () => {
      const input = createReportQuery('profit_loss')
      const plan = planQuery(input)

      expect(plan).toHaveProperty('queryType')
      expect(plan).toHaveProperty('operations')
      expect(plan).toHaveProperty('metadata')
      expect(plan).toHaveProperty('dataSources')
      expect(plan.metadata).toHaveProperty('intent')
      expect(plan.metadata).toHaveProperty('confidence')
    })

    it('should handle empty operations array gracefully', () => {
      const input = createReportQuery('profit_loss')
      const plan = planQuery(input)

      expect(Array.isArray(plan.operations)).toBe(true)
      expect(plan.operations.length).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// detectIntent() Tests
// =============================================================================

describe('detectIntent', () => {
  describe('Report Intent Detection', () => {
    it('should detect simple report intent with high confidence', () => {
      const input = createReportQuery('profit_loss')
      const intent = detectIntent(input)

      expect(intent.intent).toBe('report_fetch')
      expect(intent.confidence).toBe(0.95)
      expect(intent.suggestedReports).toContain('profit_loss')
      expect(intent.estimatedComplexity).toBe('low')
      expect(intent.requiresMultipleDataSources).toBe(false)
    })

    it('should detect financial_health as high complexity', () => {
      const input = createReportQuery('financial_health')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('high')
      expect(intent.requiresMultipleDataSources).toBe(true)
      expect(intent.suggestedReports.length).toBeGreaterThan(1)
    })

    it('should detect aged_receivables as medium complexity', () => {
      const input = createReportQuery('aged_receivables')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('medium')
      expect(intent.requiresMultipleDataSources).toBe(true)
    })

    it('should detect aged_payables as medium complexity', () => {
      const input = createReportQuery('aged_payables')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('medium')
      expect(intent.requiresMultipleDataSources).toBe(true)
    })

    it('should throw error for missing reportType', () => {
      const input: QuickBooksDataInput = {
        queryType: 'report',
      } as any

      expect(() => detectIntent(input)).toThrow('reportType is required for report queries')
    })
  })

  describe('Analysis Intent Detection', () => {
    it('should detect trends analysis with medium complexity', () => {
      const input = createAnalyzeQuery('trends', { focusArea: 'revenue' })
      const intent = detectIntent(input)

      expect(intent.intent).toBe('analysis')
      expect(intent.confidence).toBe(0.9)
      expect(intent.estimatedComplexity).toBe('medium')
      expect(intent.requiresMultipleDataSources).toBe(true)
    })

    it('should detect forecast analysis with high complexity', () => {
      const input = createAnalyzeQuery('forecast')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('high')
    })

    it('should detect performance analysis with high complexity', () => {
      const input = createAnalyzeQuery('performance')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('high')
    })

    it('should detect breakdown analysis with medium complexity', () => {
      const input = createAnalyzeQuery('breakdown', { focusArea: 'expenses' })
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('medium')
    })

    it('should map focusArea to correct reports and metrics', () => {
      const input = createAnalyzeQuery('trends', { focusArea: 'cash_flow' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['cash_flow', 'balance_sheet'])
      )
      expect(intent.suggestedMetrics.length).toBeGreaterThan(0)
    })

    it('should use default reports when focusArea is missing', () => {
      const input: QuickBooksDataInput = {
        queryType: 'analyze',
        analysisType: 'trends',
      }
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })

    it('should throw error for missing analysisType', () => {
      const input: QuickBooksDataInput = {
        queryType: 'analyze',
      } as any

      expect(() => detectIntent(input)).toThrow('analysisType is required for analyze queries')
    })
  })

  describe('Comparison Intent Detection', () => {
    it('should detect period comparison with confidence', () => {
      const input = createCompareQuery('period', { metric: 'revenue' })
      const intent = detectIntent(input)

      expect(intent.intent).toBe('comparison')
      expect(intent.confidence).toBe(0.92)
      expect(intent.estimatedComplexity).toBe('medium')
      expect(intent.requiresMultipleDataSources).toBe(true)
    })

    it('should map revenue metric to correct reports', () => {
      const input = createCompareQuery('period', { metric: 'revenue' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toContain('profit_loss')
      expect(intent.suggestedMetrics).toEqual(expect.arrayContaining(['revenue', 'revenue_growth']))
    })

    it('should map expenses metric to correct reports', () => {
      const input = createCompareQuery('period', { metric: 'expenses' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toContain('profit_loss')
      expect(intent.suggestedMetrics).toEqual(
        expect.arrayContaining(['expense_growth', 'operating_margin'])
      )
    })

    it('should map profit metric to correct metrics', () => {
      const input = createCompareQuery('period', { metric: 'profit' })
      const intent = detectIntent(input)

      expect(intent.suggestedMetrics).toEqual(
        expect.arrayContaining(['net_margin', 'gross_margin', 'operating_margin'])
      )
    })

    it('should map cash_flow metric to correct reports', () => {
      const input = createCompareQuery('period', { metric: 'cash_flow' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['cash_flow', 'balance_sheet'])
      )
    })

    it('should throw error for missing compareType', () => {
      const input: QuickBooksDataInput = {
        queryType: 'compare',
      } as any

      expect(() => detectIntent(input)).toThrow('compareType is required for compare queries')
    })
  })

  describe('Entity Intent Detection', () => {
    it('should detect entity lookup with very high confidence', () => {
      const input = createEntityQuery('customer', { entityId: 'cust-123' })
      const intent = detectIntent(input)

      expect(intent.intent).toBe('entity_lookup')
      expect(intent.confidence).toBe(0.98)
      expect(intent.estimatedComplexity).toBe('low')
      expect(intent.requiresMultipleDataSources).toBe(false)
      expect(intent.suggestedReports).toContain('customer')
    })

    it('should detect simple lookup with entity ID as low complexity', () => {
      const input = createEntityQuery('vendor', { entityId: 'vend-456' })
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('low')
    })

    it('should detect complex filters as medium complexity', () => {
      const input = createEntityQuery('invoice', {
        filters: {
          minAmount: 1000,
          maxAmount: 5000,
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      })
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('medium')
    })

    it('should detect query without ID or filters as low complexity', () => {
      const input = createEntityQuery('account')
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('low')
    })

    it('should throw error for missing entityType', () => {
      const input: QuickBooksDataInput = {
        queryType: 'entity',
      } as any

      expect(() => detectIntent(input)).toThrow('entityType is required for entity queries')
    })
  })

  describe('Metric Intent Detection', () => {
    it('should detect metric calculation with high confidence', () => {
      const input = createMetricQuery('gross_margin')
      const intent = detectIntent(input)

      expect(intent.intent).toBe('metric_calculation')
      expect(intent.confidence).toBe(0.97)
      expect(intent.suggestedMetrics).toContain('gross_margin')
    })

    it('should determine complexity based on data source count', () => {
      const input = createMetricQuery('current_ratio')
      const intent = detectIntent(input)

      // Current ratio requires balance sheet data
      expect(intent.estimatedComplexity).toBeDefined()
      expect(['low', 'medium', 'high']).toContain(intent.estimatedComplexity)
    })

    it('should mark as high complexity when includeHistory is true', () => {
      const input = createMetricQuery('revenue', { includeHistory: true })
      const intent = detectIntent(input)

      expect(intent.estimatedComplexity).toBe('high')
    })

    it('should set requiresMultipleDataSources based on dependencies', () => {
      const input = createMetricQuery('gross_margin')
      const intent = detectIntent(input)

      expect(typeof intent.requiresMultipleDataSources).toBe('boolean')
    })

    it('should throw error for missing metricName', () => {
      const input: QuickBooksDataInput = {
        queryType: 'metric',
      } as any

      expect(() => detectIntent(input)).toThrow('metricName is required for metric queries')
    })
  })

  describe('Search Intent Detection', () => {
    it('should detect search intent with moderate confidence', () => {
      const input = createSearchQuery('invoice 12345')
      const intent = detectIntent(input)

      expect(intent.intent).toBe('search')
      expect(intent.confidence).toBe(0.85)
      expect(intent.estimatedComplexity).toBe('medium')
    })

    it('should set requiresMultipleDataSources for all scope', () => {
      const input = createSearchQuery('test', { searchScope: 'all' })
      const intent = detectIntent(input)

      expect(intent.requiresMultipleDataSources).toBe(true)
      expect(intent.suggestedReports).toContain('all')
    })

    it('should suggest correct reports for transactions scope', () => {
      const input = createSearchQuery('test', { searchScope: 'transactions' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['invoices', 'bills', 'payments'])
      )
    })

    it('should suggest correct reports for entities scope', () => {
      const input = createSearchQuery('test', { searchScope: 'entities' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['customers', 'vendors', 'accounts'])
      )
    })

    it('should suggest correct reports for reports scope', () => {
      const input = createSearchQuery('test', { searchScope: 'reports' })
      const intent = detectIntent(input)

      expect(intent.suggestedReports).toEqual(
        expect.arrayContaining(['profit_loss', 'balance_sheet', 'cash_flow'])
      )
    })

    it('should throw error for missing searchText', () => {
      const input: QuickBooksDataInput = {
        queryType: 'search',
      } as any

      expect(() => detectIntent(input)).toThrow('searchText is required for search queries')
    })
  })
})

// =============================================================================
// getRequiredDataSources() Tests
// =============================================================================

describe('getRequiredDataSources', () => {
  it('should extract data sources from suggestedReports', () => {
    const intent: DetectedIntent = {
      intent: 'report_fetch',
      confidence: 0.95,
      suggestedReports: ['profit_loss', 'balance_sheet'],
      suggestedMetrics: [],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: true,
    }

    const sources = getRequiredDataSources(intent)
    expect(sources).toContain('profit_loss')
    expect(sources).toContain('balance_sheet')
  })

  it('should include metric dependencies in data sources', () => {
    const intent: DetectedIntent = {
      intent: 'metric_calculation',
      confidence: 0.97,
      suggestedReports: [],
      suggestedMetrics: ['gross_margin'],
      estimatedComplexity: 'medium',
      requiresMultipleDataSources: true,
    }

    const sources = getRequiredDataSources(intent)
    expect(sources.length).toBeGreaterThan(0)
  })

  it('should combine reports and metrics without duplicates', () => {
    const intent: DetectedIntent = {
      intent: 'analysis',
      confidence: 0.9,
      suggestedReports: ['profit_loss'],
      suggestedMetrics: ['revenue'],
      estimatedComplexity: 'medium',
      requiresMultipleDataSources: true,
    }

    const sources = getRequiredDataSources(intent)
    const uniqueSources = new Set(sources)
    expect(sources.length).toBe(uniqueSources.size)
  })

  it('should return empty array when no reports or metrics', () => {
    const intent: DetectedIntent = {
      intent: 'report_fetch',
      confidence: 0.5,
      suggestedReports: [],
      suggestedMetrics: [],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: false,
    }

    const sources = getRequiredDataSources(intent)
    expect(sources).toEqual([])
  })

  it('should handle metrics without dependencies', () => {
    const intent: DetectedIntent = {
      intent: 'metric_calculation',
      confidence: 0.97,
      suggestedReports: [],
      suggestedMetrics: ['unknown_metric'],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: false,
    }

    const sources = getRequiredDataSources(intent)
    expect(Array.isArray(sources)).toBe(true)
  })
})

// =============================================================================
// requiresParallelFetch() Tests
// =============================================================================

describe('requiresParallelFetch', () => {
  it('should return true when multiple data sources required', () => {
    const intent: DetectedIntent = {
      intent: 'analysis',
      confidence: 0.9,
      suggestedReports: ['profit_loss', 'balance_sheet', 'cash_flow'],
      suggestedMetrics: [],
      estimatedComplexity: 'high',
      requiresMultipleDataSources: true,
    }

    expect(requiresParallelFetch(intent)).toBe(true)
  })

  it('should return false when single data source', () => {
    const intent: DetectedIntent = {
      intent: 'report_fetch',
      confidence: 0.95,
      suggestedReports: ['profit_loss'],
      suggestedMetrics: [],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: false,
    }

    expect(requiresParallelFetch(intent)).toBe(false)
  })

  it('should return false when requiresMultipleDataSources is false', () => {
    const intent: DetectedIntent = {
      intent: 'entity_lookup',
      confidence: 0.98,
      suggestedReports: ['customer'],
      suggestedMetrics: [],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: false,
    }

    expect(requiresParallelFetch(intent)).toBe(false)
  })

  it('should return false when only one report despite flag', () => {
    const intent: DetectedIntent = {
      intent: 'report_fetch',
      confidence: 0.95,
      suggestedReports: ['profit_loss'],
      suggestedMetrics: [],
      estimatedComplexity: 'low',
      requiresMultipleDataSources: true,
    }

    expect(requiresParallelFetch(intent)).toBe(false)
  })
})
