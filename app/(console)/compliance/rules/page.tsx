"use client";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useShield } from "@/lib/client/store";
import { allRules } from "@/lib/client/selectors";
import { CORE_PACK } from "@/lib/engine/packs";
import { describePredicate } from "@/lib/engine/predicate";
import type { Predicate } from "@/lib/types";
import { Badge, Card, Drawer, JsonView, PageHeader, Segmented, WrapperBadge, cx } from "@/components/ui";

const STAGE_LABEL: Record<string, string> = { account_opening: "Account opening", pre_trade: "Pre-trade", pre_transfer: "Deposit", pre_withdrawal: "Withdrawal", compliance: "Monitoring" };

export default function RulesPage() {
  const { state } = useShield();
  const params = useSearchParams();
  const [wrapper, setWrapper] = useState(params.get("wrapper") ?? "all");
  const [open, setOpen] = useState<string | null>(params.get("rule"));
  const rules = useMemo(() => {
    if (!state) return [];
    const core = CORE_PACK.rules.map((r) => ({ ...r, wrapper: "CORE", packName: "Core", active: true }));
    return [...core, ...allRules(state)];
  }, [state]);
  const stats = useMemo(() => {
    const m = new Map<string, { pass: number; fail: number }>();
    for (const e of state?.audit ?? []) {
      if (e.action !== "RULE_EVALUATED" || !e.rule_id) continue;
      const s = m.get(e.rule_id) ?? { pass: 0, fail: 0 };
      if (e.result === "FAIL") s.fail++;
      else s.pass++;
      m.set(e.rule_id, s);
    }
    return m;
  }, [state]);
  const wrappers = ["all", "CORE", ...new Set(rules.filter((r) => r.wrapper !== "CORE").map((r) => r.wrapper))];
  const shown = rules.filter((r) => wrapper === "all" || r.wrapper === wrapper);
  const selected = rules.find((r) => r.id === open);
  const describe = (r: (typeof rules)[number]) => {
    const p = r.params as Record<string, unknown>;
    if (p.predicate) return describePredicate(p.predicate as Predicate);
    if (r.kind === "contribution_limit") return `${p.period} deposits ≤ ${Number(p.limit).toLocaleString()}`;
    if (r.kind === "issuer_concentration") return `single issuer ≤ ${p.max_pct}% of plan`;
    if (r.kind === "holding_period") return `plan age ≥ ${p.years}y, else ${String(p.early_exit).replace("_", " ")}`;
    if (r.kind === "max_accounts_per_client") return `≤ ${p.max} active account per client`;
    if (r.kind === "account_status") return `status = ${p.status}`;
    return "cash ≥ required amount";
  };
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader title="Rules" description="Every rule the engine enforces, loaded from JSON rule packs. Each rule picks a generic evaluator (kind) and configures it with params." />
      <div className="mb-4 overflow-x-auto">
        <Segmented value={wrapper} onChange={setWrapper} options={wrappers.map((w) => ({ id: w, label: w === "all" ? "All" : w.replace("_", "-") }))} />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Pack</th><th>Stages</th><th>Evaluator</th><th>Condition</th><th>Error code</th><th className="num">Pass</th><th className="num">Fail</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const s = stats.get(r.id);
                return (
                  <tr key={r.wrapper + r.id} className={cx("cursor-pointer", !r.active && "opacity-50")} onClick={() => setOpen(r.id)}>
                    <td><div className="font-mono text-[12px] font-medium">{r.id}</div><div className="text-[11.5px] text-muted">{r.name.replace("{wrapper}", "wrapper")}</div></td>
                    <td>{r.wrapper === "CORE" ? <Badge mono>CORE</Badge> : <WrapperBadge wrapper={r.wrapper} size="sm" />}{!r.active && <span className="text-[11px] text-muted ml-1.5">inactive</span>}</td>
                    <td><div className="flex gap-1 flex-wrap">{r.stages.map((st) => <Badge key={st}>{STAGE_LABEL[st]}</Badge>)}</div></td>
                    <td className="font-mono text-[11.5px] text-fg-2">{r.kind}</td>
                    <td className="font-mono text-[11px] text-muted max-w-[280px] truncate" title={describe(r)}>{describe(r)}</td>
                    <td className="font-mono text-[11px]">{r.error_code}</td>
                    <td className="num text-success">{s?.pass ?? 0}</td>
                    <td className="num text-danger">{s?.fail ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Drawer open={!!selected} onClose={() => setOpen(null)} title={<span className="font-mono">{selected?.id}</span>}>
        {selected && (
          <div className="p-5 space-y-4">
            <p className="text-[13.5px] text-fg-2">{selected.explain}</p>
            <div className="text-[12.5px]"><span className="text-muted">Message template: </span>{selected.message}</div>
            <div className="rounded-xl bg-surface-2 border border-border p-4"><JsonView data={{ id: selected.id, name: selected.name, stages: selected.stages, kind: selected.kind, params: selected.params, error_code: selected.error_code, message: selected.message }} /></div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
