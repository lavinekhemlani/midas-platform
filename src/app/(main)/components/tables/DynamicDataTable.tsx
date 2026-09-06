// src/app/(main)/components/tables/DynamicDataTable.tsx
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { logger } from '@/lib/logger'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface TableColumn {
  key: string
  label: string
  type?: 'text' | 'number' | 'currency' | 'percentage' | 'date' | 'badge' | 'boolean'
  sortable?: boolean
  filterable?: boolean
  hidden?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  format?: (value: any, row?: any) => string
  render?: (value: any, row?: any) => React.ReactNode
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count'
}

interface DynamicDataTableProps {
  data: any[]
  columns: TableColumn[]
  title?: string
  subtitle?: string
  searchable?: boolean
  exportable?: boolean
  paginate?: boolean
  pageSize?: number
  showAggregations?: boolean
  onRowClick?: (row: any) => void
  className?: string
  emptyMessage?: string
  customActions?: Array<{
    label: string
    href?: string
    onClick?: () => void
    variant?: 'default' | 'outline' | 'ghost'
    icon?: React.ReactNode
  }>
}

export default function DynamicDataTable({
  data,
  columns: initialColumns,
  title,
  subtitle,
  searchable = true,
  exportable = true,
  paginate = true,
  pageSize = 10,
  showAggregations = false,
  onRowClick,
  className,
  emptyMessage = 'No data available',
  customActions = [],
}: DynamicDataTableProps) {
  const { currency } = useCurrency()
  const [columns, setColumns] = useState(initialColumns)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  )
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({})
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())
  const [pdfExportMode, setPdfExportMode] = useState(false)

  // Debug logging
  logger.debug('DynamicDataTable rendered', {
    component: 'DynamicDataTable',
    title,
    subtitle,
    dataLength: data.length,
    dataIsArray: Array.isArray(data),
    columnsLength: initialColumns.length,
    columns: initialColumns,
    sampleData: data.length > 0 ? data[0] : 'No data',
    dataKeys: data.length > 0 ? Object.keys(data[0]) : [],
    sampleDataKeys: data.length > 0 ? Object.keys(data[0]) : [],
  })

  // CRITICAL: Listen for PDF export event to disable pagination
  useEffect(() => {
    const handlePdfExport = (event: Event) => {
      logger.debug('PDF export prepare event received, disabling pagination', {
        component: 'DynamicDataTable',
      })
      setPdfExportMode(true)

      // Re-enable after PDF export completes (after 15 seconds)
      setTimeout(() => {
        logger.debug('Re-enabling pagination after PDF export', {
          component: 'DynamicDataTable',
        })
        setPdfExportMode(false)
      }, 15000)
    }

    window.addEventListener('pdfExportPrepare', handlePdfExport)

    return () => {
      window.removeEventListener('pdfExportPrepare', handlePdfExport)
    }
  }, [])

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    let filtered = [...data]

    // Apply search
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter((row) =>
        columns.some((col) => {
          if (col.hidden || hiddenColumns.has(col.key)) return false
          const value = row[col.key]
          if (value === null || value === undefined) return false

          // Convert value to searchable string based on type
          let searchableValue = ''
          if (col.type === 'date') {
            // Format date for searching
            try {
              searchableValue = new Date(value)
                .toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                .toLowerCase()
            } catch {
              searchableValue = String(value).toLowerCase()
            }
          } else if (col.type === 'currency') {
            // Search both formatted and raw number
            searchableValue = String(value).toLowerCase()
          } else {
            searchableValue = String(value).toLowerCase()
          }

          return searchableValue.includes(searchLower)
        })
      )
    }

    // Apply column filters
    Object.entries(selectedFilters).forEach(([key, filterValue]) => {
      if (filterValue && filterValue !== 'all') {
        filtered = filtered.filter((row) => String(row[key]) === filterValue)
      }
    })

    return filtered
  }, [data, searchTerm, columns, selectedFilters, hiddenColumns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      const column = columns.find((c) => c.key === sortConfig.key)

      // Handle different data types
      if (
        column?.type === 'number' ||
        column?.type === 'currency' ||
        column?.type === 'percentage'
      ) {
        const aNum = parseFloat(aValue)
        const bNum = parseFloat(bValue)
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      if (column?.type === 'date') {
        const aDate = new Date(aValue).getTime()
        const bDate = new Date(bValue).getTime()
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
      }

      // String comparison
      const compareResult = String(aValue).localeCompare(String(bValue))
      return sortConfig.direction === 'asc' ? compareResult : -compareResult
    })
  }, [filteredData, sortConfig, columns])

  // Paginate data
  // CRITICAL: Disable pagination during PDF export to show all rows
  const paginatedData = useMemo(() => {
    if (!paginate || pdfExportMode) {
      logger.debug('Pagination disabled, showing all rows', {
        component: 'DynamicDataTable',
        rowCount: sortedData.length,
      })
      return sortedData
    }
    const startIndex = (currentPage - 1) * pageSize
    return sortedData.slice(startIndex, startIndex + pageSize)
  }, [sortedData, currentPage, pageSize, paginate, pdfExportMode])

  // Calculate aggregations
  const aggregations = useMemo(() => {
    if (!showAggregations) return {}

    const aggs: Record<string, any> = {}

    columns.forEach((col) => {
      if (col.aggregation && !col.hidden && !hiddenColumns.has(col.key)) {
        const values = filteredData
          .map((row) => row[col.key])
          .filter((v) => v !== null && v !== undefined)

        switch (col.aggregation) {
          case 'sum':
            aggs[col.key] = values.reduce((sum, v) => sum + parseFloat(v), 0)
            break
          case 'avg':
            aggs[col.key] =
              values.length > 0
                ? values.reduce((sum, v) => sum + parseFloat(v), 0) / values.length
                : 0
            break
          case 'min':
            aggs[col.key] = values.length > 0 ? Math.min(...values.map((v) => parseFloat(v))) : 0
            break
          case 'max':
            aggs[col.key] = values.length > 0 ? Math.max(...values.map((v) => parseFloat(v))) : 0
            break
          case 'count':
            aggs[col.key] = values.length
            break
        }
      }
    })

    return aggs
  }, [filteredData, columns, showAggregations, hiddenColumns])

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  const toggleColumnVisibility = (key: string) => {
    setHiddenColumns((current) => {
      const newSet = new Set(current)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const exportToCSV = () => {
    const visibleColumns = columns.filter((c) => !c.hidden && !hiddenColumns.has(c.key))
    const headers = visibleColumns.map((c) => c.label).join(',')
    const rows = filteredData
      .map((row) =>
        visibleColumns
          .map((col) => {
            const value = row[col.key]
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
          })
          .join(',')
      )
      .join('\n')

    const csv = `${headers}\n${rows}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'data'}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Format cell value
  const formatCellValue = (column: TableColumn, value: any, row: any) => {
    if (column.render) return column.render(value, row)
    if (column.format) return column.format(value, row)

    if (value === null || value === undefined) return '-'

    switch (column.type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value)

      case 'percentage':
        return `${value.toFixed(1)}%`

      case 'date':
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })

      case 'boolean':
        return value ? '✓' : '✗'

      case 'badge':
        return (
          <span
            className={cn(
              'px-2 py-1 text-xs rounded-full font-medium',
              value === 'active'
                ? 'bg-green-500/20 text-green-600 dark:bg-green-500/30 dark:text-green-400'
                : value === 'pending'
                  ? 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400'
                  : value === 'overdue'
                    ? 'bg-red-500/20 text-red-700 dark:bg-red-500/30 dark:text-red-400'
                    : 'bg-gray-500/20 text-gray-700 dark:bg-gray-500/30 dark:text-gray-400'
            )}
          >
            {value}
          </span>
        )

      default:
        return String(value)
    }
  }

  const totalPages = Math.ceil(sortedData.length / pageSize)
  const visibleColumns = columns.filter((c) => !c.hidden && !hiddenColumns.has(c.key))

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold theme-text-primary">{title}</h3>}
          {subtitle && <p className="text-sm theme-text-secondary">{subtitle}</p>}
        </div>
      )}

      {/* Controls */}
      {!pdfExportMode && (
        <div className="flex flex-wrap gap-2 items-center justify-between">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 theme-text-secondary" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          <div className="flex gap-2">
            {customActions.map((action, index) =>
              action.href ? (
                <a key={index} href={action.href} target="_blank" rel="noopener noreferrer">
                  <Button variant={action.variant || 'default'} size="sm">
                    {action.icon && <span className="mr-1">{action.icon}</span>}
                    {action.label}
                  </Button>
                </a>
              ) : (
                <Button
                  key={index}
                  variant={action.variant || 'default'}
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.icon && <span className="mr-1">{action.icon}</span>}
                  {action.label}
                </Button>
              )
            )}
            {exportable && (
              <Button variant="default" size="sm" onClick={exportToCSV} className="export-button">
                <Download className="h-6 w-6 mr-1" />
                Export CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/10">
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    'text-center font-semibold theme-text-primary', // Center all headers by default with theme-aware color
                    column.align === 'left' && 'text-left',
                    column.align === 'right' && 'text-right',
                    column.sortable && 'cursor-pointer hover:bg-muted/20'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center justify-center gap-1">
                    {column.label}
                    {column.sortable && (
                      <span className="ml-1 theme-text-secondary">
                        {sortConfig?.key === column.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="text-center py-8">
                  <p className="theme-text-secondary">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {paginatedData.map((row, i) => (
                  <TableRow
                    key={i}
                    className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                    onClick={() => onRowClick?.(row)}
                  >
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          'text-center theme-text-primary', // Center all cells by default with theme-aware color
                          column.align === 'left' && 'text-left',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {formatCellValue(column, row[column.key], row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

                {/* Aggregation row */}
                {showAggregations && Object.keys(aggregations).length > 0 && (
                  <TableRow className="font-semibold border-t-2">
                    {visibleColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {column.key in aggregations
                          ? formatCellValue(column, aggregations[column.key], {})
                          : column.key === visibleColumns[0].key
                            ? 'Total'
                            : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginate && totalPages > 1 && !pdfExportMode && (
        <div className="flex items-center justify-between">
          <p className="text-sm theme-text-secondary">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} entries
          </p>
          <div className="flex gap-1">
            <Button
              variant="default"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'default'}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}
            <Button
              variant="default"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
