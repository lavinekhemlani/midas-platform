// src/lib/providers/interfaces/organizations.ts

/**
 * Generic organization structure that providers should map to
 */
export interface Organization {
  organization_id: string;
  name: string;
  contact_name?: string;
  email?: string;
  is_default_org: boolean;
  language_code: string;
  fiscal_year_start_month: number;
  account_created_date: string;
  time_zone: string;
  is_org_active: boolean;
  currency_id: string;
  currency_code: string;
  currency_symbol: string;
  currency_format: string;
  price_precision: number;
  address?: {
    street_address1?: string;
    street_address2?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  org_address?: string;
  remit_to_address?: string;
  phone?: string;
  fax?: string;
  website?: string;
  tax_basis?: string;
}

/**
 * Interface that all organization providers must implement
 */
export interface OrganizationProvider {
  /**
   * Get organization details
   * @param userOrgId - The organization ID
   * @returns Promise resolving to organization information
   */
  getOrganizationInfo(userOrgId: string): Promise<Organization>;

  /**
   * List all organizations
   * @param userOrgId - The organization ID
   * @returns Promise resolving to an array of organizations
   */
  listOrganizations(userOrgId: string): Promise<Organization[]>;
}
