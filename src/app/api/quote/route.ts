import { getQuote } from "@/lib/provider";
import type { Market } from "@/lib/provider/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = (searchParams.get("market") ?? "stocks") as Market;

  if (!symbol) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const quote = await getQuote(symbol, market);
    return Response.json({ quote });
  } catch (e) {
    const message = e instanceof Error ? e.message : "failed to load quote";
    return Response.json({ error: message }, { status: 502 });
  }
}
