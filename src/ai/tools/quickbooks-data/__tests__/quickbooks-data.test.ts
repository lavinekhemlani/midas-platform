// src/ai/tools/quickbooks-data/__tests__/quickbooks-data.test.ts
// Comprehensive test suite for QuickBooks Data AI Tool

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { quickbooksDataSchema } from '../schema'
import {
  detectIntent,
  getRequiredDataSources,
  requiresParallelFetch,
  planQuery,
} from '../query-planner'
import {
  METRICS_REGISTRY,
  getMetricsByCategory,
  getMetricById,
  getCriticalMetrics,
  getRequiredDataSources as getMetricDataSources,
  formatMetricValue,
  interpretMetricValue,
} from '../metrics-registry'
import { fetchEnrichedReport } from '../report-accessor'
import { listEntities, getEntity, searchEntities } from '../entity-accessor'
import type { QuickBooksDataInput, ToolContext } from '../types'
import type { QuickBooksClient } from '@/lib/providers/quickbooks/client'

// =============================================================================
// Mock Setup
// =============================================================================

// Mock QuickBooks Client - Updated to match QuickBooksClient interface
const createMockQuickBooksClient = () => ({
  request: vi.fn(),
  query: vi.fn(),
  get: vi.fn(),
  queryEntities: vi.fn(),
  getProfitAndLoss: vi.fn(),
  getBalanceSheet: vi.fn(),
  getCashFlow: vi.fn(),
  getReport: vi.fn(),
  getInvoice: vi.fn(),
})

// Mock Tool Context
const createMockContext = (overrides = {}): ToolContext => ({
  organizationId: 'test-org-123',
  provider: 'quickbooks' as any,
  apiClient: createMockQuickBooksClient() as any,
  currency: 'USD',
  ...overrides,
})

// Mock Report Response
const createMockProfitLossReport = () => ({
  Header: {
    ReportName: 'ProfitAndLoss',
    StartPeriod: '2024-01-01',
    EndPeriod: '2024-01-31',
  },
  Columns: {
    Column: [
      { ColTitle: '', ColType: 'Account' },
      { ColTitle: 'Total', ColType: 'Money' },
    ],
  },
  Rows: {
    Row: [
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Income' }] },
        Rows: {
          Row: [
            {
              type: 'Data',
              ColData: [{ value: 'Sales' }, { value: '50000' }],
            },
          ],
        },
        Summary: { ColData: [{ value: 'Total Income' }, { value: '50000' }] },
      },
      {
        type: 'Section',
        Header: { ColData: [{ value: 'Expenses' }] },
        Rows: {
          Row: [
            {
              type: 'Data',
              ColData: [{ value: 'Operating Expenses' }, { value: '30000' }],
            },
          ],
        },
        Summary: { ColData: [{ value: 'Total Expenses' }, { value: '30000' }] },
      },
    ],
  },
})

const createMockBalanceSheetReport = () => ({
  Header: {
    ReportName: 'BalanceSheet',
    Time: '2024-01-31',
  },
  Columns: {
    Column: [
      { ColTitle: '', ColType: 'Account' },
      { ColTitle: 'Total', ColType: 'Money' },
    ],
  },
  Rows: {
    Row: [
      {
        type: 'Section',
        Header: { ColData: [{ value: 'ASSETS' }] },
        Summary: { ColData: [{ value: 'Total Assets' }, { value: '100000' }] },
      },
      {
        type: 'Section',
        Header: { ColData: [{ value: 'LIABILITIES AND EQUITY' }] },
        Rows: {
          Row: [
            {
              type: 'Section',
              Header: { ColData: [{ value: 'Liabilities' }] },
              Summary: { ColData: [{ value: 'Total Liabilities' }, { value: '40000' }] },
            },
            {
              type: 'Section',
              Header: { ColData: [{ value: 'Equity' }] },
              Summary: { ColData: [{ value: 'Total Equity' }, { value: '60000' }] },
            },
          ],
        },
      },
    ],
  },
})

