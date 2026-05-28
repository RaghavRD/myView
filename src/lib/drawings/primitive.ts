// Custom Lightweight-Charts v5 series primitive that renders every MyView drawing
// type (trend / ray / horizontal / parallel channel / Fibonacci / rectangle / text).
// Coordinates are computed at draw time from the chart's time scale + the series'
// price scale, so drawings track zoom/pan. Rendering uses media (CSS-pixel) space,
// which matches the output of timeToCoordinate / priceToCoordinate.

import type {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  IChartApi,
  ISeriesApi,
  SeriesType,
  Time,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { Drawing, DrawPoint } from "@/lib/store";

/** Standard Fibonacci retracement levels. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Convert a #rrggbb color to rgba() with the given alpha. */
function withAlpha(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

interface XY {
  x: number;
  y: number;
}

class DrawingRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly primitive: DrawingPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const { chart, series, drawing } = this.primitive;
    if (!chart || !series) return;
    const ts = chart.timeScale();

    // Resolve each anchor point to pixel coordinates; null if off the scale.
    const pts: (XY | null)[] = drawing.points.map((p: DrawPoint) => {
      const x = ts.timeToCoordinate(p.time as Time);
      const y = series.priceToCoordinate(p.value);
      return x == null || y == null ? null : { x, y };
    });

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.strokeStyle = drawing.color;
      ctx.fillStyle = drawing.color;
      ctx.lineWidth = drawing.width;
      ctx.font = "12px -apple-system, system-ui, sans-serif";

      const W = mediaSize.width;
      switch (drawing.type) {
        case "trend":
          if (pts[0] && pts[1]) segment(ctx, pts[0], pts[1]);
          break;

        case "ray":
          if (pts[0] && pts[1]) {
            const end = extendToEdge(pts[0], pts[1], W);
            segment(ctx, pts[0], end);
          }
          break;

        case "hline": {
          // Only the price matters; span the full pane width.
          const y = pts[0]?.y;
          if (y != null) {
            segment(ctx, { x: 0, y }, { x: W, y });
            label(ctx, drawing.points[0].value.toFixed(2), 4, y - 4, drawing.color);
          }
          break;
        }

        case "channel":
          if (pts[0] && pts[1] && pts[2]) {
            // Parallel offset = vertical pixel gap between p3 and the p1->p2 line at p3.x.
            const dy = pts[2].y - lineYAt(pts[0], pts[1], pts[2].x);
            const a2 = { x: pts[0].x, y: pts[0].y + dy };
            const b2 = { x: pts[1].x, y: pts[1].y + dy };
            ctx.fillStyle = withAlpha(drawing.color, 0.08);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(a2.x, a2.y);
            ctx.closePath();
            ctx.fill();
            segment(ctx, pts[0], pts[1]);
            segment(ctx, a2, b2);
          }
          break;

        case "fib":
          if (pts[0] && pts[1]) {
            const p0 = drawing.points[0].value;
            const p1 = drawing.points[1].value;
            const xL = Math.min(pts[0].x, pts[1].x);
            for (const lvl of FIB_LEVELS) {
              const price = p0 + (p1 - p0) * lvl;
              const y = series.priceToCoordinate(price);
              if (y == null) continue;
              segment(ctx, { x: xL, y }, { x: W, y });
              label(ctx, `${(lvl * 100).toFixed(1)}%  ${price.toFixed(2)}`, xL + 4, y - 3, drawing.color);
            }
          }
          break;

        case "rect":
          if (pts[0] && pts[1]) {
            const x = Math.min(pts[0].x, pts[1].x);
            const y = Math.min(pts[0].y, pts[1].y);
            const w = Math.abs(pts[1].x - pts[0].x);
            const h = Math.abs(pts[1].y - pts[0].y);
            ctx.fillStyle = withAlpha(drawing.color, 0.12);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          }
          break;

        case "text":
          if (pts[0]) label(ctx, drawing.text ?? "Text", pts[0].x, pts[0].y, drawing.color);
          break;
      }
      ctx.restore();
    });
  }
}

function segment(ctx: CanvasRenderingContext2D, a: XY, b: XY): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** y on the line through a,b at the given x. */
function lineYAt(a: XY, b: XY, x: number): number {
  if (b.x === a.x) return a.y;
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
}

/** Extend the ray a->b to the right pane edge (or left if it points left). */
function extendToEdge(a: XY, b: XY, width: number): XY {
  const targetX = b.x >= a.x ? width : 0;
  return { x: targetX, y: lineYAt(a, b, targetX) };
}

class DrawingPaneView implements IPrimitivePaneView {
  private readonly _renderer: DrawingRenderer;
  constructor(primitive: DrawingPrimitive) {
    this._renderer = new DrawingRenderer(primitive);
  }
  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

/** One attachable primitive per Drawing. Re-create when the drawing's data changes. */
export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  chart: IChartApi | null = null;
  series: ISeriesApi<SeriesType> | null = null;
  private readonly _views: DrawingPaneView[];

  constructor(public drawing: Drawing) {
    this._views = [new DrawingPaneView(this)];
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<SeriesType>;
  }
  detached(): void {
    this.chart = null;
    this.series = null;
  }
  updateAllViews(): void {
    /* coordinates are recomputed on every draw() */
  }
  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}
