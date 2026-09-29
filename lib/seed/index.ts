import type { ShieldState } from "../types";
import { INSTRUMENTS } from "./instruments";
import { DEFAULT_ACTIVE, getPack } from "../engine/packs";
import { evalPredicate } from "../engine/predicate";
import { captureSnapshot, complianceAlert, createAccount, generateReport, placeOrder, postDividend, ShieldError, transfer } from "../service";
import { instrumentMap, localPrice, valuation } from "../ledger";
import type { Predicate } from "../types";

// The seed is not a static fixture: it replays 12–18 months of partner activity
// through the real engine, so every historical rule evaluation in the audit log
// was actually produced by the rules.

import { DEMO } from "./demo-ids";
export { DEMO };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (d: string, hm = "10:15") => new Date(`${d}T${hm}:00Z`);

function tryRun(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof ShieldError)) throw e;
  }
}

export function emptyState(): ShieldState {
  return {
    version: 1,
    seeded_at: new Date().toISOString(),
    seq: 0,
    partners: [
      { id: DEMO.partners.lumen, name: "Lumen Invest", country: "FR", tagline: "Neobroker · France" },
      { id: DEMO.partners.nordfond, name: "Nordfond", country: "SE", tagline: "Savings app · Sweden" },
      { id: DEMO.partners.risparmio, name: "Risparmio Digitale", country: "IT", tagline: "Digital wealth · Italy" },
    ],
    clients: [],
    accounts: [],
    instruments: structuredClone(INSTRUMENTS),
    audit: [],
    reports: [],
    active_wrappers: [...DEFAULT_ACTIVE],
    custom_packs: [],
  };
}