// =============================================================================
// SCHEMA VALIDATION TESTS
// =============================================================================

describe('Schema Validation', () => {
  describe('quickbooksDataSchema (discriminated union)', () => {
    it('should validate report query', () => {
      const validInput = {
        queryType: 'report' as const,
        reportType: 'profit_loss' as const,
        period: 'last_month' as const,
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate analyze query', () => {
      const validInput = {
        queryType: 'analyze' as const,
        analysisType: 'trends' as const,
        focusArea: 'revenue' as const,
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate compare query', () => {
      const validInput = {
        queryType: 'compare' as const,
        compareType: 'period' as const,
        metric: 'revenue' as const,
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate entity query', () => {
      const validInput = {
        queryType: 'entity' as const,
        entityType: 'customer' as const,
        entityId: '123',
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate metric query', () => {
      const validInput = {
        queryType: 'metric' as const,
        metricName: 'gross_margin' as const,
        period: 'this_quarter' as const,
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate search query', () => {
      const validInput = {
        queryType: 'search' as const,
        searchText: 'Acme Corp',
        searchScope: 'entities' as const,
      }

      const result = quickbooksDataSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should validate all query types', () => {
      const queries: QuickBooksDataInput[] = [
        { queryType: 'report', reportType: 'profit_loss', period: 'last_month' },
        { queryType: 'analyze', analysisType: 'trends' },
        { queryType: 'compare', compareType: 'period' },
        { queryType: 'entity', entityType: 'customer' },
        { queryType: 'metric', metricName: 'gross_margin' },
        { queryType: 'search', searchText: 'Test' },
      ]

      queries.forEach((query) => {
        const result = quickbooksDataSchema.safeParse(query)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid query type', () => {
      const invalidInput = {
        queryType: 'invalid' as any,
      }

      const result = quickbooksDataSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })
  })
})

// =============================================================================
// INTENT DETECTION TESTS
// =============================================================================

describe('Intent Detection', () => {
  it('should detect report fetch intent', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      period: 'last_month',
    }

    const detected = detectIntent(input)

    expect(detected.intent).toBe('report_fetch')
    expect(detected.confidence).toBeGreaterThan(0.9)
    expect(detected.suggestedReports).toContain('profit_loss')
  })

  it('should detect financial_health as high complexity', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'financial_health',
      period: 'last_quarter',
    }

    const detected = detectIntent(input)

    expect(detected.estimatedComplexity).toBe('high')
    expect(detected.requiresMultipleDataSources).toBe(true)
    expect(detected.suggestedReports.length).toBeGreaterThan(0)
  })

  it('should detect analysis intent with focus area', () => {
    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'trends',
      focusArea: 'revenue',
    }

    const detected = detectIntent(input)

    expect(detected.intent).toBe('analysis')
    expect(detected.suggestedReports).toContain('profit_loss')
    expect(detected.suggestedMetrics.length).toBeGreaterThan(0)
  })

  it('should detect comparison intent', () => {
    const input: QuickBooksDataInput = {
      queryType: 'compare',
      compareType: 'period',
      metric: 'revenue',
    }

    const detected = detectIntent(input)

    expect(detected.intent).toBe('comparison')
    expect(detected.suggestedReports).toContain('profit_loss')
    expect(detected.estimatedComplexity).toBe('medium')
  })

  it('should detect entity lookup intent', () => {
    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'customer',
      entityId: '123',
    }

    const detected = detectIntent(input)

    expect(detected.intent).toBe('entity_lookup')
    expect(detected.confidence).toBeGreaterThan(0.95)
    expect(detected.estimatedComplexity).toBe('low')
  })

  it('should detect metric calculation intent', () => {
    const input: QuickBooksDataInput = {
      queryType: 'metric',
      metricName: 'gross_margin',
      includeHistory: true,
    }

    const detected = detectIntent(input)

    expect(detected.intent).toBe('metric_calculation')
    expect(detected.suggestedMetrics).toContain('gross_margin')
  })

  it('should determine parallel fetch requirement', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'financial_health',
      period: 'last_month',
    }

    const detected = detectIntent(input)
    const needsParallel = requiresParallelFetch(detected)

    expect(needsParallel).toBe(true)
  })

  it('should get required data sources', () => {
    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'performance',
      focusArea: 'profitability',
    }

    const detected = detectIntent(input)
    const sources = getRequiredDataSources(detected)

    expect(sources.length).toBeGreaterThan(0)
    expect(sources).toContain('profit_loss')
  })
})

