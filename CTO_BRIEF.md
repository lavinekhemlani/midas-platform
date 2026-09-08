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
