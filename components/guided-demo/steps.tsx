"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Code2, FileText, Layers, RotateCcw, Sparkles } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountDetail } from "@/lib/client/selectors";
import { BUILTIN_PACKS, contributionLimits } from "@/lib/engine/packs";
import { localPrice, positions } from "@/lib/ledger";
import { fmtMoney } from "@/lib/money";
import type { RuleResult } from "@/lib/types";
import type { ReportData } from "@/lib/reports";
import { DEMO } from "@/lib/seed/demo-ids";
import {
  Badge,
  Button,
  CountUp,
  CountryChip,
  DemoNote,
  Field,
  Input,
  JsonView,
  Progress,
  Select,
  Tabs,
  WrapperBadge,
  cx,
  wrapperColor, LinkButton } from "@/components/ui";
import { DecisionCard, FlowDiagram, RuleChecklist, SuccessCard, type FlowPhase } from "@/components/rules/Evaluation";
import { WithdrawalSimulator } from "@/components/tax/WithdrawalSimulator";
import { IskCalculation } from "@/components/tax/IskCalculation";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { useEvaluatedAction } from "./useEvaluatedAction";

export type DoneKey = "account" | "eligibility" | "blocked" | "filled" | "limits" | "tax" | "report";

export interface StepProps {
  demoAccount: string | null;
  setDemoAccount: (id: string) => void;
  markDone: (k: DoneKey) => void;
  next: () => void;
}

export function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 anim-rise">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#8a6d00]">{eyebrow}</div>
      <h2 className="text-[26px] sm:text-[28px] font-semibold tracking-[-0.03em] leading-[1.15] mt-1.5">{title}</h2>
      {children && <p className="text-[14px] text-muted mt-2 max-w-[620px] leading-relaxed">{children}</p>}
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-(--shadow-card)", className)}>{children}</div>;
}

function NextCta({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end pt-2 anim-rise">
      <Button variant="primary" size="lg" onClick={onClick} icon={<ArrowRight className="size-4 order-last" />}>
        {label}
      </Button>
    </div>
  );
}

const failedOf = (d: unknown) => (d as { evaluation?: { failed?: RuleResult } })?.evaluation?.failed ?? null;

// ——— 1 · Account ————————————————————————————————————————————————

const PRESETS: Record<string, { client: string; residency: string; deposit: number; partner: string; plain: string }> = {
  PEA: { client: "Élise Martin", residency: "FR", deposit: 25000, partner: DEMO.partners.lumen, plain: "French investors buy European shares. Hold for 5 years and gains are only subject to social charges." },
  ISK: { client: "Sven Ek", residency: "SE", deposit: 250000, partner: DEMO.partners.nordfond, plain: "Swedes pay no tax on gains or dividends — just a small yearly tax on the account's average value." },
  PIR: { client: "Paolo Conti", residency: "IT", deposit: 25000, partner: DEMO.partners.risparmio, plain: "Italians invest mainly in Italian companies; after 5 years, gains are tax-free." },
};

