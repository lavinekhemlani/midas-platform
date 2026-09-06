'use client'

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown } from 'lucide-react'

// =============================================================================
// Types
// =============================================================================

export interface Column<T> {
  key: keyof T
  label: string
  align?: 'left' | 'center' | 'right'
  format?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  width?: number
}

export interface DataTableProps<T extends Record<string, any>> {
  data: T[]
  columns: Column<T>[]
  sortable?: boolean
  paginate?: boolean
  rowsPerPage?: number
  className?: string
  emptyMessage?: string
}

// =============================================================================
// Component
// =============================================================================

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  sortable = true,
  paginate = false,
  rowsPerPage = 10,
  className,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })

  const [currentPage, setCurrentPage] = useState(1)

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!]
      const bVal = b[sortConfig.key!]

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sortConfig])

  // Paginate rows
  const paginatedRows = useMemo(() => {
    if (!paginate) return sortedRows

    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return sortedRows.slice(start, end)
  }, [sortedRows, currentPage, paginate, rowsPerPage])

  const totalPages = Math.ceil(data.length / rowsPerPage)

  const handleSort = (key: keyof T) => {
    if (!sortable) return

    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  if (data.length === 0) {
    return <div className="text-center py-8 theme-text-secondary">{emptyMessage}</div>
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse table-auto">
        <thead>
          <tr className="border-b border-black/15 dark:border-white/15">
            {columns.map((column) => {
              const isSortable = sortable && column.sortable !== false
              return (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-3 text-sm font-medium theme-text-secondary',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    isSortable && 'cursor-pointer hover:theme-text-primary'
                  )}
                  style={{ width: column.width ? `${column.width}px` : undefined }}
                  onClick={() => isSortable && handleSort(column.key)}
                >
                  <div
                    className={cn(
                      'flex items-center gap-1',
                      column.align === 'center' && 'justify-center',
                      column.align === 'right' && 'justify-end'
                    )}
                  >
                    {column.label}
                    {isSortable &&
                      sortConfig.key === column.key &&
                      (sortConfig.direction === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      ))}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {paginatedRows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {columns.map((column) => {
                const value = row[column.key]
                const formattedValue = column.format ? column.format(value, row) : value

                return (
                  <td
                    key={String(column.key)}
                    className={cn(
                      'px-4 py-3 text-sm theme-text-primary whitespace-nowrap',
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                    style={{ width: column.width ? `${column.width}px` : undefined }}
                  >
                    {formattedValue}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {paginate && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/15 dark:border-white/15">
          <div className="text-sm theme-text-secondary">
            Showing {(currentPage - 1) * rowsPerPage + 1} to{' '}
            {Math.min(currentPage * rowsPerPage, data.length)} of {data.length} entries
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-black/15 dark:border-white/15 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-black/15 dark:border-white/15 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
