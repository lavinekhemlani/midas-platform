// src/lib/pdf/components/PDFTableVisualization.tsx
import React from 'react'
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

const styles = StyleSheet.create({
  // Main container - NO overflow hidden to allow full content
  container: {
    marginVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
    flexDirection: 'column',
  },
  // Styled title header bar
  titleHeader: {
    backgroundColor: '#1e3a5f',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottom: '3 solid #d4af37',
  },
  title: {
    fontSize: 13,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  // Table container - explicit column direction for proper row stacking
  tableWrapper: {
    padding: 0,
    flexDirection: 'column',
  },
  // Column header row
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottom: '2 solid #e2e8f0',
    paddingVertical: 10,
  },
  // Data rows - flexible height
  row: {
    flexDirection: 'row',
    borderBottom: '1 solid #f1f5f9',
    paddingVertical: 10,
  },
  rowEven: {
    backgroundColor: '#ffffff',
  },
  rowOdd: {
    backgroundColor: '#fafbfc',
  },
  rowLast: {
    borderBottom: 'none',
  },
  // Cell container - text wraps within the fixed width
  cellContainer: {
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  // Cell text styles
  cell: {
    // fontSize: 8,
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#334155',
    lineHeight: 1.6,
    textAlign: 'center',
  },
  headerCell: {
    // fontSize: 7,
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  // First column styling (typically labels/IDs)
  firstColumnCell: {
    fontWeight: 700,
    color: '#1e293b',
  },
  // Alignment helpers
  alignLeft: {
    textAlign: 'left',
  },
  alignCenter: {
    textAlign: 'center',
  },
  alignRight: {
    textAlign: 'right',
  },
  // Footer for truncation message
  footer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderTop: '1 solid #e2e8f0',
  },
  footerText: {
    fontSize: 8,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
})

// Format value based on format type
function formatValue(
  value: any,
  formatType?: 'currency' | 'number' | 'date' | 'percentage',
  currency: string = 'USD'
): string {
  if (value === null || value === undefined) return '—'

  switch (formatType) {
    case 'currency':
      const numValue = typeof value === 'number' ? value : parseFloat(value)
      if (isNaN(numValue)) return '—'
      if (Math.abs(numValue) >= 1000000) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          currencyDisplay: 'narrowSymbol',
          notation: 'compact',
          maximumFractionDigits: 2,
        })
          .format(numValue)
          .replace(/^(-?)(\p{Sc})/u, '$1$2 ')
      }
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
        .format(numValue)
        .replace(/^(-?)(\p{Sc})/u, '$1$2 ')
    case 'number':
      const num = typeof value === 'number' ? value : parseFloat(value)
      if (isNaN(num)) return value.toString()
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(num)
    case 'percentage':
      const pct = typeof value === 'number' ? value : parseFloat(value)
      if (isNaN(pct)) return '—'
      return `${(pct * 100).toFixed(1)}%`
    case 'date':
      try {
        const date = new Date(value)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      } catch {
        return value.toString()
      }
    default:
      return value.toString()
  }
}

// Detect if a value is numeric
function isNumericValue(value: any): boolean {
  if (typeof value === 'number') return true
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[,$%]/g, ''))
    return !isNaN(parsed) && value.length < 20
  }
  return false
}

interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string | number
  format?: 'currency' | 'number' | 'date' | 'percentage'
}

interface HeaderGroup {
  label: string
  colSpan: number
}

interface PDFTableVisualizationProps {
  title?: string
  columns: TableColumn[]
  data: Record<string, any>[]
  currency?: string
  maxRows?: number
  headerGroups?: HeaderGroup[]
}

// Density tiers based on column count
function getDensityTier(colCount: number) {
  if (colCount >= 13) {
    // Ultra-compact: 13+ columns
    return {
      cellFont: 6.5,
      headerFont: 6,
      padding: 3,
      rowPadding: 7,
      lineHeight: 1.4,
      letterSpacing: 0.15,
    }
  }
  if (colCount >= 9) {
    // Compact: 9–12 columns
    // return { cellFont: 6.5, headerFont: 6, padding: 4, rowPadding: 7, lineHeight: 1.4, letterSpacing: 0.2 }
    return {
      cellFont: 7.5,
      headerFont: 7,
      padding: 4,
      rowPadding: 8,
      lineHeight: 1.4,
      letterSpacing: 0.2,
    }
  }
  // Normal: ≤8 columns
  return {
    cellFont: 8,
    headerFont: 7,
    padding: 8,
    rowPadding: 10,
    lineHeight: 1.6,
    letterSpacing: 0.3,
  }
}

