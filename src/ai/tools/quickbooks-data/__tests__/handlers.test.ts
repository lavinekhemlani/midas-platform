// src/ai/tools/quickbooks-data/__tests__/handlers.test.ts
// Comprehensive test suite for QuickBooks Data handlers

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  handleReportQuery,
  handleAnalysisQuery,
  handleComparisonQuery,
  handleEntityQuery,
  handleMetricQuery,
  handleSearchQuery,
  type HandlerContext,
  type AggregatedResult,
} from '../handlers'
import type { QuickBooksDataInput } from '../types'

// =============================================================================
// Mock Dependencies
// =============================================================================

// Mock all external modules
vi.mock('../report-accessor', () => ({
  fetchEnrichedReport: vi.fn(),
}))

vi.mock('../entity-accessor', () => ({
  listEntities: vi.fn(),
  getEntity: vi.fn(),
  searchEntities: vi.fn(),
  normalizeEntityType: vi.fn((type: string) => {
    const mapping: Record<string, string> = {
      customer: 'Customer',
      vendor: 'Vendor',
      account: 'Account',
      invoice: 'Invoice',
      bill: 'Bill',
      payment: 'Payment',
      transaction: 'Transaction',
    }
    return mapping[type] || type
  }),
}))

vi.mock('../metrics-registry', () => ({
  getMetricById: vi.fn(),
  formatMetricValue: vi.fn((value: number, format: string) => {
    if (format === 'currency') return `$${value.toFixed(2)}`
    if (format === 'percentage') return `${value.toFixed(2)}%`
    return value.toString()
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Import mocked modules
import { fetchEnrichedReport } from '../report-accessor'
import { listEntities, getEntity, searchEntities, normalizeEntityType } from '../entity-accessor'
import { getMetricById, formatMetricValue } from '../metrics-registry'
import { logger } from '@/lib/logger'

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockApiClient = () => ({
  request: vi.fn(),
  query: vi.fn(),
  getProfitAndLoss: vi.fn(),
  getBalanceSheet: vi.fn(),
})

const createMockContext = (overrides: Partial<HandlerContext> = {}): HandlerContext => ({
  organizationId: 'test-org-123',
  apiClient: createMockApiClient(),
  currency: 'USD',
  ...overrides,
})

const createMockReportResult = (overrides: any = {}) => ({
  success: true,
  data: {
    kpis: {
      revenue: 50000,
      expenses: 30000,
      net_income: 20000,
      gross_margin: 40,
      operating_margin: 25,
    },
    breakdown: [
      { category: 'Sales', amount: 50000 },
      { category: 'Operating Expenses', amount: 30000 },
    ],
    monthlyTrend: [{ month: '2024-01', revenue: 50000, expenses: 30000 }],
    details: {
      reportType: 'profit_loss',
    },
  },
  summary: {
    total: 50000,
    period: 'this_month',
  },
  fromDate: '2024-01-01',
  toDate: '2024-01-31',
  asOfDate: '2024-01-31',
  ...overrides,
})

const createMockEntityResult = (overrides: any = {}) => ({
  success: true,
  data: {
    entities: [
      { id: '1', name: 'Customer A', balance: 1000 },
      { id: '2', name: 'Customer B', balance: 2000 },
    ],
    summary: {
      count: 2,
      totalBalance: 3000,
    },
  },
  ...overrides,
})

// =============================================================================
// Test Suite: handleReportQuery
// =============================================================================

describe('handleReportQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully fetch and return report data', async () => {
    const mockResult = createMockReportResult()
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
    }

    const context = createMockContext()
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      period: 'this_month',
      summarizeBy: 'Month' as const,
    }

    const result = await handleReportQuery(input, context, params)

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('report')
    expect(result.data.kpis).toEqual(mockResult.data.kpis)
    expect(result.data.breakdown).toEqual(mockResult.data.breakdown)
    expect(result.data.monthlyTrend).toEqual(mockResult.data.monthlyTrend)
    expect(result.currency).toBe('USD')
    expect(result.sources).toEqual(['profit_loss'])
    expect(result.metadata?.fromDate).toBe('2024-01-01')
    expect(result.metadata?.toDate).toBe('2024-01-31')
  })

  it('should throw error when report fetch fails', async () => {
    const mockResult = {
      success: false,
      error: 'API request failed',
      data: {},
    }
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult as any)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'balance_sheet',
    }

    const context = createMockContext()
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }

    await expect(handleReportQuery(input, context, params)).rejects.toThrow('API request failed')
  })

  it('should handle date parameters correctly', async () => {
    const mockResult = createMockReportResult()
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'cash_flow',
    }

    const context = createMockContext()
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      period: 'this_year',
      summarizeBy: 'Quarter' as const,
    }

    await handleReportQuery(input, context, params)

    expect(fetchEnrichedReport).toHaveBeenCalledWith(
      'cash_flow',
      {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'this_year',
        summarizeBy: 'Quarter',
      },
      {
        organizationId: 'test-org-123',
        client: context.apiClient,
        currency: 'USD',
      }
    )
  })

  it('should log report query execution', async () => {
    const mockResult = createMockReportResult()
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
    }

    const context = createMockContext()
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }

    await handleReportQuery(input, context, params)

    expect(logger.info).toHaveBeenCalledWith(
      '[Tool:QB:Handler] Report query started',
      expect.objectContaining({
        reportType: 'profit_loss',
        organizationId: 'test-org-123',
      })
    )

    expect(logger.info).toHaveBeenCalledWith(
      '[Tool:QB:Handler] Report query completed',
      expect.objectContaining({
        duration: expect.any(Number),
      })
    )
  })
})

