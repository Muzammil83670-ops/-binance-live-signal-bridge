
export default {
  async fetch() {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Binance Futures Pulse V3</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:14px;background:#0d1420;color:#e8edf5;font-family:Arial,sans-serif}
h2{margin:8px 0 16px}
.card{background:#182334;border:1px solid #26364d;border-radius:12px;padding:14px;margin:12px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.metric{background:#111c2b;padding:10px;border-radius:9px;min-width:0}
.label{font-size:12px;color:#9aabc0}
.value{font-size:19px;font-weight:bold;margin-top:5px;overflow-wrap:anywhere}
.small{font-size:12px;color:#9aabc0;line-height:1.6}
.big{font-size:29px;font-weight:bold}
.green{color:#16c784}.red{color:#ea3943}.yellow{color:#f0b90b}
button{width:100%;padding:13px;border:0;border-radius:9px;background:#f0b90b;color:#111;font-weight:bold;font-size:15px}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{padding:9px 5px;border-bottom:1px solid #2b3b50;text-align:right}
td:first-child,th:first-child{text-align:left}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
hr{border:0;border-top:1px solid #2b3b50;margin:12px 0}
</style>
</head>
<body>

<h2>BINANCE FUTURES PULSE V3</h2>
<div class="small">BTCUSDT PERPETUAL · LIVE MARKET INTELLIGENCE</div>

<div class="card">
 <div class="label">BTC LIVE PRICE</div>
 <div id="price" class="big">Connecting...</div>
 <div id="dayChange" class="small">24h change: --</div>
 <div id="connection" class="small">WebSocket: Connecting...</div>
</div>

<div class="card">
 <div class="label">TRADE SIGNAL</div>
 <div id="signal" class="big yellow">WAIT</div>
 <div id="score" class="small">Score: --</div>
 <hr>
 <div id="signalReason" class="small">Waiting for market data...</div>
 <div class="grid" style="margin-top:12px">
  <div class="metric"><div class="label">ENTRY</div><div id="entry" class="value">--</div></div>
  <div class="metric"><div class="label">STOP LOSS</div><div id="stop" class="value red">--</div></div>
  <div class="metric"><div class="label">TAKE PROFIT 1</div><div id="tp1" class="value green">--</div></div>
  <div class="metric"><div class="label">TAKE PROFIT 2</div><div id="tp2" class="value green">--</div></div>
 </div>
 <div id="riskNote" class="small">Risk levels are estimates, not guaranteed execution prices.</div>
</div>

<div class="card">
 <b>MULTI-TIMEFRAME ANALYSIS</b>
 <table>
 <thead><tr><th>TF</th><th>RSI</th><th>EMA Trend</th><th>MACD</th><th>Vol x</th></tr></thead>
 <tbody id="timeframes"><tr><td colspan="5">Loading...</td></tr></tbody>
 </table>
</div>

<div class="card">
 <b>BUY / SELL PRESSURE</b>
 <div class="grid">
  <div class="metric"><div class="label">BUY VOLUME</div><div id="buy" class="value green">--</div></div>
  <div class="metric"><div class="label">SELL VOLUME</div><div id="sell" class="value red">--</div></div>
  <div class="metric"><div class="label">BUY PRESSURE</div><div id="buyPressure" class="value">--</div></div>
  <div class="metric"><div class="label">SELL PRESSURE</div><div id="sellPressure" class="value">--</div></div>
 </div>
 <div id="tradeInfo" class="small">Recent trades: waiting...</div>
</div>

<div class="card">
 <b>ORDER BOOK</b>
 <div class="grid">
  <div class="metric"><div class="label">BID VALUE</div><div id="bidValue" class="value green">--</div></div>
  <div class="metric"><div class="label">ASK VALUE</div><div id="askValue" class="value red">--</div></div>
  <div class="metric"><div class="label">IMBALANCE</div><div id="imbalance" class="value">--</div></div>
  <div class="metric"><div class="label">SPREAD</div><div id="spread" class="value">--</div></div>
 </div>
 <div id="bookInfo" class="small">Waiting for order book...</div>
</div>

<div class="card">
 <b>OPEN INTEREST & FUNDING</b>
 <div class="grid">
  <div class="metric"><div class="label">OPEN INTEREST</div><div id="oi" class="value">--</div></div>
  <div class="metric"><div class="label">OI CHANGE</div><div id="oiChange" class="value">--</div></div>
  <div class="metric"><div class="label">FUNDING RATE</div><div id="funding" class="value">--</div></div>
  <div class="metric"><div class="label">MARK PRICE</div><div id="mark" class="value">--</div></div>
 </div>
</div>

<div class="card">
 <b>LIQUIDATION MONITOR</b>
 <div class="grid">
  <div class="metric"><div class="label">LONG LIQUIDATIONS</div><div id="longLiq" class="value red">--</div></div>
  <div class="metric"><div class="label">SHORT LIQUIDATIONS</div><div id="shortLiq" class="value green">--</div></div>
 </div>
 <div id="liqInfo" class="small">Waiting for liquidation events...</div>
</div>

<div class="card">
 <b>MARKET STATUS & DATA HEALTH</b>
 <pre id="health">Starting...</pre>
</div>

<button onclick="refreshAll()">REFRESH ALL DATA</button>
<div class="small" style="margin:12px 0">
Auto refresh: candles 60 sec · OI 30 sec · funding 60 sec · WebSocket live
</div>

<script>
const BASE = "https://fapi.binance.com";
const SYMBOL = "BTCUSDT";
const STREAMS = [
 "btcusdt@aggTrade",
 "btcusdt@depth20@100ms",
 "btcusdt@kline_1m",
 "btcusdt@kline_3m",
 "btcusdt@kline_5m",
 "btcusdt@kline_15m",
 "btcusdt@kline_1h",
 "btcusdt@kline_4h",
 "!forceOrder@arr"
];

const state = {
 price:0, dayChange:0, mark:0, funding:0,
 oi:null, previousOI:null, oiChange:null,
 candles:{}, book:null, previousBook:null,
 trades:[], liquidations:[],
 ws:null, wsConnected:false, lastWs:0,
 lastDepth:0, lastTrade:0, lastKline:0,
 lastOI:0, lastFunding:0,
 errors:[], reconnect:1000
};

const $ = id => document.getElementById(id);
const fmt = (n,d=2) => Number(n).toLocaleString("en-US",{
 minimumFractionDigits:d,maximumFractionDigits:d
});
const sum = arr => arr.reduce((a,b)=>a+b,0);

async function api(path) {
 const r = await fetch(BASE+path);
 if(!r.ok) throw new Error("HTTP "+r.status+" "+path);
 return r.json();
}

function setText(id,value){$(id).textContent=value;}

function ema(values,period){
 const k=2/(period+1);
 let v=values[0];
 const out=[v];
 for(let i=1;i<values.length;i++){
  v=values[i]*k+v*(1-k);
  out.push(v);
 }
 return out;
}

function rsi(values,period=14){
 if(values.length<period+1)return 50;
 let gain=0,loss=0;
 for(let i=1;i<=period;i++){
  const d=values[i]-values[i-1];
  gain+=Math.max(d,0);
  loss+=Math.max(-d,0);
 }
 let ag=gain/period,al=loss/period;
 for(let i=period+1;i<values.length;i++){
  const d=values[i]-values[i-1];
  ag=(ag*(period-1)+Math.max(d,0))/period;
  al=(al*(period-1)+Math.max(-d,0))/period;
 }
 if(al===0)return 100;
 return 100-100/(1+ag/al);
}

function atr(rows,period=14){
 if(rows.length<period+1)return 0;
 const tr=[];
 for(let i=1;i<rows.length;i++){
  const high=Number(rows[i][2]);
  const low=Number(rows[i][3]);
  const prev=Number(rows[i-1][4]);
  tr.push(Math.max(high-low,Math.abs(high-prev),Math.abs(low-prev)));
 }
 return sum(tr.slice(-period))/period;
}

function indicators(raw){
 // آخری جاری candle کو نکالیں
 const rows=raw.slice(0,-1);
 if(rows.length<205)throw new Error("Need more candles for EMA200");

 const close=rows.map(x=>Number(x[4]));
 const volume=rows.map(x=>Number(x[5]));
 const e9=ema(close,9);
 const e21=ema(close,21);
 const e50=ema(close,50);
 const e200=ema(close,200);
 const fast=ema(close,12);
 const slow=ema(close,26);
 const macd=fast.map((x,i)=>x-slow[i]);
 const sig=ema(macd,9);
 const hist=macd.map((x,i)=>x-sig[i]);
 const i=close.length-1;
 const avgVol=sum(volume.slice(-21,-1))/20;
 const volumeRatio=avgVol>0?volume[i]/avgVol:0;
 const recent=rows.slice(-20);
 const totalVol=sum(recent.map(x=>Number(x[5])));
 const buyVol=sum(recent.map(x=>Number(x[9])));
 const buyRatio=totalVol>0?buyVol/totalVol:0.5;
 const currentRSI=rsi(close);
 const currentATR=atr(rows);
 let score=0;
 if(e9[i]>e21[i])score++;
 else score--;
 if(e50[i]>e200[i])score++;
 else score--;
 if(hist[i]>0)score++;
 else score--;
 if(currentRSI>55)score++;
 else if(currentRSI<45)score--;
 if(buyRatio>0.55)score++;
 else if(buyRatio<0.45)score--;
 if(volumeRatio>1.3){
  if(close[i]>close[i-1])score+=0.5;
  else if(close[i]<close[i-1])score-=0.5;
 }
 return {
  score,rsi:currentRSI,e9:e9[i],e21:e21[i],
  e50:e50[i],e200:e200[i],hist:hist[i],
  volumeRatio,buyRatio,atr:currentATR,
  close:close[i]
 };
}

function addTrade(t){
 const price=Number(t.p);
 const qty=Number(t.q);
 const value=price*qty;
 state.trades.push({
  time:Number(t.T),
  value,
  buyInitiated:!t.m,
  price
 });
 const cutoff=Date.now()-60000;
 state.trades=state.trades.filter(x=>x.time>=cutoff);
 state.lastTrade=Date.now();
 state.price=price;
}

function addLiquidation(order){
 if(!order||!order.ap)return;
 const value=Number(order.ap)*Number(order.q);
 state.liquidations.push({
  time:Date.now(),
  side:order.S,
  value
 });
 state.liquidations=state.liquidations.filter(
  x=>x.time>Date.now()-300000
 );
}

function updateBook(data){
 if(!data.bids||!data.asks)return;
 const bids=data.bids.map(x=>[Number(x[0]),Number(x[1])]);
 const asks=data.asks.map(x=>[Number(x[0]),Number(x[1])]);
 const bidValue=sum(bids.map(x=>x[0]*x[1]));
 const askValue=sum(asks.map(x=>x[0]*x[1]));
 const total=bidValue+askValue;
 const bestBid=Math.max(...bids.map(x=>x[0]));
 const bestAsk=Math.min(...asks.map(x=>x[0]));
 const mid=(bestBid+bestAsk)/2;
 state.book={
  bids,asks,bidValue,askValue,
  imbalance:total?(bidValue-askValue)/total:0,
  spread:mid?(bestAsk-bestBid)/mid*100:0,
  time:Date.now()
 };
 state.lastDepth=Date.now();
}

function connectWS(){
 try{
  if(state.ws)state.ws.close();
  const url="wss://fstream.binance.com/stream?streams="+
   STREAMS.join("/");
  const ws=new WebSocket(url);
  state.ws=ws;

  ws.onopen=()=>{
   state.wsConnected=true;
   state.reconnect=1000;
   renderHealth();
  };

  ws.onmessage=event=>{
   state.lastWs=Date.now();
   try{
    const packet=JSON.parse(event.data);
    const stream=packet.stream||"";
    const d=packet.data||{};

    if(stream.includes("@aggTrade")){
     addTrade(d);
    }else if(stream.includes("@depth20")){
     updateBook(d);
    }else if(stream.includes("@kline_")){
     const k=d.k;
     if(k&&k.x){
      const tf=k.i;
      const row=[
       k.t,k.o,k.h,k.l,k.c,k.v,k.T,k.q,k.n,
       k.V,k.Q,k.B
      ];
      if(state.candles[tf]){
       state.candles[tf].push(row);
       state.candles[tf]=state.candles[tf].slice(-350);
      }
      state.lastKline=Date.now();
     }
    }else if(stream==="!forceOrder@arr"){
     const o=d.o;
     if(o)addLiquidation(o);
    }
   }catch(e){
    state.errors.push("WebSocket message: "+e.message);
   }
  };

  ws.onerror=()=>{
   state.wsConnected=false;
   renderHealth();
  };

  ws.onclose=()=>{
   state.wsConnected=false;
   renderHealth();
   const delay=state.reconnect;
   state.reconnect=Math.min(state.reconnect*2,30000);
   setTimeout(connectWS,delay);
  };
 }catch(e){
  state.errors.push("WebSocket: "+e.message);
 }
}

async function loadCandles(){
 const tfs=[
  ["1m","1m"],["3m","3m"],["5m","5m"],
  ["15m","15m"],["1h","1h"],["4h","4h"]
 ];
 const results=await Promise.allSettled(
  tfs.map(async ([key,interval])=>{
   const data=await api(
    "/fapi/v1/klines?symbol="+SYMBOL+
    "&interval="+interval+"&limit=300"
   );
   state.candles[interval]=data;
  })
 );
 results.forEach((r,i)=>{
  if(r.status==="rejected"){
   state.errors.push(tfs[i][0]+" candles: "+r.reason.message);
  }
 });
}

async function loadTicker(){
 try{
  const d=await api("/fapi/v1/ticker/24hr?symbol="+SYMBOL);
  state.dayChange=Number(d.priceChangePercent);
 }catch(e){state.errors.push("Ticker: "+e.message)}
}

async function loadOI(){
 try{
  const d=await api("/fapi/v1/openInterest?symbol="+SYMBOL);
  const next=Number(d.openInterest);
  if(state.oi!==null&&state.oi>0){
   state.oiChange=(next-state.oi)/state.oi*100;
  }
  state.previousOI=state.oi;
  state.oi=next;
  state.lastOI=Date.now();
 }catch(e){state.errors.push("OI: "+e.message)}
}

async function loadFunding(){
 try{
  const d=await api("/fapi/v1/premiumIndex?symbol="+SYMBOL);
  state.funding=Number(d.lastFundingRate);
  state.mark=Number(d.markPrice);
  state.lastFunding=Date.now();
 }catch(e){state.errors.push("Funding: "+e.message)}
}

function render(){
 const price=state.price||state.mark;
 if(price){
  setText("price",fmt(price,2)+" USDT");
  setText("dayChange","24h change: "+fmt(state.dayChange,3)+"%");
 }

 const tfMap=[
  ["1m","1m"],["3m","3m"],["5m","5m"],
  ["15m","15m"],["1h","1h"],["4h","4h"]
 ];
 const stats={};
 let rows="";

 for(const [label,key] of tfMap){
  try{
   if(!state.candles[key])throw new Error("Loading");
   const x=indicators(state.candles[key]);
   stats[key]=x;
   const trend=x.e9>x.e21?"BULL":"BEAR";
   const macd=x.hist>0?"BULL":"BEAR";
   rows+="<tr><td>"+label+"</td><td>"+fmt(x.rsi,1)+
    "</td><td class='"+(trend==="BULL"?"green":"red")+"'>"+
    trend+"</td><td class='"+(macd==="BULL"?"green":"red")+"'>"+
    macd+"</td><td>"+fmt(x.volumeRatio,2)+"x</td></tr>";
  }catch(e){
   rows+="<tr><td>"+label+"</td><td colspan='4'>Data loading</td></tr>";
  }
 }
 $("timeframes").innerHTML=rows;

 const buy=sum(state.trades.filter(x=>x.buyInitiated).map(x=>x.value));
 const sell=sum(state.trades.filter(x=>!x.buyInitiated).map(x=>x.value));
 const total=buy+sell;
 const buyPct=total?buy/total:0;
 setText("buy",fmt(buy,0)+" USDT");
 setText("sell",fmt(sell,0)+" USDT");
 setText("buyPressure",fmt(buyPct*100,1)+"%");
 setText("sellPressure",fmt((1-buyPct)*100,1)+"%");
 setText("tradeInfo","Last 60 seconds · "+state.trades.length+
  " trades · based on actual trade notional");

 if(state.book){
  const b=state.book;
  setText("bidValue",fmt(b.bidValue,0)+" USDT");
  setText("askValue",fmt(b.askValue,0)+" USDT");
  setText("imbalance",fmt(b.imbalance*100,2)+"%");
  setText("spread",fmt(b.spread,4)+"%");
  setText("bookInfo","Top 20 levels · Last update "+
   new Date(b.time).toLocaleTimeString());
 }

 setText("oi",state.oi===null?"--":fmt(state.oi,3)+" BTC");
 setText("oiChange",state.oiChange===null?"Baseline":fmt(state.oiChange,4)+"%");
 setText("funding",fmt(state.funding*100,5)+"%");
 setText("mark",state.mark?fmt(state.mark,2):"--");

 const longLiq=sum(state.liquidations.filter(x=>x.side==="SELL").map(x=>x.value));
 const shortLiq=sum(state.liquidations.filter(x=>x.side==="BUY").map(x=>x.value));
 setText("longLiq",fmt(longLiq,0)+" USDT");
 setText("shortLiq",fmt(shortLiq,0)+" USDT");
 setText("liqInfo","5-minute observed liquidation events. SELL = long liquidation; BUY = short liquidation.");

 calculateSignal(stats,buyPct);
 renderHealth();
}

function calculateSignal(stats,buyPct){
 const required=["3m","5m","15m","1h","4h"];
 const missing=required.filter(x=>!stats[x]);
 const freshWS=Date.now()-state.lastWs<20000;
 const freshBook=state.book&&Date.now()-state.lastDepth<10000;
 const freshOI=state.lastOI&&Date.now()-state.lastOI<90000;
 const freshFunding=state.lastFunding&&Date.now()-state.lastFunding<120000;

 if(missing.length||!freshWS||!freshBook||!freshOI||!freshFunding||!state.price){
  showWait("WAIT — DATA INCOMPLETE",
   "Missing/stale data: "+missing.join(", ")+
   (freshWS?"":" · WebSocket")+
   (freshBook?"":" · Order Book")+
   (freshOI?"":" · Open Interest")+
   (freshFunding?"":" · Funding"));
  return;
 }

 const weights={"1m":0.25,"3m":0.5,"5m":0.75,"15m":1.5,"1h":2.5,"4h":2};
 let score=0;
 for(const tf in weights){
  score+=stats[tf].score*weights[tf];
 }

 const book=state.book.imbalance;
 if(book>0.12)score+=0.75;
 else if(book< -0.12)score-=0.75;

 if(buyPct>0.58)score+=1;
 else if(buyPct<0.42)score-=1;

 if(state.oiChange!==null){
  if(state.oiChange>0.05&&stats["5m"].close>stats["5m"].e21)score+=0.75;
  if(state.oiChange>0.05&&stats["5m"].close<stats["5m"].e21)score-=0.75;
 }

 if(state.funding>0.0005)score-=0.25;
 if(state.funding< -0.0005)score+=0.25;

 const bullishHigher=stats["15m"].score>0&&stats["1h"].score>0;
 const bearishHigher=stats["15m"].score<0&&stats["1h"].score<0;
 const bullish4h=stats["4h"].score>0;
 const bearish4h=stats["4h"].score<0;

 const buyConfirm=buyPct>0.50&&book>0;
 const sellConfirm=buyPct<0.50&&book<0;

 let signal="WAIT";
 let reason="Mixed conditions. Wait for confirmation.";

 if(score>=5&&bullishHigher&&bullish4h&&buyConfirm){
  signal="LONG";
  reason="15m, 1h and 4h bullish; live buying and order book confirm.";
 }else if(score<=-5&&bearishHigher&&bearish4h&&sellConfirm){
  signal="SHORT";
  reason="15m, 1h and 4h bearish; live selling and order book confirm.";
 }else{
  reason="No full multi-timeframe confirmation. Do not force a trade.";
 }

 $("signal").textContent=signal;
 $("signal").className="big "+(signal==="LONG"?"green":signal==="SHORT"?"red":"yellow");
 setText("score","Technical score: "+score.toFixed(2)+" · Not a win probability");
 setText("signalReason",reason);

 if(signal==="WAIT"){
  setLevels(null,null,null,null);
  return;
 }

 const entry=state.price;
 const volatility=stats["5m"].atr;
 if(!volatility||!Number.isFinite(volatility)){
  showWait("WAIT — ATR UNAVAILABLE","Cannot calculate risk levels.");
  return;
 }

 const distance=volatility*1.5;
 if(signal==="LONG"){
  setLevels(entry,entry-distance,entry+distance*1.5,entry+distance*2.5);
 }else{
  setLevels(entry,entry+distance,entry-distance*1.5,entry-distance*2.5);
 }
}

function setLevels(entry,stop,tp1,tp2){
 setText("entry",entry?fmt(entry,2):"--");
 setText("stop",stop?fmt(stop,2):"--");
 setText("tp1",tp1?fmt(tp1,2):"--");
 setText("tp2",tp2?fmt(tp2,2):"--");
}

function showWait(title,reason){
 $("signal").textContent=title;
 $("signal").className="big yellow";
 setText("signalReason",reason);
 setLevels(null,null,null,null);
}

function renderHealth(){
 const age=state.lastWs?Math.round((Date.now()-state.lastWs)/1000):null;
 setText("connection","WebSocket: "+(state.wsConnected?"CONNECTED":"DISCONNECTED")+
  (age===null?"":" · Last message "+age+"s ago"));

 const health=[
  "WebSocket: "+(state.wsConnected?"Connected":"Disconnected"),
  "Market price: "+(state.price?"Available":"Waiting"),
  "Order book: "+(state.book?"Available":"Waiting"),
  "Open interest: "+(state.oi===null?"Waiting":"Available"),
  "Funding: "+(state.lastFunding?"Available":"Waiting"),
  "Candles: "+Object.keys(state.candles).join(", "),
  "Errors: "+(state.errors.slice(-4).join(" | ")||"None")
 ];
 setText("health",health.join("\\n"));
}

async function refreshAll(){
 $("connection").textContent="Refreshing REST data...";
 await Promise.allSettled([
  loadCandles(),loadTicker(),loadOI(),loadFunding()
 ]);
 render();
}

connectWS();
refreshAll();

setInterval(loadOI,30000);
setInterval(loadFunding,60000);
setInterval(loadTicker,15000);
setInterval(loadCandles,60000);
setInterval(render,2000);

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
`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    });
  }
};
