// src/lib/pdf/chatPdfExporter.tsx
'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, pdf, Font } from '@react-pdf/renderer'
import {
  parseDynamoDBChatResponse,
  splitContentByViz,
  splitContentByMarkers,
  getComponentByVizIndex,
  type ParsedChatResponse,
  type ParsedComponent,
  type ParsedMetricComponent,
  type ExtendedContentSegment,
} from './chatResponseParser'
import { PDFDonutChart } from './components/PDFDonutChart'
import { PDFBarChart } from './components/PDFBarChart'
import { PDFWaterfallChart } from './components/PDFWaterfallChart'
import { PDFKPIDashboard } from './components/PDFKPIDashboard'
import { PDFLineChart } from './components/PDFLineChart'
import { PDFRadarChart } from './components/PDFRadarChart'
import { PDFScatterChart } from './components/PDFScatterChart'
import { PDFTableVisualization } from './components/PDFTableVisualization'
import { PDFMetricCard } from './components/PDFMetricCard'
import { PDFProgressBars } from './components/PDFProgressBars'
import { PDFComparison } from './components/PDFComparison'
import { PDFSankeyChart } from './components/PDFSankeyChart'
import { PDFMemoryWidget } from './components/PDFMemoryWidget'
import { PDFTreemapChart } from './components/PDFTreemapChart'
import { PDFBoxplotChart } from './components/PDFBoxplotChart'
import type { WidgetBlock } from '@/ai/widgets/types'

// Import shared font configuration
import {
  registerPdfFonts,
  segmentTextByFont,
  normalizeForPdf as normalizePdf,
  containsMathSymbols,
  PDF_FONTS,
  PDF_FONT_SIZES,
} from './fontConfig'

// Register all fonts for PDF rendering
registerPdfFonts()

// PDF Styles - Clean modern sans-serif design system
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    paddingLeft: 48,
    paddingRight: 48,
    paddingTop: 56,
    paddingBottom: 48,
    fontFamily: PDF_FONTS.PRIMARY,
    fontSize: PDF_FONT_SIZES.BODY,
  },
  logoMarkContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 28,
    height: 28,
    overflow: 'visible',
  },
  logoMark: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  header: {
    marginBottom: 28,
    paddingBottom: 20,
    borderBottom: '2 solid #111827',
  },
  organizationName: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 500,
  },
  title: {
    fontSize: PDF_FONT_SIZES.TITLE,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 12,
    letterSpacing: -0.8,
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: PDF_FONT_SIZES.SMALL,
    color: '#6b7280',
    fontFamily: PDF_FONTS.MONO,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: PDF_FONT_SIZES.SMALL,
    fontFamily: PDF_FONTS.MONO,
    color: '#9ca3af',
    paddingTop: 12,
    borderTop: '0.5 solid #e5e7eb',
  },
  // Markdown styles - Clean sans-serif heading hierarchy
  h1: {
    fontSize: PDF_FONT_SIZES.H1,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 700,
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: PDF_FONT_SIZES.H2,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '0.5 solid #e5e7eb',
  },
  h3: {
    fontSize: PDF_FONT_SIZES.H3,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
  },
  h4: {
    fontSize: 11,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#4b5563',
    marginTop: 12,
    marginBottom: 4,
  },
  h5: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#6b7280',
    marginTop: 10,
    marginBottom: 4,
  },
  h6: {
    fontSize: PDF_FONT_SIZES.SMALL,
    fontFamily: PDF_FONTS.MONO,
    fontWeight: 500,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 3,
  },
  // Body text styles - clean sans-serif
  paragraph: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#374151',
    lineHeight: 1.6,
    marginBottom: 8,
  },
  // Text formatting styles - Bold (B), Italic (I), Underline (U)
  bold: {
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 'bold' as const,
    color: '#111827',
  },
  italic: {
    fontFamily: PDF_FONTS.PRIMARY,
    fontStyle: 'italic' as const,
    color: '#111827',
  },
  boldItalic: {
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 'bold' as const,
    fontStyle: 'italic' as const,
    color: '#111827',
  },
  underline: {
    fontFamily: PDF_FONTS.PRIMARY,
    textDecoration: 'underline',
    color: '#111827',
  },
  boldUnderline: {
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 'bold' as const,
    textDecoration: 'underline',
    color: '#111827',
  },
  code: {
    fontFamily: PDF_FONTS.MONO,
    color: '#111827',
    fontSize: 9,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  strikethrough: {
    fontFamily: PDF_FONTS.PRIMARY,
    textDecoration: 'line-through',
    color: '#6b7280',
  },
  link: {
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#2563eb',
    textDecoration: 'underline',
  },
  linkUrl: {
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#6b7280',
    fontSize: PDF_FONT_SIZES.SMALL,
  },
  codeBlock: {
    backgroundColor: '#18181b',
    borderRadius: 6,
    padding: 14,
    marginVertical: 10,
  },
  codeBlockText: {
    fontFamily: PDF_FONTS.MONO,
    fontSize: 8,
    color: '#e4e4e7',
    lineHeight: 1.6,
  },
  codeBlockLanguage: {
    fontFamily: PDF_FONTS.MONO,
    fontSize: 7,
    color: '#71717a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // List styles - clean and modern
  listContainer: {
    marginBottom: 12,
    marginTop: 8,
  },
  listItemWrapper: {
    marginBottom: 6,
    paddingLeft: 4,
  },
  listItemText: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#374151',
    lineHeight: 1.6,
  },
  listBulletInline: {
    fontFamily: PDF_FONTS.PRIMARY,
    fontWeight: 500,
    color: '#111827',
    marginRight: 8,
  },
  listNumberInline: {
    fontFamily: PDF_FONTS.MONO,
    fontWeight: 500,
    color: '#111827',
    marginRight: 6,
  },
  // Blockquote styles
  blockquote: {
    borderLeft: '2 solid #d1d5db',
    paddingLeft: 10,
    marginVertical: 6,
  },
  blockquoteText: {
    fontSize: PDF_FONT_SIZES.BODY,
    fontFamily: PDF_FONTS.PRIMARY,
    fontStyle: 'italic' as const,
    color: '#111827',
    lineHeight: 1.6,
  },
  hr: {
    marginVertical: 8,
    borderBottom: '1 solid #e5e7eb',
    width: '100%',
  },
  // Table styles - clean modern look
  tableContainer: {
    marginVertical: 14,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    border: '0.5 solid #e5e7eb',
  },
  tableTitleHeader: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableTitle: {
    fontSize: 10,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    alignItems: 'stretch',
    paddingVertical: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #f3f4f6',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #f3f4f6',
    backgroundColor: '#fafafa',
    alignItems: 'stretch',
    paddingVertical: 6,
  },
  tableRowLast: {
    borderBottom: 'none',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: PDF_FONTS.HEADING,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tableCell: {
    fontSize: 9,
    fontFamily: PDF_FONTS.PRIMARY,
    color: '#374151',
    lineHeight: 1.4,
  },
  tableCellFirst: {
    fontWeight: 500,
    color: '#111827',
  },
  // Numeric cells use mono font
  tableCellNumeric: {
    fontSize: 9,
    fontFamily: PDF_FONTS.MONO,
    color: '#374151',
    lineHeight: 1.4,
  },
})

// Use the imported normalizeForPdf as normalizeText for local usage
const normalizeForPdf = normalizePdf

