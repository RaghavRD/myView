"use client";

import { useEffect, useRef, useState } from "react";
import type { Market, SymbolInfo } from "@/lib/provider/types";

export default function SymbolSearch({
  onSelect,
  market,
}: {
  onSelect: (s: SymbolInfo) => void;
  market: Market;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&market=${market}`,
        );
        const data = await res.json();
        if (!cancelled) {
          setResults(data.results ?? []);
          setActive(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, market]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(s: SymbolInfo) {
    onSelect(s);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown")
            setActive((a) => Math.min(a + 1, results.length - 1));
          else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
          else if (e.key === "Enter" && results[active]) choose(results[active]);
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={
          market === "crypto"
            ? "Search crypto… (e.g. BTC, ETH, SOL)"
            : "Search symbol… (e.g. RELIANCE, TCS, NIFTY)"
        }
        className="w-72 bg-[#0c0e15] border border-[#2a2e39] rounded px-3 py-1.5 text-sm outline-none focus:border-[#2962ff] placeholder:text-[#5a5e6b]"
      />
      {open && (query.trim() || loading) && (
        <div className="absolute z-30 mt-1 w-[22rem] max-h-80 overflow-auto bg-[#131722] border border-[#2a2e39] rounded shadow-xl">
          {loading && (
            <div className="px-3 py-2 text-xs text-[#787b86]">Searching…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-[#787b86]">No matches</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.symbol}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                i === active ? "bg-[#1c2030]" : ""
              }`}
            >
              <span className="flex flex-col">
                <span className="font-medium">{r.symbol}</span>
                <span className="text-xs text-[#787b86] truncate max-w-[14rem]">
                  {r.name}
                </span>
              </span>
              <span className="text-[10px] text-[#787b86] uppercase shrink-0">
                {r.exchange} {r.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
