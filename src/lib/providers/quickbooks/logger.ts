// QuickBooks Comprehensive Logging Utility
// Provides detailed, color-coded console output for debugging auth flow and API calls

type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';

interface LogContext {
  organizationId?: string;
  realmId?: string;
  environment?: string;
  proxy?: boolean;
  [key: string]: any;
}

class QuickBooksLogger {
  private static instance: QuickBooksLogger;
  private startTime: number = Date.now();
  private requestCounter: number = 0;
  private errorCounter: number = 0;
  private tokenRefreshCounter: number = 0;

  // ANSI color codes for terminal output
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    
    // Text colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
  };

  private constructor() {}

  static getInstance(): QuickBooksLogger {
    if (!QuickBooksLogger.instance) {
      QuickBooksLogger.instance = new QuickBooksLogger();
    }
    return QuickBooksLogger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatDuration(startTime: number): string {
    const duration = Date.now() - startTime;
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  }

  private getPrefix(level: LogLevel): string {
    const timestamp = this.formatTimestamp();
    const uptime = this.formatDuration(this.startTime);
    
    switch (level) {
      case 'debug':
        return `${this.colors.dim}[DEBUG ${timestamp}]${this.colors.reset}`;
      case 'info':
        return `${this.colors.cyan}[INFO  ${timestamp}]${this.colors.reset}`;
      case 'success':
        return `${this.colors.green}[✓ OK  ${timestamp}]${this.colors.reset}`;
      case 'warning':
        return `${this.colors.yellow}[WARN  ${timestamp}]${this.colors.reset}`;
      case 'error':
        return `${this.colors.red}[ERROR ${timestamp}]${this.colors.reset}`;
    }
  }

  private formatContext(context?: LogContext): string {
    if (!context) return '';
    
    const parts: string[] = [];
    if (context.organizationId) {
      parts.push(`org:${context.organizationId.substring(0, 8)}...`);
    }
    if (context.realmId) {
      parts.push(`realm:${context.realmId}`);
    }
    if (context.environment) {
      parts.push(`env:${context.environment}`);
    }
    if (context.proxy !== undefined) {
      parts.push(`proxy:${context.proxy ? 'yes' : 'no'}`);
    }
    
    return parts.length > 0 ? `${this.colors.dim}[${parts.join(' ')}]${this.colors.reset} ` : '';
  }

  // Main logging methods
  debug(message: string, context?: LogContext, data?: any) {
    const prefix = this.getPrefix('debug');
    const contextStr = this.formatContext(context);
    // console.log(`${prefix} ${contextStr}${this.colors.dim}${message}${this.colors.reset}`);
    // if (data) {
    //   console.log(`${this.colors.dim}${JSON.stringify(data, null, 2)}${this.colors.reset}`);
    // }
  }

  info(message: string, context?: LogContext, data?: any) {
    const prefix = this.getPrefix('info');
    const contextStr = this.formatContext(context);
    // console.log(`${prefix} ${contextStr}${message}`);
    // if (data) {
    //   console.log(JSON.stringify(data, null, 2));
    // }
  }

  success(message: string, context?: LogContext, data?: any) {
    const prefix = this.getPrefix('success');
    const contextStr = this.formatContext(context);
    // console.log(`${prefix} ${contextStr}${this.colors.green}${message}${this.colors.reset}`);
    // if (data) {
    //   console.log(`${this.colors.green}${JSON.stringify(data, null, 2)}${this.colors.reset}`);
    // }
  }

  warning(message: string, context?: LogContext, data?: any) {
    const prefix = this.getPrefix('warning');
    const contextStr = this.formatContext(context);
    // console.log(`${prefix} ${contextStr}${this.colors.yellow}${message}${this.colors.reset}`);
    // if (data) {
    //   console.log(`${this.colors.yellow}${JSON.stringify(data, null, 2)}${this.colors.reset}`);
    // }
  }

  error(message: string, context?: LogContext, error?: any) {
    this.errorCounter++;
    const prefix = this.getPrefix('error');
    const contextStr = this.formatContext(context);
    // console.error(`${prefix} ${contextStr}${this.colors.red}${message}${this.colors.reset}`);

    // if (error) {
    //   if (error.stack) {
    //     console.error(`${this.colors.red}Stack trace:${this.colors.reset}`);
    //     console.error(`${this.colors.dim}${error.stack}${this.colors.reset}`);
    //   } else if (typeof error === 'object') {
    //     console.error(`${this.colors.red}Error details:${this.colors.reset}`);
    //     console.error(`${this.colors.red}${JSON.stringify(error, null, 2)}${this.colors.reset}`);
    //   } else {
    //     console.error(`${this.colors.red}${error}${this.colors.reset}`);
    //   }
    // }
  }

  // Specialized logging methods for QuickBooks operations
  logAuthFlow(step: string, details: any) {
    // console.log(`\n${this.colors.bgBlue}${this.colors.white} AUTH FLOW ${this.colors.reset} ${this.colors.cyan}${step}${this.colors.reset}`);
    // console.log(`${this.colors.dim}────────────────────────────────────────${this.colors.reset}`);

    // for (const [key, value] of Object.entries(details)) {
    //   if (key === 'accessToken' || key === 'refreshToken') {
    //     // Mask sensitive tokens
    //     const masked = value ? `${String(value).substring(0, 10)}...` : 'null';
    //     console.log(`  ${this.colors.cyan}${key}:${this.colors.reset} ${masked}`);
    //   } else {
    //     console.log(`  ${this.colors.cyan}${key}:${this.colors.reset} ${value}`);
    //   }
    // }
  }

  logApiRequest(method: string, url: string, options?: any) {
    this.requestCounter++;
    const requestId = `REQ-${this.requestCounter.toString().padStart(4, '0')}`;

    // console.log(`\n${this.colors.bgMagenta}${this.colors.white} API REQUEST ${requestId} ${this.colors.reset}`);
    // console.log(`${this.colors.magenta}${method} ${url}${this.colors.reset}`);

    // if (options?.headers) {
    //   console.log(`${this.colors.dim}Headers:${this.colors.reset}`);
    //   for (const [key, value] of Object.entries(options.headers)) {
    //     if (key.toLowerCase() === 'authorization') {
    //       console.log(`  ${key}: Bearer ***`);
    //     } else {
    //       console.log(`  ${key}: ${value}`);
    //     }
    //   }
    // }

    // if (options?.body) {
    //   console.log(`${this.colors.dim}Body:${this.colors.reset}`);
    //   try {
    //     const parsed = JSON.parse(options.body as string);
    //     console.log(JSON.stringify(parsed, null, 2));
    //   } catch {
    //     console.log(options.body);
    //   }
    // }

    return { requestId, startTime: Date.now() };
  }

  logApiResponse(requestId: string, startTime: number, status: number, data?: any, error?: any) {
    const duration = this.formatDuration(startTime);
    const statusColor = status >= 200 && status < 300 ? this.colors.green :
                       status >= 400 && status < 500 ? this.colors.yellow :
                       this.colors.red;

    // console.log(`\n${this.colors.bgMagenta}${this.colors.white} API RESPONSE ${requestId} ${this.colors.reset}`);
    // console.log(`${statusColor}Status: ${status} - Duration: ${duration}${this.colors.reset}`);

    // if (error) {
    //   this.error('Response error:', undefined, error);
    // } else if (data) {
    //   // Truncate large responses to reduce logging verbosity
    //   const dataStr = JSON.stringify(data);
    //   if (dataStr.length > 500) {
    //     console.log(`${this.colors.dim}Response data (truncated, ${dataStr.length} chars total):${this.colors.reset}`);
    //     console.log(dataStr.substring(0, 300) + '...[truncated]...' + dataStr.substring(dataStr.length - 100));
    //   } else {
    //     console.log(`${this.colors.dim}Response data:${this.colors.reset}`);
    //     console.log(JSON.stringify(data, null, 2));
    //   }
    // }
  }

  logTokenRefresh(oldToken: string | null, newToken: string | null, expiresIn?: number) {
    this.tokenRefreshCounter++;
    // console.log(`\n${this.colors.bgYellow}${this.colors.black} TOKEN REFRESH #${this.tokenRefreshCounter} ${this.colors.reset}`);
    // console.log(`${this.colors.yellow}Old token: ${oldToken ? oldToken.substring(0, 10) + '...' : 'null'}${this.colors.reset}`);
    // console.log(`${this.colors.green}New token: ${newToken ? newToken.substring(0, 10) + '...' : 'null'}${this.colors.reset}`);
    // if (expiresIn) {
    //   console.log(`${this.colors.cyan}Expires in: ${expiresIn} seconds (${(expiresIn / 60).toFixed(1)} minutes)${this.colors.reset}`);
    // }
  }

  logProxyDetails(proxyUrl: string, usingSandbox: boolean, headers: Record<string, string>) {
    // console.log(`\n${this.colors.bgCyan}${this.colors.black} PROXY CONFIGURATION ${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Proxy URL: ${proxyUrl}${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Environment: ${usingSandbox ? 'SANDBOX' : 'PRODUCTION'}${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Headers:${this.colors.reset}`);
    // for (const [key, value] of Object.entries(headers)) {
    //   console.log(`  ${key}: ${value}`);
    // }
  }

  logRateLimit(remaining: number, limit: number, resetTime?: Date) {
    const percentage = (remaining / limit * 100).toFixed(1);
    const color = remaining < 10 ? this.colors.red :
                  remaining < 50 ? this.colors.yellow :
                  this.colors.green;

    // console.log(`\n${this.colors.bgYellow}${this.colors.black} RATE LIMIT STATUS ${this.colors.reset}`);
    // console.log(`${color}Remaining: ${remaining}/${limit} (${percentage}%)${this.colors.reset}`);
    // if (resetTime) {
    //   console.log(`${this.colors.cyan}Resets at: ${resetTime.toLocaleTimeString()}${this.colors.reset}`);
    // }
  }

  printSummary() {
    // console.log(`\n${this.colors.bgGreen}${this.colors.black} SESSION SUMMARY ${this.colors.reset}`);
    // console.log(`${this.colors.dim}────────────────────────────────────────${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Uptime: ${this.formatDuration(this.startTime)}${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Total Requests: ${this.requestCounter}${this.colors.reset}`);
    // console.log(`${this.colors.cyan}Token Refreshes: ${this.tokenRefreshCounter}${this.colors.reset}`);
    // console.log(`${this.colors.red}Errors: ${this.errorCounter}${this.colors.reset}`);
  }

  // Utility method for creating section headers
  section(title: string) {
    // console.log(`\n${this.colors.bright}${this.colors.underscore}${title}${this.colors.reset}`);
    // console.log(`${this.colors.dim}${'─'.repeat(40)}${this.colors.reset}`);
  }

  // Clear the console
  clear() {
    // console.clear();
    // console.log(`${this.colors.cyan}QuickBooks Logger initialized${this.colors.reset}`);
    // console.log(`${this.colors.dim}Started at: ${this.formatTimestamp()}${this.colors.reset}\n`);
  }
}

// Export singleton instance
export const qbLogger = QuickBooksLogger.getInstance();

// Export type for use in other files
export type { LogContext };