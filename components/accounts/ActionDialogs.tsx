"use client";
import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { useShield } from "@/lib/client/store";
import { accountDetail } from "@/lib/client/selectors";
import { localPrice, heldQty } from "@/lib/ledger";
import { fmtMoney } from "@/lib/money";
import type { Evaluation, RuleResult } from "@/lib/types";
import { Button, Field, Input, Modal, Segmented, Select } from "@/components/ui";
import { DecisionCard, RuleChecklist, SuccessCard, useReveal } from "@/components/rules/Evaluation";

type Outcome = { kind: "preview" | "submit"; ok: boolean; evaluation: Evaluation | null; failed: RuleResult | null; data: Record<string, unknown> };

function useRun() {
  const { call } = useShield();
  const [busy, setBusy] = useState<"preview" | "submit" | null>(null);
  const [out, setOut] = useState<Outcome | null>(null);
  const { revealed, done } = useReveal(out?.evaluation);
  const run = async (kind: "preview" | "submit", method: string, path: string, body: unknown) => {
    setBusy(kind);
    setOut(null);
    const c = await call(method, path, body);
    const d = c.data as Record<string, unknown>;
    const ev = (d?.evaluation ?? null) as Evaluation | null;
    const ok = kind === "preview" ? !!(d as { allowed?: boolean }).allowed : c.ok;
    setOut({ kind, ok, evaluation: ev, failed: ev?.failed ?? null, data: d });
    setBusy(null);
    return { ok, data: d };
  };
  return { busy, out, revealed, settled: !!out && (out.evaluation ? done : true), run, clear: () => setOut(null) };
}

