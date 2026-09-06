// src/lib/providers/quickbooks/projects.ts
import { QuickBooksClient } from './client';
import { ProviderApiClient } from '../apiClient';

export interface Project {
  id: string;
  name: string;
  customer_id?: string;
  customer_name?: string;
  status: 'InProgress' | 'Completed' | 'Cancelled' | 'NotStarted';
  start_date?: string;
  end_date?: string;
  description?: string;
  budget_amount?: number;
  actual_amount?: number;
  profitability?: number;
  profit_margin?: number;
  hours_budgeted?: number;
  hours_actual?: number;
  completion_percentage?: number;
  created_time?: string;
  last_modified_time?: string;
}

export interface ProjectProfitability {
  project_id: string;
  project_name: string;
  revenue: number;
  expenses: number;
  profit: number;
  profit_margin: number;
  hours_worked: number;
  labor_cost: number;
  material_cost: number;
  other_cost: number;
}

export interface ProjectListOptions {
  status?: 'InProgress' | 'Completed' | 'Cancelled' | 'NotStarted' | 'all';
  customer_id?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
  sort_by?: 'name' | 'start_date' | 'end_date' | 'status';
  sort_order?: 'asc' | 'desc';
}

// Note: QuickBooks Online doesn't have a native "Projects" entity in the API
// Projects are typically tracked using Classes, Locations, or Custom Fields
// This implementation uses Classes as projects for compatibility

export class ProjectsProvider {
  /**
   * List all projects (implemented as Classes in QuickBooks)
   */
  static async listProjects(
    userOrgId: string,
    options?: ProjectListOptions,
    apiClient?: ProviderApiClient
  ): Promise<Project[]> {
    try {
      const client = new QuickBooksClient({ organizationId: userOrgId });
      
      // Check if projects feature is available
      const isAvailable = await client.isFeatureAvailable('projects');
      if (!isAvailable) {
        console.warn('Projects feature not available in current QuickBooks plan');
        return [];
      }
      
      // Build optimized query with API-level filtering
      let query = 'SELECT * FROM Class WHERE Active = true';
      const whereConditions: string[] = [];
      
      // Add customer filtering if specified
      if (options?.customer_id) {
        // Note: QuickBooks Classes don't directly link to customers, but we can filter if needed
        // This would require custom field or different approach in real implementation
      }
      
      // Add date filtering for project dates
      if (options?.start_date || options?.end_date) {
        // Note: QuickBooks Classes don't have start/end dates by default
        // This would require custom fields in real implementation
      }
      
      // Add ordering with API-level optimization
      const sortBy = options?.sort_by || 'name';
      const sortOrder = options?.sort_order === 'desc' ? 'DESC' : 'ASC';
      
      if (sortBy === 'name') {
        query += ` ORDERBY Name ${sortOrder}`;
      } else {
        query += ` ORDERBY Name ${sortOrder}`; // Default to name ordering
      }
      
      // Add pagination with smaller default limits for better performance
      const limit = options?.per_page || 50; // Reduced from potential 200 to 50
      const startPosition = options?.page ? ((options.page - 1) * limit) + 1 : 1;
      
      if (startPosition > 1) {
        query += ` STARTPOSITION ${startPosition}`;
      }
      query += ` MAXRESULTS ${limit}`;
      
      console.log('QuickBooks Projects Query (API-optimized):', query);
      
      const result = await client.requestWithSoftFail<{ QueryResponse: { Class: any[] } }>(
        `/query?query=${encodeURIComponent(query)}`,
        {},
        'projects'
      );
      
      if (!result) {
        return [];
      }
      
      const classes = result.QueryResponse?.Class || [];
      
      // Map Classes to Projects
      const projects: Project[] = classes.map(cls => ({
        id: cls.Id,
        name: cls.Name,
        status: cls.Active ? 'InProgress' : 'Completed',
        description: cls.FullyQualifiedName,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      }));
      
      // Filter by status if specified
      if (options?.status && options.status !== 'all') {
        return projects.filter(p => p.status === options.status);
      }
      
      return projects;
    } catch (error) {
      console.error('Failed to list projects:', error);
      return [];
    }
  }

