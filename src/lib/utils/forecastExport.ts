// src/lib/utils/forecastExport.ts

/**
 * Forecast Export Utilities
 *
 * CSV export for cash flow forecast data including periods, line items,
 * assumptions, and scheduled memories.
 */

import type { ForecastData, ForecastLineItem, ScheduledMemory } from '@/types/forecasting'
import { formatPnLCurrency } from './currency'

// =============================================================================
// Helpers
// =============================================================================

function escapeCSVValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

// =============================================================================
// CSV Export
// =============================================================================

export function exportForecastToCSV(data: ForecastData): void {
  const lines: string[] = []
  const currency = data.currency || 'USD'
  const horizonLabel = data.horizon === '13-week' ? '13-Week' : '6-Month'

  // Metadata
  lines.push(escapeCSVValue(`Cash Flow Forecast - ${horizonLabel}`))
  lines.push(`"${data.startDate} to ${data.endDate}"`)
  lines.push(`"Currency: ${currency}"`)
  lines.push(`"Generated: ${getTimestamp()}"`)
  lines.push('')

  // Assumptions
  lines.push('Assumptions')
  lines.push(`Growth Rate,${data.assumptions.growthRate}%`)
  lines.push(`Inflow Growth Rate,${data.assumptions.inflowGrowthRate}%`)
  lines.push(`Outflow Growth Rate,${data.assumptions.outflowGrowthRate}%`)
  lines.push(`Rolling Average,${data.assumptions.rollingAverageDays} days`)
  lines.push('')

  // Summary KPIs
  lines.push('Summary')
  lines.push(`Current Cash,${data.summary.currentCash.toFixed(2)}`)
  lines.push(`Projected Ending Cash,${data.summary.projectedEndingCash.toFixed(2)}`)
  lines.push(`Net Change,${data.summary.netChange.toFixed(2)}`)
  lines.push(`Total Projected Inflow,${data.summary.totalProjectedInflow.toFixed(2)}`)
  lines.push(`Total Projected Outflow,${data.summary.totalProjectedOutflow.toFixed(2)}`)
  if (data.summary.runway !== null) {
    lines.push(`Runway (months),${data.summary.runway}`)
  }
  lines.push(`Lowest Cash Point,"${data.summary.lowestCashPoint.date}: ${data.summary.lowestCashPoint.amount.toFixed(2)}"`)
  lines.push(`Highest Cash Point,"${data.summary.highestCashPoint.date}: ${data.summary.highestCashPoint.amount.toFixed(2)}"`)
  lines.push('')

  // Period summary
  const periodHeaders = ['Period', ...data.periods.map((p) => escapeCSVValue(p.label))]
  lines.push(periodHeaders.join(','))

  const rows: Record<string, (string | number)[]> = {
    'Inflow': data.periods.map((p) => p.inflow.toFixed(2)),
    'Outflow': data.periods.map((p) => p.outflow.toFixed(2)),
    'Net Cash Flow': data.periods.map((p) => p.forecast.toFixed(2)),
    'Cumulative Cash': data.periods.map((p) => p.cumulativeCash.toFixed(2)),
    'Memory Adjustment': data.periods.map((p) => p.memoryAdjustment.toFixed(2)),
  }

  for (const [label, values] of Object.entries(rows)) {
    lines.push([escapeCSVValue(label), ...values].join(','))
  }
  lines.push('')

  // Line items
  lines.push('Line Items')
  const lineItemHeaders = ['Category', 'Name', 'Historical Avg', ...data.periods.map((p) => escapeCSVValue(p.label))]
  lines.push(lineItemHeaders.join(','))

  function writeLineItem(item: ForecastLineItem) {
    const indent = '  '.repeat(item.level)
    const values = data.periods.map((_, i) => {
      const val = item.values[`period_${i}`]
      return val !== undefined ? val.toFixed(2) : ''
    })
    lines.push(
      [
        escapeCSVValue(item.category),
        escapeCSVValue(indent + item.name),
        item.historicalAvg.toFixed(2),
        ...values,
      ].join(',')
    )
    if (item.children) {
      item.children.forEach(writeLineItem)
    }
  }

  data.lineItems.cashFlow.forEach(writeLineItem)
  lines.push('')

  // Scheduled memories
  if (data.memories.expenses.length > 0 || data.memories.income.length > 0) {
    lines.push('Scheduled Memories')
    lines.push('Type,Description,Amount,Date,Recurring,Frequency')

    const writeMemory = (m: ScheduledMemory) => {
      lines.push(
        [
          m.type,
          escapeCSVValue(m.description),
          m.amount.toFixed(2),
          m.date,
          m.recurring ? 'Yes' : 'No',
          m.frequency || '',
        ].join(',')
      )
    }

    data.memories.income.forEach(writeMemory)
    data.memories.expenses.forEach(writeMemory)
    lines.push('')
    lines.push(`Total Income Impact,${data.memories.totalIncomeImpact.toFixed(2)}`)
    lines.push(`Total Expense Impact,${data.memories.totalExpenseImpact.toFixed(2)}`)
    lines.push(`Net Impact,${data.memories.netImpact.toFixed(2)}`)
  }

  const filename = `cash-flow-forecast-${data.horizon}-${new Date().toISOString().split('T')[0]}.csv`
  downloadFile(lines.join('\n'), filename, 'text/csv;charset=utf-8')
}
