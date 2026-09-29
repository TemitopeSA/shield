import type { Account, Client, Instrument, Outcome, Predicate, RuleDef, RulePack } from "../types";
import { evalPredicate } from "./predicate";
import { positions, valuation, contributions, type InstrumentMap } from "../ledger";
import { fmtMoney, round2 } from "../money";
import { yearsBetween } from "../dates";

export interface EvalContext {
  pack: RulePack;
  now: Date;
  instruments: InstrumentMap;
  client?: Client;
  account?: Account;
  /** Active accounts the client already holds in this wrapper. */
  clientAccounts?: Account[];
  instrument?: Instrument;
  order?: { side: "buy" | "sell"; qty: number; price: number; notional: number };
  transfer?: { direction: "INCOMING" | "OUTGOING"; amount: number; acknowledge_early_exit?: boolean };
  initial_deposit?: number;
}

export interface EvaluatorResult {
  outcome: Outcome;
  vars?: Record<string, string | number>;
  details?: Record<string, unknown>;
}

export type Evaluator = (rule: RuleDef, ctx: EvalContext) => EvaluatorResult;

export const clientSubject = (client: Client, now: Date) => ({
  ...client,
  age: Math.floor(yearsBetween(client.birth_date, now)),
});

const pct1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Generic evaluators. A rule pack picks an evaluator with `kind` and
 * configures it with `params`. No evaluator knows about any specific wrapper.
 */
export const EVALUATORS: Record<string, Evaluator> = {
  account_status(rule, ctx) {
    if (!ctx.account) return { outcome: "SKIP" };
    const ok = ctx.account.status === rule.params.status;
    return { outcome: ok ? "PASS" : "FAIL", vars: { status: ctx.account.status }, details: { status: ctx.account.status } };
  },

  client_predicate(rule, ctx) {
    if (!ctx.client) return { outcome: "SKIP" };
    const subject = clientSubject(ctx.client, ctx.now);
    const ok = evalPredicate(rule.params.predicate as Predicate, subject);
    return {
      outcome: ok ? "PASS" : "FAIL",
      vars: { tax_residency: subject.tax_residency, age: subject.age },
      details: { tax_residency: subject.tax_residency, age: subject.age },
    };
  },

  max_accounts_per_client(rule, ctx) {
    const existing = ctx.clientAccounts ?? [];
    const max = rule.params.max as number;
    const ok = existing.length < max;
    return {
      outcome: ok ? "PASS" : "FAIL",
      vars: { existing: existing.map((a) => a.id).join(", ") },
      details: { existing_accounts: existing.map((a) => a.id), max },
    };
  },

  contribution_limit(rule, ctx) {
    const amount =
      ctx.transfer?.direction === "INCOMING" ? ctx.transfer.amount : ctx.transfer ? 0 : ctx.initial_deposit ?? 0;
    const period = rule.params.period as "lifetime" | "annual";
    const limit = rule.params.limit as number;
    const used = ctx.account ? contributions(ctx.account, period === "annual" ? ctx.now.getUTCFullYear() : undefined) : 0;
    const available = Math.max(0, limit - used);
    const ok = amount <= available;
    return {
      outcome: ok ? "PASS" : "FAIL",
      details: {
        period,
        limit,
        used: round2(used),
        requested: round2(amount),
        available: round2(available),
        excess: round2(Math.max(0, amount - available)),
        currency: ctx.pack.currency,
      },
    };
  },

  instrument_predicate(rule, ctx) {
    if (!ctx.instrument) return { outcome: "SKIP" };
    if (rule.params.side && ctx.order && ctx.order.side !== rule.params.side) return { outcome: "SKIP", vars: { symbol: ctx.instrument.symbol } };
    const ok = evalPredicate(rule.params.predicate as Predicate, ctx.instrument as unknown as Record<string, unknown>);
    return {
      outcome: ok ? "PASS" : "FAIL",
      vars: { symbol: ctx.instrument.symbol },
      details: {
        symbol: ctx.instrument.symbol,
        country: ctx.instrument.country,
        asset_class: ctx.instrument.asset_class,
        ...(ctx.instrument.eu_equity_pct !== undefined ? { eu_equity_pct: ctx.instrument.eu_equity_pct } : {}),
      },
    };
  },

  issuer_concentration(rule, ctx) {
    if (!ctx.account || !ctx.instrument || !ctx.order || ctx.order.side !== "buy") return { outcome: "SKIP" };
    const max = rule.params.max_pct as number;
    const pos = positions(ctx.account, ctx.instruments);
    const total = valuation(ctx.account, ctx.instruments, ctx.now).total;
    const issuer = ctx.instrument.issuer;
    const current = pos.filter((p) => p.issuer === issuer).reduce((s, p) => s + p.value, 0);
    const currentPct = total ? (current / total) * 100 : 0;
    const afterPct = total ? ((current + ctx.order.notional) / total) * 100 : 100;
    return {
      outcome: afterPct <= max ? "PASS" : "FAIL",
      vars: { issuer },
      details: { issuer, current_pct: pct1(currentPct), after_pct: pct1(afterPct), max_pct: max, order_value: round2(ctx.order.notional) },
    };
  },

  cash_available(_rule, ctx) {
    if (!ctx.account) return { outcome: "SKIP" };
    let required = 0;
    if (ctx.order) {
      if (ctx.order.side === "sell") return { outcome: "SKIP" };
      required = ctx.order.notional;
    } else if (ctx.transfer?.direction === "OUTGOING") required = ctx.transfer.amount;
    else return { outcome: "SKIP" };
    const available = ctx.account.cash;
    const cur = ctx.account.currency;
    return {
      outcome: required <= available + 0.005 ? "PASS" : "FAIL",
      vars: { required: fmtMoney(required, cur), available: fmtMoney(available, cur) },
      details: { required: round2(required), available: round2(available), currency: cur },
    };
  },

  holding_period(rule, ctx) {
    if (!ctx.account) return { outcome: "SKIP" };
    const years = rule.params.years as number;
    const age = yearsBetween(ctx.account.opened_at, ctx.now);
    const vars = { plan_age: age.toFixed(1) };
    const details = { plan_age_years: Math.round(age * 100) / 100, required_years: years, early_exit: rule.params.early_exit };
    if (age >= years) return { outcome: "PASS", vars, details };
    if (rule.params.early_exit === "close_plan" && !ctx.transfer?.acknowledge_early_exit)
      return { outcome: "FAIL", vars, details: { ...details, acknowledgement_required: true } };
    return { outcome: "WARN", vars, details };
  },

  allocation_ratio(rule, ctx) {
    if (!ctx.account) return { outcome: "SKIP" };
    const pos = positions(ctx.account, ctx.instruments);
    const invested = pos.reduce((s, p) => s + p.value, 0);
    if (!invested) return { outcome: "SKIP" };
    const matching = pos.filter((p) => evalPredicate(rule.params.predicate as Predicate, p.instrument as unknown as Record<string, unknown>));
    const actual = (matching.reduce((s, p) => s + p.value, 0) / invested) * 100;
    const min = rule.params.min_pct as number;
    return {
      outcome: actual >= min ? "PASS" : "FAIL",
      vars: { actual_pct: pct1(actual), min_pct: min },
      details: { actual_pct: pct1(actual), min_pct: min, matching: matching.map((m) => m.symbol) },
    };
  },
};

export const SUPPORTED_KINDS = Object.keys(EVALUATORS);
