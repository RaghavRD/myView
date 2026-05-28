# MyView

A minimal, personal TradingView-style charting app for **NSE/BSE**, built with Next.js +
[Lightweight Charts](https://github.com/tradingview/lightweight-charts). Free Yahoo Finance
data now; real-time broker data is a planned later phase (see `../PLAN.md`).

## Features

- Candlestick / line / area charts with a volume sub-pane
- Timeframes: 1m, 5m, 15m, 30m, 1h, 1D, 1W, 1M
- Symbol search (NSE `.NS`, BSE `.BO`, indices `^NSEI`, `^BSESN`)
- Persistent watchlist (localStorage)
- Indicators: SMA(20), EMA(50), RSI(14), MACD(12,26,9)
- Delayed quote header, polled every 30s during market hours (09:15–15:30 IST)
- Trendline drawing, keyboard shortcuts, dark theme

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm start        # run the production build
npm test         # unit tests (indicators, parsers, market-hours)
```

## Keyboard shortcuts

- `1`–`8` — switch timeframe (1m … 1M)
- `c` / `l` / `a` — candlestick / line / area

## Your logo

Replace `public/logo.svg` with your own mark (similar to the TradingView logo). The header
falls back to a "MyView" wordmark if the file is missing. To use a PNG instead, update the
`src` in `src/components/Logo.tsx`.

## Architecture

```
src/
├─ app/
│  ├─ page.tsx              # workspace: data fetching, polling, shortcuts, layout
│  └─ api/                  # server-side proxies to the data provider
│     ├─ candles/route.ts
│     ├─ quote/route.ts
│     └─ search/route.ts
├─ components/              # TopBar, Chart, Watchlist, QuoteHeader, SymbolSearch, IndicatorPanel, Logo
└─ lib/
   ├─ provider/            # MarketDataProvider abstraction + Yahoo implementation
   ├─ indicators.ts        # SMA / EMA / RSI / MACD (pure, unit-tested)
   ├─ market-hours.ts      # NSE/BSE session check (IST)
   ├─ timeframes.ts
   └─ store.ts             # Zustand state (persisted to localStorage)
```

All market-data access goes through `lib/provider`. To add real-time later, implement a new
provider behind the same interface and swap it in — the UI doesn't change.

## Data source note

Uses Yahoo Finance's public endpoints (cookie + crumb session, with retry and short caching).
These are **unofficial** and rate-limited — fine for personal single-user use, but data is
**delayed (~15 min)**, not real-time. Swap in a broker provider for true live data.
