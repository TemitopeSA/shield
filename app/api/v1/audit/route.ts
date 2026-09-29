import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const account = q.get("account_id");
  const action = q.get("action");
  const limit = Math.min(Number(q.get("limit") ?? 100), 1000);
  return handle(req, (s) =>
    s.audit
      .filter((e) => (!account || e.account_id === account) && (!action || e.action === action))
      .slice(-limit)
      .reverse(),
  );
}
