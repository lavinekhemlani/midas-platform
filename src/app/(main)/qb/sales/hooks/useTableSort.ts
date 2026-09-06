'use client'

import { useState, useMemo, useCallback } from 'react'
import type { SortOrder } from '../types'

interface UseTableSortOptions<T, K extends string> {
  data: T[]
  initialSortBy: K
  initialSortOrder?: SortOrder
  sortFn: (a: T, b: T, sortBy: K, sortOrder: SortOrder) => number
}

interface UseTableSortReturn<T, K extends string> {
  sortedData: T[]
  sortBy: K
  sortOrder: SortOrder
  handleSort: (column: K) => void
}

export function useTableSort<T, K extends string>({
  data,
  initialSortBy,
  initialSortOrder = 'desc',
  sortFn,
}: UseTableSortOptions<T, K>): UseTableSortReturn<T, K> {
  const [sortBy, setSortBy] = useState<K>(initialSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

  const handleSort = useCallback((column: K) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortOrder('desc')
      return column
    })
  }, [])

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []
    return [...data].sort((a, b) => sortFn(a, b, sortBy, sortOrder))
  }, [data, sortBy, sortOrder, sortFn])

  return {
    sortedData,
    sortBy,
    sortOrder,
    handleSort,
  }
}
