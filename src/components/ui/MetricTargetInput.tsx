'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface MetricTargetInputProps {
  label?: string
  unit: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
  min?: number
  max?: number
  step?: number
  benchmarkHint?: string
}

export default function MetricTargetInput({
  label,
  unit,
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  className,
  min,
  max,
  step = 1,
  benchmarkHint,
}: MetricTargetInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive validation state during render — no effect needed
  const isValid =
    !value ||
    value.trim() === '' ||
    (() => {
      const numValue = parseFloat(value)
      const isValidNumber = !isNaN(numValue)
      const isInRange =
        min === undefined || max === undefined || (numValue >= min && numValue <= max)
      return isValidNumber && isInRange
    })()

  // Only the success animation timer needs an effect
  useEffect(() => {
    if (isValid && value && value.trim() !== '') {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 1000)
      return () => clearTimeout(timer)
    } else {
      setShowSuccess(false)
    }
  }, [isValid, value])

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    // Allow empty string, numbers, and decimal points
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue)
    }
  }

  // Convert long units to single character units
  const getDisplayUnit = (unit: string): string => {
    switch (unit.toLowerCase()) {
      case 'months':
        return 'M'
      case 'days':
        return 'D'
      default:
        return unit
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down
    if (
      [8, 9, 27, 13, 35, 36, 37, 39, 38, 40, 46, 110, 190].indexOf(e.keyCode) !== -1 ||
      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true) ||
      (e.keyCode === 90 && e.ctrlKey === true)
    ) {
      return
    }
    // Ensure that it is a number and stop the keypress
    if ((e.shiftKey || e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault()
    }
  }

  const getStatusStyles = () => {
    if (error) {
      return {
        borderColor: 'var(--red-500, #ef4444)',
        backgroundColor: 'transparent',
      }
    }
    if (showSuccess) {
      return {
        borderColor: 'var(--green-500, #22c55e)',
        backgroundColor: 'var(--green-500-5, rgba(34, 197, 94, 0.05))',
      }
    }
    if (isFocused) {
      return {
        borderColor: 'var(--amber-500-70, rgba(245, 158, 11, 0.7))',
        backgroundColor: 'transparent',
      }
    }
    if (!isValid && value) {
      return {
        borderColor: 'var(--orange-500, #f97316)',
        backgroundColor: 'var(--orange-500-5, rgba(249, 115, 22, 0.05))',
      }
    }
    return {
      borderColor: 'var(--amber-500-30, rgba(245, 158, 11, 0.3))',
      backgroundColor: 'transparent',
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Label - only show if label exists */}
      {label && (
        <div className="mb-2">
          <label
            htmlFor={`target-${label?.toLowerCase().replace(/\s+/g, '-') || 'input'}`}
            className="text-sm font-medium text-white block"
          >
            {label}
          </label>
        </div>
      )}

      {/* Input Container */}
      <div className="relative">
        <input
          ref={inputRef}
          id={`target-${label?.toLowerCase().replace(/\s+/g, '-') || 'input'}`}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          aria-invalid={!isValid || !!error}
          aria-describedby={
            error
              ? `${label || 'input'}-error`
              : benchmarkHint
                ? `${label || 'input'}-hint`
                : undefined
          }
          style={{
            // Base styles
            width: '100%',
            height: '3rem',
            padding: '0 3rem 0 0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--theme-text-primary, #ffffff)',
            borderRadius: '0.125rem',
            border: '2px solid',
            transition: 'all 200ms',
            textAlign: 'right',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.5 : 1,
            // Dynamic styles
            ...getStatusStyles(),
            // Animation
            ...(showSuccess
              ? {
                  animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }
              : {}),
          }}
          className="transition-all duration-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 hover:border-amber-500/50 disabled:hover:border-current"
        />

        {/* Unit Label */}
        <div
          style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.75rem',
            fontWeight: '500',
            pointerEvents: 'none',
            color: showSuccess
              ? 'var(--green-400, #4ade80)'
              : isFocused
                ? 'var(--amber-400, #fbbf24)'
                : 'var(--amber-400-70, rgba(251, 191, 36, 0.7))',
            transition: 'color 200ms',
          }}
        >
          {getDisplayUnit(unit)}
        </div>

        {/* Success indicator */}
        {showSuccess && (
          <div
            style={{
              position: 'absolute',
              right: '-0.5rem',
              top: '-0.5rem',
              width: '1.5rem',
              height: '1.5rem',
              backgroundColor: 'var(--green-500, #22c55e)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'bounce 1s infinite',
            }}
          >
            <svg
              style={{ width: '0.75rem', height: '0.75rem', color: '#ffffff' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div
          id={`${label || 'input'}-error`}
          className="mt-2 text-xs text-red-400 flex items-center"
          role="alert"
        >
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Validation hint for invalid but not error state */}
      {!isValid && !error && value && (
        <div className="mt-2 text-xs text-orange-400 flex items-center">
          <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {min !== undefined &&
            max !== undefined &&
            `Please enter a value between ${min} and ${max}`}
        </div>
      )}
    </div>
  )
}
