"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { Check, Copy, Loader2, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

export const cx = clsx;

// ——— Button ————————————————————————————————————————————————————

type Variant = "primary" | "secondary" | "ghost" | "danger" | "brand";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2a2a28] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
  secondary: "bg-surface text-fg border border-border hover:border-border-strong hover:bg-surface-2 shadow-[0_1px_1px_rgba(0,0,0,0.03)]",
  ghost: "text-fg-2 hover:bg-sunken",
  danger: "bg-danger text-white hover:bg-[#a52c23]",
  brand: "bg-brand text-ink hover:bg-brand-strong shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
};
const SIZES = { sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md", md: "h-8.5 px-3.5 text-[13px] gap-2 rounded-lg", lg: "h-10.5 px-5 text-[14px] gap-2 rounded-lg" };
const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap transition-[background,border,color,box-shadow,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none";

/** A navigation link styled as a button (never nest a <button> inside a link). */
export function LinkButton({ href, variant = "secondary", size = "md", icon, className, children, onClick }: { href: string; variant?: Variant; size?: keyof typeof SIZES; icon?: ReactNode; className?: string; children?: ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cx(BASE, VARIANTS[variant], SIZES[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; loading?: boolean; icon?: ReactNode }
>(function Button({ variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="size-3.5 anim-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ——— Card ——————————————————————————————————————————————————————

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("bg-surface border border-border rounded-xl shadow-(--shadow-card)", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {description && <p className="text-[12.5px] text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

// ——— Badge —————————————————————————————————————————————————————

type Tone = "neutral" | "success" | "danger" | "warn" | "info" | "brand" | "ink";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-fg-2 border-border",
  success: "bg-success-soft text-success border-[#cfe9dc]",
  danger: "bg-danger-soft text-danger border-[#f4d3cf]",
  warn: "bg-warn-soft text-warn border-[#f5e0b8]",
  info: "bg-info-soft text-info border-[#d3def6]",
  brand: "bg-brand-soft text-[#6b5400] border-[#f3e3a0]",
  ink: "bg-ink text-white border-ink",
};
const DOTS: Record<Tone, string> = { neutral: "bg-faint", success: "bg-success", danger: "bg-danger", warn: "bg-warn", info: "bg-info", brand: "bg-brand-strong", ink: "bg-brand" };

export function Badge({ tone = "neutral", dot, mono, children, className }: { tone?: Tone; dot?: boolean; mono?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 h-5.5 px-2 rounded-md border text-[11.5px] font-medium whitespace-nowrap",
        mono && "font-mono text-[11px] tracking-tight",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cx("size-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "ACTIVE" || status === "PASS" || status === "COMPLIANT" || status === "filled" ? "success" : status === "FAIL" || status === "BREACH" || status === "rejected" ? "danger" : status === "WARN" || status === "CLOSED" ? "warn" : "neutral";
  return (
    <Badge tone={tone} dot mono>
      {status.toUpperCase()}
    </Badge>
  );
}

// ——— Wrapper identity ——————————————————————————————————————————

const WRAPPER_COLORS: Record<string, string> = { PEA: "#2f5bea", PEA_PME: "#6d4aff", ISK: "#0b7f86", PIR: "#1f8a4c", IKE: "#c0352b" };
export function wrapperColor(w: string) {
  if (WRAPPER_COLORS[w]) return WRAPPER_COLORS[w];
  let h = 0;
  for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}

export function WrapperBadge({ wrapper, name, size = "md" }: { wrapper: string; name?: string; size?: "sm" | "md" }) {
  const c = wrapperColor(wrapper);
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-md font-semibold tracking-tight whitespace-nowrap", size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-[12px]")}
      style={{ color: c, background: `color-mix(in srgb, ${c} 9%, white)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 22%, white)` }}
    >
      <span className="size-1.5 rounded-[2px]" style={{ background: c }} />
      {name ?? wrapper.replace("_", "-")}
    </span>
  );
}

export function CountryChip({ code }: { code: string }) {
  return <span className="inline-flex items-center justify-center h-4.5 min-w-6 px-1 rounded-[4px] bg-sunken border border-border text-[10px] font-semibold text-fg-2 tracking-wide">{code}</span>;
}

// ——— Stat / Progress ——————————————————————————————————————————

export function Stat({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[12px] text-muted font-medium">{label}</div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] tnum mt-1 leading-none">{value}</div>
      {sub && <div className="text-[12px] text-muted mt-1.5">{sub}</div>}
    </div>
  );
}

export function Progress({ value, max = 100, tone = "ink", className, marker }: { value: number; max?: number; tone?: "ink" | "success" | "danger" | "warn" | "brand"; className?: string; marker?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const fill = { ink: "bg-ink", success: "bg-success", danger: "bg-danger", warn: "bg-[#d98a00]", brand: "bg-brand-strong" }[tone];
  return (
    <div className={cx("relative h-2 rounded-full bg-sunken overflow-hidden", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("h-full rounded-full transition-[width] duration-700 ease-out", fill)} style={{ width: `${w}%` }} />
      {marker !== undefined && <div className="absolute top-0 bottom-0 w-px bg-fg/60" style={{ left: `${(marker / max) * 100}%` }} />}
    </div>
  );
}

// ——— Tabs ——————————————————————————————————————————————————————

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (t: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx("flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-thin", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "relative h-9 px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
            value === t.id ? "text-fg" : "text-muted hover:text-fg",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            {t.label}
            {t.count !== undefined && <span className="text-[11px] tnum text-faint">{t.count}</span>}
          </span>
          {value === t.id && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-ink rounded-full" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="radiogroup" className={cx("inline-flex p-0.5 rounded-lg bg-sunken border border-border", className)}>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx("h-7 px-3 rounded-md text-[12.5px] font-medium transition-all", value === o.id ? "bg-surface text-fg shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ——— Form fields ——————————————————————————————————————————————

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-fg-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}

const fieldCls = "h-9 w-full rounded-lg border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-faint transition-colors hover:border-border-strong focus:border-ink focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-brand/40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(function Input({ className, prefix, ...rest }, ref) {
  if (!prefix) return <input ref={ref} className={cx(fieldCls, className)} {...rest} />;
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted pointer-events-none">{prefix}</span>
      <input ref={ref} className={cx(fieldCls, "tnum", prefix.length > 1 ? "pl-11" : "pl-7", className)} {...rest} />
    </div>
  );
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(fieldCls, "appearance-none pr-8 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236d6c67%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-no-repeat bg-position-[right_10px_center]", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

// ——— Overlays ——————————————————————————————————————————————————

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, description, children, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; width?: number }) {
  useEscape(open, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] overflow-y-auto">
      <div className="fixed inset-0 bg-[rgba(18,18,17,0.32)] backdrop-blur-[2px] anim-overlay" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} className="relative w-full bg-surface rounded-2xl shadow-(--shadow-pop) border border-border anim-panel outline-none" style={{ maxWidth: width }}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="text-[13px] text-muted mt-1">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 -mr-1 rounded-md text-muted hover:text-fg hover:bg-sunken">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, width = 560 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(18,18,17,0.24)] anim-overlay" onClick={onClose} />
      <aside role="dialog" aria-modal="true" className="absolute right-0 top-0 bottom-0 w-full bg-surface border-l border-border shadow-(--shadow-pop) flex flex-col anim-drawer" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 h-14 px-5 border-b border-border shrink-0">
          <div className="text-[14px] font-semibold min-w-0 truncate">{title}</div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-muted hover:text-fg hover:bg-sunken">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{children}</div>
      </aside>
    </div>
  );
}

// ——— JSON view ——————————————————————————————————————————————————

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function highlightJson(value: unknown): string {
  const json = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return escapeHtml(json ?? "").replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "json-num";
      if (m.startsWith('"')) cls = m.endsWith(":") ? "json-key" : "json-str";
      else if (m === "true" || m === "false") cls = "json-bool";
      else if (m === "null") cls = "json-null";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}

export function JsonView({ data, className, maxHeight }: { data: unknown; className?: string; maxHeight?: number }) {
  return (
    <pre
      className={cx("font-mono text-[12px] leading-[1.6] text-fg-2 overflow-auto scrollbar-thin whitespace-pre", className)}
      style={{ maxHeight }}
      dangerouslySetInnerHTML={{ __html: highlightJson(data) }}
    />
  );
}

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className={className}
      icon={done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

// ——— misc ——————————————————————————————————————————————————————

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-border bg-surface text-[10.5px] font-medium text-muted font-sans">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("rounded-md bg-sunken animate-pulse", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="size-10 rounded-xl bg-sunken border border-border flex items-center justify-center text-muted mb-3">{icon}</div>}
      <div className="text-[14px] font-semibold">{title}</div>
      {body && <p className="text-[13px] text-muted mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] leading-tight">{title}</h1>
        {description && <p className="text-[13.5px] text-muted mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function DemoNote({ children = "Simplified for demo", className }: { children?: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 text-[11px] text-faint font-medium", className)}>ⓘ {children}</span>;
}

/** Animate a number from its previous value to the next. */
export function useCountUp(target: number, duration = 700) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || a === target) {
      from.current = target;
      raf = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(raf);
    }
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <span className="tnum">{format(v)}</span>;
}