export function StepAccount({ setDemoAccount, markDone, next, demoAccount }: StepProps) {
  const { state } = useShield();
  const [wrapper, setWrapper] = useState("PEA");
  const preset = PRESETS[wrapper];
  const [residency, setResidency] = useState(preset.residency);
  const [deposit, setDeposit] = useState(preset.deposit);
  const action = useEvaluatedAction();
  const created = action.ok && action.settled ? (action.data?.account as { id: string; contribution_headroom: number | null; plan_age_years: number; tax_residency: string; currency: string }) : null;
  const pack = BUILTIN_PACKS.find((b) => b.pack.wrapper === wrapper)!.pack;
  const failed = action.settled && !action.ok ? failedOf(action.data) : null;

  const choose = (w: string) => {
    setWrapper(w);
    setResidency(PRESETS[w].residency);
    setDeposit(PRESETS[w].deposit);
    action.reset();
  };

  const submit = async () => {
    const c = await action.run("POST", "/api/v1/accounts", {
      client_id: `client_demo_${wrapper.toLowerCase()}_${residency.toLowerCase()}_${(state?.seq ?? 0) + 1}`,
      client_name: preset.client,
      partner_id: preset.partner,
      wrapper_type: wrapper,
      tax_residency: residency,
      initial_deposit: deposit,
    });
    if (c.ok) {
      setDemoAccount((c.data as { account: { id: string } }).account.id);
      markDone("account");
      markDone("eligibility");
    }
  };

  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 1 · Account" title="What are you launching?">
        Pick a wrapper. Each one is a JSON rule pack plugged into the same engine — the partner integrates once and passes one field: <code className="font-mono text-[12.5px] bg-sunken border border-border px-1 rounded">wrapper_type</code>.
      </StepHeading>
      <div className="grid sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Wrapper">
        {(["PEA", "ISK", "PIR"] as const).map((w, i) => {
          const p = BUILTIN_PACKS.find((b) => b.pack.wrapper === w)!.pack;
          const active = wrapper === w;
          return (
            <button
              key={w}
              role="radio"
              aria-checked={active}
              disabled={!!created}
              onClick={() => choose(w)}
              className={cx(
                "relative text-left rounded-2xl border bg-surface p-4 transition-all anim-rise disabled:cursor-default",
                active ? "border-ink shadow-[0_0_0_3px_rgba(252,213,53,0.55)]" : "border-border hover:border-border-strong hover:-translate-y-0.5",
                created && !active && "opacity-40",
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-semibold tracking-[-0.03em]" style={{ color: wrapperColor(w) }}>{w}</span>
                <span className={cx("size-4.5 rounded-full border-2 flex items-center justify-center", active ? "border-ink bg-ink" : "border-border-strong")}>{active && <span className="size-1.5 rounded-full bg-brand" />}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[12.5px] text-muted">
                <CountryChip code={p.country} /> {p.country_name}
              </div>
              <ul className="mt-3 space-y-1">
                {p.highlights.map((h) => (
                  <li key={h} className="text-[12.5px] font-medium text-fg-2 flex gap-1.5"><span className="text-faint">—</span>{h}</li>
                ))}
              </ul>
              <p className="text-[12px] text-muted mt-3 leading-relaxed">{PRESETS[w].plain}</p>
              {w === "PEA" && <span className="absolute -top-2 right-3 text-[10px] font-semibold bg-brand text-ink rounded px-1.5 py-0.5">Recommended for demo</span>}
            </button>
          );
        })}
      </div>

      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[15px] font-semibold">Create wrapper account</div>
            <div className="text-[12.5px] text-muted">POST /v1/accounts · {state?.partners.find((p) => p.id === preset.partner)?.name}</div>
          </div>
          <WrapperBadge wrapper={wrapper} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Client">
            <Input value={preset.client} readOnly />
          </Field>
          <Field label="Client country">
            <Input value={pack.country_name} readOnly />
          </Field>
          <Field label="Tax residency" htmlFor="res" hint="Try a non-resident to see the engine reject it.">
            <Select id="res" value={residency} disabled={!!created} onChange={(e) => (setResidency(e.target.value), action.reset())}>
              {[["FR", "France"], ["SE", "Sweden"], ["IT", "Italy"], ["BE", "Belgium"], ["DE", "Germany"], ["US", "United States"]].map(([c, n]) => (
                <option key={c} value={c}>{n}</option>
              ))}
            </Select>
          </Field>
          <Field label="Account type">
            <Input value={`${pack.name} — ${pack.full_name}`} readOnly />
          </Field>
          <Field label="Initial deposit" htmlFor="dep">
            <Input id="dep" type="number" prefix={pack.currency === "EUR" ? "€" : pack.currency} value={deposit} disabled={!!created} onChange={(e) => (setDeposit(Number(e.target.value) || 0), action.reset())} />
          </Field>
          <div className="flex items-end">
            {!created && (
              <Button variant="primary" size="lg" className="w-full" loading={action.status === "running"} onClick={submit}>
                Create account
              </Button>
            )}
          </div>
        </div>

        {action.status !== "idle" && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-2">
            <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Rule engine · account_opening</div>
            <RuleChecklist evaluation={action.evaluation} revealed={action.revealed} pendingLabels={["Checking tax residency", "Checking wrapper eligibility", "Checking account limit"]} />
            {action.settled && action.ok && (
              <div className="flex items-center gap-3 py-2 px-3 anim-rise">
                <span className="size-5 rounded-full bg-success text-white flex items-center justify-center anim-pop"><Check className="size-3 stroke-3" /></span>
                <span className="text-[13px]">Creating wrapper account in ledger</span>
              </div>
            )}
          </div>
        )}
      </Panel>

      {failed && (
        <DecisionCard
          title="Account not opened"
          subtitle={failed.message}
          result={failed}
          actions={<Button onClick={() => (setResidency(preset.residency), action.reset())} icon={<RotateCcw className="size-3.5" />}>Use a {pack.country_name} tax resident</Button>}
        />
      )}

      {created && (
        <>
          <SuccessCard title={`${wrapper} account created`} subtitle={`${preset.client} can now invest through ${state?.partners.find((p) => p.id === preset.partner)?.name}.`}>
            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-[12.5px]">
              {[
                ["Account ID", <span key="id" className="font-mono">{created.id}</span>],
                ["Wrapper", <WrapperBadge key="w" wrapper={wrapper} size="sm" />],
                ["Tax residency", created.tax_residency],
                ["Contribution headroom", created.contribution_headroom === null ? "No cap" : fmtMoney(created.contribution_headroom, created.currency, { decimals: 0 })],
                ["Plan age", `${created.plan_age_years.toFixed(1)} yrs`],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium mt-1">{v}</dd>
                </div>
              ))}
            </dl>
          </SuccessCard>
          <NextCta label="Try placing a trade" onClick={next} />
        </>
      )}
      {!created && demoAccount && <NextCta label="Continue with existing account" onClick={next} />}
    </div>
  );
}

