import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { validatePack } from "@/lib/service";

export async function POST(req: NextRequest) {
  return handle(req, (_s, body) => {
    const v = validatePack((body as { pack?: unknown })?.pack ?? body);
    return v.valid ? { valid: true, summary: v.summary } : v;
  });
}
