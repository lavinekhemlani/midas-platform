// src/lib/providers/interfaces/bills.ts

export interface Bill {
  id: string;
  vendor: {
    id: string;
    name: string;
  };
  txnDate: string;
  dueDate: string;
  totalAmt: number;
  balance?: number;
  status: 'paid' | 'unpaid' | 'partial';
  docNumber?: string;
  lines?: BillLine[];
}

export interface BillLine {
  id?: string;
  amount: number;
  description?: string;
  accountRef?: {
    value: string;
    name?: string;
  };
}

export interface BillOptions {
  status?: 'paid' | 'unpaid' | 'all';
  vendor_id?: string;
  from_date?: string;
  to_date?: string;
  per_page?: number;
  page?: number;
}

export interface BillProvider {
  listBills(organizationId: string, options?: BillOptions): Promise<Bill[]>;
  getBill(organizationId: string, billId: string): Promise<Bill>;
  createBill(organizationId: string, bill: Partial<Bill>): Promise<Bill>;
  updateBill(organizationId: string, billId: string, updates: Partial<Bill>): Promise<Bill>;
  payBill(organizationId: string, billId: string, payment: any): Promise<any>;
}