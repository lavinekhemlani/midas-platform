# Shopify Integration Notes — Midas App

## Current Setup

- **App Name:** Midas
- **Dev Dashboard:** https://dev.shopify.com/dashboard
- **Partner Dashboard:** https://partners.shopify.com/4797900/apps/333521944577
- **Distribution:** **Public** (selected 2026-03-24 — permanent, cannot be changed)
- **OAuth Flow:** Authorization Code Grant (standard per-store installation)
- **Active Version:** midas-5

## Environment Variables

```env
SHOPIFY_CLIENT_ID=        # Default app credential — optional fallback (from Dev Dashboard > Settings)
SHOPIFY_CLIENT_SECRET=    # Default app credential — optional fallback (from Dev Dashboard > Settings)
```

`SHOPIFY_SHOP_DOMAIN` has been **removed** from env vars. The shop domain is now collected from the user during the onboarding flow and stored per-connection in DynamoDB.

`SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` are now **optional fallbacks**. Each store connection stores its own Client ID + Client Secret in DynamoDB (collected via the onboarding modal). This supports connecting multiple custom distribution apps — one per Shopify org.

---

## Distribution Methods

|                        | Public Distribution                 | Custom Distribution                          |
| ---------------------- | ----------------------------------- | -------------------------------------------- |
| **Who can install**    | Any merchant (unlimited stores)     | One store or one Shopify Plus organization   |
| **App Store listing**  | Yes (can be listed or unlisted)     | No                                           |
| **App Store review**   | Required                            | Not required                                 |
| **Cross-org installs** | Yes                                 | No — separate app per org required           |
| **Billing API**        | Available                           | Not available                                |
| **Credential sharing** | One Client ID/Secret for all stores | One Client ID/Secret, but limited to one org |
| **Can change later?**  | No                                  | No                                           |

### Key Constraint with Custom Distribution

Custom distribution limits installs to **one store or stores within the same Shopify Plus organization**. If stores belong to different organizations, you must create a **separate app per organization**, each with its own Client ID and Client Secret. This is why we had to generate different credentials per store during testing.

---

## Recommended Path: Public Distribution

Selecting **Public Distribution** solves the multi-store problem:

- One app, one set of Client ID / Client Secret (stays in env vars)
- Any store can install via OAuth — no org restrictions
- Can be **unlisted** (not searchable on App Store) if only used internally
- Users only need to provide their **shop domain** during onboarding
- No need to collect Client ID / Client Secret from users

### Onboarding Flow (Implemented)

1. User clicks "Connect Shopify" in the integrations UI
2. `ShopifyStoreModal` appears — user enters their **store name** (e.g. `my-store`)
3. Modal normalizes to `my-store.myshopify.com` and passes it as `?shop_domain=` to the login route
4. Login route stores `shopDomain` in the OAuth state and redirects to `https://{shop}/admin/oauth/authorize`
5. Merchant approves scopes on Shopify admin
6. Shopify redirects back with auth code to `/api/auth/shopify/callback`
7. Callback extracts `shopDomain` from the OAuth state, exchanges code for access token
8. `shop_domain` + access token stored in DynamoDB under `providers.shopify.connections[shopDomain]`
9. Each connected store gets its own sidebar section and dashboard card
10. Pages use `?shop=domain` query param to fetch data for the correct store

---

## OAuth Flow Details

### Scopes Requested (Read-Only)

```
read_orders, read_all_orders, read_products, read_inventory,
read_customers, read_reports, read_analytics
```

### Token Lifecycle

- **Offline access tokens do not expire** (permanent until app is uninstalled)
- **No refresh token** — if token becomes invalid, user must re-authorize
- Current code sets `expiresIn: 315360000` (~10 years) as a dummy value for interface compatibility

### OAuth Endpoints

```
Authorization: https://{shop}/admin/oauth/authorize
Token Exchange: https://{shop}/admin/oauth/access_token (POST)
```

### Token Exchange Request

