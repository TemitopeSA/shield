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

export function saveSnapshot(state: ShieldState) {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable or full — the server copy still works */
  }
}

function loadSnapshot(): ShieldState | undefined {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as ShieldState) : undefined;
  } catch {
    return undefined;
  }
}

async function restore(): Promise<ShieldState> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-shield-session": sessionId() },
    body: JSON.stringify({ snapshot: loadSnapshot() }),
  });
  return (await res.json()).state as ShieldState;
}

/** Real HTTP status, even when the server softened it for the console UI. */
export const statusOf = (res: Response) => Number(res.headers.get("x-shield-status") ?? res.status);

async function raw(method: string, path: string, body?: unknown): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-shield-session": sessionId(), "x-shield-soft-errors": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let res = await fetch(path, init);
  if (statusOf(res) === 409) {
    const j = await res.clone().json().catch(() => ({}));
    if (j.code === "SESSION_RESTORE_REQUIRED") {
      await restore();
      res = await fetch(path, init);
    }
  }
  return res;
}

export async function apiRequest(method: string, path: string, body?: unknown): Promise<ApiCall> {
  const t0 = performance.now();
  const res = await raw(method, path, body);
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.text();
  const status = statusOf(res);
  return { id: ++counter, method, path, body, status, ok: status < 400, data, ms: Math.round(performance.now() - t0), at: new Date().toISOString() };
}

export async function fetchState(): Promise<ShieldState> {
  const res = await raw("GET", "/api/session");
  return (await res.json()) as ShieldState;
}

export async function resetState(): Promise<ShieldState> {
  const res = await raw("POST", "/api/session/reset");
  return (await res.json()) as ShieldState;
}

export async function downloadFile(path: string, filename: string) {
  const res = await raw("GET", path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
