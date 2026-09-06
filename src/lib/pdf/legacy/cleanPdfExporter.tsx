// src/lib/pdf/cleanPdfExporter.tsx
'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, pdf, Font } from '@react-pdf/renderer'

// Register Noto Sans for full Unicode support (including ₱ and other currency symbols)
// Using Google's Noto fonts GitHub repo for complete character coverage
Font.register({
  family: 'Noto Sans',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf',
      fontWeight: 700,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-Italic.ttf',
      fontWeight: 400,
      fontStyle: 'italic',
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/hinted/ttf/NotoSans-BoldItalic.ttf',
      fontWeight: 700,
      fontStyle: 'italic',
    },
  ],
})

// Register Noto Serif for serif text (titles)
Font.register({
  family: 'Noto Serif',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSerif/hinted/ttf/NotoSerif-Regular.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSerif/hinted/ttf/NotoSerif-Bold.ttf',
      fontWeight: 700,
    },
  ],
})

// Register Noto Sans Mono for code blocks
Font.register({
  family: 'Noto Sans Mono',
  src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansMono/hinted/ttf/NotoSansMono-Regular.ttf',
})
import { StoredReport } from '@/lib/reportStorage'
import html2canvas from 'html2canvas'
import { parseDynamoDBReport, extractTableFromComponent } from './dynamodbParser'
import { PDFPieChart } from './components/PDFPieChart'
import { PDFLineChart } from './components/PDFLineChart'

// Markdown block types for PDF rendering
type BlockType =
  | 'paragraph'
  | 'header1'
  | 'header2'
  | 'header3'
  | 'unordered_list'
  | 'ordered_list'
  | 'blockquote'
  | 'table'
  | 'horizontal_rule'

interface BlockElement {
  type: BlockType
  content: string | string[] | TableData
  level?: number
  numbers?: number[] // For ordered lists - preserve original numbers from markdown
}

interface TableData {
  headers: string[]
  rows: string[][]
  alignments?: ('left' | 'center' | 'right')[]
}

// Inline segment types for markdown text
type InlineType = 'normal' | 'bold' | 'italic' | 'bold_italic' | 'code'

interface InlineSegment {
  text: string
  type: InlineType
}

// Professional PDF styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 50,
    fontFamily: 'Noto Sans',
  },
  header: {
    marginBottom: 30,
    paddingBottom: 15,
    borderBottom: '3 solid #df1e5a',
  },
  pageHeader: {
    position: 'absolute',
    top: 20,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    width: 60,
    height: 15,
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  headerMetadata: {
    fontSize: 8,
    color: '#9ca3af',
    fontFamily: 'Noto Sans',
    textAlign: 'right',
  },
  organizationName: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    fontFamily: 'Noto Sans',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Noto Serif',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    fontFamily: 'Noto Sans',
  },
  metadata: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'Noto Sans',
  },
  section: {
    marginTop: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Noto Serif',
    color: '#1f2937',
    marginBottom: 12,
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeft: '4 solid #df1e5a',
    backgroundColor: '#f3f4f6',
  },
  paragraph: {
    fontSize: 11,
    fontFamily: 'Noto Sans',
    color: '#374151',
    lineHeight: 1.85,
    marginBottom: 12,
    textAlign: 'justify',
  },
  insight: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingLeft: 6,
    paddingVertical: 4,
  },
  insightBullet: {
    color: '#df1e5a',
    fontSize: 14,
    marginRight: 10,
    marginTop: 0,
    width: 12,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
  },
  insightText: {
    fontSize: 11,
    fontFamily: 'Noto Sans',
    color: '#374151',
    lineHeight: 1.75,
    flex: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 15,
  },
  kpiCard: {
    width: '48%',
    border: '1 solid #d1d5db',
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  kpiLabel: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 20,
    fontFamily: 'Noto Serif',
    color: '#111827',
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 8,
    fontFamily: 'Noto Sans',
    color: '#9ca3af',
    marginBottom: 3,
  },
  kpiTrend: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    fontWeight: 'bold' as const,
    marginTop: 4,
  },
  trendPositive: {
    color: '#059669',
  },
  trendNegative: {
    color: '#df1e5a',
  },
  chartContainer: {
    marginVertical: 15,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  chartTitle: {
    fontSize: 18,
    fontFamily: 'Noto Serif',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  chartImage: {
    width: '90%',
    maxHeight: 400,
    objectFit: 'contain',
    border: '1 solid #e5e7eb',
  },
  legendContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendLabel: {
    fontSize: 11,
    color: '#4b5563',
  },
  tableContainer: {
    marginVertical: 15,
    border: '1 solid #e2e8f0',
  },
  tableTitle: {
    fontSize: 18,
    fontFamily: 'Noto Serif',
    color: '#1f2937',
    marginBottom: 12,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottom: '2 solid #df1e5a',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f', // Deep navy header
    borderBottom: '2 solid #df1e5a',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc', // Alternating row background
  },
  tableSectionRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #3b82f6',
    borderTop: '1 solid #e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f0f9ff', // Light blue for section rows
  },
  tableCell: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    color: '#374151',
    flex: 1,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#ffffff', // White text on dark header
    flex: 1,
    paddingHorizontal: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#9ca3af',
    borderTop: '1 solid #e5e7eb',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#9ca3af',
  },
  pageNumber: {
    fontSize: 9,
    fontFamily: 'Noto Sans',
    color: '#9ca3af',
  },
  boldText: {
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#1e3a5f', // Deep navy blue for bold emphasis
  },
  codeText: {
    fontFamily: 'Noto Sans Mono',
    color: '#6b21a8', // Purple for code
    fontSize: 10,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  // Markdown header styles
  h1Style: {
    fontSize: 22,
    fontFamily: 'Noto Serif',
    fontWeight: 700,
    color: '#0f172a', // Slate 900
    marginTop: 24,
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '2 solid #df1e5a', // Brand accent underline
  },
  h2Style: {
    fontSize: 16,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#1e3a5f', // Deep navy
    marginTop: 20,
    marginBottom: 10,
    paddingLeft: 10,
    paddingVertical: 6,
    borderLeft: '3 solid #3b82f6', // Blue accent bar
    backgroundColor: '#f8fafc', // Very subtle gray background
  },
  h3Style: {
    fontSize: 13,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '1 solid #e5e7eb', // Subtle underline
  },
  // Markdown text styles
  italicText: {
    fontFamily: 'Noto Sans',
    fontStyle: 'italic',
    color: '#4b5563',
  },
  boldItalicText: {
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    fontStyle: 'italic',
    color: '#1e3a5f',
  },
  // Markdown list styles
  listContainer: {
    marginBottom: 12,
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  listBullet: {
    width: 16,
    fontSize: 11,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#df1e5a', // Brand color for bullets
  },
  listNumber: {
    width: 22,
    fontSize: 11,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#3b82f6', // Blue for numbers
  },
  listItemText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Noto Sans',
    color: '#374151',
    lineHeight: 1.7,
  },
  // Markdown blockquote styles
  blockquoteContainer: {
    borderLeft: '4 solid #3b82f6', // Blue accent
    paddingLeft: 14,
    marginVertical: 12,
    marginLeft: 4,
    backgroundColor: '#f0f9ff', // Very light blue background
    paddingVertical: 10,
    paddingRight: 12,
  },
  blockquoteText: {
    fontSize: 11,
    fontFamily: 'Noto Sans',
    fontStyle: 'italic',
    color: '#1e40af', // Darker blue for blockquote text
    lineHeight: 1.7,
  },
  // Markdown table styles
  mdTableContainer: {
    marginVertical: 14,
    border: '1 solid #e2e8f0',
  },
  mdTableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
  },
  mdTableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1 solid #e2e8f0',
    backgroundColor: '#f8fafc', // Alternating row background
  },
  mdTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f', // Deep navy header
    borderBottom: '2 solid #df1e5a',
  },
  mdTableCell: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    color: '#374151',
  },
  mdTableHeaderCell: {
    fontSize: 10,
    fontFamily: 'Noto Sans',
    fontWeight: 700,
    color: '#ffffff', // White text on dark header
  },
})

