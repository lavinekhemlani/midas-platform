import {
  KPIId,
  KPIResult,
  FinancialData,
  KPIFormat,
  KPICalculationError
} from '../types'
import { getKPIDefinition, getAllKPIIds, getDashboardKPIs } from './registry'

/**
 * Main KPI Calculation Engine
 * Handles all KPI calculations with proper error handling and formatting
 * See: docs/api-v2/implementation/phase-1-calculator.md
 */
export class KPICalculationEngine {
  /**
   * Calculate a single KPI
   */
  calculateSingle(kpiId: KPIId, data: FinancialData): KPIResult {
    const definition = getKPIDefinition(kpiId)

    try {
      // Calculate the raw value
      const value = definition.calculate(data)

      // Validate the result if validator provided
      if (definition.validate && !definition.validate(value, data)) {
        console.warn(`Validation failed for ${kpiId}: value=${value}`)
      }

      // Format the value for display
      const formatted = this.formatValue(
        value,
        definition.format,
        definition.precision,
        data.profile?.currency
      )

      // Determine confidence level based on data quality
      const confidence = this.determineConfidence(kpiId, data)

      // Determine the data source used
      const source = this.determineSource(kpiId, data)

      // Calculate data quality metrics
      const dataQuality = this.assessDataQuality(kpiId, data)

      // Get any warnings
      const warnings = this.getWarnings(kpiId, data, value)

      // Generate semantic interpretation
      const semantic = this.generateSemantic(kpiId, value, definition)

      return {
        id: kpiId,
        value,
        formatted,
        confidence,
        source,
        dataQuality,
        warnings,
        metadata: {
          calculatedAt: new Date(),
          periodStart: data.period?.start,
          periodEnd: data.period?.end,
          fallbackUsed: source.includes('fallback')
        },
        semantic
      }
    } catch (error) {
      console.error(`Error calculating ${kpiId}:`, error)

      // Return zero value with error information
      return {
        id: kpiId,
        value: 0,
        formatted: this.formatValue(0, definition.format, definition.precision, data.profile?.currency),
        confidence: 'low',
        source: 'error',
        warnings: [`Calculation failed: ${(error as Error).message}`],
        metadata: {
          calculatedAt: new Date()
        }
      }
    }
  }

  /**
   * Calculate multiple KPIs in batch
   */
  calculateBatch(kpiIds: KPIId[], data: FinancialData): Record<KPIId, KPIResult> {
    const results: Partial<Record<KPIId, KPIResult>> = {}

    for (const kpiId of kpiIds) {
      results[kpiId] = this.calculateSingle(kpiId, data)
    }

    return results as Record<KPIId, KPIResult>
  }

  /**
   * Calculate all available KPIs
   */
  calculateAll(data: FinancialData): Record<KPIId, KPIResult> {
    const allKpiIds = getAllKPIIds()
    return this.calculateBatch(allKpiIds, data)
  }

  /**
   * Calculate dashboard KPIs (essential metrics)
   */
  calculateDashboard(data: FinancialData): Record<KPIId, KPIResult> {
    const dashboardKpis = getDashboardKPIs()
    return this.calculateBatch(dashboardKpis, data)
  }

