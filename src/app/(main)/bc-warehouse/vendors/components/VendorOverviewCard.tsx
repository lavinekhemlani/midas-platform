'use client'

import { Users, DollarSign, CreditCard, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatCompactCurrency } from '@/lib/utils/currency'

interface VendorOverviewCardProps {
  data: {
    total_vendors: number
    vendors_with_balance: number
    total_purchases: number
    total_ap: number
    total_overdue: number
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

export function VendorOverviewCard({ data, isLoading, currency = 'USD' }: VendorOverviewCardProps) {
  const overduePercentage =
    data && data.total_ap > 0 ? ((data.total_overdue / data.total_ap) * 100).toFixed(1) : '0'

  const balancePercentage =
    data && data.total_vendors > 0
      ? ((data.vendors_with_balance / data.total_vendors) * 100).toFixed(0)
      : '0'

  return (
    <Card className="glass-luxury-card flex flex-col gap-0 border border-gray-200/10 !pt-0 col-span-2">
      <CardHeader className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <CardTitle className="text-base font-bold theme-text-primary">Vendor Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1">
        {isLoading ? (
          <LoadingSpinner />
        ) : data ? (
          <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
            <StatBox
              icon={Users}
              label="Total Vendors"
              value={data.total_vendors.toLocaleString()}
              subValue={`${data.vendors_with_balance} with balance`}
              color="text-amber-400"
              bgColor="bg-amber-500/5 border-amber-500/10"
            />
            <StatBox
              icon={DollarSign}
              label="Total Purchases"
              value={formatCompactCurrency(data.total_purchases, currency)}
              subValue={`${balancePercentage}% have AP`}
              color="text-theme-green"
              bgColor="bg-green-500/5 border-green-500/10"
            />
            <StatBox
              icon={CreditCard}
              label="Total AP"
              value={formatCompactCurrency(data.total_ap, currency)}
              subValue={`${overduePercentage}% overdue`}
              color="text-theme-blue"
              bgColor="bg-blue-500/5 border-blue-500/10"
            />
            <StatBox
              icon={AlertCircle}
              label="Overdue"
              value={formatCompactCurrency(data.total_overdue, currency)}
              subValue="Requires attention"
              color="text-theme-red"
              bgColor="bg-red-500/5 border-red-500/10"
            />
          </div>
        ) : (
          <p className="text-sm theme-text-secondary text-center">No vendor data available</p>
        )}
      </CardContent>
    </Card>
  )
}
