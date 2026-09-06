// src/hooks/useTheme.ts
'use client'

import { useEffect, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'

export type Theme = 'light' | 'dark'

export interface ThemeTransitionOptions {
  x?: number
  y?: number
}

declare global {
  interface Window {
    __zenithThemeTimeout?: number
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light') // Default theme
  const [mounted, setMounted] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const getCurrentTheme = useCallback((): Theme => {
    if (typeof window === 'undefined') return 'light' // Default for SSR or if window not avail
    const htmlClasses = document.documentElement.classList
    if (htmlClasses.contains('theme-light')) return 'light'
    if (htmlClasses.contains('theme-dark')) return 'dark'
    // Check localStorage as a fallback or primary source if class isn't on <html> yet
    const saved = localStorage.getItem('zenith-theme') as Theme | null
    if (saved && (saved === 'light' || saved === 'dark')) return saved
    return 'light' // Default to light
  }, [])

  useEffect(() => {
    const initialTheme = getCurrentTheme()
    setThemeState(initialTheme)
    // Ensure the class and attribute are set if not already by ThemeInit.tsx
    // This handles cases where localStorage might be out of sync with the initial render.
    if (!document.documentElement.classList.contains(`theme-${initialTheme}`)) {
      document.documentElement.classList.remove('theme-light', 'theme-dark')
      document.documentElement.classList.add(`theme-${initialTheme}`)
    }
    if (document.documentElement.getAttribute('data-theme') !== initialTheme) {
      document.documentElement.setAttribute('data-theme', initialTheme)
    }
    setMounted(true)

    const handleThemeChange = () => {
      const currentTheme = getCurrentTheme()
      setThemeState(currentTheme)
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          handleThemeChange()
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    window.addEventListener('storage', handleThemeChange)
    window.addEventListener('theme-changed', handleThemeChange) // Custom event from setTheme

    return () => {
      observer.disconnect()
      window.removeEventListener('storage', handleThemeChange)
      window.removeEventListener('theme-changed', handleThemeChange)
    }
  }, [getCurrentTheme])

  // Core theme application logic (without transitions)
  const applyTheme = useCallback((next: Theme) => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(`theme-${next}`)
    root.setAttribute('data-theme', next)
    localStorage.setItem('zenith-theme', next)
    setThemeState(next)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: next } }))
  }, [])

  // Main theme setter with View Transitions API support
  const setTheme = useCallback(
    (next: Theme, options?: ThemeTransitionOptions) => {
      if (isTransitioning) return

      const root = document.documentElement

      if (window.__zenithThemeTimeout) clearTimeout(window.__zenithThemeTimeout)

      // Set CSS custom properties for animation origin
      if (options?.x !== undefined && options?.y !== undefined) {
        root.style.setProperty('--theme-transition-x', `${options.x}px`)
        root.style.setProperty('--theme-transition-y', `${options.y}px`)
      } else {
        // Default to center of screen
        root.style.setProperty('--theme-transition-x', '50vw')
        root.style.setProperty('--theme-transition-y', '50vh')
      }

      // Check for View Transitions API support and reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const supportsViewTransitions = typeof document.startViewTransition === 'function'

      if (!supportsViewTransitions || prefersReducedMotion) {
        // Fallback: use existing CSS transition approach
        root.classList.add('theme-transitioning')
        setIsTransitioning(true)
        applyTheme(next)

        window.__zenithThemeTimeout = window.setTimeout(() => {
          root.classList.remove('theme-transitioning')
          setIsTransitioning(false)
          window.__zenithThemeTimeout = undefined
        }, 400)
        return
      }

      // Use View Transitions API for smooth circular animation
      setIsTransitioning(true)

      // Type assertion needed as TypeScript's native types may not be fully up to date
      const transition = (
        document as Document & {
          startViewTransition: (callback: () => void) => {
            ready: Promise<void>
            finished: Promise<void>
          }
        }
      ).startViewTransition(() => {
        flushSync(() => {
          applyTheme(next)
        })
      })

      // Handle transition completion
      transition.finished
        .then(() => {
          setIsTransitioning(false)
          // Clean up CSS custom properties
          root.style.removeProperty('--theme-transition-x')
          root.style.removeProperty('--theme-transition-y')
        })
        .catch(() => {
          // Transition was skipped or failed
          setIsTransitioning(false)
        })
    },
    [isTransitioning, applyTheme]
  )

  return { theme, setTheme, isTransitioning, mounted }
}
