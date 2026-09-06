'use client'

import { cn } from '@/lib/utils'
import type { CalculationTooltip } from './InfoTooltip'

export interface InfoTooltipBodyProps {
  content?: string | React.ReactNode
  description?: string
  calculationTooltip?: CalculationTooltip
  note?: string
}

export function InfoTooltipBody({
  content,
  description,
  calculationTooltip,
  note,
}: InfoTooltipBodyProps) {
  const isStructured = !!(description || calculationTooltip)

  if (!isStructured) {
    return <span className="theme-text-primary">{content}</span>
  }

  return (
    <>
      {description && (
        <div className="mb-2 pb-2" style={{ borderBottom: '1px solid var(--theme-card-border)' }}>
          <div className="font-semibold theme-text-primary mb-1">What it means</div>
          <div className="theme-text-secondary leading-relaxed">{description}</div>
        </div>
      )}
      {calculationTooltip && (
        <>
          <div className="font-semibold theme-text-primary mb-1">How it&apos;s calculated</div>
          <div className="theme-text-secondary leading-relaxed space-y-2">
            <div className="pt-2" style={{ borderTop: '1px solid var(--theme-card-border)' }}>
              <span className="font-semibold text-amber-500">Formula:</span>{' '}
              <span className="font-mono">
                {calculationTooltip.formula.includes('\n')
                  ? calculationTooltip.formula.split('\n').map((line, i, arr) => (
                      <span key={i}>
                        {line}
                        {i < arr.length - 1 && <br />}
                      </span>
                    ))
                  : calculationTooltip.formula}
              </span>
            </div>
            {calculationTooltip.components && calculationTooltip.components.length > 0 && (
              <div className="pt-2" style={{ borderTop: '1px solid var(--theme-card-border)' }}>
                <div className="space-y-1">
                  {calculationTooltip.components.map((component, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex justify-between',
                        component.highlight ? 'font-semibold text-cyan-400 pt-1' : ''
                      )}
                      style={
                        component.highlight
                          ? { borderTop: '1px solid var(--theme-card-border)' }
                          : undefined
                      }
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
            {note && (
              <div
                className="text-xs theme-text-secondary italic pt-1"
                style={{ borderTop: '1px solid var(--theme-card-border)' }}
              >
                {note}
              </div>
            )}
          </div>
        </>
      )}
      {!calculationTooltip && note && (
        <div className="text-xs theme-text-secondary italic mt-1">{note}</div>
      )}
    </>
  )
}
