// src/lib/providers/quickbooks/accounts.ts
import { QuickBooksClient } from './client'

export interface Account {
  id: string
  name: string
  account_type: string
  account_sub_type?: string
  account_number?: string
  description?: string
  classification?: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue'
  current_balance?: number
  current_balance_with_sub_accounts?: number
  currency_code?: string
  active: boolean
  sub_account?: boolean
  parent_account_id?: string
  parent_account_name?: string
  fully_qualified_name?: string
  opening_balance?: number
  opening_balance_date?: string
  tax_type?: string
  acct_num?: string
  created_time?: string
  last_modified_time?: string
}

export interface AccountListOptions {
  account_type?: string
  classification?: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue'
  active?: boolean
  sub_account?: boolean
  limit?: number
  page?: number
  per_page?: number
  sort_column?: string
  sort_order?: 'asc' | 'desc'
  fetch_all?: boolean
}

const mapAccount = (qbAccount: any): Account => {
  return {
    id: qbAccount.Id,
    name: qbAccount.Name,
    account_type: qbAccount.AccountType,
    account_sub_type: qbAccount.AccountSubType,
    account_number: qbAccount.AcctNum,
    description: qbAccount.Description,
    classification: qbAccount.Classification,
    current_balance: qbAccount.CurrentBalance ? parseFloat(qbAccount.CurrentBalance) : undefined,
    current_balance_with_sub_accounts: qbAccount.CurrentBalanceWithSubAccounts
      ? parseFloat(qbAccount.CurrentBalanceWithSubAccounts)
      : undefined,
    currency_code: qbAccount.CurrencyRef?.value || 'USD',
    active: qbAccount.Active !== false,
    sub_account: qbAccount.SubAccount === true,
    parent_account_id: qbAccount.ParentRef?.value,
    parent_account_name: qbAccount.ParentRef?.name,
    fully_qualified_name: qbAccount.FullyQualifiedName,
    opening_balance: qbAccount.OpeningBalance ? parseFloat(qbAccount.OpeningBalance) : undefined,
    opening_balance_date: qbAccount.OpeningBalanceDate,
    tax_type: qbAccount.TaxCodeRef?.value,
    acct_num: qbAccount.AcctNum,
    created_time: qbAccount.MetaData?.CreateTime,
    last_modified_time: qbAccount.MetaData?.LastUpdatedTime,
  }
}

