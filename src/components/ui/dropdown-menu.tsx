// src/components/ui/dropdown-menu.tsx
'use client'

import React, { useState, useRef, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Trigger mode: 'click' (default) or 'hover' */
  triggerMode?: 'click' | 'hover'
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  sideOffset = 8,
  className,
  open: controlledOpen,
  onOpenChange,
  triggerMode = 'click',
}: DropdownMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen
  const setIsOpen = isControlled ? onOpenChange! : setUncontrolledOpen

  const dropdownRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isOpen, setIsOpen])

  const handleMouseEnter = () => {
    if (triggerMode !== 'hover') return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    if (triggerMode !== 'hover') return
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 250)
  }

  const handleClick = () => {
    if (triggerMode !== 'click') return
    setIsOpen(!isOpen)
  }

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div onClick={handleClick} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 min-w-[8rem] overflow-hidden rounded-lg p-1',
            'kpi-tooltip border border-[var(--theme-card-border)]',
            'animate-in fade-in-0 zoom-in-95',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0',
            className
          )}
          style={{ marginTop: sideOffset }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button ref={ref} className={cn('outline-none', className)} {...props} />
))
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

export const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => <div ref={ref} className={cn('py-1', className)} {...props} />)
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }
>(({ className, onSelect, onClick, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
      'transition-colors hover:bg-amber-500/10 hover:text-amber-500',
      'focus:bg-amber-500/10 focus:text-amber-500',
      'theme-text-primary',
      className
    )}
    onClick={(e) => {
      onClick?.(e)
      onSelect?.()
    }}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', className)} {...props} />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-[var(--theme-card-border)]', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'
