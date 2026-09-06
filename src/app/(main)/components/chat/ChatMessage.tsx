'use client'

import { cn } from '@/lib/utils'
import { Loader2, Bug, RefreshCw, Download, Check, AlertCircle, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
import React, { memo, useMemo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  parseBlockType,
  parseVisualizationBlock,
  transformStructuredVisualization,
} from '@/lib/chat/visualizationBlocks'
import { VisualizationRenderer } from '@/components/chat/visualizations'
import { VisualizationErrorBoundary } from '@/components/error'
import { WidgetRenderer } from '@/ai/widgets'
import { aiDebug } from '@/lib/debug'
// Lazy-loaded at export time to keep @react-pdf out of the client bundle
const getChatPdfExporter = () => import('@/lib/pdf/chatPdfExporter').then((m) => m.ChatPdfExporter)
import { SourceBadges } from './SourceBadges'
import { PromptBubbles, type Suggestion } from './PromptBubbles'
import { PaginatedMarkdownTable } from './PaginatedMarkdownTable'

interface ChatMessageProps {
  message: any
  status?: string | null
  progress?: { steps: string[] } | null
  onComponentClick?: (component: any) => void
  renderedComponents?: Record<string, any[]>
  enhanceContentWithMemoryCitations?: (content: string, memories?: any[]) => string
  onRetry?: () => void
  onRetrySave?: (messageId: string) => void
  onRetryFromError?: (messageId: string) => void
  onSuggestionSelect?: (prompt: string, label: string) => void
  organizationName?: string
  currency?: string
}

// Memoized markdown components - styling handled by CSS in _chat.css
const markdownComponents = {
  // Paragraphs, headings, lists - rely on CSS for styling
  p: ({ children }: any) => <p>{children}</p>,
  h1: ({ children }: any) => <h1>{children}</h1>,
  h2: ({ children }: any) => <h2>{children}</h2>,
  h3: ({ children }: any) => <h3>{children}</h3>,
  h4: ({ children }: any) => <h4>{children}</h4>,
  strong: ({ children }: any) => <strong>{children}</strong>,
  em: ({ children }: any) => <em>{children}</em>,
  ul: ({ children }: any) => <ul>{children}</ul>,
  ol: ({ children }: any) => <ol>{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,

  // Links with security attributes
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),

  // Code blocks - check for visualization blocks first
  code: ({ children, className }: any) => {
    const isInline = !className

    // Check if this is a visualization block (chart:pie, table, kpi, metric)
    if (!isInline && className) {
      const lang = className.replace('language-', '')
      const blockType = parseBlockType(lang)

      if (blockType) {
        // Extract text content from children
        const content = String(children).replace(/\n$/, '')
        const vizBlock = parseVisualizationBlock(lang, content)

        if (vizBlock) {
          return (
            <VisualizationErrorBoundary
              chartType={'chartType' in vizBlock ? vizBlock.chartType : vizBlock.type}
            >
              <VisualizationRenderer block={vizBlock} />
            </VisualizationErrorBoundary>
          )
        }
      }

      // Fallback: Check if this is raw JSON that looks like a chart specification
      // This handles cases where LLM outputs chart JSON directly instead of using the tool
      if (lang === 'json' || lang === '') {
        try {
          const content = String(children).replace(/\n$/, '')
          const parsed = JSON.parse(content)

          // Check if this looks like a chart specification
          if (
            parsed.type &&
            (parsed.type.startsWith('chart:') ||
              ['table', 'kpi', 'metric', 'comparison', 'progress', 'timeline'].includes(
                parsed.type
              ))
          ) {
            // Transform using existing function
            const vizBlock = transformStructuredVisualization(parsed)
            if (vizBlock) {
              return (
                <VisualizationErrorBoundary chartType={parsed.type}>
                  <VisualizationRenderer block={vizBlock} />
                </VisualizationErrorBoundary>
              )
            }
          }
        } catch {
          // Not valid chart JSON, fall through to normal code rendering
        }
      }
    }

    return isInline ? <code>{children}</code> : <code className={className}>{children}</code>
  },

  // Pre blocks - handle visualization blocks at this level too
  pre: ({ children }: any) => {
    // Check if the child is already a visualization (rendered by code component)
    const child = React.Children.only(children)
    if (child?.type === VisualizationRenderer) {
      return child
    }

    // Check if child is a code element with visualization language
    if (child?.props?.className) {
      const lang = child.props.className.replace('language-', '')
      const blockType = parseBlockType(lang)

      if (blockType && child.props.children) {
        const content = String(child.props.children).replace(/\n$/, '')
        const vizBlock = parseVisualizationBlock(lang, content)

        if (vizBlock) {
          return (
            <VisualizationErrorBoundary
              chartType={'chartType' in vizBlock ? vizBlock.chartType : vizBlock.type}
            >
              <VisualizationRenderer block={vizBlock} />
            </VisualizationErrorBoundary>
          )
        }
      }

      // Fallback: Check if this is raw JSON that looks like a chart specification
      if ((lang === 'json' || lang === '') && child.props.children) {
        try {
          const content = String(child.props.children).replace(/\n$/, '')
          const parsed = JSON.parse(content)

          if (
            parsed.type &&
            (parsed.type.startsWith('chart:') ||
              ['table', 'kpi', 'metric', 'comparison', 'progress', 'timeline'].includes(
                parsed.type
              ))
          ) {
            const vizBlock = transformStructuredVisualization(parsed)
            if (vizBlock) {
              return (
                <VisualizationErrorBoundary chartType={parsed.type}>
                  <VisualizationRenderer block={vizBlock} />
                </VisualizationErrorBoundary>
              )
            }
          }
        } catch {
          // Not valid chart JSON, fall through to normal pre rendering
        }
      }
    }

    return (
      <pre
        style={{
          overflowX: 'auto',
          maxWidth: '100%',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
      >
        {children}
      </pre>
    )
  },

  // Blockquotes
  blockquote: ({ children }: any) => <blockquote>{children}</blockquote>,

  // Tables — wrapped with PaginatedMarkdownTable for automatic pagination (>10 rows)
  table: ({ children }: any) => <PaginatedMarkdownTable>{children}</PaginatedMarkdownTable>,
  thead: ({ children }: any) => (
    <thead data-slot="thead" className="border-b border-white/10 bg-white/5">
      {children}
    </thead>
  ),
  tbody: ({ children }: any) => <tbody data-slot="tbody">{children}</tbody>,
  tr: ({ children }: any) => (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">{children}</tr>
  ),
  th: ({ children }: any) => (
    <th className="px-4 py-2 font-medium theme-text-secondary text-left">{children}</th>
  ),
  td: ({ children }: any) => <td className="px-4 py-2 theme-text-primary">{children}</td>,

  // Horizontal rule
  hr: () => <hr />,
}

// Helper to check for response error markup
const parseResponseError = (content: string) => {
  const errorMatch = content.match(/<response-error>([\s\S]*?)<\/response-error>/)
  if (!errorMatch) return null

  const textBefore = content.split('<response-error>')[0].trim()
  return { textBefore }
}

// Parse content with inline markers [[VIZ:N]] and [[WIDGET:N]]
// Returns an array of segments: { type: 'text', content } or { type: 'viz', index } or { type: 'widget', index }
type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'viz'; index: number }
  | { type: 'widget'; index: number }

const parseInlineMarkers = (content: string): ContentSegment[] => {
  const segments: ContentSegment[] = []
  // Combined regex for both VIZ and WIDGET markers
  const markerRegex = /\[\[(VIZ|WIDGET):(\d+)\]\]/g

  let lastIndex = 0
  let match

  while ((match = markerRegex.exec(content)) !== null) {
    // Add text before this marker
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        segments.push({ type: 'text', content: textContent })
      }
    }

    // Add the marker (viz or widget)
    const markerType = match[1].toLowerCase() as 'viz' | 'widget'
    const markerIndex = parseInt(match[2], 10)
    segments.push({ type: markerType, index: markerIndex })

    lastIndex = match.index + match[0].length
  }

  // Add any remaining text after the last marker
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim()
    if (textContent) {
      segments.push({ type: 'text', content: textContent })
    }
  }

  // If no markers found, return the whole content as text
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', content: content })
  }

  return segments
}

