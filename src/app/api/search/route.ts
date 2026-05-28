import { searchSymbols } from "@/lib/provider";
import type { Market } from "@/lib/provider/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const market = (searchParams.get("market") ?? "stocks") as Market;

  if (!query) {
    return Response.json({ results: [] });
  }

  try {
    const results = await searchSymbols(query, market);
    return Response.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "search failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
