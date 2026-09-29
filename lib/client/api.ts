"use client";
import type { ShieldState } from "../types";

const SID_KEY = "shield.session";
const SNAP_KEY = "shield.snapshot";

export interface ApiCall {
  id: number;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  ok: boolean;
  data: unknown;
  ms: number;
  at: string;
}

let counter = 0;

// The browser's copy of its sandbox is authoritative for this reviewer. Every request
// carries its version; a server instance holding a different version answers 409 and
// is re-hydrated from this copy (or, if it is ahead, hands back its newer state).
let current: ShieldState | null = null;
let listener: ((s: ShieldState) => void) | null = null;

export function onStateChange(fn: (s: ShieldState) => void) {
  listener = fn;
}

function adopt(s: ShieldState) {
  current = s;
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable or full — the in-memory copy still works */
  }
  listener?.(s);
}

export function sessionId(): string {
  try {
    let sid = localStorage.getItem(SID_KEY);
    if (!sid) {
      sid = `sbx_${crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 16)}`;
      localStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "public";
  }
}

function loadSnapshot(): ShieldState | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as ShieldState) : null;
  } catch {
    return null;
  }
}

const versionOf = (s: ShieldState) => `${s.seeded_at}:${s.seq}`;

function headers(): Record<string, string> {
  current ??= loadSnapshot();
  return {
    "content-type": "application/json",
    "x-shield-session": sessionId(),
    "x-shield-soft-errors": "1",
    "x-shield-include-state": "1",
    ...(current ? { "x-shield-version": versionOf(current) } : {}),
  };
}

async function restore() {
  current ??= loadSnapshot();
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-shield-session": sessionId() },
    body: JSON.stringify({ snapshot: current }),
  });
  adopt((await res.json()).state as ShieldState);
}

/** Real HTTP status, even when the server softened it for the console UI. */
export const statusOf = (res: Response) => Number(res.headers.get("x-shield-status") ?? res.status);

async function raw(method: string, path: string, body?: unknown): Promise<Response> {
  const send = () => fetch(path, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
  let res = await send();
  for (let attempt = 0; attempt < 2 && statusOf(res) === 409; attempt++) {
    const j = await res.clone().json().catch(() => ({}));
    if (j.code !== "SESSION_RESTORE_REQUIRED") break;
    await restore();
    res = await send();
  }
  return res;
}

export async function apiRequest(method: string, path: string, body?: unknown): Promise<ApiCall> {
  const t0 = performance.now();
  const res = await raw(method, path, body);
  const type = res.headers.get("content-type") ?? "";
  let data: unknown = type.includes("json") ? await res.json() : await res.text();
  if (data && typeof data === "object" && "_state" in data) {
    const { _state, ...rest } = data as { _state: ShieldState };
    adopt(_state);
    data = rest;
  }
  const status = statusOf(res);
  return { id: ++counter, method, path, body, status, ok: status < 400, data, ms: Math.round(performance.now() - t0), at: new Date().toISOString() };
}

export async function fetchState(): Promise<ShieldState> {
  const res = await raw("GET", "/api/session");
  const s = (await res.json()) as ShieldState;
  adopt(s);
  return s;
}

export async function resetState(): Promise<ShieldState> {
  const res = await fetch("/api/session/reset", { method: "POST", headers: { "x-shield-session": sessionId() } });
  const s = (await res.json()) as ShieldState;
  adopt(s);
  return s;
}

/** Downloads go through the API too (report generation is audited), then resync. */
export async function downloadFile(path: string, filename: string) {
  const res = await raw("GET", path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await fetchState().catch(() => undefined);
}
