
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;
const BASE = "https://fapi.binance.com";

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Binance Futures Live Signal Bridge"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/snapshot", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "AKEUSDT").toUpperCase();

    if (!/^[A-Z0-9]{2,30}$/.test(symbol)) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    const endpoints = [
      `/fapi/v1/ticker/24hr?symbol=${symbol}`,
      `/fapi/v1/klines?symbol=${symbol}&interval=3m&limit=30`,
      `/fapi/v1/depth?symbol=${symbol}&limit=20`,
      `/fapi/v1/openInterest?symbol=${symbol}`,
      `/fapi/v1/premiumIndex?symbol=${symbol}`
    ];

    const results = await Promise.all(
      endpoints.map(async (path) => {
        const response = await fetch(BASE + path);
        if (!response.ok) {
          throw new Error(`Binance returned HTTP ${response.status}`);
        }
        return response.json();
      })
    );

    res.json({
      exchange: "Binance Futures",
      symbol,
      timestamp: new Date().toISOString(),
      ticker24h: results[0],
      klines3m: results[1],
      orderBook: results[2],
      openInterest: results[3],
      funding: results[4]
    });
  } catch (error) {
    res.status(502).json({
      error: "Market data unavailable",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
