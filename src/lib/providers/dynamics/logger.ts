// Business Central Logging Utility
// Provides detailed, color-coded console output for debugging auth flow and API calls

type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error'

interface LogContext {
  organizationId?: string
  connectionId?: string
  tenantId?: string
  environment?: string
  [key: string]: any
}

class BusinessCentralLogger {
  private static instance: BusinessCentralLogger
  private startTime: number = Date.now()
  private requestCounter: number = 0
  private errorCounter: number = 0
  private tokenRefreshCounter: number = 0

  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
  }

  private constructor() {}

  static getInstance(): BusinessCentralLogger {
    if (!BusinessCentralLogger.instance) {
      BusinessCentralLogger.instance = new BusinessCentralLogger()
    }
    return BusinessCentralLogger.instance
  }

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private formatDuration(startTime: number): string {
    const duration = Date.now() - startTime
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(2)}s`
  }

  private getPrefix(level: LogLevel): string {
    const timestamp = this.formatTimestamp()
    switch (level) {
      case 'debug':
        return `${this.colors.dim}[BC DEBUG ${timestamp}]${this.colors.reset}`
      case 'info':
        return `${this.colors.blue}[BC INFO  ${timestamp}]${this.colors.reset}`
      case 'success':
        return `${this.colors.green}[BC OK    ${timestamp}]${this.colors.reset}`
      case 'warning':
        return `${this.colors.yellow}[BC WARN  ${timestamp}]${this.colors.reset}`
      case 'error':
        return `${this.colors.red}[BC ERROR ${timestamp}]${this.colors.reset}`
    }
  }

  private formatContext(context?: LogContext): string {
    if (!context) return ''
    const parts: string[] = []
    if (context.organizationId) parts.push(`org:${context.organizationId.substring(0, 8)}...`)
    if (context.connectionId) parts.push(`conn:${context.connectionId}`)
    if (context.tenantId) parts.push(`tenant:${context.tenantId.substring(0, 8)}...`)
    if (context.environment) parts.push(`env:${context.environment}`)
    return parts.length > 0 ? `${this.colors.dim}[${parts.join(' ')}]${this.colors.reset} ` : ''
  }

  debug(message: string, context?: LogContext, data?: any) {
    // Uncomment for verbose debugging:
    // const prefix = this.getPrefix('debug')
    // const contextStr = this.formatContext(context)
    // console.log(`${prefix} ${contextStr}${this.colors.dim}${message}${this.colors.reset}`)
    // if (data) console.log(`${this.colors.dim}${JSON.stringify(data, null, 2)}${this.colors.reset}`)
  }

  info(message: string, context?: LogContext, data?: any) {
    // const prefix = this.getPrefix('info')
    // const contextStr = this.formatContext(context)
    // console.log(`${prefix} ${contextStr}${message}`)
    // if (data) console.log(JSON.stringify(data, null, 2))
  }

  success(message: string, context?: LogContext, data?: any) {
    // const prefix = this.getPrefix('success')
    // const contextStr = this.formatContext(context)
    // console.log(`${prefix} ${contextStr}${this.colors.green}${message}${this.colors.reset}`)
  }

  warning(message: string, context?: LogContext, data?: any) {
    // const prefix = this.getPrefix('warning')
    // const contextStr = this.formatContext(context)
    // console.log(`${prefix} ${contextStr}${this.colors.yellow}${message}${this.colors.reset}`)
  }

  error(message: string, context?: LogContext, error?: any) {
    this.errorCounter++
    // const prefix = this.getPrefix('error')
    // const contextStr = this.formatContext(context)
    // console.error(`${prefix} ${contextStr}${this.colors.red}${message}${this.colors.reset}`)
    // if (error?.stack) console.error(`${this.colors.dim}${error.stack}${this.colors.reset}`)
  }

  logAuthFlow(step: string, details: Record<string, any>) {
    // console.log(`\n${this.colors.bgBlue}${this.colors.white} BC AUTH ${this.colors.reset} ${this.colors.cyan}${step}${this.colors.reset}`)
    // for (const [key, value] of Object.entries(details)) {
    //   if (key === 'accessToken' || key === 'refreshToken' || key === 'clientSecret') {
    //     const masked = value ? `${String(value).substring(0, 10)}...` : 'null'
    //     console.log(`  ${this.colors.cyan}${key}:${this.colors.reset} ${masked}`)
    //   } else {
    //     console.log(`  ${this.colors.cyan}${key}:${this.colors.reset} ${value}`)
    //   }
    // }
  }

  logApiRequest(method: string, url: string, options?: any) {
    this.requestCounter++
    const requestId = `BC-${this.requestCounter.toString().padStart(4, '0')}`
    // console.log(`\n${this.colors.bgMagenta}${this.colors.white} BC API ${requestId} ${this.colors.reset}`)
    // console.log(`${this.colors.magenta}${method} ${url}${this.colors.reset}`)
    return { requestId, startTime: Date.now() }
  }

  logApiResponse(requestId: string, startTime: number, status: number, data?: any, error?: any) {
    const duration = this.formatDuration(startTime)
    // const statusColor = status >= 200 && status < 300 ? this.colors.green :
    //                    status >= 400 && status < 500 ? this.colors.yellow : this.colors.red
    // console.log(`\n${this.colors.bgMagenta}${this.colors.white} BC RESPONSE ${requestId} ${this.colors.reset}`)
    // console.log(`${statusColor}Status: ${status} - Duration: ${duration}${this.colors.reset}`)
  }

  logTokenRefresh(oldToken: string | null, newToken: string | null, expiresIn?: number) {
    this.tokenRefreshCounter++
    // console.log(`\n${this.colors.bgYellow} BC TOKEN REFRESH #${this.tokenRefreshCounter} ${this.colors.reset}`)
  }
}

export const bcLogger = BusinessCentralLogger.getInstance()
export type { LogContext }
