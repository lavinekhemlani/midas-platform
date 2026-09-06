'use client'

import { useRef } from 'react'
import { Zap, Lock, Link2, Check, ArrowRight, LayoutDashboard } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { DM_Sans, STIX_Two_Text, EB_Garamond } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatedBeam } from '@/components/magicui/animated-beam'

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

// Visual diagram components for highlights

// 1. Grid of app dots converging into Midas — represents 700+ integrations
function IntegrationGridDiagram() {
  const dots = [
    'bg-[var(--theme-blue)] opacity-75',
    'bg-amber-400 opacity-75',
    'bg-[var(--theme-blue)] opacity-75',
    'bg-amber-500 opacity-75',
    'bg-amber-400 opacity-75',
    'bg-[var(--theme-blue)] opacity-75',
    'bg-amber-500 opacity-75',
    'bg-[var(--theme-blue)] opacity-75',
    'bg-[var(--theme-blue)] opacity-75',
    'bg-amber-400 opacity-75',
    'bg-amber-500 opacity-75',
    'bg-[var(--theme-blue)] opacity-75',
  ]

  return (
    <div className="relative w-full h-20 sm:h-24 flex items-center justify-center">
      {/* Grid of dots representing integrations */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {dots.map((color, i) => (
          <div key={i} className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-sm ${color}`} />
        ))}
      </div>
      {/* Arrow pointing to Midas dot */}
      <div className="flex items-center ml-2 sm:ml-3 gap-1 sm:gap-1.5">
        <div className="w-4 sm:w-6 h-[1.5px] bg-gradient-to-r from-amber-500/50 to-amber-500/90" />
        <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" strokeWidth={2} />
      </div>
    </div>
  )
}

// 2. Three-step flow: lock → link → check — represents zero-effort setup
function ZeroSetupDiagram() {
  return (
    <div className="relative w-full h-20 sm:h-24 flex items-center justify-center pr-2 sm:pr-3">
      <div className="flex items-center gap-1 sm:gap-2">
        {[
          { Icon: Lock, label: 'Auth' },
          { Icon: Link2, label: 'Link' },
          { Icon: Check, label: 'Live' },
        ].map((step, i) => (
          <div key={step.label} className="flex items-center gap-1 sm:gap-2">
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg border border-amber-500/30 bg-[var(--theme-bg)] flex items-center justify-center"
              style={{
                animation: `stepFade 3s ease-in-out ${i * 0.8}s infinite`,
              }}
            >
              <step.Icon
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${step.label === 'Live' ? 'text-emerald-500' : 'text-amber-500'}`}
                strokeWidth={2.5}
              />
            </div>
            {i < 2 && <div className="w-3 sm:w-5 h-[1.5px] bg-amber-500/30" />}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes stepFade {
          0%, 30% { opacity: 0.5; border-color: rgba(245, 158, 11, 0.2); }
          40%, 60% { opacity: 1; border-color: rgba(245, 158, 11, 0.6); }
          70%, 100% { opacity: 0.5; border-color: rgba(245, 158, 11, 0.2); }
        }
      `}</style>
    </div>
  )
}

// 3. Live data stream flowing between source and Midas — represents real-time sync
function LiveDataDiagram() {
  return (
    <div className="relative w-full h-20 sm:h-24 flex items-center justify-center">
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Source node */}
        <div className="relative flex items-center justify-center flex-shrink-0 z-10">
          <div className="flex flex-col gap-[3px]">
            <div className="h-[3px] w-6 sm:w-7 rounded-full bg-[var(--theme-blue)]" />
            <div className="h-[3px] w-4 sm:w-5 rounded-full bg-amber-500" />
            <div className="h-[3px] w-6 sm:w-7 rounded-full bg-[var(--theme-blue)] opacity-80" />
            <div className="h-[3px] w-5 sm:w-6 rounded-full bg-amber-400" />
          </div>
        </div>

        {/* Animated data stream channel */}
        <div className="relative w-10 sm:w-14 h-5 sm:h-6 overflow-hidden">
          {/* Track line */}
          <div className="absolute top-1/2 left-0 right-1 h-[1px] -translate-y-1/2 bg-amber-500/15" />

          {/* Flowing particles — 2 evenly spaced streams */}
          {[0, 1].map((i) => (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                animation: `liveStreamFlow 1.8s linear ${i * 0.9}s infinite`,
              }}
            >
              <div className="flex items-center gap-[2px]">
                <div className="w-1 h-1 rounded-full bg-amber-500" />
                <div className="w-3 sm:w-4 h-[2px] rounded-full bg-gradient-to-r from-amber-500 to-[var(--theme-blue)]" />
                <div className="w-1 h-1 rounded-full bg-[var(--theme-blue)]" />
              </div>
            </div>
          ))}
        </div>

        {/* Midas node — mini dashboard */}
        <div className="relative flex items-center justify-center flex-shrink-0 z-10">
          {/* Pulse ring */}
          <div
            className="absolute -inset-2 rounded-lg border border-amber-500/30"
            style={{ animation: 'liveSyncPulse 2s ease-out infinite' }}
          />
          <div className="w-10 h-8 sm:w-12 sm:h-9 rounded-md border border-amber-500/30 overflow-hidden p-1 bg-[var(--theme-bg)]">
            <div className="grid grid-cols-2 gap-0.5 h-full">
              <div className="rounded-[2px] bg-amber-500 opacity-80" />
              <div className="rounded-[2px] bg-[var(--theme-blue)] opacity-70" />
              <div className="col-span-2 rounded-[2px] bg-amber-400 opacity-65" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes liveStreamFlow {
          0% { left: 0%; opacity: 0; }
          10% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 85%; opacity: 0; }
        }
        @keyframes liveSyncPulse {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes liveDotBlink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

const highlights = [
  {
    title: '700+ Integrations. One Click.',
    description: 'QuickBooks, Xero, Shopify, whatever you use, Midas connects instantly.',
    diagram: IntegrationGridDiagram,
  },
  {
    title: 'Zero Engineering. Zero Migrations.',
    description: "Authenticate. Connect. Live. That's the whole setup.",
    diagram: ZeroSetupDiagram,
  },
  {
    title: 'Data Without Delay.',
    description: "Stop making decisions on last month's numbers.",
    diagram: LiveDataDiagram,
  },
]

// Logo data with brand colors for fallbacks
const logoData: Record<string, { color: string; letter: string }> = {
  quickbooks: { color: '#2CA01C', letter: 'Q' },
  xero: { color: '#13B5EA', letter: 'X' },
  stripe: { color: '#635BFF', letter: 'S' },
  shopify: { color: '#7AB55C', letter: 'S' },
  airtable: { color: '#18BFFF', letter: 'A' },
  hubspot: { color: '#FF7A59', letter: 'H' },
  paypal: { color: '#003087', letter: 'P' },
  square: { color: '#3E4348', letter: 'S' },
  mailchimp: { color: '#FFE01B', letter: 'M' },
  zoho: { color: '#E42527', letter: 'Z' },
  sap: { color: '#0FAAFF', letter: 'S' },
  googlesheets: { color: '#34A853', letter: 'G' },
  amazon: { color: '#FF9900', letter: 'A' },
  meta: { color: '#0081FB', letter: 'M' },
  linkedin: { color: '#0A66C2', letter: 'L' },
  woocommerce: { color: '#96588A', letter: 'W' },
}

// Integration logos positioned in multiple rings around center
// Inner ring: 6 logos at 60 degree intervals starting at 0
const innerRing = [
  { name: 'QuickBooks', slug: 'quickbooks', angle: 0 },
  { name: 'Stripe', slug: 'stripe', angle: 60 },
  { name: 'Xero', slug: 'xero', angle: 120 },
  { name: 'Shopify', slug: 'shopify', angle: 180 },
  { name: 'HubSpot', slug: 'hubspot', angle: 240 },
  { name: 'PayPal', slug: 'paypal', angle: 300 },
]

// Outer ring: 6 logos offset by 30 degrees (positioned in between inner ring logos)
const outerRing = [
  { name: 'Airtable', slug: 'airtable', angle: 30 },
  { name: 'Square', slug: 'square', angle: 90 },
  { name: 'Mailchimp', slug: 'mailchimp', angle: 150 },
  { name: 'Zoho', slug: 'zoho', angle: 210 },
  { name: 'SAP', slug: 'sap', angle: 270 },
  { name: 'Google Sheets', slug: 'googlesheets', angle: 330 },
]

function LogoIcon({ slug, name, size = 24 }: { slug: string; name: string; size?: number }) {
  const data = logoData[slug]

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={name}
        width={size}
        height={size}
        className="opacity-100"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const fallback = e.currentTarget.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className="absolute inset-0 items-center justify-center text-white font-bold rounded hidden"
        style={{
          backgroundColor: data?.color || '#f59e0b',
          fontSize: size * 0.5,
          display: 'none',
        }}
      >
        {data?.letter || name.charAt(0)}
      </div>
    </div>
  )
}

interface IntegrationsHeroProps {
  showCTA?: boolean
  showConnectButton?: boolean
}

export default function IntegrationsHero({
  showCTA = false,
  showConnectButton = true,
}: IntegrationsHeroProps) {
  const { theme } = useTheme()
  // Radius values as percentage of container (50 = center)
  // Inner ring: 32% from center, outer ring: 42% from center
  // This keeps all logos well within the container bounds
  const innerRadiusPercent = 32
  const outerRadiusPercent = 42

  // Container ref for AnimatedBeam
  const containerRef = useRef<HTMLDivElement>(null)

  // Center (Midas) ref
  const centerRef = useRef<HTMLDivElement>(null)

  // Inner ring refs
  const quickbooksRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<HTMLDivElement>(null)
  const xeroRef = useRef<HTMLDivElement>(null)
  const shopifyRef = useRef<HTMLDivElement>(null)
  const hubspotRef = useRef<HTMLDivElement>(null)
  const paypalRef = useRef<HTMLDivElement>(null)

  // Outer ring refs
  const airtableRef = useRef<HTMLDivElement>(null)
  const squareRef = useRef<HTMLDivElement>(null)
  const mailchimpRef = useRef<HTMLDivElement>(null)
  const zohoRef = useRef<HTMLDivElement>(null)
  const sapRef = useRef<HTMLDivElement>(null)
  const googlesheetsRef = useRef<HTMLDivElement>(null)

  // Map slugs to refs
  const innerRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    quickbooks: quickbooksRef,
    stripe: stripeRef,
    xero: xeroRef,
    shopify: shopifyRef,
    hubspot: hubspotRef,
    paypal: paypalRef,
  }

  const outerRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    airtable: airtableRef,
    square: squareRef,
    mailchimp: mailchimpRef,
    zoho: zohoRef,
    sap: sapRef,
    googlesheets: googlesheetsRef,
  }

  // Mobile-only refs (separate from desktop to avoid ref conflicts)
  const mobileContainerRef = useRef<HTMLDivElement>(null)
  const mobileCenterRef = useRef<HTMLDivElement>(null)
  const mobileInnerRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    quickbooks: useRef<HTMLDivElement>(null),
    stripe: useRef<HTMLDivElement>(null),
    xero: useRef<HTMLDivElement>(null),
    shopify: useRef<HTMLDivElement>(null),
    hubspot: useRef<HTMLDivElement>(null),
    paypal: useRef<HTMLDivElement>(null),
  }
  const mobileOuterRefs: Record<string, React.RefObject<HTMLDivElement>> = {
    airtable: useRef<HTMLDivElement>(null),
    square: useRef<HTMLDivElement>(null),
    mailchimp: useRef<HTMLDivElement>(null),
    zoho: useRef<HTMLDivElement>(null),
    sap: useRef<HTMLDivElement>(null),
    googlesheets: useRef<HTMLDivElement>(null),
  }

  // Beam colors based on theme - more visible path colors
  const beamPathColor = theme === 'light' ? 'rgba(180, 100, 0, 0.3)' : 'rgba(245, 158, 11, 0.25)'
  const gradientStart = theme === 'light' ? '#CF6900' : '#f59e0b'
  const gradientStop = theme === 'light' ? '#b45309' : '#d97706'

  return (
    <section
      className={`relative pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-28 lg:pb-32 px-4 sm:px-6 lg:px-8 ${dmSans.variable} ${stixTwoText.variable} ${ebGaramond.variable}`}
    >
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left: Golden Web Visualization with Animated Beams - desktop only */}
          <div className="hidden lg:flex order-2 lg:order-1 w-full lg:w-[45%] flex-shrink-0 items-center justify-center mt-8 lg:mt-0 overflow-visible">
            <div
              ref={containerRef}
              className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] lg:w-[540px] lg:h-[540px] overflow-visible"
            >
              {/* Animated Beams - Inner Ring (flowing INTO Midas) */}
              {innerRing.map((logo, index) => (
                <AnimatedBeam
                  key={`beam-inner-${logo.slug}`}
                  containerRef={containerRef}
                  fromRef={innerRefs[logo.slug]}
                  toRef={centerRef}
                  pathColor={beamPathColor}
                  pathWidth={2}
                  pathOpacity={0.4}
                  gradientStartColor={gradientStart}
                  gradientStopColor={gradientStop}
                  duration={3 + index * 0.3}
                  delay={index * 0.5}
                  curvature={0}
                />
              ))}

              {/* Animated Beams - Outer Ring (flowing INTO Midas) */}
              {outerRing.map((logo, index) => (
                <AnimatedBeam
                  key={`beam-outer-${logo.slug}`}
                  containerRef={containerRef}
                  fromRef={outerRefs[logo.slug]}
                  toRef={centerRef}
                  pathColor={beamPathColor}
                  pathWidth={1.5}
                  pathOpacity={0.35}
                  gradientStartColor={gradientStart}
                  gradientStopColor={gradientStop}
                  duration={4 + index * 0.3}
                  delay={index * 0.5 + 0.25}
                  curvature={0}
                />
              ))}

              {/* Central Midas logo with golden glow and solid background */}
              <div
                ref={centerRef}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center z-20"
              >
                <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
                {/* Solid background circle to hide beam lines */}
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

              {/* Inner ring logos */}
              {innerRing.map((logo) => {
                const radians = (logo.angle * Math.PI) / 180
                // Position using percentage from center (50% = center)
                // Round to 2 decimal places to avoid hydration mismatch from floating-point precision
                const x = Math.round((50 + innerRadiusPercent * Math.cos(radians)) * 100) / 100
                const y = Math.round((50 + innerRadiusPercent * Math.sin(radians)) * 100) / 100
                return (
                  <div
                    key={logo.slug}
                    ref={innerRefs[logo.slug]}
                    className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/10"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                      border:
                        theme === 'light'
                          ? '1px solid #f59e0b'
                          : '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <LogoIcon slug={logo.slug} name={logo.name} size={22} />
                  </div>
                )
              })}

              {/* Outer ring logos */}
              {outerRing.map((logo) => {
                const radians = (logo.angle * Math.PI) / 180
                // Position using percentage from center (50% = center)
                // Round to 2 decimal places to avoid hydration mismatch from floating-point precision
                const x = Math.round((50 + outerRadiusPercent * Math.cos(radians)) * 100) / 100
                const y = Math.round((50 + outerRadiusPercent * Math.sin(radians)) * 100) / 100
                return (
                  <div
                    key={logo.slug}
                    ref={outerRefs[logo.slug]}
                    className="absolute w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                      border:
                        theme === 'light'
                          ? '1px solid #f59e0b'
                          : '1px solid rgba(245, 158, 11, 0.4)',
                    }}
                  >
                    <LogoIcon slug={logo.slug} name={logo.name} size={18} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2 flex-1 flex flex-col gap-6 text-center">
            {/* Section Label */}
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
              <span
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{
                  fontFamily: 'var(--font-dm-sans)',
                  color: theme === 'light' ? '#CF6900' : '#f59e0b',
                }}
              >
                Integrations
              </span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
            </div>

            {/* Heading */}
            <h1
              className="text-[48px] sm:text-5xl lg:text-6xl theme-text-primary font-light"
              style={{ fontFamily: 'var(--font-eb-garamond)' }}
            >
              Connect Your
              <br className="lg:hidden" />{' '}
              <span
                className="italic bg-clip-text text-transparent pl-[0.05em] pr-[0.15em]"
                style={{
                  backgroundImage:
                    theme === 'light'
                      ? 'linear-gradient(to right, #CF6900, #CF6900)'
                      : 'linear-gradient(to right, #f59e0b, #d97706)',
                }}
              >
                Entire Stack
              </span>
            </h1>

            {/* Subheading */}
            <p
              className="text-lg 2xl:text-xl theme-text-secondary"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              700+ integrations with your accounting software, banking platforms, inventory systems,
              and marketing tools for unified financial intelligence.
            </p>

            {/* Mobile-only: Integration diagram with own refs + AnimatedBeam */}
            <div className="lg:hidden w-full flex items-center justify-center overflow-visible">
              <div
                ref={mobileContainerRef}
                className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] overflow-visible"
              >
                {/* Animated Beams - Inner Ring */}
                {innerRing.map((logo, index) => (
                  <AnimatedBeam
                    key={`mobile-beam-inner-${logo.slug}`}
                    containerRef={mobileContainerRef}
                    fromRef={mobileInnerRefs[logo.slug]}
                    toRef={mobileCenterRef}
                    pathColor={beamPathColor}
                    pathWidth={2}
                    pathOpacity={0.4}
                    gradientStartColor={gradientStart}
                    gradientStopColor={gradientStop}
                    duration={3 + index * 0.3}
                    delay={index * 0.5}
                    curvature={0}
                  />
                ))}

                {/* Animated Beams - Outer Ring */}
                {outerRing.map((logo, index) => (
                  <AnimatedBeam
                    key={`mobile-beam-outer-${logo.slug}`}
                    containerRef={mobileContainerRef}
                    fromRef={mobileOuterRefs[logo.slug]}
                    toRef={mobileCenterRef}
                    pathColor={beamPathColor}
                    pathWidth={1.5}
                    pathOpacity={0.35}
                    gradientStartColor={gradientStart}
                    gradientStopColor={gradientStop}
                    duration={4 + index * 0.3}
                    delay={index * 0.5 + 0.25}
                    curvature={0}
                  />
                ))}

                {/* Central Midas logo */}
                <div
                  ref={mobileCenterRef}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center z-20"
                >
                  <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl" />
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: theme === 'light' ? '#ffffff' : '#1c1c1c' }}
                  />
                  <Image
                    src="/images/hero/logo_gold_new.svg"
                    alt="Midas"
                    width={48}
                    height={48}
                    className="relative drop-shadow-lg z-10"
                  />
                </div>

                {/* Inner ring logos */}
                {innerRing.map((logo) => {
                  const radians = (logo.angle * Math.PI) / 180
                  const x = Math.round((50 + innerRadiusPercent * Math.cos(radians)) * 100) / 100
                  const y = Math.round((50 + innerRadiusPercent * Math.sin(radians)) * 100) / 100
                  return (
                    <div
                      key={`mobile-${logo.slug}`}
                      ref={mobileInnerRefs[logo.slug]}
                      className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/10"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                        border:
                          theme === 'light'
                            ? '1px solid #f59e0b'
                            : '1px solid rgba(245, 158, 11, 0.4)',
                      }}
                    >
                      <LogoIcon slug={logo.slug} name={logo.name} size={22} />
                    </div>
                  )
                })}

                {/* Outer ring logos */}
                {outerRing.map((logo) => {
                  const radians = (logo.angle * Math.PI) / 180
                  const x = Math.round((50 + outerRadiusPercent * Math.cos(radians)) * 100) / 100
                  const y = Math.round((50 + outerRadiusPercent * Math.sin(radians)) * 100) / 100
                  return (
                    <div
                      key={`mobile-${logo.slug}`}
                      ref={mobileOuterRefs[logo.slug]}
                      className="absolute w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: theme === 'light' ? '#ffffff' : '#2a2a2a',
                        border:
                          theme === 'light'
                            ? '1px solid #f59e0b'
                            : '1px solid rgba(245, 158, 11, 0.4)',
                      }}
                    >
                      <LogoIcon slug={logo.slug} name={logo.name} size={18} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* CTA Button - mobile only (above highlights) */}
            {showConnectButton && (
              <div className="lg:hidden flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 mb-4">
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
                  Connect Your Stack
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}

            {/* Highlights with Diagrams */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 mt-6 sm:mt-0">
              {highlights.map((item) => (
                <div key={item.title} className="flex flex-col">
                  <div className="relative p-3 sm:p-4 rounded-xl flex flex-col items-center">
                    {/* Title - mobile: above diagram, desktop: below */}
                    <span
                      className="sm:hidden text-sm font-medium theme-text-primary text-center w-full mb-3"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    >
                      {item.title}
                    </span>

                    {/* Diagram */}
                    <div className="scale-150 sm:scale-100 my-4 sm:my-0">
                      <item.diagram />
                    </div>

                    {/* Text - desktop only */}
                    <div className="hidden sm:flex mt-3 text-center flex-col">
                      <span
                        className="text-sm font-semibold theme-text-primary h-[2.5rem] flex items-center justify-center whitespace-pre-line"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {item.title}
                      </span>
                      <p
                        className="text-xs theme-text-secondary mt-1.5 leading-relaxed"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button - desktop only (below highlights) */}
            {showConnectButton && (
              <div className="hidden lg:flex items-center justify-center gap-4 mt-10 mb-6">
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
                  Connect Your Stack
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}

            {/* CTA Link - centered below cards */}
            {showCTA && (
              <div className="flex justify-center mt-4">
                <Link
                  href="/integrations"
                  className="group inline-flex items-center gap-2 transition-colors hover:opacity-80"
                  style={{
                    fontFamily: 'var(--font-dm-sans)',
                    color: theme === 'light' ? '#CF6900' : '#f59e0b',
                  }}
                >
                  <span className="text-sm font-medium">View all integrations</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
