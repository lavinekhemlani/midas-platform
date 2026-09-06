'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface ReportTableColumn {
  key: string
  header: string
  align?: 'left' | 'center' | 'right'
  format?: 'currency' | 'percentage' | 'number' | 'date' | 'custom'
  sortable?: boolean
  width?: string
  className?: string
  render?: (value: any, row: any) => React.ReactNode
}

interface ReportTableProps {
  data: any[]
  columns: ReportTableColumn[]
  className?: string
  striped?: boolean
  hoverable?: boolean
  sortable?: boolean
  emptyMessage?: string
  variant?: 'default' | 'compact' | 'spacious'
  onRowClick?: (row: any) => void
  currency?: string
}

export function ReportTable({
  data,
  columns,
  className,
  striped = true,
  hoverable = true,
  sortable = true,
  emptyMessage = 'No data available',
  variant = 'default',
  onRowClick,
  currency = 'USD',
}: ReportTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const formatValue = (value: any, format?: string) => {
    if (value === null || value === undefined) return '-'

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 2, // Always show 2 decimal places for currency
          maximumFractionDigits: 2,
        }).format(value)
      case 'percentage':
        return `${value}%`
      case 'number':
        return new Intl.NumberFormat('en-US').format(value)
      case 'date':
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      default:
        return value
    }
  }

  const handleSort = (columnKey: string) => {
    if (!sortable) return

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortColumn) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortColumn, sortDirection])

  const getSortIcon = (columnKey: string) => {
    if (!sortable) return null

    if (sortColumn === columnKey) {
      return sortDirection === 'asc' ? (
        <ChevronUp className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      )
    }
    return <ChevronsUpDown className="w-4 h-4 opacity-50" />
  }

  const variantClasses = {
    default: '',
    compact: 'text-sm',
    spacious: 'text-base',
  }

  const cellPadding = {
    default: 'px-4 py-3',
    compact: 'px-3 py-2',
    spacious: 'px-6 py-4',
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <Table className={variantClasses[variant]}>
        <TableHeader>
          <TableRow className="border-b border-border">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'theme-text-secondary font-semibold',
                  cellPadding[variant],
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right',
                  column.sortable !== false &&
                    sortable &&
                    'cursor-pointer select-none hover:theme-text-primary',
                  column.className
                )}
                style={{ width: column.width }}
                onClick={() => column.sortable !== false && handleSort(column.key)}
              >
                <div
                  className={cn(
                    'flex items-center gap-1',
                    column.align === 'center' && 'justify-center',
                    column.align === 'right' && 'justify-end'
                  )}
                >
                  {column.header}
                  {column.sortable !== false && getSortIcon(column.key)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className={cn('text-center theme-text-secondary', cellPadding[variant])}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  'border-b border-border',
                  hoverable && 'hover:bg-muted/30 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      'theme-text-primary',
                      cellPadding[variant],
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : formatValue(row[column.key], column.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
