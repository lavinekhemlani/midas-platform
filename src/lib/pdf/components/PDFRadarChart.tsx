// src/lib/pdf/components/PDFRadarChart.tsx
import React from 'react'
import { View, Text, Svg, Path, Line, Circle, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, PDF_FONTS, PDF_FONT_SIZES } from '../fontConfig'

// Register fonts from shared config
registerPdfFonts()

// Colors for radar chart series
const RADAR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
]

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    border: '1 solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 10,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 15,
    paddingHorizontal: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendBox: {
    width: 12,
    height: 12,
    marginRight: 6,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#111827',
  },
})

// Format number helper
function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

// Calculate point position on radar chart
function calculateRadarPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  value: number,
  maxValue: number
): { x: number; y: number } {
  const normalizedValue = value / maxValue
  const x = centerX + radius * normalizedValue * Math.cos(angle)
  const y = centerY + radius * normalizedValue * Math.sin(angle)
  return { x, y }
}

// Calculate label position (outside the radar)
function calculateLabelPoint(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
  offset: number = 25
): { x: number; y: number } {
  const x = centerX + (radius + offset) * Math.cos(angle)
  const y = centerY + (radius + offset) * Math.sin(angle)
  return { x, y }
}

interface RadarDataPoint {
  label: string
  value: number
  [key: string]: any
}

interface RadarSeries {
  key: string
  name: string
  color?: string
}

interface PDFRadarChartProps {
  data: RadarDataPoint[]
  title?: string
  series?: RadarSeries[]
  maxValue?: number
}

export const PDFRadarChart: React.FC<PDFRadarChartProps> = ({
  data,
  title,
  series = [],
  maxValue,
}) => {
  if (!data || data.length === 0) return null

  // Determine series if not provided (default to 'value' key)
  let radarSeries = series
  if (radarSeries.length === 0) {
    const defaultKeys = ['value', 'score', 'rating', 'performance']
    radarSeries = defaultKeys
      .filter((key) => data.some((d) => d[key] !== undefined))
      .map((key) => ({ key, name: key.charAt(0).toUpperCase() + key.slice(1) }))
  }

  if (radarSeries.length === 0) return null

  // Calculate max value if not provided
  let max = maxValue
  if (!max) {
    max = 0
    data.forEach((point) => {
      radarSeries.forEach((s) => {
        const value = point[s.key]
        if (value !== undefined && value !== null) {
          max = Math.max(max!, value)
        }
      })
    })
    // Round up to nice number
    max = Math.ceil(max! / 10) * 10
  }

  // SVG dimensions
  const width = 500
  const height = 400
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2 - 80

  // Calculate angles for each axis
  const numAxes = data.length
  const angleStep = (2 * Math.PI) / numAxes
  const startAngle = -Math.PI / 2 // Start at top

  // Generate grid levels (5 concentric polygons)
  const numLevels = 5
  const gridLevels = []
  for (let i = 1; i <= numLevels; i++) {
    const levelRadius = (radius / numLevels) * i
    const points = []
    for (let j = 0; j < numAxes; j++) {
      const angle = startAngle + j * angleStep
      const x = centerX + levelRadius * Math.cos(angle)
      const y = centerY + levelRadius * Math.sin(angle)
      points.push({ x, y })
    }
    gridLevels.push(points)
  }

  return (
    <View style={styles.container} wrap={true}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Draw grid levels (concentric polygons) */}
          {gridLevels.map((points, levelIndex) => {
            const pathData = 'M ' + points.map((p) => `${p.x},${p.y}`).join(' L ') + ' Z'
            return (
              <Path
                key={`grid-${levelIndex}`}
                d={pathData}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={1}
              />
            )
          })}

          {/* Draw axes from center to perimeter */}
          {data.map((point, index) => {
            const angle = startAngle + index * angleStep
            const endPoint = calculateLabelPoint(centerX, centerY, radius, angle, 0)

            return (
              <Line
                key={`axis-${index}`}
                x1={centerX}
                y1={centerY}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="#d1d5db"
                strokeWidth={1}
              />
            )
          })}

          {/* Draw value labels on axes */}
          {[1, 2, 3, 4, 5].map((level) => {
            const levelValue = (max! / 5) * level
            const angle = startAngle // Use first axis for value labels
            const point = calculateRadarPoint(centerX, centerY, radius, angle, levelValue, max!)

            return (
              <Text
                key={`value-label-${level}`}
                x={point.x + 5}
                y={point.y}
                style={{
                  fontSize: 7,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fill: '#9ca3af',
                }}
              >
                {formatNumber(levelValue)}
              </Text>
            )
          })}

          {/* Draw data series */}
          {radarSeries.map((s, seriesIndex) => {
            const color = s.color || RADAR_COLORS[seriesIndex % RADAR_COLORS.length]

            // Calculate points for this series
            const seriesPoints = data.map((point, index) => {
              const angle = startAngle + index * angleStep
              const value = point[s.key] || 0
              return calculateRadarPoint(centerX, centerY, radius, angle, value, max!)
            })

            // Create path for the polygon
            const pathData = 'M ' + seriesPoints.map((p) => `${p.x},${p.y}`).join(' L ') + ' Z'

            return (
              <React.Fragment key={s.key}>
                {/* Fill area */}
                <Path d={pathData} fill={color} opacity={0.25} />
                {/* Draw outline */}
                <Path d={pathData} fill="none" stroke={color} strokeWidth={2} />
                {/* Draw points */}
                {seriesPoints.map((point, idx) => (
                  <Circle
                    key={`${s.key}-point-${idx}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    fill={color}
                  />
                ))}
              </React.Fragment>
            )
          })}

          {/* Draw axis labels (outside the chart) */}
          {data.map((point, index) => {
            const angle = startAngle + index * angleStep
            const labelPoint = calculateLabelPoint(centerX, centerY, radius, angle, 25)

            // Adjust text anchor based on position
            let textAnchor: 'start' | 'middle' | 'end' = 'middle'
            if (labelPoint.x < centerX - 10) textAnchor = 'end'
            if (labelPoint.x > centerX + 10) textAnchor = 'start'

            return (
              <Text
                key={`label-${index}`}
                x={labelPoint.x}
                y={labelPoint.y + 4}
                style={{
                  fontSize: 9,
                  fontFamily: PDF_FONTS.PRIMARY,
                  fill: '#374151',
                  textAnchor,
                  fontWeight: 600,
                }}
              >
                {point.label}
              </Text>
            )
          })}
        </Svg>
      </View>

      {/* Legend (only if multiple series) */}
      {radarSeries.length > 1 && (
        <View style={styles.legendGrid}>
          {radarSeries.map((s, index) => {
            const color = s.color || RADAR_COLORS[index % RADAR_COLORS.length]
            return (
              <View key={s.key} style={styles.legendItem}>
                <View style={[styles.legendBox, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
