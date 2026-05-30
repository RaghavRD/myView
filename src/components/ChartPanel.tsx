"use client";

import Chart from "./Chart";
import { useStore, type Panel } from "@/lib/store";
import { usePanelData } from "@/lib/usePanelData";

/** One cell of the layout grid: owns its own data and reflects the active state. */
export default function ChartPanel({
  panel,
  active,
  showActiveRing,
}: {
  panel: Panel;
  active: boolean;
  /** only ring the active panel when more than one panel is visible */
  showActiveRing: boolean;
}) {
  const setActivePanel = useStore((s) => s.setActivePanel);
  const market = useStore((s) => s.market);
  const { candles, loading, error } = usePanelData(
    panel.symbol,
    panel.timeframe,
    market,
  );

  return (
    <div
      onMouseDown={() => !active && setActivePanel(panel.id)}
      className={`flex flex-col min-w-0 min-h-0 overflow-hidden ${
        showActiveRing && active
          ? "outline outline-1 outline-[#2962ff] -outline-offset-1"
          : ""
      }`}
    >
      <div className="relative flex-1 min-h-0">
        <Chart panel={panel} candles={candles} market={market} />
        {loading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-xs text-[#787b86] bg-[#131722] border border-[#2a2e39] rounded px-3 py-1">
            Loading…
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
            <div className="text-sm text-[#ef5350] bg-[#131722] border border-[#2a2e39] rounded px-4 py-2">
              {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
