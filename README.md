# Shield — EU Wrapper Engine

**Launch tax-advantaged investing across Europe.** Shield is a prototype infrastructure layer for a brokerage API that lets partners open **PEA** (France), **ISK** (Sweden) and **PIR** (Italy) accounts with one field — `wrapper_type` — while a configuration-driven rules engine handles eligibility, contribution limits, tax lots, compliance checks, tax calculations and reporting.

> Prototype concept for a broker API, built as a product-management portfolio piece. **Not an official Alpaca product**, not affiliated with or endorsed by Alpaca. Partners, clients and prices are fictional. Tax rules are simplified for demonstration and are **not tax advice**.

**Live demo:** https://shield-alpaca.vercel.app — click **Explore the demo** for a 3-minute guided walkthrough.

---

## Product

A reviewer can see both halves of the product:

| Customer-facing experience | Infrastructure underneath |
| --- | --- |
| Open a wrapper account, trade, deposit, withdraw | `POST /v1/accounts`, `/transfers`, `/orders` |
| Clear, explainable rejections ("AAPL isn't eligible for this wrapper") | Rule packs → generic evaluators → structured results |
| Withdrawal simulator, ISK capital-tax working | Tax models configured per pack |
| IFU / KU / PIR annual statements (CSV + PDF) | Reporting format declared per pack |
| Partner operations console | Every decision persisted to an audit log |

## Problem

European retail investors get their best after-tax outcomes inside local wrappers — the PEA in France, the ISK in Sweden, the PIR in Italy, the IKE in Poland. Each has its own residency test, contribution caps, eligible universe, holding period, tax model and reporting format. A fintech that wants to offer them today has to build and maintain each country's tax logic itself, which is why most don't. A brokerage API that offers wrappers as a primitive removes that barrier for every partner at once.

## Architecture

```
Partner app
    ↓            one API · one field: wrapper_type
Broker API        /v1/accounts · /transfers · /trading/…/orders · /wrappers/simulate
    ↓
Wrapper Engine    stage → rules (core + pack) → generic evaluators → Evaluation
    ↓
Rule Pack         rules/pea.json · isk.json · pir.json · ike.json · pea_pme.json
    ↓
Ledger / Tax / Reporting / Audit log
```

- `rules/*.json` — wrapper rule packs (the only place wrapper behaviour lives).
- `lib/engine` — predicate language, generic evaluators, engine, pack registry, Zod schema.
- `lib/tax` — tax models (`gain_tax_schedule`, `capital_base_tax`).
- `lib/ledger` — positions, FIFO tax lots, valuation.
- `lib/service.ts` — commands (open account, transfer, order, report, simulate, activate wrapper). Every command runs through the engine and writes the audit log.
- `lib/seed` — replays 12–18 months of activity for three partners **through the real engine**, so every historical audit event was produced by the rules.
- `app/api/v1/*` — route handlers (also served at `/v1/*`).
- `app/(console)` — the partner console; `components/guided-demo` — the guided walkthrough.

## Rules

| | PEA · France | ISK · Sweden | PIR · Italy |
| --- | --- | --- | --- |
| Residency | FR | SE | IT |
| Contributions | €150,000 lifetime | no cap | €40,000/yr · €200,000 lifetime |
| Eligible assets | EU/EEA shares; funds ≥ 75% EU equities | any listed security | ≥ 70% Italian, ≥ 17.5% outside FTSE MIB |
| Concentration | — | — | ≤ 10% per issuer |
| Holding period | 5 years (early exit closes the plan) | — | 5 years |
| Tax | < 5y: 31.4% of gains · ≥ 5y: 18.6% social charges | (avg of 4 quarterly values + deposits) / 4 − SEK 300k × 3.55% × 30% | < 5y: 26% · ≥ 5y: exempt |
| Report | IFU-style | KU-style | Annual PIR statement |

All figures are simplified for the demo.

A rule is data:

```json
{
  "id": "PEA_ELIGIBLE_UNIVERSE",
  "stages": ["pre_trade"],
  "kind": "instrument_predicate",
  "params": { "side": "buy", "predicate": { "any": [ … ] } },
  "error_code": "INSTRUMENT_NOT_ELIGIBLE",
  "message": "{symbol} isn't eligible for this wrapper.",
  "explain": "PEA requires eligible EU/EEA exposure …"
}
```

