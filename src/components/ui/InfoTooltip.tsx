'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InfoTooltipBody } from './InfoTooltipBody'
import { cn } from '@/lib/utils'

export interface CalculationTooltip {
  formula: string
  components?: Array<{ label: string; value: string | number; highlight?: boolean }>
}

export interface InfoTooltipProps {
  /** Simple string tooltip (legacy/quick mode) */
  content?: string | React.ReactNode
  /** "What it means" — displayed first */
  description?: string
  /** "How it's calculated" — formula + component breakdown with real numbers */
  calculationTooltip?: CalculationTooltip
  /** Italic data source note at bottom */
  note?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function InfoTooltip({
  content,
  description,
  calculationTooltip,
  note,
  side = 'top',
  className,
}: InfoTooltipProps) {
  const isStructured = !!(description || calculationTooltip)

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={`inline-flex items-center justify-center p-0.5 rounded-full hover:bg-white/10 transition-all duration-200 cursor-pointer ${className ?? ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Info className="w-3.5 h-3.5 text-amber-500/60 hover:text-amber-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align="start"
          sideOffset={12}
          className={cn(
            'kpi-tooltip text-xs rounded-lg shadow-xl border z-[100]',
            isStructured ? 'w-72 p-3 max-w-none' : 'max-w-xs leading-relaxed px-3 py-2'
          )}
        >
          <InfoTooltipBody
            content={content}
            description={description}
            calculationTooltip={calculationTooltip}
            note={note}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
