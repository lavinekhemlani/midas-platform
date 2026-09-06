'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'

export function MidasAIAgentSection() {
  const { theme } = useTheme()
  const sectionRef = useRef<HTMLDivElement>(null)

  // Track which panels have been viewed (persists across re-renders)
  const viewedPanelsRef = useRef<Set<Element>>(new Set())

  useEffect(() => {
    // Disable scroll animations on mobile
    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (isMobile) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view')
            viewedPanelsRef.current.add(entry.target)
          }
        })
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    const featurePanels = sectionRef.current?.querySelectorAll('.feature-panel')
    featurePanels?.forEach((panel) => {
      // Re-apply in-view class to panels that were already viewed
      if (viewedPanelsRef.current.has(panel)) {
        panel.classList.add('in-view')
      }
      observer.observe(panel)
    })

    return () => observer.disconnect()
  }, [theme])

  // Theme-aware colors
  const cardBorder = theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
  const textSecondary = theme === 'light' ? '#666666' : 'rgba(255,255,255,0.5)'
  const textPrimary = theme === 'light' ? '#1a1a1a' : 'rgba(255,255,255,0.9)'
  const lineColor = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'

  // Card background - solid in light mode, slightly transparent in dark mode
  const cardBg = theme === 'light' ? '#FFFDFA' : '#1a1a1a'

  // Solid background for data source boxes/diagram elements (light whitish in light mode)
  const dataBoxBg = theme === 'light' ? '#ffffff' : '#252525'

  const highlightGradient =
    theme === 'light'
      ? 'linear-gradient(135deg, #CF6900, #CF6900)'
      : 'linear-gradient(135deg, #f59e0b, #fbbf24)'

  // Accent color for highlighted numbers/values
  const accentColor = theme === 'light' ? '#CF6900' : 'rgba(245, 158, 11, 1)'
  const accentColor80 = theme === 'light' ? 'rgba(207, 105, 0, 0.8)' : 'rgba(245, 158, 11, 0.8)'
  const accentColor60 = theme === 'light' ? 'rgba(207, 105, 0, 0.6)' : 'rgba(245, 158, 11, 0.6)'
  const accentColor40 = theme === 'light' ? 'rgba(207, 105, 0, 0.4)' : 'rgba(245, 158, 11, 0.4)'
  const accentColor30 = theme === 'light' ? 'rgba(207, 105, 0, 0.3)' : 'rgba(245, 158, 11, 0.3)'
  const accentColor15 = theme === 'light' ? 'rgba(207, 105, 0, 0.15)' : 'rgba(245, 158, 11, 0.15)'
  const accentColor12 = theme === 'light' ? 'rgba(207, 105, 0, 0.12)' : 'rgba(245, 158, 11, 0.12)'

  // Data source colors - brighter and more vibrant
  const dataColors = {
    revenue: theme === 'light' ? '#059669' : '#34d399',
    customers: theme === 'light' ? '#7c3aed' : '#c4b5fd',
    marketing: theme === 'light' ? '#dc2626' : '#fca5a5',
    operations: theme === 'light' ? '#0284c7' : '#7dd3fc',
    finance: theme === 'light' ? '#d97706' : '#fcd34d',
    inventory: theme === 'light' ? '#db2777' : '#f9a8d4',
  }

  return (
    <div ref={sectionRef} className="px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center pt-16 sm:pt-20 pb-12 sm:pb-16 lg:pb-20 max-w-4xl mx-auto">
        <h2
          className="text-[48px] sm:text-[60px] font-light leading-[1.1] tracking-[-0.02em] theme-text-primary mb-4"
          style={{ fontFamily: 'var(--font-eb-garamond)' }}
        >
          One Platform.
          <br className="sm:hidden" />
          <span
            className="italic bg-clip-text text-transparent pl-[0.05em] pr-[0.15em]"
            style={{
              backgroundImage:
                theme === 'light'
                  ? 'linear-gradient(to right, #CF6900, #CF6900)'
                  : 'linear-gradient(to right, #f59e0b, #d97706)',
            }}
          >
            Total Visibility.
          </span>
        </h2>
        <p
          className="text-lg 2xl:text-xl theme-text-secondary"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Connect, analyze, and act—all from a single intelligent dashboard.
        </p>
      </div>

      {/* Animation Styles */}
      <style jsx>{`
        .feature-panel {
          opacity: 0;
          transform: translateY(20px);
          transition:
            opacity 0.8s ease-out,
            transform 0.8s ease-out;
        }
        .feature-panel.in-view {
          opacity: 1;
          transform: translateY(0);
        }
        @media (max-width: 767px) {
          .feature-panel {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
        @keyframes flowPulse {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes dashMove {
          0% {
            stroke-dashoffset: 24;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes hubGlow {
          0%,
          100% {
            filter: drop-shadow(0 0 8px rgba(245, 158, 11, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(245, 158, 11, 0.6));
          }
        }
        @keyframes alertPulse {
          0%,
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes typeEffect {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
        @keyframes processingDot {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes cardHighlight {
          0%,
          100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }
        .animated-dash {
          animation: dashMove 10s linear infinite;
        }
        .pulse-node {
          animation: flowPulse 4s ease-in-out infinite;
        }
        .hub-glow {
          animation: hubGlow 3s ease-in-out infinite;
        }
        .alert-pulse {
          animation: alertPulse 2s ease-in-out infinite;
        }
        .fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .type-cursor {
          animation: typeEffect 1s ease-in-out infinite;
        }
        .processing-dot {
          animation: processingDot 1.5s ease-in-out infinite;
        }
        .card-highlight {
          animation: cardHighlight 3s ease-in-out infinite;
        }
        .highlight-text {
          background: ${highlightGradient};
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Feature Panels */}
      <div className="max-w-[1600px] mx-auto space-y-5">
        {/* ============ FEATURE 1: EVERYTHING IN ONE PLACE ============ */}
        <div
          className="feature-panel rounded-2xl"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            position: 'relative',
            zIndex: 40,
            isolation: 'isolate',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32 p-6 sm:p-10 lg:p-12 items-center min-h-[550px] lg:min-h-[620px]">
            {/* Text */}
            <div className="order-1 lg:order-1 lg:text-right max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <h3
                className="text-[36px] sm:text-[40px] font-normal theme-text-primary mb-5 leading-[1.1]"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Everything in <em className="italic">one place</em>, like it should be
              </h3>
              <div className="w-16 h-px bg-amber-500/40 mb-5 lg:ml-auto" />
              <p
                className="text-lg sm:text-xl leading-relaxed theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                You're running one business, but your data acts like five different companies.{' '}
                <span className="highlight-text font-medium">Midas pulls it all together</span> so
                you actually see what's happening.
              </p>
            </div>

            {/* Visualization - Orbital Data Convergence */}
            <div className="order-2 lg:order-2 flex items-center justify-center lg:justify-start pb-8">
              <div className="relative w-full max-w-[420px] aspect-square">
                <svg viewBox="0 0 400 400" className="w-full h-full" fill="none">
                  <defs>
                    {/* Orbital flow paths - all spiral clockwise inward toward center */}
                    {/* Revenue: 270° (top) */}
                    <path
                      id="orbit-path-1"
                      d="M200 30 C260 45, 285 110, 255 155 C230 190, 215 198, 200 200"
                    />
                    {/* Customer: 330° (top-right) */}
                    <path
                      id="orbit-path-2"
                      d="M347 115 C340 175, 300 220, 250 230 C215 238, 205 205, 200 200"
                    />
                    {/* Marketing: 30° (bottom-right) */}
                    <path
                      id="orbit-path-3"
                      d="M347 285 C290 295, 240 280, 220 250 C200 225, 198 210, 200 200"
                    />
                    {/* Operations: 90° (bottom) */}
                    <path
                      id="orbit-path-4"
                      d="M200 370 C140 355, 115 290, 145 245 C170 210, 185 202, 200 200"
                    />
                    {/* Inventory: 150° (bottom-left) */}
                    <path
                      id="orbit-path-5"
                      d="M53 285 C60 225, 100 180, 150 170 C185 162, 195 195, 200 200"
                    />
                    {/* Finance: 210° (top-left) */}
                    <path
                      id="orbit-path-6"
                      d="M53 115 C110 105, 160 120, 180 150 C200 175, 202 190, 200 200"
                    />

                    {/* Glow filter for center */}
                    <filter id="center-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Concentric orbital rings - radar aesthetic */}
                  <circle
                    cx="200"
                    cy="200"
                    r="170"
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1"
                    strokeDasharray="4 8"
                    opacity="0.7"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="130"
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1"
                    strokeDasharray="3 6"
                    opacity="0.6"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="90"
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  <circle
                    cx="200"
                    cy="200"
                    r="50"
                    fill="none"
                    stroke={accentColor30}
                    strokeWidth="1.5"
                    opacity="0.8"
                  />

                  {/* Radial guide lines - subtle */}
                  {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                    const rad = (angle * Math.PI) / 180
                    const x1 = 200 + Math.cos(rad) * 50
                    const y1 = 200 + Math.sin(rad) * 50
                    const x2 = 200 + Math.cos(rad) * 170
                    const y2 = 200 + Math.sin(rad) * 170
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={lineColor}
                        strokeWidth="1"
                        strokeDasharray="2 6"
                        opacity="0.3"
                      />
                    )
                  })}

                  {/* Flow paths - all spiral clockwise inward toward center */}
                  <path
                    d="M200 30 C260 45, 285 110, 255 155 C230 190, 215 198, 200 200"
                    stroke={dataColors.revenue}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M347 115 C340 175, 300 220, 250 230 C215 238, 205 205, 200 200"
                    stroke={dataColors.customers}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M347 285 C290 295, 240 280, 220 250 C200 225, 198 210, 200 200"
                    stroke={dataColors.marketing}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M200 370 C140 355, 115 290, 145 245 C170 210, 185 202, 200 200"
                    stroke={dataColors.operations}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M53 285 C60 225, 100 180, 150 170 C185 162, 195 195, 200 200"
                    stroke={dataColors.inventory}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M53 115 C110 105, 160 120, 180 150 C200 175, 202 190, 200 200"
                    stroke={dataColors.finance}
                    strokeOpacity="0.3"
                    strokeWidth="1.5"
                    fill="none"
                  />

                  {/* Animated data particles flowing inward */}
                  <circle r="4" fill={dataColors.revenue}>
                    <animateMotion dur="3s" repeatCount="indefinite">
                      <mpath href="#orbit-path-1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle r="4" fill={dataColors.customers}>
                    <animateMotion dur="2.8s" repeatCount="indefinite" begin="0.5s">
                      <mpath href="#orbit-path-2" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="0.5s"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="0.5s"
                    />
                  </circle>
                  <circle r="4" fill={dataColors.marketing}>
                    <animateMotion dur="2.5s" repeatCount="indefinite" begin="1s">
                      <mpath href="#orbit-path-3" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin="1s"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin="1s"
                    />
                  </circle>
                  <circle r="4" fill={dataColors.operations}>
                    <animateMotion dur="2.8s" repeatCount="indefinite" begin="1.5s">
                      <mpath href="#orbit-path-4" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="1.5s"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="1.5s"
                    />
                  </circle>
                  <circle r="4" fill={dataColors.inventory}>
                    <animateMotion dur="3s" repeatCount="indefinite" begin="2s">
                      <mpath href="#orbit-path-5" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="3s"
                      repeatCount="indefinite"
                      begin="2s"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="3s"
                      repeatCount="indefinite"
                      begin="2s"
                    />
                  </circle>
                  <circle r="4" fill={dataColors.finance}>
                    <animateMotion dur="2.8s" repeatCount="indefinite" begin="2.5s">
                      <mpath href="#orbit-path-6" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0.8;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="2.5s"
                    />
                    <animate
                      attributeName="r"
                      values="4;4;3;2;0"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin="2.5s"
                    />
                  </circle>

                  {/* Second wave of particles (staggered) */}
                  <circle r="3" fill={dataColors.revenue} opacity="0.7">
                    <animateMotion dur="3s" repeatCount="indefinite" begin="1.5s">
                      <mpath href="#orbit-path-1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;0.7;0.7;0.5;0"
                      dur="3s"
                      repeatCount="indefinite"
                      begin="1.5s"
                    />
                  </circle>
                  <circle r="3" fill={dataColors.marketing} opacity="0.7">
                    <animateMotion dur="2.5s" repeatCount="indefinite" begin="2.2s">
                      <mpath href="#orbit-path-3" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;0.7;0.7;0.5;0"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin="2.2s"
                    />
                  </circle>
                  <circle r="3" fill={dataColors.inventory} opacity="0.7">
                    <animateMotion dur="3s" repeatCount="indefinite" begin="0.8s">
                      <mpath href="#orbit-path-5" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;0.7;0.7;0.5;0"
                      dur="3s"
                      repeatCount="indefinite"
                      begin="0.8s"
                    />
                  </circle>

                  {/* Data source nodes - evenly spaced at 60° intervals on orbital ring (radius 170) */}
                  {/* Revenue - 270° (top center) */}
                  <g>
                    <rect x="153" y="11" width="94" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="155"
                      y="13"
                      width="90"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.revenue}
                      strokeWidth="1.5"
                    />
                    <circle cx="172" cy="30" r="6" fill={dataColors.revenue} opacity="0.2" />
                    <circle cx="172" cy="30" r="3" fill={dataColors.revenue} />
                    <text
                      x="205"
                      y="35"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.revenue}
                    >
                      Revenue
                    </text>
                  </g>

                  {/* Customers - 330° (top-right) */}
                  <g>
                    <rect x="300" y="96" width="94" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="302"
                      y="98"
                      width="90"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.customers}
                      strokeWidth="1.5"
                    />
                    <circle cx="319" cy="115" r="6" fill={dataColors.customers} opacity="0.2" />
                    <circle cx="319" cy="115" r="3" fill={dataColors.customers} />
                    <text
                      x="352"
                      y="120"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.customers}
                    >
                      Customer
                    </text>
                  </g>

                  {/* Marketing - 30° (bottom-right) */}
                  <g>
                    <rect x="300" y="266" width="94" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="302"
                      y="268"
                      width="90"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.marketing}
                      strokeWidth="1.5"
                    />
                    <circle cx="319" cy="285" r="6" fill={dataColors.marketing} opacity="0.2" />
                    <circle cx="319" cy="285" r="3" fill={dataColors.marketing} />
                    <text
                      x="352"
                      y="290"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.marketing}
                    >
                      Marketing
                    </text>
                  </g>

                  {/* Operations - 90° (bottom center) */}
                  <g>
                    <rect x="150" y="351" width="99" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="152"
                      y="353"
                      width="95"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.operations}
                      strokeWidth="1.5"
                    />
                    <circle cx="169" cy="370" r="6" fill={dataColors.operations} opacity="0.2" />
                    <circle cx="169" cy="370" r="3" fill={dataColors.operations} />
                    <text
                      x="205"
                      y="375"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.operations}
                    >
                      Operations
                    </text>
                  </g>

                  {/* Inventory - 150° (bottom-left) */}
                  <g>
                    <rect x="6" y="266" width="94" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="8"
                      y="268"
                      width="90"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.inventory}
                      strokeWidth="1.5"
                    />
                    <circle cx="25" cy="285" r="6" fill={dataColors.inventory} opacity="0.2" />
                    <circle cx="25" cy="285" r="3" fill={dataColors.inventory} />
                    <text
                      x="58"
                      y="290"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.inventory}
                    >
                      Inventory
                    </text>
                  </g>

                  {/* Finance - 210° (top-left) */}
                  <g>
                    <rect x="6" y="96" width="84" height="38" rx="19" fill={cardBg} />
                    <rect
                      x="8"
                      y="98"
                      width="80"
                      height="34"
                      rx="17"
                      fill={dataBoxBg}
                      stroke={dataColors.finance}
                      strokeWidth="1.5"
                    />
                    <circle cx="25" cy="115" r="6" fill={dataColors.finance} opacity="0.2" />
                    <circle cx="25" cy="115" r="3" fill={dataColors.finance} />
                    <text
                      x="53"
                      y="120"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.finance}
                    >
                      Finance
                    </text>
                  </g>

                  {/* Central Midas Hub - convergence point with glow */}
                  <g className="hub-glow">
                    {/* Outer glow ring */}
                    <circle cx="200" cy="200" r="38" fill={accentColor15} />
                    <circle
                      cx="200"
                      cy="200"
                      r="32"
                      fill={dataBoxBg}
                      stroke={accentColor40}
                      strokeWidth="2"
                    />
                    <image
                      href="/images/hero/logo_gold_new.svg"
                      x="175"
                      y="175"
                      width="50"
                      height="50"
                    />
                  </g>

                  {/* Pulsing center ring effect */}
                  <circle
                    cx="200"
                    cy="200"
                    r="38"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="1"
                    opacity="0.4"
                  >
                    <animate
                      attributeName="r"
                      values="38;45;38"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.4;0.1;0.4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ============ FEATURE 2: TALK TO YOUR BUSINESS ============ */}
        <div
          className="feature-panel rounded-2xl"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            position: 'relative',
            zIndex: 40,
            isolation: 'isolate',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32 p-6 sm:p-10 lg:p-12 items-center min-h-[550px] lg:min-h-[620px]">
            {/* Visualization */}
            <div className="order-2 lg:order-1 flex items-center justify-center lg:justify-end pb-8">
              <div className="w-full max-w-[380px] aspect-[4/5]">
                <svg viewBox="0 0 320 410" className="w-full h-full" fill="none">
                  {/* Path definitions for animated dots */}
                  <defs>
                    <path id="f2-path1" d="M50 125 Q82 138 115 152" />
                    <path id="f2-path2" d="M50 205 Q82 191 115 178" />
                    <path id="f2-path3" d="M270 145 Q237 151 205 158" />
                    <path id="f2-path4" d="M270 195 Q237 183 205 172" />
                    <path id="f2-arrow-down" d="M160 80 L160 115" />
                    <path id="f2-arrow-up" d="M160 215 L160 260" />
                  </defs>

                  <g transform="translate(15, 10)">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="65"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(245, 158, 11, 0.3)"
                      strokeWidth="1.5"
                    />
                    <text x="14" y="20" fontSize="10" fill={textSecondary}>
                      You ask:
                    </text>
                    <text x="14" y="40" fontSize="10" fill={textSecondary}>
                      "Should we increase ad spend or focus on
                    </text>
                    <text x="14" y="56" fontSize="10" fill={textSecondary}>
                      reducing churn this quarter?"
                    </text>
                    {/* Typing cursor */}
                    <rect x="268" y="46" width="2" height="14" fill="rgba(245, 158, 11, 0.8)" />
                  </g>

                  <path
                    d="M160 80 L160 105"
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="animated-dash"
                  />
                  <polygon points="156,105 160,115 164,105" fill="rgba(245, 158, 11, 0.5)" />

                  {/* Animated dot going down to Midas */}
                  <circle r="3" fill="rgba(245, 158, 11, 0.9)">
                    <animateMotion dur="1.5s" repeatCount="indefinite">
                      <mpath href="#f2-arrow-down" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Central Midas Hub */}
                  <g>
                    <image
                      href="/images/hero/logo_gold_new.svg"
                      x="133"
                      y="138"
                      width="54"
                      height="54"
                    />
                  </g>

                  {/* Animated dots - rendered FIRST so they appear behind cards */}
                  {/* Animated dot for Ad Spend */}
                  <circle r="3" fill={dataColors.marketing}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="0.2s">
                      <mpath href="#f2-path1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.2s"
                    />
                  </circle>
                  {/* Animated dot for Churn */}
                  <circle r="3" fill={dataColors.customers}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="0.7s">
                      <mpath href="#f2-path2" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.7s"
                    />
                  </circle>
                  {/* Animated dot for LTV */}
                  <circle r="3" fill={dataColors.revenue}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="1.2s">
                      <mpath href="#f2-path3" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.2s"
                    />
                  </circle>
                  {/* Animated dot for CAC */}
                  <circle r="3" fill={dataColors.finance}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="1.7s">
                      <mpath href="#f2-path4" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.7s"
                    />
                  </circle>

                  {/* Data sources - clean solid boxes (rendered after dots so they appear on top) */}
                  <g>
                    <line
                      x1="50"
                      y1="125"
                      x2="115"
                      y2="152"
                      stroke={dataColors.marketing}
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animated-dash"
                    />
                    <rect
                      x="5"
                      y="108"
                      width="60"
                      height="35"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.marketing}
                      strokeWidth="1.5"
                    />
                    <text
                      x="35"
                      y="130"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill={dataColors.marketing}
                    >
                      Ad Spend
                    </text>
                  </g>

                  <g>
                    <line
                      x1="50"
                      y1="205"
                      x2="115"
                      y2="178"
                      stroke={dataColors.customers}
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animated-dash"
                    />
                    <rect
                      x="5"
                      y="188"
                      width="60"
                      height="35"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.customers}
                      strokeWidth="1.5"
                    />
                    <text
                      x="35"
                      y="210"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill={dataColors.customers}
                    >
                      Churn
                    </text>
                  </g>

                  <g>
                    <line
                      x1="270"
                      y1="145"
                      x2="205"
                      y2="158"
                      stroke={dataColors.revenue}
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animated-dash"
                    />
                    <rect
                      x="255"
                      y="128"
                      width="55"
                      height="35"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.revenue}
                      strokeWidth="1.5"
                    />
                    <text
                      x="282"
                      y="150"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill={dataColors.revenue}
                    >
                      LTV
                    </text>
                  </g>

                  <g>
                    <line
                      x1="270"
                      y1="195"
                      x2="205"
                      y2="172"
                      stroke={dataColors.finance}
                      strokeOpacity="0.5"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="animated-dash"
                    />
                    <rect
                      x="255"
                      y="178"
                      width="55"
                      height="35"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.finance}
                      strokeWidth="1.5"
                    />
                    <text
                      x="282"
                      y="200"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="500"
                      fill={dataColors.finance}
                    >
                      CAC
                    </text>
                  </g>

                  <path
                    d="M160 215 L160 250"
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="animated-dash"
                    style={{ animationDelay: '0.5s' }}
                  />
                  <polygon points="156,250 160,260 164,250" fill="rgba(245, 158, 11, 0.5)" />

                  {/* Animated dot going down to answer */}
                  <circle r="3" fill="rgba(245, 158, 11, 0.9)">
                    <animateMotion dur="1.5s" repeatCount="indefinite" begin="2.5s">
                      <mpath href="#f2-arrow-up" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.5s"
                      repeatCount="indefinite"
                      begin="2.5s"
                    />
                  </circle>

                  <g transform="translate(15, 270)">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="130"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(245, 158, 11, 0.3)"
                      strokeWidth="1.5"
                    />
                    <text x="14" y="20" fontSize="10" fill={textSecondary}>
                      Midas answers:
                    </text>
                    <text x="14" y="42" fontSize="13" fontWeight="500" fill="rgba(245, 158, 11, 1)">
                      Focus on churn reduction first.
                    </text>
                    <text x="14" y="62" fontSize="10" fill={textSecondary}>
                      Your CAC is $340 but LTV dropped 18% last quarter.
                    </text>
                    <text x="14" y="78" fontSize="10" fill={textSecondary}>
                      Reducing churn by 2% adds $127K ARR — more
                    </text>
                    <text x="14" y="94" fontSize="10" fill={textSecondary}>
                      efficient than equivalent ad spend at current ROAS.
                    </text>
                    <line
                      x1="14"
                      y1="106"
                      x2="276"
                      y2="106"
                      stroke={cardBorder}
                      strokeWidth="0.5"
                    />
                    <text x="14" y="120" fontSize="9" fill={textSecondary}>
                      Based on: LTV trends • CAC • Churn rate • ROAS history
                    </text>
                    {/* Processing dots */}
                    <circle cx="255" cy="20" r="2" fill="rgba(245, 158, 11, 0.6)" />
                    <circle cx="263" cy="20" r="2" fill="rgba(245, 158, 11, 0.6)" />
                    <circle cx="271" cy="20" r="2" fill="rgba(245, 158, 11, 0.6)" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2 max-w-md mx-auto lg:mx-0 lg:mr-auto">
              <h3
                className="text-[36px] sm:text-[40px] font-normal theme-text-primary mb-5 leading-[1.1]"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Talk to your <em className="italic">business</em>, not your tools
              </h3>
              <div className="w-16 h-px bg-amber-500/40 mb-5" />
              <p
                className="text-lg sm:text-xl leading-relaxed theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                You shouldn't need to translate what you want to know into filters and dashboard
                clicks. <span className="highlight-text font-medium">Ask Midas anything</span> and
                it{' '}
                <span className="highlight-text font-medium">
                  analyzes across your entire stack
                </span>{' '}
                to give you a real answer.
              </p>
            </div>
          </div>
        </div>

        {/* ============ FEATURE 3: KNOW WHAT NEEDS YOUR ATTENTION ============ */}
        <div
          className="feature-panel rounded-2xl"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            position: 'relative',
            zIndex: 40,
            isolation: 'isolate',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32 p-6 sm:p-10 lg:p-12 items-center min-h-[550px] lg:min-h-[620px]">
            {/* Text */}
            <div className="order-1 lg:order-1 lg:text-right max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <h3
                className="text-[36px] sm:text-[40px] font-normal theme-text-primary mb-5 leading-[1.1]"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Know what needs your <em className="italic">attention</em>
              </h3>
              <div className="w-16 h-px bg-amber-500/40 mb-5 lg:ml-auto" />
              <p
                className="text-lg sm:text-xl leading-relaxed theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                Your business generates more data than you can review.{' '}
                <span className="highlight-text font-medium">Midas isolates what matters</span> -
                changes, risks, and opportunities that need your attention right now.
              </p>
            </div>

            {/* Visualization */}
            <div className="order-2 lg:order-2 flex items-center justify-center lg:justify-start pb-8">
              <div className="w-full max-w-[460px] aspect-[5/4]">
                <svg viewBox="0 0 460 370" className="w-full h-full" fill="none">
                  {/* Path definitions for animated dots */}
                  <defs>
                    <path id="f3-in1" d="M80 55 Q120 80 150 140" />
                    <path id="f3-in2" d="M80 115 Q120 130 150 155" />
                    <path id="f3-in3" d="M80 175 Q120 175 150 170" />
                    <path id="f3-in4" d="M80 235 Q120 220 150 190" />
                    <path id="f3-in5" d="M80 295 Q120 270 150 210" />
                    <path id="f3-out1" d="M212 155 Q250 125 290 100" />
                    <path id="f3-out2" d="M212 175 Q250 175 290 175" />
                    <path id="f3-out3" d="M212 195 Q250 225 290 250" />
                  </defs>

                  {/* Data source boxes - clean solid style */}
                  <g className="pulse-node">
                    <rect
                      x="10"
                      y="35"
                      width="70"
                      height="40"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.revenue}
                      strokeWidth="1.5"
                    />
                    <text
                      x="45"
                      y="60"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.revenue}
                    >
                      Revenue
                    </text>
                  </g>
                  <path
                    d="M80 55 Q120 80 150 140"
                    stroke={dataColors.revenue}
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animated-dash"
                  />
                  {/* Animated dot */}
                  <circle r="3" fill={dataColors.revenue}>
                    <animateMotion dur="2s" repeatCount="indefinite">
                      <mpath href="#f3-in1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <g className="pulse-node" style={{ animationDelay: '0.4s' }}>
                    <rect
                      x="10"
                      y="95"
                      width="70"
                      height="40"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.customers}
                      strokeWidth="1.5"
                    />
                    <text
                      x="45"
                      y="120"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.customers}
                    >
                      Customers
                    </text>
                  </g>
                  <path
                    d="M80 115 Q120 130 150 155"
                    stroke={dataColors.customers}
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animated-dash"
                    style={{ animationDelay: '0.4s' }}
                  />
                  <circle r="3" fill={dataColors.customers}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="0.4s">
                      <mpath href="#f3-in2" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.4s"
                    />
                  </circle>

                  <g className="pulse-node" style={{ animationDelay: '0.8s' }}>
                    <rect
                      x="10"
                      y="155"
                      width="70"
                      height="40"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.marketing}
                      strokeWidth="1.5"
                    />
                    <text
                      x="45"
                      y="180"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.marketing}
                    >
                      Marketing
                    </text>
                  </g>
                  <path
                    d="M80 175 Q120 175 150 170"
                    stroke={dataColors.marketing}
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animated-dash"
                    style={{ animationDelay: '0.8s' }}
                  />
                  <circle r="3" fill={dataColors.marketing}>
                    <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.8s">
                      <mpath href="#f3-in3" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.8s"
                      repeatCount="indefinite"
                      begin="0.8s"
                    />
                  </circle>

                  <g className="pulse-node" style={{ animationDelay: '1.2s' }}>
                    <rect
                      x="10"
                      y="215"
                      width="70"
                      height="40"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.operations}
                      strokeWidth="1.5"
                    />
                    <text
                      x="45"
                      y="240"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.operations}
                    >
                      Operations
                    </text>
                  </g>
                  <path
                    d="M80 235 Q120 220 150 190"
                    stroke={dataColors.operations}
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animated-dash"
                    style={{ animationDelay: '1.2s' }}
                  />
                  <circle r="3" fill={dataColors.operations}>
                    <animateMotion dur="2s" repeatCount="indefinite" begin="1.2s">
                      <mpath href="#f3-in4" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.2s"
                    />
                  </circle>

                  <g className="pulse-node" style={{ animationDelay: '1.6s' }}>
                    <rect
                      x="10"
                      y="275"
                      width="70"
                      height="40"
                      rx="6"
                      fill={dataBoxBg}
                      stroke={dataColors.finance}
                      strokeWidth="1.5"
                    />
                    <text
                      x="45"
                      y="300"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill={dataColors.finance}
                    >
                      Finance
                    </text>
                  </g>
                  <path
                    d="M80 295 Q120 270 150 210"
                    stroke={dataColors.finance}
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="animated-dash"
                    style={{ animationDelay: '1.6s' }}
                  />
                  <circle r="3" fill={dataColors.finance}>
                    <animateMotion dur="2.2s" repeatCount="indefinite" begin="1.6s">
                      <mpath href="#f3-in5" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2.2s"
                      repeatCount="indefinite"
                      begin="1.6s"
                    />
                  </circle>

                  {/* Central Midas - with glow */}
                  <g className="hub-glow">
                    <image
                      href="/images/hero/logo_gold_new.svg"
                      x="158"
                      y="148"
                      width="54"
                      height="54"
                    />
                  </g>

                  {/* Output paths */}
                  <path
                    d="M212 155 Q250 125 290 100"
                    stroke="rgba(245, 158, 11, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                    className="animated-dash"
                  />
                  <path
                    d="M212 175 Q250 175 290 175"
                    stroke="rgba(245, 158, 11, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                    className="animated-dash"
                    style={{ animationDelay: '0.6s' }}
                  />
                  <path
                    d="M212 195 Q250 225 290 250"
                    stroke="rgba(245, 158, 11, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                    className="animated-dash"
                    style={{ animationDelay: '1.2s' }}
                  />

                  {/* Animated dots going to alert cards */}
                  <circle r="3" fill="rgba(239, 68, 68, 0.9)">
                    <animateMotion dur="2s" repeatCount="indefinite" begin="0.5s">
                      <mpath href="#f3-out1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="0.5s"
                    />
                  </circle>
                  <circle r="3" fill="rgba(245, 158, 11, 0.9)">
                    <animateMotion dur="1.8s" repeatCount="indefinite" begin="1.2s">
                      <mpath href="#f3-out2" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.8s"
                      repeatCount="indefinite"
                      begin="1.2s"
                    />
                  </circle>
                  <circle r="3" fill="rgba(16, 185, 129, 0.9)">
                    <animateMotion dur="2s" repeatCount="indefinite" begin="1.8s">
                      <mpath href="#f3-out3" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="2s"
                      repeatCount="indefinite"
                      begin="1.8s"
                    />
                  </circle>

                  {/* Alert cards with status indicators and pulse animation */}
                  <g transform="translate(295, 55)">
                    <rect
                      x="0"
                      y="0"
                      width="155"
                      height="75"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(239, 68, 68, 0.5)"
                      strokeWidth="1.5"
                    />
                    <rect x="8" y="8" width="4" height="30" rx="2" fill="rgba(239, 68, 68, 0.8)" />
                    <text x="20" y="24" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Cash flow alert
                    </text>
                    <text x="20" y="42" fontSize="11" fill={textSecondary}>
                      $48K exceeds balance
                    </text>
                    <text x="20" y="60" fontSize="11" fill="rgba(245, 158, 11, 0.9)">
                      → Collect receivables
                    </text>
                  </g>

                  <g transform="translate(295, 145)">
                    <rect
                      x="0"
                      y="0"
                      width="155"
                      height="65"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(245, 158, 11, 0.4)"
                      strokeWidth="1.5"
                    />
                    <rect x="8" y="8" width="4" height="25" rx="2" fill="rgba(245, 158, 11, 0.8)" />
                    <text x="20" y="22" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Inventory low
                    </text>
                    <text x="20" y="40" fontSize="11" fill={textSecondary}>
                      SKU #2847 — 12 units
                    </text>
                    <text x="20" y="55" fontSize="11" fill="rgba(245, 158, 11, 0.9)">
                      → Reorder now
                    </text>
                  </g>

                  <g transform="translate(295, 225)">
                    <rect
                      x="0"
                      y="0"
                      width="155"
                      height="75"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(16, 185, 129, 0.4)"
                      strokeWidth="1.5"
                    />
                    <rect x="8" y="8" width="4" height="30" rx="2" fill="rgba(16, 185, 129, 0.8)" />
                    <text x="20" y="24" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Campaign winning
                    </text>
                    <text x="20" y="42" fontSize="11" fill={textSecondary}>
                      ROAS 4.2x (+67%)
                    </text>
                    <text x="20" y="60" fontSize="11" fill="rgba(245, 158, 11, 0.9)">
                      → Increase budget
                    </text>
                  </g>

                  <text x="372" y="325" textAnchor="middle" fontSize="9" fill={textSecondary}>
                    + 52 more filtered
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ============ FEATURE 4: IDENTIFYING ISSUES IS JUST THE START ============ */}
        <div
          className="feature-panel rounded-2xl"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            position: 'relative',
            zIndex: 40,
            isolation: 'isolate',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32 p-6 sm:p-10 lg:p-12 items-center min-h-[550px] lg:min-h-[620px]">
            {/* Visualization */}
            <div className="order-2 lg:order-1 flex items-center justify-center lg:justify-end pb-8">
              <div className="w-full max-w-[380px] aspect-[4/5]">
                <svg viewBox="0 0 320 420" className="w-full h-full" fill="none">
                  {/* Path for animated arrow */}
                  <defs>
                    <path id="f4-arrow1" d="M160 92 L160 122" />
                  </defs>

                  {/* Issue detected card */}
                  <g transform="translate(15, 15)">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="72"
                      rx="10"
                      fill={dataBoxBg}
                      stroke="rgba(239, 68, 68, 0.5)"
                      strokeWidth="1.5"
                    />
                    <rect x="8" y="10" width="4" height="52" rx="2" fill="rgba(239, 68, 68, 0.8)" />
                    <text x="22" y="28" fontSize="9" fontWeight="500" fill={textSecondary}>
                      ISSUE DETECTED
                    </text>
                    <text x="22" y="48" fontSize="12" fontWeight="500" fill={textPrimary}>
                      $48K overdue from 3 customers
                    </text>
                    <text x="22" y="64" fontSize="9" fill={textSecondary}>
                      Runway impact: -15 days
                    </text>
                  </g>

                  <path
                    d="M160 92 L160 112"
                    stroke="rgba(245, 158, 11, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="animated-dash"
                  />
                  <polygon points="156,112 160,122 164,112" fill="rgba(245, 158, 11, 0.5)" />

                  {/* Animated dot going down */}
                  <circle r="3" fill="rgba(245, 158, 11, 0.9)">
                    <animateMotion dur="1.5s" repeatCount="indefinite">
                      <mpath href="#f4-arrow1" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <text
                    x="160"
                    y="142"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="rgba(245, 158, 11, 1)"
                  >
                    MIDAS GENERATES ACTIONS
                  </text>

                  {/* Action cards with staggered highlight animation */}
                  <g transform="translate(15, 158)" className="card-highlight">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="58"
                      rx="8"
                      fill={dataBoxBg}
                      stroke={cardBorder}
                      strokeWidth="1.5"
                    />
                    <text x="14" y="24" fontSize="12" fontWeight="600" fill="rgba(245, 158, 11, 1)">
                      1.
                    </text>
                    <text x="32" y="24" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Email Acme Corp
                    </text>
                    <text x="32" y="42" fontSize="9" fill={textSecondary}>
                      Invoice #4821 • $24K • 31 days overdue
                    </text>
                    <rect
                      x="230"
                      y="18"
                      width="50"
                      height="22"
                      rx="4"
                      fill="rgba(245, 158, 11, 0.15)"
                    />
                    <text
                      x="255"
                      y="33"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="rgba(245, 158, 11, 1)"
                    >
                      +8 days
                    </text>
                  </g>

                  <g
                    transform="translate(15, 226)"
                    className="card-highlight"
                    style={{ animationDelay: '1s' }}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="55"
                      rx="8"
                      fill={dataBoxBg}
                      stroke={cardBorder}
                      strokeWidth="1.5"
                    />
                    <text
                      x="14"
                      y="22"
                      fontSize="12"
                      fontWeight="600"
                      fill="rgba(245, 158, 11, 0.8)"
                    >
                      2.
                    </text>
                    <text x="32" y="22" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Call TechStart Inc
                    </text>
                    <text x="32" y="40" fontSize="9" fill={textSecondary}>
                      $16K • Contact: Sarah Chen
                    </text>
                    <rect
                      x="230"
                      y="16"
                      width="50"
                      height="22"
                      rx="4"
                      fill="rgba(245, 158, 11, 0.1)"
                    />
                    <text
                      x="255"
                      y="31"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="rgba(245, 158, 11, 0.8)"
                    >
                      +5 days
                    </text>
                  </g>

                  <g
                    transform="translate(15, 291)"
                    className="card-highlight"
                    style={{ animationDelay: '2s' }}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="55"
                      rx="8"
                      fill={dataBoxBg}
                      stroke={cardBorder}
                      strokeWidth="1.5"
                    />
                    <text
                      x="14"
                      y="22"
                      fontSize="12"
                      fontWeight="600"
                      fill="rgba(245, 158, 11, 0.6)"
                    >
                      3.
                    </text>
                    <text x="32" y="22" fontSize="11" fontWeight="500" fill={textPrimary}>
                      Payment plan — DataFlow
                    </text>
                    <text x="32" y="40" fontSize="9" fill={textSecondary}>
                      $8K • 3 payments of $2,667
                    </text>
                    <rect
                      x="230"
                      y="16"
                      width="50"
                      height="22"
                      rx="4"
                      fill="rgba(245, 158, 11, 0.08)"
                    />
                    <text
                      x="255"
                      y="31"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="rgba(245, 158, 11, 0.6)"
                    >
                      +2 days
                    </text>
                  </g>

                  {/* Summary card with glow effect */}
                  <g transform="translate(15, 360)" className="hub-glow">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="50"
                      rx="8"
                      fill={dataBoxBg}
                      stroke="rgba(245, 158, 11, 0.3)"
                      strokeWidth="1.5"
                    />
                    <text x="14" y="22" fontSize="10" fill={textSecondary}>
                      Total recovery:
                    </text>
                    <text x="14" y="40" fontSize="12" fontWeight="600" fill="rgba(245, 158, 11, 1)">
                      $48,000 • +15 days runway
                    </text>
                  </g>
                </svg>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2 max-w-md mx-auto lg:mx-0 lg:mr-auto">
              <h3
                className="text-[36px] sm:text-[40px] font-normal theme-text-primary mb-5 leading-[1.1]"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Identifying issues is <em className="italic">just the start</em>
              </h3>
              <div className="w-16 h-px bg-amber-500/40 mb-5" />
              <p
                className="text-lg sm:text-xl leading-relaxed theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                <span className="highlight-text font-medium">Midas delivers specific actions</span>{' '}
                with clear impact projections, so you{' '}
                <span className="highlight-text font-medium">execute on what drives growth</span>{' '}
                instead of just seeing the problem.
              </p>
            </div>
          </div>
        </div>

        {/* ============ FEATURE 5: ANY REPORT IN SECONDS ============ */}
        <div
          className="feature-panel rounded-2xl"
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorder}`,
            position: 'relative',
            zIndex: 40,
            isolation: 'isolate',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-32 p-6 sm:p-10 lg:p-12 items-center min-h-[550px] lg:min-h-[620px]">
            {/* Text */}
            <div className="order-1 lg:order-1 lg:text-right max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <h3
                className="text-[36px] sm:text-[40px] font-normal theme-text-primary mb-5 leading-[1.1]"
                style={{ fontFamily: 'var(--font-eb-garamond)', fontWeight: 400 }}
              >
                Any report in <em className="italic">seconds</em>
              </h3>
              <div className="w-16 h-px bg-amber-500/40 mb-5 lg:ml-auto" />
              <p
                className="text-lg sm:text-xl leading-relaxed theme-text-secondary"
                style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 300 }}
              >
                <span className="highlight-text font-medium">Generate comprehensive reports</span>,
                internal materials, or investor updates{' '}
                <span className="highlight-text font-medium">
                  instantly with full context and analysis
                </span>{' '}
                built in. Everything is export-ready and formatted,{' '}
                <span className="highlight-text font-medium">eliminating the decision lag</span>.
              </p>
            </div>

            {/* Visualization */}
            <div className="order-2 lg:order-2 flex items-center justify-center lg:justify-start pb-8">
              <div className="w-full max-w-[380px] aspect-[4/5]">
                <svg viewBox="0 0 320 400" className="w-full h-full" fill="none">
                  {/* Report document */}
                  <g transform="translate(15, 15)">
                    <rect
                      x="0"
                      y="0"
                      width="290"
                      height="340"
                      rx="12"
                      fill={dataBoxBg}
                      stroke={cardBorder}
                      strokeWidth="1.5"
                    />

                    {/* Header section */}
                    <line x1="18" y1="50" x2="272" y2="50" stroke={cardBorder} strokeWidth="1" />

                    {/* Document title and Midas logo in top right */}
                    <text x="18" y="30" fontSize="14" fontWeight="600" fill={textPrimary}>
                      Q4 Investor Update
                    </text>
                    <g>
                      <image
                        href="/images/hero/logo_gold_new.svg"
                        x="252"
                        y="12"
                        width="26"
                        height="26"
                        opacity="0.6"
                      />
                    </g>

                    {/* Metrics row */}
                    <g transform="translate(18, 62)">
                      <rect
                        x="0"
                        y="0"
                        width="76"
                        height="50"
                        rx="8"
                        fill={dataBoxBg}
                        stroke={cardBorder}
                        strokeWidth="1"
                      />
                      <text x="38" y="18" textAnchor="middle" fontSize="8" fill={textSecondary}>
                        Revenue
                      </text>
                      <text
                        x="38"
                        y="38"
                        textAnchor="middle"
                        fontSize="15"
                        fontWeight="600"
                        fill={accentColor}
                      >
                        $2.4M
                      </text>
                    </g>

                    <g transform="translate(107, 62)">
                      <rect
                        x="0"
                        y="0"
                        width="76"
                        height="50"
                        rx="8"
                        fill={dataBoxBg}
                        stroke={cardBorder}
                        strokeWidth="1"
                      />
                      <text x="38" y="18" textAnchor="middle" fontSize="8" fill={textSecondary}>
                        Growth
                      </text>
                      <text
                        x="38"
                        y="38"
                        textAnchor="middle"
                        fontSize="15"
                        fontWeight="600"
                        fill={accentColor}
                      >
                        +34%
                      </text>
                    </g>

                    <g transform="translate(196, 62)">
                      <rect
                        x="0"
                        y="0"
                        width="76"
                        height="50"
                        rx="8"
                        fill={dataBoxBg}
                        stroke={cardBorder}
                        strokeWidth="1"
                      />
                      <text x="38" y="18" textAnchor="middle" fontSize="8" fill={textSecondary}>
                        Runway
                      </text>
                      <text
                        x="38"
                        y="38"
                        textAnchor="middle"
                        fontSize="15"
                        fontWeight="600"
                        fill={accentColor}
                      >
                        18mo
                      </text>
                    </g>

                    {/* Chart section with drawing animation */}
                    <g transform="translate(18, 138)">
                      <text x="0" y="0" fontSize="10" fontWeight="500" fill={textPrimary}>
                        Revenue Trend
                      </text>
                      <g transform="translate(0, 12)">
                        {/* Grid lines */}
                        <line x1="0" y1="55" x2="150" y2="55" stroke={cardBorder} strokeWidth="1" />
                        <line
                          x1="0"
                          y1="35"
                          x2="150"
                          y2="35"
                          stroke={cardBorder}
                          strokeWidth="0.5"
                          strokeDasharray="3 5"
                        />
                        <line
                          x1="0"
                          y1="15"
                          x2="150"
                          y2="15"
                          stroke={cardBorder}
                          strokeWidth="0.5"
                          strokeDasharray="3 5"
                        />

                        {/* Animated fill area */}
                        <path fill={accentColor12}>
                          <animate
                            attributeName="d"
                            dur="6s"
                            repeatCount="indefinite"
                            values="
                              M0,50 L150,50 L150,55 L0,55 Z;
                              M0,50 L150,50 L150,55 L0,55 Z;
                              M0,50 L150,44 L150,55 L0,55 Z;
                              M0,50 L75,44 L150,48 L150,55 L0,55 Z;
                              M0,50 L50,44 L100,48 L150,35 L150,55 L0,55 Z;
                              M0,50 L37,44 L75,48 L112,35 L150,30 L150,55 L0,55 Z;
                              M0,50 L30,44 L60,48 L90,35 L120,30 L150,20 L150,55 L0,55 Z;
                              M0,50 L25,44 L50,48 L75,35 L100,30 L125,20 L150,10 L150,55 L0,55 Z;
                              M0,50 L25,44 L50,48 L75,35 L100,30 L125,20 L150,10 L150,55 L0,55 Z;
                              M0,50 L150,50 L150,55 L0,55 Z"
                            keyTimes="0; 0.03; 0.15; 0.27; 0.39; 0.51; 0.63; 0.75; 0.85; 1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;1;1;1;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </path>

                        {/* Animated line */}
                        <polyline
                          fill="none"
                          stroke={accentColor80}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <animate
                            attributeName="points"
                            dur="6s"
                            repeatCount="indefinite"
                            values="
                              0,50 150,50;
                              0,50 150,50;
                              0,50 150,44;
                              0,50 75,44 150,48;
                              0,50 50,44 100,48 150,35;
                              0,50 37,44 75,48 112,35 150,30;
                              0,50 30,44 60,48 90,35 120,30 150,20;
                              0,50 25,44 50,48 75,35 100,30 125,20 150,10;
                              0,50 25,44 50,48 75,35 100,30 125,20 150,10;
                              0,50 150,50"
                            keyTimes="0; 0.03; 0.15; 0.27; 0.39; 0.51; 0.63; 0.75; 0.85; 1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;1;1;1;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </polyline>

                        {/* Dot 1 - starts at end, shifts left as more appear */}
                        <circle r="3" fill={accentColor60}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;75;50;37;30;25;25;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;44;44;44;44;44;44;44;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;1;1;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Dot 2 */}
                        <circle r="3" fill={accentColor60}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;150;100;75;60;50;50;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;50;48;48;48;48;48;48;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;0;1;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Dot 3 */}
                        <circle r="3" fill={accentColor60}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;150;150;112;90;75;75;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;50;50;35;35;35;35;35;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;0;0;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Dot 4 */}
                        <circle r="3" fill={accentColor60}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;150;150;150;120;100;100;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;50;50;50;30;30;30;30;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;0;0;0;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Dot 5 */}
                        <circle r="3" fill={accentColor60}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;150;150;150;150;125;125;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;50;50;50;50;20;20;20;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;0;0;0;0;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Dot 6 - final, larger */}
                        <circle r="4" fill={accentColor}>
                          <animate
                            attributeName="cx"
                            dur="6s"
                            repeatCount="indefinite"
                            values="150;150;150;150;150;150;150;150;150;150"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                          <animate
                            attributeName="cy"
                            dur="6s"
                            repeatCount="indefinite"
                            values="50;50;50;50;50;50;50;10;10;50"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;0;0;0;0;0;0;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>

                        {/* Starting dot at origin - also fades */}
                        <circle cx="0" cy="50" r="3" fill={accentColor60}>
                          <animate
                            attributeName="opacity"
                            dur="6s"
                            repeatCount="indefinite"
                            values="0;1;1;1;1;1;1;1;0;0"
                            keyTimes="0;0.03;0.15;0.27;0.39;0.51;0.63;0.75;0.85;1"
                          />
                        </circle>
                      </g>
                    </g>

                    {/* Key insights */}
                    <g transform="translate(192, 138)">
                      <text x="0" y="0" fontSize="10" fontWeight="500" fill={textPrimary}>
                        Highlights
                      </text>
                      <g>
                        <rect x="0" y="8" width="4" height="4" rx="1" fill={accentColor80} />
                        <text x="10" y="12" fontSize="8" fill={textSecondary}>
                          MRR up 12%
                        </text>
                      </g>
                      <g>
                        <rect x="0" y="22" width="4" height="4" rx="1" fill={accentColor60} />
                        <text x="10" y="26" fontSize="8" fill={textSecondary}>
                          CAC down 8%
                        </text>
                      </g>
                      <g>
                        <rect x="0" y="36" width="4" height="4" rx="1" fill={accentColor40} />
                        <text x="10" y="40" fontSize="8" fill={textSecondary}>
                          NRR at 115%
                        </text>
                      </g>
                    </g>

                    {/* Divider line */}
                    <line x1="18" y1="225" x2="272" y2="225" stroke={cardBorder} strokeWidth="1" />

                    {/* Export button */}
                    <g transform="translate(18, 245)">
                      <rect
                        x="0"
                        y="0"
                        width="70"
                        height="28"
                        rx="6"
                        fill={accentColor15}
                        stroke={accentColor30}
                        strokeWidth="1"
                      />
                      <text
                        x="35"
                        y="18"
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="500"
                        fill={accentColor}
                      >
                        Export
                      </text>
                    </g>

                    {/* Ready status */}
                    <g transform="translate(100, 245)">
                      <circle cx="14" cy="14" r="4" fill="rgba(16, 185, 129, 0.8)" />
                      <text
                        x="26"
                        y="18"
                        fontSize="9"
                        fontWeight="500"
                        fill="rgba(16, 185, 129, 1)"
                      >
                        Ready
                      </text>
                    </g>

                    {/* Footer */}
                    <g transform="translate(18, 305)">
                      <line x1="0" y1="0" x2="254" y2="0" stroke={cardBorder} strokeWidth="0.5" />
                      <text x="0" y="18" fontSize="8" fill={textSecondary}>
                        Auto-generated • Full data lineage available
                      </text>
                      <text x="180" y="18" fontSize="8" fill={accentColor80}>
                        3.2 seconds
                      </text>
                    </g>
                  </g>

                  <text x="160" y="380" textAnchor="middle" fontSize="9" fill={textSecondary}>
                    One click to share with stakeholders
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
