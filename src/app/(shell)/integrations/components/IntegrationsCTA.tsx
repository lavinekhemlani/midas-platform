'use client'

import { ArrowRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import Link from 'next/link'

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

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const stats = [
  { value: '100+', label: 'Integrations', description: 'Ready to connect' },
  { value: '< 5 min', label: 'Setup Time', description: 'Quick deployment' },
  { value: '99.9%', label: 'Uptime SLA', description: 'Enterprise-grade' },
]

export default function IntegrationsCTA() {
  const { theme } = useTheme()

  return (
    <section
      className={`py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-5xl mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center p-6 rounded-2xl theme-bg-secondary/50 relative overflow-hidden group"
            >
              {/* Decorative gradient */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    theme === 'light'
                      ? 'radial-gradient(circle at center, rgba(207, 105, 0, 0.05) 0%, transparent 70%)'
                      : 'radial-gradient(circle at center, rgba(245, 158, 11, 0.05) 0%, transparent 70%)',
                }}
              />

              <div className="relative">
                <div
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-2 tracking-tight"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    color: theme === 'light' ? '#CF6900' : '#f59e0b',
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-base font-medium theme-text-primary mb-1"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {stat.label}
                </div>
                <div
                  className="text-sm theme-text-secondary"
                  style={{ fontFamily: 'var(--font-stix-two-text)' }}
                >
                  {stat.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Content */}
        <div className="text-center">
          <h2
            className="text-[48px] theme-text-primary mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
          >
            Don&apos;t see your
            <span
              className="italic bg-clip-text text-transparent pl-[0.12em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(135deg, #CF6900, #ea580c)'
                    : 'linear-gradient(135deg, #f59e0b, #fbbf24)',
              }}
            >
              integration
            </span>
            ?
          </h2>
          <p
            className="text-lg sm:text-xl theme-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
          >
            We&apos;re constantly expanding our ecosystem. Let us know what you need and we&apos;ll
            prioritize it for you.
          </p>

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
              className="inline-flex items-center justify-center min-w-[210px] px-8 py-4 rounded-full border border-[var(--theme-card-border)] hover:border-amber-500/30 hover:bg-amber-500/5 text-[14px] font-semibold theme-text-primary transition-all duration-300"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a',
              }}
            >
              Request Integration
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
