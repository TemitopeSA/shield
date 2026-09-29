"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, FileJson, Plus, Upload, Zap } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { allPacks } from "@/lib/client/selectors";
import { packFile } from "@/lib/engine/packs";
import { Badge, Button, Card, CopyButton, CountryChip, JsonView, Modal, PageHeader, WrapperBadge, cx } from "@/components/ui";

interface Summary { wrapper: string; name: string; country: string; country_name: string; currency: string; rules: number; stages: string[]; kinds: string[]; tax_model: string }

export default function RulePacksPage() {
  const { state } = useShield();
  const params = useSearchParams();
  const packs = state ? allPacks(state) : [];
  const [selected, setSelected] = useState(params.get("add")?.toUpperCase() ?? "PEA");
  const [adding, setAdding] = useState(!!params.get("add"));
  const pack = packs.find((p) => p.wrapper === selected) ?? packs[0];
  if (!state || !pack) return null;
  const active = (w: string) => state.active_wrappers.includes(w);
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader
        title="Rule packs"
        description="A wrapper is configuration: residency, limits, eligible universe, concentration, holding period, tax model and reporting format. The engine runs any pack that only uses supported evaluators."
        actions={<Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>Add a wrapper</Button>}
      />
      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-2">
          {packs.map((p) => (
            <button key={p.wrapper} onClick={() => setSelected(p.wrapper)} className={cx("w-full text-left rounded-xl border bg-surface p-4 transition-all", selected === p.wrapper ? "border-ink shadow-[0_0_0_3px_rgba(252,213,53,0.45)]" : "border-border hover:border-border-strong")}>
              <div className="flex items-center justify-between">
                <WrapperBadge wrapper={p.wrapper} name={p.name} />
                {active(p.wrapper) ? <Badge tone="success" dot>Active</Badge> : <Badge>Available</Badge>}
              </div>
              <div className="mt-2 text-[13px] font-medium flex items-center gap-2">{p.full_name}</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-muted"><CountryChip code={p.country} /> {p.country_name} · {p.rules.length} rules · <span className="font-mono">{packFile(p.wrapper)}</span></div>
            </button>
          ))}
        </div>
        <Card className="overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div>
              <div className="font-mono text-[13px] font-medium">rules/{packFile(pack.wrapper)}</div>
              <div className="text-[12px] text-muted mt-0.5">v{pack.version} · tax model <span className="font-mono">{pack.tax.model}</span> · reporting <span className="font-mono">{pack.reporting.format}</span></div>
            </div>
            <div className="flex gap-2">
              <CopyButton text={JSON.stringify(pack, null, 2)} label="Copy JSON" />
              {!active(pack.wrapper) && <Button variant="primary" size="sm" icon={<Zap className="size-3.5" />} onClick={() => setAdding(true)}>Activate</Button>}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-border border-b border-border">
            {[["Rules", pack.rules.length], ["Stages", [...new Set(pack.rules.flatMap((r) => r.stages))].length], ["Evaluators", [...new Set(pack.rules.map((r) => r.kind))].length]].map(([k, v]) => (
              <div key={k} className="bg-surface px-5 py-3"><div className="text-[11.5px] text-muted">{k}</div><div className="text-[18px] font-semibold tnum">{v}</div></div>
            ))}
          </div>
          <div className="p-5 bg-[#fcfcfb]"><JsonView data={pack} maxHeight={640} /></div>
        </Card>
      </div>
      <AddWrapperDialog open={adding} onClose={() => setAdding(false)} initial={params.get("add")?.toUpperCase()} onActivated={(w) => setSelected(w)} />
    </div>
  );
}

