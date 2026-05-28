"use client";

import Modal from "./Modal";
import { useStore, INDICATOR_META, type IndicatorInstance } from "@/lib/store";

export default function IndicatorDialog({
  panelId,
  instance,
  onClose,
}: {
  panelId: string;
  instance: IndicatorInstance;
  onClose: () => void;
}) {
  const updateIndicator = useStore((s) => s.updateIndicator);
  const removeIndicator = useStore((s) => s.removeIndicator);
  const meta = INDICATOR_META[instance.type];

  return (
    <Modal title={`${meta.label} settings`} onClose={onClose}>
      <div className="space-y-3">
        {Object.keys(instance.params).map((key) => (
          <label key={key} className="flex items-center justify-between text-sm">
            <span className="capitalize text-[#a3a6af]">{key}</span>
            <input
              type="number"
              min={1}
              value={instance.params[key]}
              onChange={(e) =>
                updateIndicator(panelId, instance.id, {
                  params: { [key]: Math.max(1, Number(e.target.value) || 1) },
                })
              }
              className="w-20 bg-[#0c0e15] border border-[#2a2e39] rounded px-2 py-1 text-right tabular-nums"
            />
          </label>
        ))}
        <label className="flex items-center justify-between text-sm">
          <span className="text-[#a3a6af]">Color</span>
          <input
            type="color"
            value={instance.color}
            onChange={(e) => updateIndicator(panelId, instance.id, { color: e.target.value })}
            className="w-10 h-7 bg-transparent cursor-pointer"
          />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span className="text-[#a3a6af]">Visible</span>
          <input
            type="checkbox"
            checked={instance.visible}
            onChange={(e) => updateIndicator(panelId, instance.id, { visible: e.target.checked })}
            className="accent-[#2962ff]"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => {
              removeIndicator(panelId, instance.id);
              onClose();
            }}
            className="flex-1 py-1.5 text-sm rounded border border-[#2a2e39] text-[#ef5350] hover:bg-[#1c2030]"
          >
            Remove
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-sm rounded bg-[#2962ff] text-white hover:bg-[#1e53e5]"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
