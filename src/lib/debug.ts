// src/lib/debug.ts
// Centralized debug logging for AI chat pipeline
// Enable/disable via environment variable or localStorage

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  component: string
  action: string
  data?: Record<string, unknown>
  error?: Error | unknown
}

// Check if debug mode is enabled
// Enabled by default in all environments; set DEBUG_AI_CHAT=false to disable
function isDebugEnabled(): boolean {
  // Server-side: check env (enabled unless explicitly disabled)
  if (typeof window === 'undefined') {
    return process.env.DEBUG_AI_CHAT !== 'false'
  }
  // Client-side: check localStorage (enabled unless explicitly disabled)
  try {
    return localStorage.getItem('DEBUG_AI_CHAT') !== 'false'
  } catch {
    return true
  }
}

// Format log message with timestamp and context
function formatMessage(level: LogLevel, ctx: LogContext): string {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
  return `[${timestamp}] [AI:${ctx.component}] ${ctx.action}`
}

// Color codes for different log levels (browser console)
const colors = {
  debug: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444',
}

// Component-specific colors for easier visual parsing
const componentColors: Record<string, string> = {
  API: '#8b5cf6', // purple
  Hook: '#10b981', // green
  Transform: '#f59e0b', // amber
  Renderer: '#3b82f6', // blue
  Message: '#ec4899', // pink
  SSE: '#06b6d4', // cyan
}

// ANSI color codes for server-side terminal output
const ansiColors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Bright colors
  purple: '\x1b[95m',
  green: '\x1b[92m',
  amber: '\x1b[93m',
  blue: '\x1b[94m',
  pink: '\x1b[95m',
  cyan: '\x1b[96m',
  red: '\x1b[91m',
  white: '\x1b[97m',
  // Regular colors
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
}

// Map component to ANSI color
const ansiComponentColors: Record<string, string> = {
  API: ansiColors.purple,
  Hook: ansiColors.green,
  Transform: ansiColors.amber,
  Renderer: ansiColors.blue,
  Message: ansiColors.pink,
  SSE: ansiColors.cyan,
}

// Box drawing characters
const box = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  arrow: '→',
  bullet: '•',
}

class AIDebugLogger {
  private enabled: boolean

  constructor() {
    this.enabled = isDebugEnabled()
  }

  private log(level: LogLevel, ctx: LogContext) {
    if (!this.enabled && level === 'debug') return

    const message = formatMessage(level, ctx)
    const componentColor = componentColors[ctx.component] || '#6b7280'

    if (typeof window === 'undefined') {
      // Server-side logging with enhanced ANSI colors
      const color = ansiComponentColors[ctx.component] || ansiColors.white
      const r = ansiColors.reset
      const d = ansiColors.dim
      const b = ansiColors.bold
      const timestamp = new Date().toLocaleTimeString()

      // Check if this is a tool-related action for special formatting
      const isToolStart = ctx.action.includes('Tool started')
      const isToolEnd = ctx.action.includes('Tool ended')

      if (isToolStart) {
        const toolName = ctx.action.replace('Tool started: ', '')
        const line = box.horizontal.repeat(40)
        console.log('')
        console.log(`${ansiColors.purple}${box.topLeft}${line}${box.topRight}${r}`)
        console.log(
          `${ansiColors.purple}${box.vertical}${r} ${b}${ansiColors.magenta}TOOL CALL${r} ${ansiColors.yellow}${toolName}${r}`
        )
        console.log(`${ansiColors.purple}${box.vertical}${r} ${d}[${timestamp}] Starting...${r}`)
        console.log(`${ansiColors.purple}${box.bottomLeft}${line}${box.bottomRight}${r}`)
        if (ctx.data) {
          console.log(
            `${ansiColors.magenta}${box.arrow} Input:${r} ${d}${JSON.stringify(ctx.data).slice(0, 200)}${r}`
          )
        }
      } else if (isToolEnd) {
        const toolName = ctx.action.replace('Tool ended: ', '')
        const hasViz = ctx.data && (ctx.data as any).hasVisualization
        const statusIcon = hasViz ? '✓' : '✓'
        console.log(
          `${ansiColors.purple}${box.vertical}${r} ${ansiColors.green}${statusIcon} Completed:${r} ${ansiColors.yellow}${toolName}${r}`
        )
        if (ctx.data) {
          console.log(
            `${ansiColors.magenta}${box.arrow} Output:${r} ${d}${JSON.stringify(ctx.data).slice(0, 150)}${r}`
          )
        }
      } else {
        // Standard logging with colors
        const prefix = `${color}[AI:${ctx.component}]${r}`
        switch (level) {
          case 'debug':
          case 'info':
            console.log(
              prefix,
              ctx.action,
              ctx.data ? `${d}${JSON.stringify(ctx.data, null, 2).slice(0, 500)}${r}` : ''
            )
            break
          case 'warn':
            console.warn(`${ansiColors.yellow}${prefix}${r}`, ctx.action, ctx.data || '')
            break
          case 'error':
            console.error(`${ansiColors.red}${prefix}${r}`, ctx.action, ctx.error || ctx.data || '')
            break
        }
      }
    } else {
      // Client-side logging with colors
      const style = `color: ${componentColor}; font-weight: bold`
      switch (level) {
        case 'debug':
          console.debug(`%c[AI:${ctx.component}]`, style, ctx.action, ctx.data || '')
          break
        case 'info':
          console.info(`%c[AI:${ctx.component}]`, style, ctx.action, ctx.data || '')
          break
        case 'warn':
          console.warn(`%c[AI:${ctx.component}]`, style, ctx.action, ctx.data || '')
          break
        case 'error':
          console.error(`%c[AI:${ctx.component}]`, style, ctx.action, ctx.error || ctx.data || '')
          break
      }
    }
  }

