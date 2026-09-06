/**
 * Inventory Page Components
 *
 * Components for the /bc/inventory dashboard page.
 *
 * Usage:
 * ```tsx
 * import {
 *   InventoryOverviewCard,
 *   InventoryByCategoryCard,
 *   TopItemsByValueCard,
 *   SlowMovingInventoryCard,
 *   InventoryMovementTrendCard,
 *   InventoryTurnoverCard,
 *   InventoryValuationCard,
 * } from './components'
 * ```
 */

export { InventoryOverviewCard } from './InventoryOverviewCard'
export { InventoryByCategoryCard } from './InventoryByCategoryCard'
export { TopItemsByValueCard } from './TopItemsByValueCard'
export { SlowMovingInventoryCard } from './SlowMovingInventoryCard'
export { InventoryMovementTrendCard } from './InventoryMovementTrendCard'
export { InventoryTurnoverCard } from './InventoryTurnoverCard'
export { InventoryValuationCard } from './InventoryValuationCard'

export { LocationsCard } from './LocationsCard'
export { StockMovementReportCard } from './StockMovementReportCard'

// Shared components for multi-page inventory
export { InfoTooltip } from './InfoTooltip'
export type { InfoTooltipProps, CalculationTooltip } from './InfoTooltip'
export { ItemDetailDrawer } from './ItemDetailDrawer'
export { LocationDetailDrawer } from './LocationDetailDrawer'
export { ABCClassificationCard } from './ABCClassificationCard'
export { StockHealthCard } from './StockHealthCard'
export { OutOfStockCard } from './OutOfStockCard'

// Chart components
export { SlowMovingInventoryDonut } from './SlowMovingInventoryDonut'
export { TopItemsHorizontalChart } from './TopItemsHorizontalChart'
export { ValuationComparisonChart } from './ValuationComparisonChart'

// PDF components
export { ItemDetailPDF } from './ItemDetailPDF'
export type { ItemDetailPDFProps } from './ItemDetailPDF'
export { StockAnalysisPDF } from './StockAnalysisPDF'
export type { StockAnalysisPDFProps } from './StockAnalysisPDF'
export { LocationsPDF } from './LocationsPDF'
export type { LocationsPDFProps } from './LocationsPDF'
export { ItemsListPDF } from './ItemsListPDF'
export type { ItemsListPDFProps } from './ItemsListPDF'
export { InventoryOverviewPDF } from './InventoryOverviewPDF'
export type { InventoryOverviewPDFProps } from './InventoryOverviewPDF'
