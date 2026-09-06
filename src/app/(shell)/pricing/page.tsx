'use client'

import { Check } from 'lucide-react'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

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
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

const tiers = [
  {
    name: 'FREE',
    price: '$0',
    period: '',
    description: 'Get started with essential features to explore Midas.',
    cta: 'Get Started',
    ctaVariant: 'outline' as const,
    popular: false,
    features: ['Token Usage Limit', '1 Integration', 'Agentic Analysis', 'Downloadable Reports'],
  },
  {
    name: 'GROWTH',
    price: '$99',
    period: '/mo',
    description: 'For growing teams needing deeper insights & more connections.',
    cta: 'Start Free Trial',
    ctaVariant: 'primary' as const,
    popular: true,
    features: [
      'Everything in Free',
      '2 Integrations',
      'Once a Month CFO Call',
      '24/7 Slack Support',
      'White Glove Onboarding',
    ],
  },
  {
    name: 'SCALE',
    price: '$299',
    period: '/mo',
    description: 'For scaling companies with complex multi-platform operations.',
    cta: 'Start Free Trial',
    ctaVariant: 'default' as const,
    popular: false,
    features: [
      'Everything in Growth',
      '3 Integrations',
      'Once a Week CFO Call',
      'Unlimited Token Usage',
      'Unlimited Users',
      'Multi-Entity Support',
      'Dedicated Customer Success Manager',
    ],
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    period: '',
    description: 'For organizations requiring dedicated support & compliance.',
    cta: 'Contact Us',
    ctaVariant: 'outline' as const,
    popular: false,
    features: [
      'Everything in Scale',
      'Unlimited Integrations',
      'On-Prem Options for Data',
      'Custom SSO & API',
      'Custom SLA',
      'Compliance',
    ],
  },
]

export default function PricingPage() {
  const { theme } = useTheme()

  return (
    <div
      className={`min-h-screen flex flex-col relative ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <main className="flex-1 relative z-20">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-16 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            {/* Headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-light theme-text-primary mb-4"
              style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
            >
              CFO-Level Insights,{' '}
              <span
                className="italic text-transparent bg-clip-text px-[0.15em]"
                style={{
                  backgroundImage:
                    theme === 'light'
                      ? 'linear-gradient(to right, #CF6900, #CF6900)'
                      : 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)',
                }}
              >
                Startup-Friendly Pricing
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-lg sm:text-xl theme-text-secondary max-w-2xl mx-auto"
              style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
            >
              Get the financial clarity you need to extend runway and grow with confidence.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    'relative rounded-2xl p-6 flex flex-col transition-all duration-300',
                    'border bg-[var(--theme-card-bg)] backdrop-blur-sm',
                    tier.popular
                      ? 'border-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'border-[var(--theme-card-border)] hover:border-amber-500/30'
                  )}
                >
                  {/* Popular Badge */}
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-slate-900">
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  {/* Tier Header */}
                  <div className="mb-6">
                    <h3
                      className="text-sm font-semibold tracking-wider theme-text-secondary mb-3"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {tier.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-4xl sm:text-5xl font-bold theme-text-primary"
                        style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 700 }}
                      >
                        {tier.price}
                      </span>
                      <span className="text-base theme-text-secondary">{tier.period}</span>
                    </div>
                    <p
                      className="mt-3 text-sm theme-text-secondary leading-relaxed"
                      style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
                    >
                      {tier.description}
                    </p>
                  </div>

                  {/* CTA Button */}
                  <Link
                    href={tier.cta === 'Contact Sales' ? '/schedule-demo' : '/sign-up'}
                    className={cn(
                      'w-full py-3 px-4 rounded-full text-sm font-semibold text-center transition-all duration-200',
                      tier.ctaVariant === 'primary'
                        ? 'bg-amber-500 text-slate-900 hover:bg-amber-400'
                        : tier.ctaVariant === 'default'
                          ? 'bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'
                          : 'border border-[var(--theme-card-border)] theme-text-primary hover:border-amber-500/50 hover:bg-amber-500/5'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {tier.cta}
                  </Link>

                  {/* Features List */}
                  <ul className="mt-6 space-y-3 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check
                          className={cn(
                            'w-4 h-4 mt-0.5 flex-shrink-0',
                            tier.popular ? 'text-amber-500' : 'text-emerald-500'
                          )}
                          strokeWidth={2.5}
                        />
                        <span
                          className="text-sm theme-text-secondary"
                          style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
