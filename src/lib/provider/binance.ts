// Binance provider (public market-data endpoints — no auth). Called only from server-side
// API routes. Uses data-api.binance.vision, Binance's dedicated public market-data host,
// which avoids the account-region restrictions of the main api.binance.com. Parsers are
// exported separately so they can be unit-tested without network.

import type { Candle, Quote, SymbolInfo, Timeframe } from "./types";

const BASE = "https://data-api.binance.vision";

/** MyView timeframe → Binance kline interval. Binance supports all of ours 1:1. */
const INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1M",
};

/* ----------------------------- parsers (testable) ----------------------------- */

// A Binance kline is a tuple: [openTime, open, high, low, close, volume, closeTime, ...].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseKlines(json: any): Candle[] {
  if (!Array.isArray(json)) return [];
  const out: Candle[] = [];
  let prev = -Infinity;
  for (const k of json) {
    const time = Math.floor(Number(k[0]) / 1000); // ms → unix seconds
    const open = Number(k[1]);
    const high = Number(k[2]);
    const low = Number(k[3]);
    const close = Number(k[4]);
    const volume = Number(k[5]);
    if ([time, open, high, low, close].some(Number.isNaN)) continue;
    if (time <= prev) continue; // strictly increasing for the chart lib
    prev = time;
    out.push({ time, open, high, low, close, volume: Number.isNaN(volume) ? 0 : volume });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseTicker(json: any, symbol: string): Quote {
  const price = Number(json?.lastPrice ?? json?.weightedAvgPrice ?? NaN);
  const prev = Number(json?.prevClosePrice ?? NaN);
  const change = Number(json?.priceChange ?? (price - prev));
  const changePercent = Number(json?.priceChangePercent ?? (prev ? (change / prev) * 100 : 0));
  return {
    symbol: json?.symbol ?? symbol,
    price,
    previousClose: Number.isNaN(prev) ? price - change : prev,
    change,
    changePercent,
    currency: "USD",
    marketState: "REGULAR", // crypto trades 24/7
    time: json?.closeTime ? Math.floor(Number(json.closeTime) / 1000) : Math.floor(Date.now() / 1000),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseExchangeInfo(json: any): SymbolInfo[] {
  const symbols = json?.symbols ?? [];
  return symbols
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => ({
      symbol: s.symbol as string,
      name: `${s.baseAsset} / ${s.quoteAsset}`,
      exchange: "Binance",
      type: "CRYPTO",
      market: "crypto" as const,
    }));
}

/* ------------------------------- network calls ------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cache = new Map<string, { t: number; data: unknown }>();

async function fetchJson(path: string, ttlMs = 0): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && now - cached.t < ttlMs) return cached.data;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 429 || res.status === 418) {
        // weight limit / IP ban — back off and fall back to cache
        lastErr = new Error(`Binance responded ${res.status}`);
        break;
      }
      if (!res.ok) throw new Error(`Binance responded ${res.status}`);
      const data = await res.json();
      cache.set(path, { t: Date.now(), data });
      return data;
    } catch (e) {
      lastErr = e;
      await sleep(500 * (attempt + 1));
    }
  }
  if (cached) return cached.data; // stale fallback
  throw lastErr ?? new Error("Binance request failed");
}

// Candles + quote in two parallel public calls (no auth, no rate-limit session needed).
export async function getChart(
  symbol: string,
  tf: Timeframe,
): Promise<{ candles: Candle[]; quote: Quote }> {
  const sym = symbol.toUpperCase();
  const [klines, ticker] = await Promise.all([
    fetchJson(`/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${INTERVAL[tf]}&limit=1000`, 10_000),
    fetchJson(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`, 8_000),
  ]);
  return { candles: parseKlines(klines), quote: parseTicker(ticker, sym) };
}

export async function getQuote(symbol: string): Promise<Quote> {
  const sym = symbol.toUpperCase();
  const json = await fetchJson(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(sym)}`, 8_000);
  return parseTicker(json, sym);
}

export async function searchSymbols(query: string): Promise<SymbolInfo[]> {
  // exchangeInfo is large but static; cache it for an hour and filter locally.
  const all = parseExchangeInfo(await fetchJson("/api/v3/exchangeInfo", 60 * 60_000));
  const q = query.trim().toUpperCase();
  if (!q) return all.slice(0, 20);
  const ranked = all
    .filter((s) => s.symbol.includes(q) || s.name.toUpperCase().includes(q))
    // exact base-asset / prefix matches first
    .sort((a, b) => Number(b.symbol.startsWith(q)) - Number(a.symbol.startsWith(q)));
  return ranked.slice(0, 20);
}