function AddWrapperDialog({ open, onClose, initial, onActivated }: { open: boolean; onClose: () => void; initial?: string; onActivated: (w: string) => void }) {
  const { state, call, toast } = useShield();
  const inactive = state ? allPacks(state).filter((p) => !state.active_wrappers.includes(p.wrapper)) : [];
  const [source, setSource] = useState<{ name: string; json: unknown } | null>(null);
  const [check, setCheck] = useState<{ valid: boolean; summary?: Summary; errors?: string[] } | null>(null);
  const [busy, setBusy] = useState<"validate" | "activate" | null>(null);
  const [done, setDone] = useState<Summary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialPicked = useRef(false);

  const validate = async (name: string, json: unknown) => {
    setSource({ name, json });
    setDone(null);
    setBusy("validate");
    const [c] = await Promise.all([call("POST", "/api/v1/wrappers/validate", { pack: json }), new Promise((r) => setTimeout(r, 450))]);
    setBusy(null);
    setCheck(c.data as { valid: boolean; summary?: Summary; errors?: string[] });
  };
  useEffect(() => {
    if (!open || !initial || initialPicked.current || !state) return;
    initialPicked.current = true;
    const p = allPacks(state).find((x) => x.wrapper === initial);
    if (p && !state.active_wrappers.includes(p.wrapper)) queueMicrotask(() => validate(packFile(p.wrapper), p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, state]);
  const activate = async () => {
    if (!source) return;
    setBusy("activate");
    const c = await call("POST", "/api/v1/wrappers", { pack: source.json });
    setBusy(null);
    if (c.ok) {
      setDone(check!.summary!);
      onActivated(check!.summary!.wrapper);
      toast({ tone: "success", title: `${check!.summary!.name} activated`, body: "Now available across accounts, API and reports." });
    }
  };
  const close = () => { onClose(); setSource(null); setCheck(null); setDone(null); };

  return (
    <Modal open={open} onClose={close} title="Add a wrapper" description="Select or upload a rule pack. The engine validates it against its supported evaluators — no code changes." width={600}>
      {!source && (
        <div className="space-y-3">
          {inactive.map((p) => (
            <button key={p.wrapper} onClick={() => validate(packFile(p.wrapper), p)} className="w-full flex items-center gap-3 rounded-xl border border-border p-3.5 text-left hover:border-ink hover:bg-surface-2">
              <FileJson className="size-5 text-muted" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[13px] font-medium">{packFile(p.wrapper)}</div>
                <div className="text-[12px] text-muted">{p.full_name} · {p.country_name}</div>
              </div>
              <WrapperBadge wrapper={p.wrapper} name={p.name} size="sm" />
            </button>
          ))}
          {inactive.length === 0 && <div className="text-[13px] text-muted">All bundled packs are active. Upload your own JSON pack below.</div>}
          <button onClick={() => fileRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border py-6 text-[13px] text-muted hover:border-border-strong hover:bg-surface-2">
            <Upload className="size-5" /> Upload a rule pack (.json)
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { await validate(f.name, JSON.parse(await f.text())); } catch { setSource({ name: f.name, json: null }); setCheck({ valid: false, errors: ["File is not valid JSON"] }); }
          }} />
        </div>
      )}
      {source && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-border p-3.5">
            <FileJson className="size-5 text-muted" />
            <span className="font-mono text-[13px] font-medium flex-1">{source.name}</span>
            {busy === "validate" ? <span className="text-[12px] text-muted">Validating…</span> : check?.valid ? <Badge tone="success" dot>Valid</Badge> : <Badge tone="danger" dot>Invalid</Badge>}
          </div>
          {check?.valid && check.summary && (
            <div className="rounded-xl bg-surface-2 border border-border p-5 anim-rise">
              <div className="text-[15px] font-semibold">{done ? `${check.summary.name} is live` : "Wrapper detected"}</div>
              <dl className="grid grid-cols-3 gap-4 mt-3 text-[12.5px]">
                <div><dt className="text-muted">Country</dt><dd className="font-medium mt-0.5">{check.summary.country_name}</dd></div>
                <div><dt className="text-muted">Rules</dt><dd className="font-medium mt-0.5">{check.summary.rules}</dd></div>
                <div><dt className="text-muted">Status</dt><dd className="font-medium mt-0.5 text-success">{done ? "Active" : "Ready"}</dd></div>
                <div><dt className="text-muted">Currency</dt><dd className="font-medium mt-0.5">{check.summary.currency}</dd></div>
                <div className="col-span-2"><dt className="text-muted">Evaluators reused</dt><dd className="font-mono text-[11.5px] mt-0.5">{check.summary.kinds.join(" · ")}</dd></div>
              </dl>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-success"><Check className="size-3.5" /> 0 lines of engine code changed</div>
            </div>
          )}
          {check && !check.valid && (
            <div className="rounded-xl border border-[#f1d3cf] bg-danger-soft/50 p-4">
              <div className="text-[13px] font-semibold text-danger mb-2">Validation failed</div>
              <ul className="space-y-1 font-mono text-[11.5px] text-fg-2">{check.errors?.map((e) => <li key={e}>• {e}</li>)}</ul>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => { setSource(null); setCheck(null); setDone(null); }}>Back</Button>
            {done ? (
              <div className="flex gap-2">
                <Link href={`/accounts?wrapper=${done.wrapper}`} onClick={close}><Button variant="primary">Open {done.name} accounts</Button></Link>
              </div>
            ) : (
              <Button variant="primary" icon={<Zap className="size-3.5" />} disabled={!check?.valid} loading={busy === "activate"} onClick={activate}>Activate wrapper</Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
