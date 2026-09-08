# Midas — CTO Handover & Interview Brief

## What this is
Midas is an **AI CFO platform**. It connects to a business's accounting systems, pulls
their financial data, and provides live dashboards, AI analysis and a natural-language
chat interface over their own numbers. Tagline: *Turn Data Into Gold.*

Built over ~12 months by a Bangalore team. Operations ceased April 2026 for funding
reasons, not technical ones. **The build is intact and compiles clean.**

## Verified state (checked 2 Sep 2026)
| | |
|---|---|
| Files | 1,573 |
| Code | ~430,000 lines TypeScript / TSX |
| API routes | 162 |
| App routes | 82 |
| Documentation | 95 files, 2.4 MB |
| Tests | 13 files |
| `npm install` | clean, 0 vulnerabilities blocking |
| `npm run build` | **passes** — all 160 pages generated |
| Secrets in repo | none (audited) |
| Env vars required | 61 |

## Stack
Next.js 15 · React 19 · TypeScript · Tailwind
AWS Cognito (auth) · DynamoDB · S3 · Lambda · Redshift
LangChain + LangGraph (agents) · Groq / OpenAI
Supabase · Drizzle ORM · Chart.js / Recharts / React-PDF

## Integrations already built
- **QuickBooks Online** — primary. OAuth 2.0, multi-entity (multiple realms per org),
  real-time sync via webhooks + CDC polling
- **Microsoft Dynamics 365 Business Central** — via Fivetran ETL into Redshift, multi-schema
- **Zoho Books** — OAuth, direct API
- **Xero** — provider registered, minimal implementation
- **Stripe** — payments data

Provider-agnostic interfaces (`InvoiceProvider`, `CustomerProvider`, `PaymentProvider`)
abstract the differences.

## Known gaps — say these out loud in interviews
1. **No upstream git history.** This is a flattened export from the original private repo
   at commit `5038efb8bf83421f126d60be06fa765be4be64c0`. No branches, no blame.
2. **~13 test files against 430k lines.** Effectively untested.
3. **Infrastructure is not in hand.** Cognito pool, DynamoDB tables, S3 buckets and the
   Redshift workgroup all sat in the previous AWS account. Standing this back up is job one.
4. **Shopify integration** was described as "highly developed" in the April shutdown notes
   (Sankey flows, period-over-period, B2B vs DTC) but is **not present in this export**.
   Worth chasing separately.

## Suggested interview task
Give the candidate this repo and 48 hours. Ask for a written answer to:
1. What would it take to get this running again, and in what order?
2. What would you throw away, and why?
3. Where is the real technical risk — not the obvious stuff?
4. Pick one integration and explain how it actually works, from OAuth to the dashboard.

A strong candidate will find the gaps above without being told, and will have an opinion
on the agent architecture in `AGENTIC_SYSTEM_ANALYSIS.md`.

## Restarting it
See **`RESTART.md`** — the complete runbook: every AWS resource to create, all 13
DynamoDB tables, every OAuth app to re-register, all 61 environment variables
(`.env.example`), hosting options and a suggested order of work.

## Where to start reading
- `MIDAS_CONTEXT.md` — the best single overview
- `AGENTIC_SYSTEM_ANALYSIS.md` — the AI/agent layer
- `AI_IMPLEMENTATION_AUDIT_REPORT.md` — prior audit, honest about weaknesses
- `docs/` — 95 further documents

## Note on redacted data
Before this repository was made public, two files containing ~3,195 named
individuals and their email addresses (an investor dataset) were removed, and
eight further hardcoded personal addresses in scripts and `src/app/capital/*`
were replaced with `@example.com` placeholders. This is personal data, not
product code. Nothing functional was removed. `src/data/biotech-investors.ts`
now exports an empty array.

---

## Verified findings (independent code audit, 8 Sep 2026)

These were found by reading the code, not by running it. They are the honest state
of the repository and are good ground for interview discussion.

### First-run blocker
`src/amplify-config.ts` throws **at module scope** if `NEXT_PUBLIC_APP_URL` is unset.
The root layout imports it, so *every* page — including the static marketing pages —
fails to render without that one variable. Set it before anything else.

### How auth actually works
AWS Cognito via Amplify v6. Two independent layers:

1. **Edge** — `src/middleware.ts` reads `accessToken` / `idToken` cookies and calls
   `TokenVerifier.verify()` against a hardcoded prefix list
   (`/reports /settings /analytics /customers /expenses /invoicing /learn /quickbooks
   /projects /classes /budgets /documents /bc`) plus `/onboarding`. Any failure
   redirects to `/sign-in`. It needs the **server-side** `COGNITO_USER_POOL_ID` and
   `COGNITO_USER_POOL_CLIENT_ID`; without them `verifier-factory.ts` throws and you
   get a sign-in ↔ onboarding bounce loop even though the client vars are set.
2. **Client** — the root layout mounts `ConfigureAmplify` and `SessionProvider`;
   `src/components/layout/AuthRedirectHandler.tsx` does the redirecting.

Sign-up is a **direct browser → Cognito call**. No Next.js API route is involved and
nothing is written to DynamoDB at that point. The first DynamoDB write happens later,
when `SessionProvider` calls `GET /api/users/me/profile` (`USERS_TABLE_NAME`).

### Authorization gaps — worth an opinion
- `/dashboard`, `/coa`, `/journal`, `/memories`, `/notifications`, `/sales`,
  `/shopify/*`, `/qb/*`, `/support`, `/visualizations/*`, `/validations-test` have
  **no edge gate at all**. The HTML shell is served to anonymous users; only the
  `/api` calls 401. Data is not exposed, but the routing model is inconsistent.
- All 13 `/dev/*` pages are **entirely ungated** — not in `protectedRoutes`, not
  under `(main)`.
- `middleware.ts` computes `isPublicRoute` and never uses it. Dead code — and
  because `publicRoutes` contains `/` and the test is `startsWith`, it would have
  matched every path anyway.

### Rendering
`src/app/(main)/layout.tsx` sets `export const dynamic = 'force-dynamic'`, so all 72
pages under `(main)` are non-prerenderable. No page anywhere uses
`generateStaticParams` or `revalidate`. That is the reason this app cannot be
statically exported without changes.

### Dead routes
`next.config.ts` declares 11 permanent (308) redirects that fire before middleware —
`/reports* → /qb/reports*`, `/sales* → /qb/sales*`, `/expenses* → /qb/expenses*`,
`/journal`, `/forecasting`, `/aqua* → /bc*`. The legacy pages under `/reports` and
`/sales` still exist on disk but are **unreachable in production**. Separately,
`/qb/expenses` had no index page, so the `/expenses → /qb/expenses` redirect
dead-ended in a 404; a redirect to `/qb/expenses/vendors` now closes that chain.

### Leftovers
`img.clerk.com` is still in `next.config.ts` `remotePatterns` and `NEXTAUTH_URL`
appears in `.env.example.generated`. Neither is used — there is no Clerk and no
NextAuth in this codebase. Don't let them mislead you.