// Extract title from markdown content (first H1 heading)
function extractTitleFromContent(content: string): string | null {
  if (!content) return null
  // Match first H1 heading: # Title
  const h1Match = content.match(/^#\s+(.+?)(?:\n|$)/m)
  if (h1Match && h1Match[1]) {
    // Remove any markdown formatting from the title
    return h1Match[1].replace(/\*+|_+|`+/g, '').trim()
  }
  return null
}

// Parse inline markdown (bold, italic, code, strikethrough, links, footnotes)
interface InlineSegment {
  text: string
  type:
    | 'normal'
    | 'bold'
    | 'italic'
    | 'bold_italic'
    | 'code'
    | 'strikethrough'
    | 'link'
    | 'footnote_ref'
  url?: string // For links
  footnoteId?: string // For footnote references
}

function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) return [{ text: '', type: 'normal' }]

  const normalizedText = normalizeForPdf(text)
  const segments: InlineSegment[] = []
  let currentIndex = 0

  // Extended regex to include strikethrough, links, and footnote references [^1]
  const regex =
    /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|~~[^~\n]+~~|\[[^\]]+\]\([^)]+\)|\[\^\d+\])/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalizedText)) !== null) {
    if (match.index > currentIndex) {
      segments.push({
        text: normalizedText.substring(currentIndex, match.index),
        type: 'normal',
      })
    }

    const matchedText = match[0]
    if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
      segments.push({ text: matchedText.slice(3, -3), type: 'bold_italic' })
    } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
      segments.push({ text: matchedText.slice(2, -2), type: 'bold' })
    } else if (matchedText.startsWith('~~') && matchedText.endsWith('~~')) {
      // Strikethrough: ~~text~~
      segments.push({ text: matchedText.slice(2, -2), type: 'strikethrough' })
    } else if (
      (matchedText.startsWith('*') && matchedText.endsWith('*')) ||
      (matchedText.startsWith('_') && matchedText.endsWith('_'))
    ) {
      segments.push({ text: matchedText.slice(1, -1), type: 'italic' })
    } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
      segments.push({ text: matchedText.slice(1, -1), type: 'code' })
    } else if (matchedText.startsWith('[^') && matchedText.endsWith(']')) {
      // Footnote reference: [^1]
      const footnoteId = matchedText.slice(2, -1)
      segments.push({ text: `[${footnoteId}]`, type: 'footnote_ref', footnoteId })
    } else if (matchedText.startsWith('[') && matchedText.includes('](')) {
      // Link: [text](url)
      const linkMatch = matchedText.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        const linkText = linkMatch[1]
        const linkUrl = linkMatch[2]
        segments.push({ text: linkText, type: 'link', url: linkUrl })
      } else {
        segments.push({ text: matchedText, type: 'normal' })
      }
    }

    currentIndex = match.index + matchedText.length
  }

  if (currentIndex < normalizedText.length) {
    segments.push({ text: normalizedText.substring(currentIndex), type: 'normal' })
  }

  if (segments.length === 0) {
    segments.push({ text: normalizedText, type: 'normal' })
  }

  return segments
}

// Helper to create math font style - strips fontStyle/fontWeight since Noto Sans Math
// is only registered as a single regular font
const getMathFontStyle = (baseStyle: any) => {
  const { fontStyle, fontWeight, ...rest } = baseStyle || {}
  return { ...rest, fontFamily: PDF_FONTS.MATH }
}

// Helper component to render text with proper font switching for math symbols
// Uses View-based layout when math symbols are present to avoid character overlap
const TextWithMathSupport: React.FC<{ text: string; style?: any }> = ({ text, style }) => {
  const fontSegments = segmentTextByFont(text)

  if (fontSegments.length === 0) {
    return <Text style={style}>{text}</Text>
  }

  // If no math symbols, return simple text
  if (fontSegments.length === 1 && fontSegments[0].font === 'normal') {
    return <Text style={style}>{text}</Text>
  }

  // Mixed fonts - use View-based layout to avoid character overlap
  // react-pdf doesn't properly calculate text advance width when switching fonts in nested Text
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {fontSegments.map((segment, idx) => (
        <Text key={idx} style={segment.font === 'math' ? getMathFontStyle(style) : style}>
          {segment.text}
        </Text>
      ))}
    </View>
  )
}

// Helper function to render a styled segment with math support for View-based layout
// Returns an array of Text elements that can be placed in a View with flexDirection: 'row'
function renderSegmentWithMathSupport(
  segment: { text: string; type: string; url?: string },
  index: number,
  baseStyle?: any
): React.ReactNode[] {
  const fontSegments = segmentTextByFont(segment.text)

  // Determine style based on segment type
  let segmentStyle: any = baseStyle || {}
  switch (segment.type) {
    case 'bold':
      segmentStyle = { ...segmentStyle, ...styles.bold }
      break
    case 'italic':
      segmentStyle = { ...segmentStyle, ...styles.italic }
      break
    case 'bold_italic':
      segmentStyle = { ...segmentStyle, ...styles.boldItalic }
      break
    case 'code':
      segmentStyle = { ...segmentStyle, ...styles.code }
      break
    case 'strikethrough':
      segmentStyle = { ...segmentStyle, ...styles.strikethrough }
      break
    case 'link':
      segmentStyle = { ...segmentStyle, ...styles.link }
      break
    case 'footnote_ref':
      segmentStyle = { ...segmentStyle, fontSize: 8, color: '#2563eb', verticalAlign: 'super' }
      break
  }

  const textElements = fontSegments.map((fs, fsIdx) => (
    <Text
      key={`${index}-${fsIdx}`}
      style={fs.font === 'math' ? getMathFontStyle(segmentStyle) : segmentStyle}
    >
      {fs.text}
    </Text>
  ))

  // For links, append the URL in parentheses
  if (segment.type === 'link' && segment.url) {
    textElements.push(
      <Text key={`${index}-url`} style={styles.linkUrl}>
        {' '}
        ({segment.url})
      </Text>
    )
  }

  return textElements
}

// Inline markdown text component with math symbol support
// Uses View-based layout when math symbols are present to avoid character overlap
const InlineMarkdownText: React.FC<{ text: string; baseStyle?: any }> = ({ text, baseStyle }) => {
  const segments = parseInlineMarkdown(text)

  // Check if any segment contains math symbols or links (links need View layout for URL)
  const hasMathAnywhere = segments.some((seg) => containsMathSymbols(seg.text))
  const hasLinks = segments.some((seg) => seg.type === 'link')

  // No math symbols or links - use original nested Text approach (works fine)
  if (!hasMathAnywhere && !hasLinks) {
    return (
      <Text style={baseStyle}>
        {segments.map((segment, index) => {
          switch (segment.type) {
            case 'bold':
              return (
                <Text key={index} style={styles.bold}>
                  {segment.text}
                </Text>
              )
            case 'italic':
              return (
                <Text key={index} style={styles.italic}>
                  {segment.text}
                </Text>
              )
            case 'bold_italic':
              return (
                <Text key={index} style={styles.boldItalic}>
                  {segment.text}
                </Text>
              )
            case 'code':
              return (
                <Text key={index} style={styles.code}>
                  {segment.text}
                </Text>
              )
            case 'strikethrough':
              return (
                <Text key={index} style={styles.strikethrough}>
                  {segment.text}
                </Text>
              )
            case 'footnote_ref':
              return (
                <Text key={index} style={{ fontSize: 8, color: '#2563eb' }}>
                  {segment.text}
                </Text>
              )
            default:
              return <Text key={index}>{segment.text}</Text>
          }
        })}
      </Text>
    )
  }

  // Math symbols present - use View-based layout to avoid character overlap
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {segments.flatMap((segment, index) =>
        renderSegmentWithMathSupport(segment, index, baseStyle)
      )}
    </View>
  )
}

// Helper function to parse inline markdown and return elements for embedding in a parent Text
// Note: This is used for non-math text contexts. For text with math, use renderSegmentWithMathSupport
function parseInlineMarkdownToElements(text: string): React.ReactNode[] {
  const segments = parseInlineMarkdown(text)

  const elements: React.ReactNode[] = []
  segments.forEach((segment, index) => {
    switch (segment.type) {
      case 'bold':
        elements.push(
          <Text key={index} style={styles.bold}>
            {segment.text}
          </Text>
        )
        break
      case 'italic':
        elements.push(
          <Text key={index} style={styles.italic}>
            {segment.text}
          </Text>
        )
        break
      case 'bold_italic':
        elements.push(
          <Text key={index} style={styles.boldItalic}>
            {segment.text}
          </Text>
        )
        break
      case 'code':
        elements.push(
          <Text key={index} style={styles.code}>
            {segment.text}
          </Text>
        )
        break
      case 'strikethrough':
        elements.push(
          <Text key={index} style={styles.strikethrough}>
            {segment.text}
          </Text>
        )
        break
      case 'link':
        elements.push(
          <Text key={index} style={styles.link}>
            {segment.text}
          </Text>
        )
        if (segment.url) {
          elements.push(
            <Text key={`${index}-url`} style={styles.linkUrl}>
              {' '}
              ({segment.url})
            </Text>
          )
        }
        break
      case 'footnote_ref':
        elements.push(
          <Text key={index} style={{ fontSize: 8, color: '#2563eb' }}>
            {segment.text}
          </Text>
        )
        break
      default:
        elements.push(<Text key={index}>{segment.text}</Text>)
    }
  })
  return elements
}

// Table data interface
interface TableData {
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'center' | 'right')[]
}

// Parse markdown table
function parseTableLines(lines: string[]): TableData | null {
  if (lines.length < 2) return null

  const splitRow = (line: string): string[] => {
    const parts = line.split('|').slice(1)
    if (line.trimEnd().endsWith('|') && parts[parts.length - 1]?.trim() === '') {
      return parts.slice(0, -1).map((c) => c.trim())
    }
    return parts.map((c) => c.trim())
  }

  const headers = splitRow(lines[0])
  const separatorLine = lines[1]
  const isSeparator = /^\|[\s:|-]+/.test(separatorLine) && separatorLine.includes('-')

  if (!isSeparator) return null

  const separatorCells = splitRow(separatorLine)
  const alignments: ('left' | 'center' | 'right')[] = separatorCells.map((sep) => {
    const trimmed = sep.trim()
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
    if (trimmed.endsWith(':')) return 'right'
    return 'left'
  })

  const rows = lines.slice(2).map((line) => splitRow(line))

  return { headers, rows, alignments }
}

/**
 * Converts markdown TableData to PDFTableVisualization props format.
 * This allows reusing the well-tested table visualization component for markdown tables.
 */
function convertMarkdownTableToVisualization(tableData: TableData): {
  columns: { key: string; label: string; align?: 'left' | 'center' | 'right'; width?: string }[]
  data: Record<string, any>[]
} {
  // Handle empty tables
  if (!tableData.headers.length || !tableData.rows.length) {
    return { columns: [], data: [] }
  }

  const numCols = tableData.headers.length

  // Calculate max content length for each column (for width distribution)
  const maxLengths = tableData.headers.map((header, idx) => {
    let maxLen = header.replace(/\*+/g, '').length
    for (const row of tableData.rows) {
      if (row[idx]) {
        const cellLen = row[idx].replace(/\*+/g, '').length
        maxLen = Math.max(maxLen, cellLen)
      }
    }
    return Math.max(maxLen, 3) // Minimum 3 chars
  })

  // Calculate total length and convert to percentages
  const totalLength = maxLengths.reduce((sum, len) => sum + len, 0)
  const columnWidths = maxLengths.map((len, idx) => {
    const ratio = len / totalLength
    // First column gets more space for readability
    if (idx === 0 && numCols > 2) {
      const minFirstCol = numCols > 8 ? 0.3 : 0.25
      return `${Math.round(Math.max(minFirstCol, Math.min(0.45, ratio)) * 100)}%`
    }
    // Clamp other columns between 8% and 40%
    return `${Math.round(Math.max(0.08, Math.min(0.4, ratio)) * 100)}%`
  })

  // Convert headers to column definitions with calculated widths
  const columns = tableData.headers.map((header, idx) => ({
    key: `col_${idx}`,
    label: normalizeForPdf(header.replace(/\*+/g, '')),
    align: tableData.alignments?.[idx] || ('left' as const),
    width: columnWidths[idx],
  }))

  // Convert rows to array of objects
  const data = tableData.rows.map((row) => {
    const rowObj: Record<string, any> = {}
    row.forEach((cell, idx) => {
      rowObj[`col_${idx}`] = normalizeForPdf(cell.replace(/\*+/g, ''))
    })
    return rowObj
  })

  return { columns, data }
}

// Markdown table component - reuses PDFTableVisualization for consistent styling
const MarkdownTable: React.FC<{ data: TableData; title?: string }> = ({ data, title }) => {
  const { columns, data: tableData } = convertMarkdownTableToVisualization(data)

  // Handle empty tables
  if (!columns.length || !tableData.length) {
    return null
  }

  return <PDFTableVisualization title={title} columns={columns} data={tableData} />
}

// Fallback component for unsupported chart types
const UnsupportedChartFallback: React.FC<{
  component: ParsedComponent
  currency?: string
}> = ({ component }) => {
  // Convert component data to table format
  const tableData: TableData = {
    headers: [],
    rows: [],
    alignments: [],
  }

  // Cast component to any for flexible property access
  const comp = component as any

  // Check for labels + series format (line chart, area chart)
  if (
    'labels' in comp &&
    Array.isArray(comp.labels) &&
    comp.labels.length > 0 &&
    'series' in comp &&
    Array.isArray(comp.series) &&
    comp.series.length > 0
  ) {
    // Multi-series data with labels
    tableData.headers = ['Date/Label', ...comp.series.map((s: any) => s.name || 'Value')]
    tableData.alignments = ['left', ...comp.series.map(() => 'right' as const)]
    tableData.rows = comp.labels.map((label: string, idx: number) => [
      label,
      ...comp.series.map((s: any) => {
        const val = Array.isArray(s.data) ? s.data[idx] : null
        if (val === null || val === undefined) return ''
        // Format large numbers with commas
        return typeof val === 'number' ? new Intl.NumberFormat('en-US').format(val) : String(val)
      }),
    ])
  } else if ('data' in comp && Array.isArray(comp.data) && comp.data.length > 0) {
    // Simple data array
    tableData.headers = ['Label', 'Value']
    tableData.alignments = ['left', 'right']
    tableData.rows = comp.data.map((item: any) => [
      item.label || item.name || '',
      String(item.value || ''),
    ])
  } else if ('series' in comp && Array.isArray(comp.series) && comp.series.length > 0) {
    // Series without labels - use index as label
    const firstSeries = comp.series[0]
    const dataLength = Array.isArray(firstSeries?.data) ? firstSeries.data.length : 0
    if (dataLength > 0) {
      tableData.headers = ['Index', ...comp.series.map((s: any) => s.name || 'Value')]
      tableData.alignments = ['left', ...comp.series.map(() => 'right' as const)]
      tableData.rows = Array.from({ length: dataLength }, (_, idx) => [
        String(idx + 1),
        ...comp.series.map((s: any) => {
          const val = Array.isArray(s.data) ? s.data[idx] : null
          if (val === null || val === undefined) return ''
          return typeof val === 'number' ? new Intl.NumberFormat('en-US').format(val) : String(val)
        }),
      ])
    }
  } else if ('sankeyData' in comp && comp.sankeyData) {
    // Sankey diagram data - show links as table
    const sankeyData = comp.sankeyData as { nodes: any[]; links: any[] }
    if (sankeyData.links && sankeyData.links.length > 0) {
      tableData.headers = ['Source', 'Target', 'Value']
      tableData.alignments = ['left', 'left', 'right']
      tableData.rows = sankeyData.links.map((link: any) => [
        link.source || '',
        link.target || '',
        String(link.value || ''),
      ])
    }
  }

  // If still no data, show a message
  const hasTableData = tableData.headers.length > 0 && tableData.rows.length > 0

  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ marginBottom: 4, padding: 8, backgroundColor: '#fef3c7', borderRadius: 4 }}>
        <Text
          style={{
            fontSize: PDF_FONT_SIZES.SMALL,
            color: '#92400e',
            fontFamily: PDF_FONTS.PRIMARY,
          }}
        >
          ⚠ {component.type} visualization -{' '}
          {hasTableData ? 'Displayed as table' : 'No data available'}
        </Text>
      </View>
      {'title' in comp && comp.title && (
        <Text
          style={{
            fontSize: PDF_FONT_SIZES.MEDIUM,
            fontWeight: 'bold' as const,
            marginBottom: 4,
            fontFamily: PDF_FONTS.PRIMARY,
          }}
        >
          {comp.title}
        </Text>
      )}
      {hasTableData && <MarkdownTable data={tableData} />}
    </View>
  )
}

// Block types
type BlockType =
  | 'paragraph'
  | 'header1'
  | 'header2'
  | 'header3'
  | 'header4'
  | 'header5'
  | 'header6'
  | 'unordered_list'
  | 'ordered_list'
  | 'task_list'
  | 'blockquote'
  | 'table'
  | 'horizontal_rule'
  | 'code_block'
  | 'footnote_ref'
  | 'footnote_def'

interface BlockElement {
  type: BlockType
  content: string | string[] | TableData
  numbers?: number[]
  level?: number
  language?: string // For code blocks
  checked?: boolean[] // For task lists
  footnoteId?: string // For footnotes
  nestedLevel?: number // For nested blockquotes
}

// Parse markdown content into blocks
function parseMarkdownBlocks(text: string): BlockElement[] {
  if (!text) return []

  const lines = text.split('\n')
  const blocks: BlockElement[] = []
  let currentListItems: string[] = []
  let currentListNumbers: number[] = []
  let currentListLevel: number = 0
  let currentListType: 'unordered_list' | 'ordered_list' | null = null
  let currentBlockquoteLines: string[] = []
  let currentTableLines: string[] = []
  let currentCodeBlockLines: string[] = []
  let currentCodeBlockLanguage: string = ''
  let inCodeBlock: boolean = false

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      blocks.push({
        type: currentListType,
        content: [...currentListItems],
        numbers: currentListType === 'ordered_list' ? [...currentListNumbers] : undefined,
        level: currentListLevel,
      })
      currentListItems = []
      currentListNumbers = []
      currentListType = null
      currentListLevel = 0
    }
  }

  const flushBlockquote = () => {
    if (currentBlockquoteLines.length > 0) {
      blocks.push({ type: 'blockquote', content: currentBlockquoteLines.join('\n') })
      currentBlockquoteLines = []
    }
  }

  const flushTable = () => {
    if (currentTableLines.length >= 2) {
      const tableData = parseTableLines(currentTableLines)
      if (tableData) {
        blocks.push({ type: 'table', content: tableData })
      }
    }
    currentTableLines = []
  }

  const flushCodeBlock = () => {
    if (currentCodeBlockLines.length > 0) {
      blocks.push({
        type: 'code_block',
        content: currentCodeBlockLines.join('\n'),
        language: currentCodeBlockLanguage || undefined,
      })
    }
    currentCodeBlockLines = []
    currentCodeBlockLanguage = ''
    inCodeBlock = false
  }

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Handle fenced code blocks (``` or ~~~)
    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      if (inCodeBlock) {
        // End of code block
        flushCodeBlock()
      } else {
        // Start of code block
        flushList()
        flushBlockquote()
        flushTable()
        inCodeBlock = true
        // Extract language if specified (e.g., ```javascript)
        const fence = trimmedLine.startsWith('```') ? '```' : '~~~'
        currentCodeBlockLanguage = trimmedLine.slice(fence.length).trim()
      }
      continue
    }

    // If we're inside a code block, collect the line as-is
    if (inCodeBlock) {
      currentCodeBlockLines.push(line)
      continue
    }

    if (!trimmedLine) {
      flushList()
      flushBlockquote()
      flushTable()
      continue
    }

    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushList()
      flushBlockquote()
      flushTable()
      blocks.push({ type: 'horizontal_rule', content: '' })
      continue
    }

    if (trimmedLine.startsWith('|')) {
      flushList()
      flushBlockquote()
      currentTableLines.push(trimmedLine)
      continue
    } else if (currentTableLines.length > 0) {
      flushTable()
    }

    // Headers - check from h6 to h1 (most specific first)
    if (trimmedLine.startsWith('###### ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header6', content: trimmedLine.slice(7) })
      continue
    }
    if (trimmedLine.startsWith('##### ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header5', content: trimmedLine.slice(6) })
      continue
    }
    if (trimmedLine.startsWith('#### ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header4', content: trimmedLine.slice(5) })
      continue
    }
    if (trimmedLine.startsWith('### ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header3', content: trimmedLine.slice(4) })
      continue
    }
    if (trimmedLine.startsWith('## ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header2', content: trimmedLine.slice(3) })
      continue
    }
    if (trimmedLine.startsWith('# ')) {
      flushList()
      flushBlockquote()
      blocks.push({ type: 'header1', content: trimmedLine.slice(2) })
      continue
    }

    // Nested blockquotes - count the depth (>, >>, >>>)
    const blockquoteMatch = trimmedLine.match(/^(>+)\s*(.*)$/)
    if (blockquoteMatch) {
      flushList()
      const depth = blockquoteMatch[1].length
      const content = blockquoteMatch[2]
      blocks.push({ type: 'blockquote', content, nestedLevel: depth })
      continue
    } else if (currentBlockquoteLines.length > 0) {
      flushBlockquote()
    }

    // Task list items: - [x] or - [ ]
    const taskMatch = trimmedLine.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      flushList()
      const isChecked = taskMatch[1].toLowerCase() === 'x'
      const taskContent = taskMatch[2]
      blocks.push({
        type: 'task_list',
        content: [taskContent],
        checked: [isChecked],
      })
      continue
    }

    if (/^[-*+]\s/.test(trimmedLine)) {
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0
      const indentLevel = Math.floor(leadingSpaces / 2)

      if (
        currentListType === 'ordered_list' ||
        (currentListType === 'unordered_list' && currentListLevel !== indentLevel)
      ) {
        flushList()
      }
      currentListType = 'unordered_list'
      currentListLevel = indentLevel
      currentListItems.push(trimmedLine.slice(2))
      continue
    }

    if (/^\d+\.\s/.test(trimmedLine)) {
      const match = trimmedLine.match(/^(\d+)\.\s/)
      const num = match ? parseInt(match[1], 10) : 1
      if (currentListType === 'unordered_list') {
        flushList()
      }
      currentListType = 'ordered_list'
      currentListItems.push(trimmedLine.replace(/^\d+\.\s/, ''))
      currentListNumbers.push(num)
      continue
    }

    // Footnote definition: [^1]: text
    const footnoteDefMatch = trimmedLine.match(/^\[\^(\d+)\]:\s*(.*)$/)
    if (footnoteDefMatch) {
      flushList()
      flushBlockquote()
      blocks.push({
        type: 'footnote_def',
        content: footnoteDefMatch[2],
        footnoteId: footnoteDefMatch[1],
      })
      continue
    }

    flushList()
    flushBlockquote()
    blocks.push({ type: 'paragraph', content: trimmedLine })
  }

  flushList()
  flushBlockquote()
  flushTable()
  // Flush any unclosed code block
  if (inCodeBlock) {
    flushCodeBlock()
  }

  return blocks
}

