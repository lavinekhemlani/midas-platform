'use client'

import { useEffect, useRef } from 'react'
import { Shield, Lock, KeyRound, Database, Eye } from 'lucide-react'
import { brandIcons } from '@/lib/brand-icons'
import { useTheme } from '@/hooks/useTheme'
import { EB_Garamond } from 'next/font/google'

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-eb-garamond',
})

export default function SecurityHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const size = 400
    canvas.width = size
    canvas.height = size

    const centerX = size / 2
    const centerY = size / 2

    // Particle system
    const particles: Array<{
      x: number
      y: number
      size: number
      opacity: number
      speed: number
      angle: number
      radius: number
    }> = []

    // Create particles in orbital paths
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 60 + Math.random() * 100
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        speed: (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1),
        angle: angle,
        radius: radius,
      })
    }

    let animationId: number
    let time = 0

    // Theme-aware colors: #CF6900 (207, 105, 0) for light, amber-500 (245, 158, 11) for dark
    const primaryColor = theme === 'light' ? '207, 105, 0' : '245, 158, 11'
    const highlightColor = theme === 'light' ? '230, 140, 40' : '252, 211, 77'

    const animate = () => {
      ctx.clearRect(0, 0, size, size)

      // Outer glow (minimal)
      const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 180)
      outerGlow.addColorStop(0, `rgba(${primaryColor}, 0)`)
      outerGlow.addColorStop(0.5, `rgba(${primaryColor}, 0.01)`)
      outerGlow.addColorStop(0.8, `rgba(${primaryColor}, 0.02)`)
      outerGlow.addColorStop(1, `rgba(${primaryColor}, 0)`)
      ctx.fillStyle = outerGlow
      ctx.fillRect(0, 0, size, size)

      // Pulsing core glow
      const pulseScale = 1 + Math.sin(time * 0.02) * 0.1
      const coreSize = 50 * pulseScale

      // Core outer glow (reduced)
      const coreGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreSize * 1.5
      )
      coreGlow.addColorStop(0, `rgba(${primaryColor}, 0.2)`)
      coreGlow.addColorStop(0.3, `rgba(${primaryColor}, 0.08)`)
      coreGlow.addColorStop(0.6, `rgba(${primaryColor}, 0.02)`)
      coreGlow.addColorStop(1, `rgba(${primaryColor}, 0)`)
      ctx.fillStyle = coreGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, coreSize * 1.5, 0, Math.PI * 2)
      ctx.fill()

      // Core inner bright
      const coreInner = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize)
      coreInner.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      coreInner.addColorStop(0.3, `rgba(${highlightColor}, 0.5)`)
      coreInner.addColorStop(0.6, `rgba(${primaryColor}, 0.2)`)
      coreInner.addColorStop(1, `rgba(${primaryColor}, 0)`)
      ctx.fillStyle = coreInner
      ctx.beginPath()
      ctx.arc(centerX, centerY, coreSize, 0, Math.PI * 2)
      ctx.fill()

      // Orbital rings (subtle)
      ctx.strokeStyle = `rgba(${primaryColor}, 0.1)`
      ctx.lineWidth = 1
      for (let r = 80; r <= 140; r += 30) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Update and draw particles
      particles.forEach((p) => {
        // Update angle for orbital motion
        p.angle += p.speed * 0.01
        p.x = centerX + Math.cos(p.angle) * p.radius
        p.y = centerY + Math.sin(p.angle) * p.radius

        // Slight radius oscillation
        p.radius += Math.sin(time * 0.01 + p.angle) * 0.1

        // Draw particle (minimal glow)
        const particleGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
        particleGlow.addColorStop(0, `rgba(${primaryColor}, ${p.opacity * 0.6})`)
        particleGlow.addColorStop(0.6, `rgba(${primaryColor}, ${p.opacity * 0.1})`)
        particleGlow.addColorStop(1, `rgba(${primaryColor}, 0)`)
        ctx.fillStyle = particleGlow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
        ctx.fill()

        // Bright center
        ctx.fillStyle = `rgba(${highlightColor}, ${p.opacity * 0.8})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })

      time++
      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [theme])

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 2xl:py-32 px-4 sm:px-6 lg:px-8 2xl:px-12">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left: Glowing Orb Visualization */}
          <div className="w-full lg:w-[40%] flex-shrink-0 flex items-center justify-center order-2 lg:order-1 mt-8 lg:mt-0">
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="w-[300px] h-[300px] sm:w-[350px] sm:h-[350px] lg:w-[400px] lg:h-[400px] 2xl:w-[500px] 2xl:h-[500px]"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              {/* Center shield icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Shield
                  className="w-12 h-12 sm:w-14 sm:h-14 text-white/90 drop-shadow-lg"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>

          {/* Right: Content & Glossary */}
          <div className="flex-1 w-full order-1 lg:order-2 text-center sm:text-left">
            {/* Heading */}
            <h1
              className={`text-5xl sm:text-5xl lg:text-6xl theme-text-primary mb-4 font-light ${ebGaramond.className}`}
            >
              Security at
              <span
                className="italic bg-clip-text text-transparent pl-[0.18em] pr-[0.15em]"
                style={{
                  backgroundImage:
                    theme === 'light'
                      ? 'linear-gradient(to right, #CF6900, #CF6900)'
                      : 'linear-gradient(to right, #f59e0b, #d97706)',
                }}
              >
                Midas
              </span>
            </h1>

            {/* Subheading */}
            <p
              className="text-lg 2xl:text-xl theme-text-secondary mb-6"
              style={{ fontFamily: 'var(--font-dm-sans)', fontWeight: 400 }}
            >
              Your financial data deserves the highest level of protection. Here&apos;s how we keep
              it safe.
            </p>

            {/* How We Protect You - Technical */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-4 mb-6">
              <div
                className="flex flex-col items-center text-center gap-2 sm:flex-row sm:items-center sm:text-left sm:gap-3 px-3 py-3 sm:px-4 rounded-xl border border-amber-500/20 theme-light:border-amber-500/30"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
              >
                <Lock
                  className="w-5 h-5 text-amber-600 theme-dark:text-amber-500 flex-shrink-0"
                  strokeWidth={1.5}
                />
                <div>
                  <span className="text-xs sm:text-sm font-medium theme-text-primary block mb-1">
                    Encryption
                  </span>
                  <p className="text-[10px] sm:text-xs theme-text-secondary">
                    TLS 1.3 in transit, AES-256 at rest
                  </p>
                </div>
              </div>

              <div
                className="flex flex-col items-center text-center gap-2 sm:flex-row sm:items-center sm:text-left sm:gap-3 px-3 py-3 sm:px-4 rounded-xl border border-amber-500/20 theme-light:border-amber-500/30"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
              >
                <KeyRound
                  className="w-5 h-5 text-amber-600 theme-dark:text-amber-500 flex-shrink-0"
                  strokeWidth={1.5}
                />
                <div>
                  <span className="text-xs sm:text-sm font-medium theme-text-primary block mb-1">
                    Authentication
                  </span>
                  <p className="text-[10px] sm:text-xs theme-text-secondary">
                    OAuth 2.0, JWT tokens
                  </p>
                </div>
              </div>

              <div
                className="flex flex-col items-center text-center gap-2 sm:flex-row sm:items-center sm:text-left sm:gap-3 px-3 py-3 sm:px-4 rounded-xl border border-amber-500/20 theme-light:border-amber-500/30"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
              >
                <Database
                  className="w-5 h-5 text-amber-600 theme-dark:text-amber-500 flex-shrink-0"
                  strokeWidth={1.5}
                />
                <div>
                  <span className="text-xs sm:text-sm font-medium theme-text-primary block mb-1">
                    Infrastructure
                  </span>
                  <p className="text-[10px] sm:text-xs theme-text-secondary">
                    AWS with KMS encryption
                  </p>
                </div>
              </div>

              <div
                className="flex flex-col items-center text-center gap-2 sm:flex-row sm:items-center sm:text-left sm:gap-3 px-3 py-3 sm:px-4 rounded-xl border border-amber-500/20 theme-light:border-amber-500/30"
                style={{ backgroundColor: theme === 'light' ? '#FFFDFA' : '#1a1a1a' }}
              >
                <Eye
                  className="w-5 h-5 text-amber-600 theme-dark:text-amber-500 flex-shrink-0"
                  strokeWidth={1.5}
                />
                <div>
                  <span className="text-xs sm:text-sm font-medium theme-text-primary block mb-1">
                    Monitoring
                  </span>
                  <p className="text-[10px] sm:text-xs theme-text-secondary">
                    Audit logs, real-time alerts
                  </p>
                </div>
              </div>
            </div>

            {/* Infrastructure Partners */}
            {/* Mobile: Marquee scroll */}
            <div className="sm:hidden rounded-xl mt-5 border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]/50 px-4 py-3 overflow-hidden">
              <span className="text-xs theme-text-secondary uppercase tracking-wider block text-left mb-3">
                Powered by
              </span>
              <div
                className="relative w-full overflow-hidden"
                style={{
                  maskImage:
                    'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                }}
              >
                <div className="flex items-center gap-10 animate-powered-marquee">
                  {[0, 1, 2].map((dupeIdx) => (
                    <div key={dupeIdx} className="flex items-center gap-10 flex-shrink-0">
                      <img
                        src={
                          theme === 'dark'
                            ? '/images/security/PikPng.com_run-dmc-png_5240809 (1).png'
                            : brandIcons.aws.logo.dark.svg
                        }
                        alt="AWS"
                        className="h-6 opacity-80 flex-shrink-0"
                      />
                      <img
                        src={
                          theme === 'dark'
                            ? '/images/security/vercel-logo-white.svg'
                            : brandIcons.vercel.logo.dark.svg
                        }
                        alt="Vercel"
                        className="h-4 opacity-80 flex-shrink-0"
                      />
                      <img
                        src={brandIcons.stripe.logo.dark.svg}
                        alt="Stripe"
                        className="h-7 opacity-80 dark:invert dark:brightness-200 flex-shrink-0"
                      />
                      <img
                        src="/images/security/Groq Logo_Orange 25.svg"
                        alt="Groq"
                        className="h-5 opacity-80 flex-shrink-0"
                      />
                      <img
                        src={
                          theme === 'dark'
                            ? '/images/security/quickbooks-brand-preferred-logo-50-50-white-external.png'
                            : '/images/security/quickbooks-brand-preferred-logo-50-50-black-external.png'
                        }
                        alt="QuickBooks"
                        className="h-5 opacity-80 flex-shrink-0"
                      />
                      <img
                        src="/images/security/Fivetran_idsSxu5Ooy_1.svg"
                        alt="Fivetran"
                        className="h-5 object-contain opacity-80 flex-shrink-0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop: Original inline layout */}
            <div className="hidden sm:flex flex-wrap items-center gap-6 px-4 py-3 rounded-xl mt-5 border border-[var(--theme-card-border)] bg-[var(--theme-card-bg)]/50 min-h-[68px]">
              <span className="text-xs theme-text-secondary uppercase tracking-wider">
                Powered by
              </span>
              <img
                src={
                  theme === 'dark'
                    ? '/images/security/PikPng.com_run-dmc-png_5240809 (1).png'
                    : brandIcons.aws.logo.dark.svg
                }
                alt="AWS"
                className="h-6 opacity-80"
              />
              <img
                src={
                  theme === 'dark'
                    ? '/images/security/vercel-logo-white.svg'
                    : brandIcons.vercel.logo.dark.svg
                }
                alt="Vercel"
                className="h-4 opacity-80"
              />
              <img
                src={brandIcons.stripe.logo.dark.svg}
                alt="Stripe"
                className="h-7 opacity-80 dark:invert dark:brightness-200"
              />
              <img
                src="/images/security/Groq Logo_Orange 25.svg"
                alt="Groq"
                className="h-5 opacity-80"
              />
              <img
                src={
                  theme === 'dark'
                    ? '/images/security/quickbooks-brand-preferred-logo-50-50-white-external.png'
                    : '/images/security/quickbooks-brand-preferred-logo-50-50-black-external.png'
                }
                alt="QuickBooks"
                className="h-5 opacity-80"
              />
              <img
                src="/images/security/Fivetran_idsSxu5Ooy_1.svg"
                alt="Fivetran"
                className="h-5 object-contain opacity-80"
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes powered-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
        .animate-powered-marquee {
          animation: powered-marquee 15s linear infinite;
        }
      `}</style>
    </section>
  )
}
