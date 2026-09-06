'use client'

import Cal, { getCalApi } from '@calcom/embed-react'
import { useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { EB_Garamond, DM_Sans, STIX_Two_Text } from 'next/font/google'
import { Clock, Video, Mail, ArrowRight } from 'lucide-react'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
})

const stixTwoText = STIX_Two_Text({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-stix-two-text',
})

const CAL_USERNAME = 'midas-cfo'
const CAL_EVENT_SLUG = 'product-demo'

export default function ScheduleDemoPage() {
  const { theme } = useTheme()

  useEffect(() => {
    ;(async function () {
      const cal = await getCalApi({ namespace: 'product-demo' })
      const isDark = theme === 'dark'

      cal('ui', {
        theme: isDark ? 'dark' : 'light',
        hideEventTypeDetails: true,
        layout: 'WEEK_VIEW',
        cssVarsPerTheme: {
          dark: {
            'cal-brand': '#f59e0b',
            'cal-bg': '#0a0a0a',
            'cal-text': '#ffffff',
            'cal-text-emphasis': '#ffffff',
            'cal-text-muted': 'rgba(255,255,255,0.6)',
            'cal-border': 'rgba(255,255,255,0.1)',
          },
          light: {
            'cal-brand': '#f59e0b',
            'cal-bg': '#ffffff',
            'cal-text': '#1a1a1a',
            'cal-text-emphasis': '#000000',
            'cal-text-muted': 'rgba(0,0,0,0.6)',
            'cal-border': 'rgba(0,0,0,0.1)',
          },
        },
      })
    })()
  }, [theme])

  return (
    <div className="max-w-5xl mx-auto px-5 pb-16">
      <h1
        className={`text-[48px] theme-text-primary mb-4 font-light text-center leading-tight ${ebGaramond.className}`}
      >
        See{' '}
        <span
          className="text-transparent bg-clip-text italic px-[0.15em]"
          style={{
            backgroundImage:
              theme === 'light'
                ? 'linear-gradient(to right, #CF6900, #CF6900)'
                : 'linear-gradient(to right, #fbbf24, #d97706)',
          }}
        >
          Midas
        </span>{' '}
        in Action
      </h1>

      <p
        className={`text-[16px] theme-text-secondary mb-6 leading-relaxed text-center max-w-2xl mx-auto ${dmSans.className}`}
      >
        Get a personalized demonstration of how Midas can transform your financial operations with
        AI-driven insights.
      </p>

      <div className={`flex items-center justify-center gap-4 mb-8 ${dmSans.className}`}>
        <div className="flex items-center gap-2 text-sm theme-text-secondary">
          <Clock
            className="w-4 h-4"
            strokeWidth={1.5}
            style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
          />
          <span>45 minutes</span>
        </div>
        <span className="theme-text-muted">·</span>
        <div className="flex items-center gap-2 text-sm theme-text-secondary">
          <Video
            className="w-4 h-4"
            strokeWidth={1.5}
            style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
          />
          <span>Video call</span>
        </div>
      </div>

      <Cal
        namespace="product-demo"
        calLink={`${CAL_USERNAME}/${CAL_EVENT_SLUG}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        config={{ layout: 'WEEK_VIEW' }}
      />

      {/* Email CTA */}
      <div className={`mt-6 text-center ${dmSans.className}`}>
        <p className="text-sm theme-text-secondary mb-4">Prefer to reach out directly?</p>
        <a
          href="mailto:team@midascfo.com"
          className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-full border border-[var(--theme-card-border)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300"
          style={{
            fontFamily: 'var(--font-dm-sans)',
            backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a',
          }}
        >
          <Mail className="w-5 h-5" style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }} />
          <span className="text-[14px] font-semibold theme-text-primary">team@midascfo.com</span>
          <ArrowRight
            className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: theme === 'light' ? '#CF6900' : '#f59e0b' }}
          />
        </a>
      </div>
    </div>
  )
}
