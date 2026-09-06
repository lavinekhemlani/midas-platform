// src/lib/providers/interfaces/estimates.ts

export interface Estimate {
  id: string;
  doc_number?: string;
  txn_date: string;
  expiration_date?: string;
  
  // Customer
  customer_ref: {
    value: string;
    name?: string;
  };
  
  // Status
  status?: 'Accepted' | 'Closed' | 'Pending' | 'Rejected';
  accepted_date?: string;
  accepted_by?: string;
  
  // Line items
  line_items?: Array<{
    id?: string;
    line_num?: number;
    description?: string;
    amount: number;
    detail_type: string;
    item_ref?: {
      value: string;
      name?: string;
    };
    qty?: number;
    unit_price?: number;
  }>;
  
  // Amounts
  total_amt: number;
  
  // Terms and notes
  sales_term_ref?: {
    value: string;
    name?: string;
  };
  customer_memo?: string;
  private_note?: string;
  
  // Addresses
  bill_addr?: {
    line1?: string;
    line2?: string;
    line3?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  ship_addr?: {
    line1?: string;
    line2?: string;
    line3?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  
  // Email
  bill_email?: string;
  email_status?: string;
  
  // Metadata
  created_time?: string;
  last_modified_time?: string;
  
  // Linked transactions
  linked_txn?: Array<{
    txn_id: string;
    txn_type: string;
  }>;
}

export interface EstimateListOptions {
  customer_id?: string;
  status?: 'Accepted' | 'Closed' | 'Pending' | 'Rejected';
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'date' | 'amount' | 'customer';
  sort_order?: 'asc' | 'desc';
}

export interface EstimateStatistics {
  total_estimates: number;
  pending_estimates: number;
  accepted_estimates: number;
  rejected_estimates: number;
  total_value: number;
  accepted_value: number;
  conversion_rate: number;
  average_estimate_value: number;
}

export interface EstimateProvider {
  listEstimates(userOrgId: string, options?: EstimateListOptions): Promise<Estimate[]>;
  getEstimate(userOrgId: string, estimateId: string): Promise<Estimate>;
  createEstimate(userOrgId: string, estimate: Partial<Estimate>): Promise<Estimate>;
  updateEstimate(userOrgId: string, estimateId: string, estimate: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(userOrgId: string, estimateId: string): Promise<void>;
  getEstimateStatistics(userOrgId: string): Promise<EstimateStatistics>;
  getPendingEstimates(userOrgId: string): Promise<Estimate[]>;
  getExpiringEstimates(userOrgId: string, days: number): Promise<Estimate[]>;
}