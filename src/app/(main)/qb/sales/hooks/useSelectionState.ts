'use client'

import { useState, useCallback } from 'react'

interface UseSelectionStateReturn<T> {
  selected: T | null
  selectedTransaction: any | null
  select: (item: T) => void
  clearSelection: () => void
  selectTransaction: (transaction: any) => void
  clearTransaction: () => void
}

export function useSelectionState<T extends { id: string }>(): UseSelectionStateReturn<T> {
  const [selected, setSelected] = useState<T | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)

  const select = useCallback((item: T) => {
    setSelected((prev) => {
      if (prev?.id === item.id) {
        setSelectedTransaction(null)
        return null
      }
      setSelectedTransaction(null)
      return item
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(null)
    setSelectedTransaction(null)
  }, [])

  const selectTransaction = useCallback((transaction: any) => {
    setSelectedTransaction(transaction)
  }, [])

  const clearTransaction = useCallback(() => {
    setSelectedTransaction(null)
  }, [])

  return {
    selected,
    selectedTransaction,
    select,
    clearSelection,
    selectTransaction,
    clearTransaction,
  }
}