// =============================================================================
// Test Suite: handleAnalysisQuery
// =============================================================================

describe('handleAnalysisQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch multiple reports in parallel', async () => {
    const mockResult1 = createMockReportResult({
      data: {
        kpis: { revenue: 50000, expenses: 30000 },
        breakdown: [],
        monthlyTrend: [],
      },
    })
    const mockResult2 = createMockReportResult({
      data: {
        kpis: { cash_balance: 100000 },
        breakdown: [],
        monthlyTrend: [],
      },
    })

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(mockResult1)
      .mockResolvedValueOnce(mockResult2)

    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'trends',
    }

    const context = createMockContext()
    const requiredReports = [
      {
        target: 'profit_loss',
        params: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      },
      {
        target: 'balance_sheet',
        params: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      },
    ]

    const result = await handleAnalysisQuery(input, context, requiredReports)

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('analyze')
    expect(result.data.kpis).toEqual({ revenue: 50000, expenses: 30000 })
    expect(result.sources).toEqual(['profit_loss', 'balance_sheet'])
    expect(fetchEnrichedReport).toHaveBeenCalledTimes(2)
  })

  it('should throw error on partial failure', async () => {
    const mockResult1 = createMockReportResult()
    const mockResult2 = {
      success: false,
      error: 'Balance sheet fetch failed',
      data: {},
    }

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(mockResult1)
      .mockResolvedValueOnce(mockResult2 as any)

    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'performance',
    }

    const context = createMockContext()
    const requiredReports = [
      {
        target: 'profit_loss',
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      },
      {
        target: 'balance_sheet',
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      },
    ]

    await expect(handleAnalysisQuery(input, context, requiredReports)).rejects.toThrow(
      'Balance sheet fetch failed'
    )
  })

  it('should aggregate KPIs from first report', async () => {
    const mockResult = createMockReportResult({
      data: {
        kpis: {
          revenue: 100000,
          net_income: 25000,
          gross_margin: 45,
        },
        breakdown: [{ category: 'Test', amount: 100 }],
        monthlyTrend: [{ month: '2024-01', value: 100 }],
      },
      summary: {
        total: 100000,
        period: 'this_quarter',
      },
    })

    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'breakdown',
    }

    const context = createMockContext()
    const requiredReports = [
      {
        target: 'profit_loss',
        params: { startDate: '2024-01-01', endDate: '2024-03-31' },
      },
    ]

    const result = await handleAnalysisQuery(input, context, requiredReports)

    expect(result.data.kpis).toEqual({
      revenue: 100000,
      net_income: 25000,
      gross_margin: 45,
    })
    expect(result.summary).toEqual({
      total: 100000,
      period: 'this_quarter',
    })
    expect(result.metadata?.analysisType).toBe('breakdown')
  })
})

