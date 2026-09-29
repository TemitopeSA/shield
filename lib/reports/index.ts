import type { Account, Client, Partner, RulePack } from "../types";
import { valuation, type InstrumentMap } from "../ledger";
import { capitalBaseTax, estimateTax } from "../tax";
import { fmtMoney, round2 } from "../money";
import { fmtDate } from "../dates";

export interface ReportLine {
  label: string;
  value: number | string;
  kind: "money" | "text" | "pct";
  note?: string;
}

export interface ReportData {
  title: string;
  reference: string;
  format: string;
  disclaimer: string;
  year: number;
  generated_at: string;
  holder: { name: string; client_id: string; tax_residency: string };
  provider: { name: string; country: string };
  account: { id: string; wrapper: string; wrapper_name: string; opened_at: string; status: string; currency: string };
  sections: { title: string; lines: ReportLine[] }[];
  tables: { title: string; columns: string[]; rows: (string | number)[][] }[];
  totals: Record<string, number>;
}

const inYear = (d: string, y: number) => new Date(d).getUTCFullYear() === y;

export function buildReport(args: { pack: RulePack; account: Account; client: Client; partner: Partner; instruments: InstrumentMap; year: number; now: Date }): ReportData {
  const { pack, account, client, partner, instruments, year, now } = args;
  const cur = account.currency;
  const txs = account.transactions.filter((t) => inYear(t.date, year));
  const divs = account.dividends.filter((d) => inYear(d.date, year));
  const deposits = txs.filter((t) => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
  const withdrawals = -txs.filter((t) => t.type === "WITHDRAWAL").reduce((s, t) => s + t.amount, 0);
  const withdrawalTax = txs.filter((t) => t.type === "WITHDRAWAL").reduce((s, t) => s + (t.tax ?? 0), 0);
  const realized = txs.filter((t) => t.type === "SELL").reduce((s, t) => s + (t.realized_gain ?? 0), 0);
  const gross = divs.reduce((s, d) => s + d.gross, 0);
  const wht = divs.reduce((s, d) => s + d.wht, 0);
  const reclaim = divs.reduce((s, d) => s + d.reclaimable, 0);
  const v = valuation(account, instruments, now);

  const sections: ReportData["sections"] = [
    {
      title: "Contributions",
      lines: [
        { label: `Deposits in ${year}`, value: round2(deposits), kind: "money" },
        { label: "Lifetime deposits", value: v.deposits_lifetime, kind: "money" },
        { label: `Withdrawals in ${year}`, value: round2(withdrawals), kind: "money" },
      ],
    },
    {
      title: "Income inside the wrapper",
      lines: [
        { label: "Gross dividends", value: round2(gross), kind: "money" },
        { label: "Foreign withholding tax", value: round2(wht), kind: "money" },
        { label: "Reclaimable under treaty", value: round2(reclaim), kind: "money" },
        { label: "Realised gains on disposals", value: round2(realized), kind: "money", note: "Sheltered while held in the wrapper" },
      ],
    },
  ];

  const totals: Record<string, number> = { deposits: round2(deposits), withdrawals: round2(withdrawals), dividends_gross: round2(gross), wht: round2(wht), realized_gains: round2(realized) };

  if (pack.tax.model === "capital_base_tax") {
    const r = capitalBaseTax(pack, account, instruments, now, year);
    sections.push({
      title: "Standardised income (schablonintäkt)",
      lines: [
        ...r.snapshots.map((s) => ({ label: `Value ${fmtDate(s.date)}${s.projected ? " (projected)" : ""}`, value: s.value, kind: "money" as const })),
        { label: `Deposits during ${year}`, value: r.deposits_year, kind: "money" },
        { label: "Capital base (sum ÷ 4)", value: r.capital_base, kind: "money" },
        { label: "Tax-free allowance", value: -r.tax_free_base, kind: "money" },
        { label: "Taxable capital base", value: r.taxable_base, kind: "money" },
        { label: `Standard income (${(r.standard_rate * 100).toFixed(2)}%)`, value: r.standard_income, kind: "money" },
        { label: `Estimated tax (${(r.tax_rate * 100).toFixed(0)}%)`, value: r.tax, kind: "money" },
      ],
    });
    totals.standard_income = r.standard_income;
    totals.estimated_tax = r.tax;
  } else {
    const est = estimateTax(pack, account, client, instruments, now);
    sections.push({
      title: "Tax position",
      lines: [
        { label: `Year-end value${inYear(now.toISOString(), year) ? " (to date)" : ""}`, value: v.total, kind: "money" },
        { label: "Net contributions", value: v.net_contributions, kind: "money" },
        { label: "Unrealised gain in plan", value: round2(v.total - v.net_contributions), kind: "money" },
        { label: `Tax withheld on withdrawals in ${year}`, value: round2(withdrawalTax), kind: "money" },
        { label: "Current bracket", value: est.note, kind: "text" },
        { label: est.label, value: est.amount, kind: "money", note: "Not payable unless a withdrawal is made" },
      ],
    });
    totals.withdrawal_tax = round2(withdrawalTax);
    totals.estimated_tax = est.amount;
  }

  return {
    title: pack.reporting.name,
    reference: pack.reporting.reference,
    format: pack.reporting.format,
    disclaimer: "Simplified format for demonstration. Not a tax document and not tax advice.",
    year,
    generated_at: now.toISOString(),
    holder: { name: client.name, client_id: client.id, tax_residency: client.tax_residency },
    provider: { name: partner.name, country: partner.country },
    account: { id: account.id, wrapper: pack.wrapper, wrapper_name: `${pack.name} — ${pack.full_name}`, opened_at: account.opened_at, status: account.status, currency: cur },
    sections,
    tables: [
      {
        title: "Dividends",
        columns: ["Date", "Symbol", "Gross", "WHT", "WHT rate", "Reclaimable"],
        rows: divs.map((d) => [fmtDate(d.date), d.symbol, fmtMoney(d.gross, cur), fmtMoney(d.wht, cur), `${(d.wht_rate * 100).toFixed(2)}%`, fmtMoney(d.reclaimable, cur)]),
      },
      {
        title: "Transactions",
        columns: ["Date", "Type", "Description", "Amount"],
        rows: txs.map((t) => [fmtDate(t.date), t.type, t.description, fmtMoney(t.amount, cur)]),
      },
    ],
    totals,
  };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function reportToCsv(r: ReportData): string {
  const rows: (string | number)[][] = [
    ["Report", r.title],
    ["Reference", r.reference],
    ["Year", r.year],
    ["Holder", r.holder.name],
    ["Account", r.account.id],
    ["Provider", r.provider.name],
    ["Currency", r.account.currency],
    ["Disclaimer", r.disclaimer],
    [],
    ["Section", "Line", "Value"],
  ];
  for (const s of r.sections) for (const l of s.lines) rows.push([s.title, l.label, l.value]);
  for (const t of r.tables) {
    rows.push([], [t.title], t.columns);
    rows.push(...t.rows);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
