import { beforeEach, describe, expect, it } from "vitest";
import { seedState, DEMO } from "@/lib/seed";
import { emptyState } from "@/lib/seed";
import {
  activateWrapper,
  captureSnapshot,
  createAccount,
  iskCalculation,
  placeOrder,
  ShieldError,
  simulate,
  transfer,
  validatePack,
  wrapperSummary,
} from "@/lib/service";
import { BUILTIN_PACKS, getPack } from "@/lib/engine/packs";
import { simulateWithdrawal } from "@/lib/tax";
import { addYears } from "@/lib/dates";
import { instrumentMap } from "@/lib/ledger";
import type { ShieldState } from "@/lib/types";

const NOW = new Date("2026-09-29T12:00:00Z");

function rejected(fn: () => unknown): ShieldError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ShieldError) return e;
    throw e;
  }
  throw new Error("expected a rejection");
}

let s: ShieldState;
beforeEach(() => {
  s = emptyState();
});

const openPea = (residency = "FR", deposit = 20000) =>
  createAccount(s, { client_id: `c_${residency}_${s.seq}`, client_name: "Test", wrapper_type: "PEA", tax_residency: residency, initial_deposit: deposit }, NOW);

describe("rule packs", () => {
  it("every bundled pack validates against the engine", () => {
    for (const { pack } of BUILTIN_PACKS) expect(validatePack(pack).valid).toBe(true);
  });
  it("rejects a pack using an unknown evaluator", () => {
    const bad = structuredClone(BUILTIN_PACKS[0].pack);
    bad.rules[0].kind = "magic";
    const v = validatePack(bad);
    expect(v.valid).toBe(false);
  });
});

describe("PEA", () => {
  it("French resident can open a PEA", () => {
    const { account } = openPea("FR");
    expect(account.wrapper_type).toBe("PEA");
    expect(account.contribution_headroom).toBe(130000);
  });

  it("non-French resident cannot", () => {
    const e = rejected(() => openPea("BE"));
    expect(e.code).toBe("RESIDENCY_NOT_ELIGIBLE");
    expect(e.extra.rule_id).toBe("PEA_RESIDENCY");
  });

  it("one PEA per client", () => {
    createAccount(s, { client_id: "dup", wrapper_type: "PEA", tax_residency: "FR" }, NOW);
    expect(rejected(() => createAccount(s, { client_id: "dup", wrapper_type: "PEA" }, NOW)).code).toBe("DUPLICATE_WRAPPER_ACCOUNT");
  });

  it("AAPL is rejected", () => {
    const { account } = openPea();
    const e = rejected(() => placeOrder(s, account.id, { symbol: "AAPL", qty: 10, side: "buy" }, NOW));
    expect(e.code).toBe("INSTRUMENT_NOT_ELIGIBLE");
    expect(e.extra.rule_id).toBe("PEA_ELIGIBLE_UNIVERSE");
  });

  it("an eligible EU/EEA stock is accepted and fills", () => {
    const { account } = openPea();
    const r = placeOrder(s, account.id, { symbol: "TTE", qty: 10, side: "buy" }, NOW);
    expect(r.order.status).toBe("filled");
    expect(r.order.notional).toBe(625);
    expect(r.account.cash).toBe(19375);
  });

  it("a non-EU world ETF is rejected but the PEA-eligible synthetic ETF is accepted", () => {
    const { account } = openPea();
    expect(rejected(() => placeOrder(s, account.id, { symbol: "IWDA", qty: 1, side: "buy" }, NOW)).code).toBe("INSTRUMENT_NOT_ELIGIBLE");
    expect(placeOrder(s, account.id, { symbol: "CW8", qty: 1, side: "buy" }, NOW).order.status).toBe("filled");
  });

  it("enforces the €150k contribution limit", () => {
    const { account } = openPea("FR", 145000);
    const e = rejected(() => transfer(s, account.id, { direction: "INCOMING", amount: 10000 }, NOW));
    expect(e.code).toBe("CONTRIBUTION_LIMIT_EXCEEDED");
    expect(e.extra.details).toMatchObject({ requested: 10000, available: 5000, excess: 5000 });
    const ok = transfer(s, account.id, { direction: "INCOMING", amount: 5000 }, NOW);
    expect(ok.account.contribution_headroom).toBe(0);
  });

  it("withdrawal before 5 years taxes the gain at 31.4% and closes the plan", () => {
    const seeded = seedState();
    const a = seeded.accounts.find((x) => x.id === DEMO.pea)!;
    const r = simulateWithdrawal({ pack: getPack(seeded, "PEA")!, account: a, client: seeded.clients.find((c) => c.id === a.client_id)!, instruments: instrumentMap(seeded), amount: 20000, date: addYears(a.opened_at, 2), now: addYears(a.opened_at, 2) });
    expect(r.rate).toBe(0.314);
    expect(r.closes_plan).toBe(true);
    expect(r.tax).toBeCloseTo(r.gain_portion * 0.314, 1);
  });

  it("withdrawal after 5 years only pays 18.6% social charges", () => {
    const seeded = seedState();
    const a = seeded.accounts.find((x) => x.id === DEMO.pea)!;
    const r = simulateWithdrawal({ pack: getPack(seeded, "PEA")!, account: a, client: seeded.clients.find((c) => c.id === a.client_id)!, instruments: instrumentMap(seeded), amount: 20000, date: addYears(a.opened_at, 5.5), now: NOW });
    expect(r.rate).toBe(0.186);
    expect(r.closes_plan).toBe(false);
  });

  it("early withdrawal requires acknowledgement, then closes the plan", () => {
    const { account } = openPea("FR", 20000);
    expect(rejected(() => transfer(s, account.id, { direction: "OUTGOING", amount: 1000 }, NOW)).code).toBe("EARLY_WITHDRAWAL_CLOSES_PLAN");
    const r = transfer(s, account.id, { direction: "OUTGOING", amount: 1000, acknowledge_early_exit: true }, NOW);
    expect(r.account.status).toBe("CLOSED");
  });
});

