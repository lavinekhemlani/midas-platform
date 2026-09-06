// Standardized error codes for provider authentication issues
export enum ProviderErrorCode {
  // User authentication errors
  USER_AUTH_EXPIRED = 'USER_AUTH_EXPIRED',
  USER_AUTH_INVALID = 'USER_AUTH_INVALID',
  USER_AUTH_TIMEOUT = 'USER_AUTH_TIMEOUT',
  
  // Provider connection errors
  PROVIDER_NOT_CONNECTED = 'PROVIDER_NOT_CONNECTED',
  PROVIDER_TOKEN_EXPIRED = 'PROVIDER_TOKEN_EXPIRED',
  PROVIDER_REFRESH_FAILED = 'PROVIDER_REFRESH_FAILED',
  PROVIDER_INVALID_GRANT = 'PROVIDER_INVALID_GRANT',
  PROVIDER_DISCONNECTED = 'PROVIDER_DISCONNECTED',
  
  // API errors
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_TIMEOUT = 'API_TIMEOUT',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
}

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  userMessage: string; // User-friendly message
  action?: 'login' | 'reconnect' | 'retry' | 'contact_support';
  provider?: string;
  details?: any;
}

export function createProviderError(
  code: ProviderErrorCode,
  details?: any
): ProviderError {
  const errorMap: Record<ProviderErrorCode, { message: string; userMessage: string; action: ProviderError['action'] }> = {
    [ProviderErrorCode.USER_AUTH_EXPIRED]: {
      message: 'User authentication token expired',
      userMessage: 'Your session has expired. Please log in again.',
      action: 'login'
    },
    [ProviderErrorCode.USER_AUTH_INVALID]: {
      message: 'Invalid user authentication token',
      userMessage: 'Authentication error. Please log in again.',
      action: 'login'
    },
    [ProviderErrorCode.USER_AUTH_TIMEOUT]: {
      message: 'User authentication verification timed out',
      userMessage: 'Connection timeout. Please try again.',
      action: 'retry'
    },
    [ProviderErrorCode.PROVIDER_NOT_CONNECTED]: {
      message: 'No financial provider connected',
      userMessage: 'Connect QuickBooks to view your financial data.',
      action: 'reconnect'
    },
    [ProviderErrorCode.PROVIDER_TOKEN_EXPIRED]: {
      message: 'Provider access token expired and refresh failed',
      userMessage: 'QuickBooks connection expired. Please reconnect.',
      action: 'reconnect'
    },
    [ProviderErrorCode.PROVIDER_REFRESH_FAILED]: {
      message: 'Failed to refresh provider tokens',
      userMessage: 'Unable to refresh connection. Please reconnect QuickBooks.',
      action: 'reconnect'
    },
    [ProviderErrorCode.PROVIDER_INVALID_GRANT]: {
      message: 'Provider grant is no longer valid',
      userMessage: 'QuickBooks authorization revoked. Please reconnect.',
      action: 'reconnect'
    },
    [ProviderErrorCode.PROVIDER_DISCONNECTED]: {
      message: 'Provider has been disconnected',
      userMessage: 'QuickBooks has been disconnected. Reconnect to continue.',
      action: 'reconnect'
    },
    [ProviderErrorCode.API_RATE_LIMIT]: {
      message: 'API rate limit exceeded',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      action: 'retry'
    },
    [ProviderErrorCode.API_TIMEOUT]: {
      message: 'API request timed out',
      userMessage: 'Request took too long. Please try again.',
      action: 'retry'
    },
    [ProviderErrorCode.API_SERVER_ERROR]: {
      message: 'Internal server error',
      userMessage: 'Something went wrong. Please try again or contact support.',
      action: 'contact_support'
    }
  };
  
  const errorInfo = errorMap[code];
  
  return {
    code,
    message: errorInfo.message,
    userMessage: errorInfo.userMessage,
    action: errorInfo.action,
    details
  };
}

export function isAuthenticationError(code: ProviderErrorCode): boolean {
  return [
    ProviderErrorCode.USER_AUTH_EXPIRED,
    ProviderErrorCode.USER_AUTH_INVALID,
    ProviderErrorCode.PROVIDER_TOKEN_EXPIRED,
    ProviderErrorCode.PROVIDER_INVALID_GRANT,
    ProviderErrorCode.PROVIDER_REFRESH_FAILED
  ].includes(code);
}

export function requiresReconnect(code: ProviderErrorCode): boolean {
  return [
    ProviderErrorCode.PROVIDER_NOT_CONNECTED,
    ProviderErrorCode.PROVIDER_TOKEN_EXPIRED,
    ProviderErrorCode.PROVIDER_REFRESH_FAILED,
    ProviderErrorCode.PROVIDER_INVALID_GRANT,
    ProviderErrorCode.PROVIDER_DISCONNECTED
  ].includes(code);
}

export function requiresLogin(code: ProviderErrorCode): boolean {
  return [
    ProviderErrorCode.USER_AUTH_EXPIRED,
    ProviderErrorCode.USER_AUTH_INVALID
  ].includes(code);
}