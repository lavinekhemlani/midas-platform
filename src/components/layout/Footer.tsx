'use client'

import Link from 'next/link'
import Image from 'next/image'
import { EB_Garamond, DM_Sans } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

export default function Footer() {
  const { theme } = useTheme()

  const lineStyle = {
    borderTop: `0.25px solid ${theme === 'light' ? 'rgba(207, 105, 0, 0.4)' : 'rgba(217, 119, 6, 0.4)'}`,
  }

  const textColor = theme === 'light' ? '#1a1a1a' : '#e5e5e5'

  return (
    <footer
      className="relative z-[39]"
      style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
    >
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start pt-[60px] px-8 pb-[60px] gap-8 md:gap-0">
        {/* Platform Column */}
        <div>
          <h4
            className={`mb-3 text-[20px] font-normal leading-[30px] ${dmSans.className}`}
            style={{ color: textColor }}
          >
            Platform
          </h4>
          <div className="w-8 h-px bg-amber-500/40 mb-4" />
          <ul className="space-y-2">
            <li>
              <Link
                href="/platform#financial-health"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Financial Health & Planning
              </Link>
            </li>
            <li>
              <Link
                href="/platform#banking"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Banking & Payments
              </Link>
            </li>
            <li>
              <Link
                href="/platform#gtm"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Go-to-Market & Customer
              </Link>
            </li>
            <li>
              <Link
                href="/platform#operations"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Operations, Inventory & ERP
              </Link>
            </li>
            <li>
              <Link
                href="/platform#multi-entity"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Multi-Entity Analysis
              </Link>
            </li>
          </ul>
        </div>

        {/* Industries Column */}
        <div>
          <h4
            className={`mb-3 text-[20px] font-normal leading-[30px] ${dmSans.className}`}
            style={{ color: textColor }}
          >
            Industries
          </h4>
          <div className="w-8 h-px bg-amber-500/40 mb-4" />
          <ul className="space-y-2">
            <li>
              <Link
                href="/industries#ecommerce"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                E-Commerce
              </Link>
            </li>
            <li>
              <Link
                href="/industries#services"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Professional Services
              </Link>
            </li>
            <li>
              <Link
                href="/industries#pe-multi-entity"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                PE & Multi-Entity
              </Link>
            </li>
            <li>
              <Link
                href="/industries#saas"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                SaaS
              </Link>
            </li>
            <li>
              <Link
                href="/industries#middle-market"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Middle-Market
              </Link>
            </li>
            <li>
              <Link
                href="/industries#sme"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                SME
              </Link>
            </li>
          </ul>
        </div>

        {/* Company Column */}
        <div>
          <h4
            className={`mb-3 text-[20px] font-normal leading-[30px] ${dmSans.className}`}
            style={{ color: textColor }}
          >
            Company
          </h4>
          <div className="w-8 h-px bg-amber-500/40 mb-4" />
          <ul className="space-y-2">
            <li>
              <Link
                href="/security"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Security
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors ${dmSans.className}`}
                style={{ color: textColor }}
              >
                Privacy
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact Us Column */}
        <div>
          <h4
            className={`mb-3 text-[20px] font-normal leading-[30px] ${dmSans.className}`}
            style={{ color: textColor }}
          >
            Contact Us
          </h4>
          <div className="w-8 h-px bg-amber-500/40 mb-4" />
          <ul className="space-y-2">
            <li>
              <a
                href="mailto:team@midascfo.com"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors flex items-center gap-2 ${dmSans.className}`}
                style={{ color: textColor }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                team@midascfo.com
              </a>
            </li>
            <li>
              <a
                href="tel:+919810911001"
                className={`text-[16px] font-[300] hover:text-amber-500 transition-colors flex items-center gap-2 ${dmSans.className}`}
                style={{ color: textColor }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                +919810911001
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-6 pb-[36px] flex items-center justify-center gap-2">
        <span className="text-xs" style={{ color: textColor }}>
          © 2025 All right reserved by
        </span>
        <Image
          src="/images/hero/logo_type_gold_new.svg"
          alt="Midas"
          width={80}
          height={20}
          className="object-contain"
        />
      </div>
    </footer>
  )
}
