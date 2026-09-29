import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { accountView, createAccount } from "@/lib/service";
import { createAccountBody } from "@/lib/server/validation";

export async function GET(req: NextRequest) {
  const wrapper = req.nextUrl.searchParams.get("wrapper_type");
  const partner = req.nextUrl.searchParams.get("partner_id");
  return handle(req, (s) =>
    s.accounts
      .filter((a) => (!wrapper || a.wrapper === wrapper.toUpperCase()) && (!partner || a.partner_id === partner))
      .map((a) => accountView(s, a)),
  );
}

export async function POST(req: NextRequest) {
  return handle(req, (s, body) => createAccount(s, createAccountBody.parse(body)), 201);
}
