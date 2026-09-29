// Application service: the only place that mutates Shield state.
// API routes call these commands; they route every action through the rule engine
// and persist each evaluation to the audit log.
import type {
  Account,
  AuditEvent,
  Client,
  Evaluation,
  Order,
  RulePack,
  ShieldState,
  Stage,
  Transaction,
} from "./types";
import { evaluate } from "./engine/engine";
import { EVALUATORS, SUPPORTED_KINDS, type EvalContext } from "./engine/evaluators";
import { allPacks, contributionLimits, getPack } from "./engine/packs";
import { rulePackSchema } from "./engine/schema";
import { consumeLotsFifo, heldQty, instrumentMap, localPrice, positions, valuation } from "./ledger";
import { capitalBaseTax, estimateTax, simulateWithdrawal } from "./tax";
import { addYears, isoDate, yearsBetween } from "./dates";
import { round2 } from "./money";
import { buildReport } from "./reports";

export class ShieldError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
  toJSON() {
    return { code: this.code, message: this.message, ...this.extra };
  }
}

export const TAX_MODELS = ["gain_tax_schedule", "capital_base_tax"];

// ——— ids & audit ————————————————————————————————————————————————

function hashHex(n: number, len = 12): string {
  let h = (n * 2654435761) >>> 0;
  let out = "";
  while (out.length < len) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, len);
}

export function nextId(state: ShieldState, prefix: string): string {
  state.seq += 1;
  return `${prefix}_${hashHex(state.seq)}`;
}

function audit(state: ShieldState, e: Omit<AuditEvent, "id">): AuditEvent {
  const ev = { id: nextId(state, "evt"), ...e };
  state.audit.push(ev);
  return ev;
}

function auditEvaluation(state: ShieldState, ev: Evaluation, account: Pick<Account, "id" | "partner_id"> | undefined, partnerId: string | undefined, now: Date, subject: Record<string, unknown>) {
  for (const r of ev.results) {
    if (r.outcome === "SKIP") continue;
    audit(state, {
      ts: now.toISOString(),
      account_id: account?.id,
      partner_id: account?.partner_id ?? partnerId,
      wrapper: ev.wrapper,
      action: "RULE_EVALUATED",
      rule_id: r.rule_id,
      result: r.outcome === "PASS" ? "PASS" : r.outcome === "WARN" ? "WARN" : "FAIL",
      code: r.code,
      evaluation_id: ev.id,
      summary: r.message,
      payload: { evaluation_id: ev.id, stage: ev.stage, rule_id: r.rule_id, kind: r.kind, outcome: r.outcome, details: r.details, duration_ms: r.duration_ms, subject },
    });
  }
}

function rejection(ev: Evaluation): ShieldError {
  const f = ev.failed!;
  return new ShieldError(422, f.code, f.message, { rule_id: f.rule_id, explain: f.explain, details: f.details, evaluation: ev });
}

// ——— lookups ——————————————————————————————————————————————————

export function findAccount(state: ShieldState, id: string): Account {
  const a = state.accounts.find((x) => x.id === id);
  if (!a) throw new ShieldError(404, "ACCOUNT_NOT_FOUND", `No account with id ${id}.`);
  return a;
}

export function findClient(state: ShieldState, id: string): Client {
  const c = state.clients.find((x) => x.id === id);
  if (!c) throw new ShieldError(404, "CLIENT_NOT_FOUND", `No client with id ${id}.`);
  return c;
}

function packFor(state: ShieldState, wrapper: string): RulePack {
  const pack = getPack(state, wrapper);
  if (!pack) throw new ShieldError(422, "UNKNOWN_WRAPPER", `No rule pack is registered for wrapper ${wrapper}.`);
  if (!state.active_wrappers.includes(pack.wrapper))
    throw new ShieldError(422, "WRAPPER_NOT_ACTIVE", `${pack.name} is available but not activated for this environment.`, { wrapper: pack.wrapper });
  return pack;
}

function baseCtx(state: ShieldState, account: Account, now: Date): EvalContext {
  const pack = packFor(state, account.wrapper);
  return { pack, now, instruments: instrumentMap(state), account, client: findClient(state, account.client_id) };
}

