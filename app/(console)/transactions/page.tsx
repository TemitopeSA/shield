"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShield } from "@/lib/client/store";
import { Badge, Card, PageHeader, Segmented, Skeleton, WrapperBadge, cx } from "@/components/ui";
import { fmtMoney } from "@/lib/money";
import { fmtDateTime } from "@/lib/dates";

type Filter = "all" | "DEPOSIT" | "WITHDRAWAL" | "BUY" | "SELL" | "DIVIDEND" | "REJECTED";

export default function TransactionsPage() {
  const { state, partner } = useShield();
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    if (!state) return [];
    const accounts = state.accounts.filter((a) => partner === "all" || a.partner_id === partner);
    const txs = accounts.flatMap((a) => a.transactions.map((t) => ({ ...t, wrapper: a.wrapper, currency: a.currency, rejected: false, code: "" })));
    const rejected = accounts.flatMap((a) =>
      a.orders.filter((o) => o.status === "rejected").map((o) => ({ id: o.id, account_id: a.id, type: "BUY" as const, date: o.submitted_at, amount: -o.notional, description: `Rejected: buy ${o.qty} ${o.symbol}`, wrapper: a.wrapper, currency: a.currency, rejected: true, code: o.reject_code ?? "" })),
    );
    return [...txs, ...rejected].sort((x, y) => y.date.localeCompare(x.date));
  }, [state, partner]);
  const shown = rows.filter((r) => filter === "all" || (filter === "REJECTED" ? r.rejected : !r.rejected && r.type === filter)).slice(0, 300);
  return (
    <div className="px-4 sm:px-8 py-7 max-w-[1400px] mx-auto">
      <PageHeader title="Transactions" description="Ledger entries across wrapper accounts. Every entry passed the rule engine first; rejected orders never reached the ledger." />
      <div className="mb-4 overflow-x-auto">
        <Segmented value={filter} onChange={setFilter} options={(["all", "DEPOSIT", "WITHDRAWAL", "BUY", "SELL", "DIVIDEND", "REJECTED"] as Filter[]).map((f) => ({ id: f, label: f === "all" ? "All" : f[0] + f.slice(1).toLowerCase() }))} />
      </div>
      <Card>
        {!state ? <div className="p-4"><Skeleton className="h-40" /></div> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Account</th><th>Wrapper</th><th>Type</th><th>Description</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className={cx(t.rejected && "opacity-80")}>
                    <td className="text-fg-2 tnum">{fmtDateTime(t.date)}</td>
                    <td><Link href={`/accounts/${t.account_id}`} className="font-mono text-[12.5px] hover:underline">{t.account_id}</Link></td>
                    <td><WrapperBadge wrapper={t.wrapper} size="sm" /></td>
                    <td>{t.rejected ? <Badge tone="danger" mono>REJECTED</Badge> : <Badge tone={t.type === "DEPOSIT" || t.type === "DIVIDEND" ? "success" : t.type === "WITHDRAWAL" ? "warn" : "neutral"} mono>{t.type}</Badge>}</td>
                    <td className="text-fg-2">{t.description}{t.rejected && <span className="ml-2 font-mono text-[11px] text-danger">{t.code}</span>}</td>
                    <td className={cx("num font-medium", t.rejected ? "text-faint line-through" : t.amount >= 0 ? "text-success" : "")}>{fmtMoney(t.amount, t.currency, { decimals: 2, sign: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
