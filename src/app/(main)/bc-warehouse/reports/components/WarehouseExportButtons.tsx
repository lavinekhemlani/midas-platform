'use client'

import { useState } from 'react'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import type { GLAccountTotal } from '../hooks/useWarehousePnLStatement'

// Data types matching what the view passes
export interface PnLStatementData {
  revenueAccounts: GLAccountTotal[]
  revenueGroups: Record<string, GLAccountTotal[]>
  cogsAccounts: GLAccountTotal[]
  cogsGroups: Record<string, GLAccountTotal[]>
  expenseAccounts: GLAccountTotal[]
  expenseGroups: Record<string, GLAccountTotal[]>
  otherIncomeAccounts: GLAccountTotal[]
  otherIncomeGroups: Record<string, GLAccountTotal[]>
  otherExpenseAccounts: GLAccountTotal[]
  otherExpenseGroups: Record<string, GLAccountTotal[]>
  totals: {
    totalRevenue: number
    totalCOGS: number
    grossProfit: number
    totalExpenses: number
    operatingIncome: number
    totalOtherIncome: number
    totalOtherExpenses: number
    netOtherIncome: number
    netIncome: number
  }
}

export interface BalanceSheetData {
  assetAccounts: GLAccountTotal[]
  assetGroups: Record<string, GLAccountTotal[]>
  liabilityAccounts: GLAccountTotal[]
  liabilityGroups: Record<string, GLAccountTotal[]>
  equityAccounts: GLAccountTotal[]
  equityGroups: Record<string, GLAccountTotal[]>
  netIncomeForPeriod?: number
  totals: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    totalLiabilitiesAndEquity: number
  }
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
    fontFamily: 'Helvetica-Bold',
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  rowHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  rowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingTop: 5,
    marginTop: 4,
  },
  accountCell: {
    flex: 3,
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  indent1: {
    paddingLeft: 10,
  },
  indent2: {
    paddingLeft: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
})

// Format currency for PDF
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// Helper to get net amount for an account (respecting credit/debit nature)
function getAccountAmount(account: GLAccountTotal, isIncome: boolean): number {
  if (isIncome) {
    return account.total_credits - account.total_debits
  } else {
    return account.total_debits - account.total_credits
  }
}

// P&L PDF Document
function PnLPDFDocument({
  data,
  companyName,
  currency,
  dateRange,
}: {
  data: PnLStatementData
  companyName: string
  currency: string
  dateRange?: { start: string; end: string }
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{companyName || 'Company'}</Text>
          <Text style={styles.subtitle}>Profit & Loss Statement</Text>
          {dateRange && (
            <Text style={styles.subtitle}>
              {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
            </Text>
          )}
        </View>

        {/* Revenue Section */}
        <View style={[styles.row, styles.rowHeader]}>
          <Text style={[styles.accountCell, styles.bold]}>Revenue</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.revenueAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getAccountAmount(account, true), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total Revenue</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalRevenue, currency)}
          </Text>
        </View>

        {/* COGS Section */}
        <View style={[styles.row, styles.rowHeader, { marginTop: 15 }]}>
          <Text style={[styles.accountCell, styles.bold]}>Cost of Goods Sold</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.cogsAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getAccountAmount(account, false), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total COGS</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalCOGS, currency)}
          </Text>
        </View>

        {/* Gross Profit */}
        <View
          style={[
            styles.row,
            styles.rowTotal,
            { marginTop: 10, backgroundColor: '#f0f0f0', paddingVertical: 6 },
          ]}
        >
          <Text style={[styles.accountCell, styles.bold]}>Gross Profit</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.grossProfit, currency)}
          </Text>
        </View>

        {/* Expenses Section */}
        <View style={[styles.row, styles.rowHeader, { marginTop: 15 }]}>
          <Text style={[styles.accountCell, styles.bold]}>Operating Expenses</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.expenseAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getAccountAmount(account, false), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total Expenses</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalExpenses, currency)}
          </Text>
        </View>

        {/* Net Income */}
        <View
          style={[
            styles.row,
            styles.rowTotal,
            { marginTop: 15, borderTopWidth: 2, paddingVertical: 8 },
          ]}
        >
          <Text style={[styles.accountCell, styles.bold]}>Net Income</Text>
          <Text
            style={[
              styles.amountCell,
              styles.bold,
              { color: data.totals.netIncome >= 0 ? '#16a34a' : '#dc2626' },
            ]}
          >
            {formatAmount(data.totals.netIncome, currency)}
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated on{' '}
          {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}{' '}
          | Accrual Basis
        </Text>
      </Page>
    </Document>
  )
}

