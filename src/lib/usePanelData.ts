"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle, Market, Quote, Timeframe } from "@/lib/provider/types";
import { isMarketOpenFor } from "@/lib/market-hours";

const POLL_MS = 60_000;

/** MyView timeframe → Binance kline interval (matches the server-side map). */
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "1D": "1d",
  "1W": "1w",
  "1M": "1M",
};

/** Public Binance market-data WebSocket host (mirrors data-api.binance.vision). */
const BINANCE_WS = "wss://data-stream.binance.vision/ws";

/**
 * Loads candles + quote for one panel and keeps it live. Each panel runs its own
 * instance, so a multi-chart layout makes one request per panel (the provider's
 * session + cache absorb the small burst).
 *
 * Crypto streams real-time klines over Binance's public WebSocket — the in-progress
 * candle updates every ~1s and a new candle is appended when the current one closes.
 * Stocks fall back to a 60s quote poll, and only during NSE hours.
 */
export function usePanelData(symbol: string, timeframe: string, market: Market) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/quote?symbol=${encodeURIComponent(symbol)}&market=${market}`,
      );
      const data = await res.json();
      if (!res.ok || !data.quote) return;
      const q: Quote = data.quote;
      setQuote(q);
      if (typeof q.price === "number" && !Number.isNaN(q.price)) {
        setCandles((prev) => {
          if (!prev.length) return prev;
          const last = { ...prev[prev.length - 1] };
          last.close = q.price;
          last.high = Math.max(last.high, q.price);
          last.low = Math.min(last.low, q.price);
          return [...prev.slice(0, -1), last];
        });
      }
    } catch {
      /* ignore transient quote errors */
    }
  }, [symbol, market]);

  // load candles (+ quote) on symbol / timeframe change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&market=${market}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Failed to load data");
        setCandles(data.candles ?? []);
        if (data.quote) setQuote(data.quote);
        if ((data.candles ?? []).length === 0)
          setError("No data available for this symbol / timeframe.");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load data");
          setCandles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, market]);

  // STOCKS: poll the quote while the market is tradable (visible tab only).
  // Crypto is handled by the live WebSocket below instead.
  useEffect(() => {
    if (market === "crypto") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && isMarketOpenFor(market)) fetchQuote();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchQuote, market]);

  // CRYPTO: real-time klines over Binance's public WebSocket. Updates the
  // in-progress candle as trades arrive and appends a new candle when one closes.
  // `candles` is intentionally not a dependency — we merge into the latest state
  // via the functional updater so the socket isn't torn down on every tick.
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (market !== "crypto") return;
    const interval = BINANCE_INTERVAL[timeframe as Timeframe];
    if (!interval) return;

    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      ws = new WebSocket(`${BINANCE_WS}/${stream}`);

      ws.onmessage = (ev) => {
        let msg: unknown;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        const k = (msg as { k?: Record<string, unknown> })?.k;
        if (!k) return;
        const time = Math.floor(Number(k.t) / 1000); // ms → unix seconds
        const open = Number(k.o);
        const high = Number(k.h);
        const low = Number(k.l);
        const close = Number(k.c);
        const volume = Number(k.v);
        if ([time, open, high, low, close].some(Number.isNaN)) return;
        const bar: Candle = { time, open, high, low, close, volume: Number.isNaN(volume) ? 0 : volume };

        setCandles((prev) => {
          if (!prev.length) return [bar];
          const lastTime = prev[prev.length - 1].time;
          if (time === lastTime) return [...prev.slice(0, -1), bar]; // update in-progress candle
          if (time > lastTime) return [...prev, bar]; // a new candle has opened
          return prev; // stale/out-of-order frame
        });

        // keep the header quote ticking off the live price
        setQuote((prev) =>
          prev
            ? {
                ...prev,
                price: close,
                change: close - prev.previousClose,
                changePercent: prev.previousClose
                  ? ((close - prev.previousClose) / prev.previousClose) * 100
                  : prev.changePercent,
                time,
              }
            : prev,
        );
      };

      ws.onclose = () => {
        if (closed) return;
        // transient drop — retry shortly
        reconnectRef.current = setTimeout(connect, 2_000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();

    return () => {
      closed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws?.close();
    };
  }, [symbol, timeframe, market]);

  return { candles, quote, loading, error };
}
