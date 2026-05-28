"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, useActivePanel, useActiveWatchlist } from "@/lib/store";

export default function Watchlist() {
  const market = useStore((s) => s.market);
  // Select the stable array + primitive, then derive in render. Filtering *inside* the
  // selector returns a new array every call and trips useSyncExternalStore's loop guard.
  const watchlists = useStore((s) => s.watchlists);
  const lists = watchlists.filter((w) => w.market === market);
  const active = useActiveWatchlist();
  const activePanelId = useStore((s) => s.activePanelId);
  const activeSymbol = useActivePanel().symbol;

  const setActiveWatchlist = useStore((s) => s.setActiveWatchlist);
  const createWatchlist = useStore((s) => s.createWatchlist);
  const deleteWatchlist = useStore((s) => s.deleteWatchlist);
  const renameWatchlist = useStore((s) => s.renameWatchlist);
  const setPanelSymbol = useStore((s) => s.setPanelSymbol);
  const removeFromWatchlist = useStore((s) => s.removeFromWatchlist);

  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const onlyOne = lists.length <= 1;

  return (
    <aside className="w-72 shrink-0 border-l border-[#2a2e39] bg-[#131722] flex flex-col">
      {/* watchlist selector + actions */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-[#2a2e39]" ref={ref}>
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-1 w-full px-1.5 py-1 text-sm font-medium rounded hover:bg-[#1c2030] truncate"
            title="Switch watchlist"
          >
            <span className="truncate">{active.name}</span>
            <span className="text-[#787b86] shrink-0">▾</span>
          </button>
          {menuOpen && (
            <div className="absolute z-30 mt-1 w-56 bg-[#131722] border border-[#2a2e39] rounded shadow-xl py-1">
              {lists.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveWatchlist(w.id);
                    setMenuOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-[#1c2030] ${
                    w.id === active.id ? "text-[#2962ff]" : "text-[#d1d4dc]"
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  <span className="text-xs text-[#787b86]">{w.symbols.length}</span>
                </button>
              ))}
              <div className="h-px bg-[#2a2e39] my-1" />
              <button
                onClick={() => {
                  const name = window.prompt(`New ${market} watchlist name:`, "My list");
                  if (name?.trim()) createWatchlist(name);
                  setMenuOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-[#a3a6af] hover:bg-[#1c2030]"
              >
                + New watchlist
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            const name = window.prompt("Rename watchlist:", active.name);
            if (name?.trim()) renameWatchlist(active.id, name);
          }}
          className="px-1.5 py-1 text-[#787b86] hover:text-white text-sm"
          title="Rename"
        >
          ✎
        </button>
        <button
          onClick={() => deleteWatchlist(active.id)}
          disabled={onlyOne}
          className="px-1.5 py-1 text-[#787b86] hover:text-[#ef5350] text-sm disabled:opacity-30 disabled:hover:text-[#787b86]"
          title={onlyOne ? "Keep at least one watchlist" : "Delete watchlist"}
        >
          🗑
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {active.symbols.length === 0 && (
          <div className="px-3 py-4 text-xs text-[#787b86]">
            Search a symbol to add it to “{active.name}”.
          </div>
        )}
        {active.symbols.map((w) => (
          <div
            key={w.symbol}
            onClick={() => setPanelSymbol(activePanelId, w)}
            className={`group flex items-center justify-between gap-2 px-3 py-2 cursor-pointer border-b border-[#1c2030] ${
              w.symbol === activeSymbol ? "bg-[#1c2030]" : "hover:bg-[#171b26]"
            }`}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{w.symbol}</div>
              <div className="text-xs text-[#787b86] truncate">{w.name}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFromWatchlist(active.id, w.symbol);
              }}
              className="opacity-0 group-hover:opacity-100 text-[#787b86] hover:text-[#ef5350] text-sm px-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