// =============================================================================
// Test Suite: handleComparisonQuery
// =============================================================================

describe('handleComparisonQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should compare two periods and calculate variance', async () => {
    const currentResult = createMockReportResult({
      data: {
        kpis: { revenue: 60000, expenses: 35000 },
      },
      summary: { total: 60000 },
    })

    const comparisonResult = createMockReportResult({
      data: {
        kpis: { revenue: 50000, expenses: 30000 },
      },
      summary: { total: 50000 },
    })

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(currentResult)
      .mockResolvedValueOnce(comparisonResult)

    const input: QuickBooksDataInput = {
      queryType: 'compare',
      metric: 'revenue',
      currentPeriod: 'this_month',
      comparisonPeriod: 'last_month',
    }

    const context = createMockContext()
    const reportType = 'profit_loss'
    const currentParams = {
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    }
    const comparisonParams = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }

    const result = await handleComparisonQuery(
      input,
      context,
      reportType,
      currentParams,
      comparisonParams
    )

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('compare')
    expect(result.data.variance).toEqual({
      absolute: 10000,
      percentage: 20,
      direction: 'increase',
      current: 60000,
      comparison: 50000,
    })
    expect(result.summary.change).toBe(10000)
    expect(result.summary.changePercent).toBe(20)
  })

  it('should handle zero comparison value gracefully', async () => {
    const currentResult = createMockReportResult({
      data: { kpis: { revenue: 50000 } },
      summary: { total: 50000 },
    })

    const comparisonResult = createMockReportResult({
      data: { kpis: { revenue: 0 } },
      summary: { total: 0 },
    })

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(currentResult)
      .mockResolvedValueOnce(comparisonResult)

    const input: QuickBooksDataInput = {
      queryType: 'compare',
      metric: 'revenue',
    }

    const context = createMockContext()
    const result = await handleComparisonQuery(
      input,
      context,
      'profit_loss',
      { startDate: '2024-02-01', endDate: '2024-02-29' },
      { startDate: '2024-01-01', endDate: '2024-01-31' }
    )

    expect(result.data.variance.percentage).toBe(0)
    expect(result.data.variance.absolute).toBe(50000)
  })

  it('should calculate decrease direction correctly', async () => {
    const currentResult = createMockReportResult({
      data: { kpis: { expenses: 25000 } },
    })

    const comparisonResult = createMockReportResult({
      data: { kpis: { expenses: 30000 } },
    })

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(currentResult)
      .mockResolvedValueOnce(comparisonResult)

    const input: QuickBooksDataInput = {
      queryType: 'compare',
      metric: 'expenses',
    }

    const context = createMockContext()
    const result = await handleComparisonQuery(
      input,
      context,
      'profit_loss',
      { startDate: '2024-02-01', endDate: '2024-02-29' },
      { startDate: '2024-01-01', endDate: '2024-01-31' }
    )

    expect(result.data.variance.absolute).toBe(-5000)
    expect(result.data.variance.percentage).toBeCloseTo(-16.67, 1)
    expect(result.data.variance.direction).toBe('decrease')
  })

  it('should handle unchanged values', async () => {
    const result1 = createMockReportResult({
      data: { kpis: { revenue: 50000 } },
    })

    vi.mocked(fetchEnrichedReport).mockResolvedValueOnce(result1).mockResolvedValueOnce(result1)

    const input: QuickBooksDataInput = {
      queryType: 'compare',
      metric: 'revenue',
    }

    const context = createMockContext()
    const result = await handleComparisonQuery(
      input,
      context,
      'profit_loss',
      { startDate: '2024-02-01', endDate: '2024-02-29' },
      { startDate: '2024-01-01', endDate: '2024-01-31' }
    )

    expect(result.data.variance.absolute).toBe(0)
    expect(result.data.variance.percentage).toBe(0)
    expect(result.data.variance.direction).toBe('unchanged')
  })

  it('should throw error when either period fails', async () => {
    const successResult = createMockReportResult()
    const failResult = { success: false, error: 'Failed to fetch', data: {} }

    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(successResult)
      .mockResolvedValueOnce(failResult as any)

    const input: QuickBooksDataInput = {
      queryType: 'compare',
    }

    const context = createMockContext()
    await expect(
      handleComparisonQuery(
        input,
        context,
        'profit_loss',
        { startDate: '2024-02-01', endDate: '2024-02-29' },
        { startDate: '2024-01-01', endDate: '2024-01-31' }
      )
    ).rejects.toThrow('Failed to fetch comparison periods')
  })
})

