// src/hooks/useViewTransitionRouter.ts
'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'

export type ViewTransitionType = 'top-down-sweep' | 'radial' | 'fade' | 'none'

interface ViewTransitionOptions {
  /** The type of transition animation to use */
  type?: ViewTransitionType
  /** For radial transitions - x coordinate of origin */
  x?: number
  /** For radial transitions - y coordinate of origin */
  y?: number
}

/**
 * Custom hook that provides router navigation with View Transitions API support.
 * Enables smooth page transitions using different animation styles.
 */
export function useViewTransitionRouter() {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const navigate = useCallback(
    (href: string, options: ViewTransitionOptions = {}) => {
      const { type = 'top-down-sweep', x, y } = options

      // Check for View Transitions API support and reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const supportsViewTransitions = typeof document.startViewTransition === 'function'

      // Set transition type as a data attribute for CSS targeting
      const root = document.documentElement

      if (!supportsViewTransitions || prefersReducedMotion || type === 'none') {
        // Fallback: navigate without transition
        router.push(href)
        return
      }

      // Set the transition type for CSS
      root.setAttribute('data-view-transition', type)

      // Calculate main content area bounds for constrained sweep line
      const mainContent = document.querySelector('.dashboard-container')
      if (mainContent) {
        const rect = mainContent.getBoundingClientRect()
        root.style.setProperty('--sweep-left', `${rect.left}px`)
        root.style.setProperty('--sweep-right', `${window.innerWidth - rect.right}px`)
        root.style.setProperty('--sweep-width', `${rect.width}px`)
      }

      // Set origin coordinates for radial transitions
      if (type === 'radial' && x !== undefined && y !== undefined) {
        root.style.setProperty('--view-transition-x', `${x}px`)
        root.style.setProperty('--view-transition-y', `${y}px`)
      }

      setIsTransitioning(true)

      // Use View Transitions API
      const transition = (
        document as Document & {
          startViewTransition: (callback: () => void | Promise<void>) => {
            ready: Promise<void>
            finished: Promise<void>
            updateCallbackDone: Promise<void>
          }
        }
      ).startViewTransition(() => {
        // Use flushSync to ensure DOM updates are applied synchronously
        flushSync(() => {
          router.push(href)
        })
      })

      // Handle transition completion
      transition.finished
        .then(() => {
          setIsTransitioning(false)
          // Clean up attributes
          root.removeAttribute('data-view-transition')
          root.style.removeProperty('--view-transition-x')
          root.style.removeProperty('--view-transition-y')
          root.style.removeProperty('--sweep-left')
          root.style.removeProperty('--sweep-right')
          root.style.removeProperty('--sweep-width')
        })
        .catch(() => {
          // Transition was skipped or failed
          setIsTransitioning(false)
          root.removeAttribute('data-view-transition')
        })
    },
    [router]
  )

  return { navigate, isTransitioning }
}