// Markdown block component
const MarkdownBlock: React.FC<{ block: BlockElement }> = ({ block }) => {
  switch (block.type) {
    case 'header1':
      return (
        <View style={styles.h1}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: PDF_FONT_SIZES.H1,
              fontFamily: PDF_FONTS.HEADING,
              fontWeight: 700,
              color: '#111827',
              letterSpacing: -0.5,
            }}
          />
        </View>
      )
    case 'header2':
      return (
        <View style={styles.h2}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: PDF_FONT_SIZES.H2,
              fontFamily: PDF_FONTS.HEADING,
              fontWeight: 600,
              color: '#111827',
            }}
          />
        </View>
      )
    case 'header3':
      return (
        <View style={styles.h3}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: PDF_FONT_SIZES.H3,
              fontFamily: PDF_FONTS.HEADING,
              fontWeight: 600,
              color: '#374151',
            }}
          />
        </View>
      )
    case 'header4':
      return (
        <View style={styles.h4}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: 11,
              fontFamily: PDF_FONTS.HEADING,
              fontWeight: 600,
              color: '#4b5563',
            }}
          />
        </View>
      )
    case 'header5':
      return (
        <View style={styles.h5}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: PDF_FONT_SIZES.BODY,
              fontFamily: PDF_FONTS.HEADING,
              fontWeight: 600,
              color: '#6b7280',
            }}
          />
        </View>
      )
    case 'header6':
      return (
        <View style={styles.h6}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: PDF_FONT_SIZES.SMALL,
              fontFamily: PDF_FONTS.MONO,
              fontWeight: 500,
              color: '#9ca3af',
              textTransform: 'uppercase' as const,
              letterSpacing: 1.5,
            }}
          />
        </View>
      )
    case 'blockquote': {
      // Support nested blockquotes with increasing indent
      const nestedLevel = block.nestedLevel || 1
      const leftBorderWidth = Math.min(nestedLevel * 2, 6)
      const paddingLeft = 8 + (nestedLevel - 1) * 8
      return (
        <View style={[styles.blockquote, { borderLeftWidth: leftBorderWidth, paddingLeft }]}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={styles.blockquoteText}
          />
        </View>
      )
    }
    case 'task_list':
      return (
        <View style={styles.listContainer}>
          {Array.isArray(block.content) &&
            block.content.map((item, idx) => {
              const isChecked = block.checked?.[idx] ?? false
              return (
                <View key={idx} style={styles.listItemWrapper}>
                  <Text style={styles.listItemText}>
                    <Text
                      style={{
                        fontFamily: PDF_FONTS.MONO,
                        color: isChecked ? '#059669' : '#9ca3af',
                      }}
                    >
                      {isChecked ? '[x] ' : '[ ] '}
                    </Text>
                    <Text
                      style={isChecked ? { textDecoration: 'line-through', color: '#6b7280' } : {}}
                    >
                      {parseInlineMarkdownToElements(item)}
                    </Text>
                  </Text>
                </View>
              )
            })}
        </View>
      )
    case 'footnote_def':
      return (
        <View style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 8 }}>
          <Text
            style={{
              fontSize: PDF_FONT_SIZES.SMALL,
              color: '#6b7280',
              fontFamily: PDF_FONTS.PRIMARY,
            }}
          >
            [{block.footnoteId}]{' '}
          </Text>
          <Text
            style={{
              fontSize: PDF_FONT_SIZES.SMALL,
              color: '#374151',
              fontFamily: PDF_FONTS.PRIMARY,
              flex: 1,
            }}
          >
            {typeof block.content === 'string' ? block.content : ''}
          </Text>
        </View>
      )
    case 'unordered_list':
      return (
        <View style={[styles.listContainer, { paddingLeft: (block.level || 0) * 20 }]}>
          {Array.isArray(block.content) &&
            block.content.map((item, idx) => {
              const hasMath = containsMathSymbols(item)
              if (hasMath) {
                // Use View-based layout to avoid character overlap with math symbols
                const segments = parseInlineMarkdown(item)
                return (
                  <View key={idx} style={styles.listItemWrapper}>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'baseline',
                      }}
                    >
                      <Text style={styles.listBulletInline}>• </Text>
                      {segments.flatMap((segment, segIdx) =>
                        renderSegmentWithMathSupport(segment, segIdx, styles.listItemText)
                      )}
                    </View>
                  </View>
                )
              }
              return (
                <View key={idx} style={styles.listItemWrapper}>
                  <Text style={styles.listItemText}>
                    <Text style={styles.listBulletInline}>• </Text>
                    {parseInlineMarkdownToElements(item)}
                  </Text>
                </View>
              )
            })}
        </View>
      )
    case 'ordered_list':
      return (
        <View style={styles.listContainer}>
          {Array.isArray(block.content) &&
            block.content.map((item, idx) => {
              const hasMath = containsMathSymbols(item)
              if (hasMath) {
                // Use View-based layout to avoid character overlap with math symbols
                const segments = parseInlineMarkdown(item)
                return (
                  <View key={idx} style={styles.listItemWrapper}>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'baseline',
                      }}
                    >
                      <Text style={styles.listNumberInline}>
                        {block.numbers?.[idx] ?? idx + 1}.{' '}
                      </Text>
                      {segments.flatMap((segment, segIdx) =>
                        renderSegmentWithMathSupport(segment, segIdx, styles.listItemText)
                      )}
                    </View>
                  </View>
                )
              }
              return (
                <View key={idx} style={styles.listItemWrapper}>
                  <Text style={styles.listItemText}>
                    <Text style={styles.listNumberInline}>{block.numbers?.[idx] ?? idx + 1}. </Text>
                    {parseInlineMarkdownToElements(item)}
                  </Text>
                </View>
              )
            })}
        </View>
      )
    case 'table':
      return <MarkdownTable data={block.content as TableData} />
    case 'horizontal_rule':
      return <View style={styles.hr} />
    case 'code_block':
      return (
        <View style={styles.codeBlock}>
          {block.language && <Text style={styles.codeBlockLanguage}>{block.language}</Text>}
          <Text style={styles.codeBlockText}>
            {typeof block.content === 'string' ? block.content : ''}
          </Text>
        </View>
      )
    case 'paragraph':
    default:
      return (
        <InlineMarkdownText
          text={typeof block.content === 'string' ? block.content : ''}
          baseStyle={styles.paragraph}
        />
      )
  }
}