describe("ISK", () => {
  it("captures quarterly values", () => {
    const { account } = createAccount(s, { client_id: "se", wrapper_type: "ISK", tax_residency: "SE", initial_deposit: 500000 }, new Date("2025-12-01"));
    captureSnapshot(s, account.id, "2026-01-01", 500000);
    captureSnapshot(s, account.id, "2026-04-01", 520000);
    const acct = s.accounts.find((a) => a.id === account.id)!;
    expect(acct.snapshots.map((x) => x.date)).toEqual(["2026-01-01", "2026-04-01"]);
  });

  it("applies the tax-free base and computes the annual tax", () => {
    const { account } = createAccount(s, { client_id: "se2", wrapper_type: "ISK", tax_residency: "SE", initial_deposit: 400000 }, new Date("2025-12-01"));
    for (const d of ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]) captureSnapshot(s, account.id, d, 400000);
    const r = iskCalculation(s, account.id, NOW);
    // (4 × 400,000 + 0 deposits in 2026) / 4 = 400,000 → − 300,000 → 100,000 × 3.55% × 30%
    expect(r.capital_base).toBe(400000);
    expect(r.taxable_base).toBe(100000);
    expect(r.tax).toBeCloseTo(1065, 2);
  });

  it("an ISK can hold AAPL (same order, different rule pack)", () => {
    const { account } = createAccount(s, { client_id: "se3", wrapper_type: "ISK", tax_residency: "SE", initial_deposit: 100000 }, NOW);
    expect(placeOrder(s, account.id, { symbol: "AAPL", qty: 1, side: "buy" }, NOW).order.status).toBe("filled");
  });
});

