/**
 * Formatters for AI Analysis responses
 * Converts JSON analysis into styled HTML
 */

import type { AnalysisData } from './types'

/**
 * Format JSON analysis response into styled HTML (single combined output)
 */
export function formatAnalysis(data: AnalysisData): string {
  const { strategic, forward, actions } = formatAnalysisSections(data)
  return `<div class="space-y-1">${strategic}${forward}${actions}</div>`
}

/**
 * Format JSON analysis into 3 separate section HTML strings
 */
export function formatAnalysisSections(data: AnalysisData): {
  strategic: string
  forward: string
  actions: string
} {
  // Strategic Insights — blue accent, 2-column grid layout
  const strategic = `
    <h3 class="relative inline-block text-base font-normal uppercase tracking-wider theme-text-primary mb-6">Strategic Insights<span class="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover/panel:w-full"></span></h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
    ${data.strategicInsights
      .map((insight) => {
        return `<div class="analysis-item analysis-item--strategic flex gap-3 py-2.5 px-3 rounded-lg cursor-pointer transition-all duration-200"
          data-analysis-item
          data-item-text="${escapeHtml(insight)}"
          data-section-type="strategic">
          <span class="text-blue-500 text-[10px] flex-shrink-0 mt-[5px]">&#9670;</span>
          <span class="flex-1 text-sm leading-relaxed" style="color: rgb(85, 85, 85);">${escapeHtml(insight)}</span>
        </div>`
      })
      .join('')}
    </div>
  `

  // Forward-Looking Analysis — purple accent
  const forward = `
    <h3 class="relative inline-block text-base font-normal uppercase tracking-wider theme-text-primary mb-6">Forward-Looking Analysis<span class="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover/panel:w-full"></span></h3>
    ${data.forwardLooking
      .map((prediction) => {
        return `<div class="analysis-item analysis-item--forward flex gap-3 py-2.5 px-3 -mx-3 rounded-lg cursor-pointer transition-all duration-200"
          data-analysis-item
          data-item-text="${escapeHtml(prediction)}"
          data-section-type="forward">
          <span class="text-theme-purple/70 text-xs flex-shrink-0 mt-[3px]">&#8594;</span>
          <span class="flex-1 text-sm leading-relaxed" style="color: rgb(85, 85, 85);">${escapeHtml(prediction)}</span>
        </div>`
      })
      .join('')}
  `

  // Prioritized Actions — emerald/teal accent (readable on both themes)
  const actions = `
    <h3 class="relative inline-block text-base font-normal uppercase tracking-wider theme-text-primary mb-6">Prioritized Actions<span class="absolute left-0 -bottom-1 h-[2px] w-0 bg-amber-400 transition-all duration-300 ease-out group-hover/panel:w-full"></span></h3>
    ${data.prioritizedActions
      .map((action, idx) => {
        const actionText = `${action.action}: ${action.impact} (${action.timeline})`
        return `<div class="analysis-item analysis-item--actions-blue flex gap-3 py-2.5 px-3 -mx-3 rounded-lg cursor-pointer transition-all duration-200"
          data-analysis-item
          data-item-text="${escapeHtml(actionText)}"
          data-section-type="actions">
          <span class="flex-shrink-0 w-[18px] h-[18px] rounded-full text-blue-500 text-[10px] font-semibold flex items-center justify-center mt-[2px]" style="border: 1px solid currentColor;">
            ${idx + 1}
          </span>
          <span class="flex-1 text-sm leading-relaxed" style="color: rgb(85, 85, 85);">
            <strong class="font-medium text-blue-500">${escapeHtml(action.action)}:</strong> ${escapeHtml(action.impact)} <span class="theme-text-secondary text-xs">${escapeHtml(action.timeline)}</span>
          </span>
        </div>`
      })
      .join('')}
  `

  return { strategic, forward, actions }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
