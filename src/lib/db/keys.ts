/**
 * DynamoDB Key Utilities
 *
 * Helper functions for constructing and normalizing DynamoDB partition keys.
 * Ensures consistent key formatting across the application.
 */

/**
 * Normalize organization ID by stripping any existing ORG# prefix(es)
 *
 * Handles cases where organizationId is passed as:
 * - "1fdcdecc-bd88-4760-832e-9fcb0a58e5d3" (raw UUID)
 * - "ORG#1fdcdecc-bd88-4760-832e-9fcb0a58e5d3" (with prefix)
 * - "ORG#ORG#1fdcdecc-bd88-4760-832e-9fcb0a58e5d3" (double prefix - error case)
 *
 * @param organizationId - The organization ID (with or without prefix)
 * @returns The raw organization ID without any ORG# prefix
 */
export function normalizeOrgId(organizationId: string): string {
  if (!organizationId) return organizationId

  let normalized = organizationId
  while (normalized.startsWith('ORG#')) {
    normalized = normalized.slice(4)
  }
  return normalized
}

/**
 * Create a properly formatted organization partition key
 *
 * @param organizationId - The organization ID (with or without prefix)
 * @returns Formatted PK like "ORG#<uuid>"
 */
export function createOrgPK(organizationId: string): `ORG#${string}` {
  const normalized = normalizeOrgId(organizationId)
  return `ORG#${normalized}`
}

/**
 * Normalize user ID by stripping any existing USER# prefix(es)
 *
 * @param userId - The user ID (with or without prefix)
 * @returns The raw user ID without any USER# prefix
 */
export function normalizeUserId(userId: string): string {
  if (!userId) return userId

  let normalized = userId
  while (normalized.startsWith('USER#')) {
    normalized = normalized.slice(5)
  }
  return normalized
}

/**
 * Create a properly formatted user partition key
 *
 * @param userId - The user ID (with or without prefix)
 * @returns Formatted PK like "USER#<uuid>"
 */
export function createUserPK(userId: string): `USER#${string}` {
  const normalized = normalizeUserId(userId)
  return `USER#${normalized}`
}
