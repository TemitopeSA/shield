import { z } from "zod";

const iso2 = z.string().length(2).transform((s) => s.toUpperCase());

export const createAccountBody = z.object({
  client_id: z.string().min(1).optional(),
  client_name: z.string().min(1).optional(),
  partner_id: z.string().optional(),
  wrapper_type: z.string().min(2).transform((s) => s.toUpperCase().replace("-", "_")),
  tax_residency: iso2.optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  initial_deposit: z.number().nonnegative().optional(),
});

export const transferBody = z.object({
  direction: z.enum(["INCOMING", "OUTGOING"]),
  amount: z.number().positive(),
  acknowledge_early_exit: z.boolean().optional(),
});

export const orderBody = z.object({
  symbol: z.string().min(1).transform((s) => s.toUpperCase()),
  qty: z.number().int().positive(),
  side: z.enum(["buy", "sell"]),
  type: z.literal("market").optional().default("market"),
});

export const simulateBody = z.discriminatedUnion("action", [
  createAccountBody.extend({ action: z.literal("open_account") }),
  orderBody.extend({ action: z.literal("order"), account_id: z.string() }),
  z.object({ action: z.literal("deposit"), account_id: z.string(), amount: z.number().positive() }),
  z.object({
    action: z.literal("withdrawal"),
    account_id: z.string(),
    amount: z.number().positive(),
    date: z.string().optional(),
    assumed_return: z.number().min(-0.5).max(0.5).optional(),
    acknowledge_early_exit: z.boolean().optional(),
  }),
]);
