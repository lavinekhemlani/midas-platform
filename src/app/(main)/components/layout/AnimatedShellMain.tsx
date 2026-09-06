/* ------------------------------------------------------------------
   AnimatedShellMain
   Dashboard-exclusive background line-work
   --------------------------------------------------------------- */

'use client'

import { useId, useEffect, useMemo, useState } from 'react'

interface AnimatedShellMainProps {
  /** overall opacity profile */
  intensity?: 'subtle' | 'normal' | 'bold'
  /** fade the centre so content remains legible */
  fadeCenter?: boolean
  /** % of viewport radius that stays transparent when fadeCenter=true  */
  fadeRadius?: number
}

/* ———————————————————————————————————————————
   Procedural helpers
   ——————————————————————————————————————————— */
type Orbit = { id: string; r: number; dur: number; cw: boolean }

const makeOrbits = (): Orbit[] =>
  // three concentric “data orbits”
  [
    { r: 480, dur: 50, cw: true },
    { r: 660, dur: 65, cw: false },
    { r: 820, dur: 80, cw: true },
  ].map((o, i) => ({ ...o, id: `orb${i}` }))

export default function AnimatedShellMain({
  intensity = 'normal',
  fadeCenter = true,
  fadeRadius = 0.4,
}: AnimatedShellMainProps) {
  /* mnt flag to avoid SSR / hydration mismatch ------------------- */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const uid = useId()

  /* opacity preset ----------------------------------------------- */
  const opacity = { subtle: 0.45, normal: 0.8, bold: 1.1 }[intensity]

  /* constant geometry -------------------------------------------- */
  const orbits = useMemo(makeOrbits, [])

  /* optional hole fade-out --------------------------------------- */
  const radialMask =
    fadeCenter && fadeRadius > 0
      ? {
          WebkitMaskImage: `radial-gradient(circle at center, transparent ${
            fadeRadius * 100
          }%, black 100%)`,
          maskImage: `radial-gradient(circle at center, transparent ${
            fadeRadius * 100
          }%, black 100%)`,
        }
      : undefined

  /* ———————————————————————————————————————————
     Render
     ——————————————————————————————————————————— */
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-[1]"
      style={radialMask}
    >
      {mounted && (
        <svg
          className="absolute inset-0 w-full h-full select-none"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          style={{ opacity }}
        >
          <defs>
            {/* cool-blue gradient for lines */}
            <linearGradient
              id={`dashBlue-${uid}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#38bdf8" stopOpacity=".25" />
              <stop offset="35%" stopColor="#06b6d4" stopOpacity=".6" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity=".25" />
              <animateTransform
                attributeName="gradientTransform"
                type="rotate"
                values="0 .5 .5;360 .5 .5"
                dur="90s"
                repeatCount="indefinite"
              />
            </linearGradient>

            {/* sweeping highlight on each orbit */}
            {orbits.map((o) => (
              <linearGradient
                key={o.id}
                id={`${o.id}-sweep-${uid}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="15%" stopColor="#38bdf8" stopOpacity=".9" />
                <stop offset="30%" stopColor="#ffffff" stopOpacity="0" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="rotate"
                  values={`0 .5 .5;${o.cw ? 360 : -360} .5 .5`}
                  dur={`${o.dur}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            ))}

            {/* mask so orbits fade behind content centre */}
            <mask id={`shellMask-${uid}`}>
              <rect width="1920" height="1080" fill="white" />
              {fadeCenter && (
                <circle
                  cx="960"
                  cy="540"
                  r={420}
                  fill="black"
                  opacity="0.85"
                />
              )}
            </mask>
          </defs>

          {/* static radial grid (dashed) */}
          <g fill="none" strokeLinecap="round">
            {[220, 340, 560, 940].map((r) => (
              <circle
                key={r}
                cx="960"
                cy="540"
                r={r}
                stroke={`url(#dashBlue-${uid})`}
                strokeWidth={r % 2 ? 0.8 : 0.6}
                strokeDasharray="8 14"
              />
            ))}
          </g>

          {/* animated orbits with sweeping highlight */}
          <g fill="none" mask={`url(#shellMask-${uid})`}>
            {orbits.map((o) => (
              <circle
                key={o.id}
                cx="960"
                cy="540"
                r={o.r}
                stroke={`url(#${o.id}-sweep-${uid})`}
                strokeWidth="1.6"
              />
            ))}
          </g>

          {/* subtle cross-hair lines */}
          <g stroke={`url(#dashBlue-${uid})`} strokeWidth=".6" opacity=".35">
            <line x1="0" y1="540" x2="1920" y2="540" strokeDasharray="12 10" />
            <line x1="960" y1="0" x2="960" y2="1080" strokeDasharray="12 10" />
          </g>
        </svg>
      )}
    </div>
  )
}
