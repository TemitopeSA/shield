import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { findAccount, transfer } from "@/lib/service";
import { transferBody } from "@/lib/server/validation";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/transfers">) {
  const { id } = await ctx.params;
  return handle(req, (s) => findAccount(s, id).transactions.filter((t) => t.type === "DEPOSIT" || t.type === "WITHDRAWAL"));
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/transfers">) {
  const { id } = await ctx.params;
  return handle(req, (s, body) => transfer(s, id, transferBody.parse(body)), 201);
}
