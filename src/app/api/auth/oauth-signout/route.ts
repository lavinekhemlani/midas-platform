// src/app/api/auth/oauth-signout/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Clear cookies server-side
    const response = NextResponse.redirect(new URL('/', req.url));
    
    // Construct the Cognito logout URL
    const cognitoDomain = 'https://us-east-1mcfbx9eit.auth.us-east-1.amazoncognito.com';
    const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const logoutUri = encodeURIComponent(appUrl + '/');
    
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
    
    // Clear auth cookies
    response.cookies.delete('accessToken');
    response.cookies.delete('idToken');
    response.cookies.delete('refreshToken');
    
    // Redirect to Cognito logout
    return NextResponse.redirect(logoutUrl);
    
  } catch (error) {
    console.error('OAuth signout error:', error);
    // On error, just redirect to home
    return NextResponse.redirect(new URL('/', req.url));
  }
}

export async function POST(req: NextRequest) {
  // Also support POST for flexibility
  return GET(req);
}