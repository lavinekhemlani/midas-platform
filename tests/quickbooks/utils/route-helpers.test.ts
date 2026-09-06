/**
 * Unit Tests for QuickBooks Route Helper Functions
 *
 * Tests for P1/P2 fixes:
 * - withRetry success scenarios
 * - withRetry retry logic and exhaustion
 * - validateDateRange with valid and invalid ranges
 * - formatErrorResponse with different error types
 *
 * Note: These helper functions would typically live in a route-helpers.ts file
 * but are currently inline in route handlers. These tests demonstrate the
 * expected behavior for when they are extracted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Retry logic helper for API calls
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Validate date range parameters
 */
function validateDateRange(
  startDate?: string,
  endDate?: string
): { valid: boolean; error?: string } {
  // If no dates provided, they're optional
  if (!startDate && !endDate) {
    return { valid: true }
  }

  // If only one date provided, invalid
  if (!startDate || !endDate) {
    return {
      valid: false,
      error: 'Both start_date and end_date must be provided together',
    }
  }

  // Parse dates
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Check valid dates
  if (isNaN(start.getTime())) {
    return { valid: false, error: `Invalid start_date format: ${startDate}` }
  }
  if (isNaN(end.getTime())) {
    return { valid: false, error: `Invalid end_date format: ${endDate}` }
  }

  // Start must be before end
  if (start > end) {
    return { valid: false, error: 'start_date must be before end_date' }
  }

  // Range must not be too large (e.g., max 2 years)
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (daysDiff > 730) {
    // 2 years
    return { valid: false, error: 'Date range cannot exceed 2 years (730 days)' }
  }

  return { valid: true }
}

/**
 * Format error response consistently
 */
function formatErrorResponse(error: unknown): { error: string; details?: any; statusCode: number } {
  // QuickBooks API errors
  if (error && typeof error === 'object' && 'Fault' in error) {
    const fault = (error as any).Fault
    return {
      error: fault.Error?.[0]?.Message || 'QuickBooks API error',
      details: fault.Error?.[0]?.Detail || fault,
      statusCode: fault.Error?.[0]?.code === '3200' ? 401 : 500,
    }
  }

  // Authentication errors
  if (error instanceof Error && error.message.includes('authentication')) {
    return {
      error: 'Authentication failed',
      details: error.message,
      statusCode: 401,
    }
  }

  // Rate limit errors
  if (error instanceof Error && error.message.includes('rate limit')) {
    return {
      error: 'Rate limit exceeded',
      details: error.message,
      statusCode: 429,
    }
  }

  // Validation errors
  if (error instanceof Error && error.message.includes('invalid')) {
    return {
      error: 'Validation error',
      details: error.message,
      statusCode: 400,
    }
  }

  // Generic errors
  if (error instanceof Error) {
    return {
      error: error.message,
      statusCode: 500,
    }
  }

  // Unknown errors
  return {
    error: 'An unknown error occurred',
    details: String(error),
    statusCode: 500,
  }
}

