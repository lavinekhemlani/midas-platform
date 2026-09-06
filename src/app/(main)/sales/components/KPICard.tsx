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
    <Card className="glass-luxury-card group border border-gray-200/10 hover:border-gray-200/20 hover:bg-white/[0.02] transition-all duration-300 relative overflow-hidden py-0 gap-0">
      <BackgroundPattern />
      {/* Subtle top accent line that appears on hover */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          dotColorClass
            .replace('bg-', 'bg-gradient-to-r from-transparent via-')
            .concat('/40 to-transparent')
        )}
      />
      <CardContent className="relative px-4 py-4">
        <TooltipProvider>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-[11px] font-semibold theme-text-secondary uppercase tracking-wider">
                {title}
              </p>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-3 h-3 theme-text-secondary opacity-40 cursor-help hover:opacity-80 transition-opacity duration-200" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs glass-luxury-card">
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums tracking-tight transition-transform duration-200 group-hover:translate-x-0.5',
                valueColorClass
              )}
            >
              {value}
            </p>
          </div>
          {subtitle && (
            <p className="text-[11px] theme-text-secondary mt-2.5 flex items-center gap-2">
              <span
                className={cn(
                  'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 transition-transform duration-200 group-hover:scale-125',
                  dotColorClass
                )}
              />
              <span className="opacity-80">{subtitle}</span>
            </p>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
