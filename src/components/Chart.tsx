"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  type MouseEventParams,
  type Time,
  type LineWidth,
} from "lightweight-charts";
import type { Candle } from "@/lib/provider/types";
import {
  useStore,
  POINTS_PER_TOOL,
  uid,
  type Panel,
  type DrawPoint,
} from "@/lib/store";
import { sma, ema, rsi, macd, bollinger } from "@/lib/indicators";
import { DrawingPrimitive } from "@/lib/drawings";

type AnySeries = ISeriesApi<SeriesType>;
type LineDatum = { time: UTCTimestamp; value: number };

/** A series plus how to (re)derive its data from candles — lets us update data
 *  in place on every poll instead of tearing the whole chart down (no flicker). */
interface Producer {
  series: AnySeries;
  compute: (candles: Candle[]) => unknown[];
}

function ensurePane(chart: IChartApi, idx: number) {
  while (chart.panes().length <= idx) chart.addPane();
}

function setData(series: AnySeries, data: unknown[]) {
  (series.setData as unknown as (d: unknown[]) => void)(data);
}

const closesOf = (c: Candle[]) => c.map((x) => x.close);

function toLine(candles: Candle[], vals: (number | null)[]): LineDatum[] {
  const d: LineDatum[] = [];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v != null) d.push({ time: candles[i].time as UTCTimestamp, value: v });
  }
  return d;
}

