import { forwardRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Lock, EyeOff, Shield, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { GridPattern } from '@/components/magicui/grid-pattern'
import { brandIcons } from '@/lib/brand-icons'

const securityPartners = [
  {
    name: 'AWS',
    logo: { light: brandIcons.aws.logo.dark.svg, dark: brandIcons.aws.logo.light.svg },
  },
  {
    name: 'Vercel',
    logo: {
      light: brandIcons.vercel.logo.dark.svg,
      dark: '/images/security/vercel-logo-white.svg',
    },
  },
  {
    name: 'Stripe',
    logo: { light: brandIcons.stripe.logo.dark.svg, dark: brandIcons.stripe.logo.light.svg },
    size: 'h-7 sm:h-8',
  },
  {
    name: 'Groq',
    logo: {
      light: '/images/security/Groq Logo_Orange 25.svg',
      dark: '/images/security/Groq Logo_Orange 25.svg',
    },
  },
  {
    name: 'QuickBooks',
    logo: {
      light: '/images/security/quickbooks-brand-preferred-logo-50-50-black-external.png',
      dark: '/images/security/quickbooks-brand-preferred-logo-50-50-white-external.png',
    },
  },
  {
    name: 'Fivetran',
    logo: {
      light: '/images/security/Fivetran_idsSxu5Ooy_1.svg',
      dark: '/images/security/Fivetran_idsSxu5Ooy_1.svg',
    },
  },
]

const securityFeatures = [
  {
    icon: Lock,
    title: '256-bit Encryption',
    description: 'Every byte protected with TLS 1.3 and AES-256 encryption, end to end.',
  },
  {
    icon: EyeOff,
    title: 'Zero Data Retention',
    description: 'We analyze your data in real time — we never store or share it.',
  },
  {
    icon: Shield,
    title: 'SOC 2 Type I',
    description: 'Enterprise-grade compliance standards.',
  },
]

export const SecuritySection = forwardRef<HTMLDivElement>((_, ref) => {
  const { theme } = useTheme()
  const accent = theme === 'light' ? '#CF6900' : '#f59e0b'
  const green = theme === 'light' ? '#178e66' : '#2fbc8b'
  const cardBg = theme === 'light' ? '#FFFDFA' : '#1a1a1a'

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-24 lg:py-32 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Grid Pattern Background */}
      <GridPattern
        patternId="security-grid"
        width={40}
        height={40}
        strokeDasharray="4 4"
        className="[mask-image:radial-gradient(600px_circle_at_center,white,transparent)] stroke-gray-400/20 dark:stroke-gray-600/10"
      />

      {/* Section Header */}
      <div className="relative z-10 text-center mb-12 sm:mb-16">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
          <span
            className="text-xs font-semibold tracking-[0.2em] uppercase"
            style={{
              fontFamily: 'var(--font-dm-sans)',
              color: accent,
            }}
          >
            Security
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
        </div>
        <h2
          className="text-[48px] sm:text-[60px] theme-text-primary mb-4 font-light"
          style={{ fontFamily: 'var(--font-eb-garamond)' }}
        >
          Your Data,
          <br className="sm:hidden" />
          <span
            className="italic bg-clip-text text-transparent pl-[0.12em] pr-[0.15em]"
            style={{
              backgroundImage:
                theme === 'light'
                  ? 'linear-gradient(to right, #CF6900, #CF6900)'
                  : 'linear-gradient(to right, #f59e0b, #d97706)',
            }}
          >
            Protected
          </span>
        </h2>
        <p
          className="text-lg 2xl:text-xl theme-text-secondary max-w-lg mx-auto"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Bank-level encryption. Zero data retention. Enterprise-grade security at every step.
        </p>
      </div>

      {/* Security Features */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-14 mb-20 sm:mb-28">
        {securityFeatures.map((feature) => {
          const Icon = feature.icon

          return (
            <div
              key={feature.title}
              className="text-center rounded-xl p-6 sm:p-7"
              style={{
                backgroundColor: cardBg,
                borderColor:
                  theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <Icon className="w-6 h-6 mx-auto mb-4" strokeWidth={1.5} style={{ color: green }} />

              <h3
                className="text-sm font-semibold theme-text-primary mb-1.5"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {feature.title}
              </h3>
              <p
                className="text-xs theme-text-secondary leading-relaxed"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {feature.description}
              </p>
            </div>
          )
        })}
      </div>

      {/* Infrastructure Partners */}
      <div className="relative z-10 mb-10">
        <p
          className="text-center text-xs font-medium tracking-[0.15em] uppercase theme-text-secondary mb-5"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Built on trusted infrastructure
        </p>
        <div
          className="relative w-full overflow-hidden py-4"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          }}
        >
          <div className="flex security-marquee" style={{ width: 'max-content' }}>
            {[...securityPartners, ...securityPartners].map((partner, i) => (
              <div
                key={`${partner.name}-${i}`}
                className="flex-shrink-0 mx-8 sm:mx-10 flex items-center"
              >
                <img
                  src={theme === 'light' ? partner.logo.light : partner.logo.dark}
                  alt={partner.name}
                  className={`${'size' in partner && partner.size ? partner.size : 'h-5 sm:h-6'} max-w-[100px] object-contain`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Learn More Link */}
      <div className="relative z-10 text-center">
        <Link
          href="/security"
          className="group inline-flex items-center gap-2 transition-colors hover:opacity-80"
          style={{
            fontFamily: 'var(--font-dm-sans)',
            color: accent,
          }}
        >
          <span className="text-sm font-medium">Learn more about our security</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Marquee Animation */}
      <style jsx>{`
        @keyframes security-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .security-marquee {
          animation: security-marquee 25s linear infinite;
        }
        .security-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  )
})

SecuritySection.displayName = 'SecuritySection'
