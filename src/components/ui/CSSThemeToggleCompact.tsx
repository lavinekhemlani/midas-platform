// src/components/ui/CSSThemeToggleCompact.tsx
'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface CSSThemeToggleCompactProps {
  variant?: 'icon' | 'menu-item'
  onBeforeChange?: () => void
}

export default function CSSThemeToggleCompact({
  variant = 'icon',
  onBeforeChange,
}: CSSThemeToggleCompactProps) {
  const { theme, setTheme, isTransitioning, mounted } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isLight = theme === 'light'

  // Return nothing until mounted to prevent hydration mismatch
  if (!mounted) {
    return null
  }

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent event from bubbling up to parent containers
    e.stopPropagation()

    // Notify parent before changing theme (e.g., to keep dropdown open)
    onBeforeChange?.()

    // Get click position for the circular animation origin
    // If clicked via keyboard (no clientX/Y), use button center
    let x: number
    let y: number

    if (e.clientX === 0 && e.clientY === 0 && buttonRef.current) {
      // Keyboard activation - use button center
      const rect = buttonRef.current.getBoundingClientRect()
      x = rect.left + rect.width / 2
      y = rect.top + rect.height / 2
    } else {
      // Mouse click - use exact click position
      x = e.clientX
      y = e.clientY
    }

    setTheme(isLight ? 'dark' : 'light', { x, y })
  }

  // Menu item variant - full row with icon on left and toggle on right
  if (variant === 'menu-item') {
    return (
      <button
        ref={buttonRef}
        onClick={handleToggle}
        disabled={isTransitioning}
        className="flex items-center w-full px-4 py-3 text-sm font-medium theme-text-secondary hover:bg-amber-500/10 hover:text-amber-400 transition-colors"
        aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
      >
        {/* Icon on left */}
        <div className="relative w-4 h-4 mr-2">
          <Sun
            className={cn(
              'absolute inset-0 w-4 h-4 transition-all duration-300',
              isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
            )}
          />
          <Moon
            className={cn(
              'absolute inset-0 w-4 h-4 transition-all duration-300',
              isLight ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
            )}
          />
        </div>
        <span className="flex-1 text-left">Theme</span>
        {/* Toggle switch on right */}
        <div
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors duration-300',
            isLight ? 'bg-amber-500/30' : 'bg-slate-600'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300',
              isLight ? 'translate-x-4' : 'translate-x-0.5'
            )}
          />
        </div>
      </button>
    )
  }

  // Default icon variant
  return (
    <button
      ref={buttonRef}
      onClick={handleToggle}
      disabled={isTransitioning}
      className="relative w-10 h-10 flex items-center justify-center hover:opacity-80 transition-opacity"
      title={`${isLight ? 'Light' : 'Dark'} Theme`}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} theme`}
    >
      {/* Icon container with rotation animation */}
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <Sun
          className={`absolute inset-0 w-5 h-5 theme-text-secondary transition-all duration-300 ${
            isLight ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'
          }`}
        />
        {/* Moon icon */}
        <Moon
          className={`absolute inset-0 w-5 h-5 text-slate-400 transition-all duration-300 ${
            isLight ? 'opacity-0 -rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
          }`}
        />
      </div>
    </button>
  )
}