// Format helpers
function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(timestamp: number | string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTableCell(value: any, format?: string, currency: string = 'USD'): string {
  if (value === null || value === undefined) return '-'

  switch (format) {
    case 'currency':
      return formatCurrency(typeof value === 'number' ? value : parseFloat(value) || 0, currency)
    case 'percentage':
      return `${typeof value === 'number' ? value.toFixed(1) : value}%`
    case 'number':
      return typeof value === 'number' ? formatNumber(value) : value.toString()
    case 'date':
      return formatDate(value)
    case 'badge':
    case 'text':
    default:
      return value.toString()
  }
}

function getBadgeColor(status: string): string {
  const statusLower = status.toLowerCase()
  if (
    statusLower.includes('paid') ||
    statusLower.includes('active') ||
    statusLower.includes('completed')
  )
    return '#059669'
  if (
    statusLower.includes('overdue') ||
    statusLower.includes('failed') ||
    statusLower.includes('cancelled')
  )
    return '#dc2626'
  if (statusLower.includes('pending') || statusLower.includes('draft')) return '#f59e0b'
  return '#3b82f6'
}

// Normalize only problematic characters that Noto fonts don't support
// Currency symbols like ₱ are preserved since Noto Sans includes them
function normalizeForPdf(text: string): string {
  if (!text) return ''

  return (
    text
      // Keycap emoji numbers (1️⃣, 2️⃣, etc.) - convert to plain numbers with period
      .replace(/0️⃣/g, '0.')
      .replace(/1️⃣/g, '1.')
      .replace(/2️⃣/g, '2.')
      .replace(/3️⃣/g, '3.')
      .replace(/4️⃣/g, '4.')
      .replace(/5️⃣/g, '5.')
      .replace(/6️⃣/g, '6.')
      .replace(/7️⃣/g, '7.')
      .replace(/8️⃣/g, '8.')
      .replace(/9️⃣/g, '9.')
      .replace(/🔟/g, '10.')
      // Common emojis that might appear in business documents
      .replace(/✅/g, '[x]')
      .replace(/❌/g, '[ ]')
      .replace(/⚠️/g, '[!]')
      .replace(/📌/g, '*')
      .replace(/📍/g, '*')
      .replace(/🔴/g, '(!)')
      .replace(/🟢/g, '(+)')
      .replace(/🟡/g, '(?)')
      .replace(/💡/g, '*')
      .replace(/📊/g, '')
      .replace(/📈/g, '')
      .replace(/📉/g, '')
      .replace(/💰/g, '')
      .replace(/💵/g, '')
      .replace(/🏦/g, '')
      // Math symbols that may not render correctly
      .replace(/≥/g, '>=')
      .replace(/≤/g, '<=')
      .replace(/≈/g, '~')
      .replace(/≠/g, '!=')
      .replace(/±/g, '+/-')
      // Special dashes that might cause issues
      .replace(/\u2011/g, '-') // non-breaking hyphen
      .replace(/\u2012/g, '-') // figure dash
      .replace(/\u2013/g, '-') // en-dash
      .replace(/\u2014/g, '-') // em-dash
      .replace(/\u2015/g, '-') // horizontal bar
      // Remove variation selectors and zero-width characters that cause rendering issues
      .replace(/[\uFE00-\uFE0F]/g, '') // variation selectors
      .replace(/\u200B/g, '') // zero-width space
      .replace(/\u200C/g, '') // zero-width non-joiner
      .replace(/\u200D/g, '') // zero-width joiner
      .replace(/\uFEFF/g, '') // BOM
  )
}

// Enhanced markdown parsing - supports bold, italic, bold-italic, and code
function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) return [{ text: '', type: 'normal' }]

  // Normalize problematic characters first
  const normalizedText = normalizeForPdf(text)

  const segments: InlineSegment[] = []
  let currentIndex = 0

  // Order matters: ***bold italic*** must come before ** and *
  // Matches: ***bold italic***, **bold**, *italic*, _italic_, `code`
  const regex = /(\*\*\*[^*\n]+\*\*\*|\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalizedText)) !== null) {
    // Add normal text before the match
    if (match.index > currentIndex) {
      segments.push({
        text: normalizedText.substring(currentIndex, match.index),
        type: 'normal',
      })
    }

    // Add the matched segment
    const matchedText = match[0]
    if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
      segments.push({
        text: matchedText.slice(3, -3),
        type: 'bold_italic',
      })
    } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
      segments.push({
        text: matchedText.slice(2, -2),
        type: 'bold',
      })
    } else if (
      (matchedText.startsWith('*') && matchedText.endsWith('*')) ||
      (matchedText.startsWith('_') && matchedText.endsWith('_'))
    ) {
      segments.push({
        text: matchedText.slice(1, -1),
        type: 'italic',
      })
    } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
      segments.push({
        text: matchedText.slice(1, -1),
        type: 'code',
      })
    }

    currentIndex = match.index + matchedText.length
  }

  // Add remaining normal text
  if (currentIndex < normalizedText.length) {
    segments.push({
      text: normalizedText.substring(currentIndex),
      type: 'normal',
    })
  }

  // If no segments were added, return the whole text as normal
  if (segments.length === 0) {
    segments.push({
      text: normalizedText,
      type: 'normal',
    })
  }

  return segments
}