// ——— 2 · Trade ——————————————————————————————————————————————————

export function StepTrade({ demoAccount, markDone, next }: StepProps) {
  const { state } = useShield();
  const accountId = demoAccount ?? DEMO.pea;
  const detail = state ? accountDetail(state, accountId) : null;
  const [symbol, setSymbol] = useState("AAPL");
  const [qty, setQty] = useState(10);
  const action = useEvaluatedAction();
  const [history, setHistory] = useState<{ symbol: string; ok: boolean }[]>([]);
  if (!detail || !state) return null;
  const inst = detail.instruments[symbol];
  const price = localPrice(inst, detail.account.currency);
  const cur = detail.account.currency;
  const failed = action.settled && !action.ok ? failedOf(action.data) : null;
  const filled = action.settled && action.ok ? (action.data as { order: { qty: number; price: number; notional: number; symbol: string } }).order : null;
  const phase: FlowPhase = action.status === "idle" ? "idle" : action.status === "running" ? "request" : !action.settled ? "engine" : action.ok ? "ledger" : "blocked";
  const ruleCount = detail.pack.rules.filter((r) => r.stages.includes("pre_trade")).length + 1;

  const submit = async (sym = symbol) => {
    setSymbol(sym);
    const c = await action.run("POST", `/api/v1/trading/accounts/${accountId}/orders`, { symbol: sym, qty, side: "buy", type: "market" });
    setHistory((h) => [...h, { symbol: sym, ok: c.ok }]);
    if (c.ok) markDone("filled");
    else if ((c.data as { code?: string }).code === "INSTRUMENT_NOT_ELIGIBLE") markDone("blocked");
  };

  const blockedAapl = history.some((h) => !h.ok);
  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 2 · Trade" title={<>What would happen if this client bought {symbol === "AAPL" || !filled ? "AAPL" : inst.name}?</>}>
        Every order is checked by the wrapper&apos;s rule pack <em>before</em> it can reach the brokerage ledger. Watch the path below.
      </StepHeading>
      <Panel>
        <FlowDiagram phase={phase} rules={ruleCount} className="mb-6" />
        <div className="grid sm:grid-cols-[1.4fr_0.7fr_0.8fr_auto] gap-3 items-end">
          <Field label="Instrument" htmlFor="sym">
            <Select id="sym" value={symbol} onChange={(e) => (setSymbol(e.target.value), action.reset())}>
              {state.instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="qty">
            <Input id="qty" type="number" min={1} value={qty} onChange={(e) => (setQty(Math.max(1, Math.floor(Number(e.target.value) || 1))), action.reset())} />
          </Field>
          <Field label="Price">
            <Input value={fmtMoney(price, cur, { decimals: 2 })} readOnly className="tnum" />
          </Field>
          <Button variant="primary" size="lg" loading={action.status === "running"} onClick={() => submit()}>
            Submit order
          </Button>
        </div>
        <div className="flex items-center justify-between mt-3 text-[12px] text-muted">
          <span>
            Account <span className="font-mono text-fg-2">{accountId}</span> · <WrapperBadge wrapper={detail.pack.wrapper} size="sm" /> · cash {fmtMoney(detail.valuation.cash, cur)}
          </span>
          <span className="tnum">Order value <span className="text-fg font-medium">{fmtMoney(price * qty, cur)}</span></span>
        </div>
        {action.status !== "idle" && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-2">
            <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Rule engine · pre_trade · {detail.pack.name} rule pack</div>
            <RuleChecklist evaluation={action.evaluation} revealed={action.revealed} pendingLabels={["Checking account", "Checking client eligibility", "Checking instrument eligibility"]} />
          </div>
        )}
      </Panel>

      {failed && (
        <DecisionCard
          title="Order blocked"
          subtitle={failed.message}
          result={failed}
          currency={cur}
          actions={
            failed.code === "INSTRUMENT_NOT_ELIGIBLE" ? (
              <>
                <span className="text-[12.5px] text-muted self-center mr-1">Try an eligible asset:</span>
                <Button variant="primary" onClick={() => submit("TTE")}>TotalEnergies</Button>
                <Button onClick={() => submit("SAP")}>SAP</Button>
                <Button onClick={() => submit("CW8")}>Amundi MSCI World (PEA)</Button>
              </>
            ) : null
          }
        />
      )}

      {filled && (
        <>
          <SuccessCard title="Order filled" subtitle={`${filled.qty} × ${fmtMoney(filled.price, cur)} = ${fmtMoney(filled.notional, cur)} · Position created`}>
            {!blockedAapl && detail.pack.wrapper !== "PEA" && (
              <p className="text-[12.5px] text-fg-2 bg-sunken rounded-lg px-3 py-2">
                An {detail.pack.name} can hold {symbol}. In a PEA, the same order is blocked by <span className="font-mono">PEA_ELIGIBLE_UNIVERSE</span>. Same engine — a different rule pack.
              </p>
            )}
            <div className="grid grid-cols-3 gap-4 text-[12.5px]">
              <div><div className="text-muted">Position</div><div className="font-medium mt-1">{positions(detail.account, detail.instruments).find((p) => p.symbol === filled.symbol)?.qty ?? filled.qty} {filled.symbol}</div></div>
              <div><div className="text-muted">Cash remaining</div><div className="font-medium mt-1 tnum"><CountUp value={detail.valuation.cash} format={(n) => fmtMoney(n, cur)} /></div></div>
              <div><div className="text-muted">Audit trail</div><div className="font-medium mt-1">{action.evaluation?.results.filter((r) => r.outcome !== "SKIP").length} rules + ORDER_ACCEPTED</div></div>
            </div>
          </SuccessCard>
          <NextCta label="Test a contribution limit" onClick={next} />
        </>
      )}
    </div>
  );
}

