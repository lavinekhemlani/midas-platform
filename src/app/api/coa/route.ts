// src/app/api/coa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { listAccounts } from '@/lib/providers/quickbooks/accounts'

export const GET = withActiveProvider(
  async (request, { provider, apiClient, organizationId, providerId }) => {
    try {
      // Fetch all accounts without pagination
      const accounts = await listAccounts(organizationId, {
        fetch_all: true,
      })

      return NextResponse.json({
        accounts,
        count: accounts.length,
        provider: providerId,
      })
    } catch (error) {
      console.error('Error fetching chart of accounts:', error)
      return NextResponse.json(
        {
          error: 'Failed to fetch chart of accounts',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }
  }
)
