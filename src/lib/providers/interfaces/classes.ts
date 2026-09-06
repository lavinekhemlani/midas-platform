// src/lib/providers/interfaces/classes.ts

export interface Class {
  id: string;
  name: string;
  active: boolean;
  parentRef?: {
    value: string;
    name?: string;
  };
  subClass?: boolean;
  fullyQualifiedName?: string;
}

export interface Location {
  id: string;
  name: string;
  active: boolean;
  address?: {
    line1?: string;
    city?: string;
    countrySubDivisionCode?: string;
    postalCode?: string;
  };
}

export interface ClassPerformance {
  id: string;
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  customerCount?: number;
  transactionCount?: number;
}

export interface ClassLocationOptions {
  active_only?: boolean;
  per_page?: number;
  page?: number;
}

export interface ClassLocationProvider {
  listClasses(organizationId: string, options?: ClassLocationOptions): Promise<Class[]>;
  getClass(organizationId: string, classId: string): Promise<Class>;
  listLocations(organizationId: string, options?: ClassLocationOptions): Promise<Location[]>;
  getLocation(organizationId: string, locationId: string): Promise<Location>;
  getClassPerformance(organizationId: string, period?: string): Promise<ClassPerformance[]>;
  getLocationPerformance(organizationId: string, period?: string): Promise<ClassPerformance[]>;
}