export default function Chart({
  panel,
  candles,
}: {
  panel: Panel;
  candles: Candle[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const producersRef = useRef<Producer[]>([]);
  const mainRef = useRef<AnySeries | null>(null);
  const viewKeyRef = useRef<string>("");
  const latestCandlesRef = useRef<Candle[]>(candles);

  // refs the once-registered click handler reads for latest values
  const panelIdRef = useRef(panel.id);
  const pendingRef = useRef<DrawPoint[]>([]);
  useEffect(() => {
    panelIdRef.current = panel.id;
  }, [panel.id]);

  const { chartType, indicators, drawings, appearance } = panel;

  // create the chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: appearance.background },
        textColor: "#d1d4dc",
        panes: { separatorColor: "#2a2e39", separatorHoverColor: "#363a45" },
      },
      grid: {
        vertLines: { color: appearance.grid },
        horzLines: { color: appearance.grid },
      },
      rightPriceScale: { borderColor: "#2a2e39" },
      timeScale: { borderColor: "#2a2e39", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chartRef.current = chart;

    const onClick = (param: MouseEventParams<Time>) => {
      const st = useStore.getState();
      const panelId = panelIdRef.current;
      if (st.activePanelId !== panelId) st.setActivePanel(panelId);

      const tool = st.activeTool;
      if (!tool) return;
      const main = mainRef.current;
      if (!main || !param.point || param.time == null) return;
      const t = typeof param.time === "number" ? param.time : NaN;
      if (Number.isNaN(t)) return;
      const price = main.coordinateToPrice(param.point.y);
      if (price == null) return;

      const pending = [...pendingRef.current, { time: t, value: price }];
      if (pending.length < POINTS_PER_TOOL[tool]) {
        pendingRef.current = pending;
        return;
      }

      let text: string | undefined;
      if (tool === "text") {
        text = window.prompt("Label text:", "")?.trim() || undefined;
        if (!text) {
          pendingRef.current = [];
          return;
        }
      }
      st.addDrawing(panelId, {
        id: uid("draw"),
        type: tool,
        points: pending,
        color: "#d1d4dc",
        width: 1,
        text,
      });
      pendingRef.current = [];
      st.setActiveTool(null);
    };
    chart.subscribeClick(onClick);

    return () => {
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      producersRef.current = [];
      mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live-apply background / grid without recreating the chart
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: appearance.background } },
      grid: {
        vertLines: { color: appearance.grid },
        horzLines: { color: appearance.grid },
      },
    });
  }, [appearance.background, appearance.grid]);

  // STRUCTURAL: (re)build the set of series + drawings only when the *structure*
  // changes (chart type, indicator set, drawings, candle colors). NOT on every
  // candle tick — that is what used to tear the chart down 60×/min on crypto.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const prevRange = chart.timeScale().getVisibleLogicalRange();

    producersRef.current.forEach((p) => {
      try {
        chart.removeSeries(p.series);
      } catch {}
    });
    producersRef.current = [];
    mainRef.current = null;
    for (let i = chart.panes().length - 1; i >= 1; i--) {
      try {
        chart.removePane(i);
      } catch {}
    }

    const producers: Producer[] = [];
    const add = (series: AnySeries, compute: Producer["compute"]) => {
      producers.push({ series, compute });
      return series;
    };

    // ---- main price series ----
    if (chartType === "line") {
      mainRef.current = add(
        chart.addSeries(LineSeries, { color: appearance.lineColor, lineWidth: 2 }),
        (c) => c.map((x) => ({ time: x.time as UTCTimestamp, value: x.close })),
      );
    } else if (chartType === "area") {
      mainRef.current = add(
        chart.addSeries(AreaSeries, {
          lineColor: appearance.lineColor,
          topColor: "rgba(41,98,255,0.30)",
          bottomColor: "rgba(41,98,255,0.02)",
          lineWidth: 2,
        }),
        (c) => c.map((x) => ({ time: x.time as UTCTimestamp, value: x.close })),
      );
    } else {
      mainRef.current = add(
        chart.addSeries(CandlestickSeries, {
          upColor: appearance.upColor,
          downColor: appearance.downColor,
          borderUpColor: appearance.upColor,
          borderDownColor: appearance.downColor,
          wickUpColor: appearance.upColor,
          wickDownColor: appearance.downColor,
        }),
        (c) =>
          c.map((x) => ({
            time: x.time as UTCTimestamp,
            open: x.open,
            high: x.high,
            low: x.low,
            close: x.close,
          })),
      );
    }

    // ---- volume (own overlay scale, pane 0) ----
    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    add(vol, (c) =>
      c.map((x) => ({
        time: x.time as UTCTimestamp,
        value: x.volume,
        color: x.close >= x.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
      })),
    );

    // ---- indicator instances ----
    let nextPane = 1;
    for (const ind of indicators) {
      if (!ind.visible) continue;
      const prm = ind.params;
      const lineOpts = {
        color: ind.color,
        lineWidth: 2 as LineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      if (ind.type === "sma") {
        add(chart.addSeries(LineSeries, lineOpts), (c) =>
          toLine(c, sma(closesOf(c), prm.period)),
        );
      } else if (ind.type === "ema") {
        add(chart.addSeries(LineSeries, lineOpts), (c) =>
          toLine(c, ema(closesOf(c), prm.period)),
        );
      } else if (ind.type === "bb") {
        const band = { ...lineOpts, lineWidth: 1 as LineWidth };
        add(chart.addSeries(LineSeries, band), (c) =>
          toLine(c, bollinger(closesOf(c), prm.period, prm.mult).upper),
        );
        add(chart.addSeries(LineSeries, lineOpts), (c) =>
          toLine(c, bollinger(closesOf(c), prm.period, prm.mult).middle),
        );
        add(chart.addSeries(LineSeries, band), (c) =>
          toLine(c, bollinger(closesOf(c), prm.period, prm.mult).lower),
        );
      } else if (ind.type === "rsi") {
        const pane = nextPane++;
        ensurePane(chart, pane);
        const s = chart.addSeries(LineSeries, lineOpts, pane);
        for (const lvl of [70, 30]) {
          s.createPriceLine({
            price: lvl,
            color: "#2a2e39",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: String(lvl),
          });
        }
        add(s, (c) => toLine(c, rsi(closesOf(c), prm.period)));
      } else if (ind.type === "macd") {
        const pane = nextPane++;
        ensurePane(chart, pane);
        add(
          chart.addSeries(
            HistogramSeries,
            { priceLineVisible: false, lastValueVisible: false },
            pane,
          ),
          (c) => {
            const m = macd(closesOf(c), prm.fast, prm.slow, prm.signal);
            const out: { time: UTCTimestamp; value: number; color: string }[] = [];
            for (let i = 0; i < m.histogram.length; i++) {
              const v = m.histogram[i];
              if (v != null)
                out.push({
                  time: c[i].time as UTCTimestamp,
                  value: v,
                  color: v >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
                });
            }
            return out;
          },
        );
        add(chart.addSeries(LineSeries, lineOpts, pane), (c) =>
          toLine(c, macd(closesOf(c), prm.fast, prm.slow, prm.signal).macd),
        );
        add(
          chart.addSeries(
            LineSeries,
            { ...lineOpts, color: "#ff6d00" },
            pane,
          ),
          (c) => toLine(c, macd(closesOf(c), prm.fast, prm.slow, prm.signal).signal),
        );
      }
    }

    producersRef.current = producers;

    // ---- drawings ----
    const main = mainRef.current;
    if (main) {
      for (const d of drawings) {
        try {
          main.attachPrimitive(new DrawingPrimitive(d));
        } catch {}
      }
    }

    // fill data immediately from the latest candles we have
    const cands = latestCandlesRef.current;
    for (const p of producers) {
      try {
        setData(p.series, p.compute(cands));
      } catch (e) {
        console.error("[myview] indicator/series setData failed", e);
      }
    }
    // structural changes keep the current zoom
    if (prevRange) chart.timeScale().setVisibleLogicalRange(prevRange);
  }, [
    chartType,
    indicators,
    drawings,
    appearance.upColor,
    appearance.downColor,
    appearance.lineColor,
  ]);

  // DATA: on every candle change, update series data in place (no teardown =
  // no flicker). Fit the view only when the symbol/timeframe actually changed.
  useEffect(() => {
    latestCandlesRef.current = candles;
    const chart = chartRef.current;
    if (!chart) return;
    for (const p of producersRef.current) {
      try {
        setData(p.series, p.compute(candles));
      } catch {}
    }
    const key = `${panel.symbol}|${panel.timeframe}`;
    if (key !== viewKeyRef.current) {
      if (candles.length) chart.timeScale().fitContent();
      viewKeyRef.current = key;
    }
  }, [candles, panel.symbol, panel.timeframe]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