// Render component based on type
const RenderComponent: React.FC<{ component: ParsedComponent; currency?: string }> = ({
  component,
  currency: propCurrency = 'USD',
}) => {
  // Prefer component-level currencyCode (auto-injected by viz tool) over top-level currency prop.
  // This ensures non-USD orgs (e.g. NGN) display correct symbols in PDF exports.
  const currency = (component as any).currencyCode || propCurrency

  switch (component.type) {
    case 'kpi':
      return (
        <PDFKPIDashboard title={component.title} metrics={component.metrics} currency={currency} />
      )

    // Line charts (including area variants)
    case 'chart:line': {
      // Access component properties directly (matching UI approach)
      const comp = component as any
      const { title, series, labels, data } = comp

      // Check for multi-series format (series[] + labels[]) - same as UI
      const isMultiSeries = Boolean(series?.length && labels?.length)

      if (isMultiSeries) {
        // Transform series data for PDFLineChart - same pattern as UI
        const lineChartData = labels.map((label: string, idx: number) => {
          const point: any = { x: label }
          series.forEach((s: any) => {
            const key = s.name.toLowerCase().replace(/\s+/g, '')
            point[key] = s.data?.[idx] ?? 0
          })
          return point
        })
        const lineSeries = series.map((s: any) => ({
          key: s.name.toLowerCase().replace(/\s+/g, ''),
          name: s.name,
        }))
        return (
          <PDFLineChart
            data={lineChartData}
            title={title}
            currency={currency}
            xAxisKey="x"
            yAxisFormat={comp.format || 'currency'}
            series={lineSeries}
            chartType="line"
          />
        )
      }

      // Handle format: labels[] + data[] where data has {label, series, value}
      // This is used when labels are separate from data values (e.g., months as labels, single series values)
      if (Array.isArray(labels) && labels.length > 0 && Array.isArray(data) && data.length > 0) {
        // Group data by series name to detect if we have multiple series
        const seriesGroups = new Map<string, any[]>()
        data.forEach((d: any) => {
          const seriesName = d.series || 'Value'
          if (!seriesGroups.has(seriesName)) {
            seriesGroups.set(seriesName, [])
          }
          seriesGroups.get(seriesName)!.push(d)
        })

        // Build chart data using labels as x-axis
        const lineChartData = labels.map((label: string, idx: number) => {
          const point: any = { x: label }
          seriesGroups.forEach((seriesData, seriesName) => {
            const key = seriesName.toLowerCase().replace(/\s+/g, '')
            // Get value at this index for this series
            const val = seriesData[idx]?.value
            point[key] = typeof val === 'number' && Number.isFinite(val) ? val : 0
          })
          return point
        })

        const lineSeries = Array.from(seriesGroups.keys()).map((name) => ({
          key: name.toLowerCase().replace(/\s+/g, ''),
          name,
        }))

        return (
          <PDFLineChart
            data={lineChartData}
            title={title}
            currency={currency}
            xAxisKey="x"
            yAxisFormat={comp.format || 'currency'}
            series={lineSeries}
            chartType="line"
          />
        )
      }

      // Single-series mode: data[] array with label/value (no separate labels array)
      if (Array.isArray(data) && data.length > 0) {
        const simpleLineData = data.map((d: any) => ({
          x: d.label || '',
          value: typeof d.value === 'number' && Number.isFinite(d.value) ? d.value : 0,
        }))
        return (
          <PDFLineChart
            data={simpleLineData}
            title={title}
            currency={currency}
            xAxisKey="x"
            yAxisFormat={comp.format || 'number'}
            series={[{ key: 'value', name: 'Value' }]}
            chartType="line"
          />
        )
      }

      // Fallback if no data available
      return <UnsupportedChartFallback component={component} currency={currency} />
    }

    case 'chart:area': {
      // Area chart uses PDFLineChart with area style
      if (!component.labels?.length) {
        return <UnsupportedChartFallback component={component} currency={currency} />
      }

      // Check if we have series or simple data
      if (component.series?.length) {
        const areaChartData = component.labels.map((label: string, idx: number) => {
          const point: any = { x: label }
          component.series?.forEach((s) => {
            point[s.name.toLowerCase().replace(/\s+/g, '')] = s.data[idx] ?? 0
          })
          return point
        })
        const areaSeries = component.series.map((s) => ({
          key: s.name.toLowerCase().replace(/\s+/g, ''),
          name: s.name,
        }))
        return (
          <PDFLineChart
            data={areaChartData}
            title={component.title}
            currency={currency}
            xAxisKey="x"
            yAxisFormat={component.format}
            series={areaSeries}
            chartType="area"
          />
        )
      } else if (component.data?.length) {
        // Simple data array - transform to series format
        const simpleData = component.labels.map((label: string, idx: number) => ({
          x: label,
          value: component.data?.[idx]?.value ?? 0,
        }))
        return (
          <PDFLineChart
            data={simpleData}
            title={component.title}
            currency={currency}
            xAxisKey="x"
            yAxisFormat={component.format}
            series={[{ key: 'value', name: 'Value' }]}
            chartType="area"
          />
        )
      }
      return <UnsupportedChartFallback component={component} currency={currency} />
    }

    // Donut and Pie charts
    case 'chart:donut':
      return (
        <PDFDonutChart
          data={component.data}
          title={component.title}
          currency={currency}
          format={component.format}
        />
      )

    // Unified bar chart (handles vertical, horizontal, stacked, diverging)
    case 'chart:bar': {
      const barData = component.data || []
      const isHorizontal = component.orientation === 'horizontal'

      // Check if data has grouped format with series field (e.g., Revenue vs Outflows)
      // This format has multiple items per label, differentiated by series
      const hasSeriesGroups = barData.some((d: any) => d.series)

      if (hasSeriesGroups && barData.length > 0) {
        // Group by series and aggregate or display as separate bars
        // For PDF, we'll show each series-label combination as a separate bar
        const transformedData = barData
          .filter((d: any) => d && typeof d.value === 'number' && Number.isFinite(d.value))
          .map((d: any) => ({
            label: `${d.label || ''} (${d.series || 'Value'})`,
            value: d.value,
          }))

        return (
          <PDFBarChart
            data={transformedData}
            title={component.title}
            currency={currency}
            format={component.format}
            horizontal={isHorizontal}
          />
        )
      }

      return (
        <PDFBarChart
          data={barData}
          title={component.title}
          currency={currency}
          format={component.format}
          horizontal={isHorizontal}
        />
      )
    }

    // Waterfall chart
    case 'chart:waterfall':
      return (
        <PDFWaterfallChart
          data={component.data}
          title={component.title}
          currency={currency}
          format={component.format}
        />
      )

    // Scatter chart
    case 'chart:scatter': {
      // Transform from parser format {label, value} to PDFScatterChart format {x, y}
      const series = [
        {
          name: component.title || 'Data',
          data: component.data.map((d, i) => ({
            x: i, // Use index as x-coordinate
            y: d.value,
            label: d.label,
          })),
        },
      ]
      return (
        <PDFScatterChart
          series={series}
          title={component.title}
          xAxisLabel="Index"
          yAxisLabel="Value"
          yAxisFormat={component.format}
          currency={currency}
        />
      )
    }

    // Radar chart
    case 'chart:radar':
      if ('data' in component && Array.isArray(component.data)) {
        return (
          <PDFRadarChart
            data={component.data}
            title={component.title}
            series={component.series}
            maxValue={component.maxValue}
          />
        )
      }
      return null

    // Metric card (single KPI)
    case 'metric': {
      const metricComponent = component as ParsedMetricComponent
      const metrics = [
        {
          label: metricComponent.label || 'Value',
          value: typeof metricComponent.value === 'number' ? metricComponent.value : 0,
          format: (metricComponent.format || 'number') as 'currency' | 'number' | 'percentage',
          trend: metricComponent.trend,
        },
      ]
      return <PDFMetricCard title={metricComponent.label} metrics={metrics} currency={currency} />
    }

    // Progress bars
    case 'progress':
      if ('items' in component && Array.isArray(component.items)) {
        const progressItems = component.items.map((item: any) => ({
          label: item.label,
          value: item.value,
          max: item.max || 100,
          target: item.target,
          format: item.format as 'currency' | 'number' | 'percentage' | undefined,
        }))
        return <PDFProgressBars title={component.title} items={progressItems} currency={currency} />
      }
      return null

    // Comparison view
    case 'comparison':
      // PDFComparison expects items with currentValue/previousValue structure
      if ('items' in component && Array.isArray(component.items)) {
        const comparisonItems = component.items.map((item: any) => ({
          label: item.label,
          currentValue: item.currentValue ?? item.current ?? 0,
          previousValue: item.previousValue ?? item.previous ?? 0,
          format: (item.format || 'number') as 'currency' | 'number' | 'percentage',
          isIncreaseGood: item.isIncreaseGood,
          insight: item.insight,
        }))
        return <PDFComparison title={component.title} items={comparisonItems} currency={currency} />
      }
      // Handle periods-based structure (supports 2+ periods)
      if (
        'periods' in component &&
        Array.isArray(component.periods) &&
        component.periods.length >= 2
      ) {
        // Pass periods directly to PDFComparison for multi-period support
        const periods = component.periods.map((p: any) => ({
          label: p.label || '',
          value: typeof p.value === 'number' ? p.value : 0,
          format: (p.format || component.format || 'number') as
            | 'currency'
            | 'number'
            | 'percentage',
        }))
        return (
          <PDFComparison
            title={component.title}
            periods={periods}
            showChange={component.showChange ?? true}
            changeLabel={component.changeLabel}
            currency={currency}
          />
        )
      }
      return null

    // Timeline - convert to simple list
    case 'timeline':
      if ('events' in component && Array.isArray(component.events)) {
        return (
          <View style={{ marginVertical: 6 }}>
            {component.title && (
              <Text
                style={{
                  fontSize: PDF_FONT_SIZES.MEDIUM,
                  fontWeight: 'bold' as const,
                  marginBottom: 4,
                  fontFamily: PDF_FONTS.PRIMARY,
                }}
              >
                {component.title}
              </Text>
            )}
            {component.events.map((item: any, idx: number) => (
              <View
                key={idx}
                style={{ marginBottom: 4, paddingLeft: 8, borderLeft: '1 solid #d1d5db' }}
              >
                <Text
                  style={{
                    fontSize: PDF_FONT_SIZES.BODY,
                    fontWeight: 'bold' as const,
                    color: '#1e293b',
                    fontFamily: PDF_FONTS.PRIMARY,
                  }}
                >
                  {item.date || item.label}
                </Text>
                <Text
                  style={{
                    fontSize: PDF_FONT_SIZES.SMALL,
                    color: '#64748b',
                    marginTop: 2,
                    fontFamily: PDF_FONTS.PRIMARY,
                  }}
                >
                  {item.description || item.value}
                </Text>
              </View>
            ))}
          </View>
        )
      }
      return null

    // Sankey diagram
    case 'chart:sankey':
      if ('sankeyData' in component && component.sankeyData) {
        return (
          <PDFSankeyChart
            sankeyData={component.sankeyData}
            title={component.title}
            currency={currency}
            format={component.format}
          />
        )
      }
      return <UnsupportedChartFallback component={component} currency={currency} />

    // Treemap chart - render as hierarchical list
    case 'chart:treemap':
      if ('data' in component && Array.isArray(component.data)) {
        return (
          <PDFTreemapChart
            data={component.data}
            title={component.title}
            currency={currency}
            format={component.format}
          />
        )
      }
      return <UnsupportedChartFallback component={component} currency={currency} />

    // Boxplot chart - render as statistical summary
    case 'chart:boxplot':
      if ('data' in component && Array.isArray(component.data)) {
        return (
          <PDFBoxplotChart
            data={component.data}
            title={component.title}
            currency={currency}
            format={component.format}
          />
        )
      }
      return <UnsupportedChartFallback component={component} currency={currency} />

    default:
      // Show warning banner for unknown/unsupported component types instead of silent drop
      return (
        <View
          style={{ padding: 8, backgroundColor: '#fef3c7', borderRadius: 4, marginVertical: 4 }}
        >
          <Text style={{ fontSize: 10, color: '#92400e', fontFamily: PDF_FONTS.PRIMARY }}>
            [Unsupported component: {component.type}]
          </Text>
        </View>
      )
  }
}