function accountNumber(state: ShieldState, wrapper: string): string {
  let id: string;
  do {
    state.seq += 1;
    id = `${wrapper.replace(/_/g, "")}-${10000 + ((state.seq * 7919) % 89999)}`;
  } while (state.accounts.some((a) => a.id === id));
  return id;
}

function tx(state: ShieldState, account: Account, t: Omit<Transaction, "id" | "account_id">): Transaction {
  const row = { id: nextId(state, "txn"), account_id: account.id, ...t, amount: round2(t.amount) };
  account.transactions.push(row);
  return row;
}

// ——— commands —————————————————————————————————————————————————

export interface CreateAccountInput {
  client_id?: string;
  client_name?: string;
  partner_id?: string;
  wrapper_type: string;
  tax_residency?: string;
  birth_date?: string;
  initial_deposit?: number;
  account_id?: string; // seed only
}

export function createAccount(state: ShieldState, input: CreateAccountInput, now = new Date()) {
  const pack = packFor(state, input.wrapper_type);
  let client = input.client_id ? state.clients.find((c) => c.id === input.client_id) : undefined;
  const partnerId = input.partner_id ?? client?.partner_id ?? state.partners[0].id;
  if (!state.partners.some((p) => p.id === partnerId)) throw new ShieldError(404, "PARTNER_NOT_FOUND", `No partner with id ${partnerId}.`);
  const isNewClient = !client;
  if (!client) {
    client = {
      id: input.client_id ?? nextId(state, "cli"),
      partner_id: partnerId,
      name: input.client_name ?? `Client ${input.client_id ?? ""}`.trim(),
      tax_residency: (input.tax_residency ?? pack.country).toUpperCase(),
      birth_date: input.birth_date ?? "1988-06-15",
    };
  }
  const clientAccounts = state.accounts.filter((a) => a.client_id === client!.id && a.wrapper === pack.wrapper && a.status === "ACTIVE");
  const evaluation = evaluate(
    "account_opening",
    { pack, now, instruments: instrumentMap(state), client, clientAccounts, initial_deposit: input.initial_deposit ?? 0 },
    nextId(state, "evl"),
  );
  auditEvaluation(state, evaluation, undefined, partnerId, now, { client_id: client.id, wrapper: pack.wrapper });
  if (!evaluation.allowed) {
    audit(state, {
      ts: now.toISOString(),
      partner_id: partnerId,
      wrapper: pack.wrapper,
      action: "ACCOUNT_REJECTED",
      rule_id: evaluation.failed!.rule_id,
      result: "FAIL",
      code: evaluation.failed!.code,
      evaluation_id: evaluation.id,
      summary: `${pack.name} account rejected for ${client.name}`,
      payload: { request: input, evaluation_id: evaluation.id },
    });
    throw rejection(evaluation);
  }
  if (isNewClient) state.clients.push(client);
  const account: Account = {
    id: input.account_id ?? accountNumber(state, pack.wrapper),
    partner_id: partnerId,
    client_id: client.id,
    wrapper: pack.wrapper,
    currency: pack.currency,
    status: "ACTIVE",
    opened_at: now.toISOString(),
    cash: 0,
    lots: [],
    transactions: [],
    dividends: [],
    snapshots: [],
    orders: [],
  };
  state.accounts.push(account);
  audit(state, {
    ts: now.toISOString(),
    account_id: account.id,
    partner_id: partnerId,
    wrapper: pack.wrapper,
    action: "ACCOUNT_CREATED",
    result: "PASS",
    code: "ACCOUNT_CREATED",
    evaluation_id: evaluation.id,
    summary: `${pack.name} account opened for ${client.name}`,
    payload: { account_id: account.id, client_id: client.id, wrapper: pack.wrapper, tax_residency: client.tax_residency, rule_pack_version: pack.version },
  });
  if (input.initial_deposit && input.initial_deposit > 0) {
    account.cash += input.initial_deposit;
    const t = tx(state, account, { type: "DEPOSIT", date: now.toISOString(), amount: input.initial_deposit, description: "Initial deposit" });
    audit(state, {
      ts: now.toISOString(),
      account_id: account.id,
      partner_id: partnerId,
      wrapper: pack.wrapper,
      action: "TRANSFER_ACCEPTED",
      result: "PASS",
      code: "TRANSFER_ACCEPTED",
      evaluation_id: evaluation.id,
      summary: `Initial deposit accepted`,
      payload: { transaction: t },
    });
  }
  return { account: accountView(state, account, now), evaluation };
}

