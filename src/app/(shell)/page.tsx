'use client'

import { useEffect, useRef } from 'react'
// import { Badge } from '@/components/ui/badge'
// import { Button } from '@/components/ui/button'
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EB_Garamond, DM_Sans, STIX_Two_Text } from 'next/font/google'
import Link from 'next/link'
// import { Fragment, useState } from 'react'
// import { cn } from "@/lib/utils";

// import RevenueChart from '@/app/(main)/components/charts/RevenueChart'
// import PieChartComponent from '@/components/charts/PieChart'
import { useTheme } from '@/hooks/useTheme'
import { useSession } from '@/hooks/useSession'
// import RevenueBreakdown from "@/app/(main)/components/RevenueBreakdown";
// import { CanvasRevealEffectDemo } from "@/components/ui/canvas-reveal-effect-demo";
import { TestimonialsGrid } from '@/components/landing/TestimonialsGrid'
import { FeaturesAccordion } from '@/components/landing/FeaturesAccordion'
import { MidasAIAgentSection } from '@/components/landing/MidasAIAgentSection'

import { SecuritySection } from '@/components/landing/SecuritySection'
import IntegrationsHero from '@/app/(shell)/integrations/components/IntegrationsHero'
// import { GlowingEffect } from "@/components/ui/glowing-effect";
// import { IntegrationBeamDemo } from "@/components/ui/integration-beam-demo";
import { InteractiveHoverButton } from '@/components/magicui/interactive-hover-button'
import { ArrowRight, Calendar } from 'lucide-react'
import { GridPattern } from '@/components/magicui/grid-pattern'
// import { ContainerTextFlip } from "@/components/ui/container-text-flip";
import Typewriter from '@/components/ui/typewriter'
import Image from 'next/image'
// import { SpinningText } from "@/components/magicui/spinning-text";
// import SampleChatComponent from '@/components/SampleChatComponent'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

// Dummy data for RevenueBreakdown pie chart
// const revenueBreakdownData = [
//   { source: 'Product Sales', amount: 34000, percentage: 45, count: 23 },
//   { source: 'Service Revenue', amount: 26000, percentage: 35, count: 15 },
//   { source: 'Subscription Fees', amount: 11000, percentage: 15, count: 8 },
//   { source: 'Other Income', amount: 4000, percentage: 5, count: 4 },
// ];
// const totalRevenue = 34000 + 26000 + 11000 + 4000;

// Learn cards content for the landing page carousel
// const learnCardItems = [
//   {
//     key: 'revenue',
//     title: 'Revenue',
//     badge: 'Fundamentals',
//     category: 'Fundamentals',
//     description:
//       "Revenue is the total amount of money your business brings in from selling products or services. It's your business's lifeline and proof that customers value what you're building.",

//     relatedCount: 3,
//   },
//   {
//     key: 'cashflow',
//     title: 'Cash Flow',
//     badge: 'Cash Flow',
//     category: 'Cash Flow',
//     description:
//       "Cash flow is the net amount of cash moving in and out of your business. It's the oxygen that keeps your business alive and determines your runway.",

//     relatedCount: 5,
//   },
//   {
//     key: 'runway',
//     title: 'Runway',
//     badge: 'Growth',
//     category: 'Growth',
//     description:
//       "Runway is how long your business can survive before running out of cash. It's critical for startup survival and fundraising timing.",

//     relatedCount: 4,
//   },
//   {
//     key: 'burnrate',
//     title: 'Burn Rate',
//     badge: 'Operations',
//     category: 'Operations',
//     description:
//       "Burn rate is how quickly your company spends money. It's essential for understanding cash consumption and planning your fundraising strategy.",

//     relatedCount: 6,
//   },
//   {
//     key: 'arr',
//     title: 'ARR',
//     badge: 'Metrics',
//     category: 'Metrics',
//     description:
//       "Annual Recurring Revenue (ARR) is the yearly value of your subscription contracts. It's the gold standard metric for SaaS companies and investors.",

//     relatedCount: 7,
//   },
// ]

