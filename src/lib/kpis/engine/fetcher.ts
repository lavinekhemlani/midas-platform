import { FinancialData, KPIId, DataFetchError } from '../types'
import { getKPIDefinition, getAllKPIIds } from './registry'
import {
  getProviderCompanyMetadata,
  updateProviderCompanyMetadata,
  ProviderID,
} from '@/lib/providers/database'

/**
 * Smart data fetcher that optimizes API calls based on requested KPIs
 * See: docs/api-v2/implementation/phase-2-fetcher.md
 */
export class KPIDataFetcher {
  private provider: any
  private apiClient: any
  private organizationId: string
  private providerId: ProviderID

  constructor(
    provider: any,
    apiClient: any,
    organizationId: string,
    providerId: ProviderID = 'quickbooks'
  ) {
    this.provider = provider
    this.apiClient = apiClient
    this.organizationId = organizationId
    this.providerId = providerId
  }

  /**
   * Fetch all data needed for specified KPIs
   * Optimizes by only fetching required reports
   */
  async fetchForKPIs(kpiIds: KPIId[]): Promise<FinancialData> {
    const requiredDataSources = this.determineRequiredDataSources(kpiIds)
    const fetchPromises: Promise<any>[] = []
    const results: Partial<FinancialData> = {
      profile: await this.fetchOrganizationProfile(),
    }

    // Determine date ranges
    const dateRanges = this.calculateDateRanges()

    // Fetch required data in parallel (with rate limit handling for some providers)
    if (requiredDataSources.has('pnl')) {
      fetchPromises.push(
        this.fetchPnLReport(dateRanges.current).then((data) => {
          results.pnl = data
        })
      )
    }

    if (requiredDataSources.has('balanceSheet')) {
      fetchPromises.push(
        this.fetchBalanceSheet(dateRanges.current.end).then((data) => {
          results.balanceSheet = data
        })
      )
    }

    if (requiredDataSources.has('cashflow')) {
      fetchPromises.push(
        this.fetchCashFlowStatement(dateRanges.current).then((data) => {
          results.cashFlow = data
        })
      )
    }

    if (requiredDataSources.has('invoices')) {
      fetchPromises.push(
        this.fetchInvoices(dateRanges.current).then((data) => {
          results.invoices = data
        })
      )
    }

    if (requiredDataSources.has('bills')) {
      fetchPromises.push(
        this.fetchBills(dateRanges.current).then((data) => {
          results.bills = data
        })
      )
    }

    if (requiredDataSources.has('deposits')) {
      fetchPromises.push(
        this.fetchDeposits(dateRanges.current).then((data) => {
          results.deposits = data
        })
      )
    }

    if (requiredDataSources.has('salesReceipts')) {
      fetchPromises.push(
        this.fetchSalesReceipts(dateRanges.current).then((data) => {
          results.salesReceipts = data
        })
      )
    }

    if (requiredDataSources.has('bankAccounts')) {
      fetchPromises.push(
        this.fetchBankAccounts().then((data) => {
          results.bankAccounts = data
        })
      )
    }

    if (requiredDataSources.has('agedReceivables')) {
      fetchPromises.push(
        this.fetchAgedReceivables(dateRanges.current.end).then((data) => {
          results.agedReceivables = data
        })
      )
    }

    if (requiredDataSources.has('agedPayables')) {
      fetchPromises.push(
        this.fetchAgedPayables(dateRanges.current.end).then((data) => {
          results.agedPayables = data
        })
      )
    }

    // Execute all fetches with error handling
    await Promise.allSettled(fetchPromises)

    // Set period information
    results.period = {
      start: dateRanges.current.start,
      end: dateRanges.current.end,
      months: this.calculateMonthsBetween(dateRanges.current.start, dateRanges.current.end),
    }

    return results as FinancialData
  }

