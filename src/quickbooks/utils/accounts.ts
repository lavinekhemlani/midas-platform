// Shared utility functions for QuickBooks account data fetching
// These functions ensure data consistency across all APIs

import { QuickBooksClient } from '../client'
import { logger } from '@/lib/logger'

// Helper to format dates consistently
export const formatDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get cash and cash equivalents (used by balance sheet and cash APIs)
export async function getCashAndEquivalents(orgId: string, realmId?: string): Promise<number> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Query bank accounts
    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(
      `SELECT * FROM Account WHERE AccountType = 'Bank' AND Active = true`
    )
    const accounts = result.QueryResponse?.Account || []

    // Sum up all bank account balances
    const cashBalance = accounts.reduce((sum: number, account: any) => {
      return sum + (parseFloat(account.CurrentBalance || '0') || 0)
    }, 0)

    console.log('[getCashAndEquivalents] Result:', {
      accountCount: accounts.length,
      totalCashBalance: cashBalance,
      accounts: accounts.map((acc: any) => ({
        name: acc.Name,
        balance: acc.CurrentBalance,
      })),
    })

    return cashBalance
  } catch (error) {
    // console.error('Error fetching cash and equivalents:', error)
    logger.warn('[QB:Enrichment] Cash & equivalents fetch failed (non-critical, using 0)', {
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}

// Get accounts receivable total (used by balance sheet, receivables, and cash APIs)
export async function getAccountsReceivable(
  orgId: string,
  asOfDate?: string,
  realmId?: string
): Promise<number> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Method 1: Try to get from AR account balance
    const arAccounts = await client.query<{ QueryResponse?: { Account?: any[] } }>(
      `SELECT * FROM Account WHERE AccountType = 'Accounts Receivable' AND Active = true`
    )
    if (arAccounts.QueryResponse?.Account?.length && arAccounts.QueryResponse.Account.length > 0) {
      return arAccounts.QueryResponse.Account.reduce(
        (sum: number, acc: any) => sum + parseFloat(acc.CurrentBalance || '0'),
        0
      )
    }

    // Method 2: Fallback to open invoices
    let query = `SELECT * FROM Invoice WHERE Balance > '0'`
    if (asOfDate) {
      query += ` AND TxnDate <= '${asOfDate}'`
    }
    query += ` MAXRESULTS 1000`

    const invoices = await client.query<{ QueryResponse?: { Invoice?: any[] } }>(query)
    const totalAR = (invoices.QueryResponse?.Invoice || []).reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.Balance || '0'),
      0
    )

    return totalAR
  } catch (error) {
    console.error('Error fetching accounts receivable:', error)
    return 0
  }
}

// Get accounts payable total (used by balance sheet, payables, and cash APIs)
export async function getAccountsPayable(
  orgId: string,
  asOfDate?: string,
  realmId?: string
): Promise<number> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // Method 1: Try to get from AP account balance
    const apAccounts = await client.query<{ QueryResponse?: { Account?: any[] } }>(
      `SELECT * FROM Account WHERE AccountType = 'Accounts Payable' AND Active = true`
    )
    if (apAccounts.QueryResponse?.Account?.length && apAccounts.QueryResponse.Account.length > 0) {
      return Math.abs(
        apAccounts.QueryResponse.Account.reduce(
          (sum: number, acc: any) => sum + parseFloat(acc.CurrentBalance || '0'),
          0
        )
      )
    }

    // Method 2: Fallback to open bills
    let query = `SELECT * FROM Bill WHERE Balance > '0'`
    if (asOfDate) {
      query += ` AND TxnDate <= '${asOfDate}'`
    }
    query += ` MAXRESULTS 1000`

    const bills = await client.query<{ QueryResponse?: { Bill?: any[] } }>(query)
    const totalAP = (bills.QueryResponse?.Bill || []).reduce(
      (sum: number, bill: any) => sum + parseFloat(bill.Balance || '0'),
      0
    )

    return totalAP
  } catch (error) {
    console.error('Error fetching accounts payable:', error)
    return 0
  }
}