export interface TransferInput {
  direction: "INCOMING" | "OUTGOING";
  amount: number;
  acknowledge_early_exit?: boolean;
}

export function transfer(state: ShieldState, accountId: string, input: TransferInput, now = new Date()) {
  const account = findAccount(state, accountId);
  const ctx = { ...baseCtx(state, account, now), transfer: input };
  const stage: Stage = input.direction === "INCOMING" ? "pre_transfer" : "pre_withdrawal";
  const evaluation = evaluate(stage, ctx, nextId(state, "evl"));
  auditEvaluation(state, evaluation, account, undefined, now, { direction: input.direction, amount: input.amount });
  const transferId = nextId(state, "trf");
  if (!evaluation.allowed) {
    audit(state, {
      ts: now.toISOString(),
      account_id: account.id,
      partner_id: account.partner_id,
      wrapper: account.wrapper,
      action: "TRANSFER_REJECTED",
      rule_id: evaluation.failed!.rule_id,
      result: "FAIL",
      code: evaluation.failed!.code,
      evaluation_id: evaluation.id,
      summary: `${input.direction === "INCOMING" ? "Deposit" : "Withdrawal"} of ${input.amount} rejected`,
      payload: { transfer_id: transferId, request: input, evaluation_id: evaluation.id, details: evaluation.failed!.details },
    });
    throw rejection(evaluation);
  }
  let tax: ReturnType<typeof simulateWithdrawal> | undefined;
  if (input.direction === "INCOMING") {
    account.cash += input.amount;
    tx(state, account, { type: "DEPOSIT", date: now.toISOString(), amount: input.amount, description: "Deposit" });
  } else {
    if (ctx.pack.tax.model === "gain_tax_schedule") {
      tax = simulateWithdrawal({ pack: ctx.pack, account, client: ctx.client!, instruments: ctx.instruments, amount: input.amount, date: now, now });
    }
    account.cash -= input.amount;
    tx(state, account, { type: "WITHDRAWAL", date: now.toISOString(), amount: -input.amount, tax: tax?.tax, description: "Withdrawal" });
    if (tax) {
      audit(state, {
        ts: now.toISOString(),
        account_id: account.id,
        partner_id: account.partner_id,
        wrapper: account.wrapper,
        action: "TAX_CALCULATED",
        result: "INFO",
        code: "WITHDRAWAL_TAX",
        evaluation_id: evaluation.id,
        summary: `Withdrawal tax ${tax.tax} (${tax.bracket.label})`,
        payload: { ...tax },
      });
      if (tax.closes_plan) {
        account.status = "CLOSED";
        account.closed_at = now.toISOString();
        audit(state, {
          ts: now.toISOString(),
          account_id: account.id,
          partner_id: account.partner_id,
          wrapper: account.wrapper,
          action: "ACCOUNT_CLOSED",
          result: "WARN",
          code: "EARLY_WITHDRAWAL_CLOSES_PLAN",
          evaluation_id: evaluation.id,
          summary: `${ctx.pack.name} closed after early withdrawal`,
          payload: { reason: tax.bracket.note },
        });
      }
    }
  }
  audit(state, {
    ts: now.toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "TRANSFER_ACCEPTED",
    result: evaluation.warnings.length ? "WARN" : "PASS",
    code: "TRANSFER_ACCEPTED",
    evaluation_id: evaluation.id,
    summary: `${input.direction === "INCOMING" ? "Deposit" : "Withdrawal"} of ${input.amount} accepted`,
    payload: { transfer_id: transferId, request: input },
  });
  return {
    transfer: { id: transferId, status: "COMPLETE", direction: input.direction, amount: input.amount, currency: account.currency },
    tax,
    account: accountView(state, account, now),
    evaluation,
  };
}

