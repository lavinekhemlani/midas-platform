import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionButtonProps {
  isExpanded: boolean
  onToggle: () => void
  className?: string
}

export function CollapsibleSectionButton({
  isExpanded,
  onToggle,
  className = '',
}: CollapsibleSectionButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-0.5 hover:bg-gray-200/10 rounded transition-colors ${className}`}
    >
      {isExpanded ? (
        <ChevronDown className="w-3.5 h-3.5 theme-text-secondary" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5 theme-text-secondary" />
      )}
    </button>
  )
}
