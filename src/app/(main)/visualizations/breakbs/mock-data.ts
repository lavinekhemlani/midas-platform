// Mock balance sheet data for visualization prototyping
// Real data: Assets=$558K, Liabilities=$1.4M, Equity=-$867K

export interface HierarchyNode {
  name: string
  value: number
  children?: HierarchyNode[]
}

export interface CategoryHierarchy {
  total: number
  children: HierarchyNode[]
}

export interface BalanceSheetData {
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  assetsHierarchy: {
    current: CategoryHierarchy
    fixed: CategoryHierarchy
    other: CategoryHierarchy
  }
  liabilitiesHierarchy: {
    current: CategoryHierarchy
    longTerm: CategoryHierarchy
  }
  equityHierarchy: CategoryHierarchy
}

export const MOCK_DATA: BalanceSheetData = {
  totalAssets: 558884.3,
  totalLiabilities: 1426272.15,
  totalEquity: -867387.85,

  assetsHierarchy: {
    current: {
      total: 350000,
      children: [
        {
          name: 'Bank Accounts',
          value: 150000,
          children: [
            { name: 'Checking Account', value: 100000 },
            { name: 'Savings Account', value: 50000 },
          ],
        },
        {
          name: 'Accounts Receivable',
          value: 120000,
          children: [
            { name: 'Customer A', value: 50000 },
            { name: 'Customer B', value: 40000 },
            { name: 'Customer C', value: 30000 },
          ],
        },
        { name: 'Inventory', value: 80000 },
      ],
    },
    fixed: {
      total: 180000,
      children: [
        {
          name: 'Equipment',
          value: 100000,
          children: [
            { name: 'Machinery', value: 60000 },
            { name: 'Computers', value: 40000 },
          ],
        },
        { name: 'Vehicles', value: 80000 },
      ],
    },
    other: {
      total: 28884.3,
      children: [{ name: 'Security Deposits', value: 28884.3 }],
    },
  },

  liabilitiesHierarchy: {
    current: {
      total: 800000,
      children: [
        {
          name: 'Accounts Payable',
          value: 500000,
          children: [
            { name: 'Vendor A', value: 200000 },
            { name: 'Vendor B', value: 150000 },
            { name: 'Vendor C', value: 150000 },
          ],
        },
        { name: 'Credit Cards', value: 150000 },
        { name: 'Accrued Expenses', value: 150000 },
      ],
    },
    longTerm: {
      total: 626272.15,
      children: [
        { name: 'Notes Payable', value: 400000 },
        { name: 'Long-Term Debt', value: 226272.15 },
      ],
    },
  },

  equityHierarchy: {
    total: -867387.85,
    children: [
      { name: 'Opening Balance Equity', value: -200000 },
      { name: 'Retained Earnings', value: -500000 },
      { name: 'Net Income', value: -167387.85 },
    ],
  },
}

// Color palette for charts
export const COLORS = {
  assets: '#10b981', // emerald-500
  liabilities: '#ef4444', // red-500
  equityPositive: '#3b82f6', // blue-500
  equityNegative: '#ef4444', // red-500
  total: '#8b5cf6', // violet-500
  transparent: 'transparent',
}
