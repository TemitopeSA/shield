import { z } from "zod";
import type { Predicate } from "../types";

const predicate: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(predicate) }),
    z.object({ any: z.array(predicate) }),
    z.object({ not: predicate }),
    z.object({
      field: z.string(),
      op: z.enum(["eq", "neq", "in", "nin", "lt", "lte", "gt", "gte", "has"]),
      value: z.unknown(),
    }),
  ]),
) as z.ZodType<Predicate>;

export const stageSchema = z.enum(["account_opening", "pre_trade", "pre_transfer", "pre_withdrawal", "compliance"]);

export const ruleSchema = z.object({
  id: z.string().regex(/^[A-Z0-9_]+$/, "Rule ids are UPPER_SNAKE_CASE"),
  name: z.string().min(1),
  stages: z.array(stageSchema).min(1),
  kind: z.string(),
  params: z.record(z.string(), z.unknown()),
  error_code: z.string().regex(/^[A-Z0-9_]+$/),
  message: z.string(),
  explain: z.string(),
});

export const rulePackSchema = z.object({
  wrapper: z.string().regex(/^[A-Z0-9_]+$/),
  name: z.string(),
  full_name: z.string(),
  country: z.string().length(2),
  country_name: z.string(),
  currency: z.string().length(3),
  version: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  plan: z.object({ holding_period_years: z.number().optional() }),
  rules: z.array(ruleSchema).min(1),
  tax: z.object({ model: z.string(), params: z.record(z.string(), z.unknown()) }),
  reporting: z.object({ format: z.string(), name: z.string(), reference: z.string() }),
});

export { predicate as predicateSchema };
