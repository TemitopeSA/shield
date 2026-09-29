"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, CalendarClock, Code2, PlayCircle } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountRows, activePacks, evaluationStats, partnerFilter } from "@/lib/client/selectors";
import { Badge, Card, CardHeader, CountUp, PageHeader, Progress, Skeleton, WrapperBadge, cx, wrapperColor, LinkButton } from "@/components/ui";
import { EvaluationsChart, RejectionsChart } from "@/components/charts";
import { fmtMoney } from "@/lib/money";
import { addYears, fmtDate, fmtDateTime } from "@/lib/dates";

const CODE_LABEL: Record<string, string> = {
  INSTRUMENT_NOT_ELIGIBLE: "Instrument eligibility",
  CONTRIBUTION_LIMIT_EXCEEDED: "Contribution limit",
  CONCENTRATION_LIMIT_EXCEEDED: "Issuer concentration",
  RESIDENCY_NOT_ELIGIBLE: "Residency",
  INSUFFICIENT_CASH: "Available cash",
  DUPLICATE_WRAPPER_ACCOUNT: "One account per client",
  EARLY_WITHDRAWAL_CLOSES_PLAN: "Holding period",
};

export default function Dashboard() {
  const { state, partner } = useShield();
  const data = useMemo(() => {
    if (!state) return null;
    const rows = accountRows(state, partner);
    const audit = partnerFilter(state.audit, partner);
    const stats = evaluationStats(audit);
    const months = new Map<string, { passed: number; rejected: number }>();
    for (const e of audit) {
      if (!["ORDER_ACCEPTED", "ORDER_REJECTED", "TRANSFER_ACCEPTED", "TRANSFER_REJECTED", "ACCOUNT_CREATED", "ACCOUNT_REJECTED"].includes(e.action)) continue;
      const k = e.ts.slice(0, 7);
      const m = months.get(k) ?? { passed: 0, rejected: 0 };
      if (e.action.endsWith("REJECTED")) m.rejected++;
      else m.passed++;
      months.set(k, m);
    }
    const series = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ month: new Date(k + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), ...v }));
    const byCode = new Map<string, number>();
    for (const e of stats.rejectedEvents) byCode.set(e.code, (byCode.get(e.code) ?? 0) + 1);
    const rejections = [...byCode.entries()].map(([code, count]) => ({ code, count, label: CODE_LABEL[code] ?? code })).sort((a, b) => b.count - a.count);
    const reports = state.reports.filter((r) => partner === "all" || state.accounts.find((a) => a.id === r.account_id)?.partner_id === partner).length;
    const packs = activePacks(state);
    const health = packs.map((p) => {
      const rs = rows.filter((r) => r.wrapper === p.wrapper);
      const events = audit.filter((e) => e.wrapper === p.wrapper && e.action !== "RULE_EVALUATED").slice(-3).reverse();
      return { pack: p, count: rs.length, aum: rs.reduce((s, r) => s + r.valueEur, 0), compliant: rs.filter((r) => r.compliant).length, events };
    });
    const pea = rows.filter((r) => r.wrapper === "PEA").map((r) => ({ id: r.id, d: addYears(r.account.opened_at, 5) })).sort((a, b) => +a.d - +b.d);
    const upcoming = [
      { title: "ISK quarterly snapshot", when: new Date("2026-10-01"), body: `${rows.filter((r) => r.wrapper === "ISK").length} ISK accounts valued for the capital base`, tone: "#0b7f86", href: "/tax/simulator?tab=isk" },
      { title: "PIR compliance checks", when: new Date("2026-10-01"), body: `Monthly allocation & concentration run · ${rows.filter((r) => r.wrapper === "PIR").length} plans`, tone: "#1f8a4c", href: "/compliance/rules?wrapper=PIR" },
      ...(pea[0] ? [{ title: "PEA 5-year anniversaries", when: pea[0].d, body: `${pea.filter((x) => x.d.getUTCFullYear() === pea[0].d.getUTCFullYear()).length} plans reach 5 years in ${pea[0].d.getUTCFullYear()} · next ${pea[0].id}`, tone: "#2f5bea", href: `/accounts/${pea[0].id}` }] : []),
    ];
    return { rows, stats, series, rejections, reports, health, upcoming, aum: rows.reduce((s, r) => s + r.valueEur, 0), recent: audit.filter((e) => e.action !== "RULE_EVALUATED").slice(-7).reverse() };
  }, [state, partner]);

  if (!state || !data) return <div className="p-8"><Skeleton className="h-8 w-60 mb-6" /><div className="grid grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div></div>;
  const partnerName = state.partners.find((p) => p.id === partner)?.name;
  const byWrapper = activePacks(state).map((p) => ({ w: p.wrapper, n: data.rows.filter((r) => r.wrapper === p.wrapper).length }));

  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader
        title="Overview"
        description={partnerName ? `Wrapper activity for ${partnerName}.` : "Wrapper accounts, rule evaluations and upcoming tax events across all partners."}
        actions={
          <>
            <LinkButton href="/developer/playground" icon={<Code2 className="size-3.5" />}>API Playground</LinkButton>
            <LinkButton href="/demo" variant="primary" icon={<PlayCircle className="size-3.5 text-brand" />}>Guided demo</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Wrapper accounts</div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={data.rows.length} format={(n) => Math.round(n).toString()} /></div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {byWrapper.map((b) => (
              <Link key={b.w} href={`/accounts?wrapper=${b.w}`} className="inline-flex items-center gap-1.5 text-[12px]">
                <WrapperBadge wrapper={b.w} size="sm" /> <span className="tnum text-fg-2 font-medium">{b.n}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Rule evaluations</div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={data.stats.evaluations} format={(n) => Math.round(n).toLocaleString()} /></div>
          <div className="flex items-center gap-3 mt-3 text-[12px]">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> {data.stats.passed} passed</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-danger" /> {data.stats.rejected} rejected</span>
          </div>
          <div className="text-[11.5px] text-faint mt-1">{data.stats.ruleChecks.toLocaleString()} individual rule checks</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Assets in wrappers</div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={data.aum} format={(n) => fmtMoney(n, "EUR", { compact: true })} /></div>
          <div className="text-[12px] text-muted mt-3">EUR equivalent · demo prices</div>
        </Card>
        <Card className="p-5">
          <div className="text-[12.5px] text-muted font-medium">Reports generated · 2026</div>
          <div className="text-[28px] font-semibold tracking-[-0.03em] mt-1"><CountUp value={data.reports} format={(n) => Math.round(n).toString()} /></div>
          <Link href="/tax/reports" className="inline-flex items-center gap-1 text-[12px] font-medium mt-3 hover:underline">Generate IFU · KU · PIR statements <ArrowUpRight className="size-3" /></Link>
        </Card>
      </div>

      <div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 mt-4">
        <Card>
          <CardHeader title="Rule evaluations" description="Every account opening, transfer and order — decided by the engine" action={<Link href="/compliance/audit" className="text-[12.5px] font-medium text-fg-2 hover:text-fg">Audit log →</Link>} />
          <div className="px-3 pb-3"><EvaluationsChart data={data.series} /></div>
        </Card>
        <Card>
          <CardHeader title="Rejections by rule" description="Why the engine said no" />
          <div className="px-3 pb-3">
            {data.rejections.length ? <RejectionsChart data={data.rejections} /> : <div className="text-[13px] text-muted px-2 py-10 text-center">No rejections for this partner yet.</div>}
          </div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-[1.35fr_1fr] gap-4 mt-4">
        <div className="grid md:grid-cols-3 gap-4 content-start">
          {data.health.map((h) => (
            <Card key={h.pack.wrapper} className="p-5 flex flex-col">
              <div className="flex items-center justify-between">
                <WrapperBadge wrapper={h.pack.wrapper} />
                <span className="text-[11.5px] text-muted">{h.pack.country_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><div className="text-[11.5px] text-muted">Accounts</div><div className="text-[18px] font-semibold tnum">{h.count}</div></div>
                <div><div className="text-[11.5px] text-muted">Assets</div><div className="text-[18px] font-semibold tnum">{fmtMoney(h.aum, "EUR", { compact: true })}</div></div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[11.5px] mb-1.5"><span className="text-muted">Compliance</span><span className="tnum font-medium">{h.count ? Math.round((h.compliant / h.count) * 100) : 100}%</span></div>
                <Progress value={h.compliant} max={Math.max(1, h.count)} tone="success" />
              </div>
              <div className="mt-4 pt-3 border-t border-border space-y-1.5 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Recent activity</div>
                {h.events.length === 0 && <div className="text-[12px] text-muted">No activity yet</div>}
                {h.events.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-[12px]">
                    <span className={cx("size-1.5 rounded-full shrink-0", e.result === "FAIL" ? "bg-danger" : e.result === "PASS" ? "bg-success" : "bg-faint")} />
                    <span className="truncate text-fg-2">{e.summary}</span>
                  </div>
                ))}
              </div>
              <Link href={`/accounts?wrapper=${h.pack.wrapper}`} className="text-[12px] font-medium mt-3 hover:underline" style={{ color: wrapperColor(h.pack.wrapper) }}>View {h.pack.name} accounts →</Link>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 content-start">
          <Card>
            <CardHeader title="Upcoming events" description="Tax-calendar events the engine will run automatically" />
            <div className="px-3 pb-3">
              {data.upcoming.map((u) => (
                <Link key={u.title} href={u.href} className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-sunken">
                  <span className="size-9 rounded-lg flex flex-col items-center justify-center shrink-0 border" style={{ borderColor: `color-mix(in srgb, ${u.tone} 25%, white)`, background: `color-mix(in srgb, ${u.tone} 6%, white)` }}>
                    <span className="text-[9px] font-semibold uppercase" style={{ color: u.tone }}>{u.when.toLocaleDateString("en-GB", { month: "short" })}</span>
                    <span className="text-[13px] font-semibold leading-none">{u.when.getUTCDate()}</span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-1.5">{u.title} <CalendarClock className="size-3 text-faint" /></div>
                    <div className="text-[12px] text-muted">{u.body}</div>
                    <div className="text-[11px] text-faint">{fmtDate(u.when)}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Latest decisions" />
            <div className="px-5 pb-4 space-y-2.5">
              {data.recent.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-[12.5px]">
                  <Badge tone={e.result === "FAIL" ? "danger" : e.result === "PASS" ? "success" : e.result === "WARN" ? "warn" : "neutral"} mono className="shrink-0 w-[46px] justify-center">{e.result}</Badge>
                  <div className="min-w-0">
                    <div className="truncate">{e.summary}</div>
                    <div className="text-[11px] text-faint">{e.account_id ?? "—"} · {fmtDateTime(e.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
