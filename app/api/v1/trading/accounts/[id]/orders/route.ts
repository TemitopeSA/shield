import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { findAccount, placeOrder } from "@/lib/service";
import { orderBody } from "@/lib/server/validation";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/trading/accounts/[id]/orders">) {
  const { id } = await ctx.params;
  return handle(req, (s) => [...findAccount(s, id).orders].reverse());
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/trading/accounts/[id]/orders">) {
  const { id } = await ctx.params;
  return handle(req, (s, body) => placeOrder(s, id, orderBody.parse(body)), 201);
}
