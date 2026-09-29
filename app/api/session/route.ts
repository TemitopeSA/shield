import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, isNewerOrEqual, loadState, sessionId, soften, VERSION_HEADER, versionOf } from "@/lib/server/http";
import { freshState, getSession, setSession } from "@/lib/server/store";
import type { ShieldState } from "@/lib/types";

// Internal endpoints used by the console UI to read and re-hydrate its sandbox.
export async function GET(req: NextRequest) {
  try {
    const { state } = loadState(req);
    return NextResponse.json(state, { headers: { [VERSION_HEADER]: versionOf(state) } });
  } catch (e) {
    return soften(req, errorResponse(e));
  }
}

/**
 * Re-hydrate this instance from the browser's snapshot. The newest copy wins:
 * a stale instance adopts the snapshot; if this instance is ahead (e.g. another tab
 * acted), it keeps its state and returns it so the browser can catch up.
 */
export async function POST(req: NextRequest) {
  const sid = sessionId(req);
  const body = (await req.json().catch(() => ({}))) as { snapshot?: ShieldState };
  const snap = body.snapshot;
  const valid = !!snap && snap.version === 1 && Array.isArray(snap.accounts) && Array.isArray(snap.audit) && Array.isArray(snap.instruments) && typeof snap.seq === "number";
  const current = getSession(sid);
  let state: ShieldState;
  if (valid && (!current || isNewerOrEqual(snap, current))) state = snap;
  else state = current ?? freshState();
  setSession(sid, state);
  return NextResponse.json({ restored: state === snap, state }, { headers: { [VERSION_HEADER]: versionOf(state) } });
}
