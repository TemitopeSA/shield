"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Calculator,
  ChevronDown,
  CircleCheck,
  Code2,
  FileText,
  Layers,
  LayoutDashboard,
  ListChecks,
  Menu,
  PlayCircle,
  ScrollText,
  Search,
  Settings,
  ArrowLeftRight,
  Wallet,
  X,
  CircleAlert,
  Info,
} from "lucide-react";
import { useShield } from "@/lib/client/store";
import { activePacks, accountRows } from "@/lib/client/selectors";
import { Badge, Kbd, cx, wrapperColor, LinkButton } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { Logo } from "./Logo";

interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  dot?: string;
  match?: (path: string, search: URLSearchParams) => boolean;
}

function useNav(): { title?: string; items: NavItem[] }[] {
  const { state } = useShield();
  const wrappers = state ? activePacks(state) : [];
  return [
    { items: [{ href: "/dashboard", label: "Overview", icon: <LayoutDashboard /> }] },
    {
      title: "Accounts",
      items: [
        { href: "/accounts", label: "All accounts", icon: <Wallet />, match: (p, s) => (p === "/accounts" && !s.get("wrapper")) || p.startsWith("/accounts/") },
        ...wrappers.map((w) => ({
          href: `/accounts?wrapper=${w.wrapper}`,
          label: w.name,
          dot: wrapperColor(w.wrapper),
          match: (p: string, s: URLSearchParams) => p === "/accounts" && s.get("wrapper") === w.wrapper,
        })),
      ],
    },
    { items: [{ href: "/transactions", label: "Transactions", icon: <ArrowLeftRight /> }] },
    {
      title: "Compliance",
      items: [
        { href: "/compliance/rules", label: "Rules", icon: <ListChecks /> },
        { href: "/compliance/audit", label: "Audit log", icon: <ScrollText /> },
      ],
    },
    {
      title: "Developer",
      items: [
        { href: "/developer/playground", label: "API Playground", icon: <Code2 /> },
        { href: "/developer/rule-packs", label: "Rule Packs", icon: <Layers /> },
      ],
    },
    {
      title: "Tax",
      items: [
        { href: "/tax/simulator", label: "Simulator", icon: <Calculator /> },
        { href: "/tax/reports", label: "Reports", icon: <FileText /> },
      ],
    },
  ];
}

// Query params (e.g. ?wrapper=PEA) only refine which item is highlighted, so they are read
// inside a small Suspense boundary and the rest of the shell can be server-rendered.
function Sidebar(props: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<SidebarNav {...props} search={EMPTY} />}>
      <SidebarWithSearch {...props} />
    </Suspense>
  );
}

const EMPTY = new URLSearchParams();

function SidebarWithSearch(props: { onNavigate?: () => void }) {
  const search = useSearchParams();
  return <SidebarNav {...props} search={search} />;
}

