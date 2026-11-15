function setBook(data) {
  // Binance REST uses bids/asks.
  // Binance WebSocket uses b/a.
  const rawBids = data?.bids || data?.b;
  const rawAsks = data?.asks || data?.a;

  if (
    !Array.isArray(rawBids) ||
    !Array.isArray(rawAsks) ||
    rawBids.length === 0 ||
    rawAsks.length === 0
  ) {
    throw Error("Invalid Binance order book format");
  }

  const bids = rawBids.map(x => [
    Number(x[0]),
    Number(x[1])
  ]).filter(x =>
    Number.isFinite(x[0]) &&
    Number.isFinite(x[1]) &&
    x[0] > 0 &&
    x[1] >= 0
  );

  const asks = rawAsks.map(x => [
    Number(x[0]),
    Number(x[1])
  ]).filter(x =>
    Number.isFinite(x[0]) &&
    Number.isFinite(x[1]) &&
    x[0] > 0 &&
    x[1] >= 0
  );

  if (!bids.length || !asks.length) {
    throw Error("Order book contains invalid price levels");
  }

  const bidValue = total(
    bids.map(x => x[0] * x[1])
  );

  const askValue = total(
    asks.map(x => x[0] * x[1])
  );

  const bestBid = Math.max(...bids.map(x => x[0]));
  const bestAsk = Math.min(...asks.map(x => x[0]));

  if (bestAsk <= bestBid) {
    throw Error("Invalid order book spread");
  }

  const mid = (bestBid + bestAsk) / 2;

  S.book = {
    bv: bidValue,
    av: askValue,
    imb: (bidValue + askValue)
      ? (bidValue - askValue) / (bidValue + askValue)
      : 0,
    spread: mid
      ? (bestAsk - bestBid) / mid * 100
      : 0,
    time: Date.now()
  };
}
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ======================================
    // LIVE API
    // ======================================
    if (url.pathname === "/api/live") {
      const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      const key = new Request(url.origin + "/__v3_live_snapshot");

      if (request.method === "POST") {
        try {
          const data = await request.json();

          if (!data || data.symbol !== "BTCUSDT" || !data.timestamp) {
            return Response.json(
              { error: "Invalid V3 data" },
              { status: 400, headers }
            );
          }

          await caches.default.put(
            key,
            new Response(JSON.stringify(data), {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10"
              }
            })
          );

          return Response.json(
            { saved: true, timestamp: data.timestamp },
            { headers }
          );
        } catch (e) {
          return Response.json(
            { error: String(e) },
            { status: 500, headers }
          );
        }
      }

      if (request.method === "GET") {
        try {
          const saved = await caches.default.match(key);

          if (!saved) {
            return Response.json(
              {
                status: "waiting",
                message: "Open the V3 dashboard first."
              },
              { status: 503, headers }
            );
          }

          return new Response(await saved.text(), { headers });
        } catch (e) {
          return Response.json(
            { error: String(e) },
            { status: 500, headers }
          );
        }
      }

      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers }
      );
    }

    // ======================================
    // DASHBOARD
    // ======================================

    const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Binance Futures Pulse V3</title>

