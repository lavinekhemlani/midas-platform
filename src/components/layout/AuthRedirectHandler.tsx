// src/components/layout/AuthRedirectHandler.tsx
'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from '@/hooks/useSession'
import { logger } from '@/lib/logger'

const PUBLIC_ROUTES = ['/sign-in', '/sign-up', '/oauth-callback', '/sso-callback']

export default function AuthRedirectHandler({ children }: { children: React.ReactNode }) {
  const { status, onboardingRequired, hasAcceptedTerms, error } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return

    // Early returns for routes that don't need redirect logic
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
    const isOnboardingRoute = pathname.startsWith('/onboarding')

    // Skip checks for public routes or when session is loading
    if (status === 'loading') {
      logger.debug('Session loading, waiting...', { component: 'AuthRedirectHandler' })
      return
    }

    if (isPublicRoute) {
      logger.debug('Public route, skipping checks', { component: 'AuthRedirectHandler', pathname })
      return
    }

    // Redirect unauthenticated users to sign-in
    if (status === 'unauthenticated') {
      logger.info('Unauthenticated on protected route, redirecting to /sign-in', {
        component: 'AuthRedirectHandler',
        pathname,
      })
      router.replace('/sign-in')
      return
    }

    // Handle authentication errors
    if (status === 'authenticated' && error) {
      logger.error('Session error detected, redirecting to /sign-in:', {
        error,
        component: 'AuthRedirectHandler',
      })
      router.replace('/sign-in')
      return
    }

    // Handle authenticated users
    if (status === 'authenticated') {
      // If onboarding complete but on onboarding route, redirect to dashboard
      if (!onboardingRequired && isOnboardingRoute) {
        logger.info('Onboarding complete but on onboarding route, redirecting to /dashboard', {
          component: 'AuthRedirectHandler',
          pathname,
        })
        router.replace('/dashboard')
        return
      }

      // If onboarding required but not on onboarding route, redirect to onboarding
      if (onboardingRequired && !isOnboardingRoute) {
        logger.info('Onboarding required, redirecting to /onboarding/setup', {
          component: 'AuthRedirectHandler',
          pathname,
          hasAcceptedTerms,
          onboardingRequired,
        })
        router.replace('/onboarding/setup')
        return
      }

      // No redirect needed - user is on correct route
      const routeStatus = onboardingRequired ? 'onboarding flow' : 'main app'
      logger.debug('No redirect needed - user on correct route', {
        component: 'AuthRedirectHandler',
        pathname,
        routeStatus,
      })
    }
  }, [status, onboardingRequired, hasAcceptedTerms, error, pathname, router])

  // Let the layout handle loading states - don't override children
  // This ensures the AppHeader remains visible during session initialization
  return <>{children}</>
}
