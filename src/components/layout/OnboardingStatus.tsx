'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useSession } from '@/contexts/SessionContext'

export default function OnboardingStatus() {
  const session = useSession()
  const pathname = usePathname()

  const isAccountPage = pathname?.startsWith('/settings')
  const isSignedIn = session.status === 'authenticated'
  const isLoading = session.status === 'loading'

  // Check onboarding status from session data
  const onboardingComplete = session.user?.onboarding_audit?.completed_at ? true : false

  if (isLoading || !isSignedIn || onboardingComplete) {
    return null
  }

  if (!onboardingComplete && isAccountPage) {
    return (
      <Link
        href="/onboarding/setup"
        className="hidden sm:inline-flex items-center px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold rounded-lg shadow hover:shadow-amber-500/25 transition-all duration-200 overflow-hidden group mr-3"
      >
        <span className="relative z-10">Complete Onboarding</span>
        <ArrowRight className="ml-1.5 w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
      </Link>
    )
  }

  return null
}
