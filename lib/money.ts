// Static demo FX rates, expressed as the value of one unit in EUR.
export const FX_TO_EUR: Record<string, number> = {
  EUR: 1,
  SEK: 0.087,
  USD: 0.92,
  PLN: 0.234,
};

export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const f = FX_TO_EUR[from];
  const t = FX_TO_EUR[to];
  if (f === undefined || t === undefined) throw new Error(`No FX rate for ${from}/${to}`);
  return (amount * f) / t;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

const SYMBOL: Record<string, string> = { EUR: "€", USD: "$" };

export function fmtMoney(
  amount: number,
  currency = "EUR",
  opts: { decimals?: number; compact?: boolean; sign?: boolean } = {},
): string {
  const decimals = opts.decimals ?? (Math.abs(amount) >= 10000 ? 0 : 2);
  const abs = Math.abs(amount);
  let body: string;
  if (opts.compact && abs >= 1_000_000) body = (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  else if (opts.compact && abs >= 10_000) body = (abs / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  else
    body = abs.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  const sign = amount < 0 ? "−" : opts.sign && amount > 0 ? "+" : "";
  const sym = SYMBOL[currency];
  return sym ? `${sign}${sym}${body}` : `${sign}${currency} ${body}`;
}

export const fmtPct = (n: number, decimals = 1, sign = false) =>
  `${sign && n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(decimals)}%`;

export const fmtNum = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
