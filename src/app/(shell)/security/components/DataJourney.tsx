'use client'

import { useEffect, useRef, useState } from 'react'
import { Link2, Lock, Cpu, ShieldCheck, ArrowRight, ArrowDown } from 'lucide-react'
import { EB_Garamond, DM_Sans } from 'next/font/google'
import { useTheme } from '@/hooks/useTheme'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-sans',
})

const journeySteps = [
  { icon: Link2, label: 'Connect', desc: 'Secure OAuth integration' },
  { icon: Lock, label: 'Encrypt', desc: 'Protected in transit & at rest' },
  { icon: Cpu, label: 'Analyze', desc: 'AI processes, never stores' },
  { icon: ShieldCheck, label: 'Deliver', desc: 'Insights sent securely to you' },
]

export default function DataJourney() {
  const journeyRef = useRef<HTMLDivElement>(null)
  const [journeyProgress, setJourneyProgress] = useState(0)
  const { theme } = useTheme()

  useEffect(() => {
    const handleScroll = () => {
      if (!journeyRef.current) return
      const rect = journeyRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight

      const sectionTop = rect.top

      const startPoint = windowHeight * 0.8
      const endPoint = windowHeight * 0.3

      if (sectionTop <= startPoint && sectionTop >= endPoint - rect.height) {
        const progress = Math.min(
          1,
          Math.max(0, (startPoint - sectionTop) / (startPoint - endPoint))
        )
        setJourneyProgress(progress)
      } else if (sectionTop < endPoint - rect.height) {
        setJourneyProgress(1)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section
      ref={journeyRef}
      className="relative py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12 overflow-hidden"
    >
      <div className="max-w-5xl 2xl:max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-3 font-light ${ebGaramond.className}`}
          >
            Your Data&apos;s
            <span
              className="italic bg-clip-text text-transparent pl-[0.18em] pr-[0.15em]"
              style={{
                backgroundImage:
                  theme === 'light'
                    ? 'linear-gradient(to right, #CF6900, #CF6900)'
                    : 'linear-gradient(to right, #f59e0b, #d97706)',
              }}
            >
              Journey
            </span>
          </h2>
          <p
            className="text-lg 2xl:text-xl theme-text-secondary max-w-lg 2xl:max-w-xl mx-auto"
            style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
          >
            Protected at every step, from connection to insight.
          </p>
        </div>

        {/* Journey Steps - Desktop horizontal layout */}
        <div className="hidden sm:flex flex-wrap justify-center items-start gap-0">
          {journeySteps.map((step, index) => {
            const isActive = journeyProgress >= index / (journeySteps.length - 1)
            const Icon = step.icon
            const showArrow = index < journeySteps.length - 1
            return (
              <div key={index} className="flex items-start">
                <div
                  className={`flex flex-col items-center text-center transition-all duration-500 w-[120px] 2xl:w-[150px] ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`relative w-20 h-20 2xl:w-24 2xl:h-24 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
                      isActive
                        ? 'bg-amber-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20'
                        : 'bg-amber-500/10 border border-amber-500/30'
                    }`}
                  >
                    <Icon
                      className={`w-8 h-8 2xl:w-10 2xl:h-10 transition-colors duration-500 ${
                        isActive
                          ? 'text-amber-600 theme-dark:text-amber-500'
                          : 'text-amber-700 theme-dark:text-amber-500/70'
                      }`}
                      strokeWidth={1.5}
                    />
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-pulse" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium mb-1 transition-colors duration-500 ${dmSans.className} ${
                      isActive ? 'theme-text-primary' : 'theme-text-secondary'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`text-xs theme-text-secondary leading-tight ${dmSans.className}`}
                  >
                    {step.desc}
                  </span>
                </div>

                {/* Arrow between steps */}
                {showArrow && (
                  <div className="flex items-center justify-center w-10 lg:w-14 2xl:w-20 h-20 2xl:h-24">
                    <ArrowRight
                      className={`w-5 h-5 transition-all duration-500 ${
                        isActive
                          ? 'text-amber-600 theme-dark:text-amber-500'
                          : 'text-amber-600/40 theme-dark:text-amber-500/20'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Journey Steps - Mobile vertical layout */}
        <div className="sm:hidden flex flex-col items-center gap-0">
          {journeySteps.map((step, index) => {
            const isActive = journeyProgress >= index / (journeySteps.length - 1)
            const Icon = step.icon
            const showArrow = index < journeySteps.length - 1
            return (
              <div key={index} className="flex flex-col items-center">
                <div
                  className={`flex flex-col items-center text-center transition-all duration-500 ${
                    isActive ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div
                    className={`relative w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-all duration-500 ${
                      isActive
                        ? 'bg-amber-500/20 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20'
                        : 'bg-amber-500/10 border border-amber-500/30'
                    }`}
                  >
                    <Icon
                      className={`w-7 h-7 transition-colors duration-500 ${
                        isActive
                          ? 'text-amber-600 theme-dark:text-amber-500'
                          : 'text-amber-700 theme-dark:text-amber-500/70'
                      }`}
                      strokeWidth={1.5}
                    />
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-pulse" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium mb-1 transition-colors duration-500 ${
                      isActive ? 'theme-text-primary' : 'theme-text-secondary'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span
                    className={`text-xs theme-text-secondary leading-tight ${dmSans.className}`}
                  >
                    {step.desc}
                  </span>
                </div>
                {showArrow && (
                  <div className="flex items-center justify-center py-3">
                    <ArrowDown
                      className={`w-5 h-5 transition-all duration-500 ${
                        isActive
                          ? 'text-amber-600 theme-dark:text-amber-500'
                          : 'text-amber-600/40 theme-dark:text-amber-500/20'
                      }`}
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
