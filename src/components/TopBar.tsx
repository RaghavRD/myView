"use client";

import Logo from "./Logo";
import SymbolSearch from "./SymbolSearch";
import IndicatorPanel from "./IndicatorPanel";
import LayoutPicker from "./LayoutPicker";
import SettingsDialog from "./SettingsDialog";
import { useStore, useActivePanel } from "@/lib/store";
import { TIMEFRAMES } from "@/lib/timeframes";
import type { ChartType, Market } from "@/lib/provider/types";

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candlestick", label: "Candles" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

const MARKETS: { id: Market; label: string }[] = [
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
];

export default function TopBar() {
  const panel = useActivePanel();
  const market = useStore((s) => s.market);
  const setMarket = useStore((s) => s.setMarket);
  const setPanelSymbol = useStore((s) => s.setPanelSymbol);
  const setPanelTimeframe = useStore((s) => s.setPanelTimeframe);
  const setPanelChartType = useStore((s) => s.setPanelChartType);
  const addToActiveWatchlist = useStore((s) => s.addToActiveWatchlist);

  return (
    <header className="flex items-center gap-3 h-12 px-3 border-b border-[#2a2e39] bg-[#131722] shrink-0 overflow-x-auto">
      <Logo />
      <div className="h-5 w-px bg-[#2a2e39]" />

      {/* Market toggle (flips the whole workspace) */}
      <div className="flex items-center rounded border border-[#2a2e39] overflow-hidden">
        {MARKETS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMarket(m.id)}
            className={`px-2.5 py-1 text-xs ${
              market === m.id
                ? "bg-[#2962ff] text-white"
                : "text-[#a3a6af] hover:bg-[#1c2030]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <SymbolSearch
        market={market}
        onSelect={(s) => {
          setPanelSymbol(panel.id, s);
          addToActiveWatchlist(s);
        }}
      />
      <span className="text-sm font-semibold text-[#d1d4dc]">{panel.symbol}</span>

      <div className="h-5 w-px bg-[#2a2e39]" />

      {/* Timeframes (act on the active panel) */}
      <div className="flex items-center gap-0.5">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.label}
            onClick={() => setPanelTimeframe(panel.id, tf.label)}
            className={`px-2 py-1 text-xs rounded ${
              panel.timeframe === tf.label
                ? "bg-[#2962ff] text-white"
                : "text-[#a3a6af] hover:bg-[#1c2030]"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-[#2a2e39]" />

      {/* Chart type */}
      <div className="flex items-center gap-0.5">
        {CHART_TYPES.map((c) => (
          <button
            key={c.id}
            onClick={() => setPanelChartType(panel.id, c.id)}
            className={`px-2 py-1 text-xs rounded ${
              panel.chartType === c.id
                ? "bg-[#1c2030] text-white"
                : "text-[#a3a6af] hover:bg-[#1c2030]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="h-5 w-px bg-[#2a2e39]" />

      <LayoutPicker />
      <IndicatorPanel />
      <SettingsDialog />
    </header>
  );
}