// =============================================================================
// Test Suite: handleEntityQuery
// =============================================================================

describe('handleEntityQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch single entity by ID', async () => {
    const mockEntity = {
      success: true,
      data: {
        id: 'customer-123',
        name: 'Acme Corp',
        balance: 5000,
      },
    }

    vi.mocked(getEntity).mockResolvedValue(mockEntity as any)
    vi.mocked(normalizeEntityType).mockReturnValue('Customer')

    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'customer',
      entityId: 'customer-123',
    }

    const context = createMockContext()
    const result = await handleEntityQuery(input, context)

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('entity')
    expect(result.data.entities).toContainEqual(mockEntity.data)
    expect(normalizeEntityType).toHaveBeenCalledWith('customer')
    expect(getEntity).toHaveBeenCalledWith(
      'Customer',
      'customer-123',
      expect.objectContaining({
        organizationId: 'test-org-123',
      })
    )
  })

  it('should list entities with filters', async () => {
    const mockResult = createMockEntityResult()
    vi.mocked(listEntities).mockResolvedValue(mockResult as any)
    vi.mocked(normalizeEntityType).mockReturnValue('Vendor')

    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'vendor',
      filters: {
        status: 'active',
        minAmount: 1000,
      },
    }

    const context = createMockContext()
    const result = await handleEntityQuery(input, context)

    expect(result.success).toBe(true)
    expect(result.data.entities).toEqual(mockResult.data.entities)
    expect(result.data.summary).toEqual(mockResult.data.summary)
    expect(listEntities).toHaveBeenCalledWith(
      'Vendor',
      { status: 'active', minAmount: 1000 },
      expect.any(Object)
    )
  })

  it('should normalize entity type correctly', async () => {
    const mockResult = createMockEntityResult()
    vi.mocked(listEntities).mockResolvedValue(mockResult as any)

    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'invoice',
    }

    const context = createMockContext()
    await handleEntityQuery(input, context)

    expect(normalizeEntityType).toHaveBeenCalledWith('invoice')
  })

  it('should throw error when entity fetch fails', async () => {
    const mockResult = {
      success: false,
      error: 'Entity not found',
      data: {},
    }

    vi.mocked(getEntity).mockResolvedValue(mockResult as any)
    vi.mocked(normalizeEntityType).mockReturnValue('Customer')

    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'customer',
      entityId: 'invalid-id',
    }

    const context = createMockContext()
    await expect(handleEntityQuery(input, context)).rejects.toThrow('Entity not found')
  })
})

// =============================================================================
// Test Suite: handleMetricQuery
// =============================================================================

