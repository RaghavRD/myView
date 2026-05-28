// Yahoo Finance provider (unofficial public endpoints). Called only from server-side API
// routes. Parsers are exported separately so they can be unit-tested without network.

import type { Candle, Quote, SymbolInfo, Timeframe } from "./types";
import { tfConfig } from "../timeframes";

const BASE = "https://query1.finance.yahoo.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* ----------------------------- parsers (testable) ----------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCandles(json: any): Candle[] {
  const r = json?.chart?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp ?? [];
  const q = r.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  let prev = -Infinity;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    if (t <= prev) continue; // strictly increasing for the chart lib
    prev = t;
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: v ?? 0 });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseQuoteFromChart(json: any, symbol: string): Quote {
  const r = json?.chart?.result?.[0];
  const meta = r?.meta ?? {};
  const price = meta.regularMarketPrice ?? NaN;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = price - prev;
  return {
    symbol: meta.symbol ?? symbol,
    price,
    previousClose: prev,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    currency: meta.currency,
    marketState: meta.marketState,
    time: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSearch(json: any): SymbolInfo[] {
  const quotes = json?.quotes ?? [];
  return quotes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => q.symbol)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => ({
      symbol: q.symbol,
      name: q.shortname ?? q.longname ?? q.symbol,
      exchange: q.exchDisp ?? q.exchange ?? "",
      type: q.quoteType ?? q.typeDisp ?? "",
      market: "stocks" as const,
    }));
}

/* ------------------------------- network calls ------------------------------- */

// Yahoo's public endpoints aggressively rate-limit (429) bursts from a session without
// cookies. We retry with backoff and keep a short in-memory cache that also doubles as a
// stale-fallback when a request ultimately fails.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ----- session (cookie + crumb) -----
// Anonymous calls get 429'd quickly. Establishing a cookie + crumb session (the approach
// yfinance uses) makes Yahoo treat us like a browser and is far more reliable.

interface Session {
  cookie: string;
  crumb: string;
  t: number;
}
let session: Session | null = null;
let sessionInflight: Promise<Session | null> | null = null;
const SESSION_TTL = 30 * 60 * 1000;

async function getSession(): Promise<Session | null> {
  if (session && Date.now() - session.t < SESSION_TTL) return session;
  if (sessionInflight) return sessionInflight;
  sessionInflight = bootstrapSession().finally(() => {
    sessionInflight = null;
  });
  return sessionInflight;
}

async function bootstrapSession(): Promise<Session | null> {
  try {
    const home = await fetch("https://finance.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      cache: "no-store",
    });
    const setCookies =
      (home.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      [];
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    const crumbRes = await fetch(
      "https://query1.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/plain",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        cache: "no-store",
      },
    );
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || /too many|<|forbidden/i.test(crumb)) return null;
    session = { cookie, crumb, t: Date.now() };
    return session;
  } catch {
    return null;
  }
}

// ----- cached, retrying fetch -----
// The v8 chart endpoint works fine with a bare request, so we keep cold-load bursts small.
// Only the search endpoint needs the cookie + crumb session (`useSession`).

const cache = new Map<string, { t: number; data: unknown }>();

async function fetchJson(
  path: string,
  ttlMs = 0,
  useSession = false,
): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && now - cached.t < ttlMs) return cached.data;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const s = useSession ? await getSession() : null;
      const sep = path.includes("?") ? "&" : "?";
      const url =
        BASE + path + (s?.crumb ? `${sep}crumb=${encodeURIComponent(s.crumb)}` : "");
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
          ...(s?.cookie ? { Cookie: s.cookie } : {}),
        },
        cache: "no-store",
      });
      if (res.status === 429) {
        // Do NOT retry a rate-limit — retrying just deepens the throttle. Fail fast and
        // let the caller fall back to any cached copy.
        lastErr = new Error("Yahoo responded 429");
        if (useSession) session = null;
        break;
      }
      if (res.status >= 500) {
        lastErr = new Error(`Yahoo responded ${res.status}`);
        await sleep(600 * (attempt + 1) * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
      const data = await res.json();
      cache.set(path, { t: Date.now(), data });
      return data;
    } catch (e) {
      lastErr = e;
      await sleep(600 * (attempt + 1));
    }
  }
  // fall back to any stale cached copy before giving up
  if (cached) return cached.data;
  throw lastErr ?? new Error("Yahoo request failed");
}

function chartPath(symbol: string, interval: string, range: string) {
  return `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
}

// One chart fetch yields both candles and the latest quote (from `meta`), so a page load
// costs a single upstream request.
export async function getChart(
  symbol: string,
  tf: Timeframe,
): Promise<{ candles: Candle[]; quote: Quote }> {
  const c = tfConfig(tf);
  const json = await fetchJson(chartPath(symbol, c.interval, c.range), 10_000);
  return {
    candles: parseCandles(json),
    quote: parseQuoteFromChart(json, symbol),
  };
}

export async function getQuote(symbol: string): Promise<Quote> {
  const json = await fetchJson(chartPath(symbol, "1d", "5d"), 8_000);
  return parseQuoteFromChart(json, symbol);
}

export async function searchSymbols(query: string): Promise<SymbolInfo[]> {
  const path = `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`;
  return parseSearch(await fetchJson(path, 60_000, true));
}
