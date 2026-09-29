"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { partnerFilter } from "@/lib/client/selectors";
import type { AuditEvent } from "@/lib/types";
import { Badge, Card, Drawer, JsonView, PageHeader, Select, CopyButton, cx } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";

export default function AuditPage() {
  const { state, partner } = useShield();
  const [action, setAction] = useState("all");
  const [result, setResult] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<AuditEvent | null>(null);
  const events = useMemo(() => (state ? [...partnerFilter(state.audit, partner)].reverse() : []), [state, partner]);
  const actions = [...new Set(events.map((e) => e.action))].sort();
  const shown = events.filter((e) => (action === "all" || e.action === action) && (result === "all" || e.result === result) && (!q || `${e.account_id} ${e.rule_id} ${e.code} ${e.summary}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 400);
  const related = open?.evaluation_id ? events.filter((e) => e.evaluation_id === open.evaluation_id).reverse() : [];
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader title="Audit log" description="An immutable record of every decision: each rule evaluated, each outcome, with the payload the engine saw. Click an event to inspect it." />
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="size-4 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Account, rule, code…" aria-label="Search audit log" className="flex-1 bg-transparent text-[13px] outline-none focus-visible:outline-none" />
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-[200px]" aria-label="Action">
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a}>{a}</option>)}
          </Select>
          <Select value={result} onChange={(e) => setResult(e.target.value)} className="w-[130px]" aria-label="Result">
            {["all", "PASS", "FAIL", "WARN", "INFO"].map((r) => <option key={r} value={r}>{r === "all" ? "All results" : r}</option>)}
          </Select>
          <span className="text-[12px] text-muted tnum">{shown.length}{shown.length === 400 ? "+" : ""} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Timestamp</th><th>Account</th><th>Action</th><th>Rule</th><th>Result</th><th>Code</th><th>Summary</th></tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id} className="cursor-pointer" onClick={() => setOpen(e)}>
                  <td className="font-mono text-[11.5px] text-fg-2 tnum">{fmtDateTime(e.ts)}</td>
                  <td className="font-mono text-[12px]">{e.account_id ?? "—"}</td>
                  <td className="font-mono text-[11.5px]">{e.action}</td>
                  <td className="font-mono text-[11.5px] text-fg-2">{e.rule_id ?? "—"}</td>
                  <td><Badge tone={e.result === "PASS" ? "success" : e.result === "FAIL" ? "danger" : e.result === "WARN" ? "warn" : "info"} mono>{e.result}</Badge></td>
                  <td className="font-mono text-[11px] text-muted">{e.code}</td>
                  <td className="text-fg-2 max-w-[320px] truncate">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Drawer open={!!open} onClose={() => setOpen(null)} title={<span className="font-mono">{open?.action} · {open?.id}</span>} width={620}>
        {open && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-[12.5px]">
              <div><div className="text-muted">Account</div>{open.account_id ? <Link href={`/accounts/${open.account_id}`} className="font-mono hover:underline">{open.account_id}</Link> : "—"}</div>
              <div><div className="text-muted">Evaluation</div><span className="font-mono">{open.evaluation_id ?? "—"}</span></div>
            </div>
            {related.length > 1 && (
              <div>
                <div className="text-[12px] font-semibold mb-2">Decision trace · {related.length} events</div>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {related.map((e) => (
                    <button key={e.id} onClick={() => setOpen(e)} className={cx("w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] hover:bg-sunken", e.id === open.id && "bg-brand-soft")}>
                      <span className="font-mono flex-1 truncate">{e.rule_id ?? e.action}</span>
                      <span className={cx("font-mono font-semibold text-[11px]", e.result === "PASS" ? "text-success" : e.result === "FAIL" ? "text-danger" : "text-muted")}>{e.result}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2"><span className="text-[12px] font-semibold">Event JSON</span><CopyButton text={JSON.stringify(open, null, 2)} /></div>
              <div className="rounded-xl bg-surface-2 border border-border p-4"><JsonView data={open} /></div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
