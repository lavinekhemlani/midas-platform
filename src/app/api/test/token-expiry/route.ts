import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to simulate QuickBooks token expiry
 * Use this to test the automatic redirection to integrations page
 *
 * Usage: GET /api/test/token-expiry
 */
export async function GET(request: NextRequest) {
  // Simulate different error scenarios based on query parameter
  const { searchParams } = new URL(request.url);
  const scenario = searchParams.get('scenario') || 'token_expired';

  switch (scenario) {
    case 'token_expired':
      return NextResponse.json({
        error: 'QuickBooks authentication expired',
        code: 'PROVIDER_TOKEN_EXPIRED',
        requiresReconnect: true,
        provider: 'quickbooks',
        redirectUrl: '/settings?error=token_expired&provider=quickbooks',
        userMessage: 'Your QuickBooks connection has expired. Please reconnect to continue.',
        details: process.env.NODE_ENV === 'development'
          ? 'QuickBooks authentication expired - please reconnect'
          : undefined
      }, { status: 401 });

    case 'not_connected':
      return NextResponse.json({
        error: 'Provider not connected',
        code: 'PROVIDER_NOT_CONNECTED',
        requiresReconnect: true,
        provider: 'quickbooks',
        redirectUrl: '/settings?error=not_connected&provider=quickbooks',
        userMessage: 'Please connect QuickBooks to view your financial data.',
        details: process.env.NODE_ENV === 'development'
          ? 'QuickBooks not connected for this organization'
          : undefined
      }, { status: 401 });

    case 'invalid_grant':
      return NextResponse.json({
        error: 'Invalid grant',
        code: 'PROVIDER_INVALID_GRANT',
        requiresReconnect: true,
        provider: 'quickbooks',
        redirectUrl: '/settings?error=invalid_grant&provider=quickbooks',
        userMessage: 'QuickBooks authorization has been revoked. Please reconnect.',
        details: process.env.NODE_ENV === 'development'
          ? 'Invalid grant - re-authentication required'
          : undefined
      }, { status: 401 });

    case 'success':
      return NextResponse.json({
        message: 'API call successful',
        data: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });

    default:
      return NextResponse.json({
        error: 'Unknown scenario',
        availableScenarios: ['token_expired', 'not_connected', 'invalid_grant', 'success']
      }, { status: 400 });
  }
}