export interface OrderInput {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type?: "market";
}

export function placeOrder(state: ShieldState, accountId: string, input: OrderInput, now = new Date(), priceOverride?: number) {
  const account = findAccount(state, accountId);
  const instruments = instrumentMap(state);
  const inst = instruments[input.symbol.toUpperCase()];
  if (!inst) throw new ShieldError(404, "UNKNOWN_SYMBOL", `No instrument with symbol ${input.symbol}.`);
  if (input.side === "sell" && heldQty(account, inst.symbol) < input.qty)
    throw new ShieldError(422, "INSUFFICIENT_POSITION", `Cannot sell ${input.qty} ${inst.symbol}: only ${heldQty(account, inst.symbol)} held.`);
  const price = round2(priceOverride ?? localPrice(inst, account.currency));
  const notional = round2(price * input.qty);
  const ctx: EvalContext = { ...baseCtx(state, account, now), instrument: inst, order: { side: input.side, qty: input.qty, price, notional } };
  const evaluation = evaluate("pre_trade", ctx, nextId(state, "evl"));
  auditEvaluation(state, evaluation, account, undefined, now, { symbol: inst.symbol, side: input.side, qty: input.qty });
  const order: Order = {
    id: nextId(state, "ord"),
    account_id: account.id,
    symbol: inst.symbol,
    side: input.side,
    qty: input.qty,
    price,
    notional,
    status: evaluation.allowed ? "filled" : "rejected",
    reject_code: evaluation.failed?.code,
    rule_id: evaluation.failed?.rule_id,
    evaluation_id: evaluation.id,
    submitted_at: now.toISOString(),
  };
  account.orders.push(order);
  if (!evaluation.allowed) {
    audit(state, {
      ts: now.toISOString(),
      account_id: account.id,
      partner_id: account.partner_id,
      wrapper: account.wrapper,
      action: "ORDER_REJECTED",
      rule_id: evaluation.failed!.rule_id,
      result: "FAIL",
      code: evaluation.failed!.code,
      evaluation_id: evaluation.id,
      summary: `${input.side.toUpperCase()} ${input.qty} ${inst.symbol} rejected`,
      payload: { order, details: evaluation.failed!.details },
    });
    throw rejection(evaluation);
  }
  let realized: number | undefined;
  if (input.side === "buy") {
    account.cash = round2(account.cash - notional);
    account.lots.push({ id: nextId(state, "lot"), symbol: inst.symbol, qty: input.qty, cost_per_share: price, acquired_at: now.toISOString() });
  } else {
    realized = consumeLotsFifo(account, inst.symbol, input.qty, price);
    account.cash = round2(account.cash + notional);
  }
  tx(state, account, {
    type: input.side === "buy" ? "BUY" : "SELL",
    date: now.toISOString(),
    amount: input.side === "buy" ? -notional : notional,
    symbol: inst.symbol,
    qty: input.qty,
    price,
    realized_gain: realized,
    description: `${input.side === "buy" ? "Bought" : "Sold"} ${input.qty} ${inst.symbol}`,
  });
  audit(state, {
    ts: now.toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "ORDER_ACCEPTED",
    result: "PASS",
    code: "ORDER_FILLED",
    evaluation_id: evaluation.id,
    summary: `${input.side.toUpperCase()} ${input.qty} ${inst.symbol} filled at ${price}`,
    payload: { order },
  });
  const pos = positions(account, instruments).find((p) => p.symbol === inst.symbol);
  return { order, position: pos ? { symbol: pos.symbol, qty: pos.qty, value: round2(pos.value), weight_pct: round2(pos.weight_pct) } : null, account: accountView(state, account, now), evaluation };
}

