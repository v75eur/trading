var canvas,ctx,candles=[],price=0,ws=null,sym='R_75',tf=5,cw=8,sp=2;
var lastR=null,lastS=null,macdData=[],signalData=[],histogramData=[];
var patterns=[],divergences=[],pivotLevels=null,trendLines=[],lastDivLine=null;
var lastScreenshot=0;

function showWsError() { let b=document.getElementById('wsError'); if(b) b.style.display='block'; }
function hideWsError() { let b=document.getElementById('wsError'); if(b) b.style.display='none'; }

function capture() {
    let now=Date.now();
    if(now-lastScreenshot<600000) return;
    lastScreenshot=now;
    try { let dataURL=canvas.toDataURL('image/png');
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
    candles=[]; price=0; lastR=null; lastS=null; macdData=[]; signalData=[]; histogramData=[];
    patterns=[]; divergences=[]; trendLines=[]; pivotLevels=null; lastDivLine=null;
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
            findLastSR(); computePivots(); computeTrendLines(); computeMACD(); detectPatterns(); detectDivergences(); updateInfo();
            document.getElementById('loader') && (document.getElementById('loader').style.display='none');
        }
        if(d.tick){
            price=+d.tick.quote;
            document.getElementById('price').innerText=price.toFixed(sym.includes('frx')?5:2);
            if(candles.length>0){ let last=candles[candles.length-1]; last.c=price; if(price>last.h) last.h=price; if(price<last.l) last.l=price; computeMACD(); detectDivergences(); updateInfo(); }
        }
    };
    ws.onerror=()=>showWsError();
    ws.onclose=()=>{ showWsError(); setTimeout(connect,5000); };
}

