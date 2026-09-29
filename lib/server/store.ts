import type { ShieldState } from "../types";
import { seedState } from "../seed";

// In-memory session store. Each browser gets its own sandbox (keyed by the
// x-shield-session header) so reviewers never see each other's actions.
// Serverless instances are ephemeral, so the browser keeps a snapshot and
// re-hydrates the server when an instance has never seen its session.

const MAX_SESSIONS = 300;

type Store = { sessions: Map<string, ShieldState>; seed?: ShieldState };
const g = globalThis as unknown as { __shieldStore?: Store };
const store: Store = (g.__shieldStore ??= { sessions: new Map() });

export function freshState(): ShieldState {
  store.seed ??= seedState();
  const s = structuredClone(store.seed);
  s.seeded_at = new Date().toISOString();
  return s;
}

export function getSession(sid: string): ShieldState | undefined {
  const s = store.sessions.get(sid);
  if (s) {
    store.sessions.delete(sid);
    store.sessions.set(sid, s); // LRU touch
  }
  return s;
}

export function setSession(sid: string, state: ShieldState) {
  store.sessions.set(sid, state);
  while (store.sessions.size > MAX_SESSIONS) store.sessions.delete(store.sessions.keys().next().value!);
}

export const PUBLIC_SESSION = "public";
