'use client'

import { Users, DollarSign, TrendingUp, AlertCircle, CreditCard, Ban } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface CustomerOverviewCardProps {
  data: {
    total_customers: number
    customers_with_balance: number
    blocked_customers: number
    total_sales: number
    total_ar: number
    total_overdue: number
    total_profit: number
    total_credit_limit: number
  } | null
  isLoading: boolean
  currency?: string
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
    </div>
  )
}

function StatBox({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color: string
  bgColor: string
}) {
  return (
    <div className={cn('rounded-lg p-3 border', bgColor)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-[10px] uppercase tracking-wider font-medium theme-text-secondary">
          {label}
        </span>
      </div>
      <div className={cn('text-lg font-bold', color)}>{value}</div>
      {subValue && <div className="text-[10px] theme-text-secondary mt-0.5">{subValue}</div>}
    </div>
  )
}

export function CustomerOverviewCard({
  data,
  isLoading,
  currency = 'USD',
}: CustomerOverviewCardProps) {
  const profitMargin =
    data && data.total_sales > 0 ? ((data.total_profit / data.total_sales) * 100).toFixed(1) : '0'

  const overduePercentage =
    data && data.total_ar > 0 ? ((data.total_overdue / data.total_ar) * 100).toFixed(1) : '0'

  return (
    <Card className="glass-luxury-card flex flex-col gap-0 border border-gray-200/10 !pt-0 col-span-2">
      <CardHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <CardTitle className="text-base font-bold theme-text-primary">
            Customer Overview
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1">
        {isLoading ? (
          <LoadingSpinner />
        ) : data ? (
          <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
            <StatBox
              icon={Users}
              label="Total Customers"
              value={data.total_customers.toLocaleString()}
              subValue={`${data.customers_with_balance} with balance`}
              color="text-amber-400"
              bgColor="bg-amber-500/5 border-amber-500/10"
            />
            <StatBox
              icon={DollarSign}
              label="Total Sales"
              value={formatCompactCurrency(data.total_sales, currency)}
              subValue={`${profitMargin}% margin`}
              color="text-theme-green"
              bgColor="bg-green-500/5 border-green-500/10"
            />
            <StatBox
              icon={CreditCard}
              label="Total AR"
              value={formatCompactCurrency(data.total_ar, currency)}
              subValue={`${overduePercentage}% overdue`}
              color="text-theme-blue"
              bgColor="bg-blue-500/5 border-blue-500/10"
            />
            <StatBox
              icon={AlertCircle}
              label="Overdue"
              value={formatCompactCurrency(data.total_overdue, currency)}
              subValue={
                data.blocked_customers > 0 ? `${data.blocked_customers} blocked` : 'None blocked'
              }
              color="text-theme-red"
              bgColor="bg-red-500/5 border-red-500/10"
            />
          </div>
        ) : (
          <p className="text-sm theme-text-secondary text-center">No customer data available</p>
        )}
      </CardContent>
    </Card>
  )
}
