import type { Account, Client, RulePack, TaxScheduleBracket } from "../types";
import { evalPredicate } from "../engine/predicate";
import { valuation, type InstrumentMap } from "../ledger";
import { round2 } from "../money";
import { yearsBetween } from "../dates";

// Tax models are generic calculators configured by the rule pack's `tax` block.
// Simplified for demonstration — not tax advice.

export interface WithdrawalInput {
  pack: RulePack;
  account: Account;
  client: Client;
  instruments: InstrumentMap;
  amount: number;
  date: Date;
  now?: Date;
  assumed_return?: number; // annual, e.g. 0.05
}

export interface WithdrawalResult {
  model: "gain_tax_schedule";
  currency: string;
  date: string;
  plan_age_years: number;
  client_age: number;
  current_value: number;
  projected_value: number;
  net_contributions: number;
  gain_total: number;
  gain_ratio: number;
  amount: number;
  gain_portion: number;
  capital_portion: number;
  bracket: TaxScheduleBracket;
  rate: number;
  tax: number;
  net: number;
  closes_plan: boolean;
  schedule: (TaxScheduleBracket & { applies: boolean })[];
}

function scheduleOf(pack: RulePack): TaxScheduleBracket[] {
  if (pack.tax.model !== "gain_tax_schedule") throw new Error(`${pack.wrapper} does not use gain_tax_schedule`);
  return pack.tax.params.schedule as TaxScheduleBracket[];
}

export function simulateWithdrawal(input: WithdrawalInput): WithdrawalResult {
  const now = input.now ?? new Date();
  const schedule = scheduleOf(input.pack);
  const v = valuation(input.account, input.instruments, now);
  const yearsAhead = Math.max(0, yearsBetween(now, input.date));
  const projected = v.total * Math.pow(1 + (input.assumed_return ?? 0), yearsAhead);
  const gainTotal = Math.max(0, projected - v.net_contributions);
  const ratio = projected > 0 ? gainTotal / projected : 0;
  const amount = Math.min(input.amount, projected);
  const subject = {
    plan_age_years: yearsBetween(input.account.opened_at, input.date),
    client_age: Math.floor(yearsBetween(input.client.birth_date, input.date)),
  };
  const bracket = schedule.find((b) => evalPredicate(b.when, subject)) ?? schedule[schedule.length - 1];
  const gainPortion = amount * ratio;
  const tax = gainPortion * bracket.rate;
  return {
    model: "gain_tax_schedule",
    currency: input.account.currency,
    date: input.date.toISOString(),
    plan_age_years: Math.round(subject.plan_age_years * 100) / 100,
    client_age: subject.client_age,
    current_value: round2(v.total),
    projected_value: round2(projected),
    net_contributions: round2(v.net_contributions),
    gain_total: round2(gainTotal),
    gain_ratio: Math.round(ratio * 10000) / 10000,
    amount: round2(amount),
    gain_portion: round2(gainPortion),
    capital_portion: round2(amount - gainPortion),
    bracket,
    rate: bracket.rate,
    tax: round2(tax),
    net: round2(amount - tax),
    closes_plan: bracket.closes_plan,
    schedule: schedule.map((b) => ({ ...b, applies: b === bracket })),
  };
}

export interface CapitalBaseResult {
  model: "capital_base_tax";
  currency: string;
  year: number;
  snapshots: { label: string; date: string; value: number; projected: boolean }[];
  snapshot_sum: number;
  deposits_year: number;
  capital_base: number;
  tax_free_base: number;
  taxable_base: number;
  standard_rate: number;
  standard_income: number;
  tax_rate: number;
  tax: number;
  effective_rate_pct: number;
}

const QUARTER_LABEL = ["Q1", "Q2", "Q3", "Q4"];

export function capitalBaseTax(pack: RulePack, account: Account, instruments: InstrumentMap, now = new Date(), yearOverride?: number): CapitalBaseResult {
  const p = pack.tax.params as { year: number; snapshot_dates: string[]; tax_free_base: number; standard_rate: number; tax_rate: number };
  const year = yearOverride ?? p.year;
  const v = valuation(account, instruments, now);
  const snapshots = p.snapshot_dates.map((mmdd, i) => {
    const date = `${year}-${mmdd}`;
    const captured = account.snapshots.find((s) => s.date === date);
    return {
      label: QUARTER_LABEL[i] ?? `S${i + 1}`,
      date,
      value: round2(captured ? captured.value : v.total),
      projected: !captured,
    };
  });
  const deposits = account.transactions
    .filter((t) => t.type === "DEPOSIT" && new Date(t.date).getUTCFullYear() === year)
    .reduce((s, t) => s + t.amount, 0);
  const sum = snapshots.reduce((s, x) => s + x.value, 0);
  const capitalBase = (sum + deposits) / snapshots.length;
  const taxable = Math.max(0, capitalBase - p.tax_free_base);
  const income = taxable * p.standard_rate;
  const tax = income * p.tax_rate;
  return {
    model: "capital_base_tax",
    currency: account.currency,
    year,
    snapshots,
    snapshot_sum: round2(sum),
    deposits_year: round2(deposits),
    capital_base: round2(capitalBase),
    tax_free_base: p.tax_free_base,
    taxable_base: round2(taxable),
    standard_rate: p.standard_rate,
    standard_income: round2(income),
    tax_rate: p.tax_rate,
    tax: round2(tax),
    effective_rate_pct: v.total ? Math.round((tax / v.total) * 10000) / 100 : 0,
  };
}

export interface TaxEstimate {
  model: string;
  label: string;
  amount: number;
  currency: string;
  note: string;
  detail: WithdrawalResult | CapitalBaseResult;
}

/** One-line tax status for an account, dispatched by the pack's tax model. */
export function estimateTax(pack: RulePack, account: Account, client: Client, instruments: InstrumentMap, now = new Date()): TaxEstimate {
  if (pack.tax.model === "capital_base_tax") {
    const r = capitalBaseTax(pack, account, instruments, now);
    return { model: pack.tax.model, label: `${r.year} estimated tax`, amount: r.tax, currency: account.currency, note: "Annual tax on average capital base", detail: r };
  }
  const total = valuation(account, instruments, now).total;
  const r = simulateWithdrawal({ pack, account, client, instruments, amount: total, date: now, now });
  return {
    model: pack.tax.model,
    label: "Tax if withdrawn today",
    amount: r.tax,
    currency: account.currency,
    note: `${r.bracket.label}: ${(r.rate * 100).toFixed(1)}% on gains`,
    detail: r,
  };
}
