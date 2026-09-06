// src/hooks/useCOA.ts
import useSWR from 'swr'
import type { Account } from '@/lib/providers/quickbooks/accounts'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface COAResponse {
  accounts: Account[]
  count: number
  provider: string
}

/**
 * Hook to lookup accounts from Chart of Accounts
 * Returns helper functions for account lookups used in report views
 */
export function useAccountLookup() {
  const { data } = useSWR<COAResponse>('/api/coa', fetcher)
  const accounts: Account[] = data?.accounts || []

  /**
   * Find an account by its name
   */
  const getAccountByName = (name: string): Account | undefined => {
    return accounts.find((acc) => acc.name === name)
  }

  /**
   * Find an account by name AND classification (Revenue, Expense, Asset, Liability, Equity)
   * This is important because the same account name can exist in different categories
   * e.g., "Plants and Soil" can be both a Revenue sub-account and an Expense sub-account
   */
  const getAccountByNameAndClassification = (
    name: string,
    classification: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity'
  ): Account | undefined => {
    return accounts.find((acc) => acc.name === name && acc.classification === classification)
  }

  /**
   * Calculate the depth/hierarchy level of an account
   * Based on fully_qualified_name (e.g., "Parent:Child:GrandChild" = depth 2)
   */
  const getAccountDepth = (account: Account): number => {
    if (!account.fully_qualified_name) return 0
    return account.fully_qualified_name.split(':').length - 1
  }

  /**
   * Get the parent account name from fully_qualified_name
   * Returns null if the account is top-level (no parent)
   */
  const getParentAccountName = (account: Account): string | null => {
    if (!account.fully_qualified_name) return null
    const parts = account.fully_qualified_name.split(':')
    if (parts.length <= 1) return null
    return parts[0] // Return the top-level parent
  }

  /**
   * Group items by their parent account for hierarchical display
   * Returns a map of parent name -> child items
   */
  const groupItemsByParent = (
    items: Array<{ name: string; value: number }>
  ): Map<
    string | null,
    Array<{ name: string; value: number; depth: number; parentName: string | null }>
  > => {
    const groups = new Map<
      string | null,
      Array<{ name: string; value: number; depth: number; parentName: string | null }>
    >()

    items.forEach((item) => {
      const account = getAccountByName(item.name)
      const parentName = account ? getParentAccountName(account) : null
      const depth = account ? getAccountDepth(account) : 0

      if (!groups.has(parentName)) {
        groups.set(parentName, [])
      }
      groups.get(parentName)!.push({
        ...item,
        depth,
        parentName,
      })
    })

    return groups
  }

  return {
    getAccountByName,
    getAccountByNameAndClassification,
    getAccountDepth,
    getParentAccountName,
    groupItemsByParent,
  }
}