export const PDFTableVisualization: React.FC<PDFTableVisualizationProps> = ({
  title,
  columns,
  data,
  currency = 'USD',
  maxRows,
  headerGroups,
}) => {
  if (!data || data.length === 0) return null

  // Show ALL rows - no limit
  const displayData = maxRows ? data.slice(0, maxRows) : data
  const hasMoreRows = maxRows ? data.length > maxRows : false

  // Determine density tier based on column count
  const density = getDensityTier(columns.length)

  // Calculate column widths - use explicit width if provided, otherwise calculate
  const columnWidths = columns.map((col) => {
    // Use explicit width if provided
    if (col.width) {
      return typeof col.width === 'number' ? `${col.width}%` : col.width
    }
    // Fall back to automatic calculation
    const colKey = col.key.toLowerCase()
    const isIdColumn = colKey === 'id' || colKey.endsWith('_id')
    if (isIdColumn) return '8%'
    // Distribute remaining space equally among other columns
    const otherCols = columns.filter((c) => {
      const k = c.key.toLowerCase()
      return k !== 'id' && !k.endsWith('_id')
    }).length
    return `${(92 / otherCols).toFixed(0)}%`
  })

  // Detect numeric columns for right-alignment
  const numericColumns = new Set<number>()
  if (displayData.length > 0) {
    columns.forEach((col, idx) => {
      const sampleValue = displayData[0][col.key]
      if (
        col.format === 'currency' ||
        col.format === 'number' ||
        col.format === 'percentage' ||
        isNumericValue(sampleValue)
      ) {
        numericColumns.add(idx)
      }
    })
  }

  return (
    <View style={styles.container} wrap={true}>
      {/* Title header - fixed to repeat on each page */}
      {title && (
        <View style={styles.titleHeader} fixed>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      <View style={styles.tableWrapper}>
        {/* Column Headers - fixed to repeat on each page */}
        {headerGroups ? (
          // Two-row grouped header (like Excel: OPENING STOCK spanning CTNS/MT/VALUE)
          <View fixed>
            {/* Row 1: Group headers */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#ffffff',
                borderBottom: '1 solid #cbd5e1',
                minHeight: density.rowPadding + 10,
                alignItems: 'stretch',
              }}
            >
              {(() => {
                let colIdx = 0
                return headerGroups.map((group, gIdx) => {
                  const groupCols = columns.slice(colIdx, colIdx + group.colSpan)
                  const groupWidth = groupCols.reduce((sum, _, i) => {
                    const w = columnWidths[colIdx + i]
                    return sum + parseFloat(w)
                  }, 0)
                  colIdx += group.colSpan

                  if (!group.label) {
                    // Empty group — no label, no border, just spacer
                    return (
                      <View key={gIdx} style={{ width: `${groupWidth}%` }} />
                    )
                  }

                  return (
                    <View
                      key={gIdx}
                      style={{
                        width: `${groupWidth}%`,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderLeft: '1 solid #cbd5e1',
                        backgroundColor: '#f1f5f9',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: density.headerFont + 1,
                          fontFamily: PDF_FONTS.PRIMARY,
                          fontWeight: 700,
                          color: '#1e3a5f',
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {group.label}
                      </Text>
                    </View>
                  )
                })
              })()}
            </View>
            {/* Row 2: Sub-headers (CTNS/MT/VALUE) + ungrouped column labels */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#f8fafc',
                borderBottom: '2 solid #1e3a5f',
                paddingVertical: density.rowPadding - 1,
                alignItems: 'stretch',
              }}
            >
              {(() => {
                // Track which columns belong to a group for border styling
                let groupBoundaries = new Set<number>()
                let colIdx = 0
                for (const group of headerGroups) {
                  if (group.label) groupBoundaries.add(colIdx)
                  colIdx += group.colSpan
                }

                return columns.map((column, index) => {
                  const isGroupStart = groupBoundaries.has(index)
                  return (
                    <View
                      key={index}
                      style={{
                        width: columnWidths[index],
                        paddingHorizontal: density.padding,
                        justifyContent: 'center',
                        overflow: 'hidden',
                        ...(isGroupStart ? { borderLeft: '1 solid #cbd5e1' } : {}),
                      }}
                    >
                      <Text
                        style={{
                          ...styles.headerCell,
                          fontSize: density.headerFont,
                          letterSpacing: density.letterSpacing,
                          textAlign: 'center',
                        }}
                      >
                        {column.label}
                      </Text>
                    </View>
                  )
                })
              })()}
            </View>
          </View>
        ) : (
          // Single-row header (default for vendors/customers)
          <View
            style={{
              ...styles.headerRow,
              paddingVertical: density.rowPadding,
              alignItems: 'stretch',
            }}
            fixed
          >
            {columns.map((column, index) => {
              const align = column.align || 'center'

              return (
                <View
                  key={index}
                  style={{
                    width: columnWidths[index],
                    paddingHorizontal: density.padding,
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Text
                    style={{
                      ...styles.headerCell,
                      fontSize: density.headerFont,
                      letterSpacing: density.letterSpacing,
                      textAlign: 'center',
                    }}
                  >
                    {column.label}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Data Rows - each row wraps to show full content */}
        {displayData.map((row, rowIndex) => {
          const isLast = rowIndex === displayData.length - 1 && !hasMoreRows
          const rowStyle = {
            ...styles.row,
            paddingVertical: density.rowPadding,
            ...(rowIndex % 2 === 0 ? styles.rowEven : styles.rowOdd),
            ...(isLast ? styles.rowLast : {}),
          }

          return (
            // wrap={false} prevents rows from splitting across pages
            <View key={rowIndex} style={rowStyle} wrap={false}>
              {columns.map((column, colIndex) => {
                // const isNumeric = numericColumns.has(colIndex)
                const isFirstCol = colIndex === 0
                // const align = column.align || (isNumeric && colIndex > 0 ? 'right' : 'left')
                const align = column.align || 'center'

                // Get FULL value - no truncation
                const displayValue = formatValue(row[column.key], column.format, currency)

                return (
                  <View
                    key={colIndex}
                    style={{
                      ...styles.cellContainer,
                      paddingHorizontal: density.padding,
                      width: columnWidths[colIndex],
                    }}
                  >
                    <Text
                      style={{
                        ...styles.cell,
                        fontSize: density.cellFont,
                        lineHeight: density.lineHeight,
                        textAlign: 'center',
                        ...(isFirstCol ? styles.firstColumnCell : {}),
                      }}
                    >
                      {displayValue}
                    </Text>
                  </View>
                )
              })}
            </View>
          )
        })}
      </View>

      {/* Footer showing truncation */}
      {hasMoreRows && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Showing {maxRows} of {data.length} rows
          </Text>
        </View>
      )}
    </View>
  )
}
