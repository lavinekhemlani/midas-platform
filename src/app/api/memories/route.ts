// src/app/api/memories/route.ts
// REST API for user memories - uses simplified MemoryService
// Uses withActiveProvider for consistent organization context (same as chat)

import { NextRequest, NextResponse } from 'next/server'
import { withActiveProvider } from '@/lib/providers/withActiveProvider'
import { MemoryService } from '@/ai/memory/memoryService'
import { LEGACY_TYPE_MAP, MEMORY_TYPE_LABELS } from '@/ai/memory/types'
import type { MemoryType } from '@/ai/memory/types'

/**
 * GET /api/memories
 * Fetch memories with optional filters
 * Uses realmId (QuickBooks company ID) for scoping, same as chat history
 */
export const GET = withActiveProvider(async (request, { userId, organizationId, realmId }) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const rawType = searchParams.get('type')
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const searchQuery = searchParams.get('q') || undefined

    // Map legacy type if needed
    const type = rawType && rawType !== 'all' ? (LEGACY_TYPE_MAP[rawType] as MemoryType) : undefined

    // Pass realmId for QuickBooks company-scoped memories (like chat history)
    const service = new MemoryService(userId, organizationId, realmId)
    const memories = await service.search({
      type,
      includeArchived,
      limit,
      searchQuery,
    })

    // Add labels for frontend display
    const memoriesWithLabels = memories.map((m) => ({
      ...m,
      typeLabel: MEMORY_TYPE_LABELS[m.type],
    }))

    return NextResponse.json({ memories: memoriesWithLabels })
  } catch (error) {
    console.error('[Memories API] GET error:', error)
    return handleError(error)
  }
})

/**
 * POST /api/memories
 * Create a new memory
 * Uses realmId (QuickBooks company ID) for scoping, same as chat history
 */
export const POST = withActiveProvider(async (request, { userId, organizationId, realmId }) => {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.type || !body.content) {
      return NextResponse.json({ error: 'Both type and content are required' }, { status: 400 })
    }

    // Map legacy type if needed
    const type = LEGACY_TYPE_MAP[body.type] as MemoryType
    if (!type) {
      return NextResponse.json({ error: `Invalid memory type: ${body.type}` }, { status: 400 })
    }

    // Pass realmId for QuickBooks company-scoped memories (like chat history)
    const service = new MemoryService(userId, organizationId, realmId)
    const memory = await service.create({
      type,
      content: body.content,
      metadata: body.metadata || {},
      relevanceScore: body.relevanceScore,
      source: body.source || 'user',
    })

    return NextResponse.json({
      memory: {
        ...memory,
        typeLabel: MEMORY_TYPE_LABELS[memory.type],
      },
    })
  } catch (error) {
    console.error('[Memories API] POST error:', error)
    return handleError(error)
  }
})

/**
 * PUT /api/memories
 * Update an existing memory
 * Uses realmId (QuickBooks company ID) for scoping, same as chat history
 */
export const PUT = withActiveProvider(async (request, { userId, organizationId, realmId }) => {
  try {
    const body = await request.json()
    const { id, content, metadata, archived } = body

    if (!id) {
      return NextResponse.json({ error: 'Memory ID required' }, { status: 400 })
    }

    // Pass realmId for QuickBooks company-scoped memories (like chat history)
    const service = new MemoryService(userId, organizationId, realmId)
    const updated = await service.update(id, {
      content,
      metadata,
      archived,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 })
    }

    return NextResponse.json({
      memory: {
        ...updated,
        typeLabel: MEMORY_TYPE_LABELS[updated.type],
      },
    })
  } catch (error) {
    console.error('[Memories API] PUT error:', error)
    return handleError(error)
  }
})

/**
 * DELETE /api/memories
 * Delete a memory permanently
 * Uses realmId (QuickBooks company ID) for scoping, same as chat history
 */
export const DELETE = withActiveProvider(async (request, { userId, organizationId, realmId }) => {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Memory ID required' }, { status: 400 })
    }

    // Pass realmId for QuickBooks company-scoped memories (like chat history)
    const service = new MemoryService(userId, organizationId, realmId)
    const deleted = await service.delete(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Memory not found or already deleted' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Memories API] DELETE error:', error)
    return handleError(error)
  }
})

/**
 * Common error handler
 */
function handleError(error: unknown): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  // Check for auth errors
  if (errorMessage.includes('Authentication') || errorMessage.includes('token')) {
    return NextResponse.json(
      { error: 'Authentication required', details: errorMessage },
      { status: 401 }
    )
  }

  return NextResponse.json({ error: 'Request failed', details: errorMessage }, { status: 500 })
}
