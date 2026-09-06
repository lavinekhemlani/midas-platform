import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MetricTooltipProps {
  calculationTooltip?: {
    formula: string
    components?: Array<{ label: string; value: string | number; highlight?: boolean }>
  }
  tooltip?: string
  description?: string
  children: React.ReactNode
}

export function MetricTooltip({
  calculationTooltip,
  tooltip,
  description,
  children,
}: MetricTooltipProps) {
  if (!calculationTooltip) return <>{children}</>

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <span className="cursor-help">{children}</span>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="start"
          sideOffset={12}
          className="w-72 p-3 kpi-tooltip text-xs rounded-lg shadow-xl border max-w-none z-[100]"
        >
          {description && (
            <div className="mb-2 pb-2 border-b border-gray-700">
              <div className="font-semibold theme-text-primary mb-1">What it means</div>
              <div className="theme-text-secondary leading-relaxed">{description}</div>
            </div>
          )}
          <div className="font-semibold theme-text-primary mb-1">How it's calculated</div>
          <div className="theme-text-secondary leading-relaxed space-y-2">
            <div className="border-t border-gray-700 pt-2">
              <span className="font-semibold text-amber-500">Formula:</span>{' '}
              <span className="font-mono">{calculationTooltip.formula}</span>
            </div>
            {calculationTooltip.components && calculationTooltip.components.length > 0 && (
              <div className="border-t border-gray-700 pt-2">
                <div className="space-y-1">
                  {calculationTooltip.components.map((component, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex justify-between',
                        component.highlight
                          ? 'font-semibold text-cyan-400 pt-1 border-t border-gray-700'
                          : ''
                      )}
                    >
                      <span className={component.highlight ? '' : 'theme-text-secondary'}>
                        {component.label}
                      </span>
                      <span
                        className={cn(
                          'font-mono',
                          component.highlight ? 'text-cyan-400' : 'theme-text-primary'
                        )}
                      >
                        {component.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tooltip && (
              <div className="text-xs theme-text-secondary italic pt-1 border-t border-gray-700">
                {tooltip}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
