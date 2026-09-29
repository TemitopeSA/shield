"use client";
import { useEffect, useState } from "react";
import { ChevronDown, Calculator } from "lucide-react";
import { useShield } from "@/lib/client/store";
import type { CapitalBaseResult, TaxEstimate } from "@/lib/tax";
import { fmtMoney, convert } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { CountUp, DemoNote, Skeleton, cx } from "@/components/ui";

/** Transparent ISK working: quarterly snapshots → capital base → allowance → rate → tax. */
export function IskCalculation({ accountId, defaultOpen = false }: { accountId: string; defaultOpen?: boolean }) {
  const { call, state } = useShield();
  const [data, setData] = useState<CapitalBaseResult | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const version = state?.audit.length;

  useEffect(() => {
    let alive = true;
    call("GET", `/api/v1/accounts/${accountId}/tax`).then((c) => {
      if (alive && c.ok) setData((c.data as TaxEstimate).detail as CapitalBaseResult);
    });
    return () => {
      alive = false;
    };
  }, [accountId, call, version]);

  if (!data) return <Skeleton className="h-64 w-full" />;
  const cur = data.currency;
  const m = (n: number) => fmtMoney(n, cur, { decimals: 0 });
  const max = Math.max(...data.snapshots.map((s) => s.value));
  const current = data.snapshots[data.snapshots.length - 1].value;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Metric label="Portfolio value" value={current} fmt={m} sub={`≈ ${fmtMoney(convert(current, cur, "EUR"), "EUR", { decimals: 0 })}`} />
        <Metric label={`Deposits ${data.year}`} value={data.deposits_year} fmt={m} />
        <Metric label="Taxable base" value={data.taxable_base} fmt={m} sub={`after ${m(data.tax_free_base)} allowance`} />
        <Metric label={`${data.year} estimated tax`} value={data.tax} fmt={m} sub={`${data.effective_rate_pct.toFixed(2)}% of portfolio value`} strong />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12.5px] font-medium text-fg-2">Quarterly snapshots</span>
          <span className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#0b7f86]" />Captured</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm border border-dashed border-[#0b7f86] bg-[#0b7f86]/15" />Projected</span>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3 items-end h-40">
          {data.snapshots.map((s, i) => (
            <div key={s.date} className="flex flex-col items-center justify-end gap-2 h-full">
              <span className="text-[11.5px] font-medium tnum">{fmtMoney(s.value, cur, { compact: true })}</span>
              <div
                className={cx("w-full max-w-[88px] rounded-t-lg transition-all duration-700", s.projected ? "border-2 border-dashed border-[#0b7f86]/70 bg-[#0b7f86]/10" : "bg-[#0b7f86]")}
                style={{ height: `${(s.value / max) * 100}px`, transitionDelay: `${i * 80}ms` }}
              />
              <span className="text-[11.5px] text-muted">{fmtDate(s.date, false)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 px-4 h-11 bg-surface-2 hover:bg-sunken text-[13px] font-medium">
          <span className="flex items-center gap-2"><Calculator className="size-4 text-muted" /> {open ? "Hide calculation" : "View calculation"}</span>
          <ChevronDown className={cx("size-4 text-muted transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="px-4 py-4 font-mono text-[12.5px] anim-rise">
            {data.snapshots.map((s) => (
              <Line key={s.date} label={`${s.label} value · ${fmtDate(s.date, false)}${s.projected ? " (proj.)" : ""}`} value={m(s.value)} />
            ))}
            <Line label={`Deposits during ${data.year}`} value={`+ ${m(data.deposits_year)}`} />
            <Divider />
            <Line label="Sum ÷ 4 = average capital base" value={m(data.capital_base)} bold />
            <Arrow />
            <Line label="Tax-free allowance" value={`− ${m(data.tax_free_base)}`} />
            <Line label="Taxable capital base" value={m(data.taxable_base)} bold />
            <Arrow />
            <Line label={`× ${(data.standard_rate * 100).toFixed(2)}% base rate (schablonränta)`} value={m(data.standard_income)} />
            <Arrow />
            <Line label={`× ${(data.tax_rate * 100).toFixed(0)}% capital income tax`} value={m(data.tax)} bold highlight />
            <div className="mt-3 font-sans">
              <DemoNote>Simplified for demo — rates per the {data.year} rule pack, not tax advice.</DemoNote>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, fmt, sub, strong }: { label: string; value: number; fmt: (n: number) => string; sub?: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-[12px] text-muted font-medium">{label}</div>
      <div className={cx("text-[21px] font-semibold tracking-[-0.02em] mt-1", strong && "text-[#0b7f86]")}>
        <CountUp value={value} format={fmt} />
      </div>
      {sub && <div className="text-[11.5px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

const Line = ({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) => (
  <div className={cx("flex items-center justify-between gap-4 py-1 px-2 -mx-2 rounded", highlight && "bg-brand-soft")}>
    <span className={cx("text-muted", bold && "text-fg font-semibold")}>{label}</span>
    <span className={cx("tnum", bold && "font-semibold")}>{value}</span>
  </div>
);
const Divider = () => <div className="border-t border-border my-1.5" />;
const Arrow = () => <div className="text-faint text-center leading-none py-0.5">↓</div>;
