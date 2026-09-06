// src/app/api/auth/shopify/callback/route.ts
// Shopify-specific callback route that forwards to the generic provider callback handler.
// Shopify's redirect URLs are configured as /api/auth/shopify/callback in the Shopify dashboard,
// so this route receives the OAuth callback and delegates to the shared callback logic.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Forward all query params to the generic provider callback
  const url = new URL(req.url)

  // Use X-Forwarded-Host/Proto (set by ngrok/reverse proxies) or NEXT_PUBLIC_APP_URL
  // to avoid redirecting to localhost when behind a proxy
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : process.env.NEXT_PUBLIC_APP_URL || url.origin
  const callbackUrl = new URL('/api/providers/callback', origin)

  // Copy all search params (code, state, etc.)
  url.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value)
  })

  return NextResponse.redirect(callbackUrl.toString())
}
