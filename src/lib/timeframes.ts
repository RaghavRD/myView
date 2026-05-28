import type { Timeframe } from "./provider/types";

export interface TfConfig {
  label: Timeframe;
  /** Yahoo interval */
  interval: string;
  /** Yahoo range (respecting intraday limits) */
  range: string;
}

export const TIMEFRAMES: TfConfig[] = [
  { label: "1m", interval: "1m", range: "1d" },
  { label: "5m", interval: "5m", range: "5d" },
  { label: "15m", interval: "15m", range: "1mo" },
  { label: "30m", interval: "30m", range: "1mo" },
  { label: "1h", interval: "60m", range: "3mo" },
  { label: "1D", interval: "1d", range: "1y" },
  { label: "1W", interval: "1wk", range: "5y" },
  { label: "1M", interval: "1mo", range: "max" },
];

export function tfConfig(tf: Timeframe): TfConfig {
  return TIMEFRAMES.find((t) => t.label === tf) ?? TIMEFRAMES[5];
}

const INTRADAY: Timeframe[] = ["1m", "5m", "15m", "30m", "1h"];

export function isIntraday(tf: Timeframe): boolean {
  return INTRADAY.includes(tf);
}
