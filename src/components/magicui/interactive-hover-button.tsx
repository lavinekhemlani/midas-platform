import React from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

export const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ children, className, style, ...props }, ref) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Light: dark button → light on hover | Dark: light button → dark on hover
  const bg = isDark ? '#eae8e5' : '#1a1a1a'
  const fg = isDark ? '#1a1a1a' : '#fafafa'
  const hoverBg = isDark ? '#1a1a1a' : '#eae8e5'
  const hoverFg = isDark ? '#fafafa' : '#1a1a1a'

  return (
    <div className="group/btn relative transition-transform duration-200 hover:scale-105">
      <button
        ref={ref}
        className={cn(
          'relative w-auto cursor-pointer overflow-hidden rounded-full p-2 px-6 text-center font-semibold shadow-lg group-hover/btn:shadow-amber-500/25 transition-all duration-300',
          className
        )}
        style={{
          ...style,
          backgroundColor: bg,
          color: fg,
          border: `1px solid ${bg}`,
        }}
        {...props}
      >
        <div
          className="absolute left-6 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full transition-all duration-300 group-hover/btn:scale-[100.8] z-0"
          style={{ backgroundColor: hoverBg }}
        />
        <span className="relative z-10 inline-block transition-all duration-300 ml-4 group-hover/btn:translate-x-12 group-hover/btn:opacity-0">
          {children}
        </span>
        <div
          className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover/btn:-translate-x-5 group-hover/btn:opacity-100"
          style={{ color: hoverFg }}
        >
          <span>{children}</span>
          <span className="w-4 h-4" />
        </div>
      </button>
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[45%] z-10 flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 group-hover/btn:scale-110"
        style={{
          backgroundColor: hoverBg,
          border: `1px solid ${bg}`,
          boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)',
        }}
      >
        <ArrowRight
          className="w-5 sm:w-7 h-5 sm:h-7"
          style={{ transform: 'rotate(-45deg)', color: bg }}
        />
      </span>
    </div>
  )
})

InteractiveHoverButton.displayName = 'InteractiveHoverButton'