  /**
   * Fetch minimal data for dashboard KPIs
   */
  async fetchDashboardData(): Promise<FinancialData> {
    const dateRanges = this.calculateDateRanges()
    const [profile, pnl, balanceSheet, bankAccounts] = await Promise.allSettled([
      this.fetchOrganizationProfile(),
      this.fetchPnLReport(dateRanges.current),
      this.fetchBalanceSheet(dateRanges.current.end),
      this.fetchBankAccounts(),
    ])

    return {
      profile: this.extractSettledValue(profile),
      pnl: this.extractSettledValue(pnl),
      balanceSheet: this.extractSettledValue(balanceSheet),
      bankAccounts: this.extractSettledValue(bankAccounts),
      period: {
        start: dateRanges.current.start,
        end: dateRanges.current.end,
        months: this.calculateMonthsBetween(dateRanges.current.start, dateRanges.current.end),
      },
    }
  }

  /**
   * Fetch all available financial data
   */
  async fetchAllData(): Promise<FinancialData> {
    return this.fetchForKPIs(getAllKPIIds())
  }

  /**
   * Determine which data sources are needed for the requested KPIs
   */
  private determineRequiredDataSources(kpiIds: KPIId[]): Set<string> {
    const sources = new Set<string>()

    for (const kpiId of kpiIds) {
      const definition = getKPIDefinition(kpiId)
      definition.dataSources.forEach((source) => sources.add(source))
    }

    return sources
  }

  /**
   * Calculate appropriate date ranges for reports
   */
  private calculateDateRanges(): {
    current: { start: Date; end: Date }
    previous: { start: Date; end: Date }
    quarterly: { start: Date; end: Date }
  } {
    const now = new Date()

    // Use last complete month for most accurate data
    const lastCompleteMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastCompleteMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Previous month for comparison
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)

