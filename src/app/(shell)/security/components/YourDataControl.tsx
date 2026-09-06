'use client'

import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'
import { EB_Garamond } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

export default function YourDataControl() {
  const { theme } = useTheme()

  return (
    <section
      className={`relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12 ${ebGaramond.variable}`}
    >
      <div className="max-w-4xl 2xl:max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className="text-[48px] theme-text-primary mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
          >
            Your{' '}
            <span
              className="text-transparent bg-clip-text italic pl-[0.05em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #fbbf24, #d97706)',
              }}
            >
              Data
            </span>
            , Your
            <span
              className="text-transparent bg-clip-text italic pl-[0.18em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #fbbf24, #d97706)',
              }}
            >
              Control
            </span>
          </h2>
          <p
            className="text-lg sm:text-xl theme-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
          >
            Complete transparency and control over your financial data, backed by GDPR and CCPA
            compliance.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
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
            <span className="text-[14px] font-semibold theme-text-primary">Schedule a Demo</span>
          </Link>
        </div>

        {/* Separator */}
        <div className="border-t" style={{ borderColor: 'var(--theme-card-border)' }} />

        {/* Privacy links */}
        <div className="pt-6 text-center">
          <p className="text-xs theme-text-secondary">
            Review our{' '}
            <Link
              href="/privacy"
              className="hover:underline"
              style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
            >
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link
              href="/terms"
              className="hover:underline"
              style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
            >
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