export function postDividend(state: ShieldState, accountId: string, d: { symbol: string; per_share: number; date: Date; wht_rate: number; treaty_rate: number }) {
  const account = findAccount(state, accountId);
  const qty = heldQty(account, d.symbol);
  if (!qty) return;
  const gross = round2(qty * d.per_share);
  const wht = round2(gross * d.wht_rate);
  const reclaimable = round2(gross * Math.max(0, d.wht_rate - d.treaty_rate));
  account.dividends.push({ id: nextId(state, "div"), date: d.date.toISOString(), symbol: d.symbol, gross, wht, wht_rate: d.wht_rate, treaty_rate: d.treaty_rate, reclaimable });
  account.cash = round2(account.cash + gross - wht);
  tx(state, account, { type: "DIVIDEND", date: d.date.toISOString(), amount: gross - wht, symbol: d.symbol, description: `Dividend ${d.symbol}` });
  audit(state, {
    ts: d.date.toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "DIVIDEND_POSTED",
    result: "INFO",
    code: "DIVIDEND_POSTED",
    summary: `Dividend ${d.symbol}: gross ${gross}, WHT ${wht}`,
    payload: { symbol: d.symbol, gross, wht, wht_rate: d.wht_rate, reclaimable },
  });
}

export function captureSnapshot(state: ShieldState, accountId: string, date: string, value?: number) {
  const account = findAccount(state, accountId);
  const v = value ?? valuation(account, instrumentMap(state)).total;
  account.snapshots = account.snapshots.filter((s) => s.date !== date).concat({ date, value: round2(v) });
  audit(state, {
    ts: new Date(`${date}T00:00:00Z`).toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "SNAPSHOT_CAPTURED",
    result: "INFO",
    code: "QUARTERLY_SNAPSHOT",
    summary: `Quarterly value snapshot ${date}`,
    payload: { date, value: round2(v), currency: account.currency },
  });
}

export function complianceAlert(state: ShieldState, accountId: string, ts: Date, ruleId: string, code: string, summary: string, payload: Record<string, unknown>) {
  const account = findAccount(state, accountId);
  audit(state, { ts: ts.toISOString(), account_id: account.id, partner_id: account.partner_id, wrapper: account.wrapper, action: "COMPLIANCE_ALERT", rule_id: ruleId, result: "FAIL", code, summary, payload });
}

// ——— read models ——————————————————————————————————————————————

export function accountView(state: ShieldState, account: Account, now = new Date()) {
  const client = state.clients.find((c) => c.id === account.client_id);
  const v = valuation(account, instrumentMap(state), now);
  return {
    id: account.id,
    wrapper_type: account.wrapper,
    status: account.status,
    currency: account.currency,
    partner_id: account.partner_id,
    client_id: account.client_id,
    client_name: client?.name,
    tax_residency: client?.tax_residency,
    opened_at: account.opened_at,
    cash: v.cash,
    portfolio_value: v.total,
    ...wrapperHeadroom(state, account, now),
  };
}

function wrapperHeadroom(state: ShieldState, account: Account, now: Date) {
  const pack = getPack(state, account.wrapper)!;
  const limits = contributionLimits(pack);
  const v = valuation(account, instrumentMap(state), now);
  const lifetimeHeadroom = limits.lifetime !== null ? Math.max(0, limits.lifetime - v.deposits_lifetime) : null;
  const annualHeadroom = limits.annual !== null ? Math.max(0, limits.annual - v.deposits_year) : null;
  const candidates = [lifetimeHeadroom, annualHeadroom].filter((x): x is number => x !== null);
  return {
    contribution_headroom: candidates.length ? round2(Math.min(...candidates)) : null,
    plan_age_years: Math.round(v.plan_age_years * 100) / 100,
  };
}

