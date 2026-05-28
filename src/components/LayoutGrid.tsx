"use client";

import ChartPanel from "./ChartPanel";
import { useStore, type LayoutId } from "@/lib/store";

const GRID: Record<LayoutId, { cols: number; rows: number }> = {
  "1": { cols: 1, rows: 1 },
  "2h": { cols: 2, rows: 1 },
  "2v": { cols: 1, rows: 2 },
  "3": { cols: 3, rows: 1 },
  "4": { cols: 2, rows: 2 },
  "6": { cols: 3, rows: 2 },
};

export default function LayoutGrid() {
  const layout = useStore((s) => s.layout);
  const panels = useStore((s) => s.panels);
  const activePanelId = useStore((s) => s.activePanelId);
  const { cols, rows } = GRID[layout];

  return (
    <div
      className="flex-1 min-h-0 bg-[#2a2e39]"
      style={{
        display: "grid",
        gap: "1px",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {panels.map((p) => (
        <ChartPanel
          key={p.id}
          panel={p}
          active={p.id === activePanelId}
          showActiveRing={panels.length > 1}
        />
      ))}
    </div>
  );
}
