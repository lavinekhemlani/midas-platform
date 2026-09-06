// src/app/(main)/components/WelcomeOverlay.tsx
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { EB_Garamond } from 'next/font/google'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400'],
})

// ─── Platform tips that help users discover Midas features ───────────────────
const platformTips = [
  // AI Chat & Agent
  'Ask Midas anything — "What\'s my cash runway?" or "Show me revenue trends"',
  'Midas can generate charts, tables, and KPIs right inside the chat',
  'Compare periods naturally — try "Compare this quarter vs last quarter"',
  'Tell Midas about upcoming expenses or goals for smarter forecasts',
  'Ask "What\'s my financial health?" for a score across your key metrics',
  'Try "What anomalies do you see in my expenses?" for AI spike detection',
  'Midas can model scenarios — ask "What if revenue drops 20%?"',
  'Ask Midas to look up any invoice or bill by number or vendor name',
  'Midas remembers your business context across conversations',
  'Ask for industry benchmarks — Midas can search the web for comparisons',
  'Track stock prices in real time — just ask for any ticker symbol',
  'Midas calculates burn rate, runway, and break-even automatically',

  // Reports & Analytics
  'Click any card on the Summary dashboard to jump to that report',
  'P&L, Balance Sheet, and Cash Flow each have their own dedicated pages',
  'Export any report as PDF or CSV using the export buttons',
  'Use custom date ranges to analyze any specific time period',
  'Financial ratios like Current Ratio and Quick Ratio are calculated automatically',
  "The Summary dashboard gives you a bird's-eye view of your entire business",
  'Cash runway shows how many months of operations your cash can cover',
  'Efficiency metrics track DSO, DPO, and your cash conversion cycle',

  // Platform Features
  'Toggle between dark and light mode with the icon in the top bar',
  'Pin the sidebar open to keep navigation visible while you work',
  'Enable PII Protection in Settings to blur sensitive data during demos',
  'Set your financial proficiency level in Settings to tailor AI insights',
  'Connect multiple accounting providers and switch between them anytime',
  'Your currency is automatically detected from your accounting provider',
  'Check the notification bell for financial alerts and threshold warnings',
  'Customize your Financial Health Score by choosing the metrics that matter most',
  'The top bar breadcrumbs let you quickly navigate between sections',

  // QuickBooks Features
  'Sales analytics reveal customer concentration — see if revenue is too dependent on one client',
  'The Forecasting page offers 13-week and 6-month cash projections',
  'Journal entries include automatic debit and credit balance verification',
  'Aged receivables show which invoices are overdue and by how many days',
  'View bills by aging bucket to prioritize vendor payments',

  // Business Central Features
  'Track inventory value, turnover, and slow-moving items in the Inventory section',
  'Customer credit risk scoring helps identify accounts at risk',
  'Vendor payment risk analysis highlights overdue and high-risk suppliers',
  'Cash flow is broken down by operating, investing, and financing activities',
  'Sales by salesperson shows your top revenue contributors',

  // Shopify Features
  'Shopify sales, orders, and marketing attribution are tracked with daily sparklines',
  'Marketing KPIs show session-attributed sales, orders, and conversion rate',
  'Hover over any Shopify KPI to see the formula and how the number is calculated',
  'Track inventory across all Shopify locations — available, committed, and incoming units',
  'Abandoned checkout recovery rate shows how many lost carts were converted into orders',
  'Shopify customer insights include returning rate, avg spend, and email subscribers',
  'Refund tracking separates full vs partial refunds with restocking details',
  'Product catalog shows active, draft, and archived products with variant counts',
  'Shopify disputes dashboard tracks needs-response, won, and lost cases',
  'Draft orders show your sales pipeline value before invoices are finalized',

  // Multi-Entity & Cross-Integration
  'Connect QuickBooks, Business Central, and Shopify — each gets its own dashboard',
  "Midas works across every integration you connect — ask about any provider's data",
  'Switch between connected companies from the top bar without losing context',
  'Run multiple Business Central entities under one account with separate schemas',
  'Multi-entity consolidation gives you a unified view across subsidiaries and portfolios',
  'Navigate between providers instantly — the sidebar adapts to your connected integrations',
  'Each connected entity has its own reports, analytics, and AI-powered insights',
]

/** Fisher-Yates shuffle — returns a new array */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

interface WelcomeOverlayProps {
  firstName?: string
  /** The provider being connected to (e.g. "Business Central", "QuickBooks") */
  provider?: string
  /** Callback when the welcome sequence completes and chat should open */
  onOpenChat?: () => void
  /** Callback when the overlay is fully dismissed */
  onComplete?: () => void
  /** Whether data is still loading - overlay stays visible until loading completes */
  isLoading?: boolean
  /** Left offset to account for sidebar */
  leftOffset?: number
  /** Right offset to account for chat panel */
  rightOffset?: number
  /** Whether chat panel is transitioning (for smooth animation) */
  isTransitioning?: boolean
  /** Whether on mobile viewport - skips auto-opening chat */
  isMobile?: boolean
}