  // API Route logging
  api = {
    requestStart: (data: { userId: string; inputLength: number }) =>
      this.log('info', { component: 'API', action: 'Request started', data }),

    streamStart: (data: { messageId: string; threadId: string }) =>
      this.log('debug', { component: 'API', action: 'Stream started', data }),

    toolStart: (data: { tool: string; input: unknown }) =>
      this.log('info', {
        component: 'API',
        action: `Tool started: ${data.tool}`,
        data: { input: JSON.stringify(data.input).slice(0, 200) },
      }),

    toolEnd: (data: { tool: string; outputPreview: string; hasVisualization: boolean }) =>
      this.log('info', { component: 'API', action: `Tool ended: ${data.tool}`, data }),

    visualizationSent: (data: { type: string; title?: string }) =>
      this.log('info', { component: 'API', action: `Visualization sent: ${data.type}`, data }),

    tokenStream: (data: { tokenCount: number }) =>
      this.log('debug', { component: 'API', action: 'Tokens streamed', data }),

    responseComplete: (data: {
      responseLength: number
      visualizationCount: number
      toolCallCount: number
    }) => this.log('info', { component: 'API', action: 'Response complete', data }),

    error: (error: unknown, context?: string) =>
      this.log('error', { component: 'API', action: context || 'Error occurred', error }),
  }

  // useChat hook logging
  hook = {
    sseEvent: (data: { type: string; preview?: string }) =>
      this.log('debug', { component: 'Hook', action: `SSE event: ${data.type}`, data }),

    visualizationReceived: (data: { type: string; raw: unknown }) =>
      this.log('info', {
        component: 'Hook',
        action: `Visualization received: ${data.type}`,
        data: { raw: JSON.stringify(data.raw).slice(0, 300) },
      }),

    visualizationTransformed: (data: { inputType: string; outputType: string; success: boolean }) =>
      this.log('info', { component: 'Hook', action: 'Visualization transformed', data }),

    componentsUpdated: (data: { messageId: string; count: number; types: string[] }) =>
      this.log('info', { component: 'Hook', action: 'Components updated', data }),

    messageUpdated: (data: {
      messageId: string
      role: string
      contentLength: number
      componentCount: number
    }) => this.log('debug', { component: 'Hook', action: 'Message updated', data }),

    error: (error: unknown, context?: string) =>
      this.log('error', { component: 'Hook', action: context || 'Error occurred', error }),
  }

  // Transformer logging
  transform = {
    input: (data: { type: string; raw: unknown }) =>
      this.log('debug', {
        component: 'Transform',
        action: `Input: ${data.type}`,
        data: { raw: JSON.stringify(data.raw).slice(0, 300) },
      }),

    output: (data: { type: string; chartType?: string; success: boolean }) =>
      this.log('info', { component: 'Transform', action: 'Output', data }),

    error: (data: { inputType: string; reason: string }) =>
      this.log('warn', { component: 'Transform', action: 'Transform failed', data }),
  }

  // VisualizationRenderer logging
  renderer = {
    received: (data: { type: string; block: unknown }) =>
      this.log('debug', {
        component: 'Renderer',
        action: `Received: ${data.type}`,
        data: { block: JSON.stringify(data.block).slice(0, 300) },
      }),

    rendering: (data: { type: string; chartType?: string }) =>
      this.log('info', {
        component: 'Renderer',
        action: `Rendering: ${data.type}${data.chartType ? `:${data.chartType}` : ''}`,
      }),

    rendered: (data: { type: string }) =>
      this.log('debug', { component: 'Renderer', action: `Rendered: ${data.type}` }),

    unknownType: (data: { type: string; block: unknown }) =>
      this.log('warn', {
        component: 'Renderer',
        action: `Unknown type: ${data.type}`,
        data: { block: JSON.stringify(data.block).slice(0, 200) },
      }),

    error: (error: unknown, context?: string) =>
      this.log('error', { component: 'Renderer', action: context || 'Render error', error }),
  }

  // ChatMessage logging
  message = {
    render: (data: { messageId: string; role: string; componentCount: number }) =>
      this.log('debug', { component: 'Message', action: 'Rendering', data }),

    componentsRender: (data: { messageId: string; count: number; types: string[] }) =>
      this.log('info', { component: 'Message', action: 'Rendering components', data }),
  }

  // Enable/disable debug mode
  enable() {
    this.enabled = true
    if (typeof window !== 'undefined') {
      localStorage.setItem('DEBUG_AI_CHAT', 'true')
    }
    console.log('%c[AI Debug] Logging enabled', 'color: #10b981; font-weight: bold')
  }

  disable() {
    this.enabled = false
    if (typeof window !== 'undefined') {
      localStorage.removeItem('DEBUG_AI_CHAT')
    }
    console.log('%c[AI Debug] Logging disabled', 'color: #6b7280')
  }

  // Check status
  status() {
    console.log(
      `%c[AI Debug] Status: ${this.enabled ? 'ENABLED' : 'DISABLED'}`,
      `color: ${this.enabled ? '#10b981' : '#6b7280'}; font-weight: bold`
    )
    return this.enabled
  }
}

// Export singleton instance
export const aiDebug = new AIDebugLogger()

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  ;(window as any).aiDebug = aiDebug
}
