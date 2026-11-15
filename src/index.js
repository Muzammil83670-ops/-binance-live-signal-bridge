
const BASE = "https://fapi.binance.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS
  });
}

async function api(name, path) {
  try {
    const response = await fetch(BASE + path, {
      headers: {
        "Accept": "application/json"
      }
    });

    const body = await response.text();

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      data = body.slice(0, 500);
    }

    return {
      name,
      http_status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    return {
      name,
      http_status: 0,
      success: false,
      error: error.message
    };
  }
}

function ema(values, period) {
  if (values.length < period) return null;

  const k = 2 / (period + 1);
  let result = values
    .slice(0, period)
    .reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }

  return result;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];

    avgGain =
      (avgGain * (period - 1) + Math.max(change, 0)) / period;

    avgLoss =
      (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
  }

  if (avgLoss === 0) return 100;

  return 100 - 100 / (1 + avgGain / avgLoss);
}

function indicators(candles) {
  if (!Array.isArray(candles) || candles.length < 35) {
    return { error: "Insufficient candle data" };
  }

  const closes = candles.map(c => Number(c[4]));
  const volumes = candles.map(c => Number(c[5]));

  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  const macd = fast - slow;

  const previousFast = ema(closes.slice(0, -1), 9);
  const previousSlow = ema(closes.slice(0, -1), 21);

  const avgVolume =
    volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;

  const currentVolume = volumes[volumes.length - 1];

  return {
    price: closes.at(-1),
    rsi14: Number(rsi(closes).toFixed(2)),
    ema9: Number(fast.toFixed(8)),
    ema21: Number(slow.toFixed(8)),
    macd: Number(macd.toFixed(8)),
    macdTrend:
      macd > 0 ? "BULLISH" : macd < 0 ? "BEARISH" : "NEUTRAL",
    emaCross:
      fast > slow ? "BULLISH" : "BEARISH",
    volume: currentVolume,
    averageVolume: Number(avgVolume.toFixed(4)),
    volumeRatio: avgVolume
      ? Number((currentVolume / avgVolume).toFixed(2))
      : null,
    previousEma9: previousFast,
    previousEma21: previousSlow
  };
}

function createSignal(data) {
  const i = data.indicators;

  if (!i || i.error) {
    return {
      signal: "WAIT",
      reason: "Insufficient market data",
      confidence: 0
    };
  }

  let score = 0;

  if (i.rsi14 > 55 && i.rsi14 < 75) score++;
  if (i.rsi14 < 45 && i.rsi14 > 25) score--;

  if (i.ema9 > i.ema21) score++;
  else score--;

  if (i.macd > 0) score++;
  else score--;

  if (data.orderBook?.buyPressure > 55) score++;
  if (data.orderBook?.buyPressure < 45) score--;

  if (data.ticker?.priceChangePercent > 0) score++;
  if (data.ticker?.priceChangePercent < 0) score--;

  const signal =
    score >= 3 ? "LONG" :
    score <= -3 ? "SHORT" : "WAIT";

  return {
    signal,
    score,
    confidence: Math.round(Math.abs(score) / 5 * 100),
    note: "Rule-based indicator score, not a guaranteed prediction"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS
      });
    }

    if (request.method !== "GET") {
      return json({ error: "GET only" }, 405);
    }

    if (url.pathname === "/") {
      return json({
        status: "online",
        service: "Binance Live Signal and Diagnostic Bridge",
        endpoints: [
          "/api/signal?symbol=BTCUSDT",
          "/api/diagnostic?symbol=BTCUSDT"
        ]
      });
    }

    const symbol = (
      url.searchParams.get("symbol") || "BTCUSDT"
    ).toUpperCase();

    if (!/^[A-Z0-9]{2,30}$/.test(symbol)) {
      return json({ error: "Invalid symbol" }, 400);
    }

    const routes = {
      ticker: `/fapi/v1/ticker/24hr?symbol=${symbol}`,
      candles3m: `/fapi/v1/klines?symbol=${symbol}&interval=3m&limit=100`,
      candles5m: `/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=100`,
      candles15m: `/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=100`,
      candles1h: `/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`,
      orderBook: `/fapi/v1/depth?symbol=${symbol}&limit=100`,
      openInterest: `/fapi/v1/openInterest?symbol=${symbol}`,
      funding: `/fapi/v1/premiumIndex?symbol=${symbol}`,
      trades: `/fapi/v1/trades?symbol=${symbol}&limit=100`,
      serverTime: `/fapi/v1/time`
    };

    const tests = await Promise.all(
      Object.entries(routes).map(([name, path]) =>
        api(name, path)
      )
    );

    const diagnostic = Object.fromEntries(
      tests.map(t => [
        t.name,
        {
          http_status: t.http_status,
          success: t.success,
          ...(t.error ? { error: t.error } : {})
        }
      ])
    );

    const raw = Object.fromEntries(
      tests.map(t => [t.name, t.data])
    );

    const failures = tests
      .filter(t => !t.success)
      .map(t => ({
        endpoint: t.name,
        status: t.http_status,
        error: t.error || t.data
      }));

    if (url.pathname === "/api/diagnostic") {
      return json({
        success: failures.length === 0,
        symbol,
        diagnostic,
        failures,
        timestamp: Date.now()
      });
    }

    if (url.pathname !== "/api/signal") {
      return json({ error: "Endpoint not found" }, 404);
    }

    const validCandles = raw.candles5m;
    const book = raw.orderBook;
    const ticker = raw.ticker;

    const bookValid =
      book && Array.isArray(book.bids) &&
      Array.isArray(book.asks);

    const bids = bookValid
      ? book.bids.reduce((sum, x) => sum + Number(x[1]), 0)
      : 0;

    const asks = bookValid
      ? book.asks.reduce((sum, x) => sum + Number(x[1]), 0)
      : 0;

    const total = bids + asks;

    const buyPressure = total
      ? Number((bids / total * 100).toFixed(2))
      : null;

    const indicatorData =
      indicators(validCandles);

    const result = {
      success: failures.length === 0,
      symbol,
      exchange: "Binance USD-M Futures",
      timestamp: Date.now(),
      ticker,
      indicators: indicatorData,
      multiTimeframe: {
        "3m": indicators(raw.candles3m),
        "5m": indicatorData,
        "15m": indicators(raw.candles15m),
        "1h": indicators(raw.candles1h)
      },
      orderBook: {
        buyVolume: bids,
        sellVolume: asks,
        buyPressure,
        sellPressure: total
          ? Number((asks / total * 100).toFixed(2))
          : null
      },
      openInterest: raw.openInterest,
      funding: raw.funding,
      recentTrades: raw.trades,
      signal: null,
      diagnostic,
      failures
    };

    result.signal = createSignal(result);

    return json(result);
  }
};