describe("PIR", () => {
  const openPir = (deposit: number, at = NOW) => createAccount(s, { client_id: `it_${s.seq}`, wrapper_type: "PIR", tax_residency: "IT", initial_deposit: deposit }, at);

  it("enforces the €40k annual limit", () => {
    const { account } = openPir(35000);
    const e = rejected(() => transfer(s, account.id, { direction: "INCOMING", amount: 6000 }, NOW));
    expect(e.code).toBe("CONTRIBUTION_LIMIT_EXCEEDED");
    expect(e.extra.rule_id).toBe("PIR_ANNUAL_LIMIT");
  });

  it("enforces the €200k lifetime limit", () => {
    const { account } = openPir(40000, new Date("2021-01-10"));
    for (const y of [2022, 2023, 2024, 2025]) transfer(s, account.id, { direction: "INCOMING", amount: 40000 }, new Date(`${y}-02-01`));
    // €200k contributed; the 2026 annual allowance is untouched but the lifetime cap is reached.
    const e = rejected(() => transfer(s, account.id, { direction: "INCOMING", amount: 1000 }, NOW));
    expect(e.extra.rule_id).toBe("PIR_LIFETIME_LIMIT");
  });

  it("rejects an order pushing an issuer above 10%", () => {
    const seeded = seedState();
    const e = rejected(() => placeOrder(seeded, DEMO.pir, { symbol: "ISP", qty: 219, side: "buy" }, NOW));
    expect(e.code).toBe("CONCENTRATION_LIMIT_EXCEEDED");
    const d = e.extra.details as { current_pct: number; after_pct: number; max_pct: number };
    expect(d.current_pct).toBeLessThan(10);
    expect(d.after_pct).toBeGreaterThan(10);
  });

  it("calculates compliance ratios", () => {
    const seeded = seedState();
    const c = wrapperSummary(seeded, DEMO.pir, NOW).compliance;
    expect(c.status).toBe("COMPLIANT");
    const it = c.checks.find((x) => x.rule_id === "PIR_ITALIAN_ALLOCATION")!;
    expect(it.details.actual_pct as number).toBeGreaterThanOrEqual(70);
  });
});

describe("audit & simulation", () => {
  it("every rule evaluation creates an audit event", () => {
    const { account } = openPea();
    const before = s.audit.length;
    rejected(() => placeOrder(s, account.id, { symbol: "AAPL", qty: 1, side: "buy" }, NOW));
    const events = s.audit.slice(before);
    const ruleEvents = events.filter((e) => e.action === "RULE_EVALUATED");
    expect(ruleEvents.length).toBe(4);
    expect(events.at(-1)!.action).toBe("ORDER_REJECTED");
    expect(new Set(events.map((e) => e.evaluation_id)).size).toBe(1);
  });

  it("simulate is a dry run and never modifies state", () => {
    const seeded = seedState();
    const snapshot = JSON.stringify(seeded);
    const r = simulate(seeded, { action: "order", account_id: DEMO.pea, symbol: "AAPL", qty: 1, side: "buy" }, NOW);
    expect(r.allowed).toBe(false);
    expect(JSON.stringify(seeded)).toBe(snapshot);
  });

  it("a new wrapper is configuration: activating IKE needs no code", () => {
    const ike = BUILTIN_PACKS.find((b) => b.pack.wrapper === "IKE")!.pack;
    expect(rejected(() => createAccount(s, { client_id: "pl", wrapper_type: "IKE", tax_residency: "PL" }, NOW)).code).toBe("WRAPPER_NOT_ACTIVE");
    expect(activateWrapper(s, ike, NOW).rules).toBe(6);
    const { account } = createAccount(s, { client_id: "pl", wrapper_type: "IKE", tax_residency: "PL", initial_deposit: 10000 }, NOW);
    expect(account.currency).toBe("PLN");
    expect(rejected(() => transfer(s, account.id, { direction: "INCOMING", amount: 20000 }, NOW)).extra.rule_id).toBe("IKE_ANNUAL_LIMIT");
  });
});
