import { describe, it, expect } from "vitest";
import { isMarketOpen } from "./market-hours";

// IST = UTC + 5:30. Session is 09:15–15:30 IST, Mon–Fri.
// 2025-01-06 is a Monday; 2025-01-05 is a Sunday.

describe("isMarketOpen", () => {
  it("is open mid-session on a weekday", () => {
    expect(isMarketOpen(new Date("2025-01-06T04:00:00Z"))).toBe(true); // 09:30 IST
  });
  it("is open exactly at the 09:15 IST boundary", () => {
    expect(isMarketOpen(new Date("2025-01-06T03:45:00Z"))).toBe(true); // 09:15 IST
  });
  it("is open exactly at the 15:30 IST boundary", () => {
    expect(isMarketOpen(new Date("2025-01-06T10:00:00Z"))).toBe(true); // 15:30 IST
  });
  it("is closed before the open", () => {
    expect(isMarketOpen(new Date("2025-01-06T03:00:00Z"))).toBe(false); // 08:30 IST
  });
  it("is closed after the close", () => {
    expect(isMarketOpen(new Date("2025-01-06T10:30:00Z"))).toBe(false); // 16:00 IST
  });
  it("is closed on weekends", () => {
    expect(isMarketOpen(new Date("2025-01-05T06:00:00Z"))).toBe(false); // Sun 11:30 IST
  });
});
