"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search, Wallet } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountRows, activePacks, getPack } from "@/lib/client/selectors";
import { Badge, Button, Card, CountryChip, EmptyState, Field, Input, Modal, PageHeader, Progress, Select, Skeleton, StatusBadge, WrapperBadge } from "@/components/ui";
import { DecisionCard, RuleChecklist, SuccessCard, useReveal } from "@/components/rules/Evaluation";
import { fmtMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import type { Evaluation } from "@/lib/types";

export default function AccountsPage() {
  const { state, partner } = useShield();
  const params = useSearchParams();
  const router = useRouter();
  const wrapper = params.get("wrapper") ?? undefined;
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const rows = useMemo(() => (state ? accountRows(state, partner, wrapper) : []), [state, partner, wrapper]);
  const filtered = rows.filter((r) => !q || `${r.id} ${r.clientName} ${r.partnerName}`.toLowerCase().includes(q.toLowerCase()));
  const pack = state && wrapper ? getPack(state, wrapper) : undefined;

  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow={pack && <WrapperBadge wrapper={pack.wrapper} name={`${pack.name} · ${pack.country_name}`} />}
        title={pack ? `${pack.name} accounts` : "Accounts"}
        description={pack ? `${pack.full_name}. ${pack.summary}` : "Every wrapper account opened through the API, across partners."}
        actions={<Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)}>New account</Button>}
      />
      <Card>
        <div className="flex items-center gap-3 px-4 h-13 border-b border-border">
          <Search className="size-4 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by account, client or partner" aria-label="Filter accounts" className="flex-1 bg-transparent text-[13px] outline-none focus-visible:outline-none placeholder:text-faint" />
          <span className="text-[12px] text-muted tnum">{filtered.length} accounts</span>
        </div>
        {!state ? (
          <div className="p-4 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Wallet className="size-5" />} title="No accounts yet" body={pack ? `Open the first ${pack.name} account — the rule pack is active and ready.` : "Try another filter."} action={<Button variant="primary" onClick={() => setCreating(true)}>New account</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Client</th>
                  <th>Wrapper</th>
                  <th>Partner</th>
                  <th className="num">Value</th>
                  <th className="min-w-[180px]">Contribution headroom</th>
                  <th className="num">Plan age</th>
                  <th>Compliance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => router.push(`/accounts/${r.id}`)}>
                    <td><Link href={`/accounts/${r.id}`} className="font-mono text-[12.5px] font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.id}</Link></td>
                    <td><span className="flex items-center gap-2">{r.clientName} <CountryChip code={r.residency} /></span></td>
                    <td><WrapperBadge wrapper={r.wrapper} size="sm" /></td>
                    <td className="text-fg-2">{r.partnerName}</td>
                    <td className="num font-medium">{fmtMoney(r.value, r.account.currency, { decimals: 0 })}</td>
                    <td>
                      {r.limit === null ? (
                        <span className="text-muted text-[12px]">No cap</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <Progress value={r.used} max={r.limit} tone={r.headroom === 0 ? "warn" : "ink"} className="w-20 h-1.5" />
                          <span className="tnum text-[12px]">{fmtMoney(r.headroom ?? 0, r.account.currency, { decimals: 0, compact: true })}</span>
                        </div>
                      )}
                    </td>
                    <td className="num text-fg-2">{r.planAge.toFixed(1)}y</td>
                    <td>{r.compliant ? <Badge tone="success" dot>Compliant</Badge> : <Badge tone="danger" dot>Breach</Badge>}</td>
                    <td><StatusBadge status={r.account.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {state && <NewAccountDialog open={creating} onClose={() => setCreating(false)} defaultWrapper={wrapper} />}
    </div>
  );
}

function NewAccountDialog({ open, onClose, defaultWrapper }: { open: boolean; onClose: () => void; defaultWrapper?: string }) {
  const { state, call, partner, toast } = useShield();
  const router = useRouter();
  const packs = state ? activePacks(state) : [];
  const [wrapper, setWrapper] = useState(defaultWrapper ?? "PEA");
  const pack = packs.find((p) => p.wrapper === wrapper) ?? packs[0];
  const [name, setName] = useState("Nadia Kowalski");
  const [residency, setResidency] = useState(pack?.country ?? "FR");
  const [partnerId, setPartnerId] = useState(partner !== "all" ? partner : state?.partners[0].id ?? "");
  const [deposit, setDeposit] = useState(10000);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; data: Record<string, unknown> } | null>(null);
  const ev = (res?.data?.evaluation ?? null) as Evaluation | null;
  const { revealed, done } = useReveal(ev);
  if (!state || !pack) return null;
  const submit = async () => {
    setBusy(true);
    const c = await call("POST", "/api/v1/accounts", { client_name: name, tax_residency: residency, partner_id: partnerId, wrapper_type: pack.wrapper, initial_deposit: deposit });
    setBusy(false);
    setRes({ ok: c.ok, data: c.data as Record<string, unknown> });
    if (c.ok) toast({ tone: "success", title: `${pack.name} account created`, body: (c.data as { account: { id: string } }).account.id });
  };
  const created = res?.ok ? (res.data.account as { id: string }) : null;
  return (
    <Modal open={open} onClose={() => (onClose(), setRes(null))} title="Open a wrapper account" description="POST /v1/accounts — the rule pack decides whether the account can be opened." width={560}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wrapper" htmlFor="n-w">
            <Select id="n-w" value={pack.wrapper} onChange={(e) => { setWrapper(e.target.value); setResidency(packs.find((p) => p.wrapper === e.target.value)?.country ?? "FR"); setRes(null); }}>
              {packs.map((p) => <option key={p.wrapper} value={p.wrapper}>{p.name} · {p.country_name}</option>)}
            </Select>
          </Field>
          <Field label="Partner" htmlFor="n-p">
            <Select id="n-p" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              {state.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Client name" htmlFor="n-n"><Input id="n-n" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Tax residency" htmlFor="n-r">
            <Select id="n-r" value={residency} onChange={(e) => (setResidency(e.target.value), setRes(null))}>
              {["FR", "SE", "IT", "PL", "DE", "BE", "NL", "ES", "US"].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Initial deposit" htmlFor="n-d"><Input id="n-d" type="number" prefix={pack.currency === "EUR" ? "€" : pack.currency} value={deposit} onChange={(e) => (setDeposit(Number(e.target.value) || 0), setRes(null))} /></Field>
        </div>
        {res && ev && <div className="rounded-xl border border-border bg-surface-2 p-2"><RuleChecklist evaluation={ev} revealed={revealed} /></div>}
        {res && done && !res.ok && ev?.failed && <DecisionCard title="Account not opened" subtitle={ev.failed.message} result={ev.failed} currency={pack.currency} />}
        {res && !res.ok && !ev && <div className="rounded-lg bg-danger-soft text-danger text-[13px] px-3 py-2.5">{String(res.data.message)}</div>}
        {created && done && <SuccessCard title={`${created.id} opened`} subtitle={`Opened on ${fmtDate(new Date())}`} />}
        <div className="flex justify-end gap-2">
          {created ? (
            <Button variant="primary" onClick={() => router.push(`/accounts/${created.id}`)}>Open account</Button>
          ) : (
            <Button variant="primary" loading={busy} onClick={submit}>Create account</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
