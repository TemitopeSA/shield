"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShieldState } from "../types";
import { apiRequest, fetchState, resetState, saveSnapshot, type ApiCall } from "./api";

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

  const apply = useCallback((s: ShieldState) => {
    setState(s);
    saveSnapshot(s);
  }, []);

  const refresh = useCallback(async () => {
    apply(await fetchState());
  }, [apply]);

  useEffect(() => {
    let alive = true;
    fetchState().then((s) => alive && apply(s));
    try {
      const p = localStorage.getItem("shield.partner");
      if (p) queueMicrotask(() => setPartnerState(p));
    } catch {}
    return () => {
      alive = false;
    };
  }, [apply]);

  const setPartner = useCallback((p: string) => {
    setPartnerState(p);
    try {
      localStorage.setItem("shield.partner", p);
    } catch {}
  }, []);

  const call = useCallback(
    async (method: string, path: string, body?: unknown) => {
      const c = await apiRequest(method, path, body);
      setCalls((xs) => [c, ...xs].slice(0, 30));
      // Any API call may write audit events (rejections, reports), so resync the sandbox.
      const readOnly = /\/(simulate|validate)$/.test(path);
      if ((method !== "GET" && !readOnly) || path.includes("/reports/")) await refresh();
      return c;
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    const s = await resetState();
    apply(s);
    setCalls([]);
    return s;
  }, [apply]);

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
