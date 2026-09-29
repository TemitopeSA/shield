import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { wrapperSummary } from "@/lib/service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/wrapper">) {
  const { id } = await ctx.params;
  return handle(req, (s) => wrapperSummary(s, id));
}
