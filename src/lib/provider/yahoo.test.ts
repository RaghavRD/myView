import { describe, it, expect } from "vitest";
import { parseCandles, parseQuoteFromChart, parseSearch } from "./yahoo";

describe("parseCandles", () => {
  it("skips rows with null OHLC and de-duplicates timestamps", () => {
    const json = {
      chart: {
        result: [
          {
            timestamp: [100, 200, 200, 300],
            indicators: {
              quote: [
                {
                  open: [1, 2, 2, null],
                  high: [2, 3, 3, 4],
                  low: [0.5, 1, 1, 2],
                  close: [1.5, 2.5, 2.5, 3],
                  volume: [10, 20, 20, 30],
                },
              ],
            },
          },
        ],
      },
    };
    const out = parseCandles(json);
    expect(out.map((c) => c.time)).toEqual([100, 200]); // dup 200 dropped, 300 has null open
    expect(out[0]).toMatchObject({ open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 });
  });

  it("returns an empty array on a malformed payload", () => {
    expect(parseCandles({})).toEqual([]);
    expect(parseCandles({ chart: { result: [] } })).toEqual([]);
  });
});

describe("parseQuoteFromChart", () => {
  it("derives change and percent from meta", () => {
    const json = {
      chart: {
        result: [
          {
            meta: {
              symbol: "RELIANCE.NS",
              regularMarketPrice: 101,
              chartPreviousClose: 100,
              currency: "INR",
            },
          },
        ],
      },
    };
    const q = parseQuoteFromChart(json, "RELIANCE.NS");
    expect(q.price).toBe(101);
    expect(q.change).toBeCloseTo(1);
    expect(q.changePercent).toBeCloseTo(1);
    expect(q.symbol).toBe("RELIANCE.NS");
  });
});

describe("parseSearch", () => {
  it("maps quotes and drops entries without a symbol", () => {
    const json = {
      quotes: [
        {
          symbol: "TCS.NS",
          shortname: "Tata Consultancy",
          exchDisp: "NSE",
          quoteType: "EQUITY",
        },
        { shortname: "no symbol here" },
      ],
    };
    const out = parseSearch(json);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      symbol: "TCS.NS",
      name: "Tata Consultancy",
      exchange: "NSE",
      type: "EQUITY",
      market: "stocks",
    });
  });
});
