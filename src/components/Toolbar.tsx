"use client";

import { useStore, useActivePanel } from "@/lib/store";
import { TOOLS } from "@/lib/drawings";

export default function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const clearDrawings = useStore((s) => s.clearDrawings);
  const panel = useActivePanel();

  const btn = (selected: boolean) =>
    `w-8 h-8 grid place-items-center rounded text-base leading-none ${
      selected ? "text-[#2962ff] bg-[#1c2030]" : "text-[#a3a6af] hover:bg-[#1c2030]"
    }`;

  return (
    <div className="flex flex-col items-center gap-1 w-11 py-2 border-r border-[#2a2e39] bg-[#131722] shrink-0">
      <button
        title="Cursor / select"
        onClick={() => setActiveTool(null)}
        className={btn(activeTool === null)}
      >
        ⌖
      </button>
      <div className="h-px w-6 bg-[#2a2e39] my-1" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} — ${t.hint}`}
          onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
          className={btn(activeTool === t.id)}
        >
          {t.icon}
        </button>
      ))}
      <div className="h-px w-6 bg-[#2a2e39] my-1" />
      <button
        title="Delete all drawings on the active chart"
        disabled={panel.drawings.length === 0}
        onClick={() => clearDrawings(panel.id)}
        className={`${btn(false)} disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        🗑
      </button>
    </div>
  );
}
