import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, loadState, sessionId, soften } from "@/lib/server/http";
import { freshState, setSession } from "@/lib/server/store";
import type { ShieldState } from "@/lib/types";

// Internal endpoints used by the console UI to read and re-hydrate its sandbox.
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(loadState(req).state);
  } catch (e) {
    return soften(req, errorResponse(e));
  }
}

export async function POST(req: NextRequest) {
  const sid = sessionId(req);
  const body = (await req.json().catch(() => ({}))) as { snapshot?: ShieldState };
  const snap = body.snapshot;
  const valid = snap && snap.version === 1 && Array.isArray(snap.accounts) && Array.isArray(snap.audit) && Array.isArray(snap.instruments);
  const state = valid ? snap : freshState();
  setSession(sid, state);
  return NextResponse.json({ restored: !!valid, state });
}
