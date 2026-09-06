/**
 * Validation utilities for financial metric calculations
 */

export interface ValidationResult {
  isValid: boolean
  value: number | null
  error?: string
  warning?: string
}

/**
 * Safely divide two numbers, handling division by zero
 */
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  defaultValue: number | null = null
): ValidationResult {
  // Check for null/undefined values
  if (numerator === null || numerator === undefined) {
    return {
      isValid: false,
      value: defaultValue,
      error: 'Numerator is missing',
    }
  }

  if (denominator === null || denominator === undefined) {
    return {
      isValid: false,
      value: defaultValue,
      error: 'Denominator is missing',
    }
  }

  // Check for division by zero
  if (denominator === 0) {
    return {
      isValid: false,
      value: defaultValue,
      warning: 'Division by zero - cannot calculate metric',
    }
  }

  // Check for invalid number types
  if (!isFinite(numerator) || !isFinite(denominator)) {
    return {
      isValid: false,
      value: defaultValue,
      error: 'Invalid numeric values',
    }
  }

  return {
    isValid: true,
    value: numerator / denominator,
  }
}

/**
 * Validate that a value is within expected bounds
 */
export function validateBounds(
  value: number | null | undefined,
  min?: number,
  max?: number,
  metricName: string = 'Metric'
): ValidationResult {
  if (value === null || value === undefined) {
    return {
      isValid: false,
      value: null,
      error: `${metricName} value is missing`,
    }
  }

  if (!isFinite(value)) {
    return {
      isValid: false,
      value: null,
      error: `${metricName} has invalid numeric value`,
    }
  }

  if (min !== undefined && value < min) {
    return {
      isValid: false,
      value: value,
      warning: `${metricName} is below expected minimum (${min})`,
    }
  }

  if (max !== undefined && value > max) {
    return {
      isValid: false,
      value: value,
      warning: `${metricName} exceeds expected maximum (${max})`,
    }
  }

  return {
    isValid: true,
    value: value,
  }
}

/**
 * Validate percentage values (0-100 or 0-1 depending on format)
 */
export function validatePercentage(
  value: number | null | undefined,
  isDecimal: boolean = false
): ValidationResult {
  const max = isDecimal ? 1 : 100
  const result = validateBounds(value, 0, max, 'Percentage')

  if (!result.isValid && value !== null && value !== undefined) {
    // Check if percentage is negative (common in losses)
    if (value < 0) {
      return {
        isValid: true,
        value: value,
        warning: 'Negative percentage (indicates loss)',
      }
    }
  }

  return result
}

/**
 * Validate currency values
 */
export function validateCurrency(
  value: number | null | undefined,
  allowNegative: boolean = true
): ValidationResult {
  if (value === null || value === undefined) {
    return {
      isValid: false,
      value: null,
      error: 'Currency value is missing',
    }
  }

  if (!isFinite(value)) {
    return {
      isValid: false,
      value: null,
      error: 'Invalid currency value',
    }
  }

  if (!allowNegative && value < 0) {
    return {
      isValid: false,
      value: value,
      error: 'Currency value cannot be negative',
    }
  }

  return {
    isValid: true,
    value: value,
  }
}

/**
 * Validate that required data is available for a metric calculation
 */
export interface DataRequirement {
  field: string
  value: any
  required: boolean
}

export function validateDataCompleteness(requirements: DataRequirement[]): {
  isComplete: boolean
  missingFields: string[]
} {
  const missingFields: string[] = []

  for (const req of requirements) {
    if (req.required && (req.value === null || req.value === undefined)) {
      missingFields.push(req.field)
    }
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Calculate a metric safely with full validation
 */
export interface MetricCalculation {
  metricId: string
  metricName: string
  calculate: () => number | null
  dataRequirements?: DataRequirement[]
  validateResult?: (value: number) => ValidationResult
}

export function calculateMetricSafely(calc: MetricCalculation): {
  value: number | null
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check data completeness
  if (calc.dataRequirements) {
    const { isComplete, missingFields } = validateDataCompleteness(calc.dataRequirements)
    if (!isComplete) {
      errors.push(`Missing data for ${calc.metricName}: ${missingFields.join(', ')}`)
      return {
        value: null,
        isValid: false,
        errors,
        warnings,
      }
    }
  }

  try {
    // Calculate the metric
    const value = calc.calculate()

    // Validate the result if validator provided
    if (calc.validateResult && value !== null) {
      const validation = calc.validateResult(value)
      if (!validation.isValid) {
        if (validation.error) errors.push(validation.error)
        if (validation.warning) warnings.push(validation.warning)
      }
      return {
        value: validation.value,
        isValid: validation.isValid && errors.length === 0,
        errors,
        warnings,
      }
    }

    return {
      value,
      isValid: value !== null && isFinite(value),
      errors,
      warnings,
    }
  } catch (error) {
    errors.push(
      `Error calculating ${calc.metricName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return {
      value: null,
      isValid: false,
      errors,
      warnings,
    }
  }
}

/**
 * Format validation results for user display
 */
export function formatValidationMessage(
  metricName: string,
  errors: string[],
  warnings: string[]
): string {
  const messages: string[] = []

  if (errors.length > 0) {
    messages.push(`❌ ${metricName} errors: ${errors.join('; ')}`)
  }

  if (warnings.length > 0) {
    messages.push(`⚠️ ${metricName} warnings: ${warnings.join('; ')}`)
  }

  return messages.join('\n')
}
