import { describe, it, expect } from "vitest";
import { parseKlines, parseTicker, parseExchangeInfo } from "./binance";

describe("parseKlines", () => {
  it("converts ms timestamps to seconds and numbers strings", () => {
    const raw = [
      [1700000000000, "100.5", "110", "95", "108.25", "1234.5", 1700000059999],
      [1700000060000, "108.25", "112", "107", "111", "900", 1700000119999],
    ];
    const out = parseKlines(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      time: 1700000000,
      open: 100.5,
      high: 110,
      low: 95,
      close: 108.25,
      volume: 1234.5,
    });
  });

  it("drops non-increasing / malformed rows", () => {
    const raw = [
      [1700000000000, "1", "2", "0.5", "1.5", "10"],
      [1700000000000, "1", "2", "0.5", "1.5", "10"], // duplicate time
      [1700000060000, "x", "2", "0.5", "1.5", "10"], // NaN open
    ];
    expect(parseKlines(raw)).toHaveLength(1);
  });

  it("returns [] for non-array input", () => {
    expect(parseKlines(null)).toEqual([]);
    expect(parseKlines({})).toEqual([]);
  });
});

describe("parseTicker", () => {
  it("maps the 24hr ticker into a Quote", () => {
    const q = parseTicker(
      {
        symbol: "BTCUSDT",
        lastPrice: "64000.50",
        prevClosePrice: "62000",
        priceChange: "2000.50",
        priceChangePercent: "3.22",
        closeTime: 1700000119999,
      },
      "BTCUSDT",
    );
    expect(q.symbol).toBe("BTCUSDT");
    expect(q.price).toBeCloseTo(64000.5);
    expect(q.previousClose).toBeCloseTo(62000);
    expect(q.changePercent).toBeCloseTo(3.22);
    expect(q.currency).toBe("USD");
  });
});

describe("parseExchangeInfo", () => {
  it("keeps only TRADING USDT pairs and tags them crypto", () => {
    const out = parseExchangeInfo({
      symbols: [
        { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", status: "TRADING" },
        { symbol: "ETHBTC", baseAsset: "ETH", quoteAsset: "BTC", status: "TRADING" },
        { symbol: "FOOUSDT", baseAsset: "FOO", quoteAsset: "USDT", status: "BREAK" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ symbol: "BTCUSDT", market: "crypto", exchange: "Binance" });
  });
});