// Balance Sheet PDF Document
function BalanceSheetPDFDocument({
  data,
  companyName,
  currency,
  asOfDate,
}: {
  data: BalanceSheetData
  companyName: string
  currency: string
  asOfDate?: string
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // For balance sheet, assets are normally debit, liabilities/equity are normally credit
  const getAssetBalance = (account: GLAccountTotal): number => {
    return account.total_debits - account.total_credits
  }

  const getLiabilityEquityBalance = (account: GLAccountTotal): number => {
    return account.total_credits - account.total_debits
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{companyName || 'Company'}</Text>
          <Text style={styles.subtitle}>Balance Sheet</Text>
          {asOfDate && <Text style={styles.subtitle}>As of {formatDate(asOfDate)}</Text>}
        </View>

        {/* Assets Section */}
        <View style={[styles.row, styles.rowHeader]}>
          <Text style={[styles.accountCell, styles.bold]}>Assets</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.assetAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getAssetBalance(account), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total Assets</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalAssets, currency)}
          </Text>
        </View>

        {/* Liabilities Section */}
        <View style={[styles.row, styles.rowHeader, { marginTop: 20 }]}>
          <Text style={[styles.accountCell, styles.bold]}>Liabilities</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.liabilityAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getLiabilityEquityBalance(account), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total Liabilities</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalLiabilities, currency)}
          </Text>
        </View>

        {/* Equity Section */}
        <View style={[styles.row, styles.rowHeader, { marginTop: 20 }]}>
          <Text style={[styles.accountCell, styles.bold]}>Equity</Text>
          <Text style={styles.amountCell}></Text>
        </View>
        {data.equityAccounts.map((account: GLAccountTotal, i: number) => (
          <View key={i} style={[styles.row, styles.indent1]}>
            <Text style={styles.accountCell}>
              {account.g_laccount_no} - {account.g_laccount_name}
            </Text>
            <Text style={styles.amountCell}>
              {formatAmount(getLiabilityEquityBalance(account), currency)}
            </Text>
          </View>
        ))}
        <View style={[styles.row, styles.rowTotal]}>
          <Text style={[styles.accountCell, styles.bold]}>Total Equity</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalEquity, currency)}
          </Text>
        </View>

        {/* Total Liabilities + Equity */}
        <View
          style={[
            styles.row,
            styles.rowTotal,
            { marginTop: 15, borderTopWidth: 2, paddingVertical: 8 },
          ]}
        >
          <Text style={[styles.accountCell, styles.bold]}>Total Liabilities + Equity</Text>
          <Text style={[styles.amountCell, styles.bold]}>
            {formatAmount(data.totals.totalLiabilitiesAndEquity, currency)}
          </Text>
        </View>

        <Text style={styles.footer}>
          Generated on{' '}
          {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </Page>
    </Document>
  )
}

interface WarehouseExportButtonsProps {
  type: 'pnl' | 'balance-sheet'
  pnlData?: PnLStatementData | null
  balanceSheetData?: BalanceSheetData | null
  companyName: string
  currency: string
  dateRange?: { start: string; end: string }
  asOfDate?: string
}

