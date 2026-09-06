// src/ai/visualizations/renderer.tsx
// Re-export from the main chat visualization renderer
// This file exists for backwards compatibility with imports from src/ai

export {
  VisualizationRenderer,
  ChartRenderer,
  KPIRenderer,
  MetricRenderer,
  ComparisonRenderer,
  ProgressRenderer,
  TimelineRenderer,
} from '@/components/chat/visualizations'

// Alias for backwards compatibility
export { VisualizationRenderer as VisualizationList } from '@/components/chat/visualizations'
