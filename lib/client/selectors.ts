import type { Account, AuditEvent, ShieldState } from "../types";
import { activePacks, allPacks, contributionLimits, getPack } from "../engine/packs";
import { instrumentMap, positions, valuation } from "../ledger";
import { convert } from "../money";
import { estimateTax } from "../tax";
import { evaluate } from "../engine/engine";
import { addYears } from "../dates";

export interface AccountRow {
  account: Account;
  id: string;
  wrapper: string;
  clientName: string;
  partnerName: string;
  residency: string;
  value: number;
  valueEur: number;
  cash: number;
  headroom: number | null;
  limit: number | null;
  used: number;
  planAge: number;
  compliant: boolean;
  lastActivity: string;
}

export function accountRows(state: ShieldState, partner = "all", wrapper?: string): AccountRow[] {
  const im = instrumentMap(state);
  const now = new Date();
  return state.accounts
    .filter((a) => (partner === "all" || a.partner_id === partner) && (!wrapper || a.wrapper === wrapper))
    .map((a) => {
      const v = valuation(a, im, now);
      const pack = getPack(state, a.wrapper)!;
      const lim = contributionLimits(pack);
      const client = state.clients.find((c) => c.id === a.client_id)!;
      const b = bindingLimit(lim, v);
      const limit = b?.limit ?? null;
      const used = b?.used ?? v.deposits_lifetime;
      const headrooms = [lim.lifetime !== null ? lim.lifetime - v.deposits_lifetime : null, lim.annual !== null ? lim.annual - v.deposits_year : null].filter((x): x is number => x !== null);
      const compliance = evaluate("compliance", { pack, now, instruments: im, account: a, client }, "c");
      const last = [...a.transactions].sort((x, y) => y.date.localeCompare(x.date))[0]?.date ?? a.opened_at;
      return {
        account: a,
        id: a.id,
        wrapper: a.wrapper,
        clientName: client?.name ?? a.client_id,
        partnerName: state.partners.find((p) => p.id === a.partner_id)?.name ?? a.partner_id,
        residency: client?.tax_residency ?? "",
        value: v.total,
        valueEur: convert(v.total, a.currency, "EUR"),
        cash: v.cash,
        headroom: headrooms.length ? Math.max(0, Math.min(...headrooms)) : null,
        limit,
        used,
        planAge: v.plan_age_years,
        compliant: compliance.results.every((r) => r.outcome !== "FAIL"),
        lastActivity: last,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/** The contribution cap that binds first (smallest headroom), e.g. PIR's annual cap. */
export function bindingLimit(lim: { lifetime: number | null; annual: number | null }, v: { deposits_lifetime: number; deposits_year: number }) {
  const opts = [
    lim.lifetime !== null ? { period: "lifetime" as const, limit: lim.lifetime, used: v.deposits_lifetime } : null,
    lim.annual !== null ? { period: "this year" as const, limit: lim.annual, used: v.deposits_year } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);
  if (!opts.length) return null;
  const sorted = opts.sort((a, b) => a.limit - a.used - (b.limit - b.used));
  return { ...sorted[0], other: sorted[1] ?? null };
}

export function accountDetail(state: ShieldState, id: string) {
  const account = state.accounts.find((a) => a.id === id);
  if (!account) return null;
  const im = instrumentMap(state);
  const now = new Date();
  const pack = getPack(state, account.wrapper)!;
  const client = state.clients.find((c) => c.id === account.client_id)!;
  const partner = state.partners.find((p) => p.id === account.partner_id)!;
  const v = valuation(account, im, now);
  const lim = contributionLimits(pack);
  const pos = positions(account, im);
  const tax = estimateTax(pack, account, client, im, now);
  const compliance = evaluate("compliance", { pack, now, instruments: im, account, client }, "c");
  const audit = state.audit.filter((e) => e.account_id === id);
  const holding = pack.plan.holding_period_years;
  return { account, pack, client, partner, valuation: v, limits: lim, positions: pos, tax, compliance, audit, instruments: im, anniversary: holding ? addYears(account.opened_at, holding) : null };
}

export function partnerFilter<T extends { partner_id?: string }>(xs: T[], partner: string) {
  return partner === "all" ? xs : xs.filter((x) => x.partner_id === partner);
}

/** Group outcome events (one per evaluation) for dashboard metrics. */
export function evaluationStats(audit: AuditEvent[]) {
  const outcomes = audit.filter((e) => ["ORDER_ACCEPTED", "ORDER_REJECTED", "TRANSFER_ACCEPTED", "TRANSFER_REJECTED", "ACCOUNT_CREATED", "ACCOUNT_REJECTED"].includes(e.action));
  const evaluations = new Set(audit.filter((e) => e.action === "RULE_EVALUATED").map((e) => e.evaluation_id));
  const rejected = outcomes.filter((e) => e.action.endsWith("REJECTED"));
  const ruleChecks = audit.filter((e) => e.action === "RULE_EVALUATED");
  return { evaluations: evaluations.size, passed: evaluations.size - rejected.length, rejected: rejected.length, ruleChecks: ruleChecks.length, rejectedEvents: rejected };
}

export function allRules(state: ShieldState) {
  return allPacks(state).flatMap((p) => p.rules.map((r) => ({ ...r, wrapper: p.wrapper, packName: p.name, active: state.active_wrappers.includes(p.wrapper) })));
}

export { activePacks, allPacks, getPack };