```json
POST https://{shop}/admin/oauth/access_token
{
  "client_id": "...",
  "client_secret": "...",
  "code": "{authorization_code}"
}
```

### Token Exchange Response

```json
{
  "access_token": "shpca_...",
  "scope": "read_orders,read_products,..."
}
```

---

## App Types Comparison (Shopify)

| Aspect               | Legacy Custom App (Store Admin)          | Dev Dashboard App                                          |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| **Creation**         | Shopify Admin > Settings > Apps          | dev.shopify.com/dashboard                                  |
| **Status**           | Cannot create new ones after Jan 1, 2026 | Active, sole method going forward                          |
| **Auth**             | Static token (shown once in admin)       | OAuth 2.0                                                  |
| **Token expiration** | Never                                    | Auth Code Grant: never. Client Credentials Grant: 24 hours |
| **Multi-store**      | No                                       | Yes (Public) or limited (Custom)                           |

---

## Key Files in Codebase

```
# Auth & Login
src/lib/providers/shopify/auth.ts               — OAuth implementation (per-app client_id/secret from state, fallback to env)
src/lib/providers/shopify/client.ts              — REST API client (Admin API v2025-01)
src/lib/providers/oauth-security.ts              — OAuth state (includes shopDomain, shopifyClientId, shopifyClientSecret)
src/app/api/providers/shopify/login/route.ts     — Faux login (username/password) + manual login (client_id/secret) — both return OAuth URL
src/app/api/auth/shopify/callback/route.ts       — OAuth callback (proxy header support)
src/app/api/providers/callback/route.ts          — Generic callback (stores shop_domain + per-app creds in connection)
src/app/api/providers/[provider]/login/route.ts  — Generic OAuth login (GET redirect, POST returns loginUrl JSON)

# Database
src/lib/providers/database.ts                    — storeShopifyConnectionCredentials(), getShopifyConnectionCredentials(), getProviderCredentialsFromDB() (multi-store aware)

# API Routes (all use getShopifyClient helper with ?shop= param)
src/app/api/providers/shopify/getShopifyClient.ts — Shared helper: resolves credentials by ?shop= or active store
src/app/api/providers/shopify/orders/route.ts
src/app/api/providers/shopify/products/route.ts
src/app/api/providers/shopify/customers/route.ts
src/app/api/providers/shopify/inventory/route.ts
src/app/api/providers/shopify/summary/route.ts

# UI
src/components/integrations/ShopifyStoreModal.tsx            — Dual-mode modal: faux login (default) or manual credentials (toggle)
src/components/integrations/IntegrationsContainer.tsx         — Handles both faux and manual Shopify auth flows
src/app/(main)/shopify/hooks/useShopifyData.ts               — Data hooks (reads ?shop= from URL, passes to API)
src/hooks/useShopifyConnection.ts                            — Connection status (multi-store aware)
src/app/(main)/components/layout/Sidebar.tsx                 — Multi-store sections with ?shop= in nav hrefs, isActive matches on shop param
src/app/(main)/dashboard/page.tsx                            — Multi-store dashboard cards + connectedProvidersMap
src/app/(main)/shopify/*/page.tsx                            — UI pages

# Scripts
scripts/setup-shopify-credentials.ts             — Create shopify_credentials table + seed credentials

# Config
src/lib/providers/provider-config.ts              — Provider registry config
src/lib/providers/handler.ts                      — Provider routing + API base URL (reads shop_domain from credentials)
```

---

## Relevant Shopify Documentation