export function wrapperSummary(state: ShieldState, accountId: string, now = new Date()) {
  const account = findAccount(state, accountId);
  const pack = getPack(state, account.wrapper)!;
  const client = findClient(state, account.client_id);
  const instruments = instrumentMap(state);
  const v = valuation(account, instruments, now);
  const limits = contributionLimits(pack);
  const holding = pack.plan.holding_period_years;
  const compliance = evaluate("compliance", { pack, now, instruments, account, client }, `evl_compliance_${account.id}`);
  const tax = estimateTax(pack, account, client, instruments, now);
  return {
    account_id: account.id,
    wrapper: { type: pack.wrapper, name: pack.name, full_name: pack.full_name, country: pack.country, rule_pack_version: pack.version },
    status: account.status,
    currency: account.currency,
    valuation: v,
    contributions: {
      lifetime_limit: limits.lifetime,
      annual_limit: limits.annual,
      used_lifetime: v.deposits_lifetime,
      used_this_year: v.deposits_year,
      headroom_lifetime: limits.lifetime !== null ? round2(Math.max(0, limits.lifetime - v.deposits_lifetime)) : null,
      headroom_this_year: limits.annual !== null ? round2(Math.max(0, limits.annual - v.deposits_year)) : null,
    },
    holding_period: holding
      ? {
          required_years: holding,
          plan_age_years: Math.round(v.plan_age_years * 100) / 100,
          anniversary_date: isoDate(addYears(account.opened_at, holding)),
          met: v.plan_age_years >= holding,
        }
      : null,
    compliance: {
      status: compliance.results.every((r) => r.outcome !== "FAIL") ? "COMPLIANT" : "BREACH",
      checks: compliance.results.map((r) => ({ rule_id: r.rule_id, outcome: r.outcome, message: r.message, details: r.details })),
    },
    estimated_tax: { label: tax.label, amount: tax.amount, currency: tax.currency, note: tax.note, model: tax.model },
    disclaimer: "Simplified for demo — not tax advice.",
  };
}

export function taxLots(state: ShieldState, accountId: string) {
  const account = findAccount(state, accountId);
  const instruments = instrumentMap(state);
  return account.lots
    .filter((l) => l.qty > 0)
    .map((l) => {
      const price = localPrice(instruments[l.symbol], account.currency);
      const value = l.qty * price;
      const cost = l.qty * l.cost_per_share;
      return {
        lot_id: l.id,
        symbol: l.symbol,
        acquired_at: l.acquired_at,
        qty: l.qty,
        cost_per_share: round2(l.cost_per_share),
        cost_basis: round2(cost),
        current_price: round2(price),
        current_value: round2(value),
        unrealized_gain: round2(value - cost),
        holding_days: Math.floor(yearsBetween(l.acquired_at, new Date()) * 365.25),
      };
    })
    .sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
}

export function generateReport(state: ShieldState, accountId: string, year: number, now = new Date()) {
  const account = findAccount(state, accountId);
  const pack = getPack(state, account.wrapper)!;
  const client = findClient(state, account.client_id);
  const partner = state.partners.find((p) => p.id === account.partner_id)!;
  const report = buildReport({ pack, account, client, partner, instruments: instrumentMap(state), year, now });
  const id = nextId(state, "rpt");
  state.reports.push({ id, account_id: account.id, year, format: pack.reporting.format, generated_at: now.toISOString() });
  audit(state, {
    ts: now.toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "TAX_CALCULATED",
    result: "INFO",
    code: "ANNUAL_TAX_SUMMARY",
    summary: `${year} tax summary calculated`,
    payload: { year, totals: report.totals },
  });
  audit(state, {
    ts: now.toISOString(),
    account_id: account.id,
    partner_id: account.partner_id,
    wrapper: account.wrapper,
    action: "REPORT_GENERATED",
    result: "PASS",
    code: pack.reporting.format,
    summary: `${pack.reporting.name} ${year} generated`,
    payload: { report_id: id, year, format: pack.reporting.format },
  });
  return { report_id: id, ...report };
}

// ——— simulation (dry run) —————————————————————————————————————————

export type SimulateInput =
  | { action: "open_account"; account?: never } & CreateAccountInput
  | { action: "order"; account_id: string; symbol: string; qty: number; side: "buy" | "sell" }
  | { action: "deposit"; account_id: string; amount: number }
  | { action: "withdrawal"; account_id: string; amount: number; date?: string; assumed_return?: number; acknowledge_early_exit?: boolean };

