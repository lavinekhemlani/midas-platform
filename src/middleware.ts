import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { TokenVerifier } from '@/lib/auth'

// Protected routes that require authentication and terms acceptance
const protectedRoutes = [
  '/reports',
  '/settings',
  '/analytics',
  '/customers',
  '/expenses',
  '/invoicing',
  '/learn',
  '/quickbooks',
  '/projects',
  '/classes',
  '/budgets',
  '/documents',
  '/bc', // Business Central data routes
]

// Routes that require authentication but not terms acceptance
const authOnlyRoutes = ['/onboarding']

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/sign-out',
  '/oauth-callback',
  '/schedule-demo',
  '/success',
  '/under-construction',
  '/sso-callback',
  '/capital',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  // Check if the current path is an auth-only route (like onboarding)
  const isAuthOnlyRoute = authOnlyRoutes.some((route) => pathname.startsWith(route))

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  // Get authentication tokens from cookies
  const accessToken = request.cookies.get('accessToken')?.value
  const idToken = request.cookies.get('idToken')?.value
  const hasTokens = !!(accessToken || idToken)

  // Log for debugging - include more details
  if (isProtectedRoute || isAuthOnlyRoute) {
    console.log(`[MIDDLEWARE] Protected route check:`, {
      pathname,
      hasAccessToken: !!accessToken,
      hasIdToken: !!idToken,
      hasAnyToken: hasTokens,
      isProtectedRoute,
      isAuthOnlyRoute,
    })
  }

  // If trying to access any protected route (including onboarding) without authentication
  if ((isProtectedRoute || isAuthOnlyRoute) && !hasTokens) {
    console.log(`[MIDDLEWARE] Redirecting to sign-in:`, {
      pathname,
      reason: 'no authentication tokens found',
    })
    const signInUrl = new URL('/sign-in', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Special handling for onboarding routes when authenticated
  if (isAuthOnlyRoute && hasTokens) {
    try {
      console.log(`[MIDDLEWARE] Verifying token for onboarding route:`, { pathname })
      const payload = await TokenVerifier.verify(request)

      // If user is trying to access /onboarding directly (without a step)
      // Let the onboarding page handle the redirect based on terms_accepted
      // This ensures consistent behavior
      console.log(`[MIDDLEWARE] Token verification successful for onboarding:`, {
        pathname,
        userId: payload.userId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MIDDLEWARE] Token verification failed for onboarding:', {
        pathname,
        error: errorMessage,
      })
      const signInUrl = new URL('/sign-in', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  // If user is authenticated and trying to access a protected route
  if (isProtectedRoute && hasTokens) {
    try {
      // Verify the token is valid
      // The AuthRedirectHandler will handle terms_accepted checks client-side
      console.log(`[MIDDLEWARE] Verifying token for protected route:`, { pathname })
      const payload = await TokenVerifier.verify(request)
      console.log(`[MIDDLEWARE] Token verification successful:`, {
        pathname,
        userId: payload.userId,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('[MIDDLEWARE] Token verification failed for protected route:', {
        pathname,
        error: errorMessage,
      })
      // If token verification fails, redirect to sign-in
      const signInUrl = new URL('/sign-in', request.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  // If user is on sign-out page, ensure they can access it regardless of auth state
  if (pathname === '/sign-out') {
    return NextResponse.next()
  }

  // Allow all other requests to pass through
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\..*|zoho-test|zoho-dashboard).*)'],
}
