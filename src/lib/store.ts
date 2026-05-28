"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ChartType, Market, SymbolInfo, Timeframe } from "./provider/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IndicatorId = "sma" | "ema" | "rsi" | "macd" | "bb";

/** Layout ids map to a fixed number of panels (see LAYOUT_CELLS). */
export type LayoutId = "1" | "2v" | "2h" | "3" | "4" | "6";

/** Drawing tools available in the left toolbar. */
export type ToolId =
  | "trend"
  | "ray"
  | "hline"
  | "channel"
  | "fib"
  | "rect"
  | "text";

export type DrawingType = ToolId;

export interface DrawPoint {
  /** unix seconds (UTC) */
  time: number;
  value: number;
}

/** Back-compat alias — the original single-tool code used `TrendPoint`. */
export type TrendPoint = DrawPoint;

export interface Drawing {
  id: string;
  type: DrawingType;
  /** Anchor points. Count depends on type (see POINTS_PER_TOOL). */
  points: DrawPoint[];
  color: string;
  width: number;
  /** text label content (type === "text") */
  text?: string;
}

export interface IndicatorInstance {
  id: string;
  type: IndicatorId;
  params: Record<string, number>;
  color: string;
  visible: boolean;
}

export interface PanelAppearance {
  background: string;
  grid: string;
  upColor: string;
  downColor: string;
  lineColor: string;
}

export interface Panel {
  id: string;
  /** the symbol currently shown (for the workspace's active market) */
  symbol: string;
  name: string;
  /** remembered symbol per market, so toggling Stocks/Crypto restores each side */
  symbolMemory: Partial<Record<Market, { symbol: string; name: string }>>;
  timeframe: Timeframe;
  chartType: ChartType;
  indicators: IndicatorInstance[];
  drawings: Drawing[];
  appearance: PanelAppearance;
}

