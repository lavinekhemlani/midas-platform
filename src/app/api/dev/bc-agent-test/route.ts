import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { getActiveBCConnectionId, getBCConnectionCredentials } from '@/lib/providers/database'
import { executeBCApiQuery } from '@/ai/tools/business-central-data/bc-api-handlers'

export const POST = withAuth(async (request: NextRequest, { organizationId }) => {
  const url = new URL(request.url)
  const connectionId = url.searchParams.get('connectionId') || undefined

  // Resolve connection
  let resolvedConnectionId = connectionId
  if (!resolvedConnectionId) {
    resolvedConnectionId = (await getActiveBCConnectionId(organizationId)) || undefined
  }
  if (!resolvedConnectionId) {
    return NextResponse.json({ error: 'No active BC connection' }, { status: 404 })
  }

  // Get credentials
  const credentials = await getBCConnectionCredentials(organizationId, resolvedConnectionId)
  if (!credentials || !(credentials as any).connected) {
    return NextResponse.json(
      { error: 'Connection not active or credentials missing' },
      { status: 404 }
    )
  }

  const creds = credentials as any

  // Parse request body (matches BCDataInput schema)
  const input = await request.json()

  const startTime = Date.now()

  try {
    const result = await executeBCApiQuery(input, {
      organizationId,
      connectionId: resolvedConnectionId,
      tenantId: creds.tenant_id,
      environmentName: creds.environment_name,
      companyId: creds.company_id,
      currency: creds.home_currency,
      companyName: creds.company_name,
      correlationId: `dev-test-${Date.now()}`,
    })

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      result,
      durationMs,
      requestPayload: input,
      connection: {
        connectionId: resolvedConnectionId,
        companyName: creds.company_name,
        environmentName: creds.environment_name,
        currency: creds.home_currency,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        requestPayload: input,
      },
      { status: 500 }
    )
  }
})
