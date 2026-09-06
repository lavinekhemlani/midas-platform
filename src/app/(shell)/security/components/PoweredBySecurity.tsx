'use client'

import { ExternalLink } from 'lucide-react'
import { brandIcons } from '@/lib/brand-icons'
import { useTheme } from '@/hooks/useTheme'
import { EB_Garamond, DM_Sans } from 'next/font/google'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

const partners = [
  {
    name: 'AWS',
    logo: brandIcons.aws.logo.dark.svg,
    logoDark: '/images/security/PikPng.com_run-dmc-png_5240809 (1).png',
    tagline: 'Where your data lives',
    features: [
      'Your data is stored in its own encrypted environment, isolated from other customers',
      'Our team has no direct access to your raw financial data',
      'Automatic redundancy ensures nothing is ever lost',
    ],
    link: 'https://aws.amazon.com/security/',
  },
  {
    name: 'Vercel',
    logo: brandIcons.vercel.logo.dark.svg,
    logoDark: '/images/security/vercel-logo-white.svg',
    logoSize: 'h-5 sm:h-6',
    tagline: 'How we deliver to you',
    features: [
      'All traffic between you and Midas is encrypted by default',
      'Built-in threat protection blocks attacks before they reach you',
      'Loads from the nearest global edge for speed without compromising security',
    ],
    link: 'https://vercel.com/security',
  },
  {
    name: 'Stripe',
    logo: brandIcons.stripe.logo.dark.svg,
    tagline: 'How payments work',
    features: [
      'Your payment details go directly to Stripe — they never reach our servers',
      'Processed to the same standard required of banks',
      'Suspicious activity is flagged and blocked in real time',
    ],
    link: 'https://stripe.com/docs/security',
  },
  {
    name: 'Groq',
    logo: '/images/security/Groq Logo_Orange 25.svg',
    logoSize: 'h-6 sm:h-7',
    tagline: 'Powers our AI insights',
    features: [
      'Only the context needed to generate your answer is ever shared',
      'Data is processed once and discarded immediately after',
      'Groq is prohibited from retaining or learning from your data',
    ],
    link: 'https://groq.com/privacy-policy/',
  },
  {
    name: 'QuickBooks',
    logo: '/images/security/quickbooks-brand-preferred-logo-50-50-black-external.png',
    logoDark: '/images/security/quickbooks-brand-preferred-logo-50-50-white-external.png',
    tagline: 'Your accounting source',
    features: [
      'Midas has read-only access — your books can never be modified',
      'Your credentials stay with Intuit and are never shared with us',
      'Access can be revoked at any time with a single click',
    ],
    link: 'https://security.intuit.com/',
  },
  {
    name: 'Fivetran',
    logo: '/images/security/Fivetran_idsSxu5Ooy_1.svg',
    tagline: 'Secure data pipelines',
    features: [
      'All data is encrypted throughout the entire transfer',
      'Infrastructure is independently audited to SOC 2 Type II standards',
      'No data is retained once the sync is complete',
    ],
    link: 'https://www.fivetran.com/trust-security',
  },
]

export default function PoweredBySecurity() {
  const { theme } = useTheme()

  return (
    <section className="relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
            <span
              className="text-xs font-semibold tracking-[0.2em] uppercase"
              style={{
                fontFamily: 'var(--font-dm-sans)',
                color: theme === 'light' ? '#CF6900' : '#f59e0b',
              }}
            >
              Infrastructure
            </span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
          </div>
          <h2
            className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-4 font-light ${ebGaramond.className}`}
          >
            Security You Can
            <span
              className="italic bg-clip-text text-transparent pl-[0.18em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #f59e0b, #d97706)',
              }}
            >
              Trust
            </span>
          </h2>
          <p
            className="text-lg theme-text-secondary max-w-2xl mx-auto"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
          >
            Built on industry-leading infrastructure with proven security track records.
          </p>
        </div>

        {/* Mobile: Horizontal scroll, Desktop: 1x6 grid */}
        <div
          className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-6 2xl:gap-6"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {partners.map((partner, i) => (
            <a
              key={i}
              href={partner.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col rounded-lg border overflow-hidden transition-all duration-300 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] flex-shrink-0 w-[280px] sm:w-auto snap-center border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]"
            >
              {/* Logo area */}
              <div
                className="p-4 sm:p-5 2xl:p-6 flex items-center justify-center h-20 sm:aspect-square border-b"
                style={{
                  borderColor:
                    theme === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: theme === 'light' ? '#FAF8F5' : undefined,
                }}
              >
                <img
                  src={theme === 'dark' && partner.logoDark ? partner.logoDark : partner.logo}
                  alt={partner.name}
                  className={`${partner.logoSize || 'h-8 sm:h-10'} max-w-[75%] object-contain opacity-80 group-hover:opacity-100 transition-opacity`}
                />
              </div>

              {/* Tagline & Features */}
              <div
                className="flex-1 p-4 sm:p-5 2xl:p-6"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#262626' }}
              >
                <p
                  className={`text-[14px] font-medium mb-2 sm:mb-3 ${dmSans.className}`}
                  style={{ color: theme === 'light' ? '#d97706' : '#f59e0b' }}
                >
                  {partner.tagline}
                </p>
                <ul className="space-y-1.5 sm:space-y-2">
                  {partner.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-amber-500/60 mt-2 flex-shrink-0" />
                      <span
                        className={`text-[14px] theme-text-secondary leading-relaxed ${dmSans.className}`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Link indicator */}
              <div
                className="p-4 pt-0 flex items-center justify-end"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#262626' }}
              >
                <ExternalLink
                  className="w-3.5 h-3.5 theme-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  strokeWidth={1.5}
                />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
