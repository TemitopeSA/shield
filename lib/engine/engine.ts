import type { Evaluation, RuleDef, RuleResult, Stage } from "../types";
import { CORE_PACK } from "./packs";
import { EVALUATORS, type EvalContext } from "./evaluators";

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * wrapper_type → rule pack → rule evaluator → evaluation result.
 *
 * The engine selects every rule (core + wrapper pack) registered for a stage,
 * dispatches each one to its generic evaluator and aggregates the outcome.
 * Every rule is evaluated, even after a failure, so the full decision is explainable.
 */
export function evaluate(stage: Stage, ctx: EvalContext, id: string): Evaluation {
  const t0 = now();
  const rules: RuleDef[] = [...CORE_PACK.rules, ...ctx.pack.rules].filter((r) => r.stages.includes(stage));
  const results: RuleResult[] = rules.map((rule) => {
    const r0 = now();
    const evaluator = EVALUATORS[rule.kind];
    const base = { wrapper: ctx.pack.name };
    if (!evaluator) {
      return {
        rule_id: rule.id,
        name: fill(rule.name, base),
        kind: rule.kind,
        outcome: "FAIL" as const,
        code: "UNSUPPORTED_RULE_KIND",
        message: `No evaluator registered for kind "${rule.kind}".`,
        explain: rule.explain,
        details: {},
        duration_ms: now() - r0,
      };
    }
    const out = evaluator(rule, ctx);
    const vars = { ...base, ...(out.vars ?? {}) };
    return {
      rule_id: rule.id,
      name: fill(rule.name, vars),
      kind: rule.kind,
      outcome: out.outcome,
      code: out.outcome === "FAIL" || out.outcome === "WARN" ? rule.error_code : "OK",
      message: out.outcome === "PASS" || out.outcome === "SKIP" ? fill(rule.name, vars) : fill(rule.message, vars),
      explain: rule.explain,
      details: out.details ?? {},
      duration_ms: Math.round((now() - r0) * 1000) / 1000,
    };
  });
  const failed = results.find((r) => r.outcome === "FAIL") ?? null;
  return {
    id,
    stage,
    wrapper: ctx.pack.wrapper,
    account_id: ctx.account?.id,
    allowed: !failed,
    results,
    failed,
    warnings: results.filter((r) => r.outcome === "WARN"),
    duration_ms: Math.round((now() - t0) * 1000) / 1000,
    evaluated_at: ctx.now.toISOString(),
  };
}
