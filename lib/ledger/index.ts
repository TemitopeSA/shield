import type { Account, Instrument, ShieldState, TaxLot } from "../types";
import { convert, round2 } from "../money";
import { yearsBetween } from "../dates";

export type InstrumentMap = Record<string, Instrument>;

export const instrumentMap = (state: Pick<ShieldState, "instruments">): InstrumentMap =>
  Object.fromEntries(state.instruments.map((i) => [i.symbol, i]));

/** Instrument price expressed in the account's currency. */
export const localPrice = (inst: Instrument, currency: string) => convert(inst.price, inst.currency, currency);

export interface Position {
  symbol: string;
  name: string;
  issuer: string;
  qty: number;
  price: number;
  value: number;
  cost_basis: number;
  gain: number;
  gain_pct: number;
  weight_pct: number;
  instrument: Instrument;
}

export function positions(account: Account, instruments: InstrumentMap): Position[] {
  const bySymbol = new Map<string, TaxLot[]>();
  for (const lot of account.lots) {
    if (lot.qty <= 0) continue;
    bySymbol.set(lot.symbol, [...(bySymbol.get(lot.symbol) ?? []), lot]);
  }
  const rows: Position[] = [];
  for (const [symbol, lots] of bySymbol) {
    const inst = instruments[symbol];
    const qty = lots.reduce((s, l) => s + l.qty, 0);
    const cost = lots.reduce((s, l) => s + l.qty * l.cost_per_share, 0);
    const price = localPrice(inst, account.currency);
    const value = qty * price;
    rows.push({
      symbol,
      name: inst.name,
      issuer: inst.issuer,
      qty,
      price,
      value,
      cost_basis: cost,
      gain: value - cost,
      gain_pct: cost ? ((value - cost) / cost) * 100 : 0,
      weight_pct: 0,
      instrument: inst,
    });
  }
  const total = rows.reduce((s, r) => s + r.value, 0) + account.cash;
  for (const r of rows) r.weight_pct = total ? (r.value / total) * 100 : 0;
  return rows.sort((a, b) => b.value - a.value);
}

export interface Valuation {
  cash: number;
  invested: number;
  total: number;
  cost_basis: number;
  unrealized_gain: number;
  deposits_lifetime: number;
  deposits_year: number;
  withdrawals: number;
  net_contributions: number;
  plan_age_years: number;
}

export function contributions(account: Account, year?: number): number {
  return account.transactions
    .filter((t) => t.type === "DEPOSIT" && (year === undefined || new Date(t.date).getUTCFullYear() === year))
    .reduce((s, t) => s + t.amount, 0);
}

export function valuation(account: Account, instruments: InstrumentMap, now: Date = new Date()): Valuation {
  const pos = positions(account, instruments);
  const invested = pos.reduce((s, p) => s + p.value, 0);
  const cost = pos.reduce((s, p) => s + p.cost_basis, 0);
  const deposits = contributions(account);
  const withdrawals = -account.transactions.filter((t) => t.type === "WITHDRAWAL").reduce((s, t) => s + t.amount, 0);
  return {
    cash: round2(account.cash),
    invested: round2(invested),
    total: round2(invested + account.cash),
    cost_basis: round2(cost),
    unrealized_gain: round2(invested - cost),
    deposits_lifetime: round2(deposits),
    deposits_year: round2(contributions(account, now.getUTCFullYear())),
    withdrawals: round2(withdrawals),
    net_contributions: round2(deposits - withdrawals),
    plan_age_years: Math.max(0, yearsBetween(account.opened_at, now)),
  };
}

/** Consume lots first-in-first-out; returns realised gain. */
export function consumeLotsFifo(account: Account, symbol: string, qty: number, price: number): number {
  let remaining = qty;
  let gain = 0;
  const lots = account.lots.filter((l) => l.symbol === symbol && l.qty > 0).sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty, remaining);
    gain += take * (price - lot.cost_per_share);
    lot.qty -= take;
    remaining -= take;
  }
  account.lots = account.lots.filter((l) => l.qty > 0);
  return round2(gain);
}

export const heldQty = (account: Account, symbol: string) =>
  account.lots.filter((l) => l.symbol === symbol).reduce((s, l) => s + l.qty, 0);
