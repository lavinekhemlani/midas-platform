// src/lib/providers/quickbooks/classes.ts
import { QuickBooksClient } from './client';
import { ProviderApiClient } from '../apiClient';

export interface Class {
  id: string;
  name: string;
  fully_qualified_name: string;
  active: boolean;
  parent_id?: string;
  parent_name?: string;
  sub_class: boolean;
  level: number;
  created_time: string;
  last_modified_time: string;
}

export interface Location {
  id: string;
  name: string;
  active: boolean;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  created_time: string;
  last_modified_time: string;
}

export interface ClassPerformance {
  class_id: string;
  class_name: string;
  revenue: number;
  expenses: number;
  profit: number;
  profit_margin: number;
  transaction_count: number;
  period: {
    start_date: string;
    end_date: string;
  };
}

export interface LocationPerformance {
  location_id: string;
  location_name: string;
  revenue: number;
  expenses: number;
  profit: number;
  profit_margin: number;
  transaction_count: number;
  customer_count: number;
  period: {
    start_date: string;
    end_date: string;
  };
}

export class ClassesLocationsProvider {
  /**
   * List all classes
   */
  static async listClasses(
    userOrgId: string,
    options?: {
      active_only?: boolean;
      parent_id?: string;
      page?: number;
      per_page?: number;
    },
    apiClient?: ProviderApiClient
  ): Promise<Class[]> {
    try {
      // Build query
      let query = 'SELECT * FROM Class';
      const conditions: string[] = [];
      
      if (options?.active_only) {
        conditions.push('Active = true');
      }
      
      if (options?.parent_id) {
        conditions.push(`ParentRef = '${options.parent_id}'`);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDERBY Name ASC';
      
      // Add pagination
      if (options?.page && options?.per_page) {
        const startPosition = (options.page - 1) * options.per_page;
        query += ` STARTPOSITION ${startPosition} MAXRESULTS ${options.per_page}`;
      }
      
      let classes: any[];
      
      if (apiClient) {
        const result = await apiClient.get<{ QueryResponse: { Class: any[] } }>(
          `/query?query=${encodeURIComponent(query)}`
        );
        classes = result.QueryResponse?.Class || [];
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        const result = await client.query<{ QueryResponse: { Class: any[] } }>(query);
        classes = result.QueryResponse?.Class || [];
      }
      
      // Map to our Class interface
      return classes.map(cls => ({
        id: cls.Id,
        name: cls.Name,
        fully_qualified_name: cls.FullyQualifiedName || cls.Name,
        active: cls.Active !== false,
        parent_id: cls.ParentRef?.value,
        parent_name: cls.ParentRef?.name,
        sub_class: cls.SubClass || false,
        level: cls.Level || 0,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      }));
    } catch (error) {
      console.error('Failed to list QuickBooks classes:', error);
      return [];
    }
  }

  /**
   * Get a single class
   */
  static async getClass(
    userOrgId: string,
    classId: string,
    apiClient?: ProviderApiClient
  ): Promise<Class | null> {
    try {
      let classData: any;
      
      if (apiClient) {
        classData = await apiClient.get(`/class/${classId}`);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        classData = await client.request(`/class/${classId}`);
      }
      
      const cls = classData.Class || classData;
      
      return {
        id: cls.Id,
        name: cls.Name,
        fully_qualified_name: cls.FullyQualifiedName || cls.Name,
        active: cls.Active !== false,
        parent_id: cls.ParentRef?.value,
        parent_name: cls.ParentRef?.name,
        sub_class: cls.SubClass || false,
        level: cls.Level || 0,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to get QuickBooks class:', error);
      return null;
    }
  }

  /**
   * List all locations (Departments in QuickBooks)
   */
  static async listLocations(
    userOrgId: string,
    options?: {
      active_only?: boolean;
      page?: number;
      per_page?: number;
    },
    apiClient?: ProviderApiClient
  ): Promise<Location[]> {
    try {
      // Build query for Departments (used as Locations in QuickBooks)
      let query = 'SELECT * FROM Department';
      
      if (options?.active_only) {
        query += ' WHERE Active = true';
      }
      
      query += ' ORDERBY Name ASC';
      
      // Add pagination
      if (options?.page && options?.per_page) {
        const startPosition = (options.page - 1) * options.per_page;
        query += ` STARTPOSITION ${startPosition} MAXRESULTS ${options.per_page}`;
      }
      
      let departments: any[];
      
      if (apiClient) {
        const result = await apiClient.get<{ QueryResponse: { Department: any[] } }>(
          `/query?query=${encodeURIComponent(query)}`
        );
        departments = result.QueryResponse?.Department || [];
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        const result = await client.query<{ QueryResponse: { Department: any[] } }>(query);
        departments = result.QueryResponse?.Department || [];
      }
      
      // Map to our Location interface
      return departments.map(dept => ({
        id: dept.Id,
        name: dept.Name,
        active: dept.Active !== false,
        created_time: dept.CreateTime,
        last_modified_time: dept.LastUpdatedTime
      }));
    } catch (error) {
      console.error('Failed to list QuickBooks locations:', error);
      return [];
    }
  }

  /**
   * Get a single location
   */
  static async getLocation(
    userOrgId: string,
    locationId: string,
    apiClient?: ProviderApiClient
  ): Promise<Location | null> {
    try {
      let deptData: any;
      
      if (apiClient) {
        deptData = await apiClient.get(`/department/${locationId}`);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        deptData = await client.request(`/department/${locationId}`);
      }
      
      const dept = deptData.Department || deptData;
      
      return {
        id: dept.Id,
        name: dept.Name,
        active: dept.Active !== false,
        created_time: dept.CreateTime,
        last_modified_time: dept.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to get QuickBooks location:', error);
      return null;
    }
  }

  /**
   * Get class performance metrics
   */
  static async getClassPerformance(
    userOrgId: string,
    classId: string,
    options: {
      start_date: string;
      end_date: string;
      accounting_method?: 'Cash' | 'Accrual';
    },
    apiClient?: ProviderApiClient
  ): Promise<ClassPerformance | null> {
    try {
      const params = {
        start_date: options.start_date,
        end_date: options.end_date,
        accounting_method: options.accounting_method || 'Accrual',
        class: classId
      };
      
      let plReport: any;
      
      if (apiClient) {
        const queryParams = new URLSearchParams(params).toString();
        plReport = await apiClient.get(`/reports/ProfitAndLoss?${queryParams}`);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        plReport = await client.getReport('ProfitAndLoss', params);
      }
      
      // Parse the P&L report
      let revenue = 0;
      let expenses = 0;
      let transactionCount = 0;
      
      if (plReport?.Rows?.Row) {
        const rows = Array.isArray(plReport.Rows.Row) ? plReport.Rows.Row : [plReport.Rows.Row];
        
        rows.forEach((row: any) => {
          const rowType = row.group?.toLowerCase();
          const rowValue = parseFloat(row.ColData?.[1]?.value || '0');
          
          if (rowType === 'income' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Income') {
            revenue += rowValue;
            transactionCount++;
          } else if (rowType === 'expenses' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Expenses') {
            expenses += rowValue;
            transactionCount++;
          }
        });
      }
      
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      // Get class details
      const classData = await this.getClass(userOrgId, classId, apiClient);
      
      return {
        class_id: classId,
        class_name: classData?.name || 'Unknown Class',
        revenue,
        expenses,
        profit,
        profit_margin: profitMargin,
        transaction_count: transactionCount,
        period: {
          start_date: options.start_date,
          end_date: options.end_date
        }
      };
    } catch (error) {
      console.error('Failed to get class performance:', error);
      return null;
    }
  }

  /**
   * Get location performance metrics
   */
  static async getLocationPerformance(
    userOrgId: string,
    locationId: string,
    options: {
      start_date: string;
      end_date: string;
      accounting_method?: 'Cash' | 'Accrual';
    },
    apiClient?: ProviderApiClient
  ): Promise<LocationPerformance | null> {
    try {
      const params = {
        start_date: options.start_date,
        end_date: options.end_date,
        accounting_method: options.accounting_method || 'Accrual',
        department: locationId // Department is used as Location in QuickBooks
      };
      
      let plReport: any;
      
      if (apiClient) {
        const queryParams = new URLSearchParams(params).toString();
        plReport = await apiClient.get(`/reports/ProfitAndLoss?${queryParams}`);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        plReport = await client.getReport('ProfitAndLoss', params);
      }
      
      // Parse the P&L report
      let revenue = 0;
      let expenses = 0;
      let transactionCount = 0;
      
      if (plReport?.Rows?.Row) {
        const rows = Array.isArray(plReport.Rows.Row) ? plReport.Rows.Row : [plReport.Rows.Row];
        
        rows.forEach((row: any) => {
          const rowType = row.group?.toLowerCase();
          const rowValue = parseFloat(row.ColData?.[1]?.value || '0');
          
          if (rowType === 'income' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Income') {
            revenue += rowValue;
            transactionCount++;
          } else if (rowType === 'expenses' || row.Row?.[0]?.ColData?.[0]?.value === 'Total Expenses') {
            expenses += rowValue;
            transactionCount++;
          }
        });
      }
      
      const profit = revenue - expenses;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
      
      // Get location details
      const locationData = await this.getLocation(userOrgId, locationId, apiClient);
      
      // Get customer count for this location
      let customerCount = 0;
      try {
        const customerQuery = `SELECT COUNT(*) FROM Customer WHERE Department = '${locationId}'`;
        let customerResult: any;
        
        if (apiClient) {
          customerResult = await apiClient.get(`/query?query=${encodeURIComponent(customerQuery)}`);
        } else {
          const client = new QuickBooksClient({ organizationId: userOrgId });
          customerResult = await client.query(customerQuery);
        }
        
        customerCount = customerResult.QueryResponse?.totalCount || 0;
      } catch (err) {
        console.warn('Failed to get customer count for location:', err);
      }
      
      return {
        location_id: locationId,
        location_name: locationData?.name || 'Unknown Location',
        revenue,
        expenses,
        profit,
        profit_margin: profitMargin,
        transaction_count: transactionCount,
        customer_count: customerCount,
        period: {
          start_date: options.start_date,
          end_date: options.end_date
        }
      };
    } catch (error) {
      console.error('Failed to get location performance:', error);
      return null;
    }
  }

  /**
   * Get performance comparison across all classes
   */
  static async getClassComparison(
    userOrgId: string,
    options: {
      start_date: string;
      end_date: string;
      accounting_method?: 'Cash' | 'Accrual';
      active_only?: boolean;
    },
    apiClient?: ProviderApiClient
  ): Promise<{
    classes: ClassPerformance[];
    totals: {
      revenue: number;
      expenses: number;
      profit: number;
      average_profit_margin: number;
    };
  }> {
    try {
      // Get all classes
      const classes = await this.listClasses(
        userOrgId,
        { active_only: options.active_only },
        apiClient
      );
      
      // Get performance for each class
      const classPerformances: ClassPerformance[] = [];
      let totalRevenue = 0;
      let totalExpenses = 0;
      
      for (const cls of classes) {
        const performance = await this.getClassPerformance(
          userOrgId,
          cls.id,
          {
            start_date: options.start_date,
            end_date: options.end_date,
            accounting_method: options.accounting_method
          },
          apiClient
        );
        
        if (performance && (performance.revenue > 0 || performance.expenses > 0)) {
          classPerformances.push(performance);
          totalRevenue += performance.revenue;
          totalExpenses += performance.expenses;
        }
      }
      
      // Sort by profit descending
      classPerformances.sort((a, b) => b.profit - a.profit);
      
      const totalProfit = totalRevenue - totalExpenses;
      const avgProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      return {
        classes: classPerformances,
        totals: {
          revenue: totalRevenue,
          expenses: totalExpenses,
          profit: totalProfit,
          average_profit_margin: avgProfitMargin
        }
      };
    } catch (error) {
      console.error('Failed to get class comparison:', error);
      return {
        classes: [],
        totals: {
          revenue: 0,
          expenses: 0,
          profit: 0,
          average_profit_margin: 0
        }
      };
    }
  }

  /**
   * Create a new class
   */
  static async createClass(
    userOrgId: string,
    classData: {
      name: string;
      parent_id?: string;
      active?: boolean;
    },
    apiClient?: ProviderApiClient
  ): Promise<Class | null> {
    try {
      const data = {
        Name: classData.name,
        SubClass: !!classData.parent_id,
        ParentRef: classData.parent_id ? { value: classData.parent_id } : undefined,
        Active: classData.active !== false
      };
      
      let result: any;
      
      if (apiClient) {
        result = await apiClient.post('/class', data);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        result = await client.request('/class', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      
      const cls = result.Class || result;
      
      return {
        id: cls.Id,
        name: cls.Name,
        fully_qualified_name: cls.FullyQualifiedName || cls.Name,
        active: cls.Active !== false,
        parent_id: cls.ParentRef?.value,
        parent_name: cls.ParentRef?.name,
        sub_class: cls.SubClass || false,
        level: cls.Level || 0,
        created_time: cls.CreateTime,
        last_modified_time: cls.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to create QuickBooks class:', error);
      return null;
    }
  }

  /**
   * Create a new location (Department)
   */
  static async createLocation(
    userOrgId: string,
    locationData: {
      name: string;
      active?: boolean;
    },
    apiClient?: ProviderApiClient
  ): Promise<Location | null> {
    try {
      const data = {
        Name: locationData.name,
        Active: locationData.active !== false
      };
      
      let result: any;
      
      if (apiClient) {
        result = await apiClient.post('/department', data);
      } else {
        const client = new QuickBooksClient({ organizationId: userOrgId });
        result = await client.request('/department', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
      
      const dept = result.Department || result;
      
      return {
        id: dept.Id,
        name: dept.Name,
        active: dept.Active !== false,
        created_time: dept.CreateTime,
        last_modified_time: dept.LastUpdatedTime
      };
    } catch (error) {
      console.error('Failed to create QuickBooks location:', error);
      return null;
    }
  }
}