The engine returns a structured, explainable result:

```json
{ "allowed": false, "rule_id": "PEA_ELIGIBLE_UNIVERSE", "code": "INSTRUMENT_NOT_ELIGIBLE", "message": "AAPL isn't eligible for this wrapper." }
```

## Demo

The guided demo (`/demo`) resets the sandbox to a deterministic state and walks through:

1. **Account** — pick a wrapper, open a PEA (try a Belgian resident to see a rejection).
2. **Trade** — AAPL is blocked by `PEA_ELIGIBLE_UNIVERSE`; TotalEnergies fills. Order → Rules engine → Ledger.
3. **Limits** — €10k deposit into a PEA with €5k headroom is blocked; €5k succeeds and headroom hits €0.
4. **Compliance** — a PIR order would lift Intesa Sanpaolo from 9.3% to 11.2% and is blocked by `PIR_ISSUER_CONCENTRATION`.
5. **Tax** — PEA withdrawal before vs after 5 years; ISK 2026 tax with the full working.
6. **Reports** — generate an IFU-style statement, download CSV / PDF.
7. **Finale** — the JSON rule packs behind everything; activate Poland's IKE from `ike.json` with no code changes.

A live "Under the hood" rail shows each API request/response and the audit events as they're written.

## Technical decisions

- **Rules are configuration.** Wrapper behaviour lives in JSON packs. Evaluators are generic (`client_predicate`, `instrument_predicate`, `contribution_limit`, `issuer_concentration`, `cash_available`, `holding_period`, `allocation_ratio`, `max_accounts_per_client`, `account_status`). No code branches on a wrapper name. Adding IKE is a new file; the Rule Packs screen validates any uploaded pack against the supported evaluators and activates it at runtime.
- **Explainability over booleans.** Every rule is evaluated (even after a failure) and returns outcome, code, message, plain-English reason and details (requested / available / excess, current / after / max).
- **Audit everything.** Each rule result is a `RULE_EVALUATED` event linked by `evaluation_id` to the outcome event (`ORDER_REJECTED`, `TRANSFER_ACCEPTED`, …).
- **Dry runs are real runs on a copy.** `/v1/wrappers/simulate` executes the command against a cloned state, so previews can never drift from production behaviour.
- **Per-reviewer sandboxes.** Each browser gets its own in-memory sandbox keyed by `x-shield-session`. Serverless instances are ephemeral, so the browser keeps a snapshot and re-hydrates a cold instance (`409 SESSION_RESTORE_REQUIRED` → `POST /api/session`). No database or secrets are needed to deploy. A `ShieldState` document store could be swapped for Postgres without touching the engine.

## Assumptions

- EUR, SEK and PLN at fixed demo FX rates; instrument prices are static demo values.
- Contribution limits count gross deposits; withdrawals don't restore headroom.
- Withdrawal tax applies to the pro-rata gain portion of the withdrawal, projected with an assumed return.
- ISK Q4 snapshot is projected from today's value until captured; the base rate is the 2026 pack value.
- PEA-eligible ETFs are modelled via an `eu_equity_pct ≥ 75` attribute (synthetic replication).
- Dividend withholding and treaty rates are illustrative.

## Limitations

This is a simplified prototype: no real brokerage connectivity, market data, custody, KYC, tax filing, authentication or payments. Tax rules and report formats are simplified and must not be relied on.

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rules-engine tests (vitest)
npm run typecheck
npm run build
```

## Deployment

Deploys to Vercel with zero configuration (no environment variables required):

```bash
npx vercel --prod
```

## API

OpenAPI 3.1 spec: [`public/openapi.json`](public/openapi.json) (served at `/openapi.json`). Endpoints are available at both `/v1/*` and `/api/v1/*`. The in-app **API Playground** (`/developer/playground`) runs live requests and shows the rules evaluated for each call.

```bash
curl -X POST https://shield-alpaca.vercel.app/v1/trading/accounts/PEA-20417/orders \
  -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","qty":10,"side":"buy","type":"market"}'
```