export function WelcomeOverlay({
  firstName,
  provider,
  onOpenChat,
  onComplete,
  isLoading = false,
  leftOffset = 0,
  rightOffset = 0,
  isTransitioning = false,
  isMobile = false,
}: WelcomeOverlayProps) {
  const [phase, setPhase] = useState<'logo' | 'midas' | 'welcome' | 'chat' | 'ready' | 'done'>(
    'logo'
  )
  const [animationComplete, setAnimationComplete] = useState(false)
  const hasCalledComplete = useRef(false)
  const [tipIndex, setTipIndex] = useState(0)

  // Shuffle tips once on mount so each session feels fresh
  const shuffledTips = useMemo(() => shuffleArray(platformTips), [])

  // Cycle tips every 6 seconds once they're visible (from welcome phase onward)
  useEffect(() => {
    const tipsVisible = phase === 'welcome' || phase === 'chat' || phase === 'ready'
    if (!tipsVisible) return
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % shuffledTips.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [phase, shuffledTips.length])

  // Animation sequence
  useEffect(() => {
    // Phase 1: Logo appears (immediate)
    // Phase 2: "Midas" slides out after 600ms
    const midasTimer = setTimeout(() => setPhase('midas'), 600)

    // Phase 3: Welcome text after 1400ms
    const welcomeTimer = setTimeout(() => setPhase('welcome'), 1400)

    // Phase 4: Open chat after 1.5 seconds from welcome (2900ms total)
    // Skip auto-opening chat on mobile - users have bottom nav bar instead
    const chatTimer = setTimeout(() => {
      setPhase('chat')
      if (!isMobile) {
        onOpenChat?.()
      }
    }, 2900)

    // Phase 5: Animation sequence complete, ready to fade when loading done (4500ms total)
    const readyTimer = setTimeout(() => {
      setAnimationComplete(true)
      setPhase('ready')
    }, 4500)

    return () => {
      clearTimeout(midasTimer)
      clearTimeout(welcomeTimer)
      clearTimeout(chatTimer)
      clearTimeout(readyTimer)
    }
  }, [onOpenChat, isMobile])

  // Safety timeout: auto-dismiss if loading never completes (e.g. page doesn't signal WelcomeContext)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasCalledComplete.current) {
        hasCalledComplete.current = true
        setPhase('done')
        onComplete?.()
      }
    }, 8000)
    return () => clearTimeout(timeout)
  }, [onComplete])

  // Fade out when both animation is complete AND loading is done
  useEffect(() => {
    if (animationComplete && !isLoading && phase === 'ready' && !hasCalledComplete.current) {
      hasCalledComplete.current = true
      setPhase('done')
      onComplete?.()
    }
  }, [animationComplete, isLoading, phase, onComplete])

  const isVisible = phase !== 'done'

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{
            pointerEvents: 'none',
            left: leftOffset,
            right: rightOffset,
            transition: `
              left 300ms cubic-bezier(0.4, 0, 0.2, 1),
              right ${isTransitioning ? '300ms' : '0ms'} ease-out
            `,
          }}
        >
          <div className="text-center px-6">
            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="flex-shrink-0"
              >
                <Image
                  src="/images/hero/logo_type_gold_new.svg"
                  alt="Midas"
                  width={204}
                  height={56}
                  className="object-contain"
                  priority
                />
              </motion.div>
            </div>

            {/* Welcome message - fades in and stays visible */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: phase === 'welcome' || phase === 'chat' || phase === 'ready' ? 1 : 0,
                y: phase === 'welcome' || phase === 'chat' || phase === 'ready' ? 0 : 10,
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <p
                className={`text-2xl md:text-3xl theme-text-secondary ${ebGaramond.className}`}
                style={{ fontWeight: 300 }}
              >
                Welcome{firstName ? `, ${firstName}` : ' back'}
              </p>
            </motion.div>

            {/* Provider connection + rotating tips — fades in right after welcome name */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{
                opacity: phase === 'welcome' || phase === 'chat' || phase === 'ready' ? 1 : 0,
              }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.8 }}
              className="mt-12"
            >
              {/* Progress bar */}
              <div className="mt-6 w-36 h-0.5 mx-auto bg-gray-300/20 dark:bg-gray-600/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: '100%',
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.6) 50%, transparent 100%)',
                  }}
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              </div>

              {/* Rotating tips */}
              <div className="mt-14 max-w-lg mx-auto">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-500/80 font-semibold mb-4">
                  Did you know?
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={tipIndex}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="text-[0.935rem] leading-relaxed theme-text-secondary min-h-[3rem]"
                  >
                    {shuffledTips[tipIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