describe('handleMetricQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract metric from report KPIs', async () => {
    const mockMetric = {
      id: 'gross_margin',
      name: 'Gross Profit Margin',
      shortName: 'Gross Margin',
      category: 'profitability',
      format: 'percentage',
      description: 'Percentage of revenue after COGS',
      interpretation: 'Higher is better',
      dataSources: ['profit_loss'],
      formula: 'revenue - cogs',
      priority: 1,
    }

    const mockReport = createMockReportResult({
      data: {
        kpis: {
          gross_margin: 45.5,
          revenue: 100000,
        },
      },
    })

    vi.mocked(getMetricById).mockReturnValue(mockMetric as any)
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockReport)
    vi.mocked(formatMetricValue).mockReturnValue('45.50%')

    const input: QuickBooksDataInput = {
      queryType: 'metric',
      metricName: 'gross_margin',
    }

    const context = createMockContext()
    const requiredSources: any[] = [
      {
        target: 'profit_loss',
        isEntity: false,
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      },
    ]

    const result = await handleMetricQuery(input, context, requiredSources)

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('metric')
    expect(result.data.metricName).toBe('Gross Profit Margin')
    expect(result.data.value).toBe(45.5)
    expect(result.data.formattedValue).toBe('45.50%')
    expect(result.data.unit).toBe('percentage')
    expect(result.metadata?.interpretation).toBe('Higher is better')
  })

  it('should handle multi-source metric extraction', async () => {
    const mockMetric = {
      id: 'current_ratio',
      name: 'Current Ratio',
      shortName: 'Current Ratio',
      category: 'liquidity',
      format: 'ratio',
      description: 'Current assets / Current liabilities',
      interpretation: 'Above 1.0 is healthy',
      dataSources: ['balance_sheet'],
      formula: 'current_assets / current_liabilities',
      priority: 2,
    }

    const mockBalanceSheet = createMockReportResult({
      data: {
        kpis: {
          current_ratio: 2.5,
        },
      },
    })

    const mockProfitLoss = createMockReportResult({
      data: {
        kpis: {
          revenue: 100000,
        },
      },
    })

    vi.mocked(getMetricById).mockReturnValue(mockMetric as any)
    vi.mocked(fetchEnrichedReport)
      .mockResolvedValueOnce(mockBalanceSheet)
      .mockResolvedValueOnce(mockProfitLoss)

    const input: QuickBooksDataInput = {
      queryType: 'metric',
      metricName: 'current_ratio',
    }

    const context = createMockContext()
    const requiredSources = [
      {
        target: 'balance_sheet',
        isEntity: false,
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      },
      {
        target: 'profit_loss',
        isEntity: false,
        params: { startDate: '2024-01-01', endDate: '2024-01-31' },
      },
    ]

    const result = await handleMetricQuery(input, context, requiredSources)

    expect(result.data.value).toBe(2.5)
    expect(result.sources).toEqual(['balance_sheet', 'profit_loss'])
  })

  it('should throw error for unknown metric', async () => {
    vi.mocked(getMetricById).mockReturnValue(null as any)

    const input: QuickBooksDataInput = {
      queryType: 'metric',
      metricName: 'invalid_metric' as any,
    }

    const context = createMockContext()
    const requiredSources: any[] = []

    await expect(handleMetricQuery(input, context, requiredSources)).rejects.toThrow(
      'Unknown metric: invalid_metric'
    )
  })
})

// =============================================================================
// Test Suite: handleSearchQuery
// =============================================================================

