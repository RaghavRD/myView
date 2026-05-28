"use client";

import { useEffect, useState } from "react";
import type { Market, Quote } from "@/lib/provider/types";
import { isMarketOpenFor, marketStatusLabelFor } from "@/lib/market-hours";

export default function QuoteHeader({
  name,
  symbol,
  quote,
  market,
}: {
  name: string;
  symbol: string;
  quote: Quote | null;
  market: Market;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => {
      setOpen(isMarketOpenFor(market));
      setLabel(marketStatusLabelFor(market));
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [market]);

  const up = (quote?.change ?? 0) >= 0;
  const color = up ? "#26a69a" : "#ef5350";
  const fmt = (n: number | undefined) =>
    n == null || Number.isNaN(n)
      ? "—"
      : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="flex items-baseline gap-3 px-4 py-2 border-b border-[#2a2e39] bg-[#0c0e15] shrink-0">
      <span className="font-semibold">{name}</span>
      <span className="text-xs text-[#787b86]">{symbol}</span>
      {quote && (
        <>
          <span className="text-lg font-semibold tabular-nums">
            {fmt(quote.price)}
          </span>
          <span className="text-sm tabular-nums" style={{ color }}>
            {up ? "+" : ""}
            {fmt(quote.change)} ({up ? "+" : ""}
            {quote.changePercent.toFixed(2)}%)
          </span>
        </>
      )}
      <span className="ml-auto flex items-center gap-1.5 text-xs text-[#787b86]">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: open ? "#26a69a" : "#787b86" }}
        />
        {label}
      </span>
    </div>
  );
}
