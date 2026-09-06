// src/app/api/chatHistory/route.ts
/**
 * GET endpoint for chat history with pagination support
 * Chat history is unified across all QB entities (not scoped by realmId)
 * Query params:
 *  - n: number of messages (for backward compatibility)
 *  - limit: number of messages to fetch (default 20)
 *  - before: timestamp cursor for pagination (fetch messages before this timestamp)
 *  - paginated: boolean flag to use paginated response format
 */

import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { fetchLastN, fetchPaginatedMessages, clearUserChatHistory } from '@/lib/chatHistory'
import { getUserOrganizationId } from '@/lib/zoho-dynamo'
import { clearThreadState } from '@/ai/checkpointer'

export async function GET(req: NextRequest) {
  try {
    // Use unified auth system
    const { userId } = await TokenVerifier.verify(req)

    if (!userId) {
      return new NextResponse('Unauthenticated: User ID not found in token', { status: 401 })
    }

    const url = new URL(req.url)
    const searchParams = url.searchParams

    // Check if paginated mode is requested
    const isPaginated = searchParams.get('paginated') === 'true'

    if (isPaginated) {
      // Use new pagination logic
      const limit = Number(searchParams.get('limit') ?? '20')
      const beforeParam = searchParams.get('before')
      const beforeTimestamp = beforeParam ? Number(beforeParam) : undefined

      // Validate parameters
      if (beforeParam && (isNaN(beforeTimestamp!) || beforeTimestamp! <= 0)) {
        return new NextResponse('Invalid before timestamp', { status: 400 })
      }

      if (limit <= 0 || limit > 100) {
        return new NextResponse('Invalid limit (must be between 1 and 100)', { status: 400 })
      }

      const result = await fetchPaginatedMessages(userId, limit, beforeTimestamp)

      return NextResponse.json({
        messages: result.messages,
        hasMore: result.hasMore,
        oldestTimestamp: result.oldestTimestamp,
      })
    } else {
      // Use legacy logic for backward compatibility
      const n = Number(searchParams.get('n') ?? '20')
      const history = await fetchLastN(userId, n)

      return NextResponse.json({ history })
    }
  } catch (error) {
    console.error('Chat History fetch error:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return new NextResponse('Unauthenticated', { status: 401 })
    }
    return new NextResponse('Failed to fetch history', { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await TokenVerifier.verify(req)

    if (!userId) {
      return new NextResponse('Unauthenticated', { status: 401 })
    }

    const result = await clearUserChatHistory(userId)

    // Clear checkpointer state for this thread to ensure fresh agent state
    try {
      const orgId = await getUserOrganizationId(userId)
      if (orgId) {
        const threadId = `${userId}_${orgId}`
        await clearThreadState(threadId)
      }
    } catch (err) {
      // Log but don't fail the delete - DynamoDB clear already succeeded
      console.warn('[ChatHistory] Failed to clear checkpointer state:', err)
    }

    return NextResponse.json({ success: true, deleted: result.deleted })
  } catch (error) {
    console.error('Chat History clear error:', error)
    if (
      error instanceof Error &&
      (error.message.includes('Token is not valid') ||
        error.message.includes('Authorization header is missing'))
    ) {
      return new NextResponse('Unauthenticated', { status: 401 })
    }
    return new NextResponse('Failed to clear history', { status: 500 })
  }
}
