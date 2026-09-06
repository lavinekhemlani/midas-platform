// src/lib/learn/quickbooks-terms.ts
import { GlossaryEntry } from '@/lib/data';

export const quickBooksTerms: Partial<GlossaryEntry>[] = [
  {
    id: 'project-management',
    title: 'Project Management',
    category: 'quickbooks',
    contextualSubtitle: 'Track profitability by job or project',
    definitions: {
      basic: 'A way to track income and expenses for specific jobs or projects in your business.',
      contextual: 'QuickBooks Projects (available in Plus and Advanced) lets you organize all the moving pieces of a job in one place — estimates, invoices, expenses, time tracking, and profitability reports.',
      metaphor: 'Think of it as a separate folder for each job where you keep all related financial documents, making it easy to see if you made money on that specific project.'
    },
    examples: {
      generic: 'A contractor tracking costs and revenue for building a deck',
      startup: 'A software agency tracking development hours and expenses for each client project',
      industry: 'A marketing firm organizing campaigns by client with separate P&L for each'
    },
    relatedTerms: ['profit-margin', 'job-costing', 'time-tracking'],
    learningPaths: ['quickbooks-advanced']
  },
  {
    id: 'classes',
    title: 'Classes',
    category: 'quickbooks',
    contextualSubtitle: 'Categorize transactions by department, product line, or location',
    definitions: {
      basic: 'A way to categorize your income and expenses to track profitability by business segments.',
      contextual: 'Classes in QuickBooks (Plus and Advanced only) allow you to tag transactions to track income and expenses for different parts of your business — like departments, product lines, or service types.',
      metaphor: 'Like putting colored tags on your transactions so you can sort them into different buckets and see which bucket is most profitable.'
    },
    examples: {
      generic: 'A restaurant tracking sales and costs separately for dine-in vs takeout',
      startup: 'A SaaS company tracking revenue by product tier (Basic, Pro, Enterprise)',
      industry: 'A retail chain tracking performance by store location'
    },
    relatedTerms: ['locations', 'departments', 'profit-centers'],
    learningPaths: ['quickbooks-reporting']
  },
  {
    id: 'locations',
    title: 'Locations',
    category: 'quickbooks',
    contextualSubtitle: 'Track performance by physical or virtual locations',
    definitions: {
      basic: 'A feature to track income and expenses by different business locations.',
      contextual: 'Locations in QuickBooks work alongside Classes to provide another dimension of tracking. While Classes might track departments, Locations can track physical stores, offices, or regions.',
      metaphor: 'Like having a separate cash register for each store location, so you know exactly how much each location is making or spending.'
    },
    examples: {
      generic: 'A coffee shop chain tracking sales for downtown vs airport locations',
      startup: 'A remote company tracking expenses by employee home state for tax purposes',
      industry: 'A franchise tracking royalties and fees by franchisee location'
    },
    relatedTerms: ['classes', 'multi-location', 'branch-accounting'],
    learningPaths: ['quickbooks-reporting']
  },
  {
    id: 'budgets',
    title: 'Budgets',
    category: 'quickbooks',
    contextualSubtitle: 'Plan and compare actual vs expected performance',
    definitions: {
      basic: 'A financial plan that estimates income and expenses for a future period.',
      contextual: 'QuickBooks Budgets (Plus and Advanced) lets you create profit and loss or balance sheet budgets by customer, class, or location. You can then run budget vs actual reports to see how you\'re performing.',
      metaphor: 'Like setting a spending limit on your credit card for different categories — you plan how much to spend, then check if you stayed within those limits.'
    },
    examples: {
      generic: 'Setting a $10,000 monthly marketing budget and tracking actual spend',
      startup: 'Creating department budgets for engineering, sales, and marketing',
      industry: 'A construction company budgeting materials and labor for each project'
    },
    relatedTerms: ['forecasting', 'variance-analysis', 'financial-planning'],
    learningPaths: ['financial-planning']
  },
  {
    id: 'job-costing',
    title: 'Job Costing',
    category: 'quickbooks',
    contextualSubtitle: 'Calculate true profitability for each job',
    definitions: {
      basic: 'Tracking all costs associated with a specific job or project to determine its profitability.',
      contextual: 'Job costing in QuickBooks involves assigning labor, materials, and overhead costs to specific projects. This helps you understand which jobs make money and which don\'t.',
      metaphor: 'Like keeping a detailed recipe for each dish in a restaurant — tracking every ingredient and minute of prep time to know the true cost of making that dish.'
    },
    examples: {
      generic: 'A plumber tracking parts, labor hours, and travel time for each service call',
      startup: 'A consulting firm allocating employee hours and expenses to client projects',
      industry: 'A custom manufacturer tracking materials and machine time per order'
    },
    relatedTerms: ['project-management', 'time-tracking', 'profit-margin'],
    learningPaths: ['quickbooks-advanced']
  },
  {
    id: 'accounts-receivable-aging',
    title: 'A/R Aging',
    category: 'quickbooks',
    contextualSubtitle: 'Track how long customers take to pay',
    definitions: {
      basic: 'A report showing how long invoices have been outstanding.',
      contextual: 'The A/R Aging report in QuickBooks categorizes unpaid customer invoices by how overdue they are (Current, 1-30 days, 31-60 days, etc.), helping you identify collection issues.',
      metaphor: 'Like checking expiration dates in your fridge — the older the invoice, the more urgent it is to collect before it goes "bad" (becomes uncollectible).'
    },
    examples: {
      generic: 'Seeing that Client A owes $5,000 from 45 days ago',
      startup: 'Identifying enterprise customers who consistently pay 60+ days late',
      industry: 'A wholesaler tracking which retailers are behind on payments'
    },
    relatedTerms: ['dso', 'collections', 'cash-flow'],
    learningPaths: ['accounts-receivable']
  },
  {
    id: 'quickbooks-plans',
    title: 'QuickBooks Plans',
    category: 'quickbooks',
    contextualSubtitle: 'Understanding feature availability by subscription tier',
    definitions: {
      basic: 'Different subscription levels of QuickBooks Online with varying features.',
      contextual: 'QuickBooks offers SimpleStart (basic), Essentials (+ bills & time), Plus (+ projects & inventory), and Advanced (+ custom fields & automation). Each tier unlocks more powerful features.',
      metaphor: 'Like gym memberships — basic gets you in the door, but premium memberships give you access to personal trainers, classes, and the fancy equipment.'
    },
    examples: {
      generic: 'SimpleStart for freelancers, Plus for small businesses with inventory',
      startup: 'Starting with Essentials, upgrading to Plus when you need project tracking',
      industry: 'Advanced for companies needing custom workflows and multiple budgets'
    },
    relatedTerms: ['feature-comparison', 'subscription-tiers', 'upgrade-path'],
    learningPaths: ['quickbooks-basics']
  },
  {
    id: 'custom-fields',
    title: 'Custom Fields',
    category: 'quickbooks',
    contextualSubtitle: 'Add your own data fields to transactions',
    definitions: {
      basic: 'Additional fields you can add to invoices, expenses, and other transactions.',
      contextual: 'Custom fields in QuickBooks Advanced let you track information specific to your business — like project codes, employee IDs, or contract numbers — directly on transactions.',
      metaphor: 'Like adding extra columns to a spreadsheet that are unique to your business needs, so you can track the specific details that matter to you.'
    },
    examples: {
      generic: 'Adding a "Project Code" field to all expenses for better tracking',
      startup: 'Including "Sprint Number" on development expenses',
      industry: 'Adding "Warranty Expiration" to equipment purchases'
    },
    relatedTerms: ['automation', 'workflows', 'data-tracking'],
    learningPaths: ['quickbooks-advanced']
  },
  {
    id: 'batch-transactions',
    title: 'Batch Transactions',
    category: 'quickbooks',
    contextualSubtitle: 'Process multiple transactions at once',
    definitions: {
      basic: 'The ability to create, edit, or process multiple transactions simultaneously.',
      contextual: 'Batch transactions in QuickBooks Advanced save time by letting you enter multiple invoices, bills, or checks at once, or perform bulk actions like sending statements.',
      metaphor: 'Like using a copy machine that can scan 50 pages at once instead of placing each page individually — same result, much faster.'
    },
    examples: {
      generic: 'Creating 20 similar invoices for monthly service contracts',
      startup: 'Batch entering all employee expense reports at month-end',
      industry: 'Processing weekly vendor bills in one batch'
    },
    relatedTerms: ['automation', 'efficiency', 'bulk-processing'],
    learningPaths: ['quickbooks-advanced']
  },
  {
    id: 'profit-centers',
    title: 'Profit Centers',
    category: 'quickbooks',
    contextualSubtitle: 'Business segments that generate profit independently',
    definitions: {
      basic: 'Parts of your business that you track separately to see their individual profitability.',
      contextual: 'Using Classes and Locations in QuickBooks to create profit centers helps you understand which parts of your business are most profitable and which might be draining resources.',
      metaphor: 'Like having different lemonade stands on different streets — each stand is a profit center, and you want to know which location sells the most lemonade.'
    },
    examples: {
      generic: 'A bakery tracking retail sales vs wholesale separately',
      startup: 'A SaaS tracking self-serve vs enterprise sales channels',
      industry: 'A law firm tracking profitability by practice area'
    },
    relatedTerms: ['classes', 'locations', 'segment-reporting'],
    learningPaths: ['business-analysis']
  }
];

// Helper function to get QuickBooks-specific terms
export function getQuickBooksTerms(): Partial<GlossaryEntry>[] {
  return quickBooksTerms;
}

// Helper function to get term by ID
export function getQuickBooksTerm(id: string): Partial<GlossaryEntry> | undefined {
  return quickBooksTerms.find(term => term.id === id);
}

// Categories for QuickBooks terms
export const quickBooksCategories = [
  { id: 'quickbooks', label: 'QuickBooks Features', icon: 'FileText' },
  { id: 'quickbooks-reporting', label: 'Reporting & Analytics', icon: 'BarChart' },
  { id: 'quickbooks-advanced', label: 'Advanced Features', icon: 'Settings' },
  { id: 'quickbooks-basics', label: 'Getting Started', icon: 'BookOpen' }
];