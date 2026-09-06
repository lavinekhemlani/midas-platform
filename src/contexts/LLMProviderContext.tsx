// src/contexts/LLMProviderContext.tsx
// Simplified LLM provider context - Groq only
'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { MODEL_CONFIG, LLMProvider, LLMModel } from '@/lib/llm'

interface LLMProviderContextType {
  provider: LLMProvider
  model: LLMModel
  modelConfig: typeof MODEL_CONFIG
}

const LLMProviderContext = createContext<LLMProviderContextType | undefined>(undefined)

export function LLMProviderProvider({ children }: { children: ReactNode }) {
  // Single provider/model - no state needed
  const value: LLMProviderContextType = {
    provider: 'groq',
    model: MODEL_CONFIG.name,
    modelConfig: MODEL_CONFIG,
  }

  return <LLMProviderContext.Provider value={value}>{children}</LLMProviderContext.Provider>
}

export function useLLMProvider() {
  const context = useContext(LLMProviderContext)
  if (!context) {
    throw new Error('useLLMProvider must be used within LLMProviderProvider')
  }
  return context
}