// Renderable element types for flattened content structure
type RenderableElement =
  | { type: 'block'; block: BlockElement }
  | { type: 'viz'; component: ParsedComponent }
  | { type: 'widget'; widget: WidgetBlock }

// Helper to get widget by index
function getWidgetByIndex(widgets: WidgetBlock[], index: number): WidgetBlock | undefined {
  return widgets.find((w) => w.widgetIndex === index)
}

// Content renderer with VIZ and WIDGET placeholders
const ContentWithViz: React.FC<{
  content: string
  components: ParsedComponent[]
  widgets?: WidgetBlock[]
  currency?: string
}> = ({ content, components, widgets = [], currency }) => {
  const segments = splitContentByMarkers(content)

  // Track which viz and widget indices have been rendered to avoid duplicates
  const renderedVizIndices = new Set<number>()
  const renderedWidgetIndices = new Set<number>()

  // Flatten all segments into a single array of renderable elements
  // This allows us to group headings with their following content regardless of segment boundaries
  const elements: RenderableElement[] = []
  for (const segment of segments) {
    if (segment.type === 'viz') {
      const vizIndex = segment.content as number
      const component = getComponentByVizIndex(components, vizIndex)
      if (component) {
        if (renderedVizIndices.has(vizIndex)) {
          // Duplicate marker - render as text reference
          const title =
            'title' in component ? component.title : 'label' in component ? component.label : null
          elements.push({
            type: 'block',
            block: {
              type: 'paragraph',
              content: `${title || 'Chart'} (above)`,
            },
          })
        } else {
          // First occurrence - render visualization
          renderedVizIndices.add(vizIndex)
          elements.push({ type: 'viz', component })
        }
      }
    } else if (segment.type === 'widget') {
      const widgetIndex = segment.content as number
      const widget = getWidgetByIndex(widgets, widgetIndex)
      if (widget && !renderedWidgetIndices.has(widgetIndex)) {
        renderedWidgetIndices.add(widgetIndex)
        elements.push({ type: 'widget', widget })
      }
    } else {
      const blocks = parseMarkdownBlocks(segment.content as string)
      for (const block of blocks) {
        elements.push({ type: 'block', block })
      }
    }
  }

  // Helper to check if an element is a heading
  const isHeadingElement = (el: RenderableElement): boolean =>
    el.type === 'block' && ['header1', 'header2', 'header3'].includes(el.block.type)

  // Group headings with their following content to prevent orphaned headings
  const groupedElements: React.ReactNode[] = []
  let i = 0
  while (i < elements.length) {
    const el = elements[i]

    // If this is a heading and has a next element that's not a heading, group them
    if (isHeadingElement(el) && i + 1 < elements.length) {
      const nextEl = elements[i + 1]

      if (!isHeadingElement(nextEl)) {
        // Group heading with following content - wrap={false} keeps them together (except tables)
        if (nextEl.type === 'viz') {
          // Heading followed by visualization - tables need to wrap across pages
          const isTable = nextEl.component?.type === 'table'
          if (isTable) {
            // For tables: render heading separately, let table flow across pages
            groupedElements.push(
              <MarkdownBlock
                key={`h-${i}`}
                block={(el as { type: 'block'; block: BlockElement }).block}
              />
            )
            groupedElements.push(
              <View key={i} style={{ marginVertical: 6 }}>
                <RenderComponent component={nextEl.component} currency={currency} />
              </View>
            )
          } else {
            // For other viz types: keep heading and viz together
            groupedElements.push(
              <View key={i} wrap={false}>
                <MarkdownBlock block={(el as { type: 'block'; block: BlockElement }).block} />
                <View style={{ marginVertical: 6 }}>
                  <RenderComponent component={nextEl.component} currency={currency} />
                </View>
              </View>
            )
          }
        } else if (nextEl.type === 'widget') {
          // Heading followed by widget
          groupedElements.push(
            <View key={i} wrap={false}>
              <MarkdownBlock block={(el as { type: 'block'; block: BlockElement }).block} />
              <View style={{ marginVertical: 6 }}>
                <PDFMemoryWidget widget={nextEl.widget} currency={currency} />
              </View>
            </View>
          )
        } else {
          // Heading followed by text block
          groupedElements.push(
            <View key={i} wrap={false}>
              <MarkdownBlock block={(el as { type: 'block'; block: BlockElement }).block} />
              <MarkdownBlock block={nextEl.block} />
            </View>
          )
        }
        i += 2
        continue
      }
    }

    // Standalone element (not grouped)
    if (el.type === 'viz') {
      // Tables need wrap={true} to flow across pages, other viz types use wrap={false}
      const isTable = el.component?.type === 'table'
      groupedElements.push(
        <View key={i} style={{ marginVertical: 6 }} wrap={isTable}>
          <RenderComponent component={el.component} currency={currency} />
        </View>
      )
    } else if (el.type === 'widget') {
      groupedElements.push(
        <View key={i} style={{ marginVertical: 6 }} wrap={false}>
          <PDFMemoryWidget widget={el.widget} currency={currency} />
        </View>
      )
    } else {
      groupedElements.push(<MarkdownBlock key={i} block={el.block} />)
    }
    i++
  }

  return <View>{groupedElements}</View>
}

