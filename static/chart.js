var canvas,ctx,candles=[],price=0,ws=null,sym='R_75',tf=5,cw=8,sp=2;
var lastR=null,lastS=null,macdData=[],signalData=[],histogramData=[];
var patterns=[],divergences=[],pivotLevels=null,trendLines=[],lastDivLine=null;
var liquidityZones=[],bosSignals=[],chochSignals=[];
var highs=[],lows=[];

function init(){
    canvas=document.getElementById('chart');
    ctx=canvas.getContext('2d');
    resize();window.addEventListener('resize',resize);
    canvas.addEventListener('wheel',function(e){e.preventDefault();cw+=e.deltaY>0?-1:1;cw=Math.max(2,Math.min(30,cw));});
    connect();requestAnimationFrame(loop);
}
function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight-90;}

function connect(){
    if(ws){ws.onclose=null;try{ws.close();}catch(e){}}
    candles=[];price=0;lastR=null;lastS=null;macdData=[];signalData=[];histogramData=[];
    document.getElementById('loader').style.display='flex';
    ws=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    ws.onopen=function(){
        ws.send(JSON.stringify({ticks_history:sym,count:5000,end:'latest',start:1,style:'candles',granularity:tf*60}));
        ws.send(JSON.stringify({ticks:sym,subscribe:1}));
    };
    ws.onmessage=function(m){
        var d=JSON.parse(m.data);
        if(d.candles){
            candles=[];
            for(var i=0;i<d.candles.length;i++){var c=d.candles[i];candles.push({t:c.epoch,o:+c.open,h:+c.high,l:+c.low,c:+c.close});}
            if(candles.length>200)candles=candles.slice(-200);
            findSR();computePivots();computeTrendLines();computeMACD();
            detectPatterns();detectDivergences();
            detectLiquidityZones();detectBOS();detectCHoCH();
            updateInfoBar();
            document.getElementById('loader').style.display='none';
        }
        if(d.tick){
            price=+d.tick.quote;
            document.getElementById('price').textContent=price.toFixed(sym.indexOf('frx')>=0?5:2);
            if(candles.length>0){var last=candles[candles.length-1];last.c=price;if(price>last.h)last.h=price;if(price<last.l)last.l=price;
            computeMACD();detectDivergences();detectBOS();detectCHoCH();updateInfoBar();}
        }
    };
    ws.onclose=function(){setTimeout(connect,5000);};
}

// ============================================
// DÉTECTION ZONES DE LIQUIDITÉ
// ============================================
function detectLiquidityZones(){
    liquidityZones=[];
    if(candles.length<30)return;
    var n=candles.length;
    // Chercher les ranges (consolidation = bougies avec petits corps)
    var start=null;
    for(var i=n-30;i<n;i++){
        var body=Math.abs(candles[i].c-candles[i].o);
        var range=candles[i].h-candles[i].l;
        if(range>0&&body<range*0.3){
            if(!start)start=i;
        }else{
            if(start&&i-start>=3){
                var maxH=0,minL=1e10;
                for(var j=start;j<i;j++){if(candles[j].h>maxH)maxH=candles[j].h;if(candles[j].l<minL)minL=candles[j].l;}
                liquidityZones.push({start:start,end:i-1,high:maxH,low:minL});
            }
            start=null;
        }
    }
}

// ============================================
// DÉTECTION BOS (Break of Structure)
// ============================================
function detectBOS(){
    bosSignals=[];
    if(candles.length<20)return;
    var n=candles.length;
    // Dernier plus haut significatif
    var lastHH=0,lastHHidx=0;
    for(var i=n-15;i<n;i++){if(candles[i].h>lastHH){lastHH=candles[i].h;lastHHidx=i;}}
    // Chercher si prix casse ce plus haut
    for(var i=lastHHidx+1;i<n;i++){
        if(candles[i].c>lastHH&&candles[i].c>candles[i].o){
            bosSignals.push({index:i,price:candles[i].c,type:'BOS HAUSSIER 🚀',color:'#3fb950'});
            break;
        }
    }
    // Dernier plus bas significatif
    var lastLL=1e10,lastLLidx=0;
    for(var i=n-15;i<n;i++){if(candles[i].l<lastLL){lastLL=candles[i].l;lastLLidx=i;}}
    for(var i=lastLLidx+1;i<n;i++){
        if(candles[i].c<lastLL&&candles[i].c<candles[i].o){
            bosSignals.push({index:i,price:candles[i].c,type:'BOS BAISSIER 🔻',color:'#f85149'});
            break;
        }
    }
}

