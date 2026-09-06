/**
 * Centralized Logger Utility
 *
 * A minimal, efficient logging solution following DRY and KISS principles.
 * Features:
 * - Structured JSON logging in production
 * - Human-readable format in development
 * - Automatic context injection (correlationId, userId, orgId)
 * - Workflow tracking
 * - Performance monitoring
 */

// Simple context storage that works everywhere
class SimpleContextStorage<T> {
  private context: T | undefined

  getStore(): T | undefined {
    return this.context
  }

  run<R>(context: T, fn: () => R): R {
    const previous = this.context
    this.context = context
    try {
      return fn()
    } finally {
      this.context = previous
    }
  }
}

// Request context storage for automatic context injection
export const requestContext = new SimpleContextStorage<RequestContext>()

export interface RequestContext {
  correlationId: string
  userId?: string
  organizationId?: string
  provider?: string
  startTime: number
  path?: string
  method?: string
}

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export interface LogMetadata {
  [key: string]: any
}

class Logger {
  private readonly prettyFormat = true
  private readonly serviceName = 'midas'

  // Log level configuration based on environment
  private readonly logLevel: LogLevel = this.getLogLevel()

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase()

    // Map environment variable to LogLevel enum
    switch (envLevel) {
      case 'ERROR':
        return LogLevel.ERROR
      case 'WARN':
        return LogLevel.WARN
      case 'INFO':
        return LogLevel.INFO
      case 'DEBUG':
        return LogLevel.DEBUG
      default:
        // Default to INFO in all environments for consistent logging
        // Use LOG_LEVEL=WARN or LOG_LEVEL=ERROR to reduce verbosity in production
        return LogLevel.INFO
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG]
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex <= currentLevelIndex
  }

  private getContext(): RequestContext | undefined {
    return requestContext.getStore()
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    metadata: LogMetadata = {}
  ): string | object {
    const context = this.getContext()
    const timestamp = new Date().toISOString()

    // Build complete log object
    const logData = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...metadata,
      // Add context if available
      ...(context && {
        correlationId: context.correlationId,
        userId: context.userId,
        organizationId: context.organizationId,
        provider: context.provider,
        path: context.path,
        method: context.method,
        // Calculate request duration if logging after request start
        duration: context.startTime ? Date.now() - context.startTime : undefined,
      }),
    }

    // Remove undefined values
    Object.keys(logData).forEach((key) => {
      const typedKey = key as keyof typeof logData
      if (logData[typedKey] === undefined) {
        delete logData[typedKey]
      }
    })

    // Format based on environment
    if (this.prettyFormat) {
      return this.formatForDevelopment(logData)
    }

    return logData // Return as object for JSON.stringify in production
  }

  private formatForDevelopment(logData: any): string {
    const { timestamp, level, message, workflow, error, ...metadata } = logData
    const time = new Date(timestamp).toLocaleTimeString()
    const levelColor = this.getLevelColor(level)

    // Add divider for important events
    let output = ''
    if (
      level === 'INFO' &&
      (message.includes('initialized') ||
        message.includes('started') ||
        message.includes('completed'))
    ) {
      output = '\n'
    }

    output += `[${time}] ${levelColor}[${level}]${this.reset()} `

    if (workflow) {
      output += `[${workflow}] `
    }

    output += message

    // Add important metadata on the same line
    const importantKeys = ['userId', 'organizationId', 'provider', 'correlationId']
    const important = importantKeys
      .filter((key) => metadata[key])
      .map((key) => `${key}: ${metadata[key]}`)
      .join(', ')

    if (important) {
      output += `\n  → ${important}`
    }

    // Add other metadata if present
    const otherKeys = Object.keys(metadata).filter(
      (key) => !importantKeys.includes(key) && key !== 'duration'
    )

    if (otherKeys.length > 0) {
      const other = otherKeys.map((key) => `${key}: ${JSON.stringify(metadata[key])}`).join(', ')
      output += `\n  → ${other}`
    }

    // Add duration if present
    if (metadata.duration !== undefined) {
      output += `\n  → duration: ${metadata.duration}ms`
    }

    // Add error stack if present
    if (error) {
      output += `\n  → error: ${error.message || error}`
      if (error.stack) {
        output += `\n${error.stack}`
      }
    }

    return output
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '\x1b[31m' // Red
      case LogLevel.WARN:
        return '\x1b[33m' // Yellow
      case LogLevel.INFO:
        return '\x1b[36m' // Cyan
      case LogLevel.DEBUG:
        return '\x1b[90m' // Gray
      default:
        return ''
    }
  }

  private reset(): string {
    return '\x1b[0m'
  }

  // Enhanced color codes for chat interactions
  private readonly colors = {
    // Basic styles
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Bright foreground colors
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
    bgGray: '\x1b[100m',
    bgBrightGreen: '\x1b[102m',
    bgBrightBlue: '\x1b[104m',
    bgBrightMagenta: '\x1b[105m',
  }

  // Icons and symbols for beautiful logging
  private readonly icons = {
    user: '👤',
    robot: '🤖',
    tool: '🔧',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    clock: '⏱️',
    sparkle: '✨',
    lightning: '⚡',
    gear: '⚙️',
    chart: '📊',
    rocket: '🚀',
    check: '✓',
    cross: '✗',
    arrow: '→',
    arrowRight: '▶',
    bullet: '•',
    dot: '·',
    star: '★',
    diamond: '◆',
  }

  // Box drawing characters for formatting
  private readonly box = {
    // Rounded corners
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    // Lines
    horizontal: '─',
    vertical: '│',
    // Double lines
    doubleHorizontal: '═',
    doubleVertical: '║',
    // T-junctions
    teeRight: '├',
    teeLeft: '┤',
    // Arrows
    arrow: '→',
    arrowDown: '↓',
    bullet: '•',
  }

  // Helper to create a visual progress bar
  private createProgressBar(current: number, max: number, width: number = 20): string {
    const c = this.colors
    const filled = Math.round((current / max) * width)
    const empty = width - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    const percentage = Math.round((current / max) * 100)
    return `${c.cyan}${bar}${c.reset} ${c.dim}${percentage}%${c.reset}`
  }

  // Helper to format duration with color coding
  private formatDuration(ms: number): string {
    const c = this.colors
    if (ms < 500) return `${c.brightGreen}${ms}ms${c.reset}`
    if (ms < 2000) return `${c.brightYellow}${ms}ms${c.reset}`
    if (ms < 5000) return `${c.yellow}${(ms / 1000).toFixed(1)}s${c.reset}`
    return `${c.red}${(ms / 1000).toFixed(1)}s${c.reset}`
  }

  // Helper to create a header box
  private createHeader(title: string, icon: string, color: string, width: number = 60): string[] {
    const c = this.colors
    const b = this.box
    const r = c.reset
    const line = b.horizontal.repeat(width)
    const time = new Date().toLocaleTimeString()
    const paddedTitle = `${icon}  ${title}`.padEnd(width - 15)

    return [
      '',
      `${color}${b.topLeft}${line}${b.topRight}${r}`,
      `${color}${b.vertical}${r} ${c.bold}${paddedTitle}${r}${c.dim}${time}${r} ${color}${b.vertical}${r}`,
      `${color}${b.bottomLeft}${line}${b.bottomRight}${r}`,
    ]
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata) {
    if (!this.shouldLog(level)) return

    const formatted = this.formatMessage(level, message, metadata)

    // Use appropriate console method based on level
    switch (level) {
      case LogLevel.ERROR:
        if (typeof formatted === 'string') {
          console.error(formatted)
        } else {
          console.error(JSON.stringify(formatted))
        }
        break
      case LogLevel.WARN:
        if (typeof formatted === 'string') {
          console.warn(formatted)
        } else {
          console.warn(JSON.stringify(formatted))
        }
        break
      default:
        if (typeof formatted === 'string') {
          console.log(formatted)
        } else {
          console.log(JSON.stringify(formatted))
        }
    }
  }

  // Main logging methods
  error(message: string, metadata?: LogMetadata) {
    // Extract error object if present
    if (metadata?.error && metadata.error instanceof Error) {
      metadata.error = {
        message: metadata.error.message,
        stack: metadata.error.stack,
        name: metadata.error.name,
      }
    }
    this.log(LogLevel.ERROR, message, metadata)
  }

  warn(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.WARN, message, metadata)
  }

  info(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.INFO, message, metadata)
  }

  debug(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  // Workflow-specific logging
  workflow(workflowName: string, event: string, metadata?: LogMetadata) {
    this.info(`${workflowName}: ${event}`, {
      workflow: workflowName,
      event,
      ...metadata,
    })
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: LogMetadata) {
    const level = duration > 2000 ? LogLevel.WARN : LogLevel.INFO
    const message =
      duration > 2000 ? `Slow operation: ${operation}` : `Operation completed: ${operation}`

    this.log(level, message, {
      operation,
      duration,
      slow: duration > 2000,
      ...metadata,
    })
  }

  // Request logging
  request(status: number, duration: number, metadata?: LogMetadata) {
    const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO

    this.log(level, `Request completed`, {
      status,
      duration,
      ...metadata,
    })
  }

  // API call logging (for external services)
  apiCall(service: string, method: string, path: string, metadata?: LogMetadata) {
    this.debug(`External API call: ${service}`, {
      service,
      method,
      path,
      ...metadata,
    })
  }

  // Rate limiting logging
  rateLimit(userId: string, limit: number, remaining: number, metadata?: LogMetadata) {
    const level = remaining === 0 ? LogLevel.WARN : LogLevel.DEBUG
    this.log(level, `Rate limit check`, {
      userId,
      limit,
      remaining,
      exceeded: remaining === 0,
      ...metadata,
    })
  }

  // Token usage logging (for LLM calls)
  tokenUsage(provider: string, tokens: number, metadata?: LogMetadata) {
    this.info(`LLM token usage`, {
      provider,
      tokens,
      ...metadata,
    })
  }

  // LLM interaction logging
  logLLMInteraction(data: {
    type: 'start' | 'complete' | 'error'
    correlationId: string
    userId?: string
    conversationId?: string
    messageId?: string
    model?: string
    tokens?: { input: number; output: number; total: number }
    userMessage?: string
    assistantMessage?: string
    duration?: number
    timeToFirstToken?: number
    toolsUsed?: string[]
    error?: string
  }) {
    const level = data.type === 'error' ? LogLevel.ERROR : LogLevel.INFO
    const prefix = `[LLM:${data.type.charAt(0).toUpperCase() + data.type.slice(1)}]`

    const logData: Record<string, any> = {
      correlationId: data.correlationId,
      ...(data.userId && { userId: data.userId }),
      ...(data.conversationId && { conversationId: data.conversationId }),
      ...(data.messageId && { messageId: data.messageId }),
      ...(data.model && { model: data.model }),
    }

    if (data.tokens) {
      logData.tokens = data.tokens
    }

    if (data.userMessage) {
      logData.userMessagePreview = truncateMessage(data.userMessage)
    }

    if (data.assistantMessage) {
      logData.assistantMessagePreview = truncateMessage(data.assistantMessage)
    }

    if (data.duration !== undefined) {
      logData.durationMs = data.duration
    }

    if (data.timeToFirstToken !== undefined) {
      logData.ttftMs = data.timeToFirstToken
    }

    if (data.toolsUsed?.length) {
      logData.toolsUsed = data.toolsUsed
    }

    if (data.error) {
      logData.error = data.error
    }

    this.log(
      level,
      `${prefix} ${data.type === 'start' ? 'Request started' : data.type === 'complete' ? 'Request completed' : 'Request failed'}`,
      logData
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENHANCED CHAT LOGGING - Beautiful, colorful, and informative
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log a user question/message with beautiful green styling
   */
  question(message: string, metadata?: LogMetadata) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const preview = truncateMessage(message, 200)
    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset

    if (this.prettyFormat) {
      const headerLines = this.createHeader('USER MESSAGE', i.user, c.brightGreen)
      headerLines.forEach((line) => console.log(line))

      // Message content with nice formatting
      console.log(
        `${c.green}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.brightWhite}${preview}${r}`
      )

      // Metadata in a subtle way
      if (metadata) {
        const entries = Object.entries(metadata)
        if (entries.length > 0) {
          console.log(`${c.green}${b.vertical}${r}`)
          entries.forEach(([k, v], idx) => {
            const isLast = idx === entries.length - 1
            const prefix = isLast ? b.bottomLeft : b.teeRight
            const value = typeof v === 'object' ? JSON.stringify(v) : v
            console.log(`${c.dim}${prefix}${b.horizontal} ${k}: ${value}${r}`)
          })
        }
      }
      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'question',
          message: preview,
          ...metadata,
        })
      )
    }
  }

  /**
   * Log an AI response with beautiful blue styling
   */
  response(
    message: string,
    metadata?: LogMetadata & {
      tokens?: { input: number; output: number; total: number }
      duration?: number
      model?: string
      entities?: Record<string, string>
      ttft?: number
    }
  ) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const preview = truncateMessage(message, 200)
    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset

    if (this.prettyFormat) {
      const headerLines = this.createHeader('AI RESPONSE', i.robot, c.brightBlue)
      headerLines.forEach((line) => console.log(line))

      // Response content
      console.log(
        `${c.blue}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.brightWhite}${preview}${r}`
      )
      console.log(`${c.blue}${b.vertical}${r}`)

      // Entities section - show which providers/companies the AI used
      if (metadata?.entities && Object.keys(metadata.entities).length > 0) {
        console.log(`${c.blue}${b.teeRight}${b.horizontal}${r} ${c.bold}Entities${r}`)
        const providerLabels: Record<string, string> = {
          quickbooks: 'QuickBooks',
          dynamics: 'Dynamics',
        }
        Object.entries(metadata.entities).forEach(([provider, entityName]) => {
          const label = providerLabels[provider] || provider
          console.log(
            `${c.blue}${b.vertical}${r}   🔌 ${c.brightWhite}${label}${r} ${c.dim}→${r} ${c.brightGreen}${entityName}${r}`
          )
        })
        console.log(`${c.blue}${b.vertical}${r}`)
      }

      // Stats section with visual elements
      if (metadata?.tokens || metadata?.duration || metadata?.model) {
        console.log(`${c.blue}${b.teeRight}${b.horizontal}${r} ${c.bold}Stats${r}`)

        if (metadata.model) {
          console.log(
            `${c.blue}${b.vertical}${r}   ${i.gear} Model: ${c.cyan}${metadata.model}${r}`
          )
        }

        if (metadata.tokens) {
          const { input, output, total } = metadata.tokens
          console.log(
            `${c.blue}${b.vertical}${r}   ${i.chart} Tokens: ${c.green}↓${input}${r} ${c.yellow}↑${output}${r} ${c.dim}(${total} total)${r}`
          )
        }

        if (metadata.duration) {
          console.log(
            `${c.blue}${b.vertical}${r}   ${i.clock} Duration: ${this.formatDuration(metadata.duration)}`
          )
        }

        if (metadata.ttft !== undefined) {
          console.log(
            `${c.blue}${b.vertical}${r}   ${i.lightning} TTFT: ${this.formatDuration(metadata.ttft)}`
          )
        }
      }

      // Other metadata (exclude entities and ttft since they're rendered above)
      if (metadata) {
        const { tokens, duration, model, entities, ttft, ...rest } = metadata
        const entries = Object.entries(rest)
        if (entries.length > 0) {
          entries.forEach(([k, v], idx) => {
            const isLast = idx === entries.length - 1
            const prefix = isLast ? b.bottomLeft : b.teeRight
            const value = typeof v === 'object' ? JSON.stringify(v) : v
            console.log(`${c.dim}${prefix}${b.horizontal} ${k}: ${value}${r}`)
          })
        }
      }
      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'response',
          message: preview,
          ...metadata,
        })
      )
    }
  }

  /**
   * Log a tool call start with beautiful magenta/purple styling
   */
  toolStart(toolName: string, input?: unknown, metadata?: LogMetadata) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset
    const time = new Date().toLocaleTimeString()

    if (this.prettyFormat) {
      // Compact but beautiful tool header (input shown separately via toolInput)
      const line = b.horizontal.repeat(50)
      console.log('')
      console.log(`${c.brightMagenta}${b.topLeft}${line}${b.topRight}${r}`)
      console.log(
        `${c.brightMagenta}${b.vertical}${r} ${i.tool} ${c.bold}TOOL${r} ${c.brightYellow}${c.bold}${toolName}${r}`
      )
      console.log(`${c.brightMagenta}${b.vertical}${r} ${c.dim}${i.lightning} Executing...${r}`)
      console.log(`${c.brightMagenta}${b.bottomLeft}${line}${b.bottomRight}${r}`)
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'tool_start',
          tool: toolName,
          input: input ? JSON.stringify(input).slice(0, 200) : undefined,
          ...metadata,
        })
      )
    }
  }

  /**
   * Log a tool call completion with beautiful styling
   */
  toolEnd(
    toolName: string,
    output?: unknown,
    metadata?: LogMetadata & {
      duration?: number
      success?: boolean
      hasData?: boolean
      hasVisualization?: boolean
      provider?: string
    }
  ) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset
    const success = metadata?.success !== false

    if (this.prettyFormat) {
      const statusIcon = success ? i.success : i.error
      const statusColor = success ? c.brightGreen : c.brightRed
      const statusText = success ? 'Completed' : 'Failed'

      // Result line with duration inline (output shown separately via toolOutput)
      const durationStr = metadata?.duration ? `  ${this.formatDuration(metadata.duration)}` : ''
      console.log(`${c.magenta}${b.vertical}${r}`)
      console.log(
        `${c.magenta}${b.teeRight}${b.horizontal}${r} ${statusIcon} ${statusColor}${statusText}${r}: ${c.brightYellow}${toolName}${r}${durationStr}`
      )

      // Data indicators line: Data, Viz, Provider
      const indicators: string[] = []
      if (metadata?.hasData !== undefined) {
        const dataIcon = metadata.hasData ? `${c.brightGreen}yes${r}` : `${c.dim}no${r}`
        indicators.push(`Data: ${dataIcon}`)
      }
      if (metadata?.hasVisualization !== undefined) {
        const vizIcon = metadata.hasVisualization ? `${c.brightGreen}yes${r}` : `${c.dim}no${r}`
        indicators.push(`Viz: ${vizIcon}`)
      }
      if (metadata?.provider) {
        const providerLabels: Record<string, string> = {
          quickbooks: 'QuickBooks',
          dynamics: 'Dynamics',
        }
        const providerLabel = providerLabels[metadata.provider] || metadata.provider
        indicators.push(`Provider: ${c.brightCyan}${providerLabel}${r}`)
      }

      if (indicators.length > 0) {
        console.log(
          `${c.magenta}${b.bottomLeft}${b.horizontal}${r} ${i.chart} ${indicators.join(`  ${c.dim}•${r}  `)}`
        )
      } else {
        console.log(`${c.magenta}${b.bottomLeft}${b.horizontal}${b.horizontal}${b.horizontal}${r}`)
      }
      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'tool_end',
          tool: toolName,
          success,
          output: output ? JSON.stringify(output).slice(0, 200) : undefined,
          ...metadata,
        })
      )
    }
  }

  /**
   * Log a tool error with red styling
   */
  toolError(toolName: string, error: Error | string, metadata?: LogMetadata) {
    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset
    const errorMsg = error instanceof Error ? error.message : error

    if (this.prettyFormat) {
      console.log(`${c.magenta}${b.vertical}${r}`)
      console.log(
        `${c.red}${b.teeRight}${b.horizontal}${r} ${i.error} ${c.bold}${c.red}ERROR${r}: ${c.brightYellow}${toolName}${r}`
      )
      console.log(`${c.red}${b.vertical}${r}   ${c.red}${errorMsg}${r}`)

      if (error instanceof Error && error.stack) {
        const stackLines = error.stack.split('\n').slice(1, 4)
        stackLines.forEach((line, idx) => {
          const prefix = idx === stackLines.length - 1 ? b.bottomLeft : b.vertical
          console.log(`${c.dim}${prefix}   ${line.trim()}${r}`)
        })
      } else {
        console.log(`${c.red}${b.bottomLeft}${b.horizontal}${b.horizontal}${b.horizontal}${r}`)
      }
      console.log('')
    } else {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          type: 'tool_error',
          tool: toolName,
          error: errorMsg,
          ...metadata,
        })
      )
    }
  }

  /**
   * Prominent red error box — impossible to miss in terminal
   */
  errorBox(
    source: string,
    error: Error | string,
    metadata?: LogMetadata & { queryType?: string; provider?: string; duration?: number }
  ) {
    const c = this.colors
    const b = this.box
    const r = c.reset
    const errorMsg = error instanceof Error ? error.message : error
    const errorName = error instanceof Error ? error.name : 'Error'

    if (this.prettyFormat) {
      const headerLines = this.createHeader('ERROR', '❌', c.brightRed)
      headerLines.forEach((line) => console.log(line))

      // Source and error type
      console.log(
        `${c.red}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.bold}Source:${r} ${c.brightYellow}${source}${r}  ${c.dim}•${r}  ${c.bold}Type:${r} ${c.brightRed}${errorName}${r}`
      )

      // Error message
      console.log(`${c.red}${b.vertical}${r}`)
      console.log(
        `${c.red}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.brightWhite}${c.bold}${errorMsg}${r}`
      )

      // Metadata (queryType, provider, duration)
      if (metadata) {
        const metaItems: string[] = []
        if (metadata.queryType) metaItems.push(`Query: ${metadata.queryType}`)
        if (metadata.provider) metaItems.push(`Provider: ${metadata.provider}`)
        if (metadata.duration) metaItems.push(`After: ${this.formatDuration(metadata.duration)}`)
        if (metaItems.length > 0) {
          console.log(`${c.red}${b.vertical}${r}   ${c.dim}${metaItems.join('  •  ')}${r}`)
        }
      }

      // Stack trace (top 5 frames, clean paths)
      if (error instanceof Error && error.stack) {
        console.log(`${c.red}${b.vertical}${r}`)
        console.log(`${c.red}${b.teeRight}${b.horizontal}${r} ${c.dim}Stack Trace:${r}`)
        const stackLines = error.stack.split('\n').slice(1, 6)
        stackLines.forEach((line, idx) => {
          const isLast = idx === stackLines.length - 1
          const prefix = isLast ? b.bottomLeft : b.vertical
          // Highlight file paths in the stack
          const cleanLine = line.trim().replace(/at\s+/, '')
          console.log(`${c.red}${prefix}${r}   ${c.dim}${cleanLine}${r}`)
        })
      } else {
        console.log(`${c.red}${b.bottomLeft}${b.horizontal}${b.horizontal}${b.horizontal}${r}`)
      }

      console.log('')
    } else {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          type: 'error_box',
          source,
          error: errorMsg,
          ...metadata,
        })
      )
    }
  }

  /**
   * Log query routing decision with yellow/amber styled box
   */
  routing(data: {
    intent: string
    confidence: string
    tier: string
    reports: string[]
    periods?: string[]
  }) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      const headerLines = this.createHeader('ROUTING', '🧭', c.brightYellow)
      headerLines.forEach((line) => console.log(line))

      // Main routing info on one line
      console.log(
        `${c.yellow}${b.teeRight}${b.horizontal}${b.horizontal}${r} Intent: ${c.brightWhite}${data.intent}${r}  ${c.dim}•${r}  Confidence: ${c.brightWhite}${data.confidence}${r}  ${c.dim}•${r}  Tier: ${c.brightWhite}${data.tier}${r}`
      )

      // Reports
      const reportStr = data.reports.length > 0 ? data.reports.join(', ') : '(none)'
      console.log(
        `${c.yellow}${b.bottomLeft}${b.horizontal}${b.horizontal}${r} Reports: ${c.dim}${reportStr}${r}`
      )

      // Periods if present
      if (data.periods && data.periods.length > 0) {
        console.log(
          `${c.dim}${b.bottomLeft}${b.horizontal}${r} Periods: ${data.periods.join(', ')}${r}`
        )
      }

      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'routing',
          ...data,
        })
      )
    }
  }

  /**
   * Log AI agent's planning decision — what tools it decided to call
   */
  planning(data: {
    step: number
    toolCalls: Array<{ name: string; args: Record<string, unknown> }>
    hasTextContent?: boolean
    textPreview?: string
  }) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      const headerLines = this.createHeader(
        `AGENT PLAN  •  Step ${data.step}`,
        '🧠',
        c.brightMagenta
      )
      headerLines.forEach((line) => console.log(line))

      // If the AI also generated text alongside tool calls
      if (data.hasTextContent && data.textPreview) {
        console.log(
          `${c.magenta}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.dim}Reasoning:${r} ${c.brightWhite}${data.textPreview}${r}`
        )
        console.log(`${c.magenta}${b.vertical}${r}`)
      }

      // Show each tool call decision with readable args
      if (data.toolCalls.length === 0) {
        console.log(
          `${c.magenta}${b.bottomLeft}${b.horizontal}${b.horizontal}${r} ${c.dim}No tool calls — generating final response${r}`
        )
      } else {
        console.log(
          `${c.magenta}${b.teeRight}${b.horizontal}${b.horizontal}${r} ${c.bold}Calling ${data.toolCalls.length} tool${data.toolCalls.length > 1 ? 's' : ''}:${r}`
        )

        data.toolCalls.forEach((call, idx) => {
          const isLast = idx === data.toolCalls.length - 1
          const prefix = isLast ? b.bottomLeft : b.teeRight

          // Tool name
          console.log(`${c.magenta}${prefix}${b.horizontal}${r} ${c.brightYellow}${call.name}${r}`)

          // Args as readable JSON (one field per line, indented)
          const argEntries = Object.entries(call.args)
          if (argEntries.length > 0) {
            const indent = isLast ? '   ' : `${b.vertical}  `
            argEntries.forEach(([key, value]) => {
              const valueStr =
                typeof value === 'string'
                  ? value.length > 80
                    ? `"${value.slice(0, 80)}..."`
                    : `"${value}"`
                  : JSON.stringify(value)
              console.log(
                `${c.magenta}${indent}${r}   ${c.dim}${key}:${r} ${c.cyan}${valueStr}${r}`
              )
            })
          }
        })
      }

      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'agent_plan',
          ...data,
        })
      )
    }
  }

  /**
   * Log a step in the sequential flow
   */
  step(stepNumber: number, label: string, metadata?: LogMetadata) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      const badge = `${c.bgBrightBlue}${c.black} Step ${stepNumber} ${r}`
      console.log(`${badge} ${c.brightWhite}${label}${r}`)

      if (metadata) {
        const entries = Object.entries(metadata)
        entries.forEach(([k, v]) => {
          const value = typeof v === 'object' ? JSON.stringify(v) : v
          console.log(`${c.dim}   ${b.arrow} ${k}: ${value}${r}`)
        })
      }
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'step',
          step: stepNumber,
          label,
          ...metadata,
        })
      )
    }
  }

  /**
   * Deep-parse an object: if any value is a stringified JSON, parse it recursively
   */
  private deepParseJson(obj: unknown): unknown {
    if (typeof obj === 'string') {
      const trimmed = obj.trim()
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          return this.deepParseJson(JSON.parse(trimmed))
        } catch {
          return obj
        }
      }
      return obj
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepParseJson(item))
    }
    if (obj && typeof obj === 'object') {
      const parsed: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        parsed[key] = this.deepParseJson(value)
      }
      return parsed
    }
    return obj
  }

  /**
   * Log tool input as full pretty-printed JSON in GREEN
   * Auto-parses stringified JSON values so they display as real JSON
   */
  toolInput(toolName: string, input: Record<string, unknown>) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      // Deep-parse to un-stringify nested JSON
      const parsed = this.deepParseJson(input)

      // Header label in bright green background
      console.log(`${c.magenta}${b.vertical}${r}`)
      console.log(
        `${c.magenta}${b.teeRight}${b.horizontal}${r} ${c.bgBrightGreen}${c.black} INPUT ${r}`
      )

      // Full pretty-printed JSON in green
      const jsonStr = JSON.stringify(parsed, null, 2)
      const jsonLines = jsonStr.split('\n')
      jsonLines.forEach((line, idx) => {
        const isLast = idx === jsonLines.length - 1
        const prefix = isLast ? b.bottomLeft : b.vertical
        console.log(`${c.magenta}${prefix}${r}   ${c.brightGreen}${line}${r}`)
      })
    }
  }

  /**
   * Log tool output as full pretty-printed JSON in YELLOW
   * Auto-parses stringified JSON values so they display as real JSON
   */
  toolOutput(toolName: string, output: Record<string, unknown>) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      const success = output.success
      const statusIcon = success ? '✅' : '❌'
      const statusLabel = success ? 'SUCCESS' : 'FAILED'
      const bgColor = success ? c.bgBrightBlue : c.bgRed

      // Deep-parse to un-stringify nested JSON
      const parsed = this.deepParseJson(output)

      // Header label in bright blue/red background
      console.log(`${c.magenta}${b.vertical}${r}`)
      console.log(
        `${c.magenta}${b.teeRight}${b.horizontal}${r} ${bgColor}${c.black} OUTPUT ${r} ${statusIcon} ${statusLabel}`
      )

      // Full pretty-printed JSON in bright yellow
      const jsonStr = JSON.stringify(parsed, null, 2)
      const jsonLines = jsonStr.split('\n')
      jsonLines.forEach((line, idx) => {
        const isLast = idx === jsonLines.length - 1
        const prefix = isLast ? b.bottomLeft : b.vertical
        console.log(`${c.magenta}${prefix}${r}   ${c.brightYellow}${line}${r}`)
      })
    }
  }

  /**
   * Log connected providers and entities with cyan styled box
   */
  providers(data: {
    connected: string[]
    entities: Record<string, string>
    activeRealmId?: string
    bcSchemas?: string[]
    bcDefaultSchema?: string
  }) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const r = c.reset

    if (this.prettyFormat) {
      const headerLines = this.createHeader('PROVIDERS & ENTITIES', '🔌', c.brightCyan)
      headerLines.forEach((line) => console.log(line))

      if (data.connected.length === 0) {
        console.log(
          `${c.cyan}${b.bottomLeft}${b.horizontal}${b.horizontal}${r} ${c.dim}No providers connected${r}`
        )
        console.log('')
        return
      }

      // Show each provider with its entity name
      const providerLabels: Record<string, string> = {
        quickbooks: 'QuickBooks',
        dynamics: 'Dynamics ',
      }

      data.connected.forEach((provider, idx) => {
        const label = providerLabels[provider] || provider
        const entityName = data.entities[provider] || '(no entity name)'
        const isLast =
          idx === data.connected.length - 1 && !data.activeRealmId && !data.bcSchemas?.length
        const prefix = isLast ? b.bottomLeft : b.teeRight
        console.log(
          `${c.cyan}${prefix}${b.horizontal}${b.horizontal}${r} ${c.brightWhite}${label}${r} ${c.dim}→${r} ${c.brightGreen}${entityName}${r}`
        )
      })

      // Active realm ID
      if (data.activeRealmId) {
        const isLast = !data.bcSchemas?.length
        const prefix = isLast ? b.bottomLeft : b.teeRight
        console.log(
          `${c.cyan}${prefix}${b.horizontal}${b.horizontal}${r} ${c.dim}Active QB →${r} ${c.yellow}${data.activeRealmId}${r}`
        )
      }

      // BC Schemas
      if (data.bcSchemas && data.bcSchemas.length > 0) {
        const schemaStr = data.bcSchemas.join(', ')
        const defaultStr = data.bcDefaultSchema
          ? ` ${c.dim}(default: ${data.bcDefaultSchema})${r}`
          : ''
        console.log(
          `${c.cyan}${b.bottomLeft}${b.horizontal}${b.horizontal}${r} ${c.dim}BC Schemas →${r} ${c.yellow}${schemaStr}${r}${defaultStr}`
        )
      }

      console.log('')
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'providers',
          ...data,
        })
      )
    }
  }

  /**
   * Log a chat session divider with optional label
   */
  chatDivider(label?: string) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const b = this.box
    const i = this.icons
    const r = c.reset

    if (this.prettyFormat) {
      console.log('')
      if (label) {
        const line = b.horizontal.repeat(25)
        console.log(
          `${c.cyan}${line} ${i.sparkle} ${c.bold}${label}${r} ${c.cyan}${i.sparkle} ${line}${r}`
        )
      } else {
        const line = b.horizontal.repeat(60)
        console.log(`${c.dim}${line}${r}`)
      }
      console.log('')
    }
  }

  /**
   * Log streaming progress indicator
   */
  streaming(
    status: 'start' | 'chunk' | 'end',
    metadata?: LogMetadata & { chunkSize?: number; totalChunks?: number }
  ) {
    if (!this.shouldLog(LogLevel.DEBUG)) return

    const c = this.colors
    const i = this.icons
    const r = c.reset

    if (this.prettyFormat) {
      switch (status) {
        case 'start':
          console.log(`${c.cyan}${i.rocket}${r} ${c.dim}Streaming started...${r}`)
          break
        case 'chunk':
          // Skip to reduce noise
          break
        case 'end':
          console.log(
            `${c.cyan}${i.success}${r} ${c.brightGreen}Stream complete${r}${metadata?.totalChunks ? ` ${c.dim}(${metadata.totalChunks} chunks)${r}` : ''}`
          )
          break
      }
    }
  }

  /**
   * Log API request with beautiful formatting
   */
  apiRequest(
    method: string,
    path: string,
    metadata?: LogMetadata & { status?: number; duration?: number }
  ) {
    if (!this.shouldLog(LogLevel.INFO)) return

    const c = this.colors
    const i = this.icons
    const r = c.reset

    if (this.prettyFormat) {
      const methodColor =
        method === 'GET'
          ? c.green
          : method === 'POST'
            ? c.blue
            : method === 'DELETE'
              ? c.red
              : c.yellow
      const statusColor = metadata?.status
        ? metadata.status < 300
          ? c.green
          : metadata.status < 400
            ? c.yellow
            : c.red
        : c.dim

      let output = `${i.lightning} ${methodColor}${method}${r} ${c.white}${path}${r}`

      if (metadata?.status) {
        output += ` ${statusColor}${metadata.status}${r}`
      }
      if (metadata?.duration) {
        output += ` ${c.dim}${metadata.duration}ms${r}`
      }

      console.log(output)
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          type: 'api_request',
          method,
          path,
          ...metadata,
        })
      )
    }
  }
}

// Token estimation (rough estimate for debugging)
function estimateTokens(text: string): number {
  // ~4 chars per token for English text
  return Math.ceil(text.length / 4)
}

// Truncate message for preview (with PII filtering)
function truncateMessage(message: string, maxLength: number = 200): string {
  if (!message) return ''
  // Filter potential PII patterns
  let filtered = message
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[EMAIL]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]')

  if (filtered.length <= maxLength) return filtered
  return filtered.slice(0, maxLength) + '...'
}

// Export singleton instance
export const logger = new Logger()

// Export helper functions
export { estimateTokens, truncateMessage }

// Helper function to generate correlation IDs
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper function to extract user info from JWT token (if needed externally)
export function extractUserContext(token: any): Partial<RequestContext> {
  return {
    userId: token?.sub || token?.userId,
    organizationId: token?.organization_id || token?.orgId,
  }
}