// Parse markdown text into block-level elements
function parseMarkdownBlocks(text: string): BlockElement[] {
  if (!text) return []

  const lines = text.split('\n')
  const blocks: BlockElement[] = []
  let currentListItems: string[] = []
  let currentListNumbers: number[] = [] // Track original numbers for ordered lists
  let currentListLevel: number = 0 // Track indentation level
  let currentListType: 'unordered_list' | 'ordered_list' | null = null
  let currentBlockquoteLines: string[] = []
  let currentTableLines: string[] = []

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
      const tableData = parseTableBlock(currentTableLines)
      if (tableData) {
        blocks.push({ type: 'table', content: tableData })
      }
    }
    currentTableLines = []
  }

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Empty line - flush current blocks
    if (!trimmedLine) {
      flushList()
      flushBlockquote()
      flushTable()
      continue
    }

    // Horizontal rule (---, ***, ___ with at least 3 characters)
    if (/^[-*_]{3,}$/.test(trimmedLine)) {
      flushList()
      flushBlockquote()
      flushTable()
      blocks.push({ type: 'horizontal_rule', content: '' })
      continue
    }

    // Table row (starts with |) - trailing | is optional in markdown
    if (trimmedLine.startsWith('|')) {
      flushList()
      flushBlockquote()
      currentTableLines.push(trimmedLine)
      continue
    } else if (currentTableLines.length > 0) {
      flushTable()
    }

    // Headers
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

    // Blockquote
    if (trimmedLine.startsWith('> ')) {
      flushList()
      currentBlockquoteLines.push(trimmedLine.slice(2))
      continue
    } else if (currentBlockquoteLines.length > 0) {
      flushBlockquote()
    }

    // Unordered list - check for indentation in original line
    if (/^[-*+]\s/.test(trimmedLine)) {
      // Calculate indentation level from original line (each 2-3 spaces = 1 level)
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0
      const indentLevel = Math.floor(leadingSpaces / 2)

      // If switching from ordered list OR if indentation level changed, flush
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

    // Ordered list
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

    // Regular paragraph - flush lists and add
    flushList()
    flushBlockquote()
    blocks.push({ type: 'paragraph', content: trimmedLine })
  }

  // Flush any remaining blocks
  flushList()
  flushBlockquote()
  flushTable()

  return blocks
}

