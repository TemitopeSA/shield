"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, PlayCircle, RotateCcw, Terminal } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { Badge, Button, JsonView, cx } from "@/components/ui";
import { Logo } from "@/components/shell/Logo";
import { fmtTime } from "@/lib/dates";
import { StepAccount, StepCompliance, StepFinale, StepLimits, StepReports, StepTax, StepTrade, type DoneKey, type StepProps } from "./steps";

const STEPS = [
  { id: "account", label: "Account", C: StepAccount },
  { id: "trade", label: "Trade", C: StepTrade },
  { id: "limits", label: "Limits", C: StepLimits },
  { id: "compliance", label: "Compliance", C: StepCompliance },
  { id: "tax", label: "Tax", C: StepTax },
  { id: "reports", label: "Reports", C: StepReports },
] as const;

export function DemoWorkspace() {
  const { reset } = useShield();
  const router = useRouter();
  const params = useSearchParams();
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(0);
  const [demoAccount, setDemoAccount] = useState<string | null>(null);
  const [done, setDone] = useState<Set<DoneKey>>(new Set());
  const [auditStart, setAuditStart] = useState(0);
  const autoStarted = useRef(false);
  const top = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    setStarting(true);
    const fresh = await reset();
    setStarting(false);
    setStarted(true);
    setStep(0);
    setDemoAccount(null);
    setDone(new Set());
    setAuditStart(fresh.audit.length);
  }, [reset]);

  useEffect(() => {
    if (params.get("start") && !autoStarted.current) {
      autoStarted.current = true;
      start();
      router.replace("/demo");
    }
  }, [params, start, router]);

  const markDone = useCallback((k: DoneKey) => setDone((d) => (d.has(k) ? d : new Set(d).add(k))), []);
  const go = useCallback((i: number) => {
    setStep(i);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const next = useCallback(() => go(step + 1), [go, step]);

  if (!started) return <DemoIntro onStart={start} starting={starting} />;

  const finished = step >= STEPS.length;
  const Current = !finished ? STEPS[step].C : null;
  const props: StepProps = { demoAccount, setDemoAccount, markDone, next };

  return (
    <div ref={top} className="scroll-mt-20">
      <div className="sticky top-14 z-20 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-[13px] font-semibold whitespace-nowrap">
            <PlayCircle className="size-4 text-[#a88600]" /> Guided demo
          </div>
          <ol className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin" aria-label="Demo progress">
            {STEPS.map((s, i) => {
              const state = i < step ? "done" : i === step ? "current" : "todo";
              return (
                <li key={s.id} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => go(i)}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cx("flex items-center gap-2 h-8 pl-1.5 pr-3 rounded-full text-[12.5px] font-medium transition-colors", state === "current" ? "bg-ink text-white" : state === "done" ? "text-fg hover:bg-sunken" : "text-muted hover:bg-sunken")}
                  >
                    <span className={cx("size-5 rounded-full flex items-center justify-center text-[10.5px] font-semibold", state === "current" ? "bg-brand text-ink" : state === "done" ? "bg-success text-white" : "bg-sunken border border-border")}>
                      {state === "done" ? <Check className="size-3 stroke-3" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-faint" />}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-1.5 shrink-0">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={() => go(step - 1)} icon={<ArrowLeft className="size-3.5" />}>
                <span className="hidden sm:inline">Back</span>
              </Button>
            )}
            {!finished && (
              <>
                <Button size="sm" variant="ghost" onClick={next}>Skip</Button>
                <Button size="sm" variant="primary" onClick={next}>Continue</Button>
              </>
            )}
            {finished && <Button size="sm" onClick={start} icon={<RotateCcw className="size-3.5" />}>Restart</Button>}
          </div>
        </div>
        <div className="h-0.5 bg-border">
          <div className="h-full bg-brand-strong transition-[width] duration-500" style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className={cx("max-w-[1320px] mx-auto px-4 sm:px-6 py-8 grid gap-8", !finished && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
        <div key={step} className={cx("min-w-0", !finished && "max-w-[820px]")}>
          {Current ? <Current {...props} /> : <StepFinale done={done} />}
        </div>
        {!finished && <UnderTheHood auditStart={auditStart} />}
      </div>
    </div>
  );
}

function DemoIntro({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-14">
      <div className="bg-surface border border-border rounded-2xl p-8 sm:p-10 shadow-(--shadow-card) anim-rise">
        <Logo size={40} />
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] mt-5">Guided demo</h1>
        <p className="text-[14.5px] text-muted mt-2 max-w-xl leading-relaxed">
          A 3-minute walkthrough of the EU Wrapper Engine. Every button calls the real API — the rules engine evaluates each action and writes it to the audit log.
        </p>
        <ol className="grid sm:grid-cols-3 gap-3 mt-7">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2.5 text-[13px]">
              <span className="size-6 rounded-full bg-sunken border border-border flex items-center justify-center text-[11px] font-semibold">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3 mt-8">
          <Button variant="primary" size="lg" loading={starting} onClick={onStart} icon={<PlayCircle className="size-4 text-brand" />}>
            Start guided demo
          </Button>
          <span className="text-[12.5px] text-muted">Resets this sandbox to a deterministic demo state.</span>
        </div>
      </div>
    </div>
  );
}

function UnderTheHood({ auditStart }: { auditStart: number }) {
  const { calls, state } = useShield();
  const [view, setView] = useState<"response" | "request">("response");
  const last = calls[0];
  const events = useMemo(() => (state && auditStart >= 0 ? state.audit.slice(auditStart).reverse().slice(0, 14) : []), [state, auditStart]);
  return (
    <aside className="xl:sticky xl:top-[140px] self-start space-y-4 min-w-0" aria-label="Under the hood">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-faint">
        <Terminal className="size-3.5" /> Under the hood
      </div>
      <div className="rounded-2xl bg-[#141413] text-[#e8e7e2] overflow-hidden border border-black shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-2 px-4 h-10 border-b border-white/10">
          {last ? (
            <div className="flex items-center gap-2 min-w-0 font-mono text-[11.5px]">
              <span className={cx("font-semibold", last.method === "GET" ? "text-[#7fb2ff]" : "text-brand")}>{last.method}</span>
              <span className="truncate text-[#c9c8c2]">{last.path.replace("/api", "")}</span>
            </div>
          ) : (
            <span className="text-[11.5px] text-[#8d8c86] font-mono">Waiting for the first API call…</span>
          )}
          {last && (
            <span className={cx("font-mono text-[11px] shrink-0", last.ok ? "text-[#6fd3a5]" : "text-[#ff8a7f]")}>
              {last.status} · {last.ms}ms
            </span>
          )}
        </div>
        {last && (
          <>
            <div className="px-3 pt-2">
              <div className="inline-flex p-0.5 rounded-lg bg-white/5 border border-white/10" role="tablist">
                {(["response", "request"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx("h-6 px-2.5 rounded-md text-[11.5px] font-medium capitalize", view === v ? "bg-white/15 text-white" : "text-[#8d8c86] hover:text-white")}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 [&_.json-key]:text-[#d7a6ff] [&_.json-str]:text-[#8fe0b8] [&_.json-num]:text-[#ffc07a] [&_.json-bool]:text-[#8fb8ff]">
              <JsonView data={view === "response" ? compact(last.data) : last.body ?? {}} maxHeight={260} className="text-[#c9c8c2]! text-[11px]!" />
            </div>
          </>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-4 h-10 border-b border-border">
          <span className="text-[12.5px] font-semibold">Audit log · this session</span>
          <Badge tone="neutral" mono>{events.length ? `${state!.audit.length - auditStart} events` : "0 events"}</Badge>
        </div>
        <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
          {events.length === 0 && <div className="px-4 py-6 text-[12.5px] text-muted">Every rule evaluation will appear here as it happens.</div>}
          {events.map((e) => (
            <div key={e.id} className={cx("px-4 py-2 border-b border-border last:border-0 flex items-center gap-3", "anim-flash")}>
              <span className="font-mono text-[10.5px] text-faint tnum shrink-0">{fmtTime(e.ts)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] truncate">{e.rule_id ?? e.action}</div>
                {e.rule_id && <div className="text-[10.5px] text-faint truncate">{e.action}</div>}
              </div>
              <span className={cx("font-mono text-[10.5px] font-semibold", e.result === "PASS" ? "text-success" : e.result === "FAIL" ? "text-danger" : e.result === "WARN" ? "text-warn" : "text-info")}>{e.result}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

// Keep the console readable: collapse bulky arrays in the response preview.
function compact(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  const ev = d.evaluation as { results?: unknown[] } | undefined;
  if (ev?.results) return { ...d, evaluation: { ...ev, results: ev.results.map((r) => { const x = r as Record<string, unknown>; return { rule_id: x.rule_id, outcome: x.outcome, code: x.code }; }) } };
  if (Array.isArray(d.sections)) return { ...d, sections: `[${(d.sections as unknown[]).length} sections]`, tables: "[…]" };
  return data;
}
