// src/app/api/providers/dynamics/companies/route.ts
/**
 * GET /api/providers/dynamics/companies?environment=Production
 * Returns available companies within a BC environment.
 * Called after environment selection in the setup wizard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getBCConnectionCredentials } from '@/lib/providers/database'
import { discoverCompanies } from '@/lib/providers/dynamics/oauthClient'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (request: NextRequest, { organizationId }) => {
  try {
    const { searchParams } = new URL(request.url)
    const environmentName = searchParams.get('environment')

    if (!environmentName) {
      return NextResponse.json(
        { error: 'Missing required parameter: environment' },
        { status: 400 }
      )
    }

    // Get stored BC OAuth credentials from the pending connection
    const credentials = await getBCConnectionCredentials(organizationId, '_pending_oauth')

    if (!credentials?.access_token) {
      return NextResponse.json(
        { error: 'Business Central not authenticated. Please connect first.' },
        { status: 401 }
      )
    }

    if (!credentials.tenant_id) {
      return NextResponse.json(
        { error: 'Tenant ID not found. Please re-authenticate with Business Central.' },
        { status: 400 }
      )
    }

    // Discover companies in the selected environment
    const companies = await discoverCompanies(
      credentials.access_token,
      credentials.tenant_id,
      environmentName
    )

    logger.info('BC companies discovered', {
      organizationId,
      environmentName,
      count: companies.length,
    })

    return NextResponse.json({ companies })
  } catch (error) {
    logger.error('Failed to discover BC companies', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to discover companies',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