function SidebarNav({ onNavigate, search }: { onNavigate?: () => void; search: URLSearchParams }) {
  const nav = useNav();
  const path = usePathname();
  const isActive = (i: NavItem) => (i.match ? i.match(path, search as URLSearchParams) : path === i.href || path.startsWith(i.href + "/"));
  return (
    <nav className="flex flex-col h-full" aria-label="Main">
      <div className="h-14 flex items-center gap-2.5 px-4 shrink-0">
        <Link href="/" className="flex items-center gap-2.5 rounded-md" onClick={onNavigate}>
          <Logo />
          <div className="leading-none">
            <div className="text-[14.5px] font-semibold tracking-[-0.02em]">Shield</div>
            <div className="text-[10.5px] text-muted mt-1 font-medium whitespace-nowrap">EU Wrapper Engine · Broker API</div>
          </div>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2.5 pb-3">
        {nav.map((g, gi) => (
          <div key={gi} className={cx(gi > 0 && "mt-4")}>
            {g.title && <div className="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">{g.title}</div>}
            {g.items.map((i) => {
              const active = isActive(i);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] font-medium transition-colors",
                    active ? "bg-sunken text-fg" : "text-fg-2 hover:bg-sunken/70 hover:text-fg",
                    i.dot && "pl-[34px]",
                  )}
                >
                  {i.icon && <span className={cx("[&>svg]:size-[15px] [&>svg]:stroke-[1.8]", active ? "text-fg" : "text-muted group-hover:text-fg-2")}>{i.icon}</span>}
                  {i.dot && <span className="size-1.5 rounded-[2px] -ml-4.5 mr-1" style={{ background: i.dot }} />}
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-border p-2.5 space-y-0.5">
        <Link href="/demo" onClick={onNavigate} className={cx("flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] font-medium", path === "/demo" ? "bg-brand-soft text-fg" : "text-fg-2 hover:bg-sunken")}>
          <PlayCircle className="size-[15px] text-[#a88600]" /> Demo mode
        </Link>
        <Link href="/settings" onClick={onNavigate} className={cx("flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] font-medium", path === "/settings" ? "bg-sunken text-fg" : "text-fg-2 hover:bg-sunken")}>
          <Settings className="size-[15px] text-muted" /> Settings
        </Link>
        <div className="px-2.5 pt-2 text-[10.5px] leading-snug text-faint">Prototype · EU Wrapper Infrastructure</div>
      </div>
    </nav>
  );
}

function PartnerSwitcher() {
  const { state, partner, setPartner } = useShield();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const current = state?.partners.find((p) => p.id === partner);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Partner: ${current?.name ?? "All partners"}`} className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 rounded-lg border border-border bg-surface hover:border-border-strong text-[13px] font-medium">
        <span className={cx("size-5 rounded-md flex items-center justify-center text-[10px] font-bold", current ? "bg-ink text-white" : "bg-sunken text-fg-2")}>{current ? current.name[0] : "∗"}</span>
        <span className="max-w-[88px] sm:max-w-[140px] truncate">{current?.name ?? "All partners"}</span>
        <ChevronDown className="size-3.5 text-muted" />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-10 z-40 w-64 bg-surface border border-border rounded-xl shadow-(--shadow-pop) p-1.5 anim-panel">
          <div className="px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">Partners</div>
          {[{ id: "all", name: "All partners", tagline: `${state?.partners.length ?? 0} partners · aggregated`, country: "" }, ...(state?.partners ?? [])].map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={partner === p.id}
              onClick={() => {
                setPartner(p.id);
                setOpen(false);
              }}
              className={cx("w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-sunken", partner === p.id && "bg-sunken")}
            >
              <span className={cx("size-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0", p.id === "all" ? "bg-sunken border border-border text-fg-2" : "bg-ink text-white")}>{p.id === "all" ? "∗" : p.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium truncate">{p.name}</span>
                <span className="block text-[11.5px] text-muted truncate">{p.tagline}</span>
              </span>
              {partner === p.id && <CircleCheck className="size-4 text-fg" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && fn();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, fn]);
}

function Notifications() {
  const { state } = useShield();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const items = useMemo(() => {
    if (!state) return [];
    const isk = state.accounts.filter((a) => a.wrapper === "ISK" && a.status === "ACTIVE").length;
    const peas = state.accounts.filter((a) => a.wrapper === "PEA").map((a) => ({ id: a.id, d: new Date(new Date(a.opened_at).setUTCFullYear(new Date(a.opened_at).getUTCFullYear() + 5)) })).sort((a, b) => +a.d - +b.d);
    const recent = [...state.audit].reverse().filter((e) => e.action.endsWith("REJECTED") || e.action === "COMPLIANCE_ALERT").slice(0, 3);
    return [
      { icon: <Info className="size-4 text-info" />, title: "ISK quarterly snapshot", body: `${isk} ISK accounts will be valued on 1 Oct`, href: "/tax/simulator?tab=isk" },
      { icon: <Info className="size-4 text-info" />, title: "Next PEA 5-year anniversary", body: peas[0] ? `${peas[0].id} on ${fmtDate(peas[0].d)}` : "—", href: peas[0] ? `/accounts/${peas[0].id}` : "/accounts" },
      ...recent.map((e) => ({ icon: <CircleAlert className="size-4 text-danger" />, title: e.code, body: e.summary, href: "/compliance/audit" })),
    ];
  }, [state]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative size-8 rounded-lg flex items-center justify-center text-muted hover:text-fg hover:bg-sunken">
        <Bell className="size-4" />
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-danger" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-[340px] max-w-[calc(100vw-24px)] bg-surface border border-border rounded-xl shadow-(--shadow-pop) anim-panel">
          <div className="px-4 py-3 border-b border-border text-[13px] font-semibold">Notifications</div>
          <div className="p-1.5 max-h-[360px] overflow-y-auto">
            {items.map((n, i) => (
              <Link key={i} href={n.href} onClick={() => setOpen(false)} className="flex gap-3 px-2.5 py-2.5 rounded-lg hover:bg-sunken">
                <span className="mt-0.5">{n.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium font-mono truncate">{n.title}</span>
                  <span className="block text-[12px] text-muted">{n.body}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Profile() {
  const { reset, toast } = useShield();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" className="size-8 rounded-full bg-[#2b2b29] text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-surface hover:ring-border">
        OP
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-60 bg-surface border border-border rounded-xl shadow-(--shadow-pop) p-1.5 anim-panel">
          <div className="px-2.5 py-2">
            <div className="text-[13px] font-medium">Demo Operator</div>
            <div className="text-[12px] text-muted">Partner operations · Sandbox</div>
          </div>
          <div className="h-px bg-border my-1" />
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] hover:bg-sunken">
            <Settings className="size-4 text-muted" /> Settings
          </Link>
          <a href="/openapi.json" target="_blank" className="flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] hover:bg-sunken">
            <BookOpen className="size-4 text-muted" /> OpenAPI spec
          </a>
          <button
            onClick={async () => {
              setOpen(false);
              await reset();
              toast({ tone: "success", title: "Sandbox reset", body: "Seed data restored." });
            }}
            className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] hover:bg-sunken"
          >
            <ArrowRight className="size-4 text-muted" /> Reset sandbox data
          </button>
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useShield();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const results = useMemo(() => {
    if (!state) return [];
    const pages = [
      ["Overview", "/dashboard"], ["All accounts", "/accounts"], ["Transactions", "/transactions"], ["Rules", "/compliance/rules"], ["Audit log", "/compliance/audit"],
      ["API Playground", "/developer/playground"], ["Rule Packs", "/developer/rule-packs"], ["Tax simulator", "/tax/simulator"], ["Reports", "/tax/reports"], ["Guided demo", "/demo"], ["Settings", "/settings"],
    ].map(([label, href]) => ({ kind: "Page", label, sub: href, href }));
    const accounts = accountRows(state).map((r) => ({ kind: "Account", label: `${r.id} · ${r.clientName}`, sub: r.partnerName, href: `/accounts/${r.id}` }));
    const rules = state.active_wrappers.length ? activePacks(state).flatMap((p) => p.rules.map((r) => ({ kind: "Rule", label: r.id, sub: r.name, href: `/compliance/rules?rule=${r.id}` }))) : [];
    const all = [...pages, ...accounts, ...rules];
    const needle = q.trim().toLowerCase();
    return (needle ? all.filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(needle)) : [...pages.slice(0, 6), ...accounts.slice(0, 4)]).slice(0, 12);
  }, [state, q]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const go = (href: string) => {
    router.push(href);
    onClose();
    setQ("");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-[rgba(18,18,17,0.3)] anim-overlay" onClick={onClose} />
      <div role="dialog" aria-label="Search" className="relative w-full max-w-[560px] bg-surface rounded-2xl border border-border shadow-(--shadow-pop) overflow-hidden anim-panel">
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter" && results[sel]) go(results[sel].href);
            }}
            placeholder="Search accounts, rules, pages…"
            aria-label="Search"
            className="flex-1 bg-transparent text-[14px] outline-none focus-visible:outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1.5">
          {results.length === 0 && <div className="py-10 text-center text-[13px] text-muted">No results for “{q}”</div>}
          {results.map((r, i) => (
            <button key={r.kind + r.href + r.label} onMouseEnter={() => setSel(i)} onClick={() => go(r.href)} className={cx("w-full flex items-center gap-3 px-3 h-10 rounded-lg text-left", i === sel && "bg-sunken")}>
              <span className="w-16 text-[11px] font-medium text-faint uppercase tracking-wide">{r.kind}</span>
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{r.label}</span>
              <span className="text-[12px] text-muted truncate max-w-[40%]">{r.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useShield();
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-32px)]" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="bg-surface border border-border rounded-xl shadow-(--shadow-pop) px-4 py-3 flex gap-3 anim-panel">
          <span className={cx("mt-1 size-2 rounded-full shrink-0", t.tone === "success" ? "bg-success" : t.tone === "danger" ? "bg-danger" : "bg-info")} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">{t.title}</div>
            {t.body && <div className="text-[12.5px] text-muted mt-0.5">{t.body}</div>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="text-faint hover:text-fg">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const path = usePathname();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="min-h-screen flex flex-col">
      <div className="h-7 bg-ink text-[#d9d8d3] text-[11.5px] flex items-center justify-center gap-2 px-4 text-center shrink-0">
        <span className="size-1.5 rounded-full bg-brand shrink-0" />
        <span className="truncate">
          <span className="hidden sm:inline">Prototype concept for a broker API — not an official Alpaca product. </span>Tax rules are simplified for demonstration and are not tax advice.
        </span>
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block w-[240px] shrink-0 border-r border-border bg-surface sticky top-0 h-screen">
          <Sidebar />
        </aside>
        {mobileNav && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30 anim-overlay" onClick={() => setMobileNav(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-surface border-r border-border anim-drawer">
              <Sidebar onNavigate={() => setMobileNav(false)} />
            </aside>
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 sticky top-0 z-30 bg-bg/85 backdrop-blur-md border-b border-border flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 min-w-0">
            <button onClick={() => setMobileNav(true)} className="lg:hidden size-8 rounded-lg flex items-center justify-center hover:bg-sunken" aria-label="Open navigation">
              <Menu className="size-4.5" />
            </button>
            <div className="hidden sm:block lg:hidden mr-1">
              <Logo size={26} />
            </div>
            <PartnerSwitcher />
            <span className="hidden md:inline-flex">
              <Badge tone="brand" dot>Environment: Demo</Badge>
            </span>
            <button onClick={() => setPalette(true)} className="ml-auto md:ml-4 shrink-0 flex items-center gap-2 h-8 px-2.5 md:w-[260px] rounded-lg border border-border bg-surface text-[13px] text-faint hover:border-border-strong" aria-label="Search">
              <Search className="size-3.5" />
              <span className="hidden md:inline flex-1 text-left">Search…</span>
              <span className="hidden md:inline-flex">
                <Kbd>⌘K</Kbd>
              </span>
            </button>
            <div className="md:ml-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
              {path !== "/demo" && (
                <LinkButton href="/demo" variant="primary" size="sm" icon={<PlayCircle className="size-3.5 text-brand" />}>
                    <span className="hidden sm:inline">Demo mode</span>
                  </LinkButton>
              )}
              <Notifications />
              <Profile />
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Suspense fallback={<div className="p-8"><div className="h-8 w-60 rounded-md bg-sunken animate-pulse" /></div>}>{children}</Suspense>
          </main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <Toasts />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <ShellInner>{children}</ShellInner>;
}
