"use client";

import { useStore, useActivePanel, type ToolId } from "@/lib/store";
import { TOOLS } from "@/lib/drawings";

/* TradingView-style line icons. 24×24, stroke = currentColor so the active/hover
   colors flow through from the button. */
const S = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function CursorIcon() {
  return (
    <svg {...S}>
      <path d="M12 3v18M3 12h18" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

const TOOL_ICON: Record<ToolId, React.ReactNode> = {
  trend: (
    <svg {...S}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="5" r="2" />
    </svg>
  ),
  ray: (
    <svg {...S}>
      <line x1="4" y1="20" x2="20" y2="4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  ),
  hline: (
    <svg {...S}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="9" cy="12" r="2" />
    </svg>
  ),
  channel: (
    <svg {...S}>
      <line x1="4" y1="16" x2="17" y2="5" />
      <line x1="7" y1="19" x2="20" y2="8" />
    </svg>
  ),
  fib: (
    <svg {...S}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="10.5" x2="20" y2="10.5" />
      <line x1="4" y1="14" x2="20" y2="14" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  ),
  rect: (
    <svg {...S}>
      <rect x="4" y="6" width="16" height="12" rx="1" />
    </svg>
  ),
  text: (
    <svg {...S}>
      <path d="M5 6h14M12 6v12" />
    </svg>
  ),
};

function TrashIcon() {
  return (
    <svg {...S}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export default function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const clearDrawings = useStore((s) => s.clearDrawings);
  const panel = useActivePanel();

  const btn = (selected: boolean) =>
    `w-9 h-9 grid place-items-center rounded ${
      selected
        ? "text-[#2962ff] bg-[#1c2030]"
        : "text-[#b2b5be] hover:bg-[#1c2030] hover:text-[#d1d4dc]"
    }`;

  return (
    <div className="flex flex-col items-center gap-0.5 w-12 py-2 border-r border-[#2a2e39] bg-[#131722] shrink-0">
      <button
        title="Cursor / select (Esc)"
        onClick={() => setActiveTool(null)}
        className={btn(activeTool === null)}
      >
        <CursorIcon />
      </button>
      <div className="h-px w-6 bg-[#2a2e39] my-1" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} — ${t.hint}`}
          onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
          className={btn(activeTool === t.id)}
        >
          {TOOL_ICON[t.id]}
        </button>
      ))}
      <div className="h-px w-6 bg-[#2a2e39] my-1" />
      <button
        title="Delete all drawings on the active chart"
        disabled={panel.drawings.length === 0}
        onClick={() => clearDrawings(panel.id)}
        className={`${btn(false)} disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}
