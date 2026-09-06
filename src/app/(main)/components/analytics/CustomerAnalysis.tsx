// src/app/(main)/components/CustomerAnalysis.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'

export interface CustomerData {
  id: string
  name: string
  totalRevenue: number
  outstanding: number
  creditLimit?: number
  creditUsed?: number
  daysOverdue?: number
  lastPaymentDate?: string
  invoiceCount: number
  status: 'active' | 'overdue' | 'at-risk' | 'good'
}

interface CustomerAnalysisProps {
  customers: CustomerData[]
  currency?: string
  showDetails?: boolean
  className?: string
}

export default function CustomerAnalysis({
  customers,
  currency = 'USD',
  showDetails = true,
  className
}: CustomerAnalysisProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Calculate summary metrics
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0)
  const totalOutstanding = customers.reduce((sum, c) => sum + c.outstanding, 0)
  const overdueCustomers = customers.filter(c => c.status === 'overdue').length
  const atRiskCustomers = customers.filter(c => c.status === 'at-risk').length

  // Filter customers by status
  const filteredCustomers = selectedStatus === 'all' 
    ? customers 
    : customers.filter(c => c.status === selectedStatus)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      case 'at-risk': return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      case 'overdue': return 'text-red-400 bg-red-500/10 border-red-500/30'
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    }
  }

  const getCreditUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 75) return 'text-amber-400'
    return 'text-emerald-400'
  }

  return (
    <Card className={cn("chart-container", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="chart-title">
            <Users className="w-5 h-5 text-blue-500" />
            Customer Analysis
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              {customers.length} Total
            </Badge>
            {overdueCustomers > 0 && (
              <Badge variant="outline" className="border-red-500/30 text-red-400">
                {overdueCustomers} Overdue
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-slate-500/5 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Total Revenue</div>
            <div className="text-lg font-bold text-emerald-400">
              {formatCurrency(totalRevenue, { currency, compact: true })}
            </div>
          </div>
          
          <div className="text-center p-3 bg-slate-500/5 rounded-lg">
            <CreditCard className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Outstanding</div>
            <div className="text-lg font-bold text-amber-400">
              {formatCurrency(totalOutstanding, { currency, compact: true })}
            </div>
          </div>
          
          <div className="text-center p-3 bg-slate-500/5 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">At Risk</div>
            <div className="text-lg font-bold text-orange-400">
              {atRiskCustomers}
            </div>
          </div>
          
          <div className="text-center p-3 bg-slate-500/5 rounded-lg">
            <Calendar className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <div className="text-xs theme-text-secondary mb-1">Overdue</div>
            <div className="text-lg font-bold text-red-400">
              {overdueCustomers}
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm theme-text-secondary">Filter:</span>
          <div className="flex items-center space-x-1">
            {['all', 'good', 'at-risk', 'overdue'].map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  selectedStatus === status
                    ? "bg-amber-500 text-white"
                    : "theme-text-secondary hover:bg-slate-500/10"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Customer List */}
        {showDetails && (
          <div className="space-y-3 max-h-[400px] overflow-y-auto styled-scrollbar pr-2">
            {filteredCustomers.map((customer) => {
              const creditPercentage = customer.creditLimit 
                ? (customer.creditUsed || 0) / customer.creditLimit * 100 
                : 0

              return (
                <div
                  key={customer.id}
                  className="p-4 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium theme-text-primary">
                        {customer.name}
                      </h4>
                      <div className="flex items-center space-x-3 mt-1">
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getStatusColor(customer.status))}
                        >
                          {customer.status}
                        </Badge>
                        <span className="text-xs theme-text-secondary">
                          {customer.invoiceCount} invoices
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold theme-text-primary">
                        {formatCurrency(customer.totalRevenue, { currency, compact: true })}
                      </div>
                      {customer.outstanding > 0 && (
                        <div className="text-xs text-amber-400">
                          {formatCurrency(customer.outstanding, { currency, compact: true })} due
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credit Limit Progress */}
                  {customer.creditLimit && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="theme-text-secondary">Credit Used</span>
                        <span className={cn("font-medium", getCreditUsageColor(creditPercentage))}>
                          {creditPercentage.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={creditPercentage} className="h-1.5" />
                    </div>
                  )}

                  {/* Additional Details */}
                  <div className="flex items-center justify-between mt-3 text-xs theme-text-secondary">
                    {customer.lastPaymentDate && (
                      <span>
                        Last payment: {new Date(customer.lastPaymentDate).toLocaleDateString()}
                      </span>
                    )}
                    {customer.daysOverdue && customer.daysOverdue > 0 && (
                      <span className="text-red-400">
                        {customer.daysOverdue} days overdue
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}