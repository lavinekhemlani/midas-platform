// src/components/quickbooks/shared/types.ts
import { Memory } from '@/ai/memory/types'

export interface QuickBooksComponentProps {
  // Web rendering props
  className?: string
  theme?: 'dark' | 'light' | 'dark'

  // PDF export props
  exportable?: boolean
  printOptimized?: boolean

  // Memory integration
  memories?: Memory[]
  showMemoryCitations?: boolean

  // Loading states
  isLoading?: boolean
  error?: string | null
}

export interface ChartComponentProps extends QuickBooksComponentProps {
  height?: number
  width?: number | string
  showLegend?: boolean
  showTooltip?: boolean
  animate?: boolean
}

export interface MetricCardProps extends QuickBooksComponentProps {
  title: string
  value: number | string
  previousValue?: number | string
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    percentage?: number
  }
  icon?: React.ComponentType<any>
  iconColor?: string
  format?: 'currency' | 'percentage' | 'number' | 'text'
  currency?: string
  decimals?: number
  tooltip?: string
  description?: string
  learnTerm?: string
}

export interface PerformanceMetrics {
  revenue: number
  expenses: number
  profit: number
  profit_margin: number
  period?: {
    start_date: string
    end_date: string
  }
}

export interface MemoryCitation {
  memoryId: string
  type: 'expense' | 'revenue' | 'contract' | 'forecast_adjustment'
  impact: string
  date: string
}
