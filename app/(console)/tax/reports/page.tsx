"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FileText } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { getPack } from "@/lib/client/selectors";
import type { ReportData } from "@/lib/reports";
import { DEMO } from "@/lib/seed/demo-ids";
import { Button, Card, EmptyState, Field, PageHeader, Select } from "@/components/ui";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { fmtDateTime } from "@/lib/dates";

export default function ReportsPage() {
  const { state } = useShield();
  const account = useSearchParams().get("account") ?? "";
  if (!state) return null;
  return <Reports key={account} />;
}

function Reports() {
  const { state: maybeState, call, partner: globalPartner } = useShield();
  const state = maybeState!;
  const params = useSearchParams();
  const initialAccount = params.get("account") ?? DEMO.pea;
  const [partner, setPartner] = useState(state.accounts.find((a) => a.id === initialAccount)?.partner_id ?? (globalPartner !== "all" ? globalPartner : DEMO.partners.lumen));
  const [account, setAccount] = useState(initialAccount);
  const [year, setYear] = useState(2026);
  const [report, setReport] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accounts = state.accounts.filter((a) => a.partner_id === partner);
  const generate = async () => {
    setBusy(true);
    setError(null);
    const c = await call("GET", `/api/v1/accounts/${account}/reports/${year}`);
    setBusy(false);
    if (c.ok) setReport(c.data as ReportData);
    else setError((c.data as { message: string }).message);
  };
  const history = [...state.reports].reverse().filter((r) => state.accounts.find((a) => a.id === r.account_id)?.partner_id === partner).slice(0, 8);
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1200px] mx-auto">
      <PageHeader title="Reports" description="Annual tax statements in each wrapper's local format, generated from the ledger. Simplified format for demonstration." />
      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <Field label="Partner" htmlFor="r-p">
              <Select id="r-p" value={partner} onChange={(e) => { setPartner(e.target.value); const first = state.accounts.find((a) => a.partner_id === e.target.value); if (first) setAccount(first.id); setReport(null); }}>
                {state.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Account" htmlFor="r-a">
              <Select id="r-a" value={account} onChange={(e) => (setAccount(e.target.value), setReport(null))}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.id} · {state.clients.find((c) => c.id === a.client_id)?.name}</option>)}
              </Select>
            </Field>
            <Field label="Year" htmlFor="r-y">
              <Select id="r-y" value={year} onChange={(e) => (setYear(Number(e.target.value)), setReport(null))}>
                {[2026, 2025].map((y) => <option key={y}>{y}</option>)}
              </Select>
            </Field>
            <div className="text-[12px] text-muted">Format: <b className="text-fg">{getPack(state, state.accounts.find((a) => a.id === account)?.wrapper ?? "PEA")?.reporting.name}</b></div>
            <Button variant="primary" className="w-full" loading={busy} onClick={generate} icon={<FileText className="size-3.5" />}>Generate report</Button>
            {error && <div className="text-[12px] text-danger">{error}</div>}
          </Card>
          <Card className="p-5">
            <div className="text-[12.5px] font-semibold mb-2">Recently generated</div>
            {history.length === 0 && <div className="text-[12px] text-muted">None yet</div>}
            {history.map((r) => (
              <div key={r.id} className="flex justify-between gap-2 text-[12px] py-1.5 border-b border-border last:border-0">
                <span className="font-mono">{r.account_id} · {r.year}</span>
                <span className="text-muted">{r.format} · {fmtDateTime(r.generated_at).split(" · ")[0]}</span>
              </div>
            ))}
          </Card>
        </div>
        <div className="min-w-0">
          {report ? <ReportPreview report={report} /> : <Card><EmptyState icon={<FileText className="size-5" />} title="Choose an account and generate" body="The report is built from the ledger — contributions, dividends, withholding, disposals and the wrapper's tax model." /></Card>}
        </div>
      </div>
    </div>
  );
}