export interface Watchlist {
  id: string;
  name: string;
  market: Market;
  symbols: SymbolInfo[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const LAYOUT_CELLS: Record<LayoutId, number> = {
  "1": 1,
  "2v": 2,
  "2h": 2,
  "3": 3,
  "4": 4,
  "6": 6,
};

/** How many clicks/anchors each drawing tool captures before it commits. */
export const POINTS_PER_TOOL: Record<ToolId, number> = {
  trend: 2,
  ray: 2,
  hline: 1,
  channel: 3,
  fib: 2,
  rect: 2,
  text: 1,
};

export const INDICATOR_META: Record<
  IndicatorId,
  { label: string; params: Record<string, number>; color: string; pane: boolean }
> = {
  sma: { label: "SMA", params: { period: 20 }, color: "#f0b90b", pane: false },
  ema: { label: "EMA", params: { period: 50 }, color: "#e040fb", pane: false },
  bb: { label: "Bollinger Bands", params: { period: 20, mult: 2 }, color: "#26c6da", pane: false },
  rsi: { label: "RSI", params: { period: 14 }, color: "#a78bfa", pane: true },
  macd: { label: "MACD", params: { fast: 12, slow: 26, signal: 9 }, color: "#2962ff", pane: true },
};

export const DEFAULT_APPEARANCE: PanelAppearance = {
  background: "#0c0e15",
  grid: "#1c2030",
  upColor: "#26a69a",
  downColor: "#ef5350",
  lineColor: "#2962ff",
};

/** Default symbol shown when a market has no remembered symbol yet. */
const DEFAULT_SYMBOL: Record<Market, { symbol: string; name: string }> = {
  stocks: { symbol: "^NSEI", name: "NIFTY 50" },
  crypto: { symbol: "BTCUSDT", name: "BTC / USDT" },
};

const DEFAULT_STOCKS: SymbolInfo[] = [
  { symbol: "^NSEI", name: "NIFTY 50", exchange: "NSE", type: "INDEX", market: "stocks" },
  { symbol: "^BSESN", name: "SENSEX", exchange: "BSE", type: "INDEX", market: "stocks" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", exchange: "NSE", type: "EQUITY", market: "stocks" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE", type: "EQUITY", market: "stocks" },
  { symbol: "INFY.NS", name: "Infosys", exchange: "NSE", type: "EQUITY", market: "stocks" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank", exchange: "NSE", type: "EQUITY", market: "stocks" },
];

const DEFAULT_CRYPTO: SymbolInfo[] = [
  { symbol: "BTCUSDT", name: "BTC / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
  { symbol: "ETHUSDT", name: "ETH / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
  { symbol: "SOLUSDT", name: "SOL / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
  { symbol: "BNBUSDT", name: "BNB / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
  { symbol: "XRPUSDT", name: "XRP / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
  { symbol: "DOGEUSDT", name: "DOGE / USDT", exchange: "Binance", type: "CRYPTO", market: "crypto" },
];

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

let _seq = 0;
/** SSR-safe unique id (avoids crypto.randomUUID timing issues during hydration). */
export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function makeIndicator(type: IndicatorId): IndicatorInstance {
  const m = INDICATOR_META[type];
  return { id: uid("ind"), type, params: { ...m.params }, color: m.color, visible: true };
}

function makePanel(base?: Partial<Panel>): Panel {
  return {
    id: uid("panel"),
    symbol: base?.symbol ?? DEFAULT_SYMBOL.stocks.symbol,
    name: base?.name ?? DEFAULT_SYMBOL.stocks.name,
    symbolMemory: base?.symbolMemory ? { ...base.symbolMemory } : {},
    timeframe: base?.timeframe ?? "1D",
    chartType: base?.chartType ?? "candlestick",
    indicators: [],
    drawings: [],
    appearance: base?.appearance ? { ...base.appearance } : { ...DEFAULT_APPEARANCE },
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ViewState {
  market: Market;
  layout: LayoutId;
  panels: Panel[];
  activePanelId: string;
  /** selected drawing tool; null = cursor/select. Session-only (not persisted). */
  activeTool: ToolId | null;
  watchlists: Watchlist[];
  /** active watchlist id per market */
  activeWatchlistId: Record<Market, string>;

  setMarket: (m: Market) => void;
  setLayout: (l: LayoutId) => void;
  setActivePanel: (id: string) => void;
  setActiveTool: (t: ToolId | null) => void;

  setPanelSymbol: (id: string, s: SymbolInfo) => void;
  setPanelTimeframe: (id: string, tf: Timeframe) => void;
  setPanelChartType: (id: string, c: ChartType) => void;
  setPanelAppearance: (id: string, patch: Partial<PanelAppearance>) => void;

  addIndicator: (panelId: string, type: IndicatorId) => void;
  updateIndicator: (panelId: string, indId: string, patch: Partial<IndicatorInstance>) => void;
  removeIndicator: (panelId: string, indId: string) => void;

  addDrawing: (panelId: string, d: Drawing) => void;
  updateDrawing: (panelId: string, drawId: string, patch: Partial<Drawing>) => void;
  removeDrawing: (panelId: string, drawId: string) => void;
  clearDrawings: (panelId: string) => void;

  createWatchlist: (name: string) => void;
  deleteWatchlist: (id: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  setActiveWatchlist: (id: string) => void;
  addToWatchlist: (listId: string, s: SymbolInfo) => void;
  removeFromWatchlist: (listId: string, symbol: string) => void;
  /** add to the active watchlist of the symbol's market */
  addToActiveWatchlist: (s: SymbolInfo) => void;
}

const firstPanel = makePanel();
const initialStocksWL: Watchlist = { id: uid("wl"), name: "Stocks", market: "stocks", symbols: DEFAULT_STOCKS };
const initialCryptoWL: Watchlist = { id: uid("wl"), name: "Crypto", market: "crypto", symbols: DEFAULT_CRYPTO };

export const useStore = create<ViewState>()(
  persist(
    (set, get) => {
      const patchPanel = (id: string, fn: (p: Panel) => Panel) =>
        set((s) => ({ panels: s.panels.map((p) => (p.id === id ? fn(p) : p)) }));

      return {
        market: "stocks",
        layout: "1",
        panels: [firstPanel],
        activePanelId: firstPanel.id,
        activeTool: null,
        watchlists: [initialStocksWL, initialCryptoWL],
        activeWatchlistId: { stocks: initialStocksWL.id, crypto: initialCryptoWL.id },

        setMarket: (m) =>
          set((s) => {
            if (s.market === m) return {};
            // stash each panel's current symbol under the old market, then restore
            // the symbol it last used in the new market (or that market's default).
            const panels = s.panels.map((p) => {
              const symbolMemory = {
                ...p.symbolMemory,
                [s.market]: { symbol: p.symbol, name: p.name },
              };
              const next = symbolMemory[m] ?? DEFAULT_SYMBOL[m];
              return { ...p, symbol: next.symbol, name: next.name, symbolMemory };
            });
            return { market: m, panels };
          }),

        setLayout: (l) =>
          set((s) => {
            const want = LAYOUT_CELLS[l];
            let panels = s.panels.slice(0, want);
            if (panels.length < want) {
              const seed = s.panels.find((p) => p.id === s.activePanelId) ?? s.panels[0];
              while (panels.length < want) {
                panels = [
                  ...panels,
                  makePanel({
                    symbol: seed.symbol,
                    name: seed.name,
                    symbolMemory: seed.symbolMemory,
                    timeframe: seed.timeframe,
                    chartType: seed.chartType,
                    appearance: seed.appearance,
                  }),
                ];
              }
            }
            const activePanelId = panels.some((p) => p.id === s.activePanelId)
              ? s.activePanelId
              : panels[0].id;
            return { layout: l, panels, activePanelId };
          }),

        setActivePanel: (id) => set({ activePanelId: id }),
        setActiveTool: (t) => set({ activeTool: t }),

        setPanelSymbol: (id, sym) =>
          patchPanel(id, (p) => ({
            ...p,
            symbol: sym.symbol,
            name: sym.name,
            symbolMemory: { ...p.symbolMemory, [sym.market]: { symbol: sym.symbol, name: sym.name } },
          })),
        setPanelTimeframe: (id, tf) => patchPanel(id, (p) => ({ ...p, timeframe: tf })),
        setPanelChartType: (id, c) => patchPanel(id, (p) => ({ ...p, chartType: c })),
        setPanelAppearance: (id, patch) =>
          patchPanel(id, (p) => ({ ...p, appearance: { ...p.appearance, ...patch } })),

        addIndicator: (panelId, type) =>
          patchPanel(panelId, (p) => ({ ...p, indicators: [...p.indicators, makeIndicator(type)] })),
        updateIndicator: (panelId, indId, patch) =>
          patchPanel(panelId, (p) => ({
            ...p,
            indicators: p.indicators.map((i) =>
              i.id === indId ? { ...i, ...patch, params: { ...i.params, ...patch.params } } : i,
            ),
          })),
        removeIndicator: (panelId, indId) =>
          patchPanel(panelId, (p) => ({
            ...p,
            indicators: p.indicators.filter((i) => i.id !== indId),
          })),

        addDrawing: (panelId, d) =>
          patchPanel(panelId, (p) => ({ ...p, drawings: [...p.drawings, d] })),
        updateDrawing: (panelId, drawId, patch) =>
          patchPanel(panelId, (p) => ({
            ...p,
            drawings: p.drawings.map((d) => (d.id === drawId ? { ...d, ...patch } : d)),
          })),
        removeDrawing: (panelId, drawId) =>
          patchPanel(panelId, (p) => ({
            ...p,
            drawings: p.drawings.filter((d) => d.id !== drawId),
          })),
        clearDrawings: (panelId) => patchPanel(panelId, (p) => ({ ...p, drawings: [] })),

        createWatchlist: (name) =>
          set((s) => {
            const wl: Watchlist = {
              id: uid("wl"),
              name: name.trim() || "Untitled",
              market: s.market,
              symbols: [],
            };
            return {
              watchlists: [...s.watchlists, wl],
              activeWatchlistId: { ...s.activeWatchlistId, [s.market]: wl.id },
            };
          }),
        deleteWatchlist: (id) =>
          set((s) => {
            const target = s.watchlists.find((w) => w.id === id);
            if (!target) return {};
            // keep at least one watchlist per market
            if (s.watchlists.filter((w) => w.market === target.market).length <= 1) return {};
            const watchlists = s.watchlists.filter((w) => w.id !== id);
            let activeWatchlistId = s.activeWatchlistId;
            if (s.activeWatchlistId[target.market] === id) {
              const fallback = watchlists.find((w) => w.market === target.market)!;
              activeWatchlistId = { ...s.activeWatchlistId, [target.market]: fallback.id };
            }
            return { watchlists, activeWatchlistId };
          }),
        renameWatchlist: (id, name) =>
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === id ? { ...w, name: name.trim() || w.name } : w,
            ),
          })),
        setActiveWatchlist: (id) =>
          set((s) => {
            const w = s.watchlists.find((x) => x.id === id);
            if (!w) return {};
            return { activeWatchlistId: { ...s.activeWatchlistId, [w.market]: id } };
          }),
        addToWatchlist: (listId, sym) =>
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === listId && !w.symbols.some((x) => x.symbol === sym.symbol)
                ? { ...w, symbols: [...w.symbols, sym] }
                : w,
            ),
          })),
        removeFromWatchlist: (listId, symbol) =>
          set((s) => ({
            watchlists: s.watchlists.map((w) =>
              w.id === listId ? { ...w, symbols: w.symbols.filter((x) => x.symbol !== symbol) } : w,
            ),
          })),
        addToActiveWatchlist: (sym) => {
          const s = get();
          const listId = s.activeWatchlistId[sym.market];
          if (listId) s.addToWatchlist(listId, sym);
        },
      };
    },
    {
      name: "myview-state",
      version: 3,
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      // Migrate the original single-chart (v0/v1) and the panel-only (v2) layouts
      // forward to the v3 shape (markets + named watchlists).
      migrate: (persisted: unknown, version: number) => {
        if (version >= 3 || !persisted || typeof persisted !== "object")
          return persisted as ViewState;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const o = persisted as any;

        let panels: Panel[];
        let activePanelId: string;
        if (Array.isArray(o.panels) && o.panels.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          panels = o.panels.map((p: any) => ({
            ...p,
            symbolMemory: p.symbolMemory ?? {},
            indicators: p.indicators ?? [],
            drawings: p.drawings ?? [],
            appearance: p.appearance ?? { ...DEFAULT_APPEARANCE },
          }));
          activePanelId =
            o.activePanelId && panels.some((p) => p.id === o.activePanelId)
              ? o.activePanelId
              : panels[0].id;
        } else {
          const panel = makePanel({
            symbol: o.activeSymbol ?? DEFAULT_SYMBOL.stocks.symbol,
            name: o.activeName ?? DEFAULT_SYMBOL.stocks.name,
            timeframe: o.timeframe ?? "1D",
            chartType: o.chartType ?? "candlestick",
          });
          panel.indicators = Array.isArray(o.indicators)
            ? o.indicators
                .filter((id: IndicatorId) => id in INDICATOR_META)
                .map(makeIndicator)
            : [];
          panels = [panel];
          activePanelId = panel.id;
        }

        const stockSymbols: SymbolInfo[] = Array.isArray(o.watchlist)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            o.watchlist.map((w: any) => ({ ...w, market: "stocks" as const }))
          : DEFAULT_STOCKS;
        const stockWL: Watchlist = { id: uid("wl"), name: "Stocks", market: "stocks", symbols: stockSymbols };
        const cryptoWL: Watchlist = { id: uid("wl"), name: "Crypto", market: "crypto", symbols: DEFAULT_CRYPTO };

        return {
          market: "stocks",
          layout: o.layout ?? "1",
          panels,
          activePanelId,
          watchlists: [stockWL, cryptoWL],
          activeWatchlistId: { stocks: stockWL.id, crypto: cryptoWL.id },
        } as unknown as ViewState;
      },
      partialize: (s) => ({
        market: s.market,
        layout: s.layout,
        panels: s.panels,
        activePanelId: s.activePanelId,
        watchlists: s.watchlists,
        activeWatchlistId: s.activeWatchlistId,
      }),
    },
  ),
);

/** Convenience selector for the currently active panel. */
export function useActivePanel(): Panel {
  return useStore((s) => s.panels.find((p) => p.id === s.activePanelId) ?? s.panels[0]);
}

/** The active watchlist for the current market. */
export function useActiveWatchlist(): Watchlist {
  return useStore((s) => {
    const id = s.activeWatchlistId[s.market];
    return (
      s.watchlists.find((w) => w.id === id) ??
      s.watchlists.find((w) => w.market === s.market) ??
      s.watchlists[0]
    );
  });
}
