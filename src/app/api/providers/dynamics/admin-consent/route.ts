// src/app/api/providers/dynamics/admin-consent/route.ts
/**
 * GET /api/providers/dynamics/admin-consent
 * Initiates the Azure AD admin consent flow for BC OAuth.
 * Same as normal OAuth but with prompt=admin_consent.
 * Used when regular user consent is insufficient.
 */
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/providers/handler'
import { generateSecureState } from '@/lib/providers/oauth-security'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthorizationUrl,
} from '@/lib/providers/dynamics/oauthClient'
import { logger } from '@/lib/logger'

export const GET = withAuth(async (_request: NextRequest, { userId, organizationId }) => {
  try {
    // Generate PKCE
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    // Generate secure state with PKCE verifier
    const state = await generateSecureState({
      userId,
      organizationId,
      provider: 'dynamics',
      redirect: '/onboarding/bc-setup',
      codeVerifier,
    })

    // Build admin consent URL (same as regular OAuth but with adminConsent=true)
    const adminConsentUrl = getAuthorizationUrl(state, codeChallenge, true)

    logger.info('BC admin consent flow initiated', { organizationId, userId })
    return NextResponse.redirect(adminConsentUrl)
  } catch (error) {
    logger.error('BC admin consent flow error', { organizationId, error })
    return NextResponse.json(
      {
        error: 'Failed to initiate admin consent',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
