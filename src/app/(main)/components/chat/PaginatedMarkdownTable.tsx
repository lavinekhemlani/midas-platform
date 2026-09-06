/**
 * @component PaginatedMarkdownTable
 * @description Wraps markdown tables with pagination when they exceed 10 rows
 */

'use client'

import React, { memo, useState, useMemo, Children, isValidElement } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS_PER_PAGE = 10

interface PaginatedMarkdownTableProps {
  children: React.ReactNode
  className?: string
}

/**
 * Get the element type name (handles both native elements and component functions)
 */
function getElementTypeName(element: React.ReactElement): string | null {
  const type = element.type
  if (typeof type === 'string') return type
  if (typeof type === 'function') {
    // Check displayName or name for function components
    return (type as any).displayName || type.name || null
  }
  return null
}

/**
 * Check if element is a thead (by type, displayName, or data-slot)
 */
function isThead(element: React.ReactElement): boolean {
  const typeName = getElementTypeName(element)
  if (typeName === 'thead') return true
  // Check data-slot attribute (set by markdown components)
  if ((element.props as any)?.['data-slot'] === 'thead') return true
  // Check children for actual thead element
  const firstChild = (element.props as any)?.children
  if (isValidElement(firstChild) && getElementTypeName(firstChild) === 'thead') {
    return true
  }
  return false
}

/**
 * Check if element is a tbody (by type, displayName, or data-slot)
 */
function isTbody(element: React.ReactElement): boolean {
  const typeName = getElementTypeName(element)
  if (typeName === 'tbody') return true
  // Check data-slot attribute (set by markdown components)
  if ((element.props as any)?.['data-slot'] === 'tbody') return true
  // Check children for actual tbody element
  const firstChild = (element.props as any)?.children
  if (isValidElement(firstChild) && getElementTypeName(firstChild) === 'tbody') {
    return true
  }
  return false
}

/**
 * Recursively extract tr elements from a node
 */
function extractTrElements(node: React.ReactNode): React.ReactElement[] {
  const rows: React.ReactElement[] = []

  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return

    const typeName = getElementTypeName(child)
    if (typeName === 'tr') {
      rows.push(child)
    } else {
      // Recurse into children
      const childrenProp = (child.props as any)?.children
      if (childrenProp) {
        rows.push(...extractTrElements(childrenProp))
      }
    }
  })

  return rows
}

/**
 * Extract rows from table children structure
 * Markdown renders as: table > thead + tbody > tr elements
 * Handles both native elements and React component wrappers
 */
function extractTableParts(children: React.ReactNode): {
  thead: React.ReactNode
  rows: React.ReactElement[]
} {
  let thead: React.ReactNode = null
  let rows: React.ReactElement[] = []

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return

    // Handle thead
    if (isThead(child)) {
      thead = child
    }

    // Handle tbody - extract tr children
    if (isTbody(child)) {
      rows = extractTrElements(child)
    }
  })

  return { thead, rows }
}

/**
 * Pagination Controls Component
 */
function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  // Generate page numbers to display
  // Always shows 5 numbers. When near the end, 5 consecutive; otherwise 4 + ... + last
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Center the selected page in a window of 4, clamped to bounds
      const start = Math.max(1, currentPage - 2)
      const end = start + 3

      if (end >= totalPages - 1) {
        // Near the end: show last 5 pages consecutively
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // Show centered window of 4 + ellipsis + last page
        for (let i = start; i <= end; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex flex-col items-center px-4 py-3 border-t border-white/10 gap-3">
      <div className="flex items-center gap-0">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            currentPage === 1
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          )}
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            currentPage === 1
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-center gap-0.5 w-[220px]">
          {pageNumbers.map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 theme-text-secondary">
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  'min-w-[28px] h-7 px-2 text-xs font-medium rounded-md transition-colors',
                  page === currentPage
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                )}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            currentPage === totalPages
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          )}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            currentPage === totalPages
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          )}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs theme-text-secondary">
        Showing <span className="font-medium theme-text-primary">{startItem}-{endItem}</span> of{' '}
        <span className="font-medium theme-text-primary">{totalItems}</span> rows
      </div>
    </div>
  )
}

export const PaginatedMarkdownTable = memo(function PaginatedMarkdownTable({
  children,
  className,
}: PaginatedMarkdownTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Extract thead and tbody rows from children
  const { thead, rows } = useMemo(() => extractTableParts(children), [children])

  const totalItems = rows.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const needsPagination = totalItems > ITEMS_PER_PAGE

  // Get paginated rows
  const paginatedRows = useMemo(() => {
    if (!needsPagination) return rows

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return rows.slice(startIndex, endIndex)
  }, [rows, currentPage, needsPagination])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // If no pagination needed, render table normally
  if (!needsPagination) {
    return (
      <div
        className={cn(
          'my-4 glass-luxury-card rounded-xl overflow-hidden !border !border-amber-500/30',
          className
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">{children}</table>
        </div>
      </div>
    )
  }

  // Render paginated table
  return (
    <div
      className={cn(
        'my-4 glass-luxury-card rounded-xl overflow-hidden !border !border-amber-500/30',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {thead}
          <tbody>
            {paginatedRows.map((row, idx) =>
              React.cloneElement(row, { key: `row-${currentPage}-${idx}` })
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={handlePageChange}
      />
    </div>
  )
})

PaginatedMarkdownTable.displayName = 'PaginatedMarkdownTable'
