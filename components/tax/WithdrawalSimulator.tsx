"use client";
import { useEffect, useState } from "react";
import { TriangleAlert, CircleCheck } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountDetail } from "@/lib/client/selectors";
import { simulateWithdrawal, type WithdrawalResult } from "@/lib/tax";
import { addYears, fmtDate, yearsBetween } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { CountUp, DemoNote, Input, Segmented, Select, cx } from "@/components/ui";

interface Props {
  accountId: string;
  onResult?: (r: WithdrawalResult) => void;
}

/** Withdrawal simulator for wrappers whose rule pack uses the gain_tax_schedule model. */
export function WithdrawalSimulator({ accountId, onResult }: Props) {
  const { state, call } = useShield();
  const detail = state ? accountDetail(state, accountId) : null;
  const [amount, setAmount] = useState(20000);
  const [ret, setRet] = useState(0.05);
  const openedAt = detail?.account.opened_at;
  const minYear = openedAt ? Math.max(1, Math.ceil(yearsBetween(openedAt, new Date()) + 0.1)) : 1;
  const threshold = detail?.pack.plan.holding_period_years ?? 5;
  const lastYear = Math.max(threshold + 1, 6);
  const [year, setYear] = useState<number | null>(null);
  const selYear = year ?? Math.max(minYear, 2);
  const [result, setResult] = useState<WithdrawalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const date = openedAt ? addYears(openedAt, selYear - 0.1) : new Date();

  useEffect(() => {
    if (!openedAt) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const c = await call("POST", "/api/v1/wrappers/simulate", { action: "withdrawal", account_id: accountId, amount, date: date.toISOString(), assumed_return: ret });
      if (!alive) return;
      setLoading(false);
      if (c.ok) {
        const r = (c.data as { tax: WithdrawalResult }).tax;
        setResult(r);
        onResult?.(r);
      }
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, amount, selYear, ret, openedAt]);

  // Tax by withdrawal year — the same tax model, run locally for the comparison strip.
  const byYear = !detail
    ? []
    : Array.from({ length: lastYear }, (_, i) => i + 1).map((y) => {
      const r = simulateWithdrawal({ pack: detail.pack, account: detail.account, client: detail.client, instruments: detail.instruments, amount, date: addYears(detail.account.opened_at, y - 0.1), assumed_return: ret });
      return { year: y, tax: r.tax, rate: r.rate, reachable: y >= minYear };
      });

  if (!detail) return null;
  const cur = detail.account.currency;
  const maxTax = Math.max(1, ...byYear.map((b) => b.tax));
  const r = result;
  const gainNet = r ? r.gain_portion - r.tax : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wd-amount" className="text-[12.5px] font-medium text-fg-2">Withdrawal amount</label>
          <Input id="wd-amount" prefix={cur === "EUR" ? "€" : cur} type="number" min={100} step={500} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wd-return" className="text-[12.5px] font-medium text-fg-2">Assumed growth until then</label>
          <Select id="wd-return" value={ret} onChange={(e) => setRet(Number(e.target.value))}>
            {[0, 0.03, 0.05, 0.08].map((x) => (
              <option key={x} value={x}>{(x * 100).toFixed(0)}% per year</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Scenario</span>
          <Segmented
            value={selYear <= threshold ? "before" : "after"}
            onChange={(v) => setYear(v === "before" ? Math.max(minYear, threshold) : threshold + 1)}
            options={[{ id: "before", label: `Before ${threshold} years` }, { id: "after", label: `After ${threshold} years` }]}
          />
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="flex items-center justify-between text-[12px] text-muted mb-2">
          <span>Withdrawal date</span>
          <span className="tnum font-medium text-fg">{fmtDate(date)} · plan age {(selYear - 0.1).toFixed(1)} yrs</span>
        </div>
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${lastYear + 1}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Withdrawal year">
          <div className="absolute top-[11px] h-0.5 bg-border" style={{ left: `${50 / (lastYear + 1)}%`, right: `${50 / (lastYear + 1)}%` }} />
          {Array.from({ length: lastYear + 1 }, (_, i) => i).map((y) => {
            const selectable = y >= minYear;
            const active = y === selYear;
            const after = y > threshold;
            return (
              <button
                key={y}
                role="radio"
                aria-checked={active}
                disabled={!selectable}
                onClick={() => setYear(y)}
                className="relative flex flex-col items-center gap-1.5 group disabled:cursor-default"
              >
                <span
                  className={cx(
                    "size-6 rounded-full border-2 flex items-center justify-center text-[10px] font-semibold transition-all z-10",
                    active ? "bg-ink border-ink text-white scale-110" : y === 0 ? "bg-brand border-brand-strong text-ink" : selectable ? cx("bg-surface group-hover:border-ink", after ? "border-success/60" : "border-border-strong") : "bg-sunken border-border text-faint",
                  )}
                >
                  {y === 0 ? "•" : y}
                </span>
                <span className={cx("text-[11px] whitespace-nowrap", active ? "text-fg font-medium" : "text-muted")}>{y === 0 ? "Opened" : `Year ${y}`}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[11px] mt-2">
          <span className="text-faint">{fmtDate(detail.account.opened_at)}</span>
          <span className="text-success font-medium">{threshold}-year anniversary · {fmtDate(addYears(detail.account.opened_at, threshold))}</span>
        </div>
      </div>

      {/* Result */}
      <div className={cx("rounded-xl border p-5 transition-colors", loading && "opacity-70", r?.closes_plan ? "border-[#f5e0b8] bg-[#fffcf5]" : "border-border bg-surface-2")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            ["Withdrawal", r?.amount ?? amount, ""],
            ["Estimated gain", r?.gain_portion ?? 0, `${((r?.gain_ratio ?? 0) * 100).toFixed(1)}% of value is gain`],
            ["Estimated tax", r?.tax ?? 0, r ? `${(r.rate * 100).toFixed(1)}% on the gain` : ""],
            ["Net proceeds", r?.net ?? 0, ""],
          ].map(([label, v, sub], i) => (
            <div key={label as string}>
              <div className="text-[12px] text-muted font-medium">{label}</div>
              <div className={cx("text-[22px] font-semibold tracking-[-0.02em] mt-1", i === 2 && "text-danger", i === 3 && "text-success")}>
                <CountUp value={v as number} format={(n) => fmtMoney(n, cur, { decimals: 0 })} />
              </div>
              {sub && <div className="text-[11.5px] text-muted mt-1">{sub}</div>}
            </div>
          ))}
        </div>
        {r && (
          <>
            <div className="mt-5 h-3 rounded-full overflow-hidden flex bg-sunken" aria-hidden>
              <div className="bg-[#c9c7c0] transition-all duration-500" style={{ width: `${(r.capital_portion / r.amount) * 100}%` }} />
              <div className="bg-success transition-all duration-500" style={{ width: `${(gainNet / r.amount) * 100}%` }} />
              <div className="bg-danger transition-all duration-500" style={{ width: `${(r.tax / r.amount) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#c9c7c0]" />Your contributions {fmtMoney(r.capital_portion, cur, { decimals: 0 })}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-success" />Gain kept {fmtMoney(gainNet, cur, { decimals: 0 })}</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-danger" />Tax {fmtMoney(r.tax, cur, { decimals: 0 })}</span>
            </div>
            <div className={cx("mt-4 flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px]", r.closes_plan ? "bg-warn-soft text-warn" : "bg-success-soft text-success")}>
              {r.closes_plan ? <TriangleAlert className="size-4 mt-0.5 shrink-0" /> : <CircleCheck className="size-4 mt-0.5 shrink-0" />}
              <div>
                <div className="font-semibold">{r.closes_plan ? `This withdrawal closes the ${detail.pack.name}` : `The ${detail.pack.name} stays open`}</div>
                <div className="text-[12.5px] opacity-90 mt-0.5">{r.bracket.note}</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tax by year */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12.5px] font-medium text-fg-2">Tax on this withdrawal, by year</span>
          <DemoNote>Simplified tax calculation for demonstration — not tax advice.</DemoNote>
        </div>
        <div className="flex items-end gap-2 h-24">
          {byYear.map((b) => (
            <button key={b.year} onClick={() => b.reachable && setYear(b.year)} disabled={!b.reachable} className="flex-1 flex flex-col items-center justify-end gap-1 h-full group disabled:opacity-40" aria-label={`Year ${b.year}: tax ${fmtMoney(b.tax, cur)}`}>
              <span className="text-[10.5px] tnum text-muted">{fmtMoney(b.tax, cur, { decimals: 0, compact: true })}</span>
              <span
                className={cx("w-full rounded-t-md transition-all duration-500", b.year === selYear ? "bg-ink" : b.year > threshold ? "bg-success/50 group-hover:bg-success/70" : "bg-danger/35 group-hover:bg-danger/55")}
                style={{ height: `${Math.max(4, (b.tax / maxTax) * 64)}px` }}
              />
              <span className="text-[10.5px] text-faint">Y{b.year}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
