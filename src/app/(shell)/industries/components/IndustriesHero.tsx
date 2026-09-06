'use client'

import { useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import Image from 'next/image'
import {
  ShoppingCart,
  Briefcase,
  Building,
  LineChart,
  TrendingUp,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { AnimatedBeam } from '@/components/magicui/animated-beam'

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

// Tree: Midas at top, 6 children in 3 symmetric tiers
// Outer pair (highest), middle pair, inner pair (lowest)
const industries: Array<{
  id: string
  name: string
  Icon: LucideIcon
  x: number // % horizontal position
  y: number // % vertical position
  junctionY: number // fraction of container height where the bezier inflects
  xOffset: number // px offset from Midas center to spread paths
  iconColor: { light: string; dark: string }
}> = [
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    Icon: ShoppingCart,
    x: 85,
    y: 38,
    junctionY: 0.24,
    xOffset: 10,
    iconColor: { light: '#0d9488', dark: '#2dd4bf' },
  },
  {
    id: 'services',
    name: 'Prof. Services',
    Icon: Briefcase,
    x: 72,
    y: 56,
    junctionY: 0.33,
    xOffset: 6,
    iconColor: { light: '#4f46e5', dark: '#818cf8' },
  },
  {
    id: 'pe',
    name: 'PE & Multi-Entity',
    Icon: Building,
    x: 59,
    y: 74,
    junctionY: 0.42,
    xOffset: 2,
    iconColor: { light: '#be185d', dark: '#f472b6' },
  },
  {
    id: 'saas',
    name: 'SaaS',
    Icon: LineChart,
    x: 41,
    y: 74,
    junctionY: 0.42,
    xOffset: -2,
    iconColor: { light: '#7c3aed', dark: '#a78bfa' },
  },
  {
    id: 'middle-market',
    name: 'Middle-Market',
    Icon: Building,
    x: 28,
    y: 56,
    junctionY: 0.33,
    xOffset: -6,
    iconColor: { light: '#059669', dark: '#34d399' },
  },
  {
    id: 'sme',
    name: 'SME',
    Icon: TrendingUp,
    x: 15,
    y: 38,
    junctionY: 0.24,
    xOffset: -10,
    iconColor: { light: '#d97706', dark: '#fbbf24' },
  },
]

const metrics = [
  { value: '40%', label: 'Faster Reporting', description: 'Close books in days, not weeks' },
  { value: '8+', label: 'Hours Saved Weekly', description: 'Automate manual finance tasks' },
  { value: '360°', label: 'Financial Visibility', description: 'See your complete picture' },
]

const midasX = 50 // %
const midasY = 10 // %

export default function IndustriesHero() {
  const { theme } = useTheme()

  const containerRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)

  const nodeRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ]

  const beamPathColor = theme === 'light' ? 'rgba(180, 100, 0, 0.3)' : 'rgba(245, 158, 11, 0.25)'
  const gradientStart = theme === 'light' ? '#CF6900' : '#f59e0b'
  const gradientStop = theme === 'light' ? '#b45309' : '#d97706'
  const accentColor = theme === 'light' ? '#CF6900' : '#f59e0b'

  return (
    <section
      className={`relative pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-28 lg:pb-32 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 lg:gap-16">
          {/* Left: Tree Diagram */}
          <div className="order-2 lg:order-1 w-full lg:w-[45%] flex-shrink-0 flex items-center justify-center mt-8 lg:mt-0 overflow-visible">
            <div
              ref={containerRef}
              className="relative w-[340px] h-[420px] sm:w-[460px] sm:h-[540px] lg:w-[520px] lg:h-[600px] overflow-visible"
            >
              {/* Animated Beams from Midas to each industry */}
              {industries.map((industry, i) => (
                <AnimatedBeam
                  key={`beam-${industry.id}`}
                  containerRef={containerRef}
                  fromRef={centerRef}
                  toRef={nodeRefs[i]}
                  pathColor={beamPathColor}
                  pathWidth={2}
                  pathOpacity={0.4}
                  gradientStartColor={gradientStart}
                  gradientStopColor={gradientStop}
                  duration={6 + i * 0.5}
                  delay={i * 0.8}
                  pathType="step"
                  stepJunctionY={industry.junctionY}
                  startXOffset={industry.xOffset}
                />
              ))}

              {/* Midas logo at top center */}
              <div
                ref={centerRef}
                className="absolute w-16 h-16 flex items-center justify-center z-20"
                style={{
                  left: `${midasX}%`,
                  top: `${midasY}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: theme === 'light' ? '#ffffff' : '#1c1c1c',
                  }}
                />
                <Image
                  src="/images/hero/logo_gold_new.svg"
                  alt="Midas"
                  width={48}
                  height={48}
                  className="relative drop-shadow-lg z-10"
                />
              </div>

              {/* Industry nodes in 3 tiers */}
              {industries.map((industry, i) => {
                const { Icon, iconColor } = industry
                return (
                  <div
                    key={industry.id}
                    ref={nodeRefs[i]}
                    className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/10 z-10"
                    style={{
                      left: `${industry.x}%`,
                      top: `${industry.y}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: theme === 'light' ? '#ffffff' : '#1c1c1c',
                      border:
                        theme === 'light'
                          ? '1px solid #f59e0b'
                          : '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <Icon
                      className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
                      strokeWidth={1.5}
                      style={{ color: theme === 'light' ? iconColor.light : iconColor.dark }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2 flex-1 flex flex-col gap-6 text-center lg:pt-[60px]">
            {/* Eyebrow */}
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  color: accentColor,
                }}
              >
                Industry Solutions
              </span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
            </div>

            {/* Main Heading */}
            <h1
              className="text-5xl sm:text-5xl lg:text-6xl theme-text-primary font-light"
              style={{ fontFamily: 'var(--font-eb-garamond)' }}
            >
              Built for
              <span
                className="italic text-transparent bg-clip-text pl-[0.12em] pr-[0.15em]"
                style={{
                  backgroundImage:
                    theme === 'light'
                      ? 'linear-gradient(to right, #CF6900, #CF6900)'
                      : 'linear-gradient(to right, #fbbf24, #f59e0b, #d97706)',
                }}
              >
                Your Industry
              </span>
            </h1>

            {/* Subheading */}
            <p
              className="text-lg 2xl:text-xl theme-text-secondary"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              Midas delivers CFO-level financial intelligence tailored to the unique challenges and
              opportunities of your industry.
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4 sm:gap-6">
              {metrics.map((metric) => (
                <div key={metric.label} className="group relative p-4 sm:p-5">
                  <div
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1"
                    style={{
                      fontFamily: 'var(--font-dm-sans)',
                      fontWeight: 700,
                      color: accentColor,
                    }}
                  >
                    {metric.value}
                  </div>
                  <div
                    className="text-xs sm:text-sm font-medium theme-text-primary mb-1"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {metric.label}
                  </div>
                  <div
                    className="text-[10px] sm:text-xs theme-text-secondary hidden sm:block"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {metric.description}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 text-white text-sm font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  backgroundColor: theme === 'light' ? '#CF6900' : undefined,
                  backgroundImage:
                    theme === 'light' ? 'none' : 'linear-gradient(to right, #f59e0b, #d97706)',
                  boxShadow:
                    theme === 'light'
                      ? '0 10px 15px -3px rgba(207, 105, 0, 0.25)'
                      : '0 10px 15px -3px rgba(245, 158, 11, 0.25)',
                }}
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