// ——— 3 · Limits —————————————————————————————————————————————————

export function StepLimits({ markDone, next }: StepProps) {
  const { state } = useShield();
  const detail = state ? accountDetail(state, DEMO.pea) : null;
  const [amount, setAmount] = useState(10000);
  const action = useEvaluatedAction();
  if (!detail) return null;
  const lim = contributionLimits(detail.pack).lifetime!;
  const used = detail.valuation.deposits_lifetime;
  const headroom = Math.max(0, lim - used);
  const failed = action.settled && !action.ok ? failedOf(action.data) : null;
  const accepted = action.settled && action.ok;

  const submit = async (amt = amount) => {
    setAmount(amt);
    const c = await action.run("POST", `/api/v1/accounts/${DEMO.pea}/transfers`, { direction: "INCOMING", amount: amt });
    if (c.ok) markDone("limits");
  };

  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 3 · Limits" title="Let's test a contribution limit">
        Camille has been saving into her PEA for 18 months. A PEA accepts at most €150,000 of lifetime payments — the engine tracks every deposit against the limit in the rule pack.
      </StepHeading>
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">{detail.client.name}</div>
            <div className="text-[12.5px] text-muted flex items-center gap-2 mt-0.5">
              <span className="font-mono">{DEMO.pea}</span> · {detail.partner.name} · <WrapperBadge wrapper="PEA" size="sm" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-muted">Available headroom</div>
            <div className={cx("text-[26px] font-semibold tracking-[-0.03em]", headroom === 0 && "text-success")}>
              <CountUp value={headroom} format={(n) => fmtMoney(n, "EUR", { decimals: 0 })} />
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[12.5px] mb-2">
            <span className="text-muted">Current PEA contributions</span>
            <span className="tnum font-medium"><CountUp value={used} format={(n) => fmtMoney(n, "EUR", { decimals: 0 })} /> <span className="text-muted">/ {fmtMoney(lim, "EUR", { decimals: 0 })}</span></span>
          </div>
          <Progress value={used} max={lim} tone={headroom === 0 ? "success" : "ink"} className="h-3" />
          <div className="flex justify-between text-[11px] text-faint mt-1.5"><span>€0</span><span>Rule PEA_CONTRIBUTION_LIMIT · €150,000 lifetime</span></div>
        </div>
        {!accepted && (
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end mt-6">
            <Field label="Attempt deposit" htmlFor="dep-l">
              <Input id="dep-l" type="number" prefix="€" value={amount} onChange={(e) => (setAmount(Number(e.target.value) || 0), action.reset())} />
            </Field>
            <Button variant="primary" size="lg" loading={action.status === "running"} onClick={() => submit()}>
              Submit transfer
            </Button>
          </div>
        )}
        {action.status !== "idle" && (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 p-2">
            <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Rule engine · pre_transfer</div>
            <RuleChecklist evaluation={action.evaluation} revealed={action.revealed} pendingLabels={["Checking account", "Checking residency", "Checking contribution limit"]} />
          </div>
        )}
      </Panel>
      {failed && (
        <DecisionCard
          title="Transfer blocked"
          subtitle={failed.message}
          result={failed}
          actions={
            headroom > 0 && (
              <Button variant="primary" onClick={() => submit(headroom)}>
                Deposit {fmtMoney(headroom, "EUR", { decimals: 0 })} instead
              </Button>
            )
          }
        />
      )}
      {accepted && (
        <>
          <SuccessCard title="Transfer accepted" subtitle={`${fmtMoney(amount, "EUR", { decimals: 0 })} credited. The plan has reached its €150,000 ceiling — any further deposit will be rejected automatically.`} />
          <NextCta label="See what compliance looks like in Italy" onClick={next} />
        </>
      )}
    </div>
  );
}

