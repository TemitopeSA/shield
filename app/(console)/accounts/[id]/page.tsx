"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Calculator, CandlestickChart, Check, Code2, FileText, X } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountDetail, bindingLimit } from "@/lib/client/selectors";
import { evalPredicate } from "@/lib/engine/predicate";
import { taxLots } from "@/lib/service";
import type { AuditEvent, Predicate } from "@/lib/types";
import { fmtMoney, fmtPct } from "@/lib/money";
import { fmtDate, fmtTime, yearsBetween } from "@/lib/dates";
import { Badge, Button, Card, CardHeader, CountUp, CountryChip, DemoNote, Drawer, EmptyState, JsonView, Progress, Skeleton, StatusBadge, Tabs, cx, LinkButton } from "@/components/ui";
import { TradeDialog, TransferDialog } from "@/components/accounts/ActionDialogs";
import { IskCalculation } from "@/components/tax/IskCalculation";

type Tab = "portfolio" | "lots" | "dividends" | "transactions" | "compliance";

export default function AccountPage() {
  const { id } = useParams<{ id: string }>();
  const { state } = useShield();
  const [tab, setTab] = useState<Tab>("portfolio");
  const [trade, setTrade] = useState(false);
  const [transfer, setTransfer] = useState<"INCOMING" | "OUTGOING" | null>(null);
  const [event, setEvent] = useState<AuditEvent | null>(null);
  const d = useMemo(() => (state ? accountDetail(state, id) : null), [state, id]);
  const lots = useMemo(() => (state && d ? taxLots(state, id) : []), [state, d, id]);

  if (!state) return <div className="p-8"><Skeleton className="h-10 w-80 mb-6" /><Skeleton className="h-48" /></div>;
  if (!d) return <EmptyState title="Account not found" body={`No account with id ${id} in this sandbox.`} action={<LinkButton href="/accounts">Back to accounts</LinkButton>} />;

  const { account, pack, client, partner, valuation: v, limits, positions, tax, compliance } = d;
  const cur = account.currency;
  const m = (n: number, decimals?: number) => fmtMoney(n, cur, { decimals });
  const holding = pack.plan.holding_period_years;
  const universe = pack.rules.filter((r) => r.kind === "instrument_predicate");
  const eligible = (sym: string) => universe.every((r) => evalPredicate(r.params.predicate as Predicate, d.instruments[sym] as unknown as Record<string, unknown>));
  const binding = bindingLimit(limits, v);
  const lim = binding?.limit ?? null;
  const used = binding?.used ?? v.deposits_lifetime;
  const events = [...d.audit].reverse();

  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <Link href={`/accounts?wrapper=${pack.wrapper}`} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-fg mb-4">
        <ArrowLeft className="size-3.5" /> {pack.name} accounts
      </Link>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{pack.name} · {partner.name}</h1>
            <StatusBadge status={account.status} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-muted">
            <span className="font-mono text-fg-2">{account.id}</span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-fg-2">{client.name} <CountryChip code={client.tax_residency} /></span>
            <span>·</span>
            <span>Opened {fmtDate(account.opened_at)}</span>
            <span>·</span>
            <span>Rule pack <span className="font-mono">{pack.wrapper.toLowerCase()}.json v{pack.version}</span></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<ArrowDownToLine className="size-3.5" />} onClick={() => setTransfer("INCOMING")} disabled={account.status !== "ACTIVE"}>Deposit</Button>
          <Button icon={<ArrowUpFromLine className="size-3.5" />} onClick={() => setTransfer("OUTGOING")} disabled={account.status !== "ACTIVE"}>Withdraw</Button>
          <LinkButton href={`/tax/reports?account=${account.id}`} icon={<FileText className="size-3.5" />}>Report</LinkButton>
          <LinkButton href={`/developer/playground?account=${account.id}`} variant="ghost" icon={<Code2 className="size-3.5" />}>API</LinkButton>
          <Button variant="primary" icon={<CandlestickChart className="size-3.5" />} onClick={() => setTrade(true)} disabled={account.status !== "ACTIVE"}>Trade</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Portfolio value</div>
          <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={v.total} format={(n) => m(n, 0)} /></div>
          <div className="text-[12px] mt-2 flex gap-3">
            <span className="text-muted">Cash {m(v.cash, 0)}</span>
            <span className={cx("font-medium", v.unrealized_gain >= 0 ? "text-success" : "text-danger")}>{fmtMoney(v.unrealized_gain, cur, { decimals: 0, sign: true })} unrealised</span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted font-medium">Contribution used</span>
            {binding && <span className="text-[11.5px] text-muted">{binding.period}</span>}
          </div>
          {lim === null ? (
            <>
              <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1">{m(v.deposits_lifetime, 0)}</div>
              <div className="text-[12px] text-muted mt-2">No contribution cap for {pack.name}</div>
            </>
          ) : (
            <>
              <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={used} format={(n) => m(n, 0)} /> <span className="text-[13px] text-muted font-normal">/ {m(lim, 0)}</span></div>
              <Progress value={used} max={lim} tone={used >= lim ? "warn" : "ink"} className="mt-3" />
              <div className="text-[12px] mt-2"><span className="text-muted">Remaining </span><span className="font-medium tnum">{m(Math.max(0, lim - used), 0)}</span>{binding?.other && <span className="text-muted"> · {m(Math.max(0, binding.other.limit - binding.other.used), 0)} left {binding.other.period}</span>}</div>
            </>
          )}
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Plan age</div>
          <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1">{v.plan_age_years.toFixed(1)} <span className="text-[13px] text-muted font-normal">years</span></div>
          {holding ? (
            <>
              <Progress value={Math.min(v.plan_age_years, holding)} max={holding} tone={v.plan_age_years >= holding ? "success" : "brand"} className="mt-3" />
              <div className="text-[12px] mt-2 text-muted">{v.plan_age_years >= holding ? "Holding period met" : `${holding}-year anniversary ${fmtDate(d.anniversary!)}`}</div>
            </>
          ) : (
            <div className="text-[12px] text-muted mt-2">No holding period</div>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-muted font-medium">Tax status</span>
            <Badge tone={compliance.results.every((r) => r.outcome !== "FAIL") ? "success" : "danger"} dot>{compliance.results.every((r) => r.outcome !== "FAIL") ? "Compliant" : "Breach"}</Badge>
          </div>
          <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={tax.amount} format={(n) => m(n, 0)} /></div>
          <div className="text-[12px] text-muted mt-2">{tax.label} · {tax.note}</div>
          <DemoNote className="mt-1" />
        </Card>
      </div>

      {compliance.results.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="text-[13px] font-semibold mb-3">Ongoing compliance · {pack.name} allocation rules</div>
          <div className="grid md:grid-cols-2 gap-4">
            {compliance.results.map((r) => (
              <div key={r.rule_id}>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span>{r.name} <span className="font-mono text-[10.5px] text-faint">{r.rule_id}</span></span>
                  <span className="tnum font-medium">{String(r.details.actual_pct ?? "—")}%</span>
                </div>
                <Progress value={(r.details.actual_pct as number) ?? 0} max={100} marker={r.details.min_pct as number} tone={r.outcome === "FAIL" ? "danger" : "success"} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {pack.tax.model === "capital_base_tax" && (
        <Card className="mt-4">
          <CardHeader title={`${pack.name} capital tax · ${(pack.tax.params as { year: number }).year}`} description="Quarterly snapshots → average capital base → tax" action={<Calculator className="size-4 text-faint" />} />
          <div className="px-5 pb-5"><IskCalculation accountId={account.id} /></div>
        </Card>
      )}

      <Card className="mt-4">
        <Tabs
          className="px-3"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "portfolio", label: "Portfolio", count: positions.length },
            { id: "lots", label: "Tax lots", count: lots.length },
            { id: "dividends", label: "Dividends", count: account.dividends.length },
            { id: "transactions", label: "Transactions", count: account.transactions.length },
            { id: "compliance", label: "Compliance activity", count: events.length },
          ]}
        />
        <div className="overflow-x-auto">
          {tab === "portfolio" &&
            (positions.length === 0 ? (
              <EmptyState icon={<CandlestickChart className="size-5" />} title="No positions yet" body="Place a first order — the engine will check it against the rule pack." action={<Button variant="primary" onClick={() => setTrade(true)}>Trade</Button>} />
            ) : (
              <table className="data-table">
                <thead><tr><th>Symbol</th><th>Name</th><th className="num">Quantity</th><th className="num">Price</th><th className="num">Value</th><th className="num">Cost basis</th><th className="num">Gain / loss</th><th className="num">Weight</th><th>Eligibility</th></tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="font-mono font-medium">{p.symbol}</td>
                      <td className="text-fg-2"><span className="flex items-center gap-2">{p.name} <CountryChip code={p.instrument.country} /></span></td>
                      <td className="num">{p.qty}</td>
                      <td className="num">{m(p.price, 2)}</td>
                      <td className="num font-medium">{m(p.value, 0)}</td>
                      <td className="num text-fg-2">{m(p.cost_basis, 0)}</td>
                      <td className={cx("num", p.gain >= 0 ? "text-success" : "text-danger")}>{fmtMoney(p.gain, cur, { decimals: 0, sign: true })} <span className="text-[11px] opacity-80">{fmtPct(p.gain_pct, 1, true)}</span></td>
                      <td className={cx("num", pack.rules.some((r) => r.kind === "issuer_concentration") && p.weight_pct > 9 && "text-warn font-medium")}>{p.weight_pct.toFixed(1)}%</td>
                      <td>{eligible(p.symbol) ? <span className="inline-flex items-center gap-1 text-success text-[12px] font-medium"><Check className="size-3.5" />Eligible</span> : <span className="inline-flex items-center gap-1 text-danger text-[12px] font-medium"><X className="size-3.5" />Not eligible</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          {tab === "lots" && (
            <table className="data-table">
              <thead><tr><th>Lot date</th><th>Symbol</th><th className="num">Quantity</th><th className="num">Cost / share</th><th className="num">Cost basis</th><th className="num">Current value</th><th className="num">Unrealised gain</th><th className="num">Held</th></tr></thead>
              <tbody>
                {lots.map((l) => (
                  <tr key={l.lot_id}>
                    <td>{fmtDate(l.acquired_at)}</td>
                    <td className="font-mono font-medium">{l.symbol}</td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{m(l.cost_per_share, 2)}</td>
                    <td className="num">{m(l.cost_basis, 0)}</td>
                    <td className="num font-medium">{m(l.current_value, 0)}</td>
                    <td className={cx("num", l.unrealized_gain >= 0 ? "text-success" : "text-danger")}>{fmtMoney(l.unrealized_gain, cur, { decimals: 0, sign: true })}</td>
                    <td className="num text-fg-2">{Math.floor(yearsBetween(l.acquired_at, new Date()) * 12)} mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "dividends" &&
            (account.dividends.length === 0 ? (
              <EmptyState title="No dividends yet" />
            ) : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Symbol</th><th className="num">Gross</th><th className="num">WHT</th><th className="num">WHT rate</th><th className="num">Treaty rate</th><th className="num">Reclaimable</th></tr></thead>
                <tbody>
                  {[...account.dividends].reverse().map((x) => (
                    <tr key={x.id}>
                      <td>{fmtDate(x.date)}</td>
                      <td className="font-mono font-medium">{x.symbol}</td>
                      <td className="num">{m(x.gross, 2)}</td>
                      <td className="num text-fg-2">{m(x.wht, 2)}</td>
                      <td className="num">{(x.wht_rate * 100).toFixed(3).replace(/\.?0+$/, "")}%</td>
                      <td className="num text-fg-2">{(x.treaty_rate * 100).toFixed(0)}%</td>
                      <td className={cx("num", x.reclaimable > 0 && "text-info font-medium")}>{m(x.reclaimable, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          {tab === "transactions" && (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="num">Amount</th><th className="num">Realised</th></tr></thead>
              <tbody>
                {[...account.transactions].reverse().map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td><Badge tone={t.type === "DEPOSIT" || t.type === "DIVIDEND" ? "success" : t.type === "WITHDRAWAL" ? "warn" : "neutral"} mono>{t.type}</Badge></td>
                    <td className="text-fg-2">{t.description}</td>
                    <td className={cx("num font-medium", t.amount >= 0 ? "text-success" : "text-fg")}>{fmtMoney(t.amount, cur, { decimals: 2, sign: true })}</td>
                    <td className="num text-fg-2">{t.realized_gain !== undefined ? m(t.realized_gain, 2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "compliance" && (
            <div className="px-5 py-4">
              <ol className="relative border-l border-border ml-2">
                {events.slice(0, 120).map((e) => (
                  <li key={e.id} className="pl-5 pb-3 relative">
                    <span className={cx("absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-surface", e.result === "PASS" ? "bg-success" : e.result === "FAIL" ? "bg-danger" : e.result === "WARN" ? "bg-[#d98a00]" : "bg-faint")} />
                    <button onClick={() => setEvent(e)} className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-lg px-2 py-1 -mx-2 hover:bg-sunken">
                      <span className="font-mono text-[11.5px] text-muted tnum w-[140px]">{fmtDate(e.ts)} {fmtTime(e.ts)}</span>
                      <span className="font-mono text-[12px] font-medium min-w-[230px]">{e.rule_id ?? e.action}</span>
                      <span className={cx("font-mono text-[11px] font-semibold w-10", e.result === "PASS" ? "text-success" : e.result === "FAIL" ? "text-danger" : e.result === "WARN" ? "text-warn" : "text-info")}>{e.result}</span>
                      <span className="text-[12px] text-muted truncate flex-1 min-w-[160px]">{e.summary}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Card>

      <TradeDialog accountId={account.id} open={trade} onClose={() => setTrade(false)} initialSymbol={pack.wrapper === "ISK" ? "VOLV-B" : pack.wrapper === "PIR" ? "ENEL" : "TTE"} />
      {transfer && <TransferDialog accountId={account.id} open onClose={() => setTransfer(null)} direction={transfer} />}
      <Drawer open={!!event} onClose={() => setEvent(null)} title={<span className="font-mono">{event?.rule_id ?? event?.action}</span>}>
        {event && <div className="p-5"><JsonView data={event} /></div>}
      </Drawer>
    </div>
  );
}