    // Quarterly (3 months)
    const quarterlyStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    return {
      current: {
        start: lastCompleteMonthStart,
        end: lastCompleteMonthEnd,
      },
      previous: {
        start: previousMonthStart,
        end: previousMonthEnd,
      },
      quarterly: {
        start: quarterlyStart,
        end: lastCompleteMonthEnd,
      },
    }
  }

  /**
   * Format date for API calls (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Fetch organization profile
   */
  private async fetchOrganizationProfile(): Promise<any> {
    try {
      // Check for stored metadata first to avoid unnecessary API calls
      const storedMetadata = await getProviderCompanyMetadata(this.organizationId, this.providerId)

      if (storedMetadata.homeCurrency) {
        // Use stored metadata for currency, still need to fetch for other fields
        // but we can return early with basic profile if that's all we need
        return {
          accountingBasis: 'accrual',
          currency: storedMetadata.homeCurrency,
          fiscalYearStart: 1,
          industry: 'general',
          companyName: storedMetadata.companyName || 'Organization',
        }
      }

      // Fallback: fetch from provider API
      const orgInfo = await this.provider.organizations.getOrganizationInfo(
        this.organizationId,
        this.apiClient
      )

      // Store metadata for future requests
      updateProviderCompanyMetadata(this.organizationId, this.providerId, {
        homeCurrency: orgInfo.currency_code || orgInfo.currency || undefined,
        companyName: orgInfo.name || undefined,
      }).catch((err) => console.warn('[KPIDataFetcher] Failed to store metadata:', err))

      return {
        accountingBasis: orgInfo.accounting_basis || 'accrual',
        currency: orgInfo.currency_code || orgInfo.currency || 'USD',
        fiscalYearStart: orgInfo.fiscal_year_start_month || 1,
        industry: orgInfo.industry || 'general',
        quickbooksVersion: this.detectQuickBooksVersion(orgInfo),
        companyName: orgInfo.name || 'Organization',
      }
    } catch (error) {
      console.error('Failed to fetch organization profile:', error)
      return {
        accountingBasis: 'accrual',
        currency: 'USD',
        fiscalYearStart: 1,
        industry: 'general',
      }
    }
  }

  /**
   * Fetch P&L Report
   */
  private async fetchPnLReport(dateRange: { start: Date; end: Date }): Promise<any> {
    try {
      const report = await this.provider.reports.profitAndLoss(
        this.organizationId,
        {
          from_date: this.formatDate(dateRange.start),
          to_date: this.formatDate(dateRange.end),
          summarize_column_by: 'Total',
          accounting_method: 'Accrual',
        },
        this.apiClient
      )

      return this.parsePnLReport(report)
    } catch (error) {
      console.error('Failed to fetch P&L report:', error)
      throw new DataFetchError('pnl', 'Failed to fetch P&L report', error as Error)
    }
  }

  /**
   * Fetch Balance Sheet
   */
  private async fetchBalanceSheet(asOfDate: Date): Promise<any> {
    try {
      const report = await this.provider.reports.balanceSheet(
        this.organizationId,
        {
          as_of_date: this.formatDate(asOfDate),
          summarize_column_by: 'Total',
          accounting_method: 'Accrual',
        },
        this.apiClient
      )

      return this.parseBalanceSheet(report)
    } catch (error) {
      console.error('Failed to fetch balance sheet:', error)
      throw new DataFetchError('balanceSheet', 'Failed to fetch balance sheet', error as Error)
    }
  }

  /**
   * Fetch Cash Flow Statement
   */
  private async fetchCashFlowStatement(dateRange: { start: Date; end: Date }): Promise<any> {
    try {
      const report = await this.provider.reports.cashFlow(
        this.organizationId,
        {
          from_date: this.formatDate(dateRange.start),
          to_date: this.formatDate(dateRange.end),
        },
        this.apiClient
      )

      return this.parseCashFlowStatement(report)
    } catch (error) {
      console.error('Failed to fetch cash flow statement:', error)
      // Cash flow might not be available for all accounts
      return null
    }
  }

  /**
   * Fetch Invoices
   */
  private async fetchInvoices(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // QuickBooks provider uses listInvoices method
      const invoices = await this.provider.invoices.listInvoices(
        this.organizationId,
        {
          date_start: this.formatDate(dateRange.start),
          date_end: this.formatDate(dateRange.end),
          limit: 100,
        },
        this.apiClient
      )

      return invoices.map((inv: any) => ({
        id: inv.id,
        total: inv.total || 0,
        date: inv.date || inv.created_time,
        status: inv.status,
        customer_name: inv.customer_name,
        due_date: inv.due_date,
      }))
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
      return []
    }
  }

  /**
   * Fetch Bills
   */
  private async fetchBills(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // QuickBooks provider uses listBills method
      const bills = await this.provider.bills.listBills(
        this.organizationId,
        {
          date_start: this.formatDate(dateRange.start),
          date_end: this.formatDate(dateRange.end),
          limit: 100,
        },
        this.apiClient
      )

      return bills.map((bill: any) => ({
        id: bill.id,
        total: bill.total || 0,
        date: bill.date || bill.created_time,
        status: bill.status,
        vendor_name: bill.vendor_name,
        due_date: bill.due_date,
      }))
    } catch (error) {
      console.error('Failed to fetch bills:', error)
      return []
    }
  }

  /**
   * Fetch Deposits
   */
  private async fetchDeposits(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // QuickBooks provider uses listDeposits method
      const deposits = await this.provider.deposits.listDeposits(
        this.organizationId,
        {
          date_start: this.formatDate(dateRange.start),
          date_end: this.formatDate(dateRange.end),
          limit: 100,
        },
        this.apiClient
      )

      return deposits.map((dep: any) => ({
        id: dep.id,
        total: dep.total || 0,
        date: dep.date || dep.created_time,
        lines: dep.lines || [],
      }))
    } catch (error) {
      console.error('Failed to fetch deposits:', error)
      return []
    }
  }

  /**
   * Fetch Sales Receipts
   */
  private async fetchSalesReceipts(dateRange: { start: Date; end: Date }): Promise<any[]> {
    try {
      // QuickBooks provider uses listSalesReceipts method
      const receipts = await this.provider.salesReceipts.listSalesReceipts(
        this.organizationId,
        {
          date_start: this.formatDate(dateRange.start),
          date_end: this.formatDate(dateRange.end),
          limit: 100,
        },
        this.apiClient
      )

      return receipts.map((receipt: any) => ({
        id: receipt.id,
        total: receipt.total_amount || 0,
        date: receipt.transaction_date || receipt.created_date,
      }))
    } catch (error) {
      console.error('Failed to fetch sales receipts:', error)
      return []
    }
  }

  /**
   * Fetch Bank Accounts
   */
  private async fetchBankAccounts(): Promise<any[]> {
    try {
      // QuickBooks uses banking.listBankAccounts
      const accounts =
        (await this.provider.banking?.listBankAccounts?.(
          this.organizationId,
          {},
          this.apiClient
        )) || []

      return accounts.map((account: any) => ({
        id: account.account_id || account.id,
        name: account.account_name || account.name,
        type: account.account_type || 'Bank',
        balance: account.balance || account.bank_balance || 0,
      }))
    } catch (error) {
      console.error('Failed to fetch bank accounts:', error)
      return []
    }
  }

  /**
   * Fetch Aged Receivables Report
   */
  private async fetchAgedReceivables(asOfDate: Date): Promise<any[]> {
    try {
      const report = await this.provider.reports.agedReceivables?.(
        this.organizationId,
        {
          as_of_date: this.formatDate(asOfDate),
          summarize_column_by: 'Total',
        },
        this.apiClient
      )

      return this.parseAgedReceivables(report)
    } catch (error) {
      console.error('Failed to fetch aged receivables:', error)
      return []
    }
  }

  /**
   * Fetch Aged Payables Report
   */
  private async fetchAgedPayables(asOfDate: Date): Promise<any[]> {
    try {
      const report = await this.provider.reports.agedPayables?.(
        this.organizationId,
        {
          as_of_date: this.formatDate(asOfDate),
          summarize_column_by: 'Total',
        },
        this.apiClient
      )

      return this.parseAgedPayables(report)
    } catch (error) {
      console.error('Failed to fetch aged payables:', error)
      return []
    }
  }

  /**
   * Parse P&L report to standard format
   */
  private parsePnLReport(report: any): any {
    // Check if data is already parsed (from QuickBooks provider)
    if (report?.total_income !== undefined || report?.total_expenses !== undefined) {
      console.log('[V2 KPI Fetcher] P&L data is already parsed, using directly')
      return {
        total_income: report.total_income || 0,
        cost_of_goods_sold: report.cost_of_goods_sold || 0,
        gross_profit: report.gross_profit || 0,
        total_expenses: report.total_expenses || 0,
        operating_expenses: report.operating_expenses || report.total_expenses || 0,
        net_income: report.net_income || 0,
        depreciation: report.depreciation || 0,
        amortization: report.amortization || 0,
        interest_expense: report.interest_expense || 0,
        tax_expense: report.tax_expense || 0,
      }
    }

    // Handle raw QuickBooks report structure
    if (report?.Rows?.Row) {
      console.log('[V2 KPI Fetcher] Parsing raw QuickBooks P&L report structure')
      let totalIncome = 0
      let totalExpenses = 0
      let grossProfit = 0
      let netIncome = 0
      let costOfGoodsSold = 0

      // Parse QuickBooks report sections
      const rows = Array.isArray(report.Rows.Row) ? report.Rows.Row : [report.Rows.Row]

      rows.forEach((row: any) => {
        if (row.group === 'Income' && row.Summary?.ColData?.length > 1) {
          totalIncome = parseFloat(row.Summary.ColData[1]?.value || '0')
        } else if (row.group === 'Expenses' && row.Summary?.ColData?.length > 1) {
          totalExpenses = parseFloat(row.Summary.ColData[1]?.value || '0')
        } else if (
          (row.group === 'CostOfGoodsSold' || row.group === 'COGS') &&
          row.Summary?.ColData?.length > 1
        ) {
          costOfGoodsSold = parseFloat(row.Summary.ColData[1]?.value || '0')
        } else if (row.group === 'GrossProfit' && row.Summary?.ColData?.length > 1) {
          grossProfit = parseFloat(row.Summary.ColData[1]?.value || '0')
        } else if (row.group === 'NetIncome' && row.Summary?.ColData?.length > 1) {
          netIncome = parseFloat(row.Summary.ColData[1]?.value || '0')
        }
      })

      return {
        total_income: totalIncome,
        cost_of_goods_sold: costOfGoodsSold,
        gross_profit: grossProfit || totalIncome - costOfGoodsSold,
        total_expenses: totalExpenses,
        operating_expenses: totalExpenses, // QuickBooks doesn't separate operating expenses
        net_income: netIncome,
        depreciation: 0, // Would need to extract from expense details
        amortization: 0, // Would need to extract from expense details
        interest_expense: 0, // Would need to extract from expense details
        tax_expense: 0, // Would need to extract from expense details
      }
    }

    // Fallback to simple structure for other providers
    console.log('[V2 KPI Fetcher] Using fallback P&L parsing')
    const data = report?.data || report
    return {
      total_income: this.extractReportValue(data, ['Total Income', 'Total Revenue', 'Income']),
      cost_of_goods_sold: this.extractReportValue(data, [
        'Cost of Goods Sold',
        'COGS',
        'Cost of Sales',
      ]),
      gross_profit: this.extractReportValue(data, ['Gross Profit']),
      total_expenses: this.extractReportValue(data, ['Total Expenses', 'Total Operating Expenses']),
      operating_expenses: this.extractReportValue(data, ['Operating Expenses']),
      net_income: this.extractReportValue(data, ['Net Income', 'Net Profit', 'Net Earnings']),
      depreciation: this.extractReportValue(data, ['Depreciation', 'Depreciation Expense']),
      amortization: this.extractReportValue(data, ['Amortization', 'Amortization Expense']),
      interest_expense: this.extractReportValue(data, ['Interest Expense', 'Interest']),
      tax_expense: this.extractReportValue(data, ['Income Tax Expense', 'Tax Expense', 'Taxes']),
    }
  }

  /**
   * Parse Balance Sheet to standard format
   */
  private parseBalanceSheet(report: any): any {
    // Check if data is already parsed (from QuickBooks provider)
    if (report?.total_assets !== undefined || report?.total_liabilities !== undefined) {
      console.log('[V2 KPI Fetcher] Balance Sheet data is already parsed, using directly')
      return {
        total_assets: report.total_assets || 0,
        total_liabilities: report.total_liabilities || 0,
        total_equity: report.total_equity || 0,
        current_assets: report.current_assets || 0,
        current_liabilities: report.current_liabilities || 0,
        cash_and_equivalents: report.cash_and_equivalents || 0,
        accounts_receivable: report.accounts_receivable || 0,
        accounts_payable: report.accounts_payable || 0,
        inventory: report.inventory || 0,
        short_term_debt: report.short_term_debt || 0,
        long_term_debt: report.long_term_debt || 0,
        fixed_assets: report.fixed_assets || 0,
      }
    }

    // Handle raw QuickBooks report structure
    if (report?.Rows?.Row && Array.isArray(report.Rows.Row)) {
      console.log('[V2 KPI Fetcher] Parsing raw QuickBooks Balance Sheet structure')
      let totalAssets = 0
      let totalLiabilities = 0
      let totalEquity = 0
      let currentAssets = 0
      let currentLiabilities = 0
      let cashAndEquivalents = 0

      // QuickBooks Balance Sheet has 3 main sections: Assets, Liabilities, Equity
      report.Rows.Row.forEach((section: any, index: number) => {
        // First section is usually Assets
        if (index === 0 && section?.Summary?.ColData?.length > 1) {
          totalAssets = parseFloat(section.Summary.ColData[1]?.value || '0')

          // Look for Current Assets subsection
          if (section?.Rows?.Row?.[0]?.Summary?.ColData?.length > 1) {
            currentAssets = parseFloat(section.Rows.Row[0].Summary.ColData[1]?.value || '0')
          }

          // Look for Bank Accounts in Current Assets
          if (section?.Rows?.Row?.[0]?.Rows?.Row) {
            section.Rows.Row[0].Rows.Row.forEach((subsection: any) => {
              if (subsection.group === 'BankAccounts' && subsection.Summary?.ColData?.length > 1) {
                cashAndEquivalents = parseFloat(subsection.Summary.ColData[1]?.value || '0')
              }
            })
          }
        }
        // Second section is usually Liabilities and Equity
        else if (index === 1) {
          // This section contains both liabilities and equity
          if (section?.Rows?.Row) {
            section.Rows.Row.forEach((subsection: any) => {
              if (subsection.group === 'Liabilities' && subsection.Summary?.ColData?.length > 1) {
                totalLiabilities = parseFloat(subsection.Summary.ColData[1]?.value || '0')

                // Look for Current Liabilities
                if (subsection?.Rows?.Row?.[0]?.Summary?.ColData?.length > 1) {
                  currentLiabilities = parseFloat(
                    subsection.Rows.Row[0].Summary.ColData[1]?.value || '0'
                  )
                }
              } else if (subsection.group === 'Equity' && subsection.Summary?.ColData?.length > 1) {
                totalEquity = parseFloat(subsection.Summary.ColData[1]?.value || '0')
              }
            })
          }

          // Total Liabilities and Equity is in Summary
          if (section?.Summary?.ColData?.length > 1) {
            const totalLiabilitiesAndEquity = parseFloat(section.Summary.ColData[1]?.value || '0')
            // If we didn't get equity separately, calculate it
            if (totalEquity === 0 && totalLiabilities > 0) {
              totalEquity = totalLiabilitiesAndEquity - totalLiabilities
            }
          }
        }
      })

      return {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        current_assets: currentAssets,
        current_liabilities: currentLiabilities,
        cash_and_equivalents: cashAndEquivalents,
        accounts_receivable: 0, // Would need to extract from Current Assets details
        accounts_payable: 0, // Would need to extract from Current Liabilities details
        inventory: 0, // Would need to extract from Current Assets details
        short_term_debt: 0, // Would need to extract from Current Liabilities details
        long_term_debt: 0, // Would need to extract from Non-Current Liabilities details
        fixed_assets: 0, // Would need to calculate as total_assets - current_assets
      }
    }

    // Fallback to simple structure for other providers
    const data = report?.data || report
    return {
      total_assets: this.extractReportValue(data, ['Total Assets']),
      total_liabilities: this.extractReportValue(data, ['Total Liabilities']),
      total_equity: this.extractReportValue(data, ['Total Equity', "Total Shareholders' Equity"]),
      current_assets: this.extractReportValue(data, ['Total Current Assets', 'Current Assets']),
      current_liabilities: this.extractReportValue(data, [
        'Total Current Liabilities',
        'Current Liabilities',
      ]),
      cash_and_equivalents: this.extractReportValue(data, [
        'Cash and Cash Equivalents',
        'Cash',
        'Bank',
      ]),
      accounts_receivable: this.extractReportValue(data, ['Accounts Receivable', 'A/R']),
      accounts_payable: this.extractReportValue(data, ['Accounts Payable', 'A/P']),
      inventory: this.extractReportValue(data, ['Inventory']),
      short_term_debt: this.extractReportValue(data, [
        'Short-term Debt',
        'Current Portion of Long-term Debt',
      ]),
      long_term_debt: this.extractReportValue(data, ['Long-term Debt', 'Long Term Liabilities']),
      fixed_assets: this.extractReportValue(data, [
        'Fixed Assets',
        'Property Plant and Equipment',
        'PP&E',
      ]),
    }
  }

  /**
   * Parse Cash Flow Statement to standard format
   */
  private parseCashFlowStatement(report: any): any {
    // Check if data is already parsed (from QuickBooks provider)
    if (
      report?.net_cash_from_operating_activities !== undefined ||
      report?.net_change_in_cash !== undefined
    ) {
      console.log('[V2 KPI Fetcher] Cash Flow data is already parsed, using directly')
      return {
        net_cash_from_operating_activities: report.net_cash_from_operating_activities || 0,
        net_cash_from_investing_activities: report.net_cash_from_investing_activities || 0,
        net_cash_from_financing_activities: report.net_cash_from_financing_activities || 0,
        cash_at_beginning: report.cash_at_beginning || 0,
        cash_at_end: report.cash_at_end || 0,
        capital_expenditures: report.capital_expenditures || 0,
      }
    }

    // Fallback to simple structure for other providers
    const data = report?.data || report

    return {
      net_cash_from_operating_activities: this.extractReportValue(data, [
        'Net Cash from Operating Activities',
        'Operating Activities',
        'Cash from Operations',
      ]),
      net_cash_from_investing_activities: this.extractReportValue(data, [
        'Net Cash from Investing Activities',
        'Investing Activities',
      ]),
      net_cash_from_financing_activities: this.extractReportValue(data, [
        'Net Cash from Financing Activities',
        'Financing Activities',
      ]),
      cash_at_beginning: this.extractReportValue(data, [
        'Beginning Cash',
        'Cash at Beginning of Period',
      ]),
      cash_at_end: this.extractReportValue(data, ['Ending Cash', 'Cash at End of Period']),
      capital_expenditures: this.extractReportValue(data, [
        'Capital Expenditures',
        'CapEx',
        'Purchase of Property and Equipment',
      ]),
    }
  }

  /**
   * Parse Aged Receivables report to standard format
   */
  private parseAgedReceivables(report: any): any[] {
    // Check if data is already parsed (from QuickBooks provider)
    if (Array.isArray(report)) {
      return report
    }

    // Parse from QuickBooks report structure
    const rows = report?.Rows?.Row || []
    const result: any[] = []

    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        const customerName = row.ColData[0]?.value || ''
        const current = parseFloat(row.ColData[1]?.value || '0')
        const days1_30 = parseFloat(row.ColData[2]?.value || '0')
        const days31_60 = parseFloat(row.ColData[3]?.value || '0')
        const days61_90 = parseFloat(row.ColData[4]?.value || '0')
        const daysOver90 = parseFloat(row.ColData[5]?.value || '0')
        const total = parseFloat(row.ColData[6]?.value || '0')

        if (total !== 0) {
          result.push({
            customer_name: customerName,
            current,
            days_1_30: days1_30,
            days_31_60: days31_60,
            days_61_90: days61_90,
            days_over_90: daysOver90,
            total,
          })
        }
      }
    }

    return result
  }

  /**
   * Parse Aged Payables report to standard format
   */
  private parseAgedPayables(report: any): any[] {
    // Check if data is already parsed (from QuickBooks provider)
    if (Array.isArray(report)) {
      return report
    }

    // Parse from QuickBooks report structure
    const rows = report?.Rows?.Row || []
    const result: any[] = []

    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        const vendorName = row.ColData[0]?.value || ''
        const current = parseFloat(row.ColData[1]?.value || '0')
        const days1_30 = parseFloat(row.ColData[2]?.value || '0')
        const days31_60 = parseFloat(row.ColData[3]?.value || '0')
        const days61_90 = parseFloat(row.ColData[4]?.value || '0')
        const daysOver90 = parseFloat(row.ColData[5]?.value || '0')
        const total = parseFloat(row.ColData[6]?.value || '0')

        if (total !== 0) {
          result.push({
            vendor_name: vendorName,
            current,
            days_1_30: days1_30,
            days_31_60: days31_60,
            days_61_90: days61_90,
            days_over_90: daysOver90,
            total,
          })
        }
      }
    }

    return result
  }

  /**
   * Extract value from report data by searching for field names
   */
  private extractReportValue(data: any, fieldNames: string[]): number {
    // This is a simplified implementation
    // Actual implementation would need to traverse the report structure
    for (const fieldName of fieldNames) {
      if (data?.[fieldName] !== undefined) {
        return parseFloat(data[fieldName]) || 0
      }
    }
    return 0
  }

  /**
   * Detect QuickBooks version from org info
   */
  private detectQuickBooksVersion(orgInfo: any): 'desktop' | 'online' | undefined {
    // Logic to detect QB version based on org info
    if (orgInfo?.product_name?.toLowerCase().includes('desktop')) {
      return 'desktop'
    }
    if (orgInfo?.product_name?.toLowerCase().includes('online')) {
      return 'online'
    }
    return undefined
  }

  /**
   * Calculate months between two dates
   */
  private calculateMonthsBetween(start: Date, end: Date): number {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
    return Math.max(1, months)
  }

  /**
   * Extract value from settled promise
   */
  private extractSettledValue(result: PromiseSettledResult<any>): any {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return null
  }
}

/**
 * Create fetcher instance
 */
export function createKPIDataFetcher(
  provider: any,
  apiClient: any,
  organizationId: string,
  providerId: ProviderID = 'quickbooks'
): KPIDataFetcher {
  return new KPIDataFetcher(provider, apiClient, organizationId, providerId)
}
