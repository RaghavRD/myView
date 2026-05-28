import { describe, it, expect } from "vitest";
import { sma, ema, rsi, macd, bollinger } from "./indicators";

describe("sma", () => {
  it("returns nulls until the window is full, then the average", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("handles period equal to length", () => {
    expect(sma([2, 4, 6], 3)).toEqual([null, null, 4]);
  });
});

describe("ema", () => {
  it("seeds with the SMA of the first period and aligns output", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(2); // SMA of 1,2,3
    expect(out[3]).toBeCloseTo(3); // 4*0.5 + 2*0.5
    expect(out[4]).toBeCloseTo(4); // 5*0.5 + 3*0.5
  });
  it("returns all nulls when there is not enough data", () => {
    expect(ema([1, 2], 5)).toEqual([null, null]);
  });
});

describe("rsi", () => {
  it("is 100 for a strictly rising series (no losses)", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    const out = rsi(values, 14);
    expect(out[out.length - 1]).toBe(100);
  });
  it("leaves the first `period` entries null", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    const out = rsi(values, 14);
    expect(out[13]).toBeNull();
    expect(out[14]).not.toBeNull();
  });
});

describe("bollinger", () => {
  it("middle band equals the SMA and bands are symmetric around it", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8];
    const { middle, upper, lower } = bollinger(v, 3, 2);
    expect(middle).toEqual(sma(v, 3));
    const i = 5;
    expect(upper[i]! - middle[i]!).toBeCloseTo(middle[i]! - lower[i]!);
  });
  it("leaves leading nulls until the window fills", () => {
    const { upper } = bollinger([1, 2, 3, 4], 3, 2);
    expect(upper[0]).toBeNull();
    expect(upper[1]).toBeNull();
    expect(upper[2]).not.toBeNull();
  });
});

describe("macd", () => {
  it("produces aligned arrays of equal length", () => {
    const values = Array.from({ length: 60 }, (_, i) => Math.sin(i / 5) * 10 + 100);
    const { macd: line, signal, histogram } = macd(values);
    expect(line).toHaveLength(values.length);
    expect(signal).toHaveLength(values.length);
    expect(histogram).toHaveLength(values.length);
    // signal starts after the macd line has data
    const firstMacd = line.findIndex((v) => v != null);
    const firstSignal = signal.findIndex((v) => v != null);
    expect(firstSignal).toBeGreaterThan(firstMacd);
  });
});
