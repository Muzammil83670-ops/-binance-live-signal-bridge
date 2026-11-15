
const BINANCE_API = "https://fapi.binance.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

async function getBinanceData(path) {
  const response = await fetch(BINANCE_API + path);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  return response.json();
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/") {
      return json({
        status: "online",
        service: "Binance Live Signal Bridge",
        exchange: "Binance USD-M Futures",
        endpoint: "/api/snapshot?symbol=BTCUSDT",
      });
    }

    if (url.pathname !== "/api/snapshot") {
      return json({ error: "Endpoint not found" }, 404);
    }

    const symbol = (
      url.searchParams.get("symbol") || "BTCUSDT"
    ).toUpperCase();

    if (!/^[A-Z0-9]{2,30}$/.test(symbol)) {
      return json({ error: "Invalid symbol" }, 400);
    }

    const endpoints = {
      ticker24h:
        `/fapi/v1/ticker/24hr?symbol=${symbol}`,

      klines3m:
        `/fapi/v1/klines?symbol=${symbol}&interval=3m&limit=100`,

      klines5m:
        `/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=100`,

      klines15m:
        `/fapi/v1/klines?symbol=${symbol}&interval=15m&limit=100`,

      klines1h:
        `/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=100`,

      orderBook:
        `/fapi/v1/depth?symbol=${symbol}&limit=100`,

      openInterest:
        `/fapi/v1/openInterest?symbol=${symbol}`,

      funding:
        `/fapi/v1/premiumIndex?symbol=${symbol}`,

      recentTrades:
        `/fapi/v1/trades?symbol=${symbol}&limit=100`,
    };

    try {
      const results = await Promise.all(
        Object.entries(endpoints).map(
          async ([key, path]) => {
            return [
              key,
              await getBinanceData(path),
            ];
          }
        )
      );

      return json({
        success: true,
        exchange: "Binance Futures",
        symbol,
        timestamp: Date.now(),
        data: Object.fromEntries(results),
      });

    } catch (error) {
      return json({
        success: false,
        error: error.message,
        timestamp: Date.now(),
      }, 502);
    }
  },
};