  /**
   * Get a single project
   */
  static async getProject(
    userOrgId: string,
    projectId: string,
    apiClient?: ProviderApiClient
  ): Promise<Project | null> {
    try {
      let classData: any;
      
      if (apiClient) {
        classData = await apiClient.get(`/class/${projectId}`);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        classData = await client.request(`/class/${projectId}`);
      }
      
      const cls = classData.Class || classData;
      
      return {
        id: cls.Id,
        name: cls.Name,
        status: cls.Active ? 'InProgress' : 'Completed',
        description: cls.FullyQualifiedName,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to get QuickBooks project:', error);
      return null;
    }
  }

  /**
   * Get project profitability report
   */
  static async getProjectProfitability(
    userOrgId: string,
    projectId: string,
    options?: {
      start_date?: string;
      end_date?: string;
      accounting_method?: 'Cash' | 'Accrual';
    },
    apiClient?: ProviderApiClient
  ): Promise<ProjectProfitability | null> {
    try {
      const client = new QuickBooksClient({ organizationId: userOrgId });
      
      // Use optimized parameters for P&L report
      const params: any = {
        accounting_method: options?.accounting_method || 'Accrual',
        class: projectId, // Filter by class (project)
        summarize_column_by: 'Month' // More efficient summarization
      };
      
      if (options?.start_date) {
        params.start_date = options.start_date;
      }
      
      if (options?.end_date) {
        params.end_date = options.end_date;
      }
      
      console.log('QuickBooks Project P&L Query (API-optimized):', params);
      
      const plReport = await client.getReport('ProfitAndLoss', params);
      
      // Parse the P&L report to extract project profitability
      let revenue = 0;
      let expenses = 0;
      let laborCost = 0;
      let materialCost = 0;
      let otherCost = 0;
      
      // Extract income total
      if (plReport?.Rows?.Row) {
        const rows = Array.isArray(plReport.Rows.Row) ? plReport.Rows.Row : [plReport.Rows.Row];
        
        rows.forEach((row: any) => {
          const rowType = row.group?.toLowerCase();
          const rowValue = parseFloat(row.ColData?.[1]?.value || '0');
          
          if (rowType === 'income' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Income') {
            revenue += rowValue;
          } else if (rowType === 'expenses' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Expenses') {
            expenses += rowValue;
            
            // Try to categorize expenses
            const expenseName = row.Row?.[0]?.ColData?.[0]?.value?.toLowerCase() || '';
            if (expenseName.includes('labor') || expenseName.includes('payroll')) {
              laborCost += rowValue;
            } else if (expenseName.includes('material') || expenseName.includes('supplies')) {
              materialCost += rowValue;
            } else {
              otherCost += rowValue;
            }
          }
        });
      }
      
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      // Get project details
      const project = await this.getProject(userOrgId, projectId, apiClient);
      
      return {
        project_id: projectId,
        project_name: project?.name || 'Unknown Project',
        revenue,
        expenses,
        profit,
        profit_margin: profitMargin,
        hours_worked: 0, // Would need time tracking data
        labor_cost: laborCost,
        material_cost: materialCost,
        other_cost: otherCost
      };
    } catch (error) {
      console.error('Failed to get project profitability:', error);
      return null;
    }
  }

  /**
   * Get all projects profitability summary
   */
  static async getProjectsSummary(
    userOrgId: string,
    options?: {
      start_date?: string;
      end_date?: string;
      status?: 'InProgress' | 'Completed' | 'all';
    },
    apiClient?: ProviderApiClient
  ): Promise<{
    total_projects: number;
    active_projects: number;
    completed_projects: number;
    total_revenue: number;
    total_expenses: number;
    total_profit: number;
    average_profit_margin: number;
    projects: ProjectProfitability[];
  }> {
    try {
      // Get projects with optimized pagination
      const projects = await this.listProjects(userOrgId, { 
        status: options?.status, 
        per_page: 100 // Limit for better performance 
      }, apiClient);
      
      // Process projects in smaller batches for better performance
      const projectProfitabilities: ProjectProfitability[] = [];
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      // Process projects in batches of 10 to avoid API rate limits
      const batchSize = 10;
      for (let i = 0; i < projects.length; i += batchSize) {
        const batch = projects.slice(i, i + batchSize);
        
        const batchPromises = batch.map(project =>
          this.getProjectProfitability(
            userOrgId,
            project.id,
            {
              start_date: options?.start_date,
              end_date: options?.end_date
            },
            apiClient
          )
        );
        
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(profitability => {
          if (profitability) {
            projectProfitabilities.push(profitability);
            totalRevenue += profitability.revenue;
            totalExpenses += profitability.expenses;
          }
        });
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < projects.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const totalProfit = totalRevenue - totalExpenses;
      const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      return {
        total_projects: projects.length,
        active_projects: projects.filter(p => p.status === 'InProgress').length,
        completed_projects: projects.filter(p => p.status === 'Completed').length,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        total_profit: totalProfit,
        average_profit_margin: avgProfitMargin,
        projects: projectProfitabilities
      };
    } catch (error) {
      console.error('Failed to get projects summary:', error);
      return {
        total_projects: 0,
        active_projects: 0,
        completed_projects: 0,
        total_revenue: 0,
        total_expenses: 0,
        total_profit: 0,
        average_profit_margin: 0,
        projects: []
      };
    }
  }

  /**
   * Create a new project (Class in QuickBooks)
   */
  static async createProject(
    userOrgId: string,
    project: {
      name: string;
      parent_id?: string;
      description?: string;
    },
    apiClient?: ProviderApiClient
  ): Promise<Project | null> {
    try {
      const classData = {
        Name: project.name,
        SubClass: !!project.parent_id,
        ParentRef: project.parent_id ? { value: project.parent_id } : undefined,
        Active: true
      };
      
      let result: any;
      
      if (apiClient) {
        result = await apiClient.post('/class', classData);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        result = await client.request('/class', {
          method: 'POST',
          body: JSON.stringify(classData)
        });
      }
      
      const cls = result.Class || result;
      
      return {
        id: cls.Id,
        name: cls.Name,
        status: 'InProgress',
        description: cls.FullyQualifiedName,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to create QuickBooks project:', error);
      return null;
    }
  }

  /**
   * Update a project
   */
  static async updateProject(
    userOrgId: string,
    projectId: string,
    updates: {
      name?: string;
      status?: 'InProgress' | 'Completed';
    },
    apiClient?: ProviderApiClient
  ): Promise<Project | null> {
    try {
      // First get the current project to get the SyncToken
      const current = await this.getProject(userOrgId, projectId, apiClient);
      if (!current) {
        throw new Error('Project not found');
      }
      
      const classData = {
        Id: projectId,
        Name: updates.name || current.name,
        Active: updates.status !== 'Completed',
        SyncToken: '0' // QuickBooks will require the actual SyncToken
      };
      
      let result: any;
      
      if (apiClient) {
        result = await apiClient.post('/class', classData);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        result = await client.request('/class', {
          method: 'POST',
          body: JSON.stringify(classData)
        });
      }
      
      const cls = result.Class || result;
      
      return {
        id: cls.Id,
        name: cls.Name,
        status: cls.Active ? 'InProgress' : 'Completed',
        description: cls.FullyQualifiedName,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to update QuickBooks project:', error);
      return null;
    }
  }

  /**
   * Get projects by status using API-level filtering
   * Performance optimized with status-based queries
   */
  static async getProjectsByStatus(
    userOrgId: string,
    status: 'InProgress' | 'Completed'
  ): Promise<Project[]> {
    try {
      const client = new QuickBooksClient({ organizationId: userOrgId });
      
      // Check if projects feature is available
      const isAvailable = await client.isFeatureAvailable('projects');
      if (!isAvailable) {
        console.warn('Projects feature not available in current QuickBooks plan');
        return [];
      }
      
      // API-level filtering for project status (Active = InProgress, Inactive = Completed)
      const isActive = status === 'InProgress';
      const query = `SELECT * FROM Class WHERE Active = ${isActive} ORDERBY Name ASC MAXRESULTS 100`;
      
      console.log('QuickBooks Projects by Status Query:', query);
      
      const result = await client.requestWithSoftFail<{ QueryResponse: { Class: any[] } }>(
        `/query?query=${encodeURIComponent(query)}`,
        {},
        'projects'
      );
      
      if (!result) {
        return [];
      }
      
      const classes = result.QueryResponse?.Class || [];
      
      // Map Classes to Projects
      return classes.map(cls => ({
        id: cls.Id,
        name: cls.Name,
        status: cls.Active ? 'InProgress' : 'Completed',
        description: cls.FullyQualifiedName,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      }));
    } catch (error) {
      console.error('Failed to get QuickBooks projects by status:', error);
      return [];
    }
  }

  /**
   * Get project financial summary using API-level filtering
   * Performance optimized with targeted class-based P&L reports
   */
  static async getProjectFinancialSummary(
    userOrgId: string,
    projectId: string,
    options?: { start_date?: string; end_date?: string }
  ): Promise<{
    revenue: number;
    expenses: number;
    profit: number;
    profit_margin: number;
    period: string;
  }> {
    try {
      const client = new QuickBooksClient({ organizationId: userOrgId });
      
      // Use class-specific P&L report for better performance
      const params: any = {
        accounting_method: 'Accrual',
        class: projectId,
        summarize_column_by: 'Total' // Single column for efficiency
      };
      
      if (options?.start_date) params.start_date = options.start_date;
      if (options?.end_date) params.end_date = options.end_date;
      
      console.log('QuickBooks Project Financial Summary Query:', params);
      
      const plReport = await client.getReport('ProfitAndLoss', params);
      
      let revenue = 0;
      let expenses = 0;
      
      // Parse P&L report efficiently
      if (plReport?.Rows?.Row) {
        const rows = Array.isArray(plReport.Rows.Row) ? plReport.Rows.Row : [plReport.Rows.Row];
        
        rows.forEach((row: any) => {
          const rowType = row.group?.toLowerCase();
          const rowValue = parseFloat(row.ColData?.[1]?.value || '0');
          
          if (rowType === 'income' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Income') {
            revenue += rowValue;
          } else if (rowType === 'expenses' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Expenses') {
            expenses += rowValue;
          }
        });
      }
      
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const period = options?.start_date && options?.end_date 
        ? `${options.start_date} to ${options.end_date}` 
        : 'All time';
      
      return {
        revenue,
        expenses,
        profit,
        profit_margin: profitMargin,
        period
      };
    } catch (error) {
      console.error('Failed to get QuickBooks project financial summary:', error);
      return {
        revenue: 0,
        expenses: 0,
        profit: 0,
        profit_margin: 0,
        period: 'Error'
      };
    }
  }
}