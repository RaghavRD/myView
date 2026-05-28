"use client";

import { useState } from "react";
import Modal from "./Modal";
import {
  useStore,
  useActivePanel,
  DEFAULT_APPEARANCE,
  type PanelAppearance,
} from "@/lib/store";

const FIELDS: { key: keyof PanelAppearance; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "grid", label: "Grid lines" },
  { key: "upColor", label: "Up candle" },
  { key: "downColor", label: "Down candle" },
  { key: "lineColor", label: "Line / area" },
];

export default function SettingsDialog() {
  const panel = useActivePanel();
  const setPanelAppearance = useStore((s) => s.setPanelAppearance);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Chart appearance"
        className="px-2.5 py-1.5 text-sm rounded border border-[#2a2e39] hover:bg-[#1c2030]"
      >
        ⚙
      </button>
      {open && (
        <Modal title="Chart appearance" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center justify-between text-sm">
                <span className="text-[#a3a6af]">{f.label}</span>
                <input
                  type="color"
                  value={panel.appearance[f.key]}
                  onChange={(e) => setPanelAppearance(panel.id, { [f.key]: e.target.value })}
                  className="w-10 h-7 bg-transparent cursor-pointer"
                />
              </label>
            ))}
            <button
              onClick={() => setPanelAppearance(panel.id, DEFAULT_APPEARANCE)}
              className="w-full py-1.5 text-sm rounded border border-[#2a2e39] text-[#a3a6af] hover:bg-[#1c2030]"
            >
              Reset to default
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
