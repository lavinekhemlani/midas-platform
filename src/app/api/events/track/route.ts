// src/app/api/events/track/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { headers } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { events } = await request.json()

    // Note: User context removed as Amplify isn't configured on client-side
    // Events are tracked anonymously for now
    // TODO: Consider passing user info from client if needed

    // Get client info from headers - properly await in Next.js 15
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || 'unknown'
    const referer = headersList.get('referer') || 'unknown'

    // Log each event with appropriate level
    for (const event of events) {
      const metadata = {
        ...event.metadata,
        userAgent,
        referer,
        clientTime: new Date().toISOString(),
      }

      // Remove undefined values
      Object.keys(metadata).forEach((key) => {
        if (metadata[key] === undefined) {
          delete metadata[key]
        }
      })

      // Log based on event type
      switch (event.type) {
        case 'error':
          logger.error(event.event, { workflow: 'user_interaction', ...metadata })
          break
        case 'button_click':
        case 'form_submit':
          logger.info(event.event, { workflow: 'user_interaction', ...metadata })
          break
        case 'page_view':
          logger.debug(event.event, { workflow: 'user_interaction', ...metadata })
          break
        case 'success':
          logger.info(event.event, { workflow: 'user_interaction', ...metadata })
          break
        default:
          logger.debug(event.event, { workflow: 'user_interaction', ...metadata })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to track client events', { error })
    return NextResponse.json({ error: 'Failed to track events' }, { status: 500 })
  }
}
