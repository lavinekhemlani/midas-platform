// src/components/quickbooks/shared/QuickBooksTooltip.tsx
'use client';

import React, { useState } from 'react';
import { HelpCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickBooksTooltipProps {
  description?: string;
  tooltip?: string;
  requiredPlan?: string;
  className?: string;
}

export function QuickBooksTooltip({
  description,
  tooltip,
  requiredPlan,
  className
}: QuickBooksTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!description && !tooltip && !requiredPlan) return null;

  return (
    <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn(
          "w-7 h-7 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          className
        )}
      >
        <HelpCircle className="w-4 h-4 theme-text-secondary" />
      </Button>
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 kpi-tooltip text-xs rounded-lg shadow-xl border" style={{ zIndex: 50 }}>
          {description && <div className="font-semibold theme-text-primary mb-1">{description}</div>}
          {tooltip && <div className="theme-text-secondary leading-relaxed">{tooltip}</div>}
          {requiredPlan && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <div className="flex items-center space-x-1 text-amber-400">
                <Lock className="w-3 h-3" />
                <span className="text-xs font-medium">Requires {requiredPlan}</span>
              </div>
            </div>
          )}
          <div className="absolute top-full right-3 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-current opacity-90"></div>
        </div>
      )}
    </div>
  );
}