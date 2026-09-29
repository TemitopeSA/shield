const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

export const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));

export function yearsBetween(from: string | Date, to: string | Date): number {
  return (toDate(to).getTime() - toDate(from).getTime()) / YEAR;
}

export function addYears(d: string | Date, years: number): Date {
  const x = new Date(toDate(d));
  x.setUTCFullYear(x.getUTCFullYear() + Math.floor(years));
  const frac = years - Math.floor(years);
  return new Date(x.getTime() + frac * YEAR);
}

export const isoDate = (d: string | Date) => toDate(d).toISOString().slice(0, 10);

export function fmtDate(d: string | Date, withYear = true): string {
  return toDate(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function fmtTime(d: string | Date): string {
  return toDate(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDateTime(d: string | Date): string {
  return `${fmtDate(d)} · ${fmtTime(d)}`;
}
