
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ==========================================
    // V3 LIVE DATA API
    // ==========================================

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

      const snapshotKey = new Request(
        url.origin + "/__v3_live_snapshot",
        { method: "GET" }
      );

      if (request.method === "POST") {
        try {
          const body = await request.text();
          const data = JSON.parse(body);

          if (
            !data ||
            data.symbol !== "BTCUSDT" ||
            typeof data.timestamp !== "string"
          ) {
            return new Response(
              JSON.stringify({ error: "Invalid V3 data" }),
              { status: 400, headers }
            );
          }

          await caches.default.put(
            snapshotKey,
            new Response(body, {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10"
              }
            })
          );

          return new Response(
            JSON.stringify({
              saved: true,
              timestamp: data.timestamp
            }),
            { headers }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: "Could not save live data",
              detail: String(error)
            }),
            { status: 500, headers }
          );
        }
      }

      if (request.method === "GET") {
        try {
          const saved = await caches.default.match(snapshotKey);

          if (!saved) {
            return new Response(
              JSON.stringify({
                status: "waiting",
                message: "Open the V3 dashboard first."
              }),
              { status: 503, headers }
            );
          }

          const data = await saved.json();

          return new Response(JSON.stringify(data), {
            headers
          });
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: "Could not read live data",
              detail: String(error)
            }),
            { status: 500, headers }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers }
      );
    }

    // ==========================================
    // V3 DASHBOARD
    // ==========================================

    const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Binance Futures Pulse V3</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:14px;background:#0d1420;color:#edf2fa;font-family:Arial}
