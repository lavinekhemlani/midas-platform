'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import { useTheme, type Theme } from '@/hooks/useTheme'

interface LightRaysProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.Ref<HTMLDivElement>
  count?: number
  color?: string
  blur?: number
  speed?: number
  length?: string
}

type LightRay = {
  id: string
  left: number
  rotate: number
  width: number
  delay: number
  duration: number
  intensity: number
}

const createRays = (count: number, cycle: number): LightRay[] => {
  if (count <= 0) return []

  // Distribute rays evenly across the width, all emanating from top center
  return Array.from({ length: count }, (_, index) => {
    // Spread rays across the viewport width (10% to 90%)
    const spreadFactor = 80 / (count - 1 || 1)
    const left = 10 + index * spreadFactor

    // All rays slant in the same direction (right-to-left angle)
    const rotate = 15 + Math.random() * 5 // Consistent slant with slight variation

    const width = 80 + Math.random() * 60
    const delay = Math.random() * cycle
    const duration = cycle * (0.8 + Math.random() * 0.4)
    const intensity = 0.4 + Math.random() * 0.3

    return {
      id: `${index}-${Math.round(left * 10)}`,
      left,
      rotate,
      width,
      delay,
      duration,
      intensity,
    }
  })
}

const Ray = ({ left, rotate, width, delay, duration, intensity }: LightRay) => {
  return (
    <motion.div
      className="pointer-events-none absolute -top-[5%] left-[var(--ray-left)] h-[var(--light-rays-length)] w-[var(--ray-width)] origin-top -translate-x-1/2 bg-gradient-to-b from-[var(--light-rays-color)] via-[color-mix(in_srgb,var(--light-rays-color)_40%,transparent)] to-transparent opacity-0 blur-[var(--light-rays-blur)]"
      style={
        {
          '--ray-left': `${left}%`,
          '--ray-width': `${width}px`,
          transform: `translateX(-50%) rotate(${rotate}deg)`,
        } as CSSProperties
      }
      animate={{
        opacity: [0, intensity, intensity * 0.7, intensity, 0],
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: delay,
        repeatDelay: duration * 0.2,
      }}
    />
  )
}

// Theme-specific color configurations (matches top gradient in main layout)
const getThemeColor = (theme: Theme): string => {
  switch (theme) {
    case 'light':
      // Light amber for light theme (complements beige background)
      return 'rgba(233, 160, 70, 0.38)'
    case 'dark':
      // Subtle cyan for dark theme
      return 'rgba(233, 146, 33, 0.15)'
    default:
      return 'rgba(34, 211, 238, 0.15)'
  }
}

export function LightRays({
  className,
  style,
  count = 7,
  color,
  blur = 36,
  speed = 14,
  length = '70vh',
  ref,
  ...props
}: LightRaysProps) {
  const [rays, setRays] = useState<LightRay[]>([])
  const { theme } = useTheme()
  const cycleDuration = Math.max(speed, 0.1)

  // Use provided color or theme-based color
  const rayColor = color ?? getThemeColor(theme)

  useEffect(() => {
    setRays(createRays(count, cycleDuration))
  }, [count, cycleDuration])

  return (
    <div
      ref={ref}
      className={cn(
        'pointer-events-none absolute inset-0 isolate overflow-hidden rounded-[inherit]',
        className
      )}
      style={
        {
          '--light-rays-color': rayColor,
          '--light-rays-blur': `${blur}px`,
          '--light-rays-length': length,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden">
        {/* Single subtle glow at the top center where rays originate */}
        <div
          aria-hidden
          className="absolute inset-x-0 -top-[10%] h-[40%] opacity-50"
          style={
            {
              background:
                'radial-gradient(ellipse 80% 50% at 50% 0%, var(--light-rays-color), transparent 70%)',
            } as CSSProperties
          }
        />
        {rays.map((ray) => (
          <Ray key={ray.id} {...ray} />
        ))}
      </div>
    </div>
  )
}