<style>
*{box-sizing:border-box}
body{
 margin:0;padding:14px;background:#0d1420;
 color:#edf2fa;font-family:Arial
}
h2{font-size:21px}
.card{
 background:#192638;border:1px solid #2b3d54;
 border-radius:12px;padding:14px;margin:12px 0
}
.grid{
 display:grid;grid-template-columns:1fr 1fr;gap:9px
}
.metric{
 background:#101b2a;padding:10px;
 border-radius:8px;overflow-wrap:anywhere
}
.label{font-size:12px;color:#9eafc3}
.value{font-size:18px;font-weight:bold;margin-top:6px}
.big{font-size:29px;font-weight:bold}
.green{color:#16c784}
.red{color:#ea3943}
.yellow{color:#f0b90b}
.small{
 font-size:12px;color:#9eafc3;
 line-height:1.6;white-space:pre-line;
 overflow-wrap:anywhere
}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{
 padding:9px 4px;border-bottom:1px solid #304158;
 text-align:right
}
td:first-child,th:first-child{text-align:left}
button{
 width:100%;padding:14px;background:#f0b90b;
 color:#111;border:0;border-radius:9px;font-weight:bold
}
</style>
</head>

<body>

<h2>BINANCE FUTURES PULSE V3</h2>
<div class="small">BTCUSDT PERPETUAL · LIVE MARKET ANALYSIS</div>

<div class="card">
 <div class="label">LIVE BTC PRICE</div>
 <div class="big" id="price">Loading...</div>
 <div class="small" id="change">24h change: --</div>
 <div class="small" id="ws">WebSocket: Connecting</div>
</div>

<div class="card">
 <div class="label">LIVE SIGNAL</div>
 <div class="big yellow" id="signal">WAIT</div>
 <div id="score" class="small">Calculating...</div>
 <p id="reason" class="small">Starting analysis...</p>

 <div class="grid">
  <div class="metric"><div class="label">ENTRY</div><div class="value" id="entry">--</div></div>
  <div class="metric"><div class="label">STOP LOSS</div><div class="value red" id="sl">--</div></div>
  <div class="metric"><div class="label">TP 1</div><div class="value green" id="tp1">--</div></div>
  <div class="metric"><div class="label">TP 2</div><div class="value green" id="tp2">--</div></div>
 </div>

 <div class="small">Levels are technical estimates, not guaranteed execution prices.</div>
</div>

<div class="card">
 <b>TIMEFRAME ANALYSIS</b>
 <table>
  <thead>
   <tr><th>TF</th><th>RSI</th><th>EMA</th><th>MACD</th><th>VOL</th></tr>
  </thead>
  <tbody id="frames">
   <tr><td colspan="5">Loading...</td></tr>
  </tbody>
 </table>
</div>

<div class="card">
 <b>BUY / SELL PRESSURE</b>
 <div class="grid">
  <div class="metric"><div class="label">BUY NOTIONAL</div><div id="buy" class="value green">--</div></div>
  <div class="metric"><div class="label">SELL NOTIONAL</div><div id="sell" class="value red">--</div></div>
  <div class="metric"><div class="label">BUY RATIO</div><div id="buyPct" class="value">--</div></div>
  <div class="metric"><div class="label">SELL RATIO</div><div id="sellPct" class="value">--</div></div>
 </div>
 <div class="small" id="tradeInfo">Recent trades loading...</div>
</div>

<div class="card">
 <b>ORDER BOOK</b>
 <div class="grid">
  <div class="metric"><div class="label">BID VALUE</div><div id="bid" class="value green">--</div></div>
  <div class="metric"><div class="label">ASK VALUE</div><div id="ask" class="value red">--</div></div>
  <div class="metric"><div class="label">IMBALANCE</div><div id="imb" class="value">--</div></div>
  <div class="metric"><div class="label">SPREAD</div><div id="spread" class="value">--</div></div>
 </div>
</div>

<div class="card">
 <b>OPEN INTEREST / FUNDING</b>
 <div class="grid">
  <div class="metric"><div class="label">OPEN INTEREST</div><div id="oi" class="value">--</div></div>
  <div class="metric"><div class="label">OI CHANGE</div><div id="oiChange" class="value">--</div></div>
  <div class="metric"><div class="label">FUNDING</div><div id="funding" class="value">--</div></div>
  <div class="metric"><div class="label">MARK PRICE</div><div id="mark" class="value">--</div></div>
 </div>
</div>

<div class="card">
 <b>LIQUIDATION MONITOR</b>
 <div class="grid">
  <div class="metric"><div class="label">LONG LIQUIDATIONS</div><div id="longLiq" class="value red">--</div></div>
  <div class="metric"><div class="label">SHORT LIQUIDATIONS</div><div id="shortLiq" class="value green">--</div></div>
 </div>
 <div class="small">Observed WebSocket liquidation events over 5 minutes. This stream is sampled, not a complete liquidation total.</div>
</div>

<div class="card">
 <b>DATA HEALTH</b>
 <div id="health" class="small">JavaScript is starting...</div>
 <div class="small" id="apiStatus">Live API: Starting...</div>
</div>

<button onclick="refreshAll()">REFRESH DATA</button>
<div class="small">Candles: 60 sec · Market data: 15 sec · OI: 30 sec</div>

<script>
"use strict";

// ======================================
// STARTUP DIAGNOSTICS
// ======================================

const el = id => document.getElementById(id);

const put = (id, value) => {
  const node = el(id);
  if (node) node.textContent = value;
};

put("health", "JavaScript started. Connecting to Binance...");
put("apiStatus", "Live API: Waiting for first update");

window.onerror = function(message, source, line, column) {
  put(
    "health",
    "JAVASCRIPT ERROR: " + message +
    "\\nLine: " + line +
    "\\nColumn: " + column
  );
};

window.onunhandledrejection = function(event) {
  put("health", "PROMISE ERROR: " + String(event.reason));
};

// ======================================
// CONFIGURATION
// ======================================

const API = "https://fapi.binance.com";
const SYMBOL = "BTCUSDT";
const TIMEFRAMES = ["1m","3m","5m","15m","1h","4h"];

const S = {
  price: 0,
  change: 0,
  mark: 0,
  funding: 0,
  oi: null,
  oiChange: null,
  book: null,
  candles: {},
  trades: [],
  liqs: [],
  ws: false,
  lastWS: 0,
  errors: [],
  lastOI: 0,
  lastFunding: 0,
  lastCandles: 0,
  lastMarket: 0,
  busy: false
};

const number = (n, d = 2) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });

const total = a => a.reduce((x,y) => x+y, 0);

function addError(message) {
  S.errors.push(new Date().toLocaleTimeString() + " " + message);
  S.errors = S.errors.slice(-8);
  console.error(message);
}

// ======================================
// BINANCE REST REQUEST
// ======================================

async function get(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(API + path, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw Error("HTTP " + response.status + " " + path);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ======================================
// INDICATORS
// ======================================

function ema(a, period) {
  if (!a.length) return [];

  const k = 2 / (period + 1);
  let value = a[0];
  const out = [value];

  for (let i = 1; i < a.length; i++) {
    value = a[i] * k + value * (1-k);
    out.push(value);
  }

  return out;
}

function rsi(a, period = 14) {
  if (a.length < period + 1) return 50;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const change = a[i] - a[i-1];
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < a.length; i++) {
    const change = a[i] - a[i-1];

    avgGain = (
      avgGain * (period-1) + Math.max(change,0)
    ) / period;

    avgLoss = (
      avgLoss * (period-1) + Math.max(-change,0)
    ) / period;
  }

  if (avgLoss === 0) return 100;

  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calculate(raw) {
  if (!Array.isArray(raw)) {
    throw Error("Candle response is not an array");
  }

  const rows = raw.slice(0, -1);

  if (rows.length < 205) {
    throw Error("Waiting for 205 closed candles");
  }

  const close = rows.map(x => Number(x[4]));
  const volume = rows.map(x => Number(x[5]));

  const e9 = ema(close, 9);
  const e21 = ema(close, 21);
  const e50 = ema(close, 50);
  const e200 = ema(close, 200);

  const fast = ema(close, 12);
  const slow = ema(close, 26);
  const macd = fast.map((x,i) => x-slow[i]);
  const signalLine = ema(macd, 9);

  const i = close.length - 1;
  const histogram = macd[i] - signalLine[i];
  const currentRSI = rsi(close);

  const avgVolume = total(volume.slice(-21,-1)) / 20;
  const volumeRatio = avgVolume ? volume[i] / avgVolume : 0;

  const recent = rows.slice(-20);
  const allVolume = total(recent.map(x => Number(x[5])));
  const takerBuy = total(recent.map(x => Number(x[9])));
  const buyRatio = allVolume ? takerBuy / allVolume : 0.5;

  const ranges = [];

  for (let j = 1; j < rows.length; j++) {
    const high = Number(rows[j][2]);
    const low = Number(rows[j][3]);
    const previous = Number(rows[j-1][4]);

    ranges.push(Math.max(
      high-low,
      Math.abs(high-previous),
      Math.abs(low-previous)
    ));
  }

  const atr = total(ranges.slice(-14)) / 14;

  let score = 0;

  score += e9[i] > e21[i] ? 1 : -1;
  score += e50[i] > e200[i] ? 1 : -1;
  score += histogram > 0 ? 1 : -1;
  score += currentRSI > 55 ? 1 : currentRSI < 45 ? -1 : 0;
  score += buyRatio > 0.55 ? 1 : buyRatio < 0.45 ? -1 : 0;

  if (volumeRatio > 1.3) {
    score += close[i] > close[i-1] ? 0.5 : -0.5;
  }

  return {
    score,
    rsi: currentRSI,
    e9: e9[i],
    e21: e21[i],
    e50: e50[i],
    e200: e200[i],
    hist: histogram,
    volRatio: volumeRatio,
    buyRatio,
    atr,
    close: close[i]
  };
}

// ======================================
// LOAD CANDLES
// ======================================

async function loadCandles() {
  const results = await Promise.allSettled(
    TIMEFRAMES.map(async tf => {
      const data = await get(
        "/fapi/v1/klines?symbol=" +
        SYMBOL + "&interval=" + tf + "&limit=250"
      );

      S.candles[tf] = data;
    })
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      addError(
        TIMEFRAMES[i] + " candles: " +
        String(result.reason)
      );
    }
  });

  S.lastCandles = Date.now();
}

// ======================================
// LOAD MARKET DATA
// ======================================

async function loadMarket() {
  const results = await Promise.allSettled([
    get("/fapi/v1/ticker/24hr?symbol=" + SYMBOL),
    get("/fapi/v1/depth?symbol=" + SYMBOL + "&limit=100"),
    get("/fapi/v1/aggTrades?symbol=" + SYMBOL + "&limit=100")
  ]);

  if (results[0].status === "fulfilled") {
    const d = results[0].value;
    S.price = Number(d.lastPrice);
    S.change = Number(d.priceChangePercent);
  } else {
    addError("Ticker: " + String(results[0].reason));
  }

  if (results[1].status === "fulfilled") {
    setBook(results[1].value);
  } else {
    addError("Order book: " + String(results[1].reason));
  }

  if (results[2].status === "fulfilled") {
    const now = Date.now();

    S.trades = results[2].value.map(t => ({
      time: Number(t.T),
      value: Number(t.p) * Number(t.q),
      buy: !t.m
    })).filter(t => t.time > now - 60000);
  } else {
    addError("Trades: " + String(results[2].reason));
  }

  S.lastMarket = Date.now();
}

// ======================================
// ORDER BOOK
// ======================================

function setBook(data) {
  if (!data.bids || !data.asks) {
    throw Error("Invalid order book response");
  }

  const bids = data.bids.map(x => [
    Number(x[0]), Number(x[1])
  ]);

  const asks = data.asks.map(x => [
    Number(x[0]), Number(x[1])
  ]);

  const bidValue = total(
    bids.map(x => x[0] * x[1])
  );

  const askValue = total(
    asks.map(x => x[0] * x[1])
  );

  const bestBid = Math.max(...bids.map(x => x[0]));
  const bestAsk = Math.min(...asks.map(x => x[0]));
  const mid = (bestBid + bestAsk) / 2;

  S.book = {
    bv: bidValue,
    av: askValue,
    imb: bidValue + askValue
      ? (bidValue - askValue) / (bidValue + askValue)
      : 0,
    spread: mid
      ? (bestAsk - bestBid) / mid * 100
      : 0,
    time: Date.now()
  };
}

// ======================================
// OPEN INTEREST
// ======================================

async function loadOI() {
  try {
    const data = await get(
      "/fapi/v1/openInterest?symbol=" + SYMBOL
    );

    const next = Number(data.openInterest);

    if (S.oi !== null && S.oi > 0) {
      S.oiChange = (next - S.oi) / S.oi * 100;
    }

    S.oi = next;
    S.lastOI = Date.now();

  } catch (e) {
    addError("Open interest: " + String(e));
  }
}

// ======================================
// FUNDING
// ======================================

async function loadFunding() {
  try {
    const data = await get(
      "/fapi/v1/premiumIndex?symbol=" + SYMBOL
    );

    S.funding = Number(data.lastFundingRate);
    S.mark = Number(data.markPrice);
    S.lastFunding = Date.now();

  } catch (e) {
    addError("Funding: " + String(e));
  }
}

// ======================================
// WEBSOCKET
// ======================================

let socket = null;
let reconnectTimer = null;

function connect() {
  try {
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
       socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const streams = [
      "btcusdt@aggTrade",
      "btcusdt@depth20@100ms",
      "!forceOrder@arr"
    ];

    socket = new WebSocket(
      "wss://fstream.binance.com/stream?streams=" +
      streams.join("/")
    );

    socket.onopen = () => {
      S.ws = true;
      render();
    };

    socket.onmessage = event => {
      S.lastWS = Date.now();

      try {
        const packet = JSON.parse(event.data);
        const data = packet.data || {};
        const name = packet.stream || "";

        if (name.includes("aggTrade")) {
          S.trades.push({
            time: Number(data.T),
            value: Number(data.p) * Number(data.q),
            buy: !data.m
          });

          S.trades = S.trades.filter(
            x => x.time > Date.now() - 60000
          );

          S.price = Number(data.p);
        }

        if (name.includes("depth20")) {
          setBook(data);
        }

        if (name === "!forceOrder@arr" && data.o) {
          S.liqs.push({
            side: data.o.S,
            value: Number(data.o.ap) * Number(data.o.q),
            time: Date.now()
          });

          S.liqs = S.liqs.filter(
            x => x.time > Date.now() - 300000
          );
        }

      } catch (e) {
        addError("WebSocket message: " + String(e));
      }
    };

    socket.onerror = () => {
      S.ws = false;
      addError("WebSocket connection error");
      render();
    };

    socket.onclose = () => {
      S.ws = false;
      render();

      if (reconnectTimer) clearTimeout(reconnectTimer);

      reconnectTimer = setTimeout(connect, 5000);
    };

  } catch (e) {
    S.ws = false;
    addError("WebSocket startup: " + String(e));

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 5000);
  }
}

// ======================================
// SIGNAL ENGINE
// ======================================

function showWait(reason, scoreText) {
  put("signal", "WAIT");
  el("signal").className = "big yellow";
  put("reason", reason);
  put("entry", "--");
  put("sl", "--");
  put("tp1", "--");
  put("tp2", "--");

  if (scoreText) put("score", scoreText);
}

function signal(stats, buyRatio) {
  const required = ["3m","5m","15m","1h","4h"];

  if (required.some(tf => !stats[tf])) {
    showWait("Waiting for complete timeframe data.");
    return;
  }

  if (
    !S.price ||
    !S.book ||
    Date.now() - S.lastMarket > 45000 ||
    Date.now() - S.lastOI > 90000 ||
    Date.now() - S.lastFunding > 120000
  ) {
    showWait("Market data is incomplete or stale.");
    return;
  }

  const weights = {
    "1m": 0.25,
    "3m": 0.5,
    "5m": 0.75,
    "15m": 1.5,
    "1h": 2,
    "4h": 1.5
  };

  let score = 0;

  Object.keys(weights).forEach(tf => {
    score += stats[tf].score * weights[tf];
  });

  if (S.book.imb > 0.12) score += 0.75;
  if (S.book.imb < -0.12) score -= 0.75;

  if (buyRatio > 0.58) score += 1;
  if (buyRatio < 0.42) score -= 1;

  if (S.oiChange !== null && S.oiChange > 0.05) {
    if (stats["5m"].close > stats["5m"].e21) score += 0.5;
    if (stats["5m"].close < stats["5m"].e21) score -= 0.5;
  }

  if (S.funding > 0.0005) score -= 0.25;
  if (S.funding < -0.0005) score += 0.25;

  const up =
    stats["15m"].score > 0 &&
    stats["1h"].score > 0;

  const down =
    stats["15m"].score < 0 &&
    stats["1h"].score < 0;

  const buyOK =
    buyRatio > 0.52 &&
    S.book.imb > 0;

  const sellOK =
    buyRatio < 0.48 &&
    S.book.imb < 0;

  let direction = "WAIT";
  let reason = "Conflicting signals. Wait for clearer direction.";

  if (score >= 4 && up && buyOK) {
    direction = "LONG";
    reason = "Bullish timeframe alignment with buying and order book confirmation.";
  } else if (score <= -4 && down && sellOK) {
    direction = "SHORT";
    reason = "Bearish timeframe alignment with selling and order book confirmation.";
  }

  const scoreText =
    "Technical alignment score: " + score.toFixed(2) +
    " (not win probability)";

  if (direction === "WAIT") {
    showWait(reason, scoreText);
    return;
  }

  put("signal", direction);

  el("signal").className =
    "big " + (direction === "LONG" ? "green" : "red");

  put("score", scoreText);
  put("reason", reason);

  const entry = S.price;
  const distance = stats["5m"].atr * 1.5;

  if (!distance || !Number.isFinite(distance)) {
    showWait("ATR unavailable for risk levels.", scoreText);
    return;
  }

  put("entry", number(entry));

  if (direction === "LONG") {
    put("sl", number(entry - distance));
    put("tp1", number(entry + distance * 1.5));
    put("tp2", number(entry + distance * 2.5));
  } else {
    put("sl", number(entry + distance));
    put("tp1", number(entry - distance * 1.5));
    put("tp2", number(entry - distance * 2.5));
  }
}

// ======================================
// PUBLISH DATA TO LIVE API
// ======================================

let lastPublish = 0;

async function publishLiveData(stats, buyRatio, buyValue, sellValue) {
  if (Date.now() - lastPublish < 3000) return;

  lastPublish = Date.now();

  const longLiq = total(
    S.liqs.filter(x => x.side === "SELL").map(x => x.value)
  );

  const shortLiq = total(
    S.liqs.filter(x => x.side === "BUY").map(x => x.value)
  );

  const data = {
    symbol: "BTCUSDT",
    timestamp: new Date().toISOString(),

    price: S.price,
    change24h: S.change,

    signal: el("signal").textContent,
    score: el("score").textContent,
    reason: el("reason").textContent,

    entry: el("entry").textContent,
    stopLoss: el("sl").textContent,
    tp1: el("tp1").textContent,
    tp2: el("tp2").textContent,

    timeframes: stats,

    buyNotional: buyValue,
    sellNotional: sellValue,
    buyRatio,
    sellRatio: 1 - buyRatio,

    orderBook: S.book,
    openInterest: S.oi,
    oiChange: S.oiChange,
    funding: S.funding,
    markPrice: S.mark,

    liquidations: {
      long: longLiq,
      short: shortLiq
    },

    websocket: S.ws,
    lastWebSocket: S.lastWS,
    lastMarket: S.lastMarket,
    lastOI: S.lastOI,
    lastFunding: S.lastFunding,

    errors: S.errors.slice(-3)
  };

  try {
    const response = await fetch("/api/live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw Error("API HTTP " + response.status);
    }

    put("apiStatus", "Live API: Publishing successfully");

  } catch (e) {
    put("apiStatus", "Live API: Publish failed - " + String(e));
    addError("Live API publish: " + String(e));
  }
}

// ======================================
// RENDER DASHBOARD
// ======================================

function render() {
  try {
    if (S.price) {
      put("price", number(S.price) + " USDT");
      put("change", "24h change: " + number(S.change, 3) + "%");
    }

    put(
      "ws",
      "WebSocket: " + (S.ws ? "CONNECTED" : "RECONNECTING")
    );

    const stats = {};
    let rows = "";

    TIMEFRAMES.forEach(tf => {
      try {
        stats[tf] = calculate(S.candles[tf] || []);

        const x = stats[tf];
        const trend = x.e9 > x.e21 ? "BULL" : "BEAR";

        rows +=
          "<tr><td>" + tf + "</td><td>" +
          number(x.rsi, 1) + "</td><td class='" +
          (trend === "BULL" ? "green" : "red") + "'>" +
          trend + "</td><td class='" +
          (x.hist > 0 ? "green" : "red") + "'>" +
          (x.hist > 0 ? "BULL" : "BEAR") +
          "</td><td>" + number(x.volRatio, 2) + "x</td></tr>";

      } catch (e) {
        rows +=
          "<tr><td>" + tf +
          "</td><td colspan='4'>Loading</td></tr>";
      }
    });

    el("frames").innerHTML = rows;

    const buyValue = total(
      S.trades.filter(x => x.buy).map(x => x.value)
    );

    const sellValue = total(
      S.trades.filter(x => !x.buy).map(x => x.value)
    );

    const all = buyValue + sellValue;
    const buyRatio = all ? buyValue / all : 0.5;

    put("buy", number(buyValue, 0) + " USDT");
    put("sell", number(sellValue, 0) + " USDT");
    put("buyPct", number(buyRatio * 100, 1) + "%");
    put("sellPct", number((1-buyRatio) * 100, 1) + "%");

    put(
      "tradeInfo",
      "Recent trade sample · " +
      S.trades.length +
      " trades · 60-second window"
    );

    if (S.book) {
      put("bid", number(S.book.bv, 0) + " USDT");
      put("ask", number(S.book.av, 0) + " USDT");
      put("imb", number(S.book.imb * 100, 2) + "%");
      put("spread", number(S.book.spread, 4) + "%");
    }

    put(
      "oi",
      S.oi === null ? "--" : number(S.oi, 3) + " BTC"
    );

    put(
      "oiChange",
      S.oiChange === null ? "Baseline" : number(S.oiChange, 4) + "%"
    );

    put("funding", number(S.funding * 100, 5) + "%");
    put("mark", S.mark ? number(S.mark) : "--");

    const long = total(
      S.liqs.filter(x => x.side === "SELL").map(x => x.value)
    );

    const short = total(
      S.liqs.filter(x => x.side === "BUY").map(x => x.value)
    );

    put("longLiq", number(long, 0) + " USDT");
    put("shortLiq", number(short, 0) + " USDT");

    signal(stats, buyRatio);

    // FIXED: escaped newlines inside the outer HTML template.
    put(
      "health",
      "JavaScript: Running" +
      "\\nREST market: " + (S.lastMarket ? "Available" : "Waiting") +
      "\\nCandles loaded: " + Object.keys(S.candles).join(", ") +
      "\\nWebSocket: " + (S.ws ? "Connected" : "Reconnecting") +
      "\\nOI: " + (S.lastOI ? "Available" : "Waiting") +
      "\\nFunding: " + (S.lastFunding ? "Available" : "Waiting") +
      "\\nRecent errors: " + (S.errors.slice(-3).join(" | ") || "None")
    );

    publishLiveData(stats, buyRatio, buyValue, sellValue);

  } catch (e) {
    addError("Render error: " + String(e));
    put("health", "RENDER ERROR: " + String(e));
  }
}

// ======================================
// REFRESH ALL DATA
// ======================================

async function refreshAll() {
  if (S.busy) return;

  S.busy = true;
  put("health", "JavaScript running. Loading Binance data...");

  try {
    await Promise.allSettled([
      loadMarket(),
      loadCandles(),
      loadOI(),
      loadFunding()
    ]);

    render();

  } catch (e) {
    addError("Refresh error: " + String(e));
    put("health", "REFRESH ERROR: " + String(e));

  } finally {
    S.busy = false;
  }
}

// ======================================
// START APPLICATION
// ======================================

put("health", "JavaScript running. Starting Binance connection...");
put("apiStatus", "Live API: Waiting for dashboard data");

render();

connect();
refreshAll();

setInterval(() => {
  loadMarket().then(render).catch(e => {
    addError("Market update: " + String(e));
    render();
  });
}, 15000);

setInterval(() => {
  loadOI().then(render);
}, 30000);

setInterval(() => {
  loadFunding().then(render);
}, 60000);

setInterval(() => {
  loadCandles().then(render);
}, 60000);

setInterval(render, 2000);

</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    });
  }
};
