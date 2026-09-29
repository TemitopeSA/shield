import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { simulate } from "@/lib/service";
import { simulateBody } from "@/lib/server/validation";

// Dry run: evaluates the request against a disposable copy of the sandbox.
export async function POST(req: NextRequest) {
  return handle(req, (s, body) => simulate(s, simulateBody.parse(body)));
}
