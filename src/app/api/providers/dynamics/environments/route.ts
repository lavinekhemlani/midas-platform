// src/app/api/providers/dynamics/environments/route.ts
/**
 * GET /api/providers/dynamics/environments
 * Returns available BC environments for the authenticated tenant.
 * Called after OAuth auth, before environment/company selection.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getBCConnectionCredentials, storeBCConnectionCredentials } from '@/lib/providers/database'
import { discoverEnvironments } from '@/lib/providers/dynamics/oauthClient'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (_request: NextRequest, { organizationId }) => {
  try {
    // Get stored BC OAuth credentials from the pending connection
    const credentials = await getBCConnectionCredentials(organizationId, '_pending_oauth')

    if (!credentials?.access_token) {
      return NextResponse.json(
        { error: 'Business Central not authenticated. Please connect first.' },
        { status: 401 }
      )
    }

    // Discover environments using the access token
    const environments = await discoverEnvironments(credentials.access_token)

    // Backfill tenant_id from the environments response if missing from token extraction.
    // Each environment has an aadTenantId — they're all the same tenant.
    if (!credentials.tenant_id && environments.length > 0 && environments[0].aadTenantId) {
      const tenantId = environments[0].aadTenantId
      logger.info('Backfilling tenant_id from environment discovery', { organizationId, tenantId })
      await storeBCConnectionCredentials(
        organizationId,
        '_pending_oauth',
        'Microsoft Dynamics 365 BC',
        { ...credentials, tenant_id: tenantId, provider_organization_id: tenantId }
      )
    }

    logger.info('BC environments discovered', {
      organizationId,
      count: environments.length,
    })

    return NextResponse.json({ environments })
  } catch (error) {
    logger.error('Failed to discover BC environments', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to discover environments',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
