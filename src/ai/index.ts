// src/ai/index.ts
// Main entry point for the AI system

// =============================================================================
// Core Agent
// =============================================================================

export { createAgent, invokeAgent, createLLM, getDefaultLLM, buildSystemPrompt } from './agent'
export type { LLMConfig, GraphState } from './agent'

// =============================================================================
// Tools
// =============================================================================

export {
  financialCalculator,
  dateCalculator,
  createVisualization,
  resetVisualizationIndex,
  getDateRange,
  memoryTool,
  getMemoriesForContext,
  resetWidgetIndex,
  quickbooksData,
  allTools,
} from './tools'

// =============================================================================
// Memory
// =============================================================================

export { MemoryService } from './memory/memoryService'
export type {
  Memory,
  MemoryType,
  MemoryMetadata,
  CreateMemoryInput,
  UpdateMemoryInput,
  SearchMemoryOptions,
} from './memory/types'
export { LEGACY_TYPE_MAP, MEMORY_TYPE_LABELS, MEMORY_TYPE_DESCRIPTIONS } from './memory/types'

// Legacy export for backward compatibility
export { MemoryService as MemoryManager } from './memory/memoryService'

// =============================================================================
// Visualizations
// =============================================================================

export {
  VisualizationRenderer,
  VisualizationList,
  ChartRenderer,
  KPIRenderer,
  MetricRenderer,
  ComparisonRenderer,
  ProgressRenderer,
  TimelineRenderer,
} from './visualizations/renderer'
export type * from './visualizations/types'

// =============================================================================
// Widgets (Memory UI)
// =============================================================================

export {
  WidgetRenderer,
  MemoryListRenderer,
  MemoryCreatedRenderer,
  MemoryUpdatedRenderer,
  MemoryDeletedRenderer,
  MemoryItem,
  memoryTypeIcons,
  memoryTypeColors,
} from './widgets'
export type {
  WidgetType,
  WidgetBlock,
  MemoryListWidget,
  MemoryCreatedWidget,
  MemoryUpdatedWidget,
  MemoryDeletedWidget,
  MemoryDisplayItem,
} from './widgets'
export { WIDGET_MARKER_PATTERN, extractWidgetMarkers, replaceWidgetMarkers } from './widgets'

// =============================================================================
// Validation
// =============================================================================

export {
  validateAndParseResponse,
  logValidationFailure,
  logFinalValidationStatus,
} from './validation/responseValidator'

// =============================================================================
// Analysis Prompts
// =============================================================================

export { buildSystemPrompt as buildAnalysisSystemPrompt, buildUserPrompt } from './analysis/prompts'

// =============================================================================
// Types
// =============================================================================

export * from './types'
