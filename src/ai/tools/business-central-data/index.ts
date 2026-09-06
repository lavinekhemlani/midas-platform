// src/ai/tools/business-central-data/index.ts
// Main LangChain tool export for Business Central data access
// Supports dual data sources: direct BC API (OAuth) and Redshift warehouse (Fivetran)

import { tool } from '@langchain/core/tools'
import { businessCentralDataSchema } from './schema'
import { executeBCQuery } from './handlers'
import { executeBCApiQuery } from './bc-api-handlers'
import type { BCDataInput, BCToolContext } from './types'
import type { z } from 'zod'
import { logger } from '@/lib/logger'
import { withExtraLongTimeout } from '../utils'
import { classifyError, type ErrorType } from '@/lib/errors/classifier'

/**
 * Business Central Data Tool
 *
 * Dual-source: queries BC data via direct API (OAuth, real-time) or Redshift (Fivetran, delayed).
 * Read-only, covers all reporting/analytics use cases.
 */
async function performBCQuery(input: BCDataInput, config: any): Promise<string> {
  const startTime = Date.now()
  const correlationId = config?.configurable?.correlationId || 'unknown'

  logger.info('[Tool:BC] Tool invocation started', {
    correlationId,
    queryType: input.queryType,
    reportType: input.reportType,
    entityType: input.entityType,
    metricName: input.metricName,
    period: input.period,
  })

  try {
    const configurable = config?.configurable

    // Validate organization ID
    if (!configurable?.organizationId) {
      return JSON.stringify({
        success: false,
        error: 'Organization ID is required',
        code: 'CONFIG' as ErrorType,
        retryable: false,
        queryType: input.queryType,
      })
    }

    // ─── Dual-source routing ────────────────────────────────────────────
    // Check for OAuth direct API connection first, then fall back to Redshift
    const bcOAuthConnection = configurable?.bcOAuthConnection
    const bcSchemas: string[] = configurable?.bcSchemas || []
    const defaultSchema: string = configurable?.bcDefaultSchema || bcSchemas[0] || ''

    if (bcOAuthConnection) {
      // OAuth path: query BC API directly (real-time data)
      logger.info('[Tool:BC] Using direct BC API path (OAuth)', {
        correlationId,
        connectionId: bcOAuthConnection.connectionId,
        environment: bcOAuthConnection.environmentName,
      })

      const result = await executeBCApiQuery(input, {
        organizationId: configurable.organizationId,
        connectionId: bcOAuthConnection.connectionId,
        tenantId: bcOAuthConnection.tenantId,
        environmentName: bcOAuthConnection.environmentName,
        companyId: bcOAuthConnection.companyId,
        currency: configurable.currency,
        companyName: configurable.companyName,
        correlationId,
      })

      const duration = Date.now() - startTime
      logger.info('[Tool:BC] Direct API query completed', {
        correlationId,
        duration,
        success: result.success,
        queryType: input.queryType,
      })

      const enrichedResult = {
        ...result,
        companyName: configurable?.bcCompanyName || configurable?.companyName,
        dataSource: 'bc_api_direct',
      }

      return JSON.stringify(enrichedResult, null, 2)
    }

    if (defaultSchema) {
      // Redshift path: query via Fivetran-synced warehouse (existing behavior)
      logger.info('[Tool:BC] Using Redshift path (Fivetran)', {
        correlationId,
        schema: defaultSchema,
      })

      const context: BCToolContext = {
        organizationId: configurable.organizationId,
        userId: configurable.userId,
        bcSchemas,
        defaultSchema,
        currency: configurable.currency,
        companyName: configurable.companyName,
        correlationId,
      }

      const result = await executeBCQuery(input, context)

      const duration = Date.now() - startTime
      logger.info('[Tool:BC] Redshift query completed', {
        correlationId,
        duration,
        success: result.success,
        queryType: input.queryType,
        rowCount: result.metadata?.rowCount,
      })

      const enrichedResult = {
        ...result,
        schemaName: defaultSchema,
        companyName: configurable?.bcCompanyName || context.companyName,
        dataSource: 'redshift_fivetran',
      }

      return JSON.stringify(enrichedResult, null, 2)
    }

    // Neither OAuth nor Redshift connected
    const duration = Date.now() - startTime
    logger.error('[Tool:BC] No BC connection available', {
      correlationId,
      queryType: input.queryType,
      duration,
    })
    return JSON.stringify({
      success: false,
      error: 'No Business Central connection available. Please connect Business Central first.',
      code: 'CONFIG' as ErrorType,
      retryable: false,
      queryType: input.queryType,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorClassification = classifyError(error)
    logger.error('[Tool:BC] Tool invocation failed', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      errorType: errorClassification.type,
      retryable: errorClassification.retryable,
      queryType: input.queryType,
      duration,
    })
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: errorClassification.type,
      retryable: errorClassification.retryable,
      hint: errorClassification.userMessage,
      queryType: input.queryType,
    })
  }
}

