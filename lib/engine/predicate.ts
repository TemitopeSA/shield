import type { Predicate } from "../types";

// A tiny, data-driven predicate language used by rule packs to describe
// eligibility (instruments, clients, tax brackets) without code.
export function evalPredicate(p: Predicate | undefined, subject: Record<string, unknown>): boolean {
  if (!p) return true;
  if ("all" in p) return p.all.every((q) => evalPredicate(q, subject));
  if ("any" in p) return p.any.some((q) => evalPredicate(q, subject));
  if ("not" in p) return !evalPredicate(p.not, subject);
  const actual = subject[p.field];
  const v = p.value;
  switch (p.op) {
    case "eq":
      return actual === v;
    case "neq":
      return actual !== v;
    case "in":
      return Array.isArray(v) && v.includes(actual);
    case "nin":
      return Array.isArray(v) && !v.includes(actual);
    case "lt":
      return typeof actual === "number" && actual < (v as number);
    case "lte":
      return typeof actual === "number" && actual <= (v as number);
    case "gt":
      return typeof actual === "number" && actual > (v as number);
    case "gte":
      return typeof actual === "number" && actual >= (v as number);
    case "has":
      return Array.isArray(actual) && actual.includes(v);
  }
}

// Human-readable rendering, used by the Rules and Rule Pack screens.
export function describePredicate(p: Predicate | undefined): string {
  if (!p) return "always";
  if ("all" in p) return p.all.map(describePredicate).join(" AND ");
  if ("any" in p) return p.any.map((q) => `(${describePredicate(q)})`).join(" OR ");
  if ("not" in p) return `NOT (${describePredicate(p.not)})`;
  const ops: Record<string, string> = { eq: "=", neq: "≠", in: "in", nin: "not in", lt: "<", lte: "≤", gt: ">", gte: "≥", has: "has" };
  const v = Array.isArray(p.value) ? (p.value.length > 6 ? `[${p.value.slice(0, 5).join(", ")}, … +${p.value.length - 5}]` : `[${p.value.join(", ")}]`) : String(p.value);
  return `${p.field} ${ops[p.op]} ${v}`;
}
