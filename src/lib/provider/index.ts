// Dispatches data requests to the right provider based on market. The UI never imports a
// concrete provider — it goes through these functions and passes the panel's market.

import * as yahoo from "./yahoo";
import * as binance from "./binance";
import type { Candle, Market, Quote, SymbolInfo, Timeframe } from "./types";

function provider(market: Market) {
  return market === "crypto" ? binance : yahoo;
}

export function getChart(
  symbol: string,
  tf: Timeframe,
  market: Market,
): Promise<{ candles: Candle[]; quote: Quote }> {
  return provider(market).getChart(symbol, tf);
}

export function getQuote(symbol: string, market: Market): Promise<Quote> {
  return provider(market).getQuote(symbol);
}

export function searchSymbols(query: string, market: Market): Promise<SymbolInfo[]> {
  return provider(market).searchSymbols(query);
}
