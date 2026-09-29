import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { taxLots } from "@/lib/service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/tax_lots">) {
  const { id } = await ctx.params;
  return handle(req, (s) => taxLots(s, id));
}