// Category styling to match Learn glossary cards
// const getCategoryStyling = (category: string) => {
//   switch (category.toLowerCase()) {
//     case 'fundamentals':
//       return 'border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700'
//     case 'growth':
//       return 'border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700'
//     case 'cash flow':
//       return 'border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700'
//     case 'fundraising':
//       return 'border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700'
//     case 'operations':
//       return 'border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700'
//     default:
//       return 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
//   }
// }

// Removed side overlays in favor of a mask-based edge fade directly on the carousel container

// Old IntegrationCards grid removed in favor of minimalist rotating ring

function ThemeBasedDashboardImage() {
  const { theme } = useTheme()

  const getImageSrc = () => {
    switch (theme) {
      case 'dark':
        return '/images/hero/dashboard_ss_dark.png'
      case 'light':
        return '/images/hero/dashboard_ss_light.png'
      default:
        return '/images/hero/dashboard_ss_dark.png'
    }
  }

  const getImageAlt = () => {
    switch (theme) {
      case 'dark':
        return 'Midas Summary - Dark Theme'
      case 'light':
        return 'Midas Summary - Light Theme'
      case 'dark':
        return 'Midas Summary - Minimal Theme'
      default:
        return 'Midas Summary - Dark Theme'
    }
  }

  // Removed background-color gradient; using transparency mask on the image instead

  return (
    <div className="relative w-full flex justify-center items-center my-10">
      <div className="relative w-full max-w-7xl h-auto border-t-2 border-l-2 border-r-2 border-[#CF6900]/20 dark:border-amber-500/20 rounded-t-2xl overflow-hidden">
        <Image
          width={1200}
          height={1200}
          src={getImageSrc()}
          alt={getImageAlt()}
          className="w-full h-auto object-contain rounded-t-2xl"
          style={{
            WebkitMaskImage:
              'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 15%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)',
            maskImage:
              'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 15%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 100%)',
          }}
        />
      </div>
    </div>
  )
}

// Pie chart helper function for formatting currency
// const formatCurrency = (value: number) => {
//   return new Intl.NumberFormat('en-US', {
//     style: 'currency',
//     currency: 'USD',
//     minimumFractionDigits: 0,
//     maximumFractionDigits: 0,
//     notation: Math.abs(value) >= 1000000 ? 'compact' : 'standard',
//     compactDisplay: 'short',
//   }).format(value)
// }

