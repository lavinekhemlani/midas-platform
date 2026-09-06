'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import MetricTargetInput from '@/components/ui/MetricTargetInput';
import { 
  getMetricById, 
  getMetricVariant, 
  getDefaultTarget, 
  getMetricUnit,
  FINANCIAL_METRICS 
} from '@/lib/data/financialMetrics';

interface MetricTargetsPanelProps {
  selectedMetrics: string[];
  revenueModel: string;
  values: string[];
  onChange: (values: string[]) => void;
  onMetricsChange: (metrics: string[]) => void;
  className?: string;
  disabled?: boolean;
}

interface MetricDisplayData {
  id: string;
  label: string;
  metricName: string;
  unit: string;
  placeholder: string;
  benchmarkHint?: string;
  min?: number;
  max?: number;
  step?: number;
}

// MetricDropdown Component
interface MetricDropdownProps {
  selectedMetric: string;
  onMetricChange: (metricId: string) => void;
  availableMetrics: any[];
  usedMetrics: string[];
  disabled?: boolean;
  animationDelay: number;
}

function MetricDropdown({ 
  selectedMetric, 
  onMetricChange, 
  availableMetrics, 
  usedMetrics, 
  disabled, 
  animationDelay 
}: MetricDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedMetricData = availableMetrics.find(m => m.id === selectedMetric);
  const displayName = selectedMetricData ? selectedMetricData.name : 'Select Metric';

  const filteredMetrics = availableMetrics.filter(metric => 
    !usedMetrics.includes(metric.id) || metric.id === selectedMetric
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '0.75rem',
          backgroundColor: 'transparent',
          borderRadius: '0.125rem',
          border: '1px solid var(--amber-500-20, rgba(245, 158, 11, 0.2))',
          transition: 'colors 200ms',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: '3rem',
          textAlign: 'left',
          opacity: disabled ? 0.5 : 1,
        }}
        className="transition-colors hover:bg-amber-500/5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      >
        <span style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'var(--theme-text-primary, #ffffff)',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          paddingRight: '0.5rem'
        }}>
          {displayName}
        </span>
        <svg 
          style={{
            width: '1rem',
            height: '1rem',
            color: 'var(--amber-400-70, rgba(251, 191, 36, 0.7))',
            flexShrink: 0,
            transition: 'transform 200ms',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 50,
          marginTop: '0.25rem',
          backgroundColor: 'var(--black-90, rgba(0, 0, 0, 0.9))',
          backdropFilter: 'blur(2px)',
          border: '1px solid var(--amber-500-30, rgba(245, 158, 11, 0.3))',
          borderRadius: '0.125rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          maxHeight: '15rem',
          overflowY: 'auto'
        }}>
          {filteredMetrics.map((metric) => (
            <button
              key={metric.id}
              type="button"
              onClick={() => {
                onMetricChange(metric.id);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                color: 'var(--theme-text-primary, #ffffff)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 200ms'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--amber-500-10, rgba(245, 158, 11, 0.1))';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {metric.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MetricTargetsPanel({
  selectedMetrics,
  revenueModel,
  values,
  onChange,
  onMetricsChange,
  className,
  disabled = false
}: MetricTargetsPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [metricData, setMetricData] = useState<MetricDisplayData[]>([]);

  // Calculate how many metrics are selected and have values
  const selectedCount = selectedMetrics.filter(Boolean).length;
  const shouldShow = selectedCount > 0 && revenueModel;

  // Progressive disclosure: Show panel when metrics are selected
  useEffect(() => {
    if (shouldShow && !isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 200); // Small delay for smooth UX
      return () => clearTimeout(timer);
    } else if (!shouldShow && isVisible) {
      setIsVisible(false);
    }
  }, [shouldShow, isVisible]);

  // Generate display data for each selected metric
  useEffect(() => {
    const newMetricData: MetricDisplayData[] = selectedMetrics.map((metricId, index) => {
      if (!metricId) {
        return {
          id: '',
          label: `Target ${index + 1}`,
          metricName: 'Not Selected',
          unit: '',
          placeholder: 'Select metric first',
        };
      }

      // Try to get revenue-model-specific variant first
      const variant = getMetricVariant(metricId, revenueModel);
      const baseMetric = getMetricById(metricId);
      
      if (variant) {
        // Use variant data for model-specific calculations
        const rangeText = `${variant.benchmarks.good}-${variant.benchmarks.excellent} ${variant.unit}`;
        
        return {
          id: metricId,
          label: '',
          metricName: variant.name,
          unit: variant.unit,
          placeholder: variant.defaultTarget.toString(),
          benchmarkHint: `${variant.description}.\nCalculation: ${variant.formula}\nRecommended range: ${rangeText}`,
          min: variant.targetRange.min,
          max: variant.targetRange.max,
          step: variant.targetRange.step,
        };
      } else if (baseMetric) {
        // Fallback to base metric if no variant exists
        const defaultTarget = getDefaultTarget(metricId, revenueModel);
        const unit = getMetricUnit(metricId, revenueModel);
        
        return {
          id: metricId,
          label: '',
          metricName: baseMetric.name,
          unit: unit,
          placeholder: defaultTarget?.toString() || '0',
          benchmarkHint: `${baseMetric.description}.\nCalculation: ${baseMetric.formula || 'Standard industry calculation'}`,
        };
      } else {
        return {
          id: metricId,
          label: '',
          metricName: `Metric ${index + 1}`,
          unit: '',
          placeholder: '0',
        };
      }
    });

    setMetricData(newMetricData);
  }, [selectedMetrics, revenueModel]);

  // Auto-populate with default values when metrics change
  useEffect(() => {
    if (metricData.length === 0) return;

    const hasEmptyValues = values.some((value, index) => 
      !value && selectedMetrics[index] && metricData[index]?.placeholder
    );

    if (hasEmptyValues) {
      const newValues = values.map((value, index) => {
        if (!value && selectedMetrics[index] && metricData[index]?.placeholder) {
          return metricData[index].placeholder;
        }
        return value;
      });
      
      // Only update if values actually changed
      if (JSON.stringify(newValues) !== JSON.stringify(values)) {
        onChange(newValues);
      }
    }
  }, [metricData, values, selectedMetrics, onChange]);

  const handleValueChange = (index: number, value: string) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  // Don't render anything if not visible or no metrics selected
  if (!shouldShow) {
    return null;
  }

  return (
    <div 
      className={cn(
        "w-full transition-all duration-500 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className
      )}
    >
      {/* New Layout: Each metric dropdown with its target below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((index) => (
          <div 
            key={`metric-pair-${index}`}
            className={cn(
              "mb-4 transition-all duration-300",
              isVisible && "animate-in slide-in-from-bottom-2",
            )}
            style={{ 
              animationDelay: isVisible ? `${index * 50}ms` : '0ms',
              animationFillMode: 'both'
            }}
          >
            {/* Metric Dropdown */}
            <MetricDropdown
              selectedMetric={selectedMetrics[index] || ''}
              onMetricChange={(metricId) => {
                const newMetrics = [...selectedMetrics];
                newMetrics[index] = metricId;
                onMetricsChange(newMetrics);
              }}
              disabled={disabled}
              availableMetrics={FINANCIAL_METRICS}
              usedMetrics={selectedMetrics.filter((_, i) => i !== index)}
              animationDelay={index * 50}
            />
            
            {/* Target Input - directly below dropdown */}
            <div className="mt-2">
              <MetricTargetInput
                unit={metricData[index]?.unit || ''}
                placeholder={metricData[index]?.placeholder || 'Select metric first'}
                value={values[index] || ''}
                onChange={(value) => handleValueChange(index, value)}
                min={metricData[index]?.min}
                max={metricData[index]?.max}
                step={metricData[index]?.step}
                disabled={disabled || !selectedMetrics[index]}
                className="h-12"
              />
            </div>
          </div>
        ))}


      </div>
    </div>
  );
}