// src/lib/providers/interfaces/projects.ts

export interface Project {
  id: string;
  name: string;
  status: 'NotStarted' | 'InProgress' | 'Completed';
  startDate?: string;
  endDate?: string;
  customer?: {
    id: string;
    name: string;
  };
  description?: string;
  active: boolean;
}

export interface ProjectProfitability {
  id: string;
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  budgetUtilization?: number;
  completionPercentage?: number;
}

export interface ProjectOptions {
  active_only?: boolean;
  customer_id?: string;
  per_page?: number;
  page?: number;
}

export interface ProjectProvider {
  listProjects(organizationId: string, options?: ProjectOptions): Promise<Project[]>;
  getProject(organizationId: string, projectId: string): Promise<Project>;
  getProjectProfitability(organizationId: string, projectId?: string): Promise<ProjectProfitability[]>;
  createProject(organizationId: string, project: Partial<Project>): Promise<Project>;
  updateProject(organizationId: string, projectId: string, updates: Partial<Project>): Promise<Project>;
}