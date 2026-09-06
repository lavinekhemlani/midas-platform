// Report System Type Definitions

export type ReportType =
  | 'profit_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'aged_receivables'
  | 'aged_payables'
  | 'summary'
  | 'custom'

export type ReportPeriod =
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'last_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom'

export interface ReportMetadata {
  reportType: ReportType
  reportName: string
  organizationName: string
  organizationId: string
  currency: string
  dateRange: {
    start: string // YYYY-MM-DD
    end: string // YYYY-MM-DD
  }
  generatedAt: string
  provider: string
  version?: string
}

export interface KPIData {
  id: string
  label: string
  value: number | string
  metric?: string // QuickBooks metric name (e.g., 'gross_margin_pct', 'runway_months')
  format: 'currency' | 'percentage' | 'number' | 'text'
  change?: number
  changeLabel?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: string
  tooltip?: string
}

export interface ChartData {
  id: string
  title: string
  type: 'line' | 'bar' | 'area' | 'pie' | 'stacked-bar'
  data: any[]
  dataKeys: string[] | { key: string; color?: string; name?: string }[]
  xKey?: string
  config?: {
    height?: number
    colors?: string[]
    showGrid?: boolean
    showLegend?: boolean
    showTooltip?: boolean
  }
}

export interface TableData {
  id: string
  title: string
  columns: {
    key: string
    header: string
    align?: 'left' | 'center' | 'right'
    format?: 'currency' | 'percentage' | 'number' | 'date'
    sortable?: boolean
    width?: string
  }[]
  data: any[]
  config?: {
    striped?: boolean
    hoverable?: boolean
    sortable?: boolean
  }
}

export interface InsightData {
  id: string
  title: string
  description: string
  type: 'info' | 'warning' | 'success' | 'alert'
  icon?: string
  actions?: {
    label: string
    action: string
  }[]
}

export interface ReportSection {
  id: string
  title: string
  subtitle?: string
  grid?: {
    columns: number
    gap?: 'sm' | 'md' | 'lg' | 'xl'
  }
  components: ReportComponent[]
}

export interface ReportComponent {
  id: string
  type: 'kpi' | 'chart' | 'table' | 'insight' | 'text' | 'custom'
  gridSpan?: {
    cols: number
    rows?: number
  }
  data: KPIData | ChartData | TableData | InsightData | any
}

export interface ReportLayout {
  grid: {
    columns: 12 | 6 | 4 | 3 | 2 | 1
    gap?: 'sm' | 'md' | 'lg' | 'xl'
  }
  sections: ReportSection[]
}

export interface ReportData {
  metadata: ReportMetadata
  layout: ReportLayout
  data: {
    kpis: KPIData[]
    charts: ChartData[]
    tables: TableData[]
    insights: InsightData[]
    custom?: Record<string, any>
  }
  summary?: {
    highlights: string[]
    recommendations: string[]
  }
}

export interface ReportRequest {
  reportType: ReportType
  startDate: string
  endDate: string
  organizationId?: string
  format?: 'json' | 'pdf' | 'excel'
  includeDetails?: boolean
  filters?: Record<string, any>
}

export interface ReportResponse {
  success: boolean
  data?: ReportData
  error?: {
    code: string
    message: string
    details?: any
  }
  cached?: boolean
  cacheExpiry?: string
}

// Export functions for common report operations
export function isFinancialReport(type: ReportType): boolean {
  return ['profit_loss', 'balance_sheet', 'cash_flow'].includes(type)
}

export function isAgedReport(type: ReportType): boolean {
  return ['aged_receivables', 'aged_payables'].includes(type)
}

export function getReportDisplayName(type: ReportType): string {
  const names: Record<ReportType, string> = {
    profit_loss: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Cash Flow',
    aged_receivables: 'Aged Receivables',
    aged_payables: 'Aged Payables',
    summary: 'Financial Summary',
    custom: 'Custom Report',
  }
  return names[type] || 'Report'
}
