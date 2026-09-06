import { NextRequest, NextResponse } from 'next/server'
import { getActiveProviderForUser } from '@/lib/providers/active-provider'
import { TokenVerifier } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await TokenVerifier.verify(request)

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active provider for the user
    const activeProvider = await getActiveProviderForUser(userId)

    return NextResponse.json({
      activeProvider,
      success: true,
    })
  } catch (error) {
    console.error('Error getting active provider:', error)
    return NextResponse.json({ error: 'Failed to get active provider' }, { status: 500 })
  }
}
