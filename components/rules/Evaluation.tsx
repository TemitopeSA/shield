"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Check, CircleSlash, Database, Loader2, ShieldCheck, TriangleAlert, X, FileInput } from "lucide-react";
import type { Evaluation, RuleResult } from "@/lib/types";
import { cx } from "@/components/ui";
import { fmtMoney } from "@/lib/money";

/** Reveal rule results one by one so the reviewer sees the engine working. */
export function useReveal(evaluation: Evaluation | null | undefined, step = 280) {
  const [count, setCount] = useState(0);
  const [key, setKey] = useState<string | undefined>();
  if (evaluation?.id !== key) {
    setKey(evaluation?.id);
    setCount(0);
  }
  const total = evaluation?.results.filter((r) => r.outcome !== "SKIP").length ?? 0;
  useEffect(() => {
    if (!evaluation) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = requestAnimationFrame(() => setCount(total));
      return () => cancelAnimationFrame(id);
    }
    if (count >= total) return;
    const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 180 : step);
    return () => clearTimeout(t);
  }, [evaluation, count, total, step]);
  return { revealed: count, done: !!evaluation && count >= total };
}

const ICON: Record<string, ReactNode> = {
  PASS: <Check className="size-3 stroke-3" />,
  FAIL: <X className="size-3 stroke-3" />,
  WARN: <TriangleAlert className="size-3 stroke-[2.5]" />,
};

export function RuleRow({ r, state }: { r: RuleResult; state: "pending" | "checking" | "done" }) {
  const tone = r.outcome === "PASS" ? "bg-success text-white" : r.outcome === "FAIL" ? "bg-danger text-white" : "bg-[#d98a00] text-white";
  return (
    <div className={cx("flex items-center gap-3 py-2 px-3 rounded-lg transition-colors", state === "done" && r.outcome === "FAIL" && "bg-danger-soft/60 anim-shake", state === "pending" && "opacity-40")}>
      <span className={cx("size-5 rounded-full flex items-center justify-center shrink-0", state === "done" ? cx(tone, "anim-pop") : "border border-border-strong bg-surface")}>
        {state === "checking" ? <Loader2 className="size-3 anim-spin text-muted" /> : state === "done" ? ICON[r.outcome] : null}
      </span>
      <div className="flex-1 min-w-0">
        <div className={cx("text-[13px] truncate", r.outcome === "FAIL" && state === "done" ? "text-danger font-medium" : "text-fg")}>{r.name}</div>
        <div className="text-[11px] font-mono text-faint truncate">{r.rule_id}</div>
      </div>
      {state === "done" && (
        <div className="text-right shrink-0">
          <div className={cx("text-[10.5px] font-mono font-semibold", r.outcome === "PASS" ? "text-success" : r.outcome === "FAIL" ? "text-danger" : "text-warn")}>{r.outcome}</div>
          <div className="text-[10.5px] font-mono text-faint tnum">{(r.duration_ms * 1000).toFixed(0)}µs</div>
        </div>
      )}
    </div>
  );
}

export function RuleChecklist({ evaluation, revealed, pendingLabels }: { evaluation: Evaluation | null; revealed: number; pendingLabels?: string[] }) {
  if (!evaluation) {
    return (
      <div className="space-y-0.5">
        {(pendingLabels ?? []).map((l) => (
          <div key={l} className="flex items-center gap-3 py-2 px-3 opacity-60">
            <span className="size-5 rounded-full border border-border-strong flex items-center justify-center">
              <Loader2 className="size-3 anim-spin text-muted" />
            </span>
            <span className="text-[13px] text-muted">{l}</span>
          </div>
        ))}
      </div>
    );
  }
  const rows = evaluation.results.filter((r) => r.outcome !== "SKIP");
  return (
    <div className="space-y-0.5">
      {rows.map((r, i) => (
        <RuleRow key={r.rule_id} r={r} state={i < revealed ? "done" : i === revealed ? "checking" : "pending"} />
      ))}
    </div>
  );
}

