// src/lib/providers/interfaces/vendors.ts

export interface Vendor {
  id: string;
  vendor_id?: string;
  display_name: string;
  company_name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  
  // Address
  bill_addr?: {
    line1?: string;
    line2?: string;
    line3?: string;
    line4?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
  };
  
  // Financial
  balance?: number;
  currency_code?: string;
  tax_id?: string;
  track_1099?: boolean;
  
  // Terms
  terms?: string;
  billing_rate?: number;
  
  // Status
  active?: boolean;
  
  // Metadata
  created_time?: string;
  last_modified_time?: string;
  notes?: string;
}

export interface VendorListOptions {
  active?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: 'name' | 'balance' | 'created_date';
  sort_order?: 'asc' | 'desc';
}

export interface VendorStatistics {
  total_vendors: number;
  active_vendors: number;
  total_outstanding: number;
  vendors_with_balance: number;
  average_payment_days: number;
  top_vendors_by_spend: Array<{
    vendor_id: string;
    vendor_name: string;
    total_spent: number;
    transaction_count: number;
  }>;
}

export interface VendorProvider {
  listVendors(userOrgId: string, options?: VendorListOptions): Promise<Vendor[]>;
  getVendor(userOrgId: string, vendorId: string): Promise<Vendor>;
  createVendor(userOrgId: string, vendor: Partial<Vendor>): Promise<Vendor>;
  updateVendor(userOrgId: string, vendorId: string, vendor: Partial<Vendor>): Promise<Vendor>;
  getVendorStatistics(userOrgId: string): Promise<VendorStatistics>;
  searchVendors(userOrgId: string, query: string): Promise<Vendor[]>;
  getVendorsWithBalance(userOrgId: string): Promise<Vendor[]>;
}