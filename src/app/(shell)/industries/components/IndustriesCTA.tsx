'use client'

import { ArrowRight, Calendar } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import Link from 'next/link'
import Image from 'next/image'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const trustedBy = [
  { name: 'QuickBooks', logo: 'https://cdn.simpleicons.org/quickbooks' },
  { name: 'Stripe', logo: 'https://cdn.simpleicons.org/stripe' },
  { name: 'Shopify', logo: 'https://cdn.simpleicons.org/shopify' },
  { name: 'Xero', logo: 'https://cdn.simpleicons.org/xero' },
]

export default function IndustriesCTA() {
  const { theme } = useTheme()
  return (
    <section
      className={`relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent" />

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 rounded-full border border-amber-500/10" />
        <div className="absolute inset-12 rounded-full border border-amber-500/5" />
        <div className="absolute inset-24 rounded-full border border-amber-500/5" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* CTA Content */}
        <div className="text-center">
          {/* Heading */}
          <h2
            className="text-[48px] theme-text-primary mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
          >
            Ready to transform your{' '}
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
                financial operations
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

          {/* Trust section */}
          <div className="pt-10 border-t border-[var(--theme-card-border)]">
            <p
              className="text-xs theme-text-secondary uppercase tracking-[0.2em] mb-6"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Integrates with your favorite tools
            </p>
            <div className="flex items-center justify-center gap-8 sm:gap-12">
              {trustedBy.map((company) => (
                <div
                  key={company.name}
                  className="opacity-40 hover:opacity-70 transition-opacity duration-300"
                >
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="h-6 sm:h-7 w-auto grayscale dark:invert"
                    loading="lazy"
                  />
                </div>
              ))}
              <span
                className="text-sm theme-text-secondary opacity-50"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                ... plus more
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