/** Dry run: executes the command against a disposable copy. Never mutates state. */
export function simulate(state: ShieldState, input: SimulateInput, now = new Date()) {
  const sandbox: ShieldState = structuredClone(state);
  const at = input.action === "withdrawal" && input.date ? new Date(input.date) : now;
  let evaluation: Evaluation;
  let result: unknown = null;
  try {
    if (input.action === "open_account") result = createAccount(sandbox, input, at);
    else if (input.action === "order") result = placeOrder(sandbox, input.account_id, input, at);
    else if (input.action === "deposit") result = transfer(sandbox, input.account_id, { direction: "INCOMING", amount: input.amount }, at);
    else result = transfer(sandbox, input.account_id, { direction: "OUTGOING", amount: input.amount, acknowledge_early_exit: input.acknowledge_early_exit ?? true }, at);
    evaluation = (result as { evaluation: Evaluation }).evaluation;
  } catch (e) {
    if (e instanceof ShieldError && e.extra.evaluation) evaluation = e.extra.evaluation as Evaluation;
    else throw e;
  }
  let tax: unknown;
  if (input.action === "withdrawal") {
    const account = findAccount(state, input.account_id);
    const pack = getPack(state, account.wrapper)!;
    if (pack.tax.model === "gain_tax_schedule")
      tax = simulateWithdrawal({ pack, account, client: findClient(state, account.client_id), instruments: instrumentMap(state), amount: input.amount, date: at, now, assumed_return: input.assumed_return });
  }
  return { dry_run: true, allowed: evaluation.allowed, evaluation, tax, state_modified: false };
}

export function iskCalculation(state: ShieldState, accountId: string, now = new Date(), year?: number) {
  const account = findAccount(state, accountId);
  const pack = getPack(state, account.wrapper)!;
  if (pack.tax.model !== "capital_base_tax") throw new ShieldError(422, "TAX_MODEL_MISMATCH", `${pack.name} does not use a capital-based tax.`);
  return capitalBaseTax(pack, account, instrumentMap(state), now, year);
}

// ——— wrapper packs ————————————————————————————————————————————————

export function validatePack(raw: unknown) {
  const parsed = rulePackSchema.safeParse(raw);
  if (!parsed.success) {
    return { valid: false as const, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const pack = parsed.data as RulePack;
  const errors: string[] = [];
  for (const r of pack.rules) if (!EVALUATORS[r.kind]) errors.push(`rules.${r.id}: unsupported kind "${r.kind}" (supported: ${SUPPORTED_KINDS.join(", ")})`);
  if (!TAX_MODELS.includes(pack.tax.model)) errors.push(`tax.model: unsupported "${pack.tax.model}" (supported: ${TAX_MODELS.join(", ")})`);
  const ids = pack.rules.map((r) => r.id);
  if (new Set(ids).size !== ids.length) errors.push("rules: duplicate rule ids");
  if (errors.length) return { valid: false as const, errors };
  return {
    valid: true as const,
    pack,
    summary: {
      wrapper: pack.wrapper,
      name: pack.name,
      country: pack.country,
      country_name: pack.country_name,
      currency: pack.currency,
      rules: pack.rules.length,
      stages: [...new Set(pack.rules.flatMap((r) => r.stages))],
      kinds: [...new Set(pack.rules.map((r) => r.kind))],
      tax_model: pack.tax.model,
    },
  };
}

export function activateWrapper(state: ShieldState, raw: unknown, now = new Date()) {
  const v = validatePack(raw);
  if (!v.valid) throw new ShieldError(400, "INVALID_RULE_PACK", "The rule pack failed validation.", { errors: v.errors });
  const builtin = allPacks({ custom_packs: [] }).some((p) => p.wrapper === v.pack.wrapper);
  if (!builtin) state.custom_packs = state.custom_packs.filter((p) => p.wrapper !== v.pack.wrapper).concat(v.pack);
  if (!state.active_wrappers.includes(v.pack.wrapper)) state.active_wrappers.push(v.pack.wrapper);
  audit(state, {
    ts: now.toISOString(),
    wrapper: v.pack.wrapper,
    action: "WRAPPER_ACTIVATED",
    result: "PASS",
    code: "WRAPPER_ACTIVATED",
    summary: `${v.pack.name} (${v.pack.country_name}) activated — ${v.pack.rules.length} rules`,
    payload: { ...v.summary, version: v.pack.version },
  });
  return { activated: true, ...v.summary };
}