export const listAccounts = async (
  userOrgId: string,
  options?: AccountListOptions
): Promise<Account[]> => {
  try {
    const client = new QuickBooksClient({ organizationId: userOrgId })

    let baseQuery = 'SELECT * FROM Account'
    const conditions: string[] = []

    // Add account type filter
    if (options?.account_type) {
      conditions.push(`AccountType = '${options.account_type}'`)
    }

    // Add classification filter
    if (options?.classification) {
      conditions.push(`Classification = '${options.classification}'`)
    }

    // Add active filter
    if (options?.active !== undefined) {
      conditions.push(`Active = ${options.active}`)
    }

    // Add sub-account filter
    if (options?.sub_account !== undefined) {
      conditions.push(`SubAccount = ${options.sub_account}`)
    }

    // Build WHERE clause
    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`
    }

    // Add sorting
    const sortColumn = options?.sort_column || 'Name'
    const sortOrder = options?.sort_order || 'asc'
    const qbSortColumn =
      sortColumn === 'name'
        ? 'Name'
        : sortColumn === 'account_type'
          ? 'AccountType'
          : sortColumn === 'balance'
            ? 'CurrentBalance'
            : sortColumn === 'account_number'
              ? 'AcctNum'
              : 'Name'
    baseQuery += ` ORDERBY ${qbSortColumn} ${sortOrder.toUpperCase()}`

    // If fetch_all is true, paginate through all results
    if (options?.fetch_all) {
      const allAccounts: Account[] = []
      const batchSize = 1000
      let startPosition = 1
      let hasMore = true

      while (hasMore) {
        let query = baseQuery
        if (startPosition > 1) {
          query += ` STARTPOSITION ${startPosition}`
        }
        query += ` MAXRESULTS ${batchSize}`

        const response = await client.query<any>(query)
        const accounts = response.QueryResponse?.Account || []

        allAccounts.push(...accounts.map(mapAccount))

        if (accounts.length < batchSize) {
          hasMore = false
        } else {
          startPosition += batchSize
        }
      }

      return allAccounts
    }

    // Standard pagination
    const page = options?.page || 1
    const perPage = options?.per_page || options?.limit || 100
    const startPosition = (page - 1) * perPage + 1

    let query = baseQuery
    if (startPosition > 1) {
      query += ` STARTPOSITION ${startPosition}`
    }
    query += ` MAXRESULTS ${perPage}`

    const response = await client.query<any>(query)
    const accounts = response.QueryResponse?.Account || []

    return accounts.map(mapAccount)
  } catch (error) {
    console.error('Failed to list accounts:', error)
    throw error
  }
}

export const getAccount = async (userOrgId: string, accountId: string): Promise<Account> => {
  try {
    const client = new QuickBooksClient({ organizationId: userOrgId })
    const account = await client.makeRequest(`account/${accountId}`, 'GET')
    return mapAccount(account)
  } catch (error) {
    console.error('Failed to get account:', error)
    throw error
  }
}

export const createAccount = async (
  userOrgId: string,
  accountData: Partial<Account>
): Promise<Account> => {
  try {
    const client = new QuickBooksClient({ organizationId: userOrgId })

    const qbAccount: any = {
      Name: accountData.name,
      AccountType: accountData.account_type,
      AccountSubType: accountData.account_sub_type,
      AcctNum: accountData.account_number,
      Description: accountData.description,
      Active: accountData.active !== false,
      SubAccount: accountData.sub_account,
      ParentRef: accountData.parent_account_id
        ? {
            value: accountData.parent_account_id,
          }
        : undefined,
      OpeningBalance: accountData.opening_balance,
      OpeningBalanceDate: accountData.opening_balance_date,
      CurrencyRef: accountData.currency_code
        ? {
            value: accountData.currency_code,
          }
        : undefined,
    }

    const created = await client.makeRequest('account', 'POST', qbAccount)
    return mapAccount(created)
  } catch (error) {
    console.error('Failed to create account:', error)
    throw error
  }
}

export const updateAccount = async (
  userOrgId: string,
  accountId: string,
  accountData: Partial<Account>
): Promise<Account> => {
  try {
    const client = new QuickBooksClient({ organizationId: userOrgId })

    // First get the existing account to ensure we have the SyncToken
    const existing = await client.makeRequest(`account/${accountId}`, 'GET')

    const qbAccount: any = {
      ...existing,
      Name: accountData.name || existing.Name,
      AcctNum:
        accountData.account_number !== undefined ? accountData.account_number : existing.AcctNum,
      Description:
        accountData.description !== undefined ? accountData.description : existing.Description,
      Active: accountData.active !== undefined ? accountData.active : existing.Active,
    }

    const updated = await client.makeRequest('account', 'POST', qbAccount)
    return mapAccount(updated)
  } catch (error) {
    console.error('Failed to update account:', error)
    throw error
  }
}

export const getAccountBalances = async (
  userOrgId: string,
  accountType?: string
): Promise<
  Array<{
    id: string
    name: string
    account_type: string
    balance: number
  }>
> => {
  try {
    const accounts = await listAccounts(userOrgId, {
      account_type: accountType,
      active: true,
      limit: 500,
    })

    return accounts
      .filter((acc) => acc.current_balance !== undefined)
      .map((acc) => ({
        id: acc.id,
        name: acc.name,
        account_type: acc.account_type,
        balance: acc.current_balance || 0,
      }))
  } catch (error) {
    console.error('Failed to get account balances:', error)
    throw error
  }
}

export const getChartOfAccounts = async (userOrgId: string): Promise<Record<string, Account[]>> => {
  try {
    const accounts = await listAccounts(userOrgId, {
      active: true,
      limit: 1000,
    })

    // Group accounts by type
    const grouped: Record<string, Account[]> = {}

    accounts.forEach((account) => {
      const type = account.account_type
      if (!grouped[type]) {
        grouped[type] = []
      }
      grouped[type].push(account)
    })

    // Sort each group by name
    Object.keys(grouped).forEach((type) => {
      grouped[type].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    })

    return grouped
  } catch (error) {
    console.error('Failed to get chart of accounts:', error)
    throw error
  }
}

export const getBankAccounts = async (userOrgId: string): Promise<Account[]> => {
  try {
    return await listAccounts(userOrgId, {
      account_type: 'Bank',
      active: true,
    })
  } catch (error) {
    console.error('Failed to get bank accounts:', error)
    throw error
  }
}

export const getCreditCardAccounts = async (userOrgId: string): Promise<Account[]> => {
  try {
    return await listAccounts(userOrgId, {
      account_type: 'Credit Card',
      active: true,
    })
  } catch (error) {
    console.error('Failed to get credit card accounts:', error)
    throw error
  }
}

export const getIncomeAccounts = async (userOrgId: string): Promise<Account[]> => {
  try {
    return await listAccounts(userOrgId, {
      classification: 'Revenue',
      active: true,
    })
  } catch (error) {
    console.error('Failed to get income accounts:', error)
    throw error
  }
}

export const getExpenseAccounts = async (userOrgId: string): Promise<Account[]> => {
  try {
    return await listAccounts(userOrgId, {
      classification: 'Expense',
      active: true,
    })
  } catch (error) {
    console.error('Failed to get expense accounts:', error)
    throw error
  }
}
