"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, type LayoutId } from "@/lib/store";

const OPTIONS: { id: LayoutId; label: string; cols: number; rows: number }[] = [
  { id: "1", label: "Single", cols: 1, rows: 1 },
  { id: "2h", label: "Two columns", cols: 2, rows: 1 },
  { id: "2v", label: "Two rows", cols: 1, rows: 2 },
  { id: "3", label: "Three columns", cols: 3, rows: 1 },
  { id: "4", label: "Grid 2×2", cols: 2, rows: 2 },
  { id: "6", label: "Grid 3×2", cols: 3, rows: 2 },
];

function MiniGrid({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div
      className="w-4 h-4"
      style={{
        display: "grid",
        gap: "1px",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <div key={i} className="bg-current rounded-[1px]" />
      ))}
    </div>
  );
}

export default function LayoutPicker() {
  const layout = useStore((s) => s.layout);
  const setLayout = useStore((s) => s.setLayout);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === layout) ?? OPTIONS[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Layout"
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm rounded border border-[#2a2e39] hover:bg-[#1c2030] text-[#a3a6af]"
      >
        <MiniGrid cols={current.cols} rows={current.rows} />▾
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-44 bg-[#131722] border border-[#2a2e39] rounded shadow-xl py-1">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setLayout(o.id);
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-sm hover:bg-[#1c2030] ${
                o.id === layout ? "text-[#2962ff]" : "text-[#d1d4dc]"
              }`}
            >
              <MiniGrid cols={o.cols} rows={o.rows} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
