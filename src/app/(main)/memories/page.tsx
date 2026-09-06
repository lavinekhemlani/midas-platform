// src/app/(main)/memories/page.tsx
'use client'

import MemoryViewer from '@/app/(main)/components/memory/MemoryViewer'

export default function MemoriesPage() {
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Minimal Header */}
      <div className="mb-8 shrink-0">
        <h1 className="text-4xl font-serif font-light theme-text-primary">Memories</h1>
        <p className="text-sm theme-text-secondary mt-1">
          Things your AI remembers about your business
        </p>
      </div>

      {/* Memory Viewer - Full Width */}
      <div className="flex-1 min-h-0">
        <MemoryViewer />
      </div>
    </div>
  )
}
