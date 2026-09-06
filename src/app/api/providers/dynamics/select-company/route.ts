// src/app/api/providers/dynamics/select-company/route.ts
/**
 * POST /api/providers/dynamics/select-company
 * Finalizes BC OAuth connection by storing the selected environment + company.
 * Called after the user picks an environment and company in the setup wizard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import {
  getBCConnectionCredentials,
  storeBCConnectionCredentials,
  removeBCConnection,
} from '@/lib/providers/database'
import { logger } from '@/lib/logger'

export const POST = withAuth(async (request: NextRequest, { userId, organizationId }) => {
  try {
    const body = await request.json()
    const { environmentName, companyId, companyName } = body

    if (!environmentName || !companyId || !companyName) {
      return NextResponse.json(
        { error: 'Missing required fields: environmentName, companyId, companyName' },
        { status: 400 }
      )
    }

    // Get stored BC OAuth credentials from the pending connection (set during callback)
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

    // Build connection ID
    const connectionId = `${environmentName}_${companyId}`

    // Store the final connection with all details
    const success = await storeBCConnectionCredentials(
      organizationId,
      connectionId,
      'Microsoft Dynamics 365 BC',
      {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expires_at: credentials.expires_at,
        connected: true,
        last_synced: Math.floor(Date.now() / 1000),
        tenant_id: credentials.tenant_id,
        environment_name: environmentName,
        company_id: companyId,
        company_name: companyName,
        auth_type: 'oauth',
      },
      userId
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to store connection' }, { status: 500 })
    }

    // Clean up the temporary pending connection
    await removeBCConnection(organizationId, '_pending_oauth').catch(() => {
      // Non-critical — temp entry will just be orphaned
    })

    logger.info('BC OAuth connection finalized', {
      organizationId,
      connectionId,
      companyName,
      environmentName,
    })

    return NextResponse.json({
      success: true,
      connectionId,
      companyName,
      environmentName,
    })
  } catch (error) {
    logger.error('Failed to finalize BC connection', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to finalize connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
