// src/lib/providers/interfaces/index.ts
// Central export file for all provider interfaces

/**
 * CRITICAL ARCHITECTURAL REQUIREMENT:
 * 
 * All provider method implementations MUST accept an apiClient parameter as their final argument.
 * This is enforced by the withActiveProvider HOC which provides the apiClient in the context.
 * 
 * When calling any provider method in API routes, you MUST pass the apiClient:
 * 
 * CORRECT:
 * ```typescript
 * const data = await (provider.invoices.listInvoices as any)(organizationId, params, apiClient);
 * ```
 * 
 * INCORRECT:
 * ```typescript
 * const data = await provider.invoices.listInvoices(organizationId, params); // Missing apiClient!
 * ```
 * 
 * The apiClient parameter ensures:
 * - Proper authentication and session management
 * - Centralized rate limiting
 * - Consistent error handling and retry logic
 * - Token refresh handling
 */

export * from './auth';
export * from './banking';
export * from './budgets';
export * from './customers';
export * from './expenses';
export * from './invoices';
export * from './organizations';
export * from './payments';
export * from './reports';
export * from './projects';
export * from './classes';
export * from './bills';

// Import the individual provider interfaces
import { AuthAndTokenProvider } from './auth';
import { InvoiceProvider } from './invoices';
import { ExpenseProvider } from './expenses';
import { ReportProvider } from './reports';
import { BankingProvider } from './banking';
import { CustomerProvider } from './customers';
import { BudgetProvider } from './budgets';
import { PaymentProvider } from './payments';
import { OrganizationProvider } from './organizations';
import { ProjectProvider } from './projects';
import { ClassLocationProvider } from './classes';
import { BillProvider } from './bills';

// Main FinancialProvider interface that combines all modules
export interface FinancialProvider {
  auth: AuthAndTokenProvider;
  invoices: InvoiceProvider;
  expenses: ExpenseProvider;
  reports: ReportProvider;
  banking: BankingProvider;
  customers: CustomerProvider;
  budgets: BudgetProvider;
  payments: PaymentProvider;
  organizations: OrganizationProvider;
  projects?: ProjectProvider;
  classes?: ClassLocationProvider;
  bills?: BillProvider;
}
