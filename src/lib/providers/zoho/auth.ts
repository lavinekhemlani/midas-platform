// src/lib/providers/zoho/auth.ts
// Zoho authentication provider implementation

import { AuthAndTokenProvider, TokenSet } from '../interfaces/auth';

/**
 * Zoho authentication provider implementation
 * This implements the AuthAndTokenProvider interface for Zoho Books
 */
export const auth: AuthAndTokenProvider = {
  getLoginUrl: (state: string): string => {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const domain = process.env.ZOHO_DOMAIN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    // const zohoCallbackPath = process.env.ZOHO_CALLBACK_PATH;

    if (!clientId || !domain) {
      throw new Error('Zoho configuration missing: Please check ZOHO_CLIENT_ID, ZOHO_DOMAIN environment variables');
    }
    if (!appUrl) {
      throw new Error('Application URL not configured: Please set NEXT_PUBLIC_APP_URL environment variable');
    }
    // if (!zohoCallbackPath) {
    //   throw new Error('Zoho callback path not configured: Please set ZOHO_CALLBACK_PATH environment variable');
    // }

    // Use the generic provider callback URL
    const redirectUri = `${appUrl}/api/providers/callback`;

    const qs = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'ZohoBooks.fullaccess.all',
      access_type: 'offline',
      redirect_uri: redirectUri,
      prompt: 'consent',
      state: state,
    });

    return `https://${domain}/oauth/v2/auth?${qs}`;
  },

  handleCallback: async (code: string, state: string): Promise<TokenSet> => {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const domain = process.env.ZOHO_DOMAIN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !clientSecret || !domain) {
      throw new Error('Zoho configuration missing: Please check ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_DOMAIN environment variables');
    }
    if (!appUrl) {
      throw new Error('Application URL not configured: Please set NEXT_PUBLIC_APP_URL environment variable');
    }

    // Use the generic provider callback URL
    const redirectUri = `${appUrl}/api/providers/callback`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    // Add timeout and retry logic for slow connections
    let tokenResponse;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        tokenResponse = await fetch(`https://${domain}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        break; // Success, exit loop
      } catch (error: any) {
        console.log(`OAuth token exchange attempt ${attempts} failed:`, error.message);

        if (attempts >= maxAttempts) {
          throw new Error(`Failed to exchange OAuth token after ${maxAttempts} attempts: ${error.message}`);
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!tokenResponse) {
      throw new Error('No response received from Zoho OAuth server');
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      createdAt: Math.floor(Date.now() / 1000),
    };
  },

  refreshAccessToken: async (refreshToken: string): Promise<TokenSet> => {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const domain = process.env.ZOHO_DOMAIN;

    if (!clientId || !clientSecret || !domain) {
      throw new Error('Zoho configuration missing: Please check environment variables');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Add timeout and retry logic for refresh token
    let tokenResponse;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        tokenResponse = await fetch(`https://${domain}/oauth/v2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        break; // Success, exit loop
      } catch (error: any) {
        console.log(`Refresh token attempt ${attempts} failed:`, error.message);

        if (attempts >= maxAttempts) {
          throw new Error(`Failed to refresh token after ${maxAttempts} attempts: ${error.message}`);
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    if (!tokenResponse) {
      throw new Error('No response received from Zoho OAuth server during refresh');
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Some providers don't return new refresh token
      expiresIn: tokenData.expires_in,
      createdAt: Math.floor(Date.now() / 1000),
    };
  },

  disconnect: async (accessToken: string): Promise<void> => {
    const domain = process.env.ZOHO_DOMAIN;

    if (!domain) {
      throw new Error('Zoho configuration missing: ZOHO_DOMAIN not set');
    }

    // Revoke the access token with Zoho
    try {
      const response = await fetch(`https://${domain}/oauth/v2/token/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }),
      });

      if (!response.ok) {
        console.warn('Failed to revoke Zoho token:', await response.text());
        // Don't throw error here as the token might already be invalid
      }
    } catch (error) {
      console.warn('Error revoking Zoho token:', error);
      // Don't throw error here as disconnection should still proceed
    }
  },

  getTokens: async (): Promise<TokenSet | null> => {
    // This method is typically implemented at a higher level
    // since it requires organization context and database access
    throw new Error('getTokens should be implemented at the provider handler level');
  }
};
