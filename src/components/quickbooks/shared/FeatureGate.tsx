// src/components/quickbooks/shared/FeatureGate.tsx
'use client';

import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuickBooksPlan = 'SimpleStart' | 'Essentials' | 'Plus' | 'Advanced' | 'Unknown';

interface FeatureGateProps {
  feature: string;
  featureName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  plan?: QuickBooksPlan;
  features?: string[];
}

// Feature availability matrix
const PLAN_FEATURES: Record<QuickBooksPlan, string[]> = {
  SimpleStart: ['invoices', 'expenses', 'reports', 'banking'],
  Essentials: ['invoices', 'expenses', 'reports', 'banking', 'bills', 'time'],
  Plus: ['invoices', 'expenses', 'reports', 'banking', 'bills', 'time', 'projects', 'classes', 'locations', 'budgets'],
  Advanced: ['invoices', 'expenses', 'reports', 'banking', 'bills', 'time', 'projects', 'classes', 'locations', 'budgets', 'custom_fields', 'batch_transactions'],
  Unknown: ['invoices', 'expenses', 'reports', 'banking']
};

// Feature to required plan mapping
const FEATURE_REQUIREMENTS: Record<string, QuickBooksPlan[]> = {
  projects: ['Plus', 'Advanced'],
  classes: ['Plus', 'Advanced'],
  locations: ['Plus', 'Advanced'],
  budgets: ['Plus', 'Advanced'],
  custom_fields: ['Advanced'],
  batch_transactions: ['Advanced'],
  bills: ['Essentials', 'Plus', 'Advanced'],
  time: ['Essentials', 'Plus', 'Advanced']
};

export function FeatureGate({
  feature,
  featureName,
  children,
  fallback,
  className,
  plan = 'Unknown',
  features
}: FeatureGateProps) {
  // Check if feature is available
  const isAvailable = features ? features.includes(feature) : PLAN_FEATURES[plan].includes(feature);

  // Feature is available
  if (isAvailable) {
    return <>{children}</>;
  }

  // Feature is not available
  const displayName = featureName || feature;
  const requiredPlans = FEATURE_REQUIREMENTS[feature] || ['Plus', 'Advanced'];
  const requiredPlansText = requiredPlans.join(' or ');

  // Show fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show simple informational message
  return (
    <div className={cn(
      "p-4 rounded-lg glass-component border",
      "border-amber-500/20 bg-amber-500/5",
      className
    )}>
      <div className="flex items-start space-x-3">
        <Info className="w-5 h-5 text-amber-500/70 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm theme-text-secondary">
            {displayName} requires QuickBooks {requiredPlansText}.
            {plan !== 'Unknown' && ` Your current plan is ${plan}.`}
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple plan info component
export function PlanInfo({ 
  plan, 
  className 
}: { 
  plan?: QuickBooksPlan;
  className?: string;
}) {
  if (!plan || plan === 'Unknown') return null;
  
  return (
    <div className={cn(
      "inline-flex items-center px-3 py-1 text-xs font-medium rounded-full",
      "glass-component border border-amber-500/20",
      "theme-text-secondary",
      className
    )}>
      QuickBooks {plan}
    </div>
  );
}