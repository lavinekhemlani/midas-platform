/**
 * ECharts Components
 *
 * Unified chart components following the FinancialChart pattern.
 * All components use CSS variables for theming and are theme-reactive.
 *
 * Usage:
 * ```tsx
 * import { EChartsBar, EChartsLine, EChartsPie } from '@/components/charts/echarts'
 * ```
 */

export { EChartsScatter } from './EChartsScatter'
export type { EChartsScatterProps, ScatterDataPoint } from './EChartsScatter'

export { EChartsArea } from './EChartsArea'
export type { EChartsAreaProps, AreaSeries } from './EChartsArea'

export { EChartsBar } from './EChartsBar'
export type { EChartsBarProps, BarSeriesConfig } from './EChartsBar'

export { EChartsPie } from './EChartsPie'
export type { EChartsPieProps, EChartsPieDataItem } from './EChartsPie'

export { EChartsLine } from './EChartsLine'
export type { EChartsLineProps, LineSeriesConfig } from './EChartsLine'

export { EChartsWorldMap } from './EChartsWorldMap'
export type { WorldSalesMapProps, CountrySalesData } from './EChartsWorldMap'
