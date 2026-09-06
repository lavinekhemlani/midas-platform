export const TOKEN_LIMITS = {
  // Model maximum capabilities
  MODEL_MAX_COMPLETION: 50000,
  MODEL_CONTEXT_WINDOW: 100000,

  // Use case specific limits
  CHAT_AGENT: 16000,
  ANALYSIS: 8000,
  SIMPLE_QUERY: 2000,

  // Temperature settings
  TEMPERATURE_STRUCTURED: 0.2, // For JSON/structured output
  TEMPERATURE_CONVERSATIONAL: 0.3, // For chat
  TEMPERATURE_CREATIVE: 0.7, // For creative tasks
} as const

export type TokenLimits = typeof TOKEN_LIMITS
