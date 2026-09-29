"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useShield } from "@/lib/client/store";
import { getPack } from "@/lib/client/selectors";
import { DEMO } from "@/lib/seed/demo-ids";
import { Card, CardHeader, Field, PageHeader, Select, Tabs, WrapperBadge } from "@/components/ui";
import { WithdrawalSimulator } from "@/components/tax/WithdrawalSimulator";
import { IskCalculation } from "@/components/tax/IskCalculation";

export default function SimulatorPage() {
  return <Simulator key={useSearchParams().get("tab") ?? ""} />;
}

function Simulator() {
  const { state } = useShield();
  const params = useSearchParams();
  const [tab, setTab] = useState<"withdrawal" | "isk">(params.get("tab") === "isk" ? "isk" : "withdrawal");
  const [wdAccount, setWdAccount] = useState(DEMO.pea);
  const [iskAccount, setIskAccount] = useState(DEMO.isk);
  if (!state) return null;
  const byModel = (model: string) => state.accounts.filter((a) => getPack(state, a.wrapper)?.tax.model === model && a.status === "ACTIVE");
  const name = (clientId: string) => state.clients.find((c) => c.id === clientId)?.name;
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1100px] mx-auto">
      <PageHeader title="Tax simulator" description="Dry-run tax outcomes using each wrapper's tax model. Simulations call POST /v1/wrappers/simulate and never modify the account." />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[{ id: "withdrawal", label: "Withdrawal · PEA / PIR / IKE" }, { id: "isk", label: "Capital tax · ISK" }]} />
      {tab === "withdrawal" ? (
        <Card>
          <CardHeader title="What happens if the investor withdraws?" description="Holding-period tax schedule from the rule pack (gain_tax_schedule)" action={
            <Field label=""><Select value={wdAccount} onChange={(e) => setWdAccount(e.target.value)} aria-label="Account" className="w-[260px]">
              {byModel("gain_tax_schedule").map((a) => <option key={a.id} value={a.id}>{a.id} · {name(a.client_id)}</option>)}
            </Select></Field>
          } />
          <div className="px-5 pb-6"><div className="mb-4"><WrapperBadge wrapper={state.accounts.find((a) => a.id === wdAccount)?.wrapper ?? "PEA"} /></div><WithdrawalSimulator key={wdAccount} accountId={wdAccount} /></div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="ISK · 2026 estimated tax" description="Quarterly snapshots → capital base → allowance → base rate → 30% tax" action={
            <Select value={iskAccount} onChange={(e) => setIskAccount(e.target.value)} aria-label="Account" className="w-[260px]">
              {byModel("capital_base_tax").map((a) => <option key={a.id} value={a.id}>{a.id} · {name(a.client_id)}</option>)}
            </Select>
          } />
          <div className="px-5 pb-6"><IskCalculation key={iskAccount} accountId={iskAccount} defaultOpen /></div>
        </Card>
      )}
    </div>
  );
}
