/**
 * QuickBooks API OpenAPI Specification
 * Used by Scalar API Reference for documentation and testing
 */

import type { OpenAPIV3 } from 'openapi-types'

export const quickbooksOpenApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'QuickBooks ETL API',
    version: '1.0.0',
    description: `
QuickBooks Online integration API for real-time data synchronization.

## 🔐 Authentication Required

**This API requires authentication.** Follow these steps before testing:

### Step 1: Sign In
1. Open a new browser tab and go to [/sign-in](/sign-in)
2. Sign in with your email/password or Google
3. You should be redirected to the main app

### Step 2: Test API Calls
Once signed in, your browser has the required auth cookies. You can now:
- Use this Scalar UI to test endpoints (cookies are automatically included)
- Or use browser DevTools > Network tab to copy requests as cURL

### Step 3: Get Your Organization ID
After signing in, your organization ID is needed for most endpoints.
You can find it in the URL or by calling \`/api/auth/callback\`.

---

## QuickBooks OAuth Flow
1. Call \`/api/quickbooks/connect\` with organizationId to start OAuth
2. User authorizes on QuickBooks
3. Callback saves tokens automatically
4. Use \`/api/quickbooks/status\` to verify connection

## Webhook Integration
QuickBooks sends real-time notifications to \`/api/quickbooks/webhook\` when data changes.
Configure your webhook URL in the [QuickBooks Developer Portal](https://developer.intuit.com).

## Supported Entities
Invoice, Bill, Payment, BillPayment, Customer, Vendor, Account, Item,
Deposit, Transfer, JournalEntry, Purchase, PurchaseOrder, VendorCredit,
Estimate, SalesReceipt, CreditMemo, RefundReceipt, Class, Department,
Employee, Term, PaymentMethod, TaxCode, TaxRate, TimeActivity
    `.trim(),
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Current environment',
    },
  ],
  tags: [
    {
      name: 'User Auth',
      description: 'User authentication (sign in required before using other endpoints)',
    },
    { name: 'QuickBooks OAuth', description: 'QuickBooks connection and token management' },
    { name: 'Webhook', description: 'Real-time event notifications from QuickBooks' },
    { name: 'Sync', description: 'Manual data synchronization operations' },
  ],
  paths: {
    '/sign-in': {
      get: {
        tags: ['User Auth'],
        summary: 'Sign In Page',
        description: `
**Open this in a browser tab to authenticate.**

This is not an API endpoint - it's a web page where you sign in with:
- Email + Password (AWS Cognito)
- Google OAuth

After signing in, your browser will have auth cookies that work with this API tester.
        `.trim(),
        operationId: 'signInPage',
        responses: {
          '200': {
            description: 'Sign-in page HTML',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/sign-up': {
      get: {
        tags: ['User Auth'],
        summary: 'Sign Up Page',
        description: `
**Open this in a browser tab to create an account.**

Create a new account with email/password or Google.
        `.trim(),
        operationId: 'signUpPage',
        responses: {
          '200': {
            description: 'Sign-up page HTML',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/auth/callback': {
      get: {
        tags: ['User Auth'],
        summary: 'Check auth status',
        description:
          'Verify if current session is authenticated and get user info. Use this to confirm you are logged in and get your user ID.',
        operationId: 'checkAuthStatus',
        responses: {
          '200': {
            description: 'Authenticated - returns user info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    redirectUrl: { type: 'string', example: '/reports' },
                    requiresOnboarding: { type: 'boolean', example: false },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Not authenticated - need to sign in first',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Authentication failed' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/auth/signout': {
      post: {
        tags: ['User Auth'],
        summary: 'Sign out',
        description: 'Sign out and clear auth cookies.',
        operationId: 'signOut',
        responses: {
          '200': {
            description: 'Successfully signed out',
          },
        },
      },
    },
    '/api/quickbooks/connect': {
      get: {
        tags: ['QuickBooks OAuth'],
        summary: 'Start OAuth flow',
        description: `
**⚠️ Open this URL in a browser tab - don't use the API tester.**

This endpoint redirects to QuickBooks for authorization. The API tester will show "failed to fetch" because it can't follow OAuth redirects.

**How to test:**
1. Copy the URL with your organizationId
2. Open it in a new browser tab
3. Authorize in QuickBooks
4. You'll be redirected back to the callback

After authorization, use \`/api/quickbooks/status\` to verify the connection.
        `.trim(),
        operationId: 'startOAuthFlow',
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            required: true,
            description: 'Your internal organization/tenant ID',
            schema: { type: 'string' },
            example: 'org_123456',
          },
        ],
        responses: {
          '302': {
            description: 'Redirect to QuickBooks authorization page',
            headers: {
              Location: {
                description: 'QuickBooks OAuth authorization URL',
                schema: { type: 'string' },
              },
            },
          },
          '400': {
            description: 'Missing organizationId parameter',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/quickbooks/callback': {
      get: {
        tags: ['QuickBooks OAuth'],
        summary: 'OAuth callback',
        description:
          'Handles OAuth callback from QuickBooks. Exchanges authorization code for tokens and stores them.',
        operationId: 'handleOAuthCallback',
        parameters: [
          {
            name: 'code',
            in: 'query',
            required: true,
            description: 'Authorization code from QuickBooks',
            schema: { type: 'string' },
          },
          {
            name: 'state',
            in: 'query',
            required: true,
            description: 'State parameter for CSRF validation',
            schema: { type: 'string' },
          },
          {
            name: 'realmId',
            in: 'query',
            required: true,
            description: 'QuickBooks company/realm ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '302': {
            description: 'Redirect to success page',
          },
          '400': {
            description: 'Invalid state or missing parameters',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/quickbooks/disconnect': {
      post: {
        tags: ['QuickBooks OAuth'],
        summary: 'Disconnect QuickBooks',
        description: 'Revokes OAuth tokens and disconnects the QuickBooks integration.',
        operationId: 'disconnectQuickBooks',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['organizationId'],
                properties: {
                  organizationId: {
                    type: 'string',
                    description: 'Organization to disconnect',
                    example: 'org_123456',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully disconnected',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'QuickBooks disconnected successfully' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing organizationId',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/quickbooks/status': {
      get: {
        tags: ['QuickBooks OAuth'],
        summary: 'Check connection status',
        description: 'Returns the current QuickBooks connection status for an organization.',
        operationId: 'getConnectionStatus',
        parameters: [
          {
            name: 'organizationId',
            in: 'query',
            required: true,
            description: 'Organization to check',
            schema: { type: 'string' },
            example: 'org_123456',
          },
        ],
        responses: {
          '200': {
            description: 'Connection status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: { type: 'boolean', example: true },
                    realmId: { type: 'string', example: '1234567890' },
                    companyName: { type: 'string', example: 'Acme Corp' },
                    lastSync: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Missing organizationId',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/quickbooks/webhook': {
      get: {
        tags: ['Webhook'],
        summary: 'Webhook verification',
        description: 'Handles webhook verification challenge from QuickBooks during setup.',
        operationId: 'verifyWebhook',
        parameters: [
          {
            name: 'challenge',
            in: 'query',
            required: false,
            description: 'Challenge string to echo back for verification',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Challenge echoed or health check',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'quickbooks-webhook' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Webhook'],
        summary: 'Receive webhook events',
        description: `
Receives real-time notifications from QuickBooks when data changes.

**Signature Verification**: All requests are verified using HMAC-SHA256 signature in the \`intuit-signature\` header.

**Event Types**: Create, Update, Delete, Merge, Void

**Response Time**: Must respond within 3 seconds or QuickBooks will retry.
        `.trim(),
        operationId: 'receiveWebhookEvents',
        parameters: [
          {
            name: 'intuit-signature',
            in: 'header',
            required: true,
            description: 'HMAC-SHA256 signature for payload verification',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookPayload' },
              example: {
                eventNotifications: [
                  {
                    realmId: '1234567890',
                    dataChangeEvent: {
                      entities: [
                        {
                          name: 'Invoice',
                          id: '123',
                          operation: 'Update',
                          lastUpdated: '2024-01-15T10:30:00Z',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Webhook received successfully',
          },
          '401': {
            description: 'Invalid or missing signature',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '400': {
            description: 'Invalid payload format',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/quickbooks/sync': {
      post: {
        tags: ['Sync'],
        summary: 'Trigger manual sync',
        description: 'Manually trigger a full or partial data sync for an organization.',
        operationId: 'triggerSync',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['organizationId'],
                properties: {
                  organizationId: {
                    type: 'string',
                    description: 'Organization to sync',
                    example: 'org_123456',
                  },
                  entityTypes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Specific entity types to sync (optional, syncs all if omitted)',
                    example: ['Invoice', 'Customer', 'Payment'],
                  },
                  since: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Only sync records modified after this time (optional)',
                    example: '2024-01-01T00:00:00Z',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sync completed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncResult' },
              },
            },
          },
          '400': {
            description: 'Invalid request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '401': {
            description: 'QuickBooks not connected',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Error message' },
          code: { type: 'string', description: 'Error code' },
        },
        required: ['error'],
      },
      WebhookPayload: {
        type: 'object',
        properties: {
          eventNotifications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                realmId: { type: 'string', description: 'QuickBooks company ID' },
                dataChangeEvent: {
                  type: 'object',
                  properties: {
                    entities: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: {
                            type: 'string',
                            description: 'Entity type (Invoice, Customer, etc.)',
                          },
                          id: { type: 'string', description: 'Entity ID' },
                          operation: {
                            type: 'string',
                            enum: ['Create', 'Update', 'Delete', 'Merge', 'Void'],
                            description: 'Operation type',
                          },
                          lastUpdated: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      SyncResult: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                entityType: { type: 'string' },
                processed: { type: 'integer' },
                failed: { type: 'integer' },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      entityId: { type: 'string' },
                      error: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          totalProcessed: { type: 'integer' },
          totalFailed: { type: 'integer' },
        },
      },
      NormalizedInvoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          syncToken: { type: 'string' },
          customerRef: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          docNumber: { type: 'string' },
          txnDate: { type: 'string', format: 'date' },
          dueDate: { type: 'string', format: 'date' },
          totalAmount: { type: 'number' },
          balance: { type: 'number' },
          status: {
            type: 'string',
            enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'voided'],
          },
          currencyCode: { type: 'string' },
          lineItems: {
            type: 'array',
            items: { $ref: '#/components/schemas/LineItem' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          source: { type: 'string', enum: ['quickbooks'] },
        },
      },
      LineItem: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          lineNumber: { type: 'integer' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          amount: { type: 'number' },
          itemId: { type: 'string' },
          itemName: { type: 'string' },
          accountId: { type: 'string' },
          accountName: { type: 'string' },
        },
      },
    },
  },
}