export function seedState(): ShieldState {
  const s = emptyState();
  const P = DEMO.partners;

  // ——— Camille Laurent · PEA · Lumen Invest — approaching the €150k ceiling ———
  s.clients.push({ id: "cli_camille", partner_id: P.lumen, name: "Camille Laurent", tax_residency: "FR", birth_date: "1986-03-09" });
  createAccount(s, { client_id: "cli_camille", wrapper_type: "PEA", initial_deposit: 40000, account_id: DEMO.pea }, at("2025-04-14", "09:02"));
  const pea = DEMO.pea;
  placeOrder(s, pea, { symbol: "TTE", qty: 200, side: "buy" }, at("2025-04-15", "09:31"), 57.8);
  placeOrder(s, pea, { symbol: "MC", qty: 40, side: "buy" }, at("2025-04-15", "09:33"), 560);
  transfer(s, pea, { direction: "INCOMING", amount: 15000 }, at("2025-06-02"));
  placeOrder(s, pea, { symbol: "AIR", qty: 120, side: "buy" }, at("2025-06-03", "13:04"), 150.2);
  postDividend(s, pea, { symbol: "TTE", per_share: 0.85, date: at("2025-07-01"), wht_rate: 0, treaty_rate: 0 });
  transfer(s, pea, { direction: "INCOMING", amount: 20000 }, at("2025-09-01"));
  placeOrder(s, pea, { symbol: "SAP", qty: 90, side: "buy" }, at("2025-09-02", "10:47"), 240);
  postDividend(s, pea, { symbol: "TTE", per_share: 0.85, date: at("2025-10-01"), wht_rate: 0, treaty_rate: 0 });
  tryRun(() => placeOrder(s, pea, { symbol: "AAPL", qty: 20, side: "buy" }, at("2025-10-06", "15:41")));
  transfer(s, pea, { direction: "INCOMING", amount: 20000 }, at("2025-12-01"));
  placeOrder(s, pea, { symbol: "TTE", qty: 100, side: "buy" }, at("2025-12-02", "09:12"), 60.1);
  placeOrder(s, pea, { symbol: "SIE", qty: 80, side: "buy" }, at("2025-12-02", "09:14"), 172);
  postDividend(s, pea, { symbol: "MC", per_share: 5.5, date: at("2025-12-04"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, pea, { symbol: "TTE", per_share: 0.85, date: at("2026-01-05"), wht_rate: 0, treaty_rate: 0 });
  transfer(s, pea, { direction: "INCOMING", amount: 25000 }, at("2026-02-02"));
  placeOrder(s, pea, { symbol: "CW8", qty: 45, side: "buy" }, at("2026-02-03", "11:20"), 498);
  postDividend(s, pea, { symbol: "SIE", per_share: 5.2, date: at("2026-02-16"), wht_rate: 0.26375, treaty_rate: 0.15 });
  tryRun(() => placeOrder(s, pea, { symbol: "IWDA", qty: 50, side: "buy" }, at("2026-03-10", "14:02")));
  postDividend(s, pea, { symbol: "TTE", per_share: 0.85, date: at("2026-04-01"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, pea, { symbol: "AIR", per_share: 3.0, date: at("2026-04-22"), wht_rate: 0.15, treaty_rate: 0.15 });
  postDividend(s, pea, { symbol: "MC", per_share: 7.5, date: at("2026-04-24"), wht_rate: 0, treaty_rate: 0 });
  transfer(s, pea, { direction: "INCOMING", amount: 15000 }, at("2026-05-04"));
  placeOrder(s, pea, { symbol: "ASML", qty: 25, side: "buy" }, at("2026-05-05", "10:01"), 610);
  postDividend(s, pea, { symbol: "ASML", per_share: 1.52, date: at("2026-05-06"), wht_rate: 0.15, treaty_rate: 0.15 });
  postDividend(s, pea, { symbol: "SAP", per_share: 2.5, date: at("2026-05-15"), wht_rate: 0.26375, treaty_rate: 0.15 });
  transfer(s, pea, { direction: "INCOMING", amount: 10000 }, at("2026-07-01"));
  placeOrder(s, pea, { symbol: "CW8", qty: 15, side: "buy" }, at("2026-07-02", "09:45"), 530);
  tryRun(() => transfer(s, pea, { direction: "INCOMING", amount: 8000 }, at("2026-09-14", "16:22")));

  // ——— Erik Lindqvist · ISK · Nordfond — quarterly capital-based tax ———
  s.clients.push({ id: "cli_erik", partner_id: P.nordfond, name: "Erik Lindqvist", tax_residency: "SE", birth_date: "1979-11-21" });
  const isk = DEMO.isk;
  createAccount(s, { client_id: "cli_erik", wrapper_type: "ISK", initial_deposit: 1050000, account_id: isk }, at("2025-06-10", "08:40"));
  placeOrder(s, isk, { symbol: "VOLV-B", qty: 1200, side: "buy" }, at("2025-06-11", "09:05"), 262);
  placeOrder(s, isk, { symbol: "ERIC-B", qty: 3000, side: "buy" }, at("2025-06-11", "09:06"), 74);
  placeOrder(s, isk, { symbol: "ATCO-A", qty: 1500, side: "buy" }, at("2025-06-11", "09:08"), 160);
  placeOrder(s, isk, { symbol: "INVE-B", qty: 800, side: "buy" }, at("2025-06-12", "10:30"), 270);
  transfer(s, isk, { direction: "INCOMING", amount: 200000 }, at("2025-11-03"));
  placeOrder(s, isk, { symbol: "IWDA", qty: 150, side: "buy" }, at("2025-11-04", "11:12"), 1057.47);
  placeOrder(s, isk, { symbol: "AAPL", qty: 40, side: "buy" }, at("2025-11-04", "15:44"), 2275.86);
  captureSnapshot(s, isk, "2026-01-01", 1251400);
  transfer(s, isk, { direction: "INCOMING", amount: 30000 }, at("2026-03-02"));
  captureSnapshot(s, isk, "2026-04-01", 1318900);
  postDividend(s, isk, { symbol: "ERIC-B", per_share: 2.85, date: at("2026-04-07"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, isk, { symbol: "VOLV-B", per_share: 18, date: at("2026-04-10"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, isk, { symbol: "INVE-B", per_share: 5.2, date: at("2026-05-12"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, isk, { symbol: "AAPL", per_share: 2.76, date: at("2026-05-15"), wht_rate: 0.15, treaty_rate: 0.15 });
  transfer(s, isk, { direction: "INCOMING", amount: 30000 }, at("2026-06-01"));
  captureSnapshot(s, isk, "2026-07-01", 1372300);

  // ——— Giulia Romano · PIR · Risparmio Digitale — concentration & allocation ———
  s.clients.push({ id: "cli_giulia", partner_id: P.risparmio, name: "Giulia Romano", tax_residency: "IT", birth_date: "1990-07-02" });
  const pir = DEMO.pir;
  createAccount(s, { client_id: "cli_giulia", wrapper_type: "PIR", initial_deposit: 38000, account_id: pir }, at("2025-05-12", "10:02"));
  const pirBuys: [string, number, number][] = [
    ["ISP", 750, 4.05], ["ENEL", 450, 6.6], ["UCG", 60, 42], ["MONC", 60, 56], ["PRY", 50, 55], ["BRE", 330, 9.9], ["TGYM", 280, 9.2],
    ["SES", 32, 88], ["ELN", 270, 10.2], ["SAP", 12, 235], ["ASML", 4, 640],
  ];
  for (const [sym, q, px] of pirBuys) placeOrder(s, pir, { symbol: sym, qty: q, side: "buy" }, at("2025-05-13", "09:30"), px);
  postDividend(s, pir, { symbol: "ENEL", per_share: 0.225, date: at("2025-07-22"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, pir, { symbol: "ISP", per_share: 0.17, date: at("2025-11-26"), wht_rate: 0, treaty_rate: 0 });
  transfer(s, pir, { direction: "INCOMING", amount: 12000 }, at("2026-01-12"));
  postDividend(s, pir, { symbol: "ENEL", per_share: 0.22, date: at("2026-01-21"), wht_rate: 0, treaty_rate: 0 });
  const topUps: [string, number, number][] = [["ISP", 350, 4.3], ["ENEL", 200, 6.9], ["BRE", 130, 9.1], ["TGYM", 120, 10.1], ["UCG", 40, 46], ["MONC", 20, 53], ["PRY", 20, 57], ["SES", 13, 90], ["ELN", 110, 10.6]];
  for (const [sym, q, px] of topUps) placeOrder(s, pir, { symbol: sym, qty: q, side: "buy" }, at("2026-01-13", "09:40"), px);
  tryRun(() => placeOrder(s, pir, { symbol: "ENEL", qty: 900, side: "buy" }, at("2026-02-09", "11:18")));
  complianceAlert(s, pir, at("2026-03-17", "07:00"), "PIR_ISSUER_CONCENTRATION", "CONCENTRATION_LIMIT_EXCEEDED", "Passive breach: UniCredit reached 10.6% after a price move", {
    issuer: "UniCredit S.p.A.", exposure_pct: 10.6, max_pct: 10, cause: "market_move", partner_notified: true, resolution: "Rebalanced on 2026-03-20", status: "RESOLVED",
  });
  placeOrder(s, pir, { symbol: "UCG", qty: 10, side: "sell" }, at("2026-03-20", "10:05"), 51.2);
  postDividend(s, pir, { symbol: "UCG", per_share: 1.46, date: at("2026-04-23"), wht_rate: 0, treaty_rate: 0 });
  postDividend(s, pir, { symbol: "SAP", per_share: 2.5, date: at("2026-05-15"), wht_rate: 0.26375, treaty_rate: 0.15 });
  postDividend(s, pir, { symbol: "ISP", per_share: 0.18, date: at("2026-05-20"), wht_rate: 0, treaty_rate: 0 });

  seedBackground(s);
  // Annual statements for the 2025 tax year, produced in January 2026.
  for (const a of s.accounts) if (a.opened_at < "2025-12-01") generateReport(s, a.id, 2025, at("2026-01-15", "06:00"));
  s.audit.sort((a, b) => a.ts.localeCompare(b.ts));
  return s;
}

const NAMES: Record<string, string[]> = {
  FR: ["Julien Moreau", "Sophie Bernard", "Thomas Petit", "Léa Dubois", "Nicolas Robert", "Chloé Richard", "Antoine Girard"],
  SE: ["Anna Svensson", "Johan Karlsson", "Maja Nilsson", "Oskar Eriksson", "Elsa Johansson", "Lars Persson"],
  IT: ["Marco Rossi", "Francesca Bianchi", "Luca Ferrari", "Chiara Esposito", "Alessandro Russo"],
};

function seedBackground(s: ShieldState) {
  const rnd = mulberry32(20417);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const dayBetween = (a: string, b: string) => {
    const t0 = new Date(a).getTime();
    const t1 = new Date(b).getTime();
    const d = new Date(t0 + rnd() * (t1 - t0));
    d.setUTCHours(8 + Math.floor(rnd() * 8), Math.floor(rnd() * 60), 0, 0);
    return d;
  };
  const plus = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000 + Math.floor(rnd() * 5) * 3_600_000);
  const insts = instrumentMap(s);

  const plans: { partner: string; wrapper: string; country: string; deposit: [number, number] }[] = [
    { partner: DEMO.partners.lumen, wrapper: "PEA", country: "FR", deposit: [8000, 60000] },
    { partner: DEMO.partners.nordfond, wrapper: "ISK", country: "SE", deposit: [60000, 700000] },
    { partner: DEMO.partners.risparmio, wrapper: "PIR", country: "IT", deposit: [8000, 38000] },
  ];

  for (const plan of plans) {
    const pack = getPack(s, plan.wrapper)!;
    const universe = pack.rules.find((r) => r.kind === "instrument_predicate")?.params.predicate as Predicate | undefined;
    const eligible = s.instruments.filter((i) => evalPredicate(universe, i as unknown as Record<string, unknown>));
    const ineligible = s.instruments.filter((i) => !eligible.includes(i));
    for (const name of NAMES[plan.country]) {
      const opened = dayBetween("2025-03-01", "2026-08-20");
      const deposit = Math.round((plan.deposit[0] + rnd() * (plan.deposit[1] - plan.deposit[0])) / 500) * 500;
      const clientId = `cli_${name.split(" ")[0].toLowerCase()}`;
      s.clients.push({ id: clientId, partner_id: plan.partner, name, tax_residency: plan.country, birth_date: `${1962 + Math.floor(rnd() * 36)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}` });
      const { account } = createAccount(s, { client_id: clientId, wrapper_type: plan.wrapper, initial_deposit: deposit }, opened);
      const acct = s.accounts.find((a) => a.id === account.id)!;
      // PIR positions stay small so the concentration rule is respected.
      const buys = plan.wrapper === "PIR" ? 7 : 2 + Math.floor(rnd() * 3);
      const share = plan.wrapper === "PIR" ? 0.085 : 0.28;
      const used = new Set<string>();
      let t = plus(opened, 1);
      for (let i = 0; i < buys; i++) {
        let inst = pick(eligible);
        if (plan.wrapper === "PIR") inst = pick(eligible.filter((x) => x.country === "IT" && !used.has(x.symbol))) ?? inst;
        used.add(inst.symbol);
        const px = localPrice(insts[inst.symbol], acct.currency) * (0.86 + rnd() * 0.12);
        const qty = Math.max(1, Math.floor((valuation(acct, insts).total * share) / px));
        tryRun(() => placeOrder(s, acct.id, { symbol: inst.symbol, qty, side: "buy" }, t, Math.round(px * 100) / 100));
        t = plus(t, Math.floor(rnd() * 20));
      }
      if (plan.wrapper === "PEA" && rnd() < 0.6) tryRun(() => placeOrder(s, acct.id, { symbol: pick(ineligible).symbol, qty: 5, side: "buy" }, plus(t, 3)));
      if (plan.wrapper === "PIR" && rnd() < 0.5) tryRun(() => transfer(s, acct.id, { direction: "INCOMING", amount: 45000 - deposit + 5000 }, plus(t, 10)));
      if (plan.wrapper === "PIR" && rnd() < 0.5) tryRun(() => placeOrder(s, acct.id, { symbol: "ENEL", qty: 1200, side: "buy" }, plus(t, 12)));
      if (plan.wrapper === "PEA" && rnd() < 0.3) tryRun(() => transfer(s, acct.id, { direction: "INCOMING", amount: 160000 }, plus(t, 8)));
      if (plan.wrapper === "ISK") {
        for (const d of ["2026-01-01", "2026-04-01", "2026-07-01"])
          if (new Date(d) > opened) captureSnapshot(s, acct.id, d, valuation(acct, insts).total * (0.93 + rnd() * 0.06));
      }
    }
  }

  // Residency checks rejecting non-resident applicants.
  const rejects: [string, string, string, string, string][] = [
    ["Pieter Janssens", "BE", "PEA", DEMO.partners.lumen, "2025-09-18"],
    ["Jonas Weber", "DE", "PIR", DEMO.partners.risparmio, "2026-02-24"],
    ["Emma Hansen", "NO", "ISK", DEMO.partners.nordfond, "2026-06-03"],
    ["Hugo Martin", "BE", "PEA", DEMO.partners.lumen, "2026-08-11"],
  ];
  for (const [name, res, w, partner, d] of rejects)
    tryRun(() => createAccount(s, { client_name: name, tax_residency: res, wrapper_type: w, partner_id: partner, initial_deposit: 10000 }, at(d, "14:20")));
}
