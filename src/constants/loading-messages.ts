/**
 * Centralized loading messages for consistent UX across the application.
 * Follow the pattern: "Loading [resource]..." or "[Action]ing [resource]..."
 */

export const LOADING_MESSAGES = {
  // Authentication & Session
  AUTH: {
    CHECKING: 'Checking authentication...',
    SIGNING_IN: 'Signing in...',
    SIGNING_OUT: 'Signing out...',
    LOADING_SESSION: 'Loading session...',
    REFRESHING_TOKEN: 'Refreshing authentication...',
  },

  // Data Fetching
  DATA: {
    FINANCIAL: 'Loading financial data...',
    REPORTS: 'Loading reports...',
    TRANSACTIONS: 'Loading transactions...',
    METRICS: 'Loading metrics...',
    SUMMARY: 'Loading summary...',
    CHART_DATA: 'Loading chart data...',
  },

  // Report Generation
  REPORTS: {
    GENERATING: 'Generating report...',
    PNL: 'Loading profit & loss statement...',
    BALANCE_SHEET: 'Loading balance sheet...',
    CASH_FLOW: 'Loading cash flow statement...',
    CUSTOM: 'Generating custom report...',
    EXPORTING_PDF: 'Exporting to PDF...',
    EXPORTING_CSV: 'Exporting to CSV...',
  },

  // Integration & Providers
  INTEGRATIONS: {
    CONNECTING: 'Connecting to provider...',
    DISCONNECTING: 'Disconnecting from provider...',
    SWITCHING: 'Switching provider...',
    TESTING: 'Testing connection...',
    SYNCING: 'Syncing data...',
    FETCHING_ACCOUNTS: 'Fetching accounts...',
    REFRESHING: 'Refreshing connection...',
  },

  // Chat & AI
  CHAT: {
    LOADING_HISTORY: 'Loading chat history...',
    LOADING_MORE: 'Loading older messages...',
    ANALYZING: 'Analyzing...',
    PROCESSING: 'Processing your request...',
    GENERATING_RESPONSE: 'Generating response...',
    THINKING: 'Thinking...',
  },

  // Forms & Submissions
  FORMS: {
    SAVING: 'Saving...',
    UPDATING: 'Updating...',
    SUBMITTING: 'Submitting...',
    VALIDATING: 'Validating...',
    UPLOADING: 'Uploading...',
    SAVING_SETTINGS: 'Saving settings...',
    UPDATING_PROFILE: 'Updating profile...',
    SAVING_PREFERENCES: 'Saving preferences...',
  },

  // Onboarding
  ONBOARDING: {
    CREATING_ACCOUNT: 'Creating your account...',
    SETTING_UP: 'Setting up your workspace...',
    CONNECTING_BOOKS: 'Connecting to your books...',
    IMPORTING_DATA: 'Importing your data...',
    FINALIZING: 'Finalizing setup...',
  },

  // Generic Messages
  GENERIC: {
    LOADING: 'Loading...',
    PLEASE_WAIT: 'Please wait...',
    PROCESSING: 'Processing...',
    UPDATING: 'Updating...',
    REFRESHING: 'Refreshing...',
    SEARCHING: 'Searching...',
    FETCHING: 'Fetching data...',
  },
} as const

/**
 * Progressive loading messages for long operations.
 * Each array represents a sequence of messages to show.
 */
export const PROGRESSIVE_MESSAGES = {
  DASHBOARD_LOAD: [
    'Connecting to your books',
    'Fetching financial data',
    'Calculating metrics',
    'Adding finishing touches',
  ],

  REPORT_GENERATION: [
    'Gathering data',
    'Processing transactions',
    'Calculating totals',
    'Generating report',
  ],

  AI_ANALYSIS: [
    'Understanding your request',
    'Analyzing financial data',
    'Generating insights',
    'Preparing response',
  ],

  PROVIDER_CONNECTION: [
    'Establishing connection',
    'Authenticating credentials',
    'Syncing accounts',
    'Finalizing setup',
  ],

  DATA_EXPORT: ['Preparing data', 'Formatting output', 'Generating file', 'Finalizing export'],
} as const

/**
 * Helper function to get a loading message with optional resource name.
 * Example: getLoadingMessage('DATA', 'FINANCIAL') => 'Loading financial data...'
 * Example: getLoadingMessage('GENERIC', 'LOADING', 'users') => 'Loading users...'
 */
export function getLoadingMessage(
  category: keyof typeof LOADING_MESSAGES,
  key: keyof (typeof LOADING_MESSAGES)[typeof category],
  resource?: string
): string {
  const message = LOADING_MESSAGES[category][key]

  if (resource && message === LOADING_MESSAGES.GENERIC.LOADING) {
    return `Loading ${resource}...`
  }

  return message
}

/**
 * Helper to create custom loading messages following the standard pattern.
 */
export function createLoadingMessage(action: string, resource: string): string {
  // Ensure action ends with 'ing'
  const actionVerb = action.endsWith('ing') ? action : `${action}ing`
  const capitalizedAction = actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)

  return `${capitalizedAction} ${resource}...`
}
