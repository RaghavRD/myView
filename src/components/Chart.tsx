"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { Candle, Market, Timeframe } from "@/lib/provider/types";
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

/** Candle duration in seconds, for the price-axis countdown. Weekly/monthly omitted. */
const TF_SECONDS: Partial<Record<Timeframe, number>> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "1D": 86400,
};

/** Human source label for the legend (TradingView shows the exchange here). */
function sourceLabel(market: Market): string {
  return market === "crypto" ? "Binance" : "NSE";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Seconds remaining until the current candle closes, formatted m:ss / h:mm:ss. */
function countdownFor(tf: Timeframe): string {
  const dur = TF_SECONDS[tf];
  if (!dur) return "";
  const now = Math.floor(Date.now() / 1000);
  const rem = dur - (now % dur);
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = rem % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

/** Price formatter: more decimals for sub-dollar assets, comma grouping above. */
function fmtPrice(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const max = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return n.toLocaleString("en-US", { maximumFractionDigits: max, minimumFractionDigits: 2 });
}

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
  market,
}: {
  panel: Panel;
  candles: Candle[];
  market: Market;
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

  // overlay state: crosshair-hovered candle time, last-price y-coordinate, countdown
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [priceY, setPriceY] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");

  const { chartType, indicators, drawings, appearance } = panel;

  // glue the right-axis price box to the last close's pixel position
  const syncPrice = useCallback(() => {
    const s = mainRef.current;
    const c = latestCandlesRef.current;
    if (!s || !c.length) {
      setPriceY(null);
      return;
    }
    const y = s.priceToCoordinate(c[c.length - 1].close);
    setPriceY(y == null ? null : y);
  }, []);

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

    // track the candle under the crosshair for the legend (debounced by time)
    let lastHover: number | null = null;
    const onMove = (param: MouseEventParams<Time>) => {
      const t = param.time != null && typeof param.time === "number" ? param.time : null;
      if (t !== lastHover) {
        lastHover = t;
        setHoverTime(t);
      }
    };
    chart.subscribeCrosshairMove(onMove);

    // keep the price box pinned as the user scrolls / zooms
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncPrice);

    return () => {
      chart.unsubscribeClick(onClick);
      chart.unsubscribeCrosshairMove(onMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncPrice);
      chart.remove();
      chartRef.current = null;
      producersRef.current = [];
      mainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drive the countdown (1s) and re-pin the price box each tick
  useEffect(() => {
    const tick = () => {
      setCountdown(countdownFor(panel.timeframe));
      syncPrice();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [panel.timeframe, syncPrice]);

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
        chart.addSeries(LineSeries, {
          color: appearance.lineColor,
          lineWidth: 2,
          lastValueVisible: false,
        }),
        (c) => c.map((x) => ({ time: x.time as UTCTimestamp, value: x.close })),
      );
    } else if (chartType === "area") {
      mainRef.current = add(
        chart.addSeries(AreaSeries, {
          lineColor: appearance.lineColor,
          topColor: "rgba(41,98,255,0.30)",
          bottomColor: "rgba(41,98,255,0.02)",
          lineWidth: 2,
          lastValueVisible: false,
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
          lastValueVisible: false,
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
    syncPrice();
  }, [candles, panel.symbol, panel.timeframe, syncPrice]);

  // ---- legend (OHLC of the hovered candle, else the last candle) ----
  const last = candles.length ? candles[candles.length - 1] : null;
  const shown =
    (hoverTime != null ? candles.find((c) => c.time === hoverTime) : null) ?? last;
  const shownIdx = shown ? candles.findIndex((c) => c.time === shown.time) : -1;
  const prevClose = shownIdx > 0 ? candles[shownIdx - 1].close : shown?.open ?? 0;
  const change = shown ? shown.close - prevClose : 0;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const barUp = shown ? shown.close >= shown.open : true;
  const ohlcColor = barUp ? appearance.upColor : appearance.downColor;
  const lastUp = last ? last.close >= last.open : true;

  const ohlc = (label: string, value: number | undefined) => (
    <span className="tabular-nums">
      <span className="text-[#787b86]">{label}</span>
      <span style={{ color: ohlcColor }}>{fmtPrice(value)}</span>
    </span>
  );

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* top-left legend — symbol · timeframe · source + live OHLC */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-0.5 pointer-events-none select-none">
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#d1d4dc]">
          <span>{panel.name}</span>
          <span className="text-[#787b86]">·</span>
          <span className="text-[#787b86]">{panel.timeframe}</span>
          <span className="text-[#787b86]">·</span>
          <span className="text-[#787b86]">{sourceLabel(market)}</span>
        </div>
        {shown && (
          <div className="flex items-center gap-2 text-[12px]">
            {ohlc("O", shown.open)}
            {ohlc("H", shown.high)}
            {ohlc("L", shown.low)}
            {ohlc("C", shown.close)}
            <span className="tabular-nums" style={{ color: ohlcColor }}>
              {change >= 0 ? "+" : ""}
              {fmtPrice(change)} ({change >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* right price-axis box: last price + countdown to candle close */}
      {last && priceY != null && (
        <div
          className="absolute right-0 z-10 flex flex-col items-center px-1.5 py-0.5 rounded-sm pointer-events-none select-none text-white"
          style={{
            top: priceY,
            transform: "translateY(-50%)",
            background: lastUp ? appearance.upColor : appearance.downColor,
            minWidth: 60,
          }}
        >
          <span className="text-[12px] font-semibold leading-tight tabular-nums">
            {fmtPrice(last.close)}
          </span>
          {countdown && (
            <span className="text-[10px] leading-tight tabular-nums opacity-90">
              {countdown}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