// ============================================
// DÉTECTION CHoCH (Change of Character)
// ============================================
function detectCHoCH(){
    chochSignals=[];
    if(candles.length<20)return;
    var n=candles.length;
    // Tendance récente (10 bougies)
    var trend=0;
    for(var i=n-10;i<n;i++){if(candles[i].c>candles[i].o)trend++;else trend--;}
    // CHoCH haussier : tendance baissière puis grosse bougie verte
    if(trend<-3){
        var body=Math.abs(candles[n-1].c-candles[n-1].o);
        if(candles[n-1].c>candles[n-1].o&&body>0.001*sym.indexOf('frx')>=0?0.0005:500){
            chochSignals.push({index:n-1,price:candles[n-1].c,type:'CHoCH HAUSSIER 🟢',color:'#3fb950'});
        }
    }
    // CHoCH baissier : tendance haussière puis grosse bougie rouge
    if(trend>3){
        var body=Math.abs(candles[n-1].c-candles[n-1].o);
        if(candles[n-1].c<candles[n-1].o&&body>0.001*sym.indexOf('frx')>=0?0.0005:500){
            chochSignals.push({index:n-1,price:candles[n-1].c,type:'CHoCH BAISSIER 🔴',color:'#f85149'});
        }
    }
}

// ... (toutes les autres fonctions restent identiques) ...

