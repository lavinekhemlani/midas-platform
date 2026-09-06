// app/(main)/components/RecentTransactions.tsx
'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils/currency'
import { useCurrency } from '@/contexts/CurrencyContext'
import { cn } from '@/lib/utils'

export interface Transaction {
  id: string | number
  type: 'invoice' | 'expense'
  description: string
  amount: number
  date: string
  status: string
}

interface RecentTransactionsProps {
  transactions: Transaction[]
  currency?: string
  className?: string
  itemsPerPage?: number
  isLoading?: boolean
  dataSource?: {
    types?: string[]
    description?: string
    fallbackUsed?: boolean
  }
}

export default function RecentTransactions({ 
  transactions, 
  currency: propCurrency,
  className,
  itemsPerPage = 10,
  isLoading = false,
  dataSource
}: RecentTransactionsProps) {
  const { currency: contextCurrency } = useCurrency()
  const currency = propCurrency || contextCurrency
  const [currentPage, setCurrentPage] = useState(0)
  const [showTooltip, setShowTooltip] = useState(false)
  
  // Sort transactions by date in descending order (most recent first)
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA // Most recent first
    })
  }, [transactions])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getTypeIcon = (type: 'invoice' | 'expense') => {
    return type === 'invoice' ? Receipt : CreditCard
  }

  const getAmountColor = (type: 'invoice' | 'expense') => {
    return type === 'invoice' ? 'text-emerald-400' : 'text-red-400'
  }

  // Pagination logic
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
  const startIndex = currentPage * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTransactions = sortedTransactions.slice(startIndex, endIndex)
  
  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Reset scroll position when page changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentPage])

  // Calculate totals for last 30 days
  const { totalInflow, totalOutflow } = useMemo(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentTransactions = sortedTransactions.filter(t => new Date(t.date) >= thirtyDaysAgo)
    
    // Calculate based on transaction type, not amount sign
    const inflow = recentTransactions
      .filter(t => t.type === 'invoice')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    const outflow = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    return { totalInflow: inflow, totalOutflow: outflow }
  }, [sortedTransactions])

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))
  }

  if (isLoading) {
    return (
      <Card className={`chart-container ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="chart-title">
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg">
                <div className="flex items-center space-x-3 flex-1">
                  <span className="inline-block w-10 h-10 relative overflow-hidden rounded-lg">
                    <span className="absolute inset-0 shimmer-bg-20" />
                    <span 
                      className="absolute inset-0 shimmer-gradient-medium animate-shimmer-fast" 
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  </span>
                  <div className="space-y-2 flex-1">
                    <span className="inline-block h-3 w-32 relative overflow-hidden rounded">
                      <span className="absolute inset-0 shimmer-bg-20" />
                      <span 
                        className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast" 
                        style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
                      />
                    </span>
                    <span className="inline-block h-2 w-20 relative overflow-hidden rounded">
                      <span className="absolute inset-0 shimmer-bg-15" />
                      <span 
                        className="absolute inset-0 shimmer-gradient-light animate-shimmer-fast" 
                        style={{ animationDelay: `${i * 0.1 + 0.1}s` }}
                      />
                    </span>
                  </div>
                </div>
                <span className="inline-block h-4 w-16 relative overflow-hidden rounded">
                  <span className="absolute inset-0 shimmer-bg-20" />
                  <span 
                    className="absolute inset-0 shimmer-gradient-medium animate-shimmer-fast" 
                    style={{ animationDelay: `${i * 0.1 + 0.15}s` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sortedTransactions.length === 0) {
    return (
      <Card className={`chart-container ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="chart-title">
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-6 h-6 theme-text-secondary" />
            </div>
            <p className="theme-text-secondary">No recent transactions found</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("chart-container group relative", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="chart-title">
              <ArrowUpRight className="w-5 h-5 text-blue-500" />
              Recent Transactions
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
              Last 30 days
            </Badge>
          </div>
          
          {/* Data Source Info Button */}
          <div className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-7 h-7 hover:bg-amber-500/10 transition-opacity duration-300",
                "opacity-0 group-hover:opacity-100"
              )}
            >
              <HelpCircle className="w-4 h-4 theme-text-secondary" />
            </Button>
            {showTooltip && (
              <div
                className="absolute top-0 right-full mr-2 w-72 p-3 kpi-tooltip text-xs rounded-lg shadow-xl border"
                style={{ zIndex: 50 }}
                >
                  <div className="font-semibold theme-text-primary mb-2">
                    Transaction Data Sources
                  </div>
                  <div className="theme-text-secondary leading-relaxed space-y-2">
                    <div>
                      <span className="font-semibold text-emerald-400">Income Transactions:</span>
                      <ul className="ml-2 mt-1">
                        <li>• Invoices (marked as paid)</li>
                        <li>• Sales Receipts</li>
                        {dataSource?.fallbackUsed ? (
                          <li className="text-amber-400">• Income Deposits (Fallback)</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-red-400">Expense Transactions:</span>
                      <ul className="ml-2 mt-1">
                        <li>• Bills & Purchases</li>
                        <li>• Journal Entries (expense lines)</li>
                        <li>• Check Payments</li>
                      </ul>
                    </div>
                    <div className="border-t border-gray-700 pt-2 text-[10px] text-gray-400">
                      Shows all transactions from the last 30 days, sorted by most recent first.
                      {dataSource?.fallbackUsed && ' Using deposit fallback for revenue.'}
                    </div>
                  </div>
                  <div className="absolute top-3 left-full -ml-1 w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-current opacity-90"></div>
                </div>
              )}
            </div>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-500/10">
            <div className="text-xs theme-text-secondary">
              Showing {startIndex + 1}-{Math.min(endIndex, sortedTransactions.length)} of {sortedTransactions.length}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="h-7 w-7 p-0 hover:bg-amber-500/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs theme-text-secondary px-2">
                {currentPage + 1} / {totalPages}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
                className="h-7 w-7 p-0 hover:bg-amber-500/10"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0 pb-0 flex flex-col flex-1 min-h-0">
        <div ref={scrollContainerRef} className="styled-scrollbar space-y-2 px-2 overflow-y-auto flex-1">
          {currentTransactions.map((transaction) => {
            const TypeIcon = getTypeIcon(transaction.type)
            const amountColor = getAmountColor(transaction.type)
            
            return (
              <div 
                key={`${transaction.type}-${transaction.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-500/5 hover:bg-slate-500/10 transition-colors group"
              >
                {/* Left side: Icon, Description, Date */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <TypeIcon className={`w-4 h-4 flex-shrink-0 ${
                    transaction.type === 'invoice' 
                      ? 'text-emerald-400' 
                      : 'text-red-400'
                  }`} />
                  
                  <div className="min-w-0 flex-1">
                    <p className="font-medium theme-text-primary text-xs truncate mb-0.5">
                      {transaction.description}
                    </p>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="theme-text-secondary">
                        {formatDate(transaction.date)}
                      </span>
                      <span className="text-xs theme-text-secondary capitalize">
                        • {transaction.type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Amount */}
                <div className="text-right ml-4 flex-shrink-0">
                  <div className={`font-bold text-sm ${amountColor} flex items-center justify-end space-x-1`}>
                    {transaction.type === 'invoice' ? (
                      <ArrowDownLeft className="w-3 h-3" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3" />
                    )}
                    <span>
                      {transaction.type === 'expense' ? '-' : '+'}
                      {formatCurrency(Math.abs(transaction.amount), { currency, compact: true })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
      
      {/* Summary Footer - Match Daily Cash Flow exactly */}
      <div className="grid grid-cols-2 gap-4 mt-1 pt-2 border-t border-amber-500/10 mx-6 mb-4">
        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Total Inflow</div>
          <div className="text-sm font-bold text-emerald-400">
            {formatCurrency(totalInflow, { currency })}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs theme-text-secondary mb-1">Total Outflow</div>
          <div className="text-sm font-bold text-red-400">
            {formatCurrency(totalOutflow, { currency })}
          </div>
        </div>
      </div>
    </Card>
  )
}