- [Dev Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard)
- [Select Distribution Method](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)
- [About App Distribution](https://shopify.dev/docs/apps/launch/distribution)
- [About Client Credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets)
- [Authorization Code Grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant)
- [Client Credentials Grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)
- [Offline Access Tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens)
- [Rotate/Revoke Client Credentials](https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets/rotate-revoke-client-credentials)
- [Migrate from Partner Dashboard](https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners)
- [Legacy Custom Apps Sunset (Jan 2026)](https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026)

---

## Decision Log

| Date       | Decision                                           | Rationale                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-24 | Investigating Public vs Custom distribution        | Need multi-store support across different orgs                                                                                                                                                                               |
| 2026-03-24 | **Selected Public Distribution**                   | One app, one set of credentials, any store can install. Permanent — cannot be changed.                                                                                                                                       |
| 2026-03-24 | Removed `SHOPIFY_SHOP_DOMAIN` from env vars        | Shop domain now collected via onboarding modal and stored per-connection in DynamoDB                                                                                                                                         |
| 2026-03-24 | Implemented multi-store support                    | Each store stored under `providers.shopify.connections[shopDomain]` with `activeShopDomain` pointer (same pattern as QB multi-entity)                                                                                        |
| 2026-03-24 | Added `?shop=domain` URL param for store routing   | Sidebar, hooks, and API routes all use `?shop=` to differentiate stores (same pattern as QB `?realmId=`)                                                                                                                     |
| 2026-03-24 | Created `ShopifyStoreModal` for onboarding         | Pre-auth modal collects store name before OAuth redirect. Styled to match `DynamicsCredentialsModal`.                                                                                                                        |
| 2026-03-24 | Created shared `getShopifyClient` helper           | All 5 API routes use it to resolve credentials by `?shop=` param or fall back to active store                                                                                                                                |
| 2026-03-27 | **Per-app credentials (multi custom app support)** | Client ID + Client Secret now collected per store via onboarding modal and stored per-connection in DynamoDB. Env vars are optional fallback. Supports connecting multiple custom distribution apps (one per Shopify org).   |
| 2026-03-27 | **Faux credentials login (default)**               | Users connect with a simple username/password. Credentials (client_id, client_secret, shop_domain) stored in `shopify_credentials` DynamoDB table. Same pattern as BC/Redshift faux login. Manual mode available via toggle. |

---

## Shopify Authentication Modes

### 1. Faux Credentials (Default)

Admin pre-provisions credentials in the `shopify_credentials` DynamoDB table. Users only need a username and password to connect.

**Flow:** Username/password → `POST /api/providers/shopify/login` → verify against DynamoDB → return Shopify OAuth URL (using stored client_id/client_secret) → redirect to Shopify → OAuth callback → store connection.

**Table:** `shopify_credentials` (same pattern as `bc_credentials`)

- Key: `PK=CRED#{username}`, `SK=CREDENTIAL`
- Stores: `username`, `password_hash` (bcrypt), `client_id`, `client_secret`, `shop_domain`, `display_name`, `status`
- Security: 5-attempt lockout (30 min), bcrypt 12 rounds, audit logging

**Setup:** `npx ts-node scripts/setup-shopify-credentials.ts`

### 2. Manual Credentials (Toggle)

User provides store domain + Client ID + Client Secret directly. Available via "Connect with your own app credentials" link at the bottom of the modal.

**Flow:** Store domain + Client ID + Client Secret → `POST /api/providers/shopify/login` → return Shopify OAuth URL → redirect to Shopify → OAuth callback → store connection (including per-app credentials).

---

## Clarification: Dev Dashboard vs Stores vs Apps

### The confusion

When you click the `</>` code icon next to a store (e.g. test-store) in the Shopify admin, it opens the Dev Dashboard showing the "Midas" app. This makes it **look** like the app belongs to that specific store. It doesn't.

### Three separate concepts

**1. Your Shopify Account (Organization)**

- This is your login identity ("Midas | Team")
- It owns all your stores and all your apps
- Accessed via the Shopify admin store picker

**2. Your Stores**

- test-store (dev store)
- Pininfarina Hybrid Watches EU (pininfarinahibridwatch.eu)
- Pininfarina Hybrid Watch UK (www.pininfarinahibridwatch.co.uk)
- Pininfarina Hybrid Watches (pininfarinahibridwatch.com)
- These are the actual shops that sell products

**3. Your App ("Midas")**

- Created in the Dev Dashboard (dev.shopify.com)
- Lives at the **developer account level**, not inside any store
- Has one Client ID and one Client Secret
- Can be installed on multiple stores

### Why the dev store shows the app

When you create an app in the Dev Dashboard, you link a **development store** to it for testing. That's what `shopify app dev` does — it runs your app against that dev store so you can test the OAuth flow, API calls, etc.

The `</>` icon on the dev store is just a shortcut saying "this store has an app in development linked to it." The app is not created inside the store — the store is just a testing sandbox for the app.

> **Ref:** [Shopify Dev Dashboard docs — Development stores](https://shopify.dev/docs/apps/build/dev-dashboard)
> **Ref:** [Shopify — Getting started with app development](https://shopify.dev/docs/apps/getting-started)

### How it actually works

```
Your Developer Account (Midas | Team)
  │
  ├── Midas App (one Client ID / one Client Secret)
  │     │
  │     ├── development store: test-store (linked for testing)
  │     │
  │     └── once distributed, can be INSTALLED on:
  │           ├── test-store
  │           ├── pininfarina EU
  │           ├── pininfarina UK
  │           └── pininfarina US
  │           (each install produces a separate access token)
  │
  └── Stores (owned by you)
        ├── test-store
        ├── pininfarina EU
        ├── pininfarina UK
        └── pininfarina US
```

### Per-store access tokens, not per-store apps

When a store installs your app, the OAuth flow produces an **access token specific to that store**. The app's Client ID and Client Secret stay the same — they identify your app, not any particular store.

```
Midas App credentials (singleton — never changes):
  client_id:     "edfa0445..."
  client_secret: "shpss_53ebc..."

Per-store installations (one access token per store):
  test-store          → access_token: "shpca_aaaa..."
  pininfarina EU      → access_token: "shpca_bbbb..."
  pininfarina UK      → access_token: "shpca_cccc..."
  pininfarina US      → access_token: "shpca_dddd..."
```

> **Ref:** [Shopify — About access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens)
> **Ref:** [Shopify — About client secrets](https://shopify.dev/docs/apps/build/authentication-authorization/client-secrets)
> **Ref:** [Shopify — Authorization code grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant)

### Why you may have needed different credentials before

If you created **multiple apps** in the Dev Dashboard (one per store), each app would have its own Client ID and Client Secret. But this isn't necessary — one app is sufficient. The same Midas app can be installed on all your stores, and each store gets its own access token through the OAuth flow.

If you used **Custom Distribution**, it may have limited which stores could install the app (only stores in the same Shopify Plus organization). Stores in different organizations would require separate apps, forcing separate credentials.

> **Ref:** [Shopify — Select a distribution method](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)
> **Ref:** [Shopify — About app distribution](https://shopify.dev/docs/apps/launch/distribution)

---

## Distribution Limitations Comparison

|                             | Public Distribution                                    | Custom Distribution         |
| --------------------------- | ------------------------------------------------------ | --------------------------- |
| **Install limit**           | Unlimited stores                                       | 1 store or 1 Plus org       |
| **Who can install**         | Any merchant                                           | Same org only               |
| **App review**              | Required (5-10+ business days)                         | Not required                |
| **Billing API**             | Yes (and required for charging)                        | **Not available**           |
| **API type**                | **GraphQL only** (new apps since Apr 2025)             | REST still allowed          |
| **Token expiry**            | **Expiring tokens required** (new apps after Apr 2026) | Non-expiring tokens OK      |
| **Protected customer data** | Requires **formal approval** process                   | Always available, no review |
| **Compliance webhooks**     | Must implement 3 mandatory webhooks                    | Not required                |
| **Embedded in admin**       | **Must** embed using App Bridge                        | Optional                    |
| **Revenue share**           | 0% first $1M, then 15% + 2.9% fee                      | None                        |
| **Ongoing obligations**     | Quality checks, compliance maintenance                 | None                        |
| **App Store listing**       | Yes (can be unlisted but page still exists)            | No listing at all           |
| **Can switch later?**       | No — permanent                                         | No — permanent              |

> **Ref:** [Select a distribution method](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method)
> **Ref:** [About app distribution](https://shopify.dev/docs/apps/launch/distribution)
> **Ref:** [App listing visibility](https://shopify.dev/docs/apps/launch/distribution/visibility)
> **Ref:** [Revenue share for Shopify App Store developers](https://shopify.dev/docs/apps/launch/distribution/revenue-share)
> **Ref:** [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)

---

## Data Access for Analytics Use Case (Public Distribution)

### No data limits — same API access as Custom apps

Public apps have access to the **exact same Admin API endpoints and scopes** as Custom apps. There are no endpoints or data types exclusively available to one distribution type. The difference is that some data requires **approval gates** before access is granted.

> **Ref:** [Shopify API access scopes](https://shopify.dev/docs/api/usage/access-scopes)

### Approval requirements for our scopes

| Data                              | Scope                             | Approval Needed? | Notes                                                                              |
| --------------------------------- | --------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Products & inventory              | `read_products`, `read_inventory` | No               |                                                                                    |
| Orders (last 60 days)             | `read_orders`                     | No               |                                                                                    |
| Orders (full history)             | `read_all_orders`                 | **Yes**          | Must justify to Shopify. Analytics is a legitimate and commonly approved use case. |
| Customer names, emails, addresses | `read_customers`                  | **Yes**          | Protected Customer Data Level 2                                                    |
| Analytics / ShopifyQL queries     | `read_reports`, `read_analytics`  | **Yes**          | Level 2 required even for ShopifyQL                                                |

> **Ref:** [Apps now need Shopify approval to read orders older than 60 days](https://shopify.dev/changelog/apps-now-need-shopify-approval-to-read-orders-older-than-60-days)
> **Ref:** [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
> **Ref:** [ShopifyQL with the GraphQL Admin API](https://shopify.dev/docs/apps/build/shopifyql/graphql-admin-api)

### Protected Customer Data — Level 1 vs Level 2

**Level 1 (customer data — order values, line items, shipping events):**

- Published privacy policy
- Data minimization — only process the minimum personal data required
- Retention periods — don't keep data longer than necessary
- Limit processing to stated purposes
- Inform merchants what data you process and why
- Encrypt data in transit (TLS)

**Level 2 (customer fields — name, email, phone, address):**
Everything in Level 1, plus:

- Encrypt data backups
- Separate test and production environments
- Data loss prevention strategy
- Limit staff access to protected data (least privilege)
- Require strong passwords for staff accounts
- Encrypt data at rest

**Approval process:**

- Submit request through Partner Dashboard with justification per field
- No published SLA — community reports say **1-4+ weeks**
- Can be denied if justification is weak
- Denied requests can be resubmitted after fixing issues

> **Ref:** [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
> **Ref:** [Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements)

### What you CAN do with fetched data

- **Store externally** in your own database — with encryption at rest and in transit
- **Run analytics**, generate reports, build dashboards
- **Export to CSV/PDF** for merchants
- **Calculate derived metrics** (LTV, cohort analysis, ROAS, etc.)

### What you CANNOT do

- **Use data for AI/ML training** without explicit written consent from Shopify or the merchant (updated Feb 27, 2026)
- **Sell or share merchant data** with third parties
- **Keep data after uninstall** — must delete within 48 hours (via `shop/redact` webhook)
- **Aggregate across stores for competitive intelligence** without explicit merchant consent
- **Use data beyond stated purposes** in your privacy policy

> **Ref:** [API terms compliance](https://shopify.dev/docs/apps/build/compliance/api-terms-compliance)
> **Ref:** [Shopify API License and Terms of Use](https://www.shopify.com/legal/api-terms)
> **Ref:** [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)

### Data retention rules

- No fixed retention period mandated by Shopify
- Must define and publish your own retention policy
- Must not keep data longer than necessary for your stated purpose
- Must delete ALL data within 48 hours of app uninstall (`shop/redact` webhook)
- Must delete specific customer data on request (`customers/redact` webhook)

> **Ref:** [Shopify Data Processing Addendum](https://www.shopify.com/legal/dpa)

### Analytics apps are a major App Store category

Analytics/reporting is one of the largest categories with **900+ apps**. Examples using similar scopes:

| App             | Focus                                             |
| --------------- | ------------------------------------------------- |
| Polar Analytics | Multi-source analytics, profit/loss, LTV, cohorts |
| Lifetimely      | Profit analytics, LTV, customer cohorts           |
| Better Reports  | Custom reporting, data export                     |
| PayHelm         | Multi-store + multi-channel analytics             |
| Report Pundit   | Custom report builder                             |
| Zoho Analytics  | BI dashboard with AI assistant                    |

> **Ref:** [Best Analytics Apps - Shopify App Store](https://apps.shopify.com/categories/store-management-operations-analytics/all)

---

## Remaining Work for Public Distribution (App Store Review)

Before submitting for App Store review, these items still need to be done:

### 1. REST → GraphQL (required for new public apps since Apr 2025)

`src/lib/providers/shopify/client.ts` currently uses REST endpoints (`/admin/api/2025-01/orders.json`, etc.). New public apps must use the **GraphQL Admin API exclusively**.

> **Ref:** [Starting April 2025, new public apps must use GraphQL](https://shopify.dev/changelog/starting-april-2025-new-public-apps-submitted-to-shopify-app-store-must-use-graphql)

### 2. Token refresh (required for new public apps after Apr 1, 2026)

`src/lib/providers/shopify/auth.ts` assumes tokens never expire (`expiresIn: 315360000`) and throws on `refreshAccessToken()`. New public apps must support **expiring offline access tokens** with a 90-day refresh token lifecycle.

> **Ref:** [Expiring offline access tokens required for new public apps as of April 1, 2026](https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-public-apps-april-1-2026)

### 3. Compliance webhooks (required for all public apps)

Must implement handlers for three mandatory webhooks before App Store review:

1. **`customers/data_request`** — return what personal data you hold for a customer
2. **`customers/redact`** — delete a specific customer's personal data
3. **`shop/redact`** — delete ALL data for a store (sent 48 hours after uninstall)

Failure to implement these results in **automatic rejection** during review.

> **Ref:** [Privacy law compliance — mandatory webhooks](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)

### 4. Protected Customer Data approval

Must request Level 2 access through Partner Dashboard for `read_customers` and ShopifyQL.

> **Ref:** [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)

### 5. `read_all_orders` scope approval

Must request approval for access to orders older than 60 days.

> **Ref:** [Apps now need Shopify approval to read orders older than 60 days](https://shopify.dev/changelog/apps-now-need-shopify-approval-to-read-orders-older-than-60-days)

---

## What Has Been Implemented

### Multi-store OAuth flow

- `ShopifyStoreModal` collects store domain before OAuth
- Shop domain flows through: login route → OAuth state → callback → DynamoDB
- `SHOPIFY_SHOP_DOMAIN` env var fully removed — no fallbacks

### Multi-store data storage (DynamoDB)

- Each store stored under `providers.shopify.connections[shopDomain]`
- `activeShopDomain` pointer for default store
- `storeShopifyConnectionCredentials()` — additive, doesn't overwrite other stores
- `getShopifyConnectionCredentials()` — fetch credentials for a specific store
- `getProviderCredentialsFromDB()` — updated to read from connections map

### Multi-store UI routing

- Sidebar shows one section per store with store name, nav items have `?shop=domain`
- `isActive()` in Sidebar matches on `?shop=` param (same pattern as QB `?realmId=`)
- Dashboard shows one card per store with store name
- `connectedProvidersMap` lists all connected store names
- `useShopifyConnection` checks connections map

### Multi-store data fetching

- `getShopifyClient` shared helper resolves credentials by `?shop=` param
- All 5 API routes use it (orders, products, customers, inventory, summary)
- `useShopifyData` hooks read `?shop=` from URL and include it in API calls + SWR cache keys
