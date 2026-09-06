// src/app/(main)/components/AccountsReceivableAging.tsx
'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface AgingBucket {
  range: string
  amount: number
  count: number
  percentage: number
  customers?: string[]
}

interface AccountsReceivableAgingProps {
  data: AgingBucket[]
  totalAmount: number
  currency?: string
  className?: string
}

export default function AccountsReceivableAging({
  data,
  totalAmount,
  currency: propCurrency,
  className
}: AccountsReceivableAgingProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)

  const COLORS = {
    'Current': '#10b981',      // emerald
    '1-30 days': '#3b82f6',    // blue
    '31-60 days': '#f59e0b',   // amber
    '61-90 days': '#f97316',   // orange
    'Over 90 days': '#ef4444'  // red
  }

  const getBucketColor = (range: string) => {
    return COLORS[range as keyof typeof COLORS] || '#6b7280'
  }

  const getBucketStatus = (range: string) => {
    if (range === 'Current') return 'good'
    if (range === '1-30 days') return 'normal'
    if (range === '31-60 days') return 'warning'
    return 'critical'
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'good': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      case 'normal': return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      case 'warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  // Calculate weighted average days
  const weightedDays = data.reduce((sum, bucket) => {
    const midpoint = bucket.range === 'Current' ? 0 :
                     bucket.range === '1-30 days' ? 15 :
                     bucket.range === '31-60 days' ? 45 :
                     bucket.range === '61-90 days' ? 75 : 120
    return sum + (midpoint * bucket.percentage / 100)
  }, 0)

  // Calculate health score (100 = all current, 0 = all over 90 days)
  const healthScore = Math.max(0, Math.min(100, 
    100 - (weightedDays / 90 * 100)
  ))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="glass-luxury-card p-2 border border-amber-500/10 bg-opacity-80 backdrop-blur-sm">
          <p className="font-medium theme-text-primary text-xs mb-1">{label}</p>
          <div className="space-y-0.5">
            <p className="text-xs theme-text-secondary">
              {formatCurrency(data.amount, { currency })}
            </p>
            <p className="text-xs theme-text-secondary">
              {data.count} invoices ({data.percentage.toFixed(1)}%)
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  const handleBarClick = (data: any) => {
    setSelectedBucket(selectedBucket === data.range ? null : data.range)
  }

  return (
    <Card className={cn("chart-container", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="chart-title">
            <Calendar className="w-5 h-5 text-orange-500" />
            Accounts Receivable Aging
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-orange-500/30 text-orange-400">
              {formatCurrency(totalAmount, { currency, compact: true })} Total
            </Badge>
            <Badge 
              variant="outline" 
              className={cn(
                healthScore >= 80 ? 'border-emerald-500/30 text-emerald-400' :
                healthScore >= 60 ? 'border-amber-500/30 text-amber-400' :
                'border-red-500/30 text-red-400'
              )}
            >
              {healthScore.toFixed(0)}% Health
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-emerald-500/5 rounded-lg">
            <Clock className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Current</div>
            <div className="text-lg font-bold text-emerald-400">
              {formatCurrency(
                data.find(d => d.range === 'Current')?.amount || 0, 
                { currency, compact: true }
              )}
            </div>
          </div>
          
          <div className="text-center p-3 bg-amber-500/5 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">31-60 Days</div>
            <div className="text-lg font-bold text-amber-400">
              {formatCurrency(
                data.find(d => d.range === '31-60 days')?.amount || 0, 
                { currency, compact: true }
              )}
            </div>
          </div>
          
          <div className="text-center p-3 bg-red-500/5 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Over 60 Days</div>
            <div className="text-lg font-bold text-red-400">
              {formatCurrency(
                data.filter(d => d.range === '61-90 days' || d.range === 'Over 90 days')
                    .reduce((sum, d) => sum + d.amount, 0), 
                { currency, compact: true }
              )}
            </div>
          </div>
          
          <div className="text-center p-3 bg-blue-500/5 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Avg Days</div>
            <div className="text-lg font-bold text-blue-400">
              {weightedDays.toFixed(0)}d
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div style={{ width: '100%', height: 300 }} className="mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data}
              onClick={(e) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis 
                dataKey="range" 
                stroke="rgba(148, 163, 184, 0.6)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="rgba(148, 163, 184, 0.6)"
                fontSize={11}
                tickFormatter={(value) => formatCurrency(value, { currency, compact: true })}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="amount" 
                radius={[8, 8, 0, 0]}
                cursor="pointer"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBucketColor(entry.range)}
                    stroke={selectedBucket === entry.range ? '#f59e0b' : 'none'}
                    strokeWidth={selectedBucket === entry.range ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold theme-text-primary">Aging Details</h4>
          {data.map((bucket) => {
            const status = getBucketStatus(bucket.range)
            
            return (
              <div
                key={bucket.range}
                className={cn(
                  "p-3 rounded-lg transition-all cursor-pointer",
                  selectedBucket === bucket.range 
                    ? "bg-amber-500/10 border border-amber-500/30" 
                    : "bg-slate-500/5 hover:bg-slate-500/10"
                )}
                onClick={() => setSelectedBucket(selectedBucket === bucket.range ? null : bucket.range)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: getBucketColor(bucket.range) }}
                    />
                    <span className="text-sm font-medium theme-text-primary">
                      {bucket.range}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getStatusBadgeClass(status))}
                    >
                      {status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold theme-text-primary">
                      {formatCurrency(bucket.amount, { currency, compact: true })}
                    </p>
                    <p className="text-xs theme-text-secondary">
                      {bucket.count} invoices
                    </p>
                  </div>
                </div>
                
                <Progress 
                  value={bucket.percentage} 
                  className="h-1.5"
                  style={{
                    '--progress-background': getBucketColor(bucket.range)
                  } as any}
                />
                
                {selectedBucket === bucket.range && bucket.customers && bucket.customers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-500/10">
                    <p className="text-xs theme-text-secondary mb-2">Top customers in this bucket:</p>
                    <div className="space-y-1">
                      {bucket.customers.slice(0, 3).map((customer, idx) => (
                        <p key={idx} className="text-xs theme-text-primary">
                          • {customer}
                        </p>
                      ))}
                      {bucket.customers.length > 3 && (
                        <p className="text-xs theme-text-secondary">
                          +{bucket.customers.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Collection Tips */}
        {weightedDays > 30 && (
          <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <DollarSign className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-400 mb-1">Collection Tip</h4>
                <p className="text-sm theme-text-secondary">
                  Your average collection period is {weightedDays.toFixed(0)} days. 
                  Consider implementing automated payment reminders and offering early payment discounts 
                  to improve cash flow.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}