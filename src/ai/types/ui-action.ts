// src/ai/types/ui-action.ts
// Type definitions for UI automation actions

export type UIActionType =
  | 'theme'
  | 'navigate'
  | 'tab'
  | 'sidebar'
  | 'chat_panel'
  | 'settings'
  | 'download_chat'

// =============================================================================
// Action Payloads
// =============================================================================

export interface ThemePayload {
  theme: 'light' | 'dark'
}

export interface NavigatePayload {
  path: string
  transitionType?: 'top-down-sweep' | 'radial' | 'fade' | 'none'
}

export interface TabPayload {
  tab: string
  context: 'reports' | 'sales' | 'expenses'
}

export interface SidebarPayload {
  action: 'expand' | 'collapse' | 'toggle'
}

export interface ChatPanelPayload {
  action: 'open' | 'close' | 'toggle' | 'dock' | 'fullscreen'
}

export interface SettingsPayload {
  setting: 'pii_mode' | 'proficiency_level' | 'revenue_model'
  value: boolean | string
}

export interface DownloadChatPayload {
  count: number
}

// =============================================================================
// UI Action
// =============================================================================

export interface UIAction {
  actionType: UIActionType
  payload:
    | ThemePayload
    | NavigatePayload
    | TabPayload
    | SidebarPayload
    | ChatPanelPayload
    | SettingsPayload
    | DownloadChatPayload
  description: string // Human-readable description for confirmation
}

// =============================================================================
// UI Action Proposal (sent for user confirmation)
// =============================================================================

export interface UIActionProposal {
  proposalId: string
  actions: UIAction[]
  confirmationMessage: string
}

// =============================================================================
// UI State (current state passed to LLM for context-aware commands)
// =============================================================================

export interface UIState {
  theme: 'light' | 'dark'
  currentPath: string
  sidebarExpanded: boolean
  chatMode: 'docked' | 'fullscreen' | 'closed'
  lastAction?: UIAction
}

// =============================================================================
// Route Mapping for Navigation
// =============================================================================

export const ROUTE_MAPPINGS: Record<string, string> = {
  // Shared routes (not provider-specific)
  dashboard: '/dashboard',
  settings: '/settings',
  memories: '/memories',
  memory: '/memories',
  'chart of accounts': '/coa',
  coa: '/coa',
  accounts: '/coa',
  learn: '/learn',
  support: '/support',
  notifications: '/notifications',
}

// Get human-readable name from path
export function getPageNameFromPath(path: string): string {
  // Strip provider prefix for matching, then add provider label
  const providerLabel = path.startsWith('/qb/') ? 'QB ' : path.startsWith('/bc/') ? 'BC ' : ''
  const stripped = path.replace(/^\/(qb|bc)\//, '/')

  const segmentToName: Record<string, string> = {
    '/reports/pnl': 'Profit & Loss',
    '/pnl': 'Profit & Loss',
    '/reports/balance-sheet': 'Balance Sheet',
    '/balance-sheet': 'Balance Sheet',
    '/reports/cash-flow': 'Cash Flow',
    '/cash-flow': 'Cash Flow',
    '/reports': 'Reports',
    '/sales': 'Sales',
    '/expenses/bills': 'Expenses',
    '/expenses/vendors': 'Vendors',
    '/vendors': 'Vendors',
    '/customers': 'Customers',
    '/inventory': 'Inventory',
    '/forecasting': 'Forecasting',
    '/journal': 'Journal',
    '/settings': 'Settings',
    '/memories': 'Memories',
    '/coa': 'Chart of Accounts',
    '/dashboard': 'Dashboard',
  }

  const name = segmentToName[stripped]
  return name ? `${providerLabel}${name}` : path
}