// ——— 4 · Compliance (PIR) ——————————————————————————————————————————

export function StepCompliance({ markDone, next }: StepProps) {
  const { state } = useShield();
  const detail = state ? accountDetail(state, DEMO.pir) : null;
  const action = useEvaluatedAction();
  const [maxDone, setMaxDone] = useState(false);
  const plan = useMemo(() => {
    if (!detail) return null;
    const total = detail.valuation.total;
    const isp = detail.positions.find((p) => p.symbol === "ISP");
    const price = detail.instruments.ISP.price;
    const cur = isp?.value ?? 0;
    return {
      total,
      current: (cur / total) * 100,
      breachQty: Math.max(1, Math.round((0.112 * total - cur) / price)),
      maxQty: Math.max(0, Math.floor((0.1 * total - cur) / price)),
      price,
    };
  }, [detail]);
  if (!detail || !plan) return null;
  const failed = action.settled && !action.ok ? failedOf(action.data) : null;
  const accepted = action.settled && action.ok;
  const checks = detail.compliance.results;
  const issuers = detail.positions.slice(0, 8);

  const submit = async (qty: number, isMax = false) => {
    const c = await action.run("POST", `/api/v1/trading/accounts/${DEMO.pir}/orders`, { symbol: "ISP", qty, side: "buy", type: "market" });
    if (!c.ok) markDone("blocked");
    if (c.ok && isMax) setMaxDone(true);
  };

  const after = failed ? (failed.details.after_pct as number) : null;
  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 4 · Compliance" title="Same engine, different country">
        Switch partner: <b className="text-fg">Risparmio Digitale · Italy</b>. A PIR must stay mostly Italian and never put more than 10% in one issuer. The engine monitors the portfolio continuously and checks every order against it.
      </StepHeading>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="text-[15px] font-semibold">{detail.client.name}</div>
            <div className="text-[12.5px] text-muted flex items-center gap-2 mt-0.5">
              <span className="font-mono">{DEMO.pir}</span> · {detail.partner.name} · <WrapperBadge wrapper="PIR" size="sm" />
            </div>
          </div>
          <Badge tone={checks.every((c) => c.outcome !== "FAIL") ? "success" : "danger"} dot>{checks.every((c) => c.outcome !== "FAIL") ? "Compliant" : "Breach"}</Badge>
        </div>
        <div className="space-y-4">
          {checks.map((c) => (
            <RatioBar key={c.rule_id} label={c.name} ruleId={c.rule_id} value={c.details.actual_pct as number} min={c.details.min_pct as number} />
          ))}
          <RatioBar label="Largest single issuer · Intesa Sanpaolo" ruleId="PIR_ISSUER_CONCENTRATION" value={Math.round(plan.current * 10) / 10} max={10} ghost={after ?? undefined} />
        </div>
        <div className="mt-5 grid grid-cols-4 sm:grid-cols-8 gap-2">
          {issuers.map((p) => (
            <div key={p.symbol} className="text-center">
              <div className="h-14 flex items-end justify-center relative">
                <div className="absolute left-0 right-0 border-t border-dashed border-danger/50" style={{ bottom: `${(10 / 12) * 56}px` }} />
                <div className={cx("w-5 rounded-t", p.symbol === "ISP" ? "bg-ink" : "bg-[#1f8a4c]/60")} style={{ height: `${(p.weight_pct / 12) * 56}px` }} />
              </div>
              <div className="text-[10.5px] font-mono mt-1">{p.symbol}</div>
              <div className="text-[10px] text-muted tnum">{p.weight_pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
        {!accepted && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 border border-border px-4 py-3">
            <div className="text-[13px]">
              Buy <b>{plan.breachQty} ISP</b> · Intesa Sanpaolo at {fmtMoney(plan.price, "EUR")} <span className="text-muted">= {fmtMoney(plan.breachQty * plan.price, "EUR")}</span>
            </div>
            <Button variant="primary" loading={action.status === "running"} onClick={() => submit(plan.breachQty)}>Submit order</Button>
          </div>
        )}
        {action.status !== "idle" && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-2">
            <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Rule engine · pre_trade · PIR rule pack</div>
            <RuleChecklist evaluation={action.evaluation} revealed={action.revealed} />
          </div>
        )}
      </Panel>
      {failed && (
        <DecisionCard
          title="Trade blocked"
          subtitle="Issuer concentration limit exceeded."
          result={failed}
          actions={plan.maxQty > 0 && <Button onClick={() => submit(plan.maxQty, true)}>Buy the maximum compliant quantity ({plan.maxQty})</Button>}
        />
      )}
      {(accepted || failed) && (
        <>
          {accepted && maxDone && <SuccessCard title="Order filled within the limit" subtitle={`Intesa Sanpaolo exposure is now ${action.data && (action.data as { position?: { weight_pct: number } }).position?.weight_pct.toFixed(1)}% — just under 10%.`} />}
          <NextCta label="Calculate tax" onClick={next} />
        </>
      )}
    </div>
  );
}

function RatioBar({ label, ruleId, value, min, max, ghost }: { label: string; ruleId: string; value: number; min?: number; max?: number; ghost?: number }) {
  const scale = max ? 12 : 100;
  const ok = min !== undefined ? value >= min : value <= (max ?? 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[12.5px] mb-1.5">
        <span className="font-medium">{label} <span className="font-mono text-[10.5px] text-faint ml-1">{ruleId}</span></span>
        <span className="tnum">
          <b>{value.toFixed(1)}%</b>
          {ghost !== undefined && <b className="text-danger"> → {ghost.toFixed(1)}%</b>}
          <span className="text-muted"> · {min !== undefined ? `min ${min}%` : `max ${max}%`}</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-sunken overflow-visible">
        {ghost !== undefined && <div className="absolute inset-y-0 left-0 rounded-full bg-danger/25 border border-danger/50 anim-rise" style={{ width: `${Math.min(100, (ghost / scale) * 100)}%` }} />}
        <div className={cx("absolute inset-y-0 left-0 rounded-full transition-all duration-700", ok ? "bg-[#1f8a4c]" : "bg-danger")} style={{ width: `${Math.min(100, (value / scale) * 100)}%` }} />
        <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink rounded" style={{ left: `${((min ?? max ?? 0) / scale) * 100}%` }} title="Limit" />
      </div>
    </div>
  );
}

// ——— 5 · Tax ————————————————————————————————————————————————————

export function StepTax({ markDone, next }: StepProps) {
  const [tab, setTab] = useState<"pea" | "isk">("pea");
  const [seenIsk, setSeenIsk] = useState(false);
  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 5 · Tax" title="What happens when the investor withdraws?">
        Tax treatment lives in the rule pack too. A PEA taxes gains differently before and after 5 years; an ISK ignores gains entirely and taxes the account&apos;s average value. Same engine, two very different tax models.
      </StepHeading>
      <Tabs
        tabs={[{ id: "pea", label: "PEA · withdrawal simulator" }, { id: "isk", label: "ISK · 2026 capital tax" }]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          if (t === "isk") setSeenIsk(true);
          markDone("tax");
        }}
      />
      <Panel>
        {tab === "pea" ? (
          <>
            <div className="text-[13px] text-muted mb-4">Camille Laurent · <span className="font-mono">{DEMO.pea}</span> · move between <b className="text-fg">before</b> and <b className="text-fg">after</b> 5 years.</div>
            <WithdrawalSimulator accountId={DEMO.pea} onResult={() => markDone("tax")} />
          </>
        ) : (
          <>
            <div className="text-[13px] text-muted mb-4">Partner: <b className="text-fg">Nordfond · Sweden</b> · Erik Lindqvist · <span className="font-mono">{DEMO.isk}</span></div>
            <IskCalculation accountId={DEMO.isk} defaultOpen />
          </>
        )}
      </Panel>
      <div className="flex justify-between items-center">
        {tab === "pea" && !seenIsk ? (
          <Button onClick={() => (setTab("isk"), setSeenIsk(true))} icon={<ArrowRight className="size-3.5 order-last" />}>Switch to ISK · Sweden</Button>
        ) : <span />}
        <Button variant="primary" size="lg" onClick={next} icon={<ArrowRight className="size-4 order-last" />}>Generate a report</Button>
      </div>
    </div>
  );
}

