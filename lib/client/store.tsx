"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShieldState } from "../types";
import { apiRequest, fetchState, onStateChange, resetState, type ApiCall } from "./api";

interface Toast {
  id: number;
  tone: "success" | "danger" | "info";
  title: string;
  body?: string;
}

interface ShieldCtx {
  state: ShieldState | null;
  ready: boolean;
  partner: string;
  setPartner: (p: string) => void;
  calls: ApiCall[];
  call: (method: string, path: string, body?: unknown) => Promise<ApiCall>;
  refresh: () => Promise<void>;
  reset: () => Promise<ShieldState>;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<ShieldCtx | null>(null);

export function ShieldProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShieldState | null>(null);
  const [partner, setPartnerState] = useState("all");
  const [calls, setCalls] = useState<ApiCall[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refresh = useCallback(async () => {
    await fetchState();
  }, []);

  useEffect(() => {
    let alive = true;
    // Every response that carries sandbox state flows through here.
    onStateChange((s) => alive && setState(s));
    fetchState().catch(() => undefined);
    try {
      const p = localStorage.getItem("shield.partner");
      if (p) queueMicrotask(() => setPartnerState(p));
    } catch {}
    return () => {
      alive = false;
    };
  }, []);

  const setPartner = useCallback((p: string) => {
    setPartnerState(p);
    try {
      localStorage.setItem("shield.partner", p);
    } catch {}
  }, []);

  const call = useCallback(
    async (method: string, path: string, body?: unknown) => {
      // The response carries the resulting sandbox state, so no second round-trip is needed.
      const c = await apiRequest(method, path, body);
      setCalls((xs) => [c, ...xs].slice(0, 30));
      return c;
    },
    [],
  );

  const reset = useCallback(async () => {
    const s = await resetState();
    setCalls([]);
    return s;
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((xs) => xs.filter((x) => x.id !== id)), []);

  const value = useMemo(
    () => ({ state, ready: !!state, partner, setPartner, calls, call, refresh, reset, toasts, toast, dismissToast }),
    [state, partner, setPartner, calls, call, refresh, reset, toasts, toast, dismissToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShield() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShield outside ShieldProvider");
  return c;
}