// Helper to split table row cells, handling optional trailing pipe
function splitTableRow(line: string): string[] {
  const parts = line.split('|')
  // Remove leading empty string (before first |)
  const withoutLeading = parts.slice(1)
  // Remove trailing empty string only if the line ended with |
  if (line.trimEnd().endsWith('|') && withoutLeading[withoutLeading.length - 1]?.trim() === '') {
    return withoutLeading.slice(0, -1).map((cell) => cell.trim())
  }
  return withoutLeading.map((cell) => cell.trim())
}

// Parse markdown table lines into structured data
function parseTableBlock(lines: string[]): TableData | null {
  if (lines.length < 2) return null

  // Parse header row
  const headerLine = lines[0]
  const headers = splitTableRow(headerLine)

  // Check for separator row (|----| or |----|----|... pattern)
  const separatorLine = lines[1]
  // More flexible separator check - just needs to start with | and contain dashes
  const isSeparator = /^\|[\s:|-]+/.test(separatorLine) && separatorLine.includes('-')

  if (!isSeparator) return null

  // Parse alignments from separator
  const separatorCells = splitTableRow(separatorLine)
  const alignments: ('left' | 'center' | 'right')[] = separatorCells.map((sep) => {
    const trimmed = sep.trim()
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
    if (trimmed.endsWith(':')) return 'right'
    return 'left'
  })

  // Parse data rows
  const rows = lines.slice(2).map((line) => splitTableRow(line))

  return { headers, rows, alignments }
}

// Component to render inline markdown text (bold, italic, code)
const InlineMarkdownText: React.FC<{
  text: string
  baseStyle?: any
}> = ({ text, baseStyle }) => {
  const segments = parseInlineMarkdown(text)

  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'bold':
            return (
              <Text key={index} style={styles.boldText}>
                {segment.text}
              </Text>
            )
          case 'italic':
            return (
              <Text key={index} style={styles.italicText}>
                {segment.text}
              </Text>
            )
          case 'bold_italic':
            return (
              <Text key={index} style={styles.boldItalicText}>
                {segment.text}
              </Text>
            )
          case 'code':
            return (
              <Text
                key={index}
                style={{
                  fontFamily: 'Noto Sans Mono',
                  color: '#6b21a8',
                  fontSize: 10,
                  backgroundColor: '#f5f3ff',
                }}
              >
                {' '}
                {segment.text}{' '}
              </Text>
            )
          default:
            return <Text key={index}>{segment.text}</Text>
        }
      })}
    </Text>
  )
}

