# Midas — Restart Runbook

Everything needed to take this from a repository to a running product, **without
access to the original AWS account**. Written 2 September 2026.

---

## 1. What you have, and what you don't

**You have:** the complete application. 1,573 files, ~430k lines, 162 API routes,
95 internal docs. `npm install` and `npm run build` both pass — verified.

**You don't have:** the infrastructure. The previous team's AWS account held the
Cognito user pool, every DynamoDB table, the S3 buckets and the Redshift
workgroup. None of it transfers with the code. The `AKIA…` key that appears in
`AI_IMPLEMENTATION_AUDIT_REPORT.md` points at that account and should be treated
as dead and revoked.

**Consequence:** the app builds and the marketing site renders, but the moment a
user signs in it fails. Everything in section 3 must exist first.

---

## 2. Local run (5 minutes, no AWS)

```bash
git clone https://github.com/lavinekhemlani/midas-platform
cd midas-platform && npm install
cp .env.example.generated .env.local     # 7 vars, enough to boot
npm run dev                              # http://localhost:3000
```
Marketing pages, nav and app shell render. Auth and data do not. `npm run build`
should complete with 160/160 pages — if it doesn't, that's a regression, not a
config problem.

---

## 3. Infrastructure to create (AWS)

### 3.1 Cognito
One user pool + one app client. Set `COGNITO_USER_POOL_ID`,
`COGNITO_USER_POOL_CLIENT_ID`, and the three `NEXT_PUBLIC_COGNITO_*` equivalents.
`aws-policies/cognito-migration-policy.json` in this repo is the IAM policy the
previous migration used — start there. See `docs/COGNITO_MIGRATION_COMPLETE.md`.

### 3.2 DynamoDB — 13 tables
Each is named by an environment variable, so names are yours to choose:

| Env var | Holds |
|---|---|
| `USERS_TABLE_NAME` | users |
| `ORGANIZATIONS_TABLE_NAME` | orgs / multi-entity roots |
| `CHAT_TABLE_NAME` | chat sessions |
| `CHAT_HISTORY_TABLE` | chat messages |
| `AI_MEMORIES_TABLE` | persistent agent memory |
| `AI_ANALYSIS_TABLE_NAME` | generated analyses |
| `REPORTS_TABLE_NAME` | saved reports |
| `TOKEN_USAGE_TABLE` | LLM token accounting |
| `BC_CREDENTIALS_TABLE_NAME` | Dynamics 365 credentials |
| `SHOPIFY_CREDENTIALS_TABLE_NAME` | Shopify credentials |
| `SUPPORT_TICKETS_TABLE_NAME` | support tickets |
| `TERMS_TABLE_NAME` | glossary / learn terms |
| `DYNAMODB_LOCK_TABLE` | distributed locks for sync jobs |

Key schemas are inferable from the access patterns in `src/lib` and `src/db`.

### 3.3 S3 — 2 buckets
`S3_UPLOADS_BUCKET_NAME`, `S3_DECKS_BUCKET_NAME`. Plus `AWS_S3_REGION`.

### 3.4 Redshift (only for Dynamics 365)
`REDSHIFT_WORKGROUP_NAME`, `REDSHIFT_DATABASE`, `REDSHIFT_DB_USER`. Data lands
via Fivetran ETL. **If you drop Dynamics for now, you can skip this entirely** —
QuickBooks is the primary integration and doesn't touch Redshift.

### 3.5 Lambda
`INITIAL_SYNC_LAMBDA_NAME` runs first-time provider syncs. `AWS_LAMBDA_FUNCTION_NAME`
is set by the runtime.

### 3.6 IAM
One access key with DynamoDB, S3, Cognito, Lambda invoke and Redshift Data API
permissions → `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`.

---

## 4. Third-party apps to re-register

All old client IDs and secrets belonged to the previous account. Every one needs
recreating under your own developer accounts.

- **QuickBooks / Intuit** — `QUICKBOOKS_CLIENT_ID` / `_SECRET` (sandbox) and
  `_CLIENT_ID_PROD` / `_SECRET_PROD`, `QUICKBOOKS_REDIRECT_URI`,
  `QUICKBOOKS_ENVIRONMENT`, `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.
  Optional proxy: `QUICKBOOKS_USE_PROXY`, `QUICKBOOKS_PROXY_URL`, `QUICKBOOKS_ALLOW_SELF_SIGNED`.
- **Shopify** — `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP_DOMAIN`
- **Zoho Books** — `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_DOMAIN`, `ZOHO_CALLBACK_PATH`
- **Dynamics 365 (Azure AD)** — `BC_AZURE_CLIENT_ID`, `BC_AZURE_CLIENT_SECRET`

## 5. AI and other services
`GROQ_API_KEY` (primary LLM), `TAVILY_API_KEY` (web search), `DATABASE_URL`
(Postgres/Supabase for Drizzle), and optional ops webhooks:
`SLACK_WEBHOOK_URL`, `MONITORING_WEBHOOK_URL`, `SECURITY_WEBHOOK_URL`.

---

## 6. Hosting

This is a server-rendered Next.js app with 162 API routes. **It cannot go on
GitHub Pages** — that's static only. It needs a Node runtime.

Suggested: **Render** or **Railway** (flat monthly, no build-credit metering) or
**AWS Amplify** (keeps everything in one account). Then point `tech.midascfo.com`
at the host with a `CNAME`. Do not touch `midascfo.com` — that's a separate
static marketing site on GitHub Pages.

---

## 7. Suggested order

1. AWS account + IAM key
2. Cognito pool → sign-in works
3. The 13 DynamoDB tables → app stops erroring
4. QuickBooks OAuth app → one real integration end to end
5. Deploy to a Node host, point the subdomain
6. Then, and only then, Shopify / Zoho / Dynamics

Milestone to aim for: **one QuickBooks company connected, syncing, and rendering a
P&L.** That proves the whole spine — auth, storage, provider OAuth, sync, agent,
UI. Everything after it is repetition.

---

## 8. Known risks

- **~13 test files against 430k lines.** Effectively untested. Any refactor is blind.
- **No upstream git history in this repo** — flattened from commit `5038efb8`.
  The full 4,026-commit history exists locally and can be provided.
- **The `/capital/*` routes are not Midas.** They are a separate Zenith Capital
  project built on the same repo in June 2026. The investor dataset behind them was
  removed before publication. Treat those routes as out of scope or delete them.
- **Shopify** was described at shutdown as highly developed (Sankey flows,
  period-over-period, B2B vs DTC). It is present here — confirm it matches that
  description before planning around it.
