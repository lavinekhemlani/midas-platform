// src/app/api/reports/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { ExportOptions, ReportRequest } from '@/lib/types/reports'
import { getProviderCompanyMetadata, updateProviderCompanyMetadata } from '@/lib/providers/database'

// Export functionality for reports
export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    try {
      const { searchParams } = new URL(request.url)
      const reportType = searchParams.get('type') || 'profit_loss'
      const period = searchParams.get('period') || 'this_month'
      const format = (searchParams.get('format') as 'pdf' | 'excel' | 'csv') || 'pdf'
      const includeCharts = searchParams.get('include_charts') === 'true'
      const includeDetails = searchParams.get('include_details') === 'true'

      console.log(`Exporting ${reportType} report as ${format} for ${providerId}`)

      // Get company metadata - prefer stored values to avoid API calls
      const storedMetadata = await getProviderCompanyMetadata(organizationId, providerId)
      let organizationName: string = storedMetadata.companyName || ''
      let currency: string = storedMetadata.homeCurrency || ''

      if (!currency || !organizationName) {
        // Fallback: fetch from provider API (also stores for future use)
        const orgInfo = await (provider.organizations.getOrganizationInfo as any)(
          organizationId,
          apiClient
        )
        if (!organizationName) organizationName = orgInfo.name || 'Organization'
        if (!currency) currency = orgInfo.currency_code || 'USD'

        // Store metadata for future requests
        updateProviderCompanyMetadata(organizationId, providerId, {
          homeCurrency: currency,
          companyName: organizationName !== 'Organization' ? organizationName : undefined,
        }).catch((err) => console.warn('[Export] Failed to store metadata:', err))
      }

      // Calculate date ranges
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth()

      let fromDate: Date
      let toDate: Date = new Date(currentYear, currentMonth + 1, 0) // End of current month

      switch (period) {
        case 'this_month':
          fromDate = new Date(currentYear, currentMonth, 1)
          break
        case 'last_month':
          fromDate = new Date(currentYear, currentMonth - 1, 1)
          toDate = new Date(currentYear, currentMonth, 0)
          break
        case 'this_quarter':
          const currentQuarter = Math.floor(currentMonth / 3)
          fromDate = new Date(currentYear, currentQuarter * 3, 1)
          break
        case 'this_year':
          fromDate = new Date(currentYear, 0, 1)
          break
        default:
          fromDate = new Date(currentYear, currentMonth, 1)
      }

      // Format dates for API
      const formatDate = (date: Date) => date.toISOString().split('T')[0]

      // Fetch the report data based on type
      let reportData: any = {}

      switch (reportType) {
        case 'profit_loss':
          reportData = await (provider.reports.profitAndLoss as any)(
            organizationId,
            {
              from_date: formatDate(fromDate),
              to_date: formatDate(toDate),
              report_basis: 'accrual',
            },
            apiClient
          )
          break

        case 'balance_sheet':
          reportData = await (provider.reports.balanceSheet as any)(
            organizationId,
            {
              as_of_date: formatDate(toDate),
            },
            apiClient
          )
          break

        case 'cash_flow':
          reportData = await (provider.reports.cashFlow as any)(
            organizationId,
            {
              from_date: formatDate(fromDate),
              to_date: formatDate(toDate),
            },
            apiClient
          )
          break

        default:
          throw new Error(`Unsupported report type: ${reportType}`)
      }

      // Generate export based on format
      if (format === 'pdf') {
        const pdfBuffer = await generatePDFReport(reportData, {
          organizationName,
          currency,
          reportType,
          period: {
            start_date: formatDate(fromDate),
            end_date: formatDate(toDate),
          },
          includeCharts,
          includeDetails,
        })

        return new NextResponse(pdfBuffer as any, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${organizationName}-${reportType}-${period}.pdf"`,
          },
        })
      } else if (format === 'excel') {
        const excelBuffer = await generateExcelReport(reportData, {
          organizationName,
          currency,
          reportType,
          period: {
            start_date: formatDate(fromDate),
            end_date: formatDate(toDate),
          },
          includeCharts,
          includeDetails,
        })

        return new NextResponse(excelBuffer as any, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${organizationName}-${reportType}-${period}.xlsx"`,
          },
        })
      } else if (format === 'csv') {
        const csvData = await generateCSVReport(reportData, {
          organizationName,
          currency,
          reportType,
          period: {
            start_date: formatDate(fromDate),
            end_date: formatDate(toDate),
          },
        })

        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${organizationName}-${reportType}-${period}.csv"`,
          },
        })
      }

      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    } catch (error) {
      console.error('Report export error:', error)
      return NextResponse.json(
        {
          error: 'Failed to export report',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)

// Helper function to generate PDF report
async function generatePDFReport(
  reportData: any,
  options: {
    organizationName: string
    currency: string
    reportType: string
    period: { start_date: string; end_date: string }
    includeCharts: boolean
    includeDetails: boolean
  }
): Promise<Buffer> {
  // This is a simplified PDF generation
  // In production, you'd use a library like puppeteer, jsPDF, or PDFKit

  const htmlContent = generateHTMLReport(reportData, options)

  // For now, return a simple text-based "PDF" as a Buffer
  // In production, use proper PDF generation
  const pdfContent = `
    ${options.organizationName}
    ${options.reportType.toUpperCase().replace('_', ' ')} REPORT
    Period: ${options.period.start_date} to ${options.period.end_date}
    Currency: ${options.currency}
    
    Generated on: ${new Date().toISOString()}
    
    FINANCIAL DATA:
    ${JSON.stringify(reportData, null, 2)}
  `

  return Buffer.from(pdfContent, 'utf-8')
}

// Helper function to generate Excel report
async function generateExcelReport(
  reportData: any,
  options: {
    organizationName: string
    currency: string
    reportType: string
    period: { start_date: string; end_date: string }
    includeCharts: boolean
    includeDetails: boolean
  }
): Promise<Buffer> {
  // This is a simplified Excel generation
  // In production, you'd use a library like exceljs or xlsx

  // Generate CSV-like data for Excel
  const csvData = generateCSVData(reportData, options)

  // For now, return CSV data as Buffer (Excel can open CSV)
  // In production, use proper Excel generation with formatting, charts, etc.
  return Buffer.from(csvData, 'utf-8')
}

// Helper function to generate CSV report
async function generateCSVReport(
  reportData: any,
  options: {
    organizationName: string
    currency: string
    reportType: string
    period: { start_date: string; end_date: string }
  }
): Promise<string> {
  return generateCSVData(reportData, options)
}

// Helper function to generate CSV data
function generateCSVData(
  reportData: any,
  options: {
    organizationName: string
    currency: string
    reportType: string
    period: { start_date: string; end_date: string }
  }
): string {
  const header = `Organization,${options.organizationName}
Report Type,${options.reportType.replace('_', ' ')}
Period,${options.period.start_date} to ${options.period.end_date}
Currency,${options.currency}
Generated,${new Date().toISOString()}

`

  let csvContent = header

  if (options.reportType === 'profit_loss') {
    csvContent += `Item,Amount
Total Revenue,${reportData.total_income || 0}
Total Expenses,${reportData.total_expenses || 0}
Gross Profit,${reportData.gross_profit || 0}
Net Income,${reportData.net_income || 0}
`
  } else if (options.reportType === 'balance_sheet') {
    csvContent += `Item,Amount
Total Assets,${reportData.total_assets || 0}
Total Liabilities,${reportData.total_liabilities || 0}
Total Equity,${reportData.total_equity || 0}
`
  } else if (options.reportType === 'cash_flow') {
    csvContent += `Item,Amount
Operating Cash Flow,${reportData.net_cash_from_operating_activities || 0}
Investing Cash Flow,${reportData.net_cash_from_investing_activities || 0}
Financing Cash Flow,${reportData.net_cash_from_financing_activities || 0}
Net Change in Cash,${reportData.net_change_in_cash || 0}
Cash at End,${reportData.cash_at_end || 0}
`
  }

  return csvContent
}

// Helper function to generate HTML report (for PDF conversion)
function generateHTMLReport(
  reportData: any,
  options: {
    organizationName: string
    currency: string
    reportType: string
    period: { start_date: string; end_date: string }
    includeCharts: boolean
    includeDetails: boolean
  }
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${options.organizationName} - ${options.reportType}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .report-info { margin-bottom: 20px; }
        .financial-data { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .amount { text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${options.organizationName}</h1>
        <h2>${options.reportType.toUpperCase().replace('_', ' ')} REPORT</h2>
      </div>
      
      <div class="report-info">
        <p><strong>Period:</strong> ${options.period.start_date} to ${options.period.end_date}</p>
        <p><strong>Currency:</strong> ${options.currency}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      
      <div class="financial-data">
        ${generateHTMLTable(reportData, options.reportType, options.currency)}
      </div>
    </body>
    </html>
  `
}

// Helper function to generate HTML table for different report types
function generateHTMLTable(reportData: any, reportType: string, currency: string = 'USD'): string {
  if (reportType === 'profit_loss') {
    return `
      <table>
        <thead>
          <tr><th>Item</th><th class="amount">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>Total Revenue</td><td class="amount">${formatCurrency(reportData.total_income || 0, currency)}</td></tr>
          <tr><td>Total Expenses</td><td class="amount">${formatCurrency(reportData.total_expenses || 0, currency)}</td></tr>
          <tr><td>Gross Profit</td><td class="amount">${formatCurrency(reportData.gross_profit || 0, currency)}</td></tr>
          <tr><td><strong>Net Income</strong></td><td class="amount"><strong>${formatCurrency(reportData.net_income || 0, currency)}</strong></td></tr>
        </tbody>
      </table>
    `
  } else if (reportType === 'balance_sheet') {
    return `
      <table>
        <thead>
          <tr><th>Item</th><th class="amount">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>ASSETS</strong></td><td class="amount"><strong>${formatCurrency(reportData.total_assets || 0, currency)}</strong></td></tr>
          <tr><td><strong>LIABILITIES</strong></td><td class="amount"><strong>${formatCurrency(reportData.total_liabilities || 0, currency)}</strong></td></tr>
          <tr><td><strong>EQUITY</strong></td><td class="amount"><strong>${formatCurrency(reportData.total_equity || 0, currency)}</strong></td></tr>
        </tbody>
      </table>
    `
  } else if (reportType === 'cash_flow') {
    return `
      <table>
        <thead>
          <tr><th>Cash Flow Activity</th><th class="amount">Amount</th></tr>
        </thead>
        <tbody>
          <tr><td>Operating Activities</td><td class="amount">${formatCurrency(reportData.net_cash_from_operating_activities || 0, currency)}</td></tr>
          <tr><td>Investing Activities</td><td class="amount">${formatCurrency(reportData.net_cash_from_investing_activities || 0, currency)}</td></tr>
          <tr><td>Financing Activities</td><td class="amount">${formatCurrency(reportData.net_cash_from_financing_activities || 0, currency)}</td></tr>
          <tr><td>Net Change in Cash</td><td class="amount">${formatCurrency(reportData.net_change_in_cash || 0, currency)}</td></tr>
          <tr><td><strong>Cash at End of Period</strong></td><td class="amount"><strong>${formatCurrency(reportData.cash_at_end || 0, currency)}</strong></td></tr>
        </tbody>
      </table>
    `
  }

  return '<p>Report data not available</p>'
}

// Helper function to format currency
function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}
