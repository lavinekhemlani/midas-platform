// src/ai/tools/ui-action.ts
// UI action tool for controlling application interface from chat

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { ROUTE_MAPPINGS, getPageNameFromPath } from '../types/ui-action'
import type { UIAction, UIActionProposal } from '../types/ui-action'

export const uiAction = tool(
  async (input) => {
    const actions: UIAction[] = []
    let description = ''

    switch (input.actionType) {
      case 'theme': {
        const theme = input.theme || 'dark'
        actions.push({
          actionType: 'theme',
          payload: { theme },
          description: `Switch to ${theme} mode`,
        })
        description = `Switching to ${theme} mode`
        break
      }

      case 'navigate': {
        let path = input.path
        if (input.page && !path) {
          const normalized = input.page.toLowerCase().trim()
          path = ROUTE_MAPPINGS[normalized]
          if (!path) {
            // Try partial match
            const match = Object.entries(ROUTE_MAPPINGS).find(
              ([key]) => key.includes(normalized) || normalized.includes(key)
            )
            path = match?.[1]
          }
          if (!path) {
            return JSON.stringify({
              success: false,
              error: `Unknown page: "${input.page}". Available: ${Object.keys(ROUTE_MAPPINGS).join(', ')}`,
            })
          }
        }
        if (!path) {
          return JSON.stringify({
            success: false,
            error: 'No path or page specified for navigation',
          })
        }
        const pageName = getPageNameFromPath(path)
        actions.push({
          actionType: 'navigate',
          payload: { path, transitionType: 'top-down-sweep' as const },
          description: `Navigate to ${pageName}`,
        })
        description = `Navigating to ${pageName}`
        break
      }

      case 'sidebar': {
        const rawSidebar = (input.sidebarAction || 'toggle').toLowerCase().trim()
        const sidebarAction =
          rawSidebar.includes('open') ||
          rawSidebar.includes('expand') ||
          rawSidebar.includes('show')
            ? 'expand'
            : rawSidebar.includes('close') ||
                rawSidebar.includes('collapse') ||
                rawSidebar.includes('hide')
              ? 'collapse'
              : 'toggle'
        actions.push({
          actionType: 'sidebar',
          payload: { action: sidebarAction },
          description: `${sidebarAction.charAt(0).toUpperCase() + sidebarAction.slice(1)} sidebar`,
        })
        description = `${sidebarAction === 'toggle' ? 'Toggling' : sidebarAction === 'expand' ? 'Expanding' : 'Collapsing'} sidebar`
        break
      }

      case 'chat_panel': {
        const raw = (input.chatPanelAction || 'toggle').toLowerCase().trim()
        // Normalize natural language to valid actions
        const chatAction =
          raw.includes('full') || raw.includes('expand') || raw.includes('maximize')
            ? 'fullscreen'
            : raw.includes('dock') ||
                raw.includes('collapse') ||
                raw.includes('minimize') ||
                raw.includes('restore')
              ? 'dock'
              : raw.includes('open')
                ? 'open'
                : raw.includes('close') || raw.includes('hide')
                  ? 'close'
                  : raw.includes('toggle')
                    ? 'toggle'
                    : (raw as any)
        const actionLabels: Record<string, string> = {
          open: 'Opening',
          close: 'Closing',
          toggle: 'Toggling',
          dock: 'Docking',
          fullscreen: 'Expanding to fullscreen',
        }
        actions.push({
          actionType: 'chat_panel',
          payload: { action: chatAction },
          description: `${actionLabels[chatAction] || chatAction} chat panel`,
        })
        description = `${actionLabels[chatAction] || chatAction} chat panel`
        break
      }

      case 'settings': {
        const settingName = input.settingName
        const settingValue = input.settingValue

        if (!settingName) {
          return JSON.stringify({
            success: false,
            error:
              'No setting name specified. Available: pii_mode, proficiency_level, revenue_model',
          })
        }

        if (settingValue === undefined || settingValue === null) {
          return JSON.stringify({
            success: false,
            error: `No value specified for setting "${settingName}"`,
          })
        }

        if (settingName === 'pii_mode' && typeof settingValue !== 'boolean') {
          return JSON.stringify({
            success: false,
            error: 'pii_mode must be true or false',
          })
        }

        if (
          settingName === 'proficiency_level' &&
          !['beginner', 'intermediate', 'expert'].includes(settingValue as string)
        ) {
          return JSON.stringify({
            success: false,
            error: 'proficiency_level must be beginner, intermediate, or expert',
          })
        }

        const settingLabels: Record<string, string> = {
          pii_mode: `${settingValue ? 'Enabling' : 'Disabling'} PII protection`,
          proficiency_level: `Setting proficiency level to ${settingValue}`,
          revenue_model: `Setting revenue model to ${settingValue}`,
        }

        actions.push({
          actionType: 'settings',
          payload: { setting: settingName, value: settingValue },
          description: settingLabels[settingName] || `Updating ${settingName}`,
        })
        description = settingLabels[settingName] || `Updating ${settingName}`
        break
      }

      case 'download_chat': {
        const count = input.downloadCount || 1
        actions.push({
          actionType: 'download_chat',
          payload: { count },
          description: `Downloading ${count === 1 ? 'last response' : `last ${count} responses`} as PDF`,
        })
        description = `Downloading ${count === 1 ? 'last response' : `last ${count} responses`} as PDF`
        break
      }

      default:
        return JSON.stringify({
          success: false,
          error: `Action type "${input.actionType}" is not yet supported.`,
        })
    }

    if (actions.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No valid action could be created',
      })
    }

    const proposal: UIActionProposal = {
      proposalId: crypto.randomUUID(),
      actions,
      confirmationMessage: description,
    }

    return JSON.stringify({
      success: true,
      uiActionProposal: proposal,
      message: description,
    })
  },
  {
    name: 'ui_action',
    description:
      'Control the application UI: switch theme, navigate to a page, toggle sidebar, control the chat panel, or download chat responses as PDF. Use when the user asks to change the interface or download responses.',
    schema: z.object({
      actionType: z
        .enum(['theme', 'navigate', 'sidebar', 'chat_panel', 'settings', 'download_chat'])
        .describe('The type of UI action to perform'),
      theme: z.enum(['light', 'dark']).optional().describe('Target theme (for theme actions)'),
      page: z
        .string()
        .optional()
        .describe(
          'Page name to navigate to (e.g., "P&L", "balance sheet", "cash flow", "sales", "expenses", "forecasting", "settings")'
        ),
      path: z.string().optional().describe('Direct URL path to navigate to (e.g., "/reports/pnl")'),
      sidebarAction: z.string().optional().describe('Sidebar action: expand, collapse, or toggle'),
      chatPanelAction: z
        .string()
        .optional()
        .describe('Chat panel action: open, close, toggle, dock, or fullscreen'),
      settingName: z
        .enum(['pii_mode', 'proficiency_level', 'revenue_model'])
        .optional()
        .describe('Setting to change (for settings actions)'),
      settingValue: z
        .union([z.boolean(), z.string()])
        .optional()
        .describe(
          'New value for the setting. Boolean for pii_mode, string for proficiency_level (beginner/intermediate/expert) or revenue_model'
        ),
      downloadCount: z
        .number()
        .optional()
        .describe('Number of recent responses to download as PDF (default 1)'),
    }),
  }
)