export const ChatMessage = memo(
  ({
    message,
    status,
    progress,
    onComponentClick,
    renderedComponents,
    enhanceContentWithMemoryCitations = (content: string) => content,
    onRetry,
    onRetrySave,
    onRetryFromError,
    onSuggestionSelect,
    organizationName,
    currency = 'USD',
  }: ChatMessageProps) => {
    // State for PDF export
    const [isExporting, setIsExporting] = useState(false)
    const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle')

    // Handle PDF download
    const handleDownloadPdf = useCallback(async () => {
      if (isExporting) return

      setIsExporting(true)
      setExportStatus('idle')

      try {
        const ChatPdfExporter = await getChatPdfExporter()
        await ChatPdfExporter.export(message, {
          currency,
          organizationName,
          widgets: message.widgets || [],
          onProgress: (msg) => logger.debug('PDF export progress', { message: msg }),
        })
        setExportStatus('success')
        setTimeout(() => setExportStatus('idle'), 2000)
      } catch (error) {
        logger.error('PDF export failed', { error, component: 'ChatMessage' })
        setExportStatus('error')
        setTimeout(() => setExportStatus('idle'), 3000)
      } finally {
        setIsExporting(false)
      }
    }, [message, currency, organizationName, isExporting])

    // Debug logging for message rendering
    aiDebug.message.render({
      messageId: message.id,
      role: message.role,
      componentCount: message.components?.length || 0,
    })

    // Memoize the parsed content to avoid re-parsing on every render
    const messageContent = useMemo(() => {
      if (message.role === 'assistant-temp') {
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="text-sm theme-text-secondary animate-pulse">
                {status || 'Analyzing your data...'}
              </span>
            </div>

            {progress && progress.steps.length > 0 && (
              <div className="space-y-1.5 pl-6 mt-2">
                {progress.steps
                  .filter((step) => step && step.trim())
                  .map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs animate-fade-in"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5 animate-pulse" />
                      <span className="text-amber-600/80 dark:text-amber-400/80 leading-none">
                        {step}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      }

      // Handle error messages (assistant messages with isError=true)
      if (message.isError && message.role === 'assistant') {
        const isNetworkError = message.retryData?.errorCode === 'NETWORK'

        return (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              {isNetworkError ? (
                <WifiOff className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    'text-sm',
                    isNetworkError
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {message.content}
                </p>
                {message.retryData?.errorCode && !isNetworkError && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-red-500/10 text-red-500">
                    {message.retryData.errorCode}
                  </span>
                )}
              </div>
            </div>
            {onRetryFromError && message.retryData?.input && (
              <button
                onClick={() => onRetryFromError(message.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {isNetworkError ? 'Try Again' : 'Retry'}
              </button>
            )}
          </div>
        )
      }

      // Check for response error markup
      const rawContent = message.displayContent || message.content
      const errorData = parseResponseError(rawContent)

      if (errorData) {
        return (
          <div className="space-y-3">
            <p className="text-sm theme-text-secondary">{errorData.textBefore}</p>
            <div className="flex items-center gap-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              )}
              <Link
                href="/support"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-500/10 hover:bg-zinc-500/20 theme-text-secondary transition-colors"
              >
                <Bug className="w-3.5 h-3.5" />
                Report
              </Link>
            </div>
          </div>
        )
      }

      // Check if content has inline markers (VIZ or WIDGET)
      const hasInlineVizMarkers = /\[\[VIZ:\d+\]\]/.test(rawContent)
      const hasInlineWidgetMarkers = /\[\[WIDGET:\d+\]\]/.test(rawContent)
      const hasInlineMarkers = hasInlineVizMarkers || hasInlineWidgetMarkers
      const components = message.components || []
      const widgets = message.widgets || []

      // Debug: log inline marker detection
      logger.debug('Inline marker detection', {
        component: 'ChatMessage',
        hasInlineMarkers,
        hasInlineVizMarkers,
        hasInlineWidgetMarkers,
        componentCount: components.length,
        widgetCount: widgets.length,
        rawContentPreview: rawContent.slice(0, 200),
        componentVizIndices: components.map((c: any) => c.vizIndex),
        widgetIndices: widgets.map((w: any) => w.widgetIndex),
      })

      // Build a map of vizIndex -> component for quick lookup
      const vizMap = new Map<number, any>()
      components.forEach((comp: any) => {
        if (comp.vizIndex != null) {
          vizMap.set(comp.vizIndex, comp)
        }
      })

      // Build a map of widgetIndex -> widget for quick lookup
      const widgetMap = new Map<number, any>()
      widgets.forEach((widget: any) => {
        if (widget.widgetIndex != null) {
          widgetMap.set(widget.widgetIndex, widget)
        }
      })

      // If we have inline markers and components/widgets, render inline
      if (hasInlineMarkers && (components.length > 0 || widgets.length > 0)) {
        logger.debug('Using INLINE rendering mode', { component: 'ChatMessage' })
        const segments = parseInlineMarkers(rawContent)
        aiDebug.message.componentsRender({
          messageId: message.id,
          count: components.length + widgets.length,
          types: [
            ...components.map((c: any) => c.type || 'unknown'),
            ...widgets.map((w: any) => w.type || 'widget'),
          ],
        })

        return (
          <>
            <div className="text-sm break-words space-y-4">
              {segments.map((segment, idx) => {
                if (segment.type === 'text') {
                  return (
                    <div key={`${message.id}-seg-${idx}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {enhanceContentWithMemoryCitations(segment.content, message.memories)}
                      </ReactMarkdown>
                    </div>
                  )
                } else if (segment.type === 'viz') {
                  // Render visualization inline
                  // Use idx for unique keys (segment.index could be duplicated if same VIZ marker appears twice)
                  const component = vizMap.get(segment.index)
                  if (component) {
                    return (
                      <div key={`${message.id}-viz-${idx}`} className="my-4">
                        <VisualizationErrorBoundary
                          chartType={component.chartType || component.type}
                        >
                          <VisualizationRenderer block={component} className="w-full" />
                        </VisualizationErrorBoundary>
                      </div>
                    )
                  } else {
                    // Fallback: try to find by array index (1-indexed)
                    const fallbackComponent = components[segment.index - 1]
                    if (fallbackComponent) {
                      return (
                        <div key={`${message.id}-viz-${idx}`} className="my-4">
                          <VisualizationErrorBoundary
                            chartType={fallbackComponent.chartType || fallbackComponent.type}
                          >
                            <VisualizationRenderer block={fallbackComponent} className="w-full" />
                          </VisualizationErrorBoundary>
                        </div>
                      )
                    }
                    logger.warn('No component found for VIZ marker', {
                      component: 'ChatMessage',
                      vizIndex: segment.index,
                    })
                    return null
                  }
                } else if (segment.type === 'widget') {
                  // Render memory widget inline
                  // Use idx for unique keys (segment.index could be duplicated if same WIDGET marker appears twice)
                  const widget = widgetMap.get(segment.index)
                  if (widget) {
                    return (
                      <div key={`${message.id}-widget-${idx}`} className="my-8">
                        <WidgetRenderer widget={widget} className="w-full" />
                      </div>
                    )
                  } else {
                    // Fallback: try to find by array index (1-indexed)
                    const fallbackWidget = widgets[segment.index - 1]
                    if (fallbackWidget) {
                      return (
                        <div key={`${message.id}-widget-${idx}`} className="my-8">
                          <WidgetRenderer widget={fallbackWidget} className="w-full" />
                        </div>
                      )
                    }
                    logger.warn('No widget found for WIDGET marker', {
                      component: 'ChatMessage',
                      widgetIndex: segment.index,
                    })
                    return null
                  }
                }
                return null
              })}
            </div>
          </>
        )
      }

      // Fallback: No inline markers, render text then all visualizations at the end
      // Strip any orphaned [[VIZ:N]] / [[WIDGET:N]] markers that have no matching components
      const cleanedContent = hasInlineMarkers
        ? rawContent.replace(/\[\[(VIZ|WIDGET):\d+\]\]/g, '').replace(/\n{3,}/g, '\n\n')
        : rawContent

      return (
        <>
          <div className="text-sm break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {enhanceContentWithMemoryCitations(cleanedContent, message.memories)}
            </ReactMarkdown>
          </div>

          {/* Render visualizations at the end if no inline markers */}
          {components.length > 0 &&
            (() => {
              aiDebug.message.componentsRender({
                messageId: message.id,
                count: components.length,
                types: components.map((c: any) => c.type || 'unknown'),
              })
              return (
                <div className="mt-4 space-y-4">
                  {components.map((component: any, index: number) => (
                    <VisualizationErrorBoundary
                      key={`${message.id}-viz-${index}`}
                      chartType={component.chartType || component.type}
                    >
                      <VisualizationRenderer block={component} className="w-full" />
                    </VisualizationErrorBoundary>
                  ))}
                </div>
              )
            })()}
        </>
      )
    }, [
      message.role,
      message.content,
      message.memories,
      message.updatedMemories,
      message.deletedMemories,
      message.components,
      message.widgets,
      message.timestamp,
      message.confidence,
      message.id,
      message.hasMemory,
      message.isError,
      message.retryData,
      status,
      progress,
      onComponentClick,
      renderedComponents,
      enhanceContentWithMemoryCitations,
      onRetry,
      onRetryFromError,
    ])

    // Check if message has components (visualizations) or substantial content for download button
    const hasComponents =
      (message.components && message.components.length > 0) ||
      (message.widgets && message.widgets.length > 0)
    const hasSubstantialContent = (message.content?.length || 0) > 100 // Show for responses with some content
    const showDownloadButton =
      message.role === 'assistant' &&
      message.role !== 'assistant-temp' &&
      !message.isError &&
      message.id !== 'welcome' &&
      (hasComponents || hasSubstantialContent)

    return (
      <div
        key={message.id}
        data-message-id={message.id}
        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={cn(
            'transition-all duration-200',
            message.role === 'user'
              ? 'chat-message-user ml-4 rounded-lg p-3'
              : message.role === 'assistant-temp'
                ? 'chat-message-assistant thinking'
                : 'chat-message-assistant'
          )}
          style={{
            maxWidth: message.role === 'user' ? '70%' : '100%',
            width: message.role === 'user' ? undefined : '100%',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {messageContent}

          {/* Data source badges for assistant messages */}
          {message.role === 'assistant' && message.sources && (
            <SourceBadges sources={message.sources} />
          )}

          {/* Download PDF Button */}
          {showDownloadButton && (
            <div className="flex items-center justify-end mt-3 pt-3 border-t border-amber-500/10">
              <button
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                  exportStatus === 'success'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : exportStatus === 'error'
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400',
                  isExporting && 'opacity-70 cursor-wait'
                )}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : exportStatus === 'success' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Downloaded!</span>
                  </>
                ) : exportStatus === 'error' ? (
                  <>
                    <Bug className="w-3.5 h-3.5" />
                    <span>Export failed</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Inline suggestion bubbles — render AFTER all message content including PDF button */}
          {message.role === 'assistant' && message.suggestions && onSuggestionSelect && (
            <PromptBubbles
              suggestions={message.suggestions as Suggestion[]}
              onSelect={onSuggestionSelect}
              variant="inline"
            />
          )}
        </div>
      </div>
    )
  },
  // Custom comparison function to prevent re-renders when props haven't really changed
  // OPTIMIZED: Removed expensive JSON.stringify calls, using shallow comparisons instead
  (prevProps, nextProps) => {
    // Always re-render if it's a temp message (streaming)
    if (
      prevProps.message.role === 'assistant-temp' ||
      nextProps.message.role === 'assistant-temp'
    ) {
      return false
    }

    // Helper for shallow array comparison (compares length and first/last items)
    const shallowArrayEqual = (a?: any[], b?: any[]): boolean => {
      if (a === b) return true
      if (!a || !b) return a === b
      if (a.length !== b.length) return false
      if (a.length === 0) return true
      // Compare first and last items for quick mismatch detection
      return a[0]?.id === b[0]?.id && a[a.length - 1]?.id === b[b.length - 1]?.id
    }

    // Check if message content or important props have changed
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role &&
      prevProps.message.hasMemory === nextProps.message.hasMemory &&
      prevProps.message.isError === nextProps.message.isError &&
      prevProps.message.retryData?.input === nextProps.message.retryData?.input &&
      // Use shallow array comparison instead of JSON.stringify
      shallowArrayEqual(prevProps.message.components, nextProps.message.components) &&
      shallowArrayEqual(prevProps.message.widgets, nextProps.message.widgets) &&
      shallowArrayEqual(prevProps.message.memories, nextProps.message.memories) &&
      shallowArrayEqual(prevProps.message.updatedMemories, nextProps.message.updatedMemories) &&
      shallowArrayEqual(prevProps.message.deletedMemories, nextProps.message.deletedMemories) &&
      shallowArrayEqual(prevProps.message.suggestions, nextProps.message.suggestions) &&
      shallowArrayEqual(prevProps.message.sources, nextProps.message.sources) &&
      prevProps.onSuggestionSelect === nextProps.onSuggestionSelect &&
      prevProps.status === nextProps.status &&
      // For progress, compare steps length only
      (prevProps.progress?.steps?.length ?? 0) === (nextProps.progress?.steps?.length ?? 0) &&
      // For renderedComponents, only check if this message's components changed
      prevProps.renderedComponents?.[prevProps.message.id] ===
        nextProps.renderedComponents?.[nextProps.message.id] &&
      prevProps.onRetry === nextProps.onRetry &&
      prevProps.onRetryFromError === nextProps.onRetryFromError &&
      prevProps.organizationName === nextProps.organizationName &&
      prevProps.currency === nextProps.currency
    )
  }
)

ChatMessage.displayName = 'ChatMessage'
