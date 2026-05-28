// NSE/BSE regular session: 09:15–15:30 IST, Monday–Friday.
// (Holidays are not handled — personal-use approximation.)

const WD: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface IstParts {
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
}

export function istParts(date: Date = new Date()): IstParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WD[get("weekday")] ?? 1,
  };
}

const OPEN_MIN = 9 * 60 + 15; // 09:15
const CLOSE_MIN = 15 * 60 + 30; // 15:30

export function isMarketOpen(date: Date = new Date()): boolean {
  const { hour, minute, weekday } = istParts(date);
  if (weekday === 0 || weekday === 6) return false;
  const mins = hour * 60 + minute;
  return mins >= OPEN_MIN && mins <= CLOSE_MIN;
}

export function marketStatusLabel(date: Date = new Date()): string {
  return isMarketOpen(date) ? "Market open" : "Market closed";
}

// ---- market-aware helpers (crypto trades 24/7) ----

import type { Market } from "./provider/types";

/** True when the given market is currently tradable. Crypto is always open. */
export function isMarketOpenFor(market: Market, date: Date = new Date()): boolean {
  return market === "crypto" ? true : isMarketOpen(date);
}

export function marketStatusLabelFor(market: Market, date: Date = new Date()): string {
  if (market === "crypto") return "24/7";
  return isMarketOpen(date) ? "Market open" : "Market closed";
}
