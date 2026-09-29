import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { accountView, findAccount } from "@/lib/service";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]">) {
  const { id } = await ctx.params;
  return handle(req, (s) => accountView(s, findAccount(s, id)));
}
