// src/lib/types.ts

/**
 * Custom error class for Zoho API related errors
 */
export class ZohoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ZohoError';
  }
}