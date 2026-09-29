import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { BUILTIN_PACKS } from "@/lib/engine/packs";

const WRAPPERS = ["PEA", "ISK", "PIR"].map((w) => BUILTIN_PACKS.find((b) => b.pack.wrapper === w)!.pack);
const COLORS: Record<string, string> = { PEA: "#2f5bea", ISK: "#0b7f86", PIR: "#1f8a4c" };

export default function Welcome() {
  return (
    <div className="min-h-screen flex flex-col bg-bg relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_50%_20%,black,transparent_70%)] opacity-60" />
      <header className="relative h-16 flex items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">Shield</span>
          <span className="hidden sm:inline text-[11px] text-muted border border-border rounded px-1.5 py-0.5 ml-1">Prototype · EU Wrapper Infrastructure</span>
        </div>
        <Link href="/dashboard" className="text-[13px] font-medium text-fg-2 hover:text-fg">
          Console →
        </Link>
      </header>

      <main className="relative flex-1 flex flex-col items-center px-5 pt-10 sm:pt-16 pb-16">
        <div className="inline-flex items-center gap-2 h-7 pl-1 pr-3 rounded-full bg-surface border border-border text-[12px] font-medium shadow-(--shadow-card) anim-rise">
          <span className="h-5 px-2 rounded-full bg-brand text-ink text-[10.5px] font-semibold flex items-center">NEW</span>
          EU Wrapper Engine for broker APIs
        </div>
        <h1 className="mt-6 text-center text-[40px] sm:text-[58px] font-semibold tracking-[-0.045em] leading-[1.02] max-w-[820px] anim-rise" style={{ animationDelay: "60ms" }}>
          Launch tax-advantaged investing across Europe.
        </h1>
        <p className="mt-5 text-center text-[16px] sm:text-[17px] text-muted max-w-[620px] leading-relaxed anim-rise" style={{ animationDelay: "120ms" }}>
          Give your brokerage platform native support for local investment wrappers — without building each country&apos;s tax logic from scratch.
        </p>
        <div className="mt-6 flex items-center gap-2 text-[13px] font-medium text-fg-2 anim-rise" style={{ animationDelay: "160ms" }}>
          <span className="px-2.5 py-1 rounded-md bg-surface border border-border">3 wrappers</span>
          <span className="text-faint">·</span>
          <span className="px-2.5 py-1 rounded-md bg-surface border border-border">1 rules engine</span>
          <span className="text-faint">·</span>
          <span className="px-2.5 py-1 rounded-md bg-surface border border-border">1 API</span>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 anim-rise" style={{ animationDelay: "220ms" }}>
          <Link href="/demo?start=1" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-ink text-white text-[14px] font-medium hover:bg-[#2a2a28] shadow-[0_8px_24px_-8px_rgba(18,18,17,0.5)]">
            <PlayCircle className="size-4 text-brand" /> Explore the demo
          </Link>
          <Link href="/dashboard" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-surface border border-border text-[14px] font-medium hover:border-border-strong">
            Skip to dashboard <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-16 w-full max-w-[980px] grid md:grid-cols-[1.1fr_1fr] gap-4 anim-rise" style={{ animationDelay: "300ms" }}>
          <div className="rounded-2xl bg-[#141413] text-[#e8e7e2] p-5 font-mono text-[12.5px] leading-[1.7] shadow-(--shadow-pop) overflow-x-auto">
            <div className="text-[#8d8c86]">{"// One API. The wrapper is one field."}</div>
            <div>
              <span className="text-brand">POST</span> /v1/accounts
            </div>
            <div>{"{"}</div>
            <div className="pl-4"><span className="text-[#d7a6ff]">&quot;client_id&quot;</span>: <span className="text-[#8fe0b8]">&quot;client_001&quot;</span>,</div>
            <div className="bg-brand/10 -mx-2 pl-6 pr-2 rounded"><span className="text-[#d7a6ff]">&quot;wrapper_type&quot;</span>: <span className="text-[#8fe0b8]">&quot;PEA&quot;</span>,</div>
            <div className="pl-4"><span className="text-[#d7a6ff]">&quot;tax_residency&quot;</span>: <span className="text-[#8fe0b8]">&quot;FR&quot;</span></div>
            <div>{"}"}</div>
            <div className="mt-3 text-[#8d8c86]">{"// → rule pack pea.json: eligibility, limits, tax lots,"}</div>
            <div className="text-[#8d8c86]">{"//   compliance checks, tax and reporting — handled."}</div>
          </div>
          <div className="grid gap-3">
            {WRAPPERS.map((p) => (
              <div key={p.wrapper} className="rounded-xl bg-surface border border-border px-4 py-3.5 flex items-center gap-4 shadow-(--shadow-card)">
                <span className="text-[18px] font-semibold tracking-[-0.03em] w-12" style={{ color: COLORS[p.wrapper] }}>{p.wrapper}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{p.full_name} · {p.country_name}</div>
                  <div className="text-[12px] text-muted truncate">{p.highlights.join(" · ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <footer className="relative text-center text-[11.5px] text-faint px-5 pb-6">
        Prototype concept for a broker API — not an official Alpaca product. Fictional partners and clients. Tax rules are simplified for demonstration and are not tax advice.
      </footer>
    </div>
  );
}
