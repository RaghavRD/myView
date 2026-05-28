import { describe, it, expect, beforeEach } from "vitest";
import { useStore, LAYOUT_CELLS } from "./store";

// Restore the store to its default single-panel state before each test.
beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
});

const activeId = () => useStore.getState().activePanelId;
const panel = (id: string) => useStore.getState().panels.find((p) => p.id === id)!;

describe("store: layout", () => {
  it("grows the panel list to match the layout cell count", () => {
    useStore.getState().setLayout("4");
    expect(useStore.getState().panels).toHaveLength(LAYOUT_CELLS["4"]);
  });

  it("shrinks panels and keeps the active id valid", () => {
    useStore.getState().setLayout("6");
    const last = useStore.getState().panels[5].id;
    useStore.getState().setActivePanel(last);
    useStore.getState().setLayout("1");
    const s = useStore.getState();
    expect(s.panels).toHaveLength(1);
    expect(s.panels.some((p) => p.id === s.activePanelId)).toBe(true);
  });

  it("clones the active panel's symbol into newly added cells", () => {
    useStore.getState().setPanelSymbol(activeId(), {
      symbol: "TCS.NS",
      name: "TCS",
      exchange: "NSE",
      type: "EQUITY",
      market: "stocks",
    });
    useStore.getState().setLayout("2h");
    expect(useStore.getState().panels[1].symbol).toBe("TCS.NS");
  });
});

describe("store: indicator instances", () => {
  it("allows the same indicator type multiple times and edits params per instance", () => {
    const id = activeId();
    useStore.getState().addIndicator(id, "sma");
    useStore.getState().addIndicator(id, "sma");
    expect(panel(id).indicators).toHaveLength(2);

    const first = panel(id).indicators[0].id;
    useStore.getState().updateIndicator(id, first, { params: { period: 200 } });
    expect(panel(id).indicators[0].params.period).toBe(200);
    // the second instance is untouched
    expect(panel(id).indicators[1].params.period).toBe(20);

    useStore.getState().removeIndicator(id, first);
    expect(panel(id).indicators).toHaveLength(1);
  });
});

describe("store: market toggle", () => {
  it("remembers each market's symbol and restores it when toggling back", () => {
    const id = activeId();
    // default stocks symbol
    expect(panel(id).symbol).toBe("^NSEI");
    // switch to crypto -> default crypto symbol
    useStore.getState().setMarket("crypto");
    expect(useStore.getState().market).toBe("crypto");
    expect(panel(id).symbol).toBe("BTCUSDT");
    // pick a different crypto symbol
    useStore.getState().setPanelSymbol(id, {
      symbol: "ETHUSDT",
      name: "ETH / USDT",
      exchange: "Binance",
      type: "CRYPTO",
      market: "crypto",
    });
    // back to stocks -> original stock symbol restored
    useStore.getState().setMarket("stocks");
    expect(panel(id).symbol).toBe("^NSEI");
    // and crypto remembers ETH
    useStore.getState().setMarket("crypto");
    expect(panel(id).symbol).toBe("ETHUSDT");
  });
});

describe("store: watchlists", () => {
  it("creates a watchlist for the current market and makes it active", () => {
    useStore.getState().setMarket("crypto");
    const before = useStore.getState().watchlists.length;
    useStore.getState().createWatchlist("Memes");
    const s = useStore.getState();
    expect(s.watchlists).toHaveLength(before + 1);
    const created = s.watchlists.find((w) => w.name === "Memes")!;
    expect(created.market).toBe("crypto");
    expect(s.activeWatchlistId.crypto).toBe(created.id);
  });

  it("adds/removes symbols and refuses to delete the last list of a market", () => {
    useStore.getState().setMarket("crypto");
    const cryptoList = useStore.getState().watchlists.find((w) => w.market === "crypto")!;
    useStore.getState().addToWatchlist(cryptoList.id, {
      symbol: "SOLUSDT",
      name: "SOL / USDT",
      exchange: "Binance",
      type: "CRYPTO",
      market: "crypto",
    });
    let list = useStore.getState().watchlists.find((w) => w.id === cryptoList.id)!;
    const had = list.symbols.length;
    // duplicate add is ignored
    useStore.getState().addToWatchlist(cryptoList.id, list.symbols[0]);
    expect(useStore.getState().watchlists.find((w) => w.id === cryptoList.id)!.symbols).toHaveLength(had);
    useStore.getState().removeFromWatchlist(cryptoList.id, "SOLUSDT");
    list = useStore.getState().watchlists.find((w) => w.id === cryptoList.id)!;
    expect(list.symbols.some((x) => x.symbol === "SOLUSDT")).toBe(false);

    // only one crypto list -> delete is a no-op
    useStore.getState().deleteWatchlist(cryptoList.id);
    expect(useStore.getState().watchlists.some((w) => w.id === cryptoList.id)).toBe(true);
  });
});

describe("store: drawings", () => {
  it("adds drawings to the target panel and clears them", () => {
    const id = activeId();
    useStore.getState().addDrawing(id, {
      id: "d1",
      type: "trend",
      points: [
        { time: 1, value: 1 },
        { time: 2, value: 2 },
      ],
      color: "#fff",
      width: 1,
    });
    expect(panel(id).drawings).toHaveLength(1);
    useStore.getState().clearDrawings(id);
    expect(panel(id).drawings).toHaveLength(0);
  });

  it("keeps drawings independent across panels", () => {
    useStore.getState().setLayout("2h");
    const [a, b] = useStore.getState().panels.map((p) => p.id);
    useStore.getState().addDrawing(a, {
      id: "d1",
      type: "hline",
      points: [{ time: 1, value: 100 }],
      color: "#fff",
      width: 1,
    });
    expect(panel(a).drawings).toHaveLength(1);
    expect(panel(b).drawings).toHaveLength(0);
  });
});
