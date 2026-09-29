"use client";
import { useState, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { sessionId } from "@/lib/client/api";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";

const noop = () => () => {};

export default function SettingsPage() {
  const { state, reset, toast } = useShield();
  const [busy, setBusy] = useState(false);
  const sid = useSyncExternalStore(noop, sessionId, () => "");
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[900px] mx-auto space-y-4">
      <PageHeader title="Settings" description="Sandbox environment for the Shield prototype." />
      <Card>
        <CardHeader title="Environment" />
        <dl className="px-5 pb-5 grid sm:grid-cols-2 gap-4 text-[13px]">
          <div><dt className="text-muted">Environment</dt><dd className="mt-1"><Badge tone="brand" dot>Demo</Badge></dd></div>
          <div><dt className="text-muted">Sandbox session</dt><dd className="mt-1 font-mono text-[12px]">{sid}</dd></div>
          <div><dt className="text-muted">Seeded at</dt><dd className="mt-1">{state ? fmtDateTime(state.seeded_at) : "—"}</dd></div>
          <div><dt className="text-muted">Active wrappers</dt><dd className="mt-1 font-mono text-[12px]">{state?.active_wrappers.join(", ")}</dd></div>
          <div><dt className="text-muted">Audit events</dt><dd className="mt-1 tnum">{state?.audit.length.toLocaleString()}</dd></div>
          <div><dt className="text-muted">API</dt><dd className="mt-1"><a className="underline" href="/openapi.json" target="_blank">OpenAPI specification</a></dd></div>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Reset sandbox" description="Restore the deterministic seed: 3 partners, 21 accounts, 12–18 months of history. Your API session keeps working." />
        <div className="px-5 pb-5">
          <Button variant="danger" loading={busy} icon={<RotateCcw className="size-3.5" />} onClick={async () => { setBusy(true); await reset(); setBusy(false); toast({ tone: "success", title: "Sandbox reset" }); }}>Reset demo data</Button>
        </div>
      </Card>
      <Card className="p-5 text-[12.5px] text-muted leading-relaxed">
        Shield is a portfolio prototype of a tax-wrapper feature layer for a broker API. It is not an official Alpaca product and is not affiliated with or endorsed by Alpaca. All partners, clients and prices are fictional. Tax rules are simplified for demonstration and are not tax advice.
      </Card>
    </div>
  );
}