export function WarehouseExportButtons({
  type,
  pnlData,
  balanceSheetData,
  companyName,
  currency,
  dateRange,
  asOfDate,
}: WarehouseExportButtonsProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      let blob: Blob

      if (type === 'pnl' && pnlData) {
        const doc = (
          <PnLPDFDocument
            data={pnlData}
            companyName={companyName}
            currency={currency}
            dateRange={dateRange}
          />
        )
        blob = await pdf(doc).toBlob()
      } else if (type === 'balance-sheet' && balanceSheetData) {
        const doc = (
          <BalanceSheetPDFDocument
            data={balanceSheetData}
            companyName={companyName}
            currency={currency}
            asOfDate={asOfDate}
          />
        )
        blob = await pdf(doc).toBlob()
      } else {
        console.error('No data available for export')
        return
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type === 'pnl' ? 'profit-loss' : 'balance-sheet'}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('PDF export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = () => {
    setIsExporting(true)
    try {
      let csvContent = ''

      if (type === 'pnl' && pnlData) {
        csvContent = 'Account Number,Account Name,Category,Amount\n'

        // Revenue accounts
        pnlData.revenueAccounts.forEach((account: GLAccountTotal) => {
          const amount = getAccountAmount(account, true)
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Revenue",${amount}\n`
        })

        // COGS accounts
        pnlData.cogsAccounts.forEach((account: GLAccountTotal) => {
          const amount = getAccountAmount(account, false)
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Cost of Goods Sold",${amount}\n`
        })

        // Expense accounts
        pnlData.expenseAccounts.forEach((account: GLAccountTotal) => {
          const amount = getAccountAmount(account, false)
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Operating Expenses",${amount}\n`
        })

        // Totals
        csvContent += `\n,,Total Revenue,${pnlData.totals.totalRevenue}\n`
        csvContent += `,,Total COGS,${pnlData.totals.totalCOGS}\n`
        csvContent += `,,Gross Profit,${pnlData.totals.grossProfit}\n`
        csvContent += `,,Total Expenses,${pnlData.totals.totalExpenses}\n`
        csvContent += `,,Net Income,${pnlData.totals.netIncome}\n`
      } else if (type === 'balance-sheet' && balanceSheetData) {
        csvContent = 'Account Number,Account Name,Category,Balance\n'

        // Asset accounts
        balanceSheetData.assetAccounts.forEach((account: GLAccountTotal) => {
          const balance = account.total_debits - account.total_credits
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Assets",${balance}\n`
        })

        // Liability accounts
        balanceSheetData.liabilityAccounts.forEach((account: GLAccountTotal) => {
          const balance = account.total_credits - account.total_debits
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Liabilities",${balance}\n`
        })

        // Equity accounts
        balanceSheetData.equityAccounts.forEach((account: GLAccountTotal) => {
          const balance = account.total_credits - account.total_debits
          csvContent += `"${account.g_laccount_no}","${account.g_laccount_name}","Equity",${balance}\n`
        })

        // Totals
        csvContent += `\n,,Total Assets,${balanceSheetData.totals.totalAssets}\n`
        csvContent += `,,Total Liabilities,${balanceSheetData.totals.totalLiabilities}\n`
        csvContent += `,,Total Equity,${balanceSheetData.totals.totalEquity}\n`
      }

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type === 'pnl' ? 'profit-loss' : 'balance-sheet'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Excel export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const hasData = type === 'pnl' ? !!pnlData : !!balanceSheetData

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleExportPDF}
        variant="outline"
        size="sm"
        disabled={isExporting || !hasData}
        className="group h-8 border-2 border-amber-500/70 dark:border-amber-400/70
                   text-amber-600 dark:text-amber-400
                   bg-transparent
                   hover:border-amber-500 hover:bg-amber-500 hover:text-white
                   dark:hover:border-amber-400 dark:hover:bg-amber-400 dark:hover:text-slate-900
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title={isExporting ? 'Generating PDF...' : 'Download as PDF'}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        <span className="text-xs ml-1">PDF</span>
      </Button>

      <Button
        onClick={handleExportExcel}
        variant="outline"
        size="sm"
        disabled={isExporting || !hasData}
        className="group h-8 border-2 border-emerald-500/70 dark:border-emerald-400/70
                   text-emerald-600 dark:text-emerald-400
                   bg-transparent
                   hover:border-emerald-500 hover:bg-emerald-500 hover:text-white
                   dark:hover:border-emerald-400 dark:hover:bg-emerald-400 dark:hover:text-slate-900
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title="Download as CSV"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="text-xs ml-1">CSV</span>
      </Button>
    </div>
  )
}
