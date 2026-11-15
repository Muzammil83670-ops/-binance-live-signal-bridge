
export default {
  async fetch() {
    return new Response(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Binance Futures Signal</title>
<style>
body{font-family:Arial;background:#10151f;color:#eee;padding:16px}
.card{background:#1c2635;padding:14px;border-radius:12px;margin:12px 0}
button{padding:13px;border:0;border-radius:8px;background:#f0b90b;font-weight:bold;width:100%}
pre{white-space:pre-wrap;overflow-wrap:anywhere}
.green{color:#16c784}.red{color:#ea3943}.yellow{color:#f0b90b}
.big{font-size:28px;font-weight:bold}
.small{color:#aab4c3;font-size:13px}
</style>
</head>
<body>
<h2>BINANCE FUTURES PULSE</h2>
<div class="card">
  <div class="small">BTCUSDT PERPETUAL</div>
  <div id="price" class="big">Loading...</div>
  <div id="change" class="small"></div>
</div>
<div class="card">
  <div class="small">LIVE SIGNAL</div>
  <div id="signal" class="big yellow">WAIT</div>
  <p id="probability">LONG 0% | SHORT 0% | WAIT 100%</p>
  <div id="reason"></div>
</div>
<div class="card">
  <b>TIMEFRAME ANALYSIS</b>
  <pre id="frames">Loading...</pre>
</div>
<div class="card">
  <b>MARKET DATA</b>
  <pre id="market">Loading...</pre>
</div>
<button onclick="runAnalysis()">REFRESH LIVE DATA</button>
<p id="status" class="small">Starting...</p>

<script>
const BASE = "https://fapi.binance.com";
const symbol = "BTCUSDT";

async function get(path) {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function ema(values, period) {
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = values[i] * k + result * (1-k);
  }
  return result;
}

function rsi(values, period=14) {
  if (values.length <= period) return 50;
  let gain=0, loss=0;
  for(let i=values.length-period;i<values.length;i++){
    const d=values[i]-values[i-1];
    if(d>0) gain+=d;
    else loss-=d;
  }
  if(loss===0) return 100;
  return 100-(100/(1+gain/loss));
}

function indicators(raw) {
  const rows = raw.slice(0,-1);
  const closes = rows.map(x=>Number(x[4]));
  const volumes = rows.map(x=>Number(x[5]));
  const last = rows[rows.length-1];
  const prev = rows[rows.length-2];

  const e9 = ema(closes.slice(-60),9);
  const e21 = ema(closes.slice(-60),21);

  const fast = ema(closes.slice(-60),12);
  const slow = ema(closes.slice(-60),26);
  const macd = fast-slow;

  const priorFast = ema(closes.slice(-61,-1),12);
  const priorSlow = ema(closes.slice(-61,-1),26);
  const priorMacd = priorFast-priorSlow;
  const histogram = macd-priorMacd;

  const avgVol = volumes.slice(-21,-1)
    .reduce((a,b)=>a+b,0)/20;
  const volumeRatio = avgVol ? volumes[volumes.length-1]/avgVol : 0;

  const takerBuy = rows.slice(-20)
    .reduce((a,x)=>a+Number(x[9]),0);
  const totalVol = rows.slice(-20)
    .reduce((a,x)=>a+Number(x[5]),0);
  const buyRatio = totalVol ? takerBuy/totalVol : 0.5;

  const currentRSI = rsi(closes);

  let score=0;
  if(e9>e21) score++;
  else score--;

  if(histogram>0) score++;
  else score--;

  if(currentRSI>55) score++;
  else if(currentRSI<45) score--;

  if(buyRatio>0.55) score++;
  else if(buyRatio<0.45) score--;

  if(volumeRatio>1.2) {
    if(Number(last[4])>Number(prev[4])) score+=0.5;
    else if(Number(last[4])<Number(prev[4])) score-=0.5;
  }

  return {
    score,
    rsi:currentRSI,
    ema9:e9,
    ema21:e21,
    macd,
    histogram,
    volumeRatio,
    buyRatio,
    close:Number(last[4])
  };
}

async function runAnalysis() {
  const status=document.getElementById("status");
  status.textContent="Fetching Binance Futures data...";

  try {
    const paths = {
      price:"/fapi/v1/ticker/price?symbol="+symbol,
      ticker:"/fapi/v1/ticker/24hr?symbol="+symbol,
      k3:"/fapi/v1/klines?symbol="+symbol+"&interval=3m&limit=100",
      k5:"/fapi/v1/klines?symbol="+symbol+"&interval=5m&limit=100",
      k15:"/fapi/v1/klines?symbol="+symbol+"&interval=15m&limit=100",
      k1h:"/fapi/v1/klines?symbol="+symbol+"&interval=1h&limit=100",
      depth:"/fapi/v1/depth?symbol="+symbol+"&limit=20",
      oi:"/fapi/v1/openInterest?symbol="+symbol,
      funding:"/fapi/v1/premiumIndex?symbol="+symbol,
      trades:"/fapi/v1/aggTrades?symbol="+symbol+"&limit=100"
    };

    const names=Object.keys(paths);
    const values=await Promise.all(names.map(n=>get(paths[n])));
    const d=Object.fromEntries(names.map((n,i)=>[n,values[i]]));

    const tfs={
      "3m":indicators(d.k3),
      "5m":indicators(d.k5),
      "15m":indicators(d.k15),
      "1h":indicators(d.k1h)
    };

    const weights={"3m":1,"5m":1,"15m":1.5,"1h":2};
    let score=0;
    for(const tf in tfs) score+=tfs[tf].score*weights[tf];

    const bids=d.depth.bids.reduce((a,x)=>a+Number(x[1]),0);
    const asks=d.depth.asks.reduce((a,x)=>a+Number(x[1]),0);
    const imbalance=(bids+asks)?(bids-asks)/(bids+asks):0;

    if(imbalance>0.10) score+=1;
    else if(imbalance< -0.10) score-=1;

    const funding=Number(d.funding.lastFundingRate);
    if(funding>0.0005) score-=0.5;
    else if(funding< -0.0005) score+=0.5;

    const buyTrades=d.trades.filter(x=>!x.m).length;
    const sellTrades=d.trades.length-buyTrades;
    const tradeRatio=d.trades.length?buyTrades/d.trades.length:0.5;

    if(tradeRatio>0.60) score+=0.5;
    else if(tradeRatio<0.40) score-=0.5;

    let signal="WAIT";
    if(score>=4) signal="LONG";
    else if(score<=-4) signal="SHORT";

    const directional=Math.min(85,Math.round(Math.abs(score)/15*85));
    const wait=100-directional;
    const long=score>0?directional:0;
    const short=score<0?directional:0;

    document.getElementById("price").textContent=
      Number(d.price.price).toLocaleString("en-US")+" USDT";

    document.getElementById("change").textContent=
      "24h change: "+d.ticker.priceChangePercent+"%";

    const signalEl=document.getElementById("signal");
    signalEl.textContent=signal+" | Score: "+score.toFixed(1);
    signalEl.className="big "+
      (signal==="LONG"?"green":signal==="SHORT"?"red":"yellow");

    document.getElementById("probability").textContent=
      "LONG "+long+"% | SHORT "+short+"% | WAIT "+wait+"%";

    document.getElementById("frames").textContent=
      Object.entries(tfs).map(([tf,x])=>
        tf+
        " | RSI: "+x.rsi.toFixed(1)+
        " | EMA9: "+x.ema9.toFixed(2)+
        " | EMA21: "+x.ema21.toFixed(2)+
        " | MACD Hist: "+x.histogram.toFixed(4)+
        " | Vol Ratio: "+x.volumeRatio.toFixed(2)+
        " | Buy Ratio: "+(x.buyRatio*100).toFixed(1)+"%"
      ).join("\\n");

    document.getElementById("market").textContent=
      "24h Volume: "+Number(d.ticker.quoteVolume).toLocaleString()+" USDT"+
      "\\nOrder Book Imbalance: "+(imbalance*100).toFixed(2)+"%"+
      "\\nBid Quantity: "+bids.toFixed(3)+
      "\\nAsk Quantity: "+asks.toFixed(3)+
      "\\nOpen Interest: "+d.oi.openInterest+
      "\\nFunding Rate: "+funding+
      "\\nRecent Agg Trades: "+d.trades.length+
      "\\nBuyer-initiated trades: "+buyTrades+
      "\\nSeller-initiated trades: "+sellTrades+
      "\\nTrade Buy Ratio: "+(tradeRatio*100).toFixed(1)+"%";

    document.getElementById("reason").textContent=
      "Order book and recent trades are included. OI is current level; OI direction needs comparison over time.";

    status.textContent="Updated: "+new Date().toLocaleTimeString();

  } catch(error) {
    status.textContent="DATA ERROR: "+error.message;
  }
}

runAnalysis();
setInterval(runAnalysis,30000);
</script>
</body>
</html>`, {
      headers: { "Content-Type": "text/html; charset=UTF-8" }
    });
  }
};