// UNIQUEMENT dernier support et dernière résistance
function findLastSR(){
    lastR=null; lastS=null; if(candles.length<10) return;
    let n=candles.length;
    for(let i=n-6;i>=5;i--){ let c=candles[i], high=true; for(let j=i-5;j<=i+5;j++) if(j!==i && candles[j].h>=c.h){ high=false; break; } if(high){ lastR={price:c.h,time:c.t}; break; } }
    for(let i=n-6;i>=5;i--){ let c=candles[i], low=true; for(let j=i-5;j<=i+5;j++) if(j!==i && candles[j].l<=c.l){ low=false; break; } if(low){ lastS={price:c.l,time:c.t}; break; } }
}
function computePivots(){
    if(candles.length<24) return;
    let prev=candles[Math.max(0,candles.length-96)], H=prev.h, C=prev.c, L=prev.l;
    let PP=(H+C+L)/3;
    pivotLevels={PP:PP,R1:2*PP-L,R2:PP+(H-L),S1:2*PP-H,S2:PP-(H-L)};
}
function computeTrendLines(){
    trendLines=[]; if(candles.length<20) return;
    let n=candles.length, highs=[], lows=[];
    for(let i=5;i<n-5;i++){ let c=candles[i], high=true; for(let j=i-5;j<=i+5;j++) if(j!==i && candles[j].h>=c.h){ high=false; break; } if(high) highs.push({idx:i,price:c.h}); }
    for(let i=5;i<n-5;i++){ let c=candles[i], low=true; for(let j=i-5;j<=i+5;j++) if(j!==i && candles[j].l<=c.l){ low=false; break; } if(low) lows.push({idx:i,price:c.l}); }
    if(highs.length>=2){ let h1=highs[highs.length-2], h2=highs[highs.length-1]; trendLines.push({p1:h1,p2:h2,color:'#f85149',label:'BAISSIERE'}); }
    if(lows.length>=2){ let l1=lows[lows.length-2], l2=lows[lows.length-1]; trendLines.push({p1:l1,p2:l2,color:'#3fb950',label:'HAUSSIERE'}); }
}
function ema(data,p){ let k=2/(p+1), r=[data[0]]; for(let i=1;i<data.length;i++) r.push(data[i]*k+r[i-1]*(1-k)); return r; }
function computeMACD(){
    if(candles.length<35) return;
    let closes=candles.map(c=>c.c);
    let e12=ema(closes,12), e26=ema(closes,26); macdData=[]; signalData=[]; histogramData=[];
    for(let i=0;i<candles.length;i++) macdData.push({t:candles[i].t,v:e12[i]-e26[i]});
    let sv=ema(macdData.map(d=>d.v),9);
    for(let i=0;i<candles.length;i++){ signalData.push({t:candles[i].t,v:sv[i]}); histogramData.push({t:candles[i].t,v:macdData[i].v-sv[i]}); }
}
function detectPatterns(){
    patterns=[]; if(candles.length<2) return;
    let a=candles[candles.length-1];
    let body=Math.abs(a.c-a.o);
    let avgBody=0;
    for(let i=Math.max(0,candles.length-20);i<candles.length;i++) avgBody+=Math.abs(candles[i].c-candles[i].o);
    avgBody/=20;
    if(body>avgBody*2.5) patterns.push(a.c>a.o?{type:'LONGUE VERTE',color:'#3fb950'}:{type:'LONGUE ROUGE',color:'#f85149'});
}
function detectDivergences(){
    divergences=[]; lastDivLine=null; if(macdData.length<40) return;
    let n=candles.length;
    let pH1=0,pH1i=0; for(let i=n-5;i<n;i++) if(candles[i].h>pH1){ pH1=candles[i].h; pH1i=i; }
    let pH2=0,pH2i=0; for(let i=n-25;i<n-10;i++) if(candles[i].h>pH2){ pH2=candles[i].h; pH2i=i; }
    if(pH1>pH2 && macdData[pH1i] && macdData[pH2i] && macdData[pH1i].v<macdData[pH2i].v){
        divergences.push({type:'DIVERGENCE BAISSIERE',color:'#f85149',i1:pH2i,i2:pH1i,p1:pH2,p2:pH1});
        lastDivLine={i1:pH2i,i2:pH1i,color:'#f85149',price:true};
    }
    let pL1=1e10,pL1i=0; for(let i=n-5;i<n;i++) if(candles[i].l<pL1){ pL1=candles[i].l; pL1i=i; }
    let pL2=1e10,pL2i=0; for(let i=n-25;i<n-10;i++) if(candles[i].l<pL2){ pL2=candles[i].l; pL2i=i; }
    if(pL1<pL2 && macdData[pL1i] && macdData[pL2i] && macdData[pL1i].v>macdData[pL2i].v){
        divergences.push({type:'DIVERGENCE HAUSSIERE',color:'#3fb950',i1:pL2i,i2:pL1i,p1:pL2,p2:pL1});
        lastDivLine={i1:pL2i,i2:pL1i,color:'#3fb950',price:true};
    }
}
function updateInfo(){
    let n=candles.length, dec=sym.includes('frx')?5:1;
    let canal='--';
    if(n>=20){
        let sx=0,sy=0,sxy=0,sx2=0;
        for(let i=0;i<n;i++){ sx+=i; sy+=candles[i].c; sxy+=i*candles[i].c; sx2+=i*i; }
        let slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
        canal=slope>0?'HAUSSIER':slope<0?'BAISSIER':'NEUTRE';
    }
    document.getElementById('canalInfo').innerHTML='<span id="canalLabel"></span>: '+canal;
    let sr='';
    if(lastR) sr+='R: '+lastR.price.toFixed(dec);
    if(lastS) sr+=(sr?' | ':'')+'S: '+lastS.price.toFixed(dec);
    document.getElementById('srInfo').innerHTML='<span id="srLabel"></span>: '+(sr||'--');
    let sig='';
    if(divergences.length>0) sig=divergences[0].type;
    else if(patterns.length>0) sig=patterns[0].type;
    else sig='Aucun';
    document.getElementById('signalInfo').innerHTML='<span id="signalsLabel"></span>: '+sig;
    let stats='';
    if(pivotLevels) stats+='PP: '+pivotLevels.PP.toFixed(dec);
    if(n>=5){ let var5=((candles[n-1].c-candles[n-6].c)/candles[n-6].c*100).toFixed(2); stats+=(stats?' | ':'')+'Var5: '+var5+'%'; }
    stats+=' | '+n+' bougies';
    document.getElementById('statsInfo').innerHTML='<span id="statsLabel"></span>: '+(stats||'--');
}