function DetailGrid({ details, currency }: { details: Record<string, unknown>; currency: string }) {
  const money = (k: string) => fmtMoney(details[k] as number, currency, { decimals: 0 });
  let items: [string, string, string?][] = [];
  if ("requested" in details && "available" in details && "excess" in details)
    items = [["Requested", money("requested")], ["Available", money("available")], ["Excess", money("excess"), "danger"]];
  else if ("after_pct" in details)
    items = [["Current exposure", `${details.current_pct}%`], ["After order", `${details.after_pct}%`, "danger"], ["Maximum", `${details.max_pct}%`]];
  else if ("required" in details && "available" in details)
    items = [["Required", money("required")], ["Available", money("available")], ["Shortfall", fmtMoney((details.required as number) - (details.available as number), currency, { decimals: 0 }), "danger"]];
  else if ("plan_age_years" in details)
    items = [["Plan age", `${(details.plan_age_years as number).toFixed(1)} yrs`], ["Required", `${details.required_years} yrs`], ["On early exit", String(details.early_exit).replace("_", " ")]];
  else if ("country" in details)
    items = [["Instrument", String(details.symbol)], ["Issuer country", String(details.country)], ["Asset class", String(details.asset_class)]];
  else if ("tax_residency" in details) items = [["Tax residency", String(details.tax_residency)], ["Client age", String(details.age)]];
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
      {items.map(([k, v, tone]) => (
        <div key={k} className="bg-surface px-3 py-2.5">
          <div className="text-[11px] text-muted">{k}</div>
          <div className={cx("text-[15px] font-semibold tnum mt-0.5", tone === "danger" && "text-danger")}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** A rejected action, presented as a compliance decision — not an error page. */
export function DecisionCard({ title, subtitle, result, currency = "EUR", actions, className }: { title: string; subtitle: ReactNode; result: RuleResult; currency?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("relative rounded-xl border border-[#f1d3cf] bg-surface overflow-hidden anim-rise", className)}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-danger" />
      <div className="p-5 pl-6 space-y-4">
        <div className="flex items-start gap-3">
          <span className="size-8 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0">
            <CircleSlash className="size-4.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">Compliance decision</div>
            <div className="text-[16px] font-semibold tracking-[-0.01em] mt-0.5">{title}</div>
            <div className="text-[13px] text-fg-2 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <DetailGrid details={result.details} currency={(result.details.currency as string) ?? currency} />
        <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2 text-[12.5px]">
          <dt className="text-muted">Rule</dt>
          <dd className="font-mono text-fg">{result.rule_id}</dd>
          <dt className="text-muted">Code</dt>
          <dd>
            <span className="font-mono text-[11.5px] bg-danger-soft text-danger rounded px-1.5 py-0.5">{result.code}</span>
          </dd>
          <dt className="text-muted">Why</dt>
          <dd className="text-fg-2">{result.explain}</dd>
        </dl>
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

export function SuccessCard({ title, subtitle, children, className }: { title: string; subtitle?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("relative rounded-xl border border-[#cfe9dc] bg-surface overflow-hidden anim-rise", className)}>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-success" />
      <div className="p-5 pl-6">
        <div className="flex items-start gap-3">
          <span className="size-8 rounded-lg bg-success-soft text-success flex items-center justify-center shrink-0 anim-pop">
            <Check className="size-4.5 stroke-[2.5]" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold tracking-[-0.01em]">{title}</div>
            {subtitle && <div className="text-[13px] text-fg-2 mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

export type FlowPhase = "idle" | "request" | "engine" | "ledger" | "blocked";

/** Order → Rules engine → Ledger. Every transaction passes through the engine first. */
export function FlowDiagram({ phase, source = "Order", rules, className }: { phase: FlowPhase; source?: string; rules?: number; className?: string }) {
  const node = (active: boolean, done: boolean, danger: boolean) =>
    cx(
      "relative z-10 flex flex-col items-center gap-1.5 w-[92px] sm:w-[110px] py-2.5 rounded-xl border bg-surface transition-all duration-300",
      danger ? "border-danger/50 bg-danger-soft/50" : done ? "border-success/40" : active ? "border-ink shadow-[0_0_0_4px_rgba(252,213,53,0.35)]" : "border-border",
    );
  const reachedEngine = phase === "engine" || phase === "ledger" || phase === "blocked";
  const reachedLedger = phase === "ledger";
  return (
    <div className={cx("relative flex items-center justify-between", className)} aria-label="Transaction flow">
      <div className={node(phase === "request", reachedEngine, false)}>
        <FileInput className="size-4 text-fg-2" />
        <span className="text-[11.5px] font-medium">{source}</span>
      </div>
      <Wire active={phase === "request" || phase === "engine"} done={reachedEngine} />
      <div className={node(phase === "engine", reachedLedger, phase === "blocked")}>
        <ShieldCheck className={cx("size-4", phase === "blocked" ? "text-danger" : "text-fg-2")} />
        <span className="text-[11.5px] font-medium">Rules engine</span>
        {rules !== undefined && <span className="text-[10px] text-muted font-mono">{rules} rules</span>}
        {phase === "blocked" && <span className="absolute -top-2 -right-2 size-5 rounded-full bg-danger text-white flex items-center justify-center anim-pop"><X className="size-3 stroke-3" /></span>}
      </div>
      <Wire active={phase === "ledger"} done={reachedLedger} blocked={phase === "blocked"} />
      <div className={node(false, reachedLedger, false)}>
        <Database className={cx("size-4", reachedLedger ? "text-success" : "text-fg-2")} />
        <span className="text-[11.5px] font-medium">Ledger</span>
        {reachedLedger && <span className="absolute -top-2 -right-2 size-5 rounded-full bg-success text-white flex items-center justify-center anim-pop"><Check className="size-3 stroke-3" /></span>}
      </div>
    </div>
  );
}

function Wire({ active, done, blocked }: { active: boolean; done: boolean; blocked?: boolean }) {
  return (
    <div className="relative flex-1 h-px mx-1">
      <div className={cx("absolute inset-0 border-t border-dashed", blocked ? "border-danger/40" : done ? "border-success/60 border-solid" : "border-border-strong")} />
      {active && !done && <span className="absolute -top-[3px] size-[7px] rounded-full bg-brand-strong shadow-[0_0_0_3px_rgba(252,213,53,0.35)]" style={{ animation: "travel 0.7s ease-in-out infinite" }} />}
    </div>
  );
}
