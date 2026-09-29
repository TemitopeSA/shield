"use client";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Play, RotateCcw, Terminal } from "lucide-react";
import { useShield } from "@/lib/client/store";
import type { ApiCall } from "@/lib/client/api";
import type { Evaluation } from "@/lib/types";
import { DEMO } from "@/lib/seed/demo-ids";
import { Badge, Button, CopyButton, Input, JsonView, cx } from "@/components/ui";

interface Endpoint {
  id: string;
  group: string;
  method: "GET" | "POST";
  path: string; // with {id} / {year}
  summary: string;
  body?: (acct: string) => unknown;
}

const ENDPOINTS: Endpoint[] = [
  { id: "create", group: "Accounts", method: "POST", path: "/v1/accounts", summary: "Create a wrapper account. The wrapper is one field.", body: () => ({ client_id: "client_001", client_name: "Alex Durand", wrapper_type: "PEA", tax_residency: "FR", initial_deposit: 10000 }) },
  { id: "list", group: "Accounts", method: "GET", path: "/v1/accounts", summary: "List wrapper accounts." },
  { id: "transfer", group: "Transfers", method: "POST", path: "/v1/accounts/{id}/transfers", summary: "Deposit or withdraw. Contribution limits and holding periods are enforced.", body: () => ({ direction: "INCOMING", amount: 10000 }) },
  { id: "order", group: "Orders", method: "POST", path: "/v1/trading/accounts/{id}/orders", summary: "Submit an order. Checked for eligibility, concentration and cash before a mock fill.", body: () => ({ symbol: "AAPL", qty: 10, side: "buy", type: "market" }) },
  { id: "wrapper", group: "Wrapper", method: "GET", path: "/v1/accounts/{id}/wrapper", summary: "Wrapper status: headroom, holding period, compliance, estimated tax." },
  { id: "lots", group: "Tax Lots", method: "GET", path: "/v1/accounts/{id}/tax_lots", summary: "Open tax lots with cost basis and unrealised gains." },
  { id: "report", group: "Reports", method: "GET", path: "/v1/accounts/{id}/reports/{year}", summary: "Annual tax report in the wrapper's local format (IFU · KU · PIR)." },
  { id: "simulate", group: "Simulation", method: "POST", path: "/v1/wrappers/simulate", summary: "Dry run any action. Never modifies state.", body: (a) => ({ action: "withdrawal", account_id: a, amount: 5000, date: "2031-01-15", assumed_return: 0.05 }) },
  { id: "packs", group: "Simulation", method: "GET", path: "/v1/wrappers", summary: "Rule packs registered with the engine." },
];