// Component to render a markdown table with inline markdown support
const MarkdownTable: React.FC<{ data: TableData }> = ({ data }) => {
  return (
    <View style={styles.mdTableContainer}>
      {/* Header row */}
      <View style={styles.mdTableHeaderRow}>
        {data.headers.map((header, idx) => (
          <View
            key={idx}
            style={{
              flex: 1,
              padding: 8,
              alignItems:
                data.alignments?.[idx] === 'center'
                  ? 'center'
                  : data.alignments?.[idx] === 'right'
                    ? 'flex-end'
                    : 'flex-start',
            }}
          >
            <InlineMarkdownText text={header} baseStyle={styles.mdTableHeaderCell} />
          </View>
        ))}
      </View>
      {/* Data rows with alternating backgrounds */}
      {data.rows.map((row, rowIdx) => (
        <View key={rowIdx} style={rowIdx % 2 === 1 ? styles.mdTableRowAlt : styles.mdTableRow}>
          {row.map((cell, cellIdx) => (
            <View
              key={cellIdx}
              style={{
                flex: 1,
                padding: 8,
                alignItems:
                  data.alignments?.[cellIdx] === 'center'
                    ? 'center'
                    : data.alignments?.[cellIdx] === 'right'
                      ? 'flex-end'
                      : 'flex-start',
              }}
            >
              <InlineMarkdownText text={cell} baseStyle={styles.mdTableCell} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// Component to render a single markdown block
const MarkdownBlock: React.FC<{ block: BlockElement }> = ({ block }) => {
  switch (block.type) {
    case 'header1':
      return (
        <View
          style={{
            marginTop: 24,
            marginBottom: 14,
            paddingBottom: 8,
            borderBottom: '2 solid #df1e5a',
          }}
        >
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{
              fontSize: 22,
              fontFamily: 'Noto Serif',
              fontWeight: 700,
              color: '#0f172a',
            }}
          />
        </View>
      )
    case 'header2':
      return (
        <View
          style={{
            marginTop: 20,
            marginBottom: 10,
            paddingLeft: 10,
            paddingVertical: 6,
            borderLeft: '3 solid #3b82f6',
            backgroundColor: '#f8fafc',
          }}
        >
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{ fontSize: 16, fontFamily: 'Noto Sans', fontWeight: 700, color: '#1e3a5f' }}
          />
        </View>
      )
    case 'header3':
      return (
        <View
          style={{
            marginTop: 16,
            marginBottom: 8,
            paddingBottom: 4,
            borderBottom: '1 solid #e5e7eb',
          }}
        >
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={{ fontSize: 13, fontFamily: 'Noto Sans', fontWeight: 700, color: '#374151' }}
          />
        </View>
      )
    case 'blockquote':
      return (
        <View style={styles.blockquoteContainer}>
          <InlineMarkdownText
            text={typeof block.content === 'string' ? block.content : ''}
            baseStyle={styles.blockquoteText}
          />
        </View>
      )
    case 'unordered_list': {
      const indentPadding = (block.level || 0) * 20 // 20px per indent level
      return (
        <View style={[styles.listContainer, { paddingLeft: indentPadding }]}>
          {Array.isArray(block.content) &&
            block.content.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listBullet}>•</Text>
                <InlineMarkdownText text={item} baseStyle={styles.listItemText} />
              </View>
            ))}
        </View>
      )
    }
    case 'ordered_list':
      return (
        <View style={styles.listContainer}>
          {Array.isArray(block.content) &&
            block.content.map((item, idx) => (
              <View key={idx} style={styles.listItem}>
                <Text style={styles.listNumber}>{block.numbers?.[idx] ?? idx + 1}.</Text>
                <InlineMarkdownText text={item} baseStyle={styles.listItemText} />
              </View>
            ))}
        </View>
      )
    case 'table':
      return <MarkdownTable data={block.content as TableData} />
    case 'horizontal_rule':
      return (
        <View
          style={{
            marginVertical: 16,
            borderBottom: '1 solid #d1d5db',
            width: '100%',
          }}
        />
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

// Main component to render full markdown content with block-level elements
const MarkdownContent: React.FC<{ text: string }> = ({ text }) => {
  const blocks = parseMarkdownBlocks(text)

  if (blocks.length === 0) {
    return <InlineMarkdownText text={text} baseStyle={styles.paragraph} />
  }

  return (
    <View>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} block={block} />
      ))}
    </View>
  )
}

// Legacy component for backwards compatibility
const MarkdownText: React.FC<{
  text: string
  baseStyle: any
}> = ({ text, baseStyle }) => {
  return <InlineMarkdownText text={text} baseStyle={baseStyle} />
}

// Extract legend data from pie chart
function extractPieChartLegend(
  data: any[],
  currency: string = 'USD'
): { label: string; value: string }[] {
  if (!Array.isArray(data)) return []

  return data
    .map((item) => {
      // Extract label (could be name, category, account, etc.)
      const label = item.name || item.category || item.account || item.label || ''

      // Skip empty labels or zero values
      if (!label || label === 'Unknown') return null

      // Extract value and format it
      let value = ''
      const rawValue = item.value || item.amount || item.absValue || 0
      const percentage = item.percentage

      // Skip zero values unless they have a percentage
      if (rawValue === 0 && !percentage) return null

      // Format based on the data type
      const absValue = Math.abs(rawValue)

      // Check if it's likely a currency value (larger numbers)
      const isCurrency = absValue > 100 || item.format === 'currency'

      if (percentage !== undefined && percentage !== null) {
        // Show both value and percentage
        if (isCurrency) {
          value = `${formatCurrency(absValue, currency)} (${Math.abs(percentage).toFixed(1)}%)`
        } else {
          value = `${absValue.toFixed(0)} (${Math.abs(percentage).toFixed(1)}%)`
        }
      } else if (isCurrency) {
        value = formatCurrency(absValue, currency)
      } else {
        value = absValue.toLocaleString()
      }

      return { label, value }
    })
    .filter((item) => item !== null) as { label: string; value: string }[]
}

// Table Component for PDF
const PDFTable: React.FC<{
  rows: any[]
  columns: any[]
  title?: string
  currency?: string
}> = ({ rows, columns, title, currency = 'USD' }) => {
  const displayRows = rows.slice(0, 50)

  // Track non-section row index for alternating backgrounds
  let dataRowIndex = 0

  return (
    <View style={styles.section}>
      {title && <Text style={styles.tableTitle}>{title}</Text>}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          {columns.map((column: any, index: number) => (
            <Text key={index} style={styles.tableHeaderCell}>
              {column.label}
            </Text>
          ))}
        </View>

        {displayRows.map((row: any, rowIndex: number) => {
          const isSection = row.isSection === true
          const isSubItem = row.isSubItem === true

          // Determine row style
          let rowStyle = styles.tableRow
          if (isSection) {
            rowStyle = styles.tableSectionRow
          } else {
            // Alternate backgrounds for non-section rows
            rowStyle = dataRowIndex % 2 === 1 ? styles.tableRowAlt : styles.tableRow
            dataRowIndex++
          }

          return (
            <View key={rowIndex} style={rowStyle}>
              {columns.map((column: any, colIndex: number) => {
                const value = row[column.key]
                const formattedValue = formatTableCell(value, column.format, currency)
                const isBadge = column.format === 'badge'
                const isNumericFormat = column.format === 'currency' || column.format === 'number'
                const isNegative = typeof value === 'number' && value < 0
                const isPositive = typeof value === 'number' && value > 0
                const isFirstColumn = colIndex === 0

                const cellStyle: any = { ...styles.tableCell }

                // Section row styling
                if (isSection) {
                  cellStyle.fontFamily = 'Noto Sans'
                  cellStyle.fontWeight = 'bold'
                  cellStyle.color = '#1e3a5f'
                  cellStyle.fontSize = 11
                }

                // Sub-item indentation
                if (isSubItem && isFirstColumn) {
                  cellStyle.paddingLeft = 16
                  cellStyle.color = '#6b7280'
                }

                // Badge styling
                if (isBadge && !isSection) {
                  cellStyle.color = getBadgeColor(formattedValue)
                  cellStyle.fontFamily = 'Noto Sans'
                  cellStyle.fontWeight = 'bold'
                }

                // Negative numbers in red
                if (isNumericFormat && !isSection && !isBadge && isNegative) {
                  cellStyle.color = '#dc2626'
                  cellStyle.fontFamily = 'Noto Sans'
                  cellStyle.fontWeight = 'bold'
                }

                // Positive numbers in green
                if (isNumericFormat && !isSection && !isBadge && isPositive) {
                  cellStyle.color = '#059669'
                }

                return (
                  <Text key={colIndex} style={cellStyle}>
                    {formattedValue}
                  </Text>
                )
              })}
            </View>
          )
        })}
      </View>

      {rows.length > 50 && (
        <Text
          style={{
            fontSize: 9,
            fontFamily: 'Noto Sans',
            fontStyle: 'italic',
            color: '#6b7280',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          Showing first 50 of {rows.length} entries
        </Text>
      )}
    </View>
  )
}

// PDF Document Component
const CleanPDFDocument: React.FC<{
  report: StoredReport & { organizationName?: string }
  chartImages: Record<string, string>
  tableComponents: Array<{ data: any[]; columns: any[]; title: string; currency?: string }>
  logoImage: string | null
}> = ({ report, chartImages, tableComponents, logoImage }) => {
  const kpiComponents = report.components.filter((c) => c.type === 'kpi_card')

  // Separate pie charts from other charts
  const pieChartComponents = report.components.filter(
    (c) => c.type === 'pie_chart' || c.props?.chartType === 'pie'
  )

  // Separate line/area charts for direct rendering
  const lineAreaChartComponents = report.components.filter(
    (c) =>
      (c.type === 'chart' || c.type === 'daily_cashflow') &&
      (c.props?.chartType === 'line' || c.props?.chartType === 'area')
  )

  // Remaining charts that need screenshot (bar, scatter, etc.)
  const otherChartComponents = report.components.filter(
    (c) =>
      (c.type === 'chart' || c.type === 'daily_cashflow') &&
      c.props?.chartType !== 'pie' &&
      c.props?.chartType !== 'line' &&
      c.props?.chartType !== 'area'
  )

  return (
    <Document>
      {/* Page 1: Overview */}
      <Page size="A4" style={styles.page}>
        {/* Logo Header with metadata */}
        <View style={styles.pageHeader} fixed>
          {logoImage ? (
            <View style={styles.logoContainer}>
              <Image src={logoImage} style={styles.logo} />
            </View>
          ) : (
            <View style={styles.logoContainer} />
          )}
          <Text style={styles.headerMetadata}>
            {formatDate(report.createdAt)} • Powered by Midas AI
          </Text>
        </View>

        <View style={{ height: 30, backgroundColor: 'white', marginBottom: 24 }} />

        <View style={styles.header}>
          {report.organizationName && (
            <Text style={styles.organizationName}>{report.organizationName}</Text>
          )}
          <Text style={styles.title}>{report.title}</Text>
          <Text style={styles.subtitle}>
            {report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report • {report.timeframe}
          </Text>
        </View>

        {(report.narrative || report.chatResponse) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <MarkdownContent text={report.narrative || report.chatResponse || ''} />
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by Midas AI CFO • Confidential Financial Report
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* Page 2: KPIs */}
      {kpiComponents.length > 0 && (
        <Page size="A4" style={styles.page}>
          {/* Logo Header with metadata */}
          <View style={styles.pageHeader} fixed>
            {logoImage ? (
              <View style={styles.logoContainer}>
                <Image src={logoImage} style={styles.logo} />
              </View>
            ) : (
              <View style={styles.logoContainer} />
            )}
            <Text style={styles.headerMetadata}>
              {formatDate(report.createdAt)} • Powered by Midas AI
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
            <View style={styles.kpiGrid}>
              {kpiComponents.map((kpi, index) => {
                const trend = kpi.props.trend
                const value = kpi.props.value
                const isNegative = typeof value === 'number' && value < 0
                const isPositive = typeof value === 'number' && value > 0
                const valueColor = isNegative ? '#df1e5a' : isPositive ? '#059669' : '#111827'

                return (
                  <View key={index} style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>{kpi.props.label}</Text>
                    <Text style={[styles.kpiValue, { color: valueColor }]}>
                      {kpi.props.format === 'currency'
                        ? formatCurrency(kpi.props.value, kpi.props.currency || 'USD')
                        : kpi.props.format === 'percentage'
                          ? `${kpi.props.value}%`
                          : formatNumber(kpi.props.value)}
                    </Text>
                    {kpi.props.subtext && (
                      <Text style={styles.kpiSubtext}>{kpi.props.subtext}</Text>
                    )}
                    {trend && (
                      <Text
                        style={[
                          styles.kpiTrend,
                          trend.direction === 'up' ? styles.trendPositive : styles.trendNegative,
                        ]}
                      >
                        {trend.direction === 'up' ? '▲' : '▼'} {trend.percentage.toFixed(1)}%{' '}
                        {trend.label || ''}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>
              Generated by Midas AI CFO • Confidential Financial Report
            </Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </Page>
      )}

      {/* Pie Charts Pages - Rendered directly */}
      {pieChartComponents.map((chartComponent, index) => {
        const currency = chartComponent.props?.currency || report.metadata?.currency || 'USD'
        const chartData = chartComponent.props?.data || []

        if (!chartData || chartData.length === 0) return null

        return (
          <Page key={`pie-${index}`} size="A4" style={styles.page}>
            {/* Logo Header with metadata */}
            <View style={styles.pageHeader} fixed>
              {logoImage ? (
                <View style={styles.logoContainer}>
                  <Image src={logoImage} style={styles.logo} />
                </View>
              ) : (
                <View style={styles.logoContainer} />
              )}
              <Text style={styles.headerMetadata}>
                {formatDate(report.createdAt)} • Powered by Midas AI
              </Text>
            </View>

            <PDFPieChart
              data={chartData}
              title={chartComponent.props?.title || 'Financial Breakdown'}
              currency={currency}
            />

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                Generated by Midas AI CFO • Confidential Financial Report
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}

      {/* Line/Area Charts Pages - Rendered directly */}
      {lineAreaChartComponents.map((chartComponent, index) => {
        const currency = chartComponent.props?.currency || report.metadata?.currency || 'USD'
        const chartData = chartComponent.props?.data || []
        const chartConfig = chartComponent.props?.config || {}

        if (!chartData || chartData.length === 0) return null

        // Extract series information
        const series = chartConfig.multiSeries || chartComponent.props?.multiSeries || []
        const xAxisKey = chartConfig.xAxis?.key || chartComponent.props?.xAxis?.key || 'x'
        const xAxisLabel = chartConfig.xAxis?.label || chartComponent.props?.xAxis?.label || ''
        const yAxisLabel = chartConfig.yAxis?.label || chartComponent.props?.yAxis?.label || ''
        const yAxisFormat =
          chartConfig.yAxis?.format || chartComponent.props?.yAxis?.format || 'number'
        const chartType = chartComponent.props?.chartType || 'line'

        return (
          <Page key={`line-${index}`} size="A4" style={styles.page}>
            {/* Logo Header with metadata */}
            <View style={styles.pageHeader} fixed>
              {logoImage ? (
                <View style={styles.logoContainer}>
                  <Image src={logoImage} style={styles.logo} />
                </View>
              ) : (
                <View style={styles.logoContainer} />
              )}
              <Text style={styles.headerMetadata}>
                {formatDate(report.createdAt)} • Powered by Midas AI
              </Text>
            </View>

            <PDFLineChart
              data={chartData}
              title={chartComponent.props?.title || 'Financial Trend'}
              currency={currency}
              xAxisKey={xAxisKey}
              xAxisLabel={xAxisLabel}
              yAxisLabel={yAxisLabel}
              yAxisFormat={yAxisFormat === 'currency' || currency ? 'currency' : 'number'}
              series={series}
              chartType={chartType as 'line' | 'area'}
            />

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                Generated by Midas AI CFO • Confidential Financial Report
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}

      {/* Other Charts Pages - Rendered as images */}
      {otherChartComponents.map((chartComponent, index) => {
        const chartId = chartComponent.id || `${chartComponent.type}-${index}`
        const chartImage = chartImages[chartId]

        if (!chartImage) return null

        return (
          <Page key={chartId} size="A4" style={styles.page}>
            {/* Logo Header with metadata */}
            <View style={styles.pageHeader} fixed>
              {logoImage ? (
                <View style={styles.logoContainer}>
                  <Image src={logoImage} style={styles.logo} />
                </View>
              ) : (
                <View style={styles.logoContainer} />
              )}
              <Text style={styles.headerMetadata}>
                {formatDate(report.createdAt)} • Powered by Midas AI
              </Text>
            </View>

            <View style={styles.chartPageContent}>
              <Text style={styles.chartTitle}>
                {chartComponent.props?.title || 'Financial Analysis'}
              </Text>
              <Image src={chartImage} style={styles.chartImage} />
            </View>

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                Generated by Midas AI CFO • Confidential Financial Report
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}

      {/* Tables Pages */}
      {tableComponents.map((table, index) => {
        if (!table.data || table.data.length === 0) return null

        return (
          <Page key={`table-${index}`} size="A4" style={styles.page}>
            {/* Logo Header with metadata */}
            <View style={styles.pageHeader} fixed>
              {logoImage ? (
                <View style={styles.logoContainer}>
                  <Image src={logoImage} style={styles.logo} />
                </View>
              ) : (
                <View style={styles.logoContainer} />
              )}
              <Text style={styles.headerMetadata}>
                {formatDate(report.createdAt)} • Powered by Midas AI
              </Text>
            </View>

            <PDFTable
              rows={table.data}
              columns={table.columns}
              title={table.title}
              currency={table.currency || report.metadata?.currency || 'USD'}
            />

            <View style={styles.footer} fixed>
              <Text style={styles.footerText}>
                Generated by Midas AI CFO • Confidential Financial Report
              </Text>
              <Text
                style={styles.pageNumber}
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

// Capture chart as image
async function captureChartImage(
  elementId: string,
  isPieChart: boolean = false
): Promise<string | null> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 500))

    let element = document.getElementById(elementId)
    if (!element) {
      // Try to find by chart container class if ID doesn't work
      const chartContainers = document.querySelectorAll(`[id*="${elementId}"]`)
      if (chartContainers.length > 0) {
        element = chartContainers[0] as HTMLElement
      }
    }

    if (!element) return null

    // Clone element and prepare for capture
    const clonedElement = element.cloneNode(true) as HTMLElement

    // Ensure we capture the full chart with legend
    clonedElement.style.position = 'absolute'
    clonedElement.style.left = '-9999px'
    clonedElement.style.width = '800px'
    clonedElement.style.backgroundColor = '#ffffff'
    clonedElement.style.padding = '30px'
    clonedElement.style.borderRadius = '8px'

    // For pie charts: remove active shape effects and increase size
    if (isPieChart) {
      const svg = clonedElement.querySelector('svg')
      if (svg) {
        // Remove active shape elements (lines, outer sectors, labels that extend from active shape)
        const activeElements = svg.querySelectorAll('path[d*="M"][d*="L"], circle[r="2"]')
        activeElements.forEach((el) => {
          // Check if it's part of the active shape rendering (lines connecting to labels)
          const parent = el.parentElement
          if (parent && parent.tagName === 'g') {
            const hasText = parent.querySelector('text')
            const hasPath = parent.querySelector('path[fill="none"]')
            if (hasText && hasPath) {
              // This is likely the active shape group, remove the connecting lines and outer ring
              const outerSector = parent.querySelector('path[d*="M"]:not([fill="none"])')
              const linePath = parent.querySelector('path[fill="none"]')
              const circle = parent.querySelector('circle')
              const texts = parent.querySelectorAll('text')

              if (outerSector) outerSector.remove()
              if (linePath) linePath.remove()
              if (circle) circle.remove()
              // Remove the extended labels, but keep center text
              texts.forEach((text, idx) => {
                if (idx > 0) text.remove() // Keep only first text (center percentage)
              })
            }
          }
        })

        // Increase pie chart size by scaling the viewBox
        const currentViewBox = svg.getAttribute('viewBox')
        if (currentViewBox) {
          const [x, y, width, height] = currentViewBox.split(' ').map(Number)
          // Center the pie chart better and give it more space
          svg.setAttribute('viewBox', `${x - 50} ${y - 50} ${width + 100} ${height + 100}`)
        }
      }
    }

    // Ensure legends are visible
    const legends = clonedElement.querySelectorAll('.recharts-legend-wrapper, .legend-container')
    legends.forEach((legend) => {
      ;(legend as HTMLElement).style.display = 'flex'
      ;(legend as HTMLElement).style.visibility = 'visible'
    })

    document.body.appendChild(clonedElement)
    await new Promise((resolve) => setTimeout(resolve, 200))

    const canvas = await html2canvas(clonedElement, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      width: 800,
      windowWidth: 800,
    })

    document.body.removeChild(clonedElement)
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error capturing chart:', error)
    return null
  }
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

// Main exporter class
export class CleanPDFExporter {
  static async export(
    report: StoredReport & { organizationName?: string },
    onProgress?: (message: string) => void
  ): Promise<void> {
    try {
      onProgress?.('Preparing report...')
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Load logo
      onProgress?.('Loading logo...')
      const logoImage = await loadLogoAsBase64()

      // Parse DynamoDB format if needed
      const parsedReport = parseDynamoDBReport(report)

      // Parse table components from report
      onProgress?.('Extracting table data...')
      const tableComponents: Array<{
        data: any[]
        columns: any[]
        title: string
        currency?: string
      }> = []

      for (const component of parsedReport.components) {
        const extractedTable = extractTableFromComponent(component)
        if (extractedTable) {
          tableComponents.push(extractedTable)
        }
      }

      // Capture chart images (exclude pie charts and line/area charts - they're rendered directly)
      onProgress?.('Capturing visualizations...')
      const chartImages: Record<string, string> = {}
      const chartComponents = parsedReport.components.filter(
        (c: any) =>
          (c.type === 'chart' || c.type === 'daily_cashflow') &&
          c.props?.chartType !== 'pie' &&
          c.props?.chartType !== 'line' &&
          c.props?.chartType !== 'area'
      )

      for (let i = 0; i < chartComponents.length; i++) {
        const chartComponent = chartComponents[i]
        const chartId = chartComponent.id || `${chartComponent.type}-${i}`
        onProgress?.(`Capturing chart ${i + 1} of ${chartComponents.length}...`)

        const imageData = await captureChartImage(chartId, false)
        if (imageData) {
          chartImages[chartId] = imageData
        }
      }

      // Generate PDF
      onProgress?.('Generating PDF document...')
      const pdfDocument = (
        <CleanPDFDocument
          report={parsedReport}
          chartImages={chartImages}
          tableComponents={tableComponents}
          logoImage={logoImage}
        />
      )
      const blob = await pdf(pdfDocument).toBlob()

      // Download
      onProgress?.('Downloading...')
      const filename = `${report.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
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
}
