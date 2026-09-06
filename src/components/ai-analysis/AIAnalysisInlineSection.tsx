'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DOMPurify from 'isomorphic-dompurify'
import { cn } from '@/lib/utils'

const sanitizeOpts = {
  ADD_ATTR: ['data-analysis-item', 'data-item-text', 'data-section-type', 'title'],
  ADD_TAGS: ['svg', 'path', 'strong'],
  ALLOW_DATA_ATTR: true,
}

interface AIAnalysisInlineSectionProps {
  /** Raw HTML from formatAnalysisSections */
  html: string | null
  /** Whether the analysis is still loading */
  loading: boolean
  /** Number of shimmer lines to show */
  shimmerLines?: number
  /** Optional className */
  className?: string
  /** Display name for chat context */
  displayName?: string
  /** Section type — determines skeleton shape */
  sectionType?: 'strategic' | 'forward' | 'actions'
}

export function AIAnalysisInlineSection({
  html,
  loading,
  shimmerLines = 3,
  className,
  displayName = 'Executive Summary',
  sectionType = 'strategic',
}: AIAnalysisInlineSectionProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<{
    show: boolean
    x: number
    y: number
    scrollY: number
    itemText: string
    sectionType: 'strategic' | 'forward' | 'actions'
  } | null>(null)

  // Click delegation for analysis items
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const clickableItem = target.closest('[data-analysis-item]')

      if (clickableItem) {
        event.preventDefault()
        event.stopPropagation()

        const itemText = clickableItem.getAttribute('data-item-text')
        const sectionType = clickableItem.getAttribute('data-section-type') as
          | 'strategic'
          | 'forward'
          | 'actions'

        if (itemText && sectionType) {
          setPopup({
            show: true,
            x: event.clientX,
            y: event.clientY,
            scrollY: window.scrollY,
            itemText,
            sectionType,
          })
        }
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [html])

  const handleAsk = useCallback(
    (itemText: string, sectionType: 'strategic' | 'forward' | 'actions') => {
      const contextPrompt = `Based on this AI analysis insight from the ${displayName}:\n\n"${itemText}"\n\nPlease provide more details and actionable recommendations.`

      window.dispatchEvent(
        new CustomEvent('chat-send-message', {
          detail: { message: contextPrompt, openChat: true },
        })
      )
    },
    [displayName]
  )

  if (loading || !html) {
    return (
      <div className={cn('ai-insight-panel relative', className)}>
        <div className="text-sm leading-relaxed">
          {/* Title shimmer */}
          <div className="h-5 w-40 mb-6 animate-pulse bg-black/[0.06] dark:bg-white/[0.06]" />

          {sectionType === 'strategic' ? (
            /* 2-col grid of ◆ diamond bullets — matches actual strategic layout */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {[85, 65, 90, 55, 75, 80].map((w, i) => (
                <div key={i} className="flex gap-3 py-2.5 px-3">
                  <span className="text-[10px] flex-shrink-0 mt-[5px] text-blue-400/40 dark:text-blue-500/30">
                    &#9670;
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 animate-pulse bg-black/[0.05] dark:bg-white/[0.05]" />
                    <div
                      className="h-3.5 animate-pulse bg-black/[0.04] dark:bg-white/[0.04]"
                      style={{ width: `${w}%` }}
                    />
                    <div
                      className="h-3.5 animate-pulse bg-black/[0.03] dark:bg-white/[0.04]"
                      style={{ width: `${w - 25}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : sectionType === 'forward' ? (
            /* Single-col → arrow bullets */
            <div>
              {[90, 70, 85, 60].map((w, i) => (
                <div key={i} className="flex gap-3 py-2.5 px-3 -mx-3">
                  <span className="text-xs flex-shrink-0 mt-[3px] text-purple-400/40 dark:text-purple-500/30">
                    &#8594;
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 animate-pulse bg-black/[0.05] dark:bg-white/[0.05]" />
                    <div
                      className="h-3.5 animate-pulse bg-black/[0.04] dark:bg-white/[0.04]"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Single-col numbered circle bullets */
            <div>
              {[80, 65, 90, 55].map((w, i) => (
                <div key={i} className="flex gap-3 py-2.5 px-3 -mx-3">
                  <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center mt-[2px] text-blue-400/40 dark:text-blue-500/30 border border-blue-400/30 dark:border-blue-500/20">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-1.5 items-center">
                      <div className="h-3.5 w-24 animate-pulse bg-blue-400/10 dark:bg-blue-500/10" />
                      <div className="h-3.5 flex-1 animate-pulse bg-black/[0.04] dark:bg-white/[0.04]" />
                    </div>
                    <div
                      className="h-3.5 animate-pulse bg-black/[0.03] dark:bg-white/[0.04]"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div ref={contentRef} className={cn('ai-insight-panel relative group/panel', className)}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(html, sanitizeOpts),
            }}
          />
        </motion.div>
      </div>

      {popup?.show && (
        <AskMidasPopup popup={popup} onClose={() => setPopup(null)} onAsk={handleAsk} />
      )}
    </>
  )
}

function AskMidasPopup({
  popup,
  onClose,
  onAsk,
}: {
  popup: {
    show: boolean
    x: number
    y: number
    scrollY: number
    itemText: string
    sectionType: 'strategic' | 'forward' | 'actions'
  }
  onClose: () => void
  onAsk: (itemText: string, sectionType: 'strategic' | 'forward' | 'actions') => void
}) {
  const [currentScrollY, setCurrentScrollY] = useState(window.scrollY)

  useEffect(() => {
    const handleScroll = () => setCurrentScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.ask-midas-popup')) {
        onClose()
      }
    }

    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 10)

    return () => document.removeEventListener('click', handleClickOutside)
  }, [onClose])

  const scrollDiff = currentScrollY - popup.scrollY
  const top = popup.y - scrollDiff

  return createPortal(
    <AnimatePresence>
      {popup.show && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 2, scale: 0.98 }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
          className="ask-midas-popup fixed z-[9999]"
          style={{
            left: `${popup.x}px`,
            top: `${top + 8}px`,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAsk(popup.itemText, popup.sectionType)
              onClose()
            }}
            className="backdrop-blur-xl bg-amber-500/90 hover:bg-amber-500 text-white text-[11px] font-medium tracking-wide px-3.5 py-1.5 rounded-full shadow-[0_2px_12px_-2px_rgba(245,158,11,0.4)] flex items-center gap-1.5 transition-all duration-150 hover:shadow-[0_4px_16px_-2px_rgba(245,158,11,0.5)]"
          >
            <MessageCircle className="w-3 h-3" />
            <span>Ask Midas</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
