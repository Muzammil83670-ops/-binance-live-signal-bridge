
export default {
  async fetch() {
    return new Response(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Binance Futures Data Test</title>
</head>
<body style="font-family:Arial;padding:18px">
<h2>Binance Futures Live Data</h2>
<p id="status">Ready</p>
<button onclick="runTest()">GET LIVE DATA</button>
<button onclick="copyResult()">COPY DATA</button>
<pre id="result" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>

<script>
let snapshot = {};

async function getData(name, path) {
  try {
    const response = await fetch("https://fapi.binance.com" + path);
    const data = await response.json();

    if (!response.ok) {
      throw new Error("HTTP " + response.status + ": " +
        JSON.stringify(data));
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTest() {
  document.getElementById("status").textContent =
    "Loading Binance data...";

  const symbol = "BTCUSDT";

  const requests = {
    price: "/fapi/v1/ticker/price?symbol=" + symbol,
    ticker24h: "/fapi/v1/ticker/24hr?symbol=" + symbol,
    candles3m: "/fapi/v1/klines?symbol=" + symbol + "&interval=3m&limit=100",
    candles5m: "/fapi/v1/klines?symbol=" + symbol + "&interval=5m&limit=100",
    candles15m: "/fapi/v1/klines?symbol=" + symbol + "&interval=15m&limit=100",
    candles1h: "/fapi/v1/klines?symbol=" + symbol + "&interval=1h&limit=100",
    orderBook: "/fapi/v1/depth?symbol=" + symbol + "&limit=20",
    openInterest: "/fapi/v1/openInterest?symbol=" + symbol,
    funding: "/fapi/v1/premiumIndex?symbol=" + symbol,
    trades: "/fapi/v1/aggTrades?symbol=" + symbol + "&limit=100"
  };

  const names = Object.keys(requests);

  const results = await Promise.all(
    names.map(async name => [
      name,
      await getData(name, requests[name])
    ])
  );

  snapshot = {
    symbol,
    timestamp: new Date().toISOString(),
    results: Object.fromEntries(results)
  };

  document.getElementById("result").textContent =
    JSON.stringify(snapshot, null, 2);

  const passed = results.filter(x => x[1].success).length;
  document.getElementById("status").textContent =
    passed + " / " + names.length + " endpoints successful";
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(snapshot, null, 2)
    );
    document.getElementById("status").textContent =
      "Data copied successfully";
  } catch (error) {
    document.getElementById("status").textContent =
      "Copy failed: " + error.message;
  }
}
</script>
</body>
</html>`, {
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
};