h2{font-size:21px}
.card{background:#192638;border:1px solid #2b3d54;border-radius:12px;padding:14px;margin:12px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.metric{background:#101b2a;padding:10px;border-radius:8px;overflow-wrap:anywhere}
.label{font-size:12px;color:#9eafc3}
.value{font-size:18px;font-weight:bold;margin-top:6px}
.big{font-size:29px;font-weight:bold}
.green{color:#16c784}.red{color:#ea3943}.yellow{color:#f0b90b}
.small{font-size:12px;color:#9eafc3;line-height:1.6;white-space:pre-line}
table{width:100%;border-collapse:collapse;font-size:12px}
td,th{padding:9px 4px;border-bottom:1px solid #304158;text-align:right}
td:first-child,th:first-child{text-align:left}
button{width:100%;padding:14px;background:#f0b90b;color:#111;border:0;border-radius:9px;font-weight:bold}
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
 <p id="reason" class="small">Waiting for market data.</p>
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
 <thead><tr><th>TF</th><th>RSI</th><th>EMA</th><th>MACD</th><th>VOL</th></tr></thead>
 <tbody id="frames"><tr><td colspan="5">Loading...</td></tr></tbody>
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
 <div id="health" class="small">Starting...</div>
 <div class="small" id="apiStatus">Live API: Starting...</div>
</div>

<button onclick="refreshAll()">REFRESH DATA</button>
<div class="small">Candles: 60 sec · Market data: 15 sec · OI: 30 sec</div>

<script>
"use strict";

const API="https://fapi.binance.com";
const SYMBOL="BTCUSDT";
const TIMEFRAMES=["1m","3m","5m","15m","1h","4h"];

const S={
 price:0,change:0,mark:0,funding:0,
 oi:null,oiChange:null,book:null,candles:{},
 trades:[],liqs:[],ws:false,lastWS:0,
 errors:[],lastOI:0,lastFunding:0,
 lastCandles:0,lastMarket:0,
 previousSignal:"WAIT",busy:false
};

const el=id=>document.getElementById(id);
const put=(id,v)=>{el(id).textContent=v};
const number=(n,d=2)=>Number(n).toLocaleString("en-US",{
 minimumFractionDigits:d,
 maximumFractionDigits:d
});
const total=a=>a.reduce((x,y)=>x+y,0);

async function get(path){
 const response=await fetch(API+path);
 if(!response.ok)throw Error("HTTP "+response.status);
 return response.json();
}

function ema(a,p){
 const k=2/(p+1);
 let v=a[0],out=[v];
 for(let i=1;i<a.length;i++){
  v=a[i]*k+v*(1-k);
  out.push(v);
 }
 return out;
}

function rsi(a,p=14){
 if(a.length<p+1)return 50;
 let gain=0,loss=0;

 for(let i=1;i<=p;i++){
  const d=a[i]-a[i-1];
  gain+=Math.max(d,0);
  loss+=Math.max(-d,0);
 }

 let ag=gain/p,al=loss/p;

 for(let i=p+1;i<a.length;i++){
  const d=a[i]-a[i-1];
  ag=(ag*(p-1)+Math.max(d,0))/p;
  al=(al*(p-1)+Math.max(-d,0))/p;
 }

 return al===0?100:100-100/(1+ag/al);
}

function calculate(raw){
 const rows=raw.slice(0,-1);

 if(rows.length<205)throw Error("Waiting for 205 closed candles");

 const c=rows.map(x=>Number(x[4]));
 const v=rows.map(x=>Number(x[5]));

 const e9=ema(c,9);
 const e21=ema(c,21);
 const e50=ema(c,50);
 const e200=ema(c,200);

 const m1=ema(c,12);
 const m2=ema(c,26);
 const macd=m1.map((x,i)=>x-m2[i]);
 const sig=ema(macd,9);

 const i=c.length-1;
 const hist=macd[i]-sig[i];
 const currentRSI=rsi(c);

 const avg=total(v.slice(-21,-1))/20;
 const volRatio=avg?v[i]/avg:0;

 const last=rows.slice(-20);
 const allVol=total(last.map(x=>Number(x[5])));
 const takerBuy=total(last.map(x=>Number(x[9])));
 const buyRatio=allVol?takerBuy/allVol:0.5;

 const tr=[];

 for(let j=1;j<rows.length;j++){
  const hi=Number(rows[j][2]);
  const lo=Number(rows[j][3]);
  const prev=Number(rows[j-1][4]);

  tr.push(Math.max(
   hi-lo,
   Math.abs(hi-prev),
   Math.abs(lo-prev)
  ));
 }

 const atr=total(tr.slice(-14))/14;

 let score=0;
 score+=e9[i]>e21[i]?1:-1;
 score+=e50[i]>e200[i]?1:-1;
 score+=hist>0?1:-1;
 score+=currentRSI>55?1:(currentRSI<45?-1:0);
 score+=buyRatio>0.55?1:(buyRatio<0.45?-1:0);

 if(volRatio>1.3)score+=c[i]>c[i-1]?0.5:-0.5;

 return {
  score,
  rsi:currentRSI,
  e9:e9[i],
  e21:e21[i],
  e50:e50[i],
  e200:e200[i],
  hist,
  volRatio,
  buyRatio,
  atr,
  close:c[i]
 };
}

async function loadCandles(){
 const results=await Promise.allSettled(
  TIMEFRAMES.map(async tf=>{
   const d=await get(
    "/fapi/v1/klines?symbol="+SYMBOL+
    "&interval="+tf+"&limit=250"
   );
   S.candles[tf]=d;
  })
 );

 results.forEach((r,i)=>{
  if(r.status==="rejected"){
   S.errors.push(TIMEFRAMES[i]+" candles failed");
  }
 });

 S.lastCandles=Date.now();
}

async function loadMarket(){
 const tasks=await Promise.allSettled([
  get("/fapi/v1/ticker/24hr?symbol="+SYMBOL),
  get("/fapi/v1/depth?symbol="+SYMBOL+"&limit=100"),
  get("/fapi/v1/aggTrades?symbol="+SYMBOL+"&limit=100")
 ]);

 if(tasks[0].status==="fulfilled"){
  const d=tasks[0].value;
  S.price=Number(d.lastPrice);
  S.change=Number(d.priceChangePercent);
 }

 if(tasks[1].status==="fulfilled"){
  setBook(tasks[1].value);
 }

 if(tasks[2].status==="fulfilled"){
  const now=Date.now();

  S.trades=tasks[2].value.map(t=>({
   time:Number(t.T),
   value:Number(t.p)*Number(t.q),
   buy:!t.m
  })).filter(t=>t.time>now-60000);
 }

 S.lastMarket=Date.now();
}

function setBook(d){
 const bids=d.bids.map(x=>[
  Number(x[0]),Number(x[1])
 ]);

 const asks=d.asks.map(x=>[
  Number(x[0]),Number(x[1])
 ]);

 const bv=total(bids.map(x=>x[0]*x[1]));
 const av=total(asks.map(x=>x[0]*x[1]));

 const bb=Math.max(...bids.map(x=>x[0]));
 const ba=Math.min(...asks.map(x=>x[0]));
 const mid=(bb+ba)/2;

 S.book={
  bv,
  av,
  imb:(bv+av)?(bv-av)/(bv+av):0,
  spread:mid?(ba-bb)/mid*100:0,
  time:Date.now()
 };
}

async function loadOI(){
 try{
  const d=await get(
   "/fapi/v1/openInterest?symbol="+SYMBOL
  );

  const next=Number(d.openInterest);

  if(S.oi!==null&&S.oi>0){
   S.oiChange=(next-S.oi)/S.oi*100;
  }

  S.oi=next;
  S.lastOI=Date.now();

 }catch(e){
  S.errors.push("OI unavailable");
 }
}

async function loadFunding(){
 try{
  const d=await get(
   "/fapi/v1/premiumIndex?symbol="+SYMBOL
  );

  S.funding=Number(d.lastFundingRate);
  S.mark=Number(d.markPrice);
  S.lastFunding=Date.now();

 }catch(e){
  S.errors.push("Funding unavailable");
 }
}

function connect(){
 const streams=[
  "btcusdt@aggTrade",
  "btcusdt@depth20@100ms",
  "!forceOrder@arr"
 ];

 try{
  const ws=new WebSocket(
   "wss://fstream.binance.com/stream?streams="+
   streams.join("/")
  );

  ws.onopen=()=>{
   S.ws=true;
  };

  ws.onmessage=e=>{
   S.lastWS=Date.now();

   try{
    const p=JSON.parse(e.data);
    const d=p.data||{};
    const name=p.stream||"";

    if(name.includes("aggTrade")){
     S.trades.push({
      time:Number(d.T),
      value:Number(d.p)*Number(d.q),
      buy:!d.m
     });

     S.trades=S.trades.filter(
      x=>x.time>Date.now()-60000
     );

     S.price=Number(d.p);
    }

    if(name.includes("depth20")){
     setBook(d);
    }

    if(name==="!forceOrder@arr"&&d.o){
     S.liqs.push({
      side:d.o.S,
      value:Number(d.o.ap)*Number(d.o.q),
      time:Date.now()
     });

     S.liqs=S.liqs.filter(
      x=>x.time>Date.now()-300000
     );
    }

   }catch(err){
    S.errors.push("WebSocket data error");
   }
  };

  ws.onerror=()=>{
   S.ws=false;
  };

  ws.onclose=()=>{
   S.ws=false;
   setTimeout(connect,5000);
  };

 }catch(e){
  S.ws=false;
  setTimeout(connect,5000);
 }
}

function showWait(reason){
 put("signal","WAIT");
 el("signal").className="big yellow";
 put("reason",reason);
 put("entry","--");
 put("sl","--");
 put("tp1","--");
 put("tp2","--");
}

function signal(stats,buyRatio){
 const needed=["3m","5m","15m","1h","4h"];

 if(needed.some(x=>!stats[x])){
  showWait("Waiting for complete timeframe data.");
  return;
 }

 if(
  !S.price||
  !S.book||
  Date.now()-S.lastMarket>45000||
  Date.now()-S.lastOI>90000||
  Date.now()-S.lastFunding>120000
 ){
  showWait("WAIT — market data is incomplete or stale.");
  return;
 }

 const weights={
  "1m":0.25,
  "3m":0.5,
  "5m":0.75,
  "15m":1.5,
  "1h":2,
  "4h":1.5
 };

 let score=0;

 Object.keys(weights).forEach(tf=>{
  score+=stats[tf].score*weights[tf];
 });

 if(S.book.imb>0.12)score+=0.75;
 if(S.book.imb< -0.12)score-=0.75;

 if(buyRatio>0.58)score+=1;
 if(buyRatio<0.42)score-=1;

 if(S.oiChange!==null&&S.oiChange>0.05){
  if(stats["5m"].close>stats["5m"].e21)score+=0.5;
  if(stats["5m"].close<stats["5m"].e21)score-=0.5;
 }

 if(S.funding>0.0005)score-=0.25;
 if(S.funding< -0.0005)score+=0.25;

 const up=
  stats["15m"].score>0&&
  stats["1h"].score>0;

 const down=
  stats["15m"].score<0&&
  stats["1h"].score<0;

 const buyOK=
  buyRatio>0.52&&
  S.book.imb>0;

 const sellOK=
  buyRatio<0.48&&
  S.book.imb<0;

 let direction="WAIT";
 let why="Conflicting signals. Wait for clearer direction.";

 if(score>=4&&up&&buyOK){
  direction="LONG";
  why="Bullish timeframe alignment with buying and order book confirmation.";
 }else if(score<=-4&&down&&sellOK){
  direction="SHORT";
  why="Bearish timeframe alignment with selling and order book confirmation.";
 }

 if(direction==="WAIT"){
  showWait(why);
  put(
   "score",
   "Technical alignment score: "+score.toFixed(2)
  );
  return;
 }

 put("signal",direction);

 el("signal").className=
  "big "+(direction==="LONG"?"green":"red");

 put(
  "score",
  "Technical alignment score: "+
  score.toFixed(2)+" (not win probability)"
 );

 put("reason",why);

 const entry=S.price;
 const dist=stats["5m"].atr*1.5;

 if(!dist){
  showWait("ATR unavailable for risk levels.");
  return;
 }

 if(direction==="LONG"){
  put("entry",number(entry));
  put("sl",number(entry-dist));
  put("tp1",number(entry+dist*1.5));
  put("tp2",number(entry+dist*2.5));
 }else{
  put("entry",number(entry));
  put("sl",number(entry+dist));
  put("tp1",number(entry-dist*1.5));
  put("tp2",number(entry-dist*2.5));
 }
}

// ==========================================
// SEND V3 DATA TO CLOUDFLARE API
// ==========================================

let lastPublish=0;

async function publishLiveData(
 stats,
 buyRatio,
 buyValue,
 sellValue
){
 if(Date.now()-lastPublish<3000)return;

 lastPublish=Date.now();

 const longLiq=total(
  S.liqs.filter(x=>x.side==="SELL").map(x=>x.value)
 );

 const shortLiq=total(
  S.liqs.filter(x=>x.side==="BUY").map(x=>x.value)
 );

 const data={
  symbol:"BTCUSDT",
  timestamp:new Date().toISOString(),

  price:S.price,
  change24h:S.change,

  signal:el("signal").textContent,
  score:el("score").textContent,
  reason:el("reason").textContent,

  entry:el("entry").textContent,
  stopLoss:el("sl").textContent,
  tp1:el("tp1").textContent,
  tp2:el("tp2").textContent,

  timeframes:stats,

  buyNotional:buyValue,
  sellNotional:sellValue,
  buyRatio:buyRatio,
  sellRatio:1-buyRatio,

  orderBook:S.book,
  openInterest:S.oi,
  oiChange:S.oiChange,
  funding:S.funding,
  markPrice:S.mark,

  liquidations:{
   long:longLiq,
   short:shortLiq
  },

  websocket:S.ws,
  lastWebSocket:S.lastWS,
  lastMarket:S.lastMarket,
  lastOI:S.lastOI,
  lastFunding:S.lastFunding,

  errors:S.errors.slice(-3)
 };

 try{
  const response=await fetch("/api/live",{
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify(data)
  });

  if(!response.ok){
   throw Error("API HTTP "+response.status);
  }

  put("apiStatus","Live API: Publishing successfully");

 }catch(e){
  put("apiStatus","Live API: Publish failed - "+e.message);
  console.error("Live API publish failed",e);
 }
}

function render(){
 if(S.price){
  put("price",number(S.price)+" USDT");
  put("change","24h change: "+number(S.change,3)+"%");
 }

 put(
  "ws",
  "WebSocket: "+(S.ws?"CONNECTED":"RECONNECTING")
 );

 let stats={};
 let html="";

 TIMEFRAMES.forEach(tf=>{
  try{
   stats[tf]=calculate(S.candles[tf]||[]);

   const x=stats[tf];
   const trend=x.e9>x.e21?"BULL":"BEAR";

   html+="<tr><td>"+tf+"</td><td>"+
    number(x.rsi,1)+"</td><td class='"+
    (trend==="BULL"?"green":"red")+"'>"+
    trend+"</td><td class='"+
    (x.hist>0?"green":"red")+"'>"+
    (x.hist>0?"BULL":"BEAR")+
    "</td><td>"+number(x.volRatio,2)+
    "x</td></tr>";

  }catch(e){
   html+="<tr><td>"+tf+
    "</td><td colspan='4'>Loading</td></tr>";
  }
 });

 el("frames").innerHTML=html;

 const b=total(
  S.trades.filter(x=>x.buy).map(x=>x.value)
 );

 const s=total(
  S.trades.filter(x=>!x.buy).map(x=>x.value)
 );

 const all=b+s;
 const p=all?b/all:0;

 put("buy",number(b,0)+" USDT");
 put("sell",number(s,0)+" USDT");
 put("buyPct",number(p*100,1)+"%");
 put("sellPct",number((1-p)*100,1)+"%");

 put(
  "tradeInfo",
  "Recent trade sample · "+
  S.trades.length+
  " trades · 60-second window"
 );

 if(S.book){
  put("bid",number(S.book.bv,0)+" USDT");
  put("ask",number(S.book.av,0)+" USDT");
  put("imb",number(S.book.imb*100,2)+"%");
  put("spread",number(S.book.spread,4)+"%");
 }

 put(
  "oi",
  S.oi===null?"--":number(S.oi,3)+" BTC"
 );

 put(
  "oiChange",
  S.oiChange===null?
  "Baseline":
  number(S.oiChange,4)+"%"
 );

 put("funding",number(S.funding*100,5)+"%");
 put("mark",S.mark?number(S.mark):"--");

 const long=total(
  S.liqs.filter(x=>x.side==="SELL").map(x=>x.value)
 );

 const short=total(
  S.liqs.filter(x=>x.side==="BUY").map(x=>x.value)
 );

 put("longLiq",number(long,0)+" USDT");
 put("shortLiq",number(short,0)+" USDT");

 signal(stats,p);

 put(
  "health",
  "REST market: "+(S.lastMarket?"Available":"Waiting")+
  "\nCandles: "+Object.keys(S.candles).join(", ")+
  "\nWebSocket: "+(S.ws?"Connected":"Reconnecting")+
  "\nOI sample: "+(S.lastOI?new Date(S.lastOI).toLocaleTimeString():"Waiting")+
  "\nFunding sample: "+(S.lastFunding?new Date(S.lastFunding).toLocaleTimeString():"Waiting")+
  "\nRecent errors: "+(S.errors.slice(-3).join(" | ")||"None")
 );

 // Publish the same live values shown on this dashboard.
 publishLiveData(stats,p,b,s);
}

async function refreshAll(){
 if(S.busy)return;

 S.busy=true;

 try{
  await Promise.allSettled([
   loadMarket(),
   loadCandles(),
   loadOI(),
   loadFunding()
  ]);

  render();

 }finally{
  S.busy=false;
 }
}

connect();
refreshAll();

setInterval(loadMarket,15000);
setInterval(loadOI,30000);
setInterval(loadFunding,60000);
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
