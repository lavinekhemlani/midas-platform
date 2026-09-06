'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import Background from '@/components/layout/Background'
import TopNav from '@/components/layout/TopNav'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { FinancialDataProvider } from '@/contexts/FinancialDataContext'
import { LightRays } from '@/components/magicui/light-rays'

// Dynamically import Footer with SSR disabled to prevent hydration mismatch
const Footer = dynamic(() => import('@/components/layout/Footer'), { ssr: false })

// Pages that should not show the full footer
const noFooterRoutes = [
  '/sign-in',
  '/sign-up',
  '/schedule-demo',
  '/onboarding',
  '/terms',
  '/privacy',
]

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showFooter = !noFooterRoutes.some((route) => pathname?.startsWith(route))

  return (
    // PLEASE DO NOT REMOVE ANY OF THE COMMENTS HERE IF YOU ARE MAKING EDITS. JUST ADD STUFF
    <div className="min-h-screen relative overflow-x-hidden group/shell">
      <Background />
      {/* Light Rays Effect - matches cyan gradient in (main) layout */}
      {/* z-[38] puts rays above content fade overlay (z-35) but below nav (z-40) */}
      <LightRays
        count={10}
        blur={60}
        speed={14}
        length="80vh"
        className="fixed inset-x-0 top-0 z-[38] h-[80vh] pointer-events-none"
      />
      {/* Top-origin cyan radial glow across (shell) pages */}
      {/* <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[55vh] bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.20)_0%,rgba(34,211,238,0.10)_35%,transparent_70%)] blur-2xl"
      /> */}
      {/* <div className="hidden md:block">
        <AnimatedShell intensity="normal" />
      </div> */}
      <TopNav />
      {/* Legacy fade overlay - backdrop now handled in TopNav component */}
      {/* z-index stacking: overlay(z-35) < lightRays(z-38) < content(z-39) < nav(z-40) */}
      <div className="nav-content-fade-overlay" aria-hidden="true" />
      <Suspense>
        <FinancialDataProvider>
          <CurrencyProvider>
            <div className="relative z-[39] pt-20 md:pt-24 overflow-x-hidden">{children}</div>
          </CurrencyProvider>
        </FinancialDataProvider>
      </Suspense>
      {/* Footer for shell pages (hidden on sign-in, sign-up, schedule-demo) */}
      {showFooter && <Footer />}
    </div>
  )
}