// Get inventory value (used for quick ratio calculation)
export async function getInventoryValue(
  orgId: string,
  realmId?: string,
  asOfDate?: string
): Promise<{ value: number; debug?: any }> {
  const debugInfo: any = {
    method1: { tried: false, success: false, error: null, data: null },
    method2: { tried: false, success: false, error: null, data: null },
    method3: { tried: false, success: false, error: null, data: null },
    finalValue: 0,
  }

  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })
    // console.log(`[getInventoryValue] Starting inventory fetch for org: ${orgId}`)

    // Method 1: Query Other Current Asset accounts
    // NOTE: Removed AccountSubType filter as it may not be valid
    debugInfo.method1.tried = true
    try {
      const invAccounts = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
        SELECT * FROM Account
        WHERE AccountType = 'Other Current Asset'
        AND Active = true
      `)

      if (invAccounts.QueryResponse?.Account && invAccounts.QueryResponse.Account.length > 0) {
        // Filter for inventory-related accounts
        const inventoryAccounts = invAccounts.QueryResponse.Account.filter((acc: any) => {
          const name = (acc.Name || '').toLowerCase()
          const fullyQualifiedName = (acc.FullyQualifiedName || '').toLowerCase()
          const subType = (acc.AccountSubType || '').toLowerCase()
          return (
            name.includes('inventory') ||
            name.includes('stock') ||
            name.includes('merchandise') ||
            fullyQualifiedName.includes('inventory') ||
            fullyQualifiedName.includes('stock') ||
            subType.includes('inventory')
          )
        })

        debugInfo.method1.data = {
          totalAccounts: invAccounts.QueryResponse?.Account?.length || 0,
          inventoryAccounts: inventoryAccounts.length,
          accounts: inventoryAccounts.map((acc: any) => ({
            name: acc.Name,
            balance: acc.CurrentBalance,
            subType: acc.AccountSubType,
          })),
        }

        if (inventoryAccounts.length > 0) {
          const total = inventoryAccounts.reduce(
            (sum: number, acc: any) => sum + Math.abs(parseFloat(acc.CurrentBalance || '0')),
            0
          )

          if (total > 0) {
            debugInfo.method1.success = true
            debugInfo.finalValue = total
            // console.log(`[getInventoryValue] Method 1 succeeded: $${total}`)
            return { value: total, debug: debugInfo }
          }
        }
      }
    } catch (error: any) {
      debugInfo.method1.error = error.message
      console.error('[getInventoryValue] Method 1 failed:', error.message)
    }

    // Method 2: Try with Cost of Goods Sold accounts as they might have inventory info
    debugInfo.method2.tried = true
    try {
      const cogsAccounts = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
        SELECT * FROM Account
        WHERE AccountType = 'Cost of Goods Sold'
        AND Active = true
      `)

      if (cogsAccounts.QueryResponse?.Account && cogsAccounts.QueryResponse.Account.length > 0) {
        const inventoryRelated = cogsAccounts.QueryResponse.Account.filter((acc: any) => {
          const name = (acc.Name || '').toLowerCase()
          return name.includes('inventory') || name.includes('stock')
        })

        debugInfo.method2.data = {
          totalAccounts: cogsAccounts.QueryResponse?.Account?.length || 0,
          inventoryRelated: inventoryRelated.length,
        }

        // Note: COGS accounts typically have negative balances representing expenses
        // We don't use these for inventory value, but log for debugging
      }
    } catch (error: any) {
      debugInfo.method2.error = error.message
      console.error('[getInventoryValue] Method 2 failed:', error.message)
    }

    // Method 3: Query inventory items directly for most accurate calculation
    debugInfo.method3.tried = true
    try {
      // First, get count of items
      const countQuery = await client.query<{ QueryResponse?: { totalCount?: number } }>(
        `SELECT COUNT(*) FROM Item WHERE Type = 'Inventory'`
      )
      const totalItems = countQuery.QueryResponse?.totalCount || 0

      // console.log(`[getInventoryValue] Found ${totalItems} inventory items`)

      // Fetch items in batches if needed
      let allItems: any[] = []
      let startPosition = 1
      const maxResults = 1000

      while (startPosition <= totalItems) {
        const items = await client.query<{ QueryResponse?: { Item?: any | any[] } }>(
          `SELECT * FROM Item WHERE Type = 'Inventory' AND Active = true STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
        )

        if (items.QueryResponse?.Item) {
          const itemBatch = Array.isArray(items.QueryResponse.Item)
            ? items.QueryResponse.Item
            : [items.QueryResponse.Item]
          allItems = allItems.concat(itemBatch)
        }

        startPosition += maxResults

        // Break if we've fetched all items or hit a reasonable limit
        if (allItems.length >= totalItems || startPosition > 5000) break
      }

      debugInfo.method3.data = {
        totalItems: allItems.length,
        sampleItems: allItems.slice(0, 5).map((item: any) => ({
          name: item.Name,
          qty: item.QtyOnHand,
          purchaseCost: item.PurchaseCost,
          unitPrice: item.UnitPrice,
        })),
      }

      if (allItems.length > 0) {
        const totalInventory = allItems.reduce((sum: number, item: any) => {
          const qty = parseFloat(item.QtyOnHand || '0')
          // Try multiple cost fields
          const cost = parseFloat(
            item.PurchaseCost || item.UnitPrice || item.PurchaseDesc?.Amount || '0'
          )
          return sum + qty * cost
        }, 0)

        if (totalInventory > 0) {
          debugInfo.method3.success = true
          debugInfo.finalValue = totalInventory
          // console.log(`[getInventoryValue] Method 3 succeeded: $${totalInventory}`)
          return { value: totalInventory, debug: debugInfo }
        }
      }
    } catch (error: any) {
      debugInfo.method3.error = error.message
      console.error('[getInventoryValue] Method 3 failed:', error.message)
    }

    // If all methods fail, return 0
    console.warn('[getInventoryValue] All methods failed, returning 0')
    return { value: 0, debug: debugInfo }
  } catch (error) {
    console.error('[getInventoryValue] Critical error:', error)
    return { value: 0, debug: { error: (error as any).message } }
  }
}

// Get current assets (used for current ratio calculation)
export async function getCurrentAssets(orgId: string, realmId?: string): Promise<number> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // NOTE: Removed 'Inventory' as it's not a valid AccountType
    // Inventory accounts are included under 'Other Current Asset'
    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE AccountType IN ('Bank', 'Accounts Receivable', 'Other Current Asset')
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []
    const currentAssets = accounts.reduce((sum: number, account: any) => {
      return sum + parseFloat(account.CurrentBalance || '0')
    }, 0)

    console.log('[getCurrentAssets] Result:', {
      accountCount: accounts.length,
      totalCurrentAssets: currentAssets,
      sampleAccounts: accounts.slice(0, 3).map((acc: any) => ({
        name: acc.Name,
        type: acc.AccountType,
        balance: acc.CurrentBalance,
      })),
    })

    return currentAssets
  } catch (error) {
    console.error('Error fetching current assets:', error)
    return 0
  }
}

// Get current liabilities (used for current ratio calculation)
export async function getCurrentLiabilities(orgId: string, realmId?: string): Promise<number> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE AccountType IN ('Accounts Payable', 'Credit Card', 'Other Current Liability')
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []
    const currentLiabilities = accounts.reduce((sum: number, account: any) => {
      return sum + Math.abs(parseFloat(account.CurrentBalance || '0'))
    }, 0)

    console.log('[getCurrentLiabilities] Result:', {
      accountCount: accounts.length,
      totalCurrentLiabilities: currentLiabilities,
      sampleAccounts: accounts.slice(0, 3).map((acc: any) => ({
        name: acc.Name,
        type: acc.AccountType,
        balance: acc.CurrentBalance,
      })),
    })

    return currentLiabilities
  } catch (error) {
    console.error('Error fetching current liabilities:', error)
    return 0
  }
}

// Get all asset accounts with detailed breakdown
export async function getDetailedAssets(orgId: string, realmId?: string): Promise<any[]> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // NOTE: Removed 'Inventory' as it's not a valid AccountType
    // NOTE: Removed 'ORDER BY AccountType' as it's not sortable in QuickBooks API
    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE AccountType IN ('Bank', 'Accounts Receivable', 'Other Current Asset', 'Fixed Asset', 'Other Asset')
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []

    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.Name,
      fullyQualifiedName: acc.FullyQualifiedName,
      type: acc.AccountType,
      subType: acc.AccountSubType,
      balance: parseFloat(acc.CurrentBalance || '0'),
      active: acc.Active,
    }))
  } catch (error) {
    console.error('Error fetching detailed assets:', error)
    return []
  }
}

// Get all liability accounts with detailed breakdown
export async function getDetailedLiabilities(orgId: string, realmId?: string): Promise<any[]> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // NOTE: Removed 'ORDER BY AccountType' as it's not sortable in QuickBooks API
    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE AccountType IN ('Accounts Payable', 'Credit Card', 'Other Current Liability', 'Long Term Liability')
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []

    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.Name,
      fullyQualifiedName: acc.FullyQualifiedName,
      type: acc.AccountType,
      subType: acc.AccountSubType,
      balance: Math.abs(parseFloat(acc.CurrentBalance || '0')),
      active: acc.Active,
    }))
  } catch (error) {
    console.error('Error fetching detailed liabilities:', error)
    return []
  }
}

// Get accounts by classification (Revenue, Expense, Asset, Liability, Equity)
// Used for building hierarchical P&L structures using fully_qualified_name
export async function getAccountsByClassification(
  orgId: string,
  classification: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity',
  realmId?: string
): Promise<
  Array<{
    id: string
    name: string
    accNum?: string
    displayName: string // AcctNum + Name format (e.g., "4010 Rocketship")
    fullyQualifiedName: string
    classification: string
    accountType: string
    parentAccountId?: string
  }>
> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    // QuickBooks API uses Classification field for income statement accounts
    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE Classification = '${classification}'
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []

    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.Name,
      accNum: acc.AcctNum, // Account number (e.g., "4010")
      // Display name matches P&L format: "AcctNum Name" (e.g., "4010 Rocketship")
      displayName: acc.AcctNum ? `${acc.AcctNum} ${acc.Name}` : acc.Name,
      fullyQualifiedName: acc.FullyQualifiedName || acc.Name,
      classification: acc.Classification,
      accountType: acc.AccountType,
      parentAccountId: acc.ParentRef?.value,
    }))
  } catch (error) {
    console.error(`Error fetching ${classification} accounts:`, error)
    return []
  }
}

// Get equity accounts
export async function getEquityAccounts(orgId: string, realmId?: string): Promise<any[]> {
  try {
    const client = new QuickBooksClient({ organizationId: orgId, realmId })

    const result = await client.query<{ QueryResponse?: { Account?: any[] } }>(`
      SELECT * FROM Account
      WHERE AccountType = 'Equity'
      AND Active = true
    `)

    const accounts = result.QueryResponse?.Account || []

    return accounts.map((acc: any) => ({
      id: acc.Id,
      name: acc.Name,
      fullyQualifiedName: acc.FullyQualifiedName,
      type: acc.AccountType,
      subType: acc.AccountSubType,
      balance: parseFloat(acc.CurrentBalance || '0'),
      active: acc.Active,
    }))
  } catch (error) {
    console.error('Error fetching equity accounts:', error)
    return []
  }
}
