"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore, useActivePanel, INDICATOR_META, type IndicatorId } from "@/lib/store";
import IndicatorDialog from "./IndicatorDialog";

const ADD_ORDER: IndicatorId[] = ["sma", "ema", "bb", "rsi", "macd"];

export default function IndicatorPanel() {
  const panel = useActivePanel();
  const addIndicator = useStore((s) => s.addIndicator);
  const removeIndicator = useStore((s) => s.removeIndicator);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // anchor the portal menu to the button (the header clips overflow, so the
  // menu is rendered to <body> with fixed positioning instead)
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onResize = () => place();
    document.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const editingInst = panel.indicators.find((i) => i.id === editing) ?? null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        className="px-2.5 py-1.5 text-sm rounded border border-[#2a2e39] hover:bg-[#1c2030]"
      >
        Indicators{panel.indicators.length ? ` (${panel.indicators.length})` : ""} ▾
      </button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: coords.top, right: coords.right }}
            className="z-[100] w-60 bg-[#131722] border border-[#2a2e39] rounded shadow-xl py-1"
          >
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
          </div>,
          document.body,
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
