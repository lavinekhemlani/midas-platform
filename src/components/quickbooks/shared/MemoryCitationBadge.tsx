// src/components/quickbooks/shared/MemoryCitationBadge.tsx
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Brain } from 'lucide-react';
import { MemoryCitation } from './types';

interface MemoryCitationBadgeProps {
  citations: MemoryCitation[];
  className?: string;
  compact?: boolean;
}

export function MemoryCitationBadge({ 
  citations, 
  className,
  compact = false 
}: MemoryCitationBadgeProps) {
  if (!citations || citations.length === 0) return null;

  const citationText = compact 
    ? `${citations.length} memory${citations.length > 1 ? 's' : ''}`
    : `Based on ${citations.length} stored memory${citations.length > 1 ? 's' : ''}`;

  return (
    <div 
      className={cn(
        'inline-flex items-center space-x-2 px-3 py-1.5',
        'bg-amber-500/10 border border-amber-500/20 rounded-full',
        'text-xs theme-text-secondary',
        'print:bg-gray-100 print:border-gray-300',
        className
      )}
      title={citations.map(c => `${c.type}: ${c.impact}`).join('\n')}
    >
      <Brain className="w-3 h-3 text-amber-500" strokeWidth={1.5} />
      <span>{citationText}</span>
    </div>
  );
}