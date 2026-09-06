'use client';

import React from 'react';
import GlossaryDetail from './GlossaryDetail';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useFinancialData } from '@/contexts/FinancialDataContext';
import { useLearnTerm } from '@/hooks/useLearnData';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';

interface LearnSheetContentProps {
  termId: string;
  icon?: React.ElementType;
  iconColor?: string;
  onClose: () => void;
  startCloseAnimation: () => void;
  contextData?: Record<string, number>; // Optional metric values to use for personalization
}

export function LearnSheetContent({ termId, icon, iconColor, onClose, startCloseAnimation, contextData }: LearnSheetContentProps) {
  const { financialData } = useFinancialData();
  const { status } = useSession();

  // Only fetch if authenticated - pass null to disable SWR if not authenticated
  const shouldFetch = status === 'authenticated' && termId;
  const { term, isLoading, error } = useLearnTerm(shouldFetch ? termId : null);

  // Show loading while checking auth or fetching
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
          <div className="absolute -inset-1 rounded-full bg-amber-500/5 animate-pulse"></div>
        </div>
        <p className="text-sm font-medium theme-text-primary">Loading learning content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium theme-text-primary mb-1">Unable to Load Content</p>
          <p className="text-xs theme-text-secondary max-w-xs mx-auto">{error.message || 'An error occurred'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="mt-2 bg-slate-500/5 hover:bg-slate-500/10 border-slate-500/20 hover:border-slate-500/30"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!term) return null;

  return (
    <div className="sheet-content-wrapper learn-modal-content">
      <GlossaryDetail
        term={term}
        financialData={financialData}
        icon={icon}
        iconColor={iconColor}
        displayMode="modal"
        onClose={onClose}
        startCloseAnimation={startCloseAnimation}
        contextData={contextData}
      />
    </div>
  );
}