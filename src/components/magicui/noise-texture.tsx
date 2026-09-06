'use client'

import React, { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * NoiseTexture Component Props
 *
 * @param {number} [opacity=0.08] - The opacity of the noise texture (0-1)
 * @param {number} [baseFrequency=0.65] - The frequency of the noise (higher = finer grain)
 * @param {number} [numOctaves=4] - Number of octaves for the noise (more = more detail)
 * @param {string} [className] - Additional CSS classes to apply to the container
 * @param {string} [patternId] - Stable ID to prevent hydration mismatch
 */
interface NoiseTextureProps {
  opacity?: number
  baseFrequency?: number
  numOctaves?: number
  className?: string
  patternId?: string
}

/**
 * NoiseTexture Component
 *
 * A React component that creates a subtle film grain/noise texture background using SVG filters.
 * The texture automatically fills its container and is non-interactive.
 */
export function NoiseTexture({
  opacity = 0.08,
  baseFrequency = 0.65,
  numOctaves = 4,
  className,
  patternId,
}: NoiseTextureProps) {
  const generatedId = useId()
  const id = patternId ?? generatedId

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full overflow-hidden',
        className
      )}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <filter id={`${id}-noise`}>
            <feTurbulence
              type="fractalNoise"
              baseFrequency={baseFrequency}
              numOctaves={numOctaves}
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" in="noise" result="grayscale" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${id}-noise)`} opacity={opacity} />
      </svg>
    </div>
  )
}
