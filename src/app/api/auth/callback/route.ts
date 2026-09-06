// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { withRequestContext } from '@/lib/middleware/requestContext'

export const GET = withRequestContext(async (request: NextRequest) => {
  try {
    const { userId } = await TokenVerifier.verify(request)

    // Log successful authentication
    logger.workflow('auth', 'callback_success', { userId })

    // Always redirect authenticated users to reports
    // Reports is the main app entry point
    const redirectUrl = '/reports'

    return NextResponse.json({
      success: true,
      redirectUrl,
      requiresOnboarding: false, // No longer tracking this in the redirect logic
    })
  } catch (error) {
    logger.error('Auth callback failed', {
      error,
      reason: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 401 }
    )
  }
})
