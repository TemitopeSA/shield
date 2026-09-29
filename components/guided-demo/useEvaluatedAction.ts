"use client";
import { useCallback, useState } from "react";
import type { Evaluation } from "@/lib/types";
import type { ApiCall } from "@/lib/client/api";
import { useShield } from "@/lib/client/store";
import { useReveal } from "@/components/rules/Evaluation";

/** Runs an API call whose response carries a rule-engine evaluation, then reveals it rule by rule. */
export function useEvaluatedAction() {
  const { call } = useShield();
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [last, setLast] = useState<ApiCall | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const { revealed, done } = useReveal(evaluation);

  const run = useCallback(
    async (method: string, path: string, body?: unknown) => {
      setStatus("running");
      setEvaluation(null);
      const [c] = await Promise.all([call(method, path, body), new Promise((r) => setTimeout(r, 350))]);
      const ev = ((c.data as { evaluation?: Evaluation })?.evaluation ?? null) as Evaluation | null;
      setLast(c);
      setEvaluation(ev);
      setStatus("done");
      return c;
    },
    [call],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setLast(null);
    setEvaluation(null);
  }, []);

  return {
    status,
    call: last,
    evaluation,
    revealed,
    settled: status === "done" && (evaluation ? done : true),
    ok: !!last?.ok,
    data: last?.data as Record<string, unknown> | undefined,
    run,
    reset,
  };
}