export default function Playground() {
  const params = useSearchParams();
  const { call } = useShield();
  const [ep, setEp] = useState<Endpoint>(ENDPOINTS.find((e) => e.id === "order")!);
  const [acct, setAcct] = useState(params.get("account") ?? DEMO.pea);
  const [year, setYear] = useState("2026");
  const [body, setBody] = useState(JSON.stringify(ep.body?.(acct), null, 2));
  const [res, setRes] = useState<ApiCall | null>(null);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const path = ep.path.replace("{id}", acct).replace("{year}", year);
  const select = (e: Endpoint) => {
    setEp(e);
    setBody(e.body ? JSON.stringify(e.body(acct), null, 2) : "");
    setRes(null);
    setParseError(null);
  };
  const run = async () => {
    let parsed: unknown;
    if (ep.method === "POST") {
      try {
        parsed = JSON.parse(body || "{}");
      } catch (e) {
        setParseError((e as Error).message);
        return;
      }
    }
    setParseError(null);
    setBusy(true);
    setRes(await call(ep.method, `/api${path}`, parsed));
    setBusy(false);
  };
  const evaluation = (res?.data as { evaluation?: Evaluation })?.evaluation;
  const groups = useMemo(() => [...new Set(ENDPOINTS.map((e) => e.group))], []);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const curl = `curl -X ${ep.method} ${origin}${path}${ep.method === "POST" ? ` \\\n  -H 'content-type: application/json' \\\n  -d '${body.replace(/\s*\n\s*/g, " ")}'` : ""}`;

  return (
    <div className="h-[calc(100vh-84px)] flex flex-col lg:flex-row min-h-[600px]">
      <nav className="lg:w-[250px] shrink-0 border-b lg:border-b-0 lg:border-r border-border bg-surface overflow-y-auto scrollbar-thin" aria-label="Endpoints">
        <div className="px-4 pt-4 pb-2">
          <div className="text-[14px] font-semibold">API Playground</div>
          <div className="text-[12px] text-muted">Live requests against your sandbox</div>
        </div>
        <div className="flex lg:block overflow-x-auto px-2 pb-3">
          {groups.map((g) => (
            <div key={g} className="lg:mt-3 shrink-0">
              <div className="hidden lg:block px-2 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">{g}</div>
              {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                <button key={e.id} onClick={() => select(e)} className={cx("w-full flex items-center gap-2 px-2 h-8 rounded-lg text-left whitespace-nowrap", ep.id === e.id ? "bg-sunken" : "hover:bg-sunken/70")}>
                  <span className={cx("font-mono text-[10px] font-bold w-9", e.method === "GET" ? "text-info" : "text-[#a88600]")}>{e.method}</span>
                  <span className="font-mono text-[11.5px] truncate text-fg-2">{e.path.replace("/v1", "")}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <section className="flex-1 min-w-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border">
        <div className="px-5 py-4 border-b border-border bg-surface">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ep.method === "GET" ? "info" : "brand"} mono>{ep.method}</Badge>
            <code className="font-mono text-[13px] font-medium break-all">{path}</code>
          </div>
          <p className="text-[12.5px] text-muted mt-1.5">{ep.summary}</p>
          {(ep.path.includes("{id}") || ep.id === "simulate") && (
            <div className="flex flex-wrap gap-3 mt-3">
              <label className="flex items-center gap-2 text-[12px] text-muted">
                id
                <Input value={acct} onChange={(e) => setAcct(e.target.value)} className="h-7! w-36 font-mono text-[12px]!" list="acct-ids" />
              </label>
              <datalist id="acct-ids">{[DEMO.pea, DEMO.isk, DEMO.pir].map((x) => <option key={x} value={x} />)}</datalist>
              {ep.path.includes("{year}") && (
                <label className="flex items-center gap-2 text-[12px] text-muted">year<Input value={year} onChange={(e) => setYear(e.target.value)} className="h-7! w-20 font-mono text-[12px]!" /></label>
              )}
              <div className="flex gap-1">
                {[DEMO.pea, DEMO.isk, DEMO.pir].map((x) => <button key={x} onClick={() => setAcct(x)} className={cx("h-7 px-2 rounded-md text-[11px] font-mono border", acct === x ? "border-ink bg-ink text-white" : "border-border hover:bg-sunken")}>{x}</button>)}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-1.5 border-b border-border bg-surface-2">
          <span className="text-[12px] font-semibold text-fg-2 whitespace-nowrap">Request body</span>
          <div className="flex gap-1">
            <CopyButton text={body} label="Copy JSON" />
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => select(ep)}>Reset</Button>
            <Button size="sm" variant="primary" icon={<Play className="size-3 fill-current" />} loading={busy} onClick={run}>Run request</Button>
          </div>
        </div>
        {ep.method === "POST" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
            spellCheck={false}
            aria-label="Request body JSON"
            className="flex-1 min-h-[220px] w-full resize-none bg-[#fcfcfb] p-5 font-mono text-[12.5px] leading-[1.65] outline-none focus-visible:outline-none"
          />
        ) : (
          <div className="flex-1 min-h-[120px] p-5 text-[13px] text-muted bg-[#fcfcfb]">No body. Press <b>Run request</b>.</div>
        )}
        {parseError && <div className="px-5 py-2 text-[12px] text-danger bg-danger-soft font-mono">Invalid JSON: {parseError}</div>}
        <div className="border-t border-border bg-[#141413] text-[#c9c8c2] px-5 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[11px] text-[#8d8c86]"><Terminal className="size-3" /> cURL</span>
            <CopyButton text={curl} className="text-[#c9c8c2]! hover:bg-white/10!" />
          </div>
          <pre className="font-mono text-[11px] whitespace-pre-wrap break-all">{curl}</pre>
        </div>
      </section>

      <section className="lg:w-[46%] min-w-0 flex flex-col bg-surface">
        <div className="flex items-center justify-between px-5 h-12 border-b border-border">
          <span className="text-[13px] font-semibold">Response</span>
          {res && (
            <div className="flex items-center gap-2">
              <Badge tone={res.ok ? "success" : res.status >= 500 ? "danger" : "warn"} mono>{res.status}</Badge>
              <span className="text-[11.5px] text-muted font-mono">{res.ms}ms</span>
              <CopyButton text={typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2)} label="Copy" />
            </div>
          )}
        </div>
        <div className="flex-1 min-h-[200px] overflow-auto scrollbar-thin p-5 bg-[#fcfcfb]">
          {res ? <JsonView data={res.data} /> : <div className="text-[13px] text-muted">Run a request to see the live response from the engine.</div>}
        </div>
        {evaluation && (
          <div className="border-t border-border max-h-[45%] overflow-auto scrollbar-thin">
            <div className="flex items-center justify-between px-5 h-10 bg-surface-2 border-b border-border sticky top-0">
              <span className="text-[12px] font-semibold">Rules evaluated · <span className="font-mono font-normal">{evaluation.stage}</span></span>
              <span className="text-[11.5px] font-mono text-muted">{evaluation.id} · {(evaluation.duration_ms * 1000).toFixed(0)}µs</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Rule</th><th>Result</th><th>Code</th><th className="num">Execution</th></tr></thead>
              <tbody>
                {evaluation.results.map((r) => (
                  <tr key={r.rule_id}>
                    <td className="font-mono text-[11.5px]">{r.rule_id}</td>
                    <td><span className={cx("font-mono text-[11px] font-bold", r.outcome === "PASS" ? "text-success" : r.outcome === "FAIL" ? "text-danger" : r.outcome === "WARN" ? "text-warn" : "text-faint")}>{r.outcome}</span></td>
                    <td className="font-mono text-[11px] text-muted">{r.code}</td>
                    <td className="num font-mono text-[11px] text-muted">{(r.duration_ms * 1000).toFixed(0)}µs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
