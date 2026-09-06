// src/ai/tools/index.ts
// Export all tools

export { financialCalculator } from './calculator'
export { dateCalculator, getDateRange } from './dates'
export { createVisualization, resetVisualizationIndex } from './visualization'
export { webSearch } from './webSearch'
export { stockPrice } from './stockPrice'
export { memoryTool, getMemoriesForContext, resetWidgetIndex } from './memory'
export { quickbooksData } from './quickbooks-data'
export { businessCentralData } from './business-central-data'
export { uiAction } from './ui-action'

// Combined tools array for agent
import { financialCalculator } from './calculator'
import { dateCalculator } from './dates'
import { createVisualization } from './visualization'
import { webSearch } from './webSearch'
import { stockPrice } from './stockPrice'
import { memoryTool } from './memory'
import { quickbooksData } from './quickbooks-data'
import { businessCentralData } from './business-central-data'
import { uiAction } from './ui-action'

export const allTools = [
  financialCalculator,
  dateCalculator,
  createVisualization,
  webSearch,
  stockPrice,
  memoryTool,
  quickbooksData,
  businessCentralData,
  uiAction,
]