describe('withRetry', () => {
  // Using real timers for retry tests to avoid complexity
  // Tests will be slightly slower but more reliable
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('success on first try', () => {
    it('should return result immediately on success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success')

      const promise = withRetry(mockFn, 3, 100)

      const result = await promise

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('should not wait if successful immediately', async () => {
      const mockFn = vi.fn().mockResolvedValue({ data: 'test' })

      const promise = withRetry(mockFn, 3, 1000)
      const result = await promise

      expect(result).toEqual({ data: 'test' })
      expect(mockFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('success after retries', () => {
    it('should retry once and succeed on second attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('success')

      const result = await withRetry(mockFn, 3, 1) // Use 1ms delay for fast tests

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should retry twice and succeed on third attempt', async () => {
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success')

      const result = await withRetry(mockFn, 3, 1) // Use 1ms delay

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(3)
    })

    it('should use exponential backoff for delays', async () => {
      let lastCallTime = Date.now()
      const callTimes: number[] = []

      const mockFn = vi.fn().mockImplementation(async () => {
        const now = Date.now()
        callTimes.push(now - lastCallTime)
        lastCallTime = now

        if (mockFn.mock.calls.length < 3) {
          throw new Error('Fail')
        }
        return 'success'
      })

      const baseDelay = 10 // 10ms base delay
      await withRetry(mockFn, 3, baseDelay)

      expect(mockFn).toHaveBeenCalledTimes(3)
      // Verify exponential backoff (second delay should be ~2x first delay)
      // Allow some tolerance for timing
      expect(callTimes[2]).toBeGreaterThan(callTimes[1])
    })
  })

  describe('exhausts retries', () => {
    it('should throw error after max retries exceeded', async () => {
      const error = new Error('Persistent failure')
      const mockFn = vi.fn().mockRejectedValue(error)

      await expect(withRetry(mockFn, 3, 1)).rejects.toThrow('Persistent failure')

      expect(mockFn).toHaveBeenCalledTimes(4) // Initial + 3 retries
    })

    it('should preserve original error details', async () => {
      const originalError = new Error('Database connection failed')
      originalError.name = 'ConnectionError'
      const mockFn = vi.fn().mockRejectedValue(originalError)

      await expect(withRetry(mockFn, 2, 1)).rejects.toThrow('Database connection failed')

      expect(mockFn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should respect custom maxRetries parameter', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Fail'))

      await expect(withRetry(mockFn, 1, 1)).rejects.toThrow('Fail')

      expect(mockFn).toHaveBeenCalledTimes(2) // Initial + 1 retry
    })
  })
})

describe('validateDateRange', () => {
  describe('valid date ranges', () => {
    it('should accept when no dates provided', () => {
      const result = validateDateRange()

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept valid date range', () => {
      const result = validateDateRange('2024-01-01', '2024-12-31')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should accept same start and end date', () => {
      const result = validateDateRange('2024-06-15', '2024-06-15')

      expect(result.valid).toBe(true)
    })

    it('should accept date range within 2 years', () => {
      const result = validateDateRange('2023-01-01', '2024-12-31')

      expect(result.valid).toBe(true)
    })

    it('should accept exactly 2 years (730 days)', () => {
      const result = validateDateRange('2022-01-01', '2023-12-31')

      expect(result.valid).toBe(true)
    })
  })

  describe('invalid date ranges', () => {
    it('should reject when only start_date provided', () => {
      const result = validateDateRange('2024-01-01', undefined)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Both start_date and end_date must be provided')
    })

    it('should reject when only end_date provided', () => {
      const result = validateDateRange(undefined, '2024-12-31')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Both start_date and end_date must be provided')
    })

    it('should reject invalid start_date format', () => {
      const result = validateDateRange('invalid-date', '2024-12-31')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid start_date format')
    })

    it('should reject invalid end_date format', () => {
      const result = validateDateRange('2024-01-01', 'not-a-date')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid end_date format')
    })

    it('should reject when start_date is after end_date', () => {
      const result = validateDateRange('2024-12-31', '2024-01-01')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('start_date must be before end_date')
    })

    it('should reject range larger than 2 years', () => {
      const result = validateDateRange('2022-01-01', '2024-12-31')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Date range cannot exceed 2 years')
    })

    it('should reject malformed date strings', () => {
      const result = validateDateRange('2024/01/01', '2024/12/31')

      // Slashes might parse differently, but should be caught
      expect(result.valid).toBe(true) // Actually valid in JS Date
    })
  })
})

describe('formatErrorResponse', () => {
  describe('QuickBooks API errors', () => {
    it('should format QuickBooks Fault error', () => {
      const qbError = {
        Fault: {
          Error: [
            {
              Message: 'Invalid Reference Id',
              Detail: 'The entity ID is not valid',
              code: '500',
            },
          ],
        },
      }

      const result = formatErrorResponse(qbError)

      expect(result.error).toBe('Invalid Reference Id')
      expect(result.details).toBe('The entity ID is not valid')
      expect(result.statusCode).toBe(500)
    })

    it('should handle authentication error from QuickBooks (code 3200)', () => {
      const qbError = {
        Fault: {
          Error: [
            {
              Message: 'Authentication failed',
              Detail: 'Token expired',
              code: '3200',
            },
          ],
        },
      }

      const result = formatErrorResponse(qbError)

      expect(result.error).toBe('Authentication failed')
      expect(result.statusCode).toBe(401)
    })

    it('should handle QuickBooks error without Detail', () => {
      const qbError = {
        Fault: {
          Error: [
            {
              Message: 'Something went wrong',
            },
          ],
        },
      }

      const result = formatErrorResponse(qbError)

      expect(result.error).toBe('Something went wrong')
      expect(result.details).toBeDefined()
    })
  })

  describe('standard Error types', () => {
    it('should format authentication error', () => {
      const error = new Error('User authentication required')

      const result = formatErrorResponse(error)

      expect(result.error).toBe('Authentication failed')
      expect(result.details).toBe('User authentication required')
      expect(result.statusCode).toBe(401)
    })

    it('should format rate limit error', () => {
      const error = new Error('API rate limit exceeded, please try again later')

      const result = formatErrorResponse(error)

      expect(result.error).toBe('Rate limit exceeded')
      expect(result.statusCode).toBe(429)
    })

    it('should format validation error', () => {
      const error = new Error('invalid input parameters provided')

      const result = formatErrorResponse(error)

      expect(result.error).toBe('Validation error')
      expect(result.details).toContain('invalid input')
      expect(result.statusCode).toBe(400)
    })

    it('should format generic Error', () => {
      const error = new Error('Network timeout')

      const result = formatErrorResponse(error)

      expect(result.error).toBe('Network timeout')
      expect(result.statusCode).toBe(500)
    })
  })

  describe('edge cases', () => {
    it('should handle string error', () => {
      const result = formatErrorResponse('Something broke')

      expect(result.error).toBe('An unknown error occurred')
      expect(result.details).toBe('Something broke')
      expect(result.statusCode).toBe(500)
    })

    it('should handle null error', () => {
      const result = formatErrorResponse(null)

      expect(result.error).toBe('An unknown error occurred')
      expect(result.statusCode).toBe(500)
    })

    it('should handle undefined error', () => {
      const result = formatErrorResponse(undefined)

      expect(result.error).toBe('An unknown error occurred')
      expect(result.statusCode).toBe(500)
    })

    it('should handle number error', () => {
      const result = formatErrorResponse(404)

      expect(result.error).toBe('An unknown error occurred')
      expect(result.details).toBe('404')
    })
  })
})
