var canvas,ctx,candles=[],price=0,ws=null,sym='R_75',tf=5,cw=8,sp=2;
var lastR=null,lastS=null,macdData=[],signalData=[],histogramData=[];
var patterns=[],divergences=[],pivotLevels=null;
var lastScreenshot=0;

function showWsError() { let b=document.getElementById('wsError'); if(b) b.style.display='block'; }
function hideWsError() { let b=document.getElementById('wsError'); if(b) b.style.display='none'; }

function capture() {
    let now=Date.now();
    if(now-lastScreenshot<600000) return;
    lastScreenshot=now;
    try {
        let dataURL=canvas.toDataURL('image/png');
        fetch('/api/upload-screenshot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataURL})});
    } catch(e){}
}

function init(){
    canvas=document.getElementById('chart');
    ctx=canvas.getContext('2d');
    resize(); window.addEventListener('resize',resize);
    canvas.addEventListener('wheel',e=>{e.preventDefault(); cw+=e.deltaY>0?-1:1; cw=Math.max(2,Math.min(30,cw));});
    connect(); requestAnimationFrame(loop);
    setInterval(capture,600000);
}
function resize(){ canvas.width=window.innerWidth-350; canvas.height=window.innerHeight-120; }

function connect(){
    if(ws){ ws.onclose=null; try{ws.close();}catch(e){} }
    candles=[]; price=0; lastR=null; lastS=null;
    document.getElementById('loader') && (document.getElementById('loader').style.display='flex');
    ws=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    ws.onopen=()=>{
        hideWsError();
        ws.send(JSON.stringify({ticks_history:sym,count:500,end:'latest',start:1,style:'candles',granularity:tf*60}));
        ws.send(JSON.stringify({ticks:sym,subscribe:1}));
    };
    ws.onmessage=(m)=>{
        let d=JSON.parse(m.data);
        if(d.candles){
            candles=[];
            for(let i=0;i<d.candles.length;i++){ let c=d.candles[i]; candles.push({t:c.epoch,o:+c.open,h:+c.high,l:+c.low,c:+c.close}); }
            if(candles.length>200) candles=candles.slice(-200);
            findSR(); computePivots(); updateInfo();
            document.getElementById('loader') && (document.getElementById('loader').style.display='none');
        }
        if(d.tick){
            price=+d.tick.quote;
            document.getElementById('price').innerText=price.toFixed(sym.includes('frx')?5:2);
            if(candles.length>0){ let last=candles[candles.length-1]; last.c=price; if(price>last.h) last.h=price; if(price<last.l) last.l=price; updateInfo(); }
        }
    };
    ws.onerror=()=>showWsError();
    ws.onclose=()=>{ showWsError(); setTimeout(connect,5000); };
}

function findSR(){
    lastR=null; lastS=null; if(candles.length<10) return;
    let n=candles.length;
    for(let i=n-6;i>=5;i--){ let c=candles[i], isHigh=true; for(let j=i-5;j<=i+5;j++){ if(j!==i && candles[j].h>=c.h){ isHigh=false; break; } } if(isHigh){ lastR={price:c.h,time:c.t}; break; } }
    for(let i=n-6;i>=5;i--){ let c=candles[i], isLow=true; for(let j=i-5;j<=i+5;j++){ if(j!==i && candles[j].l<=c.l){ isLow=false; break; } } if(isLow){ lastS={price:c.l,time:c.t}; break; } }
}
function computePivots(){
    if(candles.length<24) return;
    let prev=candles[Math.max(0,candles.length-96)], H=prev.h, C=prev.c, L=prev.l;
    let PP=(H+C+L)/3;
    pivotLevels={PP:PP,R1:2*PP-L,R2:PP+(H-L),S1:2*PP-H,S2:PP-(H-L)};
}
function updateInfo(){
    let n=candles.length, dec=sym.includes('frx')?5:1;
    if(n>=20){
        let sx=0,sy=0,sxy=0,sx2=0;
        for(let i=0;i<n;i++){ sx+=i; sy+=candles[i].c; sxy+=i*candles[i].c; sx2+=i*i; }
        let slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
        document.getElementById('canalInfo').innerHTML='<span id="canalLabel"></span>: '+(slope>0?'HAUSSIER':slope<0?'BAISSIER':'NEUTRE');
    }
    let sr='';
    if(lastR) sr+='R: '+lastR.price.toFixed(dec);
    if(lastS) sr+=(sr?' | ':'')+'S: '+lastS.price.toFixed(dec);
    document.getElementById('srInfo').innerHTML='<span id="srLabel"></span>: '+(sr||'--');
}
function loop(){
    if(!canvas || !ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,canvas.width,canvas.height);
    if(candles.length<2){ requestAnimationFrame(loop); return; }
    let n=candles.length, dec=sym.includes('frx')?5:1;
    let L=60, R=canvas.width-80, T=30, B=canvas.height-100, W=R-L, H=B-T;
    let minP=1e10, maxP=-1e10;
    for(let i=0;i<n;i++){ if(candles[i].h>maxP) maxP=candles[i].h; if(candles[i].l<minP) minP=candles[i].l; }
    if(price>0){ if(price>maxP) maxP=price; if(price<minP) minP=price; }
    let pad=(maxP-minP)*0.1; maxP+=pad; minP-=pad;
    let Y=p=> T+(maxP-p)/(maxP-minP)*H;
    let tw=cw+2, si=Math.max(0,n-Math.floor(W/tw));
    for(let i=0;i<=4;i++){ let y=T+H*i/4; ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#1a1a1a'; ctx.stroke(); }
    for(let i=si;i<n;i++){ let c=candles[i]; let x=L+(i-si)*tw+2; let g=c.c>=c.o; ctx.strokeStyle=g?'#3fb950':'#f85149'; ctx.beginPath(); ctx.moveTo(x+cw/2,Y(c.h)); ctx.lineTo(x+cw/2,Y(c.l)); ctx.stroke(); ctx.fillStyle=g?'#3fb950':'#f85149'; let y1=Y(c.o), y2=Y(c.c); ctx.fillRect(x,Math.min(y1,y2),cw,Math.max(1,Math.abs(y2-y1))); }
    if(lastR){ let y=Y(lastR.price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#f85149'; ctx.setLineDash([6,4]); ctx.stroke(); ctx.fillStyle='#f85149'; ctx.fillText('R: '+lastR.price.toFixed(dec),L+4,y-6); }
    if(lastS){ let y=Y(lastS.price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#3fb950'; ctx.setLineDash([6,4]); ctx.stroke(); ctx.fillStyle='#3fb950'; ctx.fillText('S: '+lastS.price.toFixed(dec),L+4,y-6); }
    ctx.setLineDash([]);
    if(price>0){ let y=Y(price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#fff'; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; ctx.fillText(price.toFixed(dec),R+6,y+4); }
    requestAnimationFrame(loop);
}
function changeSymbol(){ sym=document.getElementById('sym').value; connect(); }
function changeTF(){ tf=parseInt(document.getElementById('tf').value); connect(); }
function zoomIn(){ cw=Math.min(30,cw+2); }
function zoomOut(){ cw=Math.max(2,cw-2); }
function resetZoom(){ cw=8; }
window.addEventListener('load',init);
