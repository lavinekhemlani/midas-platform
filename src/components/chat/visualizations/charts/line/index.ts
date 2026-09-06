/**
 * @module charts/line
 * @description Barrel export for line and area chart components
 *
 * Both LineChart and AreaChart use a shared base component with automatic
 * detection of single vs multi-series data:
 * - data[] → single series
 * - series[] + labels[] → multi-series
 *
 * Key difference: area stacks multi-series, line does not.
 */

export { LineChart, AreaChart } from './Line'
