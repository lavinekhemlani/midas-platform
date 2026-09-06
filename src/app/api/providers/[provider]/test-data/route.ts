// src/app/api/providers/[provider]/test-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withProvider } from '@/lib/providers/handler'

const testDataHandler = async (
  request: NextRequest, 
  { provider, organizationId, apiClient, providerId }: { provider: any; organizationId: string; apiClient: any; providerId: string }
) => {
  try {
    // Check for mode parameter (quick or full)
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode') || 'quick';
    const isQuickMode = mode === 'quick';
    
    console.log(`Testing ${providerId} connection for organization: ${organizationId} (mode: ${mode})`)

    // Test basic connectivity
    const testResults: any = {
      provider: providerId,
      organizationId,
      timestamp: new Date().toISOString(),
      mode,
      tests: {}
    }

    // Define test operations based on mode
    let testOperations: any[] = [];
    
    // Helper to safely call a provider method (QuickBooks uses a unified client,
    // so legacy entity modules may be empty stubs)
    const safeCall = (module: any, method: string, ...args: any[]) => {
      if (module && typeof module[method] === 'function') {
        return module[method](...args)
      }
      return Promise.reject(new Error(`${method} not available for this provider`))
    }

    if (isQuickMode) {
      // Quick mode: Only get organization info and counts
      testOperations = [
        {
          key: 'organization',
          operation: () => safeCall(provider.organizations, 'getOrganizationInfo', organizationId, apiClient),
          processResult: (orgInfo: any) => ({
            status: 'success',
            data: {
              name: orgInfo.name,
              currency: orgInfo.currency_code,
              id: orgInfo.organization_id
            }
          })
        },
        {
          key: 'invoices',
          operation: () => safeCall(provider.invoices, 'listInvoices', organizationId, { per_page: 1 }, apiClient),
          processResult: (invoices: any[]) => ({
            status: 'success',
            count: invoices.length > 0 ? 'Available' : 0,
            hasData: invoices.length > 0
          })
        },
        {
          key: 'customers',
          operation: () => safeCall(provider.customers, 'listCustomers', organizationId, { per_page: 1 }, apiClient),
          processResult: (customers: any[]) => ({
            status: 'success',
            count: customers.length > 0 ? 'Available' : 0,
            hasData: customers.length > 0
          })
        }
      ];
    } else {
      // Full mode: Get detailed data (original behavior)
      testOperations = [
        {
          key: 'organization',
          operation: () => safeCall(provider.organizations, 'getOrganizationInfo', organizationId, apiClient),
          processResult: (orgInfo: any) => ({
            status: 'success',
            data: {
              name: orgInfo.name,
              currency: orgInfo.currency_code,
              id: orgInfo.organization_id
            }
          })
        },
        {
          key: 'invoices',
          operation: () => safeCall(provider.invoices, 'listInvoices', organizationId, { per_page: 5 }, apiClient),
          processResult: (invoices: any[]) => ({
            status: 'success',
            count: invoices.length,
            sample: invoices.slice(0, 2).map((inv: any) => ({
              id: inv.invoice_id || inv.id,
              number: inv.invoice_number,
              total: inv.total,
              status: inv.status
            }))
          })
        },
        {
          key: 'expenses',
          operation: () => safeCall(provider.expenses, 'listExpenses', organizationId, { per_page: 5 }, apiClient),
          processResult: (expenses: any[]) => ({
            status: 'success',
            count: expenses.length,
            sample: expenses.slice(0, 2).map((exp: any) => ({
              id: exp.expense_id || exp.id,
              description: exp.description,
              total: exp.total,
              date: exp.date || exp.expense_date
            }))
          })
        },
        {
          key: 'banking',
          operation: () => safeCall(provider.banking, 'listBankAccounts', organizationId, {}, apiClient),
          processResult: (bankAccounts: any[]) => ({
            status: 'success',
            count: bankAccounts.length,
            sample: bankAccounts.slice(0, 2).map((acc: any) => ({
              id: acc.account_id || acc.id,
              name: acc.account_name,
              balance: acc.balance,
              type: acc.account_type
            }))
          })
        },
        {
          key: 'customers',
          operation: () => safeCall(provider.customers, 'listCustomers', organizationId, { per_page: 5 }, apiClient),
          processResult: (customers: any[]) => ({
            status: 'success',
            count: customers.length,
            sample: customers.slice(0, 2).map((cust: any) => ({
              id: cust.contact_id || cust.id,
              name: cust.contact_name || cust.name,
              email: cust.email,
              status: cust.status
            }))
          })
        }
      ];
    }

    // Execute all tests concurrently using Promise.allSettled
    const testPromises = testOperations.map(test => test.operation())
    const results = await Promise.allSettled(testPromises)

    // Process results
    results.forEach((result, index) => {
      const test = testOperations[index]
      if (result.status === 'fulfilled') {
        try {
          testResults.tests[test.key] = test.processResult(result.value)
        } catch (processError) {
          testResults.tests[test.key] = {
            status: 'error',
            error: `Failed to process ${test.key} data: ${processError instanceof Error ? processError.message : 'Unknown error'}`
          }
        }
      } else {
        testResults.tests[test.key] = {
          status: 'error',
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        }
      }
    })

    // Calculate overall status
    const testCount = Object.keys(testResults.tests).length
    const successCount = Object.values(testResults.tests).filter((test: any) => test.status === 'success').length
    
    testResults.summary = {
      total: testCount,
      passed: successCount,
      failed: testCount - successCount,
      success_rate: Math.round((successCount / testCount) * 100)
    }

    testResults.overall_status = successCount === testCount ? 'success' : 
                                successCount > 0 ? 'partial' : 'failed'

    console.log(`Test completed for ${providerId}: ${testResults.overall_status}`)
    
    return NextResponse.json(testResults)

  } catch (error) {
    console.error(`Test data API error for ${providerId}:`, error)
    
    return NextResponse.json({ 
      provider: providerId,
      organizationId,
      timestamp: new Date().toISOString(),
      overall_status: 'failed',
      error: 'Failed to test provider connection', 
      details: error instanceof Error ? error.message : 'Unknown error',
      summary: {
        total: 0,
        passed: 0,
        failed: 1,
        success_rate: 0
      }
    }, { status: 500 })
  }
}

// Export the GET handler wrapped with withProvider
export const GET = withProvider(testDataHandler)