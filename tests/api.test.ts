import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import * as accounts from "@/app/api/v1/accounts/route";
import * as orders from "@/app/api/v1/trading/accounts/[id]/orders/route";
import * as transfers from "@/app/api/v1/accounts/[id]/transfers/route";
import * as simulateRoute from "@/app/api/v1/wrappers/simulate/route";
import * as report from "@/app/api/v1/accounts/[id]/reports/[year]/route";
import * as session from "@/app/api/session/route";
import { freshState, setSession, getSession } from "@/lib/server/store";
import { versionOf } from "@/lib/server/http";
import type { ShieldState } from "@/lib/types";

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://test${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json", ...headers } });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) }) as never;

describe("HTTP contract", () => {
  it("public sandbox: rule rejection is a 422 with a structured body", async () => {
    const res = await orders.POST(req("POST", "/api/v1/trading/accounts/PEA-20417/orders", { symbol: "AAPL", qty: 10, side: "buy" }), ctx({ id: "PEA-20417" }));
    expect(res.status).toBe(422);
    const j = await res.json();
    expect(j).toMatchObject({ code: "INSTRUMENT_NOT_ELIGIBLE", rule_id: "PEA_ELIGIBLE_UNIVERSE" });
    expect(j.evaluation.results.length).toBeGreaterThan(0);
  });

  it("validation errors are 400 with issues", async () => {
    const res = await orders.POST(req("POST", "/api/v1/trading/accounts/PEA-20417/orders", { symbol: "TTE", qty: -1, side: "buy" }), ctx({ id: "PEA-20417" }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("VALIDATION_ERROR");
  });

  it("invalid JSON is a 400", async () => {
    const r = new NextRequest("http://test/api/v1/accounts", { method: "POST", body: "{nope", headers: { "content-type": "application/json" } });
    expect((await accounts.POST(r)).status).toBe(400);
  });

  it("unknown account is a 404", async () => {
    const res = await transfers.POST(req("POST", "/x", { direction: "INCOMING", amount: 1 }), ctx({ id: "NOPE-1" }));
    expect(res.status).toBe(404);
  });

  it("accepted order is a 201", async () => {
    const res = await orders.POST(req("POST", "/x", { symbol: "TTE", qty: 1, side: "buy" }), ctx({ id: "PEA-20417" }));
    expect(res.status).toBe(201);
  });

  it("reports export CSV", async () => {
    const res = await report.GET(req("GET", "/api/v1/accounts/ISK-10482/reports/2026?format=csv"), ctx({ id: "ISK-10482", year: "2026" }));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("Simplified format for demonstration");
  });

  it("soft errors keep the real status in a header for the console", async () => {
    const res = await orders.POST(req("POST", "/x", { symbol: "AAPL", qty: 1, side: "buy" }, { "x-shield-soft-errors": "1" }), ctx({ id: "PEA-20417" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-shield-status")).toBe("422");
  });
});

describe("sandbox sync across serverless instances", () => {
  const sid = `test_${Date.now()}`;
  const H = (s?: ShieldState) => ({ "x-shield-session": sid, "x-shield-include-state": "1", ...(s ? { "x-shield-version": versionOf(s) } : {}) });

  it("an instance that has never seen the session asks for a restore", async () => {
    const res = await accounts.GET(req("GET", "/api/v1/accounts", undefined, H()));
    expect(res.status).toBe(409);
  });

  it("restores, then returns the resulting state with each mutation", async () => {
    const snap = freshState();
    const r = await session.POST(req("POST", "/api/session", { snapshot: snap }, { "x-shield-session": sid }));
    expect((await r.json()).restored).toBe(true);
    const res = await transfers.POST(req("POST", "/x", { direction: "INCOMING", amount: 5000 }, H(snap)), ctx({ id: "PEA-20417" }));
    expect(res.status).toBe(201);
    const j = await res.json();
    expect(j._state.seq).toBeGreaterThan(snap.seq);
    expect(res.headers.get("x-shield-version")).toBe(versionOf(j._state));
    // Rejections advance the version too (they are audited).
    const again = await transfers.POST(req("POST", "/x", { direction: "INCOMING", amount: 5000 }, H(j._state)), ctx({ id: "PEA-20417" }));
    expect(again.status).toBe(422);
    expect((await again.json())._state.seq).toBeGreaterThan(j._state.seq);
  });

  it("a stale instance refuses to act, then adopts the newer browser copy", async () => {
    const newer = structuredClone(getSession(sid)!);
    const stale = freshState();
    stale.seeded_at = newer.seeded_at;
    setSession(sid, stale); // simulate a different, older instance
    const res = await accounts.GET(req("GET", "/api/v1/accounts", undefined, H(newer)));
    expect(res.status).toBe(409);
    const r = await (await session.POST(req("POST", "/api/session", { snapshot: newer }, { "x-shield-session": sid }))).json();
    expect(r.restored).toBe(true);
    expect(getSession(sid)!.seq).toBe(newer.seq);
  });

  it("an instance that is ahead keeps its state and hands it back", async () => {
    const ahead = getSession(sid)!;
    const older = structuredClone(ahead);
    older.seq -= 5;
    const r = await (await session.POST(req("POST", "/api/session", { snapshot: older }, { "x-shield-session": sid }))).json();
    expect(r.restored).toBe(false);
    expect(r.state.seq).toBe(ahead.seq);
  });

  it("dry runs never change the version", async () => {
    const s = getSession(sid)!;
    const res = await simulateRoute.POST(req("POST", "/x", { action: "order", account_id: "PEA-20417", symbol: "AAPL", qty: 1, side: "buy" }, H(s)));
    const j = await res.json();
    expect(j.allowed).toBe(false);
    expect(j._state).toBeUndefined();
    expect(getSession(sid)!.seq).toBe(s.seq);
  });
});
