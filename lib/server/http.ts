import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { ShieldState } from "../types";
import { ShieldError } from "../service";
import { freshState, getSession, PUBLIC_SESSION, setSession } from "./store";

export const SESSION_HEADER = "x-shield-session";

export class RestoreRequired extends Error {}

export function sessionId(req: NextRequest): string {
  const sid = req.headers.get(SESSION_HEADER) ?? req.nextUrl.searchParams.get("session") ?? PUBLIC_SESSION;
  return sid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || PUBLIC_SESSION;
}

export function loadState(req: NextRequest): { sid: string; state: ShieldState } {
  const sid = sessionId(req);
  let state = getSession(sid);
  if (!state) {
    // The browser holds a snapshot of its sandbox; ask it to re-hydrate this instance.
    if (sid !== PUBLIC_SESSION && req.headers.get(SESSION_HEADER)) throw new RestoreRequired();
    state = freshState();
    setSession(sid, state);
  }
  return { sid, state };
}

export function errorResponse(e: unknown) {
  if (e instanceof RestoreRequired)
    return NextResponse.json({ code: "SESSION_RESTORE_REQUIRED", message: "This server instance has not seen your sandbox yet." }, { status: 409 });
  if (e instanceof ShieldError) return NextResponse.json(e.toJSON(), { status: e.status });
  if (e instanceof ZodError)
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "The request body is invalid.", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  if (e instanceof SyntaxError) return NextResponse.json({ code: "INVALID_JSON", message: "Request body is not valid JSON." }, { status: 400 });
  console.error(e);
  return NextResponse.json({ code: "INTERNAL_ERROR", message: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
}

/**
 * The console UI sends x-shield-soft-errors so expected business outcomes (a 422 rule
 * rejection, a 409 re-hydration request) don't surface as browser network errors.
 * The real status is preserved in x-shield-status; external API clients get real codes.
 */
export function soften(req: NextRequest, res: Response): Response {
  if (!req.headers.get("x-shield-soft-errors") || res.status < 400 || res.status >= 500) return res;
  const headers = new Headers(res.headers);
  headers.set("x-shield-status", String(res.status));
  return new Response(res.body, { status: 200, headers });
}

/** Run a handler against the caller's sandbox with uniform timing + error envelopes. */
export async function handle(req: NextRequest, fn: (state: ShieldState, body: unknown) => unknown | Promise<unknown>, status = 200) {
  const t0 = performance.now();
  try {
    const { state } = loadState(req);
    const body = req.method === "GET" ? undefined : await req.json().catch((e) => { if (req.headers.get("content-length") === "0") return {}; throw e; });
    const result = await fn(state, body);
    if (result instanceof Response) return result;
    return NextResponse.json(result, { status, headers: { "x-shield-duration-ms": (performance.now() - t0).toFixed(2) } });
  } catch (e) {
    const res = errorResponse(e);
    res.headers.set("x-shield-duration-ms", (performance.now() - t0).toFixed(2));
    return soften(req, res);
  }
}
