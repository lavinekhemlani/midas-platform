// src/lib/utils/consoleLogger.ts

export const ConsoleColors = {
  Reset: '\x1b[0m',
  Bright: '\x1b[1m',
  Dim: '\x1b[2m',
  Underscore: '\x1b[4m',
  Blink: '\x1b[5m',
  Reverse: '\x1b[7m',
  Hidden: '\x1b[8m',

  // Foreground colors
  FgBlack: '\x1b[30m',
  FgRed: '\x1b[31m',
  FgGreen: '\x1b[32m',
  FgYellow: '\x1b[33m',
  FgBlue: '\x1b[34m',
  FgMagenta: '\x1b[35m',
  FgCyan: '\x1b[36m',
  FgWhite: '\x1b[37m',

  // Background colors
  BgBlack: '\x1b[40m',
  BgRed: '\x1b[41m',
  BgGreen: '\x1b[42m',
  BgYellow: '\x1b[43m',
  BgBlue: '\x1b[44m',
  BgMagenta: '\x1b[45m',
  BgCyan: '\x1b[46m',
  BgWhite: '\x1b[47m',
}

export class ChatLogger {
  static userQuestion(message: string) {
    console.log(`${ConsoleColors.FgYellow}[USER QUESTION]${ConsoleColors.Reset}`, message)
  }

  static aiResponse(message: string) {
    console.log(`${ConsoleColors.FgCyan}[AI RESPONSE]${ConsoleColors.Reset}`, message)
  }

  static memoryFound(count: number, details?: any) {
    console.log(`${ConsoleColors.FgMagenta}[MEMORY FOUND]${ConsoleColors.Reset}`, `${count} relevant memories`, details || '')
  }

  static memoryCreated(memory: { id: string; type: string; content: string }) {
    console.log(`${ConsoleColors.FgGreen}[MEMORY CREATED]${ConsoleColors.Reset}`, memory)
  }

  static statusUpdate(status: string) {
    console.log(`${ConsoleColors.Dim}${ConsoleColors.FgBlue}[STATUS]${ConsoleColors.Reset}`, status)
  }

  static error(message: string, error?: any) {
    console.error(`${ConsoleColors.FgRed}[ERROR]${ConsoleColors.Reset}`, message, error || '')
  }

  static warning(message: string) {
    console.warn(`${ConsoleColors.FgYellow}[WARNING]${ConsoleColors.Reset}`, message)
  }

  static toolCall(toolName: string, input?: any) {
    console.log(`${ConsoleColors.FgBlue}[TOOL CALL]${ConsoleColors.Reset}`, toolName, input ? JSON.stringify(input).substring(0, 100) + '...' : '')
  }

  static debug(label: string, data: any) {
    console.log(`${ConsoleColors.Dim}[DEBUG ${label}]${ConsoleColors.Reset}`, data)
  }
}