// ——— 6 · Reports ————————————————————————————————————————————————

export function StepReports({ markDone, next }: StepProps) {
  const { state, call } = useShield();
  const [accountId, setAccountId] = useState(DEMO.pea);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    const c = await call("GET", `/api/v1/accounts/${accountId}/reports/2026`);
    setLoading(false);
    if (c.ok) {
      setReport(c.data as ReportData);
      markDone("report");
    }
  };
  return (
    <div className="space-y-5">
      <StepHeading eyebrow="Step 6 · Reports" title="Year-end reporting, generated from the ledger">
        Each rule pack declares its local reporting format — an IFU-style summary in France, a KU-style statement in Sweden, an annual PIR statement in Italy.
      </StepHeading>
      <Panel>
        <div className="grid sm:grid-cols-[1fr_140px_auto] gap-3 items-end">
          <Field label="Account" htmlFor="rep-acc">
            <Select id="rep-acc" value={accountId} onChange={(e) => (setAccountId(e.target.value), setReport(null))}>
              {[DEMO.pea, DEMO.isk, DEMO.pir].map((id) => {
                const a = state?.accounts.find((x) => x.id === id);
                const cl = state?.clients.find((c) => c.id === a?.client_id);
                return <option key={id} value={id}>{id} · {cl?.name}</option>;
              })}
            </Select>
          </Field>
          <Field label="Year">
            <Input value="2026" readOnly />
          </Field>
          <Button variant="primary" size="lg" loading={loading} onClick={generate} icon={<FileText className="size-4" />}>
            Generate report
          </Button>
        </div>
      </Panel>
      {report && (
        <>
          <ReportPreview report={report} />
          <NextCta label="Finish" onClick={next} />
        </>
      )}
    </div>
  );
}