  /**
   * Format value based on type and precision
   */
  private formatValue(
    value: number,
    format: KPIFormat,
    precision: number,
    currency: string = 'USD'
  ): string {
    switch (format) {
      case 'currency':
        // Use compact notation for large values
        if (Math.abs(value) >= 1000000) {
          const millions = value / 1000000
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          }).format(millions).replace(/(\d+\.?\d*)/, '$1M')
        } else if (Math.abs(value) >= 10000) {
          const thousands = value / 1000
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          }).format(thousands).replace(/(\d+\.?\d*)/, '$1k')
        } else {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: precision,
            maximumFractionDigits: precision
          }).format(value)
        }

      case 'percentage':
        return `${value.toFixed(precision)}%`

      case 'ratio':
        if (value >= 999) return '∞'
        return value.toFixed(precision)

      case 'days':
        return `${Math.round(value)} days`

      case 'months':
        if (value >= 999) return 'Infinite'
        return `${Math.round(value)} months`

      default:
        return value.toFixed(precision)
    }
  }

  /**
   * Determine confidence level based on data quality and sources
   */
  private determineConfidence(kpiId: KPIId, data: FinancialData): 'high' | 'medium' | 'low' {
    const definition = getKPIDefinition(kpiId)

    // Check if primary data sources are available
    const hasPrimarySource = definition.dataSources.some(source => {
      switch (source) {
        case 'pnl':
          return data.pnl && Object.keys(data.pnl).length > 0
        case 'balanceSheet':
          return data.balanceSheet && Object.keys(data.balanceSheet).length > 0
        case 'cashflow':
          return data.cashFlow && Object.keys(data.cashFlow).length > 0
        default:
          return false
      }
    })

    if (hasPrimarySource) return 'high'

    // Check for fallback data
    const hasFallbackData =
      (data.invoices && data.invoices.length > 0) ||
      (data.deposits && data.deposits.length > 0) ||
      (data.bankAccounts && data.bankAccounts.length > 0)

    if (hasFallbackData) return 'medium'

    return 'low'
  }

  /**
   * Determine which data source was actually used
   */
  private determineSource(kpiId: KPIId, data: FinancialData): string {
    const definition = getKPIDefinition(kpiId)

    // Check primary sources in order of preference
    if (definition.dataSources.includes('pnl') && data.pnl?.total_income) {
      return 'pnl_report'
    }

    if (definition.dataSources.includes('balanceSheet') && data.balanceSheet?.total_assets) {
      return 'balance_sheet'
    }

    if (definition.dataSources.includes('cashflow') && data.cashFlow) {
      return 'cash_flow_statement'
    }

    // Check fallback sources
    if (data.invoices?.length) {
      return 'invoices_fallback'
    }

    if (data.deposits?.length) {
      return 'deposits_fallback'
    }

    if (data.bankAccounts?.length) {
      return 'bank_accounts_fallback'
    }

    return 'calculated'
  }

  /**
   * Assess data quality for the calculation
   */
  private assessDataQuality(kpiId: KPIId, data: FinancialData): {
    completeness: number
    recency: number
    accuracy: number
  } {
    const definition = getKPIDefinition(kpiId)

    // Assess completeness (0-100)
    let requiredFields = 0
    let availableFields = 0

    definition.dataSources.forEach(source => {
      if (source === 'pnl') {
        requiredFields += 5 // Key P&L fields
        if (data.pnl) {
          if (data.pnl.total_income !== undefined) availableFields++
          if (data.pnl.total_expenses !== undefined) availableFields++
          if (data.pnl.net_income !== undefined) availableFields++
          if (data.pnl.cost_of_goods_sold !== undefined) availableFields++
          if (data.pnl.gross_profit !== undefined) availableFields++
        }
      }
      if (source === 'balanceSheet') {
        requiredFields += 3
        if (data.balanceSheet) {
          if (data.balanceSheet.total_assets !== undefined) availableFields++
          if (data.balanceSheet.total_liabilities !== undefined) availableFields++
          if (data.balanceSheet.total_equity !== undefined) availableFields++
        }
      }
    })

    const completeness = requiredFields > 0 ? (availableFields / requiredFields) * 100 : 0

    // Assess recency (simplified - would need actual date comparison)
    const recency = data.period?.end ? 90 : 50 // 90% if period specified, 50% otherwise

    // Assess accuracy (based on accounting basis and provider)
    let accuracy = 80 // Base accuracy
    if (data.profile?.accountingBasis === 'accrual') accuracy += 10
    if (data.profile?.quickbooksVersion) accuracy += 10

    return {
      completeness: Math.round(completeness),
      recency: Math.round(recency),
      accuracy: Math.round(accuracy)
    }
  }

  /**
   * Get warnings for a KPI calculation
   */
  private getWarnings(kpiId: KPIId, data: FinancialData, value: number): string[] {
    const warnings: string[] = []
    const definition = getKPIDefinition(kpiId)

    // Check for missing primary data
    if (definition.dataSources.includes('pnl') && !data.pnl) {
      warnings.push('P&L data not available, using fallback calculations')
    }

    if (definition.dataSources.includes('balanceSheet') && !data.balanceSheet) {
      warnings.push('Balance sheet not available, some metrics may be incomplete')
    }

    // Check for zero revenue issues
    if (
      ['gross_margin', 'net_margin', 'ebitda_margin'].includes(kpiId) &&
      (!data.pnl?.total_income || data.pnl.total_income === 0)
    ) {
      warnings.push('Revenue is zero, margin calculations not meaningful')
    }

    // Check for negative equity
    if (
      ['roe', 'debt_to_equity'].includes(kpiId) &&
      data.balanceSheet?.total_equity !== undefined &&
      data.balanceSheet.total_equity <= 0
    ) {
      warnings.push('Negative or zero equity affects ratio calculations')
    }

    // Cash basis accounting warning
    if (data.profile?.accountingBasis === 'cash') {
      warnings.push('Cash basis accounting may affect timing of revenue/expense recognition')
    }

    // Check against benchmarks if available
    if (definition.benchmark && value !== 0) {
      if (definition.format === 'percentage' || definition.format === 'ratio') {
        if (value < definition.benchmark.poor) {
          warnings.push(`Value below typical range (benchmark: >${definition.benchmark.poor})`)
        }
      }
    }

    return warnings
  }

  /**
   * Generate semantic interpretation of the KPI value
   */
  private generateSemantic(
    kpiId: KPIId,
    value: number,
    definition: any
  ): KPIResult['semantic'] {
    // Generate meaning
    const meaning = definition.description

    // Generate interpretation based on benchmarks
    let interpretation = ''
    if (definition.benchmark) {
      if (value >= definition.benchmark.good) {
        interpretation = `Excellent - above industry standards`
      } else if (value >= definition.benchmark.average) {
        interpretation = `Good - meeting industry standards`
      } else if (value >= definition.benchmark.poor) {
        interpretation = `Fair - below industry average`
      } else {
        interpretation = `Needs improvement - significantly below standards`
      }
    } else {
      // Generic interpretations
      if (definition.format === 'currency' && value < 0) {
        interpretation = 'Negative value indicates loss or deficit'
      } else if (definition.format === 'percentage' && value < 0) {
        interpretation = 'Negative percentage indicates loss'
      } else if (definition.format === 'days' && value > 60) {
        interpretation = 'Extended timeline may impact cash flow'
      } else {
        interpretation = 'Value within operational range'
      }
    }

    // Generate benchmark string if available
    let benchmark: string | undefined
    if (definition.benchmark) {
      benchmark = `Industry average: ${definition.benchmark.average}`
      if (definition.format === 'percentage') {
        benchmark += '%'
      } else if (definition.format === 'currency') {
        benchmark = `Industry average: $${(definition.benchmark.average / 1000).toFixed(0)}k`
      }
    }

    return {
      meaning,
      interpretation,
      benchmark
    }
  }
}

// Export singleton instance
export const calculationEngine = new KPICalculationEngine()