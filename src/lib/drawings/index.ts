import type { ToolId } from "@/lib/store";

export { DrawingPrimitive, FIB_LEVELS } from "./primitive";

/** Toolbar metadata. `icon` is a single glyph rendered in the left toolbar. */
export const TOOLS: { id: ToolId; label: string; icon: string; hint: string }[] = [
  { id: "trend", label: "Trend line", icon: "╱", hint: "Click two points" },
  { id: "ray", label: "Ray", icon: "⟋", hint: "Click two points; extends to the edge" },
  { id: "hline", label: "Horizontal line", icon: "─", hint: "Click a price level" },
  { id: "channel", label: "Parallel channel", icon: "⫽", hint: "Click two points, then a third for width" },
  { id: "fib", label: "Fib retracement", icon: "≣", hint: "Click two swing points" },
  { id: "rect", label: "Rectangle", icon: "▭", hint: "Click two opposite corners" },
  { id: "text", label: "Text", icon: "T", hint: "Click to place a label" },
];
