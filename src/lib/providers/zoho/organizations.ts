// src/lib/providers/zoho/organizations.ts
import { providerFetch, withRetry } from '../core'
import { ProviderApiClient } from '../apiClient'

export interface Organization {
  organization_id: string
  name: string
  contact_name?: string
  email?: string
  is_default_org: boolean
  language_code: string
  fiscal_year_start_month: number
  account_created_date: string
  time_zone: string
  is_org_active: boolean
  currency_id: string
  currency_code: string
  currency_symbol: string
  currency_format: string
  price_precision: number
  address?: {
    street_address1?: string
    street_address2?: string
    city?: string
    state?: string
    country?: string
    zip?: string
  }
  org_address?: string
  remit_to_address?: string
  phone?: string
  fax?: string
  website?: string
  tax_basis?: string
}

/**
 * Get organization details
 * Reference: https://www.zoho.com/books/api/v3/organizations/#get-an-organization
 */
export async function getOrganizationInfo(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<Organization> {
  if (!apiClient) {
    throw new Error('API client is required for getOrganizationInfo');
  }

  return withRetry(async () => {
    // First get the Zoho org ID
    const orgsResponse = await providerFetch<{ organizations: Organization[] }>(
      apiClient,
      'zoho',
      userOrgId, 
      '/organizations',
      {}
    )
    
    const zohoOrgId = orgsResponse.organizations?.[0]?.organization_id
    if (!zohoOrgId) {
      throw new Error('No Zoho organization found')
    }

    // Then get the full details
    const response = await providerFetch<{ organization: Organization }>(
      apiClient,
      'zoho',
      userOrgId,
      `/organizations/${zohoOrgId}`,
      {}
    )
    
    return response.organization
  })
}

/**
 * List all organizations
 */
export async function listOrganizations(
  userOrgId: string,
  apiClient?: ProviderApiClient
): Promise<Organization[]> {
  if (!apiClient) {
    throw new Error('API client is required for listOrganizations');
  }

  return withRetry(async () => {
    const response = await providerFetch<{ organizations: Organization[] }>(
      apiClient,
      'zoho',
      userOrgId,
      '/organizations',
      {}
    )
    
    return response.organizations || []
  })
}
