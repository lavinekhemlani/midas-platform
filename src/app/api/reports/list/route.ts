// src/app/api/reports/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TokenVerifier } from '@/lib/auth'
import { listUserReports } from '@/lib/reportStorage'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await TokenVerifier.verify(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    console.log('[Reports List API] Listing reports for userId:', userId)

    const reports = await listUserReports(userId, 20)

    return NextResponse.json({
      userId,
      count: reports.length,
      reports,
    })
  } catch (error) {
    console.error('[Reports List API] Error:', error)
    return NextResponse.json({ error: 'Failed to list reports' }, { status: 500 })
  }
}