// Wrap with 60s timeout for protection against slow Redshift queries
const performBCQueryWithTimeout = withExtraLongTimeout(performBCQuery, 'business_central_data')

export const businessCentralData = tool(performBCQueryWithTimeout, {
  name: 'business_central_data',
  description: `Query Business Central financial data. Supports two data sources:
- **Direct API** (OAuth-connected clients): real-time data from BC API, no sync delay
- **Redshift warehouse** (Fivetran-connected clients): data may be 15min–1hr delayed

This tool is read-only.
Use this tool when the user asks about BC, Business Central, or Dynamics data.
**CURRENCY**: The result includes a "currency" field (e.g. "NGN", "CAD") — always use this for formatting amounts, NOT the default system currency.

**QUERY TYPES:**

1. **report** - Pre-built financial reports with computed KPIs in the summary field
   - trial_balance: Chart of accounts with debit/credit balances. With summarizeBy: per-account breakdown by period.
   - profit_loss: Revenue, COGS, expenses (KPIs: grossMargin, netMargin, operatingMargin, ebitdaMargin, burnRate, revenuePerMonth, expenseRatio). With summarizeBy: per-account breakdown by period with periodTotals for trends.
   - balance_sheet: Assets, liabilities, equity (KPIs: currentRatio, quickRatio, workingCapital, debtToEquity, debtRatio, equityMultiplier). With summarizeBy: activity breakdown by period.
   - cash_flow: Cash movements by period (KPIs: netCashFlow, burnRate, averageNetCash). With summarizeBy: groups by month/quarter/year.
   - aged_receivables: Customer aging (KPIs: overduePercentage, averageBalance, currentAmount)
   - aged_payables: Vendor aging (KPIs: overduePercentage, averageBalance, currentAmount)
   - sales_by_customer: Revenue by customer from sales invoices. With summarizeBy: customer trends over time.
   - sales_by_item: Revenue by item/SKU from sales invoice lines. With summarizeBy: product trends over time.
   - purchases_by_vendor: Spending by vendor from purchase invoices. With summarizeBy: vendor trends over time.
   - purchases_by_item: Spending by item/SKU from purchase invoice lines. With summarizeBy: item trends over time.
   - inventory_valuation: Opening balance, closing balance, increases, and decreases per item from item ledger entries. Use for ANY inventory balance, valuation, or stock movement question.
   - monthly_pnl_trend: P&L breakdown by period (revenue, COGS, expenses, net income). With summarizeBy: groups by month/quarter/year.
   - enhanced_financial_summary: comprehensive dashboard — top customers/vendors, aged AR/AP, financial ratios, cash balance, inventory summary
   - sales_by_geography: sales by country/city from invoice ship-to/sell-to addresses
   - monthly_cash_trend: month-by-month cash position with inflows, outflows, and running balance
   - cash_flow_by_activity: monthly GL activity bucketed by operating/investing/financing
   - inventory_enhanced: comprehensive inventory — ABC classification, health scores, slow-moving items, turnover, per-location stats, category breakdown, AND monthly movement trend (purchases/sales/adjustments by month). **USE THIS for any inventory movement, stock movement, or purchase/sale trend questions — NOT item_ledger_entry or sales_by_item.**

2. **entity** - Query specific entities with filters and pagination
   - customer, vendor, item, account
   - sales_invoice, purchase_invoice, general_ledger_entry, bank_account
   - purchase_order, purchase_credit_memo, purchase_receipt
   - vendor_payment_journal, journal_line, dimension
   - item_ledger_entry (with location/lot codes), sales_credit_memo, sales_shipment
   - Filters: customerName, vendorName, minAmount, maxAmount, department, accountCategory, itemCategory
   - Results sorted by relevance/amount, limited to top entries

3. **metric** - Calculate financial KPIs. Accepts any standard metric name (e.g. gross_margin, dso, current_ratio, burn_rate, roa, working_capital, cash_conversion_cycle).
   - Covers: profitability, liquidity, efficiency, cash flow, leverage, and growth metrics
   - Returns the requested metric along with related metrics from the same category

4. **search** - Search across entities by name
   - searchScope: all, customers, vendors, items, accounts

5. **analyze** - Deep dive analysis (delegates to relevant reports)
   - focusArea: revenue, expenses, cash_flow, profitability, inventory

6. **compare** - Period-over-period comparison with full variance analysis
   - Provide currentStartDate/currentEndDate and comparisonStartDate/comparisonEndDate
   - Returns current/comparison/variance structure with absolute and percentage changes

7. **detail** - Deep drilldown into a specific entity with full transactional context
   - customer_detail: full customer profile (invoices, credit memos, shipments, aged AR). Accepts customerName (partial match), customerNumber, or customerId.
   - vendor_detail: full vendor profile (invoices, orders, credit memos, receipts, aged AP). Accepts vendorName (partial match), vendorId, or vendorNumber.
   - account_detail: GL account drilldown (transactions, monthly trend, flow metrics). Requires accountNumber.
   - item_detail: inventory item detail (ledger entries, monthly movement by type). Requires itemNumber.
   - cashflow_item_detail: cash flow category breakdown by account + monthly trend. Requires cashflowItemType (ar-change, ap-change, inventory-change, depreciation, capex, etc.).
   - document_lines: individual line items on a document. Requires documentType (invoice/order/creditMemo/receipt/salesInvoice/salesCreditMemo/salesShipment) and documentId (GUID).
   **Routing guidance:**
   - For questions about a specific vendor (balance, invoices, payments, aging) → use vendor_detail with vendorName
   - For questions about a specific customer (balance, invoices, payments, aging) → use customer_detail with customerName
   - For invoice status breakdowns (paid vs pending) → use entity query with entityType sales_invoice or purchase_invoice and filters.status
   - For aggregated financial data (revenue, expenses, P&L) → use report queries
   - vendor_detail and customer_detail support partial name matching — pass the name as you have it
   - For inventory movement, stock movement trends, or purchase/sale trends over time → use report with reportType=inventory_enhanced (it includes movementTrend). Do NOT use item_ledger_entry entities or sales_by_item for this.
   - For a specific item's movement history → use detail with detailType=item_detail

**summarizeBy** (optional): Time granularity for period-grouped reports.
- 'month' — group by calendar month
- 'quarter' — group by calendar quarter (Q1/Q2/Q3/Q4)
- 'year' — group by calendar year
Supported: profit_loss, monthly_pnl_trend, cash_flow, balance_sheet, sales_by_customer, purchases_by_vendor, sales_by_item, purchases_by_item, trial_balance.
When omitted, reports return aggregate totals.

**TIME PERIODS:**
- this_month, last_month, this_quarter, last_quarter, this_year, last_year, ytd, last_30_days, last_90_days
- Or use startDate/endDate for custom ranges (YYYY-MM-DD)
- Default: this year (YTD) if not specified`,
  schema: businessCentralDataSchema as z.ZodType<BCDataInput>,
})
