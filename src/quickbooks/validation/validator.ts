/**
 * QuickBooks API Response Validator
 *
 * Provides runtime validation helpers for QuickBooks API responses using Zod schemas.
 * This module offers type-safe validation with proper error handling.
 *
 * @module quickbooks/validation/validator
 */

import { z } from 'zod'
import { QBApiError } from '../errors'
import type { QBEntityType } from '../types/entities'
import {
  QBQueryResponseSchema,
  QBCompanyInfoSchema,
  QBReportResponseSchema,
  QBErrorResponseSchema,
  QBInvoiceSchema,
  QBCustomerSchema,
  QBVendorSchema,
  QBAccountSchema,
} from './schemas'

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Entity type to schema mapping
 */
const ENTITY_SCHEMAS: Partial<Record<QBEntityType, z.ZodType>> = {
  Invoice: QBInvoiceSchema,
  Customer: QBCustomerSchema,
  Vendor: QBVendorSchema,
  Account: QBAccountSchema,
  // Add more entity schemas as needed
}

/**
 * Response type to schema mapping
 */
interface ResponseSchemaMap {
  query: typeof QBQueryResponseSchema
  companyInfo: typeof QBCompanyInfoSchema
  report: typeof QBReportResponseSchema
  error: typeof QBErrorResponseSchema
}

const RESPONSE_SCHEMAS: ResponseSchemaMap = {
  query: QBQueryResponseSchema,
  companyInfo: QBCompanyInfoSchema,
  report: QBReportResponseSchema,
  error: QBErrorResponseSchema,
}

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for validation behavior
 */
export interface ValidationOptions {
  /**
   * If true, returns the original data on validation failure instead of throwing
   * @default false
   */
  fallbackOnError?: boolean

  /**
   * If true, strips unknown properties from the validated data
   * @default false
   */
  strict?: boolean

  /**
   * Custom error handler for validation failures
   */
  onValidationError?: (error: z.ZodError, data: unknown) => void
}

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Generic response validator
 *
 * @param data - The data to validate
 * @param schema - The Zod schema to validate against
 * @param options - Validation options
 * @returns Validated and typed data
 * @throws {QBApiError} If validation fails and fallbackOnError is false
 */
export function validateResponse<T>(
  data: unknown,
  schema: z.ZodType<T>,
  options: ValidationOptions = {}
): T {
  const { fallbackOnError = false, strict = false, onValidationError } = options

  try {
    // Parse with strict mode if requested
    if (strict) {
      return schema.parse(data)
    } else {
      // Use passthrough to allow unknown fields
      const result = schema.safeParse(data)
      if (result.success) {
        return result.data
      }
      throw result.error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Call custom error handler if provided
      if (onValidationError) {
        onValidationError(error, data)
      }

      // Log validation error details
      console.error('[QB Validation Error]', {
        issues: error.issues,
        data: JSON.stringify(data, null, 2).substring(0, 500), // Log first 500 chars
      })

      // Fallback to unvalidated data if requested
      if (fallbackOnError) {
        console.warn('[QB Validation] Falling back to unvalidated data')
        return data as T
      }

      // Throw a QB API error with validation details
      throw new QBApiError(400, {
        message: 'Response validation failed',
        validationErrors: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      })
    }
    throw error
  }
}

/**
 * Validate a query response
 *
 * @param data - The query response data
 * @param options - Validation options
 * @returns Validated query response
 */
export function validateQueryResponse(data: unknown, options?: ValidationOptions) {
  return validateResponse(data, RESPONSE_SCHEMAS.query, options)
}

/**
 * Validate a company info response
 *
 * @param data - The company info response data
 * @param options - Validation options
 * @returns Validated company info response
 */
export function validateCompanyInfoResponse(data: unknown, options?: ValidationOptions) {
  return validateResponse(data, RESPONSE_SCHEMAS.companyInfo, options)
}

/**
 * Validate a report response
 *
 * @param data - The report response data
 * @param options - Validation options
 * @returns Validated report response
 */
