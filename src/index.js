
const hosts = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi4.binance.com"
];

export default {
  async fetch() {
    const results = await Promise.all(
      hosts.map(async host => {
        try {
          const response = await fetch(
            host + "/fapi/v1/ticker/price?symbol=BTCUSDT"
          );

          return {
            host,
            status: response.status,
            result: await response.text()
          };
        } catch (error) {
          return {
            host,
            error: error.message
          };
        }
      })
    );

    return Response.json({
      test: "Binance Futures Host Test",
      results,
      timestamp: Date.now()
    });
  }
};
