// src/app/api/auth/signout/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ 
    success: true, 
    message: 'Signed out successfully' 
  });
  
  // Clear auth cookies server-side
  const expired = `; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  response.headers.append('Set-Cookie', `accessToken=${expired}`);
  response.headers.append('Set-Cookie', `idToken=${expired}`);
  
  return response;
}