function loop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0d1117';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(candles.length<2){requestAnimationFrame(loop);return;}
    
    var n=candles.length,dec=sym.indexOf('frx')>=0?5:1;
    var chartBottom=canvas.height-120;
    var L=70,R=canvas.width-70,T=25,B=chartBottom,W=R-L,H=B-T;
    var minP=1e10,maxP=-1e10;
    for(var i=0;i<n;i++){if(candles[i].h>maxP)maxP=candles[i].h;if(candles[i].l<minP)minP=candles[i].l;}
    if(price>0){if(price>maxP)maxP=price;if(price<minP)minP=price;}
    var pad=(maxP-minP)*0.08;maxP+=pad;minP-=pad;
    var rng=maxP-minP||1;
    var Y=function(p){return T+(maxP-p)/rng*H;};
    var tw=cw+sp,si=Math.max(0,n-Math.floor(W/tw));
    
    // Grille
    ctx.strokeStyle='#1a1a1a';ctx.lineWidth=0.5;
    for(var i=0;i<=4;i++){var y=T+H*i/4;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.fillStyle='#555';ctx.font='11px monospace';ctx.textAlign='right';ctx.fillText((maxP-rng*i/4).toFixed(dec),L-6,y+4);}
    
    // === ZONES DE LIQUIDITÉ (rectangles violets transparents) ===
    for(var k=0;k<liquidityZones.length;k++){
        var z=liquidityZones[k];
        if(z.start>=si){
            var zx1=L+(z.start-si)*tw;
            var zx2=L+(z.end-si)*tw+cw;
            var zy1=Y(z.high),zy2=Y(z.low);
            ctx.fillStyle='rgba(163,113,247,0.15)';
            ctx.fillRect(zx1,zy1,zx2-zx1,zy2-zy1);
            ctx.strokeStyle='rgba(163,113,247,0.4)';ctx.lineWidth=1;ctx.setLineDash([2,4]);
            ctx.strokeRect(zx1,zy1,zx2-zx1,zy2-zy1);
            ctx.setLineDash([]);
            ctx.fillStyle='rgba(163,113,247,0.7)';ctx.font='9px Arial';ctx.textAlign='center';
            ctx.fillText('LIQUIDITÉ',(zx1+zx2)/2,zy1-4);
        }
    }
    
    // === BOS (flèches) ===
    for(var k=0;k<bosSignals.length;k++){
        var b=bosSignals[k];
        if(b.index>=si){
            var bx=L+(b.index-si)*tw+cw/2,by=Y(b.price);
            ctx.fillStyle=b.color;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
            ctx.beginPath();ctx.arc(bx,by,10,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.fillStyle=b.color;
            if(b.type.indexOf('HAUSSIER')>0){
                ctx.beginPath();ctx.moveTo(bx,by-18);ctx.lineTo(bx-7,by-6);ctx.lineTo(bx+7,by-6);ctx.closePath();ctx.fill();
                ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('BOS',bx,by-22);
            }else{
                ctx.beginPath();ctx.moveTo(bx,by+18);ctx.lineTo(bx-7,by+6);ctx.lineTo(bx+7,by+6);ctx.closePath();ctx.fill();
                ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('BOS',bx,by+28);
            }
        }
    }
    
    // === CHoCH (flèches) ===
    for(var k=0;k<chochSignals.length;k++){
        var ch=chochSignals[k];
        if(ch.index>=si){
            var cx=L+(ch.index-si)*tw+cw/2,cy=Y(ch.price);
            ctx.fillStyle=ch.color;ctx.strokeStyle='#fff';ctx.lineWidth=2;
            ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.fill();ctx.stroke();
            ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';
            ctx.fillText('CHoCH',cx,ch.type.indexOf('HAUSSIER')>0?cy-20:cy+25);
            ctx.fillStyle=ch.color;
            if(ch.type.indexOf('HAUSSIER')>0){
                ctx.beginPath();ctx.moveTo(cx,cy-22);ctx.lineTo(cx-9,cy-8);ctx.lineTo(cx+9,cy-8);ctx.closePath();ctx.fill();
            }else{
                ctx.beginPath();ctx.moveTo(cx,cy+22);ctx.lineTo(cx-9,cy+8);ctx.lineTo(cx+9,cy+8);ctx.closePath();ctx.fill();
            }
        }
    }
    
    // CANAL (inchangé)
    if(n>=20){
        var sx=0,sy=0,sxy=0,sx2=0;
        for(var i=0;i<n;i++){sx+=i;sy+=candles[i].c;sxy+=i*candles[i].c;sx2+=i*i;}
        var slope=(n*sxy-sx*sy)/(n*sx2-sx*sx),intercept=(sy-slope*sx)/n,mu=0,md=0;
        for(var i=0;i<n;i++){var mid=intercept+slope*i,u=candles[i].h-mid,d=mid-candles[i].l;if(u>mu)mu=u;if(d>md)md=d;}
        var em=intercept+slope*n;
        ctx.strokeStyle='#a371f7';ctx.lineWidth=2;ctx.setLineDash([]);
        ctx.beginPath();ctx.moveTo(L+(0-si)*tw+cw/2,Y(intercept));ctx.lineTo(L+(n-1-si)*tw+cw/2,Y(em));ctx.stroke();
        ctx.strokeStyle='rgba(163,113,247,0.4)';ctx.lineWidth=1;ctx.setLineDash([8,6]);
        ctx.beginPath();ctx.moveTo(L+(0-si)*tw+cw/2,Y(intercept+mu));ctx.lineTo(L+(n-1-si)*tw+cw/2,Y(em+mu));ctx.stroke();
        ctx.beginPath();ctx.moveTo(L+(0-si)*tw+cw/2,Y(intercept-md));ctx.lineTo(L+(n-1-si)*tw+cw/2,Y(em-md));ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // S/R (inchangé)
    if(lastR){var yR=Y(lastR.price);ctx.strokeStyle='#f85149';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(L,yR);ctx.lineTo(R,yR);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f85149';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText('R: '+lastR.price.toFixed(dec),L+4,yR-8);}
    if(lastS){var yS=Y(lastS.price);ctx.strokeStyle='#3fb950';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(L,yS);ctx.lineTo(R,yS);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#3fb950';ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText('S: '+lastS.price.toFixed(dec),L+4,yS-8);}
    
    // LIGNES DE TENDANCE (inchangé)
    for(var k=0;k<trendLines.length;k++){
        var tl=trendLines[k];
        if(tl.p1.index>=si&&tl.p2.index>=si){
            var x1=L+(tl.p1.index-si)*tw+cw/2,y1=Y(tl.p1.price);
            var x2=L+(tl.p2.index-si)*tw+cw/2,y2=Y(tl.p2.price);
            ctx.strokeStyle=tl.color;ctx.lineWidth=2;ctx.setLineDash(tl.dash);
            ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle=tl.color;ctx.font='bold 11px Arial';ctx.textAlign='center';
            ctx.fillText(tl.label,(x1+x2)/2,(y1+y2)/2-12);
        }
    }
    
    // POINTS PIVOTS (inchangé)
    if(pivotLevels){
        var pColors={'R2':'#f85149','R1':'rgba(248,81,73,0.7)','PP':'#d29922','S1':'rgba(63,185,80,0.7)','S2':'#3fb950'};
        var yOffset=0;
        for(var k in pivotLevels){
            var yP=Y(pivotLevels[k]);
            if(yP>T+15&&yP<B-15){
                ctx.strokeStyle=pColors[k];ctx.lineWidth=1;ctx.setLineDash([3,5]);
                ctx.beginPath();ctx.moveTo(L,yP);ctx.lineTo(R,yP);ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle=pColors[k];ctx.font='bold 11px Arial';ctx.textAlign='left';
                ctx.fillText(k+': '+pivotLevels[k].toFixed(dec),L+4,yP-6+yOffset);
                yOffset+=18;
            }
        }
    }
    
    // PATTERNS + FLÈCHES (inchangé)
    for(var k=0;k<patterns.length;k++){
        var p=patterns[k];
        var px=L+(n-1-si)*tw+cw/2;
        var priceY=p.dir==='UP'?candles[n-1].l:p.dir==='DOWN'?candles[n-1].h:candles[n-1].c;
        var py=Y(priceY);
        ctx.fillStyle=p.color;ctx.strokeStyle='#fff';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);ctx.fill();ctx.stroke();
        if(p.dir==='UP'){
            ctx.fillStyle=p.color;
            ctx.beginPath();ctx.moveTo(px,py-28);ctx.lineTo(px-8,py-14);ctx.lineTo(px+8,py-14);ctx.closePath();ctx.fill();
            ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(p.type,px,py-33);
        }else if(p.dir==='DOWN'){
            ctx.fillStyle=p.color;
            ctx.beginPath();ctx.moveTo(px,py+28);ctx.lineTo(px-8,py+14);ctx.lineTo(px+8,py+14);ctx.closePath();ctx.fill();
            ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(p.type,px,py+38);
        }else{
            ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText(p.type,px,py-18);
        }
    }
    
    // DIVERGENCES (inchangé)
    for(var k=0;k<divergences.length;k++){
        var div=divergences[k];
        if(div.i1>=si&&div.i2>=si){
            var x1=L+(div.i1-si)*tw+cw/2,y1=Y(div.p1);
            var x2=L+(div.i2-si)*tw+cw/2,y2=Y(div.p2);
            ctx.strokeStyle=div.color;ctx.lineWidth=2.5;ctx.setLineDash([4,4]);
            ctx.beginPath();ctx.moveTo(x1,y1-15);ctx.lineTo(x2,y2-15);ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle=div.color;ctx.font='bold 12px Arial';ctx.textAlign='center';
            ctx.fillText(div.type,(x1+x2)/2,y1-22);
        }
    }
    
    // BOUGIES (inchangé)
    for(var i=si;i<n;i++){var c=candles[i];var x=L+(i-si)*tw+sp/2;var g=c.c>=c.o;ctx.strokeStyle=g?'#3fb950':'#f85149';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+cw/2,Y(c.h));ctx.lineTo(x+cw/2,Y(c.l));ctx.stroke();ctx.fillStyle=g?'#3fb950':'#f85149';var y1=Y(c.o),y2=Y(c.c);ctx.fillRect(x,Math.min(y1,y2),cw,Math.max(1,Math.abs(y2-y1)));}
    
    // PRIX LIVE (inchangé)
    if(price>0){var yP=Y(price);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(L,yP);ctx.lineTo(R,yP);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='left';ctx.fillText(price.toFixed(dec),R+4,yP+5);}
    
    // MACD (inchangé)
    if(macdData.length>0){
        var mB=canvas.height-10,mT=chartBottom+5,mH=mB-mT,mMin=1e10,mMax=-1e10;
        for(var i=si;i<n;i++){if(macdData[i]){if(macdData[i].v<mMin)mMin=macdData[i].v;if(macdData[i].v>mMax)mMax=macdData[i].v;}if(signalData[i]){if(signalData[i].v<mMin)mMin=signalData[i].v;if(signalData[i].v>mMax)mMax=signalData[i].v;}}
        var mRng=(mMax-mMin)||1,mY=function(v){return mT+(mMax-v)/mRng*mH;};
        ctx.fillStyle='#0d1117';ctx.fillRect(0,chartBottom,canvas.width,canvas.height-chartBottom);
        var zY=mY(0);if(zY>mT&&zY<mB){ctx.strokeStyle='#30363d';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(L,zY);ctx.lineTo(R,zY);ctx.stroke();}
        for(var i=si;i<n;i++){if(histogramData[i]){var hx=L+(i-si)*tw+cw/2,hv=histogramData[i].v,hy=mY(hv),hz=mY(0);ctx.fillStyle=hv>=0?'rgba(63,185,80,0.6)':'rgba(248,81,73,0.6)';ctx.fillRect(hx-1,Math.min(hy,hz),cw,Math.abs(hy-hz));}}
        ctx.strokeStyle='#58a6ff';ctx.lineWidth=1.5;ctx.beginPath();var mf=true;for(var i=si;i<n;i++){if(macdData[i]){var mx=L+(i-si)*tw+cw/2,my=mY(macdData[i].v);if(mf){ctx.moveTo(mx,my);mf=false;}else ctx.lineTo(mx,my);}}ctx.stroke();
        ctx.strokeStyle='#f0883e';ctx.lineWidth=1.5;ctx.beginPath();var sf=true;for(var i=si;i<n;i++){if(signalData[i]){var sx=L+(i-si)*tw+cw/2,sy=mY(signalData[i].v);if(sf){ctx.moveTo(sx,sy);sf=false;}else ctx.lineTo(sx,sy);}}ctx.stroke();
        ctx.fillStyle='#58a6ff';ctx.font='bold 11px Arial';ctx.fillText('MACD',L,chartBottom+14);
        ctx.fillStyle='#f0883e';ctx.font='bold 11px Arial';ctx.fillText('Signal',L+50,chartBottom+14);
        if(lastDivLine&&lastDivLine.i1>=si&&lastDivLine.i2>=si){
            var d1x=L+(lastDivLine.i1-si)*tw+cw/2,d1y=mY(lastDivLine.price?candles[lastDivLine.i1].h:macdData[lastDivLine.i1].v);
            var d2x=L+(lastDivLine.i2-si)*tw+cw/2,d2y=mY(lastDivLine.price?candles[lastDivLine.i2].h:macdData[lastDivLine.i2].v);
            ctx.strokeStyle=lastDivLine.color;ctx.lineWidth=2;ctx.setLineDash([4,4]);
            ctx.beginPath();ctx.moveTo(d1x,d1y);ctx.lineTo(d2x,d2y);ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle=lastDivLine.color;ctx.font='bold 11px Arial';ctx.textAlign='center';
            ctx.fillText('DIV',(d1x+d2x)/2,d1y-8);
        }
    }
    
    requestAnimationFrame(loop);
}

function changeSymbol(){sym=document.getElementById('sym').value;connect();}
function changeTF(){tf=parseInt(document.getElementById('tf').value);connect();}
function zoomIn(){cw=Math.min(30,cw+2);}
function zoomOut(){cw=Math.max(2,cw-2);}
function resetZoom(){cw=8;}

// ... (toutes les fonctions de détection restent)

function findSR(){
    lastR=null;lastS=null;if(candles.length<10)return;var n=candles.length;
    for(var i=n-6;i>=5;i--){var c=candles[i],isHigh=true;for(var j=i-5;j<=i+5;j++){if(j!==i&&candles[j].h>=c.h){isHigh=false;break;}}if(isHigh){lastR={price:c.h,time:c.t};break;}}
    for(var i=n-6;i>=5;i--){var c=candles[i],isLow=true;for(var j=i-5;j<=i+5;j++){if(j!==i&&candles[j].l<=c.l){isLow=false;break;}}if(isLow){lastS={price:c.l,time:c.t};break;}}
}
function computePivots(){
    if(candles.length<24)return;var n=candles.length;
    var prevCandle=candles[Math.max(0,n-96)];var H=prevCandle.h,C=prevCandle.c,L=prevCandle.l;
    var PP=(H+C+L)/3;pivotLevels={PP:PP,R1:2*PP-L,R2:PP+(H-L),S1:2*PP-H,S2:PP-(H-L)};
}
function computeTrendLines(){
    trendLines=[];if(candles.length<20)return;var n=candles.length;var highs=[],lows=[];
    for(var i=5;i<n-5;i++){var c=candles[i],isHigh=true;for(var j=i-5;j<=i+5;j++){if(j!==i&&candles[j].h>=c.h){isHigh=false;break;}}if(isHigh)highs.push({index:i,price:c.h,time:c.t});}
    for(var i=5;i<n-5;i++){var c=candles[i],isLow=true;for(var j=i-5;j<=i+5;j++){if(j!==i&&candles[j].l<=c.l){isLow=false;break;}}if(isLow)lows.push({index:i,price:c.l,time:c.t});}
    if(highs.length>=2){var h1=highs[highs.length-2],h2=highs[highs.length-1];trendLines.push({p1:h1,p2:h2,color:'#f85149',label:'TENDANCE BAISSIERE',dash:[6,3]});}
    if(lows.length>=2){var l1=lows[lows.length-2],l2=lows[lows.length-1];trendLines.push({p1:l1,p2:l2,color:'#3fb950',label:'TENDANCE HAUSSIERE',dash:[6,3]});}
}
function ema(data,p){var k=2/(p+1),r=[data[0]];for(var i=1;i<data.length;i++)r.push(data[i]*k+r[i-1]*(1-k));return r;}
function computeMACD(){
    if(candles.length<35)return;var closes=candles.map(function(c){return c.c;});
    var e12=ema(closes,12),e26=ema(closes,26);macdData=[];signalData=[];histogramData=[];
    for(var i=0;i<candles.length;i++)macdData.push({t:candles[i].t,v:e12[i]-e26[i]});
    var sv=ema(macdData.map(function(d){return d.v;}),9);
    for(var i=0;i<candles.length;i++){signalData.push({t:candles[i].t,v:sv[i]});histogramData.push({t:candles[i].t,v:macdData[i].v-sv[i]});}
}
function detectPatterns(){
    patterns=[];if(candles.length<2)return;var n=candles.length;var a=candles[n-1],b=candles[n-2];
    var body=Math.abs(a.c-a.o),range=a.h-a.l||1;var wUp=a.h-Math.max(a.o,a.c),wDown=Math.min(a.o,a.c)-a.l;
    var avgBody=0;for(var i=Math.max(0,n-20);i<n;i++)avgBody+=Math.abs(candles[i].c-candles[i].o);avgBody/=20;
    if(body>avgBody*2.5){if(a.c>a.o)patterns.push({type:'LONGUE VERTE',dir:'UP',color:'#3fb950'});else patterns.push({type:'LONGUE ROUGE',dir:'DOWN',color:'#f85149'});}
    if(wDown>body*2.5&&wUp<body*0.3)patterns.push({type:'MARTEAU',dir:'UP',color:'#3fb950'});
    if(wUp>body*2.5&&wDown<body*0.3)patterns.push({type:'ETOILE FILANTE',dir:'DOWN',color:'#f85149'});
    if(a.c>a.o&&b.c<b.o&&a.o<b.c&&a.c>b.o)patterns.push({type:'ENGULFING H',dir:'UP',color:'#3fb950'});
    if(a.c<a.o&&b.c>b.o&&a.o>b.c&&a.c<b.o)patterns.push({type:'ENGULFING B',dir:'DOWN',color:'#f85149'});
    if(body<range*0.1)patterns.push({type:'DOJI',dir:'NEUTRE',color:'#d29922'});
}
function detectDivergences(){
    divergences=[];lastDivLine=null;if(candles.length<40||macdData.length<40)return;var n=candles.length;
    var pH1=0,pH1i=0;for(var i=n-5;i<n;i++){if(candles[i].h>pH1){pH1=candles[i].h;pH1i=i;}}
    var pH2=0,pH2i=0;for(var i=n-25;i<n-10;i++){if(candles[i].h>pH2){pH2=candles[i].h;pH2i=i;}}
    if(pH1>pH2&&macdData[pH1i]&&macdData[pH2i]&&macdData[pH1i].v<macdData[pH2i].v){divergences.push({type:'DIVERGENCE BAISSIERE',color:'#f85149',i1:pH2i,i2:pH1i,p1:pH2,p2:pH1});lastDivLine={i1:pH2i,i2:pH1i,color:'#f85149',price:true};}
    var pL1=1e10,pL1i=0;for(var i=n-5;i<n;i++){if(candles[i].l<pL1){pL1=candles[i].l;pL1i=i;}}
    var pL2=1e10,pL2i=0;for(var i=n-25;i<n-10;i++){if(candles[i].l<pL2){pL2=candles[i].l;pL2i=i;}}
    if(pL1<pL2&&macdData[pL1i]&&macdData[pL2i]&&macdData[pL1i].v>macdData[pL2i].v){divergences.push({type:'DIVERGENCE HAUSSIERE',color:'#3fb950',i1:pL2i,i2:pL1i,p1:pL2,p2:pL1});lastDivLine={i1:pL2i,i2:pL1i,color:'#3fb950',price:true};}
}
function updateInfoBar(){
    var n=candles.length,dec=sym.indexOf('frx')>=0?5:1,cp=candles[n-1].c;
    var canalText='--';if(n>=20){var sx=0,sy=0,sxy=0,sx2=0;for(var i=0;i<n;i++){sx+=i;sy+=candles[i].c;sxy+=i*candles[i].c;sx2+=i*i;}var slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);canalText='Canal: '+(slope>0.0001?'HAUSSIER':slope<-0.0001?'BAISSIER':'NEUTRE');}
    document.getElementById('canal').textContent=canalText;
    var srText='';if(lastR)srText='R: '+lastR.price.toFixed(dec);if(lastS)srText+=(srText?' | ':'')+'S: '+lastS.price.toFixed(dec);
    document.getElementById('sr').textContent=srText||'S/R: --';
    var sigText='';if(divergences.length>0)sigText=divergences[0].type;else if(patterns.length>0)sigText=patterns[0].type;
    if(bosSignals.length>0)sigText+=(sigText?' | ':'')+bosSignals[0].type;
    if(chochSignals.length>0)sigText+=(sigText?' | ':'')+chochSignals[0].type;
    document.getElementById('pat').textContent='Signaux: '+(sigText||'Aucun');
    var ppText='';if(pivotLevels)ppText='PP: '+pivotLevels.PP.toFixed(dec);
    var var5=0;if(n>=5){var5=((cp-candles[n-6].c)/candles[n-6].c*100).toFixed(3);}
    document.getElementById('stats').textContent=ppText+' | Var 5: '+var5+'% | '+n+' bougies';
}

window.addEventListener('load',init);