// Format date
function formatDate(timestamp: number | string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Main PDF Document
const ChatPDFDocument: React.FC<{
  chatResponse: ParsedChatResponse
  widgets?: WidgetBlock[]
  currency?: string
  logoImage: string | null
  logoMarkImage: string | null
  organizationName?: string
}> = ({
  chatResponse,
  widgets = [],
  currency = 'USD',
  logoImage,
  logoMarkImage,
  organizationName,
}) => {
  // Extract title from content, fallback to "Financial Report"
  const reportTitle = extractTitleFromContent(chatResponse.content) || 'Financial Report'

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page} wrap>
        {/* Title Header */}
        <View style={styles.header}>
          {organizationName && <Text style={styles.organizationName}>{organizationName}</Text>}
          <Text style={styles.title}>{reportTitle}</Text>
          <Text style={styles.subtitle}>{formatDate(chatResponse.timestamp)}</Text>
        </View>

        {/* Content with visualizations and widgets */}
        <View style={styles.content}>
          <ContentWithViz
            content={chatResponse.content}
            components={chatResponse.components}
            widgets={widgets}
            currency={currency}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Confidential • {reportTitle}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// Load logo as base64
async function loadLogoAsBase64(): Promise<string | null> {
  try {
    const response = await fetch('/images/hero/logo_type_gold_new.svg')
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error loading logo:', error)
    return null
  }
}

// Load logo mark (icon) as base64 - using PNG for react-pdf compatibility
async function loadLogoMarkAsBase64(): Promise<string | null> {
  try {
    const response = await fetch('/images/hero/logo_gold.png')
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error loading logo mark:', error)
    return null
  }
}

// Main export interface
export interface ChatPdfExportOptions {
  currency?: string
  organizationName?: string
  widgets?: WidgetBlock[]
  onProgress?: (message: string) => void
}

// Main exporter class
export class ChatPdfExporter {
  /**
   * Export a chat response to PDF
   * @param dynamoResponse - The raw DynamoDB response or already parsed response
   * @param options - Export options
   */
  static async export(dynamoResponse: any, options: ChatPdfExportOptions = {}): Promise<void> {
    const { currency = 'USD', organizationName, widgets = [], onProgress } = options

    try {
      onProgress?.('Parsing chat response...')

      // Parse the DynamoDB response
      const parsedResponse = parseDynamoDBChatResponse(dynamoResponse)

      onProgress?.('Loading resources...')

      // Load logos in parallel
      const [logoImage, logoMarkImage] = await Promise.all([
        loadLogoAsBase64(),
        loadLogoMarkAsBase64(),
      ])

      onProgress?.('Generating PDF document...')

      // Create PDF document
      const pdfDocument = (
        <ChatPDFDocument
          chatResponse={parsedResponse}
          widgets={widgets}
          currency={currency}
          logoImage={logoImage}
          logoMarkImage={logoMarkImage}
          organizationName={organizationName}
        />
      )

      // Generate blob
      const blob = await pdf(pdfDocument).toBlob()

      // Download
      onProgress?.('Downloading...')
      const filename = `Report_${new Date().toISOString().split('T')[0]}.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)

      onProgress?.('Complete!')
    } catch (error) {
      console.error('PDF export error:', error)
      throw new Error('Failed to generate PDF. Please try again.')
    }
  }

  /**
   * Generate PDF blob without downloading (useful for preview or upload)
   */
  static async generateBlob(
    dynamoResponse: any,
    options: Omit<ChatPdfExportOptions, 'onProgress'> = {}
  ): Promise<Blob> {
    const { currency = 'USD', organizationName } = options

    const parsedResponse = parseDynamoDBChatResponse(dynamoResponse)
    const [logoImage, logoMarkImage] = await Promise.all([
      loadLogoAsBase64(),
      loadLogoMarkAsBase64(),
    ])

    const pdfDocument = (
      <ChatPDFDocument
        chatResponse={parsedResponse}
        currency={currency}
        logoImage={logoImage}
        logoMarkImage={logoMarkImage}
        organizationName={organizationName}
      />
    )

    return await pdf(pdfDocument).toBlob()
  }
}

// Hook for easy usage in components
export function useChatPdfExport() {
  const [isExporting, setIsExporting] = React.useState(false)
  const [progress, setProgress] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const exportToPdf = React.useCallback(
    async (dynamoResponse: any, options: ChatPdfExportOptions = {}) => {
      setIsExporting(true)
      setError(null)
      setProgress('Starting export...')

      try {
        await ChatPdfExporter.export(dynamoResponse, {
          ...options,
          onProgress: setProgress,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed')
        throw err
      } finally {
        setIsExporting(false)
        setTimeout(() => setProgress(null), 2000)
      }
    },
    []
  )

  return { exportToPdf, isExporting, progress, error }
}
