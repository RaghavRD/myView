import { getChart } from "@/lib/provider";
import type { Market, Timeframe } from "@/lib/provider/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const tf = (searchParams.get("tf") ?? "1D") as Timeframe;
  const market = (searchParams.get("market") ?? "stocks") as Market;

  if (!symbol) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const { candles, quote } = await getChart(symbol, tf, market);
    return Response.json({ candles, quote });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load candles";
    return Response.json({ error: message }, { status: 502 });
  }
}
