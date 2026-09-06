import { useState } from 'react'

/**
 * Hook for managing collapsible table sections in reports
 * @param initialSections - Array of section names that should be expanded by default
 * @returns Object with expandedSections Set and toggleSection function
 */
export function useCollapsibleSections(initialSections: string[] = []) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(initialSections))

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  return { expandedSections, toggleSection }
}