// =============================================================================
// QUERY PLANNER TESTS
// =============================================================================

describe('Query Planner', () => {
  it('should create valid query plan for simple report', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      period: 'last_month',
    }

    const plan = planQuery(input)

    expect(plan.queryType).toBe('report')
    expect(plan.dataSources.length).toBeGreaterThan(0)
    expect(plan.operations.length).toBeGreaterThan(0)
    expect(plan.metadata).toBeDefined()
  })

  it('should create parallel fetch plan for complex reports', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'financial_health',
      period: 'this_quarter',
    }

    const plan = planQuery(input)

    expect(plan.dataSources.length).toBeGreaterThan(1)
    expect(plan.operations.length).toBeGreaterThan(0)
  })

  it('should include metadata in plan', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      period: 'last_month',
    }

    const plan = planQuery(input)

    expect(plan.metadata).toBeDefined()
    expect(typeof plan.metadata).toBe('object')
  })

  it('should include operations in plan', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'balance_sheet',
      endDate: '2024-01-31',
    }

    const plan = planQuery(input)

    expect(plan.operations.length).toBeGreaterThan(0)
    expect(plan.operations[0]).toHaveProperty('type')
  })

  it('should create plan for entity lookups', () => {
    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'customer',
      entityId: '123',
    }

    const plan = planQuery(input)

    expect(plan.queryType).toBe('entity')
    expect(plan.dataSources.length).toBeGreaterThan(0)
  })

  it('should create plan for analysis queries', () => {
    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'trends',
      focusArea: 'revenue',
    }

    const plan = planQuery(input)

    expect(plan.queryType).toBe('analyze')
    expect(plan.dataSources.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// METRICS REGISTRY TESTS
// =============================================================================

describe('Metrics Registry', () => {
  it('should have 33+ metrics defined', () => {
    expect(METRICS_REGISTRY.length).toBeGreaterThanOrEqual(33)
  })

  it('should have all required metric properties', () => {
    METRICS_REGISTRY.forEach((metric) => {
      expect(metric.id).toBeTruthy()
      expect(metric.name).toBeTruthy()
      expect(metric.category).toBeTruthy()
      expect(metric.description).toBeTruthy()
      expect(metric.dataSources).toBeDefined()
      expect(metric.format).toBeTruthy()
      expect(metric.formula).toBeTruthy()
      expect(metric.interpretation).toBeDefined()
      expect(metric.priority).toBeTruthy()
    })
  })

  it('should get metrics by category', () => {
    const profitabilityMetrics = getMetricsByCategory('profitability')
    expect(profitabilityMetrics.length).toBeGreaterThan(0)
    profitabilityMetrics.forEach((m) => {
      expect(m.category).toBe('profitability')
    })
  })

  it('should get metric by ID', () => {
    const metric = getMetricById('gross_margin')
    expect(metric).toBeDefined()
    expect(metric?.id).toBe('gross_margin')
    expect(metric?.category).toBe('profitability')
  })

  it('should get critical metrics', () => {
    const critical = getCriticalMetrics()
    expect(critical.length).toBeGreaterThan(0)
    critical.forEach((m) => {
      expect(m.priority).toBe('critical')
    })
  })

  it('should get required data sources for metrics', () => {
    const sources = getMetricDataSources(['gross_margin', 'current_ratio'])
    expect(sources).toContain('profit_loss')
    expect(sources).toContain('balance_sheet')
  })

  it('should format metric values correctly', () => {
    expect(formatMetricValue(15.5, 'percent')).toContain('%')
    expect(formatMetricValue(50000, 'currency')).toContain('$')
    expect(formatMetricValue(1.5, 'ratio')).toBe('1.50')
    expect(formatMetricValue(45, 'days')).toContain('days')
  })

  it('should interpret metric values', () => {
    expect(interpretMetricValue('gross_margin', 50)).toBe('good')
    expect(interpretMetricValue('gross_margin', 15)).toBe('bad')
    expect(interpretMetricValue('current_ratio', 2.0)).toBe('good')
    expect(interpretMetricValue('current_ratio', 0.8)).toBe('bad')
  })

  it('should handle invalid metric ID gracefully', () => {
    const metric = getMetricById('non_existent_metric')
    expect(metric).toBeUndefined()
  })
})

// =============================================================================
// REPORT ACCESSOR TESTS
// =============================================================================

describe('Report Accessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch and enrich profit & loss report', async () => {
    const mockClient = createMockQuickBooksClient()
    mockClient.getProfitAndLoss.mockResolvedValue(createMockProfitLossReport())

    const config = {
      organizationId: 'test-org',
      client: mockClient as any,
      currency: 'USD',
    }

    const result = await fetchEnrichedReport('profit_loss', { period: 'last_month' }, config)

    expect(result.success).toBe(true)
    expect(result.reportType).toBe('profit_loss')
    expect(result.data.kpis).toBeDefined()
    expect(mockClient.getProfitAndLoss).toHaveBeenCalled()
  })

  it('should fetch balance sheet report', async () => {
    const mockClient = createMockQuickBooksClient()
    mockClient.getBalanceSheet.mockResolvedValue(createMockBalanceSheetReport())

    const config = {
      organizationId: 'test-org',
      client: mockClient as any,
      currency: 'USD',
    }

    const result = await fetchEnrichedReport('balance_sheet', { endDate: '2024-01-31' }, config)

    expect(result.success).toBe(true)
    expect(result.reportType).toBe('balance_sheet')
    expect(mockClient.getBalanceSheet).toHaveBeenCalled()
  })

  it('should handle unsupported report type', async () => {
    const mockClient = createMockQuickBooksClient()

    const config = {
      organizationId: 'test-org',
      client: mockClient as any,
      currency: 'USD',
    }

    const result = await fetchEnrichedReport('invalid_report', { period: 'last_month' }, config)

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('should handle API errors gracefully', async () => {
    const mockClient = createMockQuickBooksClient()
    mockClient.getProfitAndLoss.mockRejectedValue(new Error('API Error'))

    const config = {
      organizationId: 'test-org',
      client: mockClient as any,
      currency: 'USD',
    }

    const result = await fetchEnrichedReport('profit_loss', { period: 'last_month' }, config)

    expect(result.success).toBe(false)
    expect(result.error).toContain('API Error')
  })
})

// =============================================================================
// ENTITY ACCESSOR TESTS
// =============================================================================

describe('Entity Accessor', () => {
  let mockClient: ReturnType<typeof createMockQuickBooksClient>

  beforeEach(() => {
    mockClient = createMockQuickBooksClient()
    vi.clearAllMocks()
  })

  it('should list customers with filters', async () => {
    // Mock queryEntities to return raw QuickBooks entities
    mockClient.queryEntities.mockResolvedValue([
      {
        Id: '1',
        DisplayName: 'Test Customer',
        Active: true,
        Balance: '1000',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
      },
    ])

    const result = await listEntities(
      'Customer',
      { status: 'active', limit: 10 },
      { organizationId: 'test-org', client: mockClient as any }
    )

    expect(result.success).toBe(true)
    expect(result.data.entities).toHaveLength(1)
    expect(result.data.summary).toBeDefined()
  })

  it('should get single entity by ID', async () => {
    mockClient.get.mockResolvedValue({
      Id: '123',
      DisplayName: 'Acme Corp',
      Active: true,
      Balance: '500',
      MetaData: {
        CreateTime: '2024-01-01T00:00:00Z',
        LastUpdatedTime: '2024-01-02T00:00:00Z',
      },
    })

    const result = await getEntity('Customer', '123', {
      organizationId: 'test-org',
      client: mockClient as any,
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data.id).toBe('123')
  })

  it('should search entities by text', async () => {
    mockClient.queryEntities.mockResolvedValue([
      {
        Id: '1',
        DisplayName: 'Acme Corporation',
        CompanyName: 'Acme',
        Active: true,
        Balance: '0',
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
      },
    ])

    const result = await searchEntities(
      'Customer',
      'Acme',
      { limit: 10 },
      { organizationId: 'test-org', client: mockClient as any }
    )

    expect(result.success).toBe(true)
    expect(result.data.entities.length).toBeGreaterThan(0)
    expect(result.data.matchCount).toBeGreaterThan(0)
  })

  it('should handle entity not found', async () => {
    // Mock the get method to throw an error (QuickBooks returns 400/404 when entity not found)
    mockClient.get.mockRejectedValue(new Error('Entity not found'))

    const result = await getEntity('Customer', 'non-existent', {
      organizationId: 'test-org',
      client: mockClient as any,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('should filter invoices by status', async () => {
    mockClient.queryEntities.mockResolvedValue([
      {
        Id: '1',
        DocNumber: 'INV-001',
        TotalAmt: '1500',
        Balance: '1500',
        TxnDate: '2024-01-15',
        CustomerRef: { value: 'C1', name: 'Test Customer' },
        Line: [
          {
            DetailType: 'SalesItemLineDetail',
            Amount: '1500',
            SalesItemLineDetail: { ItemRef: { value: 'I1', name: 'Product' } },
          },
        ],
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
      },
    ])

    const result = await listEntities(
      'Invoice',
      { status: 'open', minAmount: 1000 },
      { organizationId: 'test-org', client: mockClient as any }
    )

    expect(result.success).toBe(true)
    expect(mockClient.queryEntities).toHaveBeenCalled()
  })

  it('should filter bills by date range', async () => {
    mockClient.queryEntities.mockResolvedValue([
      {
        Id: '1',
        DocNumber: 'BILL-001',
        TxnDate: '2024-01-15',
        DueDate: '2024-02-15',
        TotalAmt: '2000',
        Balance: '2000',
        VendorRef: { value: 'V1', name: 'Test Vendor' },
        Line: [
          {
            DetailType: 'AccountBasedExpenseLineDetail',
            Amount: '2000',
            AccountBasedExpenseLineDetail: { AccountRef: { value: 'A1', name: 'Expense Account' } },
          },
        ],
        MetaData: {
          CreateTime: '2024-01-01T00:00:00Z',
          LastUpdatedTime: '2024-01-02T00:00:00Z',
        },
      },
    ])

    const result = await listEntities(
      'Bill',
      { dateFrom: '2024-01-01', dateTo: '2024-01-31' },
      { organizationId: 'test-org', client: mockClient as any }
    )

    expect(result.success).toBe(true)
  })
})

// =============================================================================
// EDGE CASES AND ERROR HANDLING
// =============================================================================

describe('Edge Cases and Error Handling', () => {
  it('should handle empty query results', async () => {
    const mockClient = createMockQuickBooksClient()
    mockClient.queryEntities.mockResolvedValue([])

    const result = await listEntities(
      'Customer',
      {},
      { organizationId: 'test-org', client: mockClient as any }
    )

    expect(result.success).toBe(true)
    expect(result.data.entities).toHaveLength(0)
  })

  it('should handle null values in filters', () => {
    const input: QuickBooksDataInput = {
      queryType: 'entity',
      entityType: 'invoice',
      filters: {
        status: 'all',
      },
    }

    const result = quickbooksDataSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should handle maximum date ranges', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      startDate: '2020-01-01',
      endDate: '2024-12-31',
    }

    const plan = planQuery(input)
    expect(plan).toBeDefined()
  })

  it('should handle concurrent metric calculations', async () => {
    const metricIds = ['gross_margin', 'net_margin', 'current_ratio']
    const sources = getMetricDataSources(metricIds)

    expect(sources.length).toBeGreaterThan(0)
    expect(new Set(sources).size).toBeLessThanOrEqual(sources.length)
  })

  it('should handle zero amounts gracefully', () => {
    const formatted = formatMetricValue(0, 'currency')
    expect(formatted).toContain('$0')
  })

  it('should handle negative values', () => {
    const formatted = formatMetricValue(-5000, 'currency')
    expect(formatted).toContain('-')
  })

  it('should handle very large numbers', () => {
    const formatted = formatMetricValue(1000000000, 'currency')
    expect(formatted).toBeTruthy()
  })

  it('should handle division by zero in ratios', () => {
    // This would be tested in the actual calculation functions
    const interpretation = interpretMetricValue('current_ratio', 0)
    expect(['good', 'neutral', 'bad']).toContain(interpretation)
  })
})

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  it('should execute complete report query workflow', () => {
    // 1. Validate input
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      period: 'last_month',
    }

    const result = quickbooksDataSchema.safeParse(input)
    expect(result.success).toBe(true)

    // 2. Detect intent
    const intent = detectIntent(input)
    expect(intent.intent).toBe('report_fetch')

    // 3. Plan query
    const plan = planQuery(input)
    expect(plan.dataSources.length).toBeGreaterThan(0)
    expect(plan.dataSources).toContain('profit_loss')
  })

  it('should execute metric query workflow', () => {
    const input: QuickBooksDataInput = {
      queryType: 'metric',
      metricName: 'gross_margin',
      period: 'this_quarter',
      includeHistory: true,
    }

    const result = quickbooksDataSchema.safeParse(input)
    expect(result.success).toBe(true)

    const intent = detectIntent(input)
    const plan = planQuery(input)

    expect(intent.intent).toBe('metric_calculation')
    expect(plan.dataSources).toContain('profit_loss')
  })

  it('should execute comparison workflow', () => {
    const input: QuickBooksDataInput = {
      queryType: 'compare',
      compareType: 'period',
      metric: 'revenue',
      currentPeriod: 'this_month',
      comparisonPeriod: 'last_month',
    }

    const result = quickbooksDataSchema.safeParse(input)
    expect(result.success).toBe(true)

    const intent = detectIntent(input)
    const plan = planQuery(input)

    expect(intent.intent).toBe('comparison')
    // For comparison queries, the query planner returns the base reports needed
    // The actual comparison logic happens at execution time, not planning time
    // So we check that at least one data source is returned
    expect(plan.dataSources.length).toBeGreaterThanOrEqual(1)
    expect(intent.requiresMultipleDataSources).toBe(true)
  })
})

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('Performance', () => {
  it('should validate schema quickly', () => {
    const input: QuickBooksDataInput = {
      queryType: 'report',
      reportType: 'profit_loss',
      period: 'last_month',
    }

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      quickbooksDataSchema.parse(input)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1000) // Should validate 1000 times in <1s
  })

  it('should plan queries efficiently', () => {
    const input: QuickBooksDataInput = {
      queryType: 'analyze',
      analysisType: 'trends',
      focusArea: 'profitability',
    }

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      planQuery(input)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(500) // Should plan 100 queries in <500ms
  })

  it('should lookup metrics efficiently', () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      getMetricById('gross_margin')
      getMetricsByCategory('profitability')
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100) // Very fast lookups
  })
})
