/**
 * QuickBooks API Documentation Route
 * Serves Scalar API Reference UI for testing and documentation
 */

import { ApiReference } from '@scalar/nextjs-api-reference'
import { quickbooksOpenApiSpec } from '@/quickbooks/openapi'

// Export the GET handler - pass OpenAPI spec as JSON string via content
export const GET = ApiReference({
  content: JSON.stringify(quickbooksOpenApiSpec),
})
