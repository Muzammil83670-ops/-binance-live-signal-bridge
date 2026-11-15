
export default {
  async fetch() {
    return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Binance Browser Test</title>
</head>
<body style="font-family:Arial;padding:20px">
  <h2>Binance Live Data Test</h2>
  <button onclick="testBinance()">Test Binance API</button>
  <pre id="result" style="white-space:pre-wrap"></pre>

  <script>
    async function testBinance() {
      const output = document.getElementById("result");
      output.textContent = "Testing...";

      try {
        const response = await fetch(
          "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT"
        );

        const data = await response.json();

        output.textContent = JSON.stringify({
          status: response.status,
          data: data
        }, null, 2);
      } catch (error) {
        output.textContent = "ERROR: " + error.message;
      }
    }
  </script>
</body>
</html>`, {
      headers: {
        "Content-Type": "text/html; charset=UTF-8"
      }
    });
  }
};
