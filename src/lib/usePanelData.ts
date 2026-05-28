"use client";

import { useCallback, useEffect, useState } from "react";
import type { Candle, Market, Quote } from "@/lib/provider/types";
import { isMarketOpenFor } from "@/lib/market-hours";

const POLL_MS = 60_000;

/**
 * Loads candles + quote for one panel and keeps the last candle live during
 * market hours. Each panel runs its own instance, so a multi-chart layout makes
 * one request per panel (the provider's session + cache absorb the small burst).
 * Crypto polls around the clock; stocks only during NSE hours.
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

  // poll the quote while the market is tradable (visible tab only)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && isMarketOpenFor(market)) fetchQuote();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchQuote, market]);

  return { candles, quote, loading, error };
}
