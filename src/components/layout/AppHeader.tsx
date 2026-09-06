'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CircleArrowRight, Loader2 } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { EB_Garamond } from 'next/font/google'
import CSSThemeToggleCompact from '@/components/ui/CSSThemeToggleCompact'
import { useEffect, useState } from 'react'
import { useSession } from '@/hooks/useSession'
import CustomUserDropdown from '@/components/ui/CustomUserDropdown'
import OnboardingStatus from '@/components/layout/OnboardingStatus'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

function AuthenticatedControls({ isAccountPage }: { isAccountPage: boolean }) {
  return (
    <>
      {isAccountPage && <OnboardingStatus />}
      <CustomUserDropdown />
    </>
  )
}

interface AppHeaderProps {
  showSignedOutControls?: boolean
  sidebarExpanded?: boolean
}

export default function AppHeader({
  showSignedOutControls = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  sidebarExpanded = true,
}: AppHeaderProps) {
  const pathname = usePathname()
  const { status } = useSession()
  const [isNavigating, setIsNavigating] = useState<string | null>(null)

  // Simplified authentication state - single source of truth
  const isAuthenticated = status === 'authenticated'
  const isLoading = status === 'loading'
  const isUnauthenticated = status === 'unauthenticated'

  const isLandingPage = pathname === '/' || showSignedOutControls
  const isAccountPage = pathname?.startsWith('/settings')
  const isOnboardingPage = pathname?.startsWith('/onboarding')
  const isMainRoute =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/customers') ||
    pathname?.startsWith('/invoicing') ||
    pathname?.startsWith('/expenses') ||
    pathname?.startsWith('/analytics') ||
    pathname?.startsWith('/learn') ||
    pathname?.startsWith('/banking') ||
    pathname?.startsWith('/reports') ||
    pathname?.startsWith('/sales') ||
    pathname?.startsWith('/memories') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/support') ||
    pathname?.startsWith('/journal')

  // Track navigation state to show loading feedback
  useEffect(() => {
    // Reset navigation state when pathname changes (navigation complete)
    setIsNavigating(null)
  }, [pathname])

  return (
    <nav
      className={`app-header fixed top-0 left-0 right-0 z-40 pointer-events-none ${ebGaramond.variable}`}
    >
      <div className="flex items-center h-16">
        {/* Left Section - Logo */}
        <div
          className={`header-left ${
            isMainRoute && !isOnboardingPage
              ? 'opacity-0 pointer-events-none w-0'
              : 'opacity-100 w-auto pl-2 pointer-events-auto'
          }`}
        >
          <Link
            href={isAuthenticated ? '/dashboard' : '/'}
            className="header-logo-container relative group flex items-center"
          >
            <div className="relative h-10">
              <Image
                src="/images/hero/logo_type_gold_new.svg"
                alt="Midas"
                width={160}
                height={40}
                className="object-contain"
                priority
              />
            </div>
          </Link>
        </div>

        {/* Middle Section - Reserved space */}
        <div
          className={`header-middle flex-1 px-4 ${
            isMainRoute ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-none'
          }`}
        >
          {/* Optional middle content */}
        </div>

        {/* Right Section - Auth Controls */}
        <div className="header-right flex items-center space-x-2 sm:space-x-3 pr-4 sm:pr-7 pointer-events-auto">
          {isAuthenticated ? (
            // Authenticated: Show user controls
            <AuthenticatedControls isAccountPage={isAccountPage} />
          ) : isLoading ? (
            // Loading: Always show loading state regardless of route
            <div
              className="flex items-center space-x-2 px-3 py-1.5"
              role="status"
              aria-live="polite"
            >
              <span className="text-xs sm:text-sm font-medium theme-text-secondary">
                Loading...
              </span>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" aria-hidden="true" />
            </div>
          ) : isUnauthenticated && isLandingPage ? (
            // Unauthenticated on landing page: Show sign in/up buttons
            <>
              <div className="header-theme-toggle hidden md:block">
                <CSSThemeToggleCompact />
              </div>
              <Link
                href="/sign-up"
                onClick={(e) => {
                  if (pathname === '/sign-up') {
                    e.preventDefault()
                    return
                  }
                  setIsNavigating('sign-up')
                }}
                className="relative px-3 sm:px-5 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs sm:text-sm font-bold rounded-lg shadow"
                style={pathname === '/sign-up' ? { cursor: 'not-allowed' } : undefined}
              >
                <span className="relative z-10 flex items-center">
                  Sign up
                  {isNavigating === 'sign-up' ? (
                    <Loader2 className="ml-1 sm:ml-1.5 w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                  ) : (
                    <CircleArrowRight className="ml-1 sm:ml-1.5 w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </span>
              </Link>
              <Link
                href="/sign-in"
                onClick={(e) => {
                  if (pathname === '/sign-in') {
                    e.preventDefault()
                    return
                  }
                  setIsNavigating('sign-in')
                }}
                className="hidden sm:block px-3 py-1.5 text-xs sm:text-sm font-semibold theme-text-secondary hover:text-amber-400"
                style={pathname === '/sign-in' ? { cursor: 'not-allowed' } : undefined}
              >
                <span className="relative z-10 flex items-center">
                  Sign In
                  {isNavigating === 'sign-in' ? (
                    <Loader2 className="ml-1 sm:ml-1.5 w-3 h-3 animate-spin" />
                  ) : (
                    <CircleArrowRight className="ml-1 sm:ml-1.5 w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </span>
              </Link>
            </>
          ) : (
            // Fallback: Unauthenticated on protected route (shouldn't normally happen, but ensures header always shows something)
            <div
              className="flex items-center space-x-2 px-3 py-1.5"
              role="status"
              aria-live="polite"
              aria-label="Authenticating"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
