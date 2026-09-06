// src/lib/cognito-auth.ts
import { TokenVerifier } from './auth'
import { NextRequest } from 'next/server'

/**
 * Verifies the Cognito JWT from cookies or Authorization header of a NextRequest.
 * @deprecated Use TokenVerifier.verify() from auth instead
 */
export async function verifyCognitoToken(
  request: NextRequest
): Promise<{ userId: string; cognitoPayload?: any }> {
  const result = await TokenVerifier.verify(request)
  return {
    userId: result.userId,
    cognitoPayload: result.payload,
  }
}
