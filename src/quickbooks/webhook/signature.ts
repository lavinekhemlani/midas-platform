/**
 * QuickBooks Webhook Signature Verification
 * HMAC-SHA256 signature verification for webhook payloads
 */

import crypto from 'crypto'

/**
 * Verify webhook signature using HMAC-SHA256
 *
 * @param payload - Raw webhook payload string
 * @param signature - Signature from intuit-signature header
 * @param webhookVerifierToken - Your app's webhook verifier token
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookVerifierToken: string
): boolean {
  if (!payload || !signature || !webhookVerifierToken) {
    return false
  }

  try {
    const hash = crypto.createHmac('sha256', webhookVerifierToken).update(payload).digest('base64')

    const signatureBuffer = Buffer.from(signature)
    const hashBuffer = Buffer.from(hash)

    // Check lengths first - timingSafeEqual throws if lengths differ
    if (signatureBuffer.length !== hashBuffer.length) {
      return false
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(signatureBuffer, hashBuffer)
  } catch {
    return false
  }
}

/**
 * Create a signature for testing purposes
 *
 * @param payload - Payload to sign
 * @param webhookVerifierToken - Verifier token
 * @returns Base64-encoded HMAC-SHA256 signature
 */
export function createWebhookSignature(payload: string, webhookVerifierToken: string): string {
  return crypto.createHmac('sha256', webhookVerifierToken).update(payload).digest('base64')
}
