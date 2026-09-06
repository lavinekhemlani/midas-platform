/**
 * QuickBooks Validation Module
 *
 * Exports validation utilities for QuickBooks API routes.
 *
 * @module quickbooks/validation
 */

// Re-export all validation utilities
export {
  // Constants
  VALID_ACCOUNTING_METHODS,
  VALID_SUMMARIZE_COLUMN_BY,
  VALID_DATE_MACROS,
  type AccountingMethod,
  type SummarizeColumnBy,

  // Date validators
  isValidDate,
  isValidDateRange,

  // Enum validators
  isValidAccountingMethod,
  isValidSummarizeColumnBy,
  isValidDateMacro,

  // Parameter validation
  validateReportParams,
  type ValidatedReportParams,
  type ValidationSuccess,
  type ValidationError,
  type ValidationResult,

  // Error response helpers
  validationErrorResponse,
  missingParamResponse,
  authRequiredResponse,
  rateLimitedResponse,
  handleQBError,
} from './report-params'

// Re-export response validators
export {
  // Validation functions
  validateQueryResponse,
  validateCompanyInfoResponse,
  validateReportResponse,
  validateErrorResponse,
  validateEntity,
  validateEntityResponse,
  validateResponse,

  // Validation options and helpers
  type ValidationOptions,
  createValidator,
  isValidSchema,
  safeParse,
  hasSchemaForEntity,
  getAvailableSchemas,
  registerEntitySchema,
} from './validator'

// Re-export schemas
export {
  // Schema exports
  QBQueryResponseSchema,
  QBCompanyInfoSchema,
  QBReportResponseSchema,
  QBErrorResponseSchema,
  QBInvoiceSchema,
  QBCustomerSchema,
  QBVendorSchema,
  QBAccountSchema,

  // Type exports
  type QBQueryResponse,
  type QBCompanyInfoResponse,
  type QBReportResponse,
  type QBErrorResponse,
  type QBInvoice,
  type QBCustomer,
  type QBVendor,
  type QBAccount,
} from './schemas'
