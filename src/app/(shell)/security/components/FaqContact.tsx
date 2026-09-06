'use client'

import Link from 'next/link'
import { Shield, ArrowRight } from 'lucide-react'
import { EB_Garamond } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

export default function FaqContact() {
  const { theme } = useTheme()

  return (
    <section className="relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12">
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
        <h2
          className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-6 font-light ${ebGaramond.className}`}
        >
          Get in{' '}
          <span
            className="italic bg-clip-text text-transparent px-[0.15em]"
            style={{
              backgroundImage:
                theme === 'light'
                  ? 'linear-gradient(to right, #CF6900, #CF6900)'
                  : 'linear-gradient(to right, #f59e0b, #d97706)',
            }}
          >
            Touch
          </span>
        </h2>

        <div className="space-y-4">
          <a
            href="mailto:team@midascfo.com"
            className="flex items-center gap-4 p-4 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium theme-text-primary block">
                Security Questions
              </span>
              <span className="text-xs theme-text-secondary">team@midascfo.com</span>
            </div>
            <ArrowRight
              className="w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
            />
          </a>
        </div>

        <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--theme-card-border)' }}>
          <p className="text-xs theme-text-secondary">
            Review our{' '}
            <Link href="/privacy" className="text-amber-500 hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/terms" className="text-amber-500 hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
