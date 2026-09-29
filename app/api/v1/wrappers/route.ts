import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { activateWrapper } from "@/lib/service";
import { allPacks, packFile } from "@/lib/engine/packs";

export async function GET(req: NextRequest) {
  return handle(req, (s) =>
    allPacks(s).map((p) => ({
      wrapper: p.wrapper,
      name: p.name,
      country: p.country,
      currency: p.currency,
      version: p.version,
      file: packFile(p.wrapper),
      rules: p.rules.length,
      active: s.active_wrappers.includes(p.wrapper),
    })),
  );
}

/** Activate a wrapper by submitting its rule pack. */
export async function POST(req: NextRequest) {
  return handle(req, (s, body) => activateWrapper(s, (body as { pack?: unknown })?.pack ?? body), 201);
}
