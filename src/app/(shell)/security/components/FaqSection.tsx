'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EB_Garamond } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

const faqs = [
  {
    q: 'How do you protect my financial data?',
    a: 'We use multiple layers of protection: TLS 1.3 encryption for all data in transit, AES-256 encryption at rest via AWS KMS, OAuth 2.0 for secure authentication, and comprehensive audit logging.',
  },
  {
    q: 'Can Midas employees see my financial data?',
    a: 'Access to customer data is strictly limited and logged. Only authorized personnel can access data for support purposes, and all access is audited.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'When you close your account, we delete your personal data and financial information. You can request a data export before closing your account.',
  },
  {
    q: 'Is my data shared with AI providers?',
    a: 'Minimal financial context is sent to our AI partner (Groq) to generate responses. Groq is SOC 2 Type II certified and prohibited from using your data to train models.',
  },
]

export default function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const { theme } = useTheme()

  return (
    <section className="relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12">
      <div className="max-w-6xl mx-auto">
        <h2
          className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-10 font-light overflow-visible ${ebGaramond.className}`}
        >
          Common
          <br className="sm:hidden" />{' '}
          <span
            className="italic bg-clip-text text-transparent pl-[0.05em] sm:pl-[0.18em] pr-[0.15em]"
            style={{
              backgroundImage:
                theme === 'light'
                  ? 'linear-gradient(to right, #CF6900, #CF6900)'
                  : 'linear-gradient(to right, #f59e0b, #d97706)',
            }}
          >
            Questions
          </span>
        </h2>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-lg overflow-hidden border border-transparent hover:border-amber-500/20 transition-colors"
              style={{ background: theme === 'light' ? '#FFFDFA' : 'var(--theme-glass-bg)' }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between px-4 py-5 text-left"
              >
                <span className="text-sm font-medium theme-text-primary pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 theme-text-secondary flex-shrink-0 transition-transform duration-200 ${openFaq === index ? 'rotate-180' : ''}`}
                  strokeWidth={1.5}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${openFaq === index ? 'max-h-48' : 'max-h-0'}`}
              >
                <p className="px-4 pb-4 text-sm theme-text-secondary leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