describe('handleSearchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should search across all entity types', async () => {
    const mockCustomers = {
      success: true,
      data: {
        entities: [{ id: 'c1', name: 'Acme Corp', type: 'Customer' }],
      },
    }

    const mockVendors = {
      success: true,
      data: {
        entities: [{ id: 'v1', name: 'Acme Supplies', type: 'Vendor' }],
      },
    }

    const mockInvoices = {
      success: true,
      data: {
        entities: [{ id: 'i1', docNumber: 'INV-001', type: 'Invoice' }],
      },
    }

    const mockBills = {
      success: true,
      data: {
        entities: [],
      },
    }

    vi.mocked(searchEntities)
      .mockResolvedValueOnce(mockCustomers as any)
      .mockResolvedValueOnce(mockVendors as any)
      .mockResolvedValueOnce(mockInvoices as any)
      .mockResolvedValueOnce(mockBills as any)

    const input: QuickBooksDataInput = {
      queryType: 'search',
      searchText: 'Acme',
      searchScope: 'all',
      limit: 10,
    }

    const context = createMockContext()
    const result = await handleSearchQuery(input, context)

    expect(result.success).toBe(true)
    expect(result.queryType).toBe('search')
    expect(result.data.results).toHaveLength(3)
    expect(result.summary.totalResults).toBe(3)
    expect(searchEntities).toHaveBeenCalledTimes(4)
  })

  it('should scope search to entities only', async () => {
    const mockCustomers = {
      success: true,
      data: {
        entities: [{ id: 'c1', name: 'Test Customer' }],
      },
    }

    const mockVendors = {
      success: true,
      data: {
        entities: [{ id: 'v1', name: 'Test Vendor' }],
      },
    }

    vi.mocked(searchEntities)
      .mockResolvedValueOnce(mockCustomers as any)
      .mockResolvedValueOnce(mockVendors as any)

    const input: QuickBooksDataInput = {
      queryType: 'search',
      searchText: 'Test',
      searchScope: 'entities',
      limit: 10,
    }

    const context = createMockContext()
    const result = await handleSearchQuery(input, context)

    expect(result.data.results).toHaveLength(2)
    expect(searchEntities).toHaveBeenCalledTimes(2)
    expect(searchEntities).toHaveBeenCalledWith(
      'Customer',
      'Test',
      expect.any(Object),
      expect.any(Object)
    )
    expect(searchEntities).toHaveBeenCalledWith(
      'Vendor',
      'Test',
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('should handle pagination correctly', async () => {
    const mockResults = {
      success: true,
      data: {
        entities: Array.from({ length: 20 }, (_, i) => ({
          id: `e${i}`,
          name: `Entity ${i}`,
        })),
      },
    }

    vi.mocked(searchEntities)
      .mockResolvedValueOnce(mockResults as any)
      .mockResolvedValueOnce({ success: true, data: { entities: [] } } as any)
      .mockResolvedValueOnce({ success: true, data: { entities: [] } } as any)
      .mockResolvedValueOnce({ success: true, data: { entities: [] } } as any)

    const input: QuickBooksDataInput = {
      queryType: 'search',
      searchText: 'Entity',
      limit: 5,
      offset: 3,
    }

    const context = createMockContext()
    const result = await handleSearchQuery(input, context)

    expect(result.data.results).toHaveLength(5)
    expect(result.summary.offset).toBe(3)
    expect(result.summary.limit).toBe(5)
    expect(result.summary.hasMore).toBe(true)
    expect(result.summary.totalResults).toBe(20)
  })

  it('should handle failed searches gracefully', async () => {
    vi.mocked(searchEntities)
      .mockResolvedValueOnce({ success: false, error: 'API error', data: {} } as any)
      .mockResolvedValueOnce({ success: true, data: { entities: [] } } as any)

    const input: QuickBooksDataInput = {
      queryType: 'search',
      searchText: 'Test',
      searchScope: 'entities',
    }

    const context = createMockContext()
    const result = await handleSearchQuery(input, context)

    expect(result.success).toBe(true)
    expect(result.data.results).toHaveLength(0)
  })

  it('should apply default limit and offset', async () => {
    vi.mocked(searchEntities).mockResolvedValue({ success: true, data: { entities: [] } } as any)

    const input: QuickBooksDataInput = {
      queryType: 'search',
      searchText: 'Test',
    }

    const context = createMockContext()
    const result = await handleSearchQuery(input, context)

    expect(result.summary.limit).toBe(10)
    expect(result.summary.offset).toBe(0)
  })
})

// =============================================================================
// Test Suite: AggregatedResult Structure
// =============================================================================

describe('AggregatedResult structure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include all required fields in report result', async () => {
    const mockResult = createMockReportResult()
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
    }

    const context = createMockContext()
    const result = await handleReportQuery(input, context, {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    })

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('queryType')
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('currency')
    expect(result).toHaveProperty('sources')
    expect(result).toHaveProperty('metadata')
    expect(result).toHaveProperty('generated')
    expect(result).not.toHaveProperty('error')
  })

  it('should generate ISO timestamp', async () => {
    const mockResult = createMockReportResult()
    vi.mocked(fetchEnrichedReport).mockResolvedValue(mockResult)

    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
    }

    const context = createMockContext()
    const result = await handleReportQuery(input, context, {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    })

    expect(result.generated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
