import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { BackgroundPattern } from './BackgroundPattern'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  tooltip: string
  subtitle?: string
  /** Theme color class for the value text (e.g., 'text-theme-green', 'text-theme-blue') */
  valueColorClass?: string
  /** Theme color class for the subtitle dot (e.g., 'bg-emerald-500', 'bg-blue-500') */
  dotColorClass?: string
}

export function KPICard({
  title,
  value,
  tooltip,
  subtitle,
  valueColorClass = 'theme-text-primary',
  dotColorClass = 'bg-gray-400',
}: KPICardProps) {
  return (
    <Card className="glass-luxury-card group border border-gray-200/10 hover:bg-white/5 transition-colors duration-200 relative overflow-hidden py-0 gap-0">
      <BackgroundPattern />
      <CardContent className="relative px-4 py-4">
        <TooltipProvider>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-medium theme-text-secondary uppercase tracking-wider">
                {title}
              </p>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 theme-text-secondary opacity-50 cursor-help hover:opacity-100 transition-opacity" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className={cn('text-2xl font-semibold tabular-nums', valueColorClass)}>{value}</p>
          </div>
          {subtitle && (
            <p className="text-xs theme-text-secondary mt-2 flex items-center gap-1.5">
              <span
                className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', dotColorClass)}
              />
              {subtitle}
            </p>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