// This is a public page that adapts based on auth state.
// Shows "Go to Dashboard" for logged-in users, "Get Started" for new users.
export default function LandingPage() {
  const { theme } = useTheme()
  const { status } = useSession()
  const isAuthenticated = status === 'authenticated'

  // Refs for scroll animations
  const securitySectionRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for scroll animations (desktop only)
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
          }
        })
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    // Observe security cards
    const securityCards = securitySectionRef.current?.querySelectorAll('.security-card')
    securityCards?.forEach((card) => observer.observe(card))

    return () => observer.disconnect()
  }, [])

  return (
    <div
      className={`min-h-screen flex flex-col relative ${ebGaramond.variable} ${dmSans.variable} ${stixTwoText.variable}`}
    >
      <main className="flex-1 relative z-20">
        {/* Hero Container with Grid Pattern */}
        <div
          className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-[98%] rounded-3xl pointer-events-none z-0 overflow-hidden border border-gray-200/20 dark:border-gray-700/30 hero-grid-container"
          style={{ height: '850px' }}
        >
          <GridPattern
            patternId="hero-grid"
            width={40}
            height={40}
            strokeDasharray="4 4"
            className="[mask-image:radial-gradient(600px_circle_at_center,white,transparent)] stroke-gray-400/20 dark:stroke-gray-600/10 hero-grid-pattern"
          />
        </div>

        {/* Hero Section */}
        <section className="pt-[104px] pb-12 sm:pt-[136px] sm:pb-16 px-4 sm:px-6 lg:px-8 relative z-10 transition-all duration-700 ease-out">
          <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
            {/* Main Headline */}
            <div className="relative mb-8 max-w-5xl">
              <h1 className="text-[56px] sm:text-7xl lg:text-8xl font-serif font-light theme-text-primary leading-[1.1] sm:leading-[1.05]">
                Turn Data <br />
                <span
                  className="text-transparent bg-clip-text italic pr-2 relative"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #E8B127 43.27%, #E17C0D 62.5%)',
                  }}
                >
                  Into Gold
                </span>
              </h1>
            </div>

            {/* Typewriter Subheadline */}
            <div className="h-[3rem] sm:h-[4rem] mb-10 flex items-center justify-center">
              <span
                className="text-base sm:text-2xl lg:text-3xl text-slate-500 dark:text-slate-400 mr-1 sm:mr-2 font-light whitespace-nowrap"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                Midas helps you
              </span>
              <Typewriter
                as="span"
                text={[
                  'scale with intelligence.',
                  'protect your runway.',
                  'make bold decisions.',
                  'sleep better at night.',
                ]}
                className="text-base sm:text-2xl lg:text-3xl text-[#DE7E00] font-medium"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
                speed={60}
                waitTime={2500}
                deleteSpeed={40}
                cursorChar="|"
              />
            </div>

            {/* CTA */}
            <div
              className="mb-16 animate-fade-in-delayed flex flex-col items-center"
              style={{ animationDelay: '0.4s' }}
            >
              <Link href={isAuthenticated ? '/dashboard' : '/sign-up'}>
                <InteractiveHoverButton
                  className="text-[20px] font-semibold px-8 py-4 pr-12"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Start 14 Day Trial'}
                </InteractiveHoverButton>
              </Link>
              {!isAuthenticated && (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  No credit card required
                </p>
              )}
            </div>

            {/* Dashboard Preview */}
            <div className="w-full animate-fade-in-delayed" style={{ animationDelay: '0.6s' }}>
              <ThemeBasedDashboardImage />
            </div>
          </div>
        </section>

        {/* do not delete the comments below */}

        {/* Midas AI Agent - 2x2 Grid Cards */}
        <MidasAIAgentSection />

        {/* Integrations */}
        <section id="integrations" className="relative">
          <IntegrationsHero showCTA showConnectButton={false} />
        </section>

        {/* Features Accordion */}
        <div id="features">
          <FeaturesAccordion />
        </div>

        {/* Security & Data Privacy Section */}
        <SecuritySection ref={securitySectionRef} />

        {/* User Reviews */}
        <section id="testimonials" className="px-4 sm:px-6 lg:px-8 py-32 max-w-7xl mx-auto">
          <TestimonialsGrid />
        </section>

        {/* CTA Section */}
        <section className="relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent" />

          {/* Decorative elements */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-30 pointer-events-none">
            <div className="absolute inset-0 rounded-full border border-amber-500/10" />
            <div className="absolute inset-12 rounded-full border border-amber-500/5" />
            <div className="absolute inset-24 rounded-full border border-amber-500/5" />
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="text-center">
              {/* Heading */}
              <h2
                className="text-[48px] theme-text-primary mb-6 leading-tight"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Ready to turn your data{' '}
                <span className="relative inline-block">
                  <span
                    className="text-transparent bg-clip-text italic px-[0.15em]"
                    style={{
                      backgroundImage:
                        theme === 'light'
                          ? 'linear-gradient(to right, #CF6900, #CF6900)'
                          : 'linear-gradient(to right, #fbbf24, #d97706)',
                    }}
                  >
                    into gold
                  </span>
                </span>
                ?
              </h2>

              {/* Subheading */}
              <p
                className="text-lg sm:text-xl theme-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                Join hundreds of businesses using Midas to gain CFO-level insights and make smarter
                financial decisions.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center justify-center gap-2.5 min-w-[210px] px-8 py-4 text-white text-[14px] font-semibold rounded-full transition-all duration-300 hover:scale-[1.02]"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    backgroundColor: theme === 'light' ? '#CF6900' : undefined,
                    backgroundImage:
                      theme === 'light' ? 'none' : 'linear-gradient(to right, #f59e0b, #d97706)',
                    boxShadow:
                      theme === 'light'
                        ? '0 20px 25px -5px rgba(207, 105, 0, 0.25)'
                        : '0 20px 25px -5px rgba(245, 158, 11, 0.25)',
                  }}
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/schedule-demo"
                  className="group inline-flex items-center justify-center gap-2.5 min-w-[210px] px-8 py-4 rounded-full border border-[var(--theme-card-border)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a',
                  }}
                >
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <span className="text-[14px] font-semibold theme-text-primary">
                    Schedule a Demo
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
