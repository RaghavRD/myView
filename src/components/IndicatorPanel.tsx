"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, useActivePanel, INDICATOR_META, type IndicatorId } from "@/lib/store";
import IndicatorDialog from "./IndicatorDialog";

const ADD_ORDER: IndicatorId[] = ["sma", "ema", "bb", "rsi", "macd"];

export default function IndicatorPanel() {
  const panel = useActivePanel();
  const addIndicator = useStore((s) => s.addIndicator);
  const removeIndicator = useStore((s) => s.removeIndicator);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const editingInst = panel.indicators.find((i) => i.id === editing) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1.5 text-sm rounded border border-[#2a2e39] hover:bg-[#1c2030]"
      >
        Indicators{panel.indicators.length ? ` (${panel.indicators.length})` : ""} ▾
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-60 bg-[#131722] border border-[#2a2e39] rounded shadow-xl py-1">
          <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wide text-[#787b86]">
            Add to active chart
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {ADD_ORDER.map((id) => (
              <button
                key={id}
                onClick={() => addIndicator(panel.id, id)}
                className="px-2 py-1 text-xs rounded border border-[#2a2e39] hover:bg-[#1c2030]"
              >
                + {INDICATOR_META[id].label}
              </button>
            ))}
          </div>

          {panel.indicators.length > 0 && (
            <>
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wide text-[#787b86] border-t border-[#2a2e39]">
                Active
              </div>
              {panel.indicators.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#1c2030] group"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: i.color, opacity: i.visible ? 1 : 0.3 }}
                  />
                  <button
                    onClick={() => setEditing(i.id)}
                    className="flex-1 text-left truncate"
                    title="Edit settings"
                  >
                    {INDICATOR_META[i.type].label}{" "}
                    <span className="text-[#787b86]">
                      ({Object.values(i.params).join(", ")})
                    </span>
                  </button>
                  <button
                    onClick={() => setEditing(i.id)}
                    className="text-[#787b86] hover:text-white opacity-0 group-hover:opacity-100"
                    title="Settings"
                  >
                    ⚙
                  </button>
                  <button
                    onClick={() => removeIndicator(panel.id, i.id)}
                    className="text-[#787b86] hover:text-[#ef5350]"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {editingInst && (
        <IndicatorDialog
          panelId={panel.id}
          instance={editingInst}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
