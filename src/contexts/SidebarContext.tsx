'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

/**
 * Sidebar state interface
 * Manages sidebar expansion, pinning, and hover states
 */
interface SidebarState {
  expanded: boolean
  isPinned: boolean
  isHovering: boolean
}

/**
 * Sidebar actions interface
 * Provides methods to control sidebar behavior
 */
interface SidebarActions {
  toggle: () => void
  setExpanded: (value: boolean) => void
  togglePin: () => void
  setHovering: (value: boolean) => void
}

/**
 * Combined context value
 */
interface SidebarContextValue extends SidebarState, SidebarActions {}

/**
 * Context for isolated sidebar state management
 * Prevents "mother context" re-render issues by keeping sidebar state separate
 */
const SidebarContext = createContext<SidebarContextValue | undefined>(undefined)

/**
 * Provider props
 */
interface SidebarProviderProps {
  children: ReactNode
  defaultExpanded?: boolean
  defaultPinned?: boolean
}

/**
 * SidebarProvider component
 * Manages sidebar state in isolation to prevent unnecessary re-renders
 *
 * @param children - Child components that will have access to sidebar context
 * @param defaultExpanded - Initial expanded state (default: false)
 * @param defaultPinned - Initial pinned state (default: false)
 */
export function SidebarProvider({
  children,
  defaultExpanded = false,
  defaultPinned = false,
}: SidebarProviderProps) {
  // TODO: Integrate with localStorage for persistence
  // const persistedExpanded = localStorage.getItem('sidebar:expanded')
  // const persistedPinned = localStorage.getItem('sidebar:pinned')

  const [expanded, setExpandedState] = useState<boolean>(defaultExpanded)
  const [isPinned, setIsPinned] = useState<boolean>(defaultPinned)
  const [isHovering, setIsHovering] = useState<boolean>(false)

  /**
   * Toggle sidebar expanded state
   */
  const toggle = useCallback(() => {
    setExpandedState((prev) => {
      const newValue = !prev
      // TODO: Persist to localStorage
      // localStorage.setItem('sidebar:expanded', JSON.stringify(newValue))
      return newValue
    })
  }, [])

  /**
   * Set sidebar expanded state explicitly
   */
  const setExpanded = useCallback((value: boolean) => {
    setExpandedState(value)
    // TODO: Persist to localStorage
    // localStorage.setItem('sidebar:expanded', JSON.stringify(value))
  }, [])

  /**
   * Toggle sidebar pinned state
   * When pinned: sidebar pushes content
   * When unpinned: sidebar floats as overlay
   */
  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const newValue = !prev
      // TODO: Persist to localStorage
      // localStorage.setItem('sidebar:pinned', JSON.stringify(newValue))
      return newValue
    })
  }, [])

  /**
   * Set hover state for auto-expand behavior
   */
  const setHovering = useCallback((value: boolean) => {
    setIsHovering(value)
  }, [])

  const contextValue: SidebarContextValue = {
    // State
    expanded,
    isPinned,
    isHovering,
    // Actions
    toggle,
    setExpanded,
    togglePin,
    setHovering,
  }

  return <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>
}

/**
 * Custom hook to consume sidebar context
 *
 * @throws Error if used outside of SidebarProvider
 * @returns Sidebar state and actions
 *
 * @example
 * const { expanded, toggle, isPinned, togglePin } = useSidebar();
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)

  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }

  return context
}

/**
 * Type exports for external use
 */
export type { SidebarState, SidebarActions, SidebarContextValue }
