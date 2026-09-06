'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface Account {
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

interface HierarchicalAccount extends Account {
  children: HierarchicalAccount[]
  depth: number
}

interface ValidationError {
  accountId: string
  accountName: string
  message: string
  expected: number
  actual: number
}

interface ColumnVisibility {
  account_number: boolean
  description: boolean
  account_sub_type: boolean
  opening_balance: boolean
  opening_balance_date: boolean
  tax_type: boolean
  currency_code: boolean
}

type Classification = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

const CLASSIFICATION_ORDER: Classification[] = [
  'Asset',
  'Liability',
  'Equity',
  'Revenue',
  'Expense',
]

const CLASSIFICATION_COLORS: Record<Classification, string> = {
  Asset: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  Liability: 'bg-red-500/10 text-red-700 dark:text-red-400',
  Equity: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  Revenue: 'bg-green-500/10 text-green-700 dark:text-green-400',
  Expense: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
}

function formatCurrency(value: number | undefined, currency: string = 'USD'): string {
  if (value === undefined || value === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

// Format camelCase or PascalCase strings to readable text
function formatSubType(subType: string | undefined): string {
  if (!subType) return '-'
  // Insert space before capital letters and handle edge cases
  return subType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

// Pluralize helper
function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural || `${singular}s`
}

interface TypeGroup {
  type: string
  accounts: HierarchicalAccount[]
  subtotal: number
}

interface ClassificationGroup {
  classification: Classification
  types: TypeGroup[]
  subtotal: number
  totalAccounts: number
}

function buildHierarchy(accounts: Account[]): Map<Classification, ClassificationGroup> {
  const accountMap = new Map<string, Account>()
  accounts.forEach((acc) => accountMap.set(acc.id, acc))

  const resultByClassification = new Map<Classification, ClassificationGroup>()
  CLASSIFICATION_ORDER.forEach((c) =>
    resultByClassification.set(c, {
      classification: c,
      types: [],
      subtotal: 0,
      totalAccounts: 0,
    })
  )

  const processedIds = new Set<string>()

  function buildTree(account: Account, depth: number): HierarchicalAccount {
    processedIds.add(account.id)
    const children: HierarchicalAccount[] = []

    accounts.forEach((acc) => {
      if (acc.parent_account_id === account.id && !processedIds.has(acc.id)) {
        children.push(buildTree(acc, depth + 1))
      }
    })

    children.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return {
      ...account,
      children,
      depth,
    }
  }

  // Find root accounts (no parent or parent not in list)
  const rootAccounts = accounts.filter(
    (acc) => !acc.parent_account_id || !accountMap.has(acc.parent_account_id)
  )

  // Group by classification, then by type
  const tempGroups = new Map<Classification, Map<string, HierarchicalAccount[]>>()
  CLASSIFICATION_ORDER.forEach((c) => tempGroups.set(c, new Map()))

  rootAccounts.forEach((acc) => {
    if (!processedIds.has(acc.id)) {
      const tree = buildTree(acc, 0)
      const classification = acc.classification as Classification
      const accountType = acc.account_type || 'Other'

      if (classification && tempGroups.has(classification)) {
        const typeMap = tempGroups.get(classification)!
        if (!typeMap.has(accountType)) {
          typeMap.set(accountType, [])
        }
        typeMap.get(accountType)!.push(tree)
      }
    }
  })

  // Convert to final structure with subtotals
  tempGroups.forEach((typeMap, classification) => {
    const classGroup = resultByClassification.get(classification)!
    const types: TypeGroup[] = []

    typeMap.forEach((accounts, typeName) => {
      // Sort accounts within type
      accounts.sort((a, b) => (a.name || '').localeCompare(b.name || ''))

      // Calculate subtotal for this type
      let typeSubtotal = 0
      accounts.forEach((acc) => {
        if (acc.current_balance_with_sub_accounts !== undefined) {
          typeSubtotal += acc.current_balance_with_sub_accounts
        } else {
          typeSubtotal += acc.current_balance || 0
        }
      })

      types.push({
        type: typeName,
        accounts,
        subtotal: typeSubtotal,
      })
    })

    // Sort types alphabetically
    types.sort((a, b) => a.type.localeCompare(b.type))

    // Calculate classification totals
    let classSubtotal = 0
    let totalAccounts = 0
    types.forEach((t) => {
      classSubtotal += t.subtotal
      t.accounts.forEach((acc) => {
        totalAccounts += 1 + flattenForDisplay([acc]).length - 1
      })
    })

    classGroup.types = types
    classGroup.subtotal = classSubtotal
    classGroup.totalAccounts = totalAccounts
  })

  return resultByClassification
}

function flattenForDisplay(accounts: HierarchicalAccount[]): HierarchicalAccount[] {
  const result: HierarchicalAccount[] = []
  function traverse(acc: HierarchicalAccount) {
    result.push(acc)
    acc.children.forEach(traverse)
  }
  accounts.forEach(traverse)
  return result
}

function validateBalances(accounts: HierarchicalAccount[]): ValidationError[] {
  const errors: ValidationError[] = []

  function validate(acc: HierarchicalAccount) {
    if (acc.children.length > 0 && acc.current_balance_with_sub_accounts !== undefined) {
      // Calculate sum of children's balances
      let childrenSum = 0
      acc.children.forEach((child) => {
        if (child.children.length > 0 && child.current_balance_with_sub_accounts !== undefined) {
          childrenSum += child.current_balance_with_sub_accounts
        } else {
          childrenSum += child.current_balance || 0
        }
      })

      // Add parent's own balance if it has one
      const parentOwnBalance = acc.current_balance || 0
      const expectedTotal = parentOwnBalance + childrenSum

      // Check if the balance with sub accounts matches
      const diff = Math.abs(acc.current_balance_with_sub_accounts - expectedTotal)
      if (diff > 0.01) {
        // Allow for small floating point differences
        errors.push({
          accountId: acc.id,
          accountName: acc.fully_qualified_name || acc.name,
          message: `Balance with sub-accounts doesn't match calculated sum`,
          expected: expectedTotal,
          actual: acc.current_balance_with_sub_accounts,
        })
      }
    }

    acc.children.forEach(validate)
  }

  accounts.forEach(validate)
  return errors
}

function detectEmptyColumns(accounts: Account[]): ColumnVisibility {
  const visibility: ColumnVisibility = {
    account_number: false,
    description: false,
    account_sub_type: false,
    opening_balance: false,
    opening_balance_date: false,
    tax_type: false,
    currency_code: false,
  }

  accounts.forEach((acc) => {
    if (acc.account_number) visibility.account_number = true
    if (acc.description) visibility.description = true
    if (acc.account_sub_type) visibility.account_sub_type = true
    if (acc.opening_balance !== undefined && acc.opening_balance !== null)
      visibility.opening_balance = true
    if (acc.opening_balance_date) visibility.opening_balance_date = true
    if (acc.tax_type) visibility.tax_type = true
    // Check if there are multiple currencies
    const currencies = new Set(accounts.map((a) => a.currency_code).filter(Boolean))
    if (currencies.size > 1) visibility.currency_code = true
  })

  return visibility
}

function AccountRow({
  account,
  columnVisibility,
  hasError,
  currency,
}: {
  account: HierarchicalAccount
  columnVisibility: ColumnVisibility
  hasError: boolean
  currency: string
}) {
  const indent = account.depth * 24

  return (
    <TableRow className={cn(hasError && 'bg-red-50 dark:bg-red-950/20')}>
      {columnVisibility.account_number && (
        <TableCell className="font-mono text-xs">{account.account_number || '-'}</TableCell>
      )}
      <TableCell>
        <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
          {account.depth > 0 && <span className="mr-1 text-muted-foreground">├</span>}
          <span className={cn(account.children.length > 0 && 'font-medium')}>{account.name}</span>
          {!account.active && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Inactive
            </Badge>
          )}
          {hasError && <AlertCircle className="ml-2 h-4 w-4 text-destructive" />}
        </div>
      </TableCell>
      {columnVisibility.account_sub_type && (
        <TableCell className="text-muted-foreground text-sm">
          {formatSubType(account.account_sub_type)}
        </TableCell>
      )}
      {columnVisibility.description && (
        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
          {account.description || '-'}
        </TableCell>
      )}
      <TableCell className="text-right font-mono">
        <span
          className={cn((account.current_balance || 0) < 0 && 'text-red-600 dark:text-red-400')}
        >
          {formatCurrency(account.current_balance, currency)}
        </span>
      </TableCell>
      {account.children.length > 0 && (
        <TableCell className="text-right font-mono">
          <span
            className={cn(
              (account.current_balance_with_sub_accounts || 0) < 0 &&
                'text-red-600 dark:text-red-400'
            )}
          >
            {formatCurrency(account.current_balance_with_sub_accounts, currency)}
          </span>
        </TableCell>
      )}
      {account.children.length === 0 && <TableCell>-</TableCell>}
      {columnVisibility.opening_balance && (
        <TableCell className="text-right font-mono">
          {formatCurrency(account.opening_balance, currency)}
        </TableCell>
      )}
      {columnVisibility.opening_balance_date && (
        <TableCell className="text-sm">{formatDate(account.opening_balance_date)}</TableCell>
      )}
      {columnVisibility.tax_type && (
        <TableCell className="text-sm">{account.tax_type || '-'}</TableCell>
      )}
      {columnVisibility.currency_code && (
        <TableCell className="text-sm">{account.currency_code || '-'}</TableCell>
      )}
    </TableRow>
  )
}

function TypeSection({
  typeGroup,
  columnVisibility,
  errorAccountIds,
  currency,
}: {
  typeGroup: TypeGroup
  columnVisibility: ColumnVisibility
  errorAccountIds: Set<string>
  currency: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const flatAccounts = useMemo(() => flattenForDisplay(typeGroup.accounts), [typeGroup.accounts])

  const colSpan =
    1 +
    (columnVisibility.account_number ? 1 : 0) +
    (columnVisibility.account_sub_type ? 1 : 0) +
    (columnVisibility.description ? 1 : 0) +
    (columnVisibility.opening_balance ? 1 : 0) +
    (columnVisibility.opening_balance_date ? 1 : 0) +
    (columnVisibility.tax_type ? 1 : 0) +
    (columnVisibility.currency_code ? 1 : 0)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 hover:bg-muted/50 cursor-pointer rounded-md transition-colors">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">{typeGroup.type}</span>
            <Badge variant="outline" className="text-xs">
              {flatAccounts.length}
            </Badge>
          </div>
          <div
            className={cn(
              'font-mono text-sm font-medium',
              typeGroup.subtotal < 0 && 'text-red-600 dark:text-red-400'
            )}
          >
            {formatCurrency(typeGroup.subtotal, currency)}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Table>
          <TableBody>
            {flatAccounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                columnVisibility={columnVisibility}
                hasError={errorAccountIds.has(account.id)}
                currency={currency}
              />
            ))}
            <TableRow className="bg-muted/20">
              <TableCell colSpan={colSpan} className="text-right text-sm font-medium">
                Total {typeGroup.type}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                <span className={cn(typeGroup.subtotal < 0 && 'text-red-600 dark:text-red-400')}>
                  {formatCurrency(typeGroup.subtotal, currency)}
                </span>
              </TableCell>
              <TableCell />
              {columnVisibility.opening_balance && <TableCell />}
              {columnVisibility.opening_balance_date && <TableCell />}
              {columnVisibility.tax_type && <TableCell />}
              {columnVisibility.currency_code && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ClassificationSection({
  classificationGroup,
  columnVisibility,
  validationErrors,
  currency,
}: {
  classificationGroup: ClassificationGroup
  columnVisibility: ColumnVisibility
  validationErrors: ValidationError[]
  currency: string
}) {
  const [isOpen, setIsOpen] = useState(true)
  const { classification, types, subtotal, totalAccounts } = classificationGroup

  const errorAccountIds = useMemo(
    () => new Set(validationErrors.map((e) => e.accountId)),
    [validationErrors]
  )

  const allFlatAccounts = useMemo(() => {
    const all: HierarchicalAccount[] = []
    types.forEach((t) => {
      all.push(...flattenForDisplay(t.accounts))
    })
    return all
  }, [types])

  const sectionHasErrors = allFlatAccounts.some((acc) => errorAccountIds.has(acc.id))

  if (types.length === 0) return null

  const colSpan =
    1 +
    (columnVisibility.account_number ? 1 : 0) +
    (columnVisibility.account_sub_type ? 1 : 0) +
    (columnVisibility.description ? 1 : 0) +
    (columnVisibility.opening_balance ? 1 : 0) +
    (columnVisibility.opening_balance_date ? 1 : 0) +
    (columnVisibility.tax_type ? 1 : 0) +
    (columnVisibility.currency_code ? 1 : 0)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-4">
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
                <CardTitle className="text-lg">{classification}</CardTitle>
                <Badge className={CLASSIFICATION_COLORS[classification]}>
                  {totalAccounts} {pluralize(totalAccounts, 'account')}
                </Badge>
                <Badge variant="outline">
                  {types.length} {pluralize(types.length, 'type')}
                </Badge>
                {sectionHasErrors && <Badge variant="destructive">Has Errors</Badge>}
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Subtotal</div>
                <div
                  className={cn(
                    'text-lg font-semibold font-mono',
                    subtotal < 0 && 'text-red-600 dark:text-red-400'
                  )}
                >
                  {formatCurrency(subtotal, currency)}
                </div>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {/* Table Header */}
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.account_number && (
                    <TableHead className="w-[100px]">Acct #</TableHead>
                  )}
                  <TableHead>Account Name</TableHead>
                  {columnVisibility.account_sub_type && (
                    <TableHead className="w-[150px]">Sub Type</TableHead>
                  )}
                  {columnVisibility.description && (
                    <TableHead className="w-[200px]">Description</TableHead>
                  )}
                  <TableHead className="text-right w-[130px]">Balance</TableHead>
                  <TableHead className="text-right w-[130px]">With Subs</TableHead>
                  {columnVisibility.opening_balance && (
                    <TableHead className="text-right w-[130px]">Opening Bal</TableHead>
                  )}
                  {columnVisibility.opening_balance_date && (
                    <TableHead className="w-[120px]">Opening Date</TableHead>
                  )}
                  {columnVisibility.tax_type && (
                    <TableHead className="w-[100px]">Tax Type</TableHead>
                  )}
                  {columnVisibility.currency_code && (
                    <TableHead className="w-[80px]">Currency</TableHead>
                  )}
                </TableRow>
              </TableHeader>
            </Table>

            {/* Type Sections */}
            {types.map((typeGroup) => (
              <TypeSection
                key={typeGroup.type}
                typeGroup={typeGroup}
                columnVisibility={columnVisibility}
                errorAccountIds={errorAccountIds}
                currency={currency}
              />
            ))}

            {/* Classification Total - only show when multiple types */}
            {types.length > 1 && (
              <Table>
                <TableBody>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={colSpan} className="text-right">
                      Total {classification}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={cn(subtotal < 0 && 'text-red-600 dark:text-red-400')}>
                        {formatCurrency(subtotal, currency)}
                      </span>
                    </TableCell>
                    <TableCell />
                    {columnVisibility.opening_balance && <TableCell />}
                    {columnVisibility.opening_balance_date && <TableCell />}
                    {columnVisibility.tax_type && <TableCell />}
                    {columnVisibility.currency_code && <TableCell />}
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function ChartOfAccountsPage() {
  const { currency } = useCurrency()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/coa')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch accounts')
        }

        setAccounts(data.accounts || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchAccounts()
  }, [])

  const hierarchyByClassification = useMemo(() => buildHierarchy(accounts), [accounts])

  const columnVisibility = useMemo(() => detectEmptyColumns(accounts), [accounts])

  const validationErrors = useMemo(() => {
    const allErrors: ValidationError[] = []
    hierarchyByClassification.forEach((classGroup) => {
      classGroup.types.forEach((typeGroup) => {
        allErrors.push(...validateBalances(typeGroup.accounts))
      })
    })
    return allErrors
  }, [hierarchyByClassification])

  const totals = useMemo(() => {
    const result: Record<Classification, number> = {
      Asset: 0,
      Liability: 0,
      Equity: 0,
      Revenue: 0,
      Expense: 0,
    }

    hierarchyByClassification.forEach((classGroup, classification) => {
      result[classification] = classGroup.subtotal
    })

    return result
  }, [hierarchyByClassification])

  // QuickBooks stores credit accounts (Liabilities, Equity, Revenue) with negative signs
  // The accounting equation check: All accounts should sum to approximately zero
  // Assets (positive) + Expenses (positive) + Liabilities (negative) + Equity (negative) + Revenue (negative) ≈ 0
  const accountingEquationCheck = useMemo(() => {
    const totalSum =
      totals.Asset + totals.Expense + totals.Liability + totals.Equity + totals.Revenue
    const difference = Math.abs(totalSum)
    const isBalanced = difference < 0.01

    // For display purposes, show debits and credits separately (using absolute values for credits)
    const debits = totals.Asset + totals.Expense
    const credits = Math.abs(totals.Liability) + Math.abs(totals.Equity) + Math.abs(totals.Revenue)

    return {
      debits,
      credits,
      difference,
      isBalanced,
    }
  }, [totals])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading chart of accounts...</div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chart of Accounts</h1>
          <p className="text-muted-foreground">Total accounts: {accounts.length}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CLASSIFICATION_ORDER.map((classification) => (
          <Card key={classification} className="py-4">
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground">{classification}</div>
              <div
                className={cn(
                  'text-xl font-bold font-mono',
                  totals[classification] < 0 && 'text-red-600 dark:text-red-400'
                )}
              >
                {formatCurrency(totals[classification], currency)}
              </div>
            </CardContent>
          </Card>
        ))}
        <Card
          className={cn(
            'py-4',
            accountingEquationCheck.isBalanced ? 'border-green-500' : 'border-red-500'
          )}
        >
          <CardContent className="pt-0">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              Balance Check
              {accountingEquationCheck.isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div
              className={cn(
                'text-xl font-bold font-mono',
                !accountingEquationCheck.isBalanced && 'text-red-600 dark:text-red-400'
              )}
            >
              {accountingEquationCheck.isBalanced
                ? 'Balanced'
                : formatCurrency(accountingEquationCheck.difference, currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Validation Warnings ({validationErrors.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {validationErrors.slice(0, 5).map((err, idx) => (
                <li key={idx} className="text-sm">
                  <strong>{err.accountName}</strong>: {err.message} (Expected:{' '}
                  {formatCurrency(err.expected, currency)}, Actual:{' '}
                  {formatCurrency(err.actual, currency)})
                </li>
              ))}
              {validationErrors.length > 5 && (
                <li className="text-sm text-muted-foreground">
                  ...and {validationErrors.length - 5} more
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Accounting Equation Check */}
      {!accountingEquationCheck.isBalanced && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400">Trial Balance Note</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-muted-foreground mb-2">
                The accounts don&apos;t balance. This is normal if the current period&apos;s net
                income hasn&apos;t been closed to Retained Earnings yet.
              </p>
              <div>
                <strong>Debits (Assets + Expenses):</strong>{' '}
                {formatCurrency(accountingEquationCheck.debits, currency)}
              </div>
              <div>
                <strong>Credits (Liabilities + Equity + Revenue):</strong>{' '}
                {formatCurrency(accountingEquationCheck.credits, currency)}
              </div>
              <div>
                <strong>Difference:</strong>{' '}
                {formatCurrency(accountingEquationCheck.difference, currency)}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Classification Sections */}
      {CLASSIFICATION_ORDER.map((classification) => {
        const classGroup = hierarchyByClassification.get(classification)
        if (!classGroup || classGroup.types.length === 0) return null
        return (
          <ClassificationSection
            key={classification}
            classificationGroup={classGroup}
            columnVisibility={columnVisibility}
            validationErrors={validationErrors}
            currency={currency}
          />
        )
      })}
    </div>
  )
}
