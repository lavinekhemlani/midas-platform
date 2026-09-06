// src/lib/utils/chartUtils.ts

export interface PieChartDataItem {
  name: string
  value: number
  percentage?: number
  [key: string]: any
}

export interface ProcessPieChartDataOptions {
  /**
   * Maximum number of items to display before grouping smaller items into "Others"
   * @default 8
   */
  maxItems?: number
  /**
   * Minimum percentage threshold for an item to be shown separately (0-100)
   * Items below this threshold will be grouped into "Others"
   * @default 2
   */
  minPercentage?: number
  /**
   * Sort order for the items
   * @default 'desc'
   */
  sortOrder?: 'asc' | 'desc'
  /**
   * Label for the "Others" group
   * @default 'Others'
   */
  othersLabel?: string
  /**
   * Key to use for the value field
   * @default 'value'
   */
  valueKey?: string
  /**
   * Key to use for the name field
   * @default 'name'
   */
  nameKey?: string
}

/**
 * Process pie chart data by sorting items in descending order and grouping
 * smaller items into an "Others" category
 */
export function processPieChartData(
  data: PieChartDataItem[],
  options: ProcessPieChartDataOptions = {}
): PieChartDataItem[] {
  const {
    maxItems = 8,
    minPercentage = 2,
    sortOrder = 'desc',
    othersLabel = 'Others',
    valueKey = 'value',
    nameKey = 'name',
  } = options

  if (!data || data.length === 0) {
    return []
  }

  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0)

  if (total === 0) {
    return data
  }

  // Add percentage to each item and sort
  const itemsWithPercentage = data.map((item) => ({
    ...item,
    percentage: (((item as any)[valueKey] || 0) / total) * 100,
  }))

  // Sort by value
  const sortedItems = itemsWithPercentage.sort((a, b) => {
    const aVal = (a as any)[valueKey] || 0
    const bVal = (b as any)[valueKey] || 0
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
  })

  // If we have fewer items than maxItems and all items are above minPercentage, return as is
  if (
    sortedItems.length <= maxItems &&
    sortedItems.every((item) => item.percentage >= minPercentage)
  ) {
    return sortedItems
  }

  // Determine which items to keep and which to group
  const itemsToKeep: PieChartDataItem[] = []
  const itemsToGroup: PieChartDataItem[] = []

  for (let i = 0; i < sortedItems.length; i++) {
    const item = sortedItems[i]

    // Keep item if:
    // 1. We haven't reached maxItems yet AND percentage is above threshold
    // 2. OR it's one of the first few items (always keep top items)
    if (
      (itemsToKeep.length < maxItems && item.percentage >= minPercentage) ||
      itemsToKeep.length < Math.min(3, maxItems) // Always keep at least top 3 (or maxItems if smaller)
    ) {
      itemsToKeep.push(item)
    } else {
      itemsToGroup.push(item)
    }
  }

  // If there are items to group, create an "Others" category
  if (itemsToGroup.length > 0) {
    const othersValue = itemsToGroup.reduce((sum, item) => sum + ((item as any)[valueKey] || 0), 0)
    const othersPercentage = (othersValue / total) * 100

    const othersItem: PieChartDataItem = {
      name: othersLabel,
      value: othersValue,
      [nameKey]: othersLabel,
      [valueKey]: othersValue,
      percentage: othersPercentage,
      isOthersGroup: true,
      groupedItems: itemsToGroup.map((item) => ({
        name: (item as any)[nameKey],
        value: (item as any)[valueKey],
        percentage: item.percentage,
      })),
    }

    return [...itemsToKeep, othersItem]
  }

  return itemsToKeep
}