function loop(){
    if(!canvas || !ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0d1117'; ctx.fillRect(0,0,canvas.width,canvas.height);
    if(candles.length<2){ requestAnimationFrame(loop); return; }
    let n=candles.length, dec=sym.includes('frx')?5:1;
    let L=60, R=canvas.width-80, T=30, B=canvas.height-130, W=R-L, H=B-T;
    let minP=1e10, maxP=-1e10;
    for(let i=0;i<n;i++){ if(candles[i].h>maxP) maxP=candles[i].h; if(candles[i].l<minP) minP=candles[i].l; }
    if(price>0){ if(price>maxP) maxP=price; if(price<minP) minP=price; }
    let pad=(maxP-minP)*0.08; maxP+=pad; minP-=pad;
    let Y=p=> T+(maxP-p)/(maxP-minP)*H;
    let tw=cw+2, si=Math.max(0,n-Math.floor(W/tw));
    // Grille
    ctx.strokeStyle='#1a1a1a'; ctx.lineWidth=0.5;
    for(let i=0;i<=4;i++){ let y=T+H*i/4; ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.stroke(); ctx.fillStyle='#555'; ctx.font='11px monospace'; ctx.fillText((maxP-(maxP-minP)*i/4).toFixed(dec),L-6,y+4); }
    // CANAL
    if(n>=20){
        let sx=0,sy=0,sxy=0,sx2=0;
        for(let i=0;i<n;i++){ sx+=i; sy+=candles[i].c; sxy+=i*candles[i].c; sx2+=i*i; }
        let slope=(n*sxy-sx*sy)/(n*sx2-sx*sx), intercept=(sy-slope*sx)/n, mu=0, md=0;
        for(let i=0;i<n;i++){ let mid=intercept+slope*i; mu=Math.max(mu,candles[i].h-mid); md=Math.max(md,mid-candles[i].l); }
        let x1=L+(0-si)*tw+2, x2=L+(n-1-si)*tw+2;
        ctx.beginPath(); ctx.moveTo(x1,Y(intercept)); ctx.lineTo(x2,Y(intercept+slope*n)); ctx.strokeStyle='#a371f7'; ctx.lineWidth=2; ctx.setLineDash([]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1,Y(intercept+mu)); ctx.lineTo(x2,Y(intercept+slope*n+mu)); ctx.strokeStyle='rgba(163,113,247,0.4)'; ctx.setLineDash([8,6]); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1,Y(intercept-md)); ctx.lineTo(x2,Y(intercept+slope*n-md)); ctx.stroke();
        ctx.setLineDash([]);
    }
    // UNIQUEMENT dernier support et dernière résistance
    if(lastR){ let y=Y(lastR.price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#f85149'; ctx.setLineDash([6,4]); ctx.stroke(); ctx.fillStyle='#f85149'; ctx.fillText('R: '+lastR.price.toFixed(dec),L+4,y-8); }
    if(lastS){ let y=Y(lastS.price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#3fb950'; ctx.setLineDash([6,4]); ctx.stroke(); ctx.fillStyle='#3fb950'; ctx.fillText('S: '+lastS.price.toFixed(dec),L+4,y-8); }
    // Points pivots (optionnel, tu peux les garder ou les enlever)
    if(pivotLevels){
        let pColors={'R2':'#f85149','R1':'rgba(248,81,73,0.7)','PP':'#d29922','S1':'rgba(63,185,80,0.7)','S2':'#3fb950'};
        for(let k in pivotLevels){ let y=Y(pivotLevels[k]); if(y>15 && y<B-15){ ctx.strokeStyle=pColors[k]; ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.setLineDash([3,5]); ctx.stroke(); ctx.fillStyle=pColors[k]; ctx.fillText(k+': '+pivotLevels[k].toFixed(dec),L+4,y-6); } }
    }
    // Lignes de tendance
    trendLines.forEach(tl=>{ if(tl.p1.idx>=si && tl.p2.idx>=si){ let x1=L+(tl.p1.idx-si)*tw+2, y1=Y(tl.p1.price), x2=L+(tl.p2.idx-si)*tw+2, y2=Y(tl.p2.price); ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.strokeStyle=tl.color; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.stroke(); ctx.fillStyle=tl.color; ctx.fillText(tl.label,(x1+x2)/2,(y1+y2)/2-10); } });
    ctx.setLineDash([]);
    // Bougies
    for(let i=si;i<n;i++){ let c=candles[i]; let x=L+(i-si)*tw+2; let g=c.c>=c.o; ctx.strokeStyle=g?'#3fb950':'#f85149'; ctx.beginPath(); ctx.moveTo(x+cw/2,Y(c.h)); ctx.lineTo(x+cw/2,Y(c.l)); ctx.stroke(); ctx.fillStyle=g?'#3fb950':'#f85149'; let y1=Y(c.o), y2=Y(c.c); ctx.fillRect(x,Math.min(y1,y2),cw,Math.max(1,Math.abs(y2-y1))); }
    // Divergence
    if(lastDivLine && lastDivLine.i1>=si && lastDivLine.i2>=si){
        let x1=L+(lastDivLine.i1-si)*tw+2, y1=Y(candles[lastDivLine.i1][lastDivLine.price?'h':'h']);
        let x2=L+(lastDivLine.i2-si)*tw+2, y2=Y(candles[lastDivLine.i2][lastDivLine.price?'h':'h']);
        ctx.beginPath(); ctx.moveTo(x1,y1-15); ctx.lineTo(x2,y2-15); ctx.strokeStyle=lastDivLine.color; ctx.lineWidth=2.5; ctx.setLineDash([4,4]); ctx.stroke(); ctx.fillStyle=lastDivLine.color; ctx.fillText('DIV',(x1+x2)/2,y1-22);
    }
    // Prix live
    if(price>0){ let y=Y(price); ctx.beginPath(); ctx.moveTo(L,y); ctx.lineTo(R,y); ctx.strokeStyle='#fff'; ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle='#fff'; ctx.fillText(price.toFixed(dec),R+6,y+4); }
    // MACD
    if(macdData.length){
        let mT=B+15, mH=80, mMin=1e10, mMax=-1e10;
        for(let i=si;i<n;i++){ if(macdData[i]){ if(macdData[i].v<mMin) mMin=macdData[i].v; if(macdData[i].v>mMax) mMax=macdData[i].v; } if(signalData[i]){ if(signalData[i].v<mMin) mMin=signalData[i].v; if(signalData[i].v>mMax) mMax=signalData[i].v; } }
        let mRng=mMax-mMin||1, my=v=> mT+(mMax-v)/mRng*mH;
        let zY=my(0); if(zY>mT && zY<mT+mH){ ctx.beginPath(); ctx.moveTo(L,zY); ctx.lineTo(R,zY); ctx.strokeStyle='#30363d'; ctx.stroke(); }
        for(let i=si;i<n;i++){ if(histogramData[i]){ let hx=L+(i-si)*tw+2, hv=histogramData[i].v, hy=my(hv), hz=my(0); ctx.fillStyle=hv>=0?'rgba(63,185,80,0.6)':'rgba(248,81,73,0.6)'; ctx.fillRect(hx,Math.min(hy,hz),cw,Math.abs(hy-hz)); } }
        ctx.beginPath(); ctx.strokeStyle='#58a6ff'; for(let i=si;i<n;i++) if(macdData[i]){ let x=L+(i-si)*tw+2, y=my(macdData[i].v); if(i===si) ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.stroke();
        ctx.beginPath(); ctx.strokeStyle='#f0883e'; for(let i=si;i<n;i++) if(signalData[i]){ let x=L+(i-si)*tw+2, y=my(signalData[i].v); if(i===si) ctx.moveTo(x,y); else ctx.lineTo(x,y); } ctx.stroke();
        ctx.fillStyle='#58a6ff'; ctx.fillText('MACD',L,mT+12);
        ctx.fillStyle='#f0883e'; ctx.fillText('Signal',L+40,mT+12);
    }
    requestAnimationFrame(loop);
}
function changeSymbol(){ sym=document.getElementById('sym').value; connect(); }
function changeTF(){ tf=parseInt(document.getElementById('tf').value); connect(); }
function zoomIn(){ cw=Math.min(30,cw+2); }
function zoomOut(){ cw=Math.max(2,cw-2); }
function resetZoom(){ cw=8; }
window.addEventListener('load',init);