// ——— Finale ———————————————————————————————————————————————————————

const DONE_LABELS: [DoneKey, string][] = [
  ["account", "Opened a wrapper account"],
  ["eligibility", "Validated eligibility"],
  ["blocked", "Blocked an invalid trade"],
  ["filled", "Executed a valid trade"],
  ["limits", "Enforced contribution limits"],
  ["tax", "Calculated tax"],
  ["report", "Generated a report"],
];

export function StepFinale({ done }: { done: Set<DoneKey> }) {
  const [file, setFile] = useState("pea.json");
  const pack = BUILTIN_PACKS.find((b) => b.file === file)!.pack;
  return (
    <div className="space-y-6">
      <div className="anim-rise">
        <div className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#8a6d00]">
          <Sparkles className="size-3.5" /> Demo complete
        </div>
        <h2 className="text-[34px] font-semibold tracking-[-0.035em] leading-tight mt-2">That&apos;s the engine.</h2>
      </div>
      <div className="grid md:grid-cols-[280px_1fr] gap-5">
        <div className="space-y-1">
          <div className="text-[13px] text-muted mb-2">You just:</div>
          {DONE_LABELS.map(([k, label], i) => (
            <div key={k} className="flex items-center gap-2.5 py-1.5 anim-rise" style={{ animationDelay: `${i * 90}ms` }}>
              <span className={cx("size-5 rounded-full flex items-center justify-center", done.has(k) ? "bg-success text-white" : "bg-sunken border border-border text-faint")}>
                <Check className="size-3 stroke-3" />
              </span>
              <span className={cx("text-[13.5px]", done.has(k) ? "text-fg" : "text-muted")}>{label}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-surface overflow-hidden anim-rise" style={{ animationDelay: "300ms" }}>
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <div className="text-[18px] font-semibold tracking-[-0.02em]">New wrapper = new configuration.</div>
            <p className="text-[13px] text-muted mt-1">
              Everything you just saw — eligibility, limits, concentration, tax, reporting — came from these files. The engine has no <code className="font-mono text-[12px]">if (wrapper === &quot;PEA&quot;)</code>.
            </p>
          </div>
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-border overflow-x-auto">
            {["pea.json", "isk.json", "pir.json"].map((f) => (
              <button key={f} onClick={() => setFile(f)} className={cx("h-8 px-3 text-[12px] font-mono rounded-t-md border-b-2 -mb-px", f === file ? "border-ink text-fg" : "border-transparent text-muted hover:text-fg")}>
                rules/{f}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted whitespace-nowrap px-2">{pack.rules.length} rules · tax model <span className="font-mono">{pack.tax.model}</span></span>
          </div>
          <div className="bg-[#fcfcfb] p-4">
            <JsonView data={pack} maxHeight={340} />
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-ink text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 anim-rise" style={{ animationDelay: "450ms" }}>
        <div>
          <div className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.03em]">New wrapper. New rule pack. Same infrastructure.</div>
          <p className="text-[13.5px] text-[#bdbcb6] mt-1.5">Try it: activate Poland&apos;s IKE from <span className="font-mono text-brand">ike.json</span> — no engine changes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/developer/rule-packs?add=ike" variant="brand" size="lg" icon={<Layers className="size-4" />}>Add a wrapper</LinkButton>
          <LinkButton href="/developer/playground" size="lg" className="bg-transparent! text-white! border-white/25! hover:bg-white/10!" icon={<Code2 className="size-4" />}>API Playground</LinkButton>
          <LinkButton href="/dashboard" size="lg" className="bg-transparent! text-white! border-white/25! hover:bg-white/10!">Open console</LinkButton>
        </div>
      </div>
      <DemoNote>Tax rules are simplified for demonstration and are not tax advice.</DemoNote>
    </div>
  );
}

