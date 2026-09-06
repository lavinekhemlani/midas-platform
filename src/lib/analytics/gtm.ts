/**
 * Google Tag Manager (GTM) Analytics Utility
 *
 * This module provides type-safe functions for tracking events through GTM's dataLayer.
 * Events are sent to Google Analytics and can be forwarded to other platforms like Facebook Ads.
 *
 * @see https://developers.google.com/tag-platform/tag-manager/datalayer
 */

// Extend window object to include dataLayer
declare global {
  interface Window {
    dataLayer: any[]
  }
}

/**
 * Base GTM event interface
 */
interface GTMEvent {
  event: string
  timestamp: string
  [key: string]: any
}

/**
 * Push an event to the GTM dataLayer
 *
 * @param eventName - The name of the event (e.g., 'signup_started')
 * @param eventData - Additional event parameters
 */
export function pushToDataLayer(eventName: string, eventData?: Record<string, any>) {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    console.warn('[GTM] Attempted to push event in non-browser environment:', eventName)
    return
  }

  // Initialize dataLayer if it doesn't exist
  window.dataLayer = window.dataLayer || []

  // Construct the event object
  const event: GTMEvent = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...eventData,
  }

  // Push to dataLayer
  window.dataLayer.push(event)

  // Log for debugging (remove in production if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('[GTM Event]', event)
  }
}

/**
 * Track when a user initiates the signup process
 *
 * @param method - The signup method used ('email' or 'google')
 */
export function trackSignupStarted(method: 'email' | 'google') {
  pushToDataLayer('signup_started', {
    signup_method: method,
  })
}

/**
 * Track when a user successfully validates their OTP/email
 *
 * @param email - The user's email address (anonymized in GTM if needed)
 */
export function trackOTPValidated(email: string) {
  pushToDataLayer('otp_validated', {
    user_email: email,
  })
}

/**
 * Track when a user completes their profile (personal info + organization details)
 *
 * @param userId - Anonymized user identifier (UUID)
 * @param organizationId - Anonymized organization identifier (UUID)
 */
export function trackProfileCompletion(userId: string, organizationId: string) {
  pushToDataLayer('profile_completion', {
    user_id: userId,
    organization_id: organizationId,
  })
}

/**
 * Track when a user connects a financial data provider
 *
 * @param provider - The provider name (e.g., 'quickbooks', 'zoho', 'xero')
 * @param organizationId - Anonymized organization identifier (UUID)
 */
export function trackProviderConnected(provider: string, organizationId: string) {
  // Use 'qb_connected' for QuickBooks, or dynamic event name for other providers
  const eventName = provider === 'quickbooks' ? 'qb_connected' : `${provider}_connected`

  pushToDataLayer(eventName, {
    provider_name: provider,
    organization_id: organizationId,
  })
}

/**
 * Track when a user completes the entire signup/onboarding process
 *
 * @param userId - Anonymized user identifier (UUID)
 * @param organizationId - Anonymized organization identifier (UUID)
 */
export function trackSignupComplete(userId: string, organizationId: string) {
  pushToDataLayer('sign_up', {
    user_id: userId,
    organization_id: organizationId,
    onboarding_completed: true,
  })
}

// =============================================================================
// FUTURE PURCHASE EVENTS (for e-commerce tracking)
// =============================================================================

/**
 * Track when a user adds an item to cart
 *
 * @param itemId - The product/item identifier
 * @param itemName - The product/item name
 * @param price - The item price
 * @param currency - Currency code (default: 'USD')
 */
export function trackAddToCart(
  itemId: string,
  itemName: string,
  price: number,
  currency: string = 'USD'
) {
  pushToDataLayer('add_to_cart', {
    currency,
    value: price,
    items: [
      {
        item_id: itemId,
        item_name: itemName,
        price,
      },
    ],
  })
}

/**
 * Track when a user adds payment information
 *
 * @param paymentType - The payment method type (e.g., 'credit_card', 'paypal')
 */
export function trackAddPaymentInfo(paymentType: string) {
  pushToDataLayer('add_payment_info', {
    payment_type: paymentType,
  })
}

/**
 * Track when a purchase is completed
 *
 * @param transactionId - Unique transaction identifier
 * @param value - Total transaction value
 * @param currency - Currency code (default: 'USD')
 * @param items - Array of purchased items
 */
export function trackPurchase(
  transactionId: string,
  value: number,
  currency: string = 'USD',
  items?: Array<{ item_id: string; item_name: string; price: number }>
) {
  pushToDataLayer('purchase', {
    transaction_id: transactionId,
    value,
    currency,
    items: items || [],
  })
}
