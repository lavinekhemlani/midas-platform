'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableProperties, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import type { TrialBalanceRow } from '@/app/(main)/bc-warehouse/reports/hooks/useWarehouseData'

interface TrialBalanceTableProps {
  data: TrialBalanceRow[]
  isLoading: boolean
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

type SortField =
  | 'g_laccount_no'
  | 'g_laccount_name'
  | 'total_debits'
  | 'total_credits'
  | 'net_balance'
type SortDirection = 'asc' | 'desc'

export function TrialBalanceTable({ data, isLoading }: TrialBalanceTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('g_laccount_no')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Theme-aware styles
  const styles = useMemo(
    () => ({
      tableBorder: isLight ? 'border-gray-300' : 'border-gray-700',
      theadBg: isLight ? 'bg-white/80' : 'bg-gray-900/80',
      theadBorder: isLight ? 'border-gray-200' : 'border-gray-700',
      rowDivide: isLight ? 'divide-gray-200' : 'divide-gray-700/50',
      rowHover: isLight ? 'hover:bg-gray-100/50' : 'hover:bg-white/5',
      tfootBg: isLight ? 'bg-gray-100' : 'bg-gray-900/90',
      tfootBorder: isLight ? 'border-gray-300' : 'border-gray-600',
      inputBg: isLight ? 'bg-white' : 'bg-gray-800',
      inputBorder: isLight ? 'border-gray-300' : 'border-gray-600',
    }),
    [isLight]
  )

  // Filter and sort data
  const filteredData = useMemo(() => {
    let filtered = data.filter((row) => {
      const searchLower = searchTerm.toLowerCase()
      return (
        row.g_laccount_no?.toLowerCase().includes(searchLower) ||
        row.g_laccount_name?.toLowerCase().includes(searchLower)
      )
    })

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField] ?? ''
      let bVal: string | number = b[sortField] ?? ''

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [data, searchTerm, sortField, sortDirection])

  // Calculate totals
  const totals = useMemo(
    () => ({
      debits: filteredData.reduce((sum, row) => sum + (row.total_debits || 0), 0),
      credits: filteredData.reduce((sum, row) => sum + (row.total_credits || 0), 0),
      net: filteredData.reduce((sum, row) => sum + (row.net_balance || 0), 0),
    }),
    [filteredData]
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    )
  }

  if (isLoading) {
    return (
      <Card className="glass-luxury-card border border-gray-200/10">
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <TableProperties className="w-4 h-4 text-theme-blue" />
            Trial Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-luxury-card border border-gray-200/10">
      <CardHeader className="pb-2 pt-4 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold theme-text-primary flex items-center gap-2">
            <TableProperties className="w-4 h-4 text-theme-blue" />
            Trial Balance
            <span className="text-xs font-normal theme-text-secondary">
              ({filteredData.length} accounts)
            </span>
          </CardTitle>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                'pl-9 pr-4 py-1.5 text-sm rounded-lg border theme-text-primary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64',
                styles.inputBorder,
                styles.inputBg
              )}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <div className={cn('overflow-hidden rounded-lg border', styles.tableBorder)}>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead
                className={cn(
                  'sticky top-0 backdrop-blur border-b',
                  styles.theadBg,
                  styles.theadBorder
                )}
              >
                <tr>
                  <th
                    className="text-left py-3 px-4 font-medium theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors"
                    onClick={() => handleSort('g_laccount_no')}
                  >
                    Account No <SortIcon field="g_laccount_no" />
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors"
                    onClick={() => handleSort('g_laccount_name')}
                  >
                    Account Name <SortIcon field="g_laccount_name" />
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors"
                    onClick={() => handleSort('total_debits')}
                  >
                    Debits <SortIcon field="total_debits" />
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors"
                    onClick={() => handleSort('total_credits')}
                  >
                    Credits <SortIcon field="total_credits" />
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium theme-text-secondary cursor-pointer hover:theme-text-primary transition-colors"
                    onClick={() => handleSort('net_balance')}
                  >
                    Net Balance <SortIcon field="net_balance" />
                  </th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', styles.rowDivide)}>
                {filteredData.map((row, idx) => (
                  <tr
                    key={`${row.g_laccount_no}-${idx}`}
                    className={cn('transition-colors', styles.rowHover)}
                  >
                    <td className="py-2.5 px-4 font-mono text-xs text-theme-blue">
                      {row.g_laccount_no}
                    </td>
                    <td className="py-2.5 px-4 theme-text-primary truncate max-w-[200px]">
                      {row.g_laccount_name}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-theme-green">
                      {formatFullCurrency(row.total_debits || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-theme-red">
                      {formatFullCurrency(row.total_credits || 0)}
                    </td>
                    <td
                      className={cn(
                        'py-2.5 px-4 text-right font-mono font-semibold',
                        (row.net_balance || 0) >= 0 ? 'text-theme-green' : 'text-theme-red'
                      )}
                    >
                      {formatFullCurrency(row.net_balance || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot
                className={cn(
                  'sticky bottom-0 backdrop-blur border-t-2',
                  styles.tfootBg,
                  styles.tfootBorder
                )}
              >
                <tr className="font-semibold">
                  <td className="py-3 px-4 theme-text-primary" colSpan={2}>
                    Totals
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-theme-green">
                    {formatFullCurrency(totals.debits)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-theme-red">
                    {formatFullCurrency(totals.credits)}
                  </td>
                  <td
                    className={cn(
                      'py-3 px-4 text-right font-mono',
                      totals.net >= 0 ? 'text-theme-green' : 'text-theme-red'
                    )}
                  >
                    {formatFullCurrency(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
