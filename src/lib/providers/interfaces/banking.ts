// src/lib/providers/interfaces/banking.ts
import { BaseQueryOptions } from './invoices';

/**
 * Options for listing bank transactions across different providers
 */
export interface BankTransactionOptions extends BaseQueryOptions {
  account_id?: string;
  search_text?: string;
  reference_number?: string;
  description?: string;
  debit_or_credit?: 'debit' | 'credit';
  amount_start?: number;
  amount_end?: number;
  transaction_type?: string;
}

/**
 * Generic bank account structure that providers should map to
 */
export interface BankAccount {
  account_id: string;
  account_name: string;
  account_type: string;
  balance: number;
  bank_balance: number;
  uncategorized_transactions: number;
  is_active: boolean;
  currency_code: string;
  account_number?: string;
  routing_number?: string;
}

/**
 * Generic bank transaction structure that providers should map to
 */
export interface BankTransaction {
  transaction_id: string;
  amount: number;
  date: string;
  description: string;
  reference_number?: string;
  debit_or_credit: 'debit' | 'credit';
  offset_account_name?: string;
  customer_id?: string;
  vendor_id?: string;
  status: string;
}

/**
 * Cash flow analysis data structure
 */
export interface CashFlowAnalysis {
  total_inflow: number;
  total_outflow: number;
  net_flow: number;
  daily_average_inflow: number;
  daily_average_outflow: number;
  daily_data: Array<{
    date: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
}

/**
 * Account balance summary data structure
 */
export interface AccountBalanceSummary {
  total_balance: number;
  total_bank_balance: number;
  accounts: Array<{
    account_id: string;
    account_name: string;
    balance: number;
    bank_balance: number;
    currency_code: string;
    uncategorized_count: number;
  }>;
}

/**
 * Transaction patterns analysis data structure
 */
export interface TransactionPatterns {
  recurring_patterns: Array<{
    description_pattern: string;
    frequency: number;
    average_amount: number;
    last_occurrence: string;
  }>;
  top_vendors: Array<{
    description: string;
    transaction_count: number;
    total_amount: number;
  }>;
  spending_categories: Array<{
    category: string;
    count: number;
    total_amount: number;
  }>;
}

/**
 * Interface that all banking providers must implement
 */
export interface BankingProvider {
  /**
   * List bank accounts
   * @param userOrgId - The organization ID
   * @param options - Filtering options
   * @returns Promise resolving to an array of bank accounts
   */
  listBankAccounts(userOrgId: string, options?: { filter_by?: 'Status.All' | 'Status.Active' | 'Status.Inactive' }): Promise<BankAccount[]>;

  /**
   * Get bank account details
   * @param userOrgId - The organization ID
   * @param accountId - The account ID
   * @returns Promise resolving to a single bank account
   */
  getBankAccount(userOrgId: string, accountId: string): Promise<BankAccount>;

  /**
   * List bank transactions with optional filtering
   * @param userOrgId - The organization ID
   * @param options - Filtering and pagination options
   * @returns Promise resolving to an array of bank transactions
   */
  listBankTransactions(userOrgId: string, options?: BankTransactionOptions): Promise<BankTransaction[]>;

  /**
   * Get bank transaction details
   * @param userOrgId - The organization ID
   * @param transactionId - The transaction ID
   * @returns Promise resolving to a single bank transaction
   */
  getBankTransaction(userOrgId: string, transactionId: string): Promise<BankTransaction>;

  /**
   * Get transactions for a specific account
   * @param userOrgId - The organization ID
   * @param accountId - The account ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of transactions
   */
  getAccountTransactions(userOrgId: string, accountId: string, options?: Omit<BankTransactionOptions, 'account_id'>): Promise<BankTransaction[]>;

  /**
   * Get recent transactions across all accounts
   * @param userOrgId - The organization ID
   * @param days - Number of days to look back (default: 30)
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of recent transactions
   */
  getRecentTransactions(userOrgId: string, days?: number, options?: BankTransactionOptions): Promise<BankTransaction[]>;

  /**
   * Get cash flow analysis from bank transactions
   * @param userOrgId - The organization ID
   * @param accountId - Optional specific account ID
   * @param days - Number of days to analyze (default: 30)
   * @returns Promise resolving to cash flow analysis data
   */
  getCashFlowAnalysis(userOrgId: string, accountId?: string, days?: number): Promise<CashFlowAnalysis>;

  /**
   * Get account balance summary
   * @param userOrgId - The organization ID
   * @returns Promise resolving to balance summary data
   */
  getAccountBalanceSummary(userOrgId: string): Promise<AccountBalanceSummary>;

  /**
   * Get uncategorized transactions requiring attention
   * @param userOrgId - The organization ID
   * @param accountId - Optional specific account ID
   * @returns Promise resolving to an array of uncategorized transactions
   */
  getUncategorizedTransactions(userOrgId: string, accountId?: string): Promise<BankTransaction[]>;

  /**
   * Search transactions by description or reference
   * @param userOrgId - The organization ID
   * @param searchText - Text to search for
   * @param accountId - Optional specific account ID
   * @param options - Additional filtering options
   * @returns Promise resolving to an array of matching transactions
   */
  searchTransactions(userOrgId: string, searchText: string, accountId?: string, options?: Omit<BankTransactionOptions, 'search_text' | 'account_id'>): Promise<BankTransaction[]>;

  /**
   * Get transaction patterns analysis
   * @param userOrgId - The organization ID
   * @param accountId - Optional specific account ID
   * @param days - Number of days to analyze (default: 90)
   * @returns Promise resolving to transaction patterns data
   */
  getTransactionPatterns(userOrgId: string, accountId?: string, days?: number): Promise<TransactionPatterns>;
}