export function TradeDialog({ accountId, open, onClose, initialSymbol }: { accountId: string; open: boolean; onClose: () => void; initialSymbol?: string }) {
  const { state, toast } = useShield();
  const d = state ? accountDetail(state, accountId) : null;
  const [symbol, setSymbol] = useState(initialSymbol ?? "TTE");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(10);
  const r = useRun();
  if (!d || !state) return null;
  const inst = d.instruments[symbol];
  const price = localPrice(inst, d.account.currency);
  const cur = d.account.currency;
  const body = { symbol, qty, side, type: "market" };

  const submit = async () => {
    const res = await r.run("submit", "POST", `/api/v1/trading/accounts/${accountId}/orders`, body);
    if (res.ok) toast({ tone: "success", title: "Order filled", body: `${side.toUpperCase()} ${qty} ${symbol} at ${fmtMoney(price, cur)}` });
  };

  return (
    <Modal open={open} onClose={() => (onClose(), r.clear())} title="Place order" description={`${accountId} · ${d.pack.name} · cash ${fmtMoney(d.valuation.cash, cur)}`} width={560}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="Instrument" htmlFor="t-sym">
            <Select id="t-sym" value={symbol} onChange={(e) => (setSymbol(e.target.value), r.clear())}>
              {state.instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>{i.symbol} — {i.name} {heldQty(d.account, i.symbol) ? `(held ${heldQty(d.account, i.symbol)})` : ""}</option>
              ))}
            </Select>
          </Field>
          <Segmented value={side} onChange={(v) => (setSide(v), r.clear())} options={[{ id: "buy", label: "Buy" }, { id: "sell", label: "Sell" }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" htmlFor="t-qty">
            <Input id="t-qty" type="number" min={1} value={qty} onChange={(e) => (setQty(Math.max(1, Math.floor(Number(e.target.value) || 1))), r.clear())} />
          </Field>
          <Field label="Market price">
            <Input readOnly value={fmtMoney(price, cur)} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-3 py-2.5 text-[13px]">
          <span className="text-muted">Estimated order value</span>
          <span className="font-semibold tnum">{fmtMoney(price * qty, cur)}</span>
        </div>
        {r.out && (
          <div className="rounded-xl border border-border bg-surface-2 p-2">
            <div className="px-3 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{r.out.kind === "preview" ? "Dry run · nothing was executed" : "Rule engine · pre_trade"}</div>
            <RuleChecklist evaluation={r.out.evaluation} revealed={r.revealed} />
          </div>
        )}
        {r.settled && r.out && !r.out.ok && r.out.failed && <DecisionCard title={r.out.kind === "preview" ? "This order would be rejected" : "Order rejected"} subtitle={r.out.failed.message} result={r.out.failed} currency={cur} />}
        {r.settled && r.out && !r.out.ok && !r.out.failed && <div className="rounded-lg bg-danger-soft text-danger text-[13px] px-3 py-2.5">{String(r.out.data?.message)}</div>}
        {r.settled && r.out?.ok && r.out.kind === "submit" && <SuccessCard title="Order filled" subtitle={`${qty} × ${fmtMoney(price, cur)} = ${fmtMoney(price * qty, cur)}`} />}
        {r.settled && r.out?.ok && r.out.kind === "preview" && <div className="rounded-lg bg-success-soft text-success text-[13px] px-3 py-2.5 font-medium">All rules pass — this order can be submitted.</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button icon={<FlaskConical className="size-3.5" />} loading={r.busy === "preview"} onClick={() => r.run("preview", "POST", "/api/v1/wrappers/simulate", { action: "order", account_id: accountId, ...body })}>
            Dry run
          </Button>
          <Button variant="primary" loading={r.busy === "submit"} onClick={submit}>
            Submit order
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TransferDialog({ accountId, open, onClose, direction: initialDirection = "INCOMING" }: { accountId: string; open: boolean; onClose: () => void; direction?: "INCOMING" | "OUTGOING" }) {
  const { state, toast } = useShield();
  const d = state ? accountDetail(state, accountId) : null;
  const [direction, setDirection] = useState<"INCOMING" | "OUTGOING">(initialDirection);
  const [amount, setAmount] = useState(1000);
  const [ack, setAck] = useState(false);
  const r = useRun();
  if (!d) return null;
  const cur = d.account.currency;
  const needsAck = r.out?.failed?.code === "EARLY_WITHDRAWAL_CLOSES_PLAN";
  const submit = async (acknowledge = ack) => {
    const res = await r.run("submit", "POST", `/api/v1/accounts/${accountId}/transfers`, { direction, amount, ...(direction === "OUTGOING" ? { acknowledge_early_exit: acknowledge } : {}) });
    if (res.ok) toast({ tone: "success", title: direction === "INCOMING" ? "Deposit accepted" : "Withdrawal completed", body: fmtMoney(amount, cur) });
  };
  const tax = r.out?.ok ? (r.out.data?.tax as { tax: number; closes_plan: boolean } | undefined) : undefined;
  return (
    <Modal open={open} onClose={() => (onClose(), r.clear(), setAck(false))} title={direction === "INCOMING" ? "Deposit funds" : "Withdraw funds"} description={`${accountId} · ${d.pack.name} · cash ${fmtMoney(d.valuation.cash, cur)}`}>
      <div className="space-y-4">
        <Segmented value={direction} onChange={(v) => (setDirection(v), r.clear())} options={[{ id: "INCOMING", label: "Deposit" }, { id: "OUTGOING", label: "Withdraw" }]} />
        <Field label="Amount" htmlFor="tr-amt">
          <Input id="tr-amt" type="number" min={1} prefix={cur === "EUR" ? "€" : cur} value={amount} onChange={(e) => (setAmount(Math.max(0, Number(e.target.value) || 0)), r.clear())} />
        </Field>
        {r.out && (
          <div className="rounded-xl border border-border bg-surface-2 p-2">
            <RuleChecklist evaluation={r.out.evaluation} revealed={r.revealed} />
          </div>
        )}
        {r.settled && r.out && !r.out.ok && r.out.failed && (
          <DecisionCard
            title={needsAck ? "Acknowledgement required" : "Transfer rejected"}
            subtitle={r.out.failed.message}
            result={r.out.failed}
            currency={cur}
            actions={
              needsAck && (
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="size-4 accent-[#121211]" />
                  The client understands this withdrawal closes the plan
                </label>
              )
            }
          />
        )}
        {r.settled && r.out?.ok && (
          <SuccessCard title={direction === "INCOMING" ? "Deposit accepted" : "Withdrawal completed"} subtitle={tax ? `Tax on the gain portion: ${fmtMoney(tax.tax, cur)}${tax.closes_plan ? " · the plan is now closed" : ""}` : fmtMoney(amount, cur)} />
        )}
        <div className="flex justify-end gap-2 pt-1">
          {r.settled && r.out?.ok ? (
            <Button variant="primary" onClick={() => (onClose(), r.clear(), setAck(false))}>Done</Button>
          ) : (
            <Button variant="primary" loading={!!r.busy} disabled={needsAck && !ack} onClick={() => submit()}>
              {direction === "INCOMING" ? "Submit deposit" : "Submit withdrawal"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