export function validateReportResponse(data: unknown, options?: ValidationOptions) {
  return validateResponse(data, RESPONSE_SCHEMAS.report, options)
}

/**
 * Validate an error response
 *
 * @param data - The error response data
 * @param options - Validation options
 * @returns Validated error response
 */
export function validateErrorResponse(data: unknown, options?: ValidationOptions) {
  return validateResponse(data, RESPONSE_SCHEMAS.error, options)
}

// ============================================================================
// Entity Validation
// ============================================================================

/**
 * Validate an entity response
 *
 * @param data - The entity data
 * @param entityType - The QB entity type
 * @param options - Validation options
 * @returns Validated entity data, or original data if no schema exists
 */
export function validateEntity<T extends QBEntityType>(
  data: unknown,
  entityType: T,
  options?: ValidationOptions
): unknown {
  const schema = ENTITY_SCHEMAS[entityType]

  // If no schema exists for this entity type, return unvalidated data
  if (!schema) {
    console.warn(`[QB Validation] No schema found for entity type: ${entityType}`)
    return data
  }

  return validateResponse(data, schema, options)
}

/**
 * Validate an entity wrapped in a response object
 * QB API returns single entities as: { EntityType: { ...data } }
 *
 * @param data - The wrapped entity response
 * @param entityType - The QB entity type
 * @param options - Validation options
 * @returns Validated entity data
 */
export function validateEntityResponse<T extends QBEntityType>(
  data: unknown,
  entityType: T,
  options?: ValidationOptions
): unknown {
  // First validate the wrapper structure
  if (!data || typeof data !== 'object' || !(entityType in data)) {
    if (options?.fallbackOnError) {
      return data
    }
    throw new QBApiError(400, {
      message: `Invalid entity response structure: expected ${entityType} property`,
    })
  }

  // Extract and validate the entity
  // Type assertion safe because we already validated entityType is a key in ENTITY_SCHEMAS
  const entityData = (data as Record<string, unknown>)[entityType]
  // Cast both the entityType and entityData with proper type assertions
  return validateEntity(entityType as any as QBEntityType, entityData as any, options)
}

// ============================================================================
// Typed Validation Helpers
// ============================================================================

/**
 * Create a typed validator for a specific schema
 *
 * @param schema - The Zod schema
 * @returns A typed validation function
 *
 * @example
 * const validateInvoice = createValidator(QBInvoiceSchema)
 * const invoice = validateInvoice(data)
 */
export function createValidator<T>(schema: z.ZodType<T>) {
  return (data: unknown, options?: ValidationOptions): T => {
    return validateResponse(data, schema, options)
  }
}

/**
 * Check if data matches a schema without throwing
 *
 * @param data - The data to check
 * @param schema - The schema to validate against
 * @returns True if data is valid, false otherwise
 */
export function isValidSchema<T>(data: unknown, schema: z.ZodType<T>): data is T {
  const result = schema.safeParse(data)
  return result.success
}

/**
 * Safely parse data with detailed error information
 *
 * @param data - The data to parse
 * @param schema - The schema to validate against
 * @returns A result object with success status and data or error
 */
export function safeParse<T>(
  data: unknown,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a schema exists for an entity type
 *
 * @param entityType - The QB entity type
 * @returns True if a schema exists, false otherwise
 */
export function hasSchemaForEntity(entityType: QBEntityType): boolean {
  return entityType in ENTITY_SCHEMAS
}

/**
 * Get available entity types with schemas
 *
 * @returns Array of entity types that have validation schemas
 */
export function getAvailableSchemas(): QBEntityType[] {
  return Object.keys(ENTITY_SCHEMAS) as QBEntityType[]
}

/**
 * Register a custom schema for an entity type
 *
 * @param entityType - The QB entity type
 * @param schema - The Zod schema for this entity type
 */
export function registerEntitySchema(entityType: QBEntityType, schema: z.ZodType): void {
  ENTITY_SCHEMAS[entityType] = schema
  console.log(`[QB Validation] Registered schema for entity type: ${entityType}`)
}
