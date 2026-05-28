// Shared market-data types. All data access goes through MarketDataProvider so the
// source (Yahoo now, a broker for real-time later) can be swapped without touching the UI.

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "1D" | "1W" | "1M";

export type ChartType = "candlestick" | "line" | "area";

/** Asset class. Each maps to a different MarketDataProvider (Yahoo / Binance). */
export type Market = "stocks" | "crypto";

export interface Candle {
  /** unix seconds (UTC) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency?: string;
  marketState?: string;
  /** unix seconds */
  time: number;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  market: Market;
}

export interface MarketDataProvider {
  searchSymbols(query: string): Promise<SymbolInfo[]>;
  getCandles(symbol: string, tf: Timeframe): Promise<Candle[]>;
  getQuote(symbol: string): Promise<Quote>;
}
