import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { findAccount, findClient } from "@/lib/service";
import { getPack } from "@/lib/engine/packs";
import { estimateTax } from "@/lib/tax";
import { instrumentMap } from "@/lib/ledger";

// Transparent tax working for an account, as defined by its rule pack's tax model.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/tax">) {
  const { id } = await ctx.params;
  return handle(req, (s) => {
    const a = findAccount(s, id);
    const est = estimateTax(getPack(s, a.wrapper)!, a, findClient(s, a.client_id), instrumentMap(s));
    return { ...est, disclaimer: "Simplified tax calculation for demonstration — not tax advice." };
  });
}
