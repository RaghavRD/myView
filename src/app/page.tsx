"use client";

import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import Toolbar from "@/components/Toolbar";
import LayoutGrid from "@/components/LayoutGrid";
import Watchlist from "@/components/Watchlist";
import { useStore } from "@/lib/store";
import { TIMEFRAMES } from "@/lib/timeframes";
import type { ChartType } from "@/lib/provider/types";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // keyboard shortcuts act on the active panel: 1-8 timeframes, c/l/a chart type,
  // Escape clears the selected drawing tool
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      const st = useStore.getState();
      const id = st.activePanelId;
      if (e.key === "Escape") {
        st.setActiveTool(null);
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= TIMEFRAMES.length) {
        st.setPanelTimeframe(id, TIMEFRAMES[n - 1].label);
        return;
      }
      const types: Record<string, ChartType> = { c: "candlestick", l: "line", a: "area" };
      const t = types[e.key.toLowerCase()];
      if (t) st.setPanelChartType(id, t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-[#787b86]">
        Loading MyView…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Toolbar />
        <LayoutGrid />
        <Watchlist />
      </div>
    </div>
  );
}
