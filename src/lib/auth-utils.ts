import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { TokenVerifier } from './auth'

export interface CurrentUser {
  userId: string
  email: string
  name?: string
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies()
    const idToken = cookieStore.get('idToken')?.value
    const accessToken = cookieStore.get('accessToken')?.value

    if (!idToken && !accessToken) {
      return null
    }

    // Create a mock NextRequest with the token cookies
    const headers = new Headers()
    if (idToken || accessToken) {
      const cookieString = [
        idToken ? `idToken=${idToken}` : '',
        accessToken ? `accessToken=${accessToken}` : '',
      ]
        .filter(Boolean)
        .join('; ')
      headers.set('cookie', cookieString)
    }

    const mockRequest = new NextRequest('http://localhost/', { headers })

    try {
      // Use the shared TokenVerifier
      const result = await TokenVerifier.verify(mockRequest)

      // For id token, we get the full payload, for access token we only get userId
      if (result.payload) {
        return {
          userId: result.userId,
          email: (result.payload.email as string) || '',
          name: (result.payload.name as string) || undefined,
        }
      } else {
        // Access token only provides userId
        return {
          userId: result.userId,
          email: '', // Email not available in access token
          name: undefined,
        }
      }
    } catch (verifyError: any) {
      // Log specific error for debugging
      console.error('Token verification failed in getCurrentUser:', verifyError?.message)

      // If JWKS is temporarily unavailable, we might want to handle it gracefully
      if (verifyError?.message?.includes('JWKS verification temporarily unavailable')) {
        console.log('JWKS temporarily unavailable, returning null user')
      }

      return null
